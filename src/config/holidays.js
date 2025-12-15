/**
 * 予約システム - 祝日・休業日データ
 */

/**
 * 2025年の祝日リスト
 */
export const HOLIDAYS_2025 = [
  '2025-01-01', // 元日
  '2025-01-13', // 成人の日
  '2025-02-11', // 建国記念の日
  '2025-02-23', // 天皇誕生日
  '2025-03-20', // 春分の日
  '2025-04-29', // 昭和の日
  '2025-05-03', // 憲法記念日
  '2025-05-04', // みどりの日
  '2025-05-05', // こどもの日
  '2025-07-21', // 海の日
  '2025-08-11', // 山の日
  '2025-09-15', // 敬老の日
  '2025-09-23', // 秋分の日
  '2025-10-13', // スポーツの日
  '2025-11-03', // 文化の日
  '2025-11-23', // 勤労感謝の日
];

/**
 * 2026年の祝日リスト
 */
export const HOLIDAYS_2026 = [
  '2026-01-01', // 元日
  '2026-01-12', // 成人の日
  '2026-02-11', // 建国記念の日
  '2026-02-23', // 天皇誕生日
  '2026-03-20', // 春分の日
  '2026-04-29', // 昭和の日
  '2026-05-03', // 憲法記念日
  '2026-05-04', // みどりの日
  '2026-05-05', // こどもの日
  '2026-05-06', // 憲法記念日 振替休日
  '2026-07-20', // 海の日
  '2026-08-11', // 山の日
  '2026-09-21', // 敬老の日
  '2026-09-22', // 国民の休日
  '2026-09-23', // 秋分の日
  '2026-10-12', // スポーツの日
  '2026-11-03', // 文化の日
  '2026-11-23', // 勤労感謝の日
];

/**
 * 全祝日リスト（2025年 + 2026年）
 */
const ALL_HOLIDAYS = [...HOLIDAYS_2025, ...HOLIDAYS_2026];

/**
 * 会社休業日（祝日以外の特別休業日）
 * 年末年始休業: 2025/12/27（土）～2026/1/4（日）のうち祝日以外
 */
export const COMPANY_CLOSED_DAYS = [
  '2025-12-29', // 月曜
  '2025-12-30', // 火曜
  '2025-12-31', // 水曜
  '2026-01-02', // 金曜
  '2026-01-03', // 土曜
  // 2025-12-27（土）, 12-28（日）, 2026-01-01（祝日）, 01-04（日）は土日祝で自動除外されるため不要
];

/**
 * 日付が祝日かどうかを判定
 * @param {Date} date - 判定する日付
 * @returns {boolean} - 祝日の場合 true
 */
export const isHoliday = (date) => {
  // ローカル日付を YYYY-MM-DD 形式に変換（タイムゾーンの影響を受けない）
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  return ALL_HOLIDAYS.includes(dateString);
};

/**
 * 日付が会社休業日かどうかを判定
 * @param {Date} date - 判定する日付
 * @returns {boolean} - 会社休業日の場合 true
 */
export const isCompanyClosedDay = (date) => {
  // ローカル日付を YYYY-MM-DD 形式に変換（タイムゾーンの影響を受けない）
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  return COMPANY_CLOSED_DAYS.includes(dateString);
};

/**
 * 日付が予約不可日かどうかを判定（祝日 or 会社休業日）
 * @param {Date} date - 判定する日付
 * @returns {boolean} - 予約不可の場合 true
 */
export const isUnavailableDay = (date) => {
  return isHoliday(date) || isCompanyClosedDay(date);
};
