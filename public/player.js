/* =====================================================
   ENGINEERS BABU – FIXED PLAYER.JS
   HLS + DRM | MX / YouTube style
   ===================================================== */

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

/* =====================================================
   LOAD VIDEO
   ===================================================== */

(async () => {
  const rawUrl = new URLSearchParams(location.search).get("url");
  if (!rawUrl) return showError("No ClassPlus URL provided");

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

/* =====================================================
   HLS
   ===================================================== */

function loadHLS(url) {
  if (Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      buildHLSQualityMenu(data.levels);
    });
  } else {
    video.src = url;
  }
}

/* =====================================================
   DRM (SHAKA)
   ===================================================== */

async function loadDRM(mpd, keys) {
  shaka.polyfill.installAll();
  if (!shaka.Player.isBrowserSupported()) {
    throw new Error("DRM not supported in this browser");
  }

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
  buildDRMQualityMenu();
}

/* =====================================================
   PLAY / PAUSE
   ===================================================== */

function togglePlay() {
  if (locked) return;
  video.paused ? video.play() : video.pause();
}

playBtn.onclick = togglePlay;
video.onclick = togglePlay;

video.addEventListener("play", () => playBtn.textContent = "⏸");
video.addEventListener("pause", () => playBtn.textContent = "▶");
video.addEventListener("ended", () => playBtn.textContent = "▶");

/* =====================================================
   TIME & PROGRESS (FIXED)
   ===================================================== */

video.addEventListener("loadedmetadata", updateTime);
video.addEventListener("durationchange", updateTime);
video.addEventListener("timeupdate", updateProgress);

function updateProgress() {
  if (!video.duration || isNaN(video.duration)) return;
  const percent = (video.currentTime / video.duration) * 100;
  progressFill.style.width = percent + "%";
  updateTime();
}

function updateTime() {
  if (!video.duration || isNaN(video.duration)) {
    timeEl.textContent = "00:00 / LIVE";
    return;
  }
  timeEl.textContent =
    format(video.currentTime) + " / " + format(video.duration);
}

function format(sec) {
  if (!sec || isNaN(sec)) return "00:00";

  sec = Math.floor(sec);

  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return (
      String(h).padStart(2, "0") + ":" +
      String(m).padStart(2, "0") + ":" +
      String(s).padStart(2, "0")
    );
  }

  return (
    String(m).padStart(2, "0") + ":" +
    String(s).padStart(2, "0")
  );
}


progressBar.addEventListener("click", e => {
  if (locked || !video.duration) return;
  const rect = progressBar.getBoundingClientRect();
  const pos = (e.clientX - rect.left) / rect.width;
  video.currentTime = pos * video.duration;
});

/* =====================================================
   FULLSCREEN
   ===================================================== */

function toggleFullscreen() {
  document.fullscreenElement
    ? document.exitFullscreen()
    : container.requestFullscreen();
}

fullscreenBtn.onclick = toggleFullscreen;

/* =====================================================
   SPEED MENU
   ===================================================== */

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5];

speedMenu.innerHTML = SPEEDS
  .map(s => `<div onclick="setSpeed(${s})">${s}x</div>`)
  .join("");

speedBtn.onclick = () => toggleMenu(speedMenu);

function setSpeed(s) {
  video.playbackRate = s;
  speedBtn.textContent = s + "x";
  speedMenu.style.display = "none";
}

/* =====================================================
   QUALITY MENU (HLS + DRM)
   ===================================================== */

qualityBtn.onclick = () => toggleMenu(qualityMenu);

function buildHLSQualityMenu(levels) {
  qualityMenu.innerHTML = `<div onclick="setHLSQuality(-1)">AUTO</div>`;
  const added = new Set();

  levels
    .sort((a, b) => b.height - a.height)
    .forEach((l, i) => {
      if (!l.height || added.has(l.height)) return;
      added.add(l.height);
      qualityMenu.innerHTML +=
        `<div onclick="setHLSQuality(${i})">${l.height}p</div>`;
    });
}

function setHLSQuality(i) {
  if (!hls) return;
  hls.currentLevel = i;
  qualityBtn.textContent = i === -1 ? "AUTO" : hls.levels[i].height + "p";
  qualityMenu.style.display = "none";
}

function buildDRMQualityMenu() {
  qualityMenu.innerHTML = `<div onclick="setDRMQuality(-1)">AUTO</div>`;

  const heights = [...new Set(
    shakaPlayer.getVariantTracks().map(t => t.height)
  )].filter(Boolean).sort((a, b) => b - a);

  heights.forEach(h => {
    qualityMenu.innerHTML +=
      `<div onclick="setDRMQuality(${h})">${h}p</div>`;
  });
}

function setDRMQuality(h) {
  if (h === -1) {
    shakaPlayer.configure({ abr: { enabled: true } });
    qualityBtn.textContent = "AUTO";
  } else {
    shakaPlayer.configure({ abr: { enabled: false } });
    const track = shakaPlayer.getVariantTracks().find(t => t.height === h);
    if (track) shakaPlayer.selectVariantTrack(track, true);
    qualityBtn.textContent = h + "p";
  }
  qualityMenu.style.display = "none";
}

/* =====================================================
   LOCK (FIXED)
   ===================================================== */

lockBtn.onclick = () => {
  locked = !locked;
  lockBtn.textContent = locked ? "🔓" : "🔒";
  document.getElementById("controls").style.display =
    locked ? "none" : "block";
};

/* =====================================================
   SCREENSHOT (DRM SAFE)
   ===================================================== */

shotBtn.onclick = () => {
  if (shakaPlayer) {
    alert("Screenshot disabled for DRM protected video");
    return;
  }

  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext("2d").drawImage(video, 0, 0);

  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = "screenshot.png";
  a.click();
};

/* =====================================================
   DOUBLE TAP SEEK (YOUTUBE STYLE)
   ===================================================== */

let lastTap = 0;

video.addEventListener("touchend", e => {
  if (locked) return;
  const now = Date.now();
  if (now - lastTap < 300) {
    const x = e.changedTouches[0].clientX;
    seek(x < window.innerWidth / 2 ? -10 : 10);
  }
  lastTap = now;
});

video.addEventListener("dblclick", e => {
  if (locked) return;
  seek(e.clientX < window.innerWidth / 2 ? -10 : 10);
});

function seek(sec) {
  video.currentTime = Math.max(
    0,
    Math.min(video.duration, video.currentTime + sec)
  );
  showSeek(sec < 0 ? seekLeft : seekRight);
}

function showSeek(el) {
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 300);
}

/* =====================================================
   KEYBOARD CONTROLS
   ===================================================== */

document.addEventListener("keydown", e => {
  if (locked) return;
  if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

  switch (e.key) {
    case " ":
      e.preventDefault();
      togglePlay();
      break;
    case "f":
      toggleFullscreen();
      break;
    case "ArrowRight":
      seek(10);
      break;
    case "ArrowLeft":
      seek(-10);
      break;
  }
});

/* =====================================================
   HELPERS
   ===================================================== */

function toggleMenu(menu) {
  document.querySelectorAll(".menu").forEach(m => {
    if (m !== menu) m.style.display = "none";
  });
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function showError(msg) {
  document.getElementById("error-msg").textContent = msg;
}
