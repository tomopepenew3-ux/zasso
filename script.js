const WEED_EMOJI = ["🌱","🍀","🌿"];
const FLOWER_EMOJI = ["🌷","🌼","🌸"];
const VEGGIE_EMOJI = ["🍆","🥕"];
const TREE_EMOJI = ["🌳","🌲"];

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

//草、レア(長押し)草、花、野菜、木の数はここ。
const COUNTS = { weed: 150, rare: 6, flower: 12, veggie: 6, tree: 2 };
const TOTAL_CELLS = COUNTS.weed + COUNTS.rare + COUNTS.flower + COUNTS.veggie + COUNTS.tree; // 170
const TOTAL_CLEARABLE = COUNTS.weed + COUNTS.rare;
const HOLD_DURATION = 1100;
const REVEAL_CHANCE = 0; // 長押し草を抜いたとき下からお花が出る確率

// 列数・行数はぴったり割り切れる組み合わせ(17×10 / 10×17)を最初に1回だけ決める。
// 端数の出る最後の行ができないようにするのと、家庭菜園のブロック位置を安定させるため、
// リサイズの度には変えず、マスのpxサイズだけをfitGridToScreenで調整する。
const COLS = window.innerWidth >= window.innerHeight ? 17 : 10;
const ROWS = TOTAL_CELLS / COLS;

let tiles = [];
let totalPulls = {}; // { 草の名前: 累計で抜いた本数 } ※庭をリセットしても引き継ぐ
let dragging = false;
let holdState = null; // { id, interval, startTime }

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function buildField() {
  const grid2d = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  // 家庭菜園(🍆🥕)を1箇所にまとめて、長方形の畝ブロックとして配置する
  const VEG_W = COLS >= ROWS ? 3 : 2;
  const VEG_H = COUNTS.veggie / VEG_W;
  const anchorRow = Math.floor(Math.random() * (ROWS - VEG_H + 1));
  const anchorCol = Math.floor(Math.random() * (COLS - VEG_W + 1));
  for (let r = 0; r < VEG_H; r++) {
    for (let c = 0; c < VEG_W; c++) {
      grid2d[anchorRow + r][anchorCol + c] = "veggie";
    }
  }

  // 残りのマスに weed / rare / flower / tree をランダムに散らす
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
  const flatTypes = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      flatTypes.push(grid2d[r][c] || pool[p++]);
    }
  }

  return flatTypes.map((type, idx) => {
    let emoji = "", rareInfo = null;
    if (type === "weed") emoji = pick(WEED_EMOJI);
    if (type === "flower") emoji = pick(FLOWER_EMOJI);
    if (type === "veggie") emoji = pick(VEGGIE_EMOJI);
    if (type === "tree") emoji = pick(TREE_EMOJI);
    if (type === "rare") {
      rareInfo = pick(RARE_WEEDS);
      emoji = Math.random() < 0.5 ? "🌟" : "💖";
    }
    return { id: idx, type, emoji, rareInfo, cleared: false, bonusEmoji: null };
  });
}

function renderField() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  tiles.forEach((tile) => {
    const div = document.createElement("div");
    div.className = "tile";
    div.dataset.tileId = tile.id;
    div.innerHTML = `<span class="tile-emoji">${tile.emoji}</span>`;
    grid.appendChild(div);
    updateTileVisual(tile.id);
    div.addEventListener("pointerdown", (e) => onTileDown(e, tile.id));
  });
  document.getElementById("totalClearable").textContent = TOTAL_CLEARABLE;
  updateCounters();
  fitGridToScreen();
}

// 画面サイズに合わせてマス目の大きさと列数を自動計算し、
// スクロールしなくても庭全体が1画面に収まるようにする
function setAppHeight() {
  // iOSのSafariはアドレスバーの開閉でvhの基準がズレるので、
  // 実際に見えている領域(visualViewport)を使って高さを直接指定する
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.getElementById("app").style.height = h + "px";
}

function fitGridToScreen() {
  setAppHeight();
  const field = document.getElementById("field");
  const grid = document.getElementById("grid");
  const gap = 4;
  const availW = field.clientWidth - 16; // .field の左右パディング分
  const availH = field.clientHeight - 16; // .field の上下パディング分
  const minSize = 20; // タイルが小さすぎて押せなくなるのを防ぐ下限

  const sizeW = (availW - gap * (COLS - 1)) / COLS;
  const sizeH = (availH - gap * (ROWS - 1)) / ROWS;
  const size = Math.max(Math.min(sizeW, sizeH), minSize);

  grid.style.gridTemplateColumns = `repeat(${COLS}, ${size}px)`;
  grid.style.gridAutoRows = `${size}px`;
  grid.style.gap = `${gap}px`;
  grid.style.justifyContent = "center";
}

window.addEventListener("resize", fitGridToScreen);
window.addEventListener("orientationchange", fitGridToScreen);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitGridToScreen);
}

function getTileEl(id) {
  return document.querySelector(`.tile[data-tile-id="${id}"]`);
}

