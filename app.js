/* 豫膳煌 · 选址评分卡  —— 纯前端，无后端，数据只存本机浏览器 */
(function () {
'use strict';

/* ---------------- 小工具 ---------------- */
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
var K_CARDS = 'ysh_xz_cards_v1';
var K_CFG   = 'ysh_xz_cfg_v1';
var K_DRAFT = 'ysh_xz_draft_v1';

var mem = {};
function storeGet(k, def) {
  try {
    var v = localStorage.getItem(k);
    if (v) return JSON.parse(v);
  } catch (e) {}
  if (k in mem) return mem[k];
  return def;
}
function storeSet(k, v) {
  mem[k] = v;
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
}
function num(v) { var n = parseFloat(String(v).replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; }
function fmt(n) { return (Math.round(n) + '').replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>\"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' })[c]; }); }
function today() { var d = new Date(); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }

/* ---------------- 模型常量 ---------------- */
var TYPES = [
  { k: 'zaocan',    name: '早餐档口（20–70㎡）',      bench: 45,  price: 9,  entry: 0.35, minArea: 20 },
  { k: 'street',    name: '街边标准店（60–180㎡）',   bench: 60,  price: 12, entry: 0.28, minArea: 60 },
  { k: 'community', name: '社区店（50–130㎡）',        bench: 52,  price: 11, entry: 0.25, minArea: 50 },
  { k: 'mall',      name: '商场 / 综合体店（40–150㎡）', bench: 150, price: 16, entry: 0.20, minArea: 40 },
  { k: 'town',      name: '乡镇 / 县城店（60–200㎡）', bench: 32,  price: 8,  entry: 0.30, minArea: 60 }
];

var TRAFFIC = [
  { k: 't1', name: '300 人以下', score: 6,  mid: 200 },
  { k: 't2', name: '300–600 人', score: 14, mid: 450 },
  { k: 't3', name: '600–1000 人', score: 22, mid: 800 },
  { k: 't4', name: '1000–2000 人', score: 29, mid: 1500 },
  { k: 't5', name: '2000 人以上', score: 27, mid: 2500 },
  { k: 'unk', name: '不确定', score: 15, mid: null, unk: true }
];

var BIZ = [
  { k: 'community', name: '成熟社区', score: 20 },
  { k: 'school',    name: '学校',     score: 18 },
  { k: 'mall',      name: '商圈 / 商业街', score: 16 },
  { k: 'office',    name: '写字楼',   score: 13 },
  { k: 'hospital',  name: '医院',     score: 13 },
  { k: 'market',    name: '集市 / 农贸', score: 12 },
  { k: 'station',   name: '车站 / 地铁口', score: 11 },
  { k: 'site',      name: '工地 / 新区', score: 9 },
  { k: 'scenic',    name: '景区',     score: 7 }
];

var COMP = [
  { k: 'none', name: '500 米内没有', score: 10 },
  { k: 'low',  name: '1–2 家',       score: 7 },
  { k: 'mid',  name: '3–5 家',       score: 4 },
  { k: 'high', name: '5 家以上',     score: 2 },
  { k: 'unk',  name: '不确定',       score: 5, unk: true }
];

var VIS = [
  { k: 'main',   name: '主街正对，一眼看到', score: 10 },
  { k: 'side',   name: '次街 / 侧街',       score: 7 },
  { k: 'inmall', name: '商场内铺',          score: 6 },
  { k: 'alley',  name: '巷内 / 内部通道',    score: 4 },
  { k: 'unk',    name: '不确定',            score: 5, unk: true }
];

var COND = [
  { k: 'smoke',   name: '可做排烟',   w: 3 },
  { k: 'water',   name: '有上下水',   w: 2 },
  { k: 'fire',    name: '有明火 / 燃气', w: 2 },
  { k: 'power',   name: '三相电',     w: 1.5 },
  { k: 'outside', name: '门前可外摆', w: 1.5 }
];

var GRADE_TXT = {
  A: 'A · 建议推进', B: 'B · 可谈，先补短板',
  C: 'C · 谨慎，短板明显', D: 'D · 不建议',
  X: '信息不足，先补齐'
};

var state = {
  traffic: null,
  biz: [],
  comp: null,
  vis: null,
  cond: [],
  current: null,     // 最近一次评分 { data, res }
  mapOpen: false
};

/* ---------------- 表单渲染 ---------------- */
function chipHTML(k, name) {
  return '<button type="button" class="chip' + (k === 'unk' ? ' unk' : '') + '" data-k="' + k + '">' + esc(name) + '</button>';
}

function renderStatic() {
  $('#fType').innerHTML = TYPES.map(function (t) {
    return '<option value="' + t.k + '">' + esc(t.name) + '</option>';
  }).join('');

  $('#cTraffic').innerHTML = TRAFFIC.map(function (o) { return chipHTML(o.k, o.name); }).join('');
  $('#cBiz').innerHTML     = BIZ.map(function (o) { return chipHTML(o.k, o.name); }).join('');
  $('#cComp').innerHTML    = COMP.map(function (o) { return chipHTML(o.k, o.name); }).join('');
  $('#cVis').innerHTML     = VIS.map(function (o) { return chipHTML(o.k, o.name); }).join('');
  $('#cCond').innerHTML    = COND.map(function (o) { return chipHTML(o.k, o.name); }).join('');

  // 单选组
  bindSingle('#cTraffic', function (k) { state.traffic = k; });
  bindSingle('#cComp',    function (k) { state.comp = k; });
  bindSingle('#cVis',     function (k) { state.vis = k; });
  // 多选组
  bindMulti('#cBiz',  state.biz,  function (v) { state.biz = v; });
  bindMulti('#cCond', state.cond, function (v) { state.cond = v; });
}

function bindSingle(sel, cb) {
  $(sel).addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    $$(sel + ' .chip').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    cb(b.getAttribute('data-k'));
    saveDraft();
  });
}

function bindMulti(sel, arr, cb) {
  $(sel).addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    var k = b.getAttribute('data-k');
    var i = arr.indexOf(k);
    if (i >= 0) { arr.splice(i, 1); b.classList.remove('on'); }
    else { arr.push(k); b.classList.add('on'); }
    cb(arr);
    saveDraft();
  });
}

