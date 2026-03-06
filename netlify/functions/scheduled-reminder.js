/**
 * Netlify Scheduled Function - LINE自動リマインド送信
 *
 * 実行タイミング:
 * - 毎日18:00 (JST) → 翌日の予約に前日リマインド送信
 * - 15分おき → 15分後の予約に当日リマインド送信
 */

export const config = {
  schedule: "*/15 * * * *"
};

const { google } = require('googleapis');

const getCalendarClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
};

exports.handler = async (event, context) => {
  console.log('🔔 Scheduled reminder function started');

  try {
    const now = new Date();
    const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    console.log('Current time (JST):', jstNow.toISOString());

    await sendDayBeforeReminders(jstNow);
    await send15MinuteReminders(jstNow);

    return { statusCode: 200, body: JSON.stringify({ message: 'Reminder check completed' }) };
  } catch (error) {
    console.error('❌ Error in scheduled reminder:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function fetchBookingsForDate(dateStr) {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  const dayStart = new Date(dateStr + 'T00:00:00+09:00');
  const dayEnd = new Date(dateStr + 'T23:59:59+09:00');

  const res = await calendar.events.list({
    calendarId,
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: true,
  });

  return (res.data.items || []).filter(e => {
    const props = e.extendedProperties?.private || {};
    return props.bookingStatus === '予約完了' && props.lineUserId;
  });
}

async function markReminderSent(eventId, type) {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  const event = await calendar.events.get({ calendarId, eventId });
  const existing = event.data.extendedProperties?.private || {};

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      extendedProperties: {
        private: {
          ...existing,
          [type === 'day_before' ? 'dayBeforeReminderSent' : 'fifteenMinReminderSent']: 'true',
        }
      }
    }
  });
}

async function sendLineNotification(userId, message) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: message }] })
    });
    if (!res.ok) {
      console.error('LINE API error:', await res.json());
      return false;
    }
    return true;
  } catch (e) {
    console.error('Error sending LINE notification:', e);
    return false;
  }
}

async function sendDayBeforeReminders(jstNow) {
  if (jstNow.getHours() !== 18) return;
  console.log('📅 Checking day-before reminders...');

  const tomorrow = new Date(jstNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = formatDate(tomorrow);

  const bookings = await fetchBookingsForDate(dateStr);
  console.log(`Found ${bookings.length} bookings for tomorrow`);

  for (const booking of bookings) {
    const props = booking.extendedProperties?.private || {};
    if (props.dayBeforeReminderSent === 'true') continue;

    const dateTime = booking.start.dateTime || booking.start.date;
    const message = `【ご予約日前日のお知らせ】\n\n${formatDateTime(dateTime)}\n\n明日はよろしくお願いいたします！`;

    const success = await sendLineNotification(props.lineUserId, message);
    if (success) {
      await markReminderSent(booking.id, 'day_before');
      console.log('✅ Day-before reminder sent:', booking.id);
    }
  }
}

async function send15MinuteReminders(jstNow) {
  console.log('⏰ Checking 15-minute reminders...');

  const in15 = new Date(jstNow.getTime() + 15 * 60 * 1000);
  const dateStr = formatDate(in15);
  const targetHour = in15.getHours();
  const targetMin = in15.getMinutes();

  const bookings = await fetchBookingsForDate(dateStr);

  for (const booking of bookings) {
    const props = booking.extendedProperties?.private || {};
    if (props.fifteenMinReminderSent === 'true') continue;

    const dateTime = booking.start.dateTime || booking.start.date;
    const bookingDate = new Date(dateTime);
    if (bookingDate.getHours() !== targetHour || bookingDate.getMinutes() !== targetMin) continue;

    const message = `【ご予約15分前のお知らせ】\n\n本日はよろしくお願いいたします！\nお時間になりましたらご入室をお願いいたします！\n\n（※担当者の状況により、直接のご連絡と前後して本通知が送られている場合がございます。ご容赦くださいますと幸いです。）`;

    const success = await sendLineNotification(props.lineUserId, message);
    if (success) {
      await markReminderSent(booking.id, '15_minutes');
      console.log('✅ 15-minute reminder sent:', booking.id);
    }
  }
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
