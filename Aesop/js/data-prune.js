/* 设置→通用：按时间清除聊天 / 朋友圈 / 信箱数据。只动对应功能自己的数据，收藏等其他地方不碰。 */
(function () {
var KINDS = { chat: '聊天', feed: '朋友圈', mail: '信箱' };
var DAY = 86400000;
var OPTS = [['365', '一年'], ['182', '6个月'], ['91', '3个月']];
function cutoffOf(v) { var d = new Date(); if (v === '365') d.setFullYear(d.getFullYear() - 1); else d.setMonth(d.getMonth() - (v === '182' ? 6 : 3)); return d.getTime(); }
function toast(msg) { var t = document.getElementById('cc-toast'); if (!t) { t = document.createElement('div'); t.id = 'cc-toast'; document.body.appendChild(t); } t.textContent = msg; t.className = 'cc-toast'; void t.offsetWidth; t.className = 'cc-toast show'; clearTimeout(t._timer); t._timer = setTimeout(function () { t.className = 'cc-toast'; }, 2500); }
function wait(fn, ms) { return new Promise(function (res) { var end = Date.now() + (ms || 12000); (function tick() { var r = null; try { r = fn(); } catch (e) { r = null; } if (typeof r === 'number') return res(r); if (Date.now() > end) return res(null); setTimeout(tick, 250); })(); }); }
async function run(kind, cutoff) {
  if (kind === 'feed') return { removed: await wait(function () { return window.feedPruneBefore && window.feedPruneBefore(cutoff); }), failed: 0 };
  var fn = kind === 'chat' ? 'chatPruneBefore' : 'mailPruneBefore';
  var list = []; try { list = (window.getContacts ? window.getContacts() : []).map(function (c) { return c.id; }); } catch (e) {}
  if (list.indexOf('default') < 0) list.unshift('default');
  var orig = window.__activeCid || 'default', removed = 0, failed = 0;
  list.sort(function (a, b) { return (a === orig ? -1 : 0) - (b === orig ? -1 : 0); });
  for (var i = 0; i < list.length; i++) {
    if ((window.__activeCid || 'default') !== list[i] && window.setActiveContact) window.setActiveContact(list[i]);
    var r = await wait(function () { return window[fn] && window[fn](cutoff); });
    if (typeof r === 'number') removed += r; else failed++;
  }
  try { if (window.chatFlushSave) window.chatFlushSave(); } catch (e) {}
  if ((window.__activeCid || 'default') !== orig && window.setActiveContact) window.setActiveContact(orig);
  return { removed: removed, failed: failed };
}
async function countFor(kind, cutoff) { // 只统计不删除，逻辑与 run() 对应
  if (kind === 'feed') return await wait(function () { return window.feedCountBefore && window.feedCountBefore(cutoff); });
  var fn = kind === 'chat' ? 'chatCountBefore' : 'mailCountBefore';
  var list = []; try { list = (window.getContacts ? window.getContacts() : []).map(function (c) { return c.id; }); } catch (e) {}
  if (list.indexOf('default') < 0) list.unshift('default');
  var orig = window.__activeCid || 'default', total = 0, failed = 0;
  list.sort(function (a, b) { return (a === orig ? -1 : 0) - (b === orig ? -1 : 0); });
  for (var i = 0; i < list.length; i++) {
    if ((window.__activeCid || 'default') !== list[i] && window.setActiveContact) window.setActiveContact(list[i]);
    var r = await wait(function () { return window[fn] && window[fn](cutoff); });
    if (typeof r === 'number') total += r; else failed++;
  }
  if ((window.__activeCid || 'default') !== orig && window.setActiveContact) window.setActiveContact(orig);
  return failed ? null : total;
}
function fmtDate(ts) { var d = new Date(ts); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function open(kind) {
  var name = KINDS[kind];
  var m = document.createElement('div'); m.className = 'dp-mask';
  m.innerHTML = '<div class="dp-box"><div class="dp-title">清除' + name + '数据</div>' +
    OPTS.map(function (o, i) { return '<div class="dp-opt' + (i ? '' : ' on') + '" data-v="' + o[0] + '"><i class="dp-dot"></i><span>清除' + o[1] + '之前的' + name + '数据</span></div>'; }).join('') +
    '<div class="dp-count">正在统计…</div>' +
    '<div class="dp-note">只清除「' + name + '」里的记录，收藏里的内容不会被清除。不可恢复，建议先导出数据备份。</div>' +
    '<button class="dp-ok" disabled>确定</button><button class="dp-cancel">取消</button></div>';
  document.body.appendChild(m);
  var countEl = m.querySelector('.dp-count'), okBtn = m.querySelector('.dp-ok'), seq = 0;
  async function refresh() {
    var my = ++seq, v = m.querySelector('.dp-opt.on').dataset.v, cutoff = cutoffOf(v);
    countEl.textContent = '正在统计…'; okBtn.disabled = true;
    var n = await countFor(kind, cutoff);
    if (my !== seq || !document.body.contains(m)) return;
    if (typeof n !== 'number') { countEl.textContent = '数据还没读取完，请关闭后稍等几秒再试'; return; }
    countEl.textContent = '将删除 ' + n + ' 条记录（' + fmtDate(cutoff) + ' 之前的记录）';
    okBtn.disabled = false;
  }
  m.querySelectorAll('.dp-opt').forEach(function (o) { o.onclick = function () { m.querySelectorAll('.dp-opt').forEach(function (x) { x.classList.remove('on'); }); o.classList.add('on'); refresh(); }; });
  m.querySelector('.dp-cancel').onclick = function () { m.remove(); };
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  okBtn.onclick = async function () {
    var v = m.querySelector('.dp-opt.on').dataset.v, btn = this;
    btn.disabled = true; btn.textContent = '正在清除…';
    var res = await run(kind, cutoffOf(v));
    m.remove();
    if (res.removed === null || (res.failed && !res.removed)) { toast(name + '数据还没读取完，请稍后再试'); return; }
    toast('已清除 ' + (res.removed || 0) + ' 条' + name + '数据');
    setTimeout(function () { location.reload(); }, 1800);
  };
  refresh();
}
var css = document.createElement('style');
css.textContent = '.dp-mask{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:20px}' +
  '.dp-box{background:#fff;color:#111;border-radius:16px;padding:18px;width:100%;max-width:340px;box-sizing:border-box}' +
  '.dp-title{font-size:17px;font-weight:600;text-align:center;margin-bottom:12px}' +
  '.dp-opt{display:flex;align-items:center;gap:10px;padding:11px 4px;font-size:15px;border-bottom:1px solid #eee}.dp-dot{flex:none;width:16px;height:16px;border-radius:50%;border:2px solid #bbb;box-sizing:border-box}.dp-opt.on .dp-dot{border:5px solid #111}' +
  '.dp-count{font-size:13px;color:#555;margin:10px 2px 0;line-height:1.5}' +
  '.dp-note{font-size:12px;color:#888;margin:10px 2px 14px;line-height:1.5}' +
  '.dp-ok,.dp-cancel{display:block;width:100%;border:0;border-radius:10px;padding:12px;font-size:15px;margin-top:8px}.dp-ok{background:#111;color:#fff}.dp-ok:disabled{opacity:.5}.dp-cancel{background:#e5e5e5;color:#333}';
document.head.appendChild(css);
['chat', 'feed', 'mail'].forEach(function (k) { var r = document.getElementById('row-prune-' + k); if (r) r.addEventListener('click', function () { open(k); }); });
window.__dataPruneCutoff = cutoffOf;
})();
