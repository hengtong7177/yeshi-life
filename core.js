// core.js —— 《城角夜市苑》核心数据逻辑（与渲染无关，可原样复用）
// 源自 H5 版已验证的：FIFO 库存、结算、分成、清单、火候、顾客耐心判定
// 微信小游戏 / 浏览器双环境：通过 Store 适配层读写存档

var CONFIG = require('./config.js');

var Store = (function () {
  // CY3：小游戏使用独立键，避免与浏览器主 H5 的同名键互毁存档。
  // 首次运行时若旧键确为小游戏结构（有 scene、无 scenes）则平滑迁移。
  var KEY = 'lifesim_mini_v1';
  var KEY_LEGACY = 'lifesim_platform_v1';
  var isWx = (typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function');
  function getRaw(k) {
    try { return isWx ? wx.getStorageSync(k) : (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null); }
    catch (e) { return null; }
  }
  function setRaw(k, obj) {
    try {
      if (isWx) wx.setStorageSync(k, obj);
      else if (typeof localStorage !== 'undefined') localStorage.setItem(k, JSON.stringify(obj));
    } catch (e) {}
  }
  function isMiniShape(raw) {
    if (!raw || typeof raw !== 'object') return false;
    return !!(raw.shared && raw.scene && !raw.scenes);
  }
  function read() {
    var raw = getRaw(KEY);
    if (!raw) {
      var legacy = getRaw(KEY_LEGACY);
      if (typeof legacy === 'string') { try { legacy = JSON.parse(legacy); } catch (e) { legacy = null; } }
      if (isMiniShape(legacy)) { setRaw(KEY, legacy); return legacy; }
    }
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }
  function write(obj) { setRaw(KEY, obj); }
  return { read: read, write: write, isWx: isWx, KEY: KEY };
})();

function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round1(v) { return Math.round(v * 10) / 10; }

var DEF_SHARED = {
  coins: 180, rep: 3.0, totalRevenue: 0, totalCustomers: 0, perfect: 0,
  clues: 0, partnerLog: [], listClaimed: [], partners: [], chapter: 1, streak: 1,
  bonds: {}, rareMet: [], lastDay: '', lastVisitDay: '', lastShareRewardDay: '',
  oddJobDay: '', reliefDay: '', loanDay: '', depositDay: '', junkDay: '',
  taskDay: '', taskProgress: {}, taskClaimed: false, clueDay: '', errandClueDay: '',
  ownedSkins: ['default'], activeSkin: 'default', achClaimed: [],
  cityUnlocked: false, cityIncome: 0, goodsFound: [], history: [],
  cloudSlotId: '', rankReported: '',
  // 奖励机制 v6：层级称号 / 每日惊喜 / 虚荣展示 / 好友推荐
  tier: 0, tierClaimed: [], chestDay: '', chestStreak: 0,
  highlight: {}, badges: [], lastBadges: [], ref: { code: '', invited: 0, joined: 0, day: '', rewardDay: '' },
  bestCombo: 0, bestProfit: 0, surpriseLog: [],
  // 深度人性化·真实案例版：写实励志内核（情绪/隐性成长/人性事件/复盘）
  emotion: 60, growth: { experience: 0, craft: 0, empathy: 0, resilience: 0, perspective: 0 },
  mode: 'formal', fatigueDays: 0, lossDays: 0, reviewDays: 0,
  buffs: [], dayEvents: [], lastReview: null, storyMet: [],
  // 人间阅历 / 善恶平衡 / 经营格局 / 恒成本与真实波动
  perspective: 0, lifeView: { days: 0, events: 0, good: 0, bad: 0, gov: 0, stories: 0 },
  kindBalance: { good: 0, bad: 0, gov: 0 },
  fixedCostPaid: 0, environment: 0,
  saveVersion: 8
};

// 12 种小吃：wantRate 之和约等于 1，用于顾客点单概率
var GOODS = {
  jianbing: { name: '煎饼果子', cost: 6, price: 14, keep: 1, emoji: '煎饼', unlock: 0, wantRate: 0.14 },
  lengmian: { name: '烤冷面', cost: 7, price: 16, keep: 1, emoji: '冷面', unlock: 0, wantRate: 0.11 },
  kaochang: { name: '烤肠', cost: 5, price: 12, keep: 1, emoji: '烤肠', unlock: 0, wantRate: 0.11 },
  shaobing: { name: '烤炉饼', cost: 4, price: 11, keep: 2, emoji: '炉饼', unlock: 40, wantRate: 0.09 },
  naicha: { name: '手打柠檬茶', cost: 5, price: 13, keep: 1, emoji: '柠檬茶', unlock: 100, wantRate: 0.09 },
  zhachuan: { name: '炸串', cost: 8, price: 19, keep: 1, emoji: '炸串', unlock: 220, wantRate: 0.10 },
  tanghulu: { name: '冰糖葫芦', cost: 3, price: 9, keep: 2, emoji: '糖葫芦', unlock: 0, wantRate: 0.08 },
  kaoyu: { name: '铁板鱿鱼', cost: 9, price: 22, keep: 1, emoji: '鱿鱼', unlock: 350, wantRate: 0.08 },
  douhua: { name: '豆腐脑', cost: 4, price: 10, keep: 1, emoji: '豆腐脑', unlock: 500, wantRate: 0.07 },
  bingfen: { name: '手搓冰粉', cost: 5, price: 13, keep: 1, emoji: '冰粉', unlock: 700, wantRate: 0.06 },
  roujiamo: { name: '腊汁肉夹馍', cost: 10, price: 23, keep: 2, emoji: '肉夹馍', unlock: 950, wantRate: 0.04 },
  yaxue: { name: '鸭血粉丝汤', cost: 11, price: 25, keep: 1, emoji: '粉丝汤', unlock: 1300, wantRate: 0.03 }
};

// 皮肤：只改视觉与少许客流/小费加成，不涉及任何付费
var SKINS = [
  { id: 'default', name: '烟火夜市', em: '🏮', bg: '#12142a', accent: '#ffc94d', need: '默认拥有', flow: 0, tip: 0, ok: function () { return true; } },
  { id: 'dusk', name: '黄昏街角', em: '🌆', bg: '#2a1b2e', accent: '#ff9d6c', need: '累计营收≥300', flow: 1, tip: 0, ok: function (s) { return s.shared.totalRevenue >= 300; } },
  { id: 'neon', name: '霓虹不夜', em: '🌃', bg: '#0f1c33', accent: '#5be3ff', need: '口碑≥4.2', flow: 2, tip: 1, ok: function (s) { return s.shared.rep >= 4.2; } },
  { id: 'dawn', name: '清晨早市', em: '🌅', bg: '#1e2a22', accent: '#ffe08a', need: '经营到第8天', flow: 1, tip: 2, ok: function (s) { return s.scene.day >= 8; } }
];

// 成就图鉴：完成后可领取一次性金币，纯荣誉系统
var ACHIEVEMENTS = [
  { id: 'firstBuck', em: '🌱', name: '第一桶金', desc: '累计营收达到 100', rw: 20, ok: function (s) { return s.shared.totalRevenue >= 100; } },
  { id: 'streetStar', em: '⭐', name: '街边红人', desc: '口碑达到 4.5', rw: 40, ok: function (s) { return s.shared.rep >= 4.5; } },
  { id: 'regularFriend', em: '💌', name: '四方皆熟', desc: '与 3 位常客成为朋友', rw: 40, ok: function (s) { var b = s.shared.bonds || {}; return Object.keys(b).filter(function (k) { return b[k] >= 3; }).length >= 3; } },
  { id: 'perfectTen', em: '🔥', name: '火候大师', desc: '完美出锅累计 10 次', rw: 35, ok: function (s) { return s.shared.perfect >= 10; } },
  { id: 'foodie', em: '🍢', name: '百味齐全', desc: '解锁 8 种小吃', rw: 50, ok: function (s) { return Object.keys(GOODS).filter(function (k) { return s.shared.totalRevenue >= GOODS[k].unlock; }).length >= 8; } },
  { id: 'cityBoss', em: '🏙️', name: '小城掌柜', desc: '开张小城创业场景', rw: 60, ok: function (s) { return !!s.shared.cityUnlocked; } },
  { id: 'clueAll', em: '🔮', name: '匣中旧事', desc: '解开所有神秘线索', rw: 70, ok: function (s) { return (s.shared.clues || 0) >= 50; } },
  { id: 'dayTen', em: '📅', name: '十日不辍', desc: '经营满 10 天', rw: 45, ok: function (s) { return s.scene.day >= 10; } }
];

// ============================================================
// 奖励机制 v6：跨层级成长 + 每日惊喜 + 虚荣展示 + 好友推荐
// 设计约束：
//  1) 层级奖励锚定"经营里程碑"（营收/口碑/完美/天数），奖励玩得好，不奖励挂机。
//  2) 每日惊喜按"连续回访天数"确定性解锁，不做随机付费、不做分享即到账。
//  3) 虚荣称号只读展示，不设付费入口；推荐好友只给"回流补给"，不强制分享。
// ============================================================

// 跨层级成长阶梯：每跨一级给一次性金币 + 永久称号，成就墙/好友榜/战绩卡可展示
var REWARD_TIERS = [
  { id: 0, em: '🌱', name: '街角新摊主', sub: '第一盏灯', need: '开始经营', rw: 0,
    ok: function () { return true; } },
  { id: 1, em: '🔥', name: '火候学徒', sub: '烟火初成', need: '完美出锅 3 次', rw: 25,
    ok: function (s) { return (s.shared.perfect || 0) >= 3; } },
  { id: 2, em: '🏮', name: '夜市熟脸', sub: '有人认得你', need: '累计营收 300', rw: 45,
    ok: function (s) { return (s.shared.totalRevenue || 0) >= 300; } },
  { id: 3, em: '⭐', name: '街坊红人', sub: '回头客多了', need: '口碑 4.2 且 3 位熟客', rw: 70,
    ok: function (s) { var b = s.shared.bonds || {}; return (s.shared.rep || 0) >= 4.2 && Object.keys(b).filter(function (k) { return b[k] >= 3; }).length >= 3; } },
  { id: 4, em: '👑', name: '夜市掌柜', sub: '一条街都认识', need: '累计营收 1200 且 第 10 天', rw: 120,
    ok: function (s) { return (s.shared.totalRevenue || 0) >= 1200 && (s.scene.day || 1) >= 10; } },
  { id: 5, em: '🏆', name: '城角传说', sub: '这条街记住了你', need: '累计营收 3000 且 完美 30 次', rw: 220,
    ok: function (s) { return (s.shared.totalRevenue || 0) >= 3000 && (s.shared.perfect || 0) >= 30; } }
];

// 每日惊喜：按连续回访天数确定性开启（不是随机付费箱，不对分享设门槛）
// 每 3 天一轮回：金币补给 → 线索+金币 → 称号碎片感（金币更多）+ 稀有客人口彩
var SURPRISE_DAYS = [
  { em: '🎁', name: '街坊塞来的红包', text: '收摊时隔壁摊主塞来一个红包', coin: 18 },
  { em: '🔮', name: '木匣里的旧物', text: '匣子缝里掉出一片旧纸，还有几枚零钱', coin: 12, clue: 1 },
  { em: '🌟', name: '熟客的谢礼', text: '常客临走留下一句"明天还来"，压着一张纸币', coin: 30 },
  { em: '🍢', name: '夜市幸运签', text: '抽到一张幸运签，今晚的烟火气格外旺', coin: 24, rep: 0.05 }
];

// 虚荣称号：只读展示，满足"被看见"，不设任何付费或强制分享入口
var VANITY_BADGES = [
  { id: 'tier', em: '👑', name: function (s) { return rewardTier(s).name; }, desc: '当前经营称号' },
  { id: 'combo', em: '⚡', name: function (s) { return '连击纪录 ×' + (s.shared.bestCombo || 0); }, desc: '单晚最高连击', ok: function (s) { return (s.shared.bestCombo || 0) >= 3; } },
  { id: 'profit', em: '💰', name: function (s) { return '单晚净利 ' + Math.round(s.shared.bestProfit || 0); }, desc: '最高单晚净利', ok: function (s) { return (s.shared.bestProfit || 0) > 0; } },
  { id: 'perfect', em: '🔥', name: function (s) { return '完美出锅 ' + (s.shared.perfect || 0) + ' 次'; }, desc: '火候大师之路', ok: function (s) { return (s.shared.perfect || 0) >= 1; } },
  { id: 'ach', em: '🏅', name: function (s) { return '成就 ' + achStats(s).done + '/' + achStats(s).total; }, desc: '图鉴收集度', ok: function (s) { return achStats(s).done > 0; } },
  { id: 'ref', em: '🤝', name: function (s) { return '带来 ' + ((s.shared.ref && s.shared.ref.joined) || 0) + ' 位伙伴'; }, desc: '好友推荐', ok: function (s) { return !!((s.shared.ref && s.shared.ref.joined) || 0); } },
  { id: 'streak', em: '📅', name: function (s) { return '连续回访 ' + (s.shared.streak || 1) + ' 天'; }, desc: '陪伴这个函数', ok: function (s) { return (s.shared.streak || 1) >= 2; } }
];

// 小城创业：解锁后每天可收租，形成长线被动收益（游戏币）
var CITY_SCENES = [
  { id: 'stall', em: '🛒', name: '夜市分摊', cost: 0, income: 0, need: '起始', ok: function () { return true; } },
  { id: 'shop', em: '🏪', name: '街边小店', cost: 300, income: 12, need: '累计营收≥300', ok: function (s) { return s.shared.totalRevenue >= 300; } },
  { id: 'kiosk', em: '🏬', name: '小城连锁档口', cost: 900, income: 35, need: '累计营收≥900', ok: function (s) { return s.shared.totalRevenue >= 900; } }
];
var STALLS = [
  { name: '街角空位', rent: 20, flow: 8, unlock: 0 },
  { name: '学校后门', rent: 45, flow: 14, unlock: 200 },
  { name: '广场入口', rent: 80, flow: 22, unlock: 500 }
];

var TASKS = [
  { id: 'sold', em: '🍜', title: '卖出 6 份小吃', goal: 6, reward: 20 },
  { id: 'perfect', em: '🔥', title: '完美出锅 3 次', goal: 3, reward: 30 },
  { id: 'profit', em: '💰', title: '单晚净赚 80 元', goal: 80, reward: 25 }
];

var REGULARS = [
  { id: 'laozhang', em: '👴', name: '老张头', lines: ['还是老样子，来份家常的。', '我孙女说你这儿的最好吃。'], reward: '老张头成了你的忠实顾客，客流+1' },
  { id: 'xiaomei', em: '👩', name: '小美', lines: ['加班到现在，饿死了～', '今天发了工资，要好好犒劳自己！'], reward: '小美把你推荐给了同事，人缘小涨' },
  { id: 'xiaoming', em: '🧑', name: '明哥', lines: ['辅导班下课，顺路过来。', '给我留一份，老规矩。'], reward: '明哥介绍了学生家长来，回头客增多' },
  { id: 'ayi', em: '👵', name: '李阿姨', lines: ['小伙子，今天生意咋样？', '天冷了，你也早点收摊。'], reward: '李阿姨天天来唠嗑，把你的摊子当成了第二个家' }
];

var RARE = [
  { id: 'foodcritic', em: '🌟', name: '神秘美食达人', bonus: 88, text: '一位美食达人悄悄来尝了一口，说要帮你宣传！' },
  { id: 'nightowl', em: '🎩', name: '深夜的西装客', bonus: 66, text: '一位衣着讲究的客人多付了钱，只说了一句：今晚，谢谢。' },
  { id: 'oldfriend', em: '🎈', name: '多年未见的老同学', bonus: 50, text: '老同学认出了你，走时坚持要多给一份钱。' }
];

var MYSTERY_STORY = [
  { need: 0, title: '上锁的旧木匣', text: '摊子底下压着一只落灰的木匣，锁孔旁刻着：凑齐六片，才配知道这条街的秘密。' },
  { need: 6, title: '第一片 · 泛黄的收据', text: '1998年，夜市西口。有人用一碗热汤救了赶夜路的我。落款只有一个模糊的谢字。' },
  { need: 15, title: '第二片 · 半张旧照片', text: '照片上是同一条街，只是摊位更旧、灯更暗。背面写着：她每天都在等一个人，后来那人真的来了。' },
  { need: 30, title: '第三片 · 摊主的日记', text: '把生意做好，自然会有人替你把故事讲下去。你接过的从来不只是一个摊子。' },
  { need: 50, title: '匣底 · 未寄出的信', text: '给愿意把这行做下去的人——这条街会记得你。' }
];

var STREET_SHIFTS = [
  { em: '🎪', text: '演出散场，人群涌向夜市', delta: 3 },
  { em: '🌧️', text: '飘起小雨，路人加快脚步', delta: -3 },
  { em: '📣', text: '入口广播吆喝，客流被拉过来', delta: 2 },
  { em: '🚓', text: '夜巡经过，人群暂时散开', delta: -2 },
  { em: '🍢', text: '隔壁摊买二送一，抢走客人', delta: -2 }
];

var ERRANDS = [
  { em: '🍢', from: '烤串王', title: '帮忙串 3 串', need: 3, coin: 12, traffic: 1, rep: 0 },
  { em: '🧋', from: '柠檬茶摊', title: '帮忙递 2 次杯', need: 2, coin: 8, traffic: 0, rep: 0 },
  { em: '📦', from: '夜市快递点', title: '代收一个快递', need: 1, coin: 15, traffic: 0, rep: 0 },
  { em: '🎪', from: '广场舞台', title: '帮忙搬 3 箱道具', need: 3, coin: 10, traffic: 2, rep: 0 }
];

// ---- 合伙人：仍是合规的街坊搭伙/帮衬，净利分成、封顶退出 ----
var PARTNER_TIERS = [
  {
    id: 'street', name: '街坊搭伙', em: '🤝', invest: 60, share: 0.20, cap: 90, needText: '随时可搭伙',
    need: function () { return true; }
  },
  {
    id: 'neighbor', name: '邻里帮衬', em: '🧑‍🌾', invest: 120, share: 0.22, cap: 165, needText: '口碑≥3.8 或 累计营收≥500',
    need: function (save) { return save.shared.rep >= 3.8 || save.shared.totalRevenue >= 500; }
  },
  {
    id: 'oldfriend', name: '老友帮衬', em: '🧑‍🤝‍🧑', invest: 200, share: 0.25, cap: 280, needText: '口碑≥4.2 且 清单完成≥3',
    need: function (save) { return save.shared.rep >= 4.2 && lifeDone(save) >= 3; }
  }
];

function defaultSave() {
  var s = {};
  for (var k in DEF_SHARED) {
    var v = DEF_SHARED[k];
    if (Array.isArray(v)) s[k] = v.slice();
    else if (v && typeof v === 'object') { var o = {}; for (var kk in v) o[kk] = v[kk]; s[k] = o; }
    else s[k] = v;
  }
  return { shared: s, scene: { day: 1, stock: [], shelf: 'jianbing', stall: 0, debt: 0 } };
}

function ensureDayState(save) {
  if (!save || !save.shared) return;
  var key = todayKey();
  if (!save.shared.bonds || typeof save.shared.bonds !== 'object' || Array.isArray(save.shared.bonds)) save.shared.bonds = {};
  if (!save.shared.rareMet || !Array.isArray(save.shared.rareMet)) save.shared.rareMet = [];
  if (!save.shared.taskProgress || typeof save.shared.taskProgress !== 'object' || Array.isArray(save.shared.taskProgress)) save.shared.taskProgress = {};
  ['partnerLog', 'listClaimed', 'partners', 'rareMet', 'ownedSkins', 'achClaimed', 'goodsFound', 'history'].forEach(function (k) {
    if (!Array.isArray(save.shared[k])) save.shared[k] = [];
  });
  if ((save.shared.ownedSkins || []).indexOf('default') < 0) save.shared.ownedSkins.push('default');
  if (!save.shared.activeSkin) save.shared.activeSkin = 'default';
  if (typeof save.shared.cityUnlocked !== 'boolean') save.shared.cityUnlocked = false;
  if (!isFinite(Number(save.shared.cityIncome))) save.shared.cityIncome = 0;
  if (save.shared.taskDay !== key) {
    save.shared.taskDay = key;
    save.shared.taskProgress = {};
    save.shared.taskClaimed = false;
  }
}

function loadSave() {
  var d = Store.read();
  if (!d || typeof d !== 'object') return defaultSave();
  var def = defaultSave();
  if (!d.shared || typeof d.shared !== 'object') d.shared = def.shared;
  if (!d.scene || typeof d.scene !== 'object') d.scene = def.scene;

  for (var k in DEF_SHARED) {
    if (d.shared[k] === undefined || d.shared[k] === null) {
      var v = DEF_SHARED[k];
      if (Array.isArray(v)) d.shared[k] = v.slice();
      else if (v && typeof v === 'object') { var o = {}; for (var kk in v) o[kk] = v[kk]; d.shared[k] = o; }
      else d.shared[k] = v;
    } else if (Array.isArray(DEF_SHARED[k]) && !Array.isArray(d.shared[k])) {
      d.shared[k] = [];
    }
  }
  ['coins', 'rep', 'totalRevenue', 'totalCustomers', 'perfect', 'clues', 'chapter', 'streak'].forEach(function (key) {
    var n = Number(d.shared[key]);
    if (!isFinite(n)) n = DEF_SHARED[key];
    d.shared[key] = n;
  });

  if (!Array.isArray(d.scene.stock)) d.scene.stock = [];
  d.scene.stock = d.scene.stock.filter(function (b) {
    return b && GOODS[b.key] && Number(b.qty) > 0;
  }).map(function (b) {
    var g = GOODS[b.key];
    var buyDay = Number(b.buyDay) > 0 ? Number(b.buyDay) : 1;
    var expireDay = Number(b.expireDay) > 0 ? Number(b.expireDay) : buyDay + g.keep;
    return { key: b.key, qty: Number(b.qty), buyDay: buyDay, expireDay: expireDay };
  });
  if (!GOODS[d.scene.shelf]) d.scene.shelf = 'jianbing';
  if (!GOODS[d.scene.shelf] || d.shared.totalRevenue < GOODS[d.scene.shelf].unlock) d.scene.shelf = 'jianbing';
  if (!STALLS[d.scene.stall]) d.scene.stall = 0;
  if (!isFinite(Number(d.scene.day)) || Number(d.scene.day) < 1) d.scene.day = 1;
  else d.scene.day = Number(d.scene.day);
  if (!isFinite(Number(d.scene.debt)) || Number(d.scene.debt) < 0) d.scene.debt = 0;
  else d.scene.debt = Number(d.scene.debt);

  if (!d.shared.cloudSlotId) {
    try {
      d.shared.cloudSlotId = 'ysy_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    } catch (e) { d.shared.cloudSlotId = 'ysy_local'; }
  }
  // v6 奖励机制字段：老存档平滑迁移，不丢任何既有进度
  if (!d.shared.ref || typeof d.shared.ref !== 'object') d.shared.ref = {};
  ['code', 'invited', 'joined', 'day', 'rewardDay'].forEach(function (k) {
    if (d.shared.ref[k] === undefined || d.shared.ref[k] === null) d.shared.ref[k] = DEF_SHARED.ref[k];
  });
  d.shared.ref.invited = Number(d.shared.ref.invited) || 0;
  d.shared.ref.joined = Number(d.shared.ref.joined) || 0;
  if (!Array.isArray(d.shared.tierClaimed)) d.shared.tierClaimed = [];
  if (!Array.isArray(d.shared.badges)) d.shared.badges = [];
  if (!Array.isArray(d.shared.lastBadges)) d.shared.lastBadges = [];
  if (!Array.isArray(d.shared.surpriseLog)) d.shared.surpriseLog = [];
  if (!d.shared.highlight || typeof d.shared.highlight !== 'object') d.shared.highlight = {};
  ['bestCombo', 'bestProfit', 'chestStreak'].forEach(function (k) {
    d.shared[k] = Number(d.shared[k]) || 0;
  });
  // 深度人性化·真实案例版：写实系统字段迁移（隐性成长永不清零）
  if (d.shared.emotion == null || !isFinite(Number(d.shared.emotion))) d.shared.emotion = 60;
  d.shared.emotion = clamp(Number(d.shared.emotion), 0, 100);
  if (!d.shared.growth || typeof d.shared.growth !== 'object') d.shared.growth = {};
  ['experience', 'craft', 'empathy', 'resilience', 'perspective'].forEach(function (k) {
    d.shared.growth[k] = Math.max(0, Number(d.shared.growth[k]) || 0);
  });
  if (!d.shared.mode) d.shared.mode = 'formal';
  ['fatigueDays', 'lossDays', 'reviewDays', 'fixedCostPaid', 'perspective'].forEach(function (k) {
    d.shared[k] = Number(d.shared[k]) || 0;
  });
  if (!Array.isArray(d.shared.buffs)) d.shared.buffs = [];
  if (!Array.isArray(d.shared.dayEvents)) d.shared.dayEvents = [];
  if (!Array.isArray(d.shared.storyMet)) d.shared.storyMet = [];
  if (!d.shared.lifeView || typeof d.shared.lifeView !== 'object') d.shared.lifeView = { days: 0, events: 0, good: 0, bad: 0, gov: 0, stories: 0 };
  ['days', 'events', 'good', 'bad', 'gov', 'stories'].forEach(function (k) {
    d.shared.lifeView[k] = Math.max(0, Number(d.shared.lifeView[k]) || 0);
  });
  if (!d.shared.kindBalance || typeof d.shared.kindBalance !== 'object') d.shared.kindBalance = { good: 0, bad: 0, gov: 0 };
  ['good', 'bad', 'gov'].forEach(function (k) {
    d.shared.kindBalance[k] = Math.max(0, Number(d.shared.kindBalance[k]) || 0);
  });
  d.shared.saveVersion = 8;
  ensureDayState(d);
  return d;
}
function saveSave(d) { if (d) ensureDayState(d); Store.write(d); }

// ---- 商品解锁与 FIFO 库存：按 buyDay 先进先出核销 ----
function isGoodUnlocked(save, key) {
  var g = GOODS[key];
  return !!g && save.shared.totalRevenue >= g.unlock;
}
function addStock(save, key, qty) {
  var g = GOODS[key]; if (!g || !isGoodUnlocked(save, key)) return false;
  var cost = g.cost * qty;
  if (save.shared.coins < cost) return false;
  save.shared.coins -= cost;
  save.scene.stock.push({ key: key, qty: qty, buyDay: save.scene.day, expireDay: save.scene.day + g.keep });
  return true;
}
function stockQty(save, key) {
  var n = 0; save.scene.stock.forEach(function (b) { if (b.key === key && b.qty > 0) n += b.qty; });
  return n;
}
function consumeStock(save, key) {
  var batches = save.scene.stock.filter(function (b) { return b.key === key && b.qty > 0; })
                                .sort(function (a, b) { return a.buyDay - b.buyDay; });
  if (!batches.length) return null;
  var b = batches[0]; b.qty -= 1;
  return { key: key, cost: GOODS[key].cost, buyDay: b.buyDay };
}
function expireStock(save) {
  var lost = 0, kept = [];
  save.scene.stock.forEach(function (b) {
    if (b.expireDay < save.scene.day && b.qty > 0) lost += b.qty; else kept.push(b);
  });
  save.scene.stock = kept;
  return lost;
}

// ---- 口碑、线索、每日任务 ----
function applyRep(save, delta) {
  if (!delta) return save.shared.rep;
  save.shared.rep = round1(clamp(save.shared.rep + delta, 1, 5));
  return save.shared.rep;
}
function addClue(save, n) {
  var add = Math.max(0, Number(n) || 1);
  save.shared.clues = Math.max(0, Number(save.shared.clues) || 0) + add;
  return save.shared.clues;
}
function mysteryStage(save) {
  var st = 0;
  for (var i = 0; i < MYSTERY_STORY.length; i++) if ((save.shared.clues || 0) >= MYSTERY_STORY[i].need) st = i;
  return st;
}
function updateTask(save, id, value) {
  ensureDayState(save);
  if (save.shared.taskClaimed) return;
  var n = Math.max(0, Number(value) || 0);
  save.shared.taskProgress[id] = Math.max(save.shared.taskProgress[id] || 0, n);
}
function taskProgress(save, id) {
  ensureDayState(save);
  return save.shared.taskProgress[id] || 0;
}
function tasksAllDone(save) {
  ensureDayState(save);
  return TASKS.every(function (t) { return taskProgress(save, t.id) >= t.goal; });
}
function claimTasks(save) {
  ensureDayState(save);
  if (save.shared.taskClaimed || !tasksAllDone(save)) return 0;
  var reward = TASKS.reduce(function (sum, t) { return sum + t.reward; }, 0);
  save.shared.taskClaimed = true;
  save.shared.coins += reward;
  return reward;
}

// ---- 常客羁绊与稀有客人 ----
function addBond(save, regularId) {
  ensureDayState(save);
  var r = null;
  for (var i = 0; i < REGULARS.length; i++) if (REGULARS[i].id === regularId) r = REGULARS[i];
  if (!r) return null;
  save.shared.bonds[r.id] = (save.shared.bonds[r.id] || 0) + 1;
  if (save.shared.bonds[r.id] === 3) {
    applyRep(save, 0.3);
    addClue(save, 1);
    return r;
  }
  return null;
}
function maybeRare(save, customer) {
  if (!save || Math.random() >= 0.07) return null;
  var r = RARE[Math.floor(Math.random() * RARE.length)];
  customer.rare = r;
  customer.bonus = r.bonus;
  if (save.shared.rareMet.indexOf(r.id) < 0) {
    save.shared.rareMet.push(r.id);
    addClue(save, 1);
  }
  return r;
}

// ---- 合伙人分成 ----
function activePartners(save) {
  return (save.shared.partners || []).filter(function (p) { return !p.retired && (p.paid || 0) < (PARTNER_TIER(p.type).cap); });
}
function PARTNER_TIER(id) {
  for (var i = 0; i < PARTNER_TIERS.length; i++) if (PARTNER_TIERS[i].id === id) return PARTNER_TIERS[i];
  return PARTNER_TIERS[0];
}
function partnerUnlocked(save, id) {
  var def = PARTNER_TIER(id);
  var hasSame = activePartners(save).some(function (p) { return p.type === id; });
  return !!def.need(save) && !hasSame && activePartners(save).length < 3;
}
function takePartner(save, id) {
  var def = PARTNER_TIER(id);
  if (!partnerUnlocked(save, id)) return null;
  save.shared.coins += def.invest;
  save.shared.partners.push({ type: id, paid: 0, retired: false });
  save.shared.partnerLog = save.shared.partnerLog || [];
  save.shared.partnerLog.push({ day: save.scene.day, type: id, invest: def.invest, share: def.share, cap: def.cap });
  return def;
}
function settlePartners(save, profit) {
  var notes = [];
  (save.shared.partners || []).slice().forEach(function (p) {
    if (p.retired) return;
    var def = PARTNER_TIER(p.type);
    var share = profit > 0 ? Math.max(0, Math.round(profit * def.share)) : 0;
    p.paid = (p.paid || 0) + share;
    if (share > 0) {
      save.shared.coins -= share;
      notes.push(def.name + ' 分走 ' + share + ' 元');
    }
    if (p.paid >= def.cap) {
      p.retired = true;
      notes.push(def.name + ' 分够 ' + def.cap + ' 元，已体面退出');
    }
  });
  return notes;
}

// ---- 人生清单（保留旧数字索引兼容） ----
var LIFE_LIST = [
  { id: 'first', t: '第一次备货', em: '🌱', rw: 15, ok: function (s) { return s.scene.stock.length > 0 || s.shared.totalCustomers > 0; } },
  { id: 'firstSale', t: '摆出第一个摊', em: '🛒', rw: 15, ok: function (s) { return s.shared.totalCustomers >= 1; } },
  { id: 'sold10', t: '接待 10 位客人', em: '🍜', rw: 20, ok: function (s) { return s.shared.totalCustomers >= 10; } },
  { id: 'perfect5', t: '完美出锅 5 次', em: '🔥', rw: 25, ok: function (s) { return s.shared.perfect >= 5; } },
  { id: 'earn100', t: '累计营收破 100', em: '💰', rw: 20, ok: function (s) { return s.shared.totalRevenue >= 100; } },
  { id: 'earn500', t: '累计营收破 500', em: '🏆', rw: 40, ok: function (s) { return s.shared.totalRevenue >= 500; } },
  { id: 'day5', t: '连续经营 5 天', em: '📅', rw: 30, ok: function (s) { return s.scene.day >= 5; } },
  { id: 'bond1', t: '和一位常客成为朋友', em: '💌', rw: 35, ok: function (s) { var b = s.shared.bonds || {}; return Object.keys(b).some(function (k) { return b[k] >= 3; }); } },
  { id: 'rare1', t: '遇见第一位稀有客人', em: '🌟', rw: 25, ok: function (s) { return (s.shared.rareMet || []).length >= 1; } },
  { id: 'clue6', t: '拼出第一段匣中往事', em: '🔮', rw: 35, ok: function (s) { return (s.shared.clues || 0) >= 6; } },
  { id: 'rep5', t: '口碑达到满星', em: '⭐', rw: 60, ok: function (s) { return s.shared.rep >= 5; } }
];
function lifeDone(save) { return LIFE_LIST.filter(function (it) { return it.ok(save); }).length; }
function claimLife(save) {
  var gained = 0, notes = [];
  if (!save.shared.listClaimed) save.shared.listClaimed = [];
  LIFE_LIST.forEach(function (it, i) {
    var byId = save.shared.listClaimed.indexOf(it.id) >= 0;
    var byIndex = save.shared.listClaimed.indexOf(i) >= 0;
    if (it.ok(save) && !byId && !byIndex) {
      save.shared.listClaimed.push(it.id);
      save.shared.coins += it.rw; gained += it.rw;
      notes.push(it.em + '「' + it.t + '」+' + it.rw);
    }
  });
  return { gained: gained, notes: notes };
}

// ---- 火候判定：口碑越高、手艺成长越高，稳定区越宽（tol 为手艺容差，按百分点折算）----
function judgeCook(pos, rep, tol) {
  var r = Number(rep) || 3;
  var t = Math.max(0, Math.min(10, Number(tol) || 0)); // 手艺容差百分点，最多 ±10
  var goodLo = (r >= 4 ? 35 : (r < 2.5 ? 41 : 38)) - t;
  var goodHi = (r >= 4 ? 65 : (r < 2.5 ? 59 : 62)) + t;
  var perfectLo = (r >= 4 ? 46 : 47) - t;
  var perfectHi = (r >= 4 ? 54 : 53) + t;
  if (pos >= perfectLo && pos <= perfectHi) return { quality: 'perfect', mult: 1.35, perfect: true };
  if (pos >= goodLo && pos <= goodHi) return { quality: 'good', mult: 1.0, perfect: false };
  return { quality: 'fail', mult: 0, perfect: false };
}

// ---- 顾客与街况 ----
function makeCustomer(patienceMs, now, save) {
  var c = { born: now, deadline: now + patienceMs, served: false, want: 'jianbing', regular: null, rare: null, bonus: 0, line: '' };
  var keys = Object.keys(GOODS).filter(function (k) { return !save || isGoodUnlocked(save, k); });
  var roll = Math.random(), acc = 0;
  for (var i = 0; i < keys.length; i++) {
    acc += (GOODS[keys[i]].wantRate || 0.1);
    if (roll <= acc || i === keys.length - 1) { c.want = keys[i]; break; }
  }
  if (save) {
    if (Math.random() < 0.24) {
      var r = REGULARS[Math.floor(Math.random() * REGULARS.length)];
      c.regular = r;
      c.line = r.lines[Math.floor(Math.random() * r.lines.length)];
    }
    maybeRare(save, c);
  }
  return c;
}
function customerPatiencePct(c, now) { return Math.max(0, Math.min(100, (c.deadline - now) / (c.deadline - c.born) * 100)); }
function rollStreetShift() {
  var s = STREET_SHIFTS[Math.floor(Math.random() * STREET_SHIFTS.length)];
  return { em: s.em, text: s.text, delta: s.delta };
}
function startErrand() {
  var def = ERRANDS[Math.floor(Math.random() * ERRANDS.length)];
  return { def: def, progress: 0, deadline: Date.now() + 14000 };
}
function doErrand(save, errand) {
  if (!errand || !errand.def) return { done: false };
  errand.progress++;
  if (errand.progress < errand.def.need) return { done: false, progress: errand.progress };
  var d = errand.def;
  return { done: true, coin: d.coin || 0, traffic: d.traffic || 0, rep: d.rep || 0, from: d.from };
}

// ---- 结算（源自原版 endDay） ----
function settleDay(save, stall, stats) {
  ensureDayState(save);
  stats = stats || {};
  var gross = stats.gross || 0;
  var rent = stall.rent;
  var foodCost = stats.foodCost || 0;
  var tips = stats.tips || 0;
  var errandCoin = stats.errand || 0;
  // 人间纪实：真实生存恒成本（无论盈亏恒定）+ 环境随机波动（个人可控，环境不可控）
  var fixedCost = fixedDailyCost();
  var env = rollEnvironment();
  var envDelta = Math.round((gross - foodCost) * env);
  var profit = Math.round((gross - rent - foodCost - fixedCost + tips + errandCoin) * (1 + env));
  stats.played = true;
  stats.fixedCost = fixedCost; stats.environment = env; stats.envDelta = envDelta;
  // 每日人性事件（正负强制对冲）并结算其影响
  var humanEvents = rollHumanEvents(save);
  var humanImpact = applyHumanEvents(save, humanEvents, stats);
  profit += humanImpact.coinDelta;

  updateTask(save, 'sold', stats.sold || 0);
  updateTask(save, 'perfect', stats.perfect || 0);
  updateTask(save, 'profit', profit);

  var repBefore = save.shared.rep;
  var repDelta = (stats.good || 0) * 0.05 + (stats.perfect || 0) * 0.05 + (stats.errandRep || 0)
               - (stats.bad || 0) * 0.12 - (stats.lost || 0) * 0.08;
  if (profit > 0) repDelta += 0.05;
  applyRep(save, repDelta);

  var partnerNotes = settlePartners(save, profit);
  var life = claimLife(save);
  var taskReward = claimTasks(save);

  save.shared.coins += profit - (stats.paidOut || 0) + taskReward;
  save.shared.totalRevenue += gross;
  save.shared.totalCustomers += stats.sold || 0;
  save.shared.perfect += stats.perfect || 0;

  var debtPaid = 0;
  if ((save.scene.debt || 0) > 0) {
    debtPaid = Math.min(save.scene.debt, save.shared.coins);
    save.shared.coins -= debtPaid;
    save.scene.debt = round1(save.scene.debt - debtPaid);
  }

  var mysteryBefore = mysteryStage(save);
  if (profit > 0 && save.shared.clueDay !== todayKey()) {
    save.shared.clueDay = todayKey();
    addClue(save, 1);
  }
  // 记录经营日报（在 day+1 之前，记的是刚结束的这一天）
  pushHistory(save, { profit: profit, gross: gross, sold: stats.sold || 0, perfect: stats.perfect || 0 });
  save.scene.day += 1;
  // 奖励结算：破纪录 / 层级突破 / 新徽章，全部幂等，只在本函数内改存档
  var record = updateHighlight(save, stats, profit);
  // 人间纪实：隐性成长永久累计 + 恒成本记录 + BUFF刷新 + 情绪复盘保底
  var growthAfter = settleGrowth(save, stats, profit);
  save.shared.fixedCostPaid = (save.shared.fixedCostPaid || 0) + fixedCost;
  save.shared.reviewDays = (save.shared.reviewDays || 0) + 1;
  if (!save.shared.lifeView) save.shared.lifeView = { days: 0, events: 0, good: 0, bad: 0, gov: 0, stories: 0 };
  save.shared.lifeView.days = (save.shared.lifeView.days || 0) + 1;
  applyEmotion(save, 8); // 每日坚持复盘 +8（保底成长）
  var buffs = refreshBuffs(save, stats, profit);
  var tierGain = checkTiers(save);
  var badgeInfo = refreshBadges(save);
  var baseRes = {
    gross: gross, rent: rent, foodCost: foodCost, tips: tips, errand: errandCoin,
    profit: profit, partnerNotes: partnerNotes, life: life, taskReward: taskReward,
    repBefore: repBefore, repDelta: round1(save.shared.rep - repBefore), debtPaid: debtPaid,
    mysteryStage: mysteryStage(save), mysteryUnlocked: mysteryStage(save) > mysteryBefore,
    sold: stats.sold || 0, perfect: stats.perfect || 0, lost: stats.lost || 0,
    fixedCost: fixedCost, environment: env, envDelta: envDelta,
    humanEvents: humanEvents, growth: growthAfter, buffs: buffs,
    record: record, tierGain: tierGain, newBadges: badgeInfo.fresh, tier: tierGain.tier
  };
  baseRes.review = buildReview(save, baseRes, stats);
  save.shared.lastReview = { date: todayKey(), profit: profit, title: baseRes.review.title };
  saveSave(save);
  return baseRes;
}

// ---- 皮肤：解锁 + 切换，只影响视觉与少量客流/小费 ----
function skinById(id) {
  for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
  return SKINS[0];
}
function activeSkin(save) { return skinById(save && save.shared && save.shared.activeSkin); }
function skinUnlocked(save, id) {
  var s = skinById(id);
  return (save.shared.ownedSkins || []).indexOf(id) >= 0 || s.ok(save);
}
function unlockSkin(save, id) {
  var s = skinById(id);
  if ((save.shared.ownedSkins || []).indexOf(id) >= 0) return { ok: false, msg: '已拥有' };
  if (!s.ok(save)) return { ok: false, msg: '未满足：' + s.need };
  save.shared.ownedSkins.push(id);
  save.shared.activeSkin = id;
  saveSave(save);
  return { ok: true, skin: s };
}
function setSkin(save, id) {
  if (!skinUnlocked(save, id)) return false;
  save.shared.activeSkin = id; saveSave(save); return true;
}
function skinFlowBonus(save) { return activeSkin(save).flow || 0; }
function skinTipBonus(save) { return activeSkin(save).tip || 0; }

// ---- 成就图鉴 ----
function achDone(save, id) {
  var a = null;
  for (var i = 0; i < ACHIEVEMENTS.length; i++) if (ACHIEVEMENTS[i].id === id) a = ACHIEVEMENTS[i];
  return !!a && a.ok(save);
}
function claimAch(save) {
  ensureDayState(save);
  var gained = 0, got = [];
  ACHIEVEMENTS.forEach(function (a) {
    if (a.ok(save) && save.shared.achClaimed.indexOf(a.id) < 0) {
      save.shared.achClaimed.push(a.id);
      save.shared.coins += a.rw; gained += a.rw; got.push(a.em + a.name);
    }
  });
  saveSave(save);
  return { gained: gained, got: got };
}
function achStats(save) {
  var done = ACHIEVEMENTS.filter(function (a) { return a.ok(save); }).length;
  return { done: done, total: ACHIEVEMENTS.length };
}

// ============================================================
// 奖励引擎：以下函数纯数据计算，渲染层只调用、不自行改存档
// ============================================================

// 当前已达最高层级（只看条件，不看是否已领，便于展示"你已经是掌柜"）
function rewardTier(save) {
  var t = REWARD_TIERS[0];
  for (var i = 0; i < REWARD_TIERS.length; i++) {
    if (REWARD_TIERS[i].ok(save)) t = REWARD_TIERS[i];
  }
  return t;
}
function nextTier(save) {
  var cur = rewardTier(save);
  return REWARD_TIERS[cur.id + 1] || null;
}
// 层级进度（0~100），给"还差一点"的推动感
function tierProgress(save) {
  var cur = rewardTier(save), next = nextTier(save);
  if (!next) return { cur: cur, next: null, pct: 100, text: '已登顶 · 城角传说' };
  var pct = 0, text = '';
  if (next.id === 1) { pct = Math.min(100, (save.shared.perfect || 0) / 3 * 100); text = '完美出锅 ' + Math.min(3, save.shared.perfect || 0) + '/3'; }
  else if (next.id === 2) { pct = Math.min(100, (save.shared.totalRevenue || 0) / 300 * 100); text = '累计营收 ' + Math.round(Math.min(300, save.shared.totalRevenue || 0)) + '/300'; }
  else if (next.id === 3) {
    var b = save.shared.bonds || {}, friends = Object.keys(b).filter(function (k) { return b[k] >= 3; }).length;
    pct = Math.min(100, Math.min((save.shared.rep || 0) / 4.2, friends / 3) * 100);
    text = '口碑 ' + (save.shared.rep || 0).toFixed(1) + '/4.2 · 熟客 ' + friends + '/3';
  } else if (next.id === 4) { pct = Math.min(100, Math.min((save.shared.totalRevenue || 0) / 1200, (save.scene.day || 1) / 10) * 100); text = '营收 ' + Math.round(Math.min(1200, save.shared.totalRevenue || 0)) + '/1200 · 第' + Math.min(10, save.scene.day || 1) + '/10天'; }
  else if (next.id === 5) { pct = Math.min(100, Math.min((save.shared.totalRevenue || 0) / 3000, (save.shared.perfect || 0) / 30) * 100); text = '营收 ' + Math.round(Math.min(3000, save.shared.totalRevenue || 0)) + '/3000 · 完美 ' + Math.min(30, save.shared.perfect || 0) + '/30'; }
  return { cur: cur, next: next, pct: Math.round(pct), text: text };
}
// 领取所有"已达但未领"的层级奖励；结算与首页都会调用，幂等
function checkTiers(save) {
  var gained = 0, got = [];
  for (var i = 0; i < REWARD_TIERS.length; i++) {
    var t = REWARD_TIERS[i];
    if (t.ok(save) && (save.shared.tierClaimed || []).indexOf(t.id) < 0) {
      save.shared.tierClaimed.push(t.id);
      save.shared.coins += t.rw; gained += t.rw;
      got.push(t.em + t.name + (t.rw ? ' +' + t.rw : ''));
      save.shared.tier = Math.max(save.shared.tier || 0, t.id);
    }
  }
  if (got.length) saveSave(save);
  return { gained: gained, got: got, tier: rewardTier(save) };
}
// 每日惊喜：按连续回访取模，确定性；每天仅一次，跟是否分享无关
function claimSurprise(save) {
  var key = todayKey();
  if (save.shared.chestDay === key) return { ok: false, msg: '今天的惊喜已经领过啦，明天再来' };
  save.shared.chestDay = key;
  save.shared.chestStreak = (save.shared.chestStreak || 0) + 1;
  var idx = (save.shared.chestStreak - 1) % SURPRISE_DAYS.length;
  var box = SURPRISE_DAYS[idx];
  save.shared.coins += box.coin;
  if (box.clue) addClue(save, box.clue);
  if (box.rep) applyRep(save, box.rep);
  if (!Array.isArray(save.shared.surpriseLog)) save.shared.surpriseLog = [];
  save.shared.surpriseLog.push({ date: key, name: box.name, coin: box.coin });
  if (save.shared.surpriseLog.length > 20) save.shared.surpriseLog = save.shared.surpriseLog.slice(-20);
  saveSave(save);
  return { ok: true, em: box.em, name: box.name, text: box.text, coin: box.coin, clue: box.clue || 0, streak: save.shared.chestStreak };
}
function surpriseReady(save) { return save.shared.chestDay !== todayKey(); }

// 虚荣展示：计算当前点亮的徽章，并检测"本结算新点亮了哪些"
function refreshBadges(save) {
  var list = [];
  VANITY_BADGES.forEach(function (b) {
    if (!b.ok || b.ok(save)) list.push({ id: b.id, em: b.em, name: (typeof b.name === 'function' ? b.name(save) : b.name), desc: b.desc });
  });
  var prev = (save.shared.badges || []).map(function (x) { return typeof x === 'string' ? x : x.id; });
  var fresh = list.filter(function (x) { return prev.indexOf(x.id) < 0 && prev.length > 0; });
  save.shared.lastBadges = fresh;
  save.shared.badges = list.map(function (x) { return x.id; });
  return { list: list, fresh: fresh };
}
// 高光时刻：结算时记录最佳纪录，给"打破纪录"的惊喜
function updateHighlight(save, stats, profit) {
  var h = save.shared.highlight || {};
  var rec = { combo: false, profit: false };
  if ((stats.comboMax || 0) > (save.shared.bestCombo || 0)) { save.shared.bestCombo = stats.comboMax || 0; rec.combo = true; }
  if ((profit || 0) > (save.shared.bestProfit || 0)) { save.shared.bestProfit = Math.round(profit || 0); rec.profit = true; }
  save.shared.highlight = h;
  return rec;
}

// 好友推荐：只记录来源与"回流补给"，绝不分享即到账、绝不强制分享
function recordReferral(save, params) {
  params = params || {};
  var ref = save.shared.ref;
  var code = String(params.inviter || params.ref || params.from || '').slice(0, 64);
  var self = save.shared.cloudSlotId || '';
  var out = { matched: false, code: code, inviter: false };
  if (code && code !== self && code !== 'share' && code !== 'direct') {
    if (!ref.code) { ref.code = code; ref.joined = (ref.joined || 0) + 1; out.matched = true; }
    out.inviter = true;
  }
  if (params.ref === 'friend' || code === 'friend') out.inviter = true;
  saveSave(save);
  return out;
}
// 推荐好友试玩带来的"结伴补给"：被推荐人回访达标后每天领一次，与推荐人现世回报脱钩（合规）
function claimRefReward(save) {
  var ref = save.shared.ref || {};
  var key = todayKey();
  if (!ref.code || ref.rewardDay === key) return { ok: false, msg: '暂无结伴补给' };
  if ((save.shared.streak || 1) < 2 && (save.scene.day || 1) < 2) return { ok: false, msg: '回访或经营满 2 天后可领结伴补给' };
  ref.rewardDay = key;
  var coin = 15 + Math.min(15, (ref.joined || 1) * 3);
  save.shared.coins += coin;
  saveSave(save);
  return { ok: true, coin: coin, msg: '结伴补给 +' + coin + ' 元（好友推荐奖励，无需分享）' };
}
function myRefCode(save) {
  ensureSlot(save);
  return save.shared.cloudSlotId || '';
}
// 战绩卡：把虚荣展示变成可复制的炫耀文案（不自动发，不诱导分享）
function battleCard(save) {
  var tier = rewardTier(save);
  var tags = refreshBadges(save).list.slice(0, 4).map(function (x) { return x.em + x.name; }).join(' · ');
  return [
    '【' + CONFIG.GAME_NAME + ' · 我的夜市战绩卡】',
    tier.em + ' ' + tier.name + '（' + tier.sub + '）',
    '累计营收 ' + Math.round(save.shared.totalRevenue || 0) + ' · 第 ' + (save.scene.day || 1) + ' 天 · 口碑 ' + (save.shared.rep || 3).toFixed(1),
    '最佳纪录：' + tags,
    '连续回访 ' + (save.shared.streak || 1) + ' 天 · 带来伙伴 ' + ((save.shared.ref && save.shared.ref.joined) || 0) + ' 位',
    '我的推荐码：' + myRefCode(save) + '（朋友进游戏填它，双方都有结伴补给）'
  ].join('\n');
}

// ============================================================
// 人间纪实版 v7：写实励志内核
// 内核：努力未必立刻盈利，但隐性成长永久累计；人间有刁难更有善意；
//       低谷是迭代契机；合规经营、顺势而为、日日复盘。
// 全部为本地数值与文案，不涉及真实货币、充值、概率付费。
// ============================================================

// A级·人间善意 / B级·人间现实 / C级·城市治理（正负强制对冲，_write）
var HUMAN_EVENTS = [
  { id: 'a_change', kind: 'good', em: '💰', title: '顾客多给钱', story: '深夜收摊前，顾客看你疲惫，笑着多留了钱：『不用找了，早点休息。』', review: '总有人看见你的熬夜与坚守；平凡善意，是人间烟火里最暖的光。', coin: 6, emotion: 15, empathy: 6, rep: 0.02 },
  { id: 'a_defend', kind: 'good', em: '🤝', title: '熟客解围', story: '遇到无端挑剔，老熟客替你说了几句公道话。', review: '真诚待人终得人心，善意互换是小微经营最稳的长期格局。', emotion: 12, empathy: 5, rep: 0.03, clearBad: 1 },
  { id: 'a_cheer', kind: 'good', em: '💬', title: '路人鼓励', story: '冷清的摊位前，有人停下说『加油，慢慢来，谁都有难的时候。』', review: '普通人照亮普通人，是城市最温柔的力量；一句鼓励，足以撑过一个夜晚。', emotion: 12, resilience: 5 },
  { id: 'a_neighbor', kind: 'good', em: '🍢', title: '同行互助', story: '隔壁摊主提醒你天气，还借来一把备用伞。', review: '摒弃内卷内耗，抱团共生、良性竞争，才是基层创业者真正的成熟。', emotion: 8, empathy: 4, lossReduce: 1 },
  { id: 'a_student', kind: 'good', em: '🎒', title: '学生包容', story: '轻微瑕疵被学生温柔包容，还耐心等你出锅。', review: '青春纯粹、人间温柔；被理解的那一刻，疲惫也会变轻。', emotion: 8, rep: 0.02 },
  { id: 'b_picky', kind: 'bad', em: '😤', title: '无端挑剔', story: '菜品没问题，却有人刻意找茬压价，把你忙到手忙脚乱。', review: '经营无法取悦所有人；接纳参差、守住品质，是创业者修炼格局的必修课。', emotion: -8, coin: -4, empathy: 2, resilience: 5, rep: -0.02 },
  { id: 'b_pricewar', kind: 'bad', em: '🏷️', title: '同行恶意竞争', story: '隔壁恶意压价抢客，还传出几句难听的话，人流被分走一批。', review: '低端竞争拼价格，高阶经营拼品质、拼创新、拼口碑；委屈之后仍要走正路。', emotion: -6, flow: -0.12, resilience: 6 },
  { id: 'b_weather', kind: 'bad', em: '🌧️', title: '突发天气亏损', story: '一场急雨说来就来，备好的食材没能卖完。', review: '市场无常、风险永存；精细化预判、柔性备货，是普通人抗风险的真本事。', emotion: -12, coin: -12, resilience: 8 },
  { id: 'b_taster', kind: 'bad', em: '🍡', title: '路人白嫖', story: '有人尝了几串，笑着摆手走开，只留下空空的签子。', review: '小有得失，方成格局；不计微利之失，才看得见长久之路。', emotion: -4, coin: -3, empathy: 2 },
  { id: 'b_fatigue', kind: 'bad', em: '😵', title: '深夜疲惫失误', story: '太累了，火候差了那么一点，一份出品重做。', review: '奋斗不是硬扛；张弛有度、自我调节，才是长期创业的真智慧。', emotion: -6, coin: -5, resilience: 5 },
  { id: 'c_check', kind: 'gov', em: '📋', title: '文明合规巡查', story: '摊位整洁、证照齐全，巡查给了肯定。', review: '合规是底线，也是小微经营最稳的底气。', emotion: 4, rep: 0.03 },
  { id: 'c_limit', kind: 'gov', em: '🚧', title: '路段临时限流', story: '路段临时管控，今晚客流少了一些。', review: '顺势而为、灵活调整，是基层业态的生存智慧。', emotion: -3, flow: -0.1, resilience: 4 },
  { id: 'c_opt', kind: 'gov', em: '✨', title: '夜市秩序优化', story: '摊位规划更合理，长期客流更稳了。', review: '环境变好，踏实经营的人终会被看见。', emotion: 5, flow: 0.06 }
];

// 熟客故事库：每个熟客一段真实主义故事与专属增益
var REGULAR_STORIES = [
  { id: 'night_worker', em: '🌃', name: '夜班奋斗青年', story: '你守人间烟火，我守城市灯火，平凡坚守皆是不凡奋斗。', buff: '经营心态加成', emotion: 3 },
  { id: 'veteran', em: '🧭', name: '资深创业摊主', story: '摆摊不是将就糊口，是微型创业。不固化思维、持续微调迭代，方能长久。', buff: '降低失误·提升预判', craft: 2 },
  { id: 'server', em: '🛠️', name: '基层服务工作者', story: '诚信、踏实、用心，是小微创业者最朴素的担当。', buff: '口碑长期稳步提升', rep: 0.02 },
  { id: 'student', em: '📚', name: '青年创业大学生', story: '创业不靠天赋，靠复盘、靠坚持、靠日日迭代。', buff: '解锁新思路·小幅引流', flow: 0.04 },
  { id: 'craftsman', em: '🔪', name: '市井手艺人', story: '小摊位亦有大格局，品质立身、细节立根。', buff: '出品品质大幅提升', craft: 3 },
  { id: 'laborer', em: '👷', name: '奔波一线劳动者', story: '所有盈利都是日复一日精进的结果。', buff: '稳定客流·降低突发亏损', resilience: 2 },
  { id: 'recorder', em: '📷', name: '城市纪实记录者', story: '记录你的低谷、你的坚持、你的复盘革新——普通人的奋斗，最动人。', buff: '触发善意事件·人气上涨', emotion: 6, flow: 0.08 }
];

// 情绪区间：影响口碑与客流
function emotionState(save) {
  var e = save.shared.emotion == null ? 60 : save.shared.emotion;
  if (e < 20) return { key: 'low', em: '😢', name: '无力低落', rep: -0.03, flow: -0.06 };
  if (e < 40) return { key: 'low', em: '😔', name: '疲惫迷茫', rep: -0.02, flow: -0.05 };
  if (e >= 85) return { key: 'breakthrough', em: '🌟', name: '成熟破局', rep: 0.05, flow: 0.04 };
  if (e > 70) return { key: 'high', em: '😌', name: '坚韧通透', rep: 0.03, flow: 0.02 };
  return { key: 'mid', em: '😐', name: '平稳常态', rep: 0, flow: 0 };
}
function applyEmotion(save, delta) {
  save.shared.emotion = clamp((save.shared.emotion == null ? 60 : save.shared.emotion) + delta, 0, 100);
}
// 隐性成长：五项数值永久累计，永不清零（新增经营格局）
function growthSnapshot(save) {
  var g = save.shared.growth || {};
  var perspective = Math.round(g.perspective || (save.shared.perspective || 0));
  return {
    experience: Math.round(g.experience || 0),
    craft: Math.round(g.craft || 0),
    empathy: Math.round(g.empathy || 0),
    resilience: Math.round(g.resilience || 0),
    perspective: perspective,
    total: Math.round((g.experience || 0) + (g.craft || 0) + (g.empathy || 0) + (g.resilience || 0) + perspective)
  };
}
function addGrowth(save, key, v) {
  if (!save.shared.growth) save.shared.growth = { experience: 0, craft: 0, empathy: 0, resilience: 0, perspective: 0 };
  save.shared.growth[key] = Math.max(0, (save.shared.growth[key] || 0) + v);
}
// CY3 规则深化：隐性成长/心境/善恶平衡真正进入经营决策（与 H5 同口径，克制幅度）
function flowModifier(save) {
  var sh = save.shared, emo = Number(sh.emotion) || 60, g = growthSnapshot(save);
  var kb = sh.kindBalance || { good: 0, bad: 0, gov: 0 };
  var m = 1 + (emo - 60) / 400;
  m += Math.min(0.08, (g.empathy || 0) * 0.002);
  m += Math.min(0.06, (g.perspective || 0) * 0.0015);
  var imbalance = Math.abs((kb.good || 0) - (kb.bad || 0));
  if (imbalance > 20) m -= Math.min(0.05, (imbalance - 20) * 0.001);
  var fatigue = Math.max(0, (sh.fatigueDays || 0) - 2), loss = Math.max(0, (sh.lossDays || 0) - 1);
  m -= Math.min(0.06, fatigue * 0.01 + loss * 0.01);
  return Math.max(0.8, Math.min(1.2, m));
}
// 火候完美区容差：手艺越高判定越宽（最多各 +10 个百分点）
function cookTolerance(save) {
  return Math.min(0.10, (growthSnapshot(save).craft || 0) * 0.002);
}
// 每日固定事件：正负强制对冲（2–4件，至少1正面+1负面）
function rollHumanEvents(save) {
  var good = HUMAN_EVENTS.filter(function (e) { return e.kind === 'good'; });
  var bad = HUMAN_EVENTS.filter(function (e) { return e.kind === 'bad'; });
  var gov = HUMAN_EVENTS.filter(function (e) { return e.kind === 'gov'; });
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  var list = [pick(good), pick(bad)];
  if (Math.random() < 0.45) list.push(pick(gov));
  if (Math.random() < 0.3) list.push(pick(Math.random() < 0.5 ? good : bad));
  // 打乱顺序，避免每次都是先好后坏
  list = list.filter(function (e, i) { return list.indexOf(e) === i; });
  save.shared.dayEvents = list.map(function (e) { return e.id; });
  if (!save.shared.lifeView) save.shared.lifeView = { days: 0, events: 0, good: 0, bad: 0, gov: 0, stories: 0 };
  if (!save.shared.kindBalance) save.shared.kindBalance = { good: 0, bad: 0, gov: 0 };
  list.forEach(function (e) {
    save.shared.lifeView.events += 1;
    save.shared.lifeView[e.kind] = (save.shared.lifeView[e.kind] || 0) + 1;
    save.shared.kindBalance[e.kind] = (save.shared.kindBalance[e.kind] || 0) + 1;
    if (save.shared.storyMet.indexOf(e.id) < 0) save.shared.storyMet.push(e.id);
  });
  save.shared.lifeView.stories = save.shared.storyMet.length;
  saveSave(save);
  return list;
}
// 体力/情绪 BUFF：连续摆摊3天疲惫，连亏2天迷茫，复盘解锁坚韧/匠心
function refreshBuffs(save, stats, profit) {
  var sh = save.shared;
  sh.fatigueDays = stats && stats.played ? (sh.fatigueDays || 0) + 1 : 0;
  sh.lossDays = (profit || 0) < 0 ? (sh.lossDays || 0) + 1 : 0;
  var b = [];
  if ((sh.fatigueDays || 0) >= 3) b.push({ em: '😵', name: '轻微疲惫', effect: '操作小幅变难' });
  if ((sh.lossDays || 0) >= 2) b.push({ em: '😔', name: '迷茫', effect: '客流小幅波动' });
  if ((sh.reviewDays || 0) >= 3) b.push({ em: '💎', name: '坚韧通透', effect: '口碑小幅加成' });
  if ((sh.growth && sh.growth.craft || 0) >= 12) b.push({ em: '🪡', name: '匠心', effect: '出品更稳' });
  if ((sh.growth && sh.growth.resilience || 0) >= 12) b.push({ em: '🛡️', name: '抗压', effect: '逆境成长加倍' });
  if (growthSnapshot(save).perspective >= 8) b.push({ em: '🧭', name: '经营格局', effect: '降低冲动损失' });
  if (emotionState(save).key === 'breakthrough') b.push({ em: '🌟', name: '成熟破局', effect: '口碑与客流小幅受益' });
  sh.buffs = b;
  return b;
}
// 今日事件结算：把事件影响写入口碑/情绪/隐性成长；金币统一由 settleDay 经 profit 一次入账（CY3 防双重入账）
function applyHumanEvents(save, events, stats) {
  var flowDelta = 0, coinDelta = 0, clearedBad = 0, lossReduce = 0;
  (events || []).forEach(function (e) {
    if (e.coin) { coinDelta += e.coin; }
    if (e.emotion) applyEmotion(save, e.emotion);
    if (e.rep) applyRep(save, e.rep);
    if (e.empathy) addGrowth(save, 'empathy', e.empathy);
    if (e.resilience) addGrowth(save, 'resilience', e.resilience);
    if (e.craft) addGrowth(save, 'craft', e.craft);
    if (e.flow) flowDelta += e.flow;
    if (e.clearBad) clearedBad += e.clearBad;
    if (e.lossReduce) lossReduce += e.lossReduce;
  });
  if (stats) stats.eventFlowDelta = (stats.eventFlowDelta || 0) + flowDelta;
  return { coinDelta: coinDelta, flowDelta: flowDelta, clearedBad: clearedBad, lossReduce: lossReduce };
}
// 隐性成长日结算（公式完全按策划）
function settleGrowth(save, stats, profit) {
  var accuracy = (stats && stats.good + stats.bad > 0) ? stats.good / (stats.good + stats.bad) : 0.8;
  var eventCount = (save.shared.dayEvents || []).length;
  var goodCount = (save.shared.dayEvents || []).filter(function (id) {
    var e = HUMAN_EVENTS.filter(function (x) { return x.id === id; })[0]; return e && e.kind === 'good';
  }).length;
  var badCount = (save.shared.dayEvents || []).filter(function (id) {
    var e = HUMAN_EVENTS.filter(function (x) { return x.id === id; })[0]; return e && e.kind === 'bad';
  }).length;
  addGrowth(save, 'craft', accuracy * 0.3);
  addGrowth(save, 'experience', eventCount * 2 + Math.abs(profit || 0) / 100);
  addGrowth(save, 'empathy', Math.max(0, goodCount * 5 - badCount * 2));
  addGrowth(save, 'resilience', ((stats && stats.bad) || 0) * 6 + ((profit || 0) < 0 ? 6 : 0));
  addGrowth(save, 'perspective', Math.max(0, badCount * 0.5 + ((profit || 0) < 0 ? 1 : 0) + ((save.shared.reviewDays || 0) >= 3 ? 0.5 : 0)));
  save.shared.perspective = growthSnapshot(save).perspective;
  return growthSnapshot(save);
}
// 复盘文案自动生成（按盈亏四档 + 短板诊断）
function buildReview(save, res, stats) {
  var profit = res.profit || 0;
  var title, summary;
  if (profit >= 60) {
    title = '经营大捷·匠心深耕，实干收获硕果';
    summary = '今日经营稳扎稳打、品控标准、服务真诚、备货科学。以精细化运营夯实经营根基，以匠心品质赢得市场认可。日日精进、久久为功，微小坚持终将汇成长远发展力量。';
  } else if (profit > 0) {
    title = '稳步精进·迭代优化，持续突破成长';
    summary = '今日经营实现正向收益，经营状态稳定可控。仍存在细节优化空间，通过迭代备货策略、创新服务方式、优化出品效率，可实现更高质量经营。';
  } else if (profit > -40) {
    title = '查漏补缺·正视短板，逆境迭代重生';
    summary = '今日经营遇阶段性波动，源于备货预判、细节把控、市场环境综合影响。创业之路从无一帆风顺，正视不足、总结短板、优化策略，即是最大的成长革新。';
  } else {
    title = '破局新生·重构模式，低谷终成铺垫';
    summary = '今日经营遭遇阶段性困境，是风险预判、经营思维、外部环境的综合考验。困境是革新的契机、低谷是突破的铺垫。打破固化思维、重构经营模式，即可逆境翻盘、破局新生。';
  }
  var short = [];
  if ((res.expired || 0) > 0 || (stats && stats.lost > 2)) short.push('库存积压：资源配置冗余，需精细化控本增效、柔性备货创新');
  if ((stats && stats.bad) > 1) short.push('品控不足：细节标准化欠缺，需打磨匠心技艺、夯实核心竞争力');
  if (profit < 0 && (stats && stats.gross) > 0) short.push('定价偏差：市场适配不足，需创新经营思维、贴合客群需求');
  if ((stats && stats.sold || 0) < 3) short.push('客流不足：经营形式单一，需拓宽服务维度、创新引流模式');
  if (!short.length) short.push('无明显短板：保持节奏，持续复盘迭代');
  var g = growthSnapshot(save);
  return {
    title: title, summary: summary, short: short,
    rows: [
      { k: '当日经营营收', v: '¥' + Math.round(res.gross || 0) },
      { k: '创业运营总成本', v: '¥' + Math.round((res.rent || 0) + (res.foodCost || 0) + (res.fixedCost || 6)) },
      { k: '实干经营净利', v: (profit >= 0 ? '+' : '') + '¥' + Math.round(profit) },
      { k: '服务客群总量', v: (stats && stats.sold || 0) + ' 位' },
      { k: '经营口碑评分', v: (save.shared.rep || 3).toFixed(1) },
      { k: '经营疏漏短板', v: short.length + ' 项' },
      { k: '持续创业天数', v: (save.scene.day || 1) + ' 天' }
    ],
    growth: g,
    lifeView: save.shared.lifeView || { days: 0, events: 0, good: 0, bad: 0, gov: 0, stories: 0 },
    kindBalance: save.shared.kindBalance || { good: 0, bad: 0, gov: 0 },
    events: (save.shared.dayEvents || []).map(function (id) {
      var e = HUMAN_EVENTS.filter(function (x) { return x.id === id; })[0];
      return e ? { em: e.em, title: e.title, review: e.review, kind: e.kind } : null;
    }).filter(Boolean)
  };
}
// 真实生存恒成本：无论盈亏每日固定支出（耗材/折旧/基础生活）
function fixedDailyCost() { return 6; }
// 经营收益波动：环境随机系数（努力可控，环境不可控）
function rollEnvironment() {
  return Math.round((Math.random() * 0.24 - 0.12) * 100) / 100;
}

// ---- 商品图鉴 ----
function codexGoods(save) {
  return Object.keys(GOODS).map(function (k) {
    return { key: k, name: GOODS[k].name, em: GOODS[k].emoji, unlocked: isGoodUnlocked(save, k), unlock: GOODS[k].unlock, price: GOODS[k].price };
  });
}

// ---- 经营日报（每日一条，最多留 30 条） ----
function pushHistory(save, res) {
  ensureDayState(save);
  save.shared.history.push({
    day: save.scene.day - 1, date: todayKey(), profit: res.profit, gross: res.gross,
    sold: res.sold, perfect: res.perfect, rep: round1(save.shared.rep)
  });
  if (save.shared.history.length > 30) save.shared.history = save.shared.history.slice(-30);
}

// ---- 小城创业：被动收益，每日收租一次 ----
function cityUnlocked(save) { return !!save.shared.cityUnlocked; }
function unlockCity(save) {
  if (save.shared.cityUnlocked) return { ok: false, msg: '已开张' };
  if (save.shared.totalRevenue < 300) return { ok: false, msg: '累计营收需≥300' };
  save.shared.cityUnlocked = true; saveSave(save);
  return { ok: true };
}
function cityLevel(save) {
  var lv = CITY_SCENES[0];
  CITY_SCENES.forEach(function (c) { if (save.shared.totalRevenue >= (c.cost > 0 ? c.cost : 0) && c.income > lv.income) lv = c; });
  return lv;
}
function collectCity(save) {
  if (!save.shared.cityUnlocked) return { ok: false, msg: '尚未开张小城创业' };
  if (save.shared.cityDay === todayKey()) return { ok: false, msg: '今天已收过租金' };
  var lv = cityLevel(save);
  save.shared.cityDay = todayKey();
  save.shared.cityIncome = (Number(save.shared.cityIncome) || 0) + lv.income;
  save.shared.coins += lv.income;
  saveSave(save);
  return { ok: true, coin: lv.income, name: lv.name };
}

// ---- 云存档：本地可跑通（localStorage/文件），微信端配置为云开发后可替换传输层 ----
// 导出为可复制的紧凑字符串；导入做白名单字段校验，避免脏存档破坏游戏
var CLOUD_KEYS = ['coins', 'rep', 'totalRevenue', 'totalCustomers', 'perfect', 'clues', 'chapter', 'streak',
  'rareMet', 'listClaimed', 'partners', 'partnerLog', 'bonds', 'ownedSkins', 'activeSkin',
  'achClaimed', 'cityUnlocked', 'cityIncome', 'goodsFound', 'history', 'cloudSlotId',
  // CY3：补齐隐性成长账本，避免云备份/存档码丢失长期沉淀
  'emotion', 'growth', 'mode', 'fatigueDays', 'lossDays', 'reviewDays', 'fixedCostPaid', 'perspective',
  'lifeView', 'kindBalance', 'buffs', 'dayEvents', 'storyMet', 'tierClaimed', 'chestDay', 'chestStreak',
  'badges', 'ref', 'highlight', 'bestCombo', 'bestProfit'];
function exportCloud(save) {
  ensureDayState(save);
  var out = { v: 5, game: CONFIG.GAME_NAME, ts: Date.now(), shared: {}, scene: { day: save.scene.day } };
  CLOUD_KEYS.forEach(function (k) { if (save.shared[k] !== undefined) out.shared[k] = save.shared[k]; });
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(out)))); }
  catch (e) { return JSON.stringify(out); }
}
function importCloud(save, text) {
  var data;
  try {
    data = JSON.parse(typeof atob === 'function' ? decodeURIComponent(escape(atob(text.trim()))) : text);
  } catch (e) { try { data = JSON.parse(text); } catch (e2) { return { ok: false, msg: '存档码无法识别' }; } }
  if (!data || !data.shared || typeof data.shared !== 'object') return { ok: false, msg: '存档数据无效' };
  var numKeys = ['coins', 'rep', 'totalRevenue', 'totalCustomers', 'perfect', 'clues', 'chapter', 'streak', 'cityIncome'];
  numKeys.forEach(function (k) { var n = Number(data.shared[k]); if (isFinite(n) && n >= 0) save.shared[k] = n; });
  ['rareMet', 'listClaimed', 'partners', 'partnerLog', 'ownedSkins', 'achClaimed', 'goodsFound', 'history'].forEach(function (k) {
    if (Array.isArray(data.shared[k])) save.shared[k] = data.shared[k];
  });
  if (data.shared.bonds && typeof data.shared.bonds === 'object') save.shared.bonds = data.shared.bonds;
  if (typeof data.shared.cityUnlocked === 'boolean') save.shared.cityUnlocked = data.shared.cityUnlocked;
  if (typeof data.shared.activeSkin === 'string') save.shared.activeSkin = data.shared.activeSkin;
  if (typeof data.shared.cloudSlotId === 'string' && data.shared.cloudSlotId) save.shared.cloudSlotId = data.shared.cloudSlotId;
  // CY3：恢复隐性成长/心境/善恶/推荐等长期账本，逐字段做类型校验，避免脏存档破坏运行时
  var growKeys = ['experience', 'craft', 'empathy', 'resilience', 'perspective'];
  if (data.shared.growth && typeof data.shared.growth === 'object') {
    if (!save.shared.growth || typeof save.shared.growth !== 'object') save.shared.growth = {};
    growKeys.forEach(function (k) {
      var n = Number(data.shared.growth[k]);
      if (isFinite(n) && n >= 0) save.shared.growth[k] = n;
    });
  }
  var moreNums = ['fatigueDays', 'lossDays', 'reviewDays', 'fixedCostPaid', 'perspective', 'chestStreak', 'bestCombo', 'bestProfit'];
  moreNums.forEach(function (k) { var n = Number(data.shared[k]); if (isFinite(n) && n >= 0) save.shared[k] = n; });
  var emo = Number(data.shared.emotion); if (isFinite(emo)) save.shared.emotion = clamp(emo, 0, 100);
  if (typeof data.shared.mode === 'string' && data.shared.mode) save.shared.mode = data.shared.mode;
  if (typeof data.shared.chestDay === 'string') save.shared.chestDay = data.shared.chestDay;
  ['lifeView', 'kindBalance', 'ref', 'highlight'].forEach(function (k) {
    if (data.shared[k] && typeof data.shared[k] === 'object') save.shared[k] = data.shared[k];
  });
  ['buffs', 'dayEvents', 'storyMet', 'tierClaimed', 'badges'].forEach(function (k) {
    if (Array.isArray(data.shared[k])) save.shared[k] = data.shared[k];
  });
  if (data.scene && isFinite(Number(data.scene.day))) save.scene.day = Math.max(save.scene.day, Number(data.scene.day));
  ensureDayState(save); saveSave(save);
  return { ok: true, msg: '云存档已恢复' };
}
// 云存档：微信云开发已配置时走真云端，否则用本机槽位 + 存档码跑通完整交互
var CLOUD_LOCAL_KEY = 'yeshiyuan_cloud_slot_v1';
function cloudLocalKey(save) {
  var slot = save && save.shared && save.shared.cloudSlotId ? save.shared.cloudSlotId : 'default';
  return CLOUD_LOCAL_KEY + '_' + slot;
}
function cloudReady() {
  if (!Store.isWx || !wx.cloud || !CONFIG.CLOUD.enabled || !CONFIG.CLOUD.env) return false;
  try { wx.cloud.init({ env: CONFIG.CLOUD.env, traceUser: true }); return true; }
  catch (e) { return false; }
}
function cloudBackup(save) {
  var code = exportCloud(save);
  var key = cloudLocalKey(save);
  try {
    if (Store.isWx) wx.setStorageSync(key, code);
    else if (typeof localStorage !== 'undefined') localStorage.setItem(key, code);
  } catch (e) { return { ok: false, msg: '本地存储不可用' }; }
  return { ok: true, code: code, mode: 'local' };
}
function cloudBackupAsync(save, cb) {
  var done = cb || function () {};
  if (cloudReady()) {
    var code = exportCloud(save);
    var slot = save.shared.cloudSlotId;
    try {
      var db = wx.cloud.database();
      var p = db.collection(CONFIG.CLOUD.collection).doc(slot).set({
        data: { payload: code, game: CONFIG.GAME_NAME, updatedAt: Date.now() }
      });
      if (p && typeof p.then === 'function') {
        return p.then(function () { done({ ok: true, code: code, mode: 'wxcloud' }); })
               .catch(function () { done(cloudBackup(save)); });
      }
    } catch (e) {}
  }
  done(cloudBackup(save));
}
function cloudRestore(save) {
  var key = cloudLocalKey(save);
  var legacy = null;
  try { legacy = Store.isWx ? wx.getStorageSync(CLOUD_LOCAL_KEY) : (typeof localStorage !== 'undefined' ? localStorage.getItem(CLOUD_LOCAL_KEY) : null); }
  catch (e) {}
  var code = null;
  try { code = Store.isWx ? wx.getStorageSync(key) : (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null); }
  catch (e) {}
  if (!code) code = legacy;
  if (!code) return { ok: false, msg: '暂无云端备份' };
  var r = importCloud(save, code);
  if (r.ok) r.mode = 'local';
  return r;
}
function cloudRestoreAsync(save, cb) {
  var done = cb || function () {};
  if (cloudReady()) {
    var slot = ensureSlot(save);
    try {
      var p = wx.cloud.database().collection(CONFIG.CLOUD.collection).doc(slot).get();
      if (p && typeof p.then === 'function') {
        return p.then(function (res) {
          var payload = res && res.data && res.data.payload;
          if (!payload) { done(cloudRestore(save)); return; }
          var r = importCloud(save, payload);
          if (r.ok) r.mode = 'wxcloud';
          done(r);
        }).catch(function () { done(cloudRestore(save)); });
      }
    } catch (e) {}
  }
  done(cloudRestore(save));
}
function ensureSlot(save) {
  ensureDayState(save);
  if (!save.shared.cloudSlotId) {
    save.shared.cloudSlotId = 'ysy_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    saveSave(save);
  }
  return save.shared.cloudSlotId;
}
function cloudCodeApply(save, code) { return importCloud(save, code); }

