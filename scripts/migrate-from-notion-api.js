const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// ============================================
// Notion API→Googleカレンダー移行スクリプト
// ============================================

const NOTION_TOKEN = process.env.NOTION_TOKEN || process.env.REACT_APP_NOTION_TOKEN;
const NOTION_DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : null;

if (!NOTION_TOKEN || !GOOGLE_CALENDAR_ID || !GOOGLE_SERVICE_ACCOUNT_KEY) {
  console.error('環境変数が設定されていません');
  console.error('必要な環境変数: NOTION_TOKEN, GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

// Google Calendar APIの認証設定
const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

// Notionのプロパティから値を取得するヘルパー関数
function getPropertyValue(properties, key) {
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

// NotionのレコードをGoogleカレンダーイベントに変換
function convertToGoogleEvent(page) {
  const properties = page.properties;

  const name = getPropertyValue(properties, '名前');
  const dateInfo = getPropertyValue(properties, '予定日');
  const xLink = getPropertyValue(properties, 'X');
  const remarks = getPropertyValue(properties, '備考');
  const route = getPropertyValue(properties, '経路');
  const callMethod = getPropertyValue(properties, '通話方法');
  const lineUserId = getPropertyValue(properties, 'LINE User ID');
  const myfansStatus = getPropertyValue(properties, 'myfans登録状況');
  const premiumStatus = getPropertyValue(properties, 'P登録状況');
  const bookingStatus = getPropertyValue(properties, '予約システム状況');
  const sessionId = getPropertyValue(properties, 'セッションID');
  const zoomLink = getPropertyValue(properties, 'Zoomリンク');
  const status = getPropertyValue(properties, 'ステータス');
  const reminderSent = getPropertyValue(properties, '前日通知');
  const assignee = getPropertyValue(properties, '対応者');

  // 日付情報がない、または仮登録（2099年）の場合はスキップ
  if (!dateInfo || !dateInfo.start) {
    console.warn('スキップ（日付なし）:', name);
    return null;
  }

  if (dateInfo.start.includes('2099')) {
    console.warn('スキップ（仮登録）:', name, sessionId);
    return null;
  }

  // Notionの日付形式をISO形式に変換
  const startDateTime = dateInfo.start;
  const endDateTime = dateInfo.end || new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString();

  // descriptionテンプレート（人間が読める形式）
  const description = `予約者: ${name}
Xリンク: ${xLink}
備考: ${remarks}
経路: ${route}
通話方法: ${callMethod}
myfans登録状況: ${myfansStatus}
P登録状況: ${premiumStatus}

--- 以下、Notion固有データ ---
Zoomリンク: ${zoomLink}
ステータス: ${status}
前日通知: ${reminderSent}
対応者: ${assignee}`;

  // extendedProperties（システム処理用）
  const extendedProperties = {
    private: {
      xLink: xLink,
      remarks: remarks,
      route: route,
      callMethod: callMethod,
      lineUserId: lineUserId,
      myfansStatus: myfansStatus,
      premiumStatus: premiumStatus,
      bookingStatus: bookingStatus || '予約完了',
      sessionId: sessionId,
      // Notion固有データ（互換性のない項目）
      exZoomLink: zoomLink,
      exStatus: status,
      exReminderSent: reminderSent,
      exAssignee: assignee,
      // description全文もexに保存（LINEリマインド送信等で使用）
      exdescription: description,
      // Notion page IDも保存（参照用）
      notionPageId: page.id,
    }
  };

  return {
    summary: name || '（名前なし）',
    description: description,
    start: { dateTime: startDateTime },
    end: { dateTime: endDateTime },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 10 },
        { method: 'popup', minutes: 0 },
      ]
    },
    extendedProperties: extendedProperties,
  };
}

// メイン処理
async function migrateData() {
  console.log('Notionデータベースからデータを取得中...\n');

  let allPages = [];

  // 今日の日付を取得（JST）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD形式

  console.log(`本日（${todayISO}）以降の予約のみを移行します\n`);

  // Notionから今日以降のページを全件取得（ページネーション対応）
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        filter: {
          property: '予定日',
          date: {
            on_or_after: todayISO
          }
        },
        start_cursor: startCursor
      })
    });

    const data = await response.json();
    allPages = allPages.concat(data.results || []);
    hasMore = data.has_more;
    startCursor = data.next_cursor;

    console.log(`取得中... 現在 ${allPages.length}件`);
  }

  console.log(`\nNotionから取得: ${allPages.length}件\n`);

  // Googleカレンダーイベントに変換
  const events = [];
  for (const page of allPages) {
    const event = convertToGoogleEvent(page);
    if (event) {
      events.push(event);
    }
  }

  console.log(`移行対象: ${events.length}件\n`);

  // 確認プロンプト
  console.log('========================================');
  console.log(`これから ${events.length} 件の予約をGoogleカレンダーに移行します。`);
  console.log(`カレンダーID: ${GOOGLE_CALENDAR_ID}`);
  console.log('========================================\n');

  // Googleカレンダーにイベントを作成
  let successCount = 0;
  let errorCount = 0;

  for (const event of events) {
    try {
      const response = await calendar.events.insert({
        calendarId: GOOGLE_CALENDAR_ID,
        requestBody: event,
      });
      console.log(`✓ 作成成功: ${event.summary} (${event.start.dateTime})`);
      successCount++;
    } catch (error) {
      console.error(`✗ 作成失敗: ${event.summary} - ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`移行完了: 成功 ${successCount}件 / 失敗 ${errorCount}件`);
  console.log(`========================================\n`);
}

// 実行
migrateData().catch((error) => {
  console.error('移行処理エラー:', error);
  process.exit(1);
});
