exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { type, data } = JSON.parse(event.body);
    const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
    const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID;

    // セキュリティ: 許可されたtypeのみ受け付ける
    const ALLOWED_TYPES = ['date_mismatch', 'system_error'];
    if (!ALLOWED_TYPES.includes(type)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid notification type' })
      };
    }

    let message = '';

    if (type === 'date_mismatch') {
      // 必須フィールドの検証
      const required = ['selectedDate', 'registeredDate', 'time', 'customerName'];
      const missing = required.filter(field => !data || !data[field]);
      if (missing.length) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` })
        };
      }

      // データのサニタイズ（長さ制限）
      const safeData = {
        selectedDate: String(data.selectedDate).substring(0, 50),
        registeredDate: String(data.registeredDate).substring(0, 50),
        time: String(data.time).substring(0, 20),
        customerName: String(data.customerName).substring(0, 100)
      };

      message = `[toall]\n[緊急] 予約システムアラート\n\n日付ズレが発生しました！\n\n選択日: ${safeData.selectedDate}\n登録日: ${safeData.registeredDate}\n時間: ${safeData.time}\nお客様: ${safeData.customerName}\n\nシステム設定を至急確認してください。`;
    } else if (type === 'system_error') {
      // 必須フィールドの検証
      if (!data || !data.errorMessage || !data.timestamp) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing required fields: errorMessage, timestamp' })
        };
      }

      // データのサニタイズ（長さ制限）
      const safeData = {
        errorMessage: String(data.errorMessage).substring(0, 500),
        timestamp: String(data.timestamp).substring(0, 50)
      };

      message = `[toall]\n[緊急] 予約システムエラー\n\nシステム異常が検出されました。\n\nエラー内容: ${safeData.errorMessage}\n発生時刻: ${safeData.timestamp}\n\n至急システムを確認してください。`;
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
