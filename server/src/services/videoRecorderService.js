/**
 * 视频录制服务
 * 使用 Playwright 录制 HTML 贺卡为视频，并用 ffmpeg 压缩
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import http from 'http';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取 MIME 类型
 */
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

/**
 * 创建静态文件服务器
 */
function createStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    try {
      const rawUrl = new URL(req.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(rawUrl.pathname);
      if (pathname === '/') pathname = '/index.html';

      // 特殊处理：允许访问父目录的 music 目录
      if (pathname.startsWith('/music/')) {
        const musicPath = path.join(rootDir, '..', pathname);
        const safeMusicPath = path.normalize(musicPath);
        const musicDir = path.join(rootDir, '..', 'music');
        if (safeMusicPath.startsWith(musicDir) && fsSync.existsSync(safeMusicPath)) {
          res.writeHead(200, {
            'Content-Type': mimeType(safeMusicPath),
            'Cache-Control': 'no-store'
          });
          fsSync.createReadStream(safeMusicPath).pipe(res);
          return;
        }
      }

      const safePath = path.normalize(path.join(rootDir, pathname));
      if (!safePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fsSync.existsSync(safePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, {
        'Content-Type': mimeType(safePath),
        'Cache-Control': 'no-store'
      });
      fsSync.createReadStream(safePath).pipe(res);
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

/**
 * 查找 ffmpeg 路径
 */
function findFFmpeg() {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim().split(/\r?\n/)[0];
  }

  const playwrightFfmpeg = path.join(
    process.env.LOCALAPPDATA || path.join(process.env.HOME || '', '.cache'),
    'ms-playwright',
    'ffmpeg-1011',
    process.platform === 'win32' ? 'ffmpeg-win64.exe' : 'ffmpeg'
  );
  if (fsSync.existsSync(playwrightFfmpeg)) return playwrightFfmpeg;

  return 'ffmpeg';
}

const FFMPEG = findFFmpeg();

/**
 * 运行命令
 */
function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} exited with code ${result.status}`);
}

/**
 * 录制视频
 * @param {object} options
 * @param {string} options.personalizedHtml - 已替换占位符的 HTML 内容
 * @param {object} options.recordConfig - 录制配置（从 videoTemplates.js 获取）
 * @param {string} options.outputDir - 输出目录
 * @param {string} options.cardId - 卡片 ID
 * @returns {Promise<{videoPath: string, size: number}>}
 */
export const recordVideo = async ({ personalizedHtml, recordConfig, outputDir, cardId }) => {
  const { chromium } = await import('playwright');
  
  const tempDir = path.join(config.video?.tempDir || './.video-temp', cardId);
  const videoDir = path.join(tempDir, 'playwright-video');
  
  // 创建临时目录
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(videoDir, { recursive: true });
  
  // 写入 HTML
  const htmlPath = path.join(tempDir, 'index.html');
  await fs.writeFile(htmlPath, personalizedHtml, 'utf-8');
  
  // 检查音频文件
  const audioFile = path.join(__dirname, '../data/music/music.mp3');
  const hasAudio = fsSync.existsSync(audioFile);
  
  // 启动静态服务器
  const { server, port } = await createStaticServer(tempDir);
  const url = `http://127.0.0.1:${port}/index.html?recording=1`;
  
  let browser;
  const { screenOrder, pageDuration, maxSizeMb } = recordConfig;
  const tailDuration = 0;
  
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`开始录制视频，卡片ID: ${cardId}`);
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
    
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    
    // 等待模板脚本执行完毕（大型 HTML 含 base64 图片需要较长解析时间）
    await page.waitForFunction(() => typeof window.showScreen === 'function', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    
    // 设置录制模式
    await page.evaluate(() => {
      document.documentElement.style.background = '#0e1716';
      document.body.style.background = '#0e1716';
      document.body.dataset.recording = '1';

      // 停止自动播放
      if (typeof window.stopAutoPlay === 'function') window.stopAutoPlay();
      if (typeof window.isAutoPlaying !== 'undefined') window.isAutoPlaying = false;

      // 覆盖自动播放函数防止重启
      if (typeof window.startAutoPlaySequence === 'function') {
        window.startAutoPlaySequence = function () {};
      }
      if (typeof window.startAutoPlay === 'function') {
        window.startAutoPlay = function () {};
      }

      // 重置到第一屏
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
    
    console.log(`开始自动翻页录制，预计视频时长约 ${(screenOrder.length * pageDuration + tailDuration).toFixed(1)} 秒`);
    
    // 按顺序切换页面
    for (let i = 0; i < screenOrder.length; i += 1) {
      const screenName = screenOrder[i];
      await page.evaluate((sName) => {
        if (typeof window.showScreen === 'function') {
          window.showScreen(sName);
        }
      }, screenName);
      await page.waitForTimeout(Math.round(pageDuration * 1000));
    }
    await page.waitForTimeout(Math.round(tailDuration * 1000));
    
    await context.close();
    await browser.close();
    browser = null;
    
    // 查找录制的 webm 文件
    const webmFiles = (await fs.readdir(videoDir)).filter(f => f.endsWith('.webm')).map(f => path.join(videoDir, f));
    if (!webmFiles.length) throw new Error('没有找到 Playwright 录制出来的 webm 文件');
    
    const webmStats = await Promise.all(webmFiles.map(f => fs.stat(f)));
    const rawWebmFile = webmFiles[webmStats.reduce((maxI, stat, i, arr) => stat.mtimeMs > arr[maxI].mtimeMs ? i : maxI, 0)];

    // 先剥离webm中可能存在的音频轨道，确保只有纯视频
    // 这样无论模板Audio是否被录进webm，最终编码时都不会叠加模板音乐
    const silentWebmFile = path.join(tempDir, 'silent.webm');
    console.log('剥离webm音频轨道...');
    run(FFMPEG, ['-y', '-i', rawWebmFile, '-c:v', 'copy', '-an', silentWebmFile]);
    const webmFile = silentWebmFile;
    
    // 计算编码参数
    const durationSeconds = screenOrder.length * pageDuration + tailDuration;
    const maxBytes = maxSizeMb * 1000 * 1000;
    const safeTotalKbps = Math.max(220, Math.floor((maxSizeMb * 8000 * 0.90) / durationSeconds));
    const audioKbps = hasAudio ? Math.min(48, Math.max(32, safeTotalKbps - 180)) : 0;
    let videoKbps = Math.max(160, safeTotalKbps - audioKbps);
    
    console.log(`小体积模式：目标 ≤ ${maxSizeMb}MB，预计时长 ${durationSeconds.toFixed(1)}s`);
    console.log(`编码参数：720x1558 / 24fps / 视频约 ${videoKbps}k / 音频 ${hasAudio ? `${audioKbps}k mono` : '无'}`);
    
    const outputPath = path.join(outputDir, `${cardId}.mp4`);
    await fs.mkdir(outputDir, { recursive: true });
    
    const vf = `scale=720:1558:flags=lanczos,setsar=1,format=yuv420p`;
    const nullOutput = process.platform === 'win32' ? 'NUL' : '/dev/null';
    const passLog = path.join(tempDir, 'ffmpeg-passlog');
    
    // 确保输出目录存在
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try { await fs.unlink(outputPath); } catch (_) {}
      for (const f of [passLog + '-0.log', passLog + '-0.log.mbtree', passLog + '.log', passLog + '.log.mbtree']) {
        try { await fs.unlink(f); } catch (_) {}
      }
      
      // Pass 1
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
      
      // Pass 2
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
            outputPath
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
            outputPath
          ];
      
      console.log(`两遍压缩编码，第 ${attempt} 次...`);
      run(FFMPEG, pass1Args);
      run(FFMPEG, pass2Args);
      
      const stat = await fs.stat(outputPath);
      const size = stat.size;
      console.log(`当前文件大小：${(size / 1000 / 1000).toFixed(2)}MB`);
      
      if (size <= maxBytes) {
        console.log(`已压到 ${maxSizeMb}MB 以内。`);
        break;
      }
      
      const factor = Math.max(0.55, Math.min(0.88, (maxBytes / size) * 0.92));
      videoKbps = Math.max(120, Math.floor(videoKbps * factor));
      console.log(`仍然偏大，降低视频码率到约 ${videoKbps}k 后重试。`);
    }
    
    const finalStat = await fs.stat(outputPath);
    const finalSize = finalStat.size;
    
    if (finalSize > maxBytes) {
      console.warn(`警告：已经尽力压缩，但当前大小是 ${(finalSize / 1000 / 1000).toFixed(2)}MB，仍高于 ${maxSizeMb}MB。`);
    }
    
    console.log(`完成：${outputPath}`);
    console.log(`文件大小：${(finalSize / 1000 / 1000).toFixed(2)}MB`);
    
    // 清理临时文件
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    
    return { videoPath: outputPath, size: finalSize };
    
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error(`\n录制失败：${err && err.stack ? err.stack : err}`);
    // 清理临时文件
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  } finally {
    server.close();
  }
};
