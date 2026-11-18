
;/* ==== pong.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-pong-panel');
if (!panel) return;
const canvas = document.getElementById('pong-canvas');
if (!canvas) return;
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('pong-score');
const hintEl = document.getElementById('pong-hint');
const overlayEl = document.getElementById('pong-overlay');
const overlayTitleEl = document.getElementById('pong-overlay-title');
const overlayBodyEl = document.getElementById('pong-overlay-body');
const overlayBtnEl = document.getElementById('pong-overlay-btn');
const diffSel = document.getElementById('pong-diff');
const soundBtn = document.getElementById('pong-sound');
const closeBtn = document.getElementById('pong-close');
const partnerNameEl = document.getElementById('pong-partner-name');
const pauseBtn = document.getElementById('pong-pause');
const fsBtn = document.getElementById('pong-fs');
const overlayBtn2El = document.getElementById('pong-overlay-btn2');
const winTipEl = document.getElementById('pong-win-tip');
const W = 400, H = 300;
const PADDLE_W = 8;
const PADDLE_GAP = 14;            // 挡板距边界
const INIT_SPEED = 4;
const SPEED_INC = 0.2;
const MAX_SPEED = 6.5;
const PLAYER_MAX_SPEED = 8.5;      // 玩家挡板最大速度（px/tick，提高让玩家更容易接快球）
const FPS = 60;
const DIFFS = {
casual: { reactDelay: [0.8, 1.2],  maxSpeed: 1.5, predictErr: 56, missRate: 0.30, paddleH: 92, ppH: 120, ballR: 8, winScore: 3, fumble: 0.32, maxBall: 5.0,
beh: { early: 0.02, slow: 0.18, drift: 0.18, shift: 0.03, miss: 0.18, risky: 0.01 } },
easy:   { reactDelay: [0.55, 0.85], maxSpeed: 1.85, predictErr: 44, missRate: 0.22, paddleH: 84, ppH: 110, ballR: 7, winScore: 4, fumble: 0.24, maxBall: 5.6,
beh: { early: 0.03, slow: 0.13, drift: 0.12, shift: 0.04, miss: 0.12, risky: 0.02 } },
normal: { reactDelay: [0.2, 0.4],  maxSpeed: 3.6, predictErr: 16, missRate: 0.08, paddleH: 70, ppH: 84, ballR: 6, winScore: 5, fumble: 0.06, maxBall: 6.2,
beh: { early: 0.06, slow: 0.05, drift: 0.05, shift: 0.04, miss: 0.03, risky: 0.08 } },
hard:   { reactDelay: [0.12, 0.28], maxSpeed: 5.0, predictErr: 8,  missRate: 0.04, paddleH: 70, ppH: 78, ballR: 6, winScore: 5, fumble: 0, maxBall: 6.5,
beh: { early: 0.07, slow: 0.03, drift: 0.03, shift: 0.03, miss: 0.02, risky: 0.1 } }
};
const POOLS = {
casual: {
player_win: ['让你赢啦~', '再来陪你玩', '你厉害呀', '哼，下次赢回来', '好棒好棒'],
opponent_win: ['没事，再来一局', '让着你还没赢呀', '下次让你先', '别气馁嘛', '哎呀我赢了'],
draw: ['平手啦', '再来再来', '默契嘛', '一起的']
},
easy: {
player_win: ['你赢了~', '再来一局', '这次你厉害', '差点接住', '你反应挺快'],
opponent_win: ['我赢了，再来吗', '下次让你', '你差点接住', '加油呀', '还玩吗'],
draw: ['平局，再来', '一起撞上了', '再来一次', '默契默契']
},
normal: {
player_win: ['赢了？', '再来一局。', '这次你赢。', '还要继续吗？', '你反应挺快。', '差点接住。'],
opponent_win: ['我赢了。', '还玩吗？', '这次是我赢。', '再来。', '你差点接住。', '下一局加油。'],
draw: ['一起撞上的。', '算平手。', '再来一次。', '平局，再来。']
},
hard: {
player_win: ['你赢了。', '再来。', '这次你反应快。', '继续？'],
opponent_win: ['我赢了。', '再来。', '你差点接住。', '下一局。'],
draw: ['平局。', '再来。']
}
};
const SAY_POOLS = {
catch: ['接得好', '嘿', '看我的', '嘿咻'],
miss: ['哎呀', '差点', '哼', '没接住'],
score: ['哈', '接到啦', '嘿嘿', '得分']
};
let audioCtx = null, soundOn = true;
function beep(freq, dur, vol) {
if (!soundOn) return;
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(function () {});
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = 'square';
g.gain.value = vol || 0.06;
o.connect(g); g.connect(audioCtx.destination);
const t = audioCtx.currentTime;
o.start(t); g.gain.setValueAtTime(g.gain.value, t);
g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.06));
o.stop(t + (dur || 0.06));
} catch (e) {}
}
function sfxWall() { beep(380, 0.04, 0.14); }
function sfxPaddle() { beep(520, 0.05, 0.18); }
function sfxScore() { beep(300, 0.12, 0.2); }
function sfxWin() { beep(660, 0.18, 0.22); setTimeout(() => beep(880, 0.22, 0.22), 140); }
let state = null;
let rafId = null, lastTs = 0, acc = 0;
let running = false;
function newState(diff) {
const d = DIFFS[diff] || DIFFS.easy;
const pH = d.paddleH, ppH = d.ppH || d.paddleH, bR = d.ballR;
return {
diff: diff,
playerScore: 0, opponentScore: 0,
ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: INIT_SPEED },
player: { y: H / 2 - ppH / 2, vy: 0, targetY: H / 2 - ppH / 2 },
opponent: { y: H / 2 - pH / 2, vy: 0, targetY: H / 2 - pH / 2, reactUntil: 0, aiNextAt: 0 },
status: 'countdown',          // countdown | rally | scored | ended
countdown: 3, countdownAt: 0,
scorePauseUntil: 0,
gameTime: 0, roundStartTs: 0,
rallyHits: 0,                 // 本回合击球次数（球速随回合递增）
playerStreak: 0, opponentStreak: 0,
maxPlayerStreak: 0, maxOpponentStreak: 0,
totalRounds: 0,
approachErr: 0, approachMiss: 0, prevVx: 0,
beh: {
active: null,               // {type, until}
cooldown: {},               // {type: ts}
consecCatch: 0              // TA 连续接球数
},
flashPaddle: 0, flashWall: 0, flashScore: 0,
lastHit: 0,                   // 上次击球点（-1~1，用于挡板闪光颜色教学）
taBubble: null,               // {emoji, text, until} TA 表情/说话泡泡
sayCooldown: 0,               // TA 说话冷却时间戳
emojiCooldown: 0,             // TA 表情冷却时间戳（接球高频事件防每次都冒）
serveDir: Math.random() < 0.5 ? -1 : 1,  // 预决定的发球方向（用于发球前预警箭头）
playerRallyHits: 0,           // 玩家本回合连续接球数（连击奖励用）
params: d
};
}
function serve(s) {
const dir = s.serveDir || (Math.random() < 0.5 ? -1 : 1);
const ang = (Math.random() * 30 - 15) * Math.PI / 180;   // -15°~+15°
const sp = INIT_SPEED;
s.ball.x = W / 2; s.ball.y = H / 2;
s.ball.vx = Math.cos(ang) * sp * dir;
s.ball.vy = Math.sin(ang) * sp;
s.ball.speed = sp;
s.rallyHits = 0;
s.playerRallyHits = 0;
s.prevVx = 0; s.approachErr = 0; s.approachMiss = 0;   // 发球即新进攻，误差重掷
s.status = 'rally';
s.roundStartTs = s.gameTime;
s.serveDir = Math.random() < 0.5 ? -1 : 1;   // 预决定下次发球方向（供预警箭头）
}
function predictY(s, targetX) {
const b = s.ball;
const bR = s.params.ballR;
if (b.vx === 0) return b.y;
const dir = Math.sign(b.vx);
if ((targetX - b.x) * dir <= 0) return b.y;   // 球不会到达
let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
let guard = 0;
while ((targetX - x) * dir > 0 && guard < 64) {
guard++;
const dt = (targetX - x) / vx;     // 直达时间
let nextY = y + vy * dt;
if (nextY < bR) {
const tHit = (bR - y) / vy;
x += vx * tHit; y = bR; vy = -vy;
continue;
}
if (nextY > H - bR) {
const tHit = (H - bR - y) / vy;
x += vx * tHit; y = H - bR; vy = -vy;
continue;
}
return nextY;
}
return y;
}
const BEH_COOLDOWN = [3000, 6000];
function behCanTrigger(s, type, now) {
const last = s.beh.cooldown[type] || 0;
return now - last > (s._cdLen && s._cdLen[type] || 4000);
}
function behTrigger(s, type, now, dur) {
s.beh.active = { type: type, until: now + dur };
const cd = BEH_COOLDOWN[0] + Math.random() * (BEH_COOLDOWN[1] - BEH_COOLDOWN[0]);
s.beh.cooldown[type] = now + cd;
s._cdLen = s._cdLen || {};
s._cdLen[type] = cd;
}
function behActive(s, now) {
if (s.beh.active && s.beh.active.until <= now) s.beh.active = null;
return s.beh.active;
}
function opponentAI(s, now) {
const b = s.ball, o = s.opponent, p = s.params;
const pH = p.paddleH;
const taX = PADDLE_GAP + PADDLE_W;
const ballToTa = b.vx < 0;   // 球正在向 TA（左）移动
let targetY = o.y;           // 默认保持
if (!ballToTa) {
const act = behActive(s, now);
if (act && act.type === 'shift') {
targetY = o.targetY;     // 保持上次选的站位
} else {
targetY = H / 2 - pH / 2 + (Math.random() * 20 - 10);
}
} else {
let predY = predictY(s, taX);
const predCenter = predY - pH / 2;
const act = behActive(s, now);
if (!act) {
const r = Math.random();
const beh = p.beh;
const dist = b.x - taX;
if (dist < 130 && dist > 30 && p.fumble > 0 && behCanTrigger(s, 'fumble', now) && r < p.fumble) {
behTrigger(s, 'fumble', now, 260 + Math.random() * 200);
const away = pH * (0.6 + Math.random() * 0.3);
predY += (predY > H / 2 ? -1 : 1) * away;
if (Math.random() < 0.5) predY = Math.max(p.ballR + 2, Math.min(H - p.ballR - 2, predY));
}
else if (dist > 180 && behCanTrigger(s, 'early', now) && r < beh.early) {
behTrigger(s, 'early', now, 600 + Math.random() * 400);
}
else if (behCanTrigger(s, 'slow', now) && r < beh.slow) {
behTrigger(s, 'slow', now, 200 + Math.random() * 200);
o.reactUntil = now + 180 + Math.random() * 180;
}
else if (behCanTrigger(s, 'drift', now) && r < beh.drift) {
behTrigger(s, 'drift', now, 400 + Math.random() * 300);
predY += (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 10);
}
else if (dist > 200 && behCanTrigger(s, 'shift', now) && r < beh.shift) {
behTrigger(s, 'shift', now, 1000 + Math.random() * 1000);
o.targetY = Math.max(0, Math.min(H - pH, predCenter + (Math.random() * 80 - 40)));
targetY = o.targetY;
return;   // 本帧直接用新站位
}
else if (behCanTrigger(s, 'miss', now) && r < beh.miss) {
behTrigger(s, 'miss', now, 300);
predY += (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 15);
}
else if (s.beh.consecCatch >= 5 && behCanTrigger(s, 'risky', now) && r < beh.risky) {
behTrigger(s, 'risky', now, 800 + Math.random() * 600);
predY += (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 8);
}
} else {
if (act.type === 'drift' || act.type === 'miss' || act.type === 'risky' || act.type === 'fumble') {
}
if (act.type === 'slow') {
if (now < o.reactUntil) { targetY = o.targetY; return; }
}
}
predY += (s.approachErr || 0) + (s.approachMiss || 0);
targetY = predY - pH / 2;
}
o.targetY = Math.max(0, Math.min(H - pH, targetY));
}
function playerH(s) { return (s.params && (s.params.ppH || s.params.paddleH)) || 72; }
function movePaddle(paddle, targetY, maxSpeed, paddleH) {
const diff = targetY - paddle.y;
const step = Math.max(-maxSpeed, Math.min(maxSpeed, diff));
paddle.y += step;
paddle.vy = step;
paddle.y = Math.max(0, Math.min(H - paddleH, paddle.y));
}
function checkPaddle(s) {
const b = s.ball;
const bR = s.params.ballR, pH = s.params.paddleH, ppH = playerH(s);
const tx = PADDLE_GAP + PADDLE_W;
if (b.vx < 0 && b.x - bR <= tx && b.x - bR >= PADDLE_GAP - 4 && b.y >= s.opponent.y && b.y <= s.opponent.y + pH) {
b.x = tx + bR;
bouncePaddle(s, s.opponent, false);
}
const px = W - PADDLE_GAP - PADDLE_W;
if (b.vx > 0 && b.x + bR >= px && b.x + bR <= W - PADDLE_GAP + 4 && b.y >= s.player.y && b.y <= s.player.y + ppH) {
b.x = px - bR;
bouncePaddle(s, s.player, true);
}
}
function bouncePaddle(s, paddle, isPlayer) {
const b = s.ball;
const pH = isPlayer ? playerH(s) : s.params.paddleH;
const hit = (b.y - (paddle.y + pH / 2)) / (pH / 2);   // -1~1
s.lastHit = hit;                                       // 记录击球点用于挡板闪光颜色教学
s.rallyHits++;
const comboBonus = (s.diff === 'casual' || s.diff === 'easy') && isPlayer && s.playerRallyHits >= 3;
const newSpeed = comboBonus ? b.speed : Math.min(s.params.maxBall || MAX_SPEED, INIT_SPEED + s.rallyHits * SPEED_INC);
b.speed = newSpeed;
const ang = hit * (Math.PI / 3.2);   // 最大约 56°
b.vx = (isPlayer ? -1 : 1) * Math.cos(ang) * newSpeed;
b.vy = Math.sin(ang) * newSpeed;
s.flashPaddle = 1;
sfxPaddle();
if (soundOn && s.diff !== 'hard' && navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
if (!isPlayer) {
s.beh.consecCatch++;
const cc = s.beh.consecCatch;
const emoji = cc >= 5 ? '🤩' : cc >= 3 ? '😎' : '😊';
tryTaSay(s, SAY_POOLS.catch, emoji, 0.4, 1500);   // 接球：40% 表情 + 1.5s 冷却（防每次都冒）
} else {
s.beh.consecCatch = 0;
s.playerRallyHits++;
}
}
function tryTaSay(s, sayPool, emoji, emojiProb, cooldownMs) {
const now = performance.now();
if (cooldownMs > 0 && now < s.emojiCooldown) return;   // 表情冷却中，不触发
if (Math.random() > emojiProb) return;                  // 未命中表情概率
if (cooldownMs > 0) s.emojiCooldown = now + cooldownMs;
let text = null;
if (Math.random() < 0.3) {
text = sayPool[Math.floor(Math.random() * sayPool.length)];
}
s.taBubble = { emoji: emoji, text: text, until: now + 1200 };
}
function step(s, now) {
if (s.status === 'ended') return;
s.gameTime += 1000 / FPS;
if (s.status === 'countdown') {
if (now >= s.countdownAt) {
s.countdown--;
s.countdownAt = now + 700;
if (s.countdown <= 0) serve(s);
}
return;
}
if (s.status === 'scored') {
if (now >= s.scorePauseUntil) serve(s);
return;
}
if (s.status !== 'rally') return;
movePaddle(s.player, s.player.targetY, PLAYER_MAX_SPEED, playerH(s));
const b = s.ball;
if (b.vx < 0 && !(s.prevVx < 0)) {
s.approachErr = (Math.random() * 2 - 1) * s.params.predictErr;
s.approachMiss = Math.random() < s.params.missRate
? (20 + Math.random() * 26) * (Math.random() < 0.5 ? -1 : 1)
: 0;
} else if (b.vx > 0) {
s.approachErr = 0; s.approachMiss = 0;
}
s.prevVx = b.vx;
const danger = b.vx < 0 && (b.x - PADDLE_GAP - PADDLE_W) < 220;
const aiInterval = danger ? 50 : 110;
if (now >= s.opponent.aiNextAt) {
opponentAI(s, now);
s.opponent.aiNextAt = now + aiInterval;
}
movePaddle(s.opponent, s.opponent.targetY, s.params.maxSpeed, s.params.paddleH);
b.x += b.vx; b.y += b.vy;
const bR = s.params.ballR;
if (b.y - bR < 0) { b.y = bR; b.vy = -b.vy; s.flashWall = 1; sfxWall(); }
if (b.y + bR > H) { b.y = H - bR; b.vy = -b.vy; s.flashWall = 1; sfxWall(); }
checkPaddle(s);
if (b.x - bR > W) {
s.opponentScore++;
s.opponentStreak++; s.playerStreak = 0;
s.maxOpponentStreak = Math.max(s.maxOpponentStreak, s.opponentStreak);
s.totalRounds++;
s.beh.consecCatch = 0;
s.playerRallyHits = 0;
tryTaSay(s, SAY_POOLS.score, '😤', 0.75, 0);   // TA 得分：75% 表情，无冷却（关键事件）
onScore(s, now, 'opponent');
} else if (b.x + bR < 0) {
s.playerScore++;
s.playerStreak++; s.opponentStreak = 0;
s.maxPlayerStreak = Math.max(s.maxPlayerStreak, s.playerStreak);
s.totalRounds++;
s.beh.consecCatch = 0;
s.playerRallyHits = 0;
tryTaSay(s, SAY_POOLS.miss, '😅', 0.75, 0);   // TA 失误：75% 表情，无冷却（关键事件）
onScore(s, now, 'player');
}
if (s.flashPaddle > 0) s.flashPaddle = Math.max(0, s.flashPaddle - 0.08);
if (s.flashWall > 0) s.flashWall = Math.max(0, s.flashWall - 0.1);
if (s.flashScore > 0) s.flashScore = Math.max(0, s.flashScore - 0.05);
}
function onScore(s, now, who) {
sfxScore();
s.flashScore = 1;
if (s.playerScore >= s.params.winScore || s.opponentScore >= s.params.winScore) {
endGame(s, now);
} else {
s.status = 'scored';
s.scorePauseUntil = now + 900;
}
}
function endGame(s, now) {
s.status = 'ended';
clearSaved();   // 对局已结束，清除保存
sfxWin();
const playerWin = s.playerScore > s.opponentScore;
const draw = s.playerScore === s.opponentScore;
const sec = Math.round((s.gameTime - 0) / 1000);
const fmt = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
const statsKey = (window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':pong-stats';
let stats = { win: 0, lose: 0, draw: 0, maxStreak: 0, total: 0 };
try {
const raw = localStorage.getItem(statsKey);
if (raw) stats = Object.assign(stats, JSON.parse(raw));
if (draw) stats.draw++; else if (playerWin) stats.win++; else stats.lose++;
stats.maxStreak = Math.max(stats.maxStreak, s.maxPlayerStreak);
stats.total++;
localStorage.setItem(statsKey, JSON.stringify(stats));
} catch (e) {}
let drop = null;
try {
if (window.arcadeMarkLuckyPlayed) window.arcadeMarkLuckyPlayed('pong');
if (playerWin && window.arcadeTryDrop) drop = window.arcadeTryDrop('pong');
} catch (e) {}
const fit = window.taFit ? window.taFit : function (x) { return x; };
var coinLine = '';
try {
var COIN_CAP = 10400;
var day = (function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); })();
var ck = (window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':ml2_coin_pong_' + day;
var cur = Number(localStorage.getItem(ck)) || 0;
if (cur < COIN_CAP) {
var pongWinFen = Math.random() < 0.2 ? 5200 : 1314;
var pongMult = (window.arcadeMult && window.arcadeMult('pong')) || 1;
var real = Math.min((playerWin ? pongWinFen : 520) * pongMult, COIN_CAP - cur);
try { localStorage.setItem(ck, String(cur + real)); } catch (e2) {}
if (real > 0 && typeof window.giftWalletChange === 'function') {
if (window.giftWalletChange(real, real, '乒乓')) {
coinLine = '🪙 双方心意币各 +¥' + (real / 100).toFixed(2);
}
}
}
} catch (e) {}
const title = draw ? '平局' : (playerWin ? '🏆 你赢了' : fit('TA 赢了'));
const body =
'<div class="pong-end-score">' + fit('TA') + ' ' + s.opponentScore + ' : ' + s.playerScore + ' 你</div>' +
'<div class="pong-end-stat">总回合 ' + s.totalRounds + ' · 用时 ' + fmt(sec) + '</div>' +
'<div class="pong-end-stat">你的最高连得 ' + s.maxPlayerStreak + ' · ' + fit('TA') + ' 最高连得 ' + s.maxOpponentStreak + '</div>' +
'<div class="pong-end-stat">累计 ' + stats.win + '胜 ' + stats.lose + '负 ' + stats.draw + '平 · 历史最高连得 ' + stats.maxStreak + '</div>' +
(coinLine ? '<div class="pong-end-stat">' + coinLine + '</div>' : '') +
(drop ? '<div class="pong-end-stat">🎁 掉落限定摆件「' + drop.name + '」</div>' : '');
showOverlay(title, body, '再玩一次');
try {
if (window.chatAddSystem) {
window.chatAddSystem('Pong · 你 ' + s.playerScore + ' : ' + s.opponentScore + ' TA' + (draw ? ' · 平局' : playerWin ? ' · 你赢' : ' · TA赢'), { special: 'pong' });
}
const dp = POOLS[s.diff] || POOLS.easy;
const pool = draw ? dp.draw : (playerWin ? dp.player_win : dp.opponent_win);
const reply = pool[Math.floor(Math.random() * pool.length)];
setTimeout(() => {
try {
if (window.chatAddIn) window.chatAddIn(reply, { silent: true });
else if (window.chatSendMsg) window.chatSendMsg(reply);
} catch (e) {}
}, 700);
} catch (e) {}
}
function hitColor(hit) {
const a = Math.abs(hit);
if (a < 0.25) return '#4ade80';   // 绿
if (a < 0.5)  return '#facc15';   // 黄
if (a < 0.75) return '#fb923c';   // 橙
return '#f87171';                  // 红
}
function render(s, now) {
const pH = s.params.paddleH, bR = s.params.ballR;
ctx.save();
ctx.clearRect(0, 0, W, H);
ctx.fillStyle = '#0f1420';
ctx.fillRect(0, 0, W, H);
ctx.strokeStyle = 'rgba(255,255,255,0.18)';
ctx.lineWidth = 2;
ctx.setLineDash([6, 8]);
ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
ctx.setLineDash([]);
const flashC = s.flashPaddle > 0 ? hitColor(s.lastHit) : '#e8eefc';
ctx.fillStyle = flashC;
ctx.fillRect(PADDLE_GAP, s.opponent.y, PADDLE_W, pH);
ctx.fillStyle = flashC;
ctx.fillRect(W - PADDLE_GAP - PADDLE_W, s.player.y, PADDLE_W, playerH(s));
const b = s.ball;
ctx.fillStyle = s.flashWall > 0 ? '#ffe08a' : '#ffffff';
ctx.beginPath(); ctx.arc(b.x, b.y, bR, 0, Math.PI * 2); ctx.fill();
if ((s.diff === 'casual' || s.diff === 'easy') && now != null) {
let showArrow = false;
if (s.status === 'countdown' && s.countdown <= 1 && now > s.countdownAt - 500) showArrow = true;
if (s.status === 'scored' && now > s.scorePauseUntil - 500) showArrow = true;
if (showArrow) {
ctx.save();
ctx.fillStyle = 'rgba(255,255,255,0.85)';
ctx.font = 'bold 26px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText(s.serveDir < 0 ? '←' : '→', W / 2, H / 2);
ctx.restore();
}
}
if (s.taBubble) {
if (now != null && now < s.taBubble.until) {
const left = (s.taBubble.until - now) / 1200;
ctx.save();
ctx.globalAlpha = Math.min(1, left * 1.5);
ctx.textAlign = 'center';
const bx = PADDLE_GAP + PADDLE_W / 2;
ctx.font = '18px sans-serif';
ctx.textBaseline = 'bottom';
const by = Math.max(22, s.opponent.y - 6);
ctx.fillText(s.taBubble.emoji, bx, by);
if (s.taBubble.text) {
ctx.font = '11px sans-serif';
ctx.textBaseline = 'bottom';
ctx.fillStyle = 'rgba(255,255,255,0.9)';
ctx.fillText(s.taBubble.text, bx, by - 18);
}
ctx.restore();
} else if (now != null) {
s.taBubble = null;
}
}
ctx.restore();
}
let scoreCache = { key: '', flash: -1 };
function renderScore(s) {
if (!scoreEl) return;
const key = s.opponentScore + ':' + s.playerScore;
if (scoreCache.key !== key) {
scoreCache.key = key;
scoreEl.innerHTML = '<span class="pong-s-ta">' + s.opponentScore + ' ' + (window.taFit ? window.taFit('TA') : 'TA') + '</span><span class="pong-s-sep">:</span><span class="pong-s-you">你 ' + s.playerScore + '</span>';
}
const flash = s.flashScore > 0 ? Math.round(s.flashScore * 20) / 20 : 0;
if (scoreCache.flash !== flash) {
scoreCache.flash = flash;
scoreEl.style.cssText = flash > 0 ? 'transform:scale(' + (1 + flash * 0.3) + ')' : '';
}
}
function renderHint(s, now) {
if (!hintEl) return;
if (s.status === 'countdown') {
hintEl.textContent = s.countdown > 0 ? String(s.countdown) : '开始！';
} else if (s.status === 'scored') {
hintEl.textContent = '得分 · 重新发球…';
} else if (s.status === 'rally') {
hintEl.textContent = '';
} else {
hintEl.textContent = '';
}
}
function loop(ts) {
if (!running) return;
if (!lastTs) lastTs = ts;
const dt = Math.min(ts - lastTs, 250);
lastTs = ts;
acc += dt;
applyKeys();
const frame = 1000 / FPS;
let guard = 0;
while (acc >= frame && guard < 5) {
step(state, ts);
acc -= frame;
guard++;
}
render(state, ts);
renderScore(state);
renderHint(state, ts);
rafId = requestAnimationFrame(loop);
}
let lastFitGeo = '';
function fitCanvas() {
const dpr = window.devicePixelRatio || 1;
const box = canvas.parentElement;   // .pong-canvas-box
let geo, apply;
if (isFs) {
const availW = window.innerWidth - 16;
let availH = window.innerHeight - 200;
if (box && box.parentElement && box.parentElement.clientHeight > 0) {
let h = box.parentElement.clientHeight;
Array.prototype.forEach.call(box.parentElement.children, function (el) {
if (el === box || !el.offsetHeight) return;
h -= el.offsetHeight;
});
if (h >= 120) availH = h;
}
let cw = availW;
let ch = Math.round(cw * H / W);
if (ch > availH) { ch = availH; cw = Math.round(ch * W / H); }
geo = 'fs|' + dpr + '|' + cw + 'x' + ch;
apply = function () {
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
canvas.style.width = cw + 'px';
canvas.style.height = ch + 'px';
if (box) { box.style.width = cw + 'px'; box.style.height = ch + 'px'; }
};
} else {
const rect = canvas.getBoundingClientRect();
if (rect.width === 0) return;
const chCss = (rect.width * H / W) + 'px';
geo = 'nf|' + dpr + '|' + rect.width + 'x' + chCss;
apply = function () {
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
canvas.style.width = '';
canvas.style.height = chCss;
if (box) { box.style.width = ''; box.style.height = ''; }
};
}
if (geo === lastFitGeo) return;
lastFitGeo = geo;
apply();
}
function showOverlay(title, body, btn) {
if (!overlayEl) return;
if (overlayTitleEl) overlayTitleEl.innerHTML = title || '';
if (overlayBodyEl) overlayBodyEl.innerHTML = body || '';
if (overlayBtnEl) overlayBtnEl.textContent = btn || '开始';
overlayEl.hidden = false;
}
function hideOverlay() { if (overlayEl) overlayEl.hidden = true; }
function startGame(diff) {
state = newState(diff || 'easy');
state.status = 'countdown';
state.countdown = 3;
state.countdownAt = performance.now() + 400;
hideOverlay();
fitCanvas();
clearSaved();
paused = false;
if (pauseBtn) pauseBtn.textContent = '⏸';
running = true;
lastTs = 0; acc = 0;
if (rafId) cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(loop);
}
function stopGame() {
running = false;
if (rafId) cancelAnimationFrame(rafId);
rafId = null;
}
function saveKey() { return (window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':pong-saved'; }
let paused = false;
function canSave(s) {
return s && s.status !== 'ended' && (s.playerScore + s.opponentScore > 0 || s.status === 'rally' || s.status === 'scored');
}
function saveGame() {
try {
if (!canSave(state)) { localStorage.removeItem(saveKey()); return; }
const s = state;
const clone = JSON.parse(JSON.stringify(s));
clone.countdownAt = 0; clone.scorePauseUntil = 0;
clone.opponent.aiNextAt = 0; clone.opponent.reactUntil = 0;
clone._cdLen = null;
localStorage.setItem(saveKey(), JSON.stringify(clone));
} catch (e) {}
}
function loadSaved() {
try {
const raw = localStorage.getItem(saveKey());
if (!raw) return null;
const s = JSON.parse(raw);
if (!s || s.status === 'ended') return null;
return s;
} catch (e) { return null; }
}
function clearSaved() { try { localStorage.removeItem(saveKey()); } catch (e) {} }
function resumeGame() {
const s = loadSaved();
if (!s) return false;
s.status = 'rally';
s.countdownAt = 0; s.scorePauseUntil = 0;
s.opponent.aiNextAt = 0; s.opponent.reactUntil = 0;
s.params = DIFFS[s.diff] || DIFFS.easy;
state = s;
hideOverlay();
fitCanvas();
paused = false;
if (pauseBtn) pauseBtn.textContent = '⏸';
running = true;
lastTs = 0; acc = 0;
if (rafId) cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(loop);
return true;
}
function togglePause() {
if (!state || state.status === 'ended') return;
paused = !paused;
if (paused) {
running = false;
if (rafId) cancelAnimationFrame(rafId);
rafId = null;
if (pauseBtn) pauseBtn.textContent = '▶';
if (hintEl) hintEl.textContent = '已暂停';
} else {
running = true;
lastTs = 0; acc = 0;
if (rafId) cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(loop);
if (pauseBtn) pauseBtn.textContent = '⏸';
}
}
let isFs = false;
function toggleFs() {
isFs = !isFs;
if (panel) panel.classList.toggle('pong-fs', isFs);
if (fsBtn) fsBtn.textContent = isFs ? '⤢' : '⛶';
setTimeout(() => { if (panel && !panel.hidden) fitCanvas(); }, 60);
}
function inputY(clientY) {
if (!state || state.status === 'ended') return;
const rect = canvas.getBoundingClientRect();
const y = (clientY - rect.top) / rect.height * H;
const pH = playerH(state);
state.player.targetY = Math.max(0, Math.min(H - pH, y - pH / 2));
}
let touching = false;
canvas.addEventListener('touchstart', (e) => {
if (!running) return;
touching = true;
const t = e.touches[0];
if (t) inputY(t.clientY);
e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
if (!running || !touching) return;
const t = e.touches[0];
if (t) inputY(t.clientY);
e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', () => { touching = false; });
canvas.addEventListener('mousedown', (e) => { if (running) { touching = true; inputY(e.clientY); } });
canvas.addEventListener('mousemove', (e) => { if (running && touching) inputY(e.clientY); });
window.addEventListener('mouseup', () => { touching = false; });
const keys = {};
document.addEventListener('keydown', (e) => {
if (!running || !panel || panel.hidden) return;
const k = e.key.toLowerCase();
if (k === 'arrowup' || k === 'w' || k === 'arrowdown' || k === 's') {
keys[k] = true;
e.preventDefault();
}
});
document.addEventListener('keyup', (e) => {
const k = e.key.toLowerCase();
if (keys[k]) keys[k] = false;
});
window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => { keys[k] = false; }); });
function applyKeys() {
if (!running || !state) return;
let dy = 0;
if (keys['arrowup'] || keys['w']) dy -= PLAYER_MAX_SPEED;
if (keys['arrowdown'] || keys['s']) dy += PLAYER_MAX_SPEED;
if (dy !== 0) {
const pH = playerH(state);
state.player.targetY = Math.max(0, Math.min(H - pH, state.player.targetY + dy));
}
}
function updateWinTip() {
if (!winTipEl) return;
const d = (diffSel && diffSel.value) || 'easy';
const ws = (DIFFS[d] || DIFFS.easy).winScore;
winTipEl.textContent = '先得 ' + ws + ' 分获胜';
}
if (diffSel) {
diffSel.addEventListener('change', () => {
updateWinTip();
if (state && state.status === 'countdown') {
startGame(diffSel.value);
} else if (state && (state.status === 'rally' || state.status === 'scored') && hintEl) {
hintEl.textContent = '难度下一局生效';
}
});
}
if (soundBtn) {
soundBtn.addEventListener('click', () => {
soundOn = !soundOn;
soundBtn.textContent = soundOn ? '🔊' : '🔇';
soundBtn.classList.toggle('pong-sound-off', !soundOn);
});
}
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closePongPanel(); });
if (overlayBtnEl) overlayBtnEl.addEventListener('click', (e) => {
e.stopPropagation();
const diff = (diffSel && diffSel.value) || 'easy';
startGame(diff);
});
if (pauseBtn) pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
if (overlayBtn2El) overlayBtn2El.addEventListener('click', (e) => {
e.stopPropagation();
resumeGame();
});
window.openPongPanel = function () {
if (!panel) return;
if (partnerNameEl) {
try {
const s = window.activeStore && window.activeStore();
partnerNameEl.textContent = (s && (s.get('lbl-partner') || s.get('cs-lbl-partner'))) || (window.taWord ? window.taWord() : 'TA');
} catch (e) { partnerNameEl.textContent = window.taWord ? window.taWord() : 'TA'; }
}
if (isFs) toggleFs();   // 防上次全屏残留
panel.hidden = false;
lastFitGeo = '';   // #784 打开必重铺（原实现每次 fitCanvas 都重建位图＝顺带清台，幂等闸门后显式保留该语义）
fitCanvas();
paused = false;
if (pauseBtn) pauseBtn.textContent = '⏸';
updateWinTip();   // 按当前难度更新获胜分提示
if (canSave(state)) {
state.status = 'rally';
state.opponent.aiNextAt = 0; state.opponent.reactUntil = 0;
hideOverlay();
running = true; lastTs = 0; acc = 0;
if (rafId) cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(loop);
return;
}
const saved = loadSaved();
if (saved) {
showOverlay('双人 Pong', '<div class="pong-start-tip">有未完成的对局<br>你 ' + saved.playerScore + ' : ' + saved.opponentScore + ' TA</div><div class="pong-start-ctrl">手机：按住画面上下拖动<br>电脑：↑↓ 或 W S</div>', '重新开始');
if (overlayBtn2El) overlayBtn2El.hidden = false;
} else {
const curDiff = (diffSel && diffSel.value) || 'easy';
const ws = (DIFFS[curDiff] || DIFFS.easy).winScore;
showOverlay('双人 Pong', '<div class="pong-start-tip">你控制右侧挡板<br>先得 ' + ws + ' 分获胜</div><div class="pong-start-ctrl">手机：按住画面上下拖动<br>电脑：↑↓ 或 W S</div>', '开始');
if (overlayBtn2El) overlayBtn2El.hidden = true;
}
stopGame();
};
window.closePongPanel = function () {
if (canSave(state)) saveGame();   // 保存进行中的对局
stopGame();
if (isFs) toggleFs();
if (panel) panel.hidden = true;
};
document.addEventListener('contact-switched', () => { try { closePongPanel(); } catch (e) {} });
document.addEventListener('visibilitychange', () => {
if (document.hidden && running && state && state.status !== 'ended') { saveGame(); togglePause(); }
});
let refitSettle = 0;
function onViewportChange() {
clearTimeout(refitSettle);
refitSettle = setTimeout(function () { if (panel && !panel.hidden) fitCanvas(); }, 280);
}
window.addEventListener('resize', onViewportChange);
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("pong.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("pong.js"); try { console.error("[JS] pong.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[pong.js] " + String(__e && __e.message || __e)); } })();

;/* ==== snake-game.js ==== */
(function () { try {
(function () {
'use strict';
let GW = 15, GH = 15;
const FS_CELL = 21;                  // 全屏地图目标格子尺寸（逻辑 px）——偏小让地图更大
const INIT_LEN = 3;
const FOOD_TARGET = 2;               // 默认同屏食物数（可在头部选择器调 2/4/6/8）
function prefix() { return (window.activePrefix && window.activePrefix()) || 'xy-home-v2'; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function keyScore() { return prefix() + ':snake-score'; }
function keySaved() { return prefix() + ':snake-saved'; }
function keyBest() { return prefix() + ':snake-best'; }
function keyMode() { return prefix() + ':snake-mode'; }
function keyFoodN() { return prefix() + ':snake-foodn'; }
const DIFFS = {
easy:   { ticks: [200, 180, 160, 140] },
normal: { ticks: [150, 130, 115, 100] },
hard:   { ticks: [105, 90, 80, 70] }
};
const MODES = {
duo:  { label: '我 vs TA' },
pvp:  { label: '双人对战' },
coop: { label: '双人组队' }
};
const BEHAVIORS = {
randomTurn:    { prob: 0.08, cd: 6000 },
changeTarget:  { prob: 0.06, cd: 7000 },
contestFood:   { prob: 0.20, cd: 5000 },
giveUpContest: { prob: 0.10, cd: 5000 },
chasePlayer:   { prob: 0.05, cd: 8000 },
avoidPlayer:   { prob: 0.12, cd: 5000 },
speedUp:       { prob: 0.03, cd: 10000 },
pause:         { prob: 0.02, cd: 12000 },
detour:        { prob: 0.07, cd: 7000 }
};
let panel, canvas, ctx, scoreEl, hintEl, startBtn, restartBtn, resumeBtn, resultEl, dpadEl, diffSel, modeSel, foodSel, pauseBtn, fsBtn, wallBtn, safeBtn, bestEl;
let state = null;
let behavior = null;
let countdownTimer = null;
let rafId = null;
let lastFrameTime = 0, acc = 0;
let prevPlayerBody = null, prevOppBody = null;
let touchBase = null, lastTouchDir = null, lockAxis = null;
let audioCtx = null;
let paused = false;
let isFs = false;
let pauseAt = 0;
let cssW = 360, cssH = 360, dpr = 1;   // 画布 CSS 尺寸（全屏由 setupCanvas 按剩余空间计算）
let lastFitBox = null, refitSettle = 0;   // #774 视口抖动闸门：上次铺设照着的可用盒 / 落定定时器
let particles = [], floaters = [], renderLastTime = 0;
let touchTracks = {};
function gW() { return (state && state.gw) || GW; }
function gH() { return (state && state.gh) || GH; }
function curMode() { return (state && state.mode) || (modeSel && modeSel.value) || 'duo'; }
function nextMode() { return (modeSel && MODES[modeSel.value]) ? modeSel.value : 'duo'; }
function nextFoodN() { return foodSel ? (parseInt(foodSel.value, 10) || FOOD_TARGET) : FOOD_TARGET; }
function foodTargetN() { return (state && state.foodTarget) || FOOD_TARGET; }
function activeSnakes() {
if (!state) return [];
const a = [state.player];
if (state.p2) a.push(state.p2);
a.push(state.opp);
return a;
}
function humanSnakes() { return activeSnakes().filter(function (s) { return s.ctrl !== 'ai'; }); }
function snakeSkin(s) {
if (s === state.player) return ['#34c759', '#28a745'];
if (s.ctrl === 'p2') return ['#ff9f0a', '#e08600'];
return ['#5ac8fa', '#3a9fd6'];
}
function snakeLabel(s) {
if (s === state.player) return 'P1';
if (s.ctrl === 'p2') return 'P2';
return (window.taFit ? window.taFit('TA') : 'TA');
}
function themeDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
function vib(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} }
function $(id) { return document.getElementById(id); }
function beep(freq, dur) {
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(function () {});
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = 'square'; g.gain.value = 0.14;   // v3.15.x：0.04→0.14，边听音乐边玩时音效清晰
o.connect(g); g.connect(audioCtx.destination);
o.start();
g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
o.stop(audioCtx.currentTime + dur);
} catch (e) {}
}
const SFX = {
eat: function () { beep(880, 0.07); },
hit: function () { beep(180, 0.18); },
win: function () { beep(660, 0.12); setTimeout(function () { beep(880, 0.14); }, 130); }
};
function readScore() { const raw = lsGet(keyScore()) || lsGet('xy-home-v2:snake-score'); try { return JSON.parse(raw || '{"w":0,"l":0,"d":0}'); } catch (e) { return { w: 0, l: 0, d: 0 }; } }
function writeScore(s) { try { localStorage.setItem(keyScore(), JSON.stringify(s)); } catch (e) {} }
function renderScore() {
if (!scoreEl) return;
const s = readScore();
scoreEl.textContent = '胜 ' + s.w + ' · 负 ' + s.l + ' · 平 ' + s.d;
}
function readBest() { const raw = lsGet(keyBest()) || lsGet('xy-home-v2:snake-best'); try { return JSON.parse(raw || '{}'); } catch (e) { return {}; } }
function writeBest(b) { try { localStorage.setItem(keyBest(), JSON.stringify(b)); } catch (e) {} }
function renderBest() {
if (!bestEl) return;
const b = readBest();
const diff = (state && state.diff) || (diffSel && diffSel.value) || 'normal';
const cur = b[diff];
if (!cur) { bestEl.hidden = true; return; }
bestEl.textContent = '🏆 ' + (diff === 'easy' ? '慢' : diff === 'hard' ? '快' : '普通') + '档：最高 ' + cur.score + ' 分 · 最长 ' + cur.len;
bestEl.hidden = false;
}
function updateBest(result) {
try {
const b = readBest();
const diff = state.diff || 'normal';
const cur = b[diff] || { score: 0, len: 0 };
const ps = Math.floor(state.player.score) + (state.mode === 'coop' && state.p2 ? Math.floor(state.p2.score) : 0);
const pl = state.player.body.length;
let changed = false;
if (result === 'win' && ps > cur.score) { cur.score = ps; changed = true; }
if (pl > cur.len) { cur.len = pl; changed = true; }
if (changed) { b[diff] = cur; writeBest(b); }
} catch (e) {}
}
function toggleFlag(name) {
if (!state) return;
if (!state.flags) state.flags = { wall: false, safe: false };
state.flags[name] = !state.flags[name];
const btn = name === 'wall' ? wallBtn : safeBtn;
if (btn) btn.classList.toggle('on', state.flags[name]);
if (name === 'wall' && hintEl && state.status === 'idle') hintEl.textContent = state.flags.wall ? '穿墙已开 · 点开始' : '点开始 · 滑动控制方向';
if (name === 'safe' && hintEl && state.status === 'idle') hintEl.textContent = state.flags.safe ? '安全模式 · 点开始' : '点开始 · 滑动控制方向';
}
function scrollAvail() {
const sc = panel.querySelector('.poke-card-scroll');
let availW = (sc && sc.clientWidth) || window.innerWidth || 360;
let availH = (sc && sc.clientHeight) || window.innerHeight || 360;
if (sc && sc.clientHeight > 0) {
const st = getComputedStyle(sc);
let n = 0;   // 参与布局的兄弟块数；n 块 + 画布共 n+1 项，之间有 n 个 gap
sc.querySelectorAll('.snake-score,.snake-best,.snake-hint,.snake-result:not([hidden]),.snake-controls,.snake-dpad').forEach(function (el) {
if (el.hidden || !el.offsetHeight) return;   // display:none / hidden 的块不占空间也没有 gap
const cs = getComputedStyle(el);
availH -= el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
n++;
});
availH -= (parseFloat(st.rowGap) || 0) * n;
availH -= (parseFloat(st.paddingTop) || 0) + (parseFloat(st.paddingBottom) || 0);
availW -= (parseFloat(st.paddingLeft) || 0) + (parseFloat(st.paddingRight) || 0);
}
return { w: Math.max(120, availW), h: Math.max(90, availH) };
}
function applyCell(cell, minCell) {
const sc = panel.querySelector('.poke-card-scroll');
for (let i = 0; i < 4; i++) {
cell = Math.max(minCell, cell);
cssW = Math.round(cell * gW()); cssH = Math.round(cell * gH());
const bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
if (canvas.style.width !== cssW + 'px') canvas.style.width = cssW + 'px';
if (canvas.style.height !== cssH + 'px') canvas.style.height = cssH + 'px';
if (canvas.width !== bw) canvas.width = bw;
if (canvas.height !== bh) canvas.height = bh;
if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
if (!sc || !sc.clientHeight) break;          // 面板未布局（隐藏）时量不到，下次打开/resize 会重算
const over = sc.scrollHeight - sc.clientHeight;
if (over <= 0 || cell <= minCell) break;
cell -= over / gH();
}
if (sc && sc.clientHeight) lastFitBox = scrollAvail();   // 记下这次是照着哪个可用盒铺的
}
function fitCanvasBox() {
if (!canvas || !isFs || !ctx) return;
const av = scrollAvail();
applyCell(Math.min(av.w / gW(), av.h / gH()), 9);
}
function fitNonFsCanvas() {
GW = 15; GH = 15;                // 半框固定 15×15 基准
const av = scrollAvail();
applyCell(Math.min(360, Math.max(160, Math.min(av.w, av.h))) / 15, 6);
}
function refitNonFs() {
if (!canvas || !panel || panel.hidden || isFs) return;
fitNonFsCanvas();
if (ctx) render(0);
}
function refitAll() {
refitNonFs();                 // 非全屏：内部已 render
if (!isFs) return;
fitCanvasBox();
render(0);                    // applyCell 改位图尺寸会清空画布
}
function onViewportChange() {
clearTimeout(refitSettle);
refitSettle = setTimeout(function () {
if (!panel || panel.hidden || !canvas) return;
const av = scrollAvail();
if (lastFitBox && Math.abs(av.w - lastFitBox.w) < 2 && Math.abs(av.h - lastFitBox.h) < 2) return;
refitAll();
}, 280);
}
function setupCanvas() {
if (!canvas) return;
dpr = Math.min(window.devicePixelRatio || 1, 2);
ctx = canvas.getContext('2d');   // 幂等，供 applyCell 重设 transform
if (isFs) {
if (!state || state.status === 'idle' || state.status === 'over') {
const av0 = scrollAvail();
GW = Math.max(12, Math.min(34, Math.floor(av0.w / FS_CELL)));
GH = Math.max(12, Math.min(46, Math.floor(av0.h / FS_CELL)));
}
fitCanvasBox();
} else {
fitNonFsCanvas();
}
}
function initEls() {
panel = $('chat-snake-panel');
if (!panel) return;
canvas = $('snake-canvas');
setupCanvas();
scoreEl = $('snake-score');
hintEl = $('snake-hint');
startBtn = $('snake-start');
restartBtn = $('snake-restart');
resumeBtn = $('snake-resume');
resultEl = $('snake-result');
dpadEl = $('snake-dpad');
diffSel = $('snake-diff');
modeSel = $('snake-mode');
foodSel = $('snake-food');
pauseBtn = $('snake-pause');
fsBtn = $('snake-fs');
wallBtn = $('snake-wall');
safeBtn = $('snake-safe');
bestEl = $('snake-best');
if (startBtn) startBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(diffSel ? diffSel.value : 'normal'); });
if (restartBtn) restartBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(diffSel ? diffSel.value : 'normal'); });
if (resumeBtn) resumeBtn.addEventListener('click', function (e) { e.stopPropagation(); resumeGame(); });
if (pauseBtn) pauseBtn.addEventListener('click', function (e) { e.stopPropagation(); togglePause(); });
if (fsBtn) fsBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleFs(); });
if (wallBtn) wallBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleFlag('wall'); });
if (safeBtn) safeBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleFlag('safe'); });
if (modeSel) modeSel.addEventListener('change', function (e) {
e.stopPropagation();
try { localStorage.setItem(keyMode(), modeSel.value); } catch (er) {}
if (state && (state.status === 'idle' || state.status === 'over')) {
const keepDiff = state.diff;
state = null;
resetToIdle(keepDiff);
}
if (hintEl && state && state.status === 'idle') hintEl.textContent = modeHint();
});
if (foodSel) foodSel.addEventListener('change', function (e) {
e.stopPropagation();
try { localStorage.setItem(keyFoodN(), foodSel.value); } catch (er) {}
if (state) { state.foodTarget = parseInt(foodSel.value, 10) || FOOD_TARGET; if (state.status !== 'playing') maintainFood(); }
});
const closeBtn = $('chat-snake-close');
if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); closeSnakePanel(); });
setupInput();
document.addEventListener('contact-switched', function () { try { closeSnakePanel(); state = null; behavior = null; } catch (e) {} });
window.addEventListener('resize', function () {
if (!panel || panel.hidden) return;
onViewportChange();
});
document.addEventListener('visibilitychange', function () {
if (document.hidden && state && state.status === 'playing') { saveGame(); togglePause(); }
});
}
function modeHint() {
const m = curMode();
if (m === 'pvp') return '点开始 · P1 左半屏/方向键 · P2 右半屏/WASD';
if (m === 'coop') return '点开始 · 组队对抗 TA · P2 用 WASD/右半屏';
return '点开始 · 滑动控制方向';
}
function setupInput() {
if (!canvas) return;
const TH = 12; // 转向触发阈值(px)
function zoneOf(t) {
if (curMode() === 'duo') return 'p1';
const r = canvas.getBoundingClientRect();
return (t.clientX - r.left) < r.width / 2 ? 'p1' : 'p2';
}
canvas.addEventListener('touchstart', function (e) {
for (let i = 0; i < e.changedTouches.length; i++) {
const t = e.changedTouches[i];
touchTracks[t.identifier] = { zone: zoneOf(t), base: { x: t.clientX, y: t.clientY }, lastDir: null, lockAxis: null };
}
const t0 = e.touches[0];
touchBase = { x: t0.clientX, y: t0.clientY };
lastTouchDir = null;
lockAxis = null;
}, { passive: true });
function trackMove(tr, cx, cy) {
const dx = cx - tr.base.x, dy = cy - tr.base.y;
const adx = Math.abs(dx), ady = Math.abs(dy);
if (adx < TH && ady < TH) return;
let dir = null;
let lockAxis = tr.lockAxis;
if (lockAxis === 'h') {
if (ady >= TH && ady > adx * 1.5) { lockAxis = 'v'; dir = dy > 0 ? 'd' : 'u'; }
else if (adx >= TH) dir = dx > 0 ? 'r' : 'l';
} else if (lockAxis === 'v') {
if (adx >= TH && adx > ady * 1.5) { lockAxis = 'h'; dir = dx > 0 ? 'r' : 'l'; }
else if (ady >= TH) dir = dy > 0 ? 'd' : 'u';
} else {
lockAxis = adx > ady ? 'h' : 'v';
if (lockAxis === 'h') { if (adx >= TH) dir = dx > 0 ? 'r' : 'l'; }
else { if (ady >= TH) dir = dy > 0 ? 'd' : 'u'; }
}
tr.lockAxis = lockAxis;
if (!dir) return;
tr.base = { x: cx, y: cy };
if (dir === tr.lastDir) return;
if (dir === 'u') (tr.zone === 'p2' ? setP2Dir : setPlayerDir)(0, -1);
else if (dir === 'd') (tr.zone === 'p2' ? setP2Dir : setPlayerDir)(0, 1);
else if (dir === 'l') (tr.zone === 'p2' ? setP2Dir : setPlayerDir)(-1, 0);
else (tr.zone === 'p2' ? setP2Dir : setPlayerDir)(1, 0);
tr.lastDir = dir;
touchBase = { x: cx, y: cy };
lastTouchDir = dir;
}
canvas.addEventListener('touchmove', function (e) {
if (!e.changedTouches) return;
for (let i = 0; i < e.changedTouches.length; i++) {
const t = e.changedTouches[i];
const tr = touchTracks[t.identifier];
if (tr) trackMove(tr, t.clientX, t.clientY);
}
}, { passive: true });
function trackEnd(e) {
for (let i = 0; i < e.changedTouches.length; i++) delete touchTracks[e.changedTouches[i].identifier];
if (!e.touches || !e.touches.length) { touchBase = null; lastTouchDir = null; lockAxis = null; }
}
canvas.addEventListener('touchend', trackEnd, { passive: true });
canvas.addEventListener('touchcancel', trackEnd, { passive: true });
if (dpadEl) {
const dpPress = function (e) {
const btn = e.target.closest('[data-dir]');
if (!btn) return;
e.stopPropagation();
const d = btn.dataset.dir;
if (d === 'up') setPlayerDir(0, -1);
else if (d === 'down') setPlayerDir(0, 1);
else if (d === 'left') setPlayerDir(-1, 0);
else if (d === 'right') setPlayerDir(1, 0);
};
dpadEl.addEventListener('pointerdown', function (e) {
if (e.pointerType === 'mouse') return;   // 鼠标走 click，避免双触发
dpPress(e);
});
dpadEl.addEventListener('click', dpPress);
}
document.addEventListener('keydown', function (e) {
if (!panel || panel.hidden) return;
if (!state || state.status !== 'playing') return;
const k = e.key.toLowerCase();
const m = curMode();
let used = true;
if (k === 'arrowup' || (m === 'duo' && k === 'w')) setPlayerDir(0, -1);
else if (k === 'arrowdown' || (m === 'duo' && k === 's')) setPlayerDir(0, 1);
else if (k === 'arrowleft' || (m === 'duo' && k === 'a')) setPlayerDir(-1, 0);
else if (k === 'arrowright' || (m === 'duo' && k === 'd')) setPlayerDir(1, 0);
else if (m !== 'duo' && k === 'w') setP2Dir(0, -1);
else if (m !== 'duo' && k === 's') setP2Dir(0, 1);
else if (m !== 'duo' && k === 'a') setP2Dir(-1, 0);
else if (m !== 'duo' && k === 'd') setP2Dir(1, 0);
else used = false;
if (used) e.preventDefault();
});
}
function setSnakeDir(p, x, y) {
if (!p || !p.alive) return;
const last = p.nextDir2 || p.nextDir || p.dir;
if (x === -last.x && y === -last.y) return;      // 相对「队尾方向」禁止 180° 回头
if (last.x === x && last.y === y) return;        // 与队尾同向不重复入队
if (!p.nextDir || (p.nextDir.x === p.dir.x && p.nextDir.y === p.dir.y && !p.nextDir2)) p.nextDir = { x: x, y: y };
else if (!p.nextDir2) p.nextDir2 = { x: x, y: y };
else { p.nextDir = p.nextDir2; p.nextDir2 = { x: x, y: y }; }
vib(8);
}
function setPlayerDir(x, y) {
if (!state || state.status !== 'playing') return;
setSnakeDir(state.player, x, y);
}
function setP2Dir(x, y) {
if (!state || state.status !== 'playing') return;
if (state.opp && state.opp.ctrl === 'p2') setSnakeDir(state.opp, x, y);
else if (state.p2) setSnakeDir(state.p2, x, y);
}
function mkSnake(body, dir, ctrl) {
return { body: body, dir: dir, nextDir: { x: dir.x, y: dir.y }, nextDir2: null, alive: true, score: 0, foodCount: 0, ctrl: ctrl, eatT: 0, _prev: null };
}
function newGame(diff) {
const mode = nextMode();
const py = Math.floor(GH / 2);
const prevFlags = state && state.flags || { wall: false, safe: false };
const playerBody = [];
for (let i = 0; i < INIT_LEN; i++) playerBody.push({ x: 4 - i, y: py });
state = {
diff: diff || 'normal',
mode: mode,
gw: GW, gh: GH,
foodTarget: nextFoodN(),
player: mkSnake(playerBody, { x: 1, y: 0 }, 'p1'),
p2: null,
opp: null,
foods: [],
status: 'idle',
startTime: 0,
elapsed: 0,
flags: { wall: prevFlags.wall, safe: prevFlags.safe }
};
if (mode === 'coop') {
const oppBody = [];
for (let i = 0; i < INIT_LEN; i++) oppBody.push({ x: Math.floor(GW / 2), y: 3 - i });
state.opp = mkSnake(oppBody, { x: 0, y: 1 }, 'ai');
const p2Body = [];
for (let i = 0; i < INIT_LEN; i++) p2Body.push({ x: (GW - 5) + i, y: Math.min(GH - 2, py + 2) });
state.p2 = mkSnake(p2Body, { x: -1, y: 0 }, 'p2');
} else if (mode === 'pvp') {
const oppBody = [];
for (let i = 0; i < INIT_LEN; i++) oppBody.push({ x: (GW - 5) + i, y: Math.min(GH - 2, py + 2) });
state.opp = mkSnake(oppBody, { x: -1, y: 0 }, 'p2');
} else {
const oppBody = [];
for (let i = 0; i < INIT_LEN; i++) oppBody.push({ x: (GW - 5) + i, y: py });
state.opp = mkSnake(oppBody, { x: -1, y: 0 }, mode === 'pvp' ? 'p2' : 'ai');
}
if (wallBtn) wallBtn.classList.toggle('on', state.flags.wall);
if (safeBtn) safeBtn.classList.toggle('on', state.flags.safe);
behavior = { current: null, until: 0, stepLeft: 0, cooldowns: {}, targetFood: null, speedUp: false, speedUpUntil: 0 };
particles = []; floaters = [];
if (canvas) canvas.classList.remove('snk-die', 'snk-die-red');   // 清上一局死亡反馈
maintainFood();
}
function startGame(diff) {
if (!panel || panel.hidden) return;
stopLoop();
paused = false;
if (pauseBtn) pauseBtn.textContent = '⏸';
if (startBtn) { startBtn.hidden = true; startBtn.textContent = '开始'; }
if (restartBtn) restartBtn.hidden = true;
if (resumeBtn) resumeBtn.hidden = true;
if (resultEl) { resultEl.hidden = true; resultEl.innerHTML = ''; }
newGame(diff);
refitAll();     // 结算块/开始按钮收起后腾出的空间收归画布（不改格数）
let n = 3;
state.status = 'countdown';
const countdownStep = function () {
if (!state || state.status !== 'countdown') return;
if (n > 0) {
if (hintEl) hintEl.textContent = '准备 · ' + n;
n--;
countdownTimer = setTimeout(countdownStep, 700);
} else {
if (hintEl) hintEl.textContent = curMode() === 'duo' ? '滑动 / 方向键控制 · 别撞墙' : modeHint();
state.status = 'playing';
state.startTime = Date.now();
startFrame();
}
};
countdownStep();
}
function startFrame() {
stopFrame();
lastFrameTime = 0;
acc = 0;
snapshotPrev();
rafId = requestAnimationFrame(frame);
}
function stopFrame() {
if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}
function cloneBody(b) {
const out = [];
for (let i = 0; i < b.length; i++) out.push({ x: b[i].x, y: b[i].y });
return out;
}
function snapshotPrev() {
if (!state) return;
activeSnakes().forEach(function (s) { s._prev = cloneBody(s.body); });
prevPlayerBody = state.player._prev;
prevOppBody = state.opp._prev;
}
function frame(now) {
if (!state || state.status !== 'playing') { rafId = null; return; }
if (!lastFrameTime) lastFrameTime = now;
const dt = Math.min(now - lastFrameTime, 250);
lastFrameTime = now;
acc += dt;
const ti = currentTickInterval();
let guard = 3;
while (acc >= ti && guard > 0) {
acc -= ti;
snapshotPrev();
step();
guard--;
if (state.status !== 'playing') break;
}
if (state.status === 'playing') {
const curTi = currentTickInterval();
const alpha = Math.min(1, acc / curTi);
render(alpha);
rafId = requestAnimationFrame(frame);
} else {
rafId = null;
}
}
function currentTickInterval() {
const t = state.elapsed;
const ticks = (DIFFS[state.diff || 'normal'] || DIFFS.normal).ticks;
let base;
if (t < 30000) base = ticks[0];
else if (t < 60000) base = ticks[1];
else if (t < 90000) base = ticks[2];
else base = ticks[3];
if (behavior && behavior.speedUp) base = Math.max(60, base - 35);
return base;
}
function spawnParticles(pos, color) {
for (let i = 0; i < 8; i++) {
const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
const sp = 0.03 + Math.random() * 0.03;
particles.push({ x: pos.x + 0.5, y: pos.y + 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 380, maxLife: 380, color: color });
}
floaters.push({ x: pos.x + 0.5, y: pos.y + 0.3, text: '+10', life: 700, maxLife: 700 });
}
function step() {
if (!state || state.status !== 'playing') return;
state.elapsed = Date.now() - state.startTime;
const snakes = activeSnakes();
snakes.forEach(function (s) {
if (s.ctrl === 'ai') aiDecide(s);   // 与旧双蛇版同序：先决策后应用（决策当 tick 生效，晚一步会撞上人类蛇刚占住的格子）
applyDir(s);
});
const moves = resolveCollisions();
moves.forEach(function (m) {
const s = m.s;
if (!m.die) {
s.body.unshift(m.n);
if (m.eat) {
eatFood(m.n); s.score += 10; s.foodCount++; s.eatT = performance.now();
spawnParticles(m.n, snakeSkin(s)[0]);
if (s === state.player) { SFX.eat(); vib(12); }
else if (s.ctrl === 'p2') { SFX.eat(); }
} else s.body.pop();
} else {
s.alive = false;
if (s === state.player) { SFX.hit(); vib([20, 40, 20]); }
}
});
const ti = currentTickInterval();
moves.forEach(function (m) { if (!m.die) m.s.score += ti / 1000; });
checkEnd();
}
function applyDir(snake) {
const q = snake.nextDir;
if (q) { snake.nextDir = snake.nextDir2 || null; snake.nextDir2 = null; }
if (q && (q.x !== -snake.dir.x || q.y !== -snake.dir.y)) snake.dir = q;
}
function bodySet(body, dropTail) {
const s = {};
const end = dropTail ? body.length - 1 : body.length;
for (let i = 0; i < end; i++) s[body[i].x + ',' + body[i].y] = true;
return s;
}
function resolveCollisions() {
const snakes = activeSnakes();
const wall = state.flags && state.flags.wall;
const safe = state.flags && state.flags.safe;
const moves = snakes.map(function (s) {
const h = s.body[0];
let n = { x: h.x + s.dir.x, y: h.y + s.dir.y };
if (wall) { n.x = (n.x + gW()) % gW(); n.y = (n.y + gH()) % gH(); }
const eat = state.foods.some(function (f) { return f.x === n.x && f.y === n.y; });
return { s: s, n: n, eat: eat, die: false };
});
const selfSets = moves.map(function (m) { return bodySet(m.s.body, !m.eat); });
if (!wall) {
moves.forEach(function (m) {
if (m.n.x < 0 || m.n.x >= gW() || m.n.y < 0 || m.n.y >= gH()) m.die = true;
});
}
for (let i = 0; i < moves.length; i++) {
if (!moves[i].die && !safe && selfSets[i][moves[i].n.x + ',' + moves[i].n.y]) moves[i].die = true; // 碰自己身（安全模式跳过）
for (let j = 0; j < moves.length; j++) {
if (i === j) continue;
if (moves[i].n.x === moves[j].n.x && moves[i].n.y === moves[j].n.y) { moves[i].die = true; moves[j].die = true; } // 头对头
else if (!moves[i].die && selfSets[j][moves[i].n.x + ',' + moves[i].n.y]) moves[i].die = true; // 碰对方身
}
}
return moves;
}
function spawnFood() {
const occ = {};
activeSnakes().forEach(function (s) { s.body.forEach(function (p) { occ[p.x + ',' + p.y] = true; }); });
state.foods.forEach(function (f) { occ[f.x + ',' + f.y] = true; });
const empty = [];
for (let x = 0; x < gW(); x++) for (let y = 0; y < gH(); y++) if (!occ[x + ',' + y]) empty.push({ x: x, y: y });
if (!empty.length) return null;
return empty[Math.floor(Math.random() * empty.length)];
}
function maintainFood() {
while (state.foods.length < foodTargetN()) {
const f = spawnFood();
if (!f) break;
state.foods.push(f);
}
}
function eatFood(pos) {
for (let i = state.foods.length - 1; i >= 0; i--) {
if (state.foods[i].x === pos.x && state.foods[i].y === pos.y) { state.foods.splice(i, 1); break; }
}
maintainFood();
}
function aiDecide(o) {
if (!o.alive) return;
behaviorTick();
const head = o.body[0];
const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
const humans = humanSnakes();
const wall = state.flags && state.flags.wall;
const p1 = state.player;
const pNew = { x: p1.body[0].x + p1.dir.x, y: p1.body[0].y + p1.dir.y };
if (wall) { pNew.x = (pNew.x + gW()) % gW(); pNew.y = (pNew.y + gH()) % gH(); }
const candidates = [];
dirs.forEach(function (d) {
if (d.x === -o.dir.x && d.y === -o.dir.y) return;
let nx = head.x + d.x, ny = head.y + d.y;
if (wall) { nx = (nx + gW()) % gW(); ny = (ny + gH()) % gH(); }
else if (nx < 0 || nx >= gW() || ny < 0 || ny >= gH()) return;
const eat = state.foods.some(function (f) { return f.x === nx && f.y === ny; });
for (let i = 0; i < o.body.length - (eat ? 0 : 1); i++) if (o.body[i].x === nx && o.body[i].y === ny) return;
let blocked = false;
humans.forEach(function (h) {
const lim = h.body.length - 1;   // 人类蛇尾尖本 tick 会移走（不吃了尾也算），与旧双蛇判定一致
for (let i = 0; i < lim; i++) if (h.body[i].x === nx && h.body[i].y === ny) blocked = true;
});
if (blocked) return;
if (nx === pNew.x && ny === pNew.y) return;
candidates.push(d);
});
if (!candidates.length) { o.nextDir = { x: o.dir.x, y: o.dir.y }; return; }
const target = currentTarget();
const blocked = {};
activeSnakes().forEach(function (s) { s.body.forEach(function (p) { blocked[p.x + ',' + p.y] = true; }); });
const scored = candidates.map(function (d) { return { d: d, score: scoreDirection(d, target, head, o, blocked) }; });
scored.sort(function (a, b) { return b.score - a.score; });
let chosen;
if ((behavior.current === 'randomTurn' || behavior.current === 'detour') && scored.length >= 2) {
chosen = scored[1].d;
} else {
chosen = scored[0].d;
}
o.nextDir = chosen;
}
function scoreDirection(d, target, head, o, blocked) {
const nx = head.x + d.x, ny = head.y + d.y;
let score = 0;
if (target) {
const dist = Math.abs(nx - target.x) + Math.abs(ny - target.y);
const w = behavior.speedUp ? 4 : 2;
score += (gW() + gH() - dist) * w;
}
score += floodFillSize(nx, ny, blocked) * 0.6;
for (let i = 1; i < o.body.length; i++) {
const s = o.body[i];
const dd = Math.abs(nx - s.x) + Math.abs(ny - s.y);
if (dd <= 1) score -= 8;
}
let nearest = Infinity;
humanSnakes().forEach(function (h) {
const pd = Math.abs(nx - h.body[0].x) + Math.abs(ny - h.body[0].y);
if (pd < nearest) nearest = pd;
});
if (nearest === Infinity) return score;
if (behavior.current === 'avoidPlayer') score -= (12 - nearest) * 3;
else if (behavior.current === 'chasePlayer') score += (12 - nearest) * 2;
return score;
}
function floodFillSize(sx, sy, blocked) {
const visited = {};
const q = [[sx, sy]];
visited[sx + ',' + sy] = true;
let count = 0;
while (q.length && count < 100) {
const cur = q.shift();
count++;
const adj = [[0, -1], [0, 1], [-1, 0], [1, 0]];
for (let i = 0; i < 4; i++) {
const nx = cur[0] + adj[i][0], ny = cur[1] + adj[i][1], k = nx + ',' + ny;
if (nx < 0 || nx >= gW() || ny < 0 || ny >= gH()) continue;
if (visited[k] || blocked[k]) continue;
visited[k] = true; q.push([nx, ny]);
}
}
return count;
}
function currentTarget() {
const o = state.opp;
if (behavior.current === 'chasePlayer') return state.player.body[0];
if (behavior.current === 'pause') return null;
const foods = state.foods;
if (!foods.length) return null;
if (behavior.targetFood) {
const t = foods.find(function (f) { return f.x === behavior.targetFood.x && f.y === behavior.targetFood.y; });
if (t) return t;
}
const h = o.body[0];
let best = foods[0], bd = Infinity;
foods.forEach(function (f) { const d = Math.abs(f.x - h.x) + Math.abs(f.y - h.y); if (d < bd) { bd = d; best = f; } });
return best;
}
function behaviorTick() {
const now = state.elapsed;
if (behavior.current) {
if (behavior.stepLeft > 0) behavior.stepLeft--;
else if (behavior.until > 0 && now < behavior.until) { }
else clearBehavior();
}
if (behavior.speedUp && now >= behavior.speedUpUntil) behavior.speedUp = false;
if (!behavior.current) {
const names = Object.keys(BEHAVIORS);
for (let i = 0; i < names.length; i++) {
const name = names[i];
const cfg = BEHAVIORS[name];
if (now < (behavior.cooldowns[name] || 0)) continue;
if (!behaviorCondition(name)) continue;
if (Math.random() < cfg.prob) { triggerBehavior(name, now); break; }
}
}
}
function clearBehavior() { behavior.current = null; behavior.until = 0; behavior.stepLeft = 0; }
function behaviorCondition(name) {
const o = state.opp, p = state.player;
const oh = o.body[0], ph = p.body[0];
const pd = Math.abs(oh.x - ph.x) + Math.abs(oh.y - ph.y);
if (name === 'randomTurn' || name === 'detour') return true;
if (name === 'changeTarget') return state.foods.length >= 2;
if (name === 'contestFood') {
return state.foods.some(function (f) {
const od = Math.abs(f.x - oh.x) + Math.abs(f.y - oh.y);
const ppd = Math.abs(f.x - ph.x) + Math.abs(f.y - ph.y);
return od <= 5 && ppd <= 5;
});
}
if (name === 'giveUpContest') return behavior.targetFood != null;
if (name === 'chasePlayer') return pd <= 8;
if (name === 'avoidPlayer') return pd <= 4;
if (name === 'speedUp') return true;
if (name === 'pause') return true;
return false;
}
function triggerBehavior(name, now) {
behavior.current = name;
behavior.cooldowns[name] = now + BEHAVIORS[name].cd;
if (name === 'randomTurn') behavior.stepLeft = 1 + Math.floor(Math.random() * 3);
else if (name === 'detour') behavior.stepLeft = 2 + Math.floor(Math.random() * 4);
else if (name === 'avoidPlayer') behavior.stepLeft = 1 + Math.floor(Math.random() * 3);
else if (name === 'chasePlayer') behavior.until = now + 2000 + Math.floor(Math.random() * 2000);
else if (name === 'speedUp') { behavior.speedUp = true; behavior.speedUpUntil = now + 2000 + Math.floor(Math.random() * 1000); behavior.until = behavior.speedUpUntil; }
else if (name === 'pause') behavior.until = now + 500 + Math.floor(Math.random() * 500);
else if (name === 'changeTarget') { behavior.until = now + 8000; switchTargetFood(); }
else if (name === 'contestFood') { behavior.until = now + 6000; setContestFood(); }
else if (name === 'giveUpContest') { behavior.targetFood = null; behavior.until = now + 200; }
}
function switchTargetFood() {
const foods = state.foods;
if (foods.length < 2) return;
const h = state.opp.body[0];
let best = null, bd = Infinity;
foods.forEach(function (f) {
if (behavior.targetFood && f.x === behavior.targetFood.x && f.y === behavior.targetFood.y) return;
const d = Math.abs(f.x - h.x) + Math.abs(f.y - h.y);
if (d < bd) { bd = d; best = f; }
});
if (best) behavior.targetFood = best;
}
function setContestFood() {
const o = state.opp, p = state.player;
const oh = o.body[0], ph = p.body[0];
let best = null, bestSum = Infinity;
state.foods.forEach(function (f) {
const od = Math.abs(f.x - oh.x) + Math.abs(f.y - oh.y);
const ppd = Math.abs(f.x - ph.x) + Math.abs(f.y - ph.y);
if (od <= 5 && ppd <= 5 && od + ppd < bestSum) { bestSum = od + ppd; best = f; }
});
if (best) behavior.targetFood = best;
}
function checkEnd() {
const anyDead = activeSnakes().some(function (s) { return !s.alive; });
if (anyDead) { endGame(); return true; }
return false;
}
function endGame() {
if (!state) return;
state.status = 'over';
stopFrame();
render(0);
clearSaved();
const mode = state.mode || 'duo';
const psFinal = Math.floor(state.player.score);
const osFinal = Math.floor(state.opp.score);
const p2Final = state.p2 ? Math.floor(state.p2.score) : 0;
const teamFinal = psFinal + (mode === 'coop' ? p2Final : 0);
const myAlive = !!state.player.alive && !(state.p2 && !state.p2.alive);   // coop：队友死=我方输
const oppAlive = !!state.opp.alive;
let result;
if (!myAlive && oppAlive) result = 'lose';
else if (myAlive && !oppAlive) result = 'win';
else if (!myAlive && !oppAlive) result = 'draw';
else result = (mode === 'coop' ? teamFinal : psFinal) > osFinal ? 'win' : (mode === 'coop' ? teamFinal : psFinal) < osFinal ? 'lose' : 'draw';
if (result === 'win') SFX.win();
const d = {
result: result,
mode: mode,
pLen: state.player.body.length,
oLen: state.opp.body.length,
pFood: state.player.foodCount,
oFood: state.opp.foodCount,
pScore: mode === 'coop' ? teamFinal : psFinal,
oScore: osFinal,
p2Score: p2Final,
time: Math.floor(state.elapsed / 1000)
};
const s = readScore();
if (result === 'win') s.w++; else if (result === 'lose') s.l++; else s.d++;
writeScore(s);
try {
if (window.arcadeMarkLuckyPlayed) window.arcadeMarkLuckyPlayed('snake');
if (result === 'win' && window.arcadeTryDrop) { const dp = window.arcadeTryDrop('snake'); if (dp) d.drop = dp; }
} catch (e) {}
updateBest(result);
renderScore();
renderBest();
try {
canvas.classList.remove('snk-die', 'snk-die-red');
void canvas.offsetWidth;
canvas.classList.add('snk-die');
if (!state.player.alive) canvas.classList.add('snk-die-red');
} catch (e) {}
if (window.sendSnakeResult) window.sendSnakeResult(d);
const _endState = state;
setTimeout(function () {
if (state !== _endState || _endState.status !== 'over') return;
showResult(d);
}, 700);
}
function showResult(d) {
if (!resultEl) return;
const icon = d.result === 'win' ? '🏆' : d.result === 'lose' ? '💔' : '🤝';
const taName = window.taFit ? window.taFit('TA') : 'TA';
let resTxt, rows;
if (d.mode === 'pvp') {
resTxt = d.result === 'win' ? 'P1 赢了' : d.result === 'lose' ? 'P2 赢了' : '平局';
rows = '<div class="snake-res-row"><span>🟢 P1</span><span>长度 ' + d.pLen + ' · 食物 ' + d.pFood + ' · ' + psOf(d) + '分</span></div>' +
'<div class="snake-res-row"><span>🟠 P2</span><span>长度 ' + d.oLen + ' · 食物 ' + d.oFood + ' · ' + d.oScore + '分</span></div>';
} else if (d.mode === 'coop') {
resTxt = d.result === 'win' ? '组队获胜' : d.result === 'lose' ? taName + ' 赢了' : '平局';
rows = '<div class="snake-res-row"><span>👥 队伍 (P1+P2)</span><span>' + psOf(d) + ' 分</span></div>' +
'<div class="snake-res-row"><span>🤖 ' + taName + '</span><span>长度 ' + d.oLen + ' · 食物 ' + d.oFood + ' · ' + d.oScore + '分</span></div>';
} else {
resTxt = d.result === 'win' ? '你赢了' : d.result === 'lose' ? (window.taFit ? window.taFit('TA 赢了') : 'TA 赢了') : '平局';
rows = '<div class="snake-res-row"><span>🐍 你</span><span>长度 ' + d.pLen + ' · 食物 ' + d.pFood + ' · ' + psOf(d) + '分</span></div>' +
'<div class="snake-res-row"><span>🤖 ' + taName + '</span><span>长度 ' + d.oLen + ' · 食物 ' + d.oFood + ' · ' + d.oScore + '分</span></div>';
}
if (d.drop) rows += '<div class="snake-res-row"><span>🎁</span><span>掉落限定摆件「' + d.drop.name + '」</span></div>';
resultEl.innerHTML = '<div class="snake-res-icon">' + icon + '</div>' +
'<div class="snake-res-title">' + resTxt + '</div>' + rows +
'<div class="snake-res-time">存活 ' + d.time + ' 秒 · 已分享到聊天 ✓</div>';
resultEl.hidden = false;
resultEl.classList.remove('snake-res-pop');
void resultEl.offsetWidth;
resultEl.classList.add('snake-res-pop');
if (restartBtn) restartBtn.hidden = false;
if (hintEl) hintEl.textContent = '再来一局？';
refitAll();     // 结算块+再来一局出现后收小画布：半框让方向键一屏可见，全屏防「再来一局」被裁到屏外
}
function psOf(d) { return d.pScore; }
let gridCv = null, gridKey = '';
function drawBackground() {
const dark = themeDark();
const key = cssW + 'x' + cssH + ':' + dpr + ':' + gW() + 'x' + gH() + ':' + (dark ? 'd' : 'l');
if (!gridCv || gridKey !== key) {
gridCv = document.createElement('canvas');
gridCv.width = Math.max(1, Math.round(cssW * dpr));
gridCv.height = Math.max(1, Math.round(cssH * dpr));
const g = gridCv.getContext('2d');
g.setTransform(dpr, 0, 0, dpr, 0, 0);
const W = cssW, H = cssH;
g.fillStyle = dark ? '#1b1b22' : '#f6f6f8';
g.fillRect(0, 0, W, H);
const cw = W / gW(), ch = H / gH();
g.strokeStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
g.lineWidth = 1;
for (let i = 1; i < gW(); i++) { g.beginPath(); g.moveTo(i * cw, 0); g.lineTo(i * cw, H); g.stroke(); }
for (let j = 1; j < gH(); j++) { g.beginPath(); g.moveTo(0, j * ch); g.lineTo(W, j * ch); g.stroke(); }
gridKey = key;
}
ctx.drawImage(gridCv, 0, 0, cssW, cssH);
}
function render(alpha) {
if (!ctx || !state) return;
if (alpha == null) alpha = 0;
const W = cssW, H = cssH;
const cw = W / gW(), ch = H / gH(), cs = Math.min(cw, ch);
const now = performance.now();
const dt = renderLastTime ? Math.min(50, now - renderLastTime) : 16;
renderLastTime = now;
const dark = themeDark();
drawBackground();
const pulse = 1 + 0.12 * Math.sin(now / 220);
state.foods.forEach(function (f, fi) {
const fx = f.x * cw + cw / 2, fy = f.y * ch + ch / 2;
const r = cs * 0.32 * (1 + 0.12 * Math.sin(now / 220 + fi * 1.3));
ctx.fillStyle = '#ff6b6b';
ctx.beginPath(); ctx.arc(fx, fy + r * 0.08, r, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = 'rgba(255,255,255,0.55)';
ctx.beginPath(); ctx.arc(fx - r * 0.35, fy - r * 0.3, r * 0.22, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = '#34c759';
ctx.beginPath();
ctx.ellipse(fx + r * 0.3, fy - r * 1.05 * pulse + r * 0.4, r * 0.34, r * 0.16, -0.6, 0, Math.PI * 2);
ctx.fill();
});
activeSnakes().forEach(function (s) {
const skin = snakeSkin(s);
drawSnake(s, alpha, skin[0], skin[1]);
});
for (let i = particles.length - 1; i >= 0; i--) {
const p = particles[i];
p.life -= dt;
if (p.life <= 0) { particles.splice(i, 1); continue; }
p.x += p.vx * dt / 16; p.y += p.vy * dt / 16;
ctx.globalAlpha = p.life / p.maxLife;
ctx.fillStyle = p.color;
ctx.beginPath();
ctx.arc(p.x * cw, p.y * ch, cs * 0.12, 0, Math.PI * 2);
ctx.fill();
}
ctx.globalAlpha = 1;
for (let i = floaters.length - 1; i >= 0; i--) {
const f = floaters[i];
f.life -= dt;
if (f.life <= 0) { floaters.splice(i, 1); continue; }
f.y -= dt / 280;
ctx.globalAlpha = Math.min(1, f.life / 300);
ctx.fillStyle = dark ? '#ff8a8a' : '#ff6b6b';
ctx.font = 'bold ' + Math.floor(cs * 0.72) + 'px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText(f.text, f.x * cw, f.y * ch);
}
ctx.globalAlpha = 1;
}
function drawSnake(snake, alpha, headColor, bodyColor) {
if (!snake.body.length) return;
const cw = cssW / gW(), ch = cssH / gH(), cs = Math.min(cw, ch);
const dead = !snake.alive;
const dark = themeDark();
const bodyC = bodyColor;
const headC = headColor;
const prevBody = snake._prev || null;   // 步进前快照（snapshotPrev 统一维护）
const interp = !dead && prevBody && alpha > 0 && alpha < 1;
const pts = [];
for (let i = 0; i < snake.body.length; i++) {
const s = snake.body[i];
let x = s.x, y = s.y;
if (interp && prevBody[i] && Math.abs(s.x - prevBody[i].x) <= 1 && Math.abs(s.y - prevBody[i].y) <= 1) {
x = prevBody[i].x + (s.x - prevBody[i].x) * alpha;
y = prevBody[i].y + (s.y - prevBody[i].y) * alpha;
}
pts.push({ x: x * cw + cw / 2, y: y * ch + ch / 2 });
}
if (pts.length >= 2) {
ctx.strokeStyle = bodyC;
ctx.lineWidth = cs * 0.82;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.beginPath();
ctx.moveTo(pts[1].x, pts[1].y);
for (let i = 2; i < pts.length; i++) {
const ddx = pts[i].x - pts[i - 1].x, ddy = pts[i].y - pts[i - 1].y;
if (Math.abs(ddx) > cw * 2 || Math.abs(ddy) > ch * 2) {
ctx.stroke(); ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y);
} else ctx.lineTo(pts[i].x, pts[i].y);
}
ctx.stroke();
ctx.strokeStyle = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.22)';
ctx.lineWidth = cs * 0.26;
ctx.beginPath();
ctx.moveTo(pts[1].x, pts[1].y - cs * 0.14);
let broken = false;
for (let i = 2; i < pts.length; i++) {
const ddx = pts[i].x - pts[i - 1].x, ddy = pts[i].y - pts[i - 1].y;
if (Math.abs(ddx) > cw * 2 || Math.abs(ddy) > ch * 2) { ctx.stroke(); ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y - cs * 0.14); broken = true; continue; }
ctx.lineTo(pts[i].x, pts[i].y - cs * 0.14);
}
ctx.stroke();
}
let hr = cs * 0.46;
if (snake.eatT) {
const k = 1 - (now0() - snake.eatT) / 200;
if (k > 0) hr *= 1 + 0.28 * k; else snake.eatT = 0;
}
ctx.fillStyle = headC;
ctx.beginPath();
ctx.arc(pts[0].x, pts[0].y, hr, 0, Math.PI * 2);
ctx.fill();
if (!dead) {
ctx.fillStyle = 'rgba(255,255,255,0.45)';
ctx.beginPath();
ctx.arc(pts[0].x - cs * 0.13, pts[0].y - cs * 0.13, cs * 0.15, 0, Math.PI * 2);
ctx.fill();
const d = snake.dir;
const px = -d.y, py = d.x;   // 垂直方向
const fwx = d.x * cs * 0.14, fwy = d.y * cs * 0.14;
for (let side = -1; side <= 1; side += 2) {
const ex = pts[0].x + px * side * cs * 0.19 + fwx;
const ey = pts[0].y + py * side * cs * 0.19 + fwy;
ctx.fillStyle = '#fff';
ctx.beginPath(); ctx.arc(ex, ey, cs * 0.13, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = '#151515';
ctx.beginPath(); ctx.arc(ex + fwx * 0.5, ey + fwy * 0.5, cs * 0.065, 0, Math.PI * 2); ctx.fill();
}
} else {
ctx.strokeStyle = dark ? '#888' : '#666';
ctx.lineWidth = Math.max(1, cs * 0.06);
const e = cs * 0.12;
[[-0.18, -0.18], [0.18, -0.18]].forEach(function (off) {
const ex = pts[0].x + off[0] * cs, ey = pts[0].y + off[1] * cs;
ctx.beginPath();
ctx.moveTo(ex - e, ey - e); ctx.lineTo(ex + e, ey + e);
ctx.moveTo(ex + e, ey - e); ctx.lineTo(ex - e, ey + e);
ctx.stroke();
});
}
}
function now0() { return performance.now(); }
function togglePause() {
if (!state) return;
if (state.status === 'playing') {
state.status = 'paused';
stopFrame();
pauseAt = Date.now();
if (pauseBtn) pauseBtn.textContent = '▶';
if (hintEl) hintEl.textContent = '已暂停 · 点 ▶ 继续';
render(0); // 暂停时对齐到整格位置
} else if (state.status === 'paused') {
state.status = 'playing';
state.startTime += Date.now() - pauseAt;
if (pauseBtn) pauseBtn.textContent = '⏸';
if (hintEl) hintEl.textContent = curMode() === 'duo' ? '滑动 / 方向键控制 · 别撞墙' : modeHint();
startFrame();
}
}
function toggleFs() {
isFs = !isFs;
if (panel) {
panel.classList.toggle('snake-fs', isFs);
panel.classList.remove('snake-fs-in');
if (isFs) { void panel.offsetWidth; panel.classList.add('snake-fs-in'); }
}
if (fsBtn) fsBtn.textContent = isFs ? '⤢' : '⛶';
setupCanvas();
render(0);
}
function canSave(s) { return s && s.status === 'playing'; }
function stripPrev(s) {
const c = s;   // 浅拷贝去渲染层字段（_prev 不入存档）
const out = {};
Object.keys(c).forEach(function (k) { if (k !== '_prev') out[k] = c[k]; });
return out;
}
function saveGame() {
try {
if (!canSave(state)) { localStorage.removeItem(keySaved()); return; }
const cp = Object.assign({}, state);
cp.player = stripPrev(state.player);
cp.opp = stripPrev(state.opp);
if (state.p2) cp.p2 = stripPrev(state.p2);
localStorage.setItem(keySaved(), JSON.stringify(cp));
} catch (e) {}
}
function validCoord(p, w, h) { return p && p.x >= 0 && p.x < w && p.y >= 0 && p.y < h; }
function validSnake(s, w, h) {
return s && s.body && Array.isArray(s.body) && s.body.length && s.body.every(function (p) { return validCoord(p, w, h); }) && s.dir;
}
function validState(s) {
if (!s || !s.player || !s.opp) return false;
const w = Math.max(10, Math.min(42, s.gw || 15));
const h = Math.max(10, Math.min(48, s.gh || 15));
s.gw = w; s.gh = h;
if (!validSnake(s.player, w, h) || !validSnake(s.opp, w, h)) return false;
if (s.foods && !s.foods.every(function (p) { return validCoord(p, w, h); })) return false;
if (s.mode === 'pvp' || s.mode === 'coop') {
if (!validSnake(s.p2, w, h)) { s.mode = 'duo'; s.p2 = null; if (s.opp) s.opp.ctrl = 'ai'; }
} else { s.mode = 'duo'; s.p2 = null; }
return true;
}
function loadSaved() {
try {
const raw = lsGet(keySaved());
if (!raw) return null;
const s = JSON.parse(raw);
if (!s || s.status !== 'playing') return null;
if (!validState(s)) { clearSaved(); return null; }
return s;
} catch (e) { return null; }
}
function clearSaved() { try { localStorage.removeItem(keySaved()); } catch (e) {} }
function resumeGame() {
const s = loadSaved();
if (!s) return false;
state = s;
if (!state.flags) state.flags = { wall: false, safe: false };
if (wallBtn) wallBtn.classList.toggle('on', state.flags.wall);
if (safeBtn) safeBtn.classList.toggle('on', state.flags.safe);
if (state.mode === 'pvp' || state.mode === 'coop') { clearSaved(); resetToIdle(state.diff); if (hintEl) hintEl.textContent = '双人存档暂不跨局恢复 · 已回到待开局'; return true; }
behavior = { current: null, until: 0, stepLeft: 0, cooldowns: {}, targetFood: null, speedUp: false, speedUpUntil: 0 };
setupCanvas();   // 按存档自带地图尺寸重新适配画布（可能与当前视口推算尺寸不同）
state.status = 'playing';
state.startTime = Date.now() - state.elapsed;
if (startBtn) { startBtn.hidden = true; startBtn.textContent = '开始'; }
if (restartBtn) restartBtn.hidden = true;
if (resumeBtn) resumeBtn.hidden = true;
if (resultEl) { resultEl.hidden = true; resultEl.innerHTML = ''; }
if (hintEl) hintEl.textContent = '滑动 / 方向键控制 · 别撞墙';
paused = false;
if (pauseBtn) pauseBtn.textContent = '⏸';
render(0);
startFrame();
return true;
}
function wantFullscreenDefault() {
try {
const d = window.mochiDevice;
if (d && (d.isMobile || d.isTablet)) return true;   // 全站唯一设备判定源
} catch (e) {}
try { if (document.documentElement.classList.contains('force-mobile')) return true; } catch (e) {}
if (window.innerWidth < 900) return true;             // 兜底：device.js 未就绪/判定未出
try {
if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches) return true;
} catch (e) {}
return false;
}
function openSnakePanel() {
if (!panel) return;
['poke-card', 'emoji-panel', 'chat-ask-panel', 'chat-search', 'chat-divine-panel', 'chat-decision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-pong-panel'].forEach(function (id) { const el = $(id); if (el) el.hidden = true; });
if (window.closeAvlib) window.closeAvlib();
const mp = $('chat-more-panel'); if (mp) mp.hidden = true;
const nameEl = $('snake-partner-name');
if (nameEl) {
let pname = 'TA';
try {
const nst = window.activeStore && window.activeStore();
pname = (nst && (nst.get('lbl-partner') || nst.get('cs-lbl-partner'))) || pname;
} catch (e) {}
nameEl.textContent = pname;
}
if (modeSel) { const m = lsGet(keyMode()); if (m && MODES[m]) modeSel.value = m; }
if (foodSel) { const fn = parseInt(lsGet(keyFoodN()), 10); if (fn >= 2 && fn <= 8) foodSel.value = String(fn); }
panel.hidden = false;
renderScore();
renderBest();   // 最长纪录行要先落到 DOM：toggleFs 会按当时可见的兄弟块量画布，晚一行就把按钮顶出屏
if (wantFullscreenDefault()) { if (!isFs) toggleFs(); }
else if (isFs) toggleFs();
paused = false;
if (pauseBtn) pauseBtn.textContent = '⏸';
if (canSave(state) && validState(state)) {
state.status = 'playing';
state.startTime = Date.now() - state.elapsed;
setupCanvas();   // 恢复对局可能带自己的地图尺寸，重新适配画布
if (startBtn) { startBtn.hidden = true; startBtn.textContent = '开始'; }
if (restartBtn) restartBtn.hidden = true;
if (resumeBtn) resumeBtn.hidden = true;
if (resultEl) { resultEl.hidden = true; resultEl.innerHTML = ''; }
if (hintEl) hintEl.textContent = '滑动 / 方向键控制 · 别撞墙';
render(0);
startFrame();
return;
}
const saved = loadSaved();
if (saved) {
resetToIdle();
if (hintEl) hintEl.textContent = '有未完成的对局';
if (resumeBtn) resumeBtn.hidden = false;
if (startBtn) { startBtn.hidden = false; startBtn.textContent = '重新开始'; }
} else {
resetToIdle();
}
}
function resetToIdle(keepDiff) {
stopLoop();
if (keepDiff && diffSel) diffSel.value = keepDiff;
newGame(diffSel ? diffSel.value : 'normal');
state.status = 'idle';
if (startBtn) { startBtn.hidden = false; startBtn.textContent = '开始'; }
if (restartBtn) restartBtn.hidden = true;
if (resumeBtn) resumeBtn.hidden = true;
if (resultEl) { resultEl.hidden = true; resultEl.innerHTML = ''; }
if (hintEl) hintEl.textContent = modeHint();
refitAll();     // 最长纪录行/继续上局按钮显隐后再量一次，避免按钮被挤到屏外
render(0);
}
function stopLoop() {
if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null; }
stopFrame();
}
function closeSnakePanel() {
if (canSave(state)) saveGame(); else clearSaved();
stopLoop();
if (isFs) toggleFs();
if (panel) panel.hidden = true;
}
window.openSnakePanel = openSnakePanel;
window.closeSnakePanel = closeSnakePanel;
window.__snakeState = function () {
if (!state) return null;
return {
status: state.status, diff: state.diff, mode: state.mode, gw: state.gw, gh: state.gh,
foodTarget: state.foodTarget,
running: !!(rafId || countdownTimer),
player: { body: cloneBody(state.player.body), alive: state.player.alive, score: Math.floor(state.player.score),
dir: { x: state.player.dir.x, y: state.player.dir.y },
nextDir: state.player.nextDir ? { x: state.player.nextDir.x, y: state.player.nextDir.y } : null,
nextDir2: state.player.nextDir2 ? { x: state.player.nextDir2.x, y: state.player.nextDir2.y } : null },
p2: state.p2 ? { body: cloneBody(state.p2.body), alive: state.p2.alive, score: Math.floor(state.p2.score),
dir: { x: state.p2.dir.x, y: state.p2.dir.y },
nextDir: state.p2.nextDir ? { x: state.p2.nextDir.x, y: state.p2.nextDir.y } : null } : null,
opp: { body: cloneBody(state.opp.body), alive: state.opp.alive, score: Math.floor(state.opp.score), ctrl: state.opp.ctrl,
dir: { x: state.opp.dir.x, y: state.opp.dir.y },
nextDir: state.opp.nextDir ? { x: state.opp.nextDir.x, y: state.opp.nextDir.y } : null },
foods: state.foods.map(function (f) { return { x: f.x, y: f.y }; }),
elapsed: state.elapsed
};
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initEls);
else initEls();
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("snake-game.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("snake-game.js"); try { console.error("[JS] snake-game.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[snake-game.js] " + String(__e && __e.message || __e)); } })();

;/* ==== breakout.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-brick-panel');
if (!panel) return;
const canvas = document.getElementById('brick-canvas');
if (!canvas) return;
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('brick-score');
const comboEl = document.getElementById('brick-combo');
const livesEl = document.getElementById('brick-lives');
const levelEl = document.getElementById('brick-level');
const hintEl = document.getElementById('brick-hint');
const overlayEl = document.getElementById('brick-overlay');
const overlayTitleEl = document.getElementById('brick-overlay-title');
const overlayBodyEl = document.getElementById('brick-overlay-body');
const overlayBtnEl = document.getElementById('brick-overlay-btn');
const overlayCloseBtn = document.getElementById('brick-overlay-close');
const diffSel = document.getElementById('brick-diff');
const ballsSel = document.getElementById('brick-balls');
const soundBtn = document.getElementById('brick-sound');
const pauseBtn = document.getElementById('brick-pause');
const fsBtn = document.getElementById('brick-fs');
const closeBtn = document.getElementById('chat-brick-close');
const partnerNameEl = document.getElementById('brick-partner-name');
const footNameEl = document.getElementById('brick-foot-name');
const W = 400, H = 340;
const COLS = 8, ROWS = 4;            // 砖块 8 列 × 4 行
const B_MARGIN = 10, B_GAP = 4, B_TOP = 28, B_H = 15;
const B_W = (W - B_MARGIN * 2 - (COLS - 1) * B_GAP) / COLS;   // 44
const PADDLE_W = 62, PADDLE_H = 8;
const PADDLE_Y = H - 14;             // 挡板顶边 y
const BALL_R = 5;
const BALL_HOME_Y = (B_TOP + ROWS * (B_H + B_GAP) + PADDLE_Y) / 2;   // 发球点（砖区与挡板之间居中）
const PLAYER_HOME_X = W * 0.75, DREAM_HOME_X = W * 0.25;   // 玩家右半场 / 梦角左半场（手机端右手操作更顺手）
const clampPlayerX = (x) => clamp(x, W / 2 + PADDLE_W / 2, W - PADDLE_W / 2 - 4);
const clampDreamX = (x) => clamp(x, PADDLE_W / 2 + 4, W / 2 - PADDLE_W / 2);
const PLAYER_V = 7.2;                // 玩家挡板最大速度（px/tick）
const FPS = 60;
const DIFFS = {
easy:   { think: [250, 430], maxV: 2.35, err: 30, fumble: 0.17 },
normal: { think: [135, 240], maxV: 3.5,  err: 16, fumble: 0.08 },
hard:   { think: [80, 160],  maxV: 4.8,  err: 8,  fumble: 0.03 }
};
function targetBallCount() {
const n = parseInt(ballsSel && ballsSel.value, 10);
return n >= 1 && n <= 3 ? n : 1;
}
function ballsPrefKey() { return (window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':brick-balls'; }
function rollPerformance() {
const r = Math.random();
if (r < 0.02) {
return Math.random() < 0.5
? { kind: 'special', variant: 'hot', used: false }   // 一段「超神」10s：接近上一档的控制力
: { kind: 'special', variant: 'slip', used: false }; // 一次「大走神」：某次来球必然偏出挡板
}
if (r < 0.10) return { kind: 'good' };                   // 状态较好：更稳更准
if (r < 0.18) return { kind: 'dazed', nextLapseAt: 0 };  // 偶尔走神：周期性短暂反应停摆
return { kind: 'normal' };
}
const SAY_POOLS = {
catch: ['接到了。', '继续。', '还在。'],
nearmiss: ['差一点。', '……', '看球。'],
save: ['漂亮。', '接得好。'],
clear: ['清完了。', '不错。', '继续？'],
fail: ['没接住。', '可惜。', '再来。'],
coop: ['我们配合得不错。'],
streak: ['还挺顺的。']
};
const SAY_COOLDOWN = { catch: 22000, nearmiss: 15000, save: 26000, clear: 12000, fail: 14000, coop: 0, streak: 0 };
let audioCtx = null, soundOn = true;
function beep(freq, dur, vol) {
if (!soundOn) return;
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(function () {});
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = 'square';
g.gain.value = vol || 0.15;   // v3.15.x：默认 0.05→0.15，用户反馈边听音乐边玩时音效听不清
o.connect(g); g.connect(audioCtx.destination);
const t = audioCtx.currentTime;
o.start(t); g.gain.setValueAtTime(g.gain.value, t);
g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.06));
o.stop(t + (dur || 0.06));
} catch (e) {}
}
function sfxWall()   { beep(360, 0.04, 0.14); }
function sfxPaddle() { beep(500, 0.05, 0.18); }
function sfxBrick(hp){ beep(hp > 0 ? 300 : 640 + Math.random() * 120, hp > 0 ? 0.05 : 0.09, 0.18); }
function sfxLose()   { beep(200, 0.22, 0.2); setTimeout(() => beep(150, 0.26, 0.2), 130); }
function sfxClear()  { beep(620, 0.1, 0.2); setTimeout(() => beep(830, 0.14, 0.2), 110); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const tri = (sigma) => (Math.random() + Math.random() - 1) * sigma;
function foldX(x) {
const lo = BALL_R, span = W - BALL_R * 2;
let m = ((x - lo) % (2 * span) + 2 * span) % (2 * span);
return m > span ? (2 * span - m) + lo : m + lo;
}
const taName = () => (window.taWord ? window.taWord() : 'TA');
const T = (x) => (window.taFit ? window.taFit(x) : x);
const ROW_COLORS = [['#ffb3c6', '#ff5f7a'], ['#cbb2ff', '#9d6bff'], ['#96c7ff', '#4a86e8'], ['#79e6cd', '#2fbf9d']];
const STARS = [];
for (let si = 0; si < 26; si++) STARS.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.1 + 0.5, p: Math.random() * Math.PI * 2, s: 0.0008 + Math.random() * 0.0016 });
function rrPath(c, x, y, w, h, r) {
c.beginPath();
c.moveTo(x + r, y);
c.arcTo(x + w, y, x + w, y + h, r);
c.arcTo(x + w, y + h, x, y + h, r);
c.arcTo(x, y + h, x, y, r);
c.arcTo(x, y, x + w, y, r);
c.closePath();
}
function buildBricks(level) {
const sturdyRatio = Math.min(0.10 + 0.07 * (level - 1), 0.45);
const arr = [];
const skip = {};   // 排列变化：挖掉少量格子改变阵形
if (level % 3 === 1 && level >= 4) { skip['0_0'] = 1; skip['0_7'] = 1; }              // 切上角
else if (level % 3 === 2 && level >= 5) { skip['3_0'] = 1; skip['3_7'] = 1; }         // 切下角
for (let r = 0; r < ROWS; r++) {
for (let c = 0; c < COLS; c++) {
if (skip[r + '_' + c]) continue;
let sturdy = Math.random() < sturdyRatio;
if (level % 3 === 2 && (r + c) % 2 === 0 && r < 2) sturdy = true;
if (level % 3 === 0 && c >= 3 && c <= 4 && r < 2) sturdy = Math.random() < sturdyRatio + 0.18;
arr.push({ x: B_MARGIN + c * (B_W + B_GAP), y: B_TOP + r * (B_H + B_GAP), w: B_W, h: B_H, hp: sturdy ? 2 : 1, maxHp: sturdy ? 2 : 1, row: r });
}
}
return arr;
}
const levelSpeed = (lv) => Math.min(3.0 + 0.32 * (lv - 1), 5.0);
let state = null;
let running = false, paused = false;
let rafId = null, lastTs = 0, acc = 0;
function newBallObj() { return { x: W / 2, y: BALL_HOME_Y, vx: 0, vy: 0, trail: [] }; }
function newState(diffKey) {
const d = DIFFS[diffKey] || DIFFS.easy;
const st = {
diff: diffKey, params: d,
perf: rollPerformance(),
ball: null,
balls: [],                 // 场上所有球；恒有 s.ball === s.balls[0]（调试口/用例依赖）
respawns: [],              // 掉球补发队列（时间戳，按球数上限补足）
player: { x: PLAYER_HOME_X, targetX: PLAYER_HOME_X },
dream: { x: DREAM_HOME_X, targetX: DREAM_HOME_X, nextThinkAt: 0 },
bricks: buildBricks(1),
status: 'serve',           // serve | rally | clearing | over
serveAt: 0,
score: 0, combo: 0, maxCombo: 0, bricksCleared: 0, level: 1, lives: 3,
prevVy: 0,
aiBall: null,              // 梦角当前锁定的目标球（多球时选最快落地的）
prevAiVy: 0,               // 目标球上一帧 vy（判定「转为下落」）
dreamErr: 0,               // 锁定式误差：每次球向下飞只掷一次，整段保持
fumbleOffset: null,        // 放水：本次下落故意偏离（非 null 即武装）
slipArmed: false,          // 特殊发挥·slip 的必失球
hotUntil: 0,               // 特殊发挥·hot 生效期
rallyHits: 0,              // 双方连续接球数（合作默契反馈用）
floaters: [],              // {x,y,text,until}
taBubble: null,            // {text,until}
parts: [],                 // 砖块碎裂粒子
comboPopUntil: 0, comboPopVal: 0,   // COMBO 中央弹跳动画
playerFlashAt: 0, dreamFlashAt: 0,  // 挡板命中白闪时刻
cardLast: {},              // 各类泡泡上次触发时间戳
cardGlobalAt: 0,
lastBrickAt: 0,            // 上次碰到砖的时间（防僵局看门狗用，newState 后由 startGame 补齐）
endReplied: false
};
st.ball = newBallObj();
st.balls.push(st.ball);
return st;
}
function spawnX(i, n) { return clamp(W / 2 + (i - (n - 1) / 2) * 34, BALL_R + 2, W - BALL_R - 2); }
function launchBall(s, bl, i, n, now) {
const sp = levelSpeed(s.level);
let deg;
if (n <= 1) deg = rand(-38, 38);
else {
const t = n === 2 ? (i === 0 ? -1 : 1) : (i - 1);   // 3球：-1/0/1 → 左中右
deg = t * rand(24, 36);
}
let sa = Math.sin(deg * Math.PI / 180);
const MIN_SX = 0.22;
if (Math.abs(sa) < MIN_SX) sa = (Math.random() < 0.5 ? -MIN_SX : MIN_SX);   // 与挡板反弹同款防纯垂直
bl.x = spawnX(i, n); bl.y = BALL_HOME_Y;
bl.vx = sa * sp;
bl.vy = -Math.sqrt(Math.max(0, 1 - sa * sa)) * sp;
bl.trail.length = 0;   // 新球清空旧尾迹
}
function serve(s, now) {
const n = targetBallCount();
s.balls.length = 1;   // 只保留主球对象，保证 s.ball === s.balls[0] 恒成立
launchBall(s, s.ball, 0, n, now);
for (let i = 1; i < n; i++) { const nb = newBallObj(); launchBall(s, nb, i, n, now); s.balls.push(nb); }
s.prevVy = s.ball.vy;
s.status = 'rally';
s.lastBrickAt = now;   // 看门狗重新计时（每次发球=新的无进度窗口）
s.dreamErr = 0; s.fumbleOffset = null; s.slipArmed = false;
s.respawns.length = 0;
}
function predictLandingX(b) {
if (b.vy <= 0.05) return null;
const planeY = PADDLE_Y - BALL_R;
const t = (planeY - b.y) / b.vy;
if (t < 0 || t > 600) return null;
return foldX(b.x + b.vx * t);
}
function maybeTriggerSpecial(s, now) {
const pf = s.perf;
if (!pf || pf.kind !== 'special' || pf.used) return;
if (pf.variant === 'hot') { pf.used = true; s.hotUntil = now + 10000; }
}
function aiTargetBall(s) {
let best = null, bestT = Infinity;
for (const b of s.balls) {
const pred = predictLandingX(b);
if (pred == null) continue;
const t = (PADDLE_Y - BALL_R - b.y) / b.vy;
if (t < 0) continue;
const w = (b === s.aiBall) ? t * 0.78 : t;
if (w < bestT) { bestT = w; best = b; }
}
return best;
}
function planDescent(s, now) {
const tb = aiTargetBall(s);
if (!tb) { s.aiBall = null; s.prevAiVy = 0; return; }
if (tb !== s.aiBall || (tb.vy > 0 && s.prevAiVy <= 0)) {
const pf = s.perf;
const p = effectiveParams(s, now);
s.dreamErr = tri(p.err);
s.fumbleOffset = null;
maybeTriggerSpecial(s, now);
if (pf.kind === 'special' && pf.variant === 'slip' && !pf.used && Math.random() < 0.6) {
pf.used = true;
s.slipArmed = true;
s.fumbleOffset = (PADDLE_W * (0.9 + Math.random() * 0.35)) * (Math.random() < 0.5 ? -1 : 1);
} else if (Math.random() < p.fumble) {
s.fumbleOffset = (PADDLE_W * (0.72 + Math.random() * 0.33)) * (Math.random() < 0.5 ? -1 : 1);
}
if (pf.kind === 'dazed') {
if (!pf.nextLapseAt) pf.nextLapseAt = now + rand(7000, 13000);
if (now >= pf.nextLapseAt) {
pf.nextLapseAt = now + rand(9000, 16000);
s.lapseUntil = now + rand(450, 850);
}
}
}
s.aiBall = tb;
s.prevAiVy = tb.vy;
}
function effectiveParams(s, now) {
const base = s.params;
const pf = s.perf;
let errMul = 1, vMul = 1, fumbleMul = 1;
if (pf) {
if (pf.kind === 'good') { errMul = 0.55; vMul = 1.12; fumbleMul = 0.45; }
else if (pf.kind === 'dazed') { errMul = 1.25; vMul = 0.92; fumbleMul = 1.35; }
else if (pf.kind === 'special' && pf.variant === 'hot' && now < s.hotUntil) { errMul = 0.3; vMul = 1.3; fumbleMul = 0; }
}
return {
think: base.think, err: base.err * errMul,
maxV: base.maxV * vMul, fumble: base.fumble * fumbleMul
};
}
function dreamAI(s, now) {
const d = s.dream;
const p = effectiveParams(s, now);
const pred = s.aiBall ? predictLandingX(s.aiBall) : null;
const comingDown = !!(s.aiBall && s.aiBall.vy > 0 && pred != null);
if (comingDown) {
let target = pred + s.dreamErr + (s.fumbleOffset || 0);
if (pred > W * 0.58) target = W / 2 - PADDLE_W / 2 - 6;
d.targetX = clampDreamX(target);
} else {
d.targetX = DREAM_HOME_X + Math.sin(now / 2600) * 12;
}
let v = p.maxV;
const dist = Math.abs(d.targetX - d.x);
if (dist > 140) v *= 1.18;
if (s.lapseUntil && now < s.lapseUntil) v *= 0.22;
const step = clamp(d.targetX - d.x, -v, v);
d.x = clampDreamX(d.x + step);
}
function trySay(s, type, prob, now) {
if (Math.random() > prob) return;
if (now - s.cardGlobalAt < 9000) return;
const cd = SAY_COOLDOWN[type] || 0;
if (cd && now - (s.cardLast[type] || 0) < cd) return;
s.cardGlobalAt = now;
s.cardLast[type] = now;
s.taBubble = { text: pick(SAY_POOLS[type]), until: now + 1500 };
}
function bouncePaddle(s, px, isPlayer, now, b) {
const hit = clamp((b.x - px) / (PADDLE_W / 2 + BALL_R), -1, 1);
const sp = levelSpeed(s.level);
const ang = hit * (Math.PI / 3);   // 最大 60°
let sa = Math.sin(ang);
const MIN_SX = 0.22;
if (Math.abs(sa) < MIN_SX) sa = (Math.random() < 0.5 ? -MIN_SX : MIN_SX);   // 近垂直时随机给水平方向
b.vx = sa * sp;
b.vy = -Math.sqrt(Math.max(0, 1 - sa * sa)) * sp;   // 保速归一
b.y = PADDLE_Y - BALL_R - 0.5;
s.prevVy = b.vy;
s.dreamErr = 0; s.fumbleOffset = null; s.slipArmed = false;   // 新一段行程
if (isPlayer) s.playerFlashAt = now; else s.dreamFlashAt = now;   // 命中白闪
s.rallyHits++;
sfxPaddle();
if (isPlayer) {
const danger = (PADDLE_Y - b.y) < 26;
if (hit > 0 && danger && Math.abs(hit) > 0.72) trySay(s, 'save', 0.35, now);
} else {
if (Math.abs(hit) > 0.78) trySay(s, 'nearmiss', 0.3, now);
else trySay(s, 'catch', 0.10, now);
if (s.rallyHits >= 10) trySay(s, 'coop', 0.06, now);
}
}
function brickCollide(s, b) {
for (let i = 0; i < s.bricks.length; i++) {
const k = s.bricks[i];
if (k.hp <= 0) continue;
const cx = clamp(b.x, k.x, k.x + k.w);
const cy = clamp(b.y, k.y, k.y + k.h);
const dx = b.x - cx, dy = b.y - cy;
if (dx * dx + dy * dy > BALL_R * BALL_R) continue;
const overlapX = BALL_R - Math.abs(dx), overlapY = BALL_R - Math.abs(dy);
if (dx === 0 && dy === 0) { b.vy = -b.vy; }
else if (overlapY <= overlapX) { b.vy = dy < 0 ? -Math.abs(b.vy) : Math.abs(b.vy); b.y = dy < 0 ? k.y - BALL_R : cy + BALL_R; }
else { b.vx = dx < 0 ? -Math.abs(b.vx) : Math.abs(b.vx); b.x = dx < 0 ? k.x - BALL_R : cx + BALL_R; }
s.lastBrickAt = performance.now();
k.hp--;
if (k.hp <= 0) {
const nowB = performance.now();
const pts = k.maxHp >= 2 ? 20 : 10;
s.score += pts;
s.combo++;
s.bricksCleared++;
if (s.combo > s.maxCombo) s.maxCombo = s.combo;
if (s.combo >= 2) { s.comboPopUntil = nowB + 750; s.comboPopVal = s.combo; }
const rc = ROW_COLORS[(k.row || 0) % 4];
for (let pi = 0; pi < 7; pi++) {
s.parts.push({ x: k.x + k.w / 2, y: k.y + k.h / 2, vx: rand(-2.4, 2.4), vy: rand(-3.2, -0.4), born: nowB, life: rand(380, 640), sz: rand(2, 4.4), c: Math.random() < 0.5 ? rc[0] : rc[1] });
}
s.floaters.push({ x: k.x + k.w / 2, y: k.y + B_H / 2, text: '+' + pts, until: nowB + 750 });
if (s.combo >= 9) trySay(s, 'streak', 0.08, nowB);
}
sfxBrick(k.hp);
return;   // 每 tick 只处理一块，避免穿角双扣
}
}
function step(s, now) {
if (s.status === 'over') return;
if (s.status === 'serve') {
if (now >= s.serveAt) serve(s, now);
return;
}
if (s.status === 'clearing') {
if (now >= s.serveAt) {
s.level++;
s.bricks = buildBricks(s.level);
for (const bl of s.balls) { bl.vx = 0; bl.vy = 0; }
s.status = 'serve'; s.serveAt = now + 900;
hintEl.textContent = '第 ' + s.level + ' 层';
}
return;
}
if (s.status !== 'rally') return;
let pv = 0;
if (keys.left) pv -= PLAYER_V;
if (keys.right) pv += PLAYER_V;
if (pv !== 0) s.player.targetX = clampPlayerX(s.player.targetX + pv);
const pdx = clamp(s.player.targetX - s.player.x, -PLAYER_V, PLAYER_V);
s.player.x = clampPlayerX(s.player.x + pdx);
planDescent(s, now);
let urgent = false;
for (const bl of s.balls) { if (bl.vy > 0 && bl.y > H * 0.55) { urgent = true; break; } }
if (now >= s.dream.nextThinkAt) {
dreamAI(s, now);
const p = effectiveParams(s, now);
const th = urgent ? p.think[0] : rand(p.think[0], p.think[1]);
s.dream.nextThinkAt = now + th;
} else {
dreamAI(s, now);   // 目标不变也要继续朝目标移动（限速在 dreamAI 内）
}
for (let ri = s.respawns.length - 1; ri >= 0; ri--) {
if (now < s.respawns[ri]) continue;
s.respawns.splice(ri, 1);
if (s.status === 'rally' && s.lives > 0 && s.balls.length < targetBallCount()) {
const nb = newBallObj();
launchBall(s, nb, s.balls.length, targetBallCount(), now);
s.balls.push(nb);
}
}
for (let bi = s.balls.length - 1; bi >= 0; bi--) {
const b = s.balls[bi];
b.x += b.vx; b.y += b.vy;
if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx = Math.abs(b.vx); sfxWall(); }
if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); sfxWall(); }
if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy = Math.abs(b.vy); sfxWall(); }
brickCollide(s, b);
if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y - BALL_R <= PADDLE_Y + PADDLE_H + 6) {
if (Math.abs(b.x - s.player.x) <= PADDLE_W / 2 + BALL_R && b.x > W / 2 - PADDLE_W) bouncePaddle(s, s.player.x, true, now, b);
else if (Math.abs(b.x - s.dream.x) <= PADDLE_W / 2 + BALL_R && b.x <= W / 2 + PADDLE_W) bouncePaddle(s, s.dream.x, false, now, b);
}
if (now - (s.lastBrickAt || 0) > 12000) {
s.lastBrickAt = now;
const sp2 = Math.hypot(b.vx, b.vy) || levelSpeed(s.level);
const na = Math.atan2(b.vy, b.vx) + (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 20) * Math.PI / 180;
b.vx = Math.cos(na) * sp2; b.vy = Math.sin(na) * sp2;
if (Math.abs(b.vy) < 0.3 * sp2) {   // 防转成近水平贴地/贴顶滑行
b.vy = (b.vy >= 0 ? 1 : -1) * 0.3 * sp2;
b.vx = (b.vx >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, sp2 * sp2 - b.vy * b.vy));
}
}
if (b.y - BALL_R > H) loseLife(s, b, now);
if (s.status !== 'rally') break;
}
s.prevVy = s.ball.vy;
if (s.status === 'rally' && !s.bricks.some(k => k.hp > 0)) {
s.status = 'clearing';
s.serveAt = now + 1300;
hintEl.textContent = '';
sfxClear();
trySay(s, 'clear', 0.4, now);
}
}
function loseLife(s, b, now) {
const hadMulti = s.balls.length > 1;
const idx = s.balls.indexOf(b);
if (idx >= 0 && hadMulti) {
if (idx === 0) {
const o = s.balls[1];
s.ball.x = o.x; s.ball.y = o.y; s.ball.vx = o.vx; s.ball.vy = o.vy; s.ball.trail = o.trail;
s.balls.splice(1, 1);
} else {
s.balls.splice(idx, 1);
}
}
if (s.aiBall && s.balls.indexOf(s.aiBall) < 0) { s.aiBall = null; s.prevAiVy = 0; }
s.lives--;
s.combo = 0;
s.rallyHits = 0;
sfxLose();
s.shakeUntil = now + 300; s.shakeMag = 5;   // 丢命震屏（render 内 300ms 线性衰减随机位移）
if (b.x <= W / 2) trySay(s, 'nearmiss', 0.22, now);
if (s.lives <= 0) {
endGame(s, now);
return;
}
hintEl.textContent = T('差一点！还剩 ') + s.lives + T(' 次');
trySay(s, 'fail', 0.3, now);
if (!hadMulti) {
s.ball.vx = 0; s.ball.vy = 0;
s.status = 'serve';
s.serveAt = now + 1000;
} else {
const deficit = targetBallCount() - s.balls.length;
for (let i = 0; i < deficit; i++) s.respawns.push(now + 1100 + i * 700);
}
}
function bestKey() { return (window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':brick-best'; }
function loadBest() { try { return Number(localStorage.getItem(bestKey())) || 0; } catch (e) { return 0; } }
function endGame(s, now) {
s.status = 'over';
stopLoop();
clearSavedBrick();   // 对局已结束，清跨刷新存档
let best = loadBest();
const isBest = s.score > best;
if (isBest) { best = s.score; try { localStorage.setItem(bestKey(), String(best)); } catch (e) {} }
const doneLv = s.level - 1;
const stars = (doneLv >= 4 || s.score >= 600) ? 3 : (doneLv >= 2 || s.score >= 250) ? 2 : 1;
const rateTxt = ['热身一下', '配合不错', '默契满分'][stars - 1];
var coinLineBrick = '';
try {
var COIN_CAP = 15600;
var day = (function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); })();
var ck = (window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':ml2_coin_brick_' + day;
var cur = Number(localStorage.getItem(ck)) || 0;
if (cur < COIN_CAP) {
var brickMult = (window.arcadeMult && window.arcadeMult('brick')) || 1;
var real = Math.min([520, 1314, 5200][stars - 1] * brickMult, COIN_CAP - cur);
try { localStorage.setItem(ck, String(cur + real)); } catch (e2) {}
if (real > 0 && typeof window.giftWalletChange === 'function') {
if (window.giftWalletChange(real, real, '双人打砖块')) {
coinLineBrick = '🪙 双方心意币各 +¥' + (real / 100).toFixed(2);
}
}
}
} catch (e) {}
var brickDrop = null;
try {
if (window.arcadeMarkLuckyPlayed) window.arcadeMarkLuckyPlayed('brick');
if (stars >= 2 && window.arcadeTryDrop) brickDrop = window.arcadeTryDrop('brick');
var bsk = (window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':brick-stats';
var bsRaw = localStorage.getItem(bsk);
var bs = { plays: 0, layers: 0 };
if (bsRaw) { try { bs = Object.assign(bs, JSON.parse(bsRaw)); } catch (e5) {} }
bs.plays++; bs.layers += Math.max(0, doneLv);
localStorage.setItem(bsk, JSON.stringify(bs));
} catch (e) {}
const body =
'<div class="pong-end-score">' + s.score + ' 分</div>' +
'<div class="brick-rate">' + '❤️'.repeat(stars) + '<span>' + '🤍'.repeat(3 - stars) + '</span> · ' + rateTxt + '</div>' +
'<div class="pong-end-stat">最高连击 ×' + s.maxCombo + ' · 清除砖块 ' + s.bricksCleared + ' 块</div>' +
'<div class="pong-end-stat">完成层数 ' + doneLv + ' · 历史最佳 ' + best + ' 分' + (isBest ? ' 🎉新纪录' : '') + '</div>' +
(coinLineBrick ? '<div class="pong-end-stat">' + coinLineBrick + '</div>' : '') +
(brickDrop ? '<div class="pong-end-stat">🎁 掉落限定摆件「' + brickDrop.name + '」</div>' : '');
showOverlay(T('游戏结束'), body, '再来一局');
if (overlayCloseBtn) { overlayCloseBtn.hidden = false; overlayCloseBtn.textContent = '返回小游戏'; }
try {
if (window.chatAddSystem) {
window.chatAddSystem(T('双人打砖块 · ') + s.score + ' 分 · 最高连击 ×' + s.maxCombo + ' · 完成第 ' + (s.level - 1) + ' 层', { special: 'brick' });
}
if (!s.endReplied) {
s.endReplied = true;
setTimeout(() => {
try { if (window.chatAddIn) window.chatAddIn(pick(['还玩吗？', '再来一局？']), { silent: true }); } catch (e) {}
}, 800);
}
} catch (e) {}
}
let _bgGrad = null, _rowGrads = null;
function render(s, now) {
ctx.save();
ctx.clearRect(0, 0, W, H);
if (now < (s.shakeUntil || 0)) {
const _sk = (s.shakeUntil - now) / 300 * (s.shakeMag || 5);
ctx.translate((Math.random() * 2 - 1) * _sk, (Math.random() * 2 - 1) * _sk);
}
if (!_bgGrad) {
_bgGrad = ctx.createLinearGradient(0, 0, 0, H);
_bgGrad.addColorStop(0, '#0c1120');
_bgGrad.addColorStop(0.55, '#101625');
_bgGrad.addColorStop(1, '#161e34');
}
ctx.fillStyle = _bgGrad;
ctx.fillRect(-9, -9, W + 18, H + 18);
ctx.fillStyle = '#cfe0ff';
for (const st of STARS) {
ctx.globalAlpha = 0.2 + 0.16 * Math.sin(now * st.s + st.p);
ctx.fillRect(st.x, st.y, st.r, st.r);
}
ctx.globalAlpha = 1;
if (s.status === 'rally') {
let worst = null, worstY = -1;
for (const bl of s.balls) {
if (bl.vy <= 0 || bl.y <= H * 0.6) continue;
const predX = predictLandingX(bl);
if (predX != null && predX > W * 0.58 && bl.y > worstY) { worstY = bl.y; worst = bl; }
}
if (worst) {
const inten = Math.min(1, (worst.y / H - 0.6) / 0.4);
const dg = ctx.createLinearGradient(0, H - 36, 0, H);
dg.addColorStop(0, 'rgba(255,95,122,0)');
dg.addColorStop(1, 'rgba(255,95,122,' + (0.08 + 0.26 * inten).toFixed(3) + ')');
ctx.fillStyle = dg;
ctx.fillRect(0, H - 36, W, 36);
}
}
ctx.strokeStyle = 'rgba(255,255,255,0.10)';
ctx.lineWidth = 2;
ctx.setLineDash([5, 9]);
ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
ctx.setLineDash([]);
if (!_rowGrads) {
_rowGrads = ROW_COLORS.map((cc, ri) => {
const y0 = B_TOP + ri * (B_H + B_GAP);
const g = ctx.createLinearGradient(0, y0, 0, y0 + B_H);
g.addColorStop(0, cc[0]); g.addColorStop(1, cc[1]);
return g;
});
}
for (const k of s.bricks) {
if (k.hp <= 0) continue;
const sturdy = k.maxHp >= 2;
ctx.fillStyle = _rowGrads[(k.row || 0) % 4];
rrPath(ctx, k.x, k.y, k.w, k.h, 3);
ctx.fill();
if (sturdy) {
ctx.strokeStyle = 'rgba(255,255,255,.45)';
ctx.lineWidth = 1.3;
rrPath(ctx, k.x + 0.8, k.y + 0.8, k.w - 1.6, k.h - 1.6, 2.4);
ctx.stroke();
if (k.hp === 1) {   // 裂纹
ctx.strokeStyle = 'rgba(40,20,10,.5)';
ctx.lineWidth = 1.2;
ctx.beginPath();
ctx.moveTo(k.x + k.w * 0.3, k.y + 2); ctx.lineTo(k.x + k.w * 0.5, k.y + k.h * 0.55); ctx.lineTo(k.x + k.w * 0.62, k.y + k.h - 2);
ctx.stroke();
}
}
}
for (const pt of s.parts) {
const ag = 1 - (now - pt.born) / pt.life;
if (ag <= 0) continue;
ctx.globalAlpha = Math.min(1, ag * 1.5);
ctx.fillStyle = pt.c;
ctx.fillRect(pt.x - pt.sz / 2, pt.y - pt.sz / 2, pt.sz, pt.sz);
}
ctx.globalAlpha = 1;
for (const bl of s.balls) {
for (let ti = 0; ti < bl.trail.length; ti++) {
const tp = bl.trail[ti], f = (ti + 1) / bl.trail.length;
ctx.globalAlpha = f * 0.25;
ctx.fillStyle = '#ffd9e2';
ctx.beginPath(); ctx.arc(tp.x, tp.y, BALL_R * (0.35 + 0.65 * f), 0, Math.PI * 2); ctx.fill();
}
}
ctx.globalAlpha = 1;
ctx.fillStyle = '#6ea8ff';
rrPath(ctx, s.player.x - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 4); ctx.fill();
if (now - (s.playerFlashAt || 0) < 160) {
ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - (now - s.playerFlashAt) / 160)).toFixed(3) + ')';
rrPath(ctx, s.player.x - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 4); ctx.fill();
}
ctx.fillStyle = '#ffb27d';
rrPath(ctx, s.dream.x - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 4); ctx.fill();
if (now - (s.dreamFlashAt || 0) < 160) {
ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - (now - s.dreamFlashAt) / 160)).toFixed(3) + ')';
rrPath(ctx, s.dream.x - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 4); ctx.fill();
}
if ((s.rallyHits || 0) < 6 && s.status !== 'over') {
ctx.font = '10px sans-serif';
ctx.textAlign = 'center';
ctx.fillStyle = 'rgba(110,168,255,0.85)';
ctx.fillText('你', s.player.x, PADDLE_Y - 5);
ctx.fillStyle = 'rgba(255,178,125,0.85)';
ctx.fillText(taName(), s.dream.x, PADDLE_Y - 5);
}
if (s.status !== 'serve') {
for (const bl of s.balls) {
ctx.fillStyle = 'rgba(255,255,255,0.22)';
ctx.beginPath(); ctx.arc(bl.x, bl.y, BALL_R + 3, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = '#ffffff';
ctx.beginPath(); ctx.arc(bl.x, bl.y, BALL_R, 0, Math.PI * 2); ctx.fill();
}
} else {
const nServe = targetBallCount();
const pu = 0.5 + 0.5 * Math.sin(now / 170);
ctx.strokeStyle = 'rgba(110,168,255,' + (0.35 + 0.45 * pu).toFixed(3) + ')';
ctx.lineWidth = 2;
for (let i = 0; i < nServe; i++) {
const hx = spawnX(i, nServe), hy = BALL_HOME_Y;
ctx.fillStyle = '#ffffff';
ctx.beginPath(); ctx.arc(hx, hy, BALL_R, 0, Math.PI * 2); ctx.fill();
ctx.beginPath(); ctx.arc(hx, hy, BALL_R + 6 + 3 * pu, 0, Math.PI * 2); ctx.stroke();
ctx.beginPath();
ctx.moveTo(hx - 7, hy - 15); ctx.lineTo(hx, hy - 22); ctx.lineTo(hx + 7, hy - 15);
ctx.stroke();
}
}
for (const f of s.floaters) {
const left = (f.until - now) / 750;
if (left <= 0) continue;
ctx.globalAlpha = Math.min(1, left * 1.6);
ctx.fillStyle = '#ffe08a';
ctx.font = 'bold 13px sans-serif';
ctx.textAlign = 'center';
ctx.fillText(f.text, f.x, f.y - (1 - left) * 18);
ctx.globalAlpha = 1;
}
s.floaters = s.floaters.filter(f => f.until > now);
if (now < s.comboPopUntil && s.comboPopVal >= 2) {
const prog = 1 - (s.comboPopUntil - now) / 750;
const sc = prog < 0.25 ? 0.7 + (prog / 0.25) * 0.55 : 1.25 - (prog - 0.25) * 0.33;
const heat = Math.min(1, (s.comboPopVal - 2) / 8);
ctx.save();
ctx.translate(W / 2, H * 0.44);
ctx.scale(sc, sc);
ctx.globalAlpha = prog > 0.72 ? Math.max(0, (1 - prog) * 3.6) : 1;
ctx.font = 'bold 21px sans-serif';
ctx.textAlign = 'center';
ctx.fillStyle = 'rgb(255,' + Math.round(224 - heat * 150) + ',' + Math.round(138 - heat * 122) + ')';
ctx.fillText('COMBO ×' + s.comboPopVal, 0, 0);
ctx.restore();
}
if (s.status === 'clearing') {
const pr = 1 - Math.max(0, s.serveAt - now) / 1300;
const sc2 = 0.8 + Math.min(1, pr * 3) * 0.32;
ctx.save();
ctx.translate(W / 2, H * 0.46);
ctx.scale(sc2, sc2);
ctx.globalAlpha = Math.min(1, pr * 6) * (pr > 0.78 ? Math.max(0, (1 - pr) * 4.5) : 1);
ctx.font = 'bold 23px sans-serif';
ctx.textAlign = 'center';
ctx.fillStyle = '#ffe08a';
ctx.fillText(T('这一层完成！'), 0, 0);
ctx.restore();
}
if (s.taBubble) {
if (now < s.taBubble.until) {
const left = (s.taBubble.until - now) / 1500;
ctx.save();
ctx.globalAlpha = Math.min(1, left * 1.6);
ctx.font = '12px sans-serif';
const text = s.taBubble.text;
const tw = ctx.measureText(text).width;
const bw = tw + 18, bh = 20;
const bx = clamp(s.dream.x, bw / 2 + 8, W - bw / 2 - 8);
const by = PADDLE_Y - 24;   // 气泡底边
ctx.fillStyle = 'rgba(255,255,255,0.94)';
rrPath(ctx, bx - bw / 2, by - bh, bw, bh, 9);
ctx.fill();
const tailX = clamp(s.dream.x, bx - bw / 2 + 9, bx + bw / 2 - 9);
ctx.beginPath();
ctx.moveTo(tailX - 4, by - 1); ctx.lineTo(tailX + 4, by - 1); ctx.lineTo(clamp(s.dream.x, tailX - 6, tailX + 6), by + 5);
ctx.closePath(); ctx.fill();
ctx.fillStyle = '#3a3f4d';
ctx.textAlign = 'center';
ctx.fillText(text, bx, by - 6);
ctx.restore();
} else s.taBubble = null;
}
ctx.restore();
}
function renderInfo(s) {
if (!scoreEl) return;
if (scoreEl.dataset.h !== String(s.score)) { scoreEl.textContent = s.score; scoreEl.dataset.h = String(s.score); }
if (comboEl) {
const ct = s.combo >= 2 ? '×' + s.combo : '';
if (comboEl.dataset.h !== ct) { comboEl.textContent = ct; comboEl.dataset.h = ct; }
}
if (livesEl) {
const full = '❤'.repeat(Math.max(0, s.lives));
const lost = '<span class="brick-hlost">' + '❤'.repeat(Math.max(0, 3 - s.lives)) + '</span>';
if (livesEl.dataset.h !== full + (3 - s.lives)) { livesEl.innerHTML = full + lost; livesEl.dataset.h = full + (3 - s.lives); }
}
if (levelEl) {
const lt = String(s.level);
if (levelEl.dataset.h !== lt) { levelEl.textContent = s.level; levelEl.dataset.h = lt; }
}
}
function loop(ts) {
if (!running) return;
if (!lastTs) lastTs = ts;
const dt = ts - lastTs;
lastTs = ts;
if (!paused) {
acc += dt;
const frame = 1000 / FPS;
let guard = 0;
while (acc >= frame && guard < 5) { step(state, ts); acc -= frame; guard++; }
const fxDt = Math.min(50, dt) / 16.7;
const nowFx = performance.now();
if (state.status === 'rally') {
for (const bl of state.balls) {
bl.trail.push({ x: bl.x, y: bl.y });
if (bl.trail.length > 9) bl.trail.shift();
}
}
for (let i = state.parts.length - 1; i >= 0; i--) {
const pt = state.parts[i];
pt.vy += 0.16 * fxDt;
pt.x += pt.vx * fxDt;
pt.y += pt.vy * fxDt;
if (nowFx - pt.born > pt.life) state.parts.splice(i, 1);
}
}
render(state, ts);
renderInfo(state);
if (!paused && state.status === 'rally' && hintEl.textContent) hintEl.textContent = '';
rafId = requestAnimationFrame(loop);
}
function stopLoop() {
running = false;
if (rafId) cancelAnimationFrame(rafId);
rafId = null;
}
let lastFitGeo = '';
function fitCanvas() {
const dpr = window.devicePixelRatio || 1;
const box = canvas.parentElement;
let geo, apply;
if (isFs) {
let used = 26;
['.poke-card-head', '.brick-info', '.pong-foot'].forEach(sel => {
const el = panel.querySelector(sel);
if (el && el.offsetHeight) used += el.offsetHeight;
});
const cs = getComputedStyle(panel);
const availW = window.innerWidth - 20 - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
const availH = Math.max(160, window.innerHeight - used - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) - 14);
let cw, ch;
if (window.innerHeight >= window.innerWidth) {
ch = availH; cw = Math.round(ch * W / H);
if (cw > availW) { cw = availW; ch = Math.round(cw * H / W); }
} else {
cw = availW; ch = Math.round(cw * H / W);
if (ch > availH) { ch = availH; cw = Math.round(ch * W / H); }
}
geo = 'fs|' + dpr + '|' + cw + 'x' + ch;
apply = function () {
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
canvas.style.width = cw + 'px';
canvas.style.height = ch + 'px';
if (box) { box.style.width = cw + 'px'; box.style.height = ch + 'px'; }
};
} else {
const rect = canvas.getBoundingClientRect();
if (rect.width === 0) return;
geo = 'nf|' + dpr + '|' + rect.width;
apply = function () {
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
canvas.style.width = '';
canvas.style.height = '';
if (box) { box.style.width = ''; box.style.height = ''; }
};
}
if (geo === lastFitGeo) return;
lastFitGeo = geo;
apply();
}
function showOverlay(title, body, btn) {
if (!overlayEl) return;
if (overlayTitleEl) overlayTitleEl.innerHTML = title || '';
if (overlayBodyEl) overlayBodyEl.innerHTML = body || '';
if (overlayBtnEl) overlayBtnEl.textContent = btn || '开始';
overlayEl.hidden = false;
}
function hideOverlay() { if (overlayEl) overlayEl.hidden = true; }
function startGame() {
state = newState((diffSel && diffSel.value) || 'easy');
hideOverlay();
if (overlayCloseBtn) overlayCloseBtn.hidden = true;
fitCanvas();
paused = false;
if (pauseBtn) pauseBtn.textContent = '⏸';
if (hintEl) hintEl.textContent = '';
state.status = 'serve';
state.serveAt = performance.now() + 900;
running = true; lastTs = 0; acc = 0;
if (rafId) cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(loop);
}
function togglePause() {
if (!state || state.status === 'over' || state.status === 'serve') return;
paused = !paused;
if (paused) {
stopLoop();
if (pauseBtn) pauseBtn.textContent = '▶';
if (hintEl) hintEl.textContent = '已暂停';
} else {
running = true; lastTs = 0; acc = 0;
if (rafId) cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(loop);
if (pauseBtn) pauseBtn.textContent = '⏸';
if (hintEl) hintEl.textContent = '';
}
}
let isFs = false;        // 视觉全屏态（真全屏或 CSS 兜底，控制 brick-fs 类与画布适配）
let _nativeFs = false;   // 当前处于元素级原生全屏
function fsApiAvailable() {
const el = document.documentElement;
return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
}
function isNativeFs() {
return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
function requestNativeFs() {
try {
const el = panel;
if (el.requestFullscreen) return el.requestFullscreen({ navigationUI: 'hide' });
if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
} catch (e) {}
return null;
}
function exitNativeFs() {
try {
if (document.exitFullscreen) document.exitFullscreen();
else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
} catch (e) {}
}
let _savedAppFs = null;
function snapshotAppFs() {
try {
const el = document.getElementById('sf-fullscreen');
_savedAppFs = {
checked: el ? el.checked : null,
fsKey: localStorage.getItem((window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':fullscreen-enabled'),
fbKey: localStorage.getItem((window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':fullscreen-fallback')
};
} catch (e) { _savedAppFs = null; }
}
function restoreAppFs() {
if (!_savedAppFs) return;
const snap = _savedAppFs; _savedAppFs = null;
setTimeout(() => {
try {
const pre = window.activePrefix && window.activePrefix() || 'xy-home-v2';
if (snap.fsKey === null) localStorage.removeItem(pre + ':fullscreen-enabled');
else localStorage.setItem(pre + ':fullscreen-enabled', snap.fsKey);
if (snap.fbKey === null) localStorage.removeItem(pre + ':fullscreen-fallback');
else localStorage.setItem(pre + ':fullscreen-fallback', snap.fbKey);
const el = document.getElementById('sf-fullscreen');
if (el && !isNativeFs()) {
const target = snap.checked === true || String(snap.fsKey) === '1';
if (el.checked !== target) el.checked = target;   // 触发其 MutationObserver 回写一致状态
}
} catch (e) {}
}, 1100);   // 避开 fullscreen.js handleFsExit 的 700ms 延迟决策
}
function exitFsVisual() {
isFs = false;
panel.classList.remove('brick-fs');
if (fsBtn) fsBtn.textContent = '⛶';
setTimeout(() => { if (panel && !panel.hidden) fitCanvas(); }, 60);
}
function toggleFs() {
if (isNativeFs()) { exitNativeFs(); return; }   // 真全屏中 → 退出（fullscreenchange 里收尾）
if (isFs) { exitFsVisual(); return; }           // CSS 兜底全屏中再点 = 退出兜底
isFs = true;
panel.classList.add('brick-fs');
if (fsBtn) fsBtn.textContent = '⤢';
if (fsApiAvailable()) {
snapshotAppFs();
const p = requestNativeFs();
if (p && p.then) {
p.then(() => {
_nativeFs = true;
try { if (screen.orientation && screen.orientation.lock) { const lp = screen.orientation.lock('portrait'); if (lp && lp.catch) lp.catch(() => {}); } } catch (e) {}
}, () => {});
}
}
setTimeout(() => { if (panel && !panel.hidden) fitCanvas(); }, 80);
}
['fullscreenchange', 'webkitfullscreenchange'].forEach(evName => {
document.addEventListener(evName, () => {
if (_nativeFs && !isNativeFs()) {
_nativeFs = false;
restoreAppFs();
if (!panel.hidden) exitFsVisual();
else { isFs = false; panel.classList.remove('brick-fs'); if (fsBtn) fsBtn.textContent = '⛶'; }
}
});
});
function inputX(clientX) {
if (!state || state.status === 'over') return;
const rect = canvas.getBoundingClientRect();
const x = (clientX - rect.left) / rect.width * W;
state.player.targetX = clampPlayerX(x);
}
let touching = false;
canvas.addEventListener('touchstart', (e) => {
if (!running || paused) return;
touching = true;
const t = e.touches[0];
if (t) inputX(t.clientX);
e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
if (!running || paused || !touching) return;
const t = e.touches[0];
if (t) inputX(t.clientX);
e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', () => { touching = false; });
canvas.addEventListener('mousedown', (e) => { if (running && !paused) { touching = true; inputX(e.clientX); } });
canvas.addEventListener('mousemove', (e) => { if (running && !paused && touching) inputX(e.clientX); });
window.addEventListener('mouseup', () => { touching = false; });
const keys = { left: false, right: false };
function keyToDir(k) {
if (k === 'a' || k === 'arrowleft') return 'left';
if (k === 'd' || k === 'arrowright') return 'right';
return null;
}
document.addEventListener('keydown', (e) => {
if (!running || paused || !panel || panel.hidden) return;
const dir = keyToDir(e.key.toLowerCase());
if (dir) { keys[dir] = true; e.preventDefault(); }
});
document.addEventListener('keyup', (e) => {
const dir = keyToDir(e.key.toLowerCase());
if (dir) keys[dir] = false;
});
window.addEventListener('blur', () => { keys.left = false; keys.right = false; });
if (diffSel) diffSel.addEventListener('change', () => {
if (state && state.status !== 'over') state.params = DIFFS[diffSel.value] || DIFFS.easy;
});
if (ballsSel) ballsSel.addEventListener('change', () => {
const target = targetBallCount();
try { localStorage.setItem(ballsPrefKey(), String(target)); } catch (e) {}
if (state && state.status === 'rally' && state.lives > 0) {
while (state.balls.length > target) {
const extra = state.balls.pop();
if (state.aiBall === extra) { state.aiBall = null; state.prevAiVy = 0; }
}
while (state.balls.length < target) {
const nb = newBallObj();
launchBall(state, nb, state.balls.length, target, performance.now());
state.balls.push(nb);
}
}
});
if (soundBtn) soundBtn.addEventListener('click', (e) => {
e.stopPropagation();
soundOn = !soundOn;
soundBtn.textContent = soundOn ? '🔊' : '🔇';
soundBtn.style.opacity = soundOn ? '' : '.5';
});
let resumeFn = null;
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeBrickPanel(); });
if (overlayBtnEl) overlayBtnEl.addEventListener('click', (e) => {
e.stopPropagation();
if (resumeFn) { const f = resumeFn; resumeFn = null; f(); }
else startGame();
});
function armResume(fn) { resumeFn = fn; }
if (overlayCloseBtn) overlayCloseBtn.addEventListener('click', (e) => {
e.stopPropagation();
if (resumeFn) { resumeFn = null; startGame(); }
else closeBrickPanel();
});
if (pauseBtn) pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
document.addEventListener('visibilitychange', () => {
if (document.visibilityState === 'hidden') {
if (running && !paused && state && state.status !== 'over') {
if (state.status === 'rally') { saveGame(); togglePause(); }
else saveGame();
}
return;
}
if (state && !paused && running && (state.status === 'serve' || state.status === 'clearing')) {
state.serveAt = performance.now() + 900;
}
});
function savedKey() { return (window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':brick-saved'; }
function canPersist(s) { return !!(s && s.status !== 'over' && s.lives > 0 && (s.bricksCleared + s.score > 0)); }
function saveGame() {
try {
if (!canPersist(state)) { localStorage.removeItem(savedKey()); return; }
const c = JSON.parse(JSON.stringify(state));
c.floaters = []; c.parts = []; c.taBubble = null;   // 纯视觉瞬时字段不入档
c.balls.forEach((b) => { b.trail = []; });
localStorage.setItem(savedKey(), JSON.stringify(c));
} catch (e) {}
}
function loadSavedBrick() {
try {
const raw = localStorage.getItem(savedKey());
if (!raw) return null;
const s = JSON.parse(raw);
if (!s || !s.params || !s.player || !s.dream || s.status === 'over' || !(s.lives > 0)) { clearSavedBrick(); return null; }
return s;
} catch (e) { return null; }
}
function clearSavedBrick() { try { localStorage.removeItem(savedKey()); } catch (e) {} }
window.__brickDebug = {
get state() { return state; },
get running() { return running; },
get paused() { return paused; },
get W() { return W; },
get H() { return H; }
};
window.openBrickPanel = function () {
if (!panel) return;
let name = taName();
try {
const st = window.activeStore && window.activeStore();
name = (st && (st.get('lbl-partner') || st.get('cs-lbl-partner'))) || name;
} catch (e) {}
if (partnerNameEl) partnerNameEl.textContent = name;
if (footNameEl) footNameEl.textContent = name;
if (isFs) toggleFs();
panel.hidden = false;
lastFitGeo = '';   // #784 打开必重铺（原实现每次 fitCanvas 都重建位图＝顺带清台，幂等闸门后显式保留该语义）
fitCanvas();
stopLoop();
paused = false;
if (pauseBtn) pauseBtn.textContent = '⏸';
if (state && state.status !== 'over' && state.lives > 0 && state.bricksCleared + state.score > 0) {
showOverlay(T('双人打砖块'), '<div class="pong-start-tip">进行中 · ' + state.score + ' 分 · 第 ' + state.level + ' 层</div>', '继续');
armResume(function () {
hideOverlay();
if (state.status === 'serve' || state.status === 'clearing') state.serveAt = performance.now() + 900;
paused = false;
running = true; lastTs = 0; acc = 0;
if (rafId) cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(loop);
if (pauseBtn) pauseBtn.textContent = '⏸';
});
if (overlayCloseBtn) { overlayCloseBtn.hidden = false; overlayCloseBtn.textContent = '新开局'; }
return;
}
if (!state || state.status === 'over') {
const sv = loadSavedBrick();
if (sv) {
state = sv;
showOverlay(T('双人打砖块'), '<div class="pong-start-tip">有未完成的对局 · ' + state.score + ' 分 · 第 ' + state.level + ' 层</div>', '继续');
armResume(function () {
hideOverlay();
if (state.status === 'serve' || state.status === 'clearing') state.serveAt = performance.now() + 900;
else if (state.status === 'rally') state.lastBrickAt = performance.now();   // 看门狗重新计时
paused = false;
running = true; lastTs = 0; acc = 0;
if (rafId) cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(loop);
if (pauseBtn) pauseBtn.textContent = '⏸';
});
if (overlayCloseBtn) { overlayCloseBtn.hidden = false; overlayCloseBtn.textContent = '新开局'; }
return;
}
}
const best = loadBest();
armResume(null);
try {
const savedBalls = Number(localStorage.getItem(ballsPrefKey()));
if (savedBalls >= 1 && savedBalls <= 3 && ballsSel) ballsSel.value = String(savedBalls);
} catch (e) {}
const bn = targetBallCount();
showOverlay(T('双人打砖块'),
'<div class="pong-start-tip">你和' + T('TA') + '各守半场共接' + (bn > 1 ? bn + ' 颗球' : '同一颗球') + '<br>清光砖块进入下一层 · 共 3 次失误机会</div>' +
'<div class="pong-start-ctrl">按住画面左右拖动</div>' +
(best > 0 ? '<div class="pong-end-stat">历史最佳 ' + best + ' 分</div>' : ''),
'开始');
if (overlayCloseBtn) overlayCloseBtn.hidden = true;
};
window.closeBrickPanel = function () {
if (canPersist(state)) saveGame();   // FIX 2026-09-16：跨刷新存档（原关面板只停循环不落盘）
stopLoop();
if (isNativeFs()) { exitNativeFs(); }        // 真全屏 → 退出（fullscreenchange 收尾视觉）
else if (isFs) { exitFsVisual(); }
if (panel) panel.hidden = true;
};
document.addEventListener('contact-switched', () => { try { closeBrickPanel(); } catch (e) {} });
let refitSettle = 0;
function onViewportChange() {
clearTimeout(refitSettle);
refitSettle = setTimeout(function () { if (panel && !panel.hidden) fitCanvas(); }, 280);
}
window.addEventListener('resize', onViewportChange);
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("breakout.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("breakout.js"); try { console.error("[JS] breakout.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[breakout.js] " + String(__e && __e.message || __e)); } })();

;/* ==== connect-four.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-c4-panel');
if (!panel) return;
const boardEl = document.getElementById('c4-board');
const stageEl = document.getElementById('c4-stage');
const statusEl = document.getElementById('c4-status');
const overlayEl = document.getElementById('c4-overlay');
const ovTitleEl = document.getElementById('c4-ov-title');
const ovBodyEl = document.getElementById('c4-ov-body');
const startBtn = document.getElementById('c4-btn-start');
const endBtn = document.getElementById('c4-btn-end');
const soundBtn = document.getElementById('c4-sound');
const closeBtn = document.getElementById('c4-close');
const fsBtn = document.getElementById('c4-fs');
let isFs = false;
function toggleFs() {
isFs = !isFs;
panel.classList.toggle('game-fs', isFs);
if (fsBtn) fsBtn.textContent = isFs ? '⤢' : '⛶';
setTimeout(() => { try { if (typeof fitBoard === 'function') fitBoard(); } catch (e) {} }, 60);
}
if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
const partnerNameEl = document.getElementById('c4-partner-name');
const sideNameEl = document.getElementById('c4-side-name');
const COLS = 7, ROWS = 6;
const THINK_MIN = 550, THINK_VAR = 600;
const DIFFS = {
casual: {
label: '休闲', tip: 'TA 让着你，轻松玩',
w: { normal: 0.35, serious: 0.05, sandbag: 0.35, blunder: 0.25 },
take: { serious: 0.7, normal: 0.4, sandbag: 0.2, blunder: 0.25 },
block: { serious: 0.6, normal: 0.4, sandbag: 0.15, blunder: 0.12 },
floor: 4
},
daily: {
label: '日常', tip: 'TA 像普通人，时好时坏',
w: { normal: 0.5, serious: 0.2, sandbag: 0.15, blunder: 0.15 },
take: { serious: 0.95, normal: 0.6, sandbag: 0.25, blunder: 0.3 },
block: { serious: 0.9, normal: 0.62, sandbag: 0.22, blunder: 0.18 },
floor: 3
},
serious: {
label: '认真', tip: 'TA 想赢，有挑战',
w: { normal: 0.35, serious: 0.55, sandbag: 0.05, blunder: 0.05 },
take: { serious: 0.98, normal: 0.8, sandbag: 0.4, blunder: 0.5 },
block: { serious: 0.96, normal: 0.82, sandbag: 0.4, blunder: 0.45 },
floor: 2
}
};
const DIFF_ORDER = ['casual', 'daily', 'serious'];
let selDiff = 'daily';
const T = window.taFit || function (x) { return x; };
function prefix() { return (window.activePrefix && window.activePrefix()) || 'xy-home-v2'; }
let audioCtx = null, soundOn = true;
function beep(freq, dur, vol) {
if (!soundOn) return;
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const play = () => {
try {
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = 'sine';
g.gain.value = vol || 0.16;
o.connect(g); g.connect(audioCtx.destination);
const t = audioCtx.currentTime;
g.gain.setValueAtTime(g.gain.value, t);
g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
o.start(t); o.stop(t + dur);
} catch (e) {}
};
if (audioCtx.state === 'running') { play(); return; }
const r = audioCtx.resume();
if (r && r.then) r.then(play).catch(() => play());
else play();
} catch (e) {}
}
const sfxDropYou = () => beep(340, 0.09, 0.18);
const sfxDropTa = () => beep(262, 0.09, 0.18);
const sfxFull = () => beep(180, 0.06, 0.12);
const sfxWin = () => { beep(660, 0.14, 0.2); setTimeout(() => beep(880, 0.2, 0.2), 130); };
const sfxLose = () => { beep(300, 0.14, 0.18); setTimeout(() => beep(220, 0.2, 0.18), 130); };
const sfxDraw = () => beep(440, 0.12, 0.16);
let st = null;
let thinkT = null;
let cellPx = 44;
const THINK_LINES = ['TA正在想……', 'TA盯着棋盘看了一会儿', 'TA托着下巴琢磨'];
function newState() {
return {
grid: [],                 // grid[r][c]：0 空 / 1 玩家 / 2 TA（r=0 顶行）
turn: 1,
over: false,
started: false,
lock: false,
moves: 0,
winCells: null,
mode: 'normal',           // TA 本回合行为状态（每回合重抽）
lastTaCol: null,
missedBlocks: 0           // 玩家威胁被无视的连续次数（底线计数）
};
}
function newGrid() {
const g = [];
for (let r = 0; r < ROWS; r++) { g.push([0, 0, 0, 0, 0, 0, 0]); }
return g;
}
function statsKey() { return prefix() + ':c4-stats'; }
function loadStats() {
const d = { w: 0, l: 0, d: 0, nextFirst: 'you', lastDiff: 'daily' };
try {
const raw = localStorage.getItem(statsKey());
if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object') return Object.assign(d, v); }
} catch (e) {}
return d;
}
function saveStats(s) { try { localStorage.setItem(statsKey(), JSON.stringify(s)); } catch (e) {} }
function statsLine() {
const s = loadStats();
return '累计战绩 你 ' + s.w + '胜 · ' + T('TA') + ' ' + s.l + '胜 · ' + s.d + '平';
}
function dropRow(grid, c) {
if (c < 0 || c >= COLS || grid[0][c] !== 0) return -1;
for (let r = ROWS - 1; r >= 0; r--) { if (grid[r][c] === 0) return r; }
return -1;
}
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
function winLineAt(grid, r, c, side) {
for (let d = 0; d < DIRS.length; d++) {
const dr = DIRS[d][0], dc = DIRS[d][1];
const cells = [[r, c]];
for (let s = -1; s <= 1; s += 2) {
let rr = r + dr * s, cc = c + dc * s;
while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] === side) {
cells.push([rr, cc]);
rr += dr * s; cc += dc * s;
}
}
if (cells.length >= 4) return cells;
}
return null;
}
function isFull(grid) {
for (let c = 0; c < COLS; c++) { if (grid[0][c] === 0) return false; }
return true;
}
function legalCols(grid) {
const out = [];
for (let c = 0; c < COLS; c++) { if (grid[0][c] === 0) out.push(c); }
return out;
}
function winningCols(grid, side) {
const out = [];
for (let c = 0; c < COLS; c++) {
const r = dropRow(grid, c);
if (r < 0) continue;
grid[r][c] = side;
if (winLineAt(grid, r, c, side)) out.push(c);
grid[r][c] = 0;
}
return out;
}
function pickTaCol(mode) {
const grid = st.grid;
const legal = legalCols(grid);
if (!legal.length) return -1;
const randOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
const myWins = winningCols(grid, 2);
const pThreats = winningCols(grid, 1);
let col = null;
const take = DIFFS[selDiff].take, blk = DIFFS[selDiff].block;
if (mode === 'serious') {
if (myWins.length && Math.random() < take.serious) col = randOf(myWins);
else if (pThreats.length && Math.random() < blk.serious) col = randOf(pThreats);
} else if (mode === 'normal') {
if (myWins.length && Math.random() < take.normal) col = randOf(myWins);
else if (pThreats.length && Math.random() < blk.normal) col = randOf(pThreats);
} else if (mode === 'sandbag') {
let pool = legal.slice();
if (myWins.length && Math.random() < 0.8) pool = pool.filter((c) => myWins.indexOf(c) < 0);
if (pThreats.length && Math.random() < 0.75) pool = pool.filter((c) => pThreats.indexOf(c) < 0);
col = pool.length ? randOf(pool) : null;
} else { // blunder：人式失误，纯随机忽略局势；偶尔连着往相近列下
if (st.lastTaCol != null && Math.random() < 0.35) {
const near = [st.lastTaCol - 1, st.lastTaCol, st.lastTaCol + 1].filter((c) => legal.indexOf(c) >= 0);
if (near.length) col = randOf(near);
}
}
if (col == null) col = randOf(legal);
return col;
}
function applyFloor(col) {
const pThreats = winningCols(st.grid, 1), myWins = winningCols(st.grid, 2);
const isBlock = pThreats.indexOf(col) >= 0;
const isWin = myWins.indexOf(col) >= 0;
if (!isBlock && !isWin && pThreats.length) {
st.missedBlocks++;
if (st.missedBlocks > DIFFS[selDiff].floor) return pThreats[Math.floor(Math.random() * pThreats.length)];
}
if (isBlock) st.missedBlocks = 0;
return col;
}
function rollMode() {
const w = DIFFS[selDiff].w;
const r = Math.random();
if (r < w.normal) return 'normal';
if (r < w.normal + w.serious) return 'serious';
if (r < w.normal + w.serious + w.sandbag) return 'sandbag';
return 'blunder';
}
function buildBoard() {
boardEl.innerHTML = '';
for (let c = 0; c < COLS; c++) {
const col = document.createElement('div');
col.className = 'c4-col';
col.setAttribute('data-col', String(c));
for (let r = 0; r < ROWS; r++) {
const cell = document.createElement('div');
cell.className = 'c4-cell';
cell.setAttribute('data-r', String(r));
col.appendChild(cell);
}
boardEl.appendChild(col);
}
}
function fitBoard() {
if (!stageEl || panel.hidden) return;
const w = stageEl.clientWidth;
if (!w) return;
cellPx = Math.max(30, Math.min(48, Math.floor(w / COLS)));
boardEl.style.width = (cellPx * COLS) + 'px';
const cells = boardEl.querySelectorAll('.c4-cell');
for (let i = 0; i < cells.length; i++) cells[i].style.height = cellPx + 'px';
}
function cellAt(r, c) {
const col = boardEl.children[c];
return col ? col.children[r] : null;
}
function fastMul() { return (window.__c4Debug && window.__c4Debug.fast) ? 0.05 : 1; }
function animateDrop(r, c, side, cb) {
const cell = cellAt(r, c);
const disc = document.createElement('span');
disc.className = 'c4-disc ' + (side === 1 ? 'c4-you' : 'c4-ta');
const dist = (r + 1) * cellPx;
const dur = Math.round((110 + r * 42) * fastMul());
disc.style.transform = 'translateY(-' + dist + 'px)';
disc.style.transitionDuration = dur + 'ms';
cell.appendChild(disc);
requestAnimationFrame(() => { requestAnimationFrame(() => { disc.style.transform = ''; }); });
setTimeout(() => {
disc.classList.add('c4-land');
if (cb) cb();
}, dur + Math.round(70 * fastMul()) + 20);
}
function setStatus(html) { if (statusEl) statusEl.innerHTML = html; }
function escName() { const n = String(T('TA')); const d = document.createElement('div'); d.textContent = n; return d.innerHTML; }
function dot(side) { return '<i class="c4-dot ' + (side === 1 ? 'c4-dot-you' : 'c4-dot-ta') + '"></i>'; }
function showTurnStatus() {
if (!statusEl) return;
if (st.over) return;
setStatus(st.turn === 1 ? dot(1) + '你的回合' : escName() + '正在想……');
}
function clearBoardDom() {
boardEl.querySelectorAll('.c4-disc').forEach((d) => d.remove());
boardEl.querySelectorAll('.c4-wincol').forEach((el) => el.classList.remove('c4-wincol'));
}
function newGame() {
clearTimeout(thinkT); thinkT = null;
st = newState();
st.grid = newGrid();
st.started = true;
clearBoardDom();
hideOverlay();
const s = loadStats();
st.turn = s.nextFirst === 'ta' ? 2 : 1;
setStatus(st.turn === 1 ? dot(1) + '你的回合，点击一列落子' : T('TA') + '先手');
if (st.turn === 2) scheduleTaMove(Math.max(THINK_MIN, 700));
}
function scheduleTaMove(delay) {
clearTimeout(thinkT);
const line = THINK_LINES[Math.floor(Math.random() * THINK_LINES.length)];
setStatus(T(line).replace('TA', escName()));
thinkT = setTimeout(taMove, Math.round(delay * fastMul()));
}
function taMove() {
if (!st || st.over || st.turn !== 2) return;
st.mode = rollMode();
let col = pickTaCol(st.mode);
if (col < 0) return;
col = applyFloor(col);
const r = dropRow(st.grid, col);
if (r < 0) return;
st.lock = true;
st.lastTaCol = col;
st.grid[r][col] = 2;
st.moves++;
sfxDropTa();
animateDrop(r, col, 2, () => {
const line = winLineAt(st.grid, r, col, 2);
if (line) { highlightWin(line); endGame(2); return; }
if (isFull(st.grid)) { endGame(0); return; }
st.turn = 1; st.lock = false;
showTurnStatus();
});
}
function playerDrop(c) {
if (!st || !st.started || st.over || st.lock || st.turn !== 1) return;
const r = dropRow(st.grid, c);
if (r < 0) {
sfxFull();
const colEl = boardEl.children[c];
if (colEl) { colEl.classList.remove('c4-shake'); void colEl.offsetWidth; colEl.classList.add('c4-shake'); }
setStatus(dot(1) + '这一列已经满了');
return;
}
st.lock = true;
st.grid[r][c] = 1;
st.moves++;
sfxDropYou();
animateDrop(r, c, 1, () => {
const line = winLineAt(st.grid, r, c, 1);
if (line) { highlightWin(line); endGame(1); return; }
if (isFull(st.grid)) { endGame(0); return; }
st.turn = 2;
if (!panel.hidden) scheduleTaMove(THINK_MIN + Math.random() * THINK_VAR);
});
}
function highlightWin(cells) {
st.winCells = cells;
for (let i = 0; i < cells.length; i++) {
const cell = cellAt(cells[i][0], cells[i][1]);
if (cell) { cell.classList.add('c4-wincol'); const d = cell.querySelector('.c4-disc'); if (d) d.classList.add('c4-win'); }
}
}
function endGame(winner) {
st.over = true; st.lock = false;
clearTimeout(thinkT); thinkT = null;
const s = loadStats();
if (winner === 1) { s.w++; s.nextFirst = 'ta'; }
else if (winner === 2) { s.l++; s.nextFirst = 'you'; }
else { s.d++; s.nextFirst = Math.random() < 0.5 ? 'you' : 'ta'; }   // 平局下一局随机先手
saveStats(s);
if (winner === 1) sfxWin(); else if (winner === 2) sfxLose(); else sfxDraw();
var coinLine4 = '';
try {
var COIN_CAP = 10400;
var d4 = new Date();
var day4 = d4.getFullYear() + '-' + (d4.getMonth() + 1) + '-' + d4.getDate();
var ck4 = (window.activePrefix && window.activePrefix() || 'xy-home-v2') + ':ml2_coin_c4_' + day4;
var cur4 = Number(localStorage.getItem(ck4)) || 0;
if (cur4 < COIN_CAP) {
var c4WinFen = Math.random() < 0.2 ? 5200 : 1314;
var c4Mult = (window.arcadeMult && window.arcadeMult('c4')) || 1;
var real4 = Math.min((winner === 0 ? 520 : c4WinFen) * c4Mult, COIN_CAP - cur4);
try { localStorage.setItem(ck4, String(cur4 + real4)); } catch (e2) {}
if (real4 > 0 && typeof window.giftWalletChange === 'function') {
if (window.giftWalletChange(real4, real4, '四子棋')) {
coinLine4 = '🪙 双方心意币各 +¥' + (real4 / 100).toFixed(2);
}
}
}
} catch (e) {}
var c4Drop = null;
try {
if (window.arcadeMarkLuckyPlayed) window.arcadeMarkLuckyPlayed('c4');
if (winner === 1 && window.arcadeTryDrop) c4Drop = window.arcadeTryDrop('c4');
} catch (e) {}
const title = winner === 1 ? '🏆 你赢了！' : winner === 2 ? T('TA') + '赢了' : '平局';
const body =
'<div class="pong-end-stat">本局共 ' + st.moves + ' 手</div>' +
'<div class="pong-end-stat">' + statsLine() + '</div>' +
'<div class="pong-end-stat">下一局 ' + (s.nextFirst === 'you' ? '你' : T('TA')) + '先手</div>' +
(coinLine4 ? '<div class="pong-end-stat">' + coinLine4 + '</div>' : '') +
(c4Drop ? '<div class="pong-end-stat">🎁 掉落限定摆件「' + c4Drop.name + '」</div>' : '') +
pillsHtml() +
'<div class="ms-cur">' + diffHint() + '</div>';
showOverlay(title, body, '再来一局');
if (startBtn) startBtn.textContent = '再来一局';
if (endBtn) endBtn.hidden = false;
setStatus(winner === 1 ? '🎉 你赢了！' : winner === 2 ? escName() + '赢了这一局' : '这局没有分出胜负');
try {
const resTxt = winner === 1 ? '你赢' : winner === 2 ? T('TA') + '赢' : '平局';
const c4Stats = ['本局共 ' + st.moves + ' 手', '累计战绩 你 ' + s.w + '胜 · {ta} ' + s.l + '胜 · ' + s.d + '平',
'下一局 ' + (s.nextFirst === 'you' ? '你' : '{ta}') + '先手'].concat(coinLine4 ? [coinLine4] : []).concat(c4Drop ? ['🎁 掉落限定摆件「' + c4Drop.name + '」'] : []);
if (window.chatAddSystem) window.chatAddSystem(T('四子棋') + ' · ' + resTxt, { special: 'c4', game: {
name: '四子棋',
outcome: winner === 1 ? 'win' : winner === 2 ? 'lose' : 'draw',
result: winner === 1 ? '你赢了！' : winner === 2 ? '{ta}赢了' : '平局',
stats: c4Stats
} });
const grp = winner === 1 ? '游戏失败·回应' : winner === 2 ? '游戏胜利·回应' : '游戏平局·回应';
const fb = winner === 1 ? ['让你赢啦，再来？'] : winner === 2 ? ['我赢啦，再来一局吗'] : ['平局，再来一局？'];
const pool = window.getInteractPool ? window.getInteractPool(grp, fb) : fb;
const say = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ''; // #1515 整组停用＝静默（四子棋）
if (say) setTimeout(() => {
try { if (window.chatAddIn) window.chatAddIn(say, { silent: true }); } catch (e) {}
}, 800);
} catch (e) {}
}
function showOverlay(title, body, btnText) {
if (!overlayEl) return;
if (ovTitleEl) ovTitleEl.innerHTML = title || '';
if (ovBodyEl) ovBodyEl.innerHTML = body || '';
if (startBtn && btnText) startBtn.textContent = btnText;
overlayEl.hidden = false;
}
function showStartOverlay() {
const s = loadStats();
showOverlay('四子棋',
pillsHtml() +
'<div class="ms-cur" id="c4-cur">' + diffHint() + '</div>' +
'<div class="c4-start-tip">你执 🔵 · ' + T('TA') + '执 🟡<br>轮流点击一列落子，先连成四子的一方获胜</div>' +
'<div class="c4-start-note">🎲 ' + T('TA') + '每回合状态随机——认真/正常/放水/失误</div>' +
(s.w + s.l + s.d > 0 ? '<div class="pong-end-stat">' + statsLine() + '</div>' : ''),
s.w + s.l + s.d > 0 ? '再来一局' : '开始对局');
if (endBtn) endBtn.hidden = true;
}
function pillsHtml() {
return '<div class="ms-diffs">' + DIFF_ORDER.map((k) => {
const d = DIFFS[k];
return '<button class="ms-diff' + (k === selDiff ? ' on' : '') + '" data-diff="' + k + '" type="button" title="' + d.tip + '">' + d.label + '</button>';
}).join('') + '</div>';
}
function diffHint() { return '当前：' + DIFFS[selDiff].label + ' · ' + DIFFS[selDiff].tip; }
function hideOverlay() { if (overlayEl) overlayEl.hidden = true; if (endBtn) endBtn.hidden = true; }
buildBoard();   // 棋盘 DOM 只建一次（newGame 只清棋子不动结构）
boardEl.addEventListener('click', (e) => {
e.stopPropagation();
const colEl = e.target.closest('.c4-col');
if (!colEl) return;
playerDrop(parseInt(colEl.getAttribute('data-col'), 10) || 0);
});
if (startBtn) startBtn.addEventListener('click', (e) => { e.stopPropagation(); newGame(); });
if (endBtn) endBtn.addEventListener('click', (e) => { e.stopPropagation(); closeC4Panel(); });
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeC4Panel(); });
if (ovBodyEl) ovBodyEl.addEventListener('click', (e) => {
const pill = e.target.closest('.ms-diff');
if (!pill) return;
e.stopPropagation();
const k = pill.getAttribute('data-diff');
if (!DIFFS[k]) return;
selDiff = k;
const stat = loadStats();
stat.lastDiff = k;
saveStats(stat);
const pills = ovBodyEl.querySelectorAll('.ms-diff');
pills.forEach((p) => { p.classList.toggle('on', p.getAttribute('data-diff') === k); });
const curEl = document.getElementById('c4-cur');
if (curEl) curEl.textContent = diffHint();
else { const c2 = ovBodyEl.querySelector('.ms-cur'); if (c2) c2.textContent = diffHint(); }
});
if (soundBtn) soundBtn.addEventListener('click', (e) => {
e.stopPropagation();
soundOn = !soundOn;
soundBtn.textContent = soundOn ? '🔊' : '🔇';
soundBtn.classList.toggle('pong-sound-off', !soundOn);
});
function setNames() {
let name = T('TA');
try {
const s = window.activeStore && window.activeStore();
name = (s && (s.get('lbl-partner') || s.get('cs-lbl-partner'))) || name;
} catch (e) {}
if (partnerNameEl) partnerNameEl.textContent = name;
if (sideNameEl) sideNameEl.textContent = name;
}
window.openC4Panel = function () {
try { if (isFs) toggleFs(); } catch (e) {}
if (!boardEl.children.length) { try { buildBoard(); } catch (e) {} }
panel.hidden = false;
try { const s = loadStats(); if (DIFFS[s.lastDiff]) selDiff = s.lastDiff; } catch (e) {}
try { setNames(); } catch (e) {}
try { fitBoard(); } catch (e) {}
if (st && st.started && !st.over) {
if (st.turn === 2 && !thinkT) scheduleTaMove(THINK_MIN + Math.random() * THINK_VAR);
else if (st.turn === 1) showTurnStatus();
return;
}
showStartOverlay();
setStatus('点击「开始对局」');
};
function closeC4Panel() {
clearTimeout(thinkT); thinkT = null;
if (panel) panel.hidden = true;
}
window.closeC4Panel = closeC4Panel;
document.addEventListener('contact-switched', () => { try { closeC4Panel(); } catch (e) {} });
window.addEventListener('resize', () => { if (!panel.hidden) fitBoard(); });
(function bindEntry() {
const btn = document.getElementById('more-c4');
if (!btn) return;
btn.addEventListener('click', (e) => {
e.stopPropagation();
const mp = document.getElementById('chat-more-panel');
if (mp) mp.hidden = true;
const hideIds = ['poke-card', 'emoji-panel', 'chat-search', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-snake-panel'];
hideIds.forEach((id) => { const el = document.getElementById(id); if (el) el.hidden = true; });
try { if (window.closeAvlib) window.closeAvlib(); } catch (err) {}
try { if (window.closePongPanel) window.closePongPanel(); } catch (err) {}
try { openC4Panel(); } catch (err) {
try { panel.hidden = false; showStartOverlay(); setStatus('点击「开始对局」'); } catch (e2) {}
try { console.error('[c4] open failed', err); } catch (e2) {}
}
});
try {
if (window.MutationObserver) {
const SIBLING_IDS = ['poke-card', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-pong-panel', 'chat-snake-panel', 'chat-brick-panel', 'chat-more-panel'];
const mo = new MutationObserver(() => {
if (panel.hidden) return;
for (let i = 0; i < SIBLING_IDS.length; i++) {
const el = document.getElementById(SIBLING_IDS[i]);
if (el && !el.hidden) { closeC4Panel(); break; }
}
});
SIBLING_IDS.forEach((id) => { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
}
} catch (e) {}
})();
window.__c4Debug = {
st: () => st,
newGame: newGame,
dropRow: (g, c) => dropRow(g, c),
winLineAt: (g, r, c, s) => winLineAt(g, r, c, s),
rollMode: rollMode,
pick: pickTaCol,                       // 纯函数：按 st.grid 选列（不改棋盘/计数）
floor: applyFloor,                     // 底线应用（会更新 missedBlocks）
winningCols: (side) => winningCols(st.grid, side),
fast: false
};
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("connect-four.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("connect-four.js"); try { console.error("[JS] connect-four.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[connect-four.js] " + String(__e && __e.message || __e)); } })();

;/* ==== coop-mine.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-ms-panel');
if (!panel) return;
const boardEl = document.getElementById('ms-board');
const stageEl = document.getElementById('ms-stage');
const statusEl = document.getElementById('ms-status');
const livesEl = document.getElementById('ms-lives');
const progEl = document.getElementById('ms-prog');
const overlayEl = document.getElementById('ms-overlay');
const ovTitleEl = document.getElementById('ms-ov-title');
const ovBodyEl = document.getElementById('ms-ov-body');
const startBtn = document.getElementById('ms-btn-start');
const endBtn = document.getElementById('ms-btn-end');
const soundBtn = document.getElementById('ms-sound');
const modeBtn = document.getElementById('ms-mode');
const bagBtn = document.getElementById('ms-bag');
const closeBtn = document.getElementById('ms-close');
const fsBtn = document.getElementById('ms-fs');
let isFs = false;
function toggleFs() {
isFs = !isFs;
panel.classList.toggle('game-fs', isFs);
if (fsBtn) fsBtn.textContent = isFs ? '⤢' : '⛶';
setTimeout(() => { try { if (typeof fitBoard === 'function') fitBoard(); } catch (e) {} }, 60);
}
if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
const partnerNameEl = document.getElementById('ms-partner-name');
const MAX_LIVES = 3;
const MS_COIN_CAP = 1000;                       // 心意币日封顶（分）
const FLAWLESS_BONUS = 300;                     // 有雷模式全程未踩雷的额外奖励
const DIFFS = {
chill:  { n: 6, mines: 0,  label: '🌱 轻松', name: '轻松', tip: '6×6 · 无雷 · 一起挖宝' },
easy:   { n: 5, mines: 3,  label: '🍬 休闲', name: '休闲', tip: '5×5 · 3 雷' },
normal: { n: 6, mines: 6,  label: '⚙️ 普通', name: '普通', tip: '6×6 · 6 雷' },
hard:   { n: 8, mines: 12, label: '🔥 挑战', name: '挑战', tip: '8×8 · 12 雷' }
};
const NUM_COLORS = ['', '#3a7fd5', '#2e8b57', '#d9534f', '#7a4fd9', '#b7791f', '#2aa198', '#666', '#999'];
const THINK_LINES = ['TA正在观察雷区……', 'TA托着下巴想了想', 'TA盯着数字琢磨了一会儿'];
const T = window.taFit || function (x) { return x; };
function prefix() { return (window.activePrefix && window.activePrefix()) || 'xy-home-v2'; }
function taName() { try { return window.taWord ? window.taWord() : T('TA'); } catch (e) { return T('TA'); } }
function fastMul() { return (window.__msDebug && window.__msDebug.fast) ? 0.05 : 1; }
function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
let audioCtx = null, soundOn = true;
function beep(freq, dur, vol, type) {
if (!soundOn) return;
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(function () {});
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = type || 'sine';
g.gain.value = vol || 0.16;
o.connect(g); g.connect(audioCtx.destination);
const t = audioCtx.currentTime;
o.start(t); g.gain.setValueAtTime(g.gain.value, t);
g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
o.stop(t + dur);
} catch (e) {}
}
const sfxDig = () => beep(520, 0.06, 0.14);
const sfxFlag = () => beep(760, 0.05, 0.12);
const sfxBoom = () => beep(110, 0.3, 0.22, 'triangle');
const sfxCoin = () => { beep(880, 0.08, 0.14); setTimeout(() => beep(1174, 0.1, 0.12), 80); };
const sfxGift = () => { beep(784, 0.08, 0.13); setTimeout(() => beep(1046, 0.12, 0.13), 90); };
const sfxWin = () => { beep(523, 0.12, 0.18); setTimeout(() => beep(659, 0.12, 0.18), 120); setTimeout(() => beep(784, 0.18, 0.18), 240); };
const sfxFail = () => { beep(330, 0.16, 0.16); setTimeout(() => beep(247, 0.22, 0.16), 150); };
function statsKey() { return prefix() + ':ms-stats'; }
function loadStats() {
const d = { play: 0, win: 0, fail: 0, lastDiff: 'normal' };
try {
const raw = localStorage.getItem(statsKey());
if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object') return Object.assign(d, v); }
} catch (e) {}
return d;
}
function saveStats(s) { try { localStorage.setItem(statsKey(), JSON.stringify(s)); } catch (e) {} }
function keepsKey() { return prefix() + ':ms-keeps'; }
function loadKeeps() {
try {
const raw = localStorage.getItem(keepsKey());
const v = raw ? JSON.parse(raw) : [];
return Array.isArray(v) ? v : [];
} catch (e) { return []; }
}
function saveKeeps(list) { try { localStorage.setItem(keepsKey(), JSON.stringify(list.slice(-60))); } catch (e) {} }
function coinDayKey() {
const d = new Date();
return prefix() + ':ml2_coin_ms_' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function grantCoin(fen) {
let cur = 0;
try { cur = Number(localStorage.getItem(coinDayKey())) || 0; } catch (e) {}
const real = Math.min(fen, MS_COIN_CAP - cur);
if (real <= 0) return 0;
try { localStorage.setItem(coinDayKey(), String(cur + real)); } catch (e2) {}
try { if (typeof window.giftWalletChange === 'function') window.giftWalletChange(real, real, '合作扫雷'); } catch (e3) {}
return real;
}
let st = null;
let taT = null;
let selDiff = loadStats().lastDiff;
if (!DIFFS[selDiff]) selDiff = 'normal';
let flagMode = false;
let cellPx = 44;
function newState(key) {
const d = DIFFS[key];
const N = d.n * d.n;
return {
diffKey: key, n: d.n, mineTotal: d.mines,
mine: null, num: null, content: null,       // 懒生成：第一次挖掘才布雷/放宝物
open: new Array(N).fill(false),
flag: new Array(N).fill(0),                 // 0 无 / 1 你 / 2 TA
boom: new Array(N).fill(false),
taFlagged: {},                              // TA 插过旗的格子（用于「判断错了/猜对了」吐槽）
judged: {},
lives: MAX_LIVES, turn: 1,
started: false, over: false, lock: false,
firstDig: true,
digs: { you: 0, ta: 0 },
minesFound: 0,
foundList: [],                              // 本局发现的宝物类型序列
coinEarned: 0                               // 本局实际入账的心意币（分）
};
}
function N() { return st.n * st.n; }
function neighborsOf(i) {
const n = st.n, r = Math.floor(i / n), c = i % n, out = [];
for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
if (!dr && !dc) continue;
const rr = r + dr, cc = c + dc;
if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
}
return out;
}
function recalcNums() {
st.num = new Array(N()).fill(0);
for (let i = 0; i < N(); i++) {
let m = 0;
neighborsOf(i).forEach((j) => { if (st.mine[j]) m++; });
st.num[i] = m;
}
}
function generateMap(firstIdx) {
const total = N();
if (firstIdx == null || firstIdx < 0) firstIdx = 0;
st.mine = new Array(total).fill(0);
st.content = new Array(total).fill(null);
if (st.mineTotal > 0) {
let banned = new Set([firstIdx]);
neighborsOf(firstIdx).forEach((j) => banned.add(j));
if (total - banned.size < st.mineTotal) { banned = new Set([firstIdx]); }
const pool = [];
for (let i = 0; i < total; i++) if (!banned.has(i)) pool.push(i);
shuffle(pool);
for (let k = 0; k < st.mineTotal; k++) st.mine[pool[k]] = 1;
}
recalcNums();
const chill = st.mineTotal === 0;
const safe = [];
for (let i = 0; i < total; i++) if (!st.mine[i]) safe.push(i);
shuffle(safe);
let coins = Math.max(2, Math.min(8, Math.round(safe.length * 0.12)));
if (chill) coins = Math.min(safe.length, coins * 2);
const gifts = chill ? 2 : 1, flowers = chill ? 2 : 1;
let p = 0;
const take = () => (p < safe.length ? safe[p++] : -1);
for (let k = 0; k < coins && p < safe.length; k++) st.content[take()] = 'coin';
for (let k = 0; k < gifts && p < safe.length; k++) st.content[take()] = 'gift';
for (let k = 0; k < flowers && p < safe.length; k++) st.content[take()] = 'flower';
}
function forceMap(mineArr) {
const total = N();
st.mine = new Array(total).fill(0);
for (let i = 0; i < total && i < mineArr.length; i++) st.mine[i] = mineArr[i] ? 1 : 0;
st.content = new Array(total).fill(null);
recalcNums();
st.open = new Array(total).fill(false);
st.flag = new Array(total).fill(0);
st.boom = new Array(total).fill(false);
st.taFlagged = {}; st.judged = {};
st.lives = MAX_LIVES;
st.digs = { you: 0, ta: 0 };
st.minesFound = 0; st.foundList = []; st.coinEarned = 0;
st.firstDig = false;
st.over = false; st.lock = false; st.turn = 1;
clearTimeout(taT); taT = null;
for (let i = 0; i < total; i++) renderCell(i);
updateHud();
}
function constraints() {
const cons = [];
for (let i = 0; i < N(); i++) {
if (!st.open[i] || st.mine[i]) continue;
const nb = neighborsOf(i);
const free = nb.filter((j) => !st.open[j]);
if (!free.length) continue;
let boomAdj = 0;
nb.forEach((j) => { if (st.boom[j]) boomAdj++; });
cons.push({ need: st.num[i] - boomAdj, free });
}
return cons;
}
function deduceSafe() {
const out = [], seen = {};
constraints().forEach((c) => {
if (c.need <= 0) c.free.forEach((j) => { if (!seen[j]) { seen[j] = 1; out.push(j); } });
});
return out;
}
function deduceMines() {
const out = [], seen = {};
constraints().forEach((c) => {
if (c.need > 0 && c.free.length === c.need) {
c.free.forEach((j) => { if (!seen[j]) { seen[j] = 1; out.push(j); } });
}
});
return out;
}
function estProbs() {
const p = {};
constraints().forEach((c) => {
const share = c.free.length ? Math.max(0, c.need) / c.free.length : 1;
c.free.forEach((j) => { p[j] = Math.max(p[j] || 0, share); });
});
return p;
}
function defaultRatio() {
let hidden = 0;
for (let i = 0; i < N(); i++) if (!st.open[i]) hidden++;
return hidden ? Math.max(0, st.mineTotal - st.minesFound) / hidden : 1;
}
function rollTaMode() {
const r = Math.random();
if (r < 0.7) return 'smart';
if (r < 0.9) return 'memory';
return 'wild';
}
function taDecide(mode) {
const hidden = [];
for (let i = 0; i < N(); i++) if (!st.open[i] && !st.flag[i]) hidden.push(i);
if (!hidden.length) {
const flagged = [];
for (let i = 0; i < N(); i++) if (!st.open[i] && st.flag[i]) flagged.push(i);
if (!flagged.length) return null;
const P = estProbs();
let best = flagged[0], bp = Infinity;
flagged.forEach((i) => { const q = P[i] != null ? P[i] : defaultRatio(); if (q < bp) { bp = q; best = i; } });
return { type: 'dig', idx: best };
}
const sureMines = deduceMines().filter((i) => !st.flag[i]);
const safeCells = deduceSafe();   // 含「被旗插着但可证明安全」的格：挖开即顺手纠正错误旗
if (mode !== 'wild') {
if (sureMines.length && Math.random() < 0.55) return { type: 'flag', idx: pick(sureMines) };
if (safeCells.length) return { type: 'dig', idx: pick(safeCells) };
}
if (mode === 'wild') return { type: 'dig', idx: pick(hidden) };
const P = estProbs();
const ranked = hidden.map((i) => ({ i, p: P[i] != null ? P[i] : defaultRatio() }));
ranked.sort((a, b) => a.p - b.p);
if (mode === 'memory') {
const half = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.5)));
return { type: 'dig', idx: pick(half).i };
}
const worst = ranked[ranked.length - 1];
if (worst && worst.p >= 0.72 && Math.random() < 0.3) return { type: 'flag', idx: worst.i, guess: true };
return { type: 'dig', idx: ranked[0].i };
}
function buildBoardDom() {
boardEl.innerHTML = '';
boardEl.style.gridTemplateColumns = 'repeat(' + st.n + ', ' + cellPx + 'px)';
for (let i = 0; i < N(); i++) {
const cell = document.createElement('div');
cell.className = 'ms-cell';
cell.setAttribute('data-i', String(i));
const face = document.createElement('span');
face.className = 'ms-face';
cell.appendChild(face);
boardEl.appendChild(cell);
}
for (let i = 0; i < N(); i++) {
const r = Math.floor(i / st.n), c = i % st.n;
const cell = boardEl.children[i];
cell.classList.add('ms-born');
cell.style.animationDelay = Math.min((r + c) * 26, 480) + 'ms';
cell.addEventListener('animationend', function h(e) {
if (e.target !== cell || e.animationName !== 'msborn') return;
cell.classList.remove('ms-born');
cell.style.animationDelay = '';
cell.removeEventListener('animationend', h);
});
}
fitBoard();
}
function fitBoard() {
if (!stageEl || panel.hidden || !st) return;
const w = stageEl.clientWidth;
if (!w) return;
cellPx = Math.max(26, Math.min(50, Math.floor((w - 10) / st.n)));
boardEl.style.gridTemplateColumns = 'repeat(' + st.n + ', ' + cellPx + 'px)';
const cells = boardEl.children;
for (let i = 0; i < cells.length; i++) {
cells[i].style.width = cellPx + 'px';
cells[i].style.height = cellPx + 'px';
cells[i].style.fontSize = Math.round(cellPx * 0.46) + 'px';
}
}
function cellAt(i) { return boardEl.children[i] || null; }
function renderCell(i, pop, delay) {
const cell = cellAt(i);
if (!cell) return;
const gen = st;   // #343 局代币：延迟应用前若已换局（newGame 换 st）则丢弃，防旧局渲染污染新盘
const apply = function () {
if (st !== gen) return;
const face = cell.firstChild;
let txt = '', cls = 'ms-cell';
if (st.boom[i]) { cls += ' ms-open ms-boom'; txt = '💥'; }
else if (st.open[i]) {
cls += ' ms-open';
const c = st.content[i];
if (c === 'coin') { txt = '🪙'; cls += ' ms-tr'; }
else if (c === 'gift') { txt = '🎁'; cls += ' ms-tr'; }
else if (c === 'flower') { txt = '🌸'; cls += ' ms-tr'; }
else if (st.num[i] > 0) {
txt = String(st.num[i]);
cls += ' ms-n' + st.num[i];
}
} else if (st.flag[i]) {
txt = '🚩';
cls += st.flag[i] === 1 ? ' ms-fyou' : ' ms-fta';
}
cell.className = cls;
face.textContent = txt;
if (pop) { face.classList.remove('ms-pop'); void face.offsetWidth; face.classList.add('ms-pop'); }
};
if (delay) { setTimeout(apply, Math.round(delay * fastMul())); return; }
apply();
}
function heartsStr() { return '❤️'.repeat(st.lives) + '🖤'.repeat(MAX_LIVES - st.lives); }
function openCount() { let x = 0; for (let i = 0; i < N(); i++) if (st.open[i]) x++; return x; }
function safeTotal() { return st.mineTotal === 0 ? N() : N() - st.mineTotal; }
function updateHud() {
if (livesEl) livesEl.textContent = st.started ? heartsStr() : '';
if (progEl) progEl.textContent = st.started ? '已探索 ' + openCount() + ' / ' + safeTotal() : '';
}
function setStatus(html) { if (statusEl) statusEl.innerHTML = html; }
const talkEl = document.getElementById('ms-talk');
let talkHideT = null;
function taTalk(text) {
if (!talkEl) return;
const bubble = talkEl.querySelector('.ms-talk-bubble');
if (bubble) {
bubble.innerHTML = '<span class="ms-talk-name">' + taName().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' + text;
talkEl.hidden = false;
bubble.style.animation = 'none';
void bubble.offsetWidth;
bubble.style.animation = '';
}
clearTimeout(talkHideT);
talkHideT = setTimeout(() => { if (talkEl) talkEl.hidden = true; }, 4000);
}
function shakeCell(i) {
const cell = cellAt(i);
if (!cell) return;
cell.classList.remove('ms-shake'); void cell.offsetWidth; cell.classList.add('ms-shake');
}
let extraMsg = '';    // 一次性补充说明（如 TA 挪旗吐槽），由 composeStatus 消费
function floodOpen(start, out, distOut) {
if (st.mineTotal === 0) { st.open[start] = true; out.push(start); if (distOut) distOut[start] = 0; return; }
const dist = {};
dist[start] = 0;
const queue = [start];
while (queue.length) {
const i = queue.shift();
if (st.open[i] || st.flag[i]) continue;
st.open[i] = true;
out.push(i);
if (st.num[i] === 0) {
neighborsOf(i).forEach((j) => { if (!st.open[j] && !st.flag[j] && dist[j] == null) { dist[j] = dist[i] + 1; queue.push(j); } });
}
}
if (distOut) Object.keys(dist).forEach((k) => { distOut[k] = dist[k]; });
}
function allSafeOpened() {
for (let i = 0; i < N(); i++) { if (!st.mine[i] && !st.open[i]) return false; }
return true;
}
function scheduleTaGiftChat(kind) {
setTimeout(() => {
try {
const lines = kind === 'flower'
? ['挖到一朵小花，「这个给你。」', '发现了这个，觉得很适合你。']
: ['挖到了一个小礼物，「这个给你。」', '发现了这个，「送你呀。」'];
const say = pick(lines) || lines[0];
if (say) taTalk(say);
} catch (e) {}
}, 700);
}
function dig(idx, byYou, allowFlagged) {
const s = st;
if (!s || !s.started || s.over || s.lock) return false;
if (idx == null || idx < 0 || idx >= N() || s.open[idx]) return false;
if (s.flag[idx] && !allowFlagged) {
shakeCell(idx);
setStatus('🚩 这格插着记号，长按取消后再挖');
return false;
}
s.lock = true;
if (s.firstDig) generateMap(s.mineTotal > 0 ? idx : -1);
s.firstDig = false;
const wasTaFlagged = !!s.taFlagged[idx];
const hadPlayerFlag = s.flag[idx] === 1;
s.flag[idx] = 0;
extraMsg = '';
if (s.mine[idx]) {
s.open[idx] = true; s.boom[idx] = true;
s.lives--; s.minesFound++;
s.digs[byYou ? 'you' : 'ta']++;
renderCell(idx, true);
boardEl.classList.remove('ms-quake'); void boardEl.offsetWidth; boardEl.classList.add('ms-quake');
updateHud();
if (livesEl) { livesEl.classList.remove('ms-hurt'); void livesEl.offsetWidth; livesEl.classList.add('ms-hurt'); }
sfxBoom();
const who = byYou ? '你' : T('TA');
let msg = '💥 ' + who + '踩到了雷！' + heartsStr();
if (wasTaFlagged && !s.judged[idx]) { msg += '（不过 ' + T('TA') + ' 的旗没错）'; s.judged[idx] = 1; }
if (hadPlayerFlag && byYou) msg += '（是你自己插的旗那格…）';
if (s.lives <= 0) { setStatus(msg); finish(false, 640); return true; }
setStatus(msg);
passTurn(byYou, 950);   // 停一拍再让 TA 开口，踩雷提示不会被思考语立刻顶掉
return true;
}
const newly = [], distMap = {};
floodOpen(idx, newly, distMap);
let maxDelay = 0;
const gotIcons = [];
for (let k = 0; k < newly.length; k++) {
const i = newly[k];
s.digs[byYou ? 'you' : 'ta']++;
const dly = Math.min((distMap[i] || 0) * 34, 374);
if (dly > maxDelay) maxDelay = dly;
renderCell(i, true, dly);
const c = s.content ? s.content[i] : null;
if (!c) continue;
s.foundList.push(c);
if (c === 'coin') {
const real = grantCoin(100);
if (real > 0) s.coinEarned += real;
gotIcons.push('🪙');
sfxCoin();
} else {
gotIcons.push(c === 'gift' ? '🎁' : '🌸');
sfxGift();
const keeps = loadKeeps();
keeps.push({ t: c, ts: Date.now(), by: byYou ? 'you' : 'ta' });
saveKeeps(keeps);
if (!byYou) scheduleTaGiftChat(c);
}
}
updateHud();
sfxDig();
let msg;
if (gotIcons.length) {
msg = (byYou ? '你发现了 ' : T('TA') + '发现了 ') + gotIcons.join(' ');
if (gotIcons.indexOf('🪙') >= 0 && s.coinEarned > 0) msg += ' · 心意币 +¥1';
} else if (byYou) {
msg = '你挖开了一格';
} else {
msg = T('TA') + '挖开了一格';
}
if (wasTaFlagged && !s.judged[idx]) { msg += ' —— 这里其实是安全的，' + T('TA') + '判断错了'; s.judged[idx] = 1; }
if (extraMsg) { msg += '（' + extraMsg + '）'; extraMsg = ''; }
if (allSafeOpened()) { setStatus(msg); finish(true, newly.length > 2 ? maxDelay + 260 : 0); return true; }
setStatus(msg);
passTurn(byYou, gotIcons.length ? 1100 : undefined);   // 有发现时同样停一拍
return true;
}
function playerDig(idx) {
if (!st || !st.started || st.over || st.lock || st.turn !== 1) return;
if (flagMode) { toggleFlag(idx, 1); return; }
dig(idx, true, false);
}
function toggleFlag(idx, who) {
const s = st;
if (!s || !s.started || s.over || s.lock || s.open[idx]) return;
s.flag[idx] = s.flag[idx] === who ? 0 : who;
renderCell(idx, true);   // #343 旗子弹出/收回带缩放
sfxFlag();
}
function placeTaFlag(idx) {
const s = st;
if (!s || s.open[idx] || s.flag[idx] === 2) return;
s.taFlagged[idx] = 1;
s.flag[idx] = 2;
renderCell(idx, true);   // #343 同上
}
function passTurn(byYou, taDelay) {
const s = st;
if (s.over) return;
s.turn = byYou ? 2 : 1;
if (s.turn === 2) { s.lock = true; scheduleTa(taDelay); }
else { s.lock = false; showTurnStatus(); }
}
function showTurnStatus() {
if (!st || st.over) return;
setStatus('轮到你了' + (st.mineTotal === 0 ? '，慢慢挖～' : ''));
}
function scheduleTa(extraDelay) {
clearTimeout(taT); taT = null;
if (!st || st.over) return;
const line = THINK_LINES[Math.floor(Math.random() * THINK_LINES.length)];
const d = typeof extraDelay === 'number' ? extraDelay : 620 + Math.random() * 680;
taT = setTimeout(() => {
taT = null;
if (!st || st.over || st.turn !== 2) return;
setStatus(T(line).replace('TA', T('TA')) + ' ' + heartsStr());
taTurn();
}, Math.round(d * fastMul()));
}
function taTurn() {
const s = st;
if (!s || s.over || !s.started || s.turn !== 2) return;
const act = taDecide(rollTaMode());
if (!act) { s.turn = 1; s.lock = false; showTurnStatus(); return; }
if (act.type === 'flag') {
placeTaFlag(act.idx);
sfxFlag();
setStatus('🚩 ' + T('TA') + (act.guess ? '觉得这里有雷，先做了个记号' : '标记了一颗雷的位置'));
s.turn = 1; s.lock = false;
setTimeout(showTurnStatus, Math.round(900 * fastMul()));
return;
}
if (s.flag[act.idx] === 1) extraMsg = T('TA') + '把你的旗轻轻挪开了——下面确实是安全的';
s.flag[act.idx] = 0;
renderCell(act.idx);
s.lock = false;   // dig 入口会重新上锁；TA 的思考期锁在这里解除
dig(act.idx, false, true);
}
function finish(win, overlayDelay) {
const s = st;
s.over = true; s.lock = false;
clearTimeout(taT); taT = null;
const stat = loadStats();
stat.play++; if (win) stat.win++; else stat.fail++;
stat.lastDiff = s.diffKey;
saveStats(stat);
if (win) {
const base = s.mineTotal === 0 ? 200 : 500;
const flawless = (s.mineTotal > 0 && s.lives === MAX_LIVES) ? FLAWLESS_BONUS : 0;
const msMult = (window.arcadeMult && window.arcadeMult('ms')) || 1;
const real = grantCoin((base + flawless) * msMult);
if (real > 0) s.coinEarned += real;
sfxWin();
} else {
sfxFail();
}
let msDrop = null;
try {
if (window.arcadeMarkLuckyPlayed) window.arcadeMarkLuckyPlayed('ms');
if (win && window.arcadeTryDrop) msDrop = window.arcadeTryDrop('ms');
} catch (e) {}
const gifts = s.foundList.filter((x) => x === 'gift').length;
const flowers = s.foundList.filter((x) => x === 'flower').length;
let body = pillsHtml();
if (win) {
body +=
'<div class="pong-end-stat">💣 雷区清理完成！</div>' +
'<div class="pong-end-stat">你探索 ' + s.digs.you + ' 格 · ' + T('TA') + '探索 ' + s.digs.ta + ' 格</div>' +
'<div class="pong-end-stat">💣 找到地雷 ' + s.minesFound + '/' + s.mineTotal +
' · 🎁 宝物 ' + (gifts + flowers) + '</div>';
if (s.lives === MAX_LIVES && s.mineTotal > 0) body += '<div class="pong-end-stat">💕 一颗雷都没踩，完美合作</div>';
} else {
body +=
'<div class="pong-end-stat">💥 这次踩到太多雷了。</div>' +
'<div class="pong-end-stat">你们一起探索了 ' + openCount() + ' 格，还差一点。</div>';
}
if (s.coinEarned > 0) body += '<div class="pong-end-stat">🪙 我的心意币 +¥' + (s.coinEarned / 100).toFixed(2) + '</div>';
if (msDrop) body += '<div class="pong-end-stat">🎁 掉落限定摆件「' + msDrop.name + '」</div>';
body += '<div class="pong-end-stat ms-quote">「' + (win ? pick(['一起找完了。', '我们配合得不错嘛。', '全部清完啦，开心。']) : pick(['差一点点而已，再来！', '下次小心一点就好。'])) + '」</div>';
let showDelay = overlayDelay || 0;
if (!win) {
const gen = st;
let rvN = 0, rvMax = 0;
for (let i = 0; i < N(); i++) {
if (!s.mine[i] || s.boom[i] || s.open[i] || s.flag[i]) continue;
const dly = 140 + rvN * 90;
rvN++; if (dly > rvMax) rvMax = dly;
setTimeout(() => {
if (st !== gen) return;
const cell = cellAt(i);
if (!cell) return;
cell.classList.add('ms-reveal');
const face = cell.firstChild;
face.textContent = '💣';
face.classList.remove('ms-pop'); void face.offsetWidth; face.classList.add('ms-pop');
}, Math.round(dly * fastMul()));
}
if (rvN) showDelay = Math.max(showDelay, rvMax + 280);
}
const showResult = function () {
if (!st || !st.over || panel.hidden) return;
showOverlay(win ? '💣 合作完成' : '💥 差一点', body, '再来一次');
};
if (showDelay) setTimeout(showResult, Math.round(showDelay * fastMul()));
else showResult();
if (startBtn) startBtn.textContent = '再来一次';
if (endBtn) endBtn.hidden = false;
try {
const msStats = ['你探索 ' + s.digs.you + ' 格 · {ta}探索 ' + s.digs.ta + ' 格',
'💣 找到地雷 ' + s.minesFound + '/' + s.mineTotal + ' · 🎁 宝物 ' + (gifts + flowers),
'难度 ' + DIFFS[s.diffKey].name].concat(s.coinEarned > 0 ? ['🪙 我的心意币 +¥' + (s.coinEarned / 100).toFixed(2)] : []).concat(msDrop ? ['🎁 掉落限定摆件「' + msDrop.name + '」'] : []);
if (window.chatAddSystem) window.chatAddSystem(T('合作扫雷') + ' · ' + (win ? '完成 ' + DIFFS[s.diffKey].name : '差一点（' + DIFFS[s.diffKey].name + '）'), { special: 'ms', game: {
name: '合作扫雷',
outcome: win ? 'clear' : 'fail',
result: win ? '雷区清理完成！' : '差一点，雷太多了',
stats: msStats
} });
const fb = win
? ['一起找完了。', '我们配合得不错嘛。', '全部清完啦，开心。', '这一片雷区都清理干净了。']
: ['差一点点而已，再来！', '下次小心一点就好。', '没事，再来一次？'];
const say = (fb.length ? pick(fb) : fb[0]) || 'ok';
setTimeout(() => { try { if (say) taTalk(say); } catch (e) {} }, 900);
} catch (e) {}
}
function pillsHtml() {
return '<div class="ms-diffs">' + Object.keys(DIFFS).map((k) => {
const d = DIFFS[k];
return '<button class="ms-diff' + (k === selDiff ? ' on' : '') + '" data-diff="' + k + '" type="button" title="' + d.tip + '">' + d.label + '</button>';
}).join('') + '</div>';
}
function showOverlay(title, body, btnText) {
if (!overlayEl) return;
if (ovTitleEl) ovTitleEl.innerHTML = title || '';
if (ovBodyEl) ovBodyEl.innerHTML = body || '';
if (startBtn && btnText) startBtn.textContent = btnText;
overlayEl.hidden = false;
}
function showStartOverlay() {
const s = loadStats();
let body = pillsHtml();
body += '<div class="ms-cur" id="ms-cur">当前：' + curHint() + '</div>';
body += '<div class="ms-tip">轮流挖掘 · 你们共用 ' + heartsStrStatic() + '<br>数字 = 周围雷数 · 长按格子插旗<br>🪙🎁🌸 藏在格子里，一起找找看</div>';
body += '<div class="ms-note">🎲 ' + T('TA') + '会推理也会失误——偶尔也需要你救场</div>';
if (s.play > 0) body += '<div class="pong-end-stat">合作 ' + s.play + ' 局 · 完成 ' + s.win + ' 次</div>';
showOverlay('合作扫雷', body, s.play > 0 ? '继续探索' : '开始探索');
if (endBtn) endBtn.hidden = true;
}
function heartsStrStatic() { return '❤️❤️❤️'; }
function curHint() {
const d = DIFFS[selDiff];
return d.name + ' · ' + d.n + '×' + d.n
+ (d.mines ? ' · ' + d.mines + ' 颗雷' : ' · 本局无雷，纯挖宝藏');
}
function hideOverlay() { if (overlayEl) overlayEl.hidden = true; if (endBtn) endBtn.hidden = true; }
function newGame() {
clearTimeout(taT); taT = null;
st = newState(selDiff);
st.started = true;
buildBoardDom();
hideOverlay();
updateHud();
setStatus(st.mineTotal === 0
? '✅ 本局没有雷，一起挖宝找🪙🎁🌸'
: '你的回合 · 本局 ' + st.mineTotal + ' 颗雷，点一格开始探索');
}
try {
st = newState(selDiff);
buildBoardDom();
} catch (ePre) {}
function bagText() {
const keeps = loadKeeps();
if (!keeps.length) return '还没有收藏。\n一起挖挖看吧，🎁 和 🌸 都藏在地里。';
let giftN = 0, flowerN = 0;
keeps.forEach((k) => { if (k.t === 'gift') giftN++; else if (k.t === 'flower') flowerN++; });
const fmt = (ts) => { const d = new Date(ts); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; };
const recent = keeps.slice(-4).reverse().map((k) => (k.t === 'gift' ? '🎁' : '🌸') + ' ' + fmt(k.ts) + (k.by === 'ta' ? '（' + T('TA') + '送的）' : ''));
return '🎁 神秘礼物 ×' + giftN + '\n🌸 花朵 ×' + flowerN + '\n\n最近：\n' + recent.join('\n');
}
let lpTimer = null, lpFired = false, lastFlagTs = 0;
boardEl.addEventListener('pointerdown', (e) => {
const cell = e.target.closest('.ms-cell');
if (!cell) return;
e.stopPropagation();
lpFired = false;
if (!st || !st.started || st.over) return;
const idx = parseInt(cell.getAttribute('data-i'), 10) || 0;
clearTimeout(lpTimer);
lpTimer = setTimeout(() => {
lpFired = true;
lastFlagTs = Date.now();
toggleFlag(idx, 1);
try { if (navigator.vibrate) navigator.vibrate(15); } catch (err) {}
}, 430);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
boardEl.addEventListener(ev, () => { clearTimeout(lpTimer); });
});
boardEl.addEventListener('click', (e) => {
e.stopPropagation();
const cell = e.target.closest('.ms-cell');
if (!cell) return;
if (lpFired) { lpFired = false; return; }
playerDig(parseInt(cell.getAttribute('data-i'), 10) || 0);
});
boardEl.addEventListener('contextmenu', (e) => {
const cell = e.target.closest('.ms-cell');
if (!cell) return;
e.preventDefault();
e.stopPropagation();
if (Date.now() - lastFlagTs < 700) return;   // 长按后紧跟的 contextmenu 不重复切换
toggleFlag(parseInt(cell.getAttribute('data-i'), 10) || 0, 1);
});
if (startBtn) startBtn.addEventListener('click', (e) => { e.stopPropagation(); newGame(); });
if (endBtn) endBtn.addEventListener('click', (e) => { e.stopPropagation(); closeMsPanel(); });
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeMsPanel(); });
if (soundBtn) soundBtn.addEventListener('click', (e) => {
e.stopPropagation();
soundOn = !soundOn;
soundBtn.textContent = soundOn ? '🔊' : '🔇';
});
if (modeBtn) modeBtn.addEventListener('click', (e) => {
e.stopPropagation();
flagMode = !flagMode;
modeBtn.textContent = flagMode ? '🚩' : '⛏️';
modeBtn.classList.toggle('ms-mode-on', flagMode);
if (statusEl && flagMode && st && st.started && !st.over) setStatus('插旗模式：点一下格子就是 🚩（再按一次切回挖掘）');
});
if (bagBtn) bagBtn.addEventListener('click', (e) => {
e.stopPropagation();
try {
if (window.openModal) window.openModal('小收藏', '', function () {}, { noInput: true, staticText: bagText(), pills: [{ label: '好的', value: 'ok' }] });
} catch (err) {}
});
if (ovBodyEl) ovBodyEl.addEventListener('click', (e) => {
const pill = e.target.closest('.ms-diff');
if (!pill) return;
e.stopPropagation();
const k = pill.getAttribute('data-diff');
if (!DIFFS[k]) return;
selDiff = k;
const stat = loadStats();
stat.lastDiff = k;
saveStats(stat);
const pills = ovBodyEl.querySelectorAll('.ms-diff');
pills.forEach((p) => { p.classList.toggle('on', p.getAttribute('data-diff') === k); });
const curEl = document.getElementById('ms-cur');
if (curEl) curEl.textContent = '当前：' + curHint();
});
function setNames() {
let name = T('TA');
try {
const s = window.activeStore && window.activeStore();
name = (s && (s.get('lbl-partner') || s.get('cs-lbl-partner'))) || name;
} catch (e) {}
if (partnerNameEl) partnerNameEl.textContent = name;
}
window.openMsPanel = function () {
try { if (isFs) toggleFs(); } catch (e) {}
panel.hidden = false;
try { setNames(); } catch (e) {}
try { fitBoard(); } catch (e) {}
if (st && st.started && !st.over) {
if (st.turn === 2 && !taT) scheduleTa();
else if (st.turn === 1 && !st.lock) showTurnStatus();
return;
}
showStartOverlay();
setStatus('选择难度开始探索');
};
function closeMsPanel() {
clearTimeout(taT); taT = null;
if (panel) panel.hidden = true;
}
window.closeMsPanel = closeMsPanel;
document.addEventListener('contact-switched', () => { try { closeMsPanel(); } catch (e) {} });
window.addEventListener('resize', () => { if (!panel.hidden) fitBoard(); });
(function bindEntry() {
const btn = document.getElementById('more-ms');
if (!btn) return;
btn.addEventListener('click', (e) => {
e.stopPropagation();
const mp = document.getElementById('chat-more-panel');
if (mp) mp.hidden = true;
const hideIds = ['poke-card', 'emoji-panel', 'chat-search', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-snake-panel', 'chat-brick-panel', 'chat-c4-panel'];
hideIds.forEach((id) => { const el = document.getElementById(id); if (el) el.hidden = true; });
try { if (window.closeAvlib) window.closeAvlib(); } catch (err) {}
try { if (window.closePongPanel) window.closePongPanel(); } catch (err) {}
try { if (window.closeC4Panel) window.closeC4Panel(); } catch (err) {}
try { openMsPanel(); } catch (err) {
try { panel.hidden = false; showStartOverlay(); setStatus('选择难度开始探索'); } catch (e2) {}
try { console.error('[ms] open failed', err); } catch (e2) {}
}
});
try {
if (window.MutationObserver) {
const SIBLING_IDS = ['poke-card', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-pong-panel', 'chat-snake-panel', 'chat-brick-panel', 'chat-c4-panel', 'chat-more-panel'];
const mo = new MutationObserver(() => {
if (panel.hidden) return;
for (let i = 0; i < SIBLING_IDS.length; i++) {
const el = document.getElementById(SIBLING_IDS[i]);
if (el && !el.hidden) { closeMsPanel(); break; }
}
});
SIBLING_IDS.forEach((id) => { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
}
} catch (e) {}
})();
window.__msDebug = {
st: () => st,
newGame: newGame,
setDiff: (k) => { if (DIFFS[k]) selDiff = k; },
dig: (i, you) => dig(i, you !== false, true),
toggleFlag: (i, w) => toggleFlag(i, w || 1),
clearFlag: (i) => { if (st) { st.flag[i] = 0; renderCell(i); } },
placeTaFlag: placeTaFlag,
forceMap: forceMap,
setContent: (i, t) => { if (st && st.content) st.content[i] = t; },
setMine: (i, v) => { if (st && st.mine) st.mine[i] = v ? 1 : 0; },
setNum: (i, v) => { if (st) st.num[i] = v; },
setBoom: (i) => { if (st) { st.boom[i] = true; st.open[i] = true; renderCell(i); } },
openCell: (i) => { if (st) { st.open[i] = true; renderCell(i); } },
recalcNums: recalcNums,
deduceSafe: deduceSafe,
deduceMines: deduceMines,
probs: estProbs,
decide: taDecide,
rollMode: rollTaMode,
grantCoinRaw: grantCoin,
stopTa: () => { clearTimeout(taT); taT = null; },
unlock: () => { if (st) st.lock = false; },
fast: false
};
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("coop-mine.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("coop-mine.js"); try { console.error("[JS] coop-mine.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[coop-mine.js] " + String(__e && __e.message || __e)); } })();

;/* ==== fishing.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-fish-panel');
if (!panel) return;
if (window.__fishInit) return;
window.__fishInit = true;
const fsBtn = document.getElementById('fish-fs');
let isFs = false;
function toggleFs() {
isFs = !isFs;
panel.classList.toggle('game-fs', isFs);
if (fsBtn) fsBtn.textContent = isFs ? '⤢' : '⛶';
}
if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
function store() { try { return window.activeStore(); } catch (e) { return null; } }
function toast(msg) {
let t = document.getElementById('cc-toast');
if (!t) { t = document.createElement('div'); t.id = 'cc-toast'; document.body.appendChild(t); }
t.textContent = msg; t.className = 'cc-toast'; void t.offsetWidth; t.className = 'cc-toast show';
t.style.opacity = '';
clearTimeout(t._timer); t._timer = setTimeout(function () { t.className = 'cc-toast'; }, 2000);
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fit(s) { return window.taFit ? window.taFit(s) : s; }
function partnerName() { try { return window.chatPartnerName ? window.chatPartnerName() : 'TA'; } catch (e) { return 'TA'; } }
function taWord() { try { return window.taWord ? window.taWord() : 'TA'; } catch (e) { return 'TA'; } }
function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''; }
function todayKey() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fenToStr(fen) { const y = fen / 100; return y.toFixed(y >= 100 ? 0 : 2); }
function pickPool(name, fb) { try { if (window.getInteractPool) { const p = window.getInteractPool(name, fb); if (p && p.length) return p; } } catch (e) {} return window.gateCardFallback ? window.gateCardFallback('interact', fb) : fb; } // #1515 兜底也过闸（全关＝空池，消费方不出声）
let audioCtx = null, soundOn = true;
function setSoundOn(on, persist) {
soundOn = !!on;
if (soundBtn) { soundBtn.textContent = soundOn ? '🔊' : '🔇'; soundBtn.classList.toggle('off', !soundOn); }
if (persist) { try { writeJSON('fishing-sound', { on: soundOn }); } catch (e) {} }
}
function beep(freq, dur, vol, type) {
if (!soundOn) return;
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended' && audioCtx.resume) { const r = audioCtx.resume(); if (r && r.catch) r.catch(function () {}); }
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = type || 'sine';
g.gain.value = vol || 0.08;
o.connect(g); g.connect(audioCtx.destination);
const t = audioCtx.currentTime;
o.start(t); g.gain.setValueAtTime(g.gain.value, t);
g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.08));
o.stop(t + (dur || 0.08));
} catch (e) {}
}
function sfxCast() { beep(360, 0.06, 0.1); }
function sfxBite() { beep(720, 0.05, 0.12); beep(880, 0.05, 0.1); }
function sfxCatch() { beep(520, 0.08, 0.14); setTimeout(function () { beep(780, 0.1, 0.14); }, 90); }
function sfxMiss() { beep(240, 0.14, 0.1, 'triangle'); }
function sfxSell() { beep(660, 0.06, 0.12); setTimeout(function () { beep(880, 0.08, 0.12); }, 80); setTimeout(function () { beep(1100, 0.1, 0.12); }, 160); }
function sfxGift() { beep(880, 0.1, 0.12); setTimeout(function () { beep(1174, 0.12, 0.12); }, 110); }
const ITEMS = [
{ id: 'fish_small',    name: '小鱼',   icon: '🐟', price: 200,  cat: 'fish',    r: 1 },
{ id: 'fish_blue',     name: '蓝鱼',   icon: '🐠', price: 500,  cat: 'fish',    r: 2 },
{ id: 'fish_puffer',   name: '河豚',   icon: '🐡', price: 600,  cat: 'fish',    r: 2 },
{ id: 'fish_crab',     name: '螃蟹',   icon: '🦀', price: 700,  cat: 'fish',    r: 2 },
{ id: 'fish_big',      name: '大鱼',   icon: '🐟', price: 1200, cat: 'fish',    r: 3 },
{ id: 'fish_octopus',  name: '八爪鱼', icon: '🐙', price: 1200, cat: 'fish',    r: 3 },
{ id: 'fish_rare',     name: '稀有鱼', icon: '🐠', price: 3000, cat: 'fish',    r: 4 },
{ id: 'fish_gold',     name: '金色鱼', icon: '🌟', price: 5000, cat: 'fish',    r: 5 },
{ id: 'fish_koi',      name: '锦鲤',   icon: '🎏', price: 8000,  cat: 'fish',    r: 6 },
{ id: 'fish_moon',     name: '月光鱼', icon: '🌙', price: 12000, cat: 'fish',    r: 6 },
{ id: 'fish_abyss',    name: '深渊王', icon: '🐲', price: 20000, cat: 'fish',    r: 6 },
{ id: 'sp_flower',     name: '漂流花', icon: '🌸', price: 800,  cat: 'special', giftNote: 'flower' },
{ id: 'sp_chest',      name: '小宝箱', icon: '🎁', price: 2000, cat: 'special' },
{ id: 'gift_shell',    name: '小贝壳', icon: '🐚', cat: 'gift',    price: 0, giftNote: 'shell' },
{ id: 'gift_stone',    name: '小石头', icon: '🪨', cat: 'gift',    price: 0, giftNote: 'stone' },
{ id: 'gift_bottle',   name: '漂流瓶', icon: '🧴', cat: 'gift',    price: 0, giftNote: 'bottle' },
{ id: 'gift_trinket',  name: '小饰品', icon: '🎀', cat: 'gift',    price: 0, giftNote: 'trinket' }
];
const ITEM_MAP = {}; ITEMS.forEach(function (it) { ITEM_MAP[it.id] = it; });
const DISHES = {
fish_small:   { name: '烤小鱼',   emoji: '🐟', cookSec: 180,  mult: 1.8 },
fish_blue:    { name: '清蒸蓝鱼', emoji: '🍽️', cookSec: 300,  mult: 1.8 },
fish_puffer:  { name: '河豚刺身', emoji: '🍣', cookSec: 300,  mult: 1.9 },
fish_crab:    { name: '清蒸蟹',   emoji: '🦀', cookSec: 360,  mult: 1.8 },
fish_big:     { name: '红烧大鱼', emoji: '🍲', cookSec: 480,  mult: 1.9 },
fish_octopus: { name: '章鱼烧',   emoji: '🐙', cookSec: 480,  mult: 1.9 },
fish_rare:    { name: '稀有鱼宴', emoji: '🍱', cookSec: 720,  mult: 2.0 },
fish_gold:    { name: '金鱼浓汤', emoji: '🍜', cookSec: 1080, mult: 2.2 },
fish_koi:     { name: '锦鲤御膳', emoji: '👑', cookSec: 1800, mult: 2.5 },
fish_moon:    { name: '月光鱼露', emoji: '🌙', cookSec: 1800, mult: 2.5 },
fish_abyss:   { name: '深渊王宴', emoji: '🐲', cookSec: 1800, mult: 3.0 }
};
function dishOf(fishId) { return DISHES[fishId] || null; }
function dishPrice(fishId, quality) { const it = ITEM_MAP[fishId]; const d = dishOf(fishId); if (!it || !d) return 0; const qm = quality === 'perfect' ? 1.15 : quality === 'good' ? 1.0 : 0.85; return Math.round(it.price * d.mult * qm); }
const FISH_POOL = ITEMS.filter(function (it) { return it.cat === 'fish' || it.cat === 'special'; });
const GIFT_POOL = ITEMS.filter(function (it) { return it.cat === 'gift'; });
function qualityWeights(quality) {
if (quality === 'perfect') return { 1: 30, 2: 30, 3: 22, 4: 13, 5: 5, 6: 3 };
if (quality === 'good')    return { 1: 45, 2: 30, 3: 16, 4: 7, 5: 2, 6: 1 };
return { 1: 68, 2: 22, 3: 8, 4: 2, 5: 0, 6: 0 };
}
function rollFish(quality) {
const w = qualityWeights(quality);
const pool = FISH_POOL.filter(function (it) { return (w[it.r] || 0) > 0; });
let total = 0; pool.forEach(function (it) { total += (w[it.r] || 0); });
let r = Math.random() * total;
for (let i = 0; i < pool.length; i++) { r -= (w[pool[i].r] || 0); if (r <= 0) return pool[i]; }
return pool[0];
}
function successRate(quality) { return quality === 'perfect' ? 0.92 : quality === 'good' ? 0.6 : 0.22; }
function rollTaItem() {
if (Math.random() < 0.15 && GIFT_POOL.length) return GIFT_POOL[Math.floor(Math.random() * GIFT_POOL.length)];
return rollFish('good');
}
const GIFT_NOTES = {
shell: ['捡到一个小贝壳，给你。', '这个贝壳挺好看的，留给你。', '海边的小东西，收下吧。'],
stone: ['捡到一块小石头，很光滑，给你。', '这块石头摸起来很舒服，送你。'],
bottle: ['捞到一个漂流瓶，没舍得打开，给你。', '捡到一个漂流瓶，送你了。'],
trinket: ['钓上来一个小饰品，是你的了。', '这个小东西，很想给你。'],
flower: ['这朵花给你。', 'TA 把花递给你。', '捞起一朵花，觉得适合你。']
};
function giftNoteFor(item) {
const builtin = GIFT_NOTES[item.giftNote || item.id] || ['这个给你。', '想把这份小惊喜留给你。'];
const pool = pickPool('游戏胜利·回应', builtin);
return pool && pool.length ? pick(pool) : ''; // #1515 全关＝无寄语（不再回落未过闸兜底）
}
const _jsonCache = {};
function _cacheNs(key) { try { return (window.activePrefix ? window.activePrefix() : '') + '|' + key; } catch (e) { return '|' + key; } }
function readJSON(key, fb) {
const s = store(); if (!s) return fb;
const ns = _cacheNs(key);
try {
const raw = s.get(key) || 'null';
const c = _jsonCache[ns];
if (c && c.raw === raw) return c.val == null ? fb : c.val;
const v = JSON.parse(raw);
_jsonCache[ns] = { raw: raw, val: v };
return v == null ? fb : v;
} catch (e) { delete _jsonCache[ns]; return fb; }
}
function writeJSON(key, v) {
const s = store(); if (!s) return;
const ns = _cacheNs(key);
const raw = JSON.stringify(v);
try { s.set(key, raw); } catch (e) { delete _jsonCache[ns]; throw e; }
_jsonCache[ns] = { raw: raw, val: v };
}
function dexKey() { return 'fishing-dex'; }
function loadDex() { const d = readJSON(dexKey(), {}); return (d && typeof d === 'object') ? d : {}; }
function saveDex(d) { writeJSON(dexKey(), d); }
function todayDataKey() { return 'fishing-today'; }
function keepKey(side, id) { return side + ':' + id; }
function normalizeToday(t) {
const old = t.keep && typeof t.keep === 'object' ? t.keep : {};
const keep = {};
Object.keys(old).forEach(function (k) {
if (!old[k]) return;
if (k.indexOf(':') < 0) { keep[keepKey('mine', k)] = 1; keep[keepKey('ta', k)] = 1; }
else keep[k] = 1;
});
t.keep = keep;
return t;
}
function loadToday() {
const t = readJSON(todayDataKey(), null);
if (t && t.date === todayKey()) return normalizeToday(t);
return { date: todayKey(), mine: {}, ta: {}, keep: {} };
}
function saveToday(t) { writeJSON(todayDataKey(), t); }
function giftsKey() { return 'fishing-gifts'; }
function loadGifts() { const g = readJSON(giftsKey(), []); return Array.isArray(g) ? g : []; }
function saveGifts(g) { writeJSON(giftsKey(), g); }
function togetherKey() { return 'fishing-together'; }
function loadTogether() { const t = readJSON(togetherKey(), null); if (t && t.date === todayKey()) return t; return { date: todayKey(), sec: 0, rewarded: false }; }
function saveTogether(t) { writeJSON(togetherKey(), t); }
function statsKey() { return 'fishing-stats'; }
function loadStats() { const s = readJSON(statsKey(), null); return s && typeof s === 'object' ? s : { totalCast: 0, perfectCatch: 0, totalEarned: 0 }; }
function saveStats(s) { writeJSON(statsKey(), s); }
function addStats(delta) { const s = loadStats(); s.totalCast += delta.totalCast || 0; s.perfectCatch += delta.perfectCatch || 0; s.totalEarned += delta.totalEarned || 0; saveStats(s); }
function fishCoinCap() {
const o = readJSON('fishing-coin-day', null);
if (o && o.date === todayKey() && typeof o.used === 'number') return o.used;
return 0;
}
function grantFishCoin(fen, label) {
const used = fishCoinCap();
const real = Math.max(0, Math.min(fen, 10400 - used));
if (real <= 0) return 0;
try { writeJSON('fishing-coin-day', { date: todayKey(), used: used + real }); } catch (e) { return 0; }
if (window.giftWalletChange) window.giftWalletChange(real, real, label);
return real;
}
const partnerNameEl = document.getElementById('fish-partner-name');
const sceneEl = document.getElementById('fish-scene');
const statusEl = document.getElementById('fish-status');
const castBtn = document.getElementById('fish-cast');
const reelBtn = document.getElementById('fish-reel');
const soundBtn = document.getElementById('fish-sound');
const timingWrapEl = document.getElementById('fish-timing-wrap');
const timingBarEl = document.getElementById('fish-timing-bar');
const timingCursorEl = document.getElementById('fish-timing-cursor');
const pageEl = document.getElementById('fish-page');
const tabEls = panel.querySelectorAll('.fish-tab');
if (sceneEl && !sceneEl.querySelector('.fish-bobber')) {
const bm = document.createElement('span'); bm.className = 'fish-bobber fish-bobber-mine';
const bt = document.createElement('span'); bt.className = 'fish-bobber fish-bobber-ta';
sceneEl.appendChild(bm); sceneEl.appendChild(bt);
}
let mine = null;       // 玩家：{phase, since, biteAt, rafId}
let ta = null;         // TA：{phase, until, ...}
let taTimer = null, togetherTimer = null;
let timingRafId = null;
let curTab = 'today';
let open = false;
let missStreak = 0;     // 连续跑鱼次数（保底：第 5 次起必命中）
let togetherSec = -1, togetherRewarded = null;  // 陪伴计时内存缓存（减少写盘）
let _lastPageKey = '';  // renderPage 脏标记（无变化时跳过 innerHTML 重建）
function resetMine() { mine = { phase: 'idle', since: 0, biteAt: 0 }; }
function resetTa() { ta = { phase: 'idle', until: 0, next: 0 }; }
resetMine(); resetTa();
function castMine() {
if (mine.phase === 'waiting' || mine.phase === 'biting') return;
sfxCast();
addStats({ totalCast: 1 });
if (statusEl) delete statusEl.dataset.keep;
mine.phase = 'waiting'; mine.since = Date.now();
mine.biteAt = Date.now() + rand(2000, 4500);
const wait = mine.biteAt - Date.now();
clearTimeout(mine._tm); mine._tm = setTimeout(function () {
if (mine.phase !== 'waiting') return;
startBiting();
}, wait);
render();
}
function startBiting() {
mine.phase = 'biting'; mine.biteStart = Date.now(); mine.biteDur = 1600;
sfxBite();
if (timingRafId) cancelAnimationFrame(timingRafId);
const loop = function (ts) {
if (mine.phase !== 'biting') { timingRafId = null; return; }
const p = Math.min(1, (Date.now() - mine.biteStart) / mine.biteDur);
mine.progress = p;
updateTimingVisual(p);
if (p >= 1) { timingRafId = null; reelMine(); }
else timingRafId = requestAnimationFrame(loop);
};
timingRafId = requestAnimationFrame(loop);
render();
}
function reelMine() {
if (mine.phase !== 'biting') return;
const p = (mine.progress == null) ? 0 : mine.progress;
let quality;
if (p >= 0.38 && p <= 0.68) quality = 'perfect';
else if ((p >= 0.2 && p < 0.38) || (p > 0.68 && p <= 0.85)) quality = 'good';
else quality = 'poor';
const pity = missStreak >= 5;
const hit = pity || Math.random() < successRate(quality);
if (timingRafId) { cancelAnimationFrame(timingRafId); timingRafId = null; }
if (hit) {
const item = rollFish(quality);
sfxCatch();
gainMine(item);
flashScene(true, item);
try {
if (window.arcadeMarkLuckyPlayed) window.arcadeMarkLuckyPlayed('fishing');
if (quality === 'perfect' && window.arcadeTryDrop) {
const fdp = window.arcadeTryDrop('fishing');
if (fdp) setTimeout(function () { toast('🎁 掉落限定摆件「' + fdp.name + '」'); }, 600);
}
} catch (e) {}
if (pity) { statusText('保底命中！钓到了 ' + item.icon + ' ' + item.name); missStreak = 0; }
else if (quality === 'perfect') { statusText('完美收竿！钓到了 ' + item.icon + ' ' + item.name); addStats({ perfectCatch: 1 }); }
else statusText('收竿！钓到了 ' + item.icon + ' ' + item.name);
} else {
sfxMiss();
flashScene(false);
missStreak++;
let msg = '鱼跑了…（' + (quality === 'perfect' ? '差一点点' : '时机不对') + '）';
if (missStreak === 3 || missStreak === 4) msg += ' 别急，慢慢来';
statusText(msg);
if (Math.random() < 0.15) { setTimeout(function () { sendTaLine(fit('TA：') + pick(TA_COMFORT), false); }, 500); }
}
mine.phase = 'idle'; mine.progress = null;
render();
}
function gainMine(item) {
const t = loadToday();
t.mine[item.id] = (t.mine[item.id] || 0) + 1;
saveToday(t);
markDex(item);
}
function markDex(item) {
const d = loadDex();
if (!d[item.id]) {
d[item.id] = true; saveDex(d);
toast('发现新物品！' + item.icon + ' ' + item.name);
}
}
function flashScene(got, item) {
const wp = sceneEl.querySelector('.fish-water');
if (!wp) return;
const existing = wp.querySelectorAll('.fish-splash');
if (existing.length >= 3 && existing[0].parentNode) existing[0].parentNode.removeChild(existing[0]);
const splash = document.createElement('div');
splash.className = 'fish-splash' + (got ? ' ok' : '');
splash.textContent = got ? (item ? item.icon : '🐟') : '💨';
wp.appendChild(splash);
setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 1200);
}
function taStep() {
const now = Date.now();
if (ta.phase === 'idle' || (ta.phase !== 'rest' && ta.phase !== 'waiting' && ta.phase !== 'biting' && now >= ta.next)) {
ta.decide(now);
} else if (now < ta.until) {
} else {
ta.resolve(now);
}
render();
}
resetTa = function () {
ta = {
phase: 'idle', until: 0, next: 0,
decide: function (now) {
const r = Math.random();
if (r < 0.05) { this.phase = 'rest'; this.until = now + rand(4000, 9000); this.next = now + rand(9000, 15000); }
else if (r < 0.15) { this.phase = 'daze'; this.until = now + rand(2000, 5000); this.next = now + rand(5000, 9000); }
else if (r < 0.25) { this.phase = 'shift'; this.until = now + rand(1500, 3500); this.next = now + rand(2500, 4500); }
else {
this.phase = 'casting'; this.until = now + rand(800, 1500); this.castAt = now; this.biteAt = now + rand(3000, 8000); this.next = this.biteAt;
}
},
resolve: function (now) {
switch (this.phase) {
case 'casting': this.phase = 'waiting'; this.until = this.biteAt; this.next = this.biteAt; break;
case 'waiting':
this.phase = 'biting'; this.until = now + rand(900, 1800); this.next = this.until; break;
case 'biting':
if (Math.random() < 0.8) {
const item = rollTaItem();
sfxCatch();
taCaught(item);
} else {
sfxMiss();
statusText(taWord() + ' 的鱼跑了…');
}
this.phase = 'idle'; this.next = now + rand(1500, 4000); break;
default: this.phase = 'idle'; this.next = now + rand(1500, 3500);
}
}
};
};
resetTa();
function taCaught(item) {
if (item.cat === 'gift') {
const g = loadGifts();
g.unshift({ id: item.id, ts: Date.now() });
saveGifts(g);
sfxGift();
const note = giftNoteFor(item);
statusText(taWord() + ' 钓到了 ' + item.icon + ' ' + item.name + '，并把它送给了你。');
if (note) sendTaLine(fit('TA：') + note, true); // #1515 空寄语＝不发言（赠送照常）
} else {
const t = loadToday();
t.ta[item.id] = (t.ta[item.id] || 0) + 1; saveToday(t);
markDex(item);
statusText(taWord() + ' 钓到了 ' + item.icon + ' ' + item.name);
maybeTaCook(item.id);
if (item.giftNote === 'flower' && Math.random() < 0.5) {
const note = giftNoteFor(item);
setTimeout(function () { if (note) sendTaLine(fit('TA：') + note, false); }, 700); // #1515 空寄语＝不发言
} else if (item.r >= 4 && Math.random() < 0.5) {
setTimeout(function () { sendTaLine(fit('TA：') + pick(TA_PROUD), false); }, 600);
} else if (Math.random() < 0.3) {
setTimeout(function () { sendTaLine(fit('TA：') + pick(TA_HAPPY), false); }, 600);
}
}
}
const TA_HAPPY = ['钓到了！', '今天运气不错。', '这条给你看看。', '嘿嘿，上钩了。'];
const TA_PROUD = ['难得的收获呢。', '这条很漂亮吧。', '好久没钓到这么好的了。'];
const TA_COMFORT = ['没事，再试一次。', '鱼很狡猾的。', '别灰心，慢慢来。', '跑掉的总是比较大的。'];
function sendTaLine(text, glow) {
try { if (window.chatAddIn) window.chatAddIn(glow ? '💝 ' + text : text, { silent: true }); } catch (e) {}
}
const TOGETHER_GOAL = 300; // 秒
function startTogetherTimer() {
stopTogetherTimer();
const t0 = loadTogether();
togetherSec = t0.sec; togetherRewarded = t0.rewarded;
togetherTimer = setInterval(function () {
if (!open) return;
const bothFishing = (mine.phase === 'waiting' || mine.phase === 'biting') && (ta.phase === 'casting' || ta.phase === 'waiting' || ta.phase === 'biting');
if (!bothFishing) return;
if (togetherRewarded) return;
togetherSec++;
if (togetherSec % 10 === 0) { const t = loadTogether(); t.sec = togetherSec; t.rewarded = !!togetherRewarded; saveTogether(t); }
if (togetherSec >= TOGETHER_GOAL) {
togetherRewarded = true;
const t = loadTogether(); t.sec = togetherSec; t.rewarded = true; saveTogether(t);
if (window.giftWalletChange) window.giftWalletChange(1314, 1314, '钓鱼陪伴奖励');
sfxGift();
toast('💕 陪伴奖励：一起钓鱼 5 分钟，心意币各 +¥13.14');
if (window.chatAddIn) { try { window.chatAddIn(fit('陪了我这么久，鱼都知道你不走了。') + '（陪伴奖励各 +¥13.14）', { silent: true }); } catch (e) {} }
}
}, 1000);
}
function stopTogetherTimer() {
if (togetherTimer) { clearInterval(togetherTimer); togetherTimer = null; }
if (togetherSec >= 0) { const t = loadTogether(); t.sec = togetherSec; t.rewarded = !!togetherRewarded; saveTogether(t); togetherSec = -1; togetherRewarded = null; }
}
function sellAll() {
const t = loadToday();
const keep = t.keep || {};
let total = 0, count = 0;
const sold = {};
['mine', 'ta'].forEach(function (side) {
Object.keys(t[side]).forEach(function (id) {
const it = ITEM_MAP[id];
if (!it || it.cat === 'gift') return;
if (keep[keepKey(side, id)]) return;
const n = t[side][id] || 0;
total += it.price * n; count += n;
sold[side] = sold[side] || {}; sold[side][id] = 1;
});
});
if (count === 0) { toast('没有可出售的收获（勾选「留」的不卖）'); return; }
if (fishCoinCap() >= 10400) { toast('今日钓鱼收入已达上限（¥104），明天再来卖吧'); return; }
Object.keys(sold).forEach(function (side) { Object.keys(sold[side]).forEach(function (id) { delete t[side][id]; }); });
Object.keys(t.keep).forEach(function (k) {
const i = k.indexOf(':');
const side = k.slice(0, i), id = k.slice(i + 1);
if (!t[side] || !t[side][id]) delete t.keep[k];
});
try { saveToday(t); } catch (e) { toast('出售失败：存储暂不可用'); return; }
const fishMult = (window.arcadeMult && window.arcadeMult('fishing')) || 1;
const realGot = grantFishCoin(total * fishMult, '钓鱼出售');
addStats({ totalEarned: realGot });
sfxSell();
toast('已出售 ' + count + ' 件，心意币各 +' + fenToStr(realGot) + (realGot < total ? '（已达今日上限）' : ''));
render();
}
function exchangeGift(idx) {
const g = loadGifts();
const item = g[idx]; if (!item) return;
g.splice(idx, 1); saveGifts(g);
if (window.giftWalletChange) window.giftWalletChange(520, 520, '纪念品兑换');
sfxSell();
toast('已兑换心意币各 +¥5.2');
render();
}
function cookKey() { return 'fishing-cook'; }
function loadCook() { const c = readJSON(cookKey(), null); return c && typeof c === 'object' ? c : { mine: [], ta: [], taWeek: { weekKey: '', count: 0 } }; }
function saveCook(c) { writeJSON(cookKey(), c); }
function weekKey() { const d = new Date(); const thu = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (4 - (d.getDay() || 7))); const wk = Math.ceil((((thu - new Date(thu.getFullYear(), 0, 1)) / 86400000) + 1) / 7); return d.getFullYear() + '-W' + wk; }
function taCookCountThisWeek() { const c = loadCook(); return (c.taWeek && c.taWeek.weekKey === weekKey()) ? c.taWeek.count : 0; }
function cookStatus(entry) {
const d = dishOf(entry.fishId); if (!d) return null;
const now = Math.floor(Date.now() / 1000), elapsed = now - entry.startedAt;
return { dish: d, done: elapsed >= d.cookSec, progress: Math.min(1, elapsed / d.cookSec), remainSec: Math.max(0, d.cookSec - elapsed), elapsed: elapsed };
}
function loadBox() { const a = readJSON('giftbox-items', null); return Array.isArray(a) ? a : []; }
function saveBox(a) { writeJSON('giftbox-items', a); }
const TA_COOK_WISH = ['给你尝尝。', '刚做好的，趁热吃。', '这道菜想让你试试。', '用心做的，希望你喜欢。'];
function cookMine(fishId) {
const d = dishOf(fishId); if (!d) { toast('这种鱼不能烹饪'); return; }
const t = loadToday();
if (!t.mine[fishId] || t.mine[fishId] < 1) { toast('今日没有这种鱼'); return; }
t.mine[fishId]--; if (t.mine[fishId] <= 0) delete t.mine[fishId]; saveToday(t);
const c = loadCook();
c.mine.push({ fishId: fishId, startedAt: Math.floor(Date.now() / 1000), quality: 'good' });
saveCook(c); sfxCast();
toast('开始烹饪 ' + d.emoji + ' ' + d.name + '，约 ' + Math.round(d.cookSec / 60) + ' 分钟');
render();
}
function sellDish(idx) {
const c = loadCook(); const entry = c.mine[idx]; if (!entry) return;
const st = cookStatus(entry); if (!st || !st.done) { toast('还没烹饪好'); return; }
const price = dishPrice(entry.fishId, entry.quality);
if (fishCoinCap() >= 10400) { toast('今日钓鱼收入已达上限（¥104），明天再卖吧'); return; }
c.mine.splice(idx, 1);
try { saveCook(c); } catch (e) { toast('出售失败：存储暂不可用'); return; }
const dishMult = (window.arcadeMult && window.arcadeMult('fishing')) || 1;
const realGot = grantFishCoin(price * dishMult, '烹饪出售');
addStats({ totalEarned: realGot }); sfxSell();
toast('出售 ' + st.dish.name + '，心意币各 +' + fenToStr(realGot) + (realGot < price ? '（已达今日上限）' : '')); render();
}
function sendDishToTa(idx) {
const c = loadCook(); const entry = c.mine[idx]; if (!entry) return;
const st = cookStatus(entry); if (!st || !st.done) { toast('还没烹饪好'); return; }
const price = dishPrice(entry.fishId, entry.quality);
c.mine.splice(idx, 1); saveCook(c);
if (window.recordGiftBox) window.recordGiftBox({ id: 'dish_' + entry.fishId, name: st.dish.name, emoji: st.dish.emoji, price: price / 100, cat: '菜肴' }, 'out', '给你尝尝我的手艺');
if (window.chatAddGift) window.chatAddGift({ side: 'out', special: 'dish', dishName: st.dish.name, dishEmoji: st.dish.emoji, dishWish: '给你尝尝', dishQuality: entry.quality, dishPrice: price / 100, ts: Date.now() });
sfxGift(); toast('已把 ' + st.dish.name + ' 送给 ' + taWord()); render();
}
function maybeTaCook(fishId) {
const d = dishOf(fishId); if (!d) return;
if (taCookCountThisWeek() >= 3) return;
if (Math.random() >= 0.08) return;
const c = loadCook();
if (c.taWeek.weekKey !== weekKey()) c.taWeek = { weekKey: weekKey(), count: 0 };
c.taWeek.count++;
c.ta.push({ fishId: fishId, startedAt: Math.floor(Date.now() / 1000), quality: 'good' });
saveCook(c); statusText(taWord() + ' 开始烹饪 ' + d.emoji + ' ' + d.name + '…');
}
function checkTaCookDone() {
const c = loadCook(); if (!c.ta.length) return;
let changed = false;
for (let i = c.ta.length - 1; i >= 0; i--) {
const entry = c.ta[i]; const st = cookStatus(entry); if (!st || !st.done) continue;
const d = st.dish; const price = dishPrice(entry.fishId, entry.quality);
c.ta.splice(i, 1); changed = true;
if (Math.random() < 0.8) {
if (window.recordGiftBox) window.recordGiftBox({ id: 'dish_' + entry.fishId, name: d.name, emoji: d.emoji, price: price / 100, cat: '菜肴' }, 'in', pick(TA_COOK_WISH));
if (window.chatAddGift) window.chatAddGift({ side: 'in', special: 'dish', dishName: d.name, dishEmoji: d.emoji, dishWish: pick(TA_COOK_WISH), dishQuality: entry.quality, dishPrice: price / 100, ts: Date.now() });
sfxGift(); toast('💕 ' + taWord() + ' 烹饪了 ' + d.emoji + ' ' + d.name + ' 送给你！');
} else { statusText(taWord() + ' 烹饪了 ' + d.name + '，自己吃了'); }
}
if (changed) saveCook(c);
}
function eatDish(boxIdx) {
const box = loadBox(); const item = box[boxIdx]; if (!item) return;
const eatPrice = Math.round((item.price || 0) * 100 * 0.5);
box.splice(boxIdx, 1); saveBox(box);
if (window.giftWalletChange) window.giftWalletChange(eatPrice, 0, '吃掉收到的菜');
sfxSell(); toast('吃掉 ' + item.name + '，心意币 +¥' + fenToStr(eatPrice)); render();
}
let lastNotice = '';
function statusText(t) {
if (!statusEl) return;
statusEl.textContent = t;
lastNotice = t;
statusEl.dataset.keep = '1';
clearTimeout(statusEl._keepT);
statusEl._keepT = setTimeout(function () {
if (!statusEl) return;
delete statusEl.dataset.keep;
if (open) render();
}, 2500);
}
function updateTimingVisual(p) {
if (!timingWrapEl) return;
timingWrapEl.hidden = false;
if (timingCursorEl) timingCursorEl.style.left = (p * 100).toFixed(1) + '%';
}
function render() {
checkTaCookDone();
if (partnerNameEl) partnerNameEl.textContent = taWord();
const sc = sceneEl;
if (sc) {
sc.setAttribute('data-mine', mine.phase);
sc.setAttribute('data-ta', ta.phase);
const taStateEl = sc.querySelector('.fish-ta-state'); if (taStateEl) taStateEl.textContent = taStateLabel();
}
const bitting = mine.phase === 'biting';
if (castBtn) {
const waiting = mine.phase === 'waiting';
castBtn.hidden = bitting;
castBtn.disabled = waiting;
castBtn.textContent = waiting ? '等待鱼漂…' : '抛竿';
}
if (reelBtn) reelBtn.hidden = !bitting;
if (timingWrapEl) timingWrapEl.hidden = !bitting;
if (statusEl && !statusEl.dataset.keep) {
if (mine.phase === 'waiting') statusEl.textContent = '鱼漂已下水，等 TA 咬钩…';
else if (mine.phase === 'idle' && curTab === 'today') { if (statusEl.textContent !== lastNotice) statusEl.textContent = lastNotice; }
}
renderPage();
}
function taStateLabel() {
switch (ta.phase) {
case 'casting': return '抛竿';
case 'waiting': return '静静等';
case 'biting': return '有鱼！';
case 'rest': return '休息';
case 'daze': return '发呆';
case 'shift': return '换位置';
default: return '待着';
}
}
function renderPage() {
if (!pageEl) return;
let key;
if (curTab === 'today') key = 'today:' + JSON.stringify(loadToday()) + ':' + fishCoinCap();
else if (curTab === 'dex') key = 'dex:' + JSON.stringify(loadDex()) + ':' + JSON.stringify(loadStats());
else if (curTab === 'cook') {
const ck2 = loadCook();
key = 'cook:' + JSON.stringify(loadToday()) + JSON.stringify(loadBox()) + ':'
+ ck2.mine.map(function (e) { const s = cookStatus(e); return s ? (e.fishId + (s.done ? 'd' : 'c')) : ''; }).join(',')
+ ':' + ck2.ta.map(function (e) { const s = cookStatus(e); return s ? (e.fishId + (s.done ? 'd' : 'c')) : ''; }).join(',');
}
else key = 'gifts:' + JSON.stringify(loadGifts());
if (key === _lastPageKey) { if (curTab === 'cook') updateCookProgress(); return; }
_lastPageKey = key;
if (curTab === 'today') pageEl.innerHTML = renderToday();
else if (curTab === 'dex') pageEl.innerHTML = renderDex();
else if (curTab === 'cook') pageEl.innerHTML = renderCook();
else if (curTab === 'gifts') pageEl.innerHTML = renderGifts();
}
function updateCookProgress() {
if (!pageEl) return;
const c = loadCook();
const fills = pageEl.querySelectorAll('.fish-cook-row:not(.done) .fish-cook-fill');
const cnts = pageEl.querySelectorAll('.fish-cook-row:not(.done) .fish-cnt');
const entries = [];
c.mine.forEach(function (e) { const s = cookStatus(e); if (s && !s.done) entries.push(s); });
c.ta.forEach(function (e) { const s = cookStatus(e); if (s && !s.done) entries.push(s); });
for (let i = 0; i < entries.length && i < fills.length; i++) {
if (fills[i]) fills[i].style.width = Math.round(entries[i].progress * 100) + '%';
const remain = entries[i].remainSec;
if (cnts[i]) cnts[i].textContent = remain >= 60 ? Math.ceil(remain / 60) + '分' : remain + '秒';
}
}
function renderToday() {
const t = loadToday();
const keep = t.keep || {};
let total = 0, count = 0;
function rows(side) {
const m = t[side] || {};
const ids = Object.keys(m);
if (!ids.length) return '<div class="fish-empty">还没有收获</div>';
let html = '';
ids.forEach(function (id) {
const it = ITEM_MAP[id]; if (!it) return;
const n = m[id];
const p = it.price * n;
const sellable = it.cat !== 'gift';
const kept = !!keep[keepKey(side, id)];
if (sellable && !kept) { total += p; count += n; }
html += '<div class="fish-row"><span class="fish-ico">' + it.icon + '</span><span class="fish-name">' + esc(it.name) + (it.cat === 'gift' ? '<i class="fish-gift-tag">已收藏</i>' : '') + '</span><span class="fish-cnt">×' + n + '</span>' + (sellable ? '<label class="fish-keep"><input type="checkbox" class="fish-keep-cb" data-side="' + side + '" data-id="' + id + '"' + (kept ? ' checked' : '') + '><span>留</span></label><span class="fish-price">+' + fenToStr(p) + '</span>' : '<span class="fish-price">纪念</span>') + '</div>';
});
return html;
}
const capUsed = fishCoinCap();
const html =
'<div class="fish-sub">今日收获</div>' +
'<div class="fish-subhead">你</div>' + rows('mine') +
'<div class="fish-subhead">' + esc(taWord()) + '</div>' + rows('ta') +
'<div class="fish-sellbar">' + (count ? '<span>可出售 ' + count + ' 件 · <b>+' + fenToStr(total) + '</b> 心意币（勾「留」不卖）</span>' : '<span>没有可出售的收获</span>') + '<button class="fish-sell" id="fish-sell-btn"' + (count ? '' : ' disabled') + '>出售</button></div>' +
(capUsed > 0 ? '<div class="fish-capnote">今日售出所得 ¥' + fenToStr(capUsed) + ' / 上限 ¥104（出售+烹饪共用，明日重置）</div>' : '');
return html;
}
function renderDex() {
const d = loadDex();
let html = '<div class="fish-sub">我的鱼图鉴</div><div class="fish-dex-grid">';
ITEMS.forEach(function (it) {
const got = !!d[it.id];
html += '<div class="fish-dex-item' + (got ? ' got' : '') + '"><span class="fish-dex-ico">' + (got ? it.icon : '?') + '</span><span class="fish-dex-name">' + esc(it.name) + '</span>' + (got ? '<span class="fish-dex-check">✓</span>' : '') + '</div>';
});
html += '</div>';
const gotCount = Object.keys(d).length;
html += '<div class="fish-dex-foot">已发现 ' + gotCount + ' / ' + ITEMS.length + '</div>';
const st = loadStats();
html += '<div class="fish-stats">累计抛竿 <b>' + st.totalCast + '</b> · 完美收竿 <b>' + st.perfectCatch + '</b> · 累计赚 <b>¥' + fenToStr(st.totalEarned) + '</b></div>';
return html;
}
function renderGifts() {
const g = loadGifts();
const html =
'<div class="fish-sub">TA 送我的东西</div>' +
(g.length ? g.map(function (item, idx) {
const it = ITEM_MAP[item.id]; if (!it) return '';
return '<div class="fish-row"><span class="fish-ico">' + it.icon + '</span><span class="fish-name">' + esc(it.name) + '</span><span class="fish-gift-ts">' + esc(fmtTs(item.ts)) + '</span><button class="fish-exch" data-idx="' + idx + '">兑换 ¥5.20</button></div>';
}).join('') : '<div class="fish-empty">TA 还没送你东西，继续一起钓鱼吧～</div>');
return html;
}
function renderCook() {
const c = loadCook();
let html = '<div class="fish-sub">厨房</div>';
html += '<div class="fish-subhead">我的灶台</div>';
if (!c.mine.length) html += '<div class="fish-empty">灶台空着，从下面选鱼烹饪</div>';
c.mine.forEach(function (entry, idx) {
const st = cookStatus(entry); if (!st) return;
const it = ITEM_MAP[entry.fishId];
if (st.done) {
const price = dishPrice(entry.fishId, entry.quality);
html += '<div class="fish-cook-row done"><span class="fish-ico">' + st.dish.emoji + '</span><span class="fish-name">' + esc(st.dish.name) + '<i class="fish-cook-tag">已出锅</i></span><span class="fish-price">¥' + fenToStr(price) + '</span><button class="fish-cook-sell" data-idx="' + idx + '">出售</button><button class="fish-cook-send" data-idx="' + idx + '">送TA</button></div>';
} else {
const pct = Math.round(st.progress * 100);
html += '<div class="fish-cook-row"><span class="fish-ico">' + (it ? it.icon : '🐟') + '</span><span class="fish-name">烹饪 ' + esc(st.dish.name) + '</span><div class="fish-cook-bar"><div class="fish-cook-fill" style="width:' + pct + '%"></div></div><span class="fish-cnt">' + (st.remainSec >= 60 ? Math.ceil(st.remainSec / 60) + '分' : st.remainSec + '秒') + '</span></div>';
}
});
html += '<div class="fish-subhead">' + esc(taWord()) + ' 的灶台</div>';
if (!c.ta.length) html += '<div class="fish-empty">' + esc(taWord()) + ' 没在烹饪</div>';
c.ta.forEach(function (entry) {
const st = cookStatus(entry); if (!st) return;
const it = ITEM_MAP[entry.fishId];
if (st.done) {
html += '<div class="fish-cook-row done"><span class="fish-ico">' + st.dish.emoji + '</span><span class="fish-name">' + esc(st.dish.name) + '<i class="fish-cook-tag">已出锅</i></span></div>';
} else {
const pct = Math.round(st.progress * 100);
html += '<div class="fish-cook-row"><span class="fish-ico">' + (it ? it.icon : '🐟') + '</span><span class="fish-name">' + esc(taWord()) + ' 在烹饪 ' + esc(st.dish.name) + '</span><div class="fish-cook-bar"><div class="fish-cook-fill" style="width:' + pct + '%"></div></div><span class="fish-cnt">' + (st.remainSec >= 60 ? Math.ceil(st.remainSec / 60) + '分' : st.remainSec + '秒') + '</span></div>';
}
});
const t = loadToday();
const cookable = Object.keys(t.mine).filter(function (id) { return dishOf(id) && t.mine[id] > 0; });
if (cookable.length) {
html += '<div class="fish-subhead">可烹饪的鱼</div>';
cookable.forEach(function (id) {
const it = ITEM_MAP[id]; const d = dishOf(id);
html += '<div class="fish-cook-row"><span class="fish-ico">' + it.icon + '</span><span class="fish-name">' + esc(it.name) + ' → ' + esc(d.name) + '</span><span class="fish-cnt">×' + t.mine[id] + '</span><button class="fish-cook-btn" data-fish="' + id + '">烹饪' + Math.round(d.cookSec / 60) + '分</button></div>';
});
}
const box = loadBox(); const dishes = box.map(function (b, i) { return Object.assign({}, b, { _idx: i }); }).filter(function (b) { return b.side === 'in' && b.cat === '菜肴'; });
if (dishes.length) {
html += '<div class="fish-subhead">收到的菜（可吃掉换币）</div>';
dishes.forEach(function (b) {
html += '<div class="fish-cook-row"><span class="fish-ico">' + (b.emoji || '🍽️') + '</span><span class="fish-name">' + esc(b.name) + '</span><span class="fish-price">吃+¥' + fenToStr(Math.round((b.price || 0) * 100 * 0.5)) + '</span><button class="fish-eat-btn" data-idx="' + b._idx + '">吃掉</button></div>';
});
}
return html;
}
function fmtTs(ts) { const d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
if (castBtn) castBtn.addEventListener('click', function (e) { e.stopPropagation(); castMine(); });
if (reelBtn) reelBtn.addEventListener('click', function (e) { e.stopPropagation(); reelMine(); });
if (soundBtn) soundBtn.addEventListener('click', function (e) { e.stopPropagation(); setSoundOn(!soundOn, true); });
if (pageEl) pageEl.addEventListener('click', function (e) {
const sell = e.target.closest && e.target.closest('#fish-sell-btn');
if (sell) { e.stopPropagation(); sellAll(); return; }
const exch = e.target.closest && e.target.closest('.fish-exch');
if (exch) { e.stopPropagation(); exchangeGift(parseInt(exch.getAttribute('data-idx'), 10)); return; }
const cookBtn = e.target.closest && e.target.closest('.fish-cook-btn');
if (cookBtn) { e.stopPropagation(); cookMine(cookBtn.getAttribute('data-fish')); return; }
const cookSell = e.target.closest && e.target.closest('.fish-cook-sell');
if (cookSell) { e.stopPropagation(); sellDish(parseInt(cookSell.getAttribute('data-idx'), 10)); return; }
const cookSend = e.target.closest && e.target.closest('.fish-cook-send');
if (cookSend) { e.stopPropagation(); sendDishToTa(parseInt(cookSend.getAttribute('data-idx'), 10)); return; }
const eatBtn = e.target.closest && e.target.closest('.fish-eat-btn');
if (eatBtn) { e.stopPropagation(); eatDish(parseInt(eatBtn.getAttribute('data-idx'), 10)); return; }
});
if (pageEl) pageEl.addEventListener('change', function (e) {
const cb = e.target.closest && e.target.closest('.fish-keep-cb');
if (!cb) return;
e.stopPropagation();
const t = loadToday();
const key = keepKey(cb.getAttribute('data-side'), cb.getAttribute('data-id'));
if (cb.checked) t.keep[key] = 1; else delete t.keep[key];
saveToday(t);
render();
});
tabEls.forEach(function (tab) {
tab.addEventListener('click', function (e) {
e.stopPropagation();
curTab = tab.getAttribute('data-ftab');
tabEls.forEach(function (x) { x.classList.toggle('sel', x === tab); });
render();
});
});
panel.querySelector('.fish-close').addEventListener('click', function (e) { e.stopPropagation(); closeFishPanel(); });
const FISH_SIBLING_IDS = ['poke-card', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-pong-panel', 'chat-snake-panel', 'chat-brick-panel', 'chat-c4-panel', 'chat-memory-panel', 'chat-ms-panel', 'chat-more-panel'];
function hideSiblings() {
FISH_SIBLING_IDS.forEach(function (id) { const el = document.getElementById(id); if (el && el !== panel) el.hidden = true; });
try { if (window.closeAvlib) window.closeAvlib(); } catch (e) {}
}
(function bindFishMutual() {
try {
if (!window.MutationObserver) return;
const mo = new MutationObserver(function () {
if (!panel || panel.hidden || !window.closeFishPanel) return;
for (let i = 0; i < FISH_SIBLING_IDS.length; i++) {
const el = document.getElementById(FISH_SIBLING_IDS[i]);
if (el && !el.hidden) { try { window.closeFishPanel(); } catch (e) {} break; }
}
});
FISH_SIBLING_IDS.forEach(function (id) { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
} catch (e) {}
})();
window.openFishPanel = function () {
try { if (isFs) toggleFs(); } catch (e) {}
if (!panel) return;
hideSiblings();
resetTa();
resetMine();
panel.hidden = false;
open = true;
if (partnerNameEl) partnerNameEl.textContent = taWord();
stopTaTimer();
taTimer = setInterval(taStep, 1200);
startTogetherTimer();
try { const sp = readJSON('fishing-sound', null); if (sp && typeof sp.on === 'boolean') setSoundOn(sp.on, false); } catch (e) {}
statusEl.dataset.keep = '1';
statusEl.textContent = '你和 ' + taWord() + ' 在水边坐下，点「抛竿」开始。';
render();
};
window.closeFishPanel = function () {
open = false;
stopTaTimer();
stopTogetherTimer();
if (timingRafId) { cancelAnimationFrame(timingRafId); timingRafId = null; }
stopMineTimer();
resetMine(); resetTa();
if (statusEl) delete statusEl.dataset.keep;
if (panel) panel.hidden = true;
};
function stopTaTimer() { if (taTimer) { clearInterval(taTimer); taTimer = null; } }
function stopMineTimer() { if (mine && mine._tm) { clearTimeout(mine._tm); mine._tm = null; } }
document.addEventListener('contact-switched', function () { try { closeFishPanel(); } catch (e) {} });
window.__fishDebug = {
state: function () { return { open: open, mine: mine && mine.phase, ta: ta && ta.phase, today: loadToday(), dex: loadDex(), gifts: loadGifts(), together: loadTogether(), wallet: (window.giftWalletGet ? window.giftWalletGet() : null) }; },
forceBite: function () { if (mine.phase === 'waiting') { clearTimeout(mine._tm); startBiting(); } return mine.phase; },
reelAt: function (p, force) {
if (mine.phase !== 'biting') return false;
mine.progress = p;
if (force) {
const q = (p >= 0.38 && p <= 0.68) ? 'perfect' : ((p >= 0.2 && p < 0.38) || (p > 0.68 && p <= 0.85)) ? 'good' : 'poor';
const item = rollFish(q);
if (timingRafId) { cancelAnimationFrame(timingRafId); timingRafId = null; }
gainMine(item); flashScene(true, item);
statusText((q === 'perfect' ? '完美收竿！钓到了 ' : '收竿！钓到了 ') + item.icon + ' ' + item.name);
mine.phase = 'idle'; mine.progress = null; render();
return true;
}
reelMine(); return true;
},
addTaGift: function (id) { const g = loadGifts(); g.unshift({ id: id || 'gift_shell', ts: Date.now() }); saveGifts(g); renderPage(); return true; }
};
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("fishing.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("fishing.js"); try { console.error("[JS] fishing.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[fishing.js] " + String(__e && __e.message || __e)); } })();

;/* ==== memory-game.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-memory-panel');
if (!panel) return;
const boardEl = document.getElementById('memory-board');
const stageEl = document.querySelector('#chat-memory-panel .mgm-stage');
const overlayEl = document.getElementById('memory-overlay');
const overlayTitleEl = document.getElementById('memory-overlay-title');
const overlayBodyEl = document.getElementById('memory-overlay-body');
const overlayBtnEl = document.getElementById('memory-overlay-btn');
const overlayBtn2El = document.getElementById('memory-overlay-btn2');
const diffSel = document.getElementById('memory-diff');
const soundBtn = document.getElementById('memory-sound');
const closeBtn = document.getElementById('memory-close');
const fsBtn = document.getElementById('memory-fs');
let isFs = false;
function toggleFs() {
isFs = !isFs;
panel.classList.toggle('game-fs', isFs);
if (fsBtn) fsBtn.textContent = isFs ? '⤢' : '⛶';
setTimeout(() => { try { if (typeof fitBoard === 'function') fitBoard(); } catch (e) {} }, 60);
}
if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
const partnerNameEl = document.getElementById('memory-partner-name');
const turnEl = document.getElementById('memory-turn');
const chemEl = document.getElementById('memory-chem');
const coinEl = document.getElementById('memory-coin');
const hintEl = document.getElementById('memory-hint');
function T(x) { return (window.taFit ? window.taFit(x) : x); }
function partnerName() { return (typeof window.chatPartnerName === 'function') ? window.chatPartnerName() : 'TA'; }
function shuffle(arr) {
const a = arr.slice();
for (let i = a.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
const t = a[i]; a[i] = a[j]; a[j] = t;
}
return a;
}
function pick(arr) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''; }
function todayKey() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function storeKey(suf) { return (window.activePrefix ? window.activePrefix() : 'xy-home-v2:default') + ':' + suf; }
const DIFFS = {
casual: { label: '休闲', opt: '🌱 休闲 3×4',  cols: 4, rows: 3, pairs: 6,  memory: 0.60, pause: [520, 900] },
normal: { label: '普通', opt: '🌙 普通 4×4',  cols: 4, rows: 4, pairs: 8,  memory: 0.80, pause: [460, 780] },
hard:   { label: '挑战', opt: '⭐ 挑战 4×5',  cols: 5, rows: 4, pairs: 10, memory: 0.95, pause: [400, 660] },
king:   { label: '王者', opt: '👑 王者 6×5',  cols: 6, rows: 5, pairs: 15, memory: 0.97, pause: [360, 600] },
legend: { label: '传奇', opt: '🏆 传奇 6×7',  cols: 7, rows: 6, pairs: 21, memory: 0.98, pause: [320, 540] }
};
function curDiff() { return DIFFS[(diffSel && diffSel.value) || 'normal'] || DIFFS.normal; }
function syncDiffSel() {
if (!diffSel) return;
const want = String(diffSel.value || 'normal');
diffSel.innerHTML = '';
for (const k in DIFFS) {
const o = document.createElement('option');
o.value = k; o.textContent = DIFFS[k].opt;
if (k === want) o.selected = true;
diffSel.appendChild(o);
}
if (!DIFFS[want]) diffSel.value = 'normal';
}
syncDiffSel();
const THEMES = {
night:   { ico: '🌙', name: '星夜', faces: ['🌙', '⭐', '🌸', '🍓', '🐟', '🍀', '☁️', '🦋', '🍑', '🌊', '✨', '🔮', '🧸', '🎈', '🍭', '🐰', '🐱', '🦄', '🌈', '💌', '🍩', '🐥', '⛄', '🍬'] },
dessert: { ico: '🧁', name: '甜品', faces: ['🍰', '🧁', '🍩', '🍪', '🍫', '🍬', '🍭', '🍮', '🍦', '🧇', '🥞', '🍓', '🍯', '🫖', '☕', '🧋', '🥐', '🥨', '🥯', '🧈', '🍞', '🍥', '🍡', '🥮'] },
ocean:   { ico: '🌊', name: '海洋', faces: ['🐬', '🐟', '🐠', '🦈', '🐙', '🦀', '🐡', '🦐', '🐳', '🐚', '🌊', '⛵', '🪸', '⭐', '🫧', '🦞', '🦑', '🦦', '🦭', '🐢', '⚓', '🎣', '🚤', '💧'] }
};
const THEME_ORDER = Object.keys(THEMES);
let themeKey = 'night';
function themeFaces() { return (THEMES[themeKey] || THEMES.night).faces; }
function loadTheme() {
try { const t = localStorage.getItem(storeKey('memory-theme')); if (THEMES[t]) themeKey = t; } catch (e) {}
}
const themeBtnEl = (function () {
if (!soundBtn || !soundBtn.parentNode) return null;
const b = document.createElement('button');
b.type = 'button';
b.className = 'snake-icon-btn';
b.id = 'memory-theme';
b.addEventListener('click', (e) => {
e.stopPropagation();
themeKey = THEME_ORDER[(THEME_ORDER.indexOf(themeKey) + 1) % THEME_ORDER.length];
try { localStorage.setItem(storeKey('memory-theme'), themeKey); } catch (e2) {}
syncThemeBtn();
if (!game) buildPreview();   // 未开局换预览牌墙；对局中不换面（防读牌记忆串图案）
beep(520, 0.06, 0.07);
});
soundBtn.parentNode.insertBefore(b, soundBtn);
return b;
})();
function syncThemeBtn() {
if (!themeBtnEl) return;
const th = THEMES[themeKey] || THEMES.night;
themeBtnEl.textContent = th.ico;
themeBtnEl.title = '牌面主题：' + th.name + '（点击切换）';
}
loadTheme();
syncThemeBtn();
const YUAN = 100;
const COIN_CLEAR = 5;      // 完成一局 +5
const COIN_STREAK = 1;     // 连续配对每次 +1
const COIN_ALL = 2;        // 全部完成 +2
const COIN_FIRST = 5;      // 首次通关某难度 +5
const COIN_DAILY_CAP = 30; // 每日奖励上限（元）
function walletGet() {
const s = window.xyStore && window.xyStore('xy-home-v2');
if (!s) return { myBalance: 52000, systemBalance: 52000 };
try {
const w = JSON.parse(s.get('gift-wallet') || '');
if (typeof w.myBalance === 'number' && typeof w.systemBalance === 'number') return w;
} catch (e) {}
let seed = { myBalance: 52000, systemBalance: 52000 }; // v3.15.x：默认对齐 ¥520/¥520
try {
const o = JSON.parse(s.get('rp-wallet') || '');
if (typeof o.myBalance === 'number' && typeof o.systemBalance === 'number') seed = { myBalance: o.myBalance, systemBalance: o.systemBalance };
} catch (e) {}
try { s.set('gift-wallet', JSON.stringify(seed)); } catch (e) {}
return seed;
}
function walletSet(w) { const s = window.xyStore && window.xyStore('xy-home-v2'); if (s) s.set('gift-wallet', JSON.stringify(w)); }
function readDaily() {
try { const o = JSON.parse(localStorage.getItem(storeKey('memory-coin-day')) || ''); if (o && typeof o.total === 'number') return o; } catch (e) {}
return { date: todayKey(), total: 0 };
}
function writeDaily(o) { try { localStorage.setItem(storeKey('memory-coin-day'), JSON.stringify(o)); } catch (e) {} }
function readFirst() {
try { return String(localStorage.getItem(storeKey('memory-first-clears')) || '').split(',').filter(Boolean); } catch (e) { return []; }
}
function writeFirst(list) { try { localStorage.setItem(storeKey('memory-first-clears'), Array.isArray(list) ? list.join(',') : ''); } catch (e) {} }
function readStats() {
try { const o = JSON.parse(localStorage.getItem(storeKey('memory-stats')) || ''); if (o && typeof o === 'object') return Object.assign({ bestChem: 0, clears: 0 }, o); } catch (e) {}
return { bestChem: 0, clears: 0 };
}
function writeStats(o) { try { localStorage.setItem(storeKey('memory-stats'), JSON.stringify(o)); } catch (e) {} }
function grantCoins(yuan) {
const daily = readDaily();
if (daily.date !== todayKey()) { daily.date = todayKey(); daily.total = 0; }
const capFen = COIN_DAILY_CAP * YUAN;
const remain = Math.max(0, capFen - daily.total);
const grantFen = Math.min(Math.round(yuan * YUAN), remain);
if (grantFen > 0) {
daily.total += grantFen;
try { localStorage.setItem(storeKey('memory-coin-day'), JSON.stringify(daily)); } catch (e) { return 0; }
if (window.giftWalletChange) window.giftWalletChange(grantFen, grantFen, '记忆翻牌');
else {
const w = walletGet();
w.myBalance = (w.myBalance || 0) + grantFen;
walletSet(w);
}
}
return grantFen;
}
let audioCtx = null, soundOn = true;
function beep(freq, dur, vol) {
if (!soundOn) return;
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(function () {});
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = 'sine';
g.gain.value = vol || 0.08;
o.connect(g); g.connect(audioCtx.destination);
const t = audioCtx.currentTime;
o.start(t); g.gain.setValueAtTime(g.gain.value, t);
g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.08));
o.stop(t + (dur || 0.08));
} catch (e) {}
}
function sfxFlip() { beep(480, 0.05, 0.07); }
function sfxMatch() { beep(660, 0.1, 0.09); setTimeout(() => beep(880, 0.12, 0.09), 90); }
function sfxMiss() { beep(300, 0.12, 0.06); }
let game = null;
let timers = [];
function newGame(diff) {
const d = DIFFS[diff] || DIFFS.normal;
const faces = shuffle(themeFaces()).slice(0, d.pairs);
const cards = shuffle(faces.concat(faces)).map((face, idx) => ({
id: idx, face: face, matched: false, flipped: false, owner: null
}));
return {
diff: diff || 'normal',
params: d,
cards: cards,
turn: Math.random() < 0.5 ? 'player' : 'ta',
phase: 'idle',          // idle | resolving | ended
first: null, second: null,
myPairs: 0, taPairs: 0,
myFlips: 0, taFlips: 0,
chemistry: 50,
streak: 0, streakOwner: null,
coinFen: 0,             // 连续配对累计（分）
known: {},              // TA 记忆：face -> [id...]
lastPlayerFace: null, lastTaFace: null
};
}
function applyBoardLayout(d) {
if (!boardEl) return;
boardEl.style.gridTemplateColumns = 'repeat(' + d.cols + ', 1fr)';
boardEl.style.setProperty('--mgm-fs', d.cols <= 3 ? '32px' : d.cols === 4 ? '27px' : d.cols === 5 ? '23px' : d.cols === 6 ? '20px' : '18px');
}
function fitBoard() {
if (!boardEl || !panel || panel.hidden || !stageEl) return;
const d = game ? game.params : curDiff();
const COLS = d.cols, ROWS = d.rows, GAP = 7;
const sw = stageEl.clientWidth;
if (isFs && sw > 0) {
let cell = Math.floor((sw - (COLS - 1) * GAP) / COLS);
const sh = stageEl.clientHeight;
if (sh > 0) cell = Math.max(24, Math.min(cell, Math.floor((sh - (ROWS - 1) * GAP) / (ROWS * 1.36))));
boardEl.style.width = (COLS * cell + (COLS - 1) * GAP) + 'px';
boardEl.style.setProperty('--mgm-fs', Math.round(cell * 0.5) + 'px');
} else {
boardEl.style.width = '';
applyBoardLayout(d);
}
}
function makeCardEl(face, idx, withClick) {
const b = document.createElement('button');
b.type = 'button';
b.className = 'mgm-card';
b.dataset.idx = String(idx);
b.setAttribute('aria-label', '第 ' + (idx + 1) + ' 张牌');
b.innerHTML = '<span class="mgm-in"><span class="mgm-back"><i>✦</i></span><span class="mgm-face">' + face + '</span></span>';
if (withClick) b.addEventListener('click', () => onCardClick(idx));
return b;
}
function buildBoard(g) {
if (!boardEl) return;
applyBoardLayout(g.params);
boardEl.innerHTML = '';
g.cards.forEach((card, idx) => boardEl.appendChild(makeCardEl(card.face, idx, true)));
fitBoard();
}
function buildPreview() {
if (!boardEl) return;
const d = curDiff();
const faces = shuffle(themeFaces()).slice(0, d.pairs);
const cards = shuffle(faces.concat(faces));
applyBoardLayout(d);
boardEl.innerHTML = '';
cards.forEach((face, idx) => boardEl.appendChild(makeCardEl(face, idx, false)));
fitBoard();
}
function syncCard(idx) {
const g = game;
if (!g) return;
const card = g.cards[idx];
const el = boardEl.querySelector('.mgm-card[data-idx="' + idx + '"]');
if (!el) return;
el.classList.toggle('flipped', card.flipped || card.matched);
el.classList.toggle('matched', card.matched);
el.classList.toggle('mgm-own-p', card.matched && card.owner === 'player');
el.classList.toggle('mgm-own-t', card.matched && card.owner === 'ta');
}
function renderInfo() {
const g = game;
if (!g) return;
if (turnEl) {
if (g.phase === 'ended') turnEl.textContent = '本局完成';
else if (g.turn === 'player') turnEl.textContent = '轮到你了';
else turnEl.textContent = T('TA') + ' 的回合';
}
if (chemEl) chemEl.textContent = '💕 默契 ' + Math.min(100, Math.round(g.chemistry));
if (coinEl) coinEl.textContent = '心意币 +' + Math.round(g.coinFen / YUAN);
}
function hint(text) { if (hintEl) hintEl.textContent = text || ''; }
function flipCard(card) { card.flipped = true; taObserve(card); }
function taObserve(card) {
const g = game;
if (!g || card.matched) return;
if (Math.random() > g.params.memory) return;      // 这次没记住
if (!g.known[card.face]) g.known[card.face] = [];
const arr = g.known[card.face];
if (arr.indexOf(card.id) < 0) arr.push(card.id);
}
function availableCards(g) { return g.cards.filter(c => !c.matched && !c.flipped); }
function cardById(id) { const g = game; return g ? g.cards[id] : null; }
function findKnownPair(g) {
for (const face in g.known) {
const arr = g.known[face];
if (arr.length >= 2) {
const cards = arr.map(cardById).filter(c => c && !c.matched && !c.flipped);
if (cards.length >= 2) return { a: cards[0], b: cards[1] };
}
}
return null;
}
function findOtherKnown(g, face) {
const arr = g.known[face] || [];
for (const id of arr) {
const c = cardById(id);
if (c && !c.matched && !c.flipped) return c;
}
return null;
}
function taPickFirst(g) {
const avail = availableCards(g);
if (!avail.length) return null;
const knownPair = findKnownPair(g);
if (knownPair) return knownPair.a;                 // ①发现配对 / 记错（第二张决定记没记对）
return pick(avail);                                // ②③随便翻 / 顺着线索碰运气
}
function taPickSecond(g, first) {
const avail = availableCards(g);                   // 已排除 first（flipped=true）
if (!avail.length) return null;
const knownPair = findKnownPair(g);
if (knownPair && knownPair.a === first) {
if (Math.random() < g.params.memory) return knownPair.b;         // 记对
return pick(avail.filter(c => c !== knownPair.b));               // ④记错：选错一张
}
const other = findOtherKnown(g, first.face);
if (other && Math.random() < g.params.memory) return other;        // 记得 first 的另一半
return pick(avail);
}
function fastMode() { return !!(window.__mgmDebug && window.__mgmDebug.fast); }
function randPause() {
if (fastMode()) return 60 + Math.random() * 80;
const p = game ? game.params.pause : [500, 800]; return p[0] + Math.random() * (p[1] - p[0]);
}
function scheduleTa() {
const g = game;
if (!g || g.phase !== 'idle' || g.turn !== 'ta') return;
timers.push(setTimeout(() => {
if (!game || game !== g || g.turn !== 'ta' || g.phase !== 'idle') return;
const first = taPickFirst(g);                    // ③犹豫：翻第一张前等待
if (!first) return;
flipCard(first); g.first = first;
syncCard(first.id);
sfxFlip();
hint(T('TA') + '翻开了 ' + first.face);
if (first.face === g.lastPlayerFace) hint(T('TA') + '记得你刚翻过的 ' + first.face + '…');
timers.push(setTimeout(() => {
if (!game || game !== g || g.turn !== 'ta' || g.phase !== 'idle') return;
const second = taPickSecond(g, first);
if (!second) return;
flipCard(second); g.second = second;
syncCard(second.id);
sfxFlip();
resolveTurn();
}, randPause()));
}, randPause()));
}
function resolveTurn() {
const g = game;
if (!g || !g.first || !g.second) return;
const f = g.first, s = g.second;
const me = g.turn;
const match = f.face === s.face;
if (me === 'player') { g.myFlips += 2; g.lastPlayerFace = f.face; }
else { g.taFlips += 2; g.lastTaFace = f.face; }
g.first = g.second = null;
if (match) {
f.matched = s.matched = true;
f.owner = s.owner = me;
if (me === 'player') g.myPairs++; else g.taPairs++;
g.chemistry += 4;                                 // 配对成功
if (g.streakOwner === me) { g.streak++; g.chemistry += 2; g.coinFen += COIN_STREAK * YUAN; }
else { g.streak = 1; g.streakOwner = me; }
if (me === 'ta' && f.face === g.lastPlayerFace) g.chemistry += 3;   // ⑥TA 找到你刚翻过的
if (me === 'player' && f.face === g.lastTaFace) g.chemistry += 3;   // 你找到 TA 刚翻过的
sfxMatch();
syncCard(f.id); syncCard(s.id);
renderInfo();
if (g.myPairs + g.taPairs >= g.params.pairs) {
endGame();
return;
}
g.phase = 'idle';
setTurn(me);
if (me === 'player') hint('配对成功！再来一次');
else { hint(T('TA') + '又找到一对'); scheduleTa(); }
} else {
g.chemistry = Math.max(0, g.chemistry - 3);       // 翻错：不扣太多
g.streak = 0; g.streakOwner = null;
sfxMiss();
g.phase = 'resolving';
hint('不一样…盖回去了');
timers.push(setTimeout(() => {
if (!game) return;
f.flipped = s.flipped = false;
syncCard(f.id); syncCard(s.id);
g.phase = 'idle';
g.lastPlayerFace = me === 'player' ? f.face : g.lastPlayerFace;
const next = me === 'player' ? 'ta' : 'player';
setTurn(next);
if (next === 'ta') { hint(T('TA') + '的回合'); scheduleTa(); }
else hint('轮到你了');
}, fastMode() ? 120 : 760));
}
}
function setTurn(who) {
const g = game;
if (!g) return;
g.turn = who;
renderInfo();
}
function endGame() {
const g = game;
if (!g || g.phase === 'ended') return;
g.phase = 'ended';
stopTimers();
g.chemistry = Math.max(0, Math.min(100, Math.round(g.chemistry + 5)));   // 全部完成 +5
const firsts = readFirst();
const firstClear = firsts.indexOf(g.diff) < 0;
if (firstClear) { firsts.push(g.diff); writeFirst(firsts); }
const totalYuan = COIN_CLEAR + Math.round(g.coinFen / YUAN) + COIN_ALL + (firstClear ? COIN_FIRST : 0);
const memMult = (window.arcadeMult && window.arcadeMult('memory')) || 1;
const grantedYuan = Math.round(grantCoins(totalYuan * memMult) / YUAN);
let memDrop = null;
try {
if (window.arcadeMarkLuckyPlayed) window.arcadeMarkLuckyPlayed('memory');
if (window.arcadeTryDrop) memDrop = window.arcadeTryDrop('memory');
} catch (e) {}
const stats = readStats();
stats.clears = (stats.clears || 0) + 1;
stats.bestChem = Math.max(stats.bestChem || 0, g.chemistry);
writeStats(stats);
renderInfo();
if (overlayTitleEl) overlayTitleEl.textContent = '🎉 完成！';
if (overlayBodyEl) {
overlayBodyEl.innerHTML =
'<div class="pong-end-score">找到 ' + g.params.pairs + ' / ' + g.params.pairs + ' 对</div>' +
'<div class="pong-end-stat">你　配对 ' + g.myPairs + ' · 翻牌 ' + g.myFlips + ' 次</div>' +
'<div class="pong-end-stat">' + T('TA') + '　配对 ' + g.taPairs + ' · 翻牌 ' + g.taFlips + ' 次</div>' +
'<div class="memory-res-chem">💕 默契 ' + g.chemistry + '</div>' +
'<div class="memory-res-coin">获得心意币 +' + grantedYuan + (grantedYuan < totalYuan * memMult ? '（今日奖励已达上限 +' + COIN_DAILY_CAP + '）' : (firstClear ? '（首次通关' + g.params.label + '）' : '')) + '</div>' +
'<div class="pong-end-stat">累计完成 ' + stats.clears + ' 局 · 历史最佳默契 ' + stats.bestChem + '</div>' +
(memDrop ? '<div class="pong-end-stat">🎁 掉落限定摆件「' + memDrop.name + '」</div>' : '');
}
if (overlayBtnEl) overlayBtnEl.textContent = '再玩一局';
if (overlayBtn2El) { overlayBtn2El.textContent = '返回小游戏'; overlayBtn2El.hidden = false; }
if (overlayEl) overlayEl.hidden = false;
try {
if (window.chatAddSystem) {
window.chatAddSystem('记忆翻牌 · 你 ' + g.myPairs + ' 对 · ' + T('TA') + ' ' + g.taPairs + ' 对 · 默契 ' + g.chemistry, { special: 'memory' });
}
const pool = window.getInteractPool
? window.getInteractPool('游戏平局·回应', ['一起找完了。', '好默契呀。', '差不多嘛。', '再来一局？'])
: ['一起找完了。', '好默契呀。'];
const say = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ''; // #1515 整组停用＝静默（记忆翻牌）
if (say) setTimeout(() => {
try { if (window.chatAddIn) window.chatAddIn(say, { silent: true }); } catch (e) {}
}, 800);
} catch (e) {}
}
function showStartOverlay() {
const d = curDiff();
if (overlayTitleEl) overlayTitleEl.textContent = '记忆翻牌';
if (overlayBodyEl) {
overlayBodyEl.innerHTML =
'<div class="pong-start-tip">和 ' + T('TA') + ' 一起，把藏起来的牌全部找出来</div>' +
'<div class="pong-start-ctrl">' + d.label + ' · ' + d.cols + '×' + d.rows + ' · ' + d.pairs + ' 对 · 轮流翻两张</div>' +
'<div class="pong-start-ctrl">配对成功再来一次 · 结束记默契与心意币</div>';
}
if (overlayBtnEl) overlayBtnEl.textContent = '开始';
if (overlayBtn2El) overlayBtn2El.hidden = true;
if (overlayEl) overlayEl.hidden = false;
}
function startGame(diff) {
stopTimers();
game = newGame(diff || ((diffSel && diffSel.value) || 'normal'));
buildBoard(game);
renderInfo();
if (overlayEl) overlayEl.hidden = true;
if (game.turn === 'player') hint('轮到你了 · 翻开两张牌');
else { hint(T('TA') + '先开始…'); scheduleTa(); }
}
function stopTimers() {
timers.forEach(t => clearTimeout(t));
timers = [];
}
function onCardClick(idx) {
const g = game;
if (!g || g.phase !== 'idle') return;
if (g.turn !== 'player') { hint(T('TA') + '翻牌中 · 等它翻完'); return; }
const card = g.cards[idx];
if (!card || card.matched || card.flipped) return;
flipCard(card);
sfxFlip();
if (!g.first) {
g.first = card;
hint('再翻一张');
} else {
g.second = card;
resolveTurn();
}
syncCard(idx);
renderInfo();
}
window.openMemoryPanel = function () {
try { if (isFs) toggleFs(); } catch (e) {}
if (!panel) return;
if (partnerNameEl) {
try {
const s = window.activeStore && window.activeStore();
partnerNameEl.textContent = (s && (s.get('lbl-partner') || s.get('cs-lbl-partner'))) || (window.taWord ? window.taWord() : 'TA');
} catch (e) { partnerNameEl.textContent = partnerName(); }
}
stopTimers();
game = null;
buildPreview();
if (turnEl) turnEl.textContent = '';
if (chemEl) chemEl.textContent = '💕 默契 —';
if (coinEl) coinEl.textContent = '心意币 +0';
hint('');
showStartOverlay();
panel.hidden = false;
};
window.closeMemoryPanel = function () {
stopTimers();
game = null;
if (panel) panel.hidden = true;
};
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); window.closeMemoryPanel(); });
if (overlayBtnEl) overlayBtnEl.addEventListener('click', (e) => { e.stopPropagation(); startGame(); });
if (overlayBtn2El) overlayBtn2El.addEventListener('click', (e) => { e.stopPropagation(); window.closeMemoryPanel(); });
if (diffSel) {
diffSel.addEventListener('change', () => {
stopTimers();
game = null;
showStartOverlay();
buildPreview();
});
}
if (soundBtn) {
soundBtn.addEventListener('click', () => {
soundOn = !soundOn;
soundBtn.textContent = soundOn ? '🔊' : '🔇';
soundBtn.classList.toggle('pong-sound-off', !soundOn);
});
}
document.addEventListener('contact-switched', () => { try { window.closeMemoryPanel(); } catch (e) {} });
window.addEventListener('resize', () => { try { if (!panel.hidden) fitBoard(); } catch (e) {} });
if (panel) panel.addEventListener('pointerdown', function () {
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(function () {});
} catch (e) {}
}, { capture: true });
(function bindEntry() {
const btn = document.getElementById('more-memory');
if (!btn) return;
btn.addEventListener('click', (e) => {
e.stopPropagation();
const mp = document.getElementById('chat-more-panel');
if (mp) mp.hidden = true;
const hideIds = ['poke-card', 'emoji-panel', 'chat-search', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-snake-panel', 'chat-pong-panel', 'chat-brick-panel', 'chat-fish-panel', 'chat-c4-panel'];
hideIds.forEach((id) => { const el = document.getElementById(id); if (el) el.hidden = true; });
try { if (window.closeAvlib) window.closeAvlib(); } catch (err) {}
try { if (window.closePongPanel) window.closePongPanel(); } catch (err) {}
try { if (window.closeC4Panel) window.closeC4Panel(); } catch (err) {}
try { if (window.closeFishPanel) window.closeFishPanel(); } catch (err) {}
try { window.openMemoryPanel(); } catch (err) {
try { panel.hidden = false; } catch (e2) {}
try { console.error('[memory] open failed', err); } catch (e2) {}
}
});
try {
if (window.MutationObserver) {
const SIBLING_IDS = ['poke-card', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-pong-panel', 'chat-snake-panel', 'chat-brick-panel', 'chat-fish-panel', 'chat-c4-panel', 'chat-more-panel'];
const mo = new MutationObserver(() => {
if (panel.hidden) return;
for (let i = 0; i < SIBLING_IDS.length; i++) {
const el = document.getElementById(SIBLING_IDS[i]);
if (el && !el.hidden) { window.closeMemoryPanel(); break; }
}
});
SIBLING_IDS.forEach((id) => { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
}
} catch (e) {}
})();
window.__mgmDebug = {
st: () => game,
fast: false
};
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("memory-game.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("memory-game.js"); try { console.error("[JS] memory-game.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[memory-game.js] " + String(__e && __e.message || __e)); } })();

;/* ==== gomoku.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-gomoku-panel');
if (!panel) return;
const boardEl = document.getElementById('gk-board');
const stageEl = document.getElementById('gk-stage');
const statusEl = document.getElementById('gk-status');
const overlayEl = document.getElementById('gk-overlay');
const ovTitleEl = document.getElementById('gk-ov-title');
const ovBodyEl = document.getElementById('gk-ov-body');
const startBtn = document.getElementById('gk-btn-start');
const endBtn = document.getElementById('gk-btn-end');
const soundBtn = document.getElementById('gk-sound');
const undoBtn = document.getElementById('gk-undo');
const closeBtn = document.getElementById('gk-close');
const fsBtn = document.getElementById('gk-fs');
const diffSel = document.getElementById('gk-diff');   // FIX 2026-09-16：头部难度下拉（对局中也可换），原只藏在结算/开始覆盖层的 pills 里
let isFs = false;
function toggleFs() {
isFs = !isFs;
panel.classList.toggle('game-fs', isFs);
if (fsBtn) fsBtn.textContent = isFs ? '⤢' : '⛶';
setTimeout(() => { try { if (typeof fitBoard === 'function') fitBoard(); } catch (e) {} }, 60);
}
if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
const partnerNameEl = document.getElementById('gk-partner-name');
const sideNameEl = document.getElementById('gk-side-name');
const N = 11;                       // 11×11 迷你盘
const THINK_MIN = 550, THINK_VAR = 700;
const DIFFS = {
casual: {
label: '休闲', tip: 'TA 让着你，轻松玩',
w: { normal: 0.35, serious: 0.05, sandbag: 0.35, blunder: 0.25 },
take: { serious: 0.7, normal: 0.4, sandbag: 0.2, blunder: 0.25 },
block: { serious: 0.6, normal: 0.4, sandbag: 0.15, blunder: 0.12 },
floor: 4
},
daily: {
label: '日常', tip: 'TA 像普通人，时好时坏',
w: { normal: 0.5, serious: 0.2, sandbag: 0.15, blunder: 0.15 },
take: { serious: 0.95, normal: 0.6, sandbag: 0.25, blunder: 0.3 },
block: { serious: 0.9, normal: 0.62, sandbag: 0.22, blunder: 0.18 },
floor: 3
},
serious: {
label: '认真', tip: 'TA 想赢，有挑战',
w: { normal: 0.35, serious: 0.55, sandbag: 0.05, blunder: 0.05 },
take: { serious: 0.98, normal: 0.8, sandbag: 0.4, blunder: 0.5 },
block: { serious: 0.96, normal: 0.82, sandbag: 0.4, blunder: 0.45 },
floor: 2
}
};
const DIFF_ORDER = ['casual', 'daily', 'serious'];
let selDiff = 'daily';
const THINK_LINES = ['TA正在想……', 'TA盯着棋盘看了一会儿', 'TA托着下巴琢磨'];
const T = window.taFit || function (x) { return x; };
function prefix() { return (window.activePrefix && window.activePrefix()) || 'xy-home-v2'; }
function fastMul() { return (window.__gkDebug && window.__gkDebug.fast) ? 0.05 : 1; }
function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
let audioCtx = null, soundOn = true;
function beep(freq, dur, vol) {
if (!soundOn) return;
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const play = () => {
try {
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = 'sine';
g.gain.value = vol || 0.16;
o.connect(g); g.connect(audioCtx.destination);
const t = audioCtx.currentTime;
g.gain.setValueAtTime(g.gain.value, t);
g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
o.start(t); o.stop(t + dur);
} catch (e) {}
};
if (audioCtx.state === 'running') { play(); return; }
const r = audioCtx.resume();
if (r && r.then) r.then(play).catch(() => play());
else play();
} catch (e) {}
}
const sfxDropYou = () => beep(340, 0.09, 0.18);
const sfxDropTa = () => beep(262, 0.09, 0.18);
const sfxBad = () => beep(180, 0.06, 0.12);
const sfxWin = () => { beep(660, 0.14, 0.2); setTimeout(() => beep(880, 0.2, 0.2), 130); };
const sfxLose = () => { beep(300, 0.14, 0.18); setTimeout(() => beep(220, 0.2, 0.18), 130); };
const sfxDraw = () => beep(440, 0.12, 0.16);
let st = null;
let thinkT = null;
let ovT = null;               // #341 胜利连线动画播完再弹结果浮层的定时器
let cellPx = 30;
function newState() {
return {
grid: [],                 // grid[r][c]：0 空 / 1 玩家(🔵黑) / 2 TA(⚪白)
turn: 1,
over: false,
started: false,
moves: 0,
winCells: null,
mode: 'normal',           // TA 本回合行为状态（每回合重抽）
lastPlayer: null,         // 玩家最后一手（失误状态贴着下）
lastTaPt: null,
missedBlocks: 0,          // 玩家成五点被无视的连续次数（底线计数）
undoUsed: false           // #301 悔棋每局 1 次
};
}
function newGrid() {
const g = [];
for (let r = 0; r < N; r++) { g.push(new Array(N).fill(0)); }
return g;
}
function statsKey() { return prefix() + ':gomoku-stats'; }
function loadStats() {
const d = { w: 0, l: 0, d: 0, nextFirst: 'you', lastDiff: 'daily' };
try {
const raw = localStorage.getItem(statsKey());
if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object') return Object.assign(d, v); }
} catch (e) {}
return d;
}
function saveStats(s) { try { localStorage.setItem(statsKey(), JSON.stringify(s)); } catch (e) {} }
function statsLine() {
const s = loadStats();
return '累计战绩 你 ' + s.w + '胜 · ' + T('TA') + ' ' + s.l + '胜 · ' + s.d + '平';
}
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
function inBoard(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
function winLineAt(grid, r, c, side) {
for (let d = 0; d < DIRS.length; d++) {
const dr = DIRS[d][0], dc = DIRS[d][1];
const cells = [[r, c]];
for (let s = -1; s <= 1; s += 2) {
let rr = r + dr * s, cc = c + dc * s;
while (inBoard(rr, cc) && grid[rr][cc] === side) {
cells.push([rr, cc]);
rr += dr * s; cc += dc * s;
}
}
if (cells.length >= 5) return cells;
}
return null;
}
function isFull() { return st.moves >= N * N; }
function lineScore(grid, r, c, side) {
let score = 0;
for (let d = 0; d < DIRS.length; d++) {
const dr = DIRS[d][0], dc = DIRS[d][1];
let cnt = 1, open = 0;
let rr = r + dr, cc = c + dc;
while (inBoard(rr, cc) && grid[rr][cc] === side) { cnt++; rr += dr; cc += dc; }
if (inBoard(rr, cc) && grid[rr][cc] === 0) open++;
rr = r - dr; cc = c - dc;
while (inBoard(rr, cc) && grid[rr][cc] === side) { cnt++; rr -= dr; cc -= dc; }
if (inBoard(rr, cc) && grid[rr][cc] === 0) open++;
if (cnt >= 5) score += 100000;
else if (cnt === 4) score += open === 2 ? 50000 : (open === 1 ? 8000 : 0);
else if (cnt === 3) score += open === 2 ? 6000 : (open === 1 ? 500 : 0);
else if (cnt === 2) score += open === 2 ? 300 : (open === 1 ? 60 : 0);
else score += open === 2 ? 20 : 4;
}
return score;
}
function evalPt(grid, r, c) {
return lineScore(grid, r, c, 2) + lineScore(grid, r, c, 1) * 0.9;
}
function candidates(grid) {
const out = [];
let any = false;
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
if (grid[r][c] !== 0) { any = true; break; }
}
if (!any) return [[Math.floor(N / 2), Math.floor(N / 2)]];
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
if (grid[r][c] !== 0) continue;
let near = false;
for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) {
const rr = r + dr, cc = c + dc;
if (inBoard(rr, cc) && grid[rr][cc] !== 0) { near = true; break; }
}
if (near) out.push([r, c]);
}
return out;
}
function fivePoints(grid, side, cands) {
const list = cands || candidates(grid);
return list.filter((p) => lineScore(grid, p[0], p[1], side) >= 100000);
}
function pickTaPt(mode) {
const grid = st.grid;
const cands = candidates(grid);
if (!cands.length) return null;
const myFive = fivePoints(grid, 2, cands);
const pFive = fivePoints(grid, 1, cands);
const take = DIFFS[selDiff].take, blk = DIFFS[selDiff].block;
let pt = null;
if (mode === 'serious') {
if (myFive.length && Math.random() < take.serious) pt = pick(myFive);
else if (pFive.length && Math.random() < blk.serious) pt = pick(pFive);
} else if (mode === 'normal') {
if (myFive.length && Math.random() < take.normal) pt = pick(myFive);
else if (pFive.length && Math.random() < blk.normal) pt = pick(pFive);
}
if (!pt && mode !== 'sandbag' && mode !== 'blunder') {
const scored = cands.map((p) => ({ p: p, s: evalPt(grid, p[0], p[1]) }));
scored.sort((a, b) => b.s - a.s);
if (mode === 'serious') {
let best = scored[0];
for (let i = 1; i < Math.min(3, scored.length); i++) {
if (scored[i].s > best.s * (0.95 + Math.random() * 0.1)) best = scored[i];
}
pt = best.p;
} else {
pt = pick(scored.slice(0, Math.min(3, scored.length)).map((x) => x.p));
}
}
if (!pt && mode === 'sandbag') {
let pool = cands.slice();
if (myFive.length && Math.random() < 0.8) pool = pool.filter((p) => myFive.indexOf(p) < 0);
if (pFive.length && Math.random() < 0.75) pool = pool.filter((p) => pFive.indexOf(p) < 0);
const scored = pool.map((p) => ({ p: p, s: evalPt(grid, p[0], p[1]) }));
scored.sort((a, b) => b.s - a.s);
pool = scored.slice(3).map((x) => x.p);
pt = pool.length ? pick(pool) : null;
}
if (!pt && mode === 'blunder') {
if (st.lastPlayer && Math.random() < 0.7) {
const near = [];
for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
const rr = st.lastPlayer[0] + dr, cc = st.lastPlayer[1] + dc;
if (inBoard(rr, cc) && grid[rr][cc] === 0) near.push([rr, cc]);
}
if (near.length) pt = pick(near);
}
}
if (!pt) pt = pick(cands);
return pt;
}
function applyFloor(pt) {
const cands = candidates(st.grid);
const pFive = fivePoints(st.grid, 1, cands);
const myFive = fivePoints(st.grid, 2, cands);
const isBlock = pFive.some((p) => p[0] === pt[0] && p[1] === pt[1]);
const isWin = myFive.some((p) => p[0] === pt[0] && p[1] === pt[1]);
if (!isBlock && !isWin && pFive.length) {
st.missedBlocks++;
if (st.missedBlocks > DIFFS[selDiff].floor) return pick(pFive);
}
if (isBlock) st.missedBlocks = 0;
return pt;
}
function rollMode() {
const w = DIFFS[selDiff].w;
const r = Math.random();
if (r < w.normal) return 'normal';
if (r < w.normal + w.serious) return 'serious';
if (r < w.normal + w.serious + w.sandbag) return 'sandbag';
return 'blunder';
}
function buildBoard() {
boardEl.innerHTML = '';
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
const cell = document.createElement('div');
cell.className = 'gk-cell';
cell.setAttribute('data-r', String(r));
cell.setAttribute('data-c', String(c));
boardEl.appendChild(cell);
}
}
function fitBoard() {
if (!stageEl || panel.hidden) return;
const w = stageEl.clientWidth;
if (!w) return;
cellPx = Math.max(24, Math.min(40, Math.floor(w / N)));
boardEl.style.width = (cellPx * N) + 'px';
boardEl.style.height = (cellPx * N) + 'px';
const cells = boardEl.querySelectorAll('.gk-cell');
for (let i = 0; i < cells.length; i++) { cells[i].style.width = cellPx + 'px'; cells[i].style.height = cellPx + 'px'; }
}
function cellAt(r, c) {
const i = r * N + c;
return boardEl.children[i] || null;
}
function drawStone(r, c, side) {
const cell = cellAt(r, c);
if (!cell) return;
cell.querySelectorAll('.gk-stone.gk-vanish').forEach((s) => s.remove());
const s = document.createElement('span');
s.className = 'gk-stone ' + (side === 1 ? 'gk-you' : 'gk-ta') + ' gk-drop';
cell.appendChild(s);
}
function markLast(r, c) {
boardEl.querySelectorAll('.gk-last').forEach((el) => el.classList.remove('gk-last'));
const cell = cellAt(r, c);
if (cell) { const s = cell.querySelector('.gk-stone'); if (s) s.classList.add('gk-last'); }
}
function highlightWin(cells) {
st.winCells = cells;
cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
for (let i = 0; i < cells.length; i++) {
const cell = cellAt(cells[i][0], cells[i][1]);
if (cell) {
const s = cell.querySelector('.gk-stone');
if (s) { s.classList.add('gk-win'); s.style.setProperty('--gk-win-i', String(i)); }
}
}
boardEl.classList.add('gk-dim');
}
function setStatus(html) { if (statusEl) statusEl.innerHTML = html; }
let bubbleT = null;
function taSay(text) {
if (!stageEl) return;
try {
let b = stageEl.querySelector('.tg-bubble');
if (!b) { b = document.createElement('div'); b.className = 'tg-bubble'; stageEl.appendChild(b); }
b.textContent = text;
b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
clearTimeout(bubbleT);
bubbleT = setTimeout(() => { try { b.classList.remove('show'); } catch (e) {} }, 1600);
} catch (e) {}
}
function dot(side) { return '<i class="c4-dot ' + (side === 1 ? 'c4-dot-you' : 'c4-dot-ta') + '"></i>'; }
function showTurnStatus() {
if (!statusEl || !st || st.over) return;
setStatus(st.turn === 1 ? dot(1) + '你的回合' : T('TA') + '正在想……');
}
function clearBoardDom() {
boardEl.querySelectorAll('.gk-stone').forEach((s) => s.remove());
boardEl.classList.remove('gk-dim');
boardEl.querySelectorAll('.gk-win').forEach((el) => el.classList.remove('gk-win'));
boardEl.querySelectorAll('.gk-last').forEach((el) => el.classList.remove('gk-last'));
}
function newGame() {
clearTimeout(thinkT); thinkT = null;
clearTimeout(ovT);
st = newState();
st.grid = newGrid();
st.started = true;
clearBoardDom();
hideOverlay();
if (undoBtn) undoBtn.classList.remove('gk-undo-used');
const s = loadStats();
st.turn = s.nextFirst === 'ta' ? 2 : 1;
setStatus(st.turn === 1 ? dot(1) + '你的回合，点棋盘落子' : T('TA') + '先手');
if (st.turn === 2) scheduleTaMove(Math.max(THINK_MIN, 700));
}
function scheduleTaMove(delay) {
clearTimeout(thinkT);
const line = THINK_LINES[Math.floor(Math.random() * THINK_LINES.length)];
setStatus(T(line));
thinkT = setTimeout(taMove, Math.round(delay * fastMul()));
}
function taMove() {
if (!st || st.over || st.turn !== 2) return;
st.mode = rollMode();
const picked = pickTaPt(st.mode);
if (!picked) { endGame(0); return; }
const pt = applyFloor(picked);
const forced = pt[0] !== picked[0] || pt[1] !== picked[1];
st.grid[pt[0]][pt[1]] = 2;
st.moves++;
st.lastTaPt = pt;
sfxDropTa();
drawStone(pt[0], pt[1], 2);
markLast(pt[0], pt[1]);
if (forced) taSay(pick(['这手我不能装没看见～', '堵你！别想连五']));
const line = winLineAt(st.grid, pt[0], pt[1], 2);
if (line) { highlightWin(line); endGame(2); return; }
if (isFull()) { endGame(0); return; }
st.turn = 1;
showTurnStatus();
}
function playerDrop(r, c) {
if (!st || !st.started || st.over || st.turn !== 1) return;
if (st.grid[r][c] !== 0) { sfxBad(); return; }
st.grid[r][c] = 1;
st.moves++;
st.lastPlayer = [r, c];
sfxDropYou();
drawStone(r, c, 1);
markLast(r, c);
const line = winLineAt(st.grid, r, c, 1);
if (line) { highlightWin(line); endGame(1); return; }
if (isFull()) { endGame(0); return; }
st.turn = 2;
scheduleTaMove(THINK_MIN + Math.random() * THINK_VAR);
}
function undoMove() {
if (!st || !st.started || st.over || st.turn !== 1 || st.undoUsed) return;
if (!st.lastPlayer || !st.lastTaPt) return;
clearTimeout(thinkT); thinkT = null;
[st.lastTaPt, st.lastPlayer].forEach((p) => {
st.grid[p[0]][p[1]] = 0;
st.moves = Math.max(0, st.moves - 1);
const cell = cellAt(p[0], p[1]);
if (cell) {
const s = cell.querySelector('.gk-stone');
if (s) {
s.classList.add('gk-vanish');
setTimeout(() => { try { if (s.parentNode) s.parentNode.removeChild(s); } catch (e) {} }, Math.round(190 * fastMul()) + 30);
}
}
});
st.lastTaPt = null; st.lastPlayer = null; st.winCells = null;
st.undoUsed = true;
if (undoBtn) undoBtn.classList.add('gk-undo-used');
beep(440, 0.08, 0.14);
boardEl.querySelectorAll('.gk-last').forEach((el) => el.classList.remove('gk-last'));
setStatus(dot(1) + '已悔棋（每局 1 次），重新想');
}
function endGame(winner) {
st.over = true;
clearTimeout(thinkT); thinkT = null;
const s = loadStats();
if (winner === 1) { s.w++; s.nextFirst = 'ta'; }
else if (winner === 2) { s.l++; s.nextFirst = 'you'; }
else { s.d++; s.nextFirst = Math.random() < 0.5 ? 'you' : 'ta'; }
saveStats(s);
if (winner === 1) sfxWin(); else if (winner === 2) sfxLose(); else sfxDraw();
if (winner === 1) taSay(pick(['让你赢啦…', '下次没这么容易！']));
else if (winner === 2) taSay(pick(['五连，赢啦！', '承让承让～']));
var coinLine = '';
var dropLine = '';
var dropStat = '';   // #891：dropLine 是浮层用的 HTML，聊天卡片要纯文本版
try {
var COIN_CAP = 10400;
var dg = new Date();
var day = dg.getFullYear() + '-' + (dg.getMonth() + 1) + '-' + dg.getDate();
var ck = prefix() + ':ml2_coin_gomoku_' + day;
var cur = Number(localStorage.getItem(ck)) || 0;
if (cur < COIN_CAP) {
var mult = (typeof window.arcadeMult === 'function') ? window.arcadeMult('gomoku') : 1;
var winFen = Math.round((Math.random() < 0.2 ? 5200 : 1314) * mult);
var real = Math.min(winner === 0 ? Math.round(520 * mult) : winFen, COIN_CAP - cur);
try { localStorage.setItem(ck, String(cur + real)); } catch (e2) {}
if (real > 0 && typeof window.giftWalletChange === 'function') {
if (window.giftWalletChange(real, real, '五子棋')) {
if (typeof window.arcadeMarkLuckyPlayed === 'function') window.arcadeMarkLuckyPlayed('gomoku');
coinLine = '🪙 双方心意币各 +¥' + (real / 100).toFixed(2) + (mult > 1 ? '（🍀 幸运 ×2）' : '');
}
}
}
} catch (e) {}
if (winner === 1 && typeof window.arcadeTryDrop === 'function') {
try {
var dr = window.arcadeTryDrop('gomoku');
if (dr) { dropLine = '<div class="pong-end-stat">🌠 掉落限定摆件「' + dr.ico + ' ' + dr.name + '」！游乐室图鉴 +1</div>'; dropStat = '🌠 掉落限定摆件「' + dr.ico + ' ' + dr.name + '」'; taSay('哇，掉了「' + dr.name + '」！'); }
} catch (e) {}
}
const title = winner === 1 ? '🏆 你赢了！' : winner === 2 ? T('TA') + '赢了' : '平局';
const body =
'<div class="pong-end-stat">本局共 ' + st.moves + ' 手</div>' +
'<div class="pong-end-stat">' + statsLine() + '</div>' +
'<div class="pong-end-stat">下一局 ' + (s.nextFirst === 'you' ? '你' : T('TA')) + '先手</div>' +
(coinLine ? '<div class="pong-end-stat">' + coinLine + '</div>' : '') +
dropLine +
pillsHtml() +
'<div class="ms-cur" id="gk-cur">' + diffHint() + '</div>';
const showResult = () => {
showOverlay(title, body, '再来一局');
if (startBtn) startBtn.textContent = '再来一局';
if (endBtn) endBtn.hidden = false;
};
clearTimeout(ovT);
if (st.winCells && st.winCells.length) ovT = setTimeout(showResult, Math.round(1000 * fastMul()));
else showResult();
setStatus(winner === 1 ? '🎉 你赢了！' : winner === 2 ? T('TA') + '赢了这一局' : '棋盘下满了，平局');
try {
const resTxt = winner === 1 ? '你赢' : winner === 2 ? T('TA') + '赢' : '平局';
const gStats = ['本局共 ' + st.moves + ' 手', '累计战绩 你 ' + s.w + '胜 · {ta} ' + s.l + '胜 · ' + s.d + '平',
'下一局 ' + (s.nextFirst === 'you' ? '你' : '{ta}') + '先手'].concat(coinLine ? [coinLine] : []).concat(dropStat ? [dropStat] : []);
const gPayload = {
name: '五子棋',
outcome: winner === 1 ? 'win' : winner === 2 ? 'lose' : 'draw',
result: winner === 1 ? '你赢了！' : winner === 2 ? '{ta}赢了' : '平局',
stats: gStats
};
if (window.chatAddSystem) window.chatAddSystem(T('五子棋') + ' · ' + resTxt, { special: 'gomoku', game: gPayload });
const grp = winner === 1 ? '游戏失败·回应' : winner === 2 ? '游戏胜利·回应' : '游戏平局·回应';
const fb = winner === 1 ? ['让你赢啦，再来？'] : winner === 2 ? ['五连！我赢啦'] : ['平局，再来一局？'];
const pool = window.getInteractPool ? window.getInteractPool(grp, fb) : fb;
const say = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ''; // #1515 整组停用＝静默（五子棋）
const cidAtEnd = prefix();
if (say) setTimeout(() => {
if (prefix() !== cidAtEnd) return;
try { if (window.chatAddIn) window.chatAddIn(say, { silent: true }); } catch (e) {}
}, 800);
} catch (e) {}
}
function showOverlay(title, body, btnText) {
if (!overlayEl) return;
if (ovTitleEl) ovTitleEl.innerHTML = title || '';
if (ovBodyEl) ovBodyEl.innerHTML = body || '';
if (startBtn && btnText) startBtn.textContent = btnText;
overlayEl.hidden = false;
}
function showStartOverlay() {
const s = loadStats();
showOverlay('五子棋',
pillsHtml() +
'<div class="ms-cur" id="gk-cur">' + diffHint() + '</div>' +
'<div class="c4-start-tip">你执 🔵黑 · ' + T('TA') + '执 ⚪白<br>轮流落子，先连成五子的一方获胜</div>' +
'<div class="c4-start-note">🎲 ' + T('TA') + '每回合状态随机——认真/正常/放水/失误</div>' +
(s.w + s.l + s.d > 0 ? '<div class="pong-end-stat">' + statsLine() + '</div>' : ''),
s.w + s.l + s.d > 0 ? '再来一局' : '开始对局');
if (endBtn) endBtn.hidden = true;
}
function pillsHtml() {
return '<div class="ms-diffs">' + DIFF_ORDER.map((k) => {
const d = DIFFS[k];
return '<button class="ms-diff' + (k === selDiff ? ' on' : '') + '" data-diff="' + k + '" type="button" title="' + d.tip + '">' + d.label + '</button>';
}).join('') + '</div>';
}
function diffHint() { return '当前：' + DIFFS[selDiff].label + ' · ' + DIFFS[selDiff].tip; }
function hideOverlay() { if (overlayEl) overlayEl.hidden = true; if (endBtn) endBtn.hidden = true; }
buildBoard();   // 棋盘 DOM 只建一次（newGame 只清棋子不动结构）
boardEl.addEventListener('click', (e) => {
e.stopPropagation();
const cell = e.target.closest('.gk-cell');
if (!cell) return;
playerDrop(parseInt(cell.getAttribute('data-r'), 10) || 0, parseInt(cell.getAttribute('data-c'), 10) || 0);
});
if (startBtn) startBtn.addEventListener('click', (e) => { e.stopPropagation(); newGame(); });
if (undoBtn) undoBtn.addEventListener('click', (e) => { e.stopPropagation(); undoMove(); });
if (endBtn) endBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
if (ovBodyEl) ovBodyEl.addEventListener('click', (e) => {
const pill = e.target.closest('.ms-diff');
if (!pill) return;
e.stopPropagation();
const k = pill.getAttribute('data-diff');
if (!DIFFS[k]) return;
selDiff = k;
const stat = loadStats();
stat.lastDiff = k;
saveStats(stat);
const pills = ovBodyEl.querySelectorAll('.ms-diff');
pills.forEach((p) => { p.classList.toggle('on', p.getAttribute('data-diff') === k); });
const curEl = document.getElementById('gk-cur');
if (curEl) curEl.textContent = diffHint();
else { const c2 = ovBodyEl.querySelector('.ms-cur'); if (c2) c2.textContent = diffHint(); }
});
if (soundBtn) soundBtn.addEventListener('click', (e) => {
e.stopPropagation();
soundOn = !soundOn;
soundBtn.textContent = soundOn ? '🔊' : '🔇';
soundBtn.classList.toggle('pong-sound-off', !soundOn);
});
if (diffSel) diffSel.addEventListener('change', () => {
if (!DIFFS[diffSel.value]) return;
selDiff = diffSel.value;
const stat = loadStats();
stat.lastDiff = selDiff;
saveStats(stat);
const curEl = document.getElementById('gk-cur');
if (curEl) curEl.textContent = diffHint();
});
function setNames() {
let name = T('TA');
try {
const s = window.activeStore && window.activeStore();
name = (s && (s.get('lbl-partner') || s.get('cs-lbl-partner'))) || name;
} catch (e) {}
if (partnerNameEl) partnerNameEl.textContent = name;
if (sideNameEl) sideNameEl.textContent = name;
}
window.openGomokuPanel = function () {
try { if (isFs) toggleFs(); } catch (e) {}
if (!boardEl.children.length) { try { buildBoard(); } catch (e) {} }
panel.hidden = false;
try { const s = loadStats(); if (DIFFS[s.lastDiff]) selDiff = s.lastDiff; } catch (e) {}
try { if (diffSel && DIFFS[selDiff]) diffSel.value = selDiff; } catch (e) {}
try { setNames(); } catch (e) {}
try { fitBoard(); } catch (e) {}
if (st && st.started && !st.over) {
if (st.turn === 2 && !thinkT) scheduleTaMove(THINK_MIN + Math.random() * THINK_VAR);
else if (st.turn === 1) showTurnStatus();
return;
}
showStartOverlay();
setStatus('点击「开始对局」');
};
function closePanel() {
clearTimeout(thinkT); thinkT = null;
clearTimeout(ovT);
if (panel) panel.hidden = true;
}
window.closeGomokuPanel = closePanel;
document.addEventListener('contact-switched', () => { try { closePanel(); st = null; /* #548t */ } catch (e) {} });
window.addEventListener('resize', () => { if (!panel.hidden) fitBoard(); });
(function bindEntry() {
const btn = document.getElementById('more-gomoku');
if (!btn) return;
btn.addEventListener('click', (e) => {
e.stopPropagation();
const mp = document.getElementById('chat-more-panel');
if (mp) mp.hidden = true;
hideSiblingPanels(['chat-gomoku-panel']);
try { if (window.closeAvlib) window.closeAvlib(); } catch (err) {}
try { if (window.closePongPanel) window.closePongPanel(); } catch (err) {}
try { openGomokuPanel(); } catch (err) {
try { panel.hidden = false; showStartOverlay(); setStatus('点击「开始对局」'); } catch (e2) {}
try { console.error('[gomoku] open failed', err); } catch (e2) {}
}
});
try {
if (window.MutationObserver) {
const SIBLING_IDS = siblingIds('chat-gomoku-panel');
const mo = new MutationObserver(() => {
if (panel.hidden) return;
for (let i = 0; i < SIBLING_IDS.length; i++) {
const el = document.getElementById(SIBLING_IDS[i]);
if (el && !el.hidden && el.getClientRects().length > 0) { closePanel(); break; }
}
});
SIBLING_IDS.forEach((id) => { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
}
} catch (e) {}
})();
function siblingIds(self) {
return ['poke-card', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-pong-panel', 'chat-snake-panel', 'chat-brick-panel', 'chat-c4-panel', 'chat-ms-panel', 'chat-fish-panel', 'chat-memory-panel', 'chat-gift-panel', 'chat-gomoku-panel', 'chat-linkup-panel', 'chat-match3-panel', 'chat-auction-panel', 'chat-arcade-panel', 'chat-more-panel'].filter((id) => id !== self);
}
function hideSiblingPanels(self) {
siblingIds(self[0]).forEach((id) => { const el = document.getElementById(id); if (el) el.hidden = true; });
}
window.__gkDebug = {
st: () => st,
newGame: newGame,
winLineAt: winLineAt,
lineScore: lineScore,
evalPt: evalPt,
candidates: candidates,
fivePoints: fivePoints,
rollMode: rollMode,
pick: pickTaPt,                        // 纯函数：按 st.grid 选点（不改棋盘/计数）
floor: applyFloor,                     // 底线应用（会更新 missedBlocks）
fast: false
};
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("gomoku.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("gomoku.js"); try { console.error("[JS] gomoku.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[gomoku.js] " + String(__e && __e.message || __e)); } })();

;/* ==== linkup.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-linkup-panel');
if (!panel) return;
const boardEl = document.getElementById('lk-board');
const stageEl = document.getElementById('lk-stage');
const statusEl = document.getElementById('lk-status');
const infoEl = document.getElementById('lk-info');
const overlayEl = document.getElementById('lk-overlay');
const ovTitleEl = document.getElementById('lk-ov-title');
const ovBodyEl = document.getElementById('lk-ov-body');
const startBtn = document.getElementById('lk-btn-start');
const endBtn = document.getElementById('lk-btn-end');
const hintBtn = document.getElementById('lk-hint');
const shufBtn = document.getElementById('lk-shuffle');
const soundBtn = document.getElementById('lk-sound');
const closeBtn = document.getElementById('lk-close');
const fsBtn = document.getElementById('lk-fs');
let isFs = false;
function toggleFs() {
isFs = !isFs;
panel.classList.toggle('game-fs', isFs);
if (fsBtn) fsBtn.textContent = isFs ? '⤢' : '⛶';
setTimeout(() => { try { if (typeof fitBoard === 'function') fitBoard(); } catch (e) {} }, 60);
}
if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
const diffSel = document.getElementById('lk-diff');
const partnerNameEl = document.getElementById('lk-partner-name');
const DIFFS = {
casual: { rows: 5, cols: 6, kinds: 10, pairPerKind: 3, label: '🌱 休闲 6×5', coin: 520 },
normal: { rows: 6, cols: 8, kinds: 12, pairPerKind: 2, label: '🌙 普通 8×6', coin: 1314 },
hard:   { rows: 6, cols: 10, kinds: 15, pairPerKind: 2, label: '⭐ 挑战 10×6', coin: 5200 },
king:   { rows: 7, cols: 12, kinds: 21, pairPerKind: 2, label: '👑 王者 12×7', coin: 13140 },
legend: { rows: 8, cols: 12, kinds: 24, pairPerKind: 2, label: '🏆 传奇 12×8', coin: 33440 },
epic:   { rows: 9, cols: 12, kinds: 27, pairPerKind: 2, label: '🌋 史诗 12×9', coin: 52000 }
};
function syncDiffSel() {
if (!diffSel) return;
const want = String(diffSel.value || 'normal');
diffSel.innerHTML = '';
for (const k in DIFFS) {
const o = document.createElement('option');
o.value = k; o.textContent = DIFFS[k].label;
if (k === want) o.selected = true;
diffSel.appendChild(o);
}
if (!DIFFS[want]) diffSel.value = 'normal';
}
const THEMES = {
fruit:   { ico: '🍎', name: '水果', kinds: ['🍎', '🍐', '🍇', '🍒', '🍓', '🍑', '🍍', '🥝', '🍉', '🍌', '🧁', '🍰', '🍀', '🌈', '🐬', '🥑', '🍋', '🥭', '🫐', '🥥', '🌰', '🫒', '🎃', '🌻', '🥕', '🌶️', '🍄'] },
dessert: { ico: '🧁', name: '甜品', kinds: ['🍰', '🧁', '🍩', '🍪', '🍫', '🍬', '🍭', '🍮', '🍦', '🧇', '🥞', '🍓', '🍯', '🫖', '☕', '🧋', '🥐', '🥨', '🥯', '🧈', '🍞', '🍥', '🍡', '🥮', '🍹', '🥤', '🍧'] },
ocean:   { ico: '🌊', name: '海洋', kinds: ['🐬', '🐟', '🐠', '🦈', '🐙', '🦀', '🐡', '🦐', '🐳', '🐚', '🌊', '⛵', '🪸', '⭐', '🫧', '🦞', '🦑', '🦦', '🦭', '🐢', '⚓', '🎣', '🚤', '💧', '🧜', '🐋', '🦩'] },
animal:  { ico: '🦊', name: '动物', kinds: ['🐰', '🐱', '🐶', '🐭', '🐹', '🐻', '🐼', '🐨', '🦁', '🐮', '🐷', '🐸', '🐵', '🦊', '🐔', '🦆', '🦉', '🐧', '🦄', '🐝', '🦋', '🐞', '🐌', '🐢', '🐬', '🦜', '🐾'] },
bloom:   { ico: '🌷', name: '繁花', kinds: ['🌸', '🌹', '🌷', '🌻', '🌺', '💐', '🌼', '🌿', '🍀', '🌱', '🌵', '🎋', '🍁', '🍂', '🍃', '🌾', '🪷', '🪻', '🌴', '🌳', '🌲', '🍄', '🌰', '🥀', '🏵️', '💮', '🎄'] }
};
const THEME_ORDER = Object.keys(THEMES);
syncDiffSel();
let themeKey = 'fruit';
function themeKinds() { return (THEMES[themeKey] || THEMES.fruit).kinds; }
function themeBtn() { return document.getElementById('lk-theme'); }
const THINK_LINES = ['TA正在找能连的……', 'TA扫视着棋盘', 'TA歪头想了想'];
const TURN_MIN = 900, TURN_VAR = 800;
const T = window.taFit || function (x) { return x; };
function prefix() { return (window.activePrefix && window.activePrefix()) || 'xy-home-v2'; }
function fastMul() { return (window.__lkDebug && window.__lkDebug.fast) ? 0.05 : 1; }
function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
let audioCtx = null, soundOn = true;
function beep(freq, dur, vol) {
if (!soundOn) return;
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended' && audioCtx.resume) { const r = audioCtx.resume(); if (r && r.catch) r.catch(function () {}); }
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = 'sine';
g.gain.value = vol || 0.16;
o.connect(g); g.connect(audioCtx.destination);
const t = audioCtx.currentTime;
g.gain.setValueAtTime(g.gain.value, t);
g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
o.start(t); o.stop(t + dur);
} catch (e) {}
}
const sfxPick = () => beep(500, 0.06, 0.14);
const sfxMatch = () => { beep(620, 0.08, 0.16); setTimeout(() => beep(830, 0.1, 0.16), 70); };
const sfxBad = () => beep(180, 0.07, 0.12);
const sfxWin = () => { beep(660, 0.14, 0.2); setTimeout(() => beep(880, 0.2, 0.2), 130); };
let st = null;
let thinkT = null;
let hintClearT = null;      // FIX 2026-09-16：提示高亮自动清除定时器
let narrowTipShown = false; // FIX 2026-09-16：窄屏格宽跌破可读下限的一次性提示
function newState(diff) {
const d = DIFFS[diff];
return {
diff: diff,
rows: d.rows, cols: d.cols,
grid: [],                // grid[r][c] = 种类下标或 -1（已消除）
turn: 1,                 // 1 玩家 / 2 TA
over: false,
lock: false,             // #341 动画链进行中，锁输入
started: false,
sel: null,               // 玩家当前选中 [r,c]
remaining: 0,
totalPairs: 0,
myPairs: 0, taPairs: 0, misPicks: 0,
hints: 3, shuffles: 2,
seen: [],                // TA 的「记忆」：近期被翻看过的位置（滚动上限）
mode: 'smart',
combo: 0, maxCombo: 0    // #301 连击：连续配对次数（点错/提示断连）
};
}
function statsKey() { return prefix() + ':linkup-stats'; }
function loadStats() {
const d = { clears: 0, bestChem: 0, lastDiff: 'normal' };
try {
const raw = localStorage.getItem(statsKey());
if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object') return Object.assign(d, v); }
} catch (e) {}
return d;
}
function saveStats(s) { try { localStorage.setItem(statsKey(), JSON.stringify(s)); } catch (e) {} }
function at(st2, r, c) {
if (r < 0 || r >= st2.rows || c < 0 || c >= st2.cols) return -1;   // 棋盘外=空
return st2.grid[r][c];
}
function empty(st2, r, c) { return at(st2, r, c) === -1; }
function lineClear(st2, r1, c1, r2, c2) {
if (r1 === r2) {
const lo = Math.min(c1, c2), hi = Math.max(c1, c2);
for (let c = lo + 1; c < hi; c++) { if (!empty(st2, r1, c)) return false; }
return true;
}
if (c1 === c2) {
const lo = Math.min(r1, r2), hi = Math.max(r1, r2);
for (let r = lo + 1; r < hi; r++) { if (!empty(st2, r, c1)) return false; }
return true;
}
return false;
}
function findPath(st2, a, b) {
const va = at(st2, a[0], a[1]), vb = at(st2, b[0], b[1]);
if (va < 0 || vb < 0 || va !== vb) return null;
if (a[0] === b[0] && a[1] === b[1]) return null;
if ((a[0] === b[0] || a[1] === b[1]) && lineClear(st2, a[0], a[1], b[0], b[1])) return [a.slice(), b.slice()];
const c1 = [a[0], b[1]], c2 = [b[0], a[1]];
if (empty(st2, c1[0], c1[1]) && lineClear(st2, a[0], a[1], c1[0], c1[1]) && lineClear(st2, c1[0], c1[1], b[0], b[1])) return [a.slice(), c1.slice(), b.slice()];
if (empty(st2, c2[0], c2[1]) && lineClear(st2, a[0], a[1], c2[0], c2[1]) && lineClear(st2, c2[0], c2[1], b[0], b[1])) return [a.slice(), c2.slice(), b.slice()];
for (let x = -1; x <= st2.cols; x++) {
if (empty(st2, a[0], x) && empty(st2, b[0], x) &&
lineClear(st2, a[0], a[1], a[0], x) && lineClear(st2, a[0], x, b[0], x) && lineClear(st2, b[0], x, b[0], b[1])) return [a.slice(), [a[0], x], [b[0], x], b.slice()];
}
for (let y = -1; y <= st2.rows; y++) {
if (empty(st2, y, a[1]) && empty(st2, y, b[1]) &&
lineClear(st2, a[0], a[1], y, a[1]) && lineClear(st2, y, a[1], y, b[1]) && lineClear(st2, y, b[1], b[0], b[1])) return [a.slice(), [y, a[1]], [y, b[1]], b.slice()];
}
return null;
}
function connected(st2, a, b) { return !!findPath(st2, a, b); }
function allPairs(st2) {
const cells = [];
for (let r = 0; r < st2.rows; r++) for (let c = 0; c < st2.cols; c++) {
if (st2.grid[r][c] >= 0) cells.push([r, c]);
}
const out = [];
for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
if (st2.grid[cells[i][0]][cells[i][1]] !== st2.grid[cells[j][0]][cells[j][1]]) continue;
if (connected(st2, cells[i], cells[j])) out.push([cells[i], cells[j]]);
}
return out;
}
function dealGrid(d) {
const kinds = [];
for (let k = 0; k < d.kinds; k++) {
for (let p = 0; p < d.pairPerKind * 2; p++) kinds.push(k);
}
const total = d.rows * d.cols;
while (kinds.length < total) kinds.push(kinds.length % d.kinds);   // 兜底（配置不齐时）
kinds.length = total;
let grid;
do {
shuffle(kinds);
grid = [];
for (let r = 0; r < d.rows; r++) grid.push(kinds.slice(r * d.cols, (r + 1) * d.cols));
} while (allPairs({ rows: d.rows, cols: d.cols, grid: grid }).length === 0);
return grid;
}
function reshuffle() {
const cells = [];
const kinds = [];
for (let r = 0; r < st.rows; r++) for (let c = 0; c < st.cols; c++) {
if (st.grid[r][c] >= 0) { cells.push([r, c]); kinds.push(st.grid[r][c]); }
}
let ok = false;
for (let tries = 0; tries < 80; tries++) {
shuffle(kinds);
for (let i = 0; i < cells.length; i++) st.grid[cells[i][0]][cells[i][1]] = kinds[i];
if (allPairs(st).length > 0) { ok = true; break; }
}
if (!ok) { renderBoard(); return false; }
const s = st;
s.lock = true;
const alive = cells.map((p) => tileAt(p[0], p[1])).filter(Boolean);
alive.forEach((el) => { el.classList.remove('lk-shufin'); el.classList.add('lk-shufout'); });
setTimeout(() => {
if (s !== st) return;
renderBoard();
const ts = boardEl.querySelectorAll('.lk-tile');
for (let i = 0; i < ts.length; i++) {
if (ts[i].classList.contains('lk-gone')) continue;
ts[i].classList.remove('lk-shufout'); ts[i].classList.add('lk-shufin');
}
setTimeout(() => {
if (s !== st) return;
const ts2 = boardEl.querySelectorAll('.lk-tile');
for (let i = 0; i < ts2.length; i++) ts2[i].classList.remove('lk-shufin');
s.lock = false;
}, Math.round(220 * fastMul()));
}, Math.round(180 * fastMul()));
return true;
}
function buildBoard() {
boardEl.innerHTML = '';
boardEl.style.gridTemplateColumns = 'repeat(' + st.cols + ',1fr)';
for (let r = 0; r < st.rows; r++) for (let c = 0; c < st.cols; c++) {
const cell = document.createElement('div');
cell.className = 'lk-tile';
cell.setAttribute('data-r', String(r));
cell.setAttribute('data-c', String(c));
boardEl.appendChild(cell);
}
}
function fitBoard() {
if (!stageEl || panel.hidden || !st) return;
const w = stageEl.clientWidth;
if (!w) return;
const GAP = 3;
const byW = Math.floor((w - (st.cols - 1) * GAP) / st.cols);
const floor24 = Math.min(24, byW);
let cellPx = Math.max(floor24, Math.min(46, byW));
if (panel.classList.contains('game-fs')) {
const h = stageEl.clientHeight;
cellPx = Math.max(floor24, Math.min(72, byW, h ? Math.floor((h - (st.rows - 1) * GAP) / st.rows) : byW));
}
if (byW < 24 && st && st.started && !st.over && !narrowTipShown) {
narrowTipShown = true;
taSay('屏幕偏窄图案较小，可在头部换低难度');
}
boardEl.style.width = (cellPx * st.cols + (st.cols - 1) * GAP) + 'px';
const tiles = boardEl.querySelectorAll('.lk-tile');
for (let i = 0; i < tiles.length; i++) { tiles[i].style.width = cellPx + 'px'; tiles[i].style.height = cellPx + 'px'; tiles[i].style.fontSize = Math.round(cellPx * 0.52) + 'px'; }
}
function tileAt(r, c) {
return boardEl.children[r * st.cols + c] || null;
}
function renderBoard() {
for (let r = 0; r < st.rows; r++) for (let c = 0; c < st.cols; c++) {
const el = tileAt(r, c);
const v = st.grid[r][c];
el.classList.remove('lk-gone', 'lk-sel', 'lk-hint');
if (v < 0) { el.classList.add('lk-gone'); el.textContent = ''; }
else el.textContent = themeKinds()[v];
}
updateInfo();
}
function updateInfo() {
if (!st) return;
if (infoEl) infoEl.innerHTML =
'<span>剩余 ' + st.remaining + ' 张</span>' +
'<span>💡 提示×' + st.hints + '</span>' +
'<span>🔀 洗牌×' + st.shuffles + '</span>' +
(st.combo >= 2 ? '<span>🔥 连击 ×' + st.combo + '</span>' : '') +
'<span>💕 ' + chemNow() + '</span>';
syncPropBtns();
}
function syncPropBtns() {
if (!st) return;
if (hintBtn) {
hintBtn.title = '道具·提示：点亮一对能连的牌（本局剩 ' + st.hints + '/3 次）';
hintBtn.classList.toggle('game-prop-off', !(st.hints > 0));
}
if (shufBtn) {
shufBtn.title = '道具·洗牌：把剩下的牌重排（本局剩 ' + st.shuffles + '/2 次）';
shufBtn.classList.toggle('game-prop-off', !(st.shuffles > 0));
}
}
const POP_MS = 260;
let pathSvgT = null;
function drawPathLine(path) {
if (!boardEl || !path || path.length < 2) return;
try {
const t0 = tileAt(0, 0);
if (!t0 || !t0.offsetWidth) return;
const GAP = 3, cw = t0.offsetWidth, ch = t0.offsetHeight;
const pt = (p) => (t0.offsetLeft + p[1] * (cw + GAP) + cw / 2) + ',' + (t0.offsetTop + p[0] * (ch + GAP) + ch / 2);
const old = boardEl.querySelector('.lk-pathline');
if (old) old.remove();
const NS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(NS, 'svg');
svg.setAttribute('class', 'lk-pathline');
const pl = document.createElementNS(NS, 'polyline');
pl.setAttribute('points', path.map(pt).join(' '));
pl.setAttribute('pathLength', '1');
svg.appendChild(pl);
boardEl.appendChild(svg);
clearTimeout(pathSvgT);
pathSvgT = setTimeout(() => { try { const s = boardEl.querySelector('.lk-pathline'); if (s) s.remove(); } catch (e) {} }, Math.round(480 * fastMul()));
} catch (e) {}
}
function dealInAnim() {
if (!boardEl) return;
const mult = fastMul();
const tiles = boardEl.querySelectorAll('.lk-tile');
let maxD = 0;
for (let i = 0; i < tiles.length; i++) {
const el = tiles[i];
const r = parseInt(el.getAttribute('data-r'), 10) || 0;
const c = parseInt(el.getAttribute('data-c'), 10) || 0;
const d = Math.round(Math.min((r + c) * 18, 260) * mult);
if (d > maxD) maxD = d;
el.style.animationDelay = d + 'ms';
el.classList.add('lk-born');
}
setTimeout(() => {
try {
const ts = boardEl.querySelectorAll('.lk-tile');
for (let i = 0; i < ts.length; i++) { ts[i].classList.remove('lk-born'); ts[i].style.animationDelay = ''; }
} catch (e) {}
}, maxD + Math.round(240 * mult));
}
function chemNow() {
if (!st.totalPairs) return 60;
const share = st.myPairs / Math.max(1, st.myPairs + st.taPairs);
const acc = Math.max(0, 1 - st.misPicks / Math.max(4, st.totalPairs));
const comboBonus = Math.min(10, (st.maxCombo || 0) * 2);
return Math.max(0, Math.min(100, Math.round(60 + share * 20 + acc * 20 - st.misPicks * 2 + comboBonus)));
}
function setStatus(html) { if (statusEl) statusEl.innerHTML = html; }
let bubbleT = null;
function taSay(text) {
if (!stageEl) return;
try {
let b = stageEl.querySelector('.tg-bubble');
if (!b) { b = document.createElement('div'); b.className = 'tg-bubble'; stageEl.appendChild(b); }
b.textContent = text;
b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
clearTimeout(bubbleT);
bubbleT = setTimeout(() => { try { b.classList.remove('show'); } catch (e) {} }, 1600);
} catch (e) {}
}
function dot(side) { return '<i class="c4-dot ' + (side === 1 ? 'c4-dot-you' : 'c4-dot-ta') + '"></i>'; }
function showTurnStatus() {
if (!statusEl || !st || st.over) return;
if (st.turn !== 1) { setStatus(T(THINK_LINES[0])); return; }
const avail = [];
if (st.hints > 0) avail.push('💡提示×' + st.hints);
if (st.shuffles > 0) avail.push('🔀洗牌×' + st.shuffles);
setStatus(dot(1) + '你的回合：点两张相同的牌' +
(avail.length ? ' · 找不到就点上方 ' + avail.join(' / ') : ' · 道具用完啦，这局靠自己'));
}
function newGame() {
clearTimeout(thinkT); thinkT = null;
clearTimeout(hintClearT);
narrowTipShown = false;
const diff = diffSel && DIFFS[diffSel.value] ? diffSel.value : 'normal';
st = newState(diff);
st.grid = dealGrid(DIFFS[diff]);
st.remaining = st.rows * st.cols;
st.totalPairs = Math.floor(st.remaining / 2);
st.started = true;
hideOverlay();
buildBoard();
fitBoard();
renderBoard();
dealInAnim();
st.turn = 1;
showTurnStatus();
}
function remember(r, c) {
st.seen.push([r, c]);
if (st.seen.length > 12) st.seen.splice(0, st.seen.length - 12);
}
function removePair(a, b, byMe) {
const s = st;
const ea = tileAt(a[0], a[1]), eb = tileAt(b[0], b[1]);
drawPathLine(findPath(s, a, b));
s.lock = true;
s.grid[a[0]][a[1]] = -1;
s.grid[b[0]][b[1]] = -1;
s.remaining -= 2;
if (byMe) s.myPairs++; else s.taPairs++;
s.sel = null;
boardEl.querySelectorAll('.lk-sel').forEach((el) => el.classList.remove('lk-sel'));
[ea, eb].forEach((el) => { if (el) el.classList.add('lk-pop'); });
updateInfo();
setTimeout(() => {
[ea, eb].forEach((el) => { if (el) { el.classList.remove('lk-pop'); el.classList.add('lk-gone'); el.textContent = ''; } });
s.lock = false;
if (s === st) afterClear(byMe);   // 对局已被重开则丢弃这条链
}, Math.round(POP_MS * fastMul()));
}
function playerPick(r, c) {
if (!st || !st.started || st.over || st.lock || st.turn !== 1) return;
if (st.grid[r][c] < 0) return;
remember(r, c);
const el = tileAt(r, c);
if (st.sel && st.sel[0] === r && st.sel[1] === c) {
st.sel = null; el.classList.remove('lk-sel'); sfxPick();
return;
}
if (!st.sel) {
st.sel = [r, c];
el.classList.add('lk-sel');
sfxPick();
return;
}
const a = st.sel;
if (st.grid[a[0]][a[1]] === st.grid[r][c] && connected(st, a, [r, c])) {
sfxMatch();
st.combo++;
if (st.combo > (st.maxCombo || 0)) st.maxCombo = st.combo;
if (st.combo >= 2) taSay(pick(['连击 ×' + st.combo + '，好默契！', '又连上啦！', '手气不错嘛']));
removePair(a, [r, c], true);   // #341 清格后流程由动画链尾 afterClear(true) 接管，此处不再直调
} else {
st.misPicks++;
st.combo = 0;
sfxBad();
if (st.misPicks % 3 === 0) {
if (st.hints > 0) taSay('找不到？上方 💡 提示能点亮一对');
else if (st.shuffles > 0) taSay('剩的牌连不上就按上方 🔀 洗牌');
}
const ea = tileAt(a[0], a[1]);
if (ea) { ea.classList.remove('lk-shake'); void ea.offsetWidth; ea.classList.add('lk-shake'); }
if (el) { el.classList.remove('lk-shake'); void el.offsetWidth; el.classList.add('lk-shake'); }
st.sel = null;
boardEl.querySelectorAll('.lk-sel').forEach((x) => x.classList.remove('lk-sel'));
updateInfo();
}
}
function afterClear(byMe) {
if (st.remaining <= 0) { endGame(); return; }
if (allPairs(st).length === 0) {
reshuffle();
setStatus('🌀 没有能连的了，自动洗了个牌');
st.turn = 1;   // #341 合并 TA 路径语义：死锁自动洗牌后始终轮回玩家
return;
}
st.turn = byMe ? 2 : 1;
if (st.turn === 2) scheduleTaTurn(TURN_MIN + Math.random() * TURN_VAR);
else showTurnStatus();
}
function rollMode() {
const r = Math.random();
if (r < 0.6) return 'smart';
if (r < 0.8) return 'memory';
return 'wild';
}
function scheduleTaTurn(delay) {
clearTimeout(thinkT);
setStatus(T(THINK_LINES[Math.floor(Math.random() * THINK_LINES.length)]));
thinkT = setTimeout(taTurn, Math.round(delay * fastMul()));
}
function taTurn() {
if (!st || st.over || st.lock || st.turn !== 2) return;
st.mode = rollMode();
let pair = null;
const pairs = allPairs(st);
if (st.mode === 'smart') {
pair = pairs.length ? pick(pairs) : null;
if (pair && Math.random() < 0.3) taSay(pick(['找到一对！', '看我的']));
} else if (st.mode === 'memory') {
const seenAlive = st.seen.filter((p) => st.grid[p[0]][p[1]] >= 0);
outer:
for (let i = 0; i < seenAlive.length; i++) for (let j = i + 1; j < seenAlive.length; j++) {
const a = seenAlive[i], b = seenAlive[j];
if (st.grid[a[0]][a[1]] === st.grid[b[0]][b[1]] && connected(st, a, b)) { pair = [a, b]; break outer; }
}
if (!pair) pair = pairs.length ? pick(pairs) : null;
} else {
if (pairs.length && Math.random() < 0.3) {
pair = pick(pairs);
} else {
const cells = [];
for (let r = 0; r < st.rows; r++) for (let c = 0; c < st.cols; c++) {
if (st.grid[r][c] >= 0) cells.push([r, c]);
}
const a = pick(cells), b = pick(cells);
if (a && b && (a[0] !== b[0] || a[1] !== b[1]) &&
st.grid[a[0]][a[1]] === st.grid[b[0]][b[1]] && connected(st, a, b)) {
pair = [a, b];
} else {
[a, b].forEach((p) => {
if (p) { const el = tileAt(p[0], p[1]); if (el) { el.classList.remove('lk-shake'); void el.offsetWidth; el.classList.add('lk-shake'); } }
});
sfxBad();
const triedSame = !!(a && b && st.grid[a[0]][a[1]] === st.grid[b[0]][b[1]]);
taSay(triedSame ? '这两张连不上呀' : '哎呀，点错了…');
if (a) remember(a[0], a[1]);
if (b) remember(b[0], b[1]);
const found = pairs.length ? pick(pairs) : null;
if (!found) { endGame(); return; }
const s = st;
clearTimeout(thinkT);
thinkT = setTimeout(() => {
if (s !== st || st.over || st.lock || st.turn !== 2) return;   // 重开/结束/已交棒则丢弃重试链
remember(found[0][0], found[0][1]); remember(found[1][0], found[1][1]);
sfxMatch();
removePair(found[0], found[1], false);
}, Math.round(700 * fastMul()));
return;
}
}
}
if (!pair) { endGame(); return; }
remember(pair[0][0], pair[0][1]); remember(pair[1][0], pair[1][1]);
sfxMatch();
removePair(pair[0], pair[1], false);   // #341 清格/死锁/交棒统一移入动画链尾 afterClear(false)
}
function endGame() {
st.over = true; st.turn = 0;
clearTimeout(thinkT); thinkT = null;
const chem = chemNow();
const s = loadStats();
s.clears = (s.clears || 0) + 1;
s.bestChem = Math.max(s.bestChem || 0, chem);
s.lastDiff = st.diff;
saveStats(s);
sfxWin();
taSay(pick(['一起清完啦！', '收工！好默契', '最后几张藏得好深']));
var coinLine = '';
var dropLine = '';
try {
var COIN_CAP = 10400;
var dl = new Date();
var day = dl.getFullYear() + '-' + (dl.getMonth() + 1) + '-' + dl.getDate();
var ck = prefix() + ':ml2_coin_linkup_' + day;
var cur = Number(localStorage.getItem(ck)) || 0;
if (cur < COIN_CAP) {
var mult = (typeof window.arcadeMult === 'function') ? window.arcadeMult('linkup') : 1;
var nominal = Math.round(DIFFS[st.diff].coin * mult);
var real = Math.min(nominal, COIN_CAP - cur);
try { localStorage.setItem(ck, String(cur + real)); } catch (e2) {}
if (real > 0 && typeof window.giftWalletChange === 'function') {
if (window.giftWalletChange(real, real, '连连看')) {
if (typeof window.arcadeMarkLuckyPlayed === 'function') window.arcadeMarkLuckyPlayed('linkup');
coinLine = '🪙 双方心意币各 +¥' + (real / 100).toFixed(2) + (mult > 1 ? '（🍀 幸运 ×2）' : '') + (real < nominal ? '（已达今日上限）' : '');
}
}
}
} catch (e) {}
if (typeof window.arcadeTryDrop === 'function') {
try {
var dr = window.arcadeTryDrop('linkup');
if (dr) { dropLine = '<div class="pong-end-stat">🌠 掉落限定摆件「' + dr.ico + ' ' + dr.name + '」！游乐室图鉴 +1</div>'; taSay('哇，掉了「' + dr.name + '」！'); }
} catch (e) {}
}
const body =
'<div class="pong-end-stat">💕 默契 ' + chem + '</div>' +
'<div class="pong-end-stat">你 ' + st.myPairs + ' 对 · ' + T('TA') + ' ' + st.taPairs + ' 对 · 点错 ' + st.misPicks + ' 次 · 最高连击 ×' + (st.maxCombo || 0) + '</div>' +
'<div class="pong-end-stat">累计完成 ' + s.clears + ' 局 · 历史最佳默契 ' + s.bestChem + '</div>' +
(coinLine ? '<div class="pong-end-stat">' + coinLine + '</div>' : '') +
dropLine;
showOverlay('清完整张棋盘！', body, '再来一局');
if (startBtn) startBtn.textContent = '再来一局';
if (endBtn) endBtn.hidden = false;
setStatus('🎉 一起清完了！默契 ' + chem);
try {
const lkStats = ['💕 默契 ' + chem, '你 ' + st.myPairs + ' 对 · {ta} ' + st.taPairs + ' 对 · 点错 ' + st.misPicks + ' 次 · 最高连击 ×' + (st.maxCombo || 0),
'累计完成 ' + s.clears + ' 局 · 历史最佳默契 ' + s.bestChem].concat(coinLine ? [coinLine] : []).concat(dr ? ['🌠 掉落限定摆件「' + dr.ico + ' ' + dr.name + '」'] : []);
if (window.chatAddSystem) window.chatAddSystem(T('连连看') + ' · 一起清完 · 默契 ' + chem, { special: 'linkup', game: {
name: '连连看',
outcome: 'clear',
result: '一起清完啦！',
stats: lkStats
} });
const fb = ['一起连完啦。', '好默契呀。', '最后几张好难找。', '再来一局？'];
const pool = window.getInteractPool ? window.getInteractPool('游戏平局·回应', fb) : fb;
const say = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ''; // #1515 整组停用＝静默（连线）
const cidAtEnd = prefix();
if (say) setTimeout(() => {
if (prefix() !== cidAtEnd) return;
try { if (window.chatAddIn) window.chatAddIn(say, { silent: true }); } catch (e) {}
}, 800);
} catch (e) {}
}
function showOverlay(title, body, btnText) {
if (!overlayEl) return;
if (ovTitleEl) ovTitleEl.innerHTML = title || '';
if (ovBodyEl) ovBodyEl.innerHTML = body || '';
if (startBtn && btnText) startBtn.textContent = btnText;
overlayEl.hidden = false;
}
function showStartOverlay() {
const s = loadStats();
showOverlay('连连看',
'<div class="c4-start-tip">和 ' + T('TA') + ' 轮流点击两张相同的牌<br>连线不超过两个弯就消除，一起清完整张棋盘</div>' +
'<div class="c4-start-note">🧰 道具：💡 提示 ×3（点亮一对能连的牌）· 🔀 洗牌 ×2（重排剩下的牌），点右上角那两个图标使用<br>🎲 ' + T('TA') + '每回合状态随机——快速找 / 凭记忆 / 随缘点</div>' +
(s.clears > 0 ? '<div class="pong-end-stat">累计完成 ' + s.clears + ' 局 · 历史最佳默契 ' + s.bestChem + '</div>' : ''),
s.clears > 0 ? '再来一局' : '开始对局');
if (endBtn) endBtn.hidden = true;
}
function hideOverlay() { if (overlayEl) overlayEl.hidden = true; if (endBtn) endBtn.hidden = true; }
boardEl.addEventListener('click', (e) => {
e.stopPropagation();
const cell = e.target.closest('.lk-tile');
if (!cell) return;
playerPick(parseInt(cell.getAttribute('data-r'), 10) || 0, parseInt(cell.getAttribute('data-c'), 10) || 0);
});
if (startBtn) startBtn.addEventListener('click', (e) => { e.stopPropagation(); newGame(); });
if (endBtn) endBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
if (diffSel) diffSel.addEventListener('change', () => {
const s = loadStats(); s.lastDiff = diffSel.value; saveStats(s);
if (st && st.started && !st.over) { /* 对局中不换难度，下一局生效 */ }
});
if (hintBtn) hintBtn.addEventListener('click', (e) => {
e.stopPropagation();
if (!st || !st.started || st.over || st.lock || st.turn !== 1) return;
if (st.hints <= 0) { taSay('💡 提示用完啦，重开一局才恢复'); sfxBad(); return; }
const pairs = allPairs(st);
if (!pairs.length) { taSay('眼下没有能连的一对，试试 🔀 洗牌'); return; }
st.hints--;
st.combo = 0;   // #301 提示断连击
const pr = pick(pairs);
[pr[0], pr[1]].forEach((p) => {
const el = tileAt(p[0], p[1]);
if (el) { el.classList.remove('lk-hint'); void el.offsetWidth; el.classList.add('lk-hint'); }
});
clearTimeout(hintClearT);
hintClearT = setTimeout(() => {
try { boardEl.querySelectorAll('.lk-hint').forEach((x) => x.classList.remove('lk-hint')); } catch (e2) {}
}, 2500);
updateInfo();
sfxPick();
});
if (shufBtn) shufBtn.addEventListener('click', (e) => {
e.stopPropagation();
if (!st || !st.started || st.over || st.lock || st.turn !== 1) return;
if (st.shuffles <= 0) { taSay('🔀 洗牌用完啦，重开一局才恢复（死局时我会自动洗）'); sfxBad(); return; }
st.shuffles--;
st.sel = null;
reshuffle();
setStatus('🌀 洗了个牌，继续你的回合');
updateInfo();
sfxPick();
});
if (soundBtn) soundBtn.addEventListener('click', (e) => {
e.stopPropagation();
soundOn = !soundOn;
soundBtn.textContent = soundOn ? '🔊' : '🔇';
soundBtn.classList.toggle('pong-sound-off', !soundOn);
});
const themeBtnEl = themeBtn();
if (themeBtnEl) themeBtnEl.addEventListener('click', (e) => {
e.stopPropagation();
themeKey = THEME_ORDER[(THEME_ORDER.indexOf(themeKey) + 1) % THEME_ORDER.length];
try { localStorage.setItem(prefix() + ':linkup-theme', themeKey); } catch (e2) {}
themeBtnEl.textContent = THEMES[themeKey].ico;
themeBtnEl.title = '图案主题：' + (THEMES[themeKey].name || themeKey) + '（点击切换）';
if (st && st.started) renderBoard();
beep(520, 0.06, 0.12);
});
function setNames() {
let name = T('TA');
try {
const s = window.activeStore && window.activeStore();
name = (s && (s.get('lbl-partner') || s.get('cs-lbl-partner'))) || name;
} catch (e) {}
if (partnerNameEl) partnerNameEl.textContent = name;
}
window.openLinkupPanel = function () {
try { if (isFs) toggleFs(); } catch (e) {}
try { const t = localStorage.getItem(prefix() + ':linkup-theme'); if (t && THEMES[t]) themeKey = t; } catch (e) {}
if (themeBtnEl) { themeBtnEl.textContent = THEMES[themeKey].ico; }
if (!st || !st.started) { try { const s = loadStats(); if (DIFFS[s.lastDiff] && diffSel) diffSel.value = s.lastDiff; } catch (e) {} }
panel.hidden = false;
try { setNames(); } catch (e) {}
try { if (st && st.started) fitBoard(); } catch (e) {}
if (st && st.started && !st.over) {
if (st.turn === 2 && !thinkT && !st.lock) scheduleTaTurn(TURN_MIN + Math.random() * TURN_VAR);
else if (st.turn === 1) showTurnStatus();
return;
}
showStartOverlay();
setStatus('点击「开始对局」');
};
function closePanel() {
clearTimeout(thinkT); thinkT = null;
if (panel) panel.hidden = true;
}
window.closeLinkupPanel = closePanel;
document.addEventListener('contact-switched', () => { try { closePanel(); st = null; /* #548v */ } catch (e) {} });
window.addEventListener('resize', () => { if (!panel.hidden) fitBoard(); });
(function bindEntry() {
const btn = document.getElementById('more-linkup');
if (!btn) return;
btn.addEventListener('click', (e) => {
e.stopPropagation();
const mp = document.getElementById('chat-more-panel');
if (mp) mp.hidden = true;
hideSiblingPanels('chat-linkup-panel');
try { if (window.closeAvlib) window.closeAvlib(); } catch (err) {}
try { if (window.closePongPanel) window.closePongPanel(); } catch (err) {}
try { openLinkupPanel(); } catch (err) {
try { panel.hidden = false; showStartOverlay(); setStatus('点击「开始对局」'); } catch (e2) {}
try { console.error('[linkup] open failed', err); } catch (e2) {}
}
});
try {
if (window.MutationObserver) {
const SIBLING_IDS = siblingIds('chat-linkup-panel');
const mo = new MutationObserver(() => {
if (panel.hidden) return;
for (let i = 0; i < SIBLING_IDS.length; i++) {
const el = document.getElementById(SIBLING_IDS[i]);
if (el && !el.hidden) { closePanel(); break; }
}
});
SIBLING_IDS.forEach((id) => { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
}
} catch (e) {}
})();
function siblingIds(self) {
return ['poke-card', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-pong-panel', 'chat-snake-panel', 'chat-brick-panel', 'chat-c4-panel', 'chat-ms-panel', 'chat-fish-panel', 'chat-memory-panel', 'chat-gift-panel', 'chat-gomoku-panel', 'chat-linkup-panel', 'chat-match3-panel', 'chat-auction-panel', 'chat-arcade-panel', 'chat-more-panel'].filter((id) => id !== self);
}
function hideSiblingPanels(self) {
siblingIds(self).forEach((id) => { const el = document.getElementById(id); if (el) el.hidden = true; });
}
window.__lkDebug = {
st: () => st,
newGame: newGame,
connected: connected,
findPath: findPath,
allPairs: allPairs,
showTurnStatus: showTurnStatus,
fast: false
};
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("linkup.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("linkup.js"); try { console.error("[JS] linkup.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[linkup.js] " + String(__e && __e.message || __e)); } })();

;/* ==== match3.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-match3-panel');
if (!panel) return;
const boardEl = document.getElementById('m3-board');
const stageEl = document.getElementById('m3-stage');
const statusEl = document.getElementById('m3-status');
const infoEl = document.getElementById('m3-info');
const overlayEl = document.getElementById('m3-overlay');
const ovTitleEl = document.getElementById('m3-ov-title');
const ovBodyEl = document.getElementById('m3-ov-body');
const startBtn = document.getElementById('m3-btn-start');
const endBtn = document.getElementById('m3-btn-end');
const hintBtn = document.getElementById('m3-hint');
const soundBtn = document.getElementById('m3-sound');
const closeBtn = document.getElementById('m3-close');
const fsBtn = document.getElementById('m3-fs');
let isFs = false;
function toggleFs() {
isFs = !isFs;
panel.classList.toggle('game-fs', isFs);
if (fsBtn) fsBtn.textContent = isFs ? '⤢' : '⛶';
setTimeout(() => { try { if (typeof fitBoard === 'function') fitBoard(); } catch (e) {} }, 60);
}
if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
const diffSel = document.getElementById('m3-diff');
const modeSel = document.getElementById('m3-mode'); // #453 简单/道具模式
const partnerNameEl = document.getElementById('m3-partner-name');
let N = 8, KIND_N = 6;
const GAP = 3;                 // 格间距（fitBoard 哨兵表达式依赖）
const SWAP_MS = 170, POP_MS = 220, FALL_MS = 300;  // 交换/消除/下落动画时长
const KINDS = ['🍓', '🍋', '🍇', '🔔', '⭐', '🎈', '🍀', '💎'];   // 前 6 款顺序不动（旧档牌面），后 2 款供王者/传奇
const BOMB_BASE = 10;    // 10+c = 该色炸弹（💥，被消除炸 3×3）
const RAINBOW = 20;      // 彩虹（🌈）
const LINE_H = 30, LINE_V = 40; // 30+c / 40+c = 该色直线道具（↔️被消除清整行 / ↕️清整列）#453
const DIFFS = {
casual: { target: 300, coin: 520, size: 8, kinds: 6, label: '🌱 休闲 · 300 分' },
normal: { target: 600, coin: 1314, size: 8, kinds: 6, label: '🌙 普通 · 600 分' },
hard:   { target: 1000, coin: 5200, size: 8, kinds: 6, label: '⭐ 挑战 · 1000 分' },
king:   { target: 2000, coin: 13140, size: 10, kinds: 7, label: '👑 王者 · 10×10 · 2000 分' },
legend: { target: 3500, coin: 33440, size: 12, kinds: 8, label: '🏆 传奇 · 12×12 · 3500 分' }
};
function syncDiffSel() {
if (!diffSel) return;
const want = String(diffSel.value || 'normal');
diffSel.innerHTML = '';
for (const k in DIFFS) {
const o = document.createElement('option');
o.value = k; o.textContent = DIFFS[k].label;
if (k === want) o.selected = true;
diffSel.appendChild(o);
}
if (!DIFFS[want]) diffSel.value = 'normal';
}
syncDiffSel();
const THINK_LINES = ['TA正在找能消的……', 'TA扫视着棋盘', 'TA歪头想了想'];
const TURN_MIN = 900, TURN_VAR = 800;
const T = window.taFit || function (x) { return x; };
function prefix() { return (window.activePrefix && window.activePrefix()) || 'xy-home-v2'; }
function fastMul() { return (window.__m3Debug && window.__m3Debug.fast) ? 0.05 : 1; }
function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
function animMs(x) { return Math.round(x * fastMul()); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function inBoard(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
function colorOf(v) {
if (v >= LINE_V) return v - LINE_V;
if (v >= LINE_H) return v - LINE_H;
if (v >= BOMB_BASE && v < RAINBOW) return v - BOMB_BASE;
return v >= RAINBOW ? -1 : v;
}
function isRainbow(v) { return v >= RAINBOW && v < LINE_H; }
let audioCtx = null, soundOn = true;
function beep(freq, dur, vol) {
if (!soundOn) return;
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended' && audioCtx.resume) { const r = audioCtx.resume(); if (r && r.catch) r.catch(function () {}); }
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = 'sine';
g.gain.value = vol || 0.16;
o.connect(g); g.connect(audioCtx.destination);
const t = audioCtx.currentTime;
g.gain.setValueAtTime(g.gain.value, t);
g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
o.start(t); o.stop(t + dur);
} catch (e) {}
}
const sfxPick = () => beep(500, 0.06, 0.14);
const sfxSwap = () => beep(380, 0.07, 0.14);
const sfxClear = (n) => { beep(560 + Math.min(5, n) * 60, 0.09, 0.16); };
const sfxBoom = () => { beep(120, 0.16, 0.2); setTimeout(() => beep(90, 0.14, 0.16), 60); };
const sfxBad = () => beep(180, 0.07, 0.12);
const sfxWin = () => { beep(660, 0.14, 0.2); setTimeout(() => beep(880, 0.2, 0.2), 130); };
let st = null;
let thinkT = null;
function newState(diff, mode) {
const d = DIFFS[diff] || DIFFS.normal;
N = d.size; KIND_N = d.kinds;   // 「更多牌」扩展批：棋盘边长/配色数随难度（KINDS 前 6 款顺序不变，旧档牌面零漂移）
return {
diff: diff,
target: d.target,
size: d.size, kinds: d.kinds,
grid: [],                // grid[r][c]：0..5 颜色 / 10+c 炸弹 / 20 彩虹 / 30+c,40+c 直线道具
mode: mode === 'item' ? 'item' : 'simple', // #453 简单(默认,无道具)/道具
taMode: null,            // #301 TA 出手风格 serious/normal/sandbag/blunder（FIX 2026-09-15 #481 与 st.mode 道具开关分家）
genSpecial: null,        // 最近一次生成的道具（verify 断言用）
turn: 1,
over: false,
started: false,
lock: false,
sel: null,
hints: 3,                // FIX 2026-09-16：提示每局 3 次（linkup 同口径，原先无限提示可刷分）
score: 0, myScore: 0, taScore: 0,
misPicks: 0
};
}
function statsKey() { return prefix() + ':match3-stats'; }
function loadStats() {
const d = { clears: 0, bestChem: 0, lastDiff: 'normal', lastMode: 'simple' };
try {
const raw = localStorage.getItem(statsKey());
if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object') return Object.assign(d, v); }
} catch (e) {}
return d;
}
function saveStats(s) { try { localStorage.setItem(statsKey(), JSON.stringify(s)); } catch (e) {} }
function findRuns(grid) {
const N = grid.length;
const runs = [];
for (let r = 0; r < N; r++) {
let run = 1;
for (let c = 1; c <= N; c++) {
const same = c < N && colorOf(grid[r][c]) >= 0 && colorOf(grid[r][c]) === colorOf(grid[r][c - 1]);
if (same) { run++; continue; }
if (run >= 3 && colorOf(grid[r][c - 1]) >= 0) {
const cells = [];
for (let k = c - run; k < c; k++) cells.push([r, k]);
runs.push({ cells: cells, color: colorOf(grid[r][c - 1]), len: run, dir: 'h' });
}
run = 1;
}
}
for (let c = 0; c < N; c++) {
let run = 1;
for (let r = 1; r <= N; r++) {
const same = r < N && colorOf(grid[r][c]) >= 0 && colorOf(grid[r][c]) === colorOf(grid[r - 1][c]);
if (same) { run++; continue; }
if (run >= 3 && colorOf(grid[r - 1][c]) >= 0) {
const cells = [];
for (let k = r - run; k < r; k++) cells.push([k, c]);
runs.push({ cells: cells, color: colorOf(grid[r - 1][c]), len: run, dir: 'v' });
}
run = 1;
}
}
return runs;
}
function findMatches(grid) {
const runs = findRuns(grid);
if (!runs.length) return null;
const N = grid.length;
const mark = [];
for (let r = 0; r < N; r++) mark.push(new Array(N).fill(false));
runs.forEach((run) => run.cells.forEach((p) => { mark[p[0]][p[1]] = true; }));
return mark;
}
function clearWithSpecials(grid, seeds) {
const N = grid.length;
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const cleared = [];
const seen = [];
for (let r = 0; r < N; r++) seen.push(new Array(N).fill(false));
const queue = seeds.slice();
seeds.forEach((p) => { seen[p[0]][p[1]] = true; });
while (queue.length) {
const p = queue.shift();
if (!inb(p[0], p[1]) || seen[p[0]][p[1]] === 'done') continue;
seen[p[0]][p[1]] = 'done';
cleared.push([p[0], p[1]]);
const v = grid[p[0]][p[1]];
if (v >= LINE_V) {
for (let rr = 0; rr < N; rr++) { if (!seen[rr][p[1]]) { seen[rr][p[1]] = true; queue.push([rr, p[1]]); } }
} else if (v >= LINE_H) {
for (let cc = 0; cc < N; cc++) { if (!seen[p[0]][cc]) { seen[p[0]][cc] = true; queue.push([p[0], cc]); } }
} else if (v >= BOMB_BASE && v < RAINBOW) {
for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
const rr = p[0] + dr, cc = p[1] + dc;
if (inb(rr, cc) && !seen[rr][cc]) { seen[rr][cc] = true; queue.push([rr, cc]); }
}
}
}
return cleared;
}
function collapse(grid) {
const N = grid.length;
let moved = false;
for (let c = 0; c < N; c++) {
let write = N - 1;
for (let r = N - 1; r >= 0; r--) {
if (grid[r][c] >= 0) {
if (write !== r) { grid[write][c] = grid[r][c]; grid[r][c] = -1; moved = true; }
write--;
}
}
for (let r = write; r >= 0; r--) { grid[r][c] = Math.floor(Math.random() * KIND_N); moved = true; }
}
return moved;
}
function simulateClear(gridIn) {
const g = gridIn.map((row) => row.slice());
let total = 0, chain = 0;
for (;;) {
const m = findMatches(g);
if (!m) break;
const seeds = [];
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (m[r][c]) seeds.push([r, c]); }
const cells = clearWithSpecials(g, seeds);
cells.forEach((p) => { g[p[0]][p[1]] = -1; });
total += cells.length * (chain + 1);
collapse(g);
chain++;
if (chain > 20) break;
}
return total;
}
function allMoves(grid) {
const N = grid.length;
const out = [];
const dirs = [[0, 1], [1, 0]];
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
if (isRainbow(grid[r][c])) continue;
for (let d = 0; d < dirs.length; d++) {
const r2 = r + dirs[d][0], c2 = c + dirs[d][1];
if (r2 >= N || c2 >= N) continue;
if (isRainbow(grid[r2][c2])) continue;
const g = grid.map((row) => row.slice());
const t = g[r][c]; g[r][c] = g[r2][c2]; g[r2][c2] = t;
const gain = simulateClear(g);
if (gain > 0) out.push({ a: [r, c], b: [r2, c2], gain: gain });
}
}
return out;
}
function dealGrid() {
let grid;
do {
grid = [];
for (let r = 0; r < N; r++) {
const row = [];
for (let c = 0; c < N; c++) row.push(Math.floor(Math.random() * KIND_N));
grid.push(row);
}
} while (findMatches(grid) || allMoves(grid).length === 0);
return grid;
}
function reshuffle() {
if (!st || st.over) return false;
st.lock = true;   // FIX 2026-09-16：洗牌滑行期间原先可点选，选中高亮会挂在移动中的棋子上（linkup 同款先锁）
let flat = [];
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) flat.push({ v: st.grid[r][c], id: pidGrid[r][c] });
for (let tries = 0; tries < 80; tries++) {
shuffle(flat);
const g = [], ids = [];
for (let r = 0; r < N; r++) {
g.push(flat.slice(r * N, (r + 1) * N).map((x) => x.v));
ids.push(flat.slice(r * N, (r + 1) * N).map((x) => x.id));
}
if (!findMatches(g) && allMoves(g).length > 0) {
st.grid = g;
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
const id = ids[r][c];
pidGrid[r][c] = id;
const p = pieces.get(id);
if (p) {
p.el.style.transitionDuration = '0.32s';
p.el.style.transitionTimingFunction = 'cubic-bezier(.45,.05,.35,1.2)';
layoutTile(p.el, r, c);
const gl = p.el._g;
if (gl) { gl.classList.remove('m3-shuf'); void gl.offsetWidth; gl.classList.add('m3-shuf'); }
}
}
setTimeout(() => {
pieces.forEach((p) => { p.el.style.transitionDuration = ''; p.el.style.transitionTimingFunction = ''; });
st.lock = false;
}, animMs(360));
updateInfo();
return true;
}
}
renderBoard();
st.lock = false;
return false;
}
let pidGrid = [];              // pidGrid[r][c] = 棋子 id / -1（空位）
const pieces = new Map();      // id -> { v, el }
let nextPid = 1;
let cellPx = 40;
function setGlyph(el, v) {
el.classList.remove('m3-bomb', 'm3-line');
const g = el._g || el;
if (v >= LINE_V) { g.textContent = '↕️'; el.classList.add('m3-line'); }
else if (v >= LINE_H) { g.textContent = '↔️'; el.classList.add('m3-line'); }
else if (v >= RAINBOW) g.textContent = '🌈';
else if (v >= BOMB_BASE) { g.textContent = '💥'; el.classList.add('m3-bomb'); }
else g.textContent = KINDS[v];
}
function fallSec(dist) { return Math.min(0.42, 0.16 + dist * 0.05); }
function layoutTile(el, r, c) {
el.style.width = cellPx + 'px';
el.style.height = cellPx + 'px';
el.style.fontSize = Math.round(cellPx * 0.54) + 'px';
el.style.transform = 'translate(' + (c * (cellPx + GAP)) + 'px,' + (r * (cellPx + GAP)) + 'px)';
el._r = r; el._c = c;
}
function spawnTile(v, r, c, fromRow, born, fallDist) {
const el = document.createElement('div');
el.className = 'm3-tile' + (born ? ' m3-born' : '');
const id = nextPid++;
const g = document.createElement('span');
g.className = 'm3-glyph';
el.appendChild(g);
el._g = g;
setGlyph(el, v);
el.style.width = cellPx + 'px';
el.style.height = cellPx + 'px';
el.style.fontSize = Math.round(cellPx * 0.54) + 'px';
el.style.transform = 'translate(' + (c * (cellPx + GAP)) + 'px,' + ((fromRow != null ? fromRow : r) * (cellPx + GAP)) + 'px)';
if (fallDist) { el.style.transitionDuration = fallSec(fallDist) + 's'; el.style.transitionTimingFunction = 'cubic-bezier(.55,0,.75,.45)'; }
el._r = r; el._c = c;
boardEl.appendChild(el);
pieces.set(id, { v: v, el: el });
pidGrid[r][c] = id;
if (fromRow != null) requestAnimationFrame(() => { layoutTile(el, r, c); });
return id;
}
function buildBoard() {
boardEl.innerHTML = '';
pieces.clear();
pidGrid = [];
for (let r = 0; r < N; r++) pidGrid.push(new Array(N).fill(-1));
nextPid = 1;
boardEl.classList.add('m3-noanim');
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) spawnTile(st.grid[r][c], r, c, null, false);
void boardEl.offsetWidth;
boardEl.classList.remove('m3-noanim');
}
function fitBoard() {
if (!stageEl || panel.hidden || !st) return;
const w = stageEl.clientWidth;
if (!w) return;
cellPx = Math.max(26, Math.min(46, Math.floor((w - (N - 1) * GAP) / N)));
boardEl.style.width = (cellPx * N + (N - 1) * GAP) + 'px';
boardEl.style.height = (cellPx * N + (N - 1) * GAP) + 'px';
boardEl.classList.add('m3-noanim');
pieces.forEach((p) => { layoutTile(p.el, p.el._r, p.el._c); });
void boardEl.offsetWidth;
boardEl.classList.remove('m3-noanim');
}
function tileAt(r, c) {
const id = pidGrid[r] ? pidGrid[r][c] : -1;
const p = id >= 0 ? pieces.get(id) : null;
return p ? p.el : null;
}
function renderBoard() { buildBoard(); updateInfo(); }
function swapPid(a, b) {
const ia = pidGrid[a[0]][a[1]], ib = pidGrid[b[0]][b[1]];
pidGrid[a[0]][a[1]] = ib; pidGrid[b[0]][b[1]] = ia;
const pa = pieces.get(ia), pb = pieces.get(ib);
if (pa) { pa.el.style.transitionDuration = ''; pa.el.style.transitionTimingFunction = 'cubic-bezier(.3,1.35,.55,1)'; layoutTile(pa.el, b[0], b[1]); }
if (pb) { pb.el.style.transitionDuration = ''; pb.el.style.transitionTimingFunction = 'cubic-bezier(.3,1.35,.55,1)'; layoutTile(pb.el, a[0], a[1]); }
}
function popClear(cells) {
for (let i = 0; i < cells.length; i++) {
const r = cells[i][0], c = cells[i][1];
const id = pidGrid[r][c];
if (id == null || id < 0) continue;
pidGrid[r][c] = -1;
const p = pieces.get(id);
if (!p) continue;
pieces.delete(id);
p.el.classList.remove('m3-sel', 'm3-hint');
p.el.classList.add('m3-pop');
setTimeout(((el) => () => { if (el.parentNode) el.parentNode.removeChild(el); })(p.el), animMs(POP_MS) + 60);
}
}
function floatScore(cells, pts) {
if (!cells || !cells.length || !pts) return;
let sr = 0, sc = 0;
cells.forEach((p) => { sr += p[0]; sc += p[1]; });
const el = document.createElement('div');
el.className = 'm3-float';
el.textContent = '+' + pts;
el.style.left = ((sc / cells.length + 0.5) * (cellPx + GAP)) + 'px';
el.style.top = ((sr / cells.length + 0.5) * (cellPx + GAP)) + 'px';
el.style.fontSize = Math.max(14, Math.round(cellPx * 0.42)) + 'px';
boardEl.appendChild(el);
setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, animMs(780));
}
function quakeBoard() {
boardEl.classList.remove('m3-quake'); void boardEl.offsetWidth; boardEl.classList.add('m3-quake');
setTimeout(() => { boardEl.classList.remove('m3-quake'); }, animMs(380));
}
function collapseAnimated() {
let maxDist = 1;
for (let c = 0; c < N; c++) {
let write = N - 1;
for (let r = N - 1; r >= 0; r--) {
const id = pidGrid[r][c];
if (id >= 0) {
if (write !== r) {
const p = pieces.get(id);
pidGrid[write][c] = id; pidGrid[r][c] = -1;
st.grid[write][c] = st.grid[r][c]; st.grid[r][c] = -1;
if (p) {
const dist = write - r;
if (dist > maxDist) maxDist = dist;
p.el.style.transitionDuration = fallSec(dist) + 's';
p.el.style.transitionTimingFunction = 'cubic-bezier(.55,0,.75,.45)';
layoutTile(p.el, write, c);
}
}
write--;
}
}
const gapN = write + 1;
if (gapN > maxDist) maxDist = gapN;
for (let r = write; r >= 0; r--) {
const v = Math.floor(Math.random() * KIND_N);
st.grid[r][c] = v;
spawnTile(v, r, c, r - gapN, true, gapN);
}
}
return maxDist;
}
function updateInfo() {
if (!st) return;
if (infoEl) infoEl.innerHTML =
'<span>🎯 ' + st.score + ' / ' + st.target + '</span>' +
'<span>你 ' + st.myScore + '</span>' +
'<span>' + T('TA') + ' ' + st.taScore + '</span>' +
'<span>' + modeLabel(st.mode) + '</span>' +
'<span>💡 提示×' + st.hints + '</span>' +
'<span>💕 ' + chemNow() + '</span>' +
(st.started && !st.over && firstProp()
? '<span class="m3-prop-live">⚡ ' + PROP_TIP[firstProp()].ico + ' 在场上·' + PROP_TIP[firstProp()].use + '即引爆</span>' : '') +
(st.started && !st.over && (st.mode !== nextMode() || st.diff !== nextDiff())
? '<span class="m3-mode-pending">⚠ 已选' + pendingLabels().join(' · ') + '，点这里立刻重开一局换上</span>' : '');
syncPropBtns();
}
if (infoEl) infoEl.addEventListener('click', (e) => {
const t = e.target && e.target.closest && e.target.closest('.m3-mode-pending');
if (!t) return;
e.stopPropagation();
newGame();
});
function nextDiff() { return diffSel && DIFFS[diffSel.value] ? diffSel.value : st.diff; }
function nextMode() { return modeSel && modeSel.value === 'item' ? 'item' : 'simple'; }
function modeLabel(m) { return m === 'item' ? '💣 道具模式' : '🌿 简单模式'; }
function pendingLabels() {
const out = [];
if (st.mode !== nextMode()) out.push(modeLabel(nextMode()));
if (st.diff !== nextDiff()) out.push(DIFFS[nextDiff()].label);
return out;
}
function syncPropBtns() {
if (hintBtn) {
hintBtn.title = '道具·提示：点亮当前最赚的一步（本局剩 ' + st.hints + '/3 次）';
hintBtn.classList.toggle('game-prop-off', !(st.hints > 0));
}
}
function firstProp() {
if (!st || st.mode !== 'item' || !st.grid) return null;
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
const v = st.grid[r][c];
if (v < 0) continue;
if (v >= LINE_V) return 'line-v';
if (v >= LINE_H) return 'line-h';
if (isRainbow(v)) return 'rainbow';
if (v >= BOMB_BASE) return 'bomb';
}
return null;
}
const PROP_TIP = {
'line-v': { ico: '↕️', use: '交换进三连', line: '↕️ 纵向道具在场上：把它交换进三连，整列都消掉' },
'line-h': { ico: '↔️', use: '交换进三连', line: '↔️ 横向道具在场上：把它交换进三连，整行都消掉' },
'rainbow': { ico: '🌈', use: '跟任意一格交换', line: '🌈 彩虹在场上：跟任意一格交换，就清光那种颜色' },
'bomb': { ico: '💥', use: '交换进三连', line: '💥 炸弹在场上：把它交换进三连，周围 3×3 一起炸开' }
};
function propOnBoardTip() {
const k = firstProp();
return k ? PROP_TIP[k].line : null;
}
function chemNow() {
const total = st.myScore + st.taScore;
if (!total) return 60;
const share = Math.min(st.myScore, st.taScore) / Math.max(1, Math.max(st.myScore, st.taScore));
return Math.max(0, Math.min(100, Math.round(55 + share * 35 - st.misPicks * 2)));
}
function setStatus(html) { if (statusEl) statusEl.innerHTML = html; }
let bubbleT = null;
function taSay(text) {
if (!stageEl) return;
try {
let b = stageEl.querySelector('.tg-bubble');
if (!b) { b = document.createElement('div'); b.className = 'tg-bubble'; stageEl.appendChild(b); }
b.textContent = text;
b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
clearTimeout(bubbleT);
bubbleT = setTimeout(() => { try { b.classList.remove('show'); } catch (e) {} }, 1600);
} catch (e) {}
}
function dot(side) { return '<i class="c4-dot ' + (side === 1 ? 'c4-dot-you' : 'c4-dot-ta') + '"></i>'; }
function showTurnStatus() {
if (!statusEl || !st || st.over) return;
if (st.turn !== 1) { setStatus(T(THINK_LINES[0])); return; }
const tip = propOnBoardTip();
setStatus(tip ? tip : dot(1) + '你的回合：点两格或滑动交换 · 💡 提示剩 ' + st.hints + ' 次');
}
let dealT = null;   // FIX 2026-09-16：开局发牌解锁定时器收进句柄（原不跟踪，极端连点/换局重开时旧定时器会把新一局提前解锁）
function newGame() {
clearTimeout(thinkT); thinkT = null;
if (dealT) { clearTimeout(dealT); dealT = null; }
const diff = diffSel && DIFFS[diffSel.value] ? diffSel.value : 'normal';
const mode = modeSel && modeSel.value === 'item' ? 'item' : 'simple';
st = newState(diff, mode);
try { const s2 = loadStats(); s2.lastMode = mode; saveStats(s2); } catch (e) {}
st.grid = dealGrid();
st.started = true;
hideOverlay();
buildBoard();
fitBoard();
updateInfo();
st.lock = true;
boardEl.querySelectorAll('.m3-tile').forEach((el) => {
const gl = el._g;
if (gl) { gl.style.animationDelay = ((el._r + el._c) * 35) + 'ms'; gl.classList.add('m3-deal'); }
});
dealT = setTimeout(() => {
dealT = null;
boardEl.querySelectorAll('.m3-tile').forEach((el) => {
const gl = el._g;
if (gl) { gl.classList.remove('m3-deal'); gl.style.animationDelay = ''; }
});
st.lock = false;
}, animMs(35 * (2 * N - 2) + 260));
st.turn = 1;
showTurnStatus();
}
function doSwap(a, b, byMe, cb) {
const s = st;
s.lock = true;
const va = s.grid[a[0]][a[1]], vb = s.grid[b[0]][b[1]];
const rbA = isRainbow(va), rbB = isRainbow(vb);
if (rbA || rbB) { doRainbowSwap(a, b, rbA && rbB, byMe, cb); return; }
const t = s.grid[a[0]][a[1]];
s.grid[a[0]][a[1]] = s.grid[b[0]][b[1]];
s.grid[b[0]][b[1]] = t;
swapPid(a, b);
let chain = 0, gained = 0;
const step = () => {
if (st !== s) return;   // 链中已换局：丢弃旧链
const runs = findRuns(s.grid);
if (!runs.length) {
if (!chain) {
const t2 = s.grid[a[0]][a[1]];
s.grid[a[0]][a[1]] = s.grid[b[0]][b[1]];
s.grid[b[0]][b[1]] = t2;
swapPid(a, b);
[a, b].forEach((p) => {
const el = tileAt(p[0], p[1]);
if (el) { el.classList.add('m3-shake'); setTimeout(((e2) => () => e2.classList.remove('m3-shake'))(el), 320); }
});
s.lock = false;
sfxBad();
if (cb) cb(false, 0);
return;
}
finish();
return;
}
chain++;
const seeds = [];
runs.forEach((run) => run.cells.forEach((p) => seeds.push(p)));
const cells = clearWithSpecials(s.grid, seeds);
const hadBoom = cells.some((p) => { const v = s.grid[p[0]][p[1]]; return v >= BOMB_BASE; });
cells.forEach((p) => { s.grid[p[0]][p[1]] = -1; });
let kept = null;
if (chain === 1 && s.mode === 'item') {
const best = runs.slice().sort((x, y) => y.len - x.len)[0];
const atFor = (run) => run.cells.some((p) => p[0] === b[0] && p[1] === b[1]) ? b : run.cells[Math.floor(run.cells.length / 2)];
let crossPair = null;
for (let i = 0; i < runs.length && !crossPair; i++) {
for (let j = i + 1; j < runs.length; j++) {
if (runs[i].color !== runs[j].color) continue;
const at = runs[i].cells.filter((p) => runs[j].cells.some((q) => q[0] === p[0] && q[1] === p[1]))[0];
if (at && runs[i].len + runs[j].len - 1 >= 5) { crossPair = { at: at, r1: runs[i], r2: runs[j] }; break; }
}
}
if (best.len >= 5) {
const at2 = atFor(best);
s.grid[at2[0]][at2[1]] = RAINBOW;
cells.push([at2[0], at2[1]]);
kept = at2;
s.genSpecial = 'rainbow';
taSay(pick(['🌈 彩虹出现了！', '快用彩虹，超好用']));
} else if (crossPair) {
const inCross = crossPair.r1.cells.some((p) => p[0] === b[0] && p[1] === b[1]) || crossPair.r2.cells.some((p) => p[0] === b[0] && p[1] === b[1]);
const at2 = inCross ? b : crossPair.at;
s.grid[at2[0]][at2[1]] = BOMB_BASE + crossPair.r1.color;
cells.push([at2[0], at2[1]]);
kept = at2;
s.genSpecial = 'bomb';
taSay(pick(['💥 L/T 连消，炸弹生成！', '交叉消！收下这个💥']));
} else if (best.len === 4) {
const at2 = atFor(best);
s.grid[at2[0]][at2[1]] = best.dir === 'h' ? LINE_H + best.color : LINE_V + best.color;
cells.push([at2[0], at2[1]]);
kept = at2;
s.genSpecial = best.dir === 'h' ? 'line-h' : 'line-v';
taSay(best.dir === 'h' ? pick(['↔️ 横向直线道具！', '四连！整行都清掉！']) : pick(['↕️ 纵向直线道具！', '四连！一列全消！']));
}
}
const pts = cells.length * chain;
gained += pts;
s.score += pts;
if (byMe) s.myScore += pts; else s.taScore += pts;
popClear(kept ? cells.filter((p) => p[0] !== kept[0] || p[1] !== kept[1]) : cells);
floatScore(cells, pts);
if (kept) {
const el = tileAt(kept[0], kept[1]);
if (el) {
setGlyph(el, s.grid[kept[0]][kept[1]]);
el.classList.remove('m3-born'); void el.offsetWidth; el.classList.add('m3-born');
}
}
if (hadBoom) { sfxBoom(); quakeBoard(); }
sfxClear(chain);
if (chain >= 3) taSay('连锁 ×' + chain + (byMe ? '，好强！' : '，我也行吧'));
setTimeout(() => {
if (st !== s) return;   // 链中已换局：丢弃旧链
const maxDist = collapseAnimated();   // 下落补位后再等下一轮查连锁
setTimeout(step, Math.max(animMs(FALL_MS), animMs(fallSec(maxDist) * 1000 + 80)));
}, animMs(POP_MS));
};
const finish = () => {
updateInfo();
s.lock = false;
if (cb) cb(true, gained);
};
setTimeout(step, animMs(SWAP_MS));
}
function doRainbowSwap(a, b, both, byMe, cb) {
const s = st;   // FIX 2026-09-16：同 doSwap——异步段快照守卫
const rbPos = s.grid[a[0]][a[1]] >= RAINBOW ? a : b;
const other = s.grid[a[0]][a[1]] >= RAINBOW ? b : a;
const seeds = [[rbPos[0], rbPos[1]]];
const colors = [];
if (both) {
const poolAll = [];
for (let i = 0; i < KIND_N; i++) poolAll.push(i);
const pool = poolAll.sort(() => Math.random() - 0.5).slice(0, 2);
pool.forEach((c2) => colors.push(c2));
seeds.push([other[0], other[1]]);
} else {
colors.push(colorOf(s.grid[other[0]][other[1]]));
}
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
if (colors.indexOf(colorOf(s.grid[r][c])) >= 0 && colorOf(s.grid[r][c]) >= 0 && !seeds.some((p) => p[0] === r && p[1] === c)) seeds.push([r, c]);
}
sfxBoom();
taSay(both ? '双彩虹！看我的' : '🌈 全消 ' + KINDS[Math.max(0, colors[0])] + '！');
const cells = clearWithSpecials(s.grid, seeds);
cells.forEach((p) => { s.grid[p[0]][p[1]] = -1; });
const pts = cells.length;
s.score += pts;
if (byMe) s.myScore += pts; else s.taScore += pts;
popClear(cells);
floatScore(cells, pts);
setTimeout(() => {
if (st !== s) return;
const maxDist = collapseAnimated();
setTimeout(() => {
if (st !== s) return;
s.lock = false;
if (cb) cb(true, pts);
}, Math.max(animMs(FALL_MS), animMs(fallSec(maxDist) * 1000 + 80)));
}, animMs(POP_MS));
}
function afterMove(byMe) {
if (st.score >= st.target) { endGame(); return; }
if (allMoves(st.grid).length === 0) {
reshuffle();
setStatus('🌀 没有能消的了，自动洗了个牌');
}
st.turn = byMe ? 2 : 1;
if (st.turn === 2) scheduleTaTurn(TURN_MIN + Math.random() * TURN_VAR);
else showTurnStatus();
}
function playerSwap(a, b) {
if (!st || !st.started || st.over || st.lock || st.turn !== 1) return;
sfxSwap();
doSwap(a, b, true, (ok) => {
if (!ok) { st.misPicks++; updateInfo(); }
afterMove(true);
});
}
function rollMode() {
const r = Math.random();
if (r < 0.55) return 'serious';
if (r < 0.8) return 'normal';
if (r < 0.93) return 'sandbag';
return 'blunder';
}
function scheduleTaTurn(delay) {
clearTimeout(thinkT);
setStatus(T(THINK_LINES[Math.floor(Math.random() * THINK_LINES.length)]));
thinkT = setTimeout(taTurn, Math.round(delay * fastMul()));
}
function taTurn() {
if (!st || st.over || st.turn !== 2 || st.lock) return;
st.taMode = rollMode();
const moves = allMoves(st.grid);
if (!moves.length) { endGame(); return; }
if (st.taMode === 'serious') {
moves.sort((x, y) => y.gain - x.gain);
exec(pick(moves.slice(0, 2)));
} else if (st.taMode === 'normal') {
moves.sort((x, y) => y.gain - x.gain);
exec(pick(moves.slice(0, 5)));
} else if (st.taMode === 'sandbag') {
moves.sort((x, y) => x.gain - y.gain);
exec(pick(moves.slice(0, Math.max(2, Math.ceil(moves.length / 2)))));
} else {
const a = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)];
const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const d = pick(dirs);
const b = [a[0] + d[0], a[1] + d[1]];
if (b[0] >= 0 && b[0] < N && b[1] >= 0 && b[1] < N) {
const g2 = st.grid.map((row) => row.slice());
const t = g2[a[0]][a[1]]; g2[a[0]][a[1]] = g2[b[0]][b[1]]; g2[b[0]][b[1]] = t;
if (!findMatches(g2)) {
sfxBad();
setStatus(T('TA') + '点错了，重新选……');
taSay(pick(['哎呀手滑', '这格不对……']));
const ea = tileAt(a[0], a[1]);
if (ea) { ea.classList.add('m3-shake'); setTimeout(() => ea.classList.remove('m3-shake'), 300); }
setTimeout(() => {
if (!st || st.over) return;
exec(pick(moves));
}, Math.round(600 * fastMul()));
return;
}
}
exec(pick(moves));
}
function exec(mv) {
if (!mv) { st.turn = 1; showTurnStatus(); return; }
sfxSwap();
doSwap(mv.a, mv.b, false, () => {
if (st.score >= st.target) { endGame(); return; }
if (allMoves(st.grid).length === 0) reshuffle();
st.turn = 1;
showTurnStatus();
});
}
}
function endGame() {
st.over = true; st.turn = 0; st.lock = false;
clearTimeout(thinkT); thinkT = null;
const chem = chemNow();
const s = loadStats();
s.clears = (s.clears || 0) + 1;
s.bestChem = Math.max(s.bestChem || 0, chem);
s.lastDiff = st.diff;
saveStats(s);
sfxWin();
taSay(pick(['达标啦，配合不错！', '我们通关咯']));
var coinLine = '';
var dropLine = '';
try {
var COIN_CAP = 10400;
var dm = new Date();
var day = dm.getFullYear() + '-' + (dm.getMonth() + 1) + '-' + dm.getDate();
var ck = prefix() + ':ml2_coin_match3_' + day;
var cur = Number(localStorage.getItem(ck)) || 0;
if (cur < COIN_CAP) {
var mult = (typeof window.arcadeMult === 'function') ? window.arcadeMult('match3') : 1;
var real = Math.min(Math.round(DIFFS[st.diff].coin * mult), COIN_CAP - cur);
try { localStorage.setItem(ck, String(cur + real)); } catch (e2) {}
if (real > 0 && typeof window.giftWalletChange === 'function') {
if (window.giftWalletChange(real, real, '消消乐')) {
if (typeof window.arcadeMarkLuckyPlayed === 'function') window.arcadeMarkLuckyPlayed('match3');
coinLine = '🪙 双方心意币各 +¥' + (real / 100).toFixed(2) + (mult > 1 ? '（🍀 幸运 ×2）' : '');
}
}
}
} catch (e) {}
if (typeof window.arcadeTryDrop === 'function') {
try {
var dr = window.arcadeTryDrop('match3');
if (dr) { dropLine = '<div class="pong-end-stat">🌠 掉落限定摆件「' + dr.ico + ' ' + dr.name + '」！游乐室图鉴 +1</div>'; taSay('哇，掉了「' + dr.name + '」！'); }
} catch (e) {}
}
const body =
'<div class="pong-end-stat">🎯 达成 ' + st.score + ' / ' + st.target + ' 分</div>' +
'<div class="pong-end-stat">💕 默契 ' + chem + ' · 你 ' + st.myScore + ' · ' + T('TA') + ' ' + st.taScore + '</div>' +
'<div class="pong-end-stat">累计通关 ' + s.clears + ' 局 · 历史最佳默契 ' + s.bestChem + '</div>' +
(coinLine ? '<div class="pong-end-stat">' + coinLine + '</div>' : '') +
dropLine;
showOverlay('目标达成！', body, '再来一局');
if (startBtn) startBtn.textContent = '再来一局';
if (endBtn) endBtn.hidden = false;
setStatus('🎉 达成目标！默契 ' + chem);
try {
const m3Stats = ['🎯 达成 ' + st.score + ' / ' + st.target + ' 分', '💕 默契 ' + chem + ' · 你 ' + st.myScore + ' · {ta} ' + st.taScore,
'累计通关 ' + s.clears + ' 局 · 历史最佳默契 ' + s.bestChem].concat(coinLine ? [coinLine] : []).concat(dr ? ['🌠 掉落限定摆件「' + dr.ico + ' ' + dr.name + '」'] : []);
if (window.chatAddSystem) window.chatAddSystem(T('消消乐') + ' · 达成 ' + st.score + ' 分 · 默契 ' + chem, { special: 'match3', game: {
name: '消消乐',
outcome: 'clear',
result: '目标达成，通关啦！',
stats: m3Stats
} });
const fb = ['通关啦，配合不错。', '我们好默契呀。', '再来一局？'];
const pool = window.getInteractPool ? window.getInteractPool('游戏平局·回应', fb) : fb;
const say = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ''; // #1515 整组停用＝静默（消消乐）
const cidAtEnd = prefix();
if (say) setTimeout(() => {
if (prefix() !== cidAtEnd) return;
try { if (window.chatAddIn) window.chatAddIn(say, { silent: true }); } catch (e) {}
}, 800);
} catch (e) {}
}
function showOverlay(title, body, btnText) {
if (!overlayEl) return;
if (ovTitleEl) ovTitleEl.innerHTML = title || '';
if (ovBodyEl) ovBodyEl.innerHTML = body || '';
if (startBtn && btnText) startBtn.textContent = btnText;
overlayEl.hidden = false;
}
function showStartOverlay() {
const s = loadStats();
const itemMode = !!(modeSel && modeSel.value === 'item');
showOverlay('消消乐',
'<div class="c4-start-tip">和 ' + T('TA') + ' 轮流交换相邻两格<br>凑成同款三连就消除，一起冲到目标分</div>' +
'<div class="c4-start-note">' + (itemMode
? '💣 道具模式：凑四连→↔️/↕️ · L/T 交叉→💥 · 五连→🌈；道具是消出来的，不是点一下就用——再把它交换进三连才自动引爆'
: '🌿 简单模式：经典三消、无道具（想玩道具：上方下拉切「💣 道具」，再开一局才生效）') +
'<br>🧰 道具 💡 提示：每局 3 次，点亮当前最赚的一步（点右上角 💡）' +
'<br>🎲 ' + T('TA') + '每回合状态随机——最优步 / 前五挑一 / 放水 / 手滑</div>' +
(s.clears > 0 ? '<div class="pong-end-stat">累计通关 ' + s.clears + ' 局 · 历史最佳默契 ' + s.bestChem + '</div>' : ''),
s.clears > 0 ? '再来一局' : '开始对局');
if (endBtn) endBtn.hidden = true;
}
function hideOverlay() { if (overlayEl) overlayEl.hidden = true; if (endBtn) endBtn.hidden = true; }
let swipeBase = null, swipeFired = false;
boardEl.addEventListener('pointerdown', (e) => {
const cell = e.target.closest('.m3-tile');
if (!cell || typeof cell._r !== 'number') { swipeBase = null; return; }
swipeBase = { x: e.clientX, y: e.clientY, r: cell._r, c: cell._c };
swipeFired = false;
});
boardEl.addEventListener('pointerup', (e) => {
if (!swipeBase) return;
const from = [swipeBase.r, swipeBase.c];
const dx = e.clientX - swipeBase.x, dy = e.clientY - swipeBase.y;
swipeBase = null;
const th = Math.max(12, cellPx / 2);
if (Math.abs(dx) < th && Math.abs(dy) < th) return;
if (!st || !st.started || st.over || st.lock || st.turn !== 1) return;
const dir = Math.abs(dx) > Math.abs(dy) ? [0, dx > 0 ? 1 : -1] : [dy > 0 ? 1 : -1, 0];
const r2 = from[0] + dir[0], c2 = from[1] + dir[1];
if (!inBoard(r2, c2)) return;
swipeFired = true;
playerSwap(from, [r2, c2]);
});
boardEl.addEventListener('pointercancel', () => { swipeBase = null; });
boardEl.addEventListener('click', (e) => {
e.stopPropagation();
if (swipeFired) { swipeFired = false; return; }   // 滑动交换后吞掉合成 click
const cell = e.target.closest('.m3-tile');
if (!cell) return;
const r = typeof cell._r === 'number' ? cell._r : 0;
const c = typeof cell._c === 'number' ? cell._c : 0;
if (!st || !st.started || st.over || st.lock || st.turn !== 1) return;
if (st.sel && st.sel[0] === r && st.sel[1] === c) {
st.sel = null;
cell.classList.remove('m3-sel');
sfxPick();
return;
}
if (!st.sel) {
st.sel = [r, c];
cell.classList.add('m3-sel');
sfxPick();
return;
}
const a = st.sel;
const dr = Math.abs(a[0] - r), dc = Math.abs(a[1] - c);
const adj = (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
st.sel = null;
boardEl.querySelectorAll('.m3-sel').forEach((x) => x.classList.remove('m3-sel'));
if (!adj) {
st.sel = [r, c];
cell.classList.add('m3-sel');
sfxPick();
return;
}
playerSwap(a, [r, c]);
});
if (startBtn) startBtn.addEventListener('click', (e) => { e.stopPropagation(); newGame(); });
if (endBtn) endBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
if (diffSel) diffSel.addEventListener('change', () => {
const s = loadStats(); s.lastDiff = diffSel.value; saveStats(s);
if (st && st.started && !st.over) {
setStatus('下一局是' + ((DIFFS[diffSel.value] || DIFFS.normal).label) + '，点信息条红字立刻重开换');
updateInfo();
}
});
if (modeSel) {
modeSel.title = '模式开关（不是道具按钮）：切成「💣 道具」后，新开的这局才会消出道具；道具要靠交换引爆';
modeSel.addEventListener('change', () => {
const s = loadStats(); s.lastMode = modeSel.value === 'item' ? 'item' : 'simple'; saveStats(s);
setStatus(s.lastMode === 'item'
? '💣 道具模式已选：凑四连/L·T 交叉/五连时自动掉 ↔️↕️ 💥 🌈，再把它交换进三连就引爆（不是手动点用）'
: '🌿 简单模式已选：纯经典三消，不生成任何道具');
if (st && st.started && !st.over) { taSay('本局是' + modeLabel(st.mode) + '，点红字立刻重开换'); updateInfo(); }
else if (overlayEl && !overlayEl.hidden) showStartOverlay();   // 覆盖层开着：说明文字跟着模式换
});
}
if (hintBtn) hintBtn.addEventListener('click', (e) => {
e.stopPropagation();
if (!st || !st.started || st.over || st.lock || st.turn !== 1) return;
if (!(st.hints > 0)) { taSay('💡 提示用完啦，重开一局才恢复'); sfxBad(); return; }
st.hints--;
updateInfo();
const moves = allMoves(st.grid);
if (!moves.length) return;
moves.sort((x, y) => y.gain - x.gain);
const mv = moves[0];
[mv.a, mv.b].forEach((p) => {
const el = tileAt(p[0], p[1]);
if (el) { el.classList.remove('m3-hint'); void el.offsetWidth; el.classList.add('m3-hint'); }
});
sfxPick();
});
if (soundBtn) soundBtn.addEventListener('click', (e) => {
e.stopPropagation();
soundOn = !soundOn;
soundBtn.textContent = soundOn ? '🔊' : '🔇';
soundBtn.classList.toggle('pong-sound-off', !soundOn);
});
function setNames() {
let name = T('TA');
try {
const s = window.activeStore && window.activeStore();
name = (s && (s.get('lbl-partner') || s.get('cs-lbl-partner'))) || name;
} catch (e) {}
if (partnerNameEl) partnerNameEl.textContent = name;
}
window.openMatch3Panel = function () {
try { if (isFs) toggleFs(); } catch (e) {}
if (!st || !st.started) {
try {
const s = loadStats();
if (DIFFS[s.lastDiff] && diffSel) diffSel.value = s.lastDiff;
if (modeSel && (s.lastMode === 'item' || s.lastMode === 'simple')) modeSel.value = s.lastMode;
} catch (e) {}
}
panel.hidden = false;
try { setNames(); } catch (e) {}
try { if (st && st.started) fitBoard(); } catch (e) {}
if (st && st.started && !st.over) {
if (st.turn === 2 && !thinkT && !st.lock) scheduleTaTurn(TURN_MIN + Math.random() * TURN_VAR);
else if (st.turn === 1) showTurnStatus();
return;
}
showStartOverlay();
setStatus('点击「开始对局」');
};
function closePanel() {
clearTimeout(thinkT); thinkT = null;
if (dealT) { clearTimeout(dealT); dealT = null; if (st && st.lock) st.lock = false; }
if (panel) panel.hidden = true;
}
window.closeMatch3Panel = closePanel;
document.addEventListener('contact-switched', () => { try { closePanel(); st = null; /* #548u */ } catch (e) {} });
window.addEventListener('resize', () => { if (!panel.hidden) fitBoard(); });
(function bindEntry() {
const btn = document.getElementById('more-match3');
if (!btn) return;
btn.addEventListener('click', (e) => {
e.stopPropagation();
const mp = document.getElementById('chat-more-panel');
if (mp) mp.hidden = true;
hideSiblingPanels('chat-match3-panel');
try { if (window.closeAvlib) window.closeAvlib(); } catch (err) {}
try { if (window.closePongPanel) window.closePongPanel(); } catch (err) {}
try { openMatch3Panel(); } catch (err) {
try { panel.hidden = false; showStartOverlay(); setStatus('点击「开始对局」'); } catch (e2) {}
try { console.error('[match3] open failed', err); } catch (e2) {}
}
});
try {
if (window.MutationObserver) {
const SIBLING_IDS = siblingIds('chat-match3-panel');
const mo = new MutationObserver(() => {
if (panel.hidden) return;
for (let i = 0; i < SIBLING_IDS.length; i++) {
const el = document.getElementById(SIBLING_IDS[i]);
if (el && !el.hidden) { closePanel(); break; }
}
});
SIBLING_IDS.forEach((id) => { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
}
} catch (e) {}
})();
function siblingIds(self) {
return ['poke-card', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-pong-panel', 'chat-snake-panel', 'chat-brick-panel', 'chat-c4-panel', 'chat-ms-panel', 'chat-fish-panel', 'chat-memory-panel', 'chat-gift-panel', 'chat-gomoku-panel', 'chat-linkup-panel', 'chat-match3-panel', 'chat-auction-panel', 'chat-arcade-panel', 'chat-more-panel'].filter((id) => id !== self);
}
function hideSiblingPanels(self) {
siblingIds(self).forEach((id) => { const el = document.getElementById(id); if (el) el.hidden = true; });
}
window.__m3Debug = {
st: () => st,
newGame: newGame,
doSwap: doSwap,
findRuns: findRuns,
findMatches: findMatches,
allMoves: allMoves,
taTurn: taTurn,
simulateClear: simulateClear,
clearWithSpecials: clearWithSpecials,
reshuffle: reshuffle,
colorOf: colorOf,
isRainbow: isRainbow,
showTurnStatus: showTurnStatus,
updateInfo: updateInfo,
BOMB_BASE: BOMB_BASE,
RAINBOW: RAINBOW,
LINE_H: LINE_H,
LINE_V: LINE_V,
fast: false
};
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("match3.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("match3.js"); try { console.error("[JS] match3.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[match3.js] " + String(__e && __e.message || __e)); } })();

;/* ==== auction.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-auction-panel');
if (!panel) return;
const stageEl = document.getElementById('au-stage');
const itemEl = document.getElementById('au-item');
const lotEl = document.getElementById('au-lot');
const balanceEl = document.getElementById('au-balance');
const statusEl = document.getElementById('au-status');
const overlayEl = document.getElementById('au-overlay');
const ovTitleEl = document.getElementById('au-ov-title');
const ovBodyEl = document.getElementById('au-ov-body');
const startBtn = document.getElementById('au-btn-start');
const endBtn = document.getElementById('au-btn-end');
const bid1Btn = document.getElementById('au-bid1');
const bid5Btn = document.getElementById('au-bid5');
const bid13Btn = document.getElementById('au-bid13');
const passBtn = document.getElementById('au-pass');
const bagBtn = document.getElementById('au-bag');
const soundBtn = document.getElementById('au-sound');
const closeBtn = document.getElementById('au-close');
const fsBtn = document.getElementById('au-fs');
const helpBtn = document.getElementById('au-help-btn');
const helpOverlay = document.getElementById('au-help');
const helpClose = document.getElementById('au-help-close');
const introEl = document.getElementById('au-intro');
const introStepsEl = document.getElementById('au-intro-steps');
const introStatEl = document.getElementById('au-intro-stat');
const introStart = document.getElementById('au-intro-start');
const introHelp = document.getElementById('au-intro-help');
const introExit = document.getElementById('au-intro-exit');
const walletHintEl = document.getElementById('au-wallet-hint');
const historyBtn = document.getElementById('au-history');
const addBtn = document.getElementById('au-add');
function showHelp() { if (helpOverlay) helpOverlay.hidden = false; }
function hideHelp() { if (helpOverlay) helpOverlay.hidden = true; }
function showIntro() { if (introEl) introEl.hidden = false; }
function hideIntro() { if (introEl) introEl.hidden = true; }
if (helpBtn) helpBtn.addEventListener('click', (e) => { e.stopPropagation(); showHelp(); });
if (helpClose) helpClose.addEventListener('click', (e) => { e.stopPropagation(); hideHelp(); });
if (introStart) introStart.addEventListener('click', (e) => { e.stopPropagation(); newSession(); });
if (introHelp) introHelp.addEventListener('click', (e) => { e.stopPropagation(); showHelp(); });
if (introExit) introExit.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
let isFs = false;
function toggleFs() {
isFs = !isFs;
panel.classList.toggle('game-fs', isFs);
if (fsBtn) fsBtn.textContent = isFs ? '⤢' : '⛶';
setTimeout(() => { try { if (typeof fitBoard === 'function') fitBoard(); } catch (e) {} }, 60);
}
if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
const partnerNameEl = document.getElementById('au-partner-name');
const STEP1 = 100, STEP5 = 500, STEP13 = 1314;      // 加价档（分）
const POOL = [
{ ico: '🌹', name: '永生玫瑰', desc: '不会枯的那种', base: 520, wish: '花会谢，心意不会。' },
{ ico: '🧸', name: 'Mochi 玩偶', desc: '捏起来很解压', base: 900, wish: '想我的时候就捏捏它。' },
{ ico: '🧋', name: '奶茶年卡', desc: '每天一杯半糖去冰', base: 1314, wish: '第一杯请你喝。' },
{ ico: '🎧', name: '降噪耳机', desc: '世界的开关', base: 1990, wish: '戴上就是我的世界。' },
{ ico: '🎮', name: '复古掌机', desc: '内置 520 个小游戏，猜猜是什么', base: 2600, wish: '双人游戏留给你。', mystery: 1 },
{ ico: '📷', name: '拍立得', desc: '把此刻留住', base: 3130, wish: '第一张拍你。' },
{ ico: '⌚', name: '情侣对表', desc: '一对，走时一致，猜猜是什么', base: 5200, wish: '以后时间一起过。', mystery: 1 },
{ ico: '🧣', name: '手织围巾', desc: '织错的针脚都是心意', base: 1314, wish: '歪的地方是我想你。' },
{ ico: '🍰', name: '下午茶券', desc: '双人份，周末有效', base: 520, wish: '周末不见不散。' },
{ ico: '🎫', name: '演唱会门票', desc: '两张，你偶像的，猜猜是什么', base: 3999, wish: '合唱那首你跑调的。', mystery: 1 },
{ ico: '💐', name: '全明星花束', desc: '什么花都有一点', base: 1314, wish: '像你，什么都好。' },
{ ico: '💎', name: '小钻戒', desc: '别紧张，不是那种……大概', base: 9999, wish: '先占个位置。', mystery: 1 }
];
const TA_MODES = {
eager:  { factor: 1.5,  stepPref: [STEP5, STEP13, STEP13], talk: '眼睛亮了，志在必得', calls: ['跟！这件我要定了', '就这点诚意？接着', '休想从我手里抢走'] },
normal: { factor: 1.15, stepPref: [STEP1, STEP5, STEP13],  talk: '掂了掂这件的分量', calls: ['这件我挺喜欢的', '我掂量着值这个价', '那我也加一点'] },
stingy: { factor: 0.7,  stepPref: [STEP1, STEP1, STEP5],   talk: '皱着眉算了算', calls: ['唔……勉强跟一手', '快超预算了呀', '再贵我就撤了'] },
bluff:  { factor: 1.2,  stepPref: [STEP13, STEP5, STEP5],  talk: '一路跟得飞快，像真想要', calls: ['加价不加价？跟', '气势不能输', '谁怕谁呀'] }
};
const TALK_MIN = 850, TALK_VAR = 900;
const LOTS_PER_SESSION = 3;
const T = window.taFit || function (x) { return x; };
function prefix() { return (window.activePrefix && window.activePrefix()) || 'xy-home-v2'; }
function fastMul() { return (window.__auDebug && window.__auDebug.fast) ? 0.05 : 1; }
function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function yuan(fen) { return '¥' + (fen / 100).toFixed(2); }
function yuanC(fen) { const v = fen / 100; return Number.isInteger(v) ? '¥' + v : '¥' + v.toFixed(2); } // #321 整数省略 .00，按钮直白些
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const RARITY = [['普通', 'au-r0'], ['稀有', 'au-r1'], ['SSR', 'au-r2']];
function rarityOf(item) { const r = (item && item.base >= 5000) ? 2 : (item && item.base >= 2600) ? 1 : 0; return { label: RARITY[r][0], cls: RARITY[r][1] }; }
function buzz(p) {
try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
try { window.__auDebug.lastBuzz = p; } catch (e) {}
}
function splitKey(key) {
const i = key.lastIndexOf(':');
return i > 0 ? [key.slice(0, i), key.slice(i + 1)] : ['xy-home-v2', key];
}
function lsGet(key) {
const [p, k] = splitKey(key);
if (typeof window.xyStore === 'function') {
try { return window.xyStore(p).get(k); } catch (e) {}
}
try { return localStorage.getItem(key); } catch (e) { return null; }
}
function persist(key, val) {
const s = typeof val === 'string' ? val : JSON.stringify(val);
const [p, k] = splitKey(key);
if (typeof window.xyStore === 'function') {
try { window.xyStore(p).set(k, s); return true; } catch (e) {}
}
let ok = false;
try { localStorage.setItem(key, s); ok = true; } catch (e) {}
try { if (typeof window.idbSet === 'function') window.idbSet(key, val); } catch (e) {}
return ok;
}
function historyKey() { return prefix() + ':auction-history'; }
function loadHistory() { try { const a = JSON.parse(lsGet(historyKey()) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function recordHistory(item, price, who) {
const h = loadHistory();
h.unshift({ t: Date.now(), ico: item.ico, img: item.img || '', name: item.name, price: price, who: who, rarity: rarityOf(item).label });
if (h.length > 60) h.length = 60;
persist(historyKey(), h);
}
function customKey() { return prefix() + ':auction-custom'; }
function loadCustom() { try { const a = JSON.parse(lsGet(customKey()) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function saveCustom(a) { try { if (a.length > 20) a.length = 20; return persist(customKey(), a); } catch (e) { return false; } }
function activePool() {
return POOL.concat(loadCustom().map((c) => ({ ico: c.ico, img: c.img || '', name: c.name, desc: c.desc, base: c.base, wish: c.wish, mystery: c.mystery || 0, custom: 1 })));
}
let audioCtx = null;
let soundOn = true;
try { soundOn = localStorage.getItem('xy-home-v2:au-sound') !== '0'; } catch (e) {} // #343 音效偏好全局记忆（非联系人维度）
function beep(freq, dur, vol) {
if (!soundOn) return;
try {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(function () {});
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
o.frequency.value = freq; o.type = 'sine';
g.gain.value = vol || 0.16;
o.connect(g); g.connect(audioCtx.destination);
const t = audioCtx.currentTime;
g.gain.setValueAtTime(g.gain.value, t);
g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
o.start(t); o.stop(t + dur);
} catch (e) {}
}
const sfxBid = () => beep(520, 0.07, 0.15);
const sfxHammer = () => { beep(880, 0.08, 0.18); setTimeout(() => beep(520, 0.12, 0.16), 90); };
const sfxLose = () => beep(300, 0.12, 0.14);
const sfxWin = () => { beep(660, 0.14, 0.2); setTimeout(() => beep(880, 0.2, 0.2), 130); };
function walletOk() { return typeof window.giftWalletGet === 'function' && typeof window.giftWalletSet === 'function'; }
function myBalance() {
try { const w = window.giftWalletGet(); return (w && Number(w.myBalance)) || 0; } catch (e) { return 0; }
}
function walletDeduct(fen) {
try {
const w = window.giftWalletGet();
if (!w || (Number(w.myBalance) || 0) < fen) return false;
w.myBalance = (Number(w.myBalance) || 0) - fen;
window.giftWalletSet(w);
return true;
} catch (e) { return false; }
}
function statsKey() { return prefix() + ':auction-stats'; }
function loadStats() {
const d = { sessions: 0, myWins: 0, taWins: 0, spentFen: 0 };
try {
const raw = lsGet(statsKey());
if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object') return Object.assign(d, v); }
} catch (e) {}
return d;
}
function saveStats(s) { persist(statsKey(), s); }
function bagKey() { return prefix() + ':auction-items'; }
function loadBag() {
try { const a = JSON.parse(lsGet(bagKey()) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function saveBag(a) { persist(bagKey(), a); }
function giftsKey() { return prefix() + ':au-gifts-pending'; }
function loadPending() { try { const a = JSON.parse(lsGet(giftsKey()) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function savePending(a) { persist(giftsKey(), a); }
let giftTimer = null;
function checkGifts() {
const pend = loadPending();
if (!pend.length) return;
const now = Date.now();
let delivered = 0;
const rest = [];
pend.forEach((p) => {
if (p.due <= now) {
const bag = loadBag();
bag.unshift({ ico: p.ico, img: p.img || '', name: p.name, fen: 0, ts: Date.now(), from: 'ta' });
saveBag(bag);
delivered++;
try { if (window.chatAddIn) window.chatAddIn(T('TA') + ' 把之前拍走的「' + p.name + '」寄给你了，纸条上写：拍品该物归原主呀', {}); } catch (e) {}
} else rest.push(p);
});
if (rest.length !== pend.length) savePending(rest);
if (delivered && statusEl && !panel.hidden) setStatus('📬 ' + T('TA') + ' 寄来了 ' + delivered + ' 件拍品，已收进 🎒');
if (delivered && bagOpen) { try { showBag(); } catch (e) {} }
}
let st = null;
let thinkT = null;
let bagOpen = false; // #343/#346 背包覆盖层是否开着（寄到重渲染判定用）
function newState() {
const lots = shuffle(activePool()).slice(0, LOTS_PER_SESSION);
return {
started: false,
over: false,           // 一场是否结束
lots: lots,            // 本场拍品
idx: 0,                // 当前第几件
phase: 'idle',         // idle / bidding / done
cur: 0,                // 当前出价（分）
leader: 'none',        // none / you / ta
mode: 'normal',        // TA 本件状态
limit: 0,              // TA 心理价位（分）
spent: 0, myWins: 0, taWins: 0, passed: 0
};
}
function renderLot() {
const item = st.lots[st.idx];
if (lotEl) lotEl.textContent = '第 ' + (st.idx + 1) + ' / ' + st.lots.length + ' 件';
if (balanceEl) balanceEl.textContent = walletOk() ? '心意币 ' + yuan(myBalance()) : '心意币 —';
if (itemEl) {
let bidTxt;
if (st.leader === 'none') bidTxt = '起拍价 ' + yuan(st.cur);
else if (st.leader === 'you') bidTxt = '你的出价 ' + yuan(st.cur);
else bidTxt = esc(T('TA')) + ' 出价 ' + yuan(st.cur);
const auImg = item.mystery ? '' : auSafeImg(item.img);
const showIco = item.mystery ? '\u{1F381}' : auImg ? '<img class="au-ico-img" src="' + auImg + '" alt="">' : item.ico;
const showName = item.mystery ? '神秘拍品' : esc(item.name);
const leadCls = st.leader === 'you' ? ' au-lead-you' : st.leader === 'ta' ? ' au-lead-ta' : '';
itemEl.innerHTML =
'<div class="au-ico">' + showIco + '</div>' +
'<div class="au-name">' + showName + '</div>' +
'<div class="au-desc">' + esc(item.desc) + '</div>' +
'<div class="au-bid' + leadCls + '">' + bidTxt + '</div>';
}
updateBidBtns();
if (itemEl) { itemEl.classList.remove('au-in'); void itemEl.offsetWidth; itemEl.classList.add('au-in'); }
}
function lotActive() { return st && st.started && !st.over && st.phase === 'bidding'; }
function updateBidBtns() {
const STEPSa = [STEP1, STEP5, STEP13];
const bidBtns = [bid1Btn, bid5Btn, bid13Btn];
const cur = (st && typeof st.cur === 'number') ? st.cur : 0;
bidBtns.forEach((b, i) => { if (b && st) { b.textContent = '出 ' + yuanC(cur + STEPSa[i]); } });
const waiting = lotActive() && st.leader === 'you' && !!thinkT;
const on = lotActive() && !waiting && walletOk() && myBalance() >= st.cur + STEP1;
bidBtns.forEach((b) => { if (b) b.disabled = !on; });
if (passBtn) {
passBtn.disabled = !lotActive() || waiting;
passBtn.textContent = (lotActive() && st.leader === 'you') ? ('落槌 · ' + yuanC(st.cur)) : '放弃这件';
}
bidBtns.forEach((b, i) => {
if (b && on) {
const step = STEPSa[i];
b.disabled = myBalance() < st.cur + step;
}
});
if (walletHintEl) {
const noWallet = lotActive() && !walletOk();
const noBalance = lotActive() && walletOk() && myBalance() < st.cur + STEP1;
walletHintEl.hidden = !(noWallet || noBalance);
walletHintEl.textContent = noWallet
? '心意币账本还没就绪，先去心意集市逛逛吧'
: (noBalance ? '心意币不够出这一价了——去集市补点心意币，或点「放弃这件」' : '');
}
}
function setStatus(html) { if (statusEl) statusEl.innerHTML = html; }
let bubbleT = null;
function taSay(text) {
if (!stageEl) return;
try {
let b = stageEl.querySelector('.tg-bubble');
if (!b) { b = document.createElement('div'); b.className = 'tg-bubble'; stageEl.appendChild(b); }
b.textContent = text;
b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
clearTimeout(bubbleT);
bubbleT = setTimeout(() => { try { b.classList.remove('show'); } catch (e) {} }, 1600);
} catch (e) {}
}
function newSession() {
clearTimeout(thinkT); thinkT = null;
st = newState();
st.started = true;
hideOverlay();
hideIntro();   // #321 收掉开场全屏教学，别挡着拍品
hideHelp();   // #321 收掉详细玩法
openLot();
}
function openLot() {
st.phase = 'bidding';
hideOverlay();   // #343 上一件的结果浮层必须收掉——原先漏收，「下一件」后新拍品被结果层盖住点不了
if (endBtn) endBtn.hidden = true;
const r = Math.random();
st.mode = r < 0.25 ? 'eager' : r < 0.6 ? 'normal' : r < 0.85 ? 'stingy' : 'bluff';
const item = st.lots[st.idx];
st.cur = item.base;
st.leader = 'none';
let factor = TA_MODES[st.mode].factor;
st.lucky = (typeof window.arcadeMult === 'function') && window.arcadeMult('auction') === 2;
if (st.lucky) factor *= 0.8;   // #301 幸运拍卖：TA 今天手松，价位打八折
st.limit = Math.max(100, Math.round(item.base * factor / 10) * 10);
renderLot();
if (st.lucky) {
if (typeof window.arcadeMarkLuckyPlayed === 'function') window.arcadeMarkLuckyPlayed('auction');
setStatus('🍀 今日幸运拍卖：' + T('TA') + '今天手松——' + TA_MODES[st.mode].talk + '，你来出价');
} else {
setStatus('槌起！' + T('TA') + TA_MODES[st.mode].talk + '——你来出价');
}
}
function myBid(step) {
if (!lotActive()) return;
placeBid(st.cur + step);
}
function placeBid(newCur) {
if (!lotActive()) return;
const bal = myBalance();
if (!walletOk() || bal < newCur) { setStatus('心意币不够这个价——去心意集市补点吧'); updateBidBtns(); return; }
st.cur = newCur;
st.leader = 'you';
sfxBid();
renderLot();
scheduleTaThink('TA低头想了想……');
}
function customBidModal() {
if (!lotActive() || !walletOk() || typeof window.openModal !== 'function') return;
const minFen = st.cur + STEP1;
const ctl = window.openModal('自定义出价', String(minFen / 100), function (v) {
const fen = Math.round(parseFloat(String(v).replace(/[^\d.]/g, '')) * 100);
if (!fen || fen < minFen) { ctl.stay(); ctl.text(''); ctl.ph('至少要比当前价多 ¥1（≥' + yuanC(minFen) + '）'); return; }
placeBid(fen);
}, { inputmode: 'decimal', placeholder: '直接压上这个价（≥' + yuanC(minFen) + '）' });
try { if (ctl) ctl.okText('压价'); } catch (e) {}
}
function myPass() {
if (!lotActive()) return;
if (st.leader === 'you') {
const price = st.cur;
const item = st.lots[st.idx];
try {
if (typeof window.openModal === 'function') {
const ctl = window.openModal('确认落槌', '', function () { hammer(); }, {
noInput: true,
staticText: '以 ' + yuanC(price) + ' 拍下「' + item.ico + ' ' + esc(item.name) + '」？心意币将真实扣减，落槌不可撤回。'
});
try { if (ctl && ctl.okText) ctl.okText('落槌成交'); } catch (e2) {}
return;
}
} catch (e2) {}
hammer();
return;
}
if (st.limit >= st.cur) { taTake(); return; }
passLot();
}
function scheduleTaThink(line) {
clearTimeout(thinkT);
setStatus(T(line));
updateBidBtns();
thinkT = setTimeout(taThink, Math.round((TALK_MIN + Math.random() * TALK_VAR) * fastMul()));
}
function taThink() {
clearTimeout(thinkT); thinkT = null;
if (!st || !st.started || st.over || st.phase !== 'bidding') return;
const m = TA_MODES[st.mode];
if (st.mode === 'bluff' && st.cur >= st.limit && Math.random() < 0.35) { taFold(); return; }
if (st.cur < st.limit) {
let step = pick(m.stepPref) || STEP1;
let bid = st.cur + step;
if (st.mode !== 'eager' && bid > st.limit) bid = st.limit;
st.cur = Math.max(bid, st.cur + STEP1);
st.leader = 'ta';
sfxBid();
renderLot();
taSay(pick(m.calls));
setStatus(T('TA') + '举牌：' + yuan(st.cur) + '——到你出价了');
updateBidBtns();
} else {
if (st.mode === 'bluff') taSay(pick(['好吧，被你看穿了', '其实……也就那样']));
taFold();
}
}
function taFold() {
if (st.leader === 'you') { hammer('you'); return; }
passLot();
}
function taTake() {
st.phase = 'done';
clearTimeout(thinkT); thinkT = null;
st.taWins++;
sfxLose();
const s = loadStats();
s.taWins = (s.taWins || 0) + 1;
saveStats(s);
const item = st.lots[st.idx];
sfxHammer();
buzz(80);                 // #348 被抢走震动
recordHistory(item, st.cur, 'ta');
try {
const pend = loadPending();
pend.push({ ico: item.ico, img: item.img || '', name: item.name, due: Date.now() + (2 + Math.floor(Math.random() * 3)) * 86400000 });
savePending(pend);
} catch (e) {}
const rt = rarityOf(item);
showOverlay(T('TA') + '拍得了',
'<div class="au-ov-ico">' + item.ico + '</div>' +
'<div class="pong-end-stat"><span class="au-rare ' + rt.cls + '">' + rt.label + '</span> ' + esc(item.name) + ' · ' + yuan(st.cur) + ' 归 ' + esc(T('TA')) + '</div>' +
'<div class="pong-end-stat">📬 不过 TA 拍走的拍品，过几天会寄回给你</div>',
st.idx + 1 < st.lots.length ? '下一件' : '结算', 'ta');
setStatus(esc(T('TA')) + '把「' + esc(item.name) + '」抱走了');
try {
const fb = ['这件归我啦。', '嘿嘿，到手。', '眼光不错吧。'];
const pool = window.getInteractPool ? window.getInteractPool('游戏胜利·回应', fb) : fb;
const say = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ''; // #1515 整组停用＝静默（TA 抱走）
const cid1 = prefix();
if (say) setTimeout(() => {
if (prefix() !== cid1) return;
try { if (window.chatAddIn) window.chatAddIn(say, { silent: true }); } catch (e) {}
}, 800);
} catch (e) {}
nextLotBtn();
}
function passLot() {
st.phase = 'done';
clearTimeout(thinkT); thinkT = null;
st.passed++;
const item = st.lots[st.idx];
recordHistory(item, st.cur, 'pass');
showOverlay('流拍了',
'<div class="au-ov-ico">' + item.ico + '</div>' +
'<div class="pong-end-stat">' + esc(item.name) + ' 没人要，收回仓库</div>',
st.idx + 1 < st.lots.length ? '下一件' : '结算', 'pass');
setStatus('「' + esc(item.name) + '」流拍了');
try {
const fb = ['这玩意没人要啊。', '亏本了亏本了。'];
const pool = window.getInteractPool ? window.getInteractPool('游戏平局·回应', fb) : fb;
const say = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ''; // #1515 整组停用＝静默（流拍）
const cid2 = prefix();
if (say) setTimeout(() => {
if (prefix() !== cid2) return;
try { if (window.chatAddIn) window.chatAddIn(say, { silent: true }); } catch (e) {}
}, 800);
} catch (e) {}
nextLotBtn();
}
function hammer() {
if (!st || st.phase !== 'bidding') return;   // FIX 2026-09-16：确认弹窗期间 TA 可能已折价落槌，防二次扣款
st.phase = 'done';
clearTimeout(thinkT); thinkT = null;
const item = st.lots[st.idx];
if (!walletDeduct(st.cur)) {
showOverlay('扣款失败', '<div class="pong-end-stat">心意币余额不够了，这件不算了</div>', st.idx + 1 < st.lots.length ? '下一件' : '结算');
nextLotBtn();
return;
}
st.myWins++;
st.spent += st.cur;
const s = loadStats();
s.myWins = (s.myWins || 0) + 1;
s.spentFen = (s.spentFen || 0) + st.cur;
const bag = loadBag();
bag.push({ ico: item.ico, img: item.img || '', name: item.name, fen: st.cur, ts: Date.now(), rarity: rarityOf(item).label });
if (!persist(bagKey(), bag) || !persist(statsKey(), s)) {
walletDeduct(-st.cur);
st.myWins--; st.spent -= st.cur;
showOverlay('存储失败', '<div class="pong-end-stat">本地存储暂时不可用，这件没拍成，心意币已退回</div>', st.idx + 1 < st.lots.length ? '下一件' : '结算');
nextLotBtn();
return;
}
sfxWin(); sfxHammer();
buzz([30, 40, 80]);       // #348 落槌成交震动
recordHistory(item, st.cur, 'you');
taSay(pick(['被你拍走了…', '亏了亏了', '那件我本来想要来着']));
if (balanceEl) balanceEl.textContent = walletOk() ? '心意币 ' + yuan(myBalance()) : '心意币 —';
const rt = rarityOf(item);
showOverlay('落槌！',
'<div class="au-ov-ico">' + item.ico + '</div>' +
'<div class="pong-end-stat"><span class="au-rare ' + rt.cls + '">' + rt.label + '</span> ' + esc(item.name) + ' · ' + yuan(st.cur) + ' 拍下</div>' +
'<div class="pong-end-stat">💌 ' + esc(item.wish) + '</div>' +
'<div class="pong-end-stat">已收进 🎒 小收藏（剩 ' + yuan(myBalance()) + '）· 可在 🎒 里转赠给 ' + esc(T('TA')) + '</div>',
st.idx + 1 < st.lots.length ? '下一件' : '结算', 'win');
setStatus('「' + esc(item.name) + '」是你的了，花了 ' + yuan(st.cur));
try {
const fb = ['被你拍走了…', '亏了亏了。', '那件本来我想要来着。'];
const pool = window.getInteractPool ? window.getInteractPool('游戏失败·回应', fb) : fb;
const say = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ''; // #1515 整组停用＝静默（被拍走）
const cid0 = prefix();
if (say) setTimeout(() => {
if (prefix() !== cid0) return;
try { if (window.chatAddIn) window.chatAddIn(say, { silent: true }); } catch (e) {}
}, 800);
} catch (e) {}
try {
const auDrop = (typeof window.arcadeTryDrop === 'function') ? window.arcadeTryDrop('auction') : null;
if (auDrop) taSay('还掉了「' + auDrop.name + '」！游乐室图鉴 +1');
} catch (e) {}
nextLotBtn();
}
function nextLotBtn() {
if (startBtn) startBtn.textContent = st.idx + 1 < st.lots.length ? '下一件' : '结算';
if (endBtn) endBtn.hidden = false;
}
function advance() {
if (!st) return;
if (st.idx + 1 < st.lots.length) {
st.idx++;
openLot();
} else {
endSession();
}
}
function endSession() {
st.over = true;
st.phase = 'idle';
const s = loadStats();
s.sessions = (s.sessions || 0) + 1;
saveStats(s);
showSummary();
try {
let txt = T('心意币拍卖会') + ' · ';
if (st.myWins) txt += '拍下 ' + st.myWins + ' 件 ' + yuan(st.spent);
else txt += '空手而归';
if (st.taWins) txt += ' · ' + T('TA') + ' 拍走 ' + st.taWins + ' 件';
const auRes = st.myWins >= st.taWins ? (st.myWins ? '拍下 ' + st.myWins + ' 件！' : '谁也没拍到') : '{ta} 拍走 ' + st.taWins + ' 件';
if (window.chatAddSystem) window.chatAddSystem(txt, { special: 'auction', game: {
name: '心意币拍卖会',
outcome: st.myWins > st.taWins ? 'win' : st.taWins > st.myWins ? 'lose' : 'draw',
result: auRes,
stats: ['我拍下 ' + st.myWins + ' 件 · 花了 ' + yuan(st.spent), '{ta} 拍走 ' + st.taWins + ' 件', '本场 ' + st.lots.length + ' 件拍品 · 累计 ' + s.sessions + ' 场']
} });
} catch (e) {}
}
function showSummary() {
const s = loadStats();
showOverlay('本场结束',
'<div class="pong-end-stat">你拍得 ' + st.myWins + ' 件 · 花了 ' + yuan(st.spent) + '</div>' +
'<div class="pong-end-stat">' + T('TA') + ' 拍走 ' + st.taWins + ' 件 · 流拍 ' + st.passed + ' 件</div>' +
'<div class="pong-end-stat">累计 ' + s.sessions + ' 场 · 🎒 收藏 ' + loadBag().length + ' 件</div>',
'再来一场');
if (startBtn) startBtn.textContent = '再来一场';
if (endBtn) endBtn.hidden = false;
setStatus('本场结束，点击「再来一场」');
}
function bagRarity(it) {
if (it.rarity) return { label: it.rarity, cls: it.rarity === 'SSR' ? 'au-r2' : it.rarity === '稀有' ? 'au-r1' : 'au-r0' };
let src = null;
try { src = POOL.concat(loadCustom()).find((c) => c.name === it.name) || null; } catch (e) {}
const r = rarityOf(src || { base: it.fen || 0 });
return { label: r.label, cls: r.cls };
}
function bagDate(ts) { try { const d = new Date(ts); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; } catch (e) { return ''; } }
function showBag() {
bagOpen = true;
const bag = loadBag();
let body;
if (!bag.length) {
body = '<div class="au-bag-empty">' +
'<div class="au-bag-empty-ico">🎒</div>' +
'<div class="au-bag-empty-t">还什么都没拍到</div>' +
'<div class="au-bag-empty-s">开一场拍卖会，把第一件宝贝抱回来</div>' +
'<button class="pong-overlay-btn au-bag-empty-btn" type="button">开始拍卖</button></div>';
} else {
const s = loadStats();
let taCnt = 0;
bag.forEach((it) => { if (it.from === 'ta') taCnt++; });
const stat = '共 <b>' + bag.length + '</b> 件 · 累计花费 <b>' + yuan(s.spentFen || 0) + '</b>' +
(taCnt ? ' · ' + esc(T('TA')) + ' 寄回 <b>' + taCnt + '</b> 件' : '');
body = '<div class="au-bag-stat">' + stat + '</div><div class="au-bag-grid">' +
bag.map((it, i) => {
const rt = bagRarity(it);
const frame = rt.cls === 'au-r2' ? ' au-bag-ssr' : rt.cls === 'au-r1' ? ' au-bag-rare' : '';
const foot = it.from === 'ta'
? '<div class="au-bag-meta au-bag-from-ta">📬 ' + esc(T('TA')) + ' 寄来的</div>'
: '<div class="au-bag-meta">' + yuan(it.fen) + ' 拍下 · ' + bagDate(it.ts) + '</div>' +
'<button class="pong-overlay-btn au-send-btn au-bag-send" data-i="' + i + '" type="button">送' + esc(T('TA')) + '</button>';
return '<div class="au-bag-card' + frame + '">' +
'<span class="au-rare ' + rt.cls + ' au-bag-badge">' + rt.label + '</span>' +
'<div class="au-bag-tile">' + (auSafeImg(it.img) ? '<img class="au-bag-img" src="' + auSafeImg(it.img) + '" alt="">' : it.ico) + '</div>' +
'<div class="au-bag-name">' + esc(it.name) + '</div>' + foot + '</div>';
}).join('') + '</div>';
}
showOverlay('🎒 拍品收藏（' + bag.length + '）', body, '返回', '', true);
if (startBtn) startBtn.textContent = '返回'; // #346 统一返回语义：场次中回竞价、结算后回本场汇总
if (endBtn) endBtn.hidden = !(st && st.started && !st.over);
}
function showHistory() {
const h = loadHistory();
const fmt = (t) => { const d = new Date(t); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; };
const whoTxt = { you: '你拍得', ta: T('TA') + '拍走', pass: '流拍' };
const cls = (r) => r === 'SSR' ? 'au-r2' : r === '稀有' ? 'au-r1' : 'au-r0';
const body = h.length
? h.map((it) => '<div class="pong-end-stat au-hist-row"><span class="au-rare ' + cls(it.rarity) + '">' + (it.rarity || '普通') + '</span> ' + (auSafeImg(it.img) ? '<img class="au-hist-img" src="' + auSafeImg(it.img) + '" alt="">' : it.ico) + ' ' + esc(it.name) + ' · ' + (it.who === 'pass' ? '流拍' : yuan(it.price)) + ' · ' + (whoTxt[it.who] || '') + ' · ' + fmt(it.t) + '</div>').join('')
: '<div class="pong-end-stat">还没拍过任何东西</div>';
showOverlay('📜 拍卖记录（' + h.length + '）', body, '返回', '', true);
if (startBtn) startBtn.textContent = '返回';
if (endBtn) endBtn.hidden = !(st && st.started && !st.over);
}
const ED_ICOS = ['🎁', '💎', '🧸', '🌈', '🏮', '⭐', '🎧', '🎀', '🧿', '🌙', '✈️', '🎫', '🍰', '🕯️', '🎮', '⚽', '🎨', '🍫', '🧶', '🔮', '🍵', '🪁', '🐚', '🌻'];
const edEl = document.getElementById('au-editor');
const edTitleEl = document.getElementById('au-ed-title');
const edPreviewEl = document.getElementById('au-ed-preview');
const edGridEl = document.getElementById('au-ed-grid');
const edImgPrevEl = document.getElementById('au-ed-imgprev');
const edImgBtn = document.getElementById('au-ed-imgbtn');
const edImgClearBtn = document.getElementById('au-ed-imgclear');
const edNameEl = document.getElementById('au-ed-name');
const edDescEl = document.getElementById('au-ed-desc');
const edBaseEl = document.getElementById('au-ed-base');
const edWishEl = document.getElementById('au-ed-wish');
const edMysteryEl = document.getElementById('au-ed-mystery');
const edHintEl = document.getElementById('au-ed-hint');
const edLibEl = document.getElementById('au-ed-lib');
const edDelBtn = document.getElementById('au-ed-del');
const edCancelBtn = document.getElementById('au-ed-cancel');
const edSaveBtn = document.getElementById('au-ed-save');
const edCloseBtn = document.getElementById('au-ed-close');
let ed = null; // { idx:null|number, ico, img, mysteryOn }——文本字段以 DOM 为准，这里只存非文本态
function auSafeImg(s) {
return typeof s === 'string' && s.length <= 1200000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(s) ? s : '';
}
function compressAuImg(src) {
if (!window.mochiImgCompressTo) return Promise.resolve(null);
return window.mochiImgCompressTo(src, { maxSide: 480, quality: 0.85, mime: 'image/jpeg', opaque: true, tag: 'au-img' });
}
function edHint(msg) {
if (!edHintEl) return;
edHintEl.textContent = msg || '';
edHintEl.hidden = !msg;
}
function edVal(el) { return el ? String(el.value || '').trim() : ''; }
function edPreviewHtml() {
const name = edVal(edNameEl) || '拍品名称';
const desc = edVal(edDescEl) || '我们自己才懂的小玩意';
const yuanV = parseFloat(edVal(edBaseEl).replace(/[^\d.]/g, ''));
const img = ed && auSafeImg(ed.img);
const face = !ed ? '🎁' : ed.mysteryOn ? '🎁' : img ? '<img class="au-ed-pimg" src="' + img + '" alt="">' : ed.ico;
return '<div class="au-ed-pface">' + face + '</div>' +
'<div class="au-ed-pinfo"><div class="au-ed-pname">' + esc(ed && ed.mysteryOn ? '神秘拍品' : name) + '</div>' +
'<div class="au-ed-pdesc">' + esc(desc) + '</div>' +
'<div class="au-ed-pbase">起拍 ' + (yuanV > 0 ? '¥' + yuanV : '—') + '</div></div>';
}
function renderEdPreview() { if (edPreviewEl) edPreviewEl.innerHTML = edPreviewHtml(); }
function renderEdGrid() {
if (!edGridEl || !ed) return;
const imgOn = !!auSafeImg(ed.img);
edGridEl.innerHTML = ED_ICOS.map((e) => '<button type="button" class="au-ed-ico' + (e === ed.ico && !imgOn ? ' on' : '') + '" data-ico="' + e + '">' + e + '</button>').join('');
}
function renderEdImg() {
if (!edImgPrevEl || !ed) return;
const img = auSafeImg(ed.img);
edImgPrevEl.innerHTML = img ? '<img src="' + img + '" alt="">' : '🖼️';
if (edImgBtn) edImgBtn.textContent = img ? '换一张' : '上传图片';
if (edImgClearBtn) edImgClearBtn.hidden = !img;
}
function renderEdLib() {
if (!edLibEl) return;
const a = loadCustom();
if (!a.length) { edLibEl.innerHTML = ''; return; }
edLibEl.innerHTML = '<div class="au-ed-lib-t">已有 ' + a.length + '/20 · 点选即改</div>' +
a.map((c, i) => {
const img = auSafeImg(c.img);
return '<button type="button" class="au-ed-chip' + (ed && ed.idx === i ? ' on' : '') + '" data-i="' + i + '">' +
(img ? '<img src="' + img + '" alt="">' : esc(c.ico || '🎁')) + esc(c.name) + '</button>';
}).join('');
}
function openEditor(idx) {
if (!edEl) return;
const a = loadCustom();
if (idx != null && !a[idx]) idx = null;
const c = idx == null ? null : a[idx];
ed = { idx: idx, ico: c ? (c.ico || '🎁') : ED_ICOS[0], img: c ? auSafeImg(c.img) : '', mysteryOn: c ? !!c.mystery : false };
if (edTitleEl) edTitleEl.textContent = c ? '✏️ 编辑「' + c.name + '」' : '✏️ 自制新拍品';
if (edNameEl) edNameEl.value = c ? c.name : '';
if (edDescEl) edDescEl.value = c ? (c.desc || '') : '';
if (edBaseEl) edBaseEl.value = c ? String(c.base / 100) : '';
if (edWishEl) edWishEl.value = c ? (c.wish || '') : '';
if (edMysteryEl) edMysteryEl.checked = !!c && !!c.mystery;
if (edDelBtn) edDelBtn.hidden = idx == null;
edHint('');
renderEdGrid(); renderEdImg(); renderEdLib(); renderEdPreview();
edEl.hidden = false;
}
function closeEditor() { ed = null; if (edEl) edEl.hidden = true; }
function edSave() {
if (!ed) return;
const name = edVal(edNameEl);
if (!name) { edHint('先给拍品起个名称'); return; }
const yuanV = parseFloat(edVal(edBaseEl).replace(/[^\d.]/g, ''));
if (!yuanV || yuanV <= 0) { edHint('底价要大于 0（例：20 或 9.9）'); return; }
const a = loadCustom();
if (a.some((c, i) => i !== ed.idx && c.name === name)) { edHint('已有同名拍品，换个名称（想改它就点下面的库条）'); return; }
if (ed.idx == null && a.length >= 20) { edHint('自制拍品已满 20 个，先删一个再加'); return; }
const item = {
ico: ed.ico, img: auSafeImg(ed.img), name: name,
desc: edVal(edDescEl) || '我们自己才懂的小玩意',
base: Math.max(100, Math.round(yuanV * 100)),
wish: edVal(edWishEl) || '是心意呀。',
mystery: edMysteryEl && edMysteryEl.checked ? 1 : 0
};
if (ed.idx == null) a.push(item); else a[ed.idx] = item;
if (!saveCustom(a)) { edHint('本地存储写不进去（图片太大？），移除图片或少留几件再试'); return; }
taSay(ed.idx == null ? pick(['又上新拍品啦？', '你出的题我接了']) : pick(['这件还改了配方？更期待了']));
closeEditor();
}
function edDelete() {
if (!ed || ed.idx == null) return;
if (typeof window.openModal !== 'function') { closeEditor(); return; }
const a = loadCustom();
const name = a[ed.idx] ? a[ed.idx].name : '';
const target = ed.idx;
const delCtl = window.openModal('删除自制拍品', '', function () {
const cur = loadCustom();
cur.splice(target, 1);
saveCustom(cur);
taSay(pick(['这件……不拍了？', '行吧，收回仓库']));
closeEditor();
}, { staticText: '「' + name + '」将从自制库移除（已拍进 🎒 的不受影响）', noInput: true });
if (delCtl && delCtl.okText) delCtl.okText('删除');
}
if (edGridEl) edGridEl.addEventListener('click', (e) => {
const b = e.target.closest('.au-ed-ico');
if (!b || !ed) return;
e.stopPropagation();
ed.ico = b.getAttribute('data-ico') || '🎁';
ed.img = ''; // 选 emoji 即弃图（图片盖过 emoji，留残图会所见非所得）
renderEdGrid(); renderEdImg(); renderEdPreview();
});
if (edLibEl) edLibEl.addEventListener('click', (e) => {
const b = e.target.closest('.au-ed-chip');
if (!b) return;
e.stopPropagation();
openEditor(parseInt(b.getAttribute('data-i'), 10) || 0);
});
if (edImgClearBtn) edImgClearBtn.addEventListener('click', (e) => {
e.stopPropagation();
if (!ed) return;
ed.img = '';
renderEdImg(); renderEdGrid(); renderEdPreview();
});
if (edImgBtn && typeof window.mochiFilePickSurface === 'function') {
window.mochiFilePickSurface(edImgBtn, {
id: 'au-ed-img-surf', accept: 'image/*', entry: 'au-ed-img',
onFiles: function (files) {
const f = files && files[0];
if (!f || !/^image\//i.test(f.type || '')) return;
if (!window.mochiImgCompressTo) { edHint('图片处理组件没加载上（缓存过旧或离线），请重新打开页面再试'); return; }
compressAuImg(f).then(function (data) {
if (!data) { edHint('这张图本机浏览器处理不了，换一张小图试试'); return; }
if (!ed) return;
ed.img = data;
renderEdImg(); renderEdGrid(); renderEdPreview();
});
}
});
} else if (edImgBtn) {
edImgBtn.addEventListener('click', () => edHint('这台浏览器暂不支持在这里选图，先选个 emoji'));
}
[edNameEl, edDescEl, edBaseEl].forEach((el) => { if (el) el.addEventListener('input', renderEdPreview); });
if (edMysteryEl) edMysteryEl.addEventListener('change', () => { if (ed) ed.mysteryOn = edMysteryEl.checked; renderEdPreview(); });
if (edSaveBtn) edSaveBtn.addEventListener('click', (e) => { e.stopPropagation(); edSave(); });
if (edDelBtn) edDelBtn.addEventListener('click', (e) => { e.stopPropagation(); edDelete(); });
if (edCancelBtn) edCancelBtn.addEventListener('click', (e) => { e.stopPropagation(); closeEditor(); });
if (edCloseBtn) edCloseBtn.addEventListener('click', (e) => { e.stopPropagation(); closeEditor(); });
function giftAway(i) {
const bag = loadBag();
const it = bag[i];
if (!it) return;
const wish = '拍卖会上抢到的，转送给你';
try {
if (typeof window.recordGiftBox === 'function') {
window.recordGiftBox({ id: 'au_' + Date.now(), giftId: '', name: it.name, emoji: it.ico, img: auSafeImg(it.img), price: it.fen / 100, cat: '拍卖会', wish: wish }, 'out', wish);
}
} catch (e) {}
bag.splice(i, 1);
saveBag(bag);
sfxHammer();
taSay(pick(['送给我的？！', '谢谢，我很喜欢！', '怎么突然对我这么好']));
try {
if (window.chatAddSystem) window.chatAddSystem(T('心意币拍卖会') + ' · 转赠 ' + T('TA') + '「' + it.name + '」', { special: 'auction' });
} catch (e) {}
const cid3 = prefix();
setTimeout(() => {
if (prefix() !== cid3) return;
try { if (window.chatAddIn) window.chatAddIn(pick(['收下啦！超喜欢', '你也喜欢就好', '下次拍卖会我让给你一件']), { silent: true }); } catch (e) {}
}, 900);
showBag();
}
function showOverlay(title, body, btnText, mood, fs) {
if (!overlayEl) return;
if (ovTitleEl) ovTitleEl.innerHTML = title || '';
if (ovBodyEl) ovBodyEl.innerHTML = body || '';
if (startBtn && btnText) startBtn.textContent = btnText;
overlayEl.classList.remove('au-ov-win', 'au-ov-ta', 'au-ov-pass');
if (mood) overlayEl.classList.add('au-ov-' + mood);
overlayEl.classList.toggle('au-ov-fs', !!fs);
overlayEl.hidden = false;
updateBidBtns();
}
function showStartOverlay() {
const s = loadStats();
if (introStepsEl) {
introStepsEl.innerHTML =
'<b>怎么玩</b>：和 ' + T('TA') + ' 轮番举牌，抢 3 件宝贝，价高者得。<br>' +
'<b>① 看拍品</b>　每件有起拍价，先掂量值不值。<br>' +
'<b>② 出价</b>　点档位「出 ¥X」就是在当前价上加价、压上你的价。<br>' +
'<b>③ 轮替</b>　你出价后 ' + T('TA') + ' 掂量掂量，轮到你时按钮才亮。<br>' +
'<b>④ 成交</b>　你最高价点「落槌」→按现价买下（真扣心意币、进 🎒）；' + T('TA') + ' 最高价→放弃这件；都不要→流拍。<br>' +
'<b>⑤ 彩蛋</b>　' + T('TA') + ' 拍走的过几天寄回给你。';
}
const statsHtml =
(s.sessions > 0 ? '累计 ' + s.sessions + ' 场 · 你拍得 ' + s.myWins + ' 件 · 花了 ' + yuan(s.spentFen || 0) + '　' : '') +
'当前心意币 ' + (walletOk() ? yuan(myBalance()) : '—');
if (introStatEl) introStatEl.textContent = statsHtml;
showIntro();
hideOverlay(); // 半框覆盖层平时不显示（开场/成交才由流程显示）
setStatus('全屏读玩法：点下方「开始拍卖」，或「详细玩法」');
}
function hideOverlay() { if (overlayEl) { overlayEl.hidden = true; overlayEl.classList.remove('au-ov-fs'); } bagOpen = false; }
if (startBtn) startBtn.addEventListener('click', (e) => {
e.stopPropagation();
if (overlayEl && !overlayEl.hidden) {
const t = startBtn.textContent || '';
if (t === '下一件' || t === '结算') { advance(); return; }
if (t === '返回') {
hideOverlay();
if (st && st.started && !st.over) {
renderLot();
setStatus(lotActive() && st.leader === 'you' && thinkT ? T('TA') + ' 正在掂量你的出价……' : '继续——到你出价了');
} else if (st && st.over) {
showSummary(); // #346 结算后开背包，「返回」= 回到本场结算汇总
} else {
showStartOverlay(); // 防御：无场次回开场教学
}
return;
}
}
newSession();
});
if (endBtn) endBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
let lpT = null, lpFired = false;
function bindBidBtn(btn, step) {
if (!btn) return;
const start = () => { lpFired = false; clearTimeout(lpT); lpT = setTimeout(() => { lpFired = true; customBidModal(); }, 600); };
const cancel = () => { clearTimeout(lpT); };
btn.addEventListener('touchstart', start, { passive: true });
btn.addEventListener('mousedown', start);
['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach((ev) => btn.addEventListener(ev, cancel));
btn.addEventListener('click', (e) => { e.stopPropagation(); if (lpFired) { lpFired = false; return; } myBid(step); });
}
bindBidBtn(bid1Btn, STEP1);
bindBidBtn(bid5Btn, STEP5);
bindBidBtn(bid13Btn, STEP13);
if (passBtn) passBtn.addEventListener('click', (e) => { e.stopPropagation(); myPass(); });
if (bagBtn) bagBtn.addEventListener('click', (e) => { e.stopPropagation(); showBag(); });
if (historyBtn) historyBtn.addEventListener('click', (e) => { e.stopPropagation(); showHistory(); });
if (addBtn) addBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditor(null); });
if (ovBodyEl) ovBodyEl.addEventListener('click', (e) => {
if (e.target.closest('.au-bag-empty-btn')) { e.stopPropagation(); hideOverlay(); newSession(); return; }
const sendBtn = e.target.closest('.au-send-btn');
if (!sendBtn) return;
e.stopPropagation();
const i = parseInt(sendBtn.getAttribute('data-i'), 10) || 0;
const it = loadBag()[i];
if (!it) return;
try {
if (typeof window.openModal === 'function') {
const ctl = window.openModal('送出拍品', '', function () { giftAway(i); }, {
noInput: true,
staticText: '把「' + it.ico + ' ' + it.name + '」送给 ' + T('TA') + '？送出后不可撤回。'
});
try { if (ctl && ctl.okText) ctl.okText('送出'); } catch (e2) {}
return;
}
} catch (e2) {}
giftAway(i);
});
if (soundBtn) soundBtn.addEventListener('click', (e) => {
e.stopPropagation();
soundOn = !soundOn;
soundBtn.textContent = soundOn ? '🔊' : '🔇';
soundBtn.classList.toggle('pong-sound-off', !soundOn);
try { localStorage.setItem('xy-home-v2:au-sound', soundOn ? '1' : '0'); } catch (e2) {} // #346 偏好记忆
});
function setNames() {
let name = T('TA');
try {
const s = window.activeStore && window.activeStore();
name = (s && (s.get('lbl-partner') || s.get('cs-lbl-partner'))) || name;
} catch (e) {}
if (partnerNameEl) partnerNameEl.textContent = name;
}
window.openAuctionPanel = function () {
try { if (isFs) toggleFs(); } catch (e) {}
panel.hidden = false;
hideHelp();                                              // #321 重开默认收起玩法说明
if (soundBtn) { soundBtn.textContent = soundOn ? '🔊' : '🔇'; soundBtn.classList.toggle('pong-sound-off', !soundOn); } // #346 图标跟随持久化偏好
try { setNames(); } catch (e) {}
try { checkGifts(); } catch (e) {}   // #301 到期回寄投递
if (st && st.started && !st.over) {
if (st.phase === 'bidding') { renderLot(); if (!thinkT && st.leader === 'you') scheduleTaThink('TA低头想了想……'); else updateBidBtns(); }
return;
}
showStartOverlay();
setStatus('全屏读玩法：点「开始拍卖」或「详细玩法」');
};
function closePanel() {
clearTimeout(thinkT); thinkT = null;
clearInterval(giftTimer); giftTimer = null;
bagOpen = false;
hideIntro(); hideHelp();
closeEditor(); // #1041 编辑台也是面板内全屏层：关面板/切联系人（走 closePanel）必须一并收，防旧 idx 跨桌面残留
if (panel) panel.hidden = true;
}
window.closeAuctionPanel = closePanel;
(function watchGifts() {
const mo = new MutationObserver(() => {
if (panel.hidden) { clearInterval(giftTimer); giftTimer = null; return; }
if (!giftTimer) { try { checkGifts(); } catch (e) {} giftTimer = setInterval(() => { try { checkGifts(); } catch (e) {} }, 30000); }
});
mo.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
})();
setInterval(() => { try { checkGifts(); } catch (e) {} }, 600000);
(function restoreFromIdb() {
['auction-items', 'auction-history', 'au-gifts-pending', 'auction-custom'].forEach((k) => {
try {
const key = prefix() + ':' + k;
if (lsGet(key)) return;
if (typeof window.idbGet !== 'function') return;
Promise.resolve(window.idbGet(key)).then((v) => {
try {
if (v === undefined || v === null) return;
const s = typeof v === 'string' ? v : JSON.stringify(v);
if (!s) return;
const p = JSON.parse(s);
if (Array.isArray(p) && p.length) persist(key, s);
} catch (e) {}
}).catch(() => {});
} catch (e) {}
});
})();
document.addEventListener('contact-switched', () => { try { closePanel(); st = null; } catch (e) {} });
(function bindEntry() {
const btn = document.getElementById('more-auction');
if (!btn) return;
btn.addEventListener('click', (e) => {
e.stopPropagation();
const mp = document.getElementById('chat-more-panel');
if (mp) mp.hidden = true;
hideSiblingPanels('chat-auction-panel');
try { if (window.closeAvlib) window.closeAvlib(); } catch (err) {}
try { if (window.closePongPanel) window.closePongPanel(); } catch (err) {}
try { openAuctionPanel(); } catch (err) {
try { panel.hidden = false; showStartOverlay(); setStatus('点击「开场拍卖」'); } catch (e2) {}
try { console.error('[auction] open failed', err); } catch (e2) {}
}
});
try {
if (window.MutationObserver) {
const SIBLING_IDS = siblingIds('chat-auction-panel');
const mo = new MutationObserver(() => {
if (panel.hidden) return;
for (let i = 0; i < SIBLING_IDS.length; i++) {
const el = document.getElementById(SIBLING_IDS[i]);
if (el && !el.hidden) { closePanel(); break; }
}
});
SIBLING_IDS.forEach((id) => { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
}
} catch (e) {}
})();
function siblingIds(self) {
return ['poke-card', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-divine-panel', 'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel', 'chat-pong-panel', 'chat-snake-panel', 'chat-brick-panel', 'chat-c4-panel', 'chat-ms-panel', 'chat-fish-panel', 'chat-memory-panel', 'chat-gift-panel', 'chat-gomoku-panel', 'chat-linkup-panel', 'chat-match3-panel', 'chat-auction-panel', 'chat-arcade-panel', 'chat-more-panel'].filter((id) => id !== self);
}
function hideSiblingPanels(self) {
siblingIds(self).forEach((id) => { const el = document.getElementById(id); if (el) el.hidden = true; });
}
window.__auDebug = {
st: () => st,
newSession: newSession,
myBid: myBid,
loadBag: loadBag,
poolSize: () => activePool().length,
loadCustom: loadCustom,
openEditor: openEditor,
ed: () => ed,
lastBuzz: null,
fast: false
};
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("auction.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("auction.js"); try { console.error("[JS] auction.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[auction.js] " + String(__e && __e.message || __e)); } })();

;/* ==== arcade.js ==== */
(function () { try {
(function () {
const panel = document.getElementById('chat-arcade-panel');
if (!panel) return;
const bodyEl = document.getElementById('arc-body');
const closeBtn = document.getElementById('arc-close');
const partnerNameEl = document.getElementById('arc-partner-name');
const pageEl = document.getElementById('page-arcade');
const pageBodyEl = document.getElementById('arcade-body');
const lgPartnerNameEl = document.getElementById('arcade-lg-partner');
const T = window.taFit || function (x) { return x; };
function prefix() { return (window.activePrefix && window.activePrefix()) || 'xy-home-v2'; }
function today() { return new Date().toISOString().slice(0, 10); }
function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
const LUCKY_KEYS = [
{ k: 'pong', name: 'Pong' }, { k: 'snake', name: '双人贪吃蛇' }, { k: 'c4', name: '四子棋' },
{ k: 'memory', name: '记忆翻牌' }, { k: 'gomoku', name: '五子棋' }, { k: 'linkup', name: '连连看' },
{ k: 'match3', name: '消消乐' }, { k: 'auction', name: '心意币拍卖会' },
{ k: 'fishing', name: '双人钓鱼' }, { k: 'ms', name: '合作扫雷' }, { k: 'brick', name: '双人打砖块' }
];
function luckyKey() {
const d = today();
let h = 0;
for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
return LUCKY_KEYS[h % LUCKY_KEYS.length].k;
}
window.arcadeLuckyKey = luckyKey;
window.arcadeLuckyName = function () {
const k = luckyKey();
const hit = LUCKY_KEYS.filter((x) => x.k === k)[0];
return hit ? hit.name : k;
};
window.arcadeMult = function (key) { return key === luckyKey() ? 2 : 1; };
const LUCKY_MARK_KEY = () => prefix() + ':arcade-lucky-mark';
window.arcadeMarkLuckyPlayed = function (key) {
if (key !== luckyKey()) return;
try { localStorage.setItem(LUCKY_MARK_KEY(), JSON.stringify({ date: today(), key: key })); } catch (e) {}
};
function luckyPlayedToday() {
try { const v = JSON.parse(localStorage.getItem(LUCKY_MARK_KEY()) || ''); return !!(v && v.date === today() && v.key === luckyKey()); } catch (e) { return false; }
}
const DROP_POOL = [
{ ico: '🎠', name: '旋转木马' }, { ico: '🎸', name: '小吉他' }, { ico: '🪁', name: '纸鸢' },
{ ico: '🦆', name: '橡皮鸭' }, { ico: '🕯️', name: '香薰蜡烛' }, { ico: '🪴', name: '多肉盆栽' },
{ ico: '🎠', name: '八音盒', _alt: '🎵' }, { ico: '🛼', name: '轮滑鞋' }, { ico: '🧩', name: '千片拼图' },
{ ico: '🪞', name: '复古圆镜' }, { ico: '🎈', name: '告白气球' }, { ico: '🛸', name: '桌面飞碟' }
];
function dropsKey() { return prefix() + ':arcade-drops'; }
function loadDrops() {
try { const a = JSON.parse(localStorage.getItem(dropsKey()) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function saveDrops(a) { try { localStorage.setItem(dropsKey(), JSON.stringify(a)); } catch (e) {} }
window.arcadeTryDrop = function (src) {
if (!(window.__arcDebug && window.__arcDebug.forceDrop) && Math.random() >= 0.08) return null;
const owned = loadDrops().map((d) => d.name);
const rest = DROP_POOL.filter((d) => owned.indexOf(d.name) < 0);
if (!rest.length) return null;
const it = pick(rest);
const rec = { ico: it._alt || it.ico, name: it.name, src: src || '', ts: Date.now() };
const a = loadDrops(); a.push(rec); saveDrops(a);
return rec;
};
window.arcadeDrops = loadDrops;
function readJson(suf, dft) {
try {
const raw = localStorage.getItem(prefix() + ':' + suf);
if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object') return Object.assign({}, dft, v); }
} catch (e) {}
return Object.assign({}, dft);
}
function statsRows() {
const pong = readJson('pong-stats', { win: 0, lose: 0, draw: 0 });
const c4 = readJson('c4-stats', { w: 0, l: 0, d: 0 });
const gk = readJson('gomoku-stats', { w: 0, l: 0, d: 0 });
const mem = readJson('memory-stats', { clears: 0, bestChem: 0 });
const lk = readJson('linkup-stats', { clears: 0, bestChem: 0 });
const m3 = readJson('match3-stats', { clears: 0, bestChem: 0 });
const au = readJson('auction-stats', { sessions: 0, myWins: 0, spentFen: 0 });
const fs_ = readJson('fishing-stats', { totalCast: 0, totalEarned: 0 });
const ms_ = readJson('ms-stats', { play: 0, win: 0 });
const bk_ = readJson('brick-stats', { plays: 0, layers: 0 });
const yuan = (f) => '¥' + ((f || 0) / 100).toFixed(2);
return [
{ ico: '🏓', name: 'Pong', line: pong.win + '胜 · ' + pong.lose + '负 · ' + pong.draw + '平' },
{ ico: '🔵', name: '四子棋', line: c4.w + '胜 · ' + c4.l + '负 · ' + c4.d + '平' },
{ ico: '⚫', name: '五子棋', line: gk.w + '胜 · ' + gk.l + '负 · ' + gk.d + '平' },
{ ico: '🃏', name: '记忆翻牌', line: '通关 ' + mem.clears + ' 局 · 最佳默契 ' + mem.bestChem },
{ ico: '🔗', name: '连连看', line: '清完 ' + lk.clears + ' 局 · 最佳默契 ' + lk.bestChem },
{ ico: '🍬', name: '消消乐', line: '通关 ' + m3.clears + ' 局 · 最佳默契 ' + m3.bestChem },
{ ico: '🔨', name: '心意币拍卖会', line: au.sessions + ' 场 · 拍得 ' + au.myWins + ' 件 · 花了 ' + yuan(au.spentFen) },
{ ico: '🎣', name: '双人钓鱼', line: '抛竿 ' + fs_.totalCast + ' 次 · 累计赚 ' + yuan(fs_.totalEarned) },
{ ico: '💣', name: '合作扫雷', line: '合作 ' + ms_.play + ' 局 · 完成 ' + ms_.win + ' 次' },
{ ico: '🧱', name: '双人打砖块', line: '玩过 ' + bk_.plays + ' 局 · 通关 ' + bk_.layers + ' 层' }
];
}
function played(k) {
const m = { pong: 'pong-stats', snake: 'snake-score', c4: 'c4-stats', memory: 'memory-stats', gomoku: 'gomoku-stats', linkup: 'linkup-stats', match3: 'match3-stats', auction: 'auction-stats', fishing: 'fishing-stats', ms: 'ms-stats', brick: 'brick-stats' };
try { return !!localStorage.getItem(prefix() + ':' + m[k]); } catch (e) { return false; }
}
function badges() {
const gk = readJson('gomoku-stats', { w: 0, l: 0, d: 0 });
const mem = readJson('memory-stats', { clears: 0, bestChem: 0 });
const lk = readJson('linkup-stats', { clears: 0, bestChem: 0 });
const m3 = readJson('match3-stats', { clears: 0, bestChem: 0 });
const au = readJson('auction-stats', { myWins: 0, sessions: 0 });
const drops = loadDrops();
let bagN = 0;
try { const a = JSON.parse(localStorage.getItem(prefix() + ':auction-items') || '[]'); if (Array.isArray(a)) bagN = a.length; } catch (e) {}
const playedN = ['pong', 'snake', 'c4', 'memory', 'gomoku', 'linkup', 'match3', 'auction', 'fishing', 'ms', 'brick'].filter(played).length;
return [
{ ico: '⚫', name: '五子棋首胜', on: gk.w >= 1 },
{ ico: '🥋', name: '五子棋十胜', on: gk.w >= 10 },
{ ico: '💞', name: '默契满分', on: Math.max(mem.bestChem || 0, lk.bestChem || 0, m3.bestChem || 0) >= 100 },
{ ico: '🔗', name: '连连看×5', on: lk.clears >= 5 },
{ ico: '🍬', name: '消消乐×5', on: m3.clears >= 5 },
{ ico: '🔨', name: '首次拍品', on: au.myWins >= 1 },
{ ico: '🎒', name: '收藏家', on: bagN >= 5 },
{ ico: '🎡', name: '游戏体验官', on: playedN >= 6, tip: '玩过 6 种以上小游戏' },
{ ico: '🌠', name: '第一件摆件', on: drops.length >= 1 },
{ ico: '✨', name: '摆件全收集', on: drops.length >= DROP_POOL.length },
{ ico: '🍀', name: '幸运星', on: luckyPlayedToday(), tip: '在幸运日玩一局幸运游戏' }
];
}
function renderAt(elm) {
if (!elm) return;
const rows = statsRows();
const bds = badges();
const drops = loadDrops();
const owned = drops.map((d) => d.name);
let html = '';
html += '<div class="arc-lucky' + (luckyPlayedToday() ? ' done' : '') + '">🍀 今日幸运游戏：<b>' + window.arcadeLuckyName() + '</b>（奖励 ×2' + (luckyPlayedToday() ? ' · 今天已打卡' : ' · 快去玩一局') + '）</div>';
html += '<div class="arc-sec">📊 和' + T('TA') + '的战绩</div>';
html += rows.map((r) => '<div class="arc-row"><span class="arc-ico">' + r.ico + '</span><span class="arc-name">' + r.name + '</span><span class="arc-line">' + r.line + '</span></div>').join('');
const got = bds.filter((b) => b.on).length;
html += '<div class="arc-sec">🏅 徽章 ' + got + ' / ' + bds.length + '</div>';
html += '<div class="arc-badges">' + bds.map((b) =>
'<span class="arc-badge' + (b.on ? ' on' : '') + '"' + (b.tip ? ' title="' + b.tip + '"' : '') + '>' + b.ico + ' ' + b.name + '</span>').join('') + '</div>';
html += '<div class="arc-sec">🌠 限定摆件图鉴 ' + drops.length + ' / ' + DROP_POOL.length + '<span class="arc-sub">胜利 8% 概率掉落 · 各游戏互通</span></div>';
html += '<div class="arc-drops">' + DROP_POOL.map((d) => {
const has = owned.indexOf(d.name) >= 0;
return '<span class="arc-drop' + (has ? ' on' : '') + '">' + (has ? (d._alt || d.ico) : '❔') + ' ' + d.name + '</span>';
}).join('') + '</div>';
if (drops.length) {
html += '<div class="arc-sec">🧾 最近掉落</div>';
html += drops.slice(-4).reverse().map((d) => '<div class="arc-row"><span class="arc-ico">' + d.ico + '</span><span class="arc-name">' + d.name + '</span><span class="arc-line">' + (d.src || '') + '</span></div>').join('');
}
elm.innerHTML = html;
}
function render() { renderAt(bodyEl); }
function setNames() {
let name = T('TA');
try {
const s = window.activeStore && window.activeStore();
name = (s && (s.get('lbl-partner') || s.get('cs-lbl-partner'))) || name;
} catch (e) {}
if (partnerNameEl) partnerNameEl.textContent = name;
if (lgPartnerNameEl) lgPartnerNameEl.textContent = name;
}
window.openArcadePanel = function () {
panel.hidden = false;
try { setNames(); } catch (e) {}
try { render(); } catch (e) {}
};
function closePanel() { if (panel) panel.hidden = true; }
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
window.closeArcadePanel = closePanel;
document.addEventListener('contact-switched', () => { try { closePanel(); } catch (e) {} });
function openArcadePage() {
if (!pageEl) return;
document.querySelectorAll('.page').forEach(p => p.hidden = true);
pageEl.hidden = false;
try { setNames(); } catch (e) {}
try { renderAt(pageBodyEl); } catch (e) {}
}
function closeArcadePage() {
if (!pageEl) return;
pageEl.hidden = true;
document.querySelectorAll('.page').forEach(p => p.hidden = true);
const homePage = document.getElementById('page-home');
if (homePage) homePage.hidden = false;
}
(function bindHomeEntry() {
const entry = document.getElementById('home-arcade-entry');
if (entry) entry.addEventListener('click', (e) => {
e.stopPropagation();
openArcadePage();
});
const back = document.getElementById('arcade-back');
if (back) back.addEventListener('click', (e) => {
e.stopPropagation();
closeArcadePage();
});
})();
window.openArcadePage = openArcadePage;
window.closeArcadePage = closeArcadePage;
window.__arcDebug = { forceDrop: false, luckyKey: luckyKey, loadDrops: loadDrops };
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("arcade.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("arcade.js"); try { console.error("[JS] arcade.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[arcade.js] " + String(__e && __e.message || __e)); } })();
