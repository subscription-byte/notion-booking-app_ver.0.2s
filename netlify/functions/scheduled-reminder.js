/**
 * Netlify Scheduled Function - LINE自動リマインド送信
 *
 * 実行タイミング:
 * - 毎日15:00 (JST) → 翌日の予約に前日リマインド送信
 */

export const config = {
  // Netlify cron は UTC 基準。15:00 JST = 06:00 UTC
  schedule: "0 6 * * *"
};

const { google } = require('googleapis');

const MAX_ERROR_DETAILS = 5;

const getCalendarClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
};

exports.handler = async (event, context) => {
  const runId = `rem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  console.log('🔔 Scheduled reminder function started', { runId });

  try {
    const now = new Date();
    const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    console.log('Current time (JST):', jstNow.toISOString(), { runId });

    const summary = await sendDayBeforeReminders(jstNow, runId);
    console.log('Scheduled reminder summary:', JSON.stringify({ runId, ...summary }));

    if (summary.failed > 0) {
      await sendSystemErrorToChatWork({
        runId,
        stage: 'day_before_reminder',
        message: '定期リマインドで失敗が発生しました',
        summary
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Reminder check completed',
        runId,
        ...summary
      })
    };
  } catch (error) {
    console.error('❌ Error in scheduled reminder:', error, { runId });
    await sendSystemErrorToChatWork({
      runId,
      stage: 'handler',
      message: error.message || 'Unknown scheduled reminder error',
      summary: null
    });
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
    conferenceDataVersion: 1,
  });

  return (res.data.items || []).filter(e => {
    const props = e.extendedProperties?.private || {};
    return props.bookingStatus === '予約完了' && props.lineUserId;
  });
}

async function markDayBeforeReminderSent(eventId) {
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
          dayBeforeReminderSent: 'true',
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
      const errorText = await res.text();
      console.error('LINE API error:', res.status, errorText);
      return { ok: false, status: res.status, error: errorText };
    }
    return { ok: true };
  } catch (e) {
    console.error('Error sending LINE notification:', e);
    return { ok: false, status: 0, error: e.message || 'LINE send failed' };
  }
}

function buildErrorDetail(eventId, phase, detail) {
  return {
    eventId: eventId || 'unknown',
    phase,
    detail: truncate(detail || 'unknown error', 300),
  };
}

function truncate(value, max) {
  const s = String(value ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}...`;
}

async function sendDayBeforeReminders(jstNow, runId) {
  if (jstNow.getHours() !== 15) {
    return {
      targetDate: null,
      totalCandidates: 0,
      success: 0,
      failed: 0,
      skippedAlreadySent: 0,
      errors: []
    };
  }

  console.log('📅 Checking day-before reminders...', { runId });

  const tomorrow = new Date(jstNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = formatDate(tomorrow);

  const bookings = await fetchBookingsForDate(dateStr);
  console.log(`Found ${bookings.length} bookings for tomorrow`, { runId, dateStr });

  const summary = {
    targetDate: dateStr,
    totalCandidates: bookings.length,
    success: 0,
    failed: 0,
    skippedAlreadySent: 0,
    errors: []
  };

  for (const booking of bookings) {
    const props = booking.extendedProperties?.private || {};
    if (props.dayBeforeReminderSent === 'true') {
      summary.skippedAlreadySent += 1;
      continue;
    }

    const dateTime = booking.start.dateTime || booking.start.date;
    const meetUrl = booking.hangoutLink
      || booking.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
      || null;
    const meetLine = meetUrl ? `\nGoogle Meet: ${meetUrl}` : '';
    const message = `【ご予約日前日のお知らせ】\n\n${formatDateTime(dateTime)}${meetLine}\n\n明日はよろしくお願いいたします！`;

    const lineResult = await sendLineNotification(props.lineUserId, message);
    if (!lineResult.ok) {
      summary.failed += 1;
      summary.errors.push(buildErrorDetail(booking.id, 'line_push', `status=${lineResult.status} ${lineResult.error}`));
      continue;
    }

    try {
      await markDayBeforeReminderSent(booking.id);
      summary.success += 1;
      console.log('✅ Day-before reminder sent:', booking.id, { runId });
    } catch (error) {
      summary.failed += 1;
      summary.errors.push(buildErrorDetail(booking.id, 'mark_sent', error.message));
    }
  }

  summary.errors = summary.errors.slice(0, MAX_ERROR_DETAILS);
  return summary;
}

async function sendSystemErrorToChatWork({ runId, stage, message, summary }) {
  try {
    const token = process.env.CHATWORK_API_TOKEN;
    const roomId = process.env.CHATWORK_ROOM_ID;
    if (!token || !roomId) {
      console.error('ChatWork env vars missing for scheduled reminder alert', { runId });
      return;
    }

    const summaryText = summary
      ? `対象日: ${summary.targetDate || 'なし'}\n対象件数: ${summary.totalCandidates}\n成功: ${summary.success}\n失敗: ${summary.failed}\n送信済みスキップ: ${summary.skippedAlreadySent}`
      : 'サマリーなし';

    const detailLines = summary?.errors?.length
      ? `\n詳細:\n${summary.errors.map((e, i) => `${i + 1}. event=${e.eventId} phase=${e.phase} detail=${e.detail}`).join('\n')}`
      : '';

    const body = `[toall]
[緊急] 定期リマインドエラー

runId: ${runId}
stage: ${stage}
message: ${truncate(message, 500)}
${summaryText}${detailLines}

Netlify Logs で runId を検索して詳細を確認してください。`;

    const response = await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `body=${encodeURIComponent(body)}`
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Failed to send scheduled reminder alert to ChatWork', response.status, err, { runId });
    }
  } catch (error) {
    console.error('sendSystemErrorToChatWork failed', error, { runId });
  }
}


function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
