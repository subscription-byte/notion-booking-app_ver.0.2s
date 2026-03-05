/**
 * ============================================
 * Notion ↔ Google Calendar 双方向同期スクリプト (GAS用)
 * ============================================
 *
 * 【機能】
 * 1. Notionに追加された予約をGoogleカレンダーに同期
 * 2. Googleカレンダーに追加された予約をNotionに同期
 * 3. 既に移行済みのCSVデータは除外（重複防止）
 * 4. 今日以降の予定のみ同期
 *
 * 【設定方法】
 * 1. Google Apps Scriptの新規プロジェクトを作成
 * 2. このコードを貼り付け
 * 3. スクリプトプロパティに以下を設定:
 *    - NOTION_TOKEN: NotionのAPIトークン
 *    - NOTION_DATABASE_ID: NotionデータベースID (1fa44ae2d2c780a5b27dc7aae5bae1aa)
 *    - GOOGLE_CALENDAR_ID: GoogleカレンダーID
 *    - MIGRATED_CSV_DATA: 移行済みCSVデータ（下記手順で設定）
 * 4. トリガーを設定: syncBothDirections を5分ごとに実行
 *
 * 【CSV設定手順】
 * 1. CSVファイルをテキストエディタで開く
 * 2. 全文をコピー
 * 3. スクリプトプロパティの MIGRATED_CSV_DATA にペースト
 */

// ============================================
// 設定値取得
// ============================================
const NOTION_TOKEN = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN');
const NOTION_DATABASE_ID = PropertiesService.getScriptProperties().getProperty('NOTION_DATABASE_ID');
const GOOGLE_CALENDAR_ID = PropertiesService.getScriptProperties().getProperty('GOOGLE_CALENDAR_ID');
const MIGRATED_CSV_DATA = PropertiesService.getScriptProperties().getProperty('MIGRATED_CSV_DATA');

// ============================================
// メイン同期関数（トリガーから呼び出し）
// ============================================
function syncBothDirections() {
  try {
    Logger.log('=== 双方向同期開始 ===');

    // 移行済みデータを読み込み
    const migratedEvents = loadMigratedEventsFromCSV();
    Logger.log(`移行済みデータ: ${migratedEvents.size}件`);

    // Notion → Google Calendar 同期
    const notionToGoogleCount = syncNotionToGoogle(migratedEvents);
    Logger.log(`Notion → Google: ${notionToGoogleCount}件追加`);

    // Google Calendar → Notion 同期
    const googleToNotionCount = syncGoogleToNotion(migratedEvents);
    Logger.log(`Google → Notion: ${googleToNotionCount}件追加`);

    Logger.log('=== 双方向同期完了 ===');

  } catch (error) {
    Logger.log('同期エラー: ' + error.toString());
    // エラー通知が必要な場合はここでChatWorkなどに送信
  }
}

// ============================================
// CSV読み込み: 移行済みイベントのSetを作成
// ============================================
function loadMigratedEventsFromCSV() {
  const migratedSet = new Set();

  if (!MIGRATED_CSV_DATA) {
    Logger.log('CSV設定なし。全イベントを同期対象とします。');
    return migratedSet;
  }

  const lines = MIGRATED_CSV_DATA.split('\n');

  // ヘッダー行をスキップ
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSVパース（簡易版：カンマ区切り、クォート考慮なし）
    const columns = line.split(',');
    if (columns.length < 2) continue;

    const name = columns[0]; // 名前
    const dateStr = columns[1]; // 予定日

    // "2025/05/26 10:00 (JST)" → "2025-05-26" に変換
    const dateMatch = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      const dateKey = `${year}-${month}-${day}`;
      const uniqueKey = `${name}|${dateKey}`;
      migratedSet.add(uniqueKey);
    }
  }

  return migratedSet;
}

