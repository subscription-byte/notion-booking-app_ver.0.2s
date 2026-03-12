exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    console.log('LINE callback (personC) started');
    const { code, state } = event.queryStringParameters;
    console.log('Code received:', code ? 'Yes' : 'No');

    if (!code) {
      console.log('Error: No authorization code');
      return {
        statusCode: 400,
        body: 'Authorization code not provided'
      };
    }

    const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID_C;
    const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET_C;
    const REDIRECT_URI = 'https://mfagencybooking.netlify.app/.netlify/functions/line-callback-c';
    const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
    const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    console.log('LINE_CHANNEL_ID_C:', LINE_CHANNEL_ID ? 'Set' : 'Missing');
    console.log('LINE_CHANNEL_SECRET_C:', LINE_CHANNEL_SECRET ? 'Set' : 'Missing');
    console.log('GOOGLE_CALENDAR_ID:', GOOGLE_CALENDAR_ID ? 'Set' : 'Missing');
    console.log('GOOGLE_SERVICE_ACCOUNT_KEY:', GOOGLE_SERVICE_ACCOUNT_KEY ? 'Set' : 'Missing');

    if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET || !GOOGLE_CALENDAR_ID || !GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.log('Error: Required credentials not configured');
      throw new Error('Required credentials not configured');
    }

    // アクセストークンを取得
    console.log('Requesting access token...');
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET
      })
    });

    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.log('Token error response:', errorText);
      throw new Error(`Token request failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('Access token received:', accessToken ? 'Yes' : 'No');

    // ユーザープロフィールを取得
    console.log('Requesting user profile...');
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('Profile response status:', profileResponse.status);

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.log('Profile error response:', errorText);
      throw new Error(`Profile request failed: ${errorText}`);
    }

    const profile = await profileResponse.json();
    const userId = profile.userId;
    const displayName = profile.displayName;

    console.log('Profile received - userId:', userId, 'displayName:', displayName);

    // stateからrefパラメータを取得（カンマ区切りの2番目の値）
    const stateParts = state ? state.split(',') : [];
    const ref = stateParts.length > 1 ? stateParts[1] : '';
    console.log('Ref parameter from state:', ref);

    // セッションIDを生成（UUID v4）
    const crypto = require('crypto');
    const { google } = require('googleapis');
    const sessionId = crypto.randomUUID();
    console.log('Generated session ID:', sessionId);

    // Google Calendarに仮レコードを作成（セッション情報を保存）
    console.log('Creating temporary session record in Google Calendar...');
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: '（LINE認証のみ）',
        start: { dateTime: '2099-12-31T00:00:00+09:00' },
        end: { dateTime: '2099-12-31T01:00:00+09:00' },
        extendedProperties: {
          private: {
            sessionId: sessionId,
            lineUserId: userId,
            lineChannel: 'personC',
            bookingStatus: '仮登録',
          }
        }
      }
    });

    console.log('Session record created successfully');

    // リダイレクト先URL（セッションIDとrefをクエリパラメータで渡す）
    let redirectUrl = `https://mfagencybooking.netlify.app/?session_id=${encodeURIComponent(sessionId)}&line_name=${encodeURIComponent(displayName)}`;
    if (ref) {
      redirectUrl += `&ref=${encodeURIComponent(ref)}`;
    }

    console.log('Redirecting to:', redirectUrl);

    return {
      statusCode: 302,
      headers: {
        'Location': redirectUrl
      },
      body: ''
    };

  } catch (error) {
    console.error('LINE callback (personC) error:', error);

    return {
      statusCode: 302,
      headers: {
        'Location': `https://mfagencybooking.netlify.app/?line_error=${encodeURIComponent(error.message)}`
      },
      body: ''
    };
  }
};
