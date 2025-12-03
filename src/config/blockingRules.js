/**
 * 予約システム - ブロック時間ルール設定
 */

/**
 * 固定ブロック時間ルール（曜日・時間帯ベース）
 */
export const FIXED_BLOCKING_RULES = [
  {
    name: '火曜日定期ブロック',
    dayOfWeek: 2, // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
    startHour: 11,
    endHour: 16,
    enabled: true,
  },
  {
    name: '水曜日定期ブロック',
    dayOfWeek: 3,
    startHour: 13,
    endHour: 14, // 13:00のみ（13:00-14:00）
    enabled: true,
  },
  {
    name: '全日15時台ブロック',
    dayOfWeek: null, // 全曜日
    excludeDays: [2], // 火曜日は除外
    startHour: 15,
    endHour: 16,
    enabled: true,
  },
];

/**
 * イベントタイプ別ブロックルール
 */
export const EVENT_BLOCKING_RULES = {
  // 対面通話のブロックルール
  inPerson: {
    enabled: true,
    keywords: ['対面'],           // 名前に含まれる場合も該当
    callMethodValue: '対面',      // 通話方法の値
    beforeHours: 3,               // 開始前のブロック時間
    afterHours: 3,                // 終了後のブロック時間
  },

  // 撮影のブロックルール
  shooting: {
    enabled: true,
    keywords: ['撮影'],           // 名前に含まれる場合も該当
    callMethodValue: '撮影',      // 通話方法の値
    blockAllDayBefore: true,      // 当日すべてブロック（営業開始時刻から）
    dayStartHour: 12,             // 当日のブロック開始時刻
    afterHours: 3,                // 終了後のブロック時間
  },
};

/**
 * 固定ブロックルールの判定
 * @param {Date} date - 判定する日付
 * @param {number} timeHour - 判定する時刻（時）
 * @returns {boolean} - ブロック対象の場合 true
 */
export const isFixedBlockedTime = (date, timeHour) => {
  const dayOfWeek = date.getDay();

  for (const rule of FIXED_BLOCKING_RULES) {
    if (!rule.enabled) continue;

    // 曜日チェック
    if (rule.dayOfWeek !== null && rule.dayOfWeek !== dayOfWeek) {
      continue;
    }

    // 除外曜日チェック
    if (rule.excludeDays && rule.excludeDays.includes(dayOfWeek)) {
      continue;
    }

    // 時間帯チェック
    if (timeHour >= rule.startHour && timeHour < rule.endHour) {
      return true;
    }
  }

  return false;
};

/**
 * イベントタイプ別ブロック判定（対面通話）
 * @param {object} event - Notionイベントオブジェクト
 * @param {Date} slotStart - スロット開始時刻
 * @param {Date} slotEnd - スロット終了時刻
 * @returns {boolean} - ブロック対象の場合 true
 */
export const isInPersonBlocked = (event, slotStart, slotEnd) => {
  const rule = EVENT_BLOCKING_RULES.inPerson;
  if (!rule.enabled) return false;

  const eventStart = event.properties['予定日']?.date?.start;
  const eventEnd = event.properties['予定日']?.date?.end;
  const callMethod = event.properties['通話方法']?.select?.name;
  const eventName = event.properties['名前']?.title?.[0]?.text?.content || '';

  if (!eventStart) return false;

  // 対面通話判定
  const isInPerson =
    callMethod === rule.callMethodValue ||
    rule.keywords.some(keyword => eventName.includes(keyword));

  if (!isInPerson) return false;

  const existingStart = new Date(eventStart);
  const existingEnd = eventEnd
    ? new Date(eventEnd)
    : new Date(existingStart.getTime() + 60 * 60 * 1000);

  const blockStart = new Date(existingStart.getTime() - rule.beforeHours * 60 * 60 * 1000);
  const blockEnd = new Date(existingEnd.getTime() + rule.afterHours * 60 * 60 * 1000);

  return (blockStart <= slotEnd && blockEnd >= slotStart);
};

/**
 * イベントタイプ別ブロック判定（撮影）
 * @param {object} event - Notionイベントオブジェクト
 * @param {Date} slotStart - スロット開始時刻
 * @param {Date} slotEnd - スロット終了時刻
 * @returns {boolean} - ブロック対象の場合 true
 */
export const isShootingBlocked = (event, slotStart, slotEnd) => {
  const rule = EVENT_BLOCKING_RULES.shooting;
  if (!rule.enabled) return false;

  const eventStart = event.properties['予定日']?.date?.start;
  const eventEnd = event.properties['予定日']?.date?.end;
  const callMethod = event.properties['通話方法']?.select?.name;
  const eventName = event.properties['名前']?.title?.[0]?.text?.content || '';

  if (!eventStart) return false;

  // 撮影判定
  const isShooting =
    callMethod === rule.callMethodValue ||
    rule.keywords.some(keyword => eventName.includes(keyword));

  if (!isShooting) return false;

  const existingStart = new Date(eventStart);
  const existingEnd = eventEnd
    ? new Date(eventEnd)
    : new Date(existingStart.getTime() + 60 * 60 * 1000);

  let blockStart;
  if (rule.blockAllDayBefore) {
    // 当日の営業開始時刻から
    const dayStart = new Date(existingStart);
    dayStart.setHours(rule.dayStartHour, 0, 0, 0);
    blockStart = dayStart;
  } else {
    blockStart = existingStart;
  }

  const blockEnd = new Date(existingEnd.getTime() + rule.afterHours * 60 * 60 * 1000);

  return (blockStart <= slotEnd && blockEnd >= slotStart);
};
