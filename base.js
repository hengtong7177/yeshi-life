/* 凡人人生模拟器 · 统一底座 v1.0.0
 * 三款 H5 共用：画像识别 / 探奇冷却 / 每日任务 / NPC羁绊 / 勋章 / 复盘金句 / 省电静音 / 跨IP导流
 * 纯前端、零依赖、不上报隐私。所有个性化数据只存 localStorage。
 */
(function (global) {
  'use strict';
  var VERSION = '1.0.0';
  var KEY = 'mortal_base_v1';
  var DAY_MS = 86400000;

  var CONFIG = {
    series: '凡人人生模拟器',
    slogan: '没有开挂逆袭，只有一边取舍，一边慢慢扎根。',
    profileRules: {
      explore: { name: '探索型', logic: '点击图鉴、熟客故事、彩蛋、破局逆境；提高奇遇与隐藏支线概率。' },
      relax: { name: '解压型', logic: '频繁自动经营、跳过精细选择、快速结算；减少繁琐计算，增加温暖治愈事件。' },
      realistic: { name: '写实稳重型', logic: '保守进货、查看盈亏报表、主动复盘、规避风险；增加现实压力与规划文案。' },
      strategy: { name: '策略经营型', logic: '因亏损调整结构、控制库存、反复尝试谈判；开启更细的收支与风险提示。' }
    },
    cooldown: {
      npcPerDay: 1,
      sameEventMaxIn7Days: 2,
      newEventPriority: true,
      recipeNpcTier: '常客',
      skinByDaysNotMoney: true
    },
    daily: {
      resetHour: 0,
      lockedAfterStart: true,
      sideFallbackAfterMiss: 3,
      missedNote: '昨日夜市没有收尾，今天继续出发，补齐你的成长记录。'
    },
    adSlots: [
      { id: 'weather_rescue', name: '化解天气危机', rule: '自愿，不打断流程，仅给一次性规避损耗。' },
      { id: 'clue_extra', name: '线索补片', rule: '自愿，仅补一段图鉴线索。' },
      { id: 'life_subsidy', name: '小额生活补贴', rule: '自愿，金额克制，不制造付费压迫。' },
      { id: 'hidden_story', name: '解锁隐藏故事', rule: '自愿，只开剧情，不卖数值优势。' }
    ],
    artAudio: {
      title: '暖金渐变粗体；叙事正文柔和深灰，行距宽松。',
      options: '朴实接地气，不用夸张网络梗。',
      longText: '长剧情分页，点击继续，禁止弹窗塞满文字。',
      audio: '环境音低音量可关；完美反馈清脆；差评低沉；勋章风铃；复盘舒缓。'
    },
    testPlan: {
      A: '10–20人种子：验证3秒吸引力、首局流失点、任务理解门槛。',
      B: '200–500人灰度：首页点击率、3分钟留存、日任务完成率、7日复玩、海报保存率。',
      C: '压力体验：连续亏损与负面事件，校验善意保底是否生效。'
    },
    ops: {
      preheat: '上线前3天：首页动态截图 + 钩子文案 + 试玩短链。',
      launch: '第1–7天：星火启途，夜市扎根；每日轮换奇遇；鼓励复盘截图。',
      steady: '第8–30天：人间百味，慢慢生长；每周新增熟客故事与短挑战。',
      longterm: '30天后：图鉴页跨游戏导流，共用底座，只换题材资源。'
    },
    redlines: [
      '不渲染恶意竞争、暴力冲突；巡查/管理事件保持正向合规。',
      '苦难但不绝望，冲突导向取舍、理解、成长。',
      '不做充值入口，全部变现依靠自愿激励广告。',
      '文案规避低俗网络梗，保持朴实、治愈、写实。',
      '图鉴页常驻提示：清除浏览器缓存会丢失进度，记得导出存档码。'
    ]
  };

  var PROFILE_TAGS = ['explore', 'relax', 'realistic', 'strategy'];

  var GAMES = {
    yeshi: {
      name: '城角夜市苑',
      main: { id: 'deep', label: '今日深耕：完整完成一次夜市营业', stat: 'main', goal: 1 },
      sides: [
        { id: 'perfect', label: '匠心出品：完美出锅 3 次', stat: 'perfect', goal: 3 },
        { id: 'kind', label: '善意之举：倾听、让步或照顾困境客人', stat: 'kind', goal: 1 },
        { id: 'safe', label: '风险把控：今晚净亏不超过 30 元', stat: 'safe', goal: 1 },
        { id: 'regular', label: '人间相逢：接待 1 位熟客', stat: 'regular', goal: 1 },
        { id: 'stock', label: '经营精进：收摊余货不超过 2 份', stat: 'stock', goal: 1 }
      ],
      easy: [
        { id: 'easy_open', label: '稳稳开摊：完成一次开门营业', stat: 'main', goal: 1 },
        { id: 'easy_review', label: '收摊看一眼复盘，不急着做决定', stat: 'review', goal: 1 }
      ],
      attributes: ['匠心', '阅历', '共情格局', '抗压']
    },
    liuxue: {
      name: '留学生活模拟器',
      main: { id: 'deep', label: '今日深耕：完成当日日程安排（上课 / 兼职 / 自习闭环）', stat: 'main', goal: 1 },
      sides: [
        { id: 'study', label: '潜心研学：高质量完成一次作业', stat: 'study', goal: 1 },
        { id: 'npc', label: '他乡相逢：和一位 NPC 交谈', stat: 'npc', goal: 1 },
        { id: 'budget', label: '收支把控：今日没有超预算消费', stat: 'budget', goal: 1 },
        { id: 'kind', label: '善意之举：帮助身边同学', stat: 'kind', goal: 1 }
      ],
      easy: [
        { id: 'easy_plan', label: '稳稳规划：完成一次学期规划', stat: 'main', goal: 1 },
        { id: 'easy_week', label: '走过一周：处理一次他乡小事', stat: 'week', goal: 1 }
      ],
      attributes: ['治学功底', '阅历见识', '共情格局', '抗压定力']
    },
    cunchao: {
      name: '村超经理',
      main: { id: 'deep', label: '今日深耕：完成当日球队训练 / 比赛日程', stat: 'main', goal: 1 },
      sides: [
        { id: 'tactic', label: '打磨战术：尝试一套新打法', stat: 'tactic', goal: 1 },
        { id: 'fan', label: '接待球迷：回应一次乡亲期待', stat: 'fan', goal: 1 },
        { id: 'pitch', label: '维护场地：完成一次场地维护', stat: 'pitch', goal: 1 },
        { id: 'kind', label: '乡邻同心：照顾一位队员或村民', stat: 'kind', goal: 1 }
      ],
      easy: [
        { id: 'easy_season', label: '稳稳带队：完成一次赛季规划', stat: 'main', goal: 1 },
        { id: 'easy_round', label: '走过一轮：处理一次队内小事', stat: 'round', goal: 1 }
      ],
      attributes: ['执教功底', '赛事阅历', '乡土格局', '逆境韧性']
    }
  };

  var EVENT_LIB = {
    yeshi: [
      {
        id: 'late_worker', category: '温暖奇遇', title: '晚归的打工人',
        text: '夜色很晚，一个背着公文包的客人走过来，看上去满脸疲惫。他说今天加班到深夜，就想吃一碗热乎小吃，不在乎价格高低。',
        choices: [
          { label: '正常报价，用心做好这一份', hint: '匠心+5，好感+1', eff: { growthCraft: 5, bond: 1 }, result: '你把火候看得比小费更重。对方吃完，轻轻点了点头。' },
          { label: '少收一点，送一份小菜', hint: '人情格局+8，潜在熟客', eff: { growthEmpathy: 8, growthPerspective: 2, bond: 1 }, result: '他说下次还来，语气里有一点被照亮的轻松。' },
          { label: '委婉说明食材成本，不优惠', hint: '收益稳定，无属性变化', eff: { coins: 3 }, result: '你把成本讲清楚，对方理解了。生意归生意，也不必勉强。' }
        ]
      },
      {
        id: 'sudden_rain', category: '经营危机', title: '突降阵雨',
        text: '天边突然下起阵雨，客人四散躲开，刚备好的食材容易受潮变质。你现在要怎么处理？',
        choices: [
          { label: '快速收摊，损失部分食材', hint: '抗压+6', eff: { coins: -8, growthResilience: 6 }, result: '收得快，损失可控。你在雨里学会：撤，也是一种经营能力。' },
          { label: '撑伞继续守摊', hint: '客流下降，但可能遇到冒雨熟客', eff: { growthResilience: 4, bond: 1 }, result: '雨里只剩几个人，却有一位老熟客专门绕过来照顾你。' },
          { label: '看激励广告，临时拿到防雨布', hint: '自愿广告分支', eff: { ad: true }, result: '广告位已预留；当前 H5 未接入广告 SDK，不强制触发。' }
        ]
      },
      {
        id: 'peer_talk', category: '抉择博弈', title: '同行摊主过来搭话',
        text: '隔壁摆摊的老板过来闲聊，想和你交换一份小吃配方，但他希望你往后不要和他抢傍晚的客流位置。',
        choices: [
          { label: '交换配方，答应约定', hint: '解锁新菜谱，傍晚客流降低', eff: { badge: 'recipe', growthCraft: 5 }, result: '你有了新配方，也多了一份约束。生意里的取舍，从来不只是账本。' },
          { label: '婉拒交换，维持现状', hint: '无得失，人情小幅上涨', eff: { growthEmpathy: 2 }, result: '你们笑着寒暄，边界也留在了原地。' },
          { label: '坦诚沟通，错开高峰互不竞争', hint: '高格局分支', eff: { growthPerspective: 10, growthEmpathy: 6, bond: 1 }, result: '你们约定错峰出摊。夜市宽了，路也宽了。' }
        ]
      },
      {
        id: 'aunt_story', category: '熟客专属', title: '阿姨的心事',
        text: '经常来的张阿姨今天坐下来，慢慢跟你说起，家里孩子在外打工，平时很少见面，每晚来你摊位坐一会儿，是她一天里最放松的时候。',
        choices: [
          { label: '安静听她讲完，多留一会儿位置', hint: '知己羁绊推进', eff: { growthEmpathy: 8, bond: 2, badge: 'confidant' }, result: '她后来主动帮你介绍街坊客源。有些生意，是从愿意听开始的。' },
          { label: '递上一杯热水，劝她早点回家', hint: '善意抉择', eff: { growthEmpathy: 5, bond: 1 }, result: '她说你像个懂事的孩子，今晚风都没那么冷了。' },
          { label: '礼貌回应，继续照顾客流', hint: '经营优先', eff: { coins: 5 }, result: '你没有怠慢任何人，也只是把话留在了心里。' }
        ]
      }
    ],
    liuxue: [
      {
        id: 'library_senior', category: '温暖奇遇', title: '图书馆偶遇学姐',
        text: '深夜图书馆，一位已经毕业的华人学姐看见你独自啃论文，主动过来和你聊天。她手里有往年课程资料，也跟你讲求职避坑经验。',
        choices: [
          { label: '礼貌请教，交换学习思路', hint: '治学功底+5，好感+1', eff: { gpa: 0.06, language: 3, npc: { professor: 2 } }, result: '你发现资料之外，更重要的是有人告诉你怎么少走弯路。' },
          { label: '买一杯咖啡感谢，换取全套资料', hint: '共情格局+8，潜在贵人', eff: { cash: -28, social: 6, npc: { classmate: 4 } }, result: '她把资料发给你，也说：以后遇到难关，可以来问。' },
          { label: '简单道谢，继续埋头赶论文', hint: '无得失', eff: { mental: 2 }, result: '你继续翻开下一页。安静，也是一种自保。' }
        ]
      },
      {
        id: 'rent_up', category: '现实压力', title: '房东通知涨房租',
        text: '房东发来消息，下个月房租上调。你手头预算本来就紧张。',
        choices: [
          { label: '和房东好好沟通，协商缓涨', hint: '概率成功，共情+6', eff: { cash: -60, social: 5, npc: { roommate: 2 } }, result: '房东同意缓一个月。你把语气放稳，也把账本记更细了。' },
          { label: '立刻寻找新房源，花时间看房', hint: '消耗时间，抗压+5', eff: { cash: -120, mental: -4, visa: 2 }, result: '看房很累，但新住处离学校更近，心里踏实了一点。' },
          { label: '看激励广告，临时找到补贴渠道', hint: '自愿广告分支', eff: { ad: true }, result: '广告位已预留；当前 H5 未接入广告 SDK，不强制触发。' }
        ]
      },
      {
        id: 'shift_exam', category: '抉择博弈', title: '兼职排班和期末考冲突',
        text: '打工店长希望你期末多排班，但是下周有重要闭卷考试。',
        choices: [
          { label: '优先考试，跟店长请假', hint: '保住 GPA，可能失去兼职', eff: { gpa: 0.1, cash: -80, mental: 4, npc: { boss: -4 } }, result: '你守住了复习时间，也接受了这个选择的代价。' },
          { label: '两边兼顾，熬夜两头跑', hint: '学分风险，抗压上涨', eff: { cash: 160, gpa: -0.08, mental: -10 }, result: '钱拿到了，身体也提醒你：不是所有坚持都值得。' },
          { label: '协商调整班次，错开考试周', hint: '高格局分支', eff: { gpa: 0.06, social: 6, npc: { boss: 5 } }, result: '店长答应调整班表。你学会把请求说清楚，而不是硬扛。' }
        ]
      }
    ],
    cunchao: [
      {
        id: 'village_donate', category: '温暖奇遇', title: '乡亲主动捐款赞助',
        text: '训练结束后，几位村民把皱巴巴的零钱塞给你，说：钱不多，给球队买点水。',
        choices: [
          { label: '郑重收下，登记在公示账本里', hint: '经费+，乡土格局+', eff: { cash: 80, rep: 4, npc: { mayor: 3 } }, result: '你把每一笔都记下。信任，是从透明开始的。' },
          { label: '退回钱，只请大家看训练', hint: '人情+，经费不变', eff: { support: 6, npc: { mayor: 2 } }, result: '乡亲们说你有骨气，但心里也惦记着球队。' },
          { label: '看激励广告，争取一份配捐', hint: '自愿广告分支', eff: { ad: true }, result: '广告位已预留；当前 H5 未接入广告 SDK，不强制触发。' }
        ]
      },
      {
        id: 'player_injury', category: '经营危机', title: '主力在拼抢中受伤',
        text: '一次铲抢，队里的中场核心倒在地上，捂着脚踝。队医说至少要养两周，正好赶上关键场次。',
        choices: [
          { label: '让他养伤，绝不冒险', hint: '人情上升，状态下降', eff: { support: 5, form: -5, npc: { star: 4 } }, result: '你坚决让他养伤，队友都说你有人情味。' },
          { label: '启用替补，锻炼新人', hint: '短期平淡，未来受益', eff: { form: 2, support: 3, rep: 2, npc: { coach: 4 } }, result: '新人顶上来，虽然生涩，但拼劲点燃了看台。' },
          { label: '打封闭也要上', hint: '状态高，人情大幅下降', eff: { form: 9, support: -8, npc: { star: -6 } }, result: '他咬牙上场，赛后一瘸一拐。你记住了这次教训。' }
        ]
      },
      {
        id: 'young_join', category: '抉择博弈', title: '年轻少年自荐加入球队',
        text: '一个高中男孩跑到场边，说他放学后可以训练，但家里怕他耽误功课。',
        choices: [
          { label: '答应加入，但先约定学业底线', hint: '长期收益，声望+', eff: { support: 5, form: 3, rep: 3, npc: { coach: 3 } }, result: '你给了他机会，也给了他规矩。球队多了一双腿，也多了一份希望。' },
          { label: '暂时婉拒，等他毕业再来', hint: '稳妥，声望一般', eff: { form: 2 }, result: '男孩点头离开。你说不清这是保护，还是错过。' },
          { label: '让他先当球童，观察一个月', hint: '高格局分支', eff: { support: 4, form: 2, npc: { mayor: 3 } }, result: '一个月后，他成了最懂战术的替补。慢慢来，也能长出根。' }
        ]
      }
    ]
  };

  var BADGES = {
    dayPerfect: { name: '今日圆满', group: '坚守系列', desc: '当日三大闭环任务全部完成' },
   入行微光: { name: '入行微光', group: '初心系列', desc: '完成第一次完整出摊' },
   火候在手: { name: '火候在手', group: '初心系列', desc: '第一次做出完美匠心菜品' },
   初遇故人: { name: '初遇故人', group: '初心系列', desc: '解锁第一位熟客' },
   七日星火: { name: '七日星火', group: '坚守系列', desc: '连续7天完成每日深耕任务' },
   逆风行者: { name: '逆风行者', group: '坚守系列', desc: '极限试炼撑过困难一周' },
   稳守本心: { name: '稳守本心', group: '坚守系列', desc: '遭遇亏损后没有放弃，继续经营' },
   善意微光: { name: '善意微光', group: '人情系列', desc: '完成5次善意抉择事件' },
   人间知己: { name: '人间知己', group: '人情系列', desc: '解锁第一位知己等级熟客' },
   八方来客: { name: '八方来客', group: '人情系列', desc: '收集全部类型食客故事' },
   夜市扎根: { name: '夜市扎根', group: '大成系列', desc: '解锁黄金地段摊位' },
   百味集藏: { name: '百味集藏', group: '大成系列', desc: '收集全部菜品配方' },
   烟火行者: { name: '烟火行者', group: '大成系列', desc: '解锁全部图鉴故事碎片' },
   recipe: { name: '新味入册', group: '人情系列', desc: '通过同行交换获得一份新配方' },
   confidant: { name: '人间知己', group: '人情系列', desc: '在熟客故事里被真正信任' },
   异乡初行: { name: '异乡初行', group: '异乡初行', desc: '完成第一个留学学期' },
   坚守求学: { name: '坚守求学', group: '坚守求学', desc: '在压力学季没有放弃' },
   知己相逢: { name: '知己相逢', group: '知己相逢', desc: '解锁一位留学知己' },
   学成致远: { name: '学成致远', group: '学成致远', desc: '完成全部学期的长期成长' },
   绿茵新兵: { name: '绿茵新兵', group: '绿茵新兵', desc: '完成第一次带队训练' },
   球场守望: { name: '球场守望', group: '球场守望', desc: '维护球场并撑过困难赛季' },
   乡邻同心: { name: '乡邻同心', group: '乡邻同心', desc: '赢得乡亲长期信任' },
   乡土荣光: { name: '乡土荣光', group: '乡土荣光', desc: '完成村超长线目标' }
  };

  var QUOTES = {
    profit: ['收益是回报，用心才是底气。', '生意看盈亏，格局看取舍。', '所有收获，都是时间分配的结果。'],
    smallLoss: ['偶尔亏损不是失败，是摸清行情的学费。', '谋生本就起伏，稳住节奏更重要。', '缺钱、低分都是常态，学会取舍就是成长。'],
    comeback: ['低谷撑住，转机自来。', '熬过冷清时刻，才配得上烟火热闹。', '熬过最难的阶段，眼界自然打开。']
  };

  var CROSS_LINKS = [
    { file: 'index.html', name: '城角夜市苑', desc: '一晚夜市，谋生与人间取舍' },
    { file: 'liuxue.html', name: '留学生活模拟器', desc: '他乡求学，时间金钱心态的持续权衡' },
    { file: 'cunchao.html', name: '村超经理', desc: '草根球场，乡亲热爱与球队经营' },
    { file: 'projects_hub.html', name: '凡人人生模拟器广场', desc: '回到合集入口' }
  ];

  function two(n) { return n < 10 ? '0' + n : String(n); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); }
  function daysAgo(n) { var d = new Date(); d.setTime(d.getTime() - n * DAY_MS); return dayKey(d); }
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
  function safeParse(s, f) { try { return s ? JSON.parse(s) : f; } catch (e) { return f; } }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  var all = safeParse(global.localStorage ? global.localStorage.getItem(KEY) : '', {});
  if (!all || typeof all !== 'object') all = {};

  function saveAll() {
    try { global.localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  }
  function ensure(g) {
    if (!GAMES[g]) g = 'yeshi';
    if (!all[g]) all[g] = {
      v: 1,
      profile: { weights: {}, rounds: [], locked: '', shift: 0 },
      daily: { date: '', started: 0, finished: 0, rewarded: 0, tasks: [], progress: {}, note: '', fails: {} },
      cooldown: { events: [], npc: {} },
      seenEvents: [],
      badges: [],
      settings: { mute: false, eco: false },
      rounds: 0
    };
    var st = all[g];
    if (!st.profile) st.profile = { weights: {}, rounds: [], locked: '', shift: 0 };
    if (!st.daily) st.daily = { date: '', started: 0, finished: 0, rewarded: 0, tasks: [], progress: {}, note: '', fails: {} };
    if (!st.cooldown) st.cooldown = { events: [], npc: {} };
    if (!st.cooldown.events) st.cooldown.events = [];
    if (!st.cooldown.npc) st.cooldown.npc = {};
    if (!st.seenEvents) st.seenEvents = [];
    if (!st.badges) st.badges = [];
    if (!st.settings) st.settings = { mute: false, eco: false };
    return st;
  }

  var current = null;
  var currentEvent = null;
  var currentTab = 'tasks';
  var mounted = false;
  var watcherStarted = false;
  var lastProfile = '';

  function toast(msg) {
    var el = document.getElementById('toast');
    if (el) {
      el.textContent = msg;
      el.className = 'toast show';
      clearTimeout(toast._t);
      toast._t = setTimeout(function () { el.className = 'toast'; }, 2400);
    } else if (global.console && console.log) console.log('[MortalBase] ' + msg);
  }

  function weightsOf(st) {
    var w = { explore: 0, relax: 0, realistic: 0, strategy: 0 };
    var rounds = st.profile.rounds || [];
    for (var i = 0; i < rounds.length; i++) {
      for (var k in w) w[k] += Number(rounds[i][k] || 0);
    }
    return w;
  }

  function profileLabel() {
    if (!current) return '未初始化';
    var st = ensure(current), w = weightsOf(st), best = '', max = -1, second = -1;
    for (var i = 0; i < PROFILE_TAGS.length; i++) {
      var k = PROFILE_TAGS[i];
      if (w[k] > max) { second = max; max = w[k]; best = k; }
      else if (w[k] > second) second = w[k];
    }
    if (!best || max <= 0) return st.profile.locked ? CONFIG.profileRules[st.profile.locked].name : '均衡混合池';
    if (max - second <= 3) return '均衡混合池';
    return CONFIG.profileRules[best].name;
  }

  function track(tag, n) {
    if (!current || PROFILE_TAGS.indexOf(tag) < 0) return;
    var st = ensure(current);
    if (!st.profile.current) st.profile.current = { explore: 0, relax: 0, realistic: 0, strategy: 0 };
    st.profile.current[tag] += (n || 1);
    var label = profileLabel();
    if (st.profile.locked && label !== st.profile.locked && label !== '均衡混合池') st.profile.shift = (st.profile.shift || 0) + 1;
    else if (label === st.profile.locked) st.profile.shift = 0;
    if (st.profile.shift >= 5) { st.profile.locked = label; st.profile.shift = 0; }
    saveAll();
    if (label !== lastProfile) { lastProfile = label; renderPanel(); }
  }

  function taskPool(g) { return GAMES[g] || GAMES.yeshi; }
  function findTask(g, id) {
    var pool = taskPool(g);
    if (pool.main.id === id) return pool.main;
    var arr = pool.sides.concat(pool.easy || []);
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  function startDay() {
    if (!current) return null;
    var st = ensure(current), d = st.daily, key = today();
    if (d.date === key && d.started && d.tasks && d.tasks.length) return d;
    if (d.date && d.date !== key && d.started && !d.rewarded) d.note = CONFIG.daily.missedNote;
    var pool = taskPool(current);
    var sides = shuffle(pool.sides);
    for (var i = 0; i < sides.length; i++) {
      if ((d.fails && d.fails[sides[i].id] >= CONFIG.daily.sideFallbackAfterMiss) && pool.easy && pool.easy.length) {
        sides[i] = pool.easy[i % pool.easy.length];
      }
    }
    d.date = key;
    d.started = 1;
    d.finished = 0;
    d.rewarded = 0;
    d.progress = {};
    d.tasks = [pool.main.id, sides[0].id, sides[1] ? sides[1].id : sides[0].id];
    saveAll(); renderPanel();
    return d;
  }

  function taskProgress(stat, n) {
    if (!current) return;
    var st = ensure(current), d = st.daily;
    startDay();
    for (var i = 0; i < d.tasks.length; i++) {
      var t = findTask(current, d.tasks[i]);
      if (t && t.stat === stat) d.progress[t.id] = Math.min(t.goal, (d.progress[t.id] || 0) + (n || 1));
    }
    saveAll(); renderPanel();
  }

  function allTasksDone() {
    if (!current) return false;
    var st = ensure(current), d = st.daily, ok = true;
    for (var i = 0; i < d.tasks.length; i++) {
      var t = findTask(current, d.tasks[i]);
      if (t && (d.progress[t.id] || 0) < t.goal) ok = false;
    }
    return !!ok;
  }

  function finishDay() {
    if (!current) return false;
    var st = ensure(current), d = st.daily;
    if (!d.started || d.date !== today() || d.finished) return false;
    d.finished = 1;
    var i, t;
    for (i = 1; i < d.tasks.length; i++) {
      t = findTask(current, d.tasks[i]);
      if (t && (d.progress[t.id] || 0) < t.goal) d.fails[t.id] = (d.fails[t.id] || 0) + 1;
      else if (t) d.fails[t.id] = 0;
    }
    if (allTasksDone() && !d.rewarded) {
      d.rewarded = 1;
      var hooks = global.MORTAL_GAME_HOOKS;
      if (hooks && hooks.grant) hooks.grant({ dayReward: 15 }, { id: 'daily_done', title: '今日深耕圆满' }, { label: '完成每日任务' });
      grantBadge('dayPerfect');
      toast('🏅 今日深耕圆满：底座奖励已结算');
    }
    var cur = st.profile.current || {};
    st.profile.rounds.push(clone(cur));
    if (st.profile.rounds.length > 3) st.profile.rounds.shift();
    st.profile.current = { explore: 0, relax: 0, realistic: 0, strategy: 0 };
    st.rounds = (st.rounds || 0) + 1;
    saveAll(); renderPanel();
    return true;
  }

  function canEvent(category, id) {
    if (!current) return false;
    var st = ensure(current), arr = st.cooldown.events || [], since = daysAgo(6), count = 0;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].date >= since && arr[i].category === category) count++;
    }
    return count < CONFIG.cooldown.sameEventMaxIn7Days;
  }

  function markEvent(category, id) {
    if (!current) return;
    var st = ensure(current);
    st.cooldown.events.push({ date: today(), category: category, id: id, at: Date.now() });
    if (st.cooldown.events.length > 80) st.cooldown.events = st.cooldown.events.slice(-80);
    if (st.seenEvents.indexOf(id) < 0) st.seenEvents.push(id);
    saveAll();
  }

  function rollEvent(category) {
    if (!current) return null;
    var list = (EVENT_LIB[current] || []).filter(function (e) {
      return (!category || e.category === category) && canEvent(e.category, e.id);
    });
    var unseen = list.filter(function (e) { return ensure(current).seenEvents.indexOf(e.id) < 0; });
    var chosen = unseen.length ? pick(unseen) : pick(list);
    currentEvent = chosen || null;
    renderPanel();
    return currentEvent;
  }

  function applyEventChoice(idx) {
    if (!current || !currentEvent) return false;
    var ev = currentEvent, ch = ev.choices[idx];
    if (!ch) return false;
    var hooks = global.MORTAL_GAME_HOOKS;
    if (hooks && hooks.grant) hooks.grant(ch.eff || {}, ev, ch);
    if (ch.eff && ch.eff.badge) grantBadge(ch.eff.badge);
    if (ch.eff && ch.eff.bond) track('explore', 1);
    markEvent(ev.category, ev.id);
    currentEvent = null;
    toast(ch.result || '奇遇已结算');
    saveAll(); renderPanel();
    return true;
  }

  function npcAffinity(id, delta) {
    if (!current || !delta || delta < 0) return false;
    var st = ensure(current), key = today();
    if (st.cooldown.npc[id] === key) { toast('这位 NPC 今天的好感已到上限，明天再见。'); return false; }
    st.cooldown.npc[id] = key;
    var hooks = global.MORTAL_GAME_HOOKS;
    if (hooks && hooks.grant) hooks.grant({ npc: {} }, { id: 'npc_' + id, title: 'NPC羁绊' }, { label: '每日好感 +1' });
    saveAll(); toast('🤝 ' + id + ' 今日好感进度已完成');
    return true;
  }

  function grantBadge(id) {
    if (!current || !id) return false;
    var st = ensure(current), meta = BADGES[id] || { name: id, group: '成长图鉴', desc: '完成一项长期成长' };
    for (var i = 0; i < st.badges.length; i++) if (st.badges[i].id === id) return false;
    st.badges.push({ id: id, name: meta.name, group: meta.group, desc: meta.desc, date: today() });
    saveAll(); renderPanel();
    toast('🏅 新勋章：' + meta.name);
    return true;
  }

  function reviewQuote(outcome) {
    if (outcome === 'profit') return pick(QUOTES.profit);
    if (outcome === 'comeback') return pick(QUOTES.comeback);
    return pick(QUOTES.smallLoss);
  }

  function applySettings() {
    if (!current) return;
    var st = ensure(current);
    try {
      document.body.classList.toggle('mortal-eco', !!st.settings.eco);
      global.__MORTAL_MUTED__ = !!st.settings.mute;
      var media = document.querySelectorAll('audio,video');
      for (var i = 0; i < media.length; i++) media[i].muted = !!st.settings.mute;
    } catch (e) {}
    var hooks = global.MORTAL_GAME_HOOKS;
    if (hooks && hooks.setMuted) hooks.setMuted(!!st.settings.mute);
    saveAll();
  }

  function setSetting(k, v) {
    if (!current || (k !== 'mute' && k !== 'eco')) return;
    var st = ensure(current);
    st.settings[k] = !!v;
    applySettings(); renderPanel();
  }

  function baseUrl() {
    return location.href.split('?')[0].replace(/[^/]*$/, '');
  }

  function crossHTML() {
    var params = '?ch=hub';
    try {
      var code = global.localStorage.getItem('yeshi_projects_channel_v1_code');
      if (code) params += '&inviter=' + encodeURIComponent(code);
    } catch (e) {}
    return CROSS_LINKS.map(function (x) {
      return '<a href="' + esc(baseUrl() + x.file + params) + '"><b>' + esc(x.name) + '</b><span>' + esc(x.desc) + '</span></a>';
    }).join('');
  }

  function taskHTML() {
    var st = ensure(current), d = st.daily, html = '';
    startDay();
    html += '<div class="mb-row"><span>当前画像</span><b>' + esc(profileLabel()) + '</b></div>';
    html += '<div class="mb-row"><span>今日进度</span><b>' + (d.rewarded ? '已圆满' : (d.finished ? '已收尾' : '进行中')) + '</b></div>';
    if (d.note) html += '<div class="mb-note">' + esc(d.note) + '</div>';
    for (var i = 0; i < d.tasks.length; i++) {
      var t = findTask(current, d.tasks[i]);
      if (!t) continue;
      var cur = Math.min(t.goal, d.progress[t.id] || 0);
      html += '<div class="mb-task ' + (cur >= t.goal ? 'done' : '') + '"><span>' + (cur >= t.goal ? '✅' : '⬜') + ' ' + esc(t.label) + '</span><b>' + cur + '/' + t.goal + '</b></div>';
    }
    html += '<div class="mb-mini">连续 5 局行为转向后自动切换偏好池；画像权重只存本机，不上报。</div>';
    return html;
  }

  function eventHTML() {
    var st = ensure(current);
    if (!currentEvent) {
      var n = (EVENT_LIB[current] || []).length;
      return '<div class="mb-mini">当前题材共有 ' + n + ' 条底座奇遇。同类奇遇 7 天内最多 2 次，未见过的优先投放。</div><button class="mb-btn" data-mb-act="roll">抽取今日奇遇</button>';
    }
    var h = '<h4>' + esc(currentEvent.category) + ' · ' + esc(currentEvent.title) + '</h4><p class="mb-story">' + esc(currentEvent.text) + '</p>';
    currentEvent.choices.forEach(function (c, i) {
      h += '<button class="mb-choice" data-mb-choice="' + i + '"><b>' + esc(c.label) + '</b><span>' + esc(c.hint) + '</span></button>';
    });
    return h;
  }

  function badgeHTML() {
    var st = ensure(current), owned = {}, i;
    for (i = 0; i < st.badges.length; i++) owned[st.badges[i].id] = 1;
    var groups = {};
    for (var id in BADGES) {
      var b = BADGES[id], g = b.group || '成长图鉴';
      if (!groups[g]) groups[g] = [];
      groups[g].push('<span class="mb-badge ' + (owned[id] ? 'on' : '') + '">' + (owned[id] ? '🏅' : '·') + ' ' + esc(b.name) + '</span>');
    }
    var html = '<div class="mb-mini">已解锁 ' + st.badges.length + ' 枚 · 清除浏览器缓存会丢失进度，记得导出存档码。</div>';
    for (var g in groups) html += '<div class="mb-group"><b>' + esc(g) + '</b><div>' + groups[g].join('') + '</div></div>';
    return html;
  }

  function settingHTML() {
    var st = ensure(current);
    return '<div class="mb-row"><span>静音总开关</span><button class="mb-toggle" data-mb-act="mute">' + (st.settings.mute ? '已开启' : '已关闭') + '</button></div>' +
      '<div class="mb-row"><span>简约省电模式</span><button class="mb-toggle" data-mb-act="eco">' + (st.settings.eco ? '已开启' : '已关闭') + '</button></div>' +
      '<div class="mb-mini">省电模式关闭粒子与呼吸动画，降低动态人流帧数，不丢核心玩法。</div>' +
      '<h4>跨作品导流</h4><div class="mb-links">' + crossHTML() + '</div>' +
      '<h4>长期红线</h4><div class="mb-mini">' + CONFIG.redlines.map(function (x) { return '· ' + esc(x); }).join('<br>') + '</div>';
  }

  function renderPanel() {
    if (!mounted || !current) return;
    var body = document.getElementById('mbBody');
    if (!body) return;
    var tabs = document.getElementById('mbTabs');
    if (tabs) {
      var defs = [['tasks', '任务'], ['event', '奇遇'], ['badge', '徽章'], ['set', '设置']];
      tabs.innerHTML = defs.map(function (d) { return '<button data-mb-tab="' + d[0] + '" class="' + (currentTab === d[0] ? 'on' : '') + '">' + d[1] + '</button>'; }).join('');
    }
    if (currentTab === 'tasks') body.innerHTML = taskHTML();
    else if (currentTab === 'event') body.innerHTML = eventHTML();
    else if (currentTab === 'badge') body.innerHTML = badgeHTML();
    else body.innerHTML = settingHTML();
  }

  function css() {
    if (document.getElementById('mbCss')) return;
    var s = document.createElement('style');
    s.id = 'mbCss';
    s.textContent = [
      '#mbFab{position:fixed;right:8px;bottom:76px;z-index:99998;border:0;border-radius:18px;padding:7px 10px;background:linear-gradient(135deg,#6d5324,#c99a3b);color:#fff;font:600 12px/1.2 system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.28)}',
      '#mbPanel{position:fixed;right:8px;bottom:116px;z-index:99999;width:min(340px,calc(100vw - 16px));max-height:68vh;overflow:auto;background:rgba(18,20,24,.96);color:#f4e9cf;border:1px solid rgba(225,188,104,.35);border-radius:14px;box-shadow:0 12px 34px rgba(0,0,0,.42);padding:10px;font:13px/1.5 system-ui,sans-serif;display:none}',
      '#mbPanel.show{display:block}#mbPanel h4{margin:8px 0 5px;color:#ffd77a;font-size:14px}#mbTabs{display:flex;gap:5px;margin-bottom:8px}#mbTabs button{flex:1;border:0;border-radius:8px;padding:6px 2px;background:#2b2e35;color:#d9d2c4}#mbTabs button.on{background:#b88936;color:#fff}',
      '.mb-row{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.08)}.mb-task{display:flex;justify-content:space-between;gap:6px;padding:5px 0}.mb-task.done{color:#9ee6a8}.mb-note,.mb-mini{font-size:11px;color:#c8bfa9;margin:6px 0}.mb-story{font-size:12px;color:#efe4cc;margin:5px 0}',
      '.mb-btn,.mb-toggle,.mb-choice{width:100%;border:1px solid rgba(255,215,122,.35);border-radius:9px;background:#2a2d34;color:#f4e9cf;padding:7px;margin:4px 0;text-align:left}.mb-choice b{display:block;color:#ffd77a}.mb-choice span{font-size:11px;color:#c8bfa9}.mb-badge{display:inline-block;margin:3px;padding:3px 7px;border-radius:10px;background:#2b2e35;color:#8f8b82;font-size:11px}.mb-badge.on{background:#6d5324;color:#fff}.mb-group{margin:7px 0}.mb-links a{display:block;color:#ffd77a;text-decoration:none;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.08)}.mb-links span{display:block;color:#c8bfa9;font-size:11px}.mortal-eco #mbFab{box-shadow:none}'
    ].join('');
    document.head.appendChild(s);
  }

  function closestButton(node) {
    while (node && node !== document) {
      if (node.tagName === 'BUTTON' || node.tagName === 'A') return node;
      node = node.parentNode;
    }
    return null;
  }

  function inPanel(node) {
    while (node && node !== document) {
      if (node.id === 'mbPanel' || node.id === 'mbFab') return true;
      node = node.parentNode;
    }
    return false;
  }

  function bindDoc() {
    document.addEventListener('click', function (e) {
      if (!current || inPanel(e.target)) return;
      var b = closestButton(e.target);
      if (!b) return;
      var id = b.id || '';
      var txt = (b.textContent || '').replace(/\s+/g, '');
      if (id === 'openBtn' || id === 'startTerm' || id === 'startSeason') { startDay(); taskProgress('main', 1); }
      if (id === 'yStockBuyBtn' || txt.indexOf('库存') >= 0 || txt.indexOf('进货') >= 0 || txt.indexOf('选课') >= 0 || txt.indexOf('战术') >= 0) track('strategy', 1);
      if (id === 'cyAutoBtn' || id === 'autoDo' || (id === 'modeBtn' && txt.indexOf('自动') >= 0)) track('relax', 1);
      if (txt.indexOf('图鉴') >= 0 || txt.indexOf('熟客') >= 0 || txt.indexOf('故事') >= 0 || txt.indexOf('海报') >= 0 || txt.indexOf('奇遇') >= 0) track('explore', 1);
      if (txt.indexOf('复盘') >= 0 || txt.indexOf('账本') >= 0 || txt.indexOf('报表') >= 0 || txt.indexOf('盈亏') >= 0) { track('realistic', 1); taskProgress('review', 1); }
    }, true);
  }

  function startWatcher() {
    if (watcherStarted) return;
    watcherStarted = true;
    setInterval(function () {
      if (!current) return;
      var result = document.getElementById('result');
      if (result && /(^|\s)on(\s|$)/.test(result.className)) finishDay();
      var play = document.getElementById('playPanel');
      if (play && /期末复盘|赛季收官|最终人生报告|最终村超报告/.test(play.textContent || '')) finishDay();
    }, 1200);
  }

  function mount() {
    if (mounted || !document.body) return;
    mounted = true;
    css();
    var fab = document.createElement('button');
    fab.id = 'mbFab';
    fab.type = 'button';
    fab.textContent = '凡人底座';
    var panel = document.createElement('div');
    panel.id = 'mbPanel';
    panel.innerHTML = '<div id="mbTabs"></div><div id="mbBody"></div>';
    document.body.appendChild(fab);
    document.body.appendChild(panel);
    fab.onclick = function () { panel.classList.toggle('show'); if (panel.classList.contains('show')) renderPanel(); };
    panel.addEventListener('click', function (e) {
      var tab = closestButton(e.target);
      if (tab && tab.getAttribute && tab.getAttribute('data-mb-tab')) {
        currentTab = tab.getAttribute('data-mb-tab'); renderPanel(); return;
      }
      var act = closestButton(e.target);
      if (act && act.getAttribute && act.getAttribute('data-mb-act')) {
        var a = act.getAttribute('data-mb-act');
        if (a === 'roll') rollEvent();
        else if (a === 'mute') setSetting('mute', !ensure(current).settings.mute);
        else if (a === 'eco') setSetting('eco', !ensure(current).settings.eco);
        return;
      }
      var choice = closestButton(e.target);
      if (choice && choice.getAttribute && choice.getAttribute('data-mb-choice') !== null && choice.getAttribute('data-mb-choice') !== undefined) {
        applyEventChoice(Number(choice.getAttribute('data-mb-choice')));
      }
    });
    bindDoc();
    startWatcher();
    applySettings();
  }

  var api = {
    version: VERSION,
    config: CONFIG,
    games: GAMES,
    events: EVENT_LIB,
    badges: BADGES,
    quotes: QUOTES,
    init: function (g, opts) {
      current = GAMES[g] ? g : 'yeshi';
      opts = opts || {};
      if (opts.name) GAMES[current].name = opts.name;
      ensure(current);
      applySettings();
      mount();
      renderPanel();
      return api;
    },
    track: track,
    profile: profileLabel,
    startDay: startDay,
    taskProgress: taskProgress,
    finishDay: finishDay,
    canEvent: canEvent,
    rollEvent: rollEvent,
    applyEventChoice: applyEventChoice,
    npcAffinity: npcAffinity,
    grantBadge: grantBadge,
    reviewQuote: reviewQuote,
    setSetting: setSetting,
    state: function (g) { return clone(ensure(g || current || 'yeshi')); },
    exportCode: function (g) { try { return btoa(unescape(encodeURIComponent(JSON.stringify(ensure(g || current || 'yeshi'))))); } catch (e) { return ''; } },
    importCode: function (code, g) { try { var o = JSON.parse(decodeURIComponent(escape(atob(code)))); if (!o || typeof o !== 'object') return false; all[g || current || 'yeshi'] = o; saveAll(); return true; } catch (e) { return false; } }
  };

  global.MortalBase = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})(window);