// 好友榜：主域只上报自己的分数，好友昵称/头像由开放数据域读取并绘制
function reportRankScore(save, force) {
  if (!Store.isWx || !wx.setUserCloudStorage || !save || !save.shared) return false;
  var day = todayKey();
  if (!force && save.shared.rankReported === day) return false;
  var list = [
    { key: CONFIG.RANK.scoreKey, value: String(Math.max(0, Math.round(save.shared.totalRevenue || 0))) },
    { key: CONFIG.RANK.dayKey, value: String(save.scene.day || 1) },
    { key: CONFIG.RANK.repKey, value: String(save.shared.rep || 3) },
    { key: CONFIG.RANK.titleKey || 'title', value: rewardTier(save).name }
  ];
  try {
    wx.setUserCloudStorage({ KVDataList: list, success: function () {}, fail: function () {} });
    save.shared.rankReported = day;
    saveSave(save);
    return true;
  } catch (e) { return false; }
}

// ---- 好友榜：本地可跑通（内置虚拟对手 + 玩家真实数据），微信开放数据域可替换数据源 ----
var RIVALS = [
  { name: '摆摊老王', em: '🧔', revenue: 260, day: 12 },
  { name: '柠檬茶妹', em: '👧', revenue: 520, day: 18 },
  { name: '夜市一哥', em: '🕶️', revenue: 980, day: 26 },
  { name: '烧烤大叔', em: '👨', revenue: 1500, day: 35 }
];
function leaderboard(save) {
  var list = RIVALS.map(function (r) { return { name: r.name, em: r.em, revenue: r.revenue, day: r.day, me: false }; });
  list.push({ name: '我', em: '🙂', revenue: Math.round(save.shared.totalRevenue), day: save.scene.day, me: true });
  list.sort(function (a, b) { return b.revenue - a.revenue; });
  list.forEach(function (r, i) { r.rank = i + 1; });
  return { list: list, myRank: (list.filter(function (r) { return r.me; })[0] || {}).rank };
}

