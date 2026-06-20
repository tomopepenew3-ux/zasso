// ---- 定数 ----
const WEED_EMOJI = ["🌱","🍀","🌿"];
const FLOWER_EMOJI = ["🌷","🌼","🌸"];
const VEGGIE_EMOJI = ["🍆","🥕"];
const TREE_EMOJI = ["🌳","🌲"];

const RARE_ICONS = ["🌟","💖","🌟","💖","🌟","💖","🌟","💖","🌟"];
const RARE_WEEDS = [
  { name: "顔がついている草",     desc: "たまにこちらを見てくるが、別に害はない。",             icon: RARE_ICONS[0] },
  { name: "やたら筋肉質な草",     desc: "触るとムキムキしていて、なんか頼りになりそう。",       icon: RARE_ICONS[1] },
  { name: "なんかめっちゃ光ってる草", desc: "夜になると光を放つ、とても目立つ草。",            icon: RARE_ICONS[2] },
  { name: "なんか耳っぽい草",     desc: "風の音などを集めているように揺れている。",             icon: RARE_ICONS[3] },
  { name: "ウワァー！ってなる草", desc: "引き抜くと悲鳴のような変な音が鳴る。",                 icon: RARE_ICONS[4] },
  { name: "イヤァー！ってなる草", desc: "近づくとしおれて、なんだかこちらまで悲しくなる。",     icon: RARE_ICONS[5] },
  { name: "夜中に踊るらしい草",   desc: "真夜中になるとふわふわ揺れて踊り出す。",               icon: RARE_ICONS[6] },
  { name: "エコな説明をする草",   desc: "近づくと図や記号でいろんな説明をしてくれる。",         icon: RARE_ICONS[7] },
  { name: "うるさい草",           desc: "いろんなことをずっとしゃべり続けている。",             icon: RARE_ICONS[8] },
];

const COUNTS = { weed: 144, rare: 6, flower: 12, veggie: 6, tree: 2 };
const TOTAL_CELLS = Object.values(COUNTS).reduce((a, b) => a + b, 0); // 170
const TOTAL_CLEARABLE = COUNTS.weed + COUNTS.rare;
const HOLD_DURATION = 1100;

// 列数・行数は縦横比で固定(170 = 10×17 = 17×10)
const COLS = window.innerWidth >= window.innerHeight ? 17 : 10;
const ROWS = TOTAL_CELLS / COLS;

let tiles = [];
let totalPulls = {}; // { 草の名前: 累計本数 } ※庭リセットでも引き継ぐ
let dragging = false;
let holdState = null;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---- フィールド構築 ----
function buildField() {
  const grid2d = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  // 家庭菜園ブロックを1箇所に固めて配置。
  // 見た目は最初から草として偽装し、なぞって抜くと野菜が発掘される。
  const VEG_W = COLS >= ROWS ? 3 : 2;
  const VEG_H = COUNTS.veggie / VEG_W;
  const anchorRow = Math.floor(Math.random() * (ROWS - VEG_H + 1));
  const anchorCol = Math.floor(Math.random() * (COLS - VEG_W + 1));
  for (let r = 0; r < VEG_H; r++) {
    for (let c = 0; c < VEG_W; c++) {
      grid2d[anchorRow + r][anchorCol + c] = "veggie";
    }
  }

  let pool = [];
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
    let emoji = "", rareInfo = null, veggieEmoji = null;
    if (type === "weed")   emoji = pick(WEED_EMOJI);
    if (type === "flower") emoji = pick(FLOWER_EMOJI);
    if (type === "tree")   emoji = pick(TREE_EMOJI);
    if (type === "veggie") {
      veggieEmoji = pick(VEGGIE_EMOJI);  // 発掘後に出てくる野菜
      emoji = pick(WEED_EMOJI);          // 最初は草として偽装
    }
    if (type === "rare") {
      rareInfo = pick(RARE_WEEDS);
      emoji = Math.random() < 0.5 ? "🌟" : "💖";
    }
    return { id: idx, type, emoji, rareInfo, cleared: false, veggieEmoji };
  });
}

