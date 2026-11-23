/* 占卜互动：聊天「更多 → 占卜」分组、联系人主动抽牌 / 邀请抽牌、实时观战、牌背自定义 */
(function () { try {
const MODE_NAME = { tarot: '塔罗牌占卜(占卜复杂事项)', lenormand: '雷诺曼占卜(占卜日常、简单事项)' };
const gStore = window.xyStore ? window.xyStore('xy-home-v2') : null;
const BACK_KEY = { tarot: 'divine-back-tarot', lenormand: 'divine-back-lenormand' };
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
function toast(t) { if (typeof window.toast === 'function') window.toast(t); }
function curCid() { return window.__activeCid || 'default'; }
function nameOf(cid) { try { if ((!cid || cid === curCid()) && typeof window.chatPartnerName === 'function') return window.chatPartnerName(); } catch (e) {} try { const s = window.storeFor ? window.storeFor(cid || curCid()) : window.activeStore(); return s.get('lbl-partner') || s.get('cs-lbl-partner') || 'TA'; } catch (e) { return 'TA'; } }
function inChat() { const p = document.getElementById('page-chat'); return !!(p && !p.hidden); }

/* ---------- 样式 ---------- */
const css = document.createElement('style');
css.textContent = '' +
'.dta-mask{position:fixed;inset:0;z-index:9400;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;padding:18px}' +
'.dta-box{width:100%;max-width:360px;background:var(--card,#fff);color:var(--ink,#111);border-radius:16px;padding:18px 16px 14px;box-shadow:0 10px 40px rgba(0,0,0,.25)}' +
'.dta-t{font-weight:600;font-size:15px;text-align:center;margin-bottom:10px}' +
'.dta-sub{font-size:13px;opacity:.75;text-align:center;margin:6px 0 10px;line-height:1.5}' +
'.dta-in{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.15);border-radius:10px;padding:10px;font-size:14px;background:transparent;color:inherit}' +
'.dta-btns{display:flex;gap:10px;margin-top:14px}.dta-btns button{flex:1;border:0;border-radius:10px;padding:10px;font-size:14px}' +
'.dta-ok{background:#111;color:#fff}.dta-no{background:#e4e4e4;color:#333}' +
'.dta-live{position:fixed;left:0;right:0;bottom:0;z-index:9300;max-height:78vh;background:var(--card,#fff);color:var(--ink,#111);border-radius:16px 16px 0 0;box-shadow:0 -6px 30px rgba(0,0,0,.22);display:flex;flex-direction:column}' +
'.dta-live[hidden]{display:none}.dta-live-h{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;font-weight:600;font-size:14px;border-bottom:1px solid rgba(0,0,0,.08)}' +
'.dta-live-h button{border:0;background:transparent;font-size:16px;color:inherit}' +
'.dta-live-b{overflow-y:auto;padding:10px 14px 18px;-webkit-overflow-scrolling:touch}' +
'.dta-step{font-size:13px;line-height:1.55;padding:6px 10px;margin:6px 0;border-radius:10px;background:rgba(0,0,0,.05);animation:dtaIn .3s ease}' +
'@keyframes dtaIn{from{opacity:0;transform:translateY(6px)}to{opacity:1}}' +
'.dta-res{white-space:pre-wrap;font-size:12.5px;line-height:1.6}' +
'.dta-banner{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:9500;background:rgba(30,30,34,.94);color:#fff;border-radius:14px;padding:12px 14px;font-size:13.5px;box-shadow:0 6px 24px rgba(0,0,0,.3);animation:dtaIn .3s ease}' +
'.divf-back-box{margin-top:8px;border:1px solid rgba(0,0,0,.1);border-radius:10px;padding:8px 10px}' +
'.divf-back-row{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:13px}.divf-back-row .nm{flex:1}' +
'.divf-back-th{width:34px;height:54px;border-radius:5px;background:linear-gradient(168deg,#5a5270,#2b2538) center/cover no-repeat;flex-shrink:0}' +
'.divf-back-row button{border:1px solid rgba(0,0,0,.15);background:transparent;border-radius:8px;padding:5px 9px;font-size:12px;color:inherit}';
document.head.appendChild(css);

/* ---------- 牌背 ---------- */
const backCss = document.createElement('style');
backCss.id = 'div-back-css';
document.head.appendChild(backCss);
function getBack(m) { try { return (gStore && gStore.get(BACK_KEY[m])) || ''; } catch (e) { return ''; } }
function applyBacks() {
let t = '';
['tarot', 'lenormand'].forEach(function (m) {
const u = getBack(m);
if (!u) return;
const sel = '.div-bk-' + m + ' .div-pile-card,.div-bk-' + m + ' .div-shuf-card,.csp-bk-' + m + ' .csp-back';
t += sel + '{background:url("' + u.replace(/"/g, '%22') + '") center/cover no-repeat !important;border-color:rgba(0,0,0,.25) !important}';
t += '.div-bk-' + m + ' .div-pile-card::before,.div-bk-' + m + ' .div-pile-card::after,.div-bk-' + m + ' .div-shuf-card::before,.div-bk-' + m + ' .div-shuf-card::after{display:none !important}';
});
backCss.textContent = t;
}
applyBacks();
window.divineBackGet = getBack;
window.divineBackWire = function (box) {
if (!box) return;
const render = function () {
box.innerHTML = '<div style="font-size:13px;font-weight:600">牌背（塔罗与雷诺曼分开设置）</div>' +
['tarot', 'lenormand'].map(function (m) {
const u = getBack(m);
return '<div class="divf-back-row"><span class="divf-back-th"' + (u ? ' style="background-image:url(&quot;' + esc(u) + '&quot;)"' : '') + '></span>' +
'<span class="nm">' + (m === 'tarot' ? '塔罗牌背' : '雷诺曼牌背') + '</span>' +
'<button type="button" data-bk-up="' + m + '">上传图片</button>' +
(u ? '<button type="button" data-bk-rm="' + m + '">恢复默认</button>' : '') + '</div>';
}).join('');
};
render();
box.addEventListener('click', function (e) {
const up = e.target.closest('[data-bk-up]');
const rm = e.target.closest('[data-bk-rm]');
if (rm) { try { gStore.remove ? gStore.remove(BACK_KEY[rm.dataset.bkRm]) : gStore.set(BACK_KEY[rm.dataset.bkRm], ''); } catch (er) {} applyBacks(); render(); toast('已恢复默认牌背'); return; }
if (!up) return;
const m = up.dataset.bkUp;
const inp = document.createElement('input');
inp.type = 'file'; inp.accept = 'image/*';
inp.onchange = function () {
const f = inp.files && inp.files[0];
if (!f) return;
const fr = new FileReader();
fr.onload = function () {
const src = fr.result;
const done = function (u) {
if (!u) { toast('图片处理失败'); return; }
try { gStore.set(BACK_KEY[m], u); } catch (er) { toast('存储空间不足，换张小一点的图'); return; }
applyBacks(); render(); toast('牌背已更换');
};
if (window.mochiImgCompressTo) window.mochiImgCompressTo(src, { maxSide: 520, quality: 0.85, tag: 'div-back' }).then(done, function () { done(null); });
else done(src);
};
fr.readAsDataURL(f);
};
inp.click();
});
};

/* ---------- 通用弹窗 / 横幅 ---------- */
function modal(html) {
const m = document.createElement('div');
m.className = 'dta-mask';
m.innerHTML = '<div class="dta-box">' + html + '</div>';
document.body.appendChild(m);
return m;
}
let bannerEl = null;
function banner(text, onTap) {
if (bannerEl) bannerEl.remove();
const b = document.createElement('div');
b.className = 'dta-banner';
b.textContent = text;
b.addEventListener('click', function () { b.remove(); bannerEl = null; if (onTap) onTap(); });
document.body.appendChild(b);
bannerEl = b;
setTimeout(function () { if (bannerEl === b) { b.remove(); bannerEl = null; } }, 9000);
}

/* ---------- 占卜问题抽取 ---------- */
function single(s) {
if (typeof s !== 'string') return false;
s = s.trim();
if (!s || s.length > 60) return false;
if (s.indexOf('|||') >= 0 || s.indexOf('data:') === 0 || /^https?:\/\//i.test(s) || s.indexOf('\n') >= 0) return false;
if (window.mochiMediaIsToken && window.mochiMediaIsToken(s)) return false;
return true;
}
function pickQuestion() {
const divq = ((window.getCustomFuncCards && window.getCustomFuncCards('divq')) || []).filter(single);
if (Math.random() < 0.5 && divq.length) return rnd(divq);
const srcs = [
function () { return window.dictQuoteOne ? window.dictQuoteOne() : null; },
function () { const a = ((window.getCustomCards && window.getCustomCards()) || []).filter(single); return a.length ? rnd(a) : null; },
function () { for (let i = 0; i < 6; i++) { const d = window.getDefaultCards && window.getDefaultCards('chat'); if (d && d.type === 'text' && single(d.text)) return d.text; } return null; }
];
for (let i = srcs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = srcs[i]; srcs[i] = srcs[j]; srcs[j] = t; }
for (let i = 0; i < srcs.length; i++) { try { const q = srcs[i](); if (single(q)) return q.trim(); } catch (e) {} }
return divq.length ? rnd(divq) : '最近会顺利吗';
}

/* ---------- 实时观战面板 ---------- */
let busy = false;
let live = null;
function ensureLive() {
if (live) return live;
live = document.createElement('div');
live.className = 'dta-live';
live.hidden = true;
live.innerHTML = '<div class="dta-live-h"><span class="dta-live-t">占卜观战</span><button type="button" class="dta-live-x">✕</button></div><div class="dta-live-b"><div class="dta-steps"></div><div class="dta-stage"></div><div class="dta-after"></div></div>';
live.querySelector('.dta-live-x').addEventListener('click', function () { live.hidden = true; });
document.body.appendChild(live);
return live;
}
function step(text) {
const L = ensureLive();
const d = document.createElement('div');
d.className = 'dta-step';
d.textContent = text;
L.querySelector('.dta-steps').appendChild(d);
const b = L.querySelector('.dta-live-b'); b.scrollTop = b.scrollHeight;
}
window.taDivineShowLive = function () { if (live) live.hidden = false; };

function runContactDraw(opts) {
opts = opts || {};
if (busy) return false;
busy = true;
const cid = curCid();
const name = nameOf(cid);
const mode = opts.mode || (Math.random() < 0.5 ? 'tarot' : 'lenormand');
const L = ensureLive();
L.querySelector('.dta-live-t').textContent = name + ' 正在占卜';
L.querySelector('.dta-steps').innerHTML = '';
L.querySelector('.dta-stage').innerHTML = '';
L.querySelector('.dta-after').innerHTML = '';
if (inChat() || opts.show) L.hidden = false;
else banner(name + '正在进行占卜...点开即可实时观战', function () { L.hidden = false; });
const T = 1300;
setTimeout(function () {
step(name + ' 选择了「' + MODE_NAME[mode] + '」');
setTimeout(function () {
let question = (opts.question || '').trim();
if (question) step('占卜问题：「' + question + '」');
else { question = pickQuestion(); step(name + ' 抽了一张字卡当作占卜问题：「' + question + '」'); }
setTimeout(function () {
const count = rnd([1, 3, 5]);
step(name + ' 决定抽 ' + count + ' 张牌');
setTimeout(function () {
step(name + ' 开始洗牌、抽牌…');
const deck = mode === 'tarot' ? (window.__TAROT__ || []) : ((window.divineLenoDeck && window.divineLenoDeck()) || window.__LENO__ || []);
if (!window.startDivineDraw || !deck.length) { step('牌库还没加载好，这次占卜取消了'); busy = false; return; }
window.startDivineDraw(L.querySelector('.dta-stage'), {
deck: deck, count: count, tarot: mode === 'tarot',
labels: ((window.__MODE_LABELS__ || {})[mode] || {})[count] || [],
onDone: function (cards) {
const summary = (window.divineBuildSummary && window.divineBuildSummary(cards, mode, question)) || '';
const text = (window.divineBuildResultText && window.divineBuildResultText(mode, cards, summary, question)) || '';
L.querySelector('.dta-after').innerHTML = '<div class="dta-step dta-res">' + esc(text) + '</div>';
let where = 'chat';
const sameCid = curCid() === cid;
if (!sameCid) where = 'feed';
else if (!inChat()) where = Math.random() < 0.5 ? 'chat' : 'feed';
if (where === 'chat' && window.chatAddIn) { try { window.chatAddIn(text); } catch (e) {} step(name + ' 把抽牌记录发到了聊天里'); }
else if (window.feedAddTaPost) { window.feedAddTaPost(cid, text); step(name + ' 把抽牌记录发到了朋友圈'); }
try {
if (window.divineHistLoad && window.divineHistSave && sameCid) {
const list = window.divineHistLoad();
if (Array.isArray(list)) { list.unshift({ ts: Date.now(), mode: mode, count: count, question: question, cards: cards, summary: summary, target: name + '（自己抽）' }); window.divineHistSave(list); }
}
} catch (e) {}
busy = false;
}
});
}, T);
}, T);
}, T);
}, 400);
return true;
}
window.taDivineRun = runContactDraw;

/* ---------- 联系人邀请用户 ---------- */
function contactInvitesUser(mode) {
const name = nameOf();
mode = mode || (Math.random() < 0.5 ? 'tarot' : 'lenormand');
const open = function () {
const m = modal('<div class="dta-t">' + esc(name) + ' 邀请你进行占卜</div><div class="dta-sub">' + esc(MODE_NAME[mode]) + '</div><div class="dta-btns"><button class="dta-no">拒绝</button><button class="dta-ok">接受</button></div>');
m.querySelector('.dta-no').onclick = function () { m.remove(); if (window.chatAddSystem) window.chatAddSystem('你拒绝了 ' + name + ' 的占卜邀请'); };
m.querySelector('.dta-ok').onclick = function () {
m.remove();
if (!inChat() && window.enterChat) { try { window.enterChat(); } catch (e) {} }
setTimeout(function () {
if (window.openChatDivineFor) window.openChatDivineFor(mode, '');
window.__divInvitedBy = name;
}, inChat() ? 50 : 600);
};
};
if (inChat()) open();
else banner(name + '邀请你进行占卜……', open);
return true;
}
window.taDivineInviteUser = contactInvitesUser;

/* ---------- 自动触发（随 TA 主动找你） ---------- */
function prob(c, k) { const v = c && typeof c[k] === 'number' ? c[k] : 8; const eff = window.dcpEff ? window.dcpEff(v) : v; return window.icProb ? window.icProb(eff) : eff; }
window.taDivineTry = function (c) {
try {
if (busy || document.querySelector('.dta-mask')) return false;
if (Math.random() * 100 < prob(c, 'ai-divself-prob')) return runContactDraw({});
if (Math.random() * 100 < prob(c, 'ai-divinv-prob')) return contactInvitesUser();
} catch (e) {}
return false;
};

/* ---------- 用户邀请联系人 ---------- */
function userInvite(mode) {
const mp = document.getElementById('chat-more-panel'); if (mp) mp.hidden = true;
if (busy) { toast('TA 正在占卜中，稍等一下'); return; }
const name = nameOf();
const m = modal('<div class="dta-t">' + esc(MODE_NAME[mode]) + '</div><input class="dta-in" placeholder="占卜问题（可不填）" autocomplete="off"><div class="dta-sub">邀请 ' + esc(name) + ' 来抽牌</div><div class="dta-btns"><button class="dta-no">取消</button><button class="dta-ok">邀请TA抽牌</button></div>');
const inp = m.querySelector('.dta-in');
m.querySelector('.dta-no').onclick = function () { m.remove(); };
m.querySelector('.dta-ok').onclick = function () {
const q = inp.value.trim();
const box = m.querySelector('.dta-box');
let left = 30;
box.innerHTML = '<div class="dta-t">已邀请 ' + esc(name) + '</div><div class="dta-sub dta-cd">' + esc(name) + ' 正在考虑…（' + left + ' 秒）</div>';
const cd = box.querySelector('.dta-cd');
const decideAt = 3 + Math.floor(Math.random() * 27);
const accept = Math.random() < 0.5;
const tm = setInterval(function () {
left--;
if (cd) cd.textContent = name + ' 正在考虑…（' + left + ' 秒）';
if (30 - left >= decideAt || left <= 0) {
clearInterval(tm);
m.remove();
if (accept) runContactDraw({ mode: mode, question: q, show: true });
else if (window.chatAddSystem) window.chatAddSystem(name + '现在不想抽牌');
}
}, 1000);
};
setTimeout(function () { try { inp.focus(); } catch (e) {} }, 50);
}
[['more-divta-tarot', 'tarot'], ['more-divta-leno', 'lenormand']].forEach(function (p) {
const b = document.getElementById(p[0]);
if (b) b.addEventListener('click', function (e) { e.stopPropagation(); userInvite(p[1]); });
});
} catch (e) { try { (window.__jsErrors = window.__jsErrors || []).push('divine-ta: ' + (e && e.message)); } catch (e2) {} } })();
if (window.__mochiLoaded) window.__mochiLoaded.push("divine-ta.js");
