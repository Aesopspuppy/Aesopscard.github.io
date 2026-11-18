/* Shared touch scroll rails for the card library; data stays owned by each list. */
(function () {
'use strict';
var ROOTS = '#page-chatcard,#page-ta-ask,#page-ta-ask-survey,#page-ta-choose,#page-ta-curious,#page-ta-roast,#page-ta-checkin,#page-ta-invite,#page-checkin-cards,#page-quote-cards,#page-loc-cards,#page-custom-cards,#page-default-cards,#page-dict-cards,#page-fun-cards,#page-deskcheck,#page-mood-cards,#page-ta-mood,#page-reply-cards,#sxe';
var ROWS = '[data-sxid],.cc-item,.ta-row,.tc-qrow,.sxe-c';
var IDLE_MS = 1800, rails = [], pending = 0, hideTimer = 0, activeRoot = null;
function progress(offsets, counts, y, atEnd) {
  var total = counts[counts.length - 1] || 0;
  if (atEnd) return { current: total, total: total };
  var lo = 0, hi = offsets.length - 1;
  while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (offsets[mid] <= y) lo = mid; else hi = mid - 1; }
  return { current: counts[lo] || 0, total: total };
}
window.__cardScrollTools = { progress: progress, idleMs: IDLE_MS };
var badge = document.createElement('div');
badge.className = 'lib-scroll-count'; badge.setAttribute('role', 'status');
document.body.appendChild(badge);
function visible(el) { return !!el && el.isConnected && !el.closest('[hidden]') && el.getClientRects().length > 0; }
function showCount(r) {
  if (!visible(r.root)) return;
  var result = null;
  var providers = Array.from(r.root.querySelectorAll('.preset-list')).filter(function (el) {
    return visible(el) && (el === r.el || r.el.contains(el));
  });
  if (providers.length && typeof providers[0].__cardScrollProgress === 'function') {
    result = providers[0].__cardScrollProgress(r.el);
  } else {
    if (!r.rows) r.rows = Array.from(r.el.querySelectorAll(ROWS)).filter(function (el) { return visible(el); });
    var top = r.el.getBoundingClientRect().top + r.el.clientTop;
    var count = 0;
    for (var i = 0; i < r.rows.length; i++) {
      if (r.rows[i].getBoundingClientRect().top < top) count++;
    }
    var end = r.el.scrollTop >= r.el.scrollHeight - r.el.clientHeight - 2;
    result = { current: end ? r.rows.length : count, total: r.rows.length };
  }
  if (!result || !result.total) { badge.classList.remove('show'); return; }
  badge.textContent = result.current + '/' + result.total;
  badge.classList.add('show'); activeRoot = r.root;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(function () { badge.classList.remove('show'); }, IDLE_MS);
}
function update(r) {
  if (!visible(r.el) || !visible(r.root)) { r.track.hidden = true; return; }
  var rect = r.el.getBoundingClientRect(), x = r.axis === 'x';
  var extent = x ? r.el.scrollWidth : r.el.scrollHeight;
  var viewport = x ? r.el.clientWidth : r.el.clientHeight;
  if (extent <= viewport + 2) { r.track.hidden = true; return; }
  var start = Math.max(0, x ? rect.left : rect.top), end = Math.min(x ? innerWidth : innerHeight, x ? rect.right : rect.bottom);
  r.length = Math.max(0, end - start - 12);
  r.track.hidden = r.length < 30;
  if (x) { r.track.style.left = (start + 6) + 'px'; r.track.style.top = (Math.min(rect.bottom, innerHeight) - (r.large ? 34 : 14)) + 'px'; r.track.style.width = r.length + 'px'; }
  else { r.track.style.top = (start + 6) + 'px'; r.track.style.left = (Math.min(rect.right, innerWidth) - (r.large ? 38 : 16)) + 'px'; r.track.style.height = r.length + 'px'; }
  r.thumbSize = Math.min(r.length, Math.max(r.large ? 52 : 36, r.length * viewport / extent));
  var ratio = (x ? r.el.scrollLeft : r.el.scrollTop) / Math.max(1, extent - viewport);
  r.thumb.style[x ? 'width' : 'height'] = r.thumbSize + 'px';
  r.thumb.style.transform = (x ? 'translateX(' : 'translateY(') + (ratio * (r.length - r.thumbSize)) + 'px)';
  r.track.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
}
function seek(r, e) {
  var x = r.axis === 'x', rect = r.track.getBoundingClientRect();
  var point = x ? e.clientX - rect.left : e.clientY - rect.top;
  var ratio = Math.max(0, Math.min(1, (point - r.thumbSize / 2) / Math.max(1, r.length - r.thumbSize)));
  if (x) r.el.scrollLeft = ratio * (r.el.scrollWidth - r.el.clientWidth);
  else r.el.scrollTop = ratio * (r.el.scrollHeight - r.el.clientHeight);
  update(r); showCount(r);
}
function add(el, root, axis) {
  var track = document.createElement('div'), thumb = document.createElement('div');
  track.className = 'lib-scroll-rail ' + (axis === 'x' ? 'horizontal' : 'vertical');
  track.tabIndex = 0; track.setAttribute('role', 'scrollbar'); track.setAttribute('aria-label', '字卡库滑动条');
  track.setAttribute('aria-orientation', axis === 'x' ? 'horizontal' : 'vertical');
  track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100');
  if (!el.id) el.id = 'lib-scroll-area-' + rails.length;
  track.setAttribute('aria-controls', el.id);
  thumb.className = 'lib-scroll-thumb'; track.appendChild(thumb); document.body.appendChild(track);
  var r = { el: el, root: root, axis: axis, track: track, thumb: thumb, large: false, rows: null, pointer: null };
  rails.push(r); el.classList.add('lib-scroll-native');
  track.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    if (!r.large) { r.large = true; track.classList.add('large'); update(r); return; }
    r.pointer = e.pointerId; track.setPointerCapture(e.pointerId); seek(r, e);
  });
  track.addEventListener('pointermove', function (e) { if (r.pointer === e.pointerId) { e.preventDefault(); seek(r, e); } });
  function release() { r.pointer = null; if (badge.classList.contains('show')) { clearTimeout(hideTimer); hideTimer = setTimeout(function () { badge.classList.remove('show'); }, IDLE_MS); } }
  track.addEventListener('pointerup', release); track.addEventListener('pointercancel', release);
  track.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.large = !r.large; track.classList.toggle('large', r.large); update(r); }
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'PageDown', 'PageUp', 'Home', 'End'].indexOf(e.key) < 0) return;
    e.preventDefault(); var prop = axis === 'x' ? 'scrollLeft' : 'scrollTop';
    var size = axis === 'x' ? el.clientWidth : el.clientHeight;
    el[prop] = e.key === 'Home' ? 0 : e.key === 'End' ? (axis === 'x' ? el.scrollWidth : el.scrollHeight) : el[prop] + (/Up|Left/.test(e.key) ? -size : size) * 0.8;
    update(r); showCount(r);
  });
  update(r);
}
function scan() {
  pending = 0;
  rails = rails.filter(function (r) { if (r.el.isConnected) return true; r.track.remove(); return false; });
  var roots = Array.from(document.querySelectorAll(ROOTS)).filter(visible);
  if (roots.length) roots = roots.concat(Array.from(document.querySelectorAll('#modal-mask,.mg-mask,.tc-mask')).filter(visible));
  roots.forEach(function (root) {
    if (!visible(root)) return;
    [root].concat(Array.from(root.querySelectorAll('*'))).forEach(function (el) {
      if (!visible(el)) return;
      // Check overflow policy first: most of a large library consists of ordinary rows.
      var style = getComputedStyle(el);
      ['y', 'x'].forEach(function (axis) {
        if (!/auto|scroll/.test(axis === 'x' ? style.overflowX : style.overflowY)) return;
        if ((axis === 'x' ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight) <= 2) return;
        if (!rails.some(function (r) { return r.el === el && r.axis === axis; })) add(el, root, axis);
      });
    });
  });
  rails.forEach(function (r) { r.rows = null; update(r); });
  if (activeRoot && !visible(activeRoot)) { badge.classList.remove('show'); activeRoot = null; }
}
function schedule() { if (!pending) pending = setTimeout(scan, 100); }
document.addEventListener('scroll', function (e) {
  rails.forEach(function (r) { if (r.el === e.target) { update(r); showCount(r); } else if (r.root.contains(e.target)) update(r); });
}, { capture: true, passive: true });
document.addEventListener('pointerdown', function (e) {
  if (e.target.closest('.lib-scroll-rail')) return;
  rails.forEach(function (r) { if (r.large) { r.large = false; r.track.classList.remove('large'); update(r); } });
}, true);
new MutationObserver(function (records) {
  if (records.some(function (rec) {
    var el = rec.target.nodeType === 1 ? rec.target : rec.target.parentElement;
    return el && !el.closest('.lib-scroll-rail,.lib-scroll-count') && (el.closest(ROOTS + ',#modal-mask,.mg-mask,.tc-mask') || (rec.type === 'childList' && Array.from(rec.addedNodes).some(function (n) { return n.nodeType === 1 && n.matches(ROOTS + ',.mg-mask,.tc-mask'); })));
  })) schedule();
}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class'] });
window.addEventListener('resize', schedule);
if (window.visualViewport) { window.visualViewport.addEventListener('resize', schedule); window.visualViewport.addEventListener('scroll', schedule); }
schedule();
})();