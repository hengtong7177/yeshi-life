// config.js —— 《城角夜市苑》运行时配置
// 广告：首次提审 rewardAdUnitId 留空即可（此时免费试玩补给）。
// 开通流量主后【只需把 rewardAdUnitId 填成真实的 adunit-xxx 即自动启用 IAA】，无需改 enabled。
// 如需临时关闭广告，把 enabled 显式设为 false 且 rewardAdUnitId 留空即可。
// 云存档：如需真云端同步，先开通微信云开发，填写 env，并在控制台创建 collection。
// 好友榜：由 openDataContext/index.js 通过微信关系链数据绘制，主域不读取好友昵称/头像。

var GAME_NAME = '城角夜市苑';
var SHORT_NAME = '夜市苑';
var VERSION = '1.0.1';

var CONFIG = {
  GAME_NAME: GAME_NAME,
  SHORT_NAME: SHORT_NAME,
  VERSION: VERSION,
  AD: {
    enabled: false,
    rewardAdUnitId: ''
  },
  CLOUD: {
    enabled: false,
    env: '',
    collection: 'yeshiyuan_cloud_save',
    slotKey: 'cloudSlotId'
  },
  RANK: {
    scoreKey: 'score',
    dayKey: 'day',
    repKey: 'rep',
    titleKey: 'title',
    title: '城角夜市苑 · 同玩好友榜'
  },
  // 奖励机制 v6：均为本地/合规开关，无付费、无强制分享、无分享即到账
  REWARD: {
    enabled: true,
    surprise: true,      // 每日惊喜（连续回访确定性，不随机付费箱）
    tiers: true,         // 跨层级成长称号 + 一次性金币
    vanity: true,        // 虚荣徽章/战绩卡（只读展示）
    referral: true       // 好友推荐回流补给（不强制分享）
  }
};

function mergeObj(target, source) {
  if (!source || typeof source !== 'object') return target;
  Object.keys(source).forEach(function (k) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      target[k] = mergeObj(target[k] && typeof target[k] === 'object' ? target[k] : {}, source[k]);
    } else {
      target[k] = source[k];
    }
  });
  return target;
}

if (typeof wx !== 'undefined' && wx.getStorageSync) {
  try {
    var override = wx.getStorageSync('yeshiyuan_runtime_config');
    if (override) mergeObj(CONFIG, override);
  } catch (e) {}
}

module.exports = CONFIG;
