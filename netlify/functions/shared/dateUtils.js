/**
 * 日時フォーマットユーティリティ（共通）
 *
 * ⚠️ タイムゾーン注意事項 ⚠️
 * Netlify Functions はUTCで実行される。
 * Google Calendar API は +09:00 付きのISO 8601形式で日時を返す。
 *
 * - new Date(isoString).getHours()     → UTC時刻を返す（JST換算なし → NG）
 * - new Date(isoString).getUTCHours()  → 同上（UTC時刻 → NG）
 * - 正しいアプローチ: ISO文字列から正規表現で時刻を直接抽出する（下記 formatDateTime, formatBookingDateTime）
 *   または +9h オフセットを手動で加算して UTC メソッドを使う（下記 formatDateJST）
 *
 * ローカル時間依存メソッド（getHours, getDate 等）はNetlify上では使わないこと。
 */

/**
 * ISO日時文字列から「年月日 時」形式を返す
 * 例: "2026-03-18T20:00:00+09:00" → "2026年3月18日 20時"
 *
 * @param {string} isoString - ISO 8601形式（+09:00付き等）
 * @returns {string}
 */
const formatDateTime = (isoString) => {
  // 正規表現でTまでのYYYY-MM-DDThh:mmを抽出 → タイムゾーン影響を受けない
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return isoString;
  const [, year, month, day, hour] = match;
  return `${year}年${parseInt(month)}月${parseInt(day)}日 ${parseInt(hour)}時`;
};

/**
 * ISO日時文字列から日付と時刻を分割して返す
 * 例: "2026-03-18T20:00:00+09:00" → { dateStr: "2026年3月18日", hourStr: "20時" }
 *
 * @param {string} isoString - ISO 8601形式（+09:00付き等）
 * @returns {{ dateStr: string, hourStr: string }}
 */
const formatBookingDateTime = (isoString) => {
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return { dateStr: isoString, hourStr: '' };
  const [, year, month, day, hour] = match;
  return { dateStr: `${year}年${parseInt(month)}月${parseInt(day)}日`, hourStr: `${parseInt(hour)}時` };
};

/**
 * JST調整済みのDateオブジェクトから "YYYY-MM-DD" を返す
 * 使用前に必ずJST変換済みであること（UTC Dateをそのまま渡してはいけない）
 *
 * 正しい使い方:
 *   const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
 *   formatDateJST(jstNow); // → "2026-03-18"
 *
 * @param {Date} jstDate - JST換算済みのDateオブジェクト
 * @returns {string} "YYYY-MM-DD"
 */
const formatDateJST = (jstDate) => {
  return `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}-${String(jstDate.getDate()).padStart(2, '0')}`;
};

module.exports = {
  formatDateTime,
  formatBookingDateTime,
  formatDateJST,
};
