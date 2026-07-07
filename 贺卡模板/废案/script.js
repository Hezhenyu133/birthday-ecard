const bgMusic = "{{music_url}}";
const localMusic = "assets/music.mp3";

const screenOrder = ["cover", "wish", "highlight", "final"];
const palettes = {
  cover: ["#f8d19a", "#fff4e6", "#d7a65b", "#efc37d"],
  wish: ["#fff3e4", "#f8d6b4", "#f2c27e", "#f7efe4"],
  highlight: ["#f7d3a2", "#fff0df", "#ffcf93", "#f0c07d"],
  final: ["#efc37d", "#fff3e3", "#ffc28e", "#ffd8bb"]
};

const canvas = document.getElementById("fxCanvas");
const ctx = canvas.getContext("2d");
const screens = [...document.querySelectorAll(".screen")];
const dots = [...document.querySelectorAll(".dot")];
const musicToggle = document.querySelector(".music-toggle");
const progressBar = document.getElementById("autoProgress");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width = 0;
let height = 0;
let dpr = 1;
let activeScreen = "cover";
let audio = null;
let dust = [];
let confetti = [];
let fireworks = [];
let finaleTimer = null;
let touchStartY = 0;

// ===== 自动播放状态 =====
let autoPlayTimer = null;
let autoPlayInterval = 5000; // 每页停留5秒
let isAutoPlaying = false;
let animFrameId = null;
const staggerDelay = 0.22; // 每个子元素入场间隔（秒）
let staggerTimer = null;

function random(min, max) {
  return min + Math.random() * (max - min);
}

function paletteForScreen() {
  return palettes[activeScreen] || palettes.cover;
}

