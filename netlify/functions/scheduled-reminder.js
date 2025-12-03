/**
 * Netlify Scheduled Function - LINE自動リマインド送信
 *
 * 実行タイミング:
 * - 毎日18:00 (JST) → 翌日の予約に前日リマインド送信
 * - 15分おき → 15分後の予約に当日リマインド送信
 *
 * Notion DBから予約データを取得し、条件に合致する予約にLINE通知を送信
 */

const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';

exports.handler = async (event, context) => {
  console.log('🔔 Scheduled reminder function started');

  try {
    const now = new Date();
    const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

    console.log('Current time (JST):', jstNow.toISOString());

    // 前日18時リマインド処理
    await sendDayBeforeReminders(jstNow);

    // 当日15分前リマインド処理
    await send15MinuteReminders(jstNow);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Reminder check completed' })
    };
  } catch (error) {
    console.error('❌ Error in scheduled reminder:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

/**
 * 前日18時リマインド送信
 * 毎日18:00に実行され、翌日の予約に通知を送る
 */
async function sendDayBeforeReminders(jstNow) {
  const currentHour = jstNow.getHours();

  // 18:00-18:14の間のみ実行（15分間隔実行を想定）
  if (currentHour !== 18) {
    console.log('⏭️  Skip: Not 18:00 JST (current hour:', currentHour, ')');
    return;
  }

  console.log('📅 Checking day-before reminders...');

  // 翌日の日付を取得
  const tomorrow = new Date(jstNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDateStr = formatDateForNotion(tomorrow);

  console.log('Target date (tomorrow):', tomorrowDateStr);

  // Notionから翌日の予約を取得
  const bookings = await fetchBookingsForDate(tomorrowDateStr);

  console.log(`Found ${bookings.length} bookings for tomorrow`);

  for (const booking of bookings) {
    const status = booking.properties['ステータス']?.select?.name;
    const lineUserId = booking.properties['LINE User ID']?.rich_text?.[0]?.text?.content;
    const dateTime = booking.properties['予定日']?.date?.start;
    const zoomLink = booking.properties['ZOOMリンク']?.url;

    // ステータスチェック（リスケ・未確定は除外）
    if (status === 'リスケ' || status === '未確定') {
      console.log(`⏭️  Skip booking (status: ${status}):`, booking.id);
      continue;
    }

    // LINE User IDがない場合はスキップ
    if (!lineUserId) {
      console.log('⏭️  Skip booking (no LINE User ID):', booking.id);
      continue;
    }

    // 前日リマインド送信済みフラグをチェック
    const dayBeforeReminderSent = booking.properties['前日通知']?.checkbox;
    if (dayBeforeReminderSent) {
      console.log('⏭️  Skip booking (day-before reminder already sent):', booking.id);
      continue;
    }

    // メッセージ作成
    const formattedDateTime = formatDateTime(dateTime);
    let message = `【ご予約日前日のお知らせ】\n\n${formattedDateTime}\n`;

    if (zoomLink) {
      message += `\nZOOMリンク:\n${zoomLink}\n`;
    }

    message += `\n明日はよろしくお願いいたします！`;

    // LINE通知送信
    const success = await sendLineNotification(lineUserId, message);

    if (success) {
      // Notionに送信済みフラグを立てる
      await updateBookingReminderFlag(booking.id, 'day_before');
      console.log('✅ Day-before reminder sent:', booking.id);
    } else {
      console.error('❌ Failed to send day-before reminder:', booking.id);
    }
  }
}

/**
 * 当日15分前リマインド送信
 * 15分おきに実行され、15分後の予約に通知を送る
 */
async function send15MinuteReminders(jstNow) {
  console.log('⏰ Checking 15-minute reminders...');

  // 現在時刻の15分後を計算
  const in15Minutes = new Date(jstNow.getTime() + 15 * 60 * 1000);
  const targetDateStr = formatDateForNotion(in15Minutes);
  const targetHour = in15Minutes.getHours();
  const targetMinute = in15Minutes.getMinutes();

  console.log('Target time (15 min later):', in15Minutes.toISOString());

  // Notionから当日の予約を取得
  const bookings = await fetchBookingsForDate(targetDateStr);

  console.log(`Found ${bookings.length} bookings for today`);

  for (const booking of bookings) {
    const status = booking.properties['ステータス']?.select?.name;
    const lineUserId = booking.properties['LINE User ID']?.rich_text?.[0]?.text?.content;
    const dateTime = booking.properties['予定日']?.date?.start;
    const zoomLink = booking.properties['ZOOMリンク']?.url;

    // ステータスチェック（リスケ・未確定は除外）
    if (status === 'リスケ' || status === '未確定') {
      console.log(`⏭️  Skip booking (status: ${status}):`, booking.id);
      continue;
    }

    // LINE User IDがない場合はスキップ
    if (!lineUserId) {
      console.log('⏭️  Skip booking (no LINE User ID):', booking.id);
      continue;
    }

    // 予約時刻をパース
    const bookingDateTime = new Date(dateTime);
    const bookingHour = bookingDateTime.getHours();
    const bookingMinute = bookingDateTime.getMinutes();

    // 15分後の時刻と一致するかチェック
    if (bookingHour !== targetHour || bookingMinute !== targetMinute) {
      continue;
    }

    // 15分前リマインド送信済みフラグをチェック
    const fifteenMinReminderSent = booking.properties['当日通知']?.checkbox;
    if (fifteenMinReminderSent) {
      console.log('⏭️  Skip booking (15-min reminder already sent):', booking.id);
      continue;
    }

    // メッセージ作成
    let message = `【ご予約15分前のお知らせ】\n\n本日はよろしくお願いいたします！\nお時間になりましたらご入室をお願いいたします！\n`;

    if (zoomLink) {
      message += `\nZOOMリンク:\n${zoomLink}\n`;
    }

    message += `\n（※担当者の状況により、直接のご連絡と前後して本通知が送られている場合がございます。ご容赦くださいますと幸いです。）`;

    // LINE通知送信
    const success = await sendLineNotification(lineUserId, message);

    if (success) {
      // Notionに送信済みフラグを立てる
      await updateBookingReminderFlag(booking.id, '15_minutes');
      console.log('✅ 15-minute reminder sent:', booking.id);
    } else {
      console.error('❌ Failed to send 15-minute reminder:', booking.id);
    }
  }
}

/**
 * Notionから指定日の予約を取得
 */
async function fetchBookingsForDate(dateStr) {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: '予定日',
        date: {
          equals: dateStr
        }
      }
    });

    return response.results;
  } catch (error) {
    console.error('❌ Error fetching bookings from Notion:', error);
    return [];
  }
}

/**
 * LINE通知を送信
 */
async function sendLineNotification(userId, message) {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LINE API error:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending LINE notification:', error);
    return false;
  }
}

/**
 * Notionの予約に送信済みフラグを立てる
 */
async function updateBookingReminderFlag(pageId, reminderType) {
  try {
    const propertyName = reminderType === 'day_before'
      ? '前日通知'
      : '当日通知';

    await notion.pages.update({
      page_id: pageId,
      properties: {
        [propertyName]: {
          checkbox: true
        }
      }
    });

    return true;
  } catch (error) {
    console.error('❌ Error updating reminder flag in Notion:', error);
    return false;
  }
}

/**
 * 日付をNotion形式にフォーマット (YYYY-MM-DD)
 */
function formatDateForNotion(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日時を読みやすい形式にフォーマット
 */
function formatDateTime(isoString) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}年${month}月${day}日 ${hour}:${minute}`;
}
