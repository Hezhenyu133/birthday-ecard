#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const { spawn, execFile } = require('child_process');

const SCREEN_ORDER = ['cover', 'name', 'imprint', 'compass', 'wish', 'message', 'final'];

function parseArgs(argv) {
  const args = {
    card: './card',
    out: './output/birthday-card.mp4',
    width: 1080,
    height: 1920,
    pageSeconds: 3.4,
    tailSeconds: 1.2,
    fps: 30,
    name: '寿星',
    message: '愿你新的一岁沉稳、明亮，也拥有更多值得被珍藏的瞬间。',
    hideControls: true,
    audio: '',
    chromium: '',
    keepTemp: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    const readValue = () => {
      if (next === undefined || next.startsWith('--')) throw new Error(`参数 ${token} 缺少值`);
      i += 1;
      return next;
    };

    if (token === '--card') args.card = readValue();
    else if (token === '--out') args.out = readValue();
    else if (token === '--width') args.width = Number(readValue());
    else if (token === '--height') args.height = Number(readValue());
    else if (token === '--page-seconds') args.pageSeconds = Number(readValue());
    else if (token === '--tail-seconds') args.tailSeconds = Number(readValue());
    else if (token === '--fps') args.fps = Number(readValue());
    else if (token === '--name') args.name = readValue();
    else if (token === '--message') args.message = readValue();
    else if (token === '--audio') args.audio = readValue();
    else if (token === '--chromium') args.chromium = readValue();
    else if (token === '--show-controls') args.hideControls = false;
    else if (token === '--keep-temp') args.keepTemp = true;
    else if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`未知参数：${token}`);
    }
  }

  for (const key of ['width', 'height', 'pageSeconds', 'tailSeconds', 'fps']) {
    if (!Number.isFinite(args[key]) || args[key] <= 0) throw new Error(`参数 ${key} 必须是正数`);
  }
  return args;
}

function printHelp() {
  console.log(`
用法：
  node record-card.js --card ./card --out ./output/birthday.mp4

常用参数：
  --card            H5 贺卡目录，目录里要有 index.html
  --out             输出 MP4 路径
  --name            替换页面里的 {{name}}
  --message         替换页面里的 {{message}}
  --width           视频宽度，默认 1080
  --height          视频高度，默认 1920
  --page-seconds    每页停留秒数，默认 3.4
  --tail-seconds    最后一页额外停留秒数，默认 1.2
  --fps             输出帧率，默认 30
  --audio           指定音频文件，默认使用 H5 目录下 assets/music.mp3
  --show-controls   录制时保留按钮、音乐开关和底部进度条
  --chromium        指定本机 Chrome/Chromium 路径，通常不需要
  --keep-temp       保留临时 WebM 文件，方便排查
`);
}

function checkFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} 不存在：${filePath}`);
}

function safeResolve(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, '');
  const resolved = path.resolve(root, normalized || 'index.html');
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) return null;
  return resolved;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
  };
  return map[ext] || 'application/octet-stream';
}

function startStaticServer(cardRoot) {
  const server = http.createServer((req, res) => {
    try {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      let filePath = safeResolve(cardRoot, reqUrl.pathname);
      if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType(filePath),
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err && err.message ? err.message : err));
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} 执行失败，退出码 ${code}\n${stderr || stdout}`));
    });
  });
}

function execFilePromise(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) reject(new Error(`${command} 不可用：${stderr || error.message}`));
      else resolve(stdout);
    });
  });
}

async function ensureFfmpeg() {
  await execFilePromise('ffmpeg', ['-version']);
}

