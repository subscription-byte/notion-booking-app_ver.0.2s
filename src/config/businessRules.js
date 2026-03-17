/**
 * 予約システム - ビジネスルール設定
 * フロントエンド・バックエンド共通で使用
 */

import holidaysData from './data/holidays.json';
import blockingRulesData from './data/blockingRules.json';
import businessHoursData from './data/businessHours.json';
import timeConstantsData from './data/timeConstants.json';

/**
 * 祝日リスト
 */
export const HOLIDAYS = holidaysData.holidays;

/**
 * 会社休業日
 */
export const COMPANY_CLOSED_DAYS = holidaysData.companyClosedDays;

/**
 * 固定ブロックルール
 * dayOfWeek: 曜日（0=日, 1=月, ..., 6=土）、nullの場合は全曜日対象
 * excludeDays: 除外する曜日の配列
 * startHour, endHour: ブロック時間（24時間表記、JST基準）
 */
export const FIXED_BLOCKING_RULES = blockingRulesData.fixedBlockingRules;

/**
 * 営業時間設定
 */
export const BUSINESS_HOURS = businessHoursData;

/**
 * ブロック時間設定
 */
export const BLOCKING_SETTINGS = blockingRulesData.blockingSettings;

/**
 * 祝日または会社休業日かチェック
 */
export const isHoliday = (date) => {
  const dateString = date.toISOString().split('T')[0];
  return HOLIDAYS.includes(dateString) || COMPANY_CLOSED_DAYS.includes(dateString);
};

/**
 * 固定ブロック時間かチェック
 */
export const isFixedBlockedTime = (date, timeHour) => {
  const dayOfWeek = date.getDay();
  for (const rule of FIXED_BLOCKING_RULES) {
    if (rule.dayOfWeek !== null && rule.dayOfWeek !== dayOfWeek) continue;
    if (rule.excludeDays && rule.excludeDays.includes(dayOfWeek)) continue;
    if (timeHour >= rule.startHour && timeHour < rule.endHour) return true;
  }
  return false;
};

/**
 * 対面通話によるブロックかチェック
 */
export const isInPersonBlocked = (event, slotStart, slotEnd) => {
  const TIME_MS = timeConstantsData.timeMs;

  const eventStart = event.start?.dateTime || event.start?.date;
  const eventEnd = event.end?.dateTime || event.end?.date;
  const extendedProps = event.extendedProperties?.private || {};
  const callMethod = extendedProps.callMethod;
  const eventName = event.summary || '';
  const colorId = event.colorId || '';

  if (!eventStart) return false;

  const isInPerson = callMethod === '対面' || eventName.includes('対面') || colorId === '1';
  if (!isInPerson) return false;

  const existingStart = new Date(eventStart);
  const existingEnd = new Date(eventEnd || new Date(existingStart.getTime() + TIME_MS.HOUR));
  const blockStart = new Date(existingStart.getTime() - BLOCKING_SETTINGS.inPerson.beforeHours * TIME_MS.HOUR);
  const blockEnd = new Date(existingEnd.getTime() + BLOCKING_SETTINGS.inPerson.afterHours * TIME_MS.HOUR);

  return (blockStart < slotEnd && blockEnd > slotStart);
};

/**
 * 撮影によるブロックかチェック
 */
export const isShootingBlocked = (event, slotStart, slotEnd) => {
  const TIME_MS = timeConstantsData.timeMs;

  const eventStart = event.start?.dateTime || event.start?.date;
  const eventEnd = event.end?.dateTime || event.end?.date;
  const extendedProps = event.extendedProperties?.private || {};
  const callMethod = extendedProps.callMethod;
  const eventName = event.summary || '';
  const colorId = event.colorId || '';

  if (!eventStart) return false;

  const isShooting = callMethod === '撮影' || eventName.includes('撮影') || colorId === '3';
  if (!isShooting) return false;

  const existingStart = new Date(eventStart);
  const existingEnd = new Date(eventEnd || new Date(existingStart.getTime() + TIME_MS.HOUR));

  const dayStart = new Date(existingStart);
  dayStart.setHours(BLOCKING_SETTINGS.shooting.startHour, 0, 0, 0);
  const blockEnd = new Date(existingEnd.getTime() + BLOCKING_SETTINGS.shooting.afterHours * TIME_MS.HOUR);

  return (dayStart <= slotEnd && blockEnd >= slotStart);
};
