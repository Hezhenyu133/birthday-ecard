#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const CARD_DIR = __dirname;
const OUTPUT_FILE = path.join(CARD_DIR, 'output.mp4');
const TEMP_DIR = path.join(CARD_DIR, '.recording-temp');

const screenOrder = ["cover", "wish", "highlight", "final"];
const PAGE_DURATION = 3; // seconds per page (4 pages = 12s total)
const TAIL_DURATION = 0;
const MAX_SIZE_MB = 2; // 目标文件大小上限

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

      // 特殊处理：允许访问父目录的 logo.svg
      if (pathname === '/logo.svg') {
        const logoPath = path.join(rootDir, '..', 'logo.svg');
        if (fs.existsSync(logoPath)) {
          res.writeHead(200, {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'no-store'
          });
          fs.createReadStream(logoPath).pipe(res);
          return;
        }
      }

      const safePath = path.normalize(path.join(rootDir, pathname));
      if (!safePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(safePath)) {
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
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim().split(/\r?\n/)[0];
  }

  const playwrightFfmpeg = path.join(
    process.env.LOCALAPPDATA || path.join(process.env.HOME, '.cache'),
    'ms-playwright',
    'ffmpeg-1011',
    process.platform === 'win32' ? 'ffmpeg-win64.exe' : 'ffmpeg'
  );
  if (fs.existsSync(playwrightFfmpeg)) return playwrightFfmpeg;

  return 'ffmpeg';
}