module.exports = {
  Store: Store, todayKey: todayKey, DEF_SHARED: DEF_SHARED, defaultSave: defaultSave, loadSave: loadSave, saveSave: saveSave,
  GOODS: GOODS, STALLS: STALLS, isGoodUnlocked: isGoodUnlocked,
  addStock: addStock, stockQty: stockQty, consumeStock: consumeStock, expireStock: expireStock,
  TASKS: TASKS, ensureDayState: ensureDayState, updateTask: updateTask, taskProgress: taskProgress, tasksAllDone: tasksAllDone, claimTasks: claimTasks,
  REGULARS: REGULARS, RARE: RARE, addBond: addBond, MYSTERY_STORY: MYSTERY_STORY, mysteryStage: mysteryStage,
  STREET_SHIFTS: STREET_SHIFTS, ERRANDS: ERRANDS, rollStreetShift: rollStreetShift, startErrand: startErrand, doErrand: doErrand,
  PARTNER_TIERS: PARTNER_TIERS, activePartners: activePartners, partnerUnlocked: partnerUnlocked, takePartner: takePartner, settlePartners: settlePartners,
  LIFE_LIST: LIFE_LIST, lifeDone: lifeDone, claimLife: claimLife, applyRep: applyRep, addClue: addClue,
  judgeCook: judgeCook, makeCustomer: makeCustomer, customerPatiencePct: customerPatiencePct, settleDay: settleDay,
  SKINS: SKINS, skinById: skinById, activeSkin: activeSkin, skinUnlocked: skinUnlocked, unlockSkin: unlockSkin, setSkin: setSkin, skinFlowBonus: skinFlowBonus, skinTipBonus: skinTipBonus,
  ACHIEVEMENTS: ACHIEVEMENTS, achDone: achDone, claimAch: claimAch, achStats: achStats,
  codexGoods: codexGoods, pushHistory: pushHistory,
  CITY_SCENES: CITY_SCENES, cityUnlocked: cityUnlocked, unlockCity: unlockCity, cityLevel: cityLevel, collectCity: collectCity,
  CONFIG: CONFIG, exportCloud: exportCloud, importCloud: importCloud,
  cloudBackup: cloudBackup, cloudBackupAsync: cloudBackupAsync, cloudRestore: cloudRestore, cloudRestoreAsync: cloudRestoreAsync,
  cloudCodeApply: cloudCodeApply, ensureSlot: ensureSlot, reportRankScore: reportRankScore, leaderboard: leaderboard,
  // 奖励机制 v6
  REWARD_TIERS: REWARD_TIERS, SURPRISE_DAYS: SURPRISE_DAYS, VANITY_BADGES: VANITY_BADGES,
  rewardTier: rewardTier, nextTier: nextTier, tierProgress: tierProgress, checkTiers: checkTiers,
  claimSurprise: claimSurprise, surpriseReady: surpriseReady, refreshBadges: refreshBadges,
  updateHighlight: updateHighlight, recordReferral: recordReferral, claimRefReward: claimRefReward,
  myRefCode: myRefCode, battleCard: battleCard,
  // 深度人性化·真实案例版 v8
  HUMAN_EVENTS: HUMAN_EVENTS, REGULAR_STORIES: REGULAR_STORIES,
  emotionState: emotionState, applyEmotion: applyEmotion, growthSnapshot: growthSnapshot, addGrowth: addGrowth,
  flowModifier: flowModifier, cookTolerance: cookTolerance,
  rollHumanEvents: rollHumanEvents, refreshBuffs: refreshBuffs, applyHumanEvents: applyHumanEvents,
  settleGrowth: settleGrowth, buildReview: buildReview, fixedDailyCost: fixedDailyCost,
  rollEnvironment: rollEnvironment
};
