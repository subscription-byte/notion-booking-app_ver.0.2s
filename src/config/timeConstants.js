/**
 * 予約システム - 時間定数
 * よく使う時間単位を定義
 */

import timeConstantsData from './data/timeConstants.json';

// ミリ秒単位の時間定数
export const TIME_MS = timeConstantsData.timeMs;

// 分単位の時間定数
export const TIME_MINUTES = timeConstantsData.timeMinutes;

// 日単位の時間定数
export const TIME_DAYS = timeConstantsData.timeDays;

// 週単位の時間定数
export const TIME_WEEKS = timeConstantsData.timeWeeks;

// リトライ遅延（ミリ秒）
export const RETRY_DELAYS = timeConstantsData.retryDelays;

/**
 * ヘルパー関数: 分をミリ秒に変換
 */
export const minutesToMs = (minutes) => minutes * TIME_MS.MINUTE;

/**
 * ヘルパー関数: 日をミリ秒に変換
 */
export const daysToMs = (days) => days * TIME_MS.DAY;

/**
 * ヘルパー関数: 週をミリ秒に変換
 */
export const weeksToMs = (weeks) => weeks * TIME_MS.WEEK;
