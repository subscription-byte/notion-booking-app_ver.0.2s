const { google } = require('googleapis');
const { sendChatWorkSystemAlert } = require('./shared/chatwork');
const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId, displayName, ref } = JSON.parse(event.body);

    if (!userId || !displayName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId and displayName are required' }) };
    }

    // 友達追加チェック（ref='personC'の場合はPersonCのトークンを使用）
    const lineToken = ref === 'personC'
      ? process.env.LINE_CHANNEL_ACCESS_TOKEN_C
      : process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (lineToken) {
      const friendRes = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
        headers: { 'Authorization': `Bearer ${lineToken}` }
      });
      if (friendRes.status === 404) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'not_friend' })
        };
      }
      if (!friendRes.ok) {
        console.warn(`Friend check non-fatal error: status=${friendRes.status}, ref=${ref}`);
      }
    }

    const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
    const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!GOOGLE_CALENDAR_ID || !GOOGLE_SERVICE_ACCOUNT_KEY) {
      throw new Error('Required credentials not configured');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    const calendar = google.calendar({ version: 'v3', auth });

    const sessionId = crypto.randomUUID();
    const lineChannel = ref === 'personC' ? 'personC' : 'personA';

    await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: '（LINE認証のみ）',
        start: { dateTime: '2099-12-31T00:00:00+09:00' },
        end: { dateTime: '2099-12-31T01:00:00+09:00' },
        extendedProperties: {
          private: {
            sessionId,
            lineUserId: userId,
            lineChannel,
            bookingStatus: '仮登録',
          }
        }
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    };

  } catch (error) {
    console.error('line-session-create error:', error);
    await sendChatWorkSystemAlert(`[エラー] LINEセッション作成失敗\n${error.message}`);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
