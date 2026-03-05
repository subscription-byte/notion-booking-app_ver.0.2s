const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// ============================================
// Googleカレンダー全削除スクリプト
// ============================================

const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : null;

if (!GOOGLE_CALENDAR_ID || !GOOGLE_SERVICE_ACCOUNT_KEY) {
  console.error('環境変数が設定されていません');
  console.error('必要な環境変数: GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

// Google Calendar APIの認証設定
const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

// メイン処理
async function clearCalendar() {
  console.log('Googleカレンダーのイベントをすべて削除します...\n');

  // 過去1年から未来1年までのイベントを取得
  const timeMin = new Date();
  timeMin.setFullYear(timeMin.getFullYear() - 1);
  const timeMax = new Date();
  timeMax.setFullYear(timeMax.getFullYear() + 1);

  const response = await calendar.events.list({
    calendarId: GOOGLE_CALENDAR_ID,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: 2500,
    singleEvents: true,
  });

  const events = response.data.items || [];
  console.log(`削除対象: ${events.length}件\n`);

  if (events.length === 0) {
    console.log('削除するイベントがありません。');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const event of events) {
    try {
      await calendar.events.delete({
        calendarId: GOOGLE_CALENDAR_ID,
        eventId: event.id,
      });
      console.log(`✓ 削除成功: ${event.summary} (${event.start?.dateTime || event.start?.date})`);
      successCount++;
    } catch (error) {
      console.error(`✗ 削除失敗: ${event.summary} - ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`削除完了: 成功 ${successCount}件 / 失敗 ${errorCount}件`);
  console.log(`========================================\n`);
}

// 実行
clearCalendar().catch((error) => {
  console.error('削除処理エラー:', error);
  process.exit(1);
});
