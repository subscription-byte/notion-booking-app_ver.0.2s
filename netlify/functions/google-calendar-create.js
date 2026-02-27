const { google } = require('googleapis');

// ============================================
// ブロックルール（フロントエンドと同一ロジック）
// ============================================

// 祝日リスト
const HOLIDAYS = [
  '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-23', '2025-03-20',
  '2025-04-29', '2025-05-03', '2025-05-04', '2025-05-05', '2025-07-21',
  '2025-08-11', '2025-09-15', '2025-09-23', '2025-10-13', '2025-11-03',
  '2025-11-23', '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23',
  '2026-03-20', '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-05-06', '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22',
  '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23'
];

const COMPANY_CLOSED_DAYS = [
  '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-02', '2026-01-03'
];

// 固定ブロックルール
const FIXED_BLOCKING_RULES = [
  { dayOfWeek: 2, startHour: 11, endHour: 16 }, // 火曜11-16時
  { dayOfWeek: 3, startHour: 13, endHour: 14 }, // 水曜13時台
  { dayOfWeek: null, excludeDays: [2], startHour: 15, endHour: 16 }, // 全日15時台（火曜除く）
];

const isHoliday = (date) => {
  const dateString = date.toISOString().split('T')[0];
  return HOLIDAYS.includes(dateString) || COMPANY_CLOSED_DAYS.includes(dateString);
};

const isFixedBlockedTime = (date, timeHour) => {
  const dayOfWeek = date.getDay();
  for (const rule of FIXED_BLOCKING_RULES) {
    if (rule.dayOfWeek !== null && rule.dayOfWeek !== dayOfWeek) continue;
    if (rule.excludeDays && rule.excludeDays.includes(dayOfWeek)) continue;
    if (timeHour >= rule.startHour && timeHour < rule.endHour) return true;
  }
  return false;
};

const isInPersonBlocked = (event, slotStart, slotEnd) => {
  const eventStart = event.start.dateTime || event.start.date;
  const eventEnd = event.end.dateTime || event.end.date;
  const extendedProps = event.extendedProperties?.private || {};
  const callMethod = extendedProps.callMethod;
  const eventName = event.summary || '';

  if (!eventStart) return false;

  const isInPerson = callMethod === '対面' || eventName.includes('対面');
  if (!isInPerson) return false;

  const existingStart = new Date(eventStart);
  const existingEnd = new Date(eventEnd || new Date(existingStart.getTime() + 60 * 60 * 1000));
  const blockStart = new Date(existingStart.getTime() - 3 * 60 * 60 * 1000);
  const blockEnd = new Date(existingEnd.getTime() + 3 * 60 * 60 * 1000);

  return (blockStart <= slotEnd && blockEnd >= slotStart);
};