// ============================================
// ユニークキー生成（名前+日付）
// ============================================
function createUniqueKey(name, dateTime) {
  // dateTimeは ISO形式 (2025-05-26T10:00:00+09:00) を想定
  const dateOnly = dateTime.split('T')[0]; // "2025-05-26"
  return `${name}|${dateOnly}`;
}

// ============================================
// Notion → Google Calendar 同期
// ============================================
function syncNotionToGoogle(migratedEvents) {
  Logger.log('--- Notion → Google Calendar 同期開始 ---');

  // 今日の日付（JST）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy-MM-dd');

  // Notionから今日以降のページを取得
  const notionPages = fetchNotionPages(todayISO);
  Logger.log(`Notion取得: ${notionPages.length}件`);

  // Googleカレンダーから今日以降のイベントを取得
  const calendar = CalendarApp.getCalendarById(GOOGLE_CALENDAR_ID);
  const endDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000); // 1年後まで
  const googleEvents = calendar.getEvents(today, endDate);

  // Google側の既存イベントをSet化（重複チェック用）
  const existingGoogleKeys = new Set();
  googleEvents.forEach(event => {
    const name = event.getTitle();
    const startTime = event.getStartTime().toISOString();
    const key = createUniqueKey(name, startTime);
    existingGoogleKeys.add(key);
  });

  // Notion → Google Calendar 追加処理
  let addedCount = 0;

  for (const page of notionPages) {
    const eventData = convertNotionToGoogle(page);
    if (!eventData) continue;

    const uniqueKey = createUniqueKey(eventData.summary, eventData.start);

    // 移行済み or 既存チェック
    if (migratedEvents.has(uniqueKey) || existingGoogleKeys.has(uniqueKey)) {
      Logger.log(`スキップ（既存）: ${eventData.summary} @ ${eventData.start}`);
      continue;
    }

    // 2099年の仮登録はスキップ
    if (eventData.start.includes('2099')) {
      Logger.log(`スキップ（仮登録）: ${eventData.summary}`);
      continue;
    }

    // Googleカレンダーにイベント作成
    try {
      createGoogleCalendarEvent(calendar, eventData);
      Logger.log(`✓ 追加: ${eventData.summary} @ ${eventData.start}`);
      addedCount++;
    } catch (error) {
      Logger.log(`✗ エラー: ${eventData.summary} - ${error.toString()}`);
    }
  }

  return addedCount;
}

// ============================================
// Google Calendar → Notion 同期
// ============================================
function syncGoogleToNotion(migratedEvents) {
  Logger.log('--- Google Calendar → Notion 同期開始 ---');

  // 今日の日付（JST）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000); // 1年後まで

  // Googleカレンダーから今日以降のイベントを取得
  const calendar = CalendarApp.getCalendarById(GOOGLE_CALENDAR_ID);
  const googleEvents = calendar.getEvents(today, endDate);
  Logger.log(`Google取得: ${googleEvents.length}件`);

  // Notionから今日以降のページを取得
  const todayISO = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy-MM-dd');
  const notionPages = fetchNotionPages(todayISO);

  // Notion側の既存イベントをSet化（重複チェック用）
  const existingNotionKeys = new Set();
  notionPages.forEach(page => {
    const name = getNotionPropertyValue(page.properties, '名前');
    const dateInfo = getNotionPropertyValue(page.properties, '予定日');
    if (dateInfo && dateInfo.start) {
      const key = createUniqueKey(name, dateInfo.start);
      existingNotionKeys.add(key);
    }
  });

  // Google → Notion 追加処理
  let addedCount = 0;

  for (const event of googleEvents) {
    const name = event.getTitle();
    const startTime = event.getStartTime().toISOString();
    const uniqueKey = createUniqueKey(name, startTime);

    // 移行済み or 既存チェック
    if (migratedEvents.has(uniqueKey) || existingNotionKeys.has(uniqueKey)) {
      Logger.log(`スキップ（既存）: ${name} @ ${startTime}`);
      continue;
    }

    // 2099年の仮登録はスキップ
    if (startTime.includes('2099')) {
      Logger.log(`スキップ（仮登録）: ${name}`);
      continue;
    }

    // "（LINE認証のみ）" はスキップ（システム用テンポラリイベント）
    if (name.includes('（LINE認証のみ）')) {
      Logger.log(`スキップ（システム用）: ${name}`);
      continue;
    }

    // Notionにページ作成
    try {
      const notionData = convertGoogleToNotion(event);
      createNotionPage(notionData);
      Logger.log(`✓ 追加: ${name} @ ${startTime}`);
      addedCount++;
    } catch (error) {
      Logger.log(`✗ エラー: ${name} - ${error.toString()}`);
    }
  }

  return addedCount;
}

