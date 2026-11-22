// game.js —— 《城角夜市苑》微信小游戏入口（IAA 广告变现版，无虚拟支付）
// 架构：config.js 配置 + core.js 数据层 + ui.js 渲染层 + openDataContext 好友榜
// 合规：纯模拟经营，无真实货币、无充值、无概率付费

var core = require('./js/core.js');
var UI = require('./js/ui.js');
var CONFIG = core.CONFIG;

// ---------- 画布初始化 ----------
var canvas = (typeof wx !== 'undefined' && wx.createCanvas) ? wx.createCanvas() : null;
var ctx, W, H, dpr;
if (canvas) {
  ctx = canvas.getContext('2d');
  var info = wx.getSystemInfoSync();
  W = info.windowWidth; H = info.windowHeight; dpr = info.pixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
} else {
  // 浏览器预览兜底
  canvas = document.createElement('canvas');
  W = 390; H = 844; dpr = 1; canvas.width = W; canvas.height = H;
  document.body.appendChild(canvas); ctx = canvas.getContext('2d');
}
var ui = new UI(ctx, W, H, dpr);

// ---------- 广告接入（在 js/config.js 中配置，开通流量主后只需填 rewardAdUnitId） ----------
var AD_CONFIG = CONFIG.AD;
// 填入合法的 adunit-xxx 即自动启用 IAA；enabled=true 也可显式开启（二者其一即可）
var AD = {
  enabled: AD_CONFIG.enabled === true || (AD_CONFIG.rewardAdUnitId && /^adunit-[a-zA-Z0-9]+$/.test(AD_CONFIG.rewardAdUnitId)),
  adUnitId: AD_CONFIG.rewardAdUnitId,
  rewardedVideoAd: null,
  ready: false,
  init: function () {
    if (!core.Store.isWx || !wx.createRewardedVideoAd) return;
    if (!this.enabled || !/^adunit-[a-zA-Z0-9]+$/.test(this.adUnitId)) return;
    try {
      var self = this;
      this.rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId: this.adUnitId });
      this.rewardedVideoAd.onLoad(function () { self.ready = true; });
      this.rewardedVideoAd.onError(function () { self.ready = false; });
      this.rewardedVideoAd.onClose(function (res) {
        if (!self._pending) return;
        var fn = self._pending; self._pending = null;
        fn(!!(res && res.isEnded));
      });
      this.rewardedVideoAd.load().catch(function () { self.ready = false; });
    } catch (e) { this.rewardedVideoAd = null; this.ready = false; }
  },
  // 未开通广告时免费给奖励；开通后必须看完激励视频才给奖励
  reward: function (reason, onDone) {
    if (!this.enabled || !core.Store.isWx || !this.rewardedVideoAd) { onDone(true); return; }
    var self = this;
    this._pending = onDone;
    var show = function () { return self.rewardedVideoAd.show(); };
    show().catch(function () {
      return self.rewardedVideoAd.load().then(function () { return show(); });
    }).catch(function () {
      if (self._pending) { var fn = self._pending; self._pending = null; fn(false); }
    });
  }
};
AD.init();

// ---------- 游戏状态 ----------
var save = core.loadSave();
try { core.reportRankScore(save, false); } catch (e) {}
var scene = 'home';           // home | prep | play | cook | result | city | codex | album | daily | cloud | rank | skin
var prevScene = 'home';       // 子页面返回目标
var customers = [];
var stats = null;
var cook = null;
var lastTs = Date.now();
var toast = { text: '', until: 0 };
var streetTimer = 0;
var errandTimer = 0;
var cloudCode = '';           // 云存档码输入框缓存（浏览器 prompt 兜底）
var openDataContext = null;   // 微信开放数据域
var sharedCanvas = null;
var rankPostedAt = 0;
var rewardModal = null;       // 奖励弹层（层级突破/惊喜/徽章/战绩卡）
var recRef = { matched: false, inviter: false };
// 好友推荐来源：微信启动 query 或浏览器 ?inviter=，只做回流记录，不强制分享
try {
  var launchQ = {};
  if (core.Store.isWx && wx.getLaunchOptionsSync) launchQ = (wx.getLaunchOptionsSync().query || {});
  else if (typeof location !== 'undefined' && location.search) {
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      var p = kv.split('='); if (p[0]) launchQ[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
  }
  recRef = core.recordReferral(save, launchQ);
} catch (e) {}
try {
  if (core.Store.isWx && wx.getOpenDataContext) {
    openDataContext = wx.getOpenDataContext();
    sharedCanvas = openDataContext && openDataContext.canvas;
  }
} catch (e) { openDataContext = null; sharedCanvas = null; }

function note(t, ms) { toast.text = t; toast.until = Date.now() + (ms || 1800); }

// ---------- 分享复访：只给小额补给，不强制分享，不影响主流程 ----------
function todayKey() { return core.todayKey(); }
function shareGame() {
  var title = CONFIG.GAME_NAME + '：我的夜市开到第' + save.scene.day + '天，来搭个伙？';
  var refCode = core.myRefCode(save);
  try {
    if (core.Store.isWx && wx.shareAppMessage) {
      wx.shareAppMessage({ title: title, query: 'inviter=' + refCode });
      note('好友点进来会记上你的推荐码，双方回访都有结伴补给');
    } else if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: title, text: '手机浏览器就能玩的摆摊模拟小游戏' }).catch(function () {});
      note('预览模式：分享入口已触发');
    } else {
      note('预览模式：请在微信中打开分享');
    }
  } catch (e) { note('分享入口暂不可用'); }
}
function claimReturnBonus() {
  var key = todayKey();
  if (save.shared.lastVisitDay === key) return;
  var yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  var yKey = yesterday.getFullYear() + '-' + (yesterday.getMonth() + 1) + '-' + yesterday.getDate();
  save.shared.streak = save.shared.lastVisitDay === yKey ? (save.shared.streak || 1) + 1 : 1;
  var bonus = save.shared.streak >= 3 ? 20 : 10;
  save.shared.coins += bonus;
  // 好友推荐回流补给：被推荐人回访达标后可领，与是否分享无关（合规）
  var refCoin = 0;
  try { var rr = core.claimRefReward(save); if (rr.ok) refCoin = rr.coin; } catch (e) {}
  // 老存档进来先把已达层级称号一次性补齐
  try { core.checkTiers(save); } catch (e) {}
  save.shared.lastVisitDay = key;
  core.saveSave(save);
  setTimeout(function () {
    note('回访第 ' + save.shared.streak + ' 天 · 补给 +' + bonus + (refCoin ? ' + 结伴' + refCoin : '') + ' 元', 2600);
  }, 500);
}
claimReturnBonus();

