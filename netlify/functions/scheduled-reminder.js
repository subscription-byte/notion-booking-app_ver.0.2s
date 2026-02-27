/**
 * Netlify Scheduled Function - LINE自動リマインド送信
 *
 * 実行タイミング:
 * - 毎日18:00 (JST) → 翌日の予約に前日リマインド送信
 * - 15分おき → 15分後の予約に当日リマインド送信
 *
 * Google Calendarから予約データを取得し、条件に合致する予約にLINE通知を送信
 */

// Netlify v2 Scheduled Function設定
export const config = {
  schedule: "*/15 * * * *" // 15分ごとに実行
};

const { google } = require('googleapis');

const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

exports.handler = async (event, context) => {
  console.log('🔔 Scheduled reminder function started');

  try {
    const now = new Date();
    const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

    console.log('Current time (JST):', jstNow.toISOString());

    // 前日18時リマインド処理
    await sendDayBeforeReminders(jstNow);

    // 当日15分前リマインド処理
    await send15MinuteReminders(jstNow);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Reminder check completed' })
    };
  } catch (error) {
    console.error('❌ Error in scheduled reminder:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

/**
 * 前日18時リマインド送信
 * 毎日18:00に実行され、翌日の予約に通知を送る
 */
async function sendDayBeforeReminders(jstNow) {
  const currentHour = jstNow.getHours();

  // 18:00-18:14の間のみ実行（15分間隔実行を想定）
  if (currentHour !== 18) {
    console.log('⏭️  Skip: Not 18:00 JST (current hour:', currentHour, ')');
    return;
  }

  console.log('📅 Checking day-before reminders...');

  // 翌日の日付を取得
  const tomorrow = new Date(jstNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000);

  console.log('Target date (tomorrow):', tomorrowStart.toISOString());

  // Google Calendarから翌日の予約を取得
  const bookings = await fetchBookingsForDateRange(tomorrowStart, tomorrowEnd);

  console.log(`Found ${bookings.length} bookings for tomorrow`);

  for (const booking of bookings) {
    const extProps = booking.extendedProperties?.private || {};
    const lineUserId = extProps.lineUserId;
    const bookingStatus = extProps.bookingStatus;
    const dayBeforeReminderSent = extProps.dayBeforeReminderSent === 'true';

    // 仮登録や予約完了以外はスキップ
    if (bookingStatus === '仮登録' || !bookingStatus) {
      console.log(`⏭️  Skip booking (status: ${bookingStatus}):`, booking.id);
      continue;
    }

    // LINE User IDがない場合はスキップ
    if (!lineUserId) {
      console.log('⏭️  Skip booking (no LINE User ID):', booking.id);
      continue;
    }

    // 前日リマインド送信済みフラグをチェック
    if (dayBeforeReminderSent) {
      console.log('⏭️  Skip booking (day-before reminder already sent):', booking.id);
      continue;
    }

    // メッセージ作成
    const dateTime = booking.start.dateTime || booking.start.date;
    const formattedDateTime = formatDateTime(dateTime);
    let message = `【ご予約日前日のお知らせ】\n\n${formattedDateTime}\n\n明日はよろしくお願いいたします！`;

    // LINE通知送信
    const success = await sendLineNotification(lineUserId, message);

    if (success) {
      // Google Calendarに送信済みフラグを立てる
      await updateBookingReminderFlag(booking.id, 'day_before');
      console.log('✅ Day-before reminder sent:', booking.id);
    } else {
      console.error('❌ Failed to send day-before reminder:', booking.id);
    }
  }
}

/**
 * 当日15分前リマインド送信
 * 15分おきに実行され、15分後の予約に通知を送る
 */
async function send15MinuteReminders(jstNow) {
  console.log('⏰ Checking 15-minute reminders...');

  // 現在時刻の15分後を計算
  const in15Minutes = new Date(jstNow.getTime() + 15 * 60 * 1000);
  const targetStart = new Date(in15Minutes.getTime() - 1 * 60 * 1000); // 1分前
  const targetEnd = new Date(in15Minutes.getTime() + 1 * 60 * 1000);   // 1分後

  console.log('Target time (15 min later):', in15Minutes.toISOString());

  // Google Calendarから該当時刻の予約を取得
  const bookings = await fetchBookingsForDateRange(targetStart, targetEnd);

  console.log(`Found ${bookings.length} bookings for 15 minutes later`);

  for (const booking of bookings) {
    const extProps = booking.extendedProperties?.private || {};
    const lineUserId = extProps.lineUserId;
    const bookingStatus = extProps.bookingStatus;
    const fifteenMinReminderSent = extProps.fifteenMinReminderSent === 'true';

    // 仮登録や予約完了以外はスキップ
    if (bookingStatus === '仮登録' || !bookingStatus) {
      console.log(`⏭️  Skip booking (status: ${bookingStatus}):`, booking.id);
      continue;
    }

    // LINE User IDがない場合はスキップ
    if (!lineUserId) {
      console.log('⏭️  Skip booking (no LINE User ID):', booking.id);
      continue;
    }

    // 15分前リマインド送信済みフラグをチェック
    if (fifteenMinReminderSent) {
      console.log('⏭️  Skip booking (15-min reminder already sent):', booking.id);
      continue;
    }

    // メッセージ作成
    let message = `【ご予約15分前のお知らせ】\n\n本日はよろしくお願いいたします！\nお時間になりましたらご入室をお願いいたします！\n\n（※担当者の状況により、直接のご連絡と前後して本通知が送られている場合がございます。ご容赦くださいますと幸いです。）`;

    // LINE通知送信
    const success = await sendLineNotification(lineUserId, message);

    if (success) {
      // Google Calendarに送信済みフラグを立てる
      await updateBookingReminderFlag(booking.id, '15_minutes');
      console.log('✅ 15-minute reminder sent:', booking.id);
    } else {
      console.error('❌ Failed to send 15-minute reminder:', booking.id);
    }
  }
}

/**
 * Google Calendarから指定期間の予約を取得
 */
async function fetchBookingsForDateRange(startDate, endDate) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    return response.data.items || [];
  } catch (error) {
    console.error('❌ Error fetching bookings from Google Calendar:', error);
    return [];
  }
}

/**
 * LINE通知を送信
 */
async function sendLineNotification(userId, message) {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LINE API error:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending LINE notification:', error);
    return false;
  }
}

/**
 * Google Calendarの予約に送信済みフラグを立てる
 */
async function updateBookingReminderFlag(eventId, reminderType) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // イベントを取得
    const event = await calendar.events.get({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId: eventId
    });

    // extendedPropertiesを更新
    const extProps = event.data.extendedProperties?.private || {};
    const propertyName = reminderType === 'day_before'
      ? 'dayBeforeReminderSent'
      : 'fifteenMinReminderSent';

    extProps[propertyName] = 'true';

    await calendar.events.patch({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId: eventId,
      requestBody: {
        extendedProperties: {
          private: extProps
        }
      }
    });

    return true;
  } catch (error) {
    console.error('❌ Error updating reminder flag in Google Calendar:', error);
    return false;
  }
}

/**
 * 日時を読みやすい形式にフォーマット
 */
function formatDateTime(isoString) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}年${month}月${day}日 ${hour}:${minute}`;
}