function setOn(sel, keys) {
  $$(sel + ' .chip').forEach(function (x) {
    x.classList.toggle('on', (keys || []).indexOf(x.getAttribute('data-k')) >= 0);
  });
}

/* ---------------- 草稿 ---------------- */
function saveDraft() {
  storeSet(K_DRAFT, {
    name: $('#fName').value, type: $('#fType').value, addr: $('#fAddr').value,
    rent: $('#fRent').value, area: $('#fArea').value,
    traffic: state.traffic, biz: state.biz, comp: state.comp, vis: state.vis, cond: state.cond
  });
}

function loadDraft() {
  var d = storeGet(K_DRAFT, null);
  if (!d) return;
  if (d.name) $('#fName').value = d.name;
  if (d.type) $('#fType').value = d.type;
  if (d.addr) $('#fAddr').value = d.addr;
  if (d.rent) $('#fRent').value = d.rent;
  if (d.area) $('#fArea').value = d.area;
  state.traffic = d.traffic || null;
  state.biz = d.biz || [];
  state.comp = d.comp || null;
  state.vis = d.vis || null;
  state.cond = d.cond || [];
  if (state.traffic) setOn('#cTraffic', [state.traffic]);
  if (state.comp) setOn('#cComp', [state.comp]);
  if (state.vis) setOn('#cVis', [state.vis]);
  setOn('#cBiz', state.biz);
  setOn('#cCond', state.cond);
  updateUnit();
}

/* ---------------- 单价提示 ---------------- */
function updateUnit() {
  var rent = num($('#fRent').value), area = num($('#fArea').value);
  var t = TYPES.find(function (x) { return x.k === $('#fType').value; }) || TYPES[1];
  var box = $('#unitLine');
  if (rent > 0 && area > 0) {
    var unit = rent / area;
    var r = unit / t.bench;
    var word;
    if (area < 60 && r > 1.2 && r <= 2) {
      word = '小面积档口单价天然偏高（同样是这个价，大店能摊薄），判断标准换成「月租总额 ' + fmt(rent) + ' 元扛不扛得住」';
    } else {
      word = r <= 0.8 ? '明显低于同类型基准，属于捡漏区间，注意核实房东真实性'
        : r <= 1.0 ? '略低于基准，算健康'
        : r <= 1.2 ? '略高于基准，要在运营上补回来'
        : r <= 1.5 ? '偏高，谈租时一定要压价'
        : '明显偏高，这个点位除非客流极强，否则很难赚钱';
    }
    box.innerHTML = '租金单价 <b>' + fmt(unit) + ' 元/㎡/月</b>，' + esc(t.name) + '的参考区间约 ' +
      Math.round(t.bench * 0.8) + '–' + Math.round(t.bench * 1.2) + ' 元/㎡/月。<br>' + word + '。';
  } else {
    box.innerHTML = '填了租金和面积，这里会显示每平米每月多少钱，以及和你选的店型比是高还是低。';
  }
}

/* ---------------- 评分核心 ---------------- */
var ORDER = ['A', 'B', 'C', 'D'];
function shiftGrade(g, n) { return ORDER[Math.min(3, ORDER.indexOf(g) + n)]; }

