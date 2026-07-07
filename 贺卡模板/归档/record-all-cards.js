#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { chromium, devices } = require('playwright');

// 模板配置：页面顺序和总时长
const TEMPLATE_CONFIGS = {
  '4page': {
    screens: ['cover', 'wish', 'highlight', 'final'],
    totalDuration: 13 // 秒
  },
  '7page': {
    screens: ['cover', 'identity', 'message', 'honor', 'reflection', 'signoff', 'final'],
    totalDuration: 26 // 秒
  },
  '7page-archive': {
    screens: ['cover', 'name', 'imprint', 'compass', 'wish', 'message', 'final'],
    totalDuration: 26 // 秒
  }
};

// 模板目录到配置的映射
const TEMPLATE_MAP = {
  'birthday-card-13-employee-warm-image': '4page',
  'birthday-card-14-executive-night-image': '4page',
  'birthday-card-15-executive-private-banquet': '7page',
  'birthday-card-16-executive-honor-gallery': '7page',
  'birthday-card-17-executive-time-archive': '7page-archive'
};

function parseArgs(argv) {
  const args = {
    card: '',
    out: '',
    name: '寿星',
    message: '愿你新的一岁沉稳、明亮，也拥有更多值得被珍藏的瞬间。',
    'viewport-width': '390',
    'viewport-height': '844',
    'video-width': '720',
    'video-height': '1558',
    fps: '24',
    'audio-bitrate': '48k',
    'max-size-mb': '2',
    'show-controls': false,
    'keep-temp': false,
    'all': false
  };
  const provided = new Set();

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    provided.add(key);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  args.__provided = provided;
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fileExists(file) {
  try {
    return fs.statSync(file).isFile();
  } catch (_) {
    return false;
  }
}

function dirExists(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch (_) {
    return false;
  }
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.json': 'application/json; charset=utf-8'
  }[ext] || 'application/octet-stream';
}

function createStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    try {
      const rawUrl = new URL(req.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(rawUrl.pathname);
      if (pathname === '/') pathname = '/index.html';

      const safePath = path.normalize(path.join(rootDir, pathname));
      if (!safePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fileExists(safePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, {
        'Content-Type': mimeType(safePath),
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(safePath).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err && err.message ? err.message : err));
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} exited with code ${result.status}`);
}

function seconds(n, fallback) {
  const value = Number(n);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseBitrateKbps(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value || '').trim().toLowerCase();
  if (!s) return fallback;
  const m = s.match(/^([0-9.]+)\s*([km]?)$/);
  if (!m) return fallback;
  const num = Number(m[1]);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return m[2] === 'm' ? Math.round(num * 1000) : Math.round(num);
}

function mb(bytes) {
  return bytes / 1000 / 1000;
}

async function waitForImages(page) {
  await page.evaluate(async () => {
    const imgs = Array.from(document.images || []);
    await Promise.all(imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready.catch(() => {});
    }
  });
}

function encodeCompact({ webmFile, audioFile, hasAudio, outFile, videoWidth, videoHeight, fps, maxSizeMb, audioKbps, durationSeconds, tempDir }) {
  const maxBytes = Math.floor(maxSizeMb * 1000 * 1000);
  const nullOutput = process.platform === 'win32' ? 'NUL' : '/dev/null';
  const vf = `scale=${videoWidth}:${videoHeight}:flags=lanczos,setsar=1,format=yuv420p`;

  const safeTotalKbps = Math.max(220, Math.floor((maxSizeMb * 8000 * 0.90) / durationSeconds));
  const finalAudioKbps = hasAudio ? Math.min(audioKbps, Math.max(32, safeTotalKbps - 180)) : 0;
  let videoKbps = Math.max(160, safeTotalKbps - finalAudioKbps);
  const passLog = path.join(tempDir, 'ffmpeg-compact-passlog');

  console.log(`小体积模式：目标 ≤ ${maxSizeMb}MB，预计时长 ${durationSeconds.toFixed(1)}s`);
  console.log(`编码参数：${videoWidth}x${videoHeight} / ${fps}fps / 视频约 ${videoKbps}k / 音频 ${hasAudio ? `${finalAudioKbps}k mono` : '无'}`);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { fs.unlinkSync(outFile); } catch (_) {}
    for (const f of [passLog + '-0.log', passLog + '-0.log.mbtree', passLog + '.log', passLog + '.log.mbtree']) {
      try { fs.unlinkSync(f); } catch (_) {}
    }

    const pass1Args = [
      '-y',
      '-i', webmFile,
      '-vf', vf,
      '-r', String(fps),
      '-c:v', 'libx264',
      '-preset', 'veryslow',
      '-b:v', `${videoKbps}k`,
      '-maxrate', `${videoKbps}k`,
      '-bufsize', `${videoKbps * 2}k`,
      '-pix_fmt', 'yuv420p',
      '-pass', '1',
      '-passlogfile', passLog,
      '-an',
      '-f', 'mp4',
      nullOutput
    ];

    const pass2Args = hasAudio
      ? [
          '-y',
          '-i', webmFile,
          '-stream_loop', '-1',
          '-i', audioFile,
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-vf', vf,
          '-r', String(fps),
          '-c:v', 'libx264',
          '-preset', 'veryslow',
          '-b:v', `${videoKbps}k`,
          '-maxrate', `${videoKbps}k`,
          '-bufsize', `${videoKbps * 2}k`,
          '-pix_fmt', 'yuv420p',
          '-pass', '2',
          '-passlogfile', passLog,
          '-c:a', 'aac',
          '-b:a', `${finalAudioKbps}k`,
          '-ac', '1',
          '-ar', '44100',
          '-shortest',
          '-movflags', '+faststart',
          outFile
        ]
      : [
          '-y',
          '-i', webmFile,
          '-vf', vf,
          '-r', String(fps),
          '-c:v', 'libx264',
          '-preset', 'veryslow',
          '-b:v', `${videoKbps}k`,
          '-maxrate', `${videoKbps}k`,
          '-bufsize', `${videoKbps * 2}k`,
          '-pix_fmt', 'yuv420p',
          '-pass', '2',
          '-passlogfile', passLog,
          '-movflags', '+faststart',
          outFile
        ];

    console.log(`两遍压缩编码，第 ${attempt} 次...`);
    run('ffmpeg', pass1Args);
    run('ffmpeg', pass2Args);

    const size = fs.statSync(outFile).size;
    console.log(`当前文件大小：${mb(size).toFixed(2)}MB`);
    if (size <= maxBytes) {
      console.log(`已压到 ${maxSizeMb}MB 以内。`);
      return;
    }

    const factor = Math.max(0.55, Math.min(0.88, (maxBytes / size) * 0.92));
    videoKbps = Math.max(120, Math.floor(videoKbps * factor));
    console.log(`仍然偏大，降低视频码率到约 ${videoKbps}k 后重试。`);
  }

  const finalSize = fs.statSync(outFile).size;
  if (finalSize > maxBytes) {
    console.warn(`警告：已经尽力压缩，但当前大小是 ${mb(finalSize).toFixed(2)}MB，仍高于 ${maxSizeMb}MB。`);
  }
}

function detectTemplateType(cardDir) {
  const dirName = path.basename(cardDir);
  return TEMPLATE_MAP[dirName] || null;
}

async function recordCard(cardDir, args) {
  const templateType = detectTemplateType(cardDir);
  if (!templateType) {
    throw new Error(`无法识别模板类型：${path.basename(cardDir)}`);
  }

  const config = TEMPLATE_CONFIGS[templateType];
  const pageSeconds = config.totalDuration / config.screens.length;
  
  const outFile = args.out || path.join('./output', `${path.basename(cardDir)}.mp4`);
  const outDir = path.dirname(outFile);
  const tempDir = path.resolve('./.recording-temp-mobile');
  const videoDir = path.join(tempDir, 'playwright-video');

  const viewportWidth = Math.round(seconds(args['viewport-width'], 390));
  const viewportHeight = Math.round(seconds(args['viewport-height'], 844));
  const videoWidth = Math.round(seconds(args['video-width'], 720));
  const videoHeight = Math.round(seconds(args['video-height'], 1558));
  const fps = Math.round(seconds(args.fps, 24));
  const maxSizeMb = Number(args['max-size-mb']) || 2;
  const name = String(args.name || '').trim() || '寿星';
  const message = String(args.message || '').trim() || '愿你新的一岁沉稳、明亮，也拥有更多值得被珍藏的瞬间。';

  if (!dirExists(cardDir)) throw new Error(`找不到 H5 目录：${cardDir}`);
  if (!fileExists(path.join(cardDir, 'index.html'))) throw new Error(`H5 目录里没有 index.html：${cardDir}`);

  ensureDir(outDir);
  fs.rmSync(tempDir, { recursive: true, force: true });
  ensureDir(videoDir);

  const audioFile = path.join(cardDir, 'assets', 'music.mp3');
  const hasAudio = fileExists(audioFile);

  const { server, port } = await createStaticServer(cardDir);
  const url = `http://127.0.0.1:${port}/index.html?recording=1`;

  let browser;
  let page;
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`录制模板：${path.basename(cardDir)}`);
    console.log(`模板类型：${templateType} (${config.screens.length}页，${config.totalDuration}秒)`);
    console.log(`打开页面：${url}`);
    console.log(`手机视口：${viewportWidth}x${viewportHeight}，最终视频：${videoWidth}x${videoHeight}`);

    const iPhone = devices['iPhone 13'];
    browser = await chromium.launch({
      headless: true,
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    });

    const context = await browser.newContext({
      ...iPhone,
      viewport: { width: viewportWidth, height: viewportHeight },
      screen: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor: Math.max(1, Math.min(3, videoWidth / viewportWidth)),
      isMobile: true,
      hasTouch: true,
      locale: 'zh-CN',
      recordVideo: {
        dir: videoDir,
        size: { width: viewportWidth, height: viewportHeight }
      }
    });

    page = await context.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (/error|fail|warning/i.test(text)) console.log(`[page:${msg.type()}] ${text}`);
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);
    await waitForImages(page);

    await page.evaluate(({ name, message, showControls }) => {
      document.documentElement.style.background = '#0e1716';
      document.body.style.background = '#0e1716';
      document.body.dataset.recording = '1';

      // 替换变量
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      for (const node of textNodes) {
        let text = node.nodeValue;
        text = text.replaceAll('{{name}}', name);
        text = text.replaceAll('{{message}}', message);
        text = text.replaceAll('{{sender}}', '信阳移动公司工会');
        // 替换日期变量
        const now = new Date();
        text = text.replaceAll('{{year}}', now.getFullYear());
        text = text.replaceAll('{{month}}', now.getMonth() + 1);
        text = text.replaceAll('{{day}}', now.getDate());
        node.nodeValue = text;
      }

      const style = document.createElement('style');
      style.textContent = `
        html, body, .card-app { width: 100vw !important; height: 100vh !important; min-height: 100vh !important; overflow: hidden !important; }
        body[data-recording="1"] { margin: 0 !important; }
        body[data-recording="1"] .screen { transform: translate3d(0, 22px, 0); }
        body[data-recording="1"] .screen.active { transform: translate3d(0, 0, 0); }
        ${showControls ? '' : `
          body[data-recording="1"] .music-toggle,
          body[data-recording="1"] .page-progress,
          body[data-recording="1"] .page-dots,
          body[data-recording="1"] .primary-action {
            display: none !important;
          }
        `}
      `;
      document.head.appendChild(style);
    }, { name, message, showControls: Boolean(args['show-controls']) });

    await page.waitForTimeout(600);

    const durationSeconds = config.totalDuration;
    console.log(`开始自动翻页录制，预计视频时长约 ${durationSeconds.toFixed(1)} 秒`);
    
    for (let i = 0; i < config.screens.length; i += 1) {
      const screenName = config.screens[i];
      console.log(`  第 ${i + 1}/${config.screens.length} 页：${screenName}`);
      
      await page.evaluate((name) => {
        // 优先使用 showScreen 函数
        if (typeof window.showScreen === 'function') {
          window.showScreen(name);
          return;
        }
        // 备选：点击导航按钮
        const button = document.querySelector(`[data-jump="${name}"]`) || document.querySelector(`[data-next="${name}"]`);
        if (button) button.click();
      }, screenName);
      
      await page.waitForTimeout(Math.round(pageSeconds * 1000));
    }

    await context.close();
    await browser.close();
    browser = null;

    const webmFiles = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm')).map((f) => path.join(videoDir, f));
    if (!webmFiles.length) throw new Error('没有找到 Playwright 录制出来的 webm 文件');
    const webmFile = webmFiles.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

    encodeCompact({
      webmFile,
      audioFile,
      hasAudio,
      outFile,
      videoWidth,
      videoHeight,
      fps,
      maxSizeMb,
      audioKbps: parseBitrateKbps(args['audio-bitrate'], 48),
      durationSeconds,
      tempDir
    });

    const finalBytes = fs.statSync(outFile).size;
    console.log(`完成：${outFile}`);
    console.log(`文件大小：${mb(finalBytes).toFixed(2)}MB`);

    if (!args['keep-temp']) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    return { outFile, size: finalBytes };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    throw err;
  } finally {
    server.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const basePath = path.resolve(__dirname, '..');
  
  if (args.all) {
    // 录制所有模板
    const templates = Object.keys(TEMPLATE_MAP);
    console.log(`准备录制 ${templates.length} 个模板...`);
    
    const results = [];
    for (const template of templates) {
      const cardDir = path.join(basePath, template);
      if (!dirExists(cardDir)) {
        console.warn(`跳过不存在的模板：${template}`);
        continue;
      }
      try {
        const result = await recordCard(cardDir, args);
        results.push({ template, ...result });
      } catch (err) {
        console.error(`\n录制失败 [${template}]：${err.message}`);
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('录制完成汇总：');
    for (const r of results) {
      console.log(`  ${r.template}: ${r.outFile} (${mb(r.size).toFixed(2)}MB)`);
    }
  } else if (args.card) {
    // 录制单个模板
    const cardDir = path.resolve(args.card);
    try {
      await recordCard(cardDir, args);
    } catch (err) {
      console.error(`\n录制失败：${err.message}`);
      process.exitCode = 1;
    }
  } else {
    console.log(`
用法：
  node record-all-cards.js --all                    # 录制所有模板
  node record-all-cards.js --card ./path/to/card    # 录制单个模板

常用参数：
  --card            H5 贺卡目录
  --out             输出 MP4 路径（默认 ./output/<模板名>.mp4）
  --name            替换 {{name}}，默认 "寿星"
  --message         替换 {{message}}
  --max-size-mb     目标文件大小上限，默认 2MB
  --show-controls   录制时保留按钮和导航
  --keep-temp       保留临时文件
`);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