// ============================================
// Notion API: ページ取得
// ============================================
function fetchNotionPages(afterDate) {
  const url = `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`;

  let allPages = [];
  let hasMore = true;
  let startCursor = null;

  while (hasMore) {
    const payload = {
      filter: {
        property: '予定日',
        date: {
          on_or_after: afterDate
        }
      }
    };

    if (startCursor) {
      payload.start_cursor = startCursor;
    }

    const options = {
      method: 'post',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    if (data.results) {
      allPages = allPages.concat(data.results);
    }

    hasMore = data.has_more || false;
    startCursor = data.next_cursor || null;
  }

  return allPages;
}

// ============================================
// Notion API: ページ作成
// ============================================
function createNotionPage(pageData) {
  const url = `https://api.notion.com/v1/pages`;

  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    payload: JSON.stringify(pageData),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error(`Notion API Error: ${data.message || 'Unknown error'}`);
  }

  return data;
}

// ============================================
// 変換: Notion → Google Calendar
// ============================================
function convertNotionToGoogle(page) {
  const properties = page.properties;

  const name = getNotionPropertyValue(properties, '名前');
  const dateInfo = getNotionPropertyValue(properties, '予定日');
  const xLink = getNotionPropertyValue(properties, 'X');
  const remarks = getNotionPropertyValue(properties, '備考');
  const route = getNotionPropertyValue(properties, '経路');
  const callMethod = getNotionPropertyValue(properties, '通話方法');
  const myfansStatus = getNotionPropertyValue(properties, 'myfans登録状況');
  const premiumStatus = getNotionPropertyValue(properties, 'P登録状況');
  const assignee = getNotionPropertyValue(properties, '対応者');

  // 日付情報がない場合はスキップ
  if (!dateInfo || !dateInfo.start) {
    Logger.log(`スキップ（日付なし）: ${name}`);
    return null;
  }

  const startDateTime = dateInfo.start;
  const endDateTime = dateInfo.end || calculateEndTime(startDateTime, 60); // デフォルト1時間

  // イベントデータ（Google Calendar形式）
  return {
    summary: name || '（名前なし）',
    description: `予約者: ${name}
Xリンク: ${xLink}
備考: ${remarks}
経路: ${route}
通話方法: ${callMethod}
myfans登録状況: ${myfansStatus}
P登録状況: ${premiumStatus}
対応者: ${assignee}`,
    start: startDateTime,
    end: endDateTime,
    extendedProperties: {
      xLink: xLink,
      remarks: remarks,
      route: route,
      callMethod: callMethod,
      myfansStatus: myfansStatus,
      premiumStatus: premiumStatus,
      assignee: assignee,
      syncSource: 'notion' // 同期元識別用
    }
  };
}