function compute(d) {
  var t = TYPES.find(function (x) { return x.k === d.type; }) || TYPES[1];
  var rent = num(d.rent), area = num(d.area);
  var unit = (rent > 0 && area > 0) ? rent / area : null;

  var tr = TRAFFIC.find(function (x) { return x.k === d.traffic; }) || TRAFFIC[5];
  var sTraffic = tr.score;

  var bizScores = d.biz.map(function (k) {
    var b = BIZ.find(function (x) { return x.k === k; });
    return b ? b.score : 0;
  }).sort(function (a, b) { return b - a; });
  var sBiz = bizScores.length ? Math.min(20, bizScores[0] + 0.3 * (bizScores[1] || 0)) : 9;

  /* 估算营业额（只用来算租售比） */
  var estDaily = null, rentRatio = null;
  if (tr.mid && rent > 0) {
    estDaily = tr.mid * t.entry * t.price;
    rentRatio = rent / (estDaily * 30);
  }

  /* 租金压力 = 租售比 70% + 单价 30%（小面积档口单价天然高，靠租售比校正） */
  var unitScore = null, ratioScore = null;
  if (unit) {
    var r = unit / t.bench;
    unitScore = r <= 0.8 ? 20 : r <= 1.0 ? 18 : r <= 1.2 ? 14 : r <= 1.5 ? 9 : 4;
  }
  if (rentRatio != null) {
    ratioScore = rentRatio <= 0.12 ? 20 : rentRatio <= 0.15 ? 17
      : rentRatio <= 0.20 ? 12 : rentRatio <= 0.25 ? 7 : 3;
  }
  var sRent;
  if (ratioScore != null && unitScore != null) sRent = Math.round(0.7 * ratioScore + 0.3 * unitScore);
  else if (ratioScore != null) sRent = ratioScore;
  else if (unitScore != null) sRent = unitScore;
  else sRent = 12;
  sRent = Math.max(0, Math.min(20, sRent));

  var co = COMP.find(function (x) { return x.k === d.comp; });
  var sComp = co ? co.score : 5;

  var condKnown = d.cond.length > 0;
  var sCond = condKnown ? Math.min(10, d.cond.reduce(function (a, k) {
    var c = COND.find(function (x) { return x.k === k; });
    return a + (c ? c.w : 0);
  }, 0)) : 4;

  var vo = VIS.find(function (x) { return x.k === d.vis; });
  var sVis = vo ? vo.score : 5;

  var total = Math.round(sTraffic + sBiz + sRent + sComp + sCond + sVis);

  var dims = [
    { k: 'traffic', name: '客流',      score: sTraffic, max: 30 },
    { k: 'biz',     name: '周边业态',  score: sBiz,     max: 20 },
    { k: 'rent',    name: '租金压力',  score: sRent,    max: 20 },
    { k: 'comp',    name: '竞品环境',  score: sComp,    max: 10 },
    { k: 'cond',    name: '门店硬件',  score: sCond,    max: 10 },
    { k: 'vis',     name: '可见度',    score: sVis,     max: 10 }
  ];

  /* 基础等级 + 红线降级 */
  var grade = total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D';
  var flags = [];
  var shift = 0;

  if (condKnown) {
    var noSmoke = d.cond.indexOf('smoke') < 0;
    var noFire  = d.cond.indexOf('fire') < 0;
    var noWater = d.cond.indexOf('water') < 0;
    if (noSmoke && !noFire) { shift = Math.max(shift, 2); flags.push('既没排烟也没明火，得先解决抽排或改成电加热'); }
    else if (noSmoke)       { shift = Math.max(shift, 1); flags.push('没有排烟条件，须确认能否加装油烟净化'); }
    if (noWater)            { shift = Math.max(shift, shift >= 1 ? 2 : 1); flags.push('没有上下水，改造要砸地，钱和时间都要算进去'); }
  } else {
    flags.push('门店硬件没填，没做红线判断，结论偏乐观');
  }

  if (unit && unit / t.bench > 1.5 && sTraffic <= 14) {
    shift = Math.min(2, shift + 1);
    flags.push('租金单价高但客流弱，租售比很难站住');
  }

  var gradeFinal = shiftGrade(grade, shift);

  /* 数据完整度 */
  var filled = 0;
  if (d.name) filled += 1;
  if (d.addr) filled += 1;
  if (d.type) filled += 1;
  if (rent > 0) filled += 1;
  if (area > 0) filled += 1;
  if (d.traffic && d.traffic !== 'unk') filled += 1; else if (d.traffic) filled += 0.5;
  if (d.biz.length) filled += 1;
  if (d.comp) filled += 1;
  if (d.vis) filled += 1;
  if (d.cond.length) filled += 1;
  var completeness = Math.round(filled / 10 * 100);

  /* 核心信息缺了就不下结论（客流或业态空着，算出来的分没有意义） */
  if (!d.traffic || d.traffic === 'unk' || !d.biz.length) {
    gradeFinal = 'X';
    flags.push('客流或周边业态还没填实，先补齐再算');
  }

  /* 强弱项：门店硬件没填时，不参与排名（避免甩锅给没填的项） */
  var rank = dims.filter(function (x) { return !(x.k === 'cond' && !condKnown); })
    .sort(function (a, b) { return (a.score / a.max) - (b.score / b.max); });
  var top = dims.slice().sort(function (a, b) { return (b.score / b.max) - (a.score / a.max); })[0];

  var res = {
    total: total, grade: gradeFinal, gradeRaw: grade, shift: shift,
    dims: dims, flags: flags, completeness: completeness,
    unit: unit, rent: rent, area: area, type: t, traffic: tr,
    estDaily: estDaily, rentRatio: rentRatio,
    rank: rank, weak1: rank[0], weak2: rank[1], top: top,
    condKnown: condKnown, dist: d
  };
  res.verdict = verdictOf(res);
  res.advice = adviceOf(res, d);
  res.checks = checksOf(res, d);
  return res;
}

