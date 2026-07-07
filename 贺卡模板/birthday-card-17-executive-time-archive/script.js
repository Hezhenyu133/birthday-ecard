const screenOrder = ["cover", "name", "imprint", "compass", "wish", "message", "final"];
const paletteByScreen = {
  cover: ["#efe5d5", "#86aaa2", "#bf8a58", "#d9c8ae"],
  name: ["#f6ead9", "#acc9c1", "#b77c4d", "#ffffff"],
  imprint: ["#e5d8c5", "#8fb3aa", "#c79a64", "#f7f0e6"],
  compass: ["#f0dec3", "#6f9f9a", "#bb8652", "#d8e8e1"],
  wish: ["#e8f0e8", "#87aa9f", "#c49262", "#f4ead9"],
  message: ["#f4eadc", "#9cbab1", "#bd8552", "#ffffff"],
  final: ["#fff2dc", "#a7c8bd", "#c98e56", "#f8faf4"]
};

const app = document.querySelector(".card-app");
const canvas = document.getElementById("fxCanvas");
const ctx = canvas.getContext("2d");
const screens = [...document.querySelectorAll(".screen")];
const segments = [...document.querySelectorAll(".progress-segment")];
const musicToggle = document.querySelector(".music-toggle");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width = 0;
let height = 0;
let dpr = 1;
let activeScreen = "cover";
let particles = [];
let lightLines = [];
let audio = null;
let touchStartY = 0;
let wheelLocked = false;

// ===== 自动播放状态 =====
let autoPlayTimer = null;
const totalPages = 7;
const totalDuration = 26000; // 26秒
const autoPlayInterval = totalDuration / totalPages; // 每页约3.71秒
let isAutoPlaying = false;

function random(min, max) {
  return min + Math.random() * (max - min);
}

function palette() {
  return paletteByScreen[activeScreen] || paletteByScreen.cover;
}

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

function makeParticle(fromTop = false) {
  const colors = palette();
  return {
    x: random(0, width),
    y: fromTop ? random(-80, -12) : random(0, height),
    radius: random(0.55, 2.1),
    speed: random(0.08, 0.24),
    drift: random(-0.12, 0.12),
    alpha: random(0.1, 0.32),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeLine(fromSide = false) {
  const colors = palette();
  return {
    x: fromSide ? random(-100, 0) : random(0, width),
    y: random(height * 0.08, height * 0.9),
    length: random(48, 150),
    speed: random(0.08, 0.22),
    alpha: random(0.05, 0.16),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function resetEffects() {
  particles = Array.from({ length: reduceMotion ? 10 : 34 }, () => makeParticle());
  lightLines = Array.from({ length: reduceMotion ? 2 : 8 }, () => makeLine());
}

function updateMusicButton() {
  musicToggle.classList.toggle("is-paused", !audio || audio.paused);
}

function setupMusic() {
  audio = new Audio("assets/music.mp3");
  audio.loop = true;
  audio.preload = "auto";
  updateMusicButton();

  musicToggle.addEventListener("click", async () => {
    if (!audio) return;
    if (audio.paused) await audio.play().catch(() => {});
    else audio.pause();
    updateMusicButton();
  });

  document.addEventListener("WeixinJSBridgeReady", () => {
    if (audio && activeScreen !== "cover") audio.play().catch(() => {});
    updateMusicButton();
  });
}

async function tryPlayMusic() {
  if (!audio) return;
  await audio.play().catch(() => {});
  updateMusicButton();
}

function updateProgress() {
  segments.forEach((segment) => {
    segment.classList.toggle("is-active", segment.dataset.jump === activeScreen);
  });
}

function showScreen(name) {
  const currentIndex = screenOrder.indexOf(activeScreen);
  const nextIndex = screenOrder.indexOf(name);
  if (nextIndex < 0 || name === activeScreen) return;

  app.dataset.direction = nextIndex > currentIndex ? "next" : "prev";
  activeScreen = name;

  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === name);
  });

  updateProgress();
  resetEffects();

  if (name !== "cover") tryPlayMusic();
}

function moveScreen(direction) {
  const currentIndex = screenOrder.indexOf(activeScreen);
  const nextIndex = Math.max(0, Math.min(screenOrder.length - 1, currentIndex + direction));
  if (nextIndex !== currentIndex) showScreen(screenOrder[nextIndex]);
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = particle.alpha;
  ctx.fillStyle = particle.color;
  ctx.shadowBlur = 12;
  ctx.shadowColor = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLine(line) {
  ctx.save();
  ctx.globalAlpha = line.alpha;
  ctx.strokeStyle = line.color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(line.x, line.y);
  ctx.lineTo(line.x + line.length, line.y - line.length * 0.18);
  ctx.stroke();
  ctx.restore();
}

function drawFinalHalo(time) {
  if (activeScreen !== "final" || reduceMotion) return;
  const colors = palette();
  const cx = width * 0.5;
  const cy = height * 0.35;
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i += 1) {
    const radius = 46 + i * 30 + Math.sin(time * 0.0014 + i) * 7;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function updateEffects(time) {
  particles.forEach((particle) => {
    particle.y += particle.speed;
    particle.x += particle.drift + Math.sin((particle.y + time * 0.02) * 0.01) * 0.03;
    if (particle.y > height + 14) Object.assign(particle, makeParticle(true), { y: -10 });
    drawParticle(particle);
  });

  lightLines.forEach((line) => {
    line.x += line.speed;
    line.y -= line.speed * 0.15;
    if (line.x > width + line.length) Object.assign(line, makeLine(true), { x: -line.length });
    drawLine(line);
  });

  drawFinalHalo(time);
}

function tick(time) {
  ctx.clearRect(0, 0, width, height);
  updateEffects(time);
  requestAnimationFrame(tick);
}

// 自动播放启动
function startAutoPlaySequence() {
  if (isAutoPlaying) return;
  isAutoPlaying = true;

  autoPlayTimer = setInterval(() => {
    const currentIndex = screenOrder.indexOf(activeScreen);
    if (currentIndex < screenOrder.length - 1) {
      moveScreen(1);
    } else {
      stopAutoPlay();
    }
  }, autoPlayInterval);
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
  isAutoPlaying = false;
}

// 页面加载后自动播放
setTimeout(startAutoPlaySequence, 500);

window.addEventListener("resize", () => {
  resizeCanvas();
  resetEffects();
});

document.addEventListener("touchstart", (event) => {
  touchStartY = event.changedTouches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", (event) => {
  const diff = touchStartY - event.changedTouches[0].clientY;
  if (Math.abs(diff) < 68) return;
  moveScreen(diff > 0 ? 1 : -1);
}, { passive: true });

document.addEventListener("wheel", (event) => {
  if (wheelLocked || Math.abs(event.deltaY) < 48) return;
  wheelLocked = true;
  moveScreen(event.deltaY > 0 ? 1 : -1);
  window.setTimeout(() => { wheelLocked = false; }, 760);
}, { passive: true });

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "PageDown") moveScreen(1);
  if (event.key === "ArrowUp" || event.key === "PageUp") moveScreen(-1);
});

// ========================================================
//  逗号断行：以逗号/分号为界换行，移除标点
// ========================================================
function formatBlessingText() {
  var selectors = "h1, h2, h3, .hero-copy, .message-text, .signature-copy, "
    + ".support-note, .year-note, .lead, "
    + ".copy-block > p:not(.eyebrow):not(.progress-tag):not(.sig-company):not(.sig-date)";

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
resetEffects();
setupMusic();
tick(0);
