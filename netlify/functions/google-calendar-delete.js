const { google } = require('googleapis');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { eventId } = JSON.parse(event.body);

    if (!eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing eventId' })
      };
    }

    const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

    // Google Calendar APIの認証設定
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // セキュリティ: イベントが正しいカレンダーに属しているか確認
    const checkResponse = await calendar.events.get({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId: eventId,
    });

    if (!checkResponse.data) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Event not found' })
      };
    }

    // イベントを削除
    await calendar.events.delete({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId: eventId,
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Google Calendar delete error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