function verdictOf(res) {
  var g = res.grade;
  if (g === 'X') {
    return '这次关键信息还没填实（客流或周边业态空着），分数只能当参考，还不能当结论。把这两项补上再算一次。';
  }
  var w1 = res.weak1.name, w2 = res.weak2.name;
  var v;
  if (g === 'A') {
    v = '这个点位整体成立：' + res.top.name + '是最强项，各项都过线、没有明显短板。可以进入谈租阶段，重点谈免租期和递增条款。';
  } else if (g === 'B') {
    v = '基本可用，但' + w1 + '这块偏弱。谈租时把这条当成压价条件；补得上就签，补不上就按下一档给价。';
  } else if (g === 'C') {
    v = '短板比较明显：' + w1 + '和' + w2 + '都拖后腿。除非租金能压下来、或者这两项能在开店前解决，否则不建议直接签。';
  } else {
    v = '不建议按现在的条件签。核心短板在' + w1 + '；要么在签约前把它解决（压租金、改硬件、补客流证据），要么换点位。';
  }
  if (res.shift > 0 && res.flags.length) {
    v += '（已被降级：' + res.flags[0] + '）';
  }
  if (res.completeness < 85) {
    v += ' 部分信息仍是「不确定」，结论还有变数。';
  }
  return v;
}

function adviceOf(res, d) {
  var out = [];
  var byKey = {};
  res.dims.forEach(function (x) { byKey[x.k] = x; });
  var map = {
    traffic: function () {
      if (byKey.traffic.score >= 22) return '客流够用，但要确认高峰是不是集中在 6:30–9:00；中午和晚上太空的话，租金会被摊薄。';
      return '客流偏弱：去蹲点 3 个工作日，早 6:30–9:00 数过店人数，蹲完再谈价，别凭感觉签。';
    },
    biz: function () {
      return '周边业态偏单一：用高德热力图核对 800 米内实际住户户数和写字楼工位数，比「看着热闹」靠谱。';
    },
    rent: function () {
      if (res.unit && res.unit / res.type.bench > 1.2) {
        return '租金偏高：谈 2–3 个月免租期、阶梯递增（比如前两年不涨），把首年租售比压到 15% 以内。';
      }
      if (res.rentRatio != null && res.rentRatio > 0.15) {
        return '租售比超过 15%：要么压租金，要么靠午晚市把营业额做上去，算一下保本线每天要卖多少碗。';
      }
      return '租金这一项还行，谈租时把物业费、垃圾清运费、转让费问清，别让隐性成本把毛利吃掉。';
    },
    comp: function () {
      return '竞品密度不低：早高峰去对面吃一次，看出餐速度、客单和排队长度——需求旺盛就拼产品和效率，已经饱和就换点位。';
    },
    cond: function () {
      if (byKey.cond.score >= 7) return '硬件基本齐了，把三相电、门前外摆这类加分项再确认下，别到装修才发现电不够用。';
      return '硬件缺项是硬门槛：排烟、上下水、明火、三相电，任何一项要从零做，都是几万块和一个月工期。';
    },
    vis: function () {
      return '可见度一般：测算从主路口走到店门的动线，评估要不要额外做引导招牌和灯箱，把这笔钱算进开业预算。';
    }
  };
  res.rank.slice(0, 3).forEach(function (dim) {
    out.push(map[dim.k]());
  });
  if (res.completeness < 60) {
    out.push('把「不确定」的几项补齐再复算一次——空着的那几项往往就是决定赚不赚钱的地方。');
  }
  return out;
}

function checksOf(res, d) {
  var c = [];
  if (d.traffic === 'unk') c.push('客流：连数 3 个工作日早高峰的过店人次，工作日和周末分开记。');
  if (!d.cond.length) c.push('硬件：排烟、上下水、明火、三相电四项逐一确认，任何一项从零做都要加钱。');
  if (d.cond.length && d.cond.indexOf('smoke') < 0) c.push('排烟：问房东和物业能否在外墙加装油烟净化一体机，不能解决就直接放弃。');
  if (d.cond.length && d.cond.indexOf('water') < 0) c.push('上下水：确认有没有独立水表和排水坡度，老房子改造经常要砸地。');
  if (d.comp === 'mid' || d.comp === 'high') c.push('竞品：把 500 米内的店各吃一遍，比出餐速度、份量和客单，判断是增量还是抢客。');
  if (d.comp === 'unk') c.push('竞品：地图搜「胡辣汤」「早餐」，先数清 500 米内到底几家。');
  if (!d.biz.length || d.biz.indexOf('site') >= 0 || d.biz.indexOf('scenic') >= 0) c.push('客群：核实 800 米内真实住户和工位数，新区和景区容易看着热闹、实际没有早餐客。');
  if (res.area > 0 && res.area < res.type.minArea) c.push('面积 ' + res.area + '㎡ 低于' + res.type.name + '的常规下限，确认备餐、洗碗、储物动线够不够。');
  if (res.unit && res.unit / res.type.bench > 1.2) c.push('租金：问清租约年限、每年递增、免租期（争取 2–3 个月）、是否含物业费。');
  if (d.vis === 'alley' || d.vis === 'inmall' || d.vis === 'unk') c.push('可见度：从主路口走一遍到店门，看有没有遮挡，评估要不要加引导招牌。');
  if (c.length === 0) c.push('基础信息比较齐，现场复核一次早高峰真实客流，就可以进入谈租。');
  return c.slice(0, 6);
}

