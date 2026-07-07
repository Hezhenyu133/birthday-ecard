#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { chromium, devices } = require('playwright');

function extractScreenOrder(cardDir) {
  const scriptPath = path.join(cardDir, 'script.js');
  if (!fs.existsSync(scriptPath)) return null;
  const content = fs.readFileSync(scriptPath, 'utf8');
  const match = content.match(/const\s+screenOrder\s*=\s*(\[[^\]]*\])/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].replace(/'/g, '"'));
  } catch (_) {
    return null;
  }
}

function parseArgs(argv) {
  const args = {
    card: './card',
    out: '',
    name: '王总',
    message: '祝您生日快乐，事业长青，生活明亮从容。',
    'viewport-width': '390',
    'viewport-height': '844',
    'video-width': '1170',
    'video-height': '2532',
    'page-seconds': '3.4',
    'tail-seconds': '1.2',
    fps: '30',
    'audio-bitrate': '192k',
    'max-size-mb': '',
    'screen-order': '',
    compact: false,
    'show-controls': false,
    'keep-temp': false
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
  try { return fs.statSync(file).isFile(); } catch (_) { return false; }
}

function dirExists(dir) {
  try { return fs.statSync(dir).isDirectory(); } catch (_) { return false; }
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

function findFFmpeg() {
  const playwrightFfmpeg = path.join(
    process.env.LOCALAPPDATA || path.join(process.env.HOME, '.cache'),
    'ms-playwright',
    'ffmpeg-1011',
    process.platform === 'win32' ? 'ffmpeg-win64.exe' : 'ffmpeg'
  );
  if (fs.existsSync(playwrightFfmpeg)) return playwrightFfmpeg;

  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim().split(/\r?\n/)[0];
  }
  return 'ffmpeg';
}

const FFMPEG = findFFmpeg();

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

function encodeNormal({ webmFile, audioFile, hasAudio, outFile, videoWidth, videoHeight, fps }) {
  const vf = `scale=${videoWidth}:${videoHeight}:flags=lanczos,setsar=1,format=yuv420p`;
  const ffmpegArgs = hasAudio
    ? [
        '-y', '-i', webmFile,
        '-stream_loop', '-1', '-i', audioFile,
        '-map', '0:v:0', '-map', '1:a:0',
        '-vf', vf, '-r', String(fps),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-shortest', '-movflags', '+faststart',
        outFile
      ]
    : [
        '-y', '-i', webmFile,
        '-vf', vf, '-r', String(fps),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outFile
      ];

  console.log(hasAudio ? '合成 MP4 + 音频...' : '合成 MP4...');
  run(FFMPEG, ffmpegArgs);
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
      '-y', '-i', webmFile,
      '-vf', vf, '-r', String(fps),
      '-c:v', 'libx264', '-preset', 'veryslow',
      '-b:v', `${videoKbps}k`, '-maxrate', `${videoKbps}k`,
      '-bufsize', `${videoKbps * 2}k`,
      '-pix_fmt', 'yuv420p',
      '-pass', '1', '-passlogfile', passLog,
      '-an', '-f', 'mp4', nullOutput
    ];

    const pass2Args = hasAudio
      ? [
          '-y', '-i', webmFile,
          '-stream_loop', '-1', '-i', audioFile,
          '-map', '0:v:0', '-map', '1:a:0',
          '-vf', vf, '-r', String(fps),
          '-c:v', 'libx264', '-preset', 'veryslow',
          '-b:v', `${videoKbps}k`, '-maxrate', `${videoKbps}k`,
          '-bufsize', `${videoKbps * 2}k`,
          '-pix_fmt', 'yuv420p',
          '-pass', '2', '-passlogfile', passLog,
          '-c:a', 'aac', '-b:a', `${finalAudioKbps}k`,
          '-ac', '1', '-ar', '44100',
          '-shortest', '-movflags', '+faststart',
          outFile
        ]
      : [
          '-y', '-i', webmFile,
          '-vf', vf, '-r', String(fps),
          '-c:v', 'libx264', '-preset', 'veryslow',
          '-b:v', `${videoKbps}k`, '-maxrate', `${videoKbps}k`,
          '-bufsize', `${videoKbps * 2}k`,
          '-pix_fmt', 'yuv420p',
          '-pass', '2', '-passlogfile', passLog,
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
    console.warn(`警告：已经尽力压缩，但当前大小是 ${mb(finalSize).toFixed(2)}MB，仍高于 ${maxSizeMb}MB。可以再降低 --video-width/--video-height 或 --fps。`);
  }
}