// ---------- 音效（Web Audio / wx 可用 createInnerAudioContext 兜底静音） ----------
var sfxOn = true;
function beep(freq, dur) {
  if (!sfxOn) return;
  try {
    if (typeof wx !== 'undefined' && wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  } catch (e) {}
}

// ---------- 人间纪实版 v7：四模式 ----------
var GAME_MODES = [
  { id: 'novice',  em: '🌱', name: '新手试炼', sub: '创业起步', sec: 75, note: '时间更宽裕，先学会摆摊' },
  { id: 'formal',  em: '🔥', name: '正式经营', sub: '深耕实干', sec: 60, note: '标准节奏，拼复盘与品质' },
  { id: 'extreme', em: '⚡', name: '极限挑战', sub: '破局创新', sec: 45, note: '时间更紧，波动更真实' },
  { id: 'archive', em: '📖', name: '成长档案', sub: '创业图鉴', sec: 0,  note: '查看隐性成长、经营格局与熟客故事' }
];
function currentMode() {
  var m = save.shared.mode || 'formal';
  return GAME_MODES.filter(function (x) { return x.id === m; })[0] || GAME_MODES[1];
}
function modeSeconds() { return currentMode().sec || 60; }
function chooseMode(m) {
  if (m === 'archive') { openSub('archive'); return; }
  save.shared.mode = m; core.saveSave(save);
  note('已切换：' + currentMode().name + '·' + currentMode().sub);
}

// ---------- 场景切换 ----------
function goPrep() { scene = 'prep'; }
function goHome() { scene = 'home'; }
function startBusiness() {
  var stall = core.STALLS[save.scene.stall];
  var have = core.stockQty(save, save.scene.shelf);
  if (have <= 0) { note('库存空了，先备货'); return; }
  if (save.shared.coins < stall.rent) { note('钱不够付租金'); return; }
  customers = [];
  stats = {
    gross: 0, foodCost: 0, sold: 0, perfect: 0, lost: 0, tips: 0, errand: 0,
    paidOut: 0, timeLeft: modeSeconds(), good: 0, bad: 0, combo: 0, comboMax: 0,
    trafficBonus: 0, errandRep: 0, streetText: '街况平稳 · 客流正常', errandTask: null
  };
  streetTimer = 0; errandTimer = 0;
  scene = 'play';
  spawnCustomer();
}
function spawnCustomer() {
  if (customers.length >= 4) return;
  customers.push(core.makeCustomer(15000, Date.now(), save));
}
function openCook(c) {
  if (c.served) return;
  c.served = true;
  cook = { pos: 0, dir: 1, customer: c, speed: 2.4 };
  scene = 'cook';
}
function doCook() {
  if (!cook) return;
  var c = cook.customer;
  // CY3：手艺成长拓宽火候判定窗口（百分点），成长可被玩家真实感知
  var r = core.judgeCook(cook.pos, save.shared.rep, core.cookTolerance(save) * 100);
  var g = core.GOODS[save.scene.shelf];
  var batch = core.consumeStock(save, save.scene.shelf);
  if (!batch) { note('没货了'); scene = 'play'; cook = null; return; }
  var income = 0, qualityText = '';
  if (r.quality === 'fail') {
    stats.bad++; stats.combo = 0;
    qualityText = '火候过了，这份砸了';
  } else {
    stats.good++; stats.combo++; stats.comboMax = Math.max(stats.comboMax, stats.combo);
    income = Math.round(g.price * r.mult);
    if (c.want === save.scene.shelf) income += 2;
    if (stats.combo >= 3) income += 5;
    stats.gross += income; stats.foodCost += batch.cost; stats.sold++;
    if (r.perfect) stats.perfect++;
    // CY3：销售收入在成交时已实时入账，计入 paidOut，收摊结算只补差额，避免重复入账
    save.shared.coins += income; stats.paidOut = (stats.paidOut || 0) + income;
    qualityText = (r.perfect ? '完美出锅 +' : '出锅 +') + income;
    if (c.want === save.scene.shelf) qualityText += ' · 正合口味';
    if (stats.combo >= 3) qualityText += ' · 连击×' + stats.combo;
    if (c.rare && c.bonus > 0) {
      stats.tips += c.bonus; save.shared.coins += c.bonus; stats.paidOut = (stats.paidOut || 0) + c.bonus;
      qualityText += ' · 稀有客人 +' + c.bonus; c.bonus = 0;
    }
    if (c.regular) {
      var bond = core.addBond(save, c.regular.id);
      if (bond) qualityText += ' · ' + bond.name + '成为朋友';
      else qualityText += ' · ' + c.regular.name + '常来了';
    }
    beep();
  }
  customers = customers.filter(function (x) { return x !== c; });
  note(qualityText, 1400);
  cook = null; scene = 'play';
  spawnCustomer();
}
function endBusiness() {
  var stall = core.STALLS[save.scene.stall];
  var lost = core.expireStock(save);
  var res = core.settleDay(save, stall, stats);
  res.expired = lost;
  resultData = res;
  try { core.reportRankScore(save, true); } catch (e) {}
  scene = 'result';
  // 高光时刻：层级突破/破纪录/新徽章聚合弹层，不打断结算页阅读
  setTimeout(function () { showResultRewards(res); }, 350);
}
function nextDay() { scene = 'prep'; }
function doOddJob() {
  var key = todayKey();
  if (save.shared.oddJobDay === key) { note('今天打过零工了'); return; }
  save.shared.oddJobDay = key;
  save.shared.coins += 25; core.saveSave(save); note('打零工 +25 元');
}
function doJunk() {
  var key = todayKey();
  if (save.shared.junkDay === key) { note('今天已经翻过回收站了'); return; }
  save.shared.junkDay = key;
  var base = 8 + Math.floor(Math.random() * 15);
  if (Math.random() > 0.93) base += 25;
  save.shared.coins += base;
  if (Math.random() < 0.18) core.addClue(save, 1);
  else if (Math.random() < 0.40) {
    var g = core.GOODS[save.scene.shelf];
    save.scene.stock.push({ key: save.scene.shelf, qty: 1, buyDay: save.scene.day, expireDay: save.scene.day + g.keep });
  }
  core.saveSave(save); note('回收站翻出 ' + base + ' 元' + (core.mysteryStage(save) > 0 ? ' · 匣子有动静' : ''));
}
function doRelief() {
  var key = todayKey();
  if (save.scene.day > 3 || save.shared.coins >= 60 || save.shared.reliefDay === key) { note('救济只给开头最难的前几天'); return; }
  save.shared.reliefDay = key; save.shared.coins += 80;
  core.saveSave(save); note('街坊凑了救急钱 +80 元');
}
function doLoan() {
  var key = todayKey();
  if ((save.scene.debt || 0) > 0) { note('先把上一笔借款还清'); return; }
  if (save.shared.loanDay === key) { note('借款每天只能办一次'); return; }
  // CY3：借款统一写入 scene.debt，与 settleDay 的自动扣还字段一致（原误写 shared.debt 导致永远不还且锁死后续借款）
  save.shared.loanDay = key; save.scene.debt = 68; save.shared.coins += 60;
  core.saveSave(save); note('借本钱 +60，收摊自动还 68');
}
function doDeposit() {
  var key = todayKey();
  var bonds = save.shared.bonds || {};
  var hot = Object.keys(bonds).filter(function (k) { return bonds[k] >= 2; }).length;
  if (save.shared.rep < 3.5 && hot < 1) { note('口碑 3.5 或有熟客后才能接预售'); return; }
  if (save.shared.depositDay === key) { note('今天的预售额度用掉了'); return; }
  save.shared.depositDay = key; save.shared.coins += 40;
  core.saveSave(save); note('预售订金 +40 元');
}
function doSkipDay() {
  var key = todayKey();
  if (save.shared.lastDay === key) { note('今天已经歇业过了，明天再来'); return; }
  save.shared.lastDay = key;
  save.scene.day += 1;
  // 歇业也进入完整结算：刷新任务/清单日锚点，避免跨天后任务状态错位
  try { core.ensureDayState(save); core.refreshBadges(save); } catch (e) {}
  core.saveSave(save);
  note('今天歇业，明天再来');
}
function claimLifeNow() {
  var r = core.claimLife(save);
  core.saveSave(save);
  note(r.gained > 0 ? '清单奖励 +' + r.gained + ' 元' : '还没有新的清单奖励');
}
function doPartner(id) {
  id = id || 'street';
  var def = core.takePartner(save, id);
  if (!def) {
    var t = null;
    for (var i = 0; i < core.PARTNER_TIERS.length; i++) if (core.PARTNER_TIERS[i].id === id) t = core.PARTNER_TIERS[i];
    note(t ? (t.name + '未开放：' + t.needText) : '当前不能新增搭伙');
    return;
  }
  core.saveSave(save);
  note(def.name + '带来 +' + def.invest + ' 本钱 · 分净利' + Math.round(def.share * 100) + '%，封顶' + def.cap + '退出', 2200);
}
function watchAdBoost() {
  AD.reward('extra_traffic', function (ok) {
    if (!ok) { note('广告未看完，暂无奖励'); return; }
    if (AD.enabled && core.Store.isWx) {
      var tip = 10 + core.skinTipBonus(save);
      if (stats) { stats.tips += tip; note('广告已看完，收到 ' + tip + ' 元打赏'); beep(); }
      return;
    }
    var key = 'adFree_' + todayKey();
    if (save.shared[key]) { note('今天的试玩补给已领过'); return; }
    save.shared[key] = true;
    if (stats) { var t = 10 + core.skinTipBonus(save); stats.tips += t; note('试玩补给 +' + t + '（广告位开通后改为看广告领取）'); beep(); }
  });
}

// ---------- 子场景导航 ----------
function openSub(s) {
  prevScene = (scene === 'home' || scene === 'prep') ? scene : prevScene;
  scene = s;
  if (s === 'rank') {
    rankPostedAt = 0;
    try { core.reportRankScore(save, false); } catch (e) {}
  }
}
function backSub() { scene = prevScene || 'home'; }

// ---------- 小城创业 ----------
function doUnlockCity() {
  var r = core.unlockCity(save);
  note(r.ok ? '小城创业开张！每天可来收租' : (r.msg || '暂不能开张'));
}
function doCollectCity() {
  var r = core.collectCity(save);
  note(r.ok ? (r.name + ' 租金 +' + r.coin + ' 元') : (r.msg || '暂无可收租金'));
}

// ---------- 成就 / 皮肤 ----------
function doClaimAch() {
  var r = core.claimAch(save);
  note(r.gained > 0 ? ('成就奖励 +' + r.gained + ' 元 · ' + r.got.join('、')) : '还没有新的成就可以领');
}
function doSetSkin(id) {
  var r = core.skinUnlocked(save, id) ? core.setSkin(save, id) : core.unlockSkin(save, id);
  if (r === true || (r && r.ok)) note('已换上「' + core.skinById(id).name + '」');
  else note(r && r.msg ? r.msg : '暂不能使用');
}

// ---------- 云存档 ----------
function doCloudBackup() {
  core.ensureSlot(save);
  core.cloudBackupAsync(save, function (r) {
    if (r.ok) {
      cloudCode = r.code;
      note((r.mode === 'wxcloud' ? '已备份到微信云开发' : '已备份到本机云端槽位') + '（码长 ' + r.code.length + '）', 2200);
    } else note(r.msg || '备份失败');
  });
}
function doCloudRestore() {
  core.cloudRestoreAsync(save, function (r) {
    note(r.ok ? ((r.mode === 'wxcloud' ? '微信云开发已恢复' : '本机云端槽位已恢复') + ' · 已刷新') : (r.msg || '恢复失败'));
    if (r.ok) save = core.loadSave();
  });
}
function doCloudCopy() {
  if (!cloudCode) cloudCode = core.exportCloud(save);
  try {
    if (typeof wx !== 'undefined' && wx.setClipboardData) wx.setClipboardData({ data: cloudCode });
    else if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(cloudCode);
    note('存档码已复制，可粘贴到另一台设备');
  } catch (e) { note('复制失败，请在操作卡中查看存档码说明'); }
}
function doCloudImport() {
  var code = cloudCode;
  if (!code) {
    try { if (typeof prompt === 'function') code = prompt('粘贴云存档码：', ''); } catch (e) {}
  }
  if (!code) { note('未输入存档码'); return; }
  var r = core.cloudCodeApply(save, code);
  note(r.ok ? (r.msg + ' · 已刷新') : (r.msg || '导入失败'));
  if (r.ok) save = core.loadSave();
}

// ---------- 奖励弹层：层级 / 惊喜 / 称号 / 战绩卡 ----------
function openSurprise() {
  var r = core.claimSurprise(save);
  if (!r.ok) { note(r.msg); return; }
  var lines = [r.text, '惊喜补给 +' + r.coin + ' 元' + (r.clue ? ' · 木匣线索 +' + r.clue : '')];
  lines.push('连续惊喜第 ' + r.streak + ' 天，明天的惊喜会不一样');
  rewardModal = { em: r.em, title: r.name, lines: lines, actions: [{ t: '收下这份惊喜', f: function () { rewardModal = null; } }] };
  beep();
}
function openTitles() {
  var pr = core.tierProgress(save);
  var badgeList = core.refreshBadges(save).list;
  var lines = [pr.cur.em + ' 当前：' + pr.cur.name + ' · ' + pr.cur.sub];
  if (pr.next) lines.push('下一级：' + pr.next.em + ' ' + pr.next.name + '（' + pr.text + ' ' + pr.pct + '%）');
  else lines.push('已登顶：城角传说');
  lines.push('点亮徽章：' + badgeList.map(function (b) { return b.em; }).join(' ') + '（' + badgeList.length + ' 枚）');
  lines.push('最高纪录：连击 ×' + (save.shared.bestCombo || 0) + ' · 单晚净利 ' + Math.round(save.shared.bestProfit || 0));
  rewardModal = {
    em: '👑', title: '我的称号与徽章', lines: lines,
    actions: [{ t: '复制战绩卡炫耀', f: doBattleCard }, { t: '关闭', f: function () { rewardModal = null; } }]
  };
}
function doBattleCard() {
  var card = core.battleCard(save);
  try {
    if (typeof wx !== 'undefined' && wx.setClipboardData) wx.setClipboardData({ data: card });
    else if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(card);
    note('战绩卡已复制，可发到微信群或朋友圈', 2200);
  } catch (e) { note('复制失败，可在操作卡中查看'); }
  rewardModal = null;
}
function openShareCard() {
  var refCode = core.myRefCode(save);
  var lines = [
    '把夜市开给朋友看：你的推荐码 ' + refCode,
    '朋友进游戏带上这个码，双方回访都能领结伴补给',
    '不需要分享才能玩，也不分享立即到账——纯粹多一份回访惊喜'
  ];
  rewardModal = {
    em: '🤝', title: '喊朋友来搭伙', lines: lines,
    actions: [
      { t: '复制战绩卡+推荐码', f: doBattleCard },
      { t: '直接分享给好友', f: function () { rewardModal = null; shareGame(); } },
      { t: '关闭', f: function () { rewardModal = null; } }
    ]
  };
}
function showResultRewards(r) {
  var lines = [];
  if (r.tierGain && r.tierGain.got.length) lines.push('🎊 层级突破：' + r.tierGain.got.join('、'));
  if (r.record && r.record.combo) lines.push('⚡ 打破连击纪录：×' + save.shared.bestCombo);
  if (r.record && r.record.profit) lines.push('💰 打破单晚净利纪录：' + Math.round(save.shared.bestProfit));
  if (r.newBadges && r.newBadges.length) lines.push('🏅 新徽章：' + r.newBadges.map(function (b) { return b.em + b.name; }).join('、'));
  if (!lines.length) return;
  rewardModal = { em: '🎉', title: '今晚的高光时刻', lines: lines, actions: [{ t: '继续', f: function () { rewardModal = null; } }] };
}

function drawRewardModal() {
  if (!rewardModal) return;
  ui.rect(0, 0, W, H, 0, '#000000b0');
  var pad = 24, boxY = H / 2 - 190, boxH = 380;
  ui.rect(pad, boxY, W - 2 * pad, boxH, 16, ui.colors.panel);
  ui.text(rewardModal.em, W / 2, boxY + 40, 30, ui.colors.gold, 'center');
  ui.text(rewardModal.title, W / 2, boxY + 78, 20, ui.colors.text, 'center', true);
  var y = boxY + 116;
  for (var i = 0; i < rewardModal.lines.length; i++) {
    y = ui.wrap(rewardModal.lines[i], pad + 18, y, W - 2 * pad - 36, 24, 14, ui.colors.sub) + 6;
  }
  var acts = rewardModal.actions || [];
  var bw = (W - 2 * pad - 36 - (acts.length - 1) * 10) / acts.length;
  for (var j = 0; j < acts.length; j++) {
    (function (a, x) {
      ui.button(a.t, x, boxY + boxH - 62, bw, 44, a.f, { size: 13, fill: ui.colors.gold, color: '#1a1200' });
    })(acts[j], pad + 18 + j * (bw + 10));
  }
}

// ---------- 渲染 ----------
function render() {
  var skin = core.activeSkin(save);
  ctx.fillStyle = skin.bg || ui.colors.bg; ctx.fillRect(0, 0, W, H);
  ui.colors.gold = skin.accent || '#ffc94d';
  ui.reset();
  var pad = 18, top = 40;

  // 顶部状态栏
  ui.text(skin.em + ' ' + CONFIG.GAME_NAME, pad, 28, 20, ui.colors.gold, 'left', true);
  ui.text('💰' + save.shared.coins + '  ⭐' + save.shared.rep.toFixed(1) + '  📅第' + save.scene.day + '天', W - pad, 28, 14, ui.colors.text, 'right', true);

  if (scene === 'home') renderHome(pad, top);
  else if (scene === 'prep') renderPrep(pad, top);
  else if (scene === 'play') renderPlay(pad, top);
  else if (scene === 'cook') renderPlay(pad, top), renderCook(pad);
  else if (scene === 'result') renderResult(pad, top);
  else if (scene === 'review') renderReview(pad, top);
  else if (scene === 'review2') renderReview2(pad, top);
  else if (scene === 'archive') renderArchive(pad, top);
  else if (scene === 'city') renderCity(pad, top);
  else if (scene === 'codex') renderCodex(pad, top);
  else if (scene === 'album') renderAlbum(pad, top);
  else if (scene === 'daily') renderDaily(pad, top);
  else if (scene === 'cloud') renderCloud(pad, top);
  else if (scene === 'rank') renderRank(pad, top);
  else if (scene === 'skin') renderSkin(pad, top);

  // toast（放在最底部，避免遮挡备货/营业按钮）
  if (toast.until > Date.now()) {
    ui.rect(W / 2 - 150, H - 52, 300, 40, 12, '#000000dd');
    ui.text(toast.text, W / 2, H - 32, 13, ui.colors.text, 'center', true);
  }
  // 奖励弹层最后绘制：命中区最后注册，保证弹层按钮优先响应
  drawRewardModal();
}

function renderHome(pad, top) {
  ui.text('城角夜市苑', W / 2, top + 20, 24, ui.colors.text, 'center', true);
  ui.text('城角夜市苑 · 深度人性化真实案例版', W / 2, top + 44, 12, ui.colors.gold, 'center');
  // 当前称号条：一眼看到"我是谁"
  var tier = core.rewardTier(save);
  ui.rect(W / 2 - 124, top + 56, 248, 28, 15, ui.colors.panel2);
  ui.text(tier.em + ' ' + tier.name + ' · ' + tier.sub, W / 2, top + 70, 12, ui.colors.gold, 'center', true);
  ui.wrap('摆摊不是娱乐，是人生考场；盈亏是生活，冷暖是人间，坚持是信仰。10个真实案例、善恶平衡、隐性成长。', pad + 5, top + 90, W - 2 * pad - 10, 19, 10);
  // 四模式：真实影响营业时长，成长档案为独立子页
  var mw = (W - 2 * pad - 18) / 4, my = top + 122;
  for (var m = 0; m < GAME_MODES.length; m++) {
    (function (def, idx) {
      var sel = (save.shared.mode || 'formal') === def.id;
      ui.button(def.em + def.name, pad + idx * (mw + 6), my, mw, 36,
        function () { chooseMode(def.id); },
        { size: 10, fill: sel ? ui.colors.gold : ui.colors.panel2, color: sel ? '#1a1200' : ui.colors.text });
    })(GAME_MODES[m], m);
  }
  var cur = currentMode();
  ui.text('当前：' + cur.name + '·' + cur.sub + ' · ' + cur.note, W / 2, my + 46, 10, ui.colors.sub, 'center');
  var y = my + 58;
  ui.button('开始我在人间的一夜', W / 2 - 110, y, 220, 44, goPrep, { fill: ui.colors.gold, color: '#1a1200', size: 18 });

  // 功能中心：2 列网格（含奖励入口 + 成长档案）
  var gx = pad, gw = (W - 2 * pad - 12) / 2, gh = 36, gy0 = y + 54;
  var ready = core.surpriseReady(save);
  var menu = [
    { em: ready ? '🎁' : '📦', t: ready ? '每日惊喜·可领' : '惊喜明日再来', f: openSurprise, hot: ready },
    { em: '👑', t: '我的称号', f: openTitles },
    { em: '📖', t: '成长档案', f: function () { openSub('archive'); } },
    { em: '🏙️', t: '小城创业', f: function () { openSub('city'); } },
    { em: '🍢', t: '小吃图鉴', f: function () { openSub('codex'); } },
    { em: '🏆', t: '成就图鉴', f: function () { openSub('album'); } },
    { em: '📊', t: '经营日报', f: function () { openSub('daily'); } },
    { em: '🎨', t: '夜市皮肤', f: function () { openSub('skin'); } },
    { em: '☁️', t: '云存档', f: function () { openSub('cloud'); } },
    { em: '🏅', t: '好友榜', f: function () { openSub('rank'); } },
    { em: '📤', t: '喊朋友来', f: openShareCard }
  ];
  for (var i = 0; i < menu.length; i++) {
    var col = i % 2, row = Math.floor(i / 2);
    ui.button(menu[i].em + ' ' + menu[i].t, gx + col * (gw + 12), gy0 + row * (gh + 6), gw, gh, menu[i].f,
      { size: 11, fill: menu[i].hot ? ui.colors.gold : ui.colors.panel2, color: menu[i].hot ? '#1a1200' : ui.colors.text });
  }
  // 隐性成长与心境常驻可见：努力未必立刻盈利，但成长永不清零
  var g = core.growthSnapshot(save), emo = core.emotionState(save);
  var sy = gy0 + 6 * (gh + 6) + 4;
  ui.rect(pad, sy, W - 2 * pad, 46, 10, ui.colors.panel2);
  ui.text('📈 隐性成长 ' + g.total + '（经验' + g.experience + '·手艺' + g.craft + '·共情' + g.empathy + '·抗压' + g.resilience + '）', pad + 10, sy + 16, 10, ui.colors.gold, 'left', true);
  ui.text(emo.em + ' 心境：' + emo.name + ' · 坚持复盘，慢慢变强', pad + 10, sy + 34, 10, ui.colors.sub);
  ui.text('进度自动存在本机 · 免费试玩 · 无内购无充值', W / 2, H - 18, 10, ui.colors.sub, 'center');
}

function renderPrep(pad, top) {
  var stall = core.STALLS[save.scene.stall];
  var g = core.GOODS[save.scene.shelf];
  ui.text('今晚，去哪儿摆？', pad, top + 8, 19, ui.colors.text, 'left', true);
  var _emo = core.emotionState(save);
  ui.text(_emo.em + ' ' + _emo.name, W - pad, top + 10, 11, ui.colors.sub, 'right');
  ui.text('租金 ' + stall.rent + ' · 客流 ' + stall.flow + ' · 口碑 ' + save.shared.rep.toFixed(1) + ' · 第' + save.scene.day + '天', pad, top + 34, 12, ui.colors.sub);

  ui.text('① 选摊位', pad, top + 58, 14, ui.colors.gold, 'left', true);
  for (var i = 0; i < core.STALLS.length; i++) {
    var s = core.STALLS[i], sel = i === save.scene.stall;
    var locked = save.shared.totalRevenue < s.unlock;
    (function (idx, st, lk) {
      ui.button(st.name + '  租' + st.rent + (lk ? '  🔒营收' + st.unlock : ''),
        pad, top + 78 + idx * 36, W - 2 * pad, 32,
        lk ? null : function () { save.scene.stall = idx; core.saveSave(save); },
        { fill: sel ? ui.colors.gold : ui.colors.panel2, color: sel ? '#1a1200' : ui.colors.text, disabled: lk, size: 12 });
    })(i, s, locked);
  }

  var gy = top + 78 + core.STALLS.length * 36 + 10;
  ui.text('② 卖什么（口碑越高火候越稳）', pad, gy, 13, ui.colors.gold, 'left', true);
  var keys = Object.keys(core.GOODS);
  var cw = (W - 2 * pad - 8) / 2;
  for (var j = 0; j < keys.length; j++) {
    var k = keys[j], good = core.GOODS[k], gsel = k === save.scene.shelf;
    var glock = !core.isGoodUnlocked(save, k);
    (function (key, gd, isSel, lock, col, row) {
      ui.button(gd.name + ' ' + gd.cost + '→' + gd.price + (lock ? ' 🔒' + gd.unlock : ''),
        pad + col * (cw + 8), gy + 20 + row * 34, cw, 30,
        lock ? null : function () { save.scene.shelf = key; core.saveSave(save); },
        { fill: isSel ? ui.colors.gold : ui.colors.panel2, color: isSel ? '#1a1200' : ui.colors.text, disabled: lock, size: 11 });
    })(k, good, gsel, glock, j % 2, Math.floor(j / 2));
  }

  var sy = gy + 20 + 6 * 34 + 8;
  var have = core.stockQty(save, save.scene.shelf);
  ui.text('③ 备货（当前 ' + have + ' 份）', pad, sy, 14, ui.colors.gold, 'left', true);
  ui.button('进货3份 -' + (g.cost * 3), pad, sy + 20, (W - 2 * pad - 12) / 2, 42,
    function () { if (core.addStock(save, save.scene.shelf, 3)) { core.saveSave(save); note('进货 3 份'); } else note('钱不够或商品未解锁'); },
    { size: 14, fill: ui.colors.panel2 });
  ui.button('开门营业 · 租' + stall.rent, pad + (W - 2 * pad - 12) / 2 + 12, sy + 20, (W - 2 * pad - 12) / 2, 42,
    startBusiness, { size: 14, fill: ui.colors.green, color: '#08210f' });

  core.ensureDayState(save);
  var taskText = core.TASKS.map(function (t) {
    return t.em + Math.min(core.taskProgress(save, t.id), t.goal) + '/' + t.goal;
  }).join(' ');
  ui.text('今日任务 ' + taskText + (save.shared.taskClaimed ? ' ✓已领' : ''), pad + 2, sy + 70, 10, save.shared.taskClaimed ? ui.colors.green : ui.colors.sub);

  var bw = (W - 2 * pad - 24) / 3, step = 36, oy = sy + 86;
  ui.button('💼 零工+25', pad, oy, bw, 32, doOddJob, { size: 10 });
  ui.button('🗑️ 回收站', pad + bw + 12, oy, bw, 32, doJunk, { size: 10 });
  ui.button('🎁 救急+80', pad + (bw + 12) * 2, oy, bw, 32, doRelief, { size: 10 });

  ui.button('🤝 借本+60', pad, oy + step, bw, 32, doLoan, { size: 10 });
  ui.button('📦 预售+40', pad + bw + 12, oy + step, bw, 32, doDeposit, { size: 10 });
  ui.button('🎯 清单奖励', pad + (bw + 12) * 2, oy + step, bw, 32, claimLifeNow, { size: 10 });

  var active = core.activePartners(save);
  for (var p = 0; p < core.PARTNER_TIERS.length; p++) {
    var def = core.PARTNER_TIERS[p];
    var has = active.some(function (x) { return x.type === def.id; });
    var unlocked = core.partnerUnlocked(save, def.id);
    var label = has ? (def.em + def.name + ' 已搭伙') : (unlocked ? (def.em + def.name + ' +' + def.invest) : (def.em + def.name + ' 未开'));
    ui.button(label, pad + p * (bw + 12), oy + step * 2, bw, 32,
      unlocked ? function (id) { return function () { doPartner(id); }; }(def.id) : null,
      { size: 9, disabled: !unlocked, fill: unlocked ? ui.colors.panel2 : '#2a2c3a' });
  }

  ui.button('😴 歇业', pad, oy + step * 3, bw, 32, doSkipDay, { size: 10 });
  ui.button('🏠 首页', pad + bw + 12, oy + step * 3, bw, 32, goHome, { size: 10 });
  ui.button('🏙️ 小城', pad + (bw + 12) * 2, oy + step * 3, bw, 32, function () { openSub('city'); }, { size: 10 });
}

function renderPlay(pad, top) {
  var g = core.GOODS[save.scene.shelf];
  ui.text('营业中 · 剩余 ' + Math.ceil(stats.timeLeft) + 's', pad, top + 10, 18, ui.colors.gold, 'left', true);
  ui.text('流水 +' + stats.gross + ' · 卖出 ' + stats.sold + ' · 连击×' + stats.combo, W - pad, top + 10, 13, ui.colors.text, 'right');
  ui.text(stats.streetText, pad, top + 34, 12, stats.trafficBonus >= 0 ? ui.colors.green : ui.colors.red);

  var stallY = H - 220;
  ui.rect(W / 2 - 90, stallY, 180, 70, 14, ui.colors.panel2);
  ui.text('🍳 我的摊位', W / 2, stallY + 24, 15, ui.colors.gold, 'center', true);
  ui.text(g.name + ' · 剩 ' + core.stockQty(save, save.scene.shelf) + ' 份', W / 2, stallY + 50, 13, ui.colors.text, 'center');

  ui.text('排队 ' + customers.length + ' 人 · 点顾客接单（看头顶想吃什么）', pad, stallY - 30, 13, ui.colors.sub);
  for (var i = 0; i < customers.length; i++) {
    var c = customers[i];
    var cx = pad + 12 + i * ((W - 2 * pad - 24) / 4);
    var cy = stallY - 110;
    var pct = core.customerPatiencePct(c, Date.now());
    var face = c.rare ? c.rare.em : (c.regular ? c.regular.em : '🧍');
    var want = c.want && core.GOODS[c.want] ? core.GOODS[c.want].emoji : '想买';
    ui.rect(cx, cy, 60, 76, 10, c.rare ? '#5a4524' : ui.colors.panel);
    ui.text(face, cx + 30, cy + 24, 25, ui.colors.text, 'center');
    ui.text(want, cx + 30, cy + 48, 11, c.rare ? ui.colors.gold : ui.colors.sub, 'center');
    ui.bar(cx + 6, cy + 62, 48, 6, pct, pct < 30 ? ui.colors.red : ui.colors.green);
    (function (cc) { ui.button('', cx, cy, 60, 76, function () { openCook(cc); }, { fill: '#ffffff01' }); })(c);
  }

  var e = stats.errandTask;
  var elabel = e ? ('🤝 ' + e.def.from + ' ' + e.progress + '/' + e.def.need) : '🤝 邻摊委托等待中';
  ui.button(elabel, pad, H - 142, W - 2 * pad, 40,
    e ? function () { var r = core.doErrand(save, e); if (r.done) { stats.errand += r.coin; stats.trafficBonus += r.traffic; stats.errandRep += r.rep; stats.errandTask = null; note(r.from + '：谢啦！+' + r.coin + ' 元'); } } : null,
    { size: 13, disabled: !e, fill: e ? ui.colors.panel2 : '#2a2c3a' });

  ui.button('📺 看广告得打赏 +10', pad, H - 90, (W - 2 * pad - 12) / 2, 46, watchAdBoost, { size: 14 });
  ui.button('🌙 收摊结算', pad + (W - 2 * pad - 12) / 2 + 12, H - 90, (W - 2 * pad - 12) / 2, 46, endBusiness, { size: 15, fill: ui.colors.gold, color: '#1a1200' });
}

function renderCook(pad) {
  ui.rect(0, 0, W, H, 0, '#000000aa');
  ui.rect(pad, H / 2 - 140, W - 2 * pad, 280, 16, ui.colors.panel);
  ui.text('🔥 卡准火候，点击出锅！', W / 2, H / 2 - 105, 20, ui.colors.gold, 'center', true);
  // 火候条
  var bx = pad + 20, bw = W - 2 * pad - 40, by = H / 2 - 50;
  ui.rect(bx, by, bw, 30, 8, '#00000066');
  ui.rect(bx + bw * 0.38, by, bw * 0.24, 30, 4, '#3a8f5f');
  ui.rect(bx + bw * 0.47, by, bw * 0.06, 30, 4, ui.colors.gold);
  // 指针
  var px = bx + bw * cook.pos / 100;
  ui.rect(px - 2, by - 8, 4, 46, 2, '#ffffff');
  ui.text('绿区成功 · 金区完美（+35%）', W / 2, by + 60, 13, ui.colors.sub, 'center');
  ui.button('出 锅！', W / 2 - 90, H / 2 + 85, 180, 52, doCook, { fill: ui.colors.gold, color: '#1a1200', size: 22 });
}

function renderResult(pad, top) {
  var r = resultData;
  ui.text(r.profit >= 0 ? '🌙 今晚赚回来了！' : '😢 今晚没赚回来，明天再战', W / 2, top + 30, 20, r.profit >= 0 ? ui.colors.gold : ui.colors.red, 'center', true);
  ui.text('本晚净利 ' + (r.profit >= 0 ? '+' : '') + r.profit + ' 元', W / 2, top + 64, 26, ui.colors.text, 'center', true);
  var y = top + 110;
  var lines = [
    '营业收入 +' + r.gross, '摊位租金 -' + r.rent, '食材核销 -' + r.foodCost,
    '生存恒成本 -' + (r.fixedCost || 6),
    '环境波动 ' + (r.environment >= 0 ? '+' : '') + Math.round((r.environment || 0) * 100) + '%（努力可控，环境不可控）',
    '打赏 +' + r.tips, '卖出 ' + r.sold + ' 份 · 完美 ' + r.perfect + ' 次 · 走人 ' + r.lost + ' 位',
    '过期清仓 ' + r.expired + ' 份 · 今夜真实案例 ' + (r.humanEvents || []).length + ' 件'
  ];
  lines.forEach(function (t) { ui.text(t, pad + 10, y, 15, ui.colors.sub); y += 28; });
  ui.text('口碑 ' + r.repBefore.toFixed(1) + ' → ' + save.shared.rep.toFixed(1) + '（' + (r.repDelta >= 0 ? '+' : '') + r.repDelta + '）',
    pad + 10, y, 14, r.repDelta >= 0 ? ui.colors.green : ui.colors.red); y += 28;
  if (r.partnerNotes.length) { ui.text('搭伙分成：' + r.partnerNotes.join('、'), pad + 10, y, 12, ui.colors.gold); y += 26; }
  if (r.life.gained > 0) { ui.text('人生清单奖励 +' + r.life.gained + ' 元', pad + 10, y, 13, ui.colors.green); y += 26; }
  if (r.taskReward > 0) { ui.text('每日任务全完成 +' + r.taskReward + ' 元', pad + 10, y, 13, ui.colors.green); y += 26; }
  if (r.debtPaid > 0) { ui.text('自动还借款 ' + r.debtPaid + ' 元', pad + 10, y, 13, ui.colors.sub); y += 26; }
  if (r.mysteryUnlocked) { ui.text('🔮 匣中往事：' + core.MYSTERY_STORY[r.mysteryStage].title, pad + 10, y, 13, ui.colors.gold); y += 26; }
  if (r.tierGain && r.tierGain.gained > 0) { ui.text('🎊 层级突破奖励 +' + r.tierGain.gained + ' 元 · ' + r.tier.em + r.tier.name, pad + 10, y, 13, ui.colors.gold); y += 26; }
  if (r.record && (r.record.combo || r.record.profit)) { ui.text('⚡ 打破了自己的纪录！', pad + 10, y, 13, ui.colors.gold); y += 26; }
  ui.button('📖 查看收摊复盘 →', W / 2 - 110, H - 100, 220, 54, function () { scene = 'review'; }, { fill: ui.colors.gold, color: '#1a1200', size: 18 });
}
var resultData = null;

// ---------- 人间纪实版：收摊复盘（两屏） ----------
function openReview() { if (resultData) scene = 'review'; }
function reviewNext() { scene = 'review2'; }
function renderReview(pad, top) {
  subHead('📖 收摊复盘 · 人间纪实', pad, top);
  var v = resultData && resultData.review;
  if (!v) { ui.wrap('还没有复盘。先做完今晚的生意吧。', pad, top + 70, W - 2 * pad, 24, 14); return; }
  var y = top + 50;
  ui.text(v.title, W / 2, y, 17, ui.colors.gold, 'center', true); y += 28;
  ui.wrap(v.summary, pad + 4, y, W - 2 * pad - 8, 18, 11); y += 76;
  ui.text('经营账本', pad + 4, y, 13, ui.colors.gold, 'left', true); y += 20;
  v.rows.forEach(function (row) {
    ui.text(row.k, pad + 6, y, 11, ui.colors.sub);
    ui.text(row.v, W - pad - 6, y, 11, ui.colors.text, 'right'); y += 20;
  });
  y += 6;
  ui.text('今日短板', pad + 4, y, 13, ui.colors.gold, 'left', true); y += 18;
  v.short.forEach(function (s) { ui.wrap('· ' + s, pad + 6, y, W - 2 * pad - 12, 17, 10); y += 17; });
  ui.button('继续：成长与人间篇章 →', W / 2 - 116, H - 92, 232, 48, reviewNext, { fill: ui.colors.gold, color: '#1a1200', size: 16 });
}
function renderReview2(pad, top) {
  subHead('📖 复盘 · 成长与人间', pad, top);
  var v = resultData && resultData.review;
  if (!v) { backSub(); return; }
  var y = top + 50;
  var g = v.growth || core.growthSnapshot(save), emo = core.emotionState(save);
  ui.text('🌱 隐性成长（永不清零）', pad + 4, y, 14, ui.colors.gold, 'left', true); y += 22;
  ui.text('经验 ' + g.experience + '   手艺 ' + g.craft + '   共情 ' + g.empathy + '   抗压 ' + g.resilience + '   格局 ' + g.perspective + '   合计 ' + g.total, pad + 6, y, 12, ui.colors.text); y += 26;
  ui.text(emo.em + ' 当前心境：' + emo.name + ' · 复盘让坚持沉淀为能力', pad + 6, y, 11, ui.colors.sub); y += 24;
  var lv = v.lifeView || {}, kb = v.kindBalance || {};
  ui.text('🧭 人间阅历：' + (lv.days || 0) + ' 天 · ' + (lv.events || 0) + ' 件 · 熟客 ' + (lv.stories || 0) + ' 段', pad + 6, y, 11, ui.colors.sub); y += 20;
  ui.text('⚖️ 善恶平衡：善意 ' + (kb.good || 0) + ' · 现实 ' + (kb.bad || 0) + ' · 环境 ' + (kb.gov || 0), pad + 6, y, 11, ui.colors.sub); y += 26;
  var buffs = resultData.buffs || [];
  if (buffs.length) {
    ui.text('🎗️ 状态', pad + 4, y, 13, ui.colors.gold, 'left', true); y += 18;
    buffs.forEach(function (b) { ui.text(b.em + ' ' + b.name + '：' + b.effect, pad + 6, y, 11, ui.colors.sub); y += 18; });
  }
  y += 4;
  ui.text('🌙 今夜人间（真实冷暖）', pad + 4, y, 13, ui.colors.gold, 'left', true); y += 18;
  (v.events || []).forEach(function (e) {
    ui.wrap(e.em + ' ' + e.title + ' · ' + e.review, pad + 6, y, W - 2 * pad - 12, 16, 10); y += 34;
  });
  ui.button('😴 迎接明天 →', W / 2 - 110, H - 92, 220, 48, function () { scene = 'prep'; }, { fill: ui.colors.gold, color: '#1a1200', size: 17 });
}

// ---------- 人间纪实版：成长档案 · 创业图鉴 ----------
function renderArchive(pad, top) {
  subHead('📖 成长档案 · 创业图鉴', pad, top);
  var g = core.growthSnapshot(save), emo = core.emotionState(save);
  var y = top + 50;
  var lv = save.shared.lifeView || {}, kb = save.shared.kindBalance || {};
  ui.rect(pad, y, W - 2 * pad, 104, 12, ui.colors.panel2);
  ui.text('经验 ' + g.experience + ' · 手艺 ' + g.craft + ' · 共情 ' + g.empathy + ' · 抗压 ' + g.resilience + ' · 格局 ' + g.perspective, W / 2, y + 20, 12, ui.colors.gold, 'center', true);
  ui.text('隐性成长合计 ' + g.total + ' · ' + emo.em + ' ' + emo.name, W / 2, y + 44, 12, ui.colors.text, 'center');
  ui.text('人间阅历 ' + (lv.days || 0) + ' 天 · ' + (lv.events || 0) + ' 件 · 熟客 ' + (lv.stories || 0) + ' 段', W / 2, y + 66, 11, ui.colors.sub, 'center');
  ui.text('善恶平衡 善意' + (kb.good || 0) + ' / 现实' + (kb.bad || 0) + ' / 环境' + (kb.gov || 0), W / 2, y + 86, 11, ui.colors.sub, 'center');
  y += 116;
  ui.text('熟客故事 · 创业图鉴', pad + 4, y, 13, ui.colors.gold, 'left', true); y += 18;
  var met = save.shared.totalCustomers || 0;
  (core.REGULAR_STORIES || []).forEach(function (s, i) {
    var unlocked = met >= i * 12;
    ui.rect(pad, y, W - 2 * pad, 40, 8, unlocked ? ui.colors.panel2 : '#242636');
    ui.text((unlocked ? s.em : '🔒') + ' ' + s.name + ' · ' + s.buff, pad + 8, y + 12, 11, unlocked ? ui.colors.text : '#6a6c80', 'left', true);
    if (unlocked) ui.text(s.story, pad + 8, y + 28, 9, ui.colors.sub);
    y += 44;
  });
  ui.button('返回首页', W / 2 - 90, H - 70, 180, 44, goHome, { fill: ui.colors.panel2 });
}

// ---------- 通用：子页标题 + 返回 ----------
function subHead(title, pad, top) {
  ui.button('‹ 返回', pad, top - 2, 90, 34, backSub, { size: 13, fill: ui.colors.panel2 });
  ui.text(title, W / 2, top + 14, 19, ui.colors.gold, 'center', true);
}

function renderCity(pad, top) {
  subHead('🏙️ 小城创业', pad, top);
  var y = top + 54;
  if (!core.cityUnlocked(save)) {
    ui.wrap('把夜市挣下的钱，慢慢盘成一间小店。开张后每天都能收到租金，是长线的被动收入。', pad, y, W - 2 * pad, 22, 13);
    ui.button('🏪 开张小城创业（累计营收≥300）', pad, y + 70, W - 2 * pad, 50,
      function () { doUnlockCity(); }, { size: 15, fill: ui.colors.gold, color: '#1a1200' });
    ui.text('当前累计营收 ' + Math.round(save.shared.totalRevenue) + ' / 300', W / 2, y + 140, 13, ui.colors.sub, 'center');
    return;
  }
  var lv = core.cityLevel(save);
  ui.text('你的产业：' + lv.em + ' ' + lv.name, pad, y, 17, ui.colors.text, 'left', true);
  ui.text('每日租金 +' + lv.income + ' 元 · 累计收租 ' + Math.round(save.shared.cityIncome) + ' 元', pad, y + 30, 13, ui.colors.gold);
  ui.wrap('随着累计营收增长，产业会自动升级：街边小店(300) → 连锁档口(900)。每天来收一次租即可。', pad, y + 60, W - 2 * pad, 22, 12);
  var got = save.shared.cityDay === todayKey();
  ui.button(got ? '✅ 今天已收租，明天再来' : '💰 收取今日租金 +' + lv.income, pad, y + 130, W - 2 * pad, 52,
    got ? null : doCollectCity, { size: 17, fill: got ? '#2a2c3a' : ui.colors.green, color: got ? '#6a6c80' : '#08210f', disabled: got });
}

function renderCodex(pad, top) {
  subHead('🍢 小吃图鉴', pad, top);
  var list = core.codexGoods(save);
  ui.text('已解锁 ' + list.filter(function (g) { return g.unlocked; }).length + ' / ' + list.length + ' 种', pad, top + 48, 13, ui.colors.sub);
  var y = top + 74;
  for (var i = 0; i < list.length; i++) {
    var g = list[i], col = i % 2, row = Math.floor(i / 2);
    var x = pad + col * ((W - 2 * pad - 10) / 2 + 10);
    var yy = y + row * 46;
    ui.rect(x, yy, (W - 2 * pad - 10) / 2, 40, 10, g.unlocked ? ui.colors.panel2 : '#242636');
    ui.text(g.em + ' ' + g.name, x + 10, yy + 14, 12, g.unlocked ? ui.colors.text : '#6a6c80', 'left', true);
    ui.text(g.unlocked ? ('售 ' + g.price) : ('🔒营收' + g.unlock), x + 10, yy + 30, 10, g.unlocked ? ui.colors.gold : ui.colors.sub);
  }
}

function renderAlbum(pad, top) {
  subHead('🏆 成就图鉴', pad, top);
  var st = core.achStats(save);
  ui.text('已完成 ' + st.done + ' / ' + st.total, pad, top + 48, 13, ui.colors.sub);
  var y = top + 72;
  core.ACHIEVEMENTS.forEach(function (a, i) {
    var done = core.achDone(save, a.id);
    var claimed = save.shared.achClaimed.indexOf(a.id) >= 0;
    var yy = y + i * 48;
    ui.rect(pad, yy, W - 2 * pad, 42, 10, done ? ui.colors.panel2 : '#242636');
    ui.text(a.em + ' ' + a.name + (claimed ? ' ✓' : ''), pad + 10, yy + 14, 13, done ? ui.colors.gold : '#6a6c80', 'left', true);
    ui.text(a.desc + ' · 奖励' + a.rw, pad + 10, yy + 31, 10, ui.colors.sub);
  });
  var by = H - 70;
  ui.button('领取已完成成就', pad, by, (W - 2 * pad - 12) / 2, 46, doClaimAch, { size: 14, fill: ui.colors.gold, color: '#1a1200' });
  ui.button('返回首页', pad + (W - 2 * pad - 12) / 2 + 12, by, (W - 2 * pad - 12) / 2, 46, goHome, { size: 14 });
}

function renderDaily(pad, top) {
  subHead('📊 经营日报', pad, top);
  var h = save.shared.history || [];
  if (!h.length) { ui.wrap('还没有日报。收摊结算后，每晚的经营记录会出现在这里。', pad, top + 70, W - 2 * pad, 24, 14); return; }
  ui.text('最近 ' + h.length + ' 晚 · 每晚净利', pad, top + 50, 13, ui.colors.sub);
  var maxAbs = 1;
  h.forEach(function (r) { maxAbs = Math.max(maxAbs, Math.abs(r.profit)); });
  var y = top + 76, rowH = 34;
  var shown = h.slice(-12);
  shown.forEach(function (r, i) {
    var yy = y + i * rowH;
    ui.text('第' + r.day + '天', pad, yy + 8, 11, ui.colors.sub);
    var barX = pad + 46, barW = W - 2 * pad - 46 - 52;
    ui.rect(barX, yy, barW, 16, 8, '#00000044');
    var w = Math.max(3, barW * Math.abs(r.profit) / maxAbs);
    ui.rect(barX, yy, w, 16, 8, r.profit >= 0 ? ui.colors.green : ui.colors.red);
    ui.text((r.profit >= 0 ? '+' : '') + r.profit, W - pad, yy + 8, 12, r.profit >= 0 ? ui.colors.green : ui.colors.red, 'right');
  });
  var last = h[h.length - 1];
  ui.text('最近一晚：卖出' + last.sold + ' 份 · 完美' + last.perfect + ' 次 · 口碑' + last.rep.toFixed(1), pad, H - 54, 12, ui.colors.gold);
}

function renderSkin(pad, top) {
  subHead('🎨 夜市皮肤', pad, top);
  ui.text('换装只改外观，并带来少量客流/小费加成 · 无任何付费', pad, top + 48, 12, ui.colors.sub);
  core.SKINS.forEach(function (s, i) {
    var active = save.shared.activeSkin === s.id;
    var owned = core.skinUnlocked(save, s.id);
    var yy = top + 74 + i * 76;
    ui.rect(pad, yy, W - 2 * pad, 66, 12, active ? ui.colors.panel2 : '#202238');
    ui.rect(pad + 8, yy + 10, 44, 44, 8, s.bg);
    ui.text(s.em, pad + 30, yy + 32, 22, s.accent, 'center');
    ui.text(s.name + (active ? ' · 使用中' : ''), pad + 62, yy + 22, 14, active ? ui.colors.gold : ui.colors.text, 'left', true);
    ui.text(owned ? ('客流+' + (s.flow || 0) + ' 小费+' + (s.tip || 0)) : ('解锁：' + s.need), pad + 62, yy + 44, 11, ui.colors.sub);
    ui.button(active ? '已启用' : (owned ? '启用' : '解锁'), W - pad - 86, yy + 18, 74, 30,
      function () { doSetSkin(s.id); }, { size: 12, fill: active ? '#3a3f6b' : ui.colors.gold, color: active ? ui.colors.text : '#1a1200', disabled: active });
  });
}

function renderCloud(pad, top) {
  subHead('☁️ 云存档', pad, top);
  ui.wrap('把进度备份到云端槽位，换设备也能接着玩。当前为本地可跑通版本；上线后在操作卡按步骤接入微信云开发即可切换为真正的云端同步。', pad, top + 48, W - 2 * pad, 22, 12);
  var y = top + 128;
  ui.button('⬆️ 备份当前进度', pad, y, W - 2 * pad, 48, doCloudBackup, { size: 16, fill: ui.colors.green, color: '#08210f' });
  ui.button('⬇️ 从云端恢复', pad, y + 60, (W - 2 * pad - 12) / 2, 46, doCloudRestore, { size: 14, fill: ui.colors.panel2 });
  ui.button('📋 复制存档码', pad + (W - 2 * pad - 12) / 2 + 12, y + 60, (W - 2 * pad - 12) / 2, 46, doCloudCopy, { size: 14, fill: ui.colors.panel2 });
  ui.button('📥 粘贴存档码导入', pad, y + 118, W - 2 * pad, 46, doCloudImport, { size: 14 });
  ui.text(cloudCode ? ('存档码已生成（' + cloudCode.length + ' 字符）') : '尚未生成存档码', W / 2, H - 54, 11, ui.colors.sub, 'center');
}

function renderRank(pad, top) {
  subHead('🏅 好友榜', pad, top);
  var boxY = top + 58;
  var boxH = H - boxY - 72;
  var useWxRank = !!(openDataContext && sharedCanvas && openDataContext.postMessage);

  if (useWxRank) {
    var now = Date.now();
    if (!rankPostedAt || now - rankPostedAt > 1200) {
      rankPostedAt = now;
      try {
        openDataContext.postMessage({
          type: 'renderRank',
          width: W - 2 * pad,
          height: boxH,
          dpr: dpr,
          selfScore: save.shared.totalRevenue || 0,
          selfDay: save.scene.day || 1,
          selfRep: save.shared.rep || 3,
          selfTitle: core.rewardTier(save).name
        });
      } catch (e) { useWxRank = false; }
    }
    if (useWxRank) {
      ui.rect(pad, boxY, W - 2 * pad, boxH, 12, '#12142a');
      try {
        ctx.drawImage(sharedCanvas, pad, boxY, W - 2 * pad, boxH);
        ui.text('微信同玩好友实时榜 · 主游戏不读取好友昵称', W / 2, H - 54, 11, ui.colors.sub, 'center');
        return;
      } catch (e) { useWxRank = false; }
    }
  }

  var lb = core.leaderboard(save);
  ui.text('浏览器预览榜 · 含虚拟对手；微信内自动切换同玩好友榜', pad, top + 48, 11, ui.colors.sub);
  var y = top + 74;
  lb.list.forEach(function (r, i) {
    var yy = y + i * 56;
    ui.rect(pad, yy, W - 2 * pad, 48, 10, r.me ? '#3a3f6b' : ui.colors.panel2);
    ui.text('第' + r.rank + '名', pad + 12, yy + 24, 14, r.rank <= 3 ? ui.colors.gold : ui.colors.sub, 'left', true);
    ui.text(r.em + ' ' + r.name + (r.me ? '（我）' : ''), pad + 78, yy + 24, 14, r.me ? ui.colors.gold : ui.colors.text, 'left', true);
    ui.text('营收 ' + r.revenue + ' · 第' + r.day + '天', W - pad - 12, yy + 24, 11, ui.colors.sub, 'right');
  });
  ui.text('我的排名：第 ' + lb.myRank + ' 名', W / 2, H - 54, 14, ui.colors.gold, 'center', true);
}

// ---------- 主循环 ----------
function loop(ts) {
  var dt = Math.min(100, ts - lastTs); lastTs = ts;
  if (scene === 'play') {
    stats.timeLeft -= dt / 1000;
    var before = customers.length;
    customers = customers.filter(function (c) { return c.deadline > Date.now(); });
    if (customers.length < before) {
      stats.lost += (before - customers.length);
      stats.combo = 0;
    }

    streetTimer += dt;
    if (streetTimer >= 12000) {
      streetTimer = 0;
      var sh = core.rollStreetShift();
      stats.trafficBonus += sh.delta;
      stats.streetText = sh.em + ' ' + sh.text + ' · 客流' + (sh.delta >= 0 ? '+' : '') + sh.delta;
      note(stats.streetText, 1600);
    }

    errandTimer += dt;
    if (stats.errandTask && Date.now() > stats.errandTask.deadline) {
      stats.errandTask = null; errandTimer = 6000; note('邻摊委托超时了，下次再帮');
    } else if (!stats.errandTask && errandTimer >= 9000) {
      errandTimer = 0;
      stats.errandTask = core.startErrand();
      note('邻摊委托：' + stats.errandTask.def.from + ' · ' + stats.errandTask.def.title, 1600);
    }

    // CY3：心境/隐性成长/善恶平衡真实修正客流，与 H5 口径一致
    var flow = Math.max(2, (core.STALLS[save.scene.stall].flow + (stats.trafficBonus || 0) + core.skinFlowBonus(save)) * core.flowModifier(save));
    if (Math.random() < flow / 100000 * dt && customers.length < 4) spawnCustomer();
    if (stats.timeLeft <= 0) endBusiness();
  } else if (scene === 'cook' && cook) {
    cook.pos += cook.dir * cook.speed * dt / 16;
    if (cook.pos >= 100) { cook.pos = 100; cook.dir = -1; }
    if (cook.pos <= 0) { cook.pos = 0; cook.dir = 1; }
  }
  render();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(loop);
}

// ---------- 输入 ----------
function onTouch(x, y) {
  var fn = ui.hitTest(x, y);
  if (fn) { fn(); beep(600, 0.03); }
}
if (typeof wx !== 'undefined' && wx.onTouchStart) {
  wx.onTouchStart(function (e) {
    var t = e.touches[0]; if (t) onTouch(t.clientX, t.clientY);
  });
} else if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', function (e) {
    var r = canvas.getBoundingClientRect();
    onTouch((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height));
  });
}

requestAnimationFrame(loop);