// ========================================================
//  Canvas 尺寸与适配
// ========================================================
function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ========================================================
//  粒子生成
// ========================================================
function makeDust(fromTop = false) {
  const colors = paletteForScreen();
  return {
    x: random(0, width),
    y: fromTop ? random(-80, 0) : random(0, height),
    radius: random(1.1, 3.6),
    speed: random(0.15, 0.45),
    drift: random(-0.12, 0.12),
    alpha: random(0.16, 0.56),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeConfetti(fromTop = false) {
  return {
    x: random(width * 0.06, width * 0.94),
    y: fromTop ? random(-140, -20) : random(-height * 0.12, height),
    vy: random(0.7, 1.8),
    vx: random(-0.25, 0.25),
    length: random(12, 26),
    width: random(4, 7),
    angle: random(0, Math.PI * 2),
    spin: random(-0.05, 0.05),
    alpha: random(0.18, 0.54),
    color: paletteForScreen()[Math.floor(random(0, paletteForScreen().length))]
  };
}

function resetDust() {
  const count = reduceMotion ? 14 : 40;
  dust = Array.from({ length: count }, () => makeDust());
}

function resetConfetti() {
  const count = reduceMotion ? 4 : 12;
  confetti = Array.from({ length: count }, () => makeConfetti());
}

// ========================================================
//  音乐控制
// ========================================================
function updateMusicButton() {
  musicToggle.classList.toggle("is-paused", !audio || audio.paused);
}

function setupMusic() {
  const source = bgMusic && !bgMusic.includes("{{") ? bgMusic : localMusic;
  audio = new Audio(source);
  audio.loop = true;
  audio.preload = "auto";
  updateMusicButton();

  musicToggle.addEventListener("click", async () => {
    if (!audio) return;
    if (audio.paused) {
      await audio.play().catch(err => console.warn("音乐播放失败:", err.message));
    } else {
      audio.pause();
    }
    updateMusicButton();
  });

  document.addEventListener("WeixinJSBridgeReady", () => {
    if (audio && activeScreen !== "cover") {
      audio.play().catch(err => console.warn("微信环境音乐播放失败:", err.message));
    }
    updateMusicButton();
  });
}

async function tryPlayMusic() {
  if (!audio) return;
  await audio.play().catch(err => console.warn("音乐播放失败:", err.message));
  updateMusicButton();
}

// ========================================================
//  烟花系统（仅 final 页）
// ========================================================
function stopFinale() {
  if (finaleTimer) {
    clearInterval(finaleTimer);
    finaleTimer = null;
  }
  fireworks = [];
}

function launchBurst(x, y) {
  const colors = paletteForScreen();
  for (let i = 0; i < 24; i += 1) {
    const angle = (Math.PI * 2 * i) / 24;
    fireworks.push({
      x,
      y,
      vx: Math.cos(angle) * random(1.1, 3),
      vy: Math.sin(angle) * random(1.1, 3),
      alpha: 1,
      color: colors[Math.floor(random(0, colors.length))]
    });
  }
}

function startFinale() {
  stopFinale();
  const launch = () => launchBurst(random(width * 0.24, width * 0.76), random(height * 0.12, height * 0.38));
  launch();
  finaleTimer = window.setInterval(launch, reduceMotion ? 1800 : 1100);
}

// ========================================================
//  逐元素淡入上浮动效
// ========================================================
function animateStaggerChildren(screenEl) {
  const panel = screenEl.querySelector(".copy-panel");
  if (!panel) return 0;

  // 清除上一次动画状态
  panel.classList.remove("stagger-animate");
  panel.querySelectorAll(".stagger-child").forEach(function(el) {
    el.classList.remove("stagger-child");
    el.style.animationDelay = "";
  });

  // 减少动画模式：直接显示，不计算延迟
  if (reduceMotion) return 0;

  // 收集需要动画的子元素
  var children = Array.from(panel.querySelectorAll(
    ":scope > .eyebrow, :scope > h1, :scope > h2, :scope > .english-title, " +
    ":scope > .hero-copy, :scope > .message, :scope > .signature-copy, " +
    ":scope > .support-note, :scope > p:not(.eyebrow):not(.support-note), " +
    ":scope > .primary-action"
  ));

  children.forEach(function(el, i) {
    el.classList.add("stagger-child");
    el.style.animationDelay = (i * staggerDelay) + "s";
  });

  // 强制回流后触发动画
  void panel.offsetWidth;
  panel.classList.add("stagger-animate");

  // 返回总动画时长（秒）
  return children.length > 0
    ? (children.length - 1) * staggerDelay + 0.6
    : 0;
}

/** 根据当前屏元素数量计算自动播放间隔（ms） */
function getAutoPlayDuration() {
  var screenEl = document.querySelector('.screen[data-screen="' + activeScreen + '"]');
  var panel = screenEl ? screenEl.querySelector(".copy-panel") : null;
  if (!panel) return autoPlayInterval;

  var count = panel.querySelectorAll(
    ":scope > .eyebrow, :scope > h1, :scope > h2, :scope > .english-title, " +
    ":scope > .hero-copy, :scope > .message, :scope > .signature-copy, " +
    ":scope > .support-note, :scope > p:not(.eyebrow):not(.support-note), " +
    ":scope > .primary-action"
  ).length;

  if (reduceMotion || count === 0) return autoPlayInterval;

  // 动画时长 + 2.2s 阅读停留
  return Math.round(((count - 1) * staggerDelay + 0.6 + 2.2) * 1000);
}

// ========================================================
//  自动播放
// ========================================================
function startAutoPlay() {
  if (isAutoPlaying) return;

  // 减少动画模式下不自动播放，仅前进一步
  if (reduceMotion) {
    nextScreen(1);
    return;
  }

  isAutoPlaying = true;

  // 先立即前进一步（从 cover 到 wish）
  nextScreen(1);

  // 根据当前屏内容量计算动态间隔
  var duration = getAutoPlayDuration();

  // 启动进度条动画
  startProgress(duration);

  // 定时继续前进（动画结束 + 阅读停留后自动换屏）
  autoPlayTimer = setTimeout(function advance() {
    var currentIndex = screenOrder.indexOf(activeScreen);
    if (currentIndex >= screenOrder.length - 1) {
      stopAutoPlay();
      return;
    }
    nextScreen(1);
    duration = getAutoPlayDuration();
    startProgress(duration);
    autoPlayTimer = setTimeout(advance, duration);
  }, duration);
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = null;
  }
  stopProgress();
  isAutoPlaying = false;
}

function startProgress(duration) {
  if (!progressBar) return;
  progressBar.classList.remove("hidden");
  progressBar.style.transition = "none";
  progressBar.style.width = "0%";
  // 强制重绘后启动过渡动画
  void progressBar.offsetWidth;
  progressBar.style.transition = "width " + (duration || autoPlayInterval) + "ms linear";
  progressBar.style.width = "100%";
}

function stopProgress() {
  if (!progressBar) return;
  progressBar.classList.add("hidden");
  progressBar.style.transition = "none";
  progressBar.style.width = "0%";
}

// ========================================================
//  页面切换
// ========================================================
function updateDots() {
  dots.forEach((dot) => {
    dot.classList.toggle("is-active", dot.dataset.jump === activeScreen);
  });
}

function showScreen(name) {
  activeScreen = name;
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === name);
  });
  updateDots();
  resetConfetti();

  // 触发逐元素淡入上浮动效
  var activeEl = document.querySelector('.screen[data-screen="' + name + '"]');
  if (activeEl) animateStaggerChildren(activeEl);

  // 离开封面时淡出滚动引导箭头
  const scrollHint = document.querySelector(".scroll-hint");
  if (scrollHint) {
    scrollHint.style.opacity = name === "cover" ? "0.55" : "0";
    scrollHint.style.transition = "opacity 0.4s ease";
  }

  if (name !== "cover") tryPlayMusic();
  if (name === "final") startFinale();
  else stopFinale();
}

function nextScreen(direction = 1) {
  const currentIndex = screenOrder.indexOf(activeScreen);
  const nextIndex = Math.max(0, Math.min(screenOrder.length - 1, currentIndex + direction));
  if (nextIndex !== currentIndex) showScreen(screenOrder[nextIndex]);
}

