/* 查看字卡来源：聊天/收藏/朋友圈长按 → 😺查看来源，按出处用莫兰迪色框标记并在下方列出图例 */
(function () {
'use strict';
var LIB = {
  'li-default-cards': '默认聊天字卡', 'li-dict-cards': '聊天默认字卡·词典', 'li-fun-cards': '其他互动功能字卡',
  'li-deskcheck': '联系人跨桌面查岗', 'li-mood-cards': '聊天情绪字卡', 'li-ta-mood': 'TA的心情',
  'li-reply-cards': '聊天回应字卡', 'li-checkin-cards': '寻踪日常字卡', 'li-quote-cards': '桌面今日情话',
  'li-loc-cards': 'TA在身边位置卡', 'li-ta-ask': 'TA的询问', 'li-ta-choose': 'TA的小问题', 'li-ta-curious': 'TA的好奇',
  'li-ta-roast': 'TA的吐槽', 'li-ta-checkin': 'TA的查岗', 'li-ta-invite': 'TA的邀请'
};
var CC = { text: '主字卡', kaomoji: '颜文字', emoji: 'emoji', sticker: '表情包', image: '图片', poke: '拍一拍', voice: '语音', fish: '摸鱼', eat: '吃饭', period: '经期', water: '喝水', garden: '花园', sync: '同频', reach: '伸手', cjian: '此间', room: '房间', piggy: '存钱罐', drift: '漂流瓶', interact: '互动回应', music: '音乐', mjfree: '梦角自由造句' };
/* 莫兰迪色：互不重复、尽量拉开色相 */
var PAL = ['#8fa8c4', '#c98f8f', '#a3b88c', '#d6b27c', '#ab97c4', '#7fb3a4', '#d49c7f', '#9c9c74', '#c7a6c0', '#6f93a8', '#b8a48c', '#8fae7a', '#c48aa0', '#a0b8c0', '#c2a35e', '#8c8aa8', '#b07c6c', '#9fc2a8', '#d8b8a4', '#7c8c6c', '#b4b8d8', '#c4b49c', '#9c7c8c', '#8cb4c8'];
var UNKNOWN = '#d0ccc6';

function buildIndex() {
  var idx = new Map(), img = new Map(), maxLen = 1;
  function add(t, label) {
    if (typeof t !== 'string') return;
    if (/^data:|^https?:\/\/|^@@m:|\|\|\|/.test(t)) {
      img.has(t) || img.set(t, label);
      var p = t.split('|||'); if (p[1] && !img.has(p[1])) img.set(p[1], label);
      return;
    }
    t = t.trim(); if (!t || t.length > 300) return;
    if (!idx.has(t)) { idx.set(t, label); if (t.length > maxLen) maxLen = t.length; }
  }
  var S = window.__sysSrc;
  if (S) Object.keys(S.SETS).sort(function (a, b) { return (a === 'li-dict-cards') - (b === 'li-dict-cards'); }).forEach(function (li) {
    var sets = S.SETS[li];
    sets.forEach(function (s) {
      var m = S.model(s[0]) || [];
      var base = '系统预设字卡-' + (LIB[li] || li) + (sets.length > 1 || s[1] !== LIB[li] ? '-' + s[1] : '');
      m.forEach(function (g) { (g.items || []).forEach(function (it) { add(it.t, base + (g.n && m.length > 1 ? '-' + g.n : '')); }); });
    });
  });
  try {
    var G = window.__ccSrcGroups ? window.__ccSrcGroups() : null;
    if (G) Object.keys(G).forEach(function (t) {
      (G[t] || []).forEach(function (pair) { (pair[1] || []).forEach(function (c) { add(c, '可自定义字卡-' + (CC[t] || t) + '-' + pair[0]); }); });
    });
  } catch (e) {}
  return { idx: idx, img: img, maxLen: Math.min(maxLen, 300) };
}
var NEUTRAL = /[\s，。、！？!?,.~～…·;；:：'"“”‘’（）()\[\]【】\-—_|]/;
function segment(text, I) {
  var out = [], i = 0, n = text.length, unk = -1;
  var whole = I.idx.get(text.trim());
  if (whole) return [{ s: 0, e: n, src: whole }];
  while (i < n) {
    var hit = 0, src = null;
    for (var L = Math.min(I.maxLen, n - i); L >= 1; L--) { var v = I.idx.get(text.substr(i, L)); if (v) { hit = L; src = v; break; } }
    if (hit && (hit > 1 || !/[\u4e00-\u9fa5a-zA-Z0-9]/.test(text[i]))) { if (unk >= 0) { out.push({ s: unk, e: i, src: null }); unk = -1; } out.push({ s: i, e: i + hit, src: src }); i += hit; continue; }
    if (NEUTRAL.test(text[i])) { if (unk >= 0) { out.push({ s: unk, e: i, src: null }); unk = -1; } i++; continue; }
    if (unk < 0) unk = i; i++;
  }
  if (unk >= 0) out.push({ s: unk, e: n, src: null });
  return out;
}
var css = document.createElement('style');
css.textContent = '.mxs-mark{border-radius:6px;padding:0 2px;box-shadow:0 0 0 1.5px var(--mxc) inset;background:color-mix(in srgb,var(--mxc) 45%,transparent);color:inherit}' +
  'img.mxs-img{outline:3px solid var(--mxc);outline-offset:2px;border-radius:8px}' +
  '.mxs-legend{margin:6px 12px 10px;padding:10px 12px;border-radius:14px;background:var(--card,#fff);border:1px solid rgba(0,0,0,.1);box-shadow:0 6px 18px rgba(0,0,0,.08);font-size:12px;color:var(--ink,#333);align-self:stretch;max-width:100%;box-sizing:border-box}' +
  '.mxs-legend b{display:block;margin-bottom:6px;font-size:13px}.mxs-row{display:flex;align-items:flex-start;gap:8px;margin:4px 0;word-break:break-all}' +
  '.mxs-sw{flex:none;width:16px;height:16px;border-radius:4px;margin-top:1px}.mxs-x{float:right;border:none;background:none;font-size:13px;color:inherit;opacity:.6;padding:0 2px}' +
  '.mxs-pop{position:fixed;z-index:99995;display:flex;gap:6px;padding:8px;border-radius:18px;background:rgba(255,255,255,.97);border:1px solid rgba(0,0,0,.1);box-shadow:0 10px 28px rgba(0,0,0,.12)}' +
  '.mxs-pop button{display:flex;flex-direction:column;align-items:center;gap:3px;border:none;background:none;font-size:10px;color:#444;padding:6px 10px;border-radius:12px;font-family:inherit}.mxs-pop button i{font-style:normal;font-size:18px;line-height:20px}';
document.head.appendChild(css);

var active = null;
function clear() {
  if (!active) return;
  try { active.el.innerHTML = active.html; } catch (e) {}
  if (active.legend) active.legend.remove();
  active = null;
}
function textNodes(root) {
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentNode; return p && p.closest && p.closest('.msg-mood-tag,.msg-side,.msg-time,b.feed-name,.fav-item-tag,script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
  var a = [], n; while ((n = w.nextNode())) a.push(n); return a;
}
function show(el, after) {
  clear(); if (!el) return;
  var I = buildIndex(), colors = {}, ci = 0, rows = [], hasUnk = false;
  function colorOf(src) { if (!src) { hasUnk = true; return UNKNOWN; } if (!colors[src]) { colors[src] = PAL[ci % PAL.length]; ci++; rows.push(src); } return colors[src]; }
  active = { el: el, html: el.innerHTML };
  el.querySelectorAll('img').forEach(function (im) {
    var s = im.getAttribute('src') || '', src = I.img.get(s) || null;
    if (!src && (im.alt === '表情' || im.classList.contains('msg-img-sm'))) src = null; else if (!src) return;
    im.classList.add('mxs-img'); im.style.setProperty('--mxc', colorOf(src));
  });
  var nodes = textNodes(el), full = '', map = [];
  nodes.forEach(function (n) { map.push([n, full.length]); full += n.nodeValue; });
  var segs = full.trim() ? segment(full, I) : [];
  segs.forEach(function (sg) { sg.c = colorOf(sg.src); });
  for (var k = map.length - 1; k >= 0; k--) {
    var node = map[k][0], off = map[k][1], end = off + node.nodeValue.length;
    var mine = segs.filter(function (sg) { return sg.e > off && sg.s < end; });
    if (!mine.length) continue;
    var frag = document.createDocumentFragment(), pos = off, txt = node.nodeValue;
    mine.forEach(function (sg) {
      var a = Math.max(sg.s, off), b = Math.min(sg.e, end);
      if (a > pos) frag.appendChild(document.createTextNode(txt.slice(pos - off, a - off)));
      var sp = document.createElement('span'); sp.className = 'mxs-mark'; sp.style.setProperty('--mxc', sg.c); sp.textContent = txt.slice(a - off, b - off);
      frag.appendChild(sp); pos = b;
    });
    if (pos < end) frag.appendChild(document.createTextNode(txt.slice(pos - off)));
    node.parentNode.replaceChild(frag, node);
  }
  var lg = document.createElement('div'); lg.className = 'mxs-legend';
  var h = '<button class="mxs-x" type="button">关闭</button><b>😺 字卡来源</b>';
  rows.forEach(function (r) { h += '<div class="mxs-row"><span class="mxs-sw" style="background:' + colors[r] + '"></span><span>' + r.replace(/</g, '&lt;') + '</span></div>'; });
  if (hasUnk) h += '<div class="mxs-row"><span class="mxs-sw" style="background:' + UNKNOWN + '"></span><span>未找到来源（可能是自动拼字/造句，或该字卡已被删除）</span></div>';
  if (!rows.length && !hasUnk) h += '<div class="mxs-row">这条内容没有可识别的字卡</div>';
  lg.innerHTML = h;
  var host = after || el; host.parentNode.insertBefore(lg, host.nextSibling);
  active.legend = lg;
  lg.querySelector('.mxs-x').addEventListener('click', function (e) { e.stopPropagation(); clear(); });
  lg.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
}
window.mxCardSource = show;
window.mxCardSourceClear = clear;

/* 小菜单：收藏 / 朋友圈长按 */
var pop = null;
function closePop() { if (pop) { pop.remove(); pop = null; } }
window.mxSrcMenu = function (anchor, target, extra) {
  closePop();
  pop = document.createElement('div'); pop.className = 'mxs-pop';
  var btns = [{ i: '😺', t: '查看来源', fn: function () { show(target, anchor); } }].concat(extra || []);
  btns.forEach(function (b) {
    var el = document.createElement('button'); el.type = 'button'; el.innerHTML = '<i>' + b.i + '</i><span>' + b.t + '</span>';
    var run = function (e) { e.preventDefault(); e.stopPropagation(); closePop(); b.fn(); };
    el.addEventListener('click', run); el.addEventListener('touchend', run);
    pop.appendChild(el);
  });
  document.body.appendChild(pop);
  var r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
  var top = r.top - ph - 8; if (top < 8) top = Math.min(r.bottom + 8, innerHeight - ph - 8);
  pop.style.top = top + 'px'; pop.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left + r.width / 2 - pw / 2)) + 'px';
  setTimeout(function () {
    var off = function (e) { if (pop && !pop.contains(e.target)) { closePop(); document.removeEventListener('touchstart', off, true); document.removeEventListener('mousedown', off, true); } };
    document.addEventListener('touchstart', off, true); document.addEventListener('mousedown', off, true);
  }, 50);
};

/* 朋友圈：长按动态正文或评论 */
var lp = null;
function feedTarget(t) { return t && t.closest ? t.closest('.feed-content,.feed-c-line,.mail-paper[data-ta] .mail-paper-body') : null; }
document.addEventListener('touchstart', function (e) {
  var el = feedTarget(e.target); if (!el || active && active.legend && active.legend.contains(e.target)) return;
  var t0 = e.touches[0], x = t0.clientX, y = t0.clientY;
  lp = { x: x, y: y, tm: setTimeout(function () { lp = null; window.mxSrcMenu(el, el); }, 550) };
}, { passive: true, capture: true });
document.addEventListener('touchmove', function (e) { if (lp) { var t = e.touches[0]; if (Math.abs(t.clientX - lp.x) + Math.abs(t.clientY - lp.y) > 12) { clearTimeout(lp.tm); lp = null; } } }, { passive: true, capture: true });
document.addEventListener('touchend', function () { if (lp) { clearTimeout(lp.tm); lp = null; } }, true);
document.addEventListener('contextmenu', function (e) { var el = feedTarget(e.target); if (el) { e.preventDefault(); window.mxSrcMenu(el, el); } });
})();
