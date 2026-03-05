/**
 * 予約システム - 共通定数（CommonJS版）
 */

/**
 * システム設定
 */
const SYSTEM_CONFIG = {
  // デフォルト値
  defaultAssignee: '町谷有里',      // デフォルト担当者名

  // 時間定数（ミリ秒）
  HOUR_MS: 60 * 60 * 1000,          // 1時間
  DAY_MS: 24 * 60 * 60 * 1000,      // 1日

  // クエリ設定
  defaultQueryRangeDays: 30,        // デフォルトクエリ範囲（日）
};

module.exports = {
  SYSTEM_CONFIG
};