// ============================================
// 変換: Google Calendar → Notion
// ============================================
function convertGoogleToNotion(event) {
  const name = event.getTitle();
  const startTime = event.getStartTime();
  const endTime = event.getEndTime();
  const description = event.getDescription() || '';

  // descriptionからプロパティを抽出
  const xLink = extractFromDescription(description, 'Xリンク');
  const remarks = extractFromDescription(description, '備考');
  const route = extractFromDescription(description, '経路');
  const callMethod = extractFromDescription(description, '通話方法');
  const myfansStatus = extractFromDescription(description, 'myfans登録状況');
  const premiumStatus = extractFromDescription(description, 'P登録状況');

  // Notion API用のページデータ
  return {
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      '名前': {
        title: [{ text: { content: name } }]
      },
      '予定日': {
        date: {
          start: startTime.toISOString(),
          end: endTime.toISOString()
        }
      },
      'X': {
        url: xLink || null
      },
      '備考': {
        rich_text: [{ text: { content: remarks || '' } }]
      },
      '経路': {
        rich_text: [{ text: { content: route || '' } }]
      },
      '通話方法': {
        rich_text: [{ text: { content: callMethod || '' } }]
      },
      'myfans登録状況': {
        select: myfansStatus ? { name: myfansStatus } : null
      },
      'P登録状況': {
        select: premiumStatus ? { name: premiumStatus } : null
      },
      'ステータス': {
        select: { name: '確定' }
      },
      '予約システム状況': {
        rich_text: [{ text: { content: '予約完了' } }]
      }
    }
  };
}

// ============================================
// Notionプロパティ値取得
// ============================================
function getNotionPropertyValue(properties, key) {
  const prop = properties[key];
  if (!prop) return '';

  switch (prop.type) {
    case 'title':
      return prop.title?.[0]?.plain_text || '';
    case 'rich_text':
      return prop.rich_text?.[0]?.plain_text || '';
    case 'url':
      return prop.url || '';
    case 'select':
      return prop.select?.name || '';
    case 'people':
      return prop.people?.map(p => p.name || p.id).join(', ') || '';
    case 'date':
      return prop.date;
    default:
      return '';
  }
}

// ============================================
// Googleカレンダーイベント作成
// ============================================
function createGoogleCalendarEvent(calendar, eventData) {
  const startTime = new Date(eventData.start);
  const endTime = new Date(eventData.end);

  const event = calendar.createEvent(
    eventData.summary,
    startTime,
    endTime,
    {
      description: eventData.description
    }
  );

  // 拡張プロパティはGAS APIでは直接設定不可のため、
  // 必要に応じてAdvanced Calendar Serviceを有効化して使用
  // 参考: https://developers.google.com/apps-script/advanced/calendar

  return event;
}

// ============================================
// ユーティリティ: 終了時刻計算
// ============================================
function calculateEndTime(startISO, durationMinutes) {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return end.toISOString();
}

// ============================================
// ユーティリティ: description から値抽出
// ============================================
function extractFromDescription(description, fieldName) {
  const regex = new RegExp(`${fieldName}:\\s*(.+?)(?=\\n|$)`, 'i');
  const match = description.match(regex);
  return match ? match[1].trim() : '';
}

// ============================================
// 手動実行用: 設定確認
// ============================================
function checkConfiguration() {
  Logger.log('=== 設定確認 ===');
  Logger.log('NOTION_TOKEN: ' + (NOTION_TOKEN ? 'OK' : 'NG'));
  Logger.log('NOTION_DATABASE_ID: ' + (NOTION_DATABASE_ID ? 'OK' : 'NG'));
  Logger.log('GOOGLE_CALENDAR_ID: ' + (GOOGLE_CALENDAR_ID ? 'OK' : 'NG'));
  Logger.log('MIGRATED_CSV_DATA: ' + (MIGRATED_CSV_DATA ? `OK (${MIGRATED_CSV_DATA.length} chars)` : 'NG'));

  if (!NOTION_TOKEN || !NOTION_DATABASE_ID || !GOOGLE_CALENDAR_ID) {
    Logger.log('エラー: 必須設定が不足しています。スクリプトプロパティを確認してください。');
  } else {
    Logger.log('設定OK: syncBothDirections() を実行できます。');
  }
}