const isShootingBlocked = (event, slotStart, slotEnd) => {
  const eventStart = event.start.dateTime || event.start.date;
  const eventEnd = event.end.dateTime || event.end.date;
  const extendedProps = event.extendedProperties?.private || {};
  const callMethod = extendedProps.callMethod;
  const eventName = event.summary || '';

  if (!eventStart) return false;

  const isShooting = callMethod === '撮影' || eventName.includes('撮影');
  if (!isShooting) return false;

  const existingStart = new Date(eventStart);
  const existingEnd = new Date(eventEnd || new Date(existingStart.getTime() + 60 * 60 * 1000));

  const dayStart = new Date(existingStart);
  dayStart.setHours(12, 0, 0, 0);
  const blockEnd = new Date(existingEnd.getTime() + 3 * 60 * 60 * 1000);

  return (dayStart <= slotEnd && blockEnd >= slotStart);
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const requestBody = JSON.parse(event.body);
    const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
    const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    // セキュリティ: 許可されたカレンダーIDのみ書き込み可能
    const targetCalendarId = requestBody?.calendarId;
    if (targetCalendarId !== GOOGLE_CALENDAR_ID) {
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

    // セッションIDがある場合は、セッション方式の予約作成
    const sessionId = requestBody?.sessionId;
    if (sessionId) {
      console.log('Session-based booking creation:', sessionId);
      console.log('Request properties:', JSON.stringify(requestBody.properties, null, 2));

      // 1. Googleカレンダーからセッション情報を取得
      // Google Calendar APIはextendedPropertiesでフィルタできないため、
      // 2099年の仮登録データを取得して検索
      const year2099Start = new Date('2099-01-01T00:00:00Z');
      const year2099End = new Date('2100-01-01T00:00:00Z');

      const queryResponse = await calendar.events.list({
        calendarId: GOOGLE_CALENDAR_ID,
        timeMin: year2099Start.toISOString(),
        timeMax: year2099End.toISOString(),
        singleEvents: true,
        maxResults: 500,
      });

      console.log('Found 2099 events:', queryResponse.data.items.length);
      console.log('SessionIDs found:', queryResponse.data.items.map(e => e.extendedProperties?.private?.sessionId).filter(Boolean));

      const sessionEvent = queryResponse.data.items.find(e =>
        e.extendedProperties?.private?.sessionId === sessionId
      );

      if (!sessionEvent) {
        console.error('Session not found:', sessionId);
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Invalid or expired session' })
        };
      }

      console.log('Session event found:', sessionEvent.id, sessionEvent.summary);

      // セッションの状況チェック
      const sessionStatus = sessionEvent.extendedProperties?.private?.bookingStatus;
      if (sessionStatus !== '仮登録') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Session already used or invalid' })
        };
      }

      // LINE User IDを取得
      const lineUserId = sessionEvent.extendedProperties?.private?.lineUserId;
      if (!lineUserId) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Session record has no LINE User ID' })
        };
      }

      console.log('Session validated, LINE User ID:', lineUserId);

      // 2. 仮レコードを本レコードに更新
      const properties = requestBody?.properties || {};
      const bookingDateStr = properties.date?.start;

      if (!bookingDateStr) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid booking date' })
        };
      }

      const bookingDate = new Date(bookingDateStr);
      if (isNaN(bookingDate.getTime())) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid booking date format' })
        };
      }

      // JSTの日付・時刻を取得（UTCから+9時間）
      const jstOffset = 9 * 60; // 分単位
      const jstDate = new Date(bookingDate.getTime() + jstOffset * 60 * 1000);
      const timeHour = jstDate.getUTCHours();

      // 土日チェック（JST基準）
      const dayOfWeek = jstDate.getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Weekends are not available for booking' })
        };
      }

      // 祝日チェック（JST基準）
      if (isHoliday(jstDate)) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Holidays are not available for booking' })
        };
      }

      // 固定ブロック時間チェック
      if (isFixedBlockedTime(bookingDate, timeHour)) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'This time slot is blocked by fixed rules' })
        };
      }

      // Googleカレンダーから既存予約を取得して重複チェック（JST基準の日付）
      const dayStart = new Date(jstDate.getUTCFullYear(), jstDate.getUTCMonth(), jstDate.getUTCDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const queryExistingResponse = await calendar.events.list({
        calendarId: GOOGLE_CALENDAR_ID,
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        singleEvents: true,
      });

      const existingEvents = queryExistingResponse.data.items || [];

      // スロット時間の定義
      const slotStart = new Date(bookingDateStr);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

      // 既存予約との重複チェック（仮登録以外）
      for (const evt of existingEvents) {
        const eventStatus = evt.extendedProperties?.private?.bookingStatus;
        if (eventStatus === '仮登録') continue;

        const existingStart = new Date(evt.start.dateTime || evt.start.date);
        const existingEnd = new Date(evt.end.dateTime || evt.end.date || new Date(existingStart.getTime() + 60 * 60 * 1000));

        // 直接の時間重複チェック
        if (existingStart < slotEnd && existingEnd > slotStart) {
          return {
            statusCode: 409,
            body: JSON.stringify({ error: 'This time slot is already booked' })
          };
        }
      }

      // 対面通話ブロックチェック
      for (const evt of existingEvents) {
        const eventStatus = evt.extendedProperties?.private?.bookingStatus;
        if (eventStatus === '仮登録') continue;

        if (isInPersonBlocked(evt, slotStart, slotEnd)) {
          return {
            statusCode: 409,
            body: JSON.stringify({ error: 'This time slot is blocked due to an in-person appointment' })
          };
        }
      }

      // 撮影ブロックチェック
      for (const evt of existingEvents) {
        const eventStatus = evt.extendedProperties?.private?.bookingStatus;
        if (eventStatus === '仮登録') continue;

        if (isShootingBlocked(evt, slotStart, slotEnd)) {
          return {
            statusCode: 409,
            body: JSON.stringify({ error: 'This time slot is blocked due to a shooting session' })
          };
        }
      }

      // イベント更新
      const description = `予約者: ${properties.summary || ''}
Xリンク: ${properties.xLink || ''}
備考: ${properties.remarks || ''}
経路: ${properties.route || ''}
通話方法: ${properties.callMethod || ''}
myfans登録状況: ${properties.myfansStatus || ''}
P登録状況: ${properties.premiumStatus || ''}`;

      const updatedEvent = await calendar.events.patch({
        calendarId: GOOGLE_CALENDAR_ID,
        eventId: sessionEvent.id,
        requestBody: {
          summary: properties.summary,
          description: description,
          start: { dateTime: bookingDateStr },
          end: { dateTime: new Date(slotEnd).toISOString() },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 10 },  // 10分前
              { method: 'popup', minutes: 1 },   // 1分前
            ]
          },
          extendedProperties: {
            private: {
              ...sessionEvent.extendedProperties?.private,
              xLink: properties.xLink || '',
              remarks: properties.remarks || '',
              route: properties.route || '',
              callMethod: properties.callMethod || '',
              myfansStatus: properties.myfansStatus || '',
              premiumStatus: properties.premiumStatus || '',
              lineUserId: lineUserId,
              bookingStatus: '予約完了',
              sessionId: '', // セッションIDを削除
            }
          }
        }
      });

      console.log('Booking updated successfully');

      // 3. LINE通知を送信
      if (LINE_CHANNEL_ACCESS_TOKEN && lineUserId) {
        try {
          const match = bookingDateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
          let formattedDate = bookingDateStr;
          if (match) {
            const [, year, month, day, hour] = match;
            formattedDate = `${year}年${parseInt(month)}月${parseInt(day)}日 ${parseInt(hour)}時`;
          }

          const message = `【予約完了】\n\n日付: ${formattedDate}\nお名前: ${properties.summary}\n${properties.remarks ? `備考: ${properties.remarks}\n` : ''}\n予約が完了しました！\n担当者から折り返しご連絡いたします。`;

          await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
              to: lineUserId,
              messages: [{ type: 'text', text: message }]
            })
          });

          console.log('LINE notification sent successfully');
        } catch (lineError) {
          console.error('LINE notification error:', lineError);
        }
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ id: updatedEvent.data.id })
      };
    }

    // 従来方式（セッションIDなし）の予約作成
    const properties = requestBody?.properties || {};
    const bookingDateStr = properties.date?.start;

    if (!bookingDateStr) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid booking date' })
      };
    }

    const bookingDate = new Date(bookingDateStr);
    if (isNaN(bookingDate.getTime())) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid booking date format' })
      };
    }

    // JSTの日付・時刻を取得（UTCから+9時間）
    const jstOffset = 9 * 60; // 分単位
    const jstDate = new Date(bookingDate.getTime() + jstOffset * 60 * 1000);
    const timeHour = jstDate.getUTCHours();

    // 土日チェック（JST基準）
    const dayOfWeek = jstDate.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Weekends are not available for booking' })
      };
    }

    // 祝日チェック（JST基準）
    if (isHoliday(jstDate)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Holidays are not available for booking' })
      };
    }

    // 固定ブロック時間チェック（JST基準）
    if (isFixedBlockedTime(jstDate, timeHour)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'This time slot is blocked by fixed rules' })
      };
    }

    // Googleカレンダーから既存予約を取得（JST基準の日付）
    const dayStart = new Date(jstDate.getUTCFullYear(), jstDate.getUTCMonth(), jstDate.getUTCDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const queryResponse = await calendar.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
    });

    const existingEvents = queryResponse.data.items || [];

    // スロット時間の定義
    const slotStart = new Date(bookingDateStr);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

    // 既存予約との重複チェック
    for (const evt of existingEvents) {
      const existingStart = new Date(evt.start.dateTime || evt.start.date);
      const existingEnd = new Date(evt.end.dateTime || evt.end.date || new Date(existingStart.getTime() + 60 * 60 * 1000));

      if (existingStart < slotEnd && existingEnd > slotStart) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'This time slot is already booked' })
        };
      }
    }

    // 対面通話ブロックチェック
    for (const evt of existingEvents) {
      if (isInPersonBlocked(evt, slotStart, slotEnd)) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'This time slot is blocked due to an in-person appointment' })
        };
      }
    }

    // 撮影ブロックチェック
    for (const evt of existingEvents) {
      if (isShootingBlocked(evt, slotStart, slotEnd)) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'This time slot is blocked due to a shooting session' })
        };
      }
    }

    // ============================================
    // すべてのチェックをパス → 予約作成
    // ============================================
    const description = `予約者: ${properties.summary || ''}
Xリンク: ${properties.xLink || ''}
備考: ${properties.remarks || ''}
経路: ${properties.route || ''}
通話方法: ${properties.callMethod || ''}
myfans登録状況: ${properties.myfansStatus || ''}
P登録状況: ${properties.premiumStatus || ''}`;

    const newEvent = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: properties.summary,
        description: description,
        start: { dateTime: bookingDateStr },
        end: { dateTime: new Date(slotEnd).toISOString() },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 10 },  // 10分前
            { method: 'popup', minutes: 0 },   // 時間ぴったり
          ]
        },
        extendedProperties: {
          private: {
            xLink: properties.xLink || '',
            remarks: properties.remarks || '',
            route: properties.route || '',
            assignee: properties.assignee || '',
            callMethod: properties.callMethod || '',
            lineUserId: properties.lineUserId || '',
            myfansStatus: properties.myfansStatus || '',
            premiumStatus: properties.premiumStatus || '',
            bookingStatus: '予約完了',
            sessionId: properties.sessionId || '',
          }
        }
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ id: newEvent.data.id })
    };
  } catch (error) {
    console.error('Google Calendar create error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
