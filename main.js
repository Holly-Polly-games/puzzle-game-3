// main.js — адаптивный, с anti-swipe и поддержкой Retina (devicePixelRatio)

// Параметры сетки
const COLS = 6;
const ROWS = 6;
const PUZZLE_COLS = 4;
const PUZZLE_ROWS = 4;

const CANVAS = document.getElementById('gameCanvas');
const CTX = CANVAS.getContext('2d');

let CELL = 80; // CSS-пиксели (пересчитывается в resizeCanvas)
let PUZZLE_OFFSET_X = 0;
let PUZZLE_OFFSET_Y = 0;

// Картинки (положи в папку проекта)
const IMAGES = ['kartinka1.png', 'kartinka2.png', 'kartinka3.png'];
let chosenImageSrc = IMAGES[Math.floor(Math.random() * IMAGES.length)];
let puzzleImage = new Image();
puzzleImage.src = chosenImageSrc;

// Состояние
let pieces = [];
let dragging = null;
let dragOffsetX = 0, dragOffsetY = 0;

// ----------------- УТИЛИТЫ -----------------
function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

class Piece {
  constructor(img, pieceCol, pieceRow, gx, gy) {
    this.img = img;
    this.pieceCol = pieceCol;
    this.pieceRow = pieceRow;
    this.gx = gx; // grid x (0..COLS-1)
    this.gy = gy; // grid y (0..ROWS-1)
    this.prevGx = gx;
    this.prevGy = gy;
  }
  px() { return this.gx * CELL; }
  py() { return this.gy * CELL; }
  getSrcRect() {
    const w = this.img.width / PUZZLE_COLS;
    const h = this.img.height / PUZZLE_ROWS;
    return { sx: this.pieceCol * w, sy: this.pieceRow * h, sw: w, sh: h };
  }
  draw(ctx, isDragging=false) {
    const { sx, sy, sw, sh } = this.getSrcRect();
    const x = this.px();
    const y = this.py();
    ctx.save();
    roundRectPath(ctx, x, y, CELL, CELL, Math.min(12, CELL*0.15));
    ctx.clip();
    ctx.drawImage(this.img, sx, sy, sw, sh, x, y, CELL, CELL);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 0.5, y + 0.5, CELL - 1, CELL - 1, Math.min(12, CELL*0.15));
    ctx.stroke();
  }
  contains(px, py) { // px/py в CSS-пикселях
    return px >= this.px() && px <= this.px() + CELL && py >= this.py() && py <= this.py() + CELL;
  }
}

// ----------------- РАЗМЕР КАНВАСА / DPR -----------------
function resizeCanvas() {
  const maxWidth = Math.min(window.innerWidth * 0.95, 1400);
  const maxHeight = Math.min(window.innerHeight * 0.78, 1200);

  // вычисляем CELL в CSS-пикселях (целое)
  CELL = Math.max(28, Math.floor(Math.min(maxWidth / COLS, maxHeight / ROWS)));

  const cssWidth = COLS * CELL;
  const cssHeight = ROWS * CELL;

  const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  // Устанавливаем CSS размеры и физический буфер
  CANVAS.style.width = cssWidth + 'px';
  CANVAS.style.height = cssHeight + 'px';
  CANVAS.width = cssWidth * DPR;
  CANVAS.height = cssHeight * DPR;

  // Масштабируем контекст так, чтобы 1 единица = 1 CSS px
  CTX.setTransform(DPR, 0, 0, DPR, 0, 0);

  // пересчёт offset зоны пазла
  PUZZLE_OFFSET_X = Math.floor((COLS - PUZZLE_COLS) / 2) * CELL;
  PUZZLE_OFFSET_Y = Math.floor((ROWS - PUZZLE_ROWS) / 2) * CELL;

  draw();
}

// ----------------- СОЗДАНИЕ И ПЕРЕМЕШИВАНИЕ -----------------
function createPiecesRandom() {
  pieces = [];
  const all = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      all.push({ gx: c, gy: r });
    }
  }
  shuffleArray(all);
  let idx = 0;
  for (let r = 0; r < PUZZLE_ROWS; r++) {
    for (let c = 0; c < PUZZLE_COLS; c++) {
      const cell = all[idx++];
      pieces.push(new Piece(puzzleImage, c, r, cell.gx, cell.gy));
    }
  }
}

