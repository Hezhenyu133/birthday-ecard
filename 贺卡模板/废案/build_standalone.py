"""
压缩资源并生成两个单文件 HTML：
- template-standalone.html（带占位符的模板）
- demo-standalone.html（填充内容的贺卡）
"""
import base64, os, subprocess, sys
from PIL import Image
from io import BytesIO

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = r"D:\python\3.12\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
BASE = r"D:\学\quanzhan\birthday-card-system\birthday-card-13-employee-warm-image"
OUT = BASE  # 输出到同一目录

# ---- 1. 压缩图片 PNG → JPEG 80% ----
img_names = ["01-cover-bg", "02-wish-bg", "03-highlight-bg", "04-final-bg"]
img_b64 = {}
for name in img_names:
    src = os.path.join(BASE, "assets", "generated", f"{name}.png")
    img = Image.open(src).convert("RGB")
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=80, optimize=True)
    raw = buf.getvalue()
    img_b64[name] = base64.b64encode(raw).decode()
    print(f"[IMG] {name}: {os.path.getsize(src)/1024:.0f}KB → {len(raw)/1024:.0f}KB (base64 {len(img_b64[name])/1024:.0f}KB)")

# ---- 2. 压缩音乐 320kbps stereo → 64kbps mono ----
music_src = os.path.join(BASE, "assets", "music.mp3")
music_tmp = os.path.join(BASE, "assets", "music_compressed.mp3")
subprocess.run([
    FFMPEG, "-y", "-i", music_src,
    "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1", "-ar", "22050",
    music_tmp
], capture_output=True)
with open(music_tmp, "rb") as f:
    music_b64 = base64.b64encode(f.read()).decode()
print(f"[MP3] {os.path.getsize(music_src)/1024:.0f}KB → {os.path.getsize(music_tmp)/1024:.0f}KB (base64 {len(music_b64)/1024:.0f}KB)")
os.remove(music_tmp)

# ---- 3. 读取 CSS 和 JS ----
with open(os.path.join(BASE, "style.css"), "r", encoding="utf-8") as f:
    css_content = f.read()

with open(os.path.join(BASE, "script.js"), "r", encoding="utf-8") as f:
    js_content = f.read()

# JS 中的 music_url 替换为 base64 data URI
js_embedded = js_content.replace(
    'const bgMusic = "{{music_url}}";',
    f'const bgMusic = "data:audio/mpeg;base64,{music_b64}";'
)
js_demo = js_content.replace(
    'const bgMusic = "{{music_url}}";',
    f'const bgMusic = "data:audio/mpeg;base64,{music_b64}";'
)

# ---- 4. 生成 HTML 的辅助函数 ----
def build_html(title, logo_url, company, name, blessing,
               sender, year, month, day, is_template=False):
    """构建单文件 HTML"""

    # 图片替换：把 src="assets/generated/xx.png" 换成 data URI
    def img_data(name_key):
        return f"data:image/jpeg;base64,{img_b64[name_key]}"

    # Logo: 模板用 {{logo_url}}，贺卡用空字符串触发 fallback
    logo_src = logo_url if not is_template else "{{logo_url}}"
    # company 占位符
    comp = "{{company}}" if is_template else company
    # 其他占位符
    t = "{{title}}" if is_template else title
    n = "{{name}}" if is_template else name
    bl = "{{blessing}}" if is_template else blessing
    sd = "{{sender}}" if is_template else sender
    y = "{{year}}" if is_template else year
    m = "{{month}}" if is_template else month
    d = "{{day}}" if is_template else day

    # 选择对应的 JS
    js = js_embedded if is_template else js_demo

    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{t}</title>
  <style>
{css_content}
  </style>
