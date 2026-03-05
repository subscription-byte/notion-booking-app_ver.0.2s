/**
 * 予約システム - メッセージテンプレート設定（CommonJS版）
 */

/**
 * LINE通知メッセージテンプレート
 * @param {Object} data - 予約データ
 * @param {string} data.formattedDate - フォーマット済み日時
 * @param {string} data.customerName - 予約者名
 * @param {string} data.remarks - 備考
 * @returns {string} - LINE通知メッセージ
 */
const getLineBookingCompleteMessage = ({ formattedDate, customerName, remarks }) => {
  return `【予約完了】\n\n日付: ${formattedDate}\nお名前: ${customerName}\n${remarks ? `備考: ${remarks}\n` : ''}\n予約が完了しました！\n担当者から折り返しご連絡いたします。`;
};

/**
 * 日時フォーマット関数
 * @param {string} dateTimeStr - ISO形式の日時文字列（例: 2026-03-18T20:00+09:00）
 * @returns {string} - フォーマット済み日時（例: 2026年3月18日 20時）
 */
const formatDateTime = (dateTimeStr) => {
  const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return dateTimeStr;

  const [, year, month, day, hour] = match;
  return `${year}年${parseInt(month)}月${parseInt(day)}日 ${parseInt(hour)}時`;
};

module.exports = {
  getLineBookingCompleteMessage,
  formatDateTime
};