async function recordCard({ cardDir, outFile, name, message, screenOrder, options }) {
  const outDir = path.dirname(outFile);
  const tempDir = path.resolve('./.recording-temp-mobile');
  const videoDir = path.join(tempDir, 'playwright-video');

  const viewportWidth = Math.round(seconds(options['viewport-width'], 390));
  const viewportHeight = Math.round(seconds(options['viewport-height'], 844));
  const maxSizeMb = Number(options['max-size-mb']);
  const compactMode = Boolean(options.compact) || (Number.isFinite(maxSizeMb) && maxSizeMb > 0);

  let videoWidth = Math.round(seconds(options['video-width'], 1170));
  let videoHeight = Math.round(seconds(options['video-height'], 2532));
  let fps = Math.round(seconds(options.fps, 30));

  if (compactMode) {
    if (!options.__provided.has('video-width')) videoWidth = 720;
    if (!options.__provided.has('video-height')) videoHeight = 1558;
    if (!options.__provided.has('fps')) fps = 24;
    if (!options.__provided.has('audio-bitrate')) options['audio-bitrate'] = '48k';
  }

  const pageSeconds = seconds(options['page-seconds'], 3.4);
  const tailSeconds = seconds(options['tail-seconds'], 1.2);

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
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`录制模板：${path.basename(cardDir)}`);
    console.log(`页面顺序：${screenOrder.join(' → ')}`);
    console.log(`打开页面：${url}`);
    console.log(`手机视口：${viewportWidth}x${viewportHeight}，最终视频：${videoWidth}x${videoHeight}`);

    const iPhone = devices['iPhone 13'];
    browser = await chromium.launch({
      headless: true,
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-software-rasterizer'
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

    const page = await context.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (/error|fail|warning/i.test(text)) console.log(`[page:${msg.type()}] ${text}`);
    });

    // Inject script BEFORE page loads to neutralize built-in auto-play
    await page.addInitScript(() => {
      const _origSetTimeout = window.setTimeout;
      const _origSetInterval = window.setInterval;
      window.__recordingAutoPlayTimers = [];
      window.setTimeout = function (fn, delay, ...args) {
        const id = _origSetTimeout.call(window, fn, delay, ...args);
        window.__recordingAutoPlayTimers.push({ type: 'timeout', id });
        return id;
      };
      window.setInterval = function (fn, delay, ...args) {
        const id = _origSetInterval.call(window, fn, delay, ...args);
        window.__recordingAutoPlayTimers.push({ type: 'interval', id });
        return id;
      };
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);
    await waitForImages(page);

    await page.evaluate(({ name, message, showControls }) => {
      document.documentElement.style.background = '#0e1716';
      document.body.style.background = '#0e1716';
      document.body.dataset.recording = '1';

      // Stop all auto-play timers captured before this point
      if (window.__recordingAutoPlayTimers) {
        for (const t of window.__recordingAutoPlayTimers) {
          if (t.type === 'timeout') clearTimeout(t.id);
          else if (t.type === 'interval') clearInterval(t.id);
        }
        window.__recordingAutoPlayTimers = [];
      }

      // Neutralize auto-play functions
      if (typeof window.stopAutoPlay === 'function') window.stopAutoPlay();
      if (typeof window.startAutoPlaySequence === 'function') {
        window.startAutoPlaySequence = function () {};
      }
      if (typeof window.startAutoPlay === 'function') {
        window.startAutoPlay = function () {};
      }
      if (typeof window.isAutoPlaying !== 'undefined') window.isAutoPlaying = false;

      // Restore original setTimeout/setInterval
      if (window._origSetTimeout) window.setTimeout = window._origSetTimeout;
      if (window._origSetInterval) window.setInterval = window._origSetInterval;

      // Reset to first screen
      if (typeof window.showScreen === 'function' && typeof window.screenOrder !== 'undefined' && window.screenOrder.length) {
        window.showScreen(window.screenOrder[0]);
      }

      const nameEl = document.querySelector('.copy-name h2');
      if (nameEl) nameEl.textContent = name;
      const messageEl = document.querySelector('.message-text');
      if (messageEl) messageEl.textContent = message;

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      for (const node of textNodes) {
        node.nodeValue = node.nodeValue.replaceAll('{{name}}', name).replaceAll('{{message}}', message);
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
          body[data-recording="1"] .primary-action {
            display: none !important;
          }
        `}
      `;
      document.head.appendChild(style);
    }, { name, message, showControls: Boolean(options['show-controls']) });

    await page.waitForTimeout(600);

    const durationSeconds = screenOrder.length * pageSeconds + tailSeconds;
    console.log(`开始自动翻页录制，预计视频时长约 ${durationSeconds.toFixed(1)} 秒`);
    for (let i = 0; i < screenOrder.length; i += 1) {
      const screenName = screenOrder[i];
      await page.evaluate((sName) => {
        if (typeof window.showScreen === 'function') {
          window.showScreen(sName);
          return;
        }
        const button = document.querySelector(`[data-jump="${sName}"]`) || document.querySelector(`[data-next="${sName}"]`);
        if (button) button.click();
      }, screenName);
      await page.waitForTimeout(Math.round(pageSeconds * 1000));
    }
    await page.waitForTimeout(Math.round(tailSeconds * 1000));

    await context.close();
    await browser.close();
    browser = null;

    const webmFiles = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm')).map((f) => path.join(videoDir, f));
    if (!webmFiles.length) throw new Error('没有找到 Playwright 录制出来的 webm 文件');
    const webmFile = webmFiles.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

    if (compactMode) {
      const finalMaxSizeMb = Number.isFinite(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : 2;
      encodeCompact({
        webmFile,
        audioFile,
        hasAudio,
        outFile,
        videoWidth,
        videoHeight,
        fps,
        maxSizeMb: finalMaxSizeMb,
        audioKbps: parseBitrateKbps(options['audio-bitrate'], 48),
        durationSeconds,
        tempDir
      });
    } else {
      encodeNormal({ webmFile, audioFile, hasAudio, outFile, videoWidth, videoHeight, fps });
    }

    const finalBytes = fs.statSync(outFile).size;
    console.log(`完成：${outFile}`);
    console.log(`文件大小：${mb(finalBytes).toFixed(2)}MB`);

    if (!options['keep-temp']) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } else {
      console.log(`临时文件保留在：${tempDir}`);
    }
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error(`\n录制失败：${err && err.stack ? err.stack : err}`);
    throw err;
  } finally {
    server.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const provided = args.__provided;

  const cardDir = path.resolve(args.card);
  const outFile = args.out
    ? path.resolve(args.out)
    : path.resolve(`./output/${path.basename(cardDir)}-mobile.mp4`);

  const name = String(args.name || '').trim() || '王总';
  const message = String(args.message || '').trim() || '祝您生日快乐，事业长青，生活明亮从容。';

  let screenOrder;
  if (args['screen-order']) {
    screenOrder = String(args['screen-order']).split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    screenOrder = extractScreenOrder(cardDir);
  }
  if (!screenOrder || !screenOrder.length) {
    screenOrder = ['cover', 'name', 'imprint', 'compass', 'wish', 'message', 'final'];
    console.log(`未能自动检测页面顺序，使用默认顺序：${screenOrder.join(' → ')}`);
  } else {
    console.log(`自动检测到页面顺序：${screenOrder.join(' → ')}`);
  }

  try {
    await recordCard({
      cardDir,
      outFile,
      name,
      message,
      screenOrder,
      options: args
    });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = { recordCard, extractScreenOrder, parseArgs };