function updateTileVisual(id) {
  const tile = tiles.find((t) => t.id === id);
  const el = getTileEl(id);
  if (!tile || !el) return;
  el.classList.toggle("cleared", tile.cleared);
  const isRareUncleared = tile.type === "rare" && !tile.cleared;
  el.classList.toggle("rare-glow", isRareUncleared);
  const emojiSpan = el.querySelector(".tile-emoji");
  if (emojiSpan) emojiSpan.style.display = tile.cleared ? "none" : "inline";
  let badge = el.querySelector(".reveal-emoji");
  if (tile.cleared && tile.bonusEmoji) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "reveal-emoji";
      el.appendChild(badge);
    }
    badge.textContent = tile.bonusEmoji;
  } else if (badge) {
    badge.remove();
  }
}

function updateCounters() {
  const clearedCount = tiles.filter((t) => t.cleared && (t.type === "weed" || t.type === "rare")).length;
  const pct = TOTAL_CLEARABLE ? Math.round((clearedCount / TOTAL_CLEARABLE) * 100) : 0;
  document.getElementById("clearedCount").textContent = clearedCount;
  document.getElementById("pctText").textContent = pct + "%";
  document.getElementById("progressFill").style.width = pct + "%";
}

function addEffect(id, text) {
  const el = getTileEl(id);
  if (!el) return;
  const span = document.createElement("span");
  span.className = "effect-text";
  span.textContent = text;
  el.appendChild(span);
  setTimeout(() => span.remove(), 700);
}

function clearTile(id) {
  const tile = tiles.find((t) => t.id === id);
  if (!tile || tile.cleared) return;
  tile.cleared = true;
  if (tile.type === "rare" && tile.rareInfo) {
    const name = tile.rareInfo.name;
    totalPulls[name] = (totalPulls[name] || 0) + 1;
    if (Math.random() < REVEAL_CHANCE) {
      tile.bonusEmoji = pick(FLOWER_EMOJI);
      addEffect(id, "お花を発掘！");
    } else {
      addEffect(id, "スポンッ！");
    }
    renderZukan();
  } else if (tile.type === "weed") {
    addEffect(id, "ポンッ！");
  }
  updateTileVisual(id);
  updateCounters();
}

function cancelHold() {
  if (holdState) {
    clearInterval(holdState.interval);
    const el = getTileEl(holdState.id);
    if (el) {
      const ring = el.querySelector(".hold-ring");
      if (ring) ring.remove();
      el.classList.remove("holding");
    }
  }
  holdState = null;
}

function startHold(id) {
  if (holdState) cancelHold();
  const el = getTileEl(id);
  if (!el) return;
  el.classList.add("holding"); // マスを拡大表示してゲージを見やすくする
  const ring = document.createElement("div");
  ring.className = "hold-ring";
  ring.innerHTML = `<svg viewBox="0 0 36 36" width="100%" height="100%">
    <circle class="hold-circle" cx="18" cy="18" r="15" fill="none" stroke="#fff7d6" stroke-width="3" stroke-linecap="round" transform="rotate(-90 18 18)" />
  </svg>`;
  el.appendChild(ring);
  const circle = ring.querySelector(".hold-circle");
  const startTime = Date.now();
  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const p = Math.min(100, (elapsed / HOLD_DURATION) * 100);
    circle.setAttribute("stroke-dasharray", `${p * 0.94} 100`);
    if (p >= 100) {
      clearInterval(interval);
      holdState = null;
      ring.remove();
      el.classList.remove("holding");
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

function onTileDown(e, id) {
  e.preventDefault();
  const tile = tiles.find((t) => t.id === id);
  if (!tile || tile.cleared) return;
  if (tile.type === "flower" || tile.type === "veggie" || tile.type === "tree") {
    triggerShake(id);
    return;
  }
  if (tile.type === "weed") {
    dragging = true;
    clearTile(id);
    return;
  }
  if (tile.type === "rare") {
    startHold(id);
  }
}

function onPointerMoveGlobal(e) {
  if (!dragging) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const tileEl = el && el.closest && el.closest(".tile");
  if (!tileEl) return;
  const id = Number(tileEl.dataset.tileId);
  const tile = tiles.find((t) => t.id === id);
  if (!tile || tile.cleared) return;
  if (tile.type === "weed") {
    clearTile(id);
  } else if (tile.type === "flower" || tile.type === "veggie" || tile.type === "tree") {
    triggerShake(id);
  }
}

function onPointerUpGlobal() {
  dragging = false;
  cancelHold();
}

function renderZukan() {
  const foundCount = RARE_WEEDS.filter((w) => (totalPulls[w.name] || 0) > 0).length;
  document.getElementById("zukanCount").textContent = `${foundCount}/${RARE_WEEDS.length}`;
  const list = document.getElementById("zukanList");
  list.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "zukan-grid";
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
    grid.appendChild(card);
  });
  list.appendChild(grid);
}

function resetField() {
  tiles = buildField();
  cancelHold();
  renderField();
  renderZukan();
}

document.addEventListener("pointermove", onPointerMoveGlobal);
document.addEventListener("pointerup", onPointerUpGlobal);
document.addEventListener("pointercancel", onPointerUpGlobal);

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