/* ---------------- 结果渲染 ---------------- */
function renderResult(res) {
  $('#rName').textContent = res.dist.name || '未命名点位';
  $('#rScore').textContent = res.total;
  var g = $('#rGrade');
  g.className = 'grade g-' + res.grade;
  g.textContent = GRADE_TXT[res.grade];

  $('#rVerdict').textContent = res.verdict;

  $('#rFlags').innerHTML = res.flags.map(function (f) { return '<span class="flag">' + esc(f) + '</span>'; }).join('');

  $('#rDims').innerHTML = res.dims.map(function (d) {
    if (d.k === 'cond' && !res.condKnown) {
      return '<div class="dim"><div class="dn">' + esc(d.name) + '</div>' +
        '<div class="track"><div class="fill low" style="width:40%"></div></div>' +
        '<div class="dv">未填</div></div>';
    }
    var pct = Math.round(d.score / d.max * 100);
    var low = pct < 50 ? ' low' : '';
    return '<div class="dim"><div class="dn">' + esc(d.name) + '</div>' +
      '<div class="track"><div class="fill' + low + '" style="width:' + pct + '%"></div></div>' +
      '<div class="dv">' + Math.round(d.score) + '/' + d.max + '</div></div>';
  }).join('');

  var facts = [];
  facts.push({ k: '月租金', v: fmt(res.rent) + ' 元' });
  facts.push({ k: '租金单价', v: res.unit ? fmt(res.unit) + ' 元/㎡/月' : '—' });
  facts.push({ k: '使用面积', v: fmt(res.area) + ' ㎡' });
  facts.push({ k: '店型基准区间', v: Math.round(res.type.bench * 0.8) + '–' + Math.round(res.type.bench * 1.2) + ' 元/㎡' });
  facts.push({ k: '日均客流', v: res.traffic.name });
  facts.push({ k: '数据完整度', v: res.completeness + '%' });
  if (res.estDaily) {
    facts.push({ k: '估算日营业额（±30%）', v: fmt(res.estDaily) + ' 元' });
    facts.push({ k: '估算租售比（健康线 15%）', v: Math.round(res.rentRatio * 100) + '%' });
  }
  $('#rFacts').innerHTML = facts.map(function (f) {
    return '<div class="fact"><div class="k">' + esc(f.k) + '</div><div class="v">' + esc(f.v) + '</div></div>';
  }).join('');

  $('#rAdvice').innerHTML = res.advice.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
  $('#rCheck').innerHTML  = res.checks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');

  $('#rNote').textContent =
    '评分口径：客流 30 + 周边业态 20 + 租金单价 20 + 竞品 10 + 硬件 10 + 可见度 10 = 100 分。' +
    '估算营业额 = 客流中位数 × 进店率 × 客单价，误差约 ±30%，只用来感知租售比，不参与打分。' +
    '分数是初筛，不是判决。';

  $('#rMeta').textContent = '豫膳煌 · 选址评分卡 ｜ ' + today();
}

/* ---------------- 校验 & 主流程 ---------------- */
function collect() {
  return {
    name: $('#fName').value.trim(),
    type: $('#fType').value,
    addr: $('#fAddr').value.trim(),
    rent: $('#fRent').value,
    area: $('#fArea').value,
    traffic: state.traffic,
    biz: state.biz.slice(),
    comp: state.comp,
    vis: state.vis,
    cond: state.cond.slice()
  };
}

function validate(d) {
  var miss = [];
  if (!d.name) miss.push('点位名称');
  if (!d.addr) miss.push('详细地址');
  if (!num(d.rent)) miss.push('月租金');
  if (!num(d.area)) miss.push('使用面积');
  if (!d.traffic) miss.push('日均客流');
  if (!d.biz.length) miss.push('周边业态');
  return miss;
}

