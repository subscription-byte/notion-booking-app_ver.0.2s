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

/**
 * 指定したweekOffsetの週の日曜日を取得
 * getDay()は日曜=0なので、そのまま日曜基準で計算
 * @param {number} weekOffset - 週オフセット（0=今週, 1=来週, -1=先週）
 * @returns {Date} - その週の日曜日（00:00:00）
 */
export const getSundayOfWeek = (weekOffset = 0) => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=日, 1=月, ..., 6=土
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek + (weekOffset * 7));
  sunday.setHours(0, 0, 0, 0);
  return sunday;
};

/**
 * 指定したweekOffsetの週の全曜日（日〜土）を取得
 * @param {number} weekOffset - 週オフセット（0=今週, 1=来週, -1=先週）
 * @returns {Date[]} - その週の7日分の日付配列（日曜始まり）
 */
export const getWeekDates = (weekOffset = 0) => {
  const sunday = getSundayOfWeek(weekOffset);
  const weekDates = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    weekDates.push(date);
  }

  return weekDates;
};

/**
 * 指定したweekOffsetの週の平日（月〜金）のみを取得
 * @param {number} weekOffset - 週オフセット（0=今週, 1=来週, -1=先週）
 * @returns {Date[]} - その週の平日5日分の日付配列
 */
export const getWeekdayDates = (weekOffset = 0) => {
  const allDates = getWeekDates(weekOffset);
  // 日曜(0)と土曜(6)を除外
  return allDates.filter(date => {
    const day = date.getDay();
    return day !== 0 && day !== 6;
  });
};