</head>
<body>
  <main class="card-app employee-image-app">
    <canvas id="fxCanvas" aria-hidden="true"></canvas>
    <div class="auto-progress hidden" id="autoProgress"></div>

    <button class="music-toggle is-paused" type="button" aria-label="音乐开关">
      <span class="music-icon"></span>
    </button>

    <nav class="page-dots" aria-label="页面导航">
      <button class="dot is-active" type="button" data-jump="cover" aria-label="封面页"></button>
      <button class="dot" type="button" data-jump="wish" aria-label="祝福页"></button>
      <button class="dot" type="button" data-jump="highlight" aria-label="高光页"></button>
      <button class="dot" type="button" data-jump="final" aria-label="结尾页"></button>
    </nav>

    <!-- ===== 第1页：封面 ===== -->
    <section class="screen cover active" data-screen="cover">
      <img class="scene-bg" src="{img_data("01-cover-bg")}" alt="" loading="eager">
      <div class="scene-overlay scene-overlay-cover" aria-hidden="true"></div>
      <div class="brand-slot">
        <img class="brand-logo" src="{logo_src}" alt="{comp}"
             onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='block')">
        <span class="brand-text" style="display:none">{comp}</span>
      </div>
      <p class="progress-tag">01 / 04</p>
      <div class="copy-panel cover-panel">
        <p class="eyebrow">Warm Birthday Wishes</p>
        <h1>生日快乐</h1>
        <p class="english-title">HAPPY BIRTHDAY</p>
        <p class="hero-copy">把今天的暖光、掌声和温柔，都送给认真生活的你。</p>
        <button class="primary-action" type="button" data-next="wish" data-auto="true">开启祝福</button>
      </div>
      <div class="scroll-hint" aria-label="向下滑动"></div>
    </section>

    <!-- ===== 第2页：祝福 ===== -->
    <section class="screen wish" data-screen="wish">
      <img class="scene-bg" src="{img_data("02-wish-bg")}" alt="" loading="lazy">
      <div class="scene-overlay scene-overlay-wish" aria-hidden="true"></div>
      <div class="brand-slot">
        <img class="brand-logo" src="{logo_src}" alt="{comp}"
             onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='block')">
        <span class="brand-text" style="display:none">{comp}</span>
      </div>
      <p class="progress-tag">02 / 04</p>
      <div class="copy-panel wish-panel">
        <p class="eyebrow">For {n}</p>
        <h2>{n}</h2>
        <!-- editable-start -->
        <p class="message">{bl}</p>
        <!-- editable-end -->
        <p class="signature-copy">愿你被看见，也被认真庆祝。</p>
        <button class="primary-action" type="button" data-next="highlight">继续翻页</button>
      </div>
    </section>

    <!-- ===== 第3页：高光 ===== -->
    <section class="screen highlight" data-screen="highlight">
      <img class="scene-bg" src="{img_data("03-highlight-bg")}" alt="" loading="lazy">
      <div class="scene-overlay scene-overlay-highlight" aria-hidden="true"></div>
      <div class="brand-slot">
        <img class="brand-logo" src="{logo_src}" alt="{comp}"
             onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='block')">
        <span class="brand-text" style="display:none">{comp}</span>
      </div>
      <p class="progress-tag">03 / 04</p>
      <div class="copy-panel highlight-panel">
        <p class="eyebrow">A Gentle Spotlight</p>
        <h2>这一年的认真与辛苦，值得被温柔庆祝</h2>
        <p>愿你在忙碌里依然拥有被善待的时刻，在平凡日子里也能收到属于自己的掌声与惊喜。</p>
        <p class="support-note">来自{comp}的一份生日心意</p>
        <button class="primary-action ghost-light" type="button" data-next="final">走向高光</button>
      </div>
    </section>

    <!-- ===== 第4页：结尾 ===== -->
    <section class="screen final" data-screen="final">
      <img class="scene-bg" src="{img_data("04-final-bg")}" alt="" loading="lazy">
      <div class="scene-overlay scene-overlay-final" aria-hidden="true"></div>
      <div class="brand-slot">
        <img class="brand-logo" src="{logo_src}" alt="{comp}"
             onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='block')">
        <span class="brand-text" style="display:none">{comp}</span>
      </div>
      <p class="progress-tag">04 / 04</p>
      <div class="copy-panel final-panel">
        <p class="eyebrow">Tonight Is Yours</p>
        <h2>把今天的好运，都赠予你</h2>
        <p>愿新一岁的你，多一点从容，多一点被爱，也多一点心想事成。</p>
        <div class="formal-signature">
          <p class="sig-company">{sd} 敬贺</p>
          <p class="sig-date">{y}年{m}月{d}日</p>
        </div>
        <button class="primary-action" type="button" data-next="cover">再看一次</button>
      </div>
    </section>
  </main>

  <script>
{js}
  </script>
</body>
</html>'''
    return html

# ---- 5. 生成两个文件 ----
# 模板文件（保留占位符）
template_html = build_html(
    title="", logo_url="", company="", name="", blessing="",
    sender="", year="", month="", day="",
    is_template=True
)
tpl_path = os.path.join(OUT, "template-standalone.html")
with open(tpl_path, "w", encoding="utf-8") as f:
    f.write(template_html)
print(f"\n[OK] template-standalone.html ({os.path.getsize(tpl_path)/1024/1024:.1f} MB)")

# 贺卡文件（填充内容）
demo_html = build_html(
    title="林小雨 · 生日快乐",
    logo_url="",
    company="星辰科技有限公司",
    name="林小雨",
    blessing="今天是属于你的日子，愿所有美好都如约而至",
    sender="星辰科技有限公司全体同仁",
    year="2026", month="6", day="18",
    is_template=False
)
demo_path = os.path.join(OUT, "demo-standalone.html")
with open(demo_path, "w", encoding="utf-8") as f:
    f.write(demo_html)
print(f"[OK] demo-standalone.html ({os.path.getsize(demo_path)/1024/1024:.1f} MB)")

print("\nDone!")
