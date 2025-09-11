// main.js — адаптивный + оставлена игровая логика и фиксы по touch

// ---------- ПАРАМЕТРЫ (меняем только ROWS -> 6 и не трогаем PUZZLE_COLS/PUZZLE_ROWS) ----------
const COLS = 6;   // ширина поля (неигровое поле)
const ROWS = 6;   // высота поля — УБРАН НИЖНИЙ РЯД (было 7)
const PUZZLE_COLS = 4; // зона пазла ширина
const PUZZLE_ROWS = 4; // зона пазла высота

const CANVAS = document.getElementById('gameCanvas');
const CTX = CANVAS.getContext('2d');

// держим CELL динамическим — будет считаться в resizeCanvas()
let CELL = 80; // начальное значение (замена при вычислении)
let PUZZLE_OFFSET_X = 0;
let PUZZLE_OFFSET_Y = 0;

// картинки (png) — положи в папку проекта
const IMAGES = ['kartinka1.png', 'kartinka2.png', 'kartinka3.png'];
let chosenImageSrc = IMAGES[Math.floor(Math.random() * IMAGES.length)];
let puzzleImage = new Image();
puzzleImage.src = chosenImageSrc;

// состояние
let pieces = []; // массив объектов Piece
let dragging = null;
let dragOffsetX = 0, dragOffsetY = 0;

// ------- полезные функции -------
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

// Piece класс
class Piece {
  constructor(img, pieceCol, pieceRow, gx, gy) {
    this.img = img;
    this.pieceCol = pieceCol; // исходная колонка (внутри PUZZLE_COLS x PUZZLE_ROWS)
    this.pieceRow = pieceRow; // исходная строка
    this.gx = gx; // текущая позиция в grid-координатах (0..COLS-1, 0..ROWS-1)
    this.gy = gy;
    this.prevGx = gx;
    this.prevGy = gy;
    this.size = CELL;
  }

  // pixel позиции на основе CELL
  get x() { return this.gx * CELL; }
  set x(px) { this.gx = Math.round(px / CELL); }

  get y() { return this.gy * CELL; }
  set y(py) { this.gy = Math.round(py / CELL); }

  // прямой доступ для отрисовки (float-safe)
  getPxX() { return this.gx * CELL; }
  getPxY() { return this.gy * CELL; }

  // src rect внутри source image
  getSrcRect() {
    const w = this.img.width / PUZZLE_COLS;
    const h = this.img.height / PUZZLE_ROWS;
    return { sx: this.pieceCol * w, sy: this.pieceRow * h, sw: w, sh: h };
  }

  draw(ctx, isDragging=false) {
    const { sx, sy, sw, sh } = this.getSrcRect();
    const px = this.getPxX();
    const py = this.getPxY();
    ctx.save();
    roundRectPath(ctx, px, py, CELL, CELL, Math.min(12, CELL*0.15));
    ctx.clip();
    ctx.drawImage(this.img, sx, sy, sw, sh, px, py, CELL, CELL);
    ctx.restore();
    // рамка
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, px + 0.5, py + 0.5, CELL - 1, CELL - 1, Math.min(12, CELL*0.15));
    ctx.stroke();
  }

  contains(px, py) {
    // px,py - pixel coordinates
    return px >= this.getPxX() && px <= this.getPxX() + CELL &&
           py >= this.getPxY() && py <= this.getPxY() + CELL;
  }
}

// Вычисляем CELL и обновляем canvas размеры; пересчитываем offsets и пересчитываем позиции по сетке
function resizeCanvas() {
  // сохранение старого CELL чтобы скорректировать grid-позиции
  const oldCell = CELL || 80;

  // ограничиваем доступную область
  const maxWidth = Math.min(window.innerWidth * 0.95, 1000);
  const maxHeight = Math.min(window.innerHeight * 0.78, 1000);

  // CELL = целочисленный размер, чтобы сетка всегда уместилась
  CELL = Math.max(32, Math.floor(Math.min(maxWidth / COLS, maxHeight / ROWS)));

  // задаём реальные размеры canvas
  CANVAS.width = COLS * CELL;
  CANVAS.height = ROWS * CELL;

  // центрируем canvas в элементе (css делает центрирование, canvas сам имеет размер)
  // пересчитываем puzzle offset
  PUZZLE_OFFSET_X = Math.floor((COLS - PUZZLE_COLS) / 2) * CELL;
  PUZZLE_OFFSET_Y = Math.floor((ROWS - PUZZLE_ROWS) / 2) * CELL;

  // если уже есть кусочки — пересчитываем их grid-позиции, используя округление по старой клетке
  if (pieces.length) {
    pieces.forEach(p => {
      // восстанавливаем grid координаты относительно старого размера:
      const gx = Math.round((p.getPxX()) / oldCell);
      const gy = Math.round((p.getPxY()) / oldCell);
      p.gx = Math.max(0, Math.min(COLS - 1, gx));
      p.gy = Math.max(0, Math.min(ROWS - 1, gy));
      p.prevGx = p.gx;
      p.prevGy = p.gy;
    });
  }
  draw();
}

// Создаём кусочки — стартовый рандом без наложений (grid-координаты)
function createPiecesRandom() {
  pieces = [];
  // список всех grid-ячей
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
      const cell = all[idx++]; // уникальная клетка
      pieces.push(new Piece(puzzleImage, c, r, cell.gx, cell.gy));
    }
  }
}

