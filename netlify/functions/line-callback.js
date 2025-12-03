exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    console.log('LINE callback started');
    const { code, state } = event.queryStringParameters;
    console.log('Code received:', code ? 'Yes' : 'No');

    if (!code) {
      console.log('Error: No authorization code');
      return {
        statusCode: 400,
        body: 'Authorization code not provided'
      };
    }

    const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID;
    const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
    const REDIRECT_URI = 'https://mfagencybooking.netlify.app/.netlify/functions/line-callback';

    console.log('LINE_CHANNEL_ID:', LINE_CHANNEL_ID ? 'Set' : 'Missing');
    console.log('LINE_CHANNEL_SECRET:', LINE_CHANNEL_SECRET ? 'Set' : 'Missing');

    if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
      console.log('Error: LINE credentials not configured');
      throw new Error('LINE credentials not configured');
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

    // リダイレクト先URL（元のページに戻る + User IDとrefをクエリパラメータで渡す）
    let redirectUrl = `https://mfagencybooking.netlify.app/?line_user_id=${encodeURIComponent(userId)}&line_name=${encodeURIComponent(displayName)}`;
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
