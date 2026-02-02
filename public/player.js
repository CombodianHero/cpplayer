const video = document.getElementById("video");
const API = "https://itsgolu-v1player-api.vercel.app/api/proxy";

let hls=null, shakaPlayer=null, locked=false, brightness=0;

/* ===== LOAD VIDEO ===== */
(async()=>{
  const url=new URLSearchParams(location.search).get("url");
  if(!url) return showError("No URL");

  const res=await fetch(`${API}?url=${encodeURIComponent(url)}`);
  const data=await res.json();

  if(data.MPD && data.KEYS) loadDRM(data.MPD,data.KEYS);
  else loadHLS(data.url);
})();

/* ===== HLS ===== */
function loadHLS(url){
  if(Hls.isSupported()){
    hls=new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED,(_,d)=>buildHLSQuality(d.levels));
  } else video.src=url;
}

/* ===== DRM ===== */
async function loadDRM(mpd,keys){
  shaka.polyfill.installAll();
  shakaPlayer=new shaka.Player(video);
  const ck={};
  keys.forEach(k=>{
    let [id,val]=k.split(":");
    ck[id]=val;
  });
  shakaPlayer.configure({drm:{clearKeys:ck}});
  await shakaPlayer.load(mpd);
  buildDRMQuality();
}

/* ===== PLAY / PAUSE ===== */
const playBtn=document.getElementById("play-btn");
playBtn.onclick=()=>video.paused?video.play():video.pause();
video.onplay=()=>playBtn.textContent="⏸";
video.onpause=()=>playBtn.textContent="▶";

/* ===== KEYBOARD ===== */
document.addEventListener("keydown",e=>{
  if(e.key===" ") {e.preventDefault();playBtn.click();}
  if(e.key==="f") toggleFS();
  if(e.key==="ArrowRight") video.currentTime+=10;
  if(e.key==="ArrowLeft") video.currentTime-=10;
});

/* ===== FULLSCREEN ===== */
function toggleFS(){
  document.fullscreenElement
    ? document.exitFullscreen()
    : document.getElementById("player-container").requestFullscreen();
}
document.getElementById("fullscreen-btn").onclick=toggleFS;

/* ===== DOUBLE TAP SEEK ===== */
let lastTap=0;
video.addEventListener("touchend",e=>{
  const now=Date.now();
  if(now-lastTap<300){
    const x=e.changedTouches[0].clientX;
    seek(x<innerWidth/2?-10:10);
  }
  lastTap=now;
});
function seek(s){
  video.currentTime+=s;
  showSeek(s<0?"seek-left":"seek-right");
}
function showSeek(id){
  const el=document.getElementById(id);
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),300);
}

/* ===== QUALITY ===== */
function buildHLSQuality(levels){
  const m=document.getElementById("quality-menu");
  m.innerHTML=`<div onclick="hls.currentLevel=-1">AUTO</div>`;
  levels.forEach((l,i)=>m.innerHTML+=`<div onclick="hls.currentLevel=${i}">${l.height}p</div>`);
}
function buildDRMQuality(){
  const m=document.getElementById("quality-menu");
  m.innerHTML=`<div onclick="shakaPlayer.configure({abr:{enabled:true}})">AUTO</div>`;
  [...new Set(shakaPlayer.getVariantTracks().map(t=>t.height))]
    .forEach(h=>m.innerHTML+=`<div onclick="setDRM(${h})">${h}p</div>`);
}
function setDRM(h){
  shakaPlayer.configure({abr:{enabled:false}});
  const t=shakaPlayer.getVariantTracks().find(x=>x.height===h);
  shakaPlayer.selectVariantTrack(t,true);
}

/* ===== SPEED ===== */
const speeds=[0.25,0.5,1,1.25,1.5,2,3,4,5];
const sm=document.getElementById("speed-menu");
sm.innerHTML=speeds.map(s=>`<div onclick="video.playbackRate=${s}">${s}x</div>`).join("");
document.getElementById("speed-btn").onclick=()=>toggle(sm);

/* ===== UTILS ===== */
function toggle(m){m.style.display=m.style.display==="block"?"none":"block";}
function showError(t){document.getElementById("error-msg").textContent=t;}