async function preparePage(page, opts) {
  await page.addStyleTag({
    content: `
      html, body { cursor: none !important; }
      ${opts.hideControls ? `
      .music-toggle,
      .page-progress,
      .primary-action { opacity: 0 !important; pointer-events: none !important; }
      ` : ''}
    `
  });

  await page.evaluate(async ({ name, message }) => {
    document.body.classList.add('recording-capture');

    for (const img of Array.from(document.images)) {
      img.loading = 'eager';
    }

    const replacements = {
      '{{name}}': name || '',
      '{{message}}': message || ''
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      let text = node.nodeValue || '';
      for (const [from, to] of Object.entries(replacements)) text = text.split(from).join(to);
      node.nodeValue = text;
      node = walker.nextNode();
    }

    if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
    await Promise.all(Array.from(document.images).map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      if (img.decode) return img.decode().catch(() => {});
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
  }, { name: opts.name, message: opts.message });
}

async function showScreen(page, screenName) {
  await page.evaluate((name) => {
    if (typeof window.showScreen === 'function') {
      window.showScreen(name);
      return;
    }
    document.querySelectorAll('.screen').forEach((screen) => {
      screen.classList.toggle('active', screen.dataset.screen === name);
    });
    document.querySelectorAll('.progress-segment').forEach((segment) => {
      segment.classList.toggle('is-active', segment.dataset.jump === name);
    });
  }, screenName);
}

async function recordRawVideo(opts, url, tempDir) {
  const { chromium } = require('playwright');

  const browser = await chromium.launch({
    headless: true,
    executablePath: opts.chromium || undefined,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--mute-audio=false'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    screen: { width: opts.width, height: opts.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    javaScriptEnabled: true,
    recordVideo: {
      dir: tempDir,
      size: { width: opts.width, height: opts.height }
    }
  });

  const page = await context.newPage();
  const startedAt = Date.now();
  console.log(`打开页面：${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  await preparePage(page, opts);
  await showScreen(page, 'cover');

  const trimStart = Math.max(0, (Date.now() - startedAt) / 1000);
  const timelineSeconds = SCREEN_ORDER.length * opts.pageSeconds + opts.tailSeconds;

  console.log(`开始自动翻页录制，预计视频时长约 ${timelineSeconds.toFixed(1)} 秒`);
  for (const screenName of SCREEN_ORDER) {
    await showScreen(page, screenName);
    await page.waitForTimeout(opts.pageSeconds * 1000);
  }
  await page.waitForTimeout(opts.tailSeconds * 1000);

  const video = page.video();
  await context.close();
  await browser.close();
  const rawVideoPath = await video.path();
  return { rawVideoPath, trimStart, timelineSeconds };
}

async function muxVideoAndAudio({ rawVideoPath, audioPath, outputPath, trimStart, duration, fps }) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const args = [
    '-y',
    '-ss', trimStart.toFixed(3),
    '-i', rawVideoPath,
    '-stream_loop', '-1',
    '-i', audioPath,
    '-t', duration.toFixed(3),
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-vf', `fps=${fps},format=yuv420p`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    outputPath
  ];
  console.log('合成 MP4 + 音频...');
  await run('ffmpeg', args);
}

async function main() {
  const opts = parseArgs(process.argv);
  const cardRoot = path.resolve(process.cwd(), opts.card);
  const indexPath = path.join(cardRoot, 'index.html');
  const outputPath = path.resolve(process.cwd(), opts.out);
  const audioPath = path.resolve(process.cwd(), opts.audio || path.join(cardRoot, 'assets', 'music.mp3'));
  const tempDir = path.resolve(process.cwd(), '.recording-temp');

  checkFileExists(indexPath, 'index.html');
  checkFileExists(audioPath, '音频文件');
  await ensureFfmpeg();
  fs.mkdirSync(tempDir, { recursive: true });

  let serverInfo;
  try {
    serverInfo = await startStaticServer(cardRoot);
    const url = `http://127.0.0.1:${serverInfo.port}/index.html?recording=1`;
    const { rawVideoPath, trimStart, timelineSeconds } = await recordRawVideo(opts, url, tempDir);
    await muxVideoAndAudio({
      rawVideoPath,
      audioPath,
      outputPath,
      trimStart,
      duration: timelineSeconds,
      fps: opts.fps
    });
    if (!opts.keepTemp) fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`完成：${outputPath}`);
  } finally {
    if (serverInfo && serverInfo.server) {
      await new Promise((resolve) => serverInfo.server.close(resolve));
    }
  }
}

main().catch((err) => {
  console.error(`\n录制失败：${err.message}\n`);
  process.exit(1);
});