// Перемешать позиции (без смены картинки, без наложений) — назначаем уникальные клетки
function reshufflePositions() {
  const all = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      all.push({ gx: c, gy: r });
    }
  }
  shuffleArray(all);
  for (let i = 0; i < pieces.length; i++) {
    const cell = all[i];
    pieces[i].gx = cell.gx;
    pieces[i].gy = cell.gy;
    pieces[i].prevGx = cell.gx;
    pieces[i].prevGy = cell.gy;
  }
  draw();
}

// Fisher-Yates
function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Рисуем сетку, зону и кусочки
function draw() {
  CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);

  // сетка (полупрозрачная)
  CTX.strokeStyle = 'rgba(0,0,0,0.08)';
  CTX.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    CTX.beginPath();
    CTX.moveTo(0, r * CELL + 0.5);
    CTX.lineTo(CANVAS.width, r * CELL + 0.5);
    CTX.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    CTX.beginPath();
    CTX.moveTo(c * CELL + 0.5, 0);
    CTX.lineTo(c * CELL + 0.5, CANVAS.height);
    CTX.stroke();
  }

  // зелёная рамка (скруглённая) вокруг PUZZLE_COLS x PUZZLE_ROWS
  CTX.strokeStyle = '#1fa42a';
  CTX.lineWidth = 4;
  roundRectPath(CTX, PUZZLE_OFFSET_X, PUZZLE_OFFSET_Y, PUZZLE_COLS * CELL, PUZZLE_ROWS * CELL, Math.min(20, CELL * 0.2));
  CTX.stroke();

  // draw pieces (dragging on top)
  for (const p of pieces) {
    if (p !== dragging) p.draw(CTX, false);
  }
  if (dragging) dragging.draw(CTX, true);
}

// Проверка сборки
function checkSolved() {
  let ok = true;
  for (const p of pieces) {
    const targetGx = Math.floor((PUZZLE_OFFSET_X) / CELL) + p.pieceCol;
    const targetGy = Math.floor((PUZZLE_OFFSET_Y) / CELL) + p.pieceRow;
    if (p.gx !== targetGx || p.gy !== targetGy) { ok = false; break; }
  }
  if (ok) {
    alert('🎉 Пазл собран!');
  } else {
    alert('Пока не всё на месте.');
  }
}

// pointer events (работают для мыши и touch)
CANVAS.addEventListener('pointerdown', (e) => {
  const rect = CANVAS.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  for (let i = pieces.length - 1; i >= 0; i--) {
    if (pieces[i].contains(px, py)) {
      dragging = pieces[i];
      // сохранить предыдущие grid-координаты (для отката)
      dragging.prevGx = dragging.gx;
      dragging.prevGy = dragging.gy;
      // смещение в пикселях внутри клетки
      dragOffsetX = px - dragging.getPxX();
      dragOffsetY = py - dragging.getPxY();
      // переместить в конец массива (чтобы рисовать сверху)
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

  // свободное перемещение: вычисляем новые пиксельные координаты, затем переводим в grid (целая клетка)
  let newPxX = px - dragOffsetX;
  let newPxY = py - dragOffsetY;

  // констрейн внутри канваса
  newPxX = Math.max(0, Math.min(CANVAS.width - CELL, newPxX));
  newPxY = Math.max(0, Math.min(CANVAS.height - CELL, newPxY));

  // временно ставим в grid-координаты (не финально)
  dragging.gx = Math.round(newPxX / CELL);
  dragging.gy = Math.round(newPxY / CELL);

  draw();
});

CANVAS.addEventListener('pointerup', (e) => {
  if (!dragging) return;

  // snap: уже в grid coords, но ограничим
  dragging.gx = Math.max(0, Math.min(COLS - 1, dragging.gx));
  dragging.gy = Math.max(0, Math.min(ROWS - 1, dragging.gy));

  // занятость целевой клетки?
  const occupied = pieces.some(p => p !== dragging && p.gx === dragging.gx && p.gy === dragging.gy);

  if (occupied) {
    // откатываем на prev grid
    dragging.gx = dragging.prevGx;
    dragging.gy = dragging.prevGy;
  } else {
    // новая prev для следующего движения
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

// кнопки
document.getElementById('restartButton').addEventListener('click', () => reshufflePositions());
document.getElementById('checkButton').addEventListener('click', () => checkSolved());

// когда картинка загружена — старт
puzzleImage.onload = () => {
  resizeCanvas();         // вычислим CELL & размеры
  createPiecesRandom();
  draw();
};

// если картинка уже в кэше — подстрахуемся
if (puzzleImage.complete) {
  resizeCanvas();
  createPiecesRandom();
  draw();
}

// адаптивность: пересчитать при ресайзе экрана
window.addEventListener('resize', () => {
  const hadPieces = pieces.length > 0;
  const oldPieces = pieces.slice(); // копия
  // пересчёт CELL и пересчет позиций внутри resizeCanvas()
  resizeCanvas();
  // приведение prev координат к новой сетке уже делается внутри resizeCanvas
  draw();
});

// 🔒 фикс №4 — дополнительный перехват touchmove только для canvas
document.body.addEventListener(
  "touchmove",
  function (e) {
    if (e.target.closest("canvas")) {
      e.preventDefault();
    }
  },
  { passive: false }
);