function goScore() {
  var d = collect();
  var miss = validate(d);
  var err = $('#formErr');
  if (miss.length) {
    err.textContent = '还差 ' + miss.join('、') + '，补上就能出分。';
    err.classList.remove('hide');
    return;
  }
  err.classList.add('hide');
  saveDraft();

  var res = compute(d);
  state.current = { data: d, res: res };
  renderResult(res);
  showView('result');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------- 视图切换 ---------------- */
function showView(name) {
  ['form', 'result', 'list', 'set'].forEach(function (v) {
    var el = $('#view-' + v);
    if (el) el.classList.toggle('hide', v !== name);
  });
  $$('.navbtn').forEach(function (b) {
    b.classList.toggle('on', b.getAttribute('data-view') === name);
  });
  if (name === 'list') renderList();
  if (name === 'set') fillCfg();
}

/* ---------------- 保存 & 对比 ---------------- */
function getCards() { return storeGet(K_CARDS, []); }

function saveCurrent() {
  if (!state.current) return;
  var d = state.current.data, res = state.current.res;
  var cards = getCards();
  var item = {
    id: 'c' + Date.now(),
    name: d.name || '未命名点位',
    addr: d.addr,
    type: d.type,
    score: res.total,
    grade: res.grade,
    traffic: res.traffic.name,
    unit: res.unit ? Math.round(res.unit) : null,
    brief: res.verdict.split('。')[0] + '。',
    date: today()
  };
  var i = cards.findIndex(function (c) { return c.name === item.name && c.addr === item.addr; });
  if (i >= 0) cards[i] = item; else cards.unshift(item);
  if (cards.length > 40) cards = cards.slice(0, 40);
  storeSet(K_CARDS, cards);
  var btn = $('#btnSave');
  btn.textContent = '已保存 ✓';
  setTimeout(function () { btn.textContent = '保存这个点位'; }, 1600);
  renderList();
}

function renderList() {
  var cards = getCards();
  var body = $('#listBody');
  if (!cards.length) {
    body.innerHTML = '<div class="empty">还没有保存的点位。<br>回到「评分」填完出分后，点「保存这个点位」。</div>';
    return;
  }
  var sorted = cards.slice().sort(function (a, b) { return b.score - a.score; });
  body.innerHTML = sorted.map(function (c, i) {
    return '<div class="pitem">' +
      '<div class="rank' + (i === 0 ? ' r1' : '') + '">' + (i + 1) + '</div>' +
      '<div class="body"><div class="t">' + esc(c.name) + '</div>' +
        '<div class="s">' + c.score + ' 分 · ' + esc(c.traffic) + (c.unit ? ' · ' + c.unit + ' 元/㎡' : '') + '<br>' + esc(c.brief) + '</div>' +
      '</div>' +
      '<div class="right"><div class="sc">' + c.score + '</div>' +
        '<button class="del" data-del="' + c.id + '">删除</button></div>' +
      '</div>';
  }).join('');

  body.querySelectorAll('[data-del]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-del');
      var name = '';
      var next = getCards().filter(function (c) { if (c.id === id) { name = c.name; return false; } return true; });
      if (window.confirm('删除「' + name + '」？')) { storeSet(K_CARDS, next); renderList(); }
    });
  });
}

/* ---------------- 复制结论 ---------------- */
function copyResult() {
  if (!state.current) return;
  var d = state.current.data, res = state.current.res;
  var lines = [];
  lines.push('【豫膳煌 · 选址评分】' + (d.name || '未命名点位'));
  lines.push('得分 ' + res.total + ' 分 ｜ ' + GRADE_TXT[res.grade]);
  lines.push('地址：' + (d.addr || '—'));
  lines.push('店型：' + res.type.name + ' ｜ 月租 ' + fmt(res.rent) + ' 元 ｜ 面积 ' + fmt(res.area) + '㎡' +
    (res.unit ? ' ｜ 单价 ' + fmt(res.unit) + ' 元/㎡' : ''));
  lines.push('');
  lines.push('结论：' + res.verdict);
  lines.push('');
  lines.push('下一步：');
  res.advice.forEach(function (t, i) { lines.push((i + 1) + '. ' + t); });
  lines.push('');
  lines.push('现场还要核实：');
  res.checks.forEach(function (t, i) { lines.push((i + 1) + '. ' + t); });
  lines.push('');
  lines.push(today() + ' ｜ 豫膳煌 · 选址评分卡');

  var text = lines.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      var b = $('#btnCopy'); b.textContent = '已复制 ✓';
      setTimeout(function () { b.textContent = '复制结论'; }, 1600);
    }, function () { fallbackCopy(text); });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.top = '-1000px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  var b = $('#btnCopy'); b.textContent = '已复制 ✓';
  setTimeout(function () { b.textContent = '复制结论'; }, 1600);
}

/* ---------------- 地图 ---------------- */
var CFG = storeGet(K_CFG, { amap: '', amapSec: '', baidu: '' });
var map = null, marker = null, lastPick = null, amapLoading = false;

function loadAmap() {
  return new Promise(function (resolve, reject) {
    if (window.AMap) return resolve();
    if (!CFG.amap) return reject(new Error('nokey'));
    if (amapLoading) return reject(new Error('loading'));
    amapLoading = true;
    if (CFG.amapSec) window._AMapSecurityConfig = { securityJsCode: CFG.amapSec };
    var s = document.createElement('script');
    s.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(CFG.amap) +
      '&plugin=AMap.PlaceSearch,AMap.Geocoder,AMap.Geolocation';
    s.onload = function () { resolve(); };
    s.onerror = function () { amapLoading = false; reject(new Error('loadfail')); };
    document.head.appendChild(s);
  });
}

function openMap() {
  var box = $('#mapbox');
  state.mapOpen = !state.mapOpen;
  box.classList.toggle('on', state.mapOpen);
  if (!state.mapOpen) return;

  if (!CFG.amap && !CFG.baidu) {
    box.innerHTML = '<div class="warnline">还没配地图 Key。你可以先手填地址直接用；想在地图上选点，去「设置」里填高德 Key（免费，3 分钟）。</div>' +
      '<div class="bar" style="margin-top:9px"><button class="btn plain" id="mToCfg">去设置</button></div>';
    var b = $('#mToCfg');
    if (b) b.addEventListener('click', function () { showView('set'); });
    return;
  }
  if (CFG.amap) initAmap();
  else initBaidu();
}