const FFMPEG = findFFmpeg();

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} exited with code ${result.status}`);
}

async function record() {
  const videoDir = path.join(TEMP_DIR, 'playwright-video');
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(videoDir, { recursive: true });

  const audioFile = path.join(CARD_DIR, 'assets', 'music.mp3');
  const hasAudio = fs.existsSync(audioFile);

  const { server, port } = await createStaticServer(CARD_DIR);
  const url = `http://127.0.0.1:${port}/index.html?recording=1`;

  let browser;
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`录制模板：${path.basename(CARD_DIR)}`);
    console.log(`页面顺序：${screenOrder.join(' → ')}`);
    console.log(`打开页面：${url}`);

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
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'zh-CN',
      recordVideo: {
        dir: videoDir,
        size: { width: 390, height: 844 }
      }
    });

    const page = await context.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (/error|fail|warning/i.test(text)) console.log(`[page:${msg.type()}] ${text}`);
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      document.documentElement.style.background = '#0e1716';
      document.body.style.background = '#0e1716';
      document.body.dataset.recording = '1';

      if (typeof window.stopAutoPlay === 'function') window.stopAutoPlay();
      if (typeof window.startAutoPlaySequence === 'function') {
        window.startAutoPlaySequence = function () {};
      }
      if (typeof window.startAutoPlay === 'function') {
        window.startAutoPlay = function () {};
      }
      if (typeof window.isAutoPlaying !== 'undefined') window.isAutoPlaying = false;

      if (typeof window.showScreen === 'function' && typeof window.screenOrder !== 'undefined' && window.screenOrder.length) {
        window.showScreen(window.screenOrder[0]);
      }

      const style = document.createElement('style');
      style.textContent = `
        html, body, .card-app { width: 100vw !important; height: 100vh !important; min-height: 100vh !important; overflow: hidden !important; }
        body[data-recording="1"] { margin: 0 !important; }
        body[data-recording="1"] .screen { transform: translate3d(0, 22px, 0); }
        body[data-recording="1"] .screen.active { transform: translate3d(0, 0, 0); }
        body[data-recording="1"] .music-toggle,
        body[data-recording="1"] .page-progress,
        body[data-recording="1"] .primary-action {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    });

    await page.waitForTimeout(600);

    console.log(`开始自动翻页录制，预计视频时长约 ${(screenOrder.length * PAGE_DURATION + TAIL_DURATION).toFixed(1)} 秒`);

    for (let i = 0; i < screenOrder.length; i += 1) {
      const screenName = screenOrder[i];
      await page.evaluate((sName) => {
        if (typeof window.showScreen === 'function') {
          window.showScreen(sName);
        }
      }, screenName);
      await page.waitForTimeout(Math.round(PAGE_DURATION * 1000));
    }
    await page.waitForTimeout(Math.round(TAIL_DURATION * 1000));

    await context.close();
    await browser.close();
    browser = null;

    const webmFiles = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm')).map((f) => path.join(videoDir, f));
    if (!webmFiles.length) throw new Error('没有找到 Playwright 录制出来的 webm 文件');
    const webmFile = webmFiles.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

    const durationSeconds = screenOrder.length * PAGE_DURATION + TAIL_DURATION;
    const maxBytes = MAX_SIZE_MB * 1000 * 1000;
    const safeTotalKbps = Math.max(220, Math.floor((MAX_SIZE_MB * 8000 * 0.90) / durationSeconds));
    const audioKbps = hasAudio ? Math.min(48, Math.max(32, safeTotalKbps - 180)) : 0;
    let videoKbps = Math.max(160, safeTotalKbps - audioKbps);

    console.log(`小体积模式：目标 ≤ ${MAX_SIZE_MB}MB，预计时长 ${durationSeconds.toFixed(1)}s`);
    console.log(`编码参数：720x1558 / 24fps / 视频约 ${videoKbps}k / 音频 ${hasAudio ? `${audioKbps}k mono` : '无'}`);

    const vf = `scale=720:1558:flags=lanczos,setsar=1,format=yuv420p`;
    const nullOutput = process.platform === 'win32' ? 'NUL' : '/dev/null';
    const passLog = path.join(TEMP_DIR, 'ffmpeg-passlog');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try { fs.unlinkSync(OUTPUT_FILE); } catch (_) {}
      for (const f of [passLog + '-0.log', passLog + '-0.log.mbtree', passLog + '.log', passLog + '.log.mbtree']) {
        try { fs.unlinkSync(f); } catch (_) {}
      }

      const pass1Args = [
        '-y', '-i', webmFile,
        '-vf', vf, '-r', '24',
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
            '-vf', vf, '-r', '24',
            '-c:v', 'libx264', '-preset', 'veryslow',
            '-b:v', `${videoKbps}k`, '-maxrate', `${videoKbps}k`,
            '-bufsize', `${videoKbps * 2}k`,
            '-pix_fmt', 'yuv420p',
            '-pass', '2', '-passlogfile', passLog,
            '-c:a', 'aac', '-b:a', `${audioKbps}k`,
            '-ac', '1', '-ar', '44100',
            '-shortest', '-movflags', '+faststart',
            OUTPUT_FILE
          ]
        : [
            '-y', '-i', webmFile,
            '-vf', vf, '-r', '24',
            '-c:v', 'libx264', '-preset', 'veryslow',
            '-b:v', `${videoKbps}k`, '-maxrate', `${videoKbps}k`,
            '-bufsize', `${videoKbps * 2}k`,
            '-pix_fmt', 'yuv420p',
            '-pass', '2', '-passlogfile', passLog,
            '-movflags', '+faststart',
            OUTPUT_FILE
          ];

      console.log(`两遍压缩编码，第 ${attempt} 次...`);
      run(FFMPEG, pass1Args);
      run(FFMPEG, pass2Args);

      const size = fs.statSync(OUTPUT_FILE).size;
      console.log(`当前文件大小：${(size / 1000 / 1000).toFixed(2)}MB`);
      if (size <= maxBytes) {
        console.log(`已压到 ${MAX_SIZE_MB}MB 以内。`);
        break;
      }

      const factor = Math.max(0.55, Math.min(0.88, (maxBytes / size) * 0.92));
      videoKbps = Math.max(120, Math.floor(videoKbps * factor));
      console.log(`仍然偏大，降低视频码率到约 ${videoKbps}k 后重试。`);
    }

    const finalSize = fs.statSync(OUTPUT_FILE).size;
    if (finalSize > maxBytes) {
      console.warn(`警告：已经尽力压缩，但当前大小是 ${(finalSize / 1000 / 1000).toFixed(2)}MB，仍高于 ${MAX_SIZE_MB}MB。`);
    }

    const finalBytes = fs.statSync(OUTPUT_FILE).size;
    console.log(`完成：${OUTPUT_FILE}`);
    console.log(`文件大小：${(finalBytes / 1000 / 1000).toFixed(2)}MB`);

    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error(`\n录制失败：${err && err.stack ? err.stack : err}`);
    throw err;
  } finally {
    server.close();
  }
}

record().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
