// ---- 定数 ----
const WEED_EMOJI = ["🌱", "🍀", "🌿"];
const FLOWER_EMOJI = ["🌷", "🌼", "🌸"];
const VEGGIE_EMOJI = ["🍆", "🥕"];
const TREE_EMOJI = ["🌳", "🌲"];

const RARE_ICONS = ["🌟","💖","🌟","💖","🌟","💖","🌟","💖","🌟"];
const RARE_WEEDS = [
  { name: "顔がついている草",       desc: "たまにこちらを見てくるが、別に害はない。",         icon: RARE_ICONS[0] },
  { name: "やたら筋肉質な草",       desc: "触るとムキムキしていて、なんか頼りになりそう。",   icon: RARE_ICONS[1] },
  { name: "なんかめっちゃ光ってる草", desc: "夜になると光を放つ、とても目立つ草。",           icon: RARE_ICONS[2] },
  { name: "なんか耳っぽい草",       desc: "風の音などを集めているように揺れている。",         icon: RARE_ICONS[3] },
  { name: "ウワァー！ってなる草",   desc: "引き抜くと悲鳴のような変な音が鳴る。",             icon: RARE_ICONS[4] },
  { name: "イヤァー！ってなる草",   desc: "近づくとしおれて、なんだかこちらまで悲しくなる。", icon: RARE_ICONS[5] },
  { name: "夜中に踊るらしい草",     desc: "真夜中になるとふわふわ揺れて踊り出す。",           icon: RARE_ICONS[6] },
  { name: "エコな説明をする草",     desc: "近づくと図や記号でいろんな説明をしてくれる。",     icon: RARE_ICONS[7] },
  { name: "うるさい草",             desc: "いろんなことをずっとしゃべり続けている。",         icon: RARE_ICONS[8] },
];

const COUNTS = { weed: 144, rare: 6, flower: 12, veggie: 6, tree: 2 };
const TOTAL_CELLS = Object.values(COUNTS).reduce((a, b) => a + b, 0);
const TOTAL_CLEARABLE = COUNTS.weed + COUNTS.veggie + COUNTS.rare;
const HOLD_DURATION = 1100;
const TILE_GAP = 4;

let COLS = window.innerWidth >= window.innerHeight ? 17 : 10;
let ROWS = TOTAL_CELLS / COLS;

let tiles = [];
let totalPulls = {};
let dragging = false;
let holdState = null;

let lastX = null;
let lastY = null;
let tileAreas = [];
let hasShownVeggieCompleteMsg = false;

// ---- 音響・ミュートシステム ----
let audioCtx = null;
let ponBuffer = null;
let isMuted = false;

function initAudioSystem() {
  if (audioCtx) return;
  try {
    const ContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new ContextClass();
    
    fetch("pon.mp3")
      .then(res => res.arrayBuffer())
      .then(data => audioCtx.decodeAudioData(data))
      .then(buffer => { 
        ponBuffer = buffer; 
      })
      .catch(err => console.error("音源ファイルの読み込みに失敗しました:", err));
  } catch (e) {
    console.error("Web Audio API非対応環境です", e);
  }
}

function forceUnlockAudio() {
  initAudioSystem();
  if (!audioCtx) return;
  
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  
  try {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(0);
    oscillator.stop(audioCtx.currentTime + 0.01);
  } catch (e) {
    console.error("アンロックエラー:", e);
  }
}

document.addEventListener("click", forceUnlockAudio);
document.addEventListener("touchstart", forceUnlockAudio, { passive: true });
document.addEventListener("touchend", forceUnlockAudio);

