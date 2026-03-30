/**
 * 予約システム - メッセージテンプレート設定（CommonJS版）
 */
const { formatDateTime } = require('./dateUtils');

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


module.exports = {
  getLineBookingCompleteMessage,
  formatDateTime
};
