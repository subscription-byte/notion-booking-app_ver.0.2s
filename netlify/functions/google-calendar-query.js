const { google } = require('googleapis');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { calendarId, filter } = JSON.parse(event.body);

    // セキュリティ: 許可されたカレンダーIDのみアクセス可能
    const ALLOWED_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
    if (calendarId !== ALLOWED_CALENDAR_ID) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden: Invalid calendar ID' })
      };
    }

    // Google Calendar APIの認証設定
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // フィルター条件からtimeMin/timeMaxを抽出
    // YYYY-MM-DD形式をISO 8601形式に変換
    const timeMin = filter?.date?.on_or_after
      ? `${filter.date.on_or_after}T00:00:00.000Z`
      : new Date().toISOString();
    const timeMax = filter?.date?.on_or_before
      ? `${filter.date.on_or_before}T23:59:59.999Z`
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // イベント一覧を取得
    const response = await calendar.events.list({
      calendarId: ALLOWED_CALENDAR_ID,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
    });

    // Notion形式のレスポンスに変換
    const results = response.data.items.map(event => {
      const extendedProps = event.extendedProperties?.private || {};

      return {
        id: event.id,
        properties: {
          '名前': {
            title: [{ text: { content: event.summary || '' } }]
          },
          '予定日': {
            date: {
              start: event.start.dateTime || event.start.date,
              end: event.end.dateTime || event.end.date
            }
          },
          'X': {
            url: extendedProps.xLink || null
          },
          '備考': {
            rich_text: [{ text: { content: extendedProps.remarks || '' } }]
          },
          '経路': {
            select: { name: extendedProps.route || '' }
          },
          '対応者': {
            people: extendedProps.assignee ? [{ name: extendedProps.assignee }] : []
          },
          '通話方法': {
            select: { name: extendedProps.callMethod || '' }
          },
          'LINE User ID': {
            rich_text: [{ text: { content: extendedProps.lineUserId || '' } }]
          },
          'myfans登録状況': {
            select: { name: extendedProps.myfansStatus || '' }
          },
          'P登録状況': {
            select: { name: extendedProps.premiumStatus || '' }
          },
          '予約システム状況': {
            select: { name: extendedProps.bookingStatus || '予約完了' }
          },
          'セッションID': {
            rich_text: [{ text: { content: extendedProps.sessionId || '' } }]
          }
        }
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ results })
    };
  } catch (error) {
    console.error('Google Calendar query error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
