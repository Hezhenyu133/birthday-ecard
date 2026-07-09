const bgMusic = "{{music_url}}";
const localMusic = "../music/music.mp3";

const screenOrder = ["cover", "identity", "message", "honor", "reflection", "signoff", "final"];
const palettes = {
  cover: ["#efe1c3", "#fffaf0", "#caa56e", "#e0cfb0"],
  identity: ["#f8f3eb", "#e2d7ca", "#d5b07a", "#f1e7d8"],
  message: ["#f1e2c8", "#fcf7ee", "#ceb08a", "#ebe1d3"],
  honor: ["#e9d6b5", "#fdf8f0", "#be9861", "#e8dac4"],
  reflection: ["#eee0c7", "#faf5ed", "#c8aa7a", "#e4dbce"],
  signoff: ["#f0e2cb", "#f9f3e8", "#c5a275", "#e8ddd0"],
  final: ["#cb9f62", "#fff8ef", "#ebcf9d", "#f2e5d0"]
};

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
let audio = null;
let dust = [];
let confetti = [];
let fireworks = [];
let finaleTimer = null;
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

function paletteForScreen() {
  return palettes[activeScreen] || palettes.cover;
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

function makeDust(fromTop = false) {
  const colors = paletteForScreen();
  return {
    x: random(0, width),
    y: fromTop ? random(-80, 0) : random(0, height),
    radius: random(0.9, 2.8),
    speed: random(0.1, 0.3),
    drift: random(-0.08, 0.08),
    alpha: random(0.1, 0.34),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeConfetti(fromTop = false) {
  return {
    x: random(width * 0.1, width * 0.9),
    y: fromTop ? random(-120, -20) : random(-height * 0.06, height),
    vy: random(0.56, 1.22),
    vx: random(-0.14, 0.14),
    length: random(8, 18),
    width: random(3, 5),
    angle: random(0, Math.PI * 2),
    spin: random(-0.03, 0.03),
    alpha: random(0.08, 0.28),
    color: paletteForScreen()[Math.floor(random(0, paletteForScreen().length))]
  };
}

function resetDust() {
  dust = Array.from({ length: reduceMotion ? 10 : 30 }, () => makeDust());
}

function resetConfetti() {
  confetti = Array.from({ length: reduceMotion ? 2 : 6 }, () => makeConfetti());
}

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

function stopFinale() {
  if (finaleTimer) {
    clearInterval(finaleTimer);
    finaleTimer = null;
  }
  fireworks = [];
}

function launchBurst(x, y) {
  const colors = paletteForScreen();
  for (let i = 0; i < 20; i += 1) {
    const angle = (Math.PI * 2 * i) / 20;
    fireworks.push({
      x,
      y,
      vx: Math.cos(angle) * random(0.8, 2.2),
      vy: Math.sin(angle) * random(0.8, 2.2),
      alpha: 1,
      color: colors[Math.floor(random(0, colors.length))]
    });
  }
}

function startFinale() {
  stopFinale();
  const launch = () => launchBurst(random(width * 0.28, width * 0.72), random(height * 0.12, height * 0.32));
  launch();
  finaleTimer = window.setInterval(launch, reduceMotion ? 2200 : 1400);
}

function updateProgress() {
  segments.forEach((segment) => {
    segment.classList.toggle("is-active", segment.dataset.jump === activeScreen);
  });
}

function showScreen(name) {
  activeScreen = name;
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === name);
  });
  updateProgress();
  resetConfetti();
  if (name !== "cover") tryPlayMusic();
  if (name === "final") startFinale();
  else stopFinale();
}

function nextScreen(direction = 1) {
  const currentIndex = screenOrder.indexOf(activeScreen);
  const nextIndex = Math.max(0, Math.min(screenOrder.length - 1, currentIndex + direction));
  if (nextIndex !== currentIndex) showScreen(screenOrder[nextIndex]);
}

function drawDustParticle(particle) {
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
  ctx.lineWidth = 1;
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
    particle.x += particle.drift + Math.sin(particle.y * 0.01) * 0.02;
    if (particle.y > height + 16) Object.assign(particle, makeDust(true), { y: -10 });
    drawDustParticle(particle);
  });

  if (activeScreen === "honor" || activeScreen === "reflection" || activeScreen === "final") {
    confetti.forEach((piece) => {
      piece.y += piece.vy;
      piece.x += piece.vx;
      piece.angle += piece.spin;
      if (piece.y > height + 30) Object.assign(piece, makeConfetti(true), { y: -18 });
      drawConfetti(piece);
    });
  }
}

function updateFireworks() {
  fireworks = fireworks.filter((spark) => spark.alpha > 0.04);
  fireworks.forEach((spark) => {
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vy += 0.016;
    spark.alpha *= 0.962;
    drawSpark(spark.x, spark.y, 6.5 * spark.alpha, spark.color, spark.alpha);
  });
}

function tick() {
  ctx.clearRect(0, 0, width, height);
  updateParticles();
  if (activeScreen === "final") updateFireworks();
  requestAnimationFrame(tick);
}

// 自动播放启动
function startAutoPlaySequence() {
  if (isAutoPlaying) return;
  isAutoPlaying = true;

  autoPlayTimer = setInterval(() => {
    const currentIndex = screenOrder.indexOf(activeScreen);
    if (currentIndex < screenOrder.length - 1) {
      nextScreen(1);
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
  resetDust();
  resetConfetti();
});

document.addEventListener("touchstart", (event) => {
  touchStartY = event.changedTouches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", (event) => {
  const diff = touchStartY - event.changedTouches[0].clientY;
  if (Math.abs(diff) < 72) return;
  if (diff > 0) nextScreen(1);
  else nextScreen(-1);
}, { passive: true });

document.addEventListener("wheel", (event) => {
  if (wheelLocked || Math.abs(event.deltaY) < 48) return;
  wheelLocked = true;
  stopAutoPlay();
  nextScreen(event.deltaY > 0 ? 1 : -1);
  window.setTimeout(() => { wheelLocked = false; }, 760);
}, { passive: true });

// ========================================================
//  逗号断行：以逗号/分号为界换行，移除标点
// ========================================================
function formatBlessingText() {
  var selectors = "h1, h2, h3, .hero-copy, .message-text, .signature-copy, "
    + ".support-note, .year-note, .lead, "
    + ".copy-panel > p:not(.eyebrow):not(.meta-line):not(.progress-tag):not(.sig-company):not(.sig-date)";

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
