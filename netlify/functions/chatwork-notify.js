exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { type, data } = JSON.parse(event.body);
    const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
    const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID;
    const CHATWORK_BOOKING_ROOM_ID = process.env.CHATWORK_BOOKING_ROOM_ID;

    // セキュリティ: 許可されたtypeのみ受け付ける
    const ALLOWED_TYPES = ['date_mismatch', 'system_error', 'booking_complete'];
    if (!ALLOWED_TYPES.includes(type)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid notification type' })
      };
    }

    let message = '';
    let roomId = CHATWORK_ROOM_ID; // デフォルトはエラー通知ルーム

    if (type === 'booking_complete') {
      // 予約通知ルームに送信
      roomId = CHATWORK_BOOKING_ROOM_ID;

      // 必須フィールドの検証
      const required = ['date', 'time', 'customerName'];
      const missing = required.filter(field => !data || !data[field]);
      if (missing.length) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` })
        };
      }

      // データのサニタイズ（長さ制限）
      const safeData = {
        date: String(data.date).substring(0, 50),
        time: String(data.time).substring(0, 20),
        customerName: String(data.customerName).substring(0, 100),
        xLink: data.xLink ? String(data.xLink).substring(0, 200) : '',
        remarks: data.remarks ? String(data.remarks).substring(0, 300) : 'なし',
        route: data.route ? String(data.route).substring(0, 50) : '',
        callMethod: data.callMethod ? String(data.callMethod).substring(0, 50) : 'なし',
        myfansStatus: data.myfansStatus ? String(data.myfansStatus).substring(0, 50) : '',
        premiumStatus: data.premiumStatus ? String(data.premiumStatus).substring(0, 50) : '',
      };

      // 時間から「〇時」形式を生成（例: "14:00" → "14時"）
      const hourMatch = safeData.time.match(/^(\d+):/);
      const hourStr = hourMatch ? `${parseInt(hourMatch[1])}時` : safeData.time;

      message = `日付: ${safeData.date} ${hourStr}\nお名前: ${safeData.customerName}\nXリンク: ${safeData.xLink}\n備考: ${safeData.remarks}\n経路: ${safeData.route}\n通話方法: ${safeData.callMethod}\nmyfans登録: ${safeData.myfansStatus}\nP登録: ${safeData.premiumStatus}`;

    } else if (type === 'date_mismatch') {
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
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
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