function initAmap() {
  loadAmap().then(function () {
    map = new AMap.Map('mapCanvas', {
      zoom: 15, center: [113.665, 34.757], resizeEnable: true
    });
    map.on('click', function (e) {
      pick( e.lnglat.getLng(), e.lnglat.getLat(), null);
    });
  }).catch(function (err) {
    $('#mapCanvas').innerHTML = '<div style="padding:14px;font-size:13px;color:#8b827c">地图加载失败：' +
      (err.message === 'nokey' ? '没有配置 Key' : 'Key 无效或域名未加白名单') + '</div>';
  });
}

function amapSearch(q) {
  if (!q) return;
  var sug = $('#mSug');
  sug.innerHTML = '<div class="tip">搜索中…</div>';
  var ps = new AMap.PlaceSearch({ city: '全国', citylimit: false, pageSize: 10 });
  ps.search(q, function (status, result) {
    if (status === 'complete' && result.poiList && result.poiList.pois && result.poiList.pois.length) {
      sug.innerHTML = result.poiList.pois.map(function (p, i) {
        return '<button data-i="' + i + '">' + esc(p.name) + '<span class="sub">' + esc((p.pname || '') + (p.cityname || '') + (p.adname || '') + (p.address || '')) + '</span></button>';
      }).join('');
      $$('#mSug button').forEach(function (b) {
        b.addEventListener('click', function () {
          var p = result.poiList.pois[+b.getAttribute('data-i')];
          if (!p || !p.location) return;
          pick(p.location.lng, p.location.lat, p);
        });
      });
    } else {
      sug.innerHTML = '<div class="tip">没搜到，换个说法再试（比如只输入小区名）。</div>';
    }
  });
}

function pick(lng, lat, poi) {
  lastPick = { lng: lng, lat: lat, poi: poi };
  if (map) {
    if (!marker) {
      marker = new AMap.Marker({ position: [lng, lat], map: map });
    } else {
      marker.setPosition([lng, lat]);
    }
    map.setCenter([lng, lat]);
    map.setZoom(16);
  }
  var gol = new AMap.Geocoder();
  gol.getAddress([lng, lat], function (st, r) {
    var addr = '';
    if (st === 'complete' && r.regeocode) {
      addr = r.regeocode.formattedAddress || '';
    }
    if (poi) addr = (poi.pname || '') + (poi.cityname || '') + (poi.adname || '') + (poi.address || '') || addr;
    if (addr) $('#fAddr').value = addr;
    stats(lng, lat, addr);
  });
}

function stats(lng, lat, addr) {
  var box = $('#mStats');
  box.innerHTML = '<div class="tip">正在统计周边 800 米业态…</div>';
  var cats = ['小区', '学校', '写字楼', '商场', '胡辣汤'];
  var counts = {};
  var idx = 0;

  function next() {
    if (idx >= cats.length) return done();
    var cat = cats[idx++];
    var ps = new AMap.PlaceSearch({ city: '全国', citylimit: false, pageSize: 1 });
    ps.searchNearBy(cat, [lng, lat], 800, function (st, r) {
      counts[cat] = (st === 'complete' && r && r.poiList) ? (r.poiList.count || 0) : null;
      setTimeout(next, 120);
    });
  }

  function done() {
    var rec = [];
    if ((counts['小区'] || 0) >= 8) rec.push('community');
    if ((counts['学校'] || 0) >= 3) rec.push('school');
    if ((counts['写字楼'] || 0) >= 6) rec.push('office');
    if ((counts['商场'] || 0) >= 2) rec.push('mall');
    var parts = cats.map(function (c) {
      return c + ' ' + (counts[c] == null ? '—' : counts[c]);
    });
    var html = '<div class="unitline">800 米内地图统计：' + parts.join(' ｜ ') + '</div>';
    if (rec.length) {
      var sel = rec.slice();
      state.biz = sel;
      setOn('#cBiz', sel);
      html += '<div class="tip">已按地图提示勾选周边业态：' +
        BIZ.filter(function (b) { return rec.indexOf(b.k) >= 0; }).map(function (b) { return b.name; }).join('、') +
        '（不对的话手动改）。</div>';
    }
    if ((counts['胡辣汤'] || 0) >= 3) {
      html += '<div class="tip">附近「胡辣汤」类关键词命中 ' + counts['胡辣汤'] + ' 家，竞品可能要选「3 家以上」。</div>';
    }
    box.innerHTML = html;
  }

  next();
}

/* ---- 百度（仅地址联想 + 静态图，作为高德未配置时的兜底） ---- */
function initBaidu() {
  var box = $('#mapCanvas');
  box.innerHTML = '<div style="padding:14px;color:#8b827c;font-size:13px">已启用百度地址联想。输入地址搜索后可回填；地图展示需要高德 Key。</div>';
  var sr = document.querySelector('.mapbox .sr');
  if (!sr) return;
  sr.style.display = 'flex';
}

