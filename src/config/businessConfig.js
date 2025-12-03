/**
 * 予約システム - 営業時間・スケジュール設定
 */

export const BUSINESS_HOURS = {
  startHour: 12,  // 営業開始時刻
  endHour: 21,    // 営業終了時刻
};

/**
 * 時間スロット生成
 * @param {number} startHour - 開始時刻
 * @param {number} endHour - 終了時刻
 * @returns {string[]} - 時間スロットの配列（例: ['12:00', '13:00', ...]）
 */
export const generateTimeSlots = (startHour = BUSINESS_HOURS.startHour, endHour = BUSINESS_HOURS.endHour) => {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return slots;
};
