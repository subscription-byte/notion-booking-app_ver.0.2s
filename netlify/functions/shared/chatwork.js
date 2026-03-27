/**
 * ChatWork通知ユーティリティ
 * システムアラート（CHATWORK_ROOM_ID）送信用の共通関数
 */

const sendChatWorkSystemAlert = async (message) => {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_ID;
  if (!token || !roomId) {
    console.error('[ChatWork] 環境変数未設定: CHATWORK_API_TOKEN / CHATWORK_ROOM_ID');
    return;
  }
  try {
    const res = await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'X-ChatWorkToken': token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `body=${encodeURIComponent(message)}`,
    });
    if (!res.ok) {
      console.error('[ChatWork] アラート送信失敗:', res.status, await res.text());
    }
  } catch (e) {
    console.error('[ChatWork] アラート送信エラー:', e);
  }
};

module.exports = { sendChatWorkSystemAlert };
