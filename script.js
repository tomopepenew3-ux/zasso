// ---- 定数 ----
const WEED_EMOJI = ["🌱", "🍀", "🌿"];
const FLOWER_EMOJI = ["🌷", "🌼", "🌸"];
const VEGGIE_EMOJI = ["🍆", "🥕"];
const TREE_EMOJI = ["🌳", "🌲"];

const RARE_ICONS = ["🌟", "💖", "🌟", "💖", "🌟", "💖", "🌟", "💖", "🌟"];
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
const TOTAL_CELLS = Object.values(COUNTS).reduce((a, b) => a + b, 0);
const TOTAL_CLEARABLE = COUNTS.weed + COUNTS.veggie + COUNTS.rare; // 144+6+6=156
const HOLD_DURATION = 1100;

let COLS = window.innerWidth >= window.innerHeight ? 17 : 10;
let ROWS = TOTAL_CELLS / COLS;

let tiles = [];
let totalPulls = {};
let dragging = false;
let holdState = null;
let audioUnlocked = false;

const sfxPon = new Audio("pon.mp3");
sfxPon.preload = "auto";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function getGridSize() {
  COLS = window.innerWidth >= window.innerHeight ? 17 : 10;
  ROWS = TOTAL_CELLS / COLS;
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  sfxPon.play().then(() => { sfxPon.pause(); sfxPon.currentTime = 0; }).catch(() => {});
}

function playPon() {
  unlockAudio();
  sfxPon.currentTime = 0;
  sfxPon.play().catch(() => {});
}

function isWeedCover(tile) {
  return tile.type === "veggie" && tile.weedCover;
}

function isRevealedVeggie(tile) {
  return tile.type === "veggie" && !tile.weedCover;
}

function isProtected(tile) {
  return tile.type === "flower" || tile.type === "tree" || isRevealedVeggie(tile);
}

function canDragPull(tile) {
  return (tile.type === "weed" && !tile.cleared) || isWeedCover(tile);
}

function countsAsPulled(tile) {
  return (tile.type === "rare" && tile.cleared)
    || (tile.type === "weed" && tile.cleared)
    || isRevealedVeggie(tile);
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
      grid2d[anchorRow + r][anchorCol + c] = "veggie";
    }
  }

  const pool = [];
  for (let i = 0; i < COUNTS.weed; i++) pool.push("weed");
  for (let i = 0; i < COUNTS.rare; i++) pool.push("rare");
  for (let i = 0; i < COUNTS.flower; i++) pool.push("flower");
  for (let i = 0; i < COUNTS.tree; i++) pool.push("tree");
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let p = 0;
  const flat = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      flat.push(grid2d[r][c] || pool[p++]);
    }
  }

  return flat.map((type, idx) => {
    let emoji = "", rareInfo = null, veggieEmoji = null, weedCover = false;
    if (type === "weed") emoji = pick(WEED_EMOJI);
    if (type === "flower") emoji = pick(FLOWER_EMOJI);
    if (type === "tree") emoji = pick(TREE_EMOJI);
    if (type === "veggie") {
      veggieEmoji = pick(VEGGIE_EMOJI);
      emoji = pick(WEED_EMOJI);
      weedCover = true;
    }
    if (type === "rare") {
      rareInfo = pick(RARE_WEEDS);
      emoji = Math.random() < 0.5 ? "🌟" : "💖";
    }
    return { id: idx, type, emoji, rareInfo, cleared: false, veggieEmoji, weedCover };
  });
}

function renderField() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  tiles.forEach((tile) => {
    const div = document.createElement("div");
    div.className = "tile";
    div.dataset.tileId = tile.id;
    if (tile.type === "veggie") {
      div.innerHTML = `
        <span class="tile-emoji weed-cover">${tile.emoji}</span>
        <span class="tile-emoji veggie-base" hidden>${tile.veggieEmoji}</span>
      `;
    } else {
      div.innerHTML = `<span class="tile-emoji">${tile.emoji}</span>`;
    }
    div.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    div.addEventListener("contextmenu", (e) => e.preventDefault());
    div.addEventListener("pointerdown", (e) => onTileDown(e, tile.id));
    grid.appendChild(div);
    updateTileVisual(tile.id);
  });
  document.getElementById("totalClearable").textContent = TOTAL_CLEARABLE;
  updateCounters();
  fitGridToScreen();
}

