exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { type, data } = JSON.parse(event.body);
    const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
    const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID;

    let message = '';

    if (type === 'date_mismatch') {
      message = `[toall]\n[緊急] 予約システムアラート\n\n日付ズレが発生しました！\n\n選択日: ${data.selectedDate}\n登録日: ${data.registeredDate}\n時間: ${data.time}\nお客様: ${data.customerName}\n\nシステム設定を至急確認してください。`;
    } else if (type === 'system_error') {
      message = `[toall]\n[緊急] 予約システムエラー\n\nシステム異常が検出されました。\n\nエラー内容: ${data.errorMessage}\n発生時刻: ${data.timestamp}\n\n至急システムを確認してください。`;
    }

    const response = await fetch(
      `https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'X-ChatWorkToken': CHATWORK_API_TOKEN,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `body=${encodeURIComponent(message)}`,
      }
    );

    if (!response.ok) {
      throw new Error('ChatWork API error');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('ChatWork notification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
