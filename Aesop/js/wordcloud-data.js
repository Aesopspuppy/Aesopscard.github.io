/* Browser-native Chinese segmentation and pure word-cloud ranking. */
(function () {
'use strict';
var segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh-CN', { granularity: 'word' }) : null;
function clean(s) {
  if (typeof s !== 'string' || /^(?:data:|blob:|https?:\/\/|mp:|media:)/i.test(s.trim())) return '';
  return s.replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+/g, '').trim();
}
function textOf(m) {
  if (!m || m.special || m.type === 'image' || m.type === 'voice') return '';
  if (Array.isArray(m.parts) && m.parts.length) return m.parts.filter(function (p) { return p.k === 'text'; }).map(function (p) { return clean(p.v); }).filter(Boolean).join('\n');
  return clean(m.text);
}
function words(s) {
  if (!segmenter) return s.match(/[\p{Script=Han}]{2,}|[\p{L}\p{N}]+/gu) || [];
  return Array.from(segmenter.segment(s)).filter(function (p) { return p.isWordLike && Array.from(p.segment).length > 1; }).map(function (p) { return p.segment; });
}
function rank(map) { return Array.from(map, function (p) { return { text: p[0], count: p[1] }; }).sort(function (a, b) { return b.count - a.count || a.text.localeCompare(b.text, 'zh-CN'); }); }
function bucket() { return { cards: new Map(), words: new Map(), chars: new Map() }; }
function add(b, text) {
  text = clean(text); if (!text) return;
  text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (s) { b.cards.set(s, (b.cards.get(s) || 0) + 1); });
  words(text).forEach(function (s) { b.words.set(s, (b.words.get(s) || 0) + 1); });
  Array.from(text).filter(function (s) { return /[\p{L}\p{N}]/u.test(s); }).forEach(function (s) { b.chars.set(s, (b.chars.get(s) || 0) + 1); });
}
function summarize(messages, posts, cid) {
  var ta = bucket(), me = bucket();
  (messages || []).forEach(function (m) { if (m && (m.side === 'in' || m.side === 'out')) add(m.side === 'in' ? ta : me, textOf(m)); });
  function addPost(p, owner) {
    if (!p) return;
    var who = p.role || p.by;
    if (who === 'me') add(me, p.content);
    else if (who === 'ta' && (p.owner || owner || 'default') === cid) add(ta, p.content);
    (p.comments || []).forEach(function (c) { addPost(c, p.owner || owner); });
    (p.replies || []).forEach(function (c) { addPost(c, p.owner || owner); });
  }
  (posts || []).forEach(function (p) { addPost(p, p.owner); });
  function done(b) { return { cards: rank(b.cards), words: rank(b.words), chars: rank(b.chars) }; }
  return { ta: done(ta), me: done(me), updated: Date.now() };
}
var NUM = ['一','二','三','四','五','六','七','八','九','十'];
function lines(title, list, n) {
  return title + '\n' + Array.from({ length: n }, function (_, i) { return '第' + NUM[i] + '：' + (list[i] ? list[i].text : '—'); }).join('\n');
}
function report(stats, name, kind) {
  var a = stats.ta, b = stats.me;
  if (kind === 'me') return lines('我至今为止，使用频率最高的词：', b.words, 10) + '\n' + lines('使用频率最高的字：', b.chars, 10);
  var n = kind === 'ta' ? 10 : 5, small = kind === 'ta' ? 10 : 3;
  var out = lines(name + '至今为止，使用频率最高的字卡：', a.cards, n) + '\n' + lines('使用频率最高的词：', a.words, small) + '\n' + lines('使用频率最高的字：', a.chars, small);
  if (kind !== 'ta') out += '\n💞\n' + lines('我至今为止，使用频率最高的词：', b.words, 3) + '\n' + lines('使用频率最高的字：', b.chars, 3);
  return out;
}
window.wordcloudData = { summarize: summarize, report: report, textOf: textOf, words: words };
})();