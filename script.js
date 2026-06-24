// ---- 定数 ----
const WEED_EMOJI = ["🌱", "🍀", "🌿"];
const FLOWER_EMOJI = ["🌷", "🌼", "🌸"];
const VEGGIE_EMOJI = ["🍆", "🥕"];
const TREE_EMOJI = ["🌳", "🌲"];
const RARE_ICONS = ["🌟","💖","🌟","💖","🌟","💖","🌟","💖","🌟"];
const RARE_WEEDS = [
  { name: "顔がついている草", desc: "たまにこちらを見てくるが、別に害はない。", icon: RARE_ICONS[0] },
  { name: "やたら筋肉質な草", desc: "触るとムキムキしていて、なんか頼りになりそう。", icon: RARE_ICONS[1] },
  { name: "なんかめっちゃ光ってる草", desc: "夜になると光を放つ、とても目立つ草。", icon: RARE_ICONS[2] },
  { name: "なんか耳っぽい草", desc: "風の音などを集めているように揺れている。", icon: RARE_ICONS[3] },
  { name: "ウワァー！ってなる草", desc: "引き抜くと悲鳴のような変な音が鳴る。", icon: RARE_ICONS[4] },
  { name: "イヤァー！ってなる草", desc: "近づくとしおれて、なんだかこちらまで悲しくなる。", icon: RARE_ICONS[5] },
  { name: "夜中に踊るらしい草", desc: "真夜中になるとふわふわ揺れて踊り出す。", icon: RARE_ICONS[6] },
  { name: "エコな説明をする草", desc: "近づくと図や記号でいろんな説明をしてくれる。", icon: RARE_ICONS[7] },
  { name: "うるさい草", desc: "いろんなことをずっとしゃべり続けている。", icon: RARE_ICONS[8] },
];

const COUNTS = { weed: 144, rare: 6, flower: 12, veggie: 6, tree: 2 };
const TOTAL_CLEARABLE = COUNTS.weed + COUNTS.veggie + COUNTS.rare;

let tiles = [];
let totalPulls = {};
let isMuted = false;
let audioCtx = null;
let ponBuffer = null;

// 音響の初期化
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  fetch("pon.mp3").then(r => r.arrayBuffer()).then(b => audioCtx.decodeAudioData(b)).then(buf => ponBuffer = buf);
}

function playPon() {
  if (isMuted || !ponBuffer) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const src = audioCtx.createBufferSource();
  src.buffer = ponBuffer;
  src.connect(audioCtx.destination);
  src.start();
}

function forceUnlockAudio() {
  if (!audioCtx) initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

// 庭の再構築
function resetField() {
  tiles = Array.from({length: 156}, (_, i) => ({ id: i, type: "weed", cleared: false, emoji: "🌱" }));
  renderField();
}

function renderField() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  grid.innerHTML = "";
  tiles.forEach(tile => {
    const div = document.createElement("div");
    div.className = "tile";
    div.innerHTML = tile.emoji;
    div.addEventListener("pointerdown", () => {
      forceUnlockAudio();
      playPon();
      div.style.visibility = "hidden"; // 仮の処理
    });
    grid.appendChild(div);
  });
}

// イベント設定（重複を排除して1箇所にまとめた）
window.addEventListener("DOMContentLoaded", () => {
  const muteBtn = document.getElementById("muteBtn");
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      forceUnlockAudio();
      isMuted = !isMuted;
      muteBtn.textContent = isMuted ? "🔇 消音" : "🔊 音あり";
    });
  }

  document.getElementById("resetBtn").addEventListener("click", resetField);
  document.getElementById("zukanOpenBtn").addEventListener("click", () => {
    document.getElementById("modalOverlay").classList.add("open");
  });
  
  resetField();
});