// ---- 描画 ----
function renderField() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  tiles.forEach((tile) => {
    const div = document.createElement("div");
    div.className = "tile";
    div.dataset.tileId = tile.id;
    div.innerHTML = `<span class="tile-emoji">${tile.emoji}</span>`;
    // touchstart を preventDefault しないと iOS が長押し選択メニューを出す
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

  const isRevealedVeggie = tile.type === "veggie" && tile.cleared;
  const isClearedSoil    = tile.cleared && tile.type !== "veggie";
  const isRareUncleared  = tile.type === "rare" && !tile.cleared;

  el.classList.toggle("cleared",        isClearedSoil);
  el.classList.toggle("veggie-revealed", isRevealedVeggie);
  el.classList.toggle("rare-glow",       isRareUncleared);

  const emojiSpan = el.querySelector(".tile-emoji");
  if (!emojiSpan) return;
  if (isRevealedVeggie) {
    // 草を抜いたら下から野菜が出てくる
    emojiSpan.textContent = tile.veggieEmoji;
    emojiSpan.style.display = "inline";
  } else if (isClearedSoil) {
    emojiSpan.style.display = "none";
  } else {
    emojiSpan.textContent = tile.emoji;
    emojiSpan.style.display = "inline";
  }
}

function updateCounters() {
  const clearedCount = tiles.filter(
    (t) => t.cleared && (t.type === "weed" || t.type === "rare")
  ).length;
  const pct = TOTAL_CLEARABLE ? Math.round((clearedCount / TOTAL_CLEARABLE) * 100) : 0;
  document.getElementById("clearedCount").textContent = clearedCount;
  document.getElementById("pctText").textContent = pct + "%";
  document.getElementById("progressFill").style.width = pct + "%";
  if (pct >= 100) showFinish();
}

// ---- フロートテキスト(固定positionでタイル上空に出す) ----
function addFloatEffect(id, text) {
  const el = getTileEl(id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const span = document.createElement("span");
  span.className = "float-effect";
  span.textContent = text;
  span.style.left = (rect.left + rect.width / 2) + "px";
  span.style.top  = (rect.top - 4) + "px";
  document.body.appendChild(span);
  setTimeout(() => span.remove(), 750);
}

// ---- ゲージオーバーレイ(固定positionで最前面) ----
const gaugeOverlay = document.getElementById("gauge-overlay");
const gaugeCircle  = gaugeOverlay.querySelector(".gauge-circle");
const gaugeEmoji   = document.getElementById("gaugeEmoji");

function showGaugeAt(id) {
  const el = getTileEl(id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.4;
  gaugeOverlay.style.width  = size + "px";
  gaugeOverlay.style.height = size + "px";
  gaugeOverlay.style.left   = (rect.left + rect.width  / 2 - size / 2) + "px";
  gaugeOverlay.style.top    = (rect.top  + rect.height / 2 - size / 2) + "px";
  gaugeCircle.setAttribute("stroke-dasharray", "0 100");
  const tile = tiles.find((t) => t.id === id);
  gaugeEmoji.textContent = tile ? tile.emoji : "🌟";
  gaugeOverlay.style.display = "flex";
}

function updateGauge(pct) {
  gaugeCircle.setAttribute("stroke-dasharray", `${pct * 0.94} 100`);
  // Push!テキストはゲージが進むにつれてフェードアウト
  const pushEl = gaugeOverlay.querySelector(".gauge-push");
  if (pushEl) pushEl.style.opacity = Math.max(0, 1 - pct / 40) + "";
}

function hideGauge() {
  gaugeOverlay.style.display = "none";
}

// ---- タイル操作 ----
function clearTile(id) {
  const tile = tiles.find((t) => t.id === id);
  if (!tile || tile.cleared) return;
  tile.cleared = true;
  if (tile.type === "rare" && tile.rareInfo) {
    const name = tile.rareInfo.name;
    totalPulls[name] = (totalPulls[name] || 0) + 1;
    addFloatEffect(id, "スポンッ！");
    renderZukan();
  } else if (tile.type === "weed") {
    addFloatEffect(id, "ポンッ！");
  } else if (tile.type === "veggie") {
    addFloatEffect(id, "発掘！");
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
    const elapsed = Date.now() - startTime;
    const p = Math.min(100, (elapsed / HOLD_DURATION) * 100);
    updateGauge(p);
    if (p >= 100) {
      clearInterval(interval);
      holdState = null;
      hideGauge();
      clearTile(id);
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
  // レアにスワイプが当たったとき光で「ここは抵抗あるよ」を示す
  const el = getTileEl(id);
  if (!el || el.dataset.resisting) return;
  el.dataset.resisting = "1";
  el.classList.add("resist");
  setTimeout(() => {
    el.classList.remove("resist");
    delete el.dataset.resisting;
  }, 250);
}

function onTileDown(e, id) {
  e.preventDefault();
  const tile = tiles.find((t) => t.id === id);
  if (!tile || tile.cleared) return;
  if (tile.type === "flower" || tile.type === "tree") {
    triggerShake(id);
    return;
  }
  if (tile.type === "rare") {
    startHold(id);
    return;
  }
  // weed と veggie(草に偽装中)はドラッグで抜ける
  dragging = true;
  clearTile(id);
}

function onPointerMoveGlobal(e) {
  if (!dragging) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const tileEl = el && el.closest && el.closest(".tile");
  if (!tileEl) return;
  const id = Number(tileEl.dataset.tileId);
  const tile = tiles.find((t) => t.id === id);
  if (!tile || tile.cleared) return;
  if (tile.type === "weed" || tile.type === "veggie") {
    clearTile(id);
  } else if (tile.type === "flower" || tile.type === "tree") {
    triggerShake(id);
  } else if (tile.type === "rare") {
    triggerResist(id); // スワイプが当たっても抜けない、光るだけ
  }
}

function onPointerUpGlobal() {
  dragging = false;
  cancelHold();
}

// ---- FINISH! 演出 ----
function showFinish() {
  if (document.getElementById("finish-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "finish-overlay";
  overlay.innerHTML = `
    <div class="finish-box">
      <div class="finish-text">🌸 FINISH! 🌸</div>
      <div class="finish-sub">庭がきれいになったよ！</div>
      <button class="finish-reset" id="finishResetBtn">もう一度</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("finishResetBtn").addEventListener("click", () => {
    overlay.remove();
    resetField();
  });
}

// ---- グリッドを画面に合わせる ----
function setAppHeight() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.getElementById("app").style.height = h + "px";
}

function fitGridToScreen() {
  setAppHeight();
  const field = document.getElementById("field");
  const grid  = document.getElementById("grid");
  const gap = 4;
  const pad = 16; // field の内側余白
  const availW = field.clientWidth  - pad;
  const availH = field.clientHeight - pad;
  const minSize = 20;

  const sizeW = (availW - gap * (COLS - 1)) / COLS;
  const sizeH = (availH - gap * (ROWS - 1)) / ROWS;
  const size  = Math.max(Math.min(sizeW, sizeH), minSize);

  // グリッドの幅と高さをピッタリ指定して「浮き」をなくす
  const gridW = COLS * size + (COLS - 1) * gap;
  const gridH = ROWS * size + (ROWS - 1) * gap;

  grid.style.gridTemplateColumns = `repeat(${COLS}, ${size}px)`;
  grid.style.gridAutoRows        = `${size}px`;
  grid.style.gap                 = `${gap}px`;
  grid.style.width               = gridW + "px";
  grid.style.height              = gridH + "px";
}

window.addEventListener("resize", fitGridToScreen);
window.addEventListener("orientationchange", fitGridToScreen);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitGridToScreen);
}

// ---- 図鑑 ----
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
      ${found ? `<div class="zukan-desc">${w.desc}</div><div class="zukan-pulls">これまで ${count} 本</div>` : ""}
    `;
    zukanGrid.appendChild(card);
  });
  list.appendChild(zukanGrid);
}

// ---- リセット ----
function resetField() {
  tiles = buildField();
  cancelHold();
  renderField();
  renderZukan();
}

// ---- グローバルイベント ----
document.addEventListener("pointermove",   onPointerMoveGlobal);
document.addEventListener("pointerup",     onPointerUpGlobal);
document.addEventListener("pointercancel", onPointerUpGlobal);
document.addEventListener("contextmenu",   (e) => e.preventDefault()); // 全体で選択メニューを封じる

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
