/* 左滑字卡：在字卡最右边露出红底「删除」按钮，点按钮才删除 —— window.mxSwipeDel(selector, onDelete(el)) */
(function () {
'use strict';
var regs = [], BW = 76;
window.mxSwipeDel = function (sel, fn) { regs.push({ sel: sel, fn: fn }); };
var css = document.createElement('style');
css.textContent = '.mx-swdel{position:absolute;top:0;bottom:0;right:-' + BW + 'px;width:' + BW + 'px;display:flex;align-items:center;justify-content:center;background:#e53935!important;color:#fff!important;font-size:14px;font-weight:600;border:0!important;border-radius:0!important;z-index:5;padding:0!important;margin:0}';
document.head.appendChild(css);
var bt = null, st = null, open = null, suppress = 0;
function find(t) {
  for (var i = 0; i < regs.length; i++) { var el = t.closest && t.closest(regs[i].sel); if (el) return { el: el, fn: regs[i].fn }; }
  return null;
}
function ensureBtn(el, fn) {
  var b = el.querySelector(':scope > .mx-swdel');
  if (!b) {
    if (getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.dataset.mxPos = '1'; }
    b = document.createElement('button'); b.type = 'button'; b.className = 'mx-swdel'; b.textContent = '删除';
    b.__del = function () {
      if (b.__done) return; b.__done = 1;
      open = null; b.remove();
      el.style.transition = 'transform .18s, opacity .18s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0';
      setTimeout(function () { try { fn(el); } catch (err) { console.error(err); el.style.transform = ''; el.style.opacity = ''; } }, 180);
    };
    b.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); b.__del(); }, true);
    el.appendChild(b);
  }
  return b;
}
function closeEl(el) {
  if (!el) return;
  el.style.transition = 'transform .2s'; el.style.transform = '';
  setTimeout(function () { if (el.style.transform === '' ) { var b = el.querySelector(':scope > .mx-swdel'); if (b) b.remove(); } }, 220);
  if (open && open.el === el) open = null;
}
document.addEventListener('touchstart', function (e) {
  if (open && !(e.target.closest && e.target.closest('.mx-swdel'))) { var o = open.el; if (!o.contains(e.target)) { closeEl(o); suppress = Date.now(); st = null; return; } }
  if (e.touches.length !== 1) { st = null; return; }
  var hb = e.target.closest && e.target.closest('.mx-swdel');
  if (hb) { st = null; bt = { b: hb, x: e.touches[0].clientX, y: e.touches[0].clientY }; e.stopPropagation(); return; }
  var hit = find(e.target); if (!hit) { st = null; return; }
  if (e.target.closest('input,textarea,[contenteditable="true"]')) { st = null; return; }
  var base = (open && open.el === hit.el) ? -BW : 0;
  st = { el: hit.el, fn: hit.fn, x: e.touches[0].clientX, y: e.touches[0].clientY, base: base, dx: base, on: false, t: Date.now() };
}, { passive: true, capture: true });
document.addEventListener('touchmove', function (e) {
  if (bt) { e.stopPropagation(); return; }
  if (!st) return;
  var dx = e.touches[0].clientX - st.x, dy = e.touches[0].clientY - st.y;
  if (!st.on) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { st = null; return; }
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3 && (dx < 0 || st.base) && Date.now() - st.t < 600) { st.on = true; st.el.style.transition = 'none'; ensureBtn(st.el, st.fn); }
    else return;
  }
  if (st.el.classList.contains('cc-dragging') || document.querySelector('.sxe-drag')) { closeEl(st.el); st = null; return; }
  st.dx = Math.max(-BW - 30, Math.min(0, st.base + dx));
  st.el.style.transform = 'translateX(' + st.dx + 'px)';
  if (e.cancelable) e.preventDefault();
}, { passive: false, capture: true });
document.addEventListener('touchend', function (e) {
  if (bt) {
    var B = bt; bt = null; var t = e.changedTouches && e.changedTouches[0];
    if (!t || (Math.abs(t.clientX - B.x) < 12 && Math.abs(t.clientY - B.y) < 12)) { suppress = Date.now(); e.stopPropagation(); if (e.cancelable) e.preventDefault(); B.b.__del(); }
    return;
  }
  if (!st) return;
  var s = st; st = null;
  if (!s.on) { if (s.base) { closeEl(s.el); suppress = Date.now(); } return; }
  suppress = Date.now();
  if (s.dx < -BW / 2) {
    if (open && open.el !== s.el) closeEl(open.el);
    s.el.style.transition = 'transform .2s'; s.el.style.transform = 'translateX(-' + BW + 'px)';
    open = { el: s.el };
  } else closeEl(s.el);
}, { capture: true });
document.addEventListener('touchcancel', function () { if (st) { closeEl(st.el); st = null; } }, { capture: true });
document.addEventListener('click', function (e) {
  if (e.target.closest && e.target.closest('.mx-swdel')) return;
  if (Date.now() - suppress < 400) { e.stopPropagation(); e.preventDefault(); }
}, true);
})();