function playPon() {
  if (isMuted) return; 
  if (!audioCtx) initAudioSystem();
  if (!audioCtx) return;
  
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  
  if (!ponBuffer) return; 
  try {
    const source = audioCtx.createBufferSource();
    source.buffer = ponBuffer;
    source.connect(audioCtx.destination);
    source.start(0);
  } catch (e) {
    console.error("再生エラー:", e);
  }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function isWeedCover(tile)      { return tile.type === "veggie" && tile.weedCover; }
function isRevealedVeggie(tile) { return tile.type === "veggie" && !tile.weedCover; }
function isProtected(tile)      { return tile.type === "flower" || tile.type === "tree" || isRevealedVeggie(tile); }
function canDragPull(tile)      { return (tile.type === "weed" && !tile.cleared) || isWeedCover(tile); }
function countsAsPulled(tile)   {
  return (tile.type === "rare"  && tile.cleared)
      || (tile.type === "weed"  && tile.cleared)
      || isRevealedVeggie(tile);
}

function getGridSize() {
  COLS = window.innerWidth >= window.innerHeight ? 17 : 10;
  ROWS = TOTAL_CELLS / COLS;
}

function buildField() {
  getGridSize();
  const grid2d = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const VEG_W = COLS >= ROWS ? 3 : 2;
  const VEG_H = COUNTS.veggie / VEG_W;
  const anchorRow = Math.floor(Math.random() * (ROWS - VEG_H + 1));
  const anchorCol = Math.floor(Math.random() * (COLS - VEG_W + 1));
  
  for (let r = 0; r < VEG_H; r++) {
    for (let c = 0; c < VEG_W; c++) {
      if (anchorRow + r < ROWS && anchorCol + c < COLS) {
        grid2d[anchorRow + r][anchorCol + c] = "veggie";
      }
    }
  }

  const pool = [];
  for (let i = 0; i < COUNTS.weed;   i++) pool.push("weed");
  for (let i = 0; i < COUNTS.rare;   i++) pool.push("rare");
  for (let i = 0; i < COUNTS.flower; i++) pool.push("flower");
  for (let i = 0; i < COUNTS.tree;   i++) pool.push("tree");
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let p = 0;
  const flat = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      flat.push(grid2d[r][c] || pool[p++]);

  return flat.map((type, idx) => {
    let emoji = "", rareInfo = null, veggieEmoji = null, weedCover = false;
    if (type === "weed")   emoji = pick(WEED_EMOJI);
    if (type === "flower") emoji = pick(FLOWER_EMOJI);
    if (type === "tree")   emoji = pick(TREE_EMOJI);
    if (type === "veggie") { veggieEmoji = pick(VEGGIE_EMOJI); emoji = pick(WEED_EMOJI); weedCover = true; }
    if (type === "rare")   { rareInfo = pick(RARE_WEEDS); emoji = Math.random() < 0.5 ? "🌟" : "💖"; }
    return { id: idx, type, emoji, rareInfo, cleared: false, veggieEmoji, weedCover };
  });
}

function forceRenameTitle() {
  document.title = "雑草すっぽん！";
  const mainTitleEl = document.querySelector(".header-title");
  if (mainTitleEl) mainTitleEl.textContent = "雑草すっぽん！";
}

function renderField() {
  forceRenameTitle(); 

  const grid = document.getElementById("grid");
  if (!grid) return;
  grid.innerHTML = "";
  
  tiles.forEach((tile) => {
    const div = document.createElement("div");
    div.className = "tile";
    div.dataset.tileId = tile.id;
    div.style.touchAction = "none";
    if (tile.type === "veggie") {
      div.innerHTML = `
        <span class="tile-emoji weed-cover">${tile.emoji}</span>
        <span class="tile-emoji veggie-base" hidden>${tile.veggieEmoji}</span>`;
    } else {
      div.innerHTML = `<span class="tile-emoji">${tile.emoji}</span>`;
    }
    div.addEventListener("contextmenu",  (e) => e.preventDefault());
    div.addEventListener("pointerdown",  (e) => onTileDown(e, tile.id));
    grid.appendChild(div);
    updateTileVisual(tile.id);
  });
  
  const totalClearableEl = document.getElementById("totalClearable");
  if (totalClearableEl) totalClearableEl.textContent = TOTAL_CLEARABLE;
  
  updateCounters();
  fitGridToScreen();
}

function getTileEl(id) { return document.querySelector(`.tile[data-tile-id="${id}"]`); }

function updateTileVisual(id) {
  const tile = tiles.find((t) => t.id === id);
  const el = getTileEl(id);
  if (!tile || !el) return;
  el.style.touchAction = "none";
  
  const isSoil = tile.cleared && tile.type !== "veggie";
  el.classList.toggle("cleared",         isSoil);
  el.classList.toggle("veggie-revealed", isRevealedVeggie(tile));
  el.classList.toggle("veggie-covered",  isWeedCover(tile));
  el.classList.toggle("rare-glow",       tile.type === "rare" && !tile.cleared);
  if (tile.type === "veggie") {
    const cover = el.querySelector(".weed-cover");
    const base  = el.querySelector(".veggie-base");
    if (cover) cover.hidden = !tile.weedCover;
    if (base)  base.hidden  =  tile.weedCover;
    return;
  }
  const emojiSpan = el.querySelector(".tile-emoji");
  if (!emojiSpan) return;
  emojiSpan.hidden = isSoil;
  if (!isSoil) emojiSpan.textContent = tile.emoji;
}

function updateCounters() {
  const clearedCount = tiles.filter(countsAsPulled).length;
  const pct = TOTAL_CLEARABLE ? Math.round((clearedCount / TOTAL_CLEARABLE) * 100) : 0;
  
  const clearedCountEl = document.getElementById("clearedCount");
  if (clearedCountEl) clearedCountEl.textContent = clearedCount;
  
  const pctTextEl = document.getElementById("pctText");
  if (pctTextEl) pctTextEl.textContent = pct + "%";
  
  const progressFillEl = document.getElementById("progressFill");
  if (progressFillEl) progressFillEl.style.width = pct + "%";
  
  if (pct >= 100) showFinish();
}

function showVeggieMessage(tileId, text) {
  const el = getTileEl(tileId);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const span = document.createElement("span");
  span.className = "veggie-msg";
  span.textContent = text;
  span.style.left = (rect.left + rect.width / 2) + "px";
  span.style.top  = (rect.top  + rect.height / 2) + "px";
  document.body.appendChild(span);
  setTimeout(() => span.remove(), 2200);
}

function showFieldMessage(text) {
  const existing = document.getElementById("field-msg");
  if (existing) existing.remove();
  const field = document.getElementById("field");
  if (!field) return;
  const div = document.createElement("div");
  div.id = "field-msg";
  div.textContent = text;
  field.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

function addFloatEffect(id, text) {
  const el = getTileEl(id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const span = document.createElement("span");
  span.className = "float-effect";
  span.textContent = text;
  span.style.left = (rect.left + rect.width / 2) + "px";
  span.style.top = (rect.top + rect.height / 2) + "px";
  document.body.appendChild(span);
  setTimeout(() => span.remove(), 750);
}

function showGauge(id, rareEmoji) {
  const overlay = document.getElementById("gauge-overlay");
  const el = getTileEl(id);
  if (!overlay || !el) return;

  const rect = el.getBoundingClientRect();
  overlay.style.left = rect.left + "px";
  overlay.style.top = rect.top + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.height = rect.height + "px";
  overlay.style.display = "flex";

  const emojiEl = document.getElementById("gaugeEmoji");
  if (emojiEl) emojiEl.textContent = rareEmoji;

  const path = document.getElementById("gaugePath");
  if (path) path.style.strokeDasharray = "0, 100";
}

function updateGauge(pct) {
  const path = document.getElementById("gaugePath");
  if (path) path.style.strokeDasharray = `${pct}, 100`;
}

function hideGauge(complete) {
  const overlay = document.getElementById("gauge-overlay");
  if (overlay) overlay.style.display = "none";
}

function pullWeed(id) {
  const tile = tiles.find((t) => t.id === id);
  if (!tile || !canDragPull(tile)) return;
  if (tile.type === "weed") {
    tile.cleared = true;
    playPon();
    addFloatEffect(id, "すぽんっ！");
  } else if (isWeedCover(tile)) {
    tile.weedCover = false;
    playPon();
    addFloatEffect(id, "発掘！");
    
    const allVeggieRevealed = tiles.filter(t => t.type === "veggie" && !t.weedCover).length;
    if (allVeggieRevealed === 1) { 
      showVeggieMessage(id, "あれ？野菜だ！"); 
    } else if (allVeggieRevealed === COUNTS.veggie && !hasShownVeggieCompleteMsg) { 
      hasShownVeggieCompleteMsg = true;
      showVeggieMessage(id, "💡 家庭菜園だったのか！"); 
    }
  }
  updateTileVisual(id);
  updateCounters();
}

function pullRare(id) {
  const tile = tiles.find((t) => t.id === id);
  if (!tile || tile.type !== "rare" || tile.cleared) return;
  tile.cleared = true;
  playPon();
  if (tile.rareInfo) {
    totalPulls[tile.rareInfo.name] = (totalPulls[tile.rareInfo.name] || 0) + 1;
    addFloatEffect(id, "大すぽんっ！");
    renderZukan();
  }
  updateTileVisual(id);
  showFieldMessage("✨ 採取完了！");
  hideGauge(true);
  updateCounters();
}

function cancelHold() {
  if (holdState) clearInterval(holdState.interval);
  holdState = null;
  hideGauge(false);
}

function startHold(id) {
  if (holdState) cancelHold();
  const tile = tiles.find((t) => t.id === id);
  showGauge(id, tile ? tile.emoji : "🌟");
  const startTime = Date.now();
  const interval = setInterval(() => {
    const p = Math.min(100, ((Date.now() - startTime) / HOLD_DURATION) * 100);
    updateGauge(p);
    if (p >= 100) {
      clearInterval(interval);
      holdState = null;
      pullRare(id);
    }
  }, 40);
  holdState = { id, interval };
}

function triggerShake(id) {
  const el = getTileEl(id);
  if (!el) return;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), 300);
}

function triggerResist(id) {
  const el = getTileEl(id);
  if (!el || el.dataset.resisting) return;
  el.dataset.resisting = "1";
  el.classList.add("resist");
  setTimeout(() => { el.classList.remove("resist"); delete el.dataset.resisting; }, 250);
}

function checkAndPullAt(x, y) {
  const found = tileAreas.find(a => x >= a.left && x <= a.right && y >= a.top && y <= a.bottom);
  if (!found) return;
  
  const id = found.id;
  const tile = tiles.find((t) => t.id === id);
  if (!tile || (tile.cleared && tile.type !== "veggie")) return;
  if (tile.type === "rare") { triggerResist(id); return; }
  if (isProtected(tile))   { triggerShake(id);  return; }
  if (canDragPull(tile))   pullWeed(id);
}

function cacheTileAreas() {
  tileAreas = [];
  tiles.forEach((tile) => {
    const el = getTileEl(tile.id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    tileAreas.push({
      id: tile.id,
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY
    });
  });
}

function onTileDown(e, id) {
  e.preventDefault();
  forceUnlockAudio(); 
  
  const tile = tiles.find((t) => t.id === id);
  if (!tile) return;
  
  if (tile.type === "rare") { startHold(id); return; }
  
  dragging = true; 
  lastX = e.pageX;
  lastY = e.pageY;
  
  if (isProtected(tile)) { 
    triggerShake(id); 
  } else if (canDragPull(tile)) { 
    pullWeed(id); 
  }
}

function onPointerMoveGlobal(e) {
  if (!dragging) return;
  const currentX = e.pageX;
  const currentY = e.pageY;

  if (lastX !== null && lastY !== null) {
    const dx = currentX - lastX;
    const dy = currentY - lastY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const steps = Math.ceil(distance / 8); 
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = lastX + dx * t;
      const y = lastY + dy * t;
      checkAndPullAt(x, y);
    }
  } else {
    checkAndPullAt(currentX, currentY);
  }

  lastX = currentX;
  lastY = currentY;
}

function onPointerUpGlobal() { 
  dragging = false; 
  cancelHold(); 
  lastX = null; 
  lastY = null; 
}

function showFinish() {
  if (document.getElementById("finish-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "finish-overlay";
  overlay.innerHTML = `
    <div class="finish-box">
      <div class="finish-text">🌸 FINISH! 🌸</div>
      <div class="finish-sub">庭がきれいになったよ！</div>
      <button class="finish-reset" id="finishResetBtn">もう一度</button>
    </div>`;
  document.body.appendChild(overlay);
  
  const btn = document.getElementById("finishResetBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      overlay.remove();
      resetField();
    });
  }
}

function setAppHeight() {
  const app = document.getElementById("app");
  if (!app) return;
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  app.style.height = h + "px";
}

function fitGridToScreen() {
  getGridSize();
  setAppHeight();
  const field = document.getElementById("field");
  const grid  = document.getElementById("grid");
  if (!field || !grid) return;
  
  const gap = TILE_GAP, pad = 16, minSize = 20;
  const availW = field.clientWidth  - pad;
  const availH = field.clientHeight - pad;
  const size = Math.max(Math.min(
    (availW - gap * (COLS - 1)) / COLS,
    (availH - gap * (ROWS - 1)) / ROWS
  ), minSize);
  
  grid.style.gridTemplateColumns = `repeat(${COLS}, ${size}px)`;
  grid.style.gridAutoRows        = `${size}px`;
  grid.style.gap                 = `${gap}px`;
  grid.style.width               = (COLS * size + (COLS - 1) * gap) + "px";
  grid.style.height              = (ROWS * size + (ROWS - 1) * gap) + "px";

  setTimeout(cacheTileAreas, 0);
}

window.addEventListener("resize", fitGridToScreen);
window.addEventListener("orientationchange", fitGridToScreen);
if (window.visualViewport) window.visualViewport.addEventListener("resize", fitGridToScreen);

function renderZukan() {
  const foundCount = RARE_WEEDS.filter((w) => (totalPulls[w.name] || 0) > 0).length;
  const zukanCountEl = document.getElementById("zukanCount");
  if (zukanCountEl) zukanCountEl.textContent = `${foundCount}/${RARE_WEEDS.length}`;
  
  const list = document.getElementById("zukanList");
  if (!list) return;
  list.innerHTML = "";
  
  const zukanGrid = document.createElement("div");
  zukanGrid.className = "zukan-grid";
  RARE_WEEDS.forEach((w) => {
    const count = totalPulls[w.name] || 0;
    const found = count > 0;
    const card  = document.createElement("div");
    card.className = "zukan-card" + (found ? " found" : " locked");
    card.innerHTML = `
      <span class="zukan-icon">${found ? w.icon : "❓"}</span>
      <div class="zukan-name">${found ? w.name : "？？？？？"}</div>
      ${found ? `<div class="zukan-desc">${w.desc}</div><div class="zukan-pulls">これまで ${count} 本</div>` : ""}`;
    zukanGrid.appendChild(card);
  });
  list.appendChild(zukanGrid);
}

function resetField() {
  tiles = buildField();
  cancelHold();
  dragging = false;
  hasShownVeggieCompleteMsg = false; 
  renderField();
  renderZukan();
}

document.addEventListener("pointermove",   onPointerMoveGlobal);
document.addEventListener("pointerup",     onPointerUpGlobal);
document.addEventListener("pointercancel", onPointerUpGlobal);
document.addEventListener("contextmenu",   (e) => e.preventDefault());

// ---- 安全なイベントリスナー登録 ----
window.addEventListener("DOMContentLoaded", () => {
  const muteBtn = document.getElementById("muteBtn");
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      forceUnlockAudio(); 
      isMuted = !isMuted;
      muteBtn.textContent = isMuted ? "🔇" : "🔊";
      muteBtn.style.opacity = isMuted ? "0.5" : "1.0"; 
    });
  }

  const zukanOpenBtn = document.getElementById("zukanOpenBtn");
  const modalOverlay = document.getElementById("modalOverlay");
  if (zukanOpenBtn && modalOverlay) {
    zukanOpenBtn.addEventListener("click", () => modalOverlay.classList.add("open"));
  }

  const zukanCloseBtn = document.getElementById("zukanCloseBtn");
  if (zukanCloseBtn && modalOverlay) {
    zukanCloseBtn.addEventListener("click", () => modalOverlay.classList.remove("open"));
  }

  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target.id === "modalOverlay") modalOverlay.classList.remove("open");
    });
  }

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetField);
  }

  initAudioSystem();
  resetField();
});
