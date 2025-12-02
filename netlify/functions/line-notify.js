exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId, message } = JSON.parse(event.body);
    const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
    }

    // セキュリティ: 必須フィールドの検証
    if (!userId || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: userId, message' })
      };
    }

    // データのサニタイズ
    const safeUserId = String(userId).substring(0, 100);
    const safeMessage = String(message).substring(0, 5000); // LINEの最大文字数制限

    // LINE Messaging API: Push Message
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: safeUserId,
        messages: [
          {
            type: 'text',
            text: safeMessage
          }
        ]
      })
    });

    const statusCode = response.status;

    if (statusCode !== 200) {
      const errorText = await response.text();
      throw new Error(`LINE API error (${statusCode}): ${errorText}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('LINE notification error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