function baiduSearch(q) {
  if (!q || !CFG.baidu) return;
  var sug = $('#mSug');
  sug.innerHTML = '<div class="tip">搜索中…</div>';
  var cb = 'bd_' + Date.now();
  var s = document.createElement('script');
  window[cb] = function (data) {
    var list = (data && data.result) || [];
    if (!list.length) {
      sug.innerHTML = '<div class="tip">没搜到，换个说法。</div>';
      return;
    }
    sug.innerHTML = list.map(function (p, i) {
      return '<button data-i="' + i + '">' + esc(p.name) +
        '<span class="sub">' + esc((p.city || '') + (p.district || '') + (p.address || '')) + '</span></button>';
    }).join('');
    $$('#mSug button').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = list[+b.getAttribute('data-i')];
        var addr = (p.city || '') + (p.district || '') + (p.address || '') + (p.name || '');
        $('#fAddr').value = addr;
        lastPick = { lng: p.location && p.location.lng, lat: p.location && p.location.lat };
        if (p.location) {
          $('#mapCanvas').innerHTML = '<img alt="点位" style="width:100%;height:100%;object-fit:cover" src="https://api.map.baidu.com/staticimage/v2?ak=' +
            encodeURIComponent(CFG.baidu) + '&center=' + p.location.lng + ',' + p.location.lat +
            '&width=750&height=400&zoom=16&markers=' + p.location.lng + ',' + p.location.lat + '&markerStyles=l,A">';
        }
        sug.innerHTML = '<div class="tip">已回填地址。业态统计需要高德 Key 才支持。</div>';
        saveDraft();
      });
    });
  };
  s.src = 'https://api.map.baidu.com/place/v2/suggestion?query=' + encodeURIComponent(q) +
    '&region=%E5%85%A8%E5%9B%BD&city_limit=false&output=json&ak=' + encodeURIComponent(CFG.baidu) + '&callback=' + cb;
  s.onerror = function () { sug.innerHTML = '<div class="tip">百度接口调用失败，检查 AK 或 Referer 白名单。</div>'; };
  document.head.appendChild(s);
}

/* ---------------- 设置 ---------------- */
function fillCfg() {
  $('#kAmap').value = CFG.amap || '';
  $('#kAmapSec').value = CFG.amapSec || '';
  $('#kBaidu').value = CFG.baidu || '';
}

function saveCfg() {
  CFG = {
    amap: $('#kAmap').value.trim(),
    amapSec: $('#kAmapSec').value.trim(),
    baidu: $('#kBaidu').value.trim()
  };
  storeSet(K_CFG, CFG);
  $('#cfgTip').textContent = '已保存。下次打开页面会自动带上；换设备需要重新填一次。';
  amapLoading = false;
  window.AMap = null;
  map = null; marker = null;
}

/* ---------------- 初始化 ---------------- */
function init() {
  renderStatic();
  if (!$('#fType').value || $('#fType').value === TYPES[0].k) $('#fType').value = 'street';
  loadDraft();
  updateUnit();

  $('#fType').addEventListener('change', function () { updateUnit(); saveDraft(); });
  ['#fName', '#fAddr', '#fRent', '#fArea'].forEach(function (sel) {
    $(sel).addEventListener('input', function () {
      if (sel === '#fRent' || sel === '#fArea') updateUnit();
      saveDraft();
    });
  });

  $('#btnScore').addEventListener('click', goScore);
  $('#btnSave').addEventListener('click', saveCurrent);
  $('#btnCopy').addEventListener('click', copyResult);
  $('#btnBack').addEventListener('click', function () { showView('form'); });

  $('#btnMap').addEventListener('click', openMap);
  $('#btnNav').addEventListener('click', function () {
    var a = $('#fAddr').value.trim();
    if (!a) { alert('先把地址填上，或者用地图选点。'); return; }
    window.open('https://uri.amap.com/search?keyword=' + encodeURIComponent(a), '_blank');
  });
  $('#mGo').addEventListener('click', function () {
    var q = $('#mQ').value.trim();
    if (CFG.amap) amapSearch(q); else baiduSearch(q);
  });
  $('#mQ').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (CFG.amap) amapSearch($('#mQ').value.trim()); else baiduSearch($('#mQ').value.trim());
    }
  });
  $('#mUse').addEventListener('click', function () {
    if (!lastPick) { alert('先在地图上点一下位置，或者在搜索框里选一个结果。'); return; }
    saveDraft();
    if (!state.mapOpen) return;
    state.mapOpen = false;
    $('#mapbox').classList.remove('on');
  });
  $('#mHere').addEventListener('click', function () {
    if (!CFG.amap || !window.AMap) { alert('定位需要高德 Key。'); return; }
    var geo = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 8000 });
    geo.getCurrentPosition(function (st, r) {
      if (st === 'complete') {
        pick(r.position.getLng(), r.position.getLat(), null);
      } else {
        alert('定位失败，可能是没给浏览器定位权限。');
      }
    });
  });

  $('#btnCfgSave').addEventListener('click', saveCfg);
  $('#btnCfgClear').addEventListener('click', function () {
    $('#kAmap').value = ''; $('#kAmapSec').value = ''; $('#kBaidu').value = '';
    saveCfg();
    $('#cfgTip').textContent = '已清空。';
  });

  $$('.navbtn').forEach(function (b) {
    b.addEventListener('click', function () { showView(b.getAttribute('data-view')); });
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

/* 供本地自测使用（浏览器里不会走到） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { compute: compute, TYPES: TYPES, visitGrade: GRADE_TXT };
}
})();
