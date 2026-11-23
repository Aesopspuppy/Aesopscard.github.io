(function () {
'use strict';
var data = window.wordcloudData, page = document.getElementById('page-wordcloud');
if (!data || !page) return;
var stats = null, generation = 0;
var GLOBAL_KEY = 'xy-home-v2:wordcloud-style';
function cid() { return window.__activeCid || 'default'; }
function name() { try { return window.activeStore().get('lbl-partner') || 'TA'; } catch (e) { return 'TA'; } }
function toast(s) { if (window.toast) window.toast(s); else alert(s); }
function loadStyle() { try { return JSON.parse(window.xyStore('xy-home-v2').get('wordcloud-style') || '{}'); } catch (e) { return {}; } }
function putStyle(s) { try { window.xyStore('xy-home-v2').set('wordcloud-style', JSON.stringify(s)); applyStyle(); return true; } catch (e) { toast('存储空间不足，未保存'); return false; } }
function scopeCss(input, kind) {
  if (!input.trim()) return '';
  var style = document.createElement('style'); style.media = 'not all';
  style.textContent = input.indexOf('{') < 0 ? '.bubble{' + input + '}' : input;
  document.head.appendChild(style);
  var selector = kind === 'bubble' ? '.wc-scope .wc-bubble' : '.wc-scope,.wc-scope *';
  var fonts = {}, rules = style.sheet ? Array.from(style.sheet.cssRules) : [], out = '';
  rules.forEach(function (r, i) { if (r.type === 5) { var f = r.style.getPropertyValue('font-family').replace(/["']/g, '').trim(); if (f) fonts[f] = 'wc-font-' + i; } });
  function decl(s) { Object.keys(fonts).forEach(function (f) { s = s.split(f).join(fonts[f]); }); return s; }
  function walk(list) {
    return Array.from(list).map(function (r) {
      if (r.type === 1) return selector + '{' + decl(r.style.cssText) + '}';
      if (r.type === 4) return '@media ' + r.conditionText + '{' + walk(r.cssRules) + '}';
      if (r.type === 5 && kind === 'font') return '@font-face{' + decl(r.style.cssText) + '}';
      return ''; // Never allow imports, global selectors or animation names to escape this feature.
    }).join('\n');
  }
  try { out = walk(rules); } finally { style.remove(); }
  return out;
}
window.__wordcloudScopeCss = scopeCss;
function applyStyle() {
  var s = loadStyle(), st = document.getElementById('wc-custom-style');
  if (!st) { st = document.createElement('style'); st.id = 'wc-custom-style'; document.head.appendChild(st); }
  st.textContent = scopeCss(s.bubble || '', 'bubble') + '\n' + scopeCss(s.font || '', 'font');
  document.querySelectorAll('.wc-scope').forEach(function (el) { if (s.wallpaper) el.style.setProperty('--wc-wallpaper', 'url("' + s.wallpaper.replace(/"/g, '%22') + '")'); else el.style.removeProperty('--wc-wallpaper'); });
}
function openPage() {
  document.querySelectorAll('.page').forEach(function (p) { p.hidden = p !== page; });
  try { stats = JSON.parse(window.activeStore().get('wordcloud-stats') || 'null'); } catch (e) { stats = null; }
  render(); applyStyle();
}
function tokens(list, max) {
  var top = list.slice(0, max), high = top.length ? top[0].count : 1;
  return top.map(function (t) {
    var span = document.createElement('span');
    var size = Math.min(4, Math.max(0, Math.round(4 * Math.sqrt(t.count / high))));
    if (t.text.length > 45) size = Math.min(1, size);
    else if (t.text.length > 20) size = Math.min(2, size);
    span.className = 'wc-chip wc-bubble wc-size-' + size; span.textContent = t.text;
    span.title = t.count + '次'; return span;
  });
}
function render() {
  document.getElementById('wc-partner-name').textContent = name();
  ['ta','me'].forEach(function (who) {
    var el = document.getElementById('wc-cloud-' + who); el.replaceChildren();
    var list = [];
    if (stats) {
      list = who === 'ta' ? stats.ta.cards : stats.me.words.concat(stats.me.chars).sort(function (a,b) { return b.count - a.count; }).filter(function (x, i, a) { return a.findIndex(function (v) { return v.text === x.text; }) === i; });
    }
    var nodes = tokens(list, who === 'ta' ? 8 : 18);
    if (!nodes.length) { var empty = document.createElement('span'); empty.className = 'wc-empty'; empty.textContent = stats ? '暂无记录' : '尚未统计'; nodes = [empty]; }
    nodes.forEach(function (n) { el.appendChild(n); });
  });
}
async function refresh() {
  var my = ++generation, contact = cid(), btn = document.getElementById('wc-refresh');
  btn.disabled = true; btn.querySelector('span').textContent = '正在统计…';
  try {
    var all = await Promise.all([window.chatReadForWordcloud(), window.feedReadForWordcloud()]);
    if (my !== generation || contact !== cid()) return;
    stats = data.summarize(all[0], all[1], contact);
    window.activeStore().set('wordcloud-stats', JSON.stringify(stats)); render();
  } catch (e) { if (my === generation) toast('记录还没读取完成，请稍后再刷新'); }
  finally { if (my === generation) { btn.disabled = false; btn.querySelector('span').textContent = '刷新'; } }
}
function dialog(title) {
  var mask = document.createElement('div'); mask.className = 'wc-mask wc-scope';
  mask.innerHTML = '<div class="wc-panel wc-bubble" role="dialog" aria-modal="true"><div class="wc-dialog-head"><b></b><button class="wc-icon-btn" aria-label="关闭">×</button></div><div class="wc-dialog-body"></div></div>';
  mask.querySelector('b').textContent = title; mask.querySelector('[role=dialog]').setAttribute('aria-label', title);
  mask.querySelector('button').onclick = function () { mask.remove(); };
  mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove(); });
  document.body.appendChild(mask); applyStyle(); return mask;
}
function detail(kind) {
  if (!stats) { toast('请先点击刷新'); return; }
  var mask = dialog(kind === 'share' ? '分享词云' : '词云详情');
  var text = data.report(stats, name(), kind), body = mask.querySelector('.wc-dialog-body');
  var report = document.createElement('div'); report.className = 'wc-report'; report.textContent = text; body.appendChild(report);
  if (kind !== 'share') return;
  var contact = cid(), actions = document.createElement('div'); actions.className = 'wc-actions';
  actions.innerHTML = '<button class="modal-btn ok" data-to="chat">发送到聊天</button><button class="modal-btn cancel" data-to="feed">发送到朋友圈</button>';
  mask.querySelector('.wc-panel').appendChild(actions);
  actions.querySelectorAll('button').forEach(function (b) { b.onclick = async function () {
    if (cid() !== contact) { toast('联系人已切换，请重新分享'); mask.remove(); return; }
    b.disabled = true;
    try {
      if (b.dataset.to === 'chat') { await window.chatReadForWordcloud(); if (cid() !== contact) throw new Error('contact changed'); window.chatAddWordcloudReport(text); mask.remove(); window.enterChat(); }
      else { await window.feedReadForWordcloud(); if (cid() !== contact) throw new Error('contact changed'); if (!window.feedAddPost(text, [])) throw new Error('not saved'); mask.remove(); toast('已发送到朋友圈'); }
    } catch (e) { b.disabled = false; toast('发送失败，请稍后重试'); }
  }; });
}
function editCss(kind) {
  var title = kind === 'bubble' ? '更改词云背景框' : '更改词云字体', m = dialog(title), s = loadStyle();
  var input = document.createElement('textarea'); input.dataset.ceDone = '1'; input.className = 'wc-css-input'; input.setAttribute('aria-label', title + 'CSS代码'); input.value = s[kind] || '';
  m.querySelector('.wc-dialog-body').appendChild(input);
  var actions = document.createElement('div'); actions.className = 'wc-actions';
  actions.innerHTML = '<button class="modal-btn cancel">恢复默认</button><button class="modal-btn ok">保存</button>';
  m.querySelector('.wc-panel').appendChild(actions);
  actions.querySelector('.ok').onclick = function () { var v = loadStyle(); v[kind] = input.value; if (putStyle(v)) m.remove(); };
  actions.querySelector('.cancel').onclick = function () { var v = loadStyle(); delete v[kind]; if (putStyle(v)) m.remove(); };
}
function wallpaper() {
  var m = dialog('更改词云壁纸'), body = m.querySelector('.wc-dialog-body'), s = loadStyle();
  if (s.wallpaper) { var im = document.createElement('img'); im.className = 'wc-wall-preview'; im.src = s.wallpaper; body.appendChild(im); }
  var label = document.createElement('label'); label.className = 'wc-option'; label.textContent = '上传图片';
  var input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.hidden = true; input.setAttribute('aria-label','上传词云壁纸'); label.appendChild(input); body.appendChild(label);
  var reset = document.createElement('button'); reset.className = 'wc-option'; reset.textContent = '恢复默认'; body.appendChild(reset);
  reset.onclick = function () { var v = loadStyle(); delete v.wallpaper; if (putStyle(v)) m.remove(); };
  input.onchange = function () {
    var file = input.files && input.files[0]; if (!file) return;
    var reader = new FileReader(); reader.onload = function () {
      var image = new Image(); image.onload = function () {
        var ratio = Math.min(1, 1200 / Math.max(image.width, image.height)), cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(image.width * ratio)); cv.height = Math.max(1, Math.round(image.height * ratio));
        var ctx = cv.getContext('2d'); if (!ctx) return; ctx.drawImage(image,0,0,cv.width,cv.height);
        var v = loadStyle(); v.wallpaper = cv.toDataURL('image/jpeg',.82); if (putStyle(v)) m.remove();
      }; image.onerror = function () { toast('图片无法读取'); }; image.src = reader.result;
    }; reader.readAsDataURL(file);
  };
}
function beautify() {
  var m = dialog('词云美化'), body = m.querySelector('.wc-dialog-body');
  [['更改词云背景框','bubble'],['更改词云字体','font'],['更改词云壁纸','wallpaper']].forEach(function (o) {
    var b = document.createElement('button'); b.className = 'wc-option'; b.textContent = o[0];
    b.onclick = function () { m.remove(); if (o[1] === 'wallpaper') wallpaper(); else editCss(o[1]); }; body.appendChild(b);
  });
}
document.addEventListener('click', function (e) { var app = e.target.closest('.app[data-app="wordcloud"]'); if (app && !document.getElementById('page-phone').classList.contains('decor-on')) openPage(); });
document.getElementById('wc-back').onclick = function () { page.hidden = true; document.getElementById('page-phone').hidden = false; };
document.getElementById('wc-refresh').onclick = refresh;
document.getElementById('wc-share').onclick = function () { detail('share'); };
document.getElementById('wc-cloud-ta').onclick = function () { detail('ta'); };
document.getElementById('wc-cloud-me').onclick = function () { detail('me'); };
document.getElementById('row-wordcloud-style').onclick = beautify;
document.addEventListener('contact-switched', function () { generation++; stats = null; var btn = document.getElementById('wc-refresh'); btn.disabled = false; btn.querySelector('span').textContent = '刷新'; if (!page.hidden) openPage(); });
applyStyle();
if (window.idbHydrateKey) window.idbHydrateKey(GLOBAL_KEY).then(applyStyle).catch(function () {});
document.addEventListener('mochi-restore-done', applyStyle);
})();