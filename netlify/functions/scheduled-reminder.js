/**
 * Netlify Scheduled Function - LINE自動リマインド送信
 *
 * 実行タイミング:
 * - 毎日15:00 (JST) → 翌日の予約に前日リマインド送信
 */

// スケジュール設定は netlify.toml の [functions."scheduled-reminder"] schedule で管理
// 毎日 06:00 UTC (15:00 JST) に実行

const { google } = require('googleapis');
const { sendChatWorkSystemAlert } = require('./shared/chatwork');
const { formatDateTime, formatDateJST } = require('./shared/dateUtils');

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

    // 24時間以上経過した仮登録セッションを削除
    await cleanupStaleSessions(runId);

    const summary = await sendDayBeforeReminders(jstNow, runId);
    console.log('Scheduled reminder summary:', JSON.stringify({ runId, ...summary }));

    // 毎回実行結果をChatWorkに報告（不要な場合はコメントアウト）
    // await sendChatWorkReminderReport(summary, runId);

    if (summary.failed > 0) {
      await sendSystemErrorToChatWork({
        runId,
        stage: 'day_before_reminder',
        message: `定期リマインドで失敗が発生しました（成功: ${summary.success} / 失敗: ${summary.failed}）`,
        summary
      });
    } else if (summary.totalCandidates > 0 && summary.success === 0 && summary.skippedAlreadySent === 0) {
      await sendSystemErrorToChatWork({
        runId,
        stage: 'day_before_reminder',
        message: `前日リマインド対象が ${summary.totalCandidates} 件あるにもかかわらず、1件も通知が送信されませんでした。`,
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

async function markDayBeforeReminderSent(eventId, existingPrivateProps) {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      extendedProperties: {
        private: {
          ...existingPrivateProps,
          dayBeforeReminderSent: 'true',
        }
      }
    }
  });
}

const LINE_ACCESS_TOKENS = {
  personA: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  personC: process.env.LINE_CHANNEL_ACCESS_TOKEN_C,
};

async function sendLineNotification(userId, message, lineChannel) {
  const token = LINE_ACCESS_TOKENS[lineChannel] || LINE_ACCESS_TOKENS.personA;
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
    // cronが意図しない時刻に実行されている異常
    await sendSystemErrorToChatWork({
      runId,
      stage: 'hour_check',
      message: `スケジュール関数が想定外の時刻に実行されました（JST ${jstNow.getHours()}時）。cronまたはタイムゾーン変換を確認してください。`,
      summary: null
    });
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
  const dateStr = formatDateJST(tomorrow);

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
    const description = booking.description || '';
    const zoomMatch = description.match(/https:\/\/[\w.-]*zoom\.us\/\S+/);
    const zoomUrl = zoomMatch ? zoomMatch[0] : null;
    const zoomLine = zoomUrl ? `\nZoom: ${zoomUrl}` : '';
    const message = `【ご予約日前日のお知らせ】\n\n${formatDateTime(dateTime)}${zoomLine}\n\n明日はよろしくお願いいたします！`;

    const lineChannel = props.lineChannel || 'personA';
    const lineResult = await sendLineNotification(props.lineUserId, message, lineChannel);
    if (!lineResult.ok) {
      summary.failed += 1;
      summary.errors.push(buildErrorDetail(booking.id, 'line_push', `status=${lineResult.status} ${lineResult.error}`));
      continue;
    }

    try {
      await markDayBeforeReminderSent(booking.id, props);
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

async function cleanupStaleSessions(runId) {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    const res = await calendar.events.list({
      calendarId,
      timeMin: new Date('2099-01-01T00:00:00Z').toISOString(),
      timeMax: new Date('2100-01-01T00:00:00Z').toISOString(),
      singleEvents: true,
      maxResults: 500,
    });

    const events = res.data.items || [];
    const now = Date.now();
    const stale = events.filter(e => {
      const props = e.extendedProperties?.private || {};
      if (props.bookingStatus !== '仮登録') return false;
      const age = now - new Date(e.created).getTime();
      return age > 24 * 60 * 60 * 1000; // 24時間超
    });

    console.log(`🧹 Stale sessions to delete: ${stale.length}`, { runId });

    for (const e of stale) {
      await calendar.events.delete({ calendarId, eventId: e.id });
      console.log(`🗑️ Deleted stale session: ${e.id}`, { runId });
    }
  } catch (error) {
    console.error('cleanupStaleSessions error:', error, { runId });
    await sendChatWorkSystemAlert(`[エラー] 仮登録セッション削除失敗\n${error.message}`);
  }
}

async function sendChatWorkReminderReport(summary, runId) {
  try {
    const token = process.env.CHATWORK_API_TOKEN;
    const roomId = process.env.CHATWORK_ROOM_ID;
    if (!token || !roomId) return;

    const skipped = summary.skippedAlreadySent > 0 ? `\n送信済みスキップ: ${summary.skippedAlreadySent}` : '';
    const errDetail = summary.errors?.length
      ? `\nエラー: ${summary.errors.map(e => `${e.phase}/${e.detail}`).join(', ')}`
      : '';
    const body = summary.targetDate
      ? `[前日リマインド実行]\n対象日: ${summary.targetDate}\n対象件数: ${summary.totalCandidates}\n成功: ${summary.success} / 失敗: ${summary.failed}${skipped}${errDetail}`
      : `[前日リマインド] 時刻チェックによりスキップ（runId: ${runId}）`;

    await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'X-ChatWorkToken': token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `body=${encodeURIComponent(body)}`,
    });
  } catch (e) {
    console.error('sendChatWorkReminderReport error:', e);
  }
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


