/**
 * 予約システム - 時間定数（CommonJS版）
 * よく使う時間単位を定義
 */

const timeConstantsData = require('../../../src/config/data/timeConstants.json');

// ミリ秒単位の時間定数
const TIME_MS = timeConstantsData.timeMs;

// 分単位の時間定数
const TIME_MINUTES = timeConstantsData.timeMinutes;

// 日単位の時間定数
const TIME_DAYS = timeConstantsData.timeDays;

// 週単位の時間定数
const TIME_WEEKS = timeConstantsData.timeWeeks;

// リトライ遅延（ミリ秒）
const RETRY_DELAYS = timeConstantsData.retryDelays;

/**
 * ヘルパー関数: 分をミリ秒に変換
 */
const minutesToMs = (minutes) => minutes * TIME_MS.MINUTE;

/**
 * ヘルパー関数: 日をミリ秒に変換
 */
const daysToMs = (days) => days * TIME_MS.DAY;

/**
 * ヘルパー関数: 週をミリ秒に変換
 */
const weeksToMs = (weeks) => weeks * TIME_MS.WEEK;

module.exports = {
  TIME_MS,
  TIME_MINUTES,
  TIME_DAYS,
  TIME_WEEKS,
  RETRY_DELAYS,
  minutesToMs,
  daysToMs,
  weeksToMs
};
