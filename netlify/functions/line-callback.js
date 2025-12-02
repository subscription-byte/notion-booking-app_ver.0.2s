exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { code, state } = event.queryStringParameters;

    if (!code) {
      return {
        statusCode: 400,
        body: 'Authorization code not provided'
      };
    }

    const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID;
    const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
    const REDIRECT_URI = 'https://mfagencybooking.netlify.app/.netlify/functions/line-callback';

    if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
      throw new Error('LINE credentials not configured');
    }

    // アクセストークンを取得
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

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token request failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // ユーザープロフィールを取得
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      throw new Error(`Profile request failed: ${errorText}`);
    }

    const profile = await profileResponse.json();
    const userId = profile.userId;
    const displayName = profile.displayName;

    // リダイレクト先URL（元のページに戻る + User IDをクエリパラメータで渡す）
    const redirectUrl = `https://mfagencybooking.netlify.app/?line_user_id=${encodeURIComponent(userId)}&line_name=${encodeURIComponent(displayName)}`;

    return {
      statusCode: 302,
      headers: {
        'Location': redirectUrl
      },
      body: ''
    };

  } catch (error) {
    console.error('LINE callback error:', error);

    // エラー時はトップページにリダイレクト（エラーメッセージ付き）
    return {
      statusCode: 302,
      headers: {
        'Location': `https://mfagencybooking.netlify.app/?line_error=${encodeURIComponent(error.message)}`
      },
      body: ''
    };
  }
};
