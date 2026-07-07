# H5 生日贺卡录制器

这个工程会启动一个本地 Node 静态服务，用 Playwright 打开 H5 贺卡，自动切换 7 个页面并录制画面，然后用 FFmpeg 把 `assets/music.mp3` 合成到 MP4 里。

## 目录

- `card/`：你的 H5 贺卡
- `record-card.js`：录制脚本
- `output/`：输出目录，录制后生成 MP4

## 安装依赖

先安装 Node.js 18+，再安装 FFmpeg。

macOS：

```bash
brew install ffmpeg
```

Windows：

```bash
winget install Gyan.FFmpeg
```

进入本工程目录后执行：

```bash
npm install
npx playwright install chromium
```

Linux 如果 Chromium 缺系统依赖，可以执行：

```bash
npx playwright install --with-deps chromium
```

## 常用参数(录制2mb以下)

```bash
node record-card-mobile.js \
  --card ./card \
  --out ./output/birthday-card-mobile-small.mp4 \
  --name "王总" \
  --message "祝您生日快乐，事业长青，生活明亮从容。" \
  --compact \
  --max-size-mb 2

```

如果你想录制时保留按钮、音乐开关和底部进度条，加：

```bash
--show-controls
```

如果你想换音乐：

```bash
--audio ./your-music.mp3
```

## 说明

原 H5 是按钮/滚轮切页，脚本会在录制时注入自动翻页逻辑，不破坏原始 H5 文件。声音不依赖浏览器自动播放，而是用 FFmpeg 把 MP3 直接合成进最终 MP4，所以稳定性更高。


## 2026-06-26 修复

如果页面资源、音频或动画导致 Playwright 等不到 `networkidle`，旧版脚本可能卡在“打开页面”并超时。
当前版本已经改为等待 `domcontentloaded`，更适合录制 H5 动画。