// ========================================================
//  Canvas 绘制
// ========================================================
function drawDustParticle(particle) {
  ctx.save();
  ctx.globalAlpha = particle.alpha;
  ctx.fillStyle = particle.color;
  ctx.shadowBlur = 16;
  ctx.shadowColor = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawConfetti(piece) {
  ctx.save();
  ctx.translate(piece.x, piece.y);
  ctx.rotate(piece.angle);
  ctx.globalAlpha = piece.alpha;
  ctx.fillStyle = piece.color;
  ctx.fillRect(-piece.width / 2, -piece.length / 2, piece.width, piece.length);
  ctx.restore();
}

function drawSpark(x, y, size, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.restore();
}

function updateParticles() {
  dust.forEach((particle) => {
    particle.y += particle.speed;
    particle.x += particle.drift + Math.sin(particle.y * 0.01) * 0.04;
    if (particle.y > height + 18) Object.assign(particle, makeDust(true), { y: -12 });
    drawDustParticle(particle);
  });

  if (activeScreen === "highlight" || activeScreen === "final") {
    confetti.forEach((piece) => {
      piece.y += piece.vy;
      piece.x += piece.vx;
      piece.angle += piece.spin;
      if (piece.y > height + 36) Object.assign(piece, makeConfetti(true), { y: -20 });
      drawConfetti(piece);
    });
  }
}

function updateFireworks() {
  fireworks = fireworks.filter((spark) => spark.alpha > 0.04);
  fireworks.forEach((spark) => {
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vy += 0.018;
    spark.alpha *= 0.962;
    drawSpark(spark.x, spark.y, 7 * spark.alpha, spark.color, spark.alpha);
  });
}

function tick() {
  ctx.clearRect(0, 0, width, height);
  updateParticles();
  if (activeScreen === "final") updateFireworks();
  animFrameId = requestAnimationFrame(tick);
}

// ========================================================
//  事件绑定
// ========================================================

// 按钮导航（支持自动播放触发）
document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.auto === "true") {
      startAutoPlay();
    } else {
      stopAutoPlay();
      showScreen(button.dataset.next);
    }
  });
});

// 圆点导航（手动操作时停止自动播放）
dots.forEach((dot) => {
  dot.addEventListener("click", () => {
    stopAutoPlay();
    showScreen(dot.dataset.jump);
  });
});

// 窗口 resize
window.addEventListener("resize", () => {
  resizeCanvas();
  resetDust();
  resetConfetti();
});

// 触摸滑动（手动操作时停止自动播放）
document.addEventListener("touchstart", (event) => {
  touchStartY = event.changedTouches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", (event) => {
  const diff = touchStartY - event.changedTouches[0].clientY;
  if (Math.abs(diff) < 72) return;
  stopAutoPlay();
  if (diff > 0) nextScreen(1);
  else nextScreen(-1);
}, { passive: true });

// 鼠标滚轮翻页
let wheelLock = false;
document.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (wheelLock) return;
  wheelLock = true;
  stopAutoPlay();
  if (e.deltaY > 0) nextScreen(1);
  else nextScreen(-1);
  setTimeout(() => { wheelLock = false; }, 850);
}, { passive: false });

// 键盘方向键翻页
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === " " || e.key === "ArrowRight") {
    e.preventDefault();
    stopAutoPlay();
    nextScreen(1);
  }
  if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
    e.preventDefault();
    stopAutoPlay();
    nextScreen(-1);
  }
});

// 页面不可见时暂停 Canvas 渲染，节省性能
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  } else {
    if (!animFrameId) tick();
  }
});

// ========================================================
//  逗号断行：以逗号/分号为界换行，移除标点
// ========================================================
function formatBlessingText() {
  var selectors = "h2, .hero-copy, .message, .signature-copy, "
    + ".highlight-panel > p:not(.eyebrow):not(.support-note), "
    + ".final-panel > p:not(.eyebrow)";

  document.querySelectorAll(selectors).forEach(function(el) {
    if (el.dataset.formatted === "true") return;
    if (el.querySelector("*")) return;

    var text = el.textContent.trim();
    if (!text) return;

    var parts = text.split(/[，；]/).map(function(s) { return s.trim(); }).filter(Boolean);

    if (parts.length > 1) {
      el.textContent = "";
      parts.forEach(function(part) {
        var span = document.createElement("span");
        span.className = "comma-line";
        span.style.display = "block";
        span.textContent = part.replace(/[。]+$/, "");
        el.appendChild(span);
      });
      el.dataset.formatted = "true";
    } else {
      el.textContent = text.replace(/[。]+$/, "");
      el.dataset.formatted = "true";
    }
  });
}

// ========================================================
//  初始化
// ========================================================
document.addEventListener("DOMContentLoaded", formatBlessingText);
formatBlessingText();
resizeCanvas();
resetDust();
resetConfetti();
setupMusic();
tick();