function reshufflePositions() {
  const all = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      all.push({ gx: c, gy: r });
    }
  }
  shuffleArray(all);
  for (let i = 0; i < pieces.length; i++) {
    pieces[i].gx = all[i].gx;
    pieces[i].gy = all[i].gy;
    pieces[i].prevGx = pieces[i].gx;
    pieces[i].prevGy = pieces[i].gy;
  }
  draw();
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ----------------- ОТРИСОВКА -----------------
function draw() {
  // Очищаем по CSS размерам (CTX уже масштабирован так, что единицы — CSS px)
  CTX.clearRect(0, 0, COLS * CELL, ROWS * CELL);

  // сетка
  CTX.strokeStyle = 'rgba(0,0,0,0.08)';
  CTX.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    CTX.beginPath();
    CTX.moveTo(0, r * CELL + 0.5);
    CTX.lineTo(COLS * CELL, r * CELL + 0.5);
    CTX.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    CTX.beginPath();
    CTX.moveTo(c * CELL + 0.5, 0);
    CTX.lineTo(c * CELL + 0.5, ROWS * CELL);
    CTX.stroke();
  }

  // зелёная рамка зоны пазла (скруглённая)
  CTX.strokeStyle = '#1fa42a';
  CTX.lineWidth = 4;
  roundRectPath(CTX, PUZZLE_OFFSET_X, PUZZLE_OFFSET_Y, PUZZLE_COLS * CELL, PUZZLE_ROWS * CELL, Math.min(20, CELL * 0.2));
  CTX.stroke();

  // кусочки (перетаскиваемый сверху)
  for (const p of pieces) {
    if (p !== dragging) p.draw(CTX, false);
  }
  if (dragging) dragging.draw(CTX, true);
}

// ----------------- ПРОВЕРКА -----------------
function checkSolved() {
  let ok = true;
  for (const p of pieces) {
    const targetGx = Math.floor(PUZZLE_OFFSET_X / CELL) + p.pieceCol;
    const targetGy = Math.floor(PUZZLE_OFFSET_Y / CELL) + p.pieceRow;
    if (p.gx !== targetGx || p.gy !== targetGy) { ok = false; break; }
  }
  alert(ok ? '🎉 Пазл собран!' : 'Пока не всё на месте.');
}

// ----------------- POINTER / TOUCH события -----------------
CANVAS.addEventListener('pointerdown', (e) => {
  const rect = CANVAS.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  for (let i = pieces.length - 1; i >= 0; i--) {
    if (pieces[i].contains(px, py)) {
      dragging = pieces[i];
      dragging.prevGx = dragging.gx;
      dragging.prevGy = dragging.gy;
      dragOffsetX = px - dragging.px();
      dragOffsetY = py - dragging.py();
      pieces.push(pieces.splice(i, 1)[0]);
      try { CANVAS.setPointerCapture(e.pointerId); } catch (err) {}
      draw();
      break;
    }
  }
});

CANVAS.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = CANVAS.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  let newPxX = px - dragOffsetX;
  let newPxY = py - dragOffsetY;

  newPxX = Math.max(0, Math.min(COLS * CELL - CELL, newPxX));
  newPxY = Math.max(0, Math.min(ROWS * CELL - CELL, newPxY));

  dragging.gx = Math.round(newPxX / CELL);
  dragging.gy = Math.round(newPxY / CELL);
  draw();
});

CANVAS.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging.gx = Math.max(0, Math.min(COLS - 1, dragging.gx));
  dragging.gy = Math.max(0, Math.min(ROWS - 1, dragging.gy));

  const occupied = pieces.some(p => p !== dragging && p.gx === dragging.gx && p.gy === dragging.gy);
  if (occupied) {
    dragging.gx = dragging.prevGx;
    dragging.gy = dragging.prevGy;
  } else {
    dragging.prevGx = dragging.gx;
    dragging.prevGy = dragging.gy;
  }
  try { CANVAS.releasePointerCapture(e.pointerId); } catch (err) {}
  dragging = null;
  draw();
});

CANVAS.addEventListener('pointercancel', () => {
  if (!dragging) return;
  dragging.gx = dragging.prevGx;
  dragging.gy = dragging.prevGy;
  dragging = null;
  draw();
});

// ----------------- Кнопки -----------------
document.getElementById('restartButton').addEventListener('click', () => reshufflePositions());
document.getElementById('checkButton').addEventListener('click', () => checkSolved());

// ----------------- ЗАПУСК -----------------
puzzleImage.onload = () => {
  resizeCanvas();
  createPiecesRandom();
  draw();
};
if (puzzleImage.complete) {
  resizeCanvas();
  createPiecesRandom();
  draw();
}
window.addEventListener('resize', resizeCanvas);

// ----------------- ANTI-SWIPE FIXES -----------------
// флаг, когда тач начат на canvas
let isTouchingCanvas = false;
CANVAS.addEventListener('touchstart', (e) => { isTouchingCanvas = true; }, { passive: true });
document.addEventListener('touchend', (e) => { isTouchingCanvas = false; }, { passive: true });

// глобальный перехват touchmove — только если тач из canvas
document.body.addEventListener('touchmove', function(e) {
  if (isTouchingCanvas || (e.target && e.target.closest && e.target.closest('canvas'))) {
    e.preventDefault(); // passive:false обязательно
  }
}, { passive: false });

