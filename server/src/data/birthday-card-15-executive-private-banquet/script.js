const bgMusic = "{{music_url}}";
const localMusic = "../music/music.mp3";

const screenOrder = ["cover", "identity", "message", "honor", "reflection", "signoff", "final"];
const palettes = {
  cover: ["#f5dfb4", "#fff7e8", "#d6b07a", "#efd0a2"],
  identity: ["#fff7ec", "#eadfce", "#efca90", "#f8ead4"],
  message: ["#f4dfbd", "#fff3e3", "#e7c188", "#f3e5c8"],
  honor: ["#f2d7a7", "#fff0d8", "#dcaf67", "#f0dfc0"],
  reflection: ["#f4ddba", "#fff5e8", "#e3be85", "#efe4ce"],
  signoff: ["#f3dbb5", "#fff2df", "#d9b279", "#eee0c3"],
  final: ["#dcb06d", "#fff6e8", "#f1cf97", "#f6e4bf"]
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
    radius: random(1, 3),
    speed: random(0.12, 0.34),
    drift: random(-0.1, 0.1),
    alpha: random(0.12, 0.4),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeConfetti(fromTop = false) {
  return {
    x: random(width * 0.08, width * 0.92),
    y: fromTop ? random(-120, -20) : random(-height * 0.08, height),
    vy: random(0.62, 1.42),
    vx: random(-0.18, 0.18),
    length: random(10, 20),
    width: random(3, 6),
    angle: random(0, Math.PI * 2),
    spin: random(-0.04, 0.04),
    alpha: random(0.1, 0.34),
    color: paletteForScreen()[Math.floor(random(0, paletteForScreen().length))]
  };
}

function resetDust() {
  dust = Array.from({ length: reduceMotion ? 12 : 36 }, () => makeDust());
}

function resetConfetti() {
  confetti = Array.from({ length: reduceMotion ? 3 : 9 }, () => makeConfetti());
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
  for (let i = 0; i < 24; i += 1) {
    const angle = (Math.PI * 2 * i) / 24;
    fireworks.push({
      x,
      y,
      vx: Math.cos(angle) * random(0.9, 2.5),
      vy: Math.sin(angle) * random(0.9, 2.5),
      alpha: 1,
      color: colors[Math.floor(random(0, colors.length))]
    });
  }
}

function startFinale() {
  stopFinale();
  const launch = () => launchBurst(random(width * 0.26, width * 0.74), random(height * 0.1, height * 0.34));
  launch();
  finaleTimer = window.setInterval(launch, reduceMotion ? 1900 : 1200);
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
  tryPlayMusic();
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
  ctx.shadowBlur = 14;
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
  ctx.lineWidth = 1.1;
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
    particle.x += particle.drift + Math.sin(particle.y * 0.01) * 0.03;
    if (particle.y > height + 16) Object.assign(particle, makeDust(true), { y: -10 });
    drawDustParticle(particle);
  });

  if (activeScreen !== "cover" && activeScreen !== "identity") {
    confetti.forEach((piece) => {
      piece.y += piece.vy;
      piece.x += piece.vx;
      piece.angle += piece.spin;
      if (piece.y > height + 34) Object.assign(piece, makeConfetti(true), { y: -18 });
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
