// projects.js —— 留学生活 / 村超经理 / 城市人生 三项目 H5 点击即玩版
// 设计：无后端、无安装、URL 渠道追踪、本机存档、复访补给、渐进式增长策略。

(function () {
  'use strict';

  var VERSION = '1.0.0';
  var META_KEY = 'yeshi_projects_meta_v1';
  var CH_KEY = 'yeshi_projects_channel_v1';
  var SAVE_PREFIX = 'yeshi_project_save_v1_';

  var CONFIG = {
    mpUrl: '',
    miniGameUrl: '',
    returnBonusBase: 12,
    returnBonusStep: 6,
    returnBonusCap: 42
  };

  var CHANNELS = {
    wechat_group: '微信群',
    moments: '朋友圈',
    mp_menu: '公众号菜单',
    mp_article: '公众号文章',
    qrcode: '二维码',
    direct: '直接打开'
  };

  function two(n) { return n < 10 ? '0' + n : String(n); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); }
  function yesterday() { var d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); }
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function chance(p) { return Math.random() < p; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmtTime() { var d = new Date(); return two(d.getHours()) + ':' + two(d.getMinutes()); }
  function getParam(name) {
    var s = location.search.replace(/^\?/, '').split('&');
    for (var i = 0; i < s.length; i++) {
      var p = s[i].split('=');
      if (decodeURIComponent(p[0]) === name) return decodeURIComponent(p[1] || '');
    }
    return '';
  }
  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function readJSON(key, fallback) {
    try { var raw = safeGet(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, val) { safeSet(key, JSON.stringify(val)); }
  function channelName(ch) { return CHANNELS[ch] || ch || '直接打开'; }
  function normalizeChannel(ch) { return CHANNELS[ch] ? ch : 'direct'; }
  function pushLog(st, text) {
    st.log = st.log || [];
    st.log.push('[' + fmtTime() + '] ' + text);
    if (st.log.length > 16) st.log = st.log.slice(-16);
  }
  function addAch(st, scene, id, name) {
    st.achievements = st.achievements || [];
    if (st.achievements.indexOf(id) >= 0) return;
    st.achievements.push(id);
    pushLog(st, '达成成就：' + name);
  }

  var baseStats = {
    day: 1,
    energy: 3,
    lastVisit: '',
    streak: 0,
    visits: 0,
    returns: 0,
    shares: 0,
    bonusToday: false,
    log: [],
    achievements: [],
    // 奖励机制 v1.1：层级称号 / 每日惊喜 / 虚荣徽章 / 好友推荐
    tier: 0, tierClaimed: [], chestDay: '', chestStreak: 0,
    badges: [], bestValue: 0, ref: { code: '', joined: 0, rewardDay: '' }
  };

  // 层级称号：锚定各项目"玩得好"的核心指标，不做签到型通胀
  var TIERS = {
    cunchao: [
      { em: '🌱', name: '村队新人', need: '开始执教', rw: 0, ok: function () { return true; } },
      { em: '⚽', name: '村落教头', need: '赢下 1 场', rw: 15, ok: function (s) { return (s.wins || 0) >= 1; } },
      { em: '🔥', name: '乡赛名帅', need: '赢下 4 场', rw: 40, ok: function (s) { return (s.wins || 0) >= 4; } },
      { em: '🏆', name: '村超传奇', need: '积分 18 且 赢 8 场', rw: 90, ok: function (s) { return (s.points || 0) >= 18 && (s.wins || 0) >= 8; } }
    ],
    liuxue: [
      { em: '🌱', name: '初到异乡', need: '开始留学生活', rw: 0, ok: function () { return true; } },
      { em: '📚', name: '课业上手', need: '修 4 门课', rw: 15, ok: function (s) { return (s.courses || 0) >= 4; } },
      { em: '🎓', name: '优等生', need: 'GPA 3.5', rw: 40, ok: function (s) { return (s.gpa || 0) >= 3.5; } },
      { em: '🌍', name: '毕业精英', need: 'GPA 3.8 且 实习 2 次', rw: 90, ok: function (s) { return (s.gpa || 0) >= 3.8 && (s.internships || 0) >= 2; } }
    ],
    chengshi: [
      { em: '🌱', name: '初来乍到', need: '落地一座城', rw: 0, ok: function () { return true; } },
      { em: '💼', name: '职场新人', need: '晋升到 2 级', rw: 15, ok: function (s) { return (s.jobLevel || 1) >= 2; } },
      { em: '🏙️', name: '城市扎根', need: '存款 1000', rw: 40, ok: function (s) { return (s.savings || 0) >= 1000; } },
      { em: '🌟', name: '新城市民', need: '技能 80 且 晋升 3 级', rw: 90, ok: function (s) { return (s.skill || 0) >= 80 && (s.jobLevel || 1) >= 3; } }
    ]
  };
  var SURPRISE = [
    { em: '🎁', name: '室友的零食', text: '有人往你桌上放了一包零食', coin: 12 },
    { em: '📮', name: '一封家书', text: '收到家里的消息，还有一点零花钱', coin: 18 },
    { em: '🌟', name: '意外的好运', text: '今天运气不错，捡到一笔小钱', coin: 26 }
  ];

  function makeDefault(scene) {
    var s = {};
    for (var k in baseStats) if (Object.prototype.hasOwnProperty.call(baseStats, k)) s[k] = baseStats[k];
    if (scene === 'cunchao') {
      s.funds = 260; s.fans = 18; s.morale = 62; s.attack = 42; s.defense = 40;
      s.stamina = 68; s.points = 0; s.sponsor = 0; s.matches = 0; s.wins = 0;
      s.upgrades = {};
    } else if (scene === 'liuxue') {
      s.cash = 900; s.language = 38; s.gpa = 2.6; s.energy2 = 70; s.social = 25;
      s.visa = 30; s.internships = 0; s.courses = 0; s.jobs = 0;
    } else {
      s.cash = 1200; s.skill = 30; s.mood = 65; s.rent = 180; s.credit = 60;
      s.jobLevel = 1; s.savings = 0; s.city = ''; s.dayOff = 0;
    }
    return s;
  }

  function loadSave(scene) {
    var def = makeDefault(scene);
    var saved = readJSON(SAVE_PREFIX + scene, null);
    if (!saved || typeof saved !== 'object') return def;
    for (var k in def) {
      if (!Object.prototype.hasOwnProperty.call(def, k)) continue;
      if (saved[k] === undefined || saved[k] === null) saved[k] = def[k];
    }
    if (scene === 'cunchao' && (!saved.upgrades || typeof saved.upgrades !== 'object')) saved.upgrades = {};
    // 奖励字段迁移
    if (!Array.isArray(saved.tierClaimed)) saved.tierClaimed = [];
    if (!Array.isArray(saved.badges)) saved.badges = [];
    saved.tier = Number(saved.tier) || 0;
    saved.chestStreak = Number(saved.chestStreak) || 0;
    saved.bestValue = Number(saved.bestValue) || 0;
    if (!saved.ref || typeof saved.ref !== 'object') saved.ref = {};
    if (saved.ref.code === undefined) saved.ref.code = '';
    saved.ref.joined = Number(saved.ref.joined) || 0;
    if (saved.ref.rewardDay === undefined) saved.ref.rewardDay = '';
    return saved;
  }
  function saveScene(scene, st) { writeJSON(SAVE_PREFIX + scene, st); }

  // ---- 奖励引擎 ----
  function rewardTier(scene, st) {
    var list = TIERS[scene], t = list[0];
    for (var i = 0; i < list.length; i++) if (list[i].ok(st)) t = list[i];
    return t;
  }
  function checkTiers(scene, st) {
    var gained = 0, got = [];
    TIERS[scene].forEach(function (t, i) {
      if (t.ok(st) && st.tierClaimed.indexOf(i) < 0) {
        st.tierClaimed.push(i);
        var currency = GAMES[scene].currency;
        st[currency] = (st[currency] || 0) + t.rw;
        gained += t.rw; got.push(t.em + t.name);
        st.tier = Math.max(st.tier || 0, i);
      }
    });
    if (got.length) pushLog(st, '层级突破：' + got.join('、') + (gained ? ' +' + gained : ''));
    return { gained: gained, got: got };
  }
  function claimSurprise(st) {
    if (st.chestDay === today()) return null;
    st.chestDay = today(); st.chestStreak = (st.chestStreak || 0) + 1;
    var box = SURPRISE[(st.chestStreak - 1) % SURPRISE.length];
    var currency = GAMES[scene].currency;
    st[currency] = (st[currency] || 0) + box.coin;
    pushLog(st, box.name + '：+' + box.coin + '（连续惊喜第 ' + st.chestStreak + ' 天）');
    return { em: box.em, name: box.name, text: box.text, coin: box.coin };
  }
  function refreshBadges(scene, st) {
    var cur = rewardTier(scene, st);
    var list = [{ id: 'tier', em: cur.em, name: cur.name }, { id: 'day', em: '📅', name: '第 ' + st.day + ' 天' },
      { id: 'streak', em: '🔥', name: '连续 ' + (st.streak || 0) + ' 天' }];
    if (st.shares) list.push({ id: 'share', em: '📤', name: '分享 ' + st.shares + ' 次' });
    if (st.ref && st.ref.joined) list.push({ id: 'ref', em: '🤝', name: '带来 ' + st.ref.joined + ' 位伙伴' });
    var prev = st.badges || [];
    var fresh = list.filter(function (b) { return prev.indexOf(b.id) < 0 && prev.length > 0; });
    st.badges = list.map(function (b) { return b.id; });
    return { list: list, fresh: fresh };
  }
  function recordReferral(st) {
    var inviter = getParam('inviter') || getParam('ref');
    if (inviter && inviter !== st.ref.code) {
      st.ref.code = inviter; st.ref.joined = (st.ref.joined || 0) + 1;
      pushLog(st, '通过好友推荐加入，结伴补给已解锁');
    }
  }
  function claimRefReward(st) {
    if (!st.ref.code || st.ref.rewardDay === today()) return null;
    if ((st.streak || 0) < 1 && st.day < 2) return null;
    st.ref.rewardDay = today();
    var coin = 10 + Math.min(10, st.ref.joined * 2);
    var currency = GAMES[scene].currency;
    st[currency] = (st[currency] || 0) + coin;
    pushLog(st, '好友结伴补给 +' + coin + '（无需分享）');
    return coin;
  }

  function metaLoad() {
    var m = readJSON(META_KEY, { visits: 0, returns: 0, shares: 0, channelCounts: {}, firstChannel: '', lastScene: '' });
    m.channelCounts = m.channelCounts || {};
    return m;
  }
  function metaSave(m) { writeJSON(META_KEY, m); }

  var GAMES = {
    cunchao: {
      title: '村超经理', icon: '⚽', desc: '草根球队 · 赞助赛事 · 乡村热血',
      stats: [
        { k: 'funds', label: '经费', fmt: function (v) { return '¥' + v; } },
        { k: 'fans', label: '球迷', fmt: function (v) { return v + '人'; } },
        { k: 'morale', label: '士气', fmt: function (v) { return v; } },
        { k: 'points', label: '积分', fmt: function (v) { return v + '分'; } },
        { k: 'wins', label: '胜场', fmt: function (v) { return v + '场'; } },
        { k: 'energy', label: '行动', fmt: function (v) { return v + '/3'; } }
      ],
      currency: 'funds',
      actions: [
        { id: 'train', label: '晨训', desc: '消耗1行动，进攻与体能提升', run: function (st) {
            st.energy--; var atk = rnd(1, 3), sta = rnd(2, 4); st.attack += atk; st.stamina += sta; st.morale -= 1;
            return '晨训完成：进攻 +' + atk + '，体能 +' + sta + '，士气略降。';
          } },
        { id: 'sponsor', label: '跑赞助', desc: '消耗1行动，谈本地商户赞助', run: function (st) {
            st.energy--; var money = rnd(28, 65) + Math.floor(st.fans / 5); st.funds += money; st.sponsor += money;
            return '谈下赞助：经费 +' + money + ' 元。';
          } },
        { id: 'meet', label: '队内会议', desc: '消耗1行动，稳住士气与防守', run: function (st) {
            st.energy--; st.morale = clamp(st.morale + rnd(5, 9), 0, 100); st.defense += rnd(1, 2);
            return '队内会议：士气回升，防守思路更统一。';
          } },
        { id: 'live', label: '开一场直播', desc: '花30元，吸引外村球迷关注', need: function (st) { return st.funds >= 30; }, run: function (st) {
            st.funds -= 30; var fans = rnd(8, 18); st.fans += fans;
            return '村超直播出圈：球迷 +' + fans + ' 人。';
          } },
        { id: 'match', label: '正式比赛', desc: '消耗2行动，按阵容实力结算', need: function (st) { return st.energy >= 2; }, run: function (st) {
            st.energy -= 2; st.matches++;
            var power = st.attack * 0.42 + st.defense * 0.32 + st.stamina * 0.14 + st.morale * 0.12;
            var rival = 62 + Math.min(20, st.matches * 2) + rnd(-7, 9);
            var win = power >= rival;
            if (win) {
              st.wins++; st.points += 3; st.fans += rnd(6, 14); st.morale = clamp(st.morale + 6, 0, 100);
              var prize = 60 + st.fans; st.funds += prize;
              addAch(st, 'cunchao', 'first_win', '村超首胜');
              return '主场取胜！奖金 +' + prize + ' 元，积分 +3。';
            }
            st.points += 1; st.morale = clamp(st.morale - 4, 0, 100); st.fans += rnd(1, 4);
            return '客场逼平，积分 +1。回去要练防守了。';
          } },
        { id: 'upgrade', label: '升级装备', desc: '花90元，进攻+8、士气+4', need: function (st) { return st.funds >= 90 && !st.upgrades.kit; }, run: function (st) {
            st.funds -= 90; st.attack += 8; st.morale += 4; st.upgrades.kit = true;
            return '新球衣到位，球队像样多了。';
          } },
        { id: 'youth', label: '建青训点', desc: '花160元，每天自动加防守', need: function (st) { return st.funds >= 160 && !st.upgrades.youth; }, run: function (st) {
            st.funds -= 160; st.upgrades.youth = true; addAch(st, 'cunchao', 'youth', '青训扎根');
            return '青训点开起来，村里孩子也来踢球了。';
          } },
        { id: 'next', label: '推进一天', cls: 'green', desc: '恢复行动，结算赞助与青训', run: function (st) {
            st.day++; st.energy = 3; st.stamina = clamp(st.stamina + 8, 0, 100);
            var income = Math.floor(st.sponsor / 8) + (st.upgrades.youth ? 6 : 0);
            if (income) st.funds += income;
            if (st.fans >= 100) addAch(st, 'cunchao', 'fans100', '百人球迷会');
            return '新的一天：行动恢复，运营收入 +' + income + ' 元。';
          } }
      ]
    },
    liuxue: {
      title: '留学生活', icon: '🎓', desc: '签证选课 · 海外打工 · 毕业求职',
      stats: [
        { k: 'cash', label: '现金', fmt: function (v) { return '¥' + v; } },
        { k: 'language', label: '语言', fmt: function (v) { return Math.round(v); } },
        { k: 'gpa', label: 'GPA', fmt: function (v) { return v.toFixed(1); } },
        { k: 'energy2', label: '精力', fmt: function (v) { return Math.round(v); } },
        { k: 'social', label: '社交', fmt: function (v) { return Math.round(v); } },
        { k: 'visa', label: '签证', fmt: function (v) { return Math.round(v); } }
      ],
      currency: 'cash',
      actions: [
        { id: 'course', label: '认真选课', desc: '消耗精力，GPA 与语言提升', need: function (st) { return st.energy2 >= 12; }, run: function (st) {
            st.energy2 -= 12; st.courses++; st.gpa = clamp(st.gpa + 0.08, 0, 4); st.language += rnd(1, 3);
            return '选课规划完成：GPA 小幅上升。';
          } },
        { id: 'library', label: '泡图书馆', desc: '精力-15，GPA+0.12', need: function (st) { return st.energy2 >= 15; }, run: function (st) {
            st.energy2 -= 15; st.gpa = clamp(st.gpa + 0.12, 0, 4); st.language += 1;
            if (st.gpa >= 3.6) addAch(st, 'liuxue', 'gpa36', '优秀毕业生预备役');
            return '图书馆一战：GPA +0.12。';
          } },
        { id: 'work', label: '咖啡馆打工', desc: '精力-18，现金+75~120', need: function (st) { return st.energy2 >= 18; }, run: function (st) {
            st.energy2 -= 18; st.jobs++; var pay = rnd(75, 120); st.cash += pay; st.social += 2;
            return '今晚打工赚了 ' + pay + ' 元，也练了口语。';
          } },
        { id: 'club', label: '参加社团', desc: '精力-10，社交与签证稳定度上升', need: function (st) { return st.energy2 >= 10; }, run: function (st) {
            st.energy2 -= 10; st.social = clamp(st.social + rnd(5, 10), 0, 100); st.visa = clamp(st.visa + 3, 0, 100);
            return '认识了几位新朋友，留学生活没那么孤单了。';
          } },
        { id: 'intern', label: '投实习简历', desc: '语言≥55、GPA≥3.0 可投', need: function (st) { return st.language >= 55 && st.gpa >= 3.0; }, run: function (st) {
            var ok = chance(0.45 + (st.social / 400) + (st.gpa - 3) * 0.15);
            if (ok) {
              st.internships++; var pay = rnd(220, 420); st.cash += pay; st.visa = clamp(st.visa + 8, 0, 100);
              addAch(st, 'liuxue', 'intern', '第一份海外实习');
              return '拿到实习 offer：补贴 +' + pay + ' 元，签证材料更稳。';
            }
            st.social = clamp(st.social + 3, 0, 100);
            return '简历暂时没回音，但人脉又扩了一点。';
          } },
        { id: 'next', label: '推进一天', cls: 'green', desc: '恢复精力，扣生活费', run: function (st) {
            st.day++; st.energy2 = clamp(st.energy2 + 32, 0, 100); var cost = 55 + Math.floor(st.day / 4) * 5; st.cash -= cost;
            if (st.language >= 80) addAch(st, 'liuxue', 'lang80', '语言过关');
            return '新的一天：精力恢复，生活费 -' + cost + ' 元。';
          } }
      ]
    },
    chengshi: {
      title: '城市人生', icon: '🌏', desc: '北上广深 · 租房通勤 · 漂泊记忆',
      stats: [
        { k: 'cash', label: '现金', fmt: function (v) { return '¥' + v; } },
        { k: 'skill', label: '技能', fmt: function (v) { return Math.round(v); } },
        { k: 'mood', label: '心情', fmt: function (v) { return Math.round(v); } },
        { k: 'rent', label: '月租', fmt: function (v) { return '¥' + v; } },
        { k: 'credit', label: '信用', fmt: function (v) { return Math.round(v); } },
        { k: 'jobLevel', label: '职级', fmt: function (v) { return 'L' + v; } }
      ],
      currency: 'cash',
      actions: [
        { id: 'commute', label: '通勤上班', desc: '精力换稳定工资', run: function (st) {
            st.mood = clamp(st.mood - 5, 0, 100); var pay = 95 + st.jobLevel * 35 - Math.floor(st.rent / 40); st.cash += Math.max(40, pay);
            st.credit = clamp(st.credit + 2, 0, 100);
            return '挤完地铁到公司：工资 +' + Math.max(40, pay) + ' 元。';
          } },
        { id: 'freelance', label: '接私单', desc: '用技能换现金，消耗心情', need: function (st) { return st.skill >= 35; }, run: function (st) {
            st.mood = clamp(st.mood - 6, 0, 100); var pay = 80 + st.skill + rnd(0, 60); st.cash += pay;
            return '完成一个私单：额外收入 +' + pay + ' 元。';
          } },
        { id: 'study', label: '晚间学习', desc: '心情-4，技能+随机', run: function (st) {
            st.mood = clamp(st.mood - 4, 0, 100); var up = rnd(2, 5); st.skill += up;
            if (st.skill >= 80) addAch(st, 'chengshi', 'skill80', '技能尖子');
            return '学习完成：技能 +' + up + '。';
          } },
        { id: 'move', label: '换个住处', desc: '花250元，降租金但通勤变远', need: function (st) { return st.cash >= 250 && st.rent > 120; }, run: function (st) {
            st.cash -= 250; st.rent = Math.max(120, st.rent - rnd(30, 50)); st.mood += 4;
            return '搬进更划算的合租房：月租降到 ' + st.rent + ' 元。';
          } },
        { id: 'promote', label: '争取晋升', desc: '技能≥55、信用≥70 可申请', need: function (st) { return st.skill >= 55 && st.credit >= 70; }, run: function (st) {
            var ok = chance(0.38 + st.skill / 300 + st.credit / 500);
            if (ok) { st.jobLevel++; st.credit = clamp(st.credit + 5, 0, 100); addAch(st, 'chengshi', 'promote', '城市晋升'); return '晋升成功，职级升到 L' + st.jobLevel + '。'; }
            st.skill += 2; return '这次没过，但面试官给了提升建议。';
          } },
        { id: 'rest', label: '给自己放空', desc: '恢复心情，少量花钱', run: function (st) {
            st.cash = Math.max(0, st.cash - 30); st.mood = clamp(st.mood + 16, 0, 100);
            return '看场电影、走一段江边路，心情缓过来了。';
          } },
        { id: 'next', label: '推进一天', cls: 'green', desc: '结算房租与储蓄', run: function (st) {
            st.day++; var dailyRent = Math.ceil(st.rent / 30); st.cash -= dailyRent; st.savings += Math.max(0, Math.floor((st.cash - st.rent) / 20));
            if (st.savings >= 1000) addAch(st, 'chengshi', 'save1000', '第一笔城市存款');
            return '新的一天：房租摊销 -' + dailyRent + ' 元。';
          } }
      ]
    }
  };

  var scene = getParam('scene');
  if (!GAMES[scene]) scene = '';
  var ch = normalizeChannel(getParam('ch') || safeGet(CH_KEY) || 'direct');
  safeSet(CH_KEY, ch);

  var meta = metaLoad();
  meta.visits++;
  meta.channelCounts[ch] = (meta.channelCounts[ch] || 0) + 1;
  if (!meta.firstChannel) meta.firstChannel = ch;
  if (scene) meta.lastScene = scene;
  metaSave(meta);

  var st = scene ? loadSave(scene) : null;
  if (st) {
    var isReturn = st.lastVisit && st.lastVisit !== today();
    st.visits = (st.visits || 0) + 1;
    if (isReturn) {
      st.returns = (st.returns || 0) + 1;
      meta.returns++;
      st.streak = st.lastVisit === yesterday() ? (st.streak || 0) + 1 : 1;
      var bonus = Math.min(CONFIG.returnBonusCap, CONFIG.returnBonusBase + st.streak * CONFIG.returnBonusStep);
      var cur = GAMES[scene].currency;
      st[cur] = (st[cur] || 0) + bonus;
      st.energy = 3;
      if (scene === 'liuxue') st.energy2 = clamp((st.energy2 || 0) + 30, 0, 100);
      st.bonusToday = true;
      pushLog(st, '连续回访第 ' + st.streak + ' 天，补给 +' + bonus + ' 元');
    } else {
      st.bonusToday = false;
    }
    st.lastVisit = today();
    // 奖励：好友推荐识别 + 已达层级补齐 + 回访结伴补给
    recordReferral(st);
    var tierGain = checkTiers(scene, st);
    var refCoin = claimRefReward(st);
    if (refCoin) pushLog(st, '好友结伴补给 +' + refCoin + ' 元');
    refreshBadges(scene, st);
    saveScene(scene, st);
    metaSave(meta);
    if (tierGain.got.length) setTimeout(function () { toast('🎊 层级突破：' + tierGain.got.join('、')); }, 700);
  }

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var d = document.createElement(tag); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; return d; }
  function toast(text) {
    var t = $('toast'); if (!t) return;
    t.textContent = text; t.className = 'toast show';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { t.className = 'toast'; }, 2200);
  }
  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      return Promise.resolve();
    } catch (e) { return Promise.resolve(); }
  }
  function baseLink() { return location.href.split('?')[0].replace(/projects_hub\.html$/, ''); }
  function myCode() {
    return safeGet(CH_KEY + '_code') || (function () {
      var c = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      safeSet(CH_KEY + '_code', c); return c;
    })();
  }
  function shareLink() {
    var code = encodeURIComponent(myCode());
    if (!scene) return baseLink() + 'projects_hub.html?ch=wechat_group&inviter=' + code;
    return baseLink() + scene + '.html?ch=wechat_group&inviter=' + code;
  }
  function shareText() {
    var g = GAMES[scene];
    if (!g) return '真实人生模拟器：村超经理、留学生活、城市人生，点击即玩。';
    var tier = rewardTier(scene, st);
    var lines = [
      '我在《' + g.title + '》玩到第 ' + st.day + ' 天了，现在是「' + tier.name + '」。',
      '微信群和朋友圈点开就能玩，不用下载；带上我的码，双方都有回访补给。',
      shareLink()
    ];
    return lines.join('\n');
  }
  function doShare() {
    st && st.shares++;
    meta.shares++;
    metaSave(meta);
    if (st) saveScene(scene, st);
    copyText(shareText()).then(function () {
      toast('分享文案与链接已复制；发到微信群/朋友圈后明日回来领补给');
      render();
    });
  }
  function copyReport() {
    var g = GAMES[scene];
    var tier = rewardTier(scene, st);
    var badges = refreshBadges(scene, st).list.map(function (b) { return b.em + b.name; }).join(' · ');
    var lines = ['【' + g.title + '战绩卡】'];
    lines.push(tier.em + ' ' + tier.name + '（' + tier.need + '）');
    g.stats.slice(0, 5).forEach(function (s) { lines.push(s.label + '：' + s.fmt(st[s.k] || 0)); });
    lines.push('点亮徽章：' + badges);
    lines.push('连续回访 ' + (st.streak || 0) + ' 天 · 已分享 ' + (st.shares || 0) + ' 次 · 带来伙伴 ' + ((st.ref && st.ref.joined) || 0) + ' 位');
    lines.push(shareLink());
    copyText(lines.join('\n')).then(function () { toast('战绩卡已复制，可直接发群或朋友圈'); });
  }
  function doSurprise() {
    var box = claimSurprise(st);
    if (!box) { toast('今天的惊喜已领过，明天再来'); return; }
    refreshBadges(scene, st); saveScene(scene, st);
    toast(box.em + ' ' + box.name + '：' + box.text + ' +' + box.coin + '（连续第' + st.chestStreak + '天）');
    renderGame();
  }
  function navTo(target) {
    var url = baseLink() + 'projects_hub.html?ch=' + encodeURIComponent(ch);
    if (target && GAMES[target]) url += '&scene=' + target;
    location.href = url;
  }

  function strategyInfo() {
    if (!st) return { stage: 1, title: '阶段1 · 获客冷启动', task: '三个项目均可通过独立链接直接打开，适合微信群、朋友圈和公众号菜单。' };
    var stage = st.day < 2 ? 1 : (st.day < 4 ? 2 : 3);
    var task;
    if (!st.shares) task = '成长任务：点「喊朋友来」复制带推荐码的链接，朋友点开双方都有回访补给。';
    else if (st.chestDay !== today()) task = '成长任务：先领今天的惊喜（连续越久越丰厚），再去做今天的行动。';
    else if (!st.bonusToday) task = '成长任务：明天回来领连续回访补给与结伴补给，连续越久补给越高。';
    else if (stage >= 3) task = '成长任务：复制带称号的战绩卡，发到群里做日榜、朋友圈打卡，吸引朋友带码加入。';
    else task = '成长任务：达成层级条件（见称号）即可领一次性突破奖励，玩得好比玩得久更划算。';
    return {
      stage: stage,
      title: stage === 1 ? '阶段1 · 获客冷启动' : (stage === 2 ? '阶段2 · 复访留存' : '阶段3 · 分享转化'),
      task: task
    };
  }

  function renderHub() {
    $('hubPanel').hidden = false;
    $('heroPanel').hidden = true;
    $('scoreboard').innerHTML = '';
    $('actionPanel').innerHTML = '';
    $('eventPanel').innerHTML = '';
    $('strategyPanel').innerHTML = '';
    var panel = $('hubCardsPanel');
    panel.hidden = false;
    panel.innerHTML = '<h2>选择今天要玩的人生 <small>点击即玩</small></h2><div class="hubcards" id="hubCards"></div>';
    var box = $('hubCards');
    var cards = [
      { s: 'cunchao', icon: '⚽', bg: 'linear-gradient(135deg,#6e4a3a,#8e5a4a)', title: '村超经理', desc: '草根球队 · 赞助赛事 · 乡村热血' },
      { s: 'liuxue', icon: '🎓', bg: 'linear-gradient(135deg,#3a4a6e,#4a5a8e)', title: '留学生活', desc: '签证选课 · 海外打工 · 毕业求职' },
      { s: 'chengshi', icon: '🌏', bg: 'linear-gradient(135deg,#5a3a6e,#7a4a8e)', title: '城市人生', desc: '北上广深 · 租房通勤 · 漂泊记忆' }
    ];
    cards.forEach(function (c) {
      var b = el('button', 'hubcard');
      b.type = 'button';
      b.innerHTML = '<span class="icon" style="background:' + c.bg + '">' + c.icon + '</span>' +
        '<span class="body"><span class="name">' + c.title + '</span><span class="desc">' + c.desc + '</span></span><span class="arrow">›</span>';
      b.onclick = function () { navTo(c.s); };
      box.appendChild(b);
    });
    var info = strategyInfo();
    var sp = $('strategyPanel');
    sp.innerHTML = '<h2>增长策略 <small>本地可见</small></h2><div class="strategy"><span class="stage">' + info.title + '</span><div class="task">' + info.task + '</div>' +
      '<div class="muted" style="margin-top:8px">累计访问 ' + meta.visits + ' 次 · 分享 ' + meta.shares + ' 次 · 首次渠道 ' + channelName(meta.firstChannel) + '</div></div>';
  }

  function cityActions() {
    var cities = [
      { id: '北京', rent: 260, skill: 1, mood: -2 },
      { id: '上海', rent: 280, skill: 1, mood: -2 },
      { id: '广州', rent: 190, skill: 0, mood: 1 },
      { id: '深圳', rent: 240, skill: 1, mood: 0 }
    ];
    return cities.map(function (c) {
      return { id: 'city_' + c.id, label: '落地' + c.id, desc: '月租¥' + c.rent + ' · 开局心情' + (c.mood > 0 ? '较好' : '一般'), cls: 'gold', run: function (s) {
        s.city = c.id; s.rent = c.rent; s.skill += c.skill; s.mood = clamp(s.mood + c.mood, 0, 100);
        pushLog(s, '落脚' + c.id + '，城市人生正式开始。');
        return '落脚 ' + c.id + '：月租 ' + c.rent + ' 元。';
      } };
    });
  }

  function doAction(id) {
    if (!st || !scene) return;
    var actions = (scene === 'chengshi' && !st.city) ? cityActions() : GAMES[scene].actions;
    var a = null;
    for (var i = 0; i < actions.length; i++) if (actions[i].id === id) a = actions[i];
    if (!a) return;
    if (a.need && !a.need(st)) { toast('条件还不够，先做别的攒一攒'); return; }
    var before = st.energy;
    var text = a.run(st);
    pushLog(st, text);
    if (scene === 'cunchao' && before > 0 && st.energy === before && a.id !== 'next') {
      // 兼容未消耗行动的动作，无需处理
    }
    // 每次行动后检查层级突破：玩得好就即时给称号奖励，形成正反馈
    var tg = checkTiers(scene, st);
    if (tg.got.length) text += ' 🎊层级突破：' + tg.got.join('、');
    saveScene(scene, st);
    toast(text);
    renderGame();
  }

  function renderGame() {
    var g = GAMES[scene];
    $('hubPanel').hidden = true;
    $('heroPanel').hidden = false;
    $('hubCardsPanel').hidden = true;
    $('gameTitle').textContent = g.title;
    $('channelBadge').textContent = '渠道：' + channelName(ch) + ' · v' + VERSION;
    var tier = rewardTier(scene, st);
    $('heroTitle').textContent = g.icon + ' ' + g.title;
    $('heroDesc').textContent = tier.em + ' ' + tier.name + ' · 第 ' + st.day + ' 天 · 进度已自动保存';

    $('scoreboard').innerHTML = g.stats.map(function (s) {
      var v = s.fmt ? s.fmt(st[s.k] || 0) : (st[s.k] || 0);
      return '<div class="stat"><div class="k">' + s.label + '</div><div class="v">' + v + '</div></div>';
    }).join('');

    var actions = (scene === 'chengshi' && !st.city) ? cityActions() : g.actions;
    $('actionPanel').innerHTML = '<h2>今日行动 <small>' + (scene === 'chengshi' && !st.city ? '先选城市' : '点一下立即结算') + '</small></h2>' +
      '<div class="grid">' + actions.map(function (a) {
        var disabled = a.need && !a.need(st);
        return '<button type="button" class="action ' + (a.cls || '') + '" data-action="' + a.id + '"' + (disabled ? ' disabled' : '') + '><b>' + a.label + '</b><span>' + a.desc + '</span></button>';
      }).join('') + '</div>';
    Array.prototype.forEach.call($('actionPanel').querySelectorAll('[data-action]'), function (b) {
      b.onclick = function () { doAction(b.getAttribute('data-action')); };
    });

    var logs = (st.log || []).slice(-8).reverse();
    $('eventPanel').innerHTML = '<h2>最近发生 <small>本机记录</small></h2><div class="log">' +
      (logs.length ? logs.map(function (x) { return '<div class="logitem">' + x + '</div>'; }).join('') : '<div class="logitem">还没有事件，点一个行动开始吧。</div>') + '</div>';

    var info = strategyInfo();
    var cta = (st.day >= 3 && (CONFIG.miniGameUrl || CONFIG.mpUrl))
      ? '<div class="minirow">' + (CONFIG.miniGameUrl ? '<button class="iconbtn primary" id="miniBtn" type="button">打开小游戏版</button>' : '') +
        (CONFIG.mpUrl ? '<button class="iconbtn" id="mpBtn" type="button">关注公众号</button>' : '') + '</div>'
      : '<div class="muted" style="margin-top:8px">广告位与公众号跳转位保留在配置中，未配置前不打扰玩家。</div>';
    var badges = refreshBadges(scene, st).list.map(function (b) { return '<span class="badge">' + b.em + ' ' + b.name + '</span>'; }).join('');
    var surpriseReady = st.chestDay !== today();
    $('strategyPanel').innerHTML = '<h2>成长与奖励 <small>逐阶段开启</small></h2><div class="strategy">' +
      '<span class="stage">' + tier.em + ' ' + tier.name + ' · ' + info.title + '</span><div class="task">' + info.task + '</div>' +
      '<div class="badges">' + badges + '</div>' +
      '<div class="minirow"><button class="iconbtn' + (surpriseReady ? ' primary' : '') + '" id="surpriseBtn" type="button"' + (surpriseReady ? '' : ' disabled') + '>' + (surpriseReady ? '🎁 领今日惊喜' : '📦 惊喜已领') + '</button>' +
      '<button class="iconbtn" id="reportBtn" type="button">复制战绩卡</button><button class="iconbtn" id="shareBtn2" type="button">喊朋友来</button></div>' + cta +
      '<div class="muted" style="margin-top:8px">访问 ' + st.visits + ' 次 · 回访 ' + (st.returns || 0) + ' 次 · 分享 ' + (st.shares || 0) + ' 次 · 连续 ' + (st.streak || 0) + ' 天' +
      (st.ref && st.ref.code ? ' · 好友推荐已绑定' : '') + '</div></div>';
    var spb = $('surpriseBtn'); if (spb) spb.onclick = doSurprise;
    var rb = $('reportBtn'); if (rb) rb.onclick = copyReport;
    var sb2 = $('shareBtn2'); if (sb2) sb2.onclick = doShare;
    var mb = $('miniBtn'); if (mb) mb.onclick = function () { location.href = CONFIG.miniGameUrl; };
    var mpb = $('mpBtn'); if (mpb) mpb.onclick = function () { location.href = CONFIG.mpUrl; };

    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-nav') === scene);
    });
  }

  function render() {
    $('channelBadge').textContent = '渠道：' + channelName(ch);
    if (!scene) { renderHub(); return; }
    renderGame();
  }

  $('topBack').onclick = function () { navTo(''); };
  $('shareBtn').onclick = doShare;
  Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (b) {
    b.onclick = function () { navTo(b.getAttribute('data-nav') === 'hub' ? '' : b.getAttribute('data-nav')); };
  });
  render();
})();
