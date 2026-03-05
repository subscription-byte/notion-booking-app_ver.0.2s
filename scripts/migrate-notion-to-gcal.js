const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { google } = require('googleapis');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// ============================================
// Notion→Googleカレンダー移行スクリプト
// ============================================

const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : null;

// CSVファイルのパス（コマンドライン引数から取得）
const CSV_FILE_PATH = process.argv[2];

if (!CSV_FILE_PATH) {
  console.error('使い方: node migrate-notion-to-gcal.js <CSVファイルパス>');
  process.exit(1);
}

if (!GOOGLE_CALENDAR_ID || !GOOGLE_SERVICE_ACCOUNT_KEY) {
  console.error('環境変数が設定されていません: GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

// Google Calendar APIの認証設定
const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

// 日付パース関数（"2026/02/09 13:00 (JST) → 14:00" 形式対応）
function parseNotionDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  // "2026/02/09 13:00 (JST) → 14:00" 形式
  const match = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2})\s+\(JST\)\s*→\s*(\d{1,2}):(\d{2})$/);
  if (match) {
    const [, year, month, day, startHour, startMin, endHour, endMin] = match;
    const startDate = new Date(`${year}-${month}-${day}T${startHour.padStart(2, '0')}:${startMin}:00+09:00`);
    const endDate = new Date(`${year}-${month}-${day}T${endHour.padStart(2, '0')}:${endMin}:00+09:00`);
    return { start: startDate.toISOString(), end: endDate.toISOString() };
  }

  // ISO形式などの通常の日付形式もサポート
  try {
    const startDate = new Date(dateStr);
    if (!isNaN(startDate.getTime())) {
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // デフォルト1時間
      return { start: startDate.toISOString(), end: endDate.toISOString() };
    }
  } catch (e) {
    console.warn('日付パース失敗:', dateStr);
  }

  return null;
}

// CSVからGoogleカレンダーイベント形式に変換
function convertToGoogleEvent(row) {
  const dateInfo = parseNotionDate(row['予定日']);

  if (!dateInfo) {
    console.warn('スキップ（日付なし）:', row['名前']);
    return null;
  }

  // 仮登録レコードは2099年なのでスキップ
  if (row['予定日'] && row['予定日'].includes('2099')) {
    console.warn('スキップ（仮登録）:', row['名前'], row['セッションID']);
    return null;
  }

  // descriptionテンプレート（人間が読める形式）
  const description = `予約者: ${row['名前'] || ''}
Xリンク: ${row['X'] || ''}
備考: ${row['備考'] || ''}
経路: ${row['経路'] || ''}
通話方法: ${row['通話方法'] || ''}
myfans登録状況: ${row['myfans登録状況'] || ''}
P登録状況: ${row['P登録状況'] || ''}

--- 以下、Notion固有データ ---
Zoomリンク: ${row['Zoomリンク'] || ''}
ステータス: ${row['ステータス'] || ''}
前日通知: ${row['前日通知'] || ''}
対応者: ${row['対応者'] || ''}`;

  // extendedProperties（システム処理用）
  const extendedProperties = {
    private: {
      xLink: row['X'] || '',
      remarks: row['備考'] || '',
      route: row['経路'] || '',
      callMethod: row['通話方法'] || '',
      lineUserId: row['LINE User ID'] || '',
      myfansStatus: row['myfans登録状況'] || '',
      premiumStatus: row['P登録状況'] || '',
      bookingStatus: row['予約システム状況'] || '予約完了',
      sessionId: row['セッションID'] || '',
      // Notion固有データ（互換性のない項目）
      exZoomLink: row['Zoomリンク'] || '',
      exStatus: row['ステータス'] || '',
      exReminderSent: row['前日通知'] || '',
      exAssignee: row['対応者'] || '',
      // description全文もexに保存（LINEリマインド送信等で使用）
      exdescription: description,
    }
  };

  return {
    summary: row['名前'] || '（名前なし）',
    description: description,
    start: { dateTime: dateInfo.start },
    end: { dateTime: dateInfo.end },
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
  const events = [];

  // CSVファイルを読み込み
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (row) => {
        const event = convertToGoogleEvent(row);
        if (event) {
          events.push(event);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`\n移行対象: ${events.length}件\n`);

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