function getTileEl(id) {
  return document.querySelector(`.tile[data-tile-id="${id}"]`);
}

function updateTileVisual(id) {
  const tile = tiles.find((t) => t.id === id);
  const el = getTileEl(id);
  if (!tile || !el) return;

  const isSoil = tile.cleared && tile.type !== "veggie";
  el.classList.toggle("cleared", isSoil);
  el.classList.toggle("veggie-revealed", isRevealedVeggie(tile));
  el.classList.toggle("veggie-covered", isWeedCover(tile));
  el.classList.toggle("rare-glow", tile.type === "rare" && !tile.cleared);

  if (tile.type === "veggie") {
    const cover = el.querySelector(".weed-cover");
    const base = el.querySelector(".veggie-base");
    if (!cover || !base) return;
    cover.hidden = !tile.weedCover;
    base.hidden = tile.weedCover;
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
  document.getElementById("clearedCount").textContent = clearedCount;
  document.getElementById("pctText").textContent = pct + "%";
  document.getElementById("progressFill").style.width = pct + "%";
  if (pct >= 100) showFinish();
}

function addFloatEffect(id, text) {
  const el = getTileEl(id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const span = document.createElement("span");
  span.className = "float-effect";
  span.textContent = text;
  span.style.left = rect.left + rect.width / 2 + "px";
  span.style.top = rect.top - 4 + "px";
  document.body.appendChild(span);
  setTimeout(() => span.remove(), 750);
}

const gaugeOverlay = document.getElementById("gauge-overlay");
const gaugeCircle = gaugeOverlay.querySelector(".gauge-circle");
const gaugeEmoji = document.getElementById("gaugeEmoji");

function showGaugeAt(id) {
  const el = getTileEl(id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.4;
  gaugeOverlay.style.width = size + "px";
  gaugeOverlay.style.height = size + "px";
  gaugeOverlay.style.left = rect.left + rect.width / 2 - size / 2 + "px";
  gaugeOverlay.style.top = rect.top + rect.height / 2 - size / 2 + "px";
  gaugeCircle.setAttribute("stroke-dasharray", "0 100");
  const tile = tiles.find((t) => t.id === id);
  gaugeEmoji.textContent = tile ? tile.emoji : "🌟";
  gaugeOverlay.style.display = "flex";
}

function updateGauge(pct) {
  gaugeCircle.setAttribute("stroke-dasharray", `${pct * 0.94} 100`);
  const pushEl = gaugeOverlay.querySelector(".gauge-push");
  if (pushEl) pushEl.style.opacity = Math.max(0, 1 - pct / 40) + "";
}

function hideGauge() { gaugeOverlay.style.display = "none"; }

function pullWeed(id) {
  const tile = tiles.find((t) => t.id === id);
  if (!tile || !canDragPull(tile)) return;
  if (tile.type === "weed") {
    tile.cleared = true;
    playPon();
    addFloatEffect(id, "ポンッ！");
  } else if (isWeedCover(tile)) {
    tile.weedCover = false;
    playPon();
    addFloatEffect(id, "発掘！");
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
    addFloatEffect(id, "スポンッ！");
    renderZukan();
  }
  updateTileVisual(id);
  updateCounters();
}

function cancelHold() {
  if (holdState) clearInterval(holdState.interval);
  holdState = null;
  hideGauge();
}

function startHold(id) {
  if (holdState) cancelHold();
  showGaugeAt(id);
  addFloatEffect(id, "Push!");
  const startTime = Date.now();
  const interval = setInterval(() => {
    const p = Math.min(100, ((Date.now() - startTime) / HOLD_DURATION) * 100);
    updateGauge(p);
    if (p >= 100) {
      clearInterval(interval);
      holdState = null;
      hideGauge();
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

function blockDrag(id, tile) {
  if (tile.type === "rare") triggerResist(id);
  else triggerShake(id);
  dragging = false;
}

function onTileDown(e, id) {
  e.preventDefault();
  unlockAudio();
  const tile = tiles.find((t) => t.id === id);
  if (!tile) return;
  if (tile.cleared && tile.type !== "veggie") return;

  if (isProtected(tile)) { triggerShake(id); return; }
  if (tile.type === "rare") { startHold(id); return; }
  if (canDragPull(tile)) { dragging = true; pullWeed(id); }
}

function onPointerMoveGlobal(e) {
  if (!dragging) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const tileEl = el && el.closest(".tile");
  if (!tileEl) return;
  const id = Number(tileEl.dataset.tileId);
  const tile = tiles.find((t) => t.id === id);
  if (!tile || (tile.cleared && tile.type !== "veggie")) return;
  if (isProtected(tile) || tile.type === "rare") { blockDrag(id, tile); return; }
  if (canDragPull(tile)) pullWeed(id);
}

function onPointerUpGlobal() { dragging = false; cancelHold(); }

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
  document.getElementById("finishResetBtn").addEventListener("click", () => {
    overlay.remove();
    resetField();
  });
}

function setAppHeight() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.getElementById("app").style.height = h + "px";
}

function fitGridToScreen() {
  getGridSize();
  setAppHeight();
  const field = document.getElementById("field");
  const grid = document.getElementById("grid");
  const gap = 4, pad = 16, minSize = 20;
  const availW = field.clientWidth - pad;
  const availH = field.clientHeight - pad;
  const size = Math.max(Math.min(
    (availW - gap * (COLS - 1)) / COLS,
    (availH - gap * (ROWS - 1)) / ROWS
  ), minSize);
  grid.style.gridTemplateColumns = `repeat(${COLS}, ${size}px)`;
  grid.style.gridAutoRows = `${size}px`;
  grid.style.gap = `${gap}px`;
  grid.style.width = COLS * size + (COLS - 1) * gap + "px";
  grid.style.height = ROWS * size + (ROWS - 1) * gap + "px";
}

window.addEventListener("resize", fitGridToScreen);
window.addEventListener("orientationchange", fitGridToScreen);
if (window.visualViewport) window.visualViewport.addEventListener("resize", fitGridToScreen);

function renderZukan() {
  const foundCount = RARE_WEEDS.filter((w) => (totalPulls[w.name] || 0) > 0).length;
  document.getElementById("zukanCount").textContent = `${foundCount}/${RARE_WEEDS.length}`;
  const list = document.getElementById("zukanList");
  list.innerHTML = "";
  const zukanGrid = document.createElement("div");
  zukanGrid.className = "zukan-grid";
  RARE_WEEDS.forEach((w) => {
    const count = totalPulls[w.name] || 0;
    const found = count > 0;
    const card = document.createElement("div");
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
  renderField();
  renderZukan();
}

document.addEventListener("pointermove", onPointerMoveGlobal);
document.addEventListener("touchmove", (e) => {
  if (!dragging) return;
  const t = e.touches[0];
  onPointerMoveGlobal({ clientX: t.clientX, clientY: t.clientY });
}, { passive: true });
document.addEventListener("pointerup", onPointerUpGlobal);
document.addEventListener("pointercancel", onPointerUpGlobal);
document.addEventListener("contextmenu", (e) => e.preventDefault());

document.getElementById("zukanOpenBtn").addEventListener("click", () => {
  document.getElementById("modalOverlay").classList.add("open");
});
document.getElementById("zukanCloseBtn").addEventListener("click", () => {
  document.getElementById("modalOverlay").classList.remove("open");
});
document.getElementById("modalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "modalOverlay") e.target.classList.remove("open");
});
document.getElementById("resetBtn").addEventListener("click", resetField);

resetField();
