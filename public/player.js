const video = document.getElementById("video");
const container = document.getElementById("player-container");

const playBtn = document.getElementById("play-btn");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const speedBtn = document.getElementById("speed-btn");
const qualityBtn = document.getElementById("quality-btn");
const lockBtn = document.getElementById("lock-btn");
const shotBtn = document.getElementById("shot-btn");

const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const timeEl = document.getElementById("time");

const speedMenu = document.getElementById("speed-menu");
const qualityMenu = document.getElementById("quality-menu");

const seekLeft = document.getElementById("seek-left");
const seekRight = document.getElementById("seek-right");

const API = "https://itsgolu-v1player-api.vercel.app/api/proxy";

let hls = null;
let shakaPlayer = null;
let locked = false;

/* ================= LOAD VIDEO ================= */

(async () => {
  const rawUrl = new URLSearchParams(location.search).get("url");
  if (!rawUrl) return showError("No video URL provided");

  try {
    const res = await fetch(`${API}?url=${encodeURIComponent(rawUrl)}`);
    const data = await res.json();

    if (data.MPD && data.KEYS) {
      await loadDRM(data.MPD, data.KEYS);
    } else if (data.url) {
      loadHLS(data.url);
    } else {
      throw new Error("Invalid API response");
    }
  } catch (e) {
    showError(e.message);
  }
})();

/* ================= HLS ================= */

function loadHLS(url) {
  if (Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
      buildHLSQualityMenu(hls.levels);
    });
  } else {
    video.src = url;
    video.play().catch(() => {});
  }
}

/* ================= DRM ================= */

async function loadDRM(mpd, keys) {
  shaka.polyfill.installAll();
  shakaPlayer = new shaka.Player(video);

  const clearKeys = {};
  keys.forEach(k => {
    const [kid, key] = k.split(":");
    clearKeys[kid] = key;
  });

  shakaPlayer.configure({
    drm: { clearKeys },
    abr: { enabled: true }
  });

  await shakaPlayer.load(mpd);
  video.play().catch(() => {});
  buildDRMQualityMenu();
}

/* ================= PLAY / PAUSE ================= */

function togglePlay() {
  if (locked) return;
  video.paused ? video.play() : video.pause();
}

playBtn.onclick = togglePlay;
video.onclick = togglePlay;

video.onplay = () => playBtn.textContent = "⏸";
video.onpause = () => playBtn.textContent = "▶";

/* ================= PROGRESS ================= */

video.ontimeupdate = () => {
  if (!video.duration) return;
  progressFill.style.width = (video.currentTime / video.duration) * 100 + "%";
  timeEl.textContent =
    format(video.currentTime) + " / " + format(video.duration);
};

function format(sec) {
  sec = Math.floor(sec || 0);
  return String(Math.floor(sec / 60)).padStart(2, "0") + ":" +
         String(sec % 60).padStart(2, "0");
}

progressBar.onclick = e => {
  if (locked || !video.duration) return;
  const rect = progressBar.getBoundingClientRect();
  video.currentTime =
    ((e.clientX - rect.left) / rect.width) * video.duration;
};

/* ================= FULLSCREEN ================= */

fullscreenBtn.onclick = () => {
  document.fullscreenElement
    ? document.exitFullscreen()
    : container.requestFullscreen();
};

/* ================= SPEED ================= */

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
speedMenu.innerHTML = SPEEDS.map(s =>
  `<div onclick="setSpeed(${s})">${s}x</div>`).join("");

speedBtn.onclick = () => toggleMenu(speedMenu);

function setSpeed(s) {
  video.playbackRate = s;
  speedBtn.textContent = s + "x";
  speedMenu.style.display = "none";
}

/* ================= QUALITY ================= */

qualityBtn.onclick = () => toggleMenu(qualityMenu);

function buildHLSQualityMenu(levels) {
  qualityMenu.innerHTML = `<div onclick="setHLSQuality(-1)">AUTO</div>`;
  levels.forEach((l, i) => {
    if (l.height)
      qualityMenu.innerHTML +=
        `<div onclick="setHLSQuality(${i})">${l.height}p</div>`;
  });
}

function setHLSQuality(i) {
  hls.currentLevel = i;
  qualityBtn.textContent = i === -1 ? "AUTO" : hls.levels[i].height + "p";
  qualityMenu.style.display = "none";
}

function buildDRMQualityMenu() {
  qualityMenu.innerHTML = `<div>AUTO</div>`;
}

/* ================= LOCK ================= */

lockBtn.onclick = () => {
  locked = !locked;
  lockBtn.textContent = locked ? "🔓" : "🔒";
  document.getElementById("controls").style.display =
    locked ? "none" : "block";
};

/* ================= HELPERS ================= */

function toggleMenu(menu) {
  document.querySelectorAll(".menu").forEach(m => m.style.display = "none");
  menu.style.display = "block";
}

function showError(msg) {
  document.getElementById("error-msg").textContent = msg;
}
