// ui.js —— Canvas 2D 轻量 UI 组件（微信小游戏无 DOM，全部自绘 + 触摸命中）
// 设计：所有可点击元素注册为 hit region，main.js 在 onTouchStart 时做命中检测

function UI(ctx, W, H, dpr) {
  this.ctx = ctx; this.W = W; this.H = H; this.dpr = dpr;
  this.hits = [];
  this.colors = {
    bg: '#12142a', panel: '#1e2140', panel2: '#2a2e55', gold: '#ffc94d',
    text: '#f4f1ea', sub: '#a9a6c8', green: '#4fd18b', red: '#ff6b6b', line: '#3a3f6b'
  };
}
UI.prototype.reset = function () { this.hits = []; };
UI.prototype.rect = function (x, y, w, h, r, fill) {
  var c = this.ctx; c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else {
    r = r || 0;
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  if (fill) { c.fillStyle = fill; c.fill(); }
};
UI.prototype.text = function (t, x, y, size, color, align, bold) {
  var c = this.ctx;
  c.fillStyle = color || this.colors.text;
  c.font = (bold ? 'bold ' : '') + size + 'px sans-serif';
  c.textAlign = align || 'left'; c.textBaseline = 'middle';
  c.fillText(String(t), x, y);
};
UI.prototype.wrap = function (t, x, y, maxW, lineH, size, color) {
  var c = this.ctx; c.fillStyle = color || this.colors.sub;
  c.font = size + 'px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top';
  var chars = String(t).split(''), line = '', yy = y;
  for (var i = 0; i < chars.length; i++) {
    var test = line + chars[i];
    if (c.measureText(test).width > maxW && line) { c.fillText(line, x, yy); yy += lineH; line = chars[i]; }
    else line = test;
  }
  if (line) c.fillText(line, x, yy);
  return yy + lineH;
};
// 注册命中区：矩形按钮
UI.prototype.button = function (label, x, y, w, h, onClick, opt) {
  opt = opt || {};
  var fill = opt.fill || this.colors.panel2;
  var disabled = !!opt.disabled;
  if (disabled) fill = '#2a2c3a';
  this.rect(x, y, w, h, opt.r || 12, fill);
  if (opt.border) { this.ctx.strokeStyle = opt.border; this.ctx.lineWidth = 2; this.ctx.stroke(); }
  this.text(label, x + w / 2, y + h / 2, opt.size || 18, disabled ? '#6a6c80' : (opt.color || this.colors.text), 'center', true);
  if (!disabled && onClick) this.hits.push({ x: x, y: y, w: w, h: h, label: String(label || ''), fn: onClick });
};
// 进度条
UI.prototype.bar = function (x, y, w, h, pct, color, bg) {
  this.rect(x, y, w, h, h / 2, bg || '#00000055');
  var fw = Math.max(0, Math.min(w, w * pct / 100));
  if (fw > 0) this.rect(x, y, fw, h, h / 2, color || this.colors.green);
};
// 触摸命中检测
UI.prototype.hitTest = function (tx, ty) {
  for (var i = this.hits.length - 1; i >= 0; i--) {
    var h = this.hits[i];
    if (tx >= h.x && tx <= h.x + h.w && ty >= h.y && ty <= h.y + h.h) return h.fn;
  }
  return null;
};
module.exports = UI;
