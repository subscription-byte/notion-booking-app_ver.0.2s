const { google } = require('googleapis');
const { isHoliday, isFixedBlockedTime, isInPersonBlocked, isShootingBlocked } = require('./shared/businessRules');

const sendChatWorkSystemAlert = async (message) => {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_ID;
  if (!token || !roomId) return;
  try {
    await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'X-ChatWorkToken': token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `body=${encodeURIComponent(message)}`,
    });
  } catch (e) {
    console.error('ChatWork system alert error:', e);
  }
};

const sendChatWorkBookingNotice = async (bookingDateStr, message) => {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_BOOKING_ROOM_ID;
  if (!token || !roomId) return;
  try {
    await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'X-ChatWorkToken': token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `body=${encodeURIComponent(message)}`,
    });
  } catch (e) {
    console.error('ChatWork notification error:', e);
  }
};

const formatBookingDateTime = (bookingDateStr) => {
  const match = bookingDateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return { dateStr: bookingDateStr, hourStr: '' };
  const [, year, month, day, hour] = match;
  return { dateStr: `${year}年${parseInt(month)}月${parseInt(day)}日`, hourStr: `${parseInt(hour)}時` };
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const requestBody = JSON.parse(event.body);
    const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
    const LINE_ACCESS_TOKENS = {
      personA: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      personC: process.env.LINE_CHANNEL_ACCESS_TOKEN_C,
    };

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

      console.log(`[重複チェック] slotStart=${slotStart.toISOString()} slotEnd=${slotEnd.toISOString()} 取得イベント数=${existingEvents.length}`);

      // 既存予約との重複チェック（仮登録以外）
      for (const evt of existingEvents) {
        const eventStatus = evt.extendedProperties?.private?.bookingStatus;
        if (eventStatus === '仮登録') continue;

        const existingStart = new Date(evt.start.dateTime || evt.start.date);
        const existingEnd = new Date(evt.end.dateTime || evt.end.date || new Date(existingStart.getTime() + 60 * 60 * 1000));

        console.log(`[重複チェック] イベント: "${evt.summary}" start=${existingStart.toISOString()} end=${existingEnd.toISOString()} colorId=${evt.colorId || 'none'} status=${eventStatus || 'none'}`);

        // 直接の時間重複チェック
        if (existingStart < slotEnd && existingEnd > slotStart) {
          console.log(`[重複チェック] 重複検出 → 409返却`);
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

      // 場所情報を設定（一覧で見やすいように）
      const location = '公式LINE（公認）';

      const updatedEvent = await calendar.events.patch({
        calendarId: GOOGLE_CALENDAR_ID,
        eventId: sessionEvent.id,
        requestBody: {
          summary: properties.summary,
          description: description,
          location: location,
          start: { dateTime: bookingDateStr },
          end: { dateTime: new Date(slotEnd).toISOString() },
          colorId: (sessionEvent.extendedProperties?.private?.lineChannel === 'personC') ? '2' : '11', // PersonC=セージ(2)、PersonA=トマト(11)
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
              lineChannel: sessionEvent.extendedProperties?.private?.lineChannel || 'personA',
              bookingStatus: '予約完了',
              sessionId: '', // セッションIDを削除
            }
          }
        }
      });

      console.log('Booking updated successfully');

      // 予約完了後の重複検証（アラート送信用）
      try {
        const verifyResponse = await calendar.events.list({
          calendarId: GOOGLE_CALENDAR_ID,
          timeMin: slotStart.toISOString(),
          timeMax: slotEnd.toISOString(),
          singleEvents: true,
        });
        const createdEventId = updatedEvent.data.id;
        const overlapping = (verifyResponse.data.items || []).filter(evt => {
          if (evt.id === createdEventId) return false;
          const evtStatus = evt.extendedProperties?.private?.bookingStatus;
          if (evtStatus === '仮登録') return false;
          const evtStart = new Date(evt.start.dateTime || evt.start.date);
          const evtEnd = new Date(evt.end.dateTime || evt.end.date || new Date(evtStart.getTime() + 60 * 60 * 1000));
          return evtStart < slotEnd && evtEnd > slotStart;
        });
        if (overlapping.length > 0) {
          const { dateStr: alertDateStr, hourStr: alertHourStr } = formatBookingDateTime(bookingDateStr);
          const overlapSummary = overlapping.map(e => `"${e.summary}" (${e.start.dateTime || e.start.date})`).join(', ');
          const alertMsg = `[警告] 予約完了後に時間重複を検出\n日時: ${alertDateStr} ${alertHourStr}\n予約者: ${properties.summary}\n重複イベント: ${overlapSummary}`;
          await sendChatWorkSystemAlert(alertMsg);
          console.warn('[重複警告] 予約完了後に重複イベントを検出:', overlapSummary);
        }
      } catch (verifyError) {
        console.error('[重複検証] エラー:', verifyError);
      }

      // 3. LINE通知を送信
      const lineChannel = sessionEvent.extendedProperties?.private?.lineChannel || 'personA';
      const lineToken = LINE_ACCESS_TOKENS[lineChannel] || LINE_ACCESS_TOKENS.personA;
      if (lineToken && lineUserId) {
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
              'Authorization': `Bearer ${lineToken}`
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

      // 4. ChatWork予約完了通知（LINE連携）
      const { dateStr: lineDateStr, hourStr: lineHourStr } = formatBookingDateTime(bookingDateStr);
      const lineChannelTitle = lineChannel === 'personC' ? 'PersonC（LINE連携）' : 'PersonA（LINE連携）';
      const lineChannelRoute = lineChannel === 'personC' ? 'まえかぶLINE（PersonC）' : '公認LINE（PersonA）';
      await sendChatWorkBookingNotice(bookingDateStr, `[info][title]【予約完了】${lineChannelTitle}[/title]日付: ${lineDateStr} ${lineHourStr}\nお名前: ${properties.summary || ''}\nXリンク: ${properties.xLink || 'なし'}\n備考: ${properties.remarks || 'なし'}\n経路: ${lineChannelRoute}\nmyfans登録: ${properties.myfansStatus || ''}\nP登録: ${properties.premiumStatus || ''}[/info]`);

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

    // 場所情報を設定（一覧で見やすいように）
    const location = 'X DM';

    const newEvent = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: properties.summary,
        description: description,
        location: location,
        start: { dateTime: bookingDateStr },
        end: { dateTime: new Date(slotEnd).toISOString() },
        colorId: '7', // ピーコック（水色）- 通常予約
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

    // 予約完了後の重複検証（アラート送信用）
    try {
      const verifyNormResponse = await calendar.events.list({
        calendarId: GOOGLE_CALENDAR_ID,
        timeMin: slotStart.toISOString(),
        timeMax: slotEnd.toISOString(),
        singleEvents: true,
      });
      const createdNormEventId = newEvent.data.id;
      const overlappingNorm = (verifyNormResponse.data.items || []).filter(evt => {
        if (evt.id === createdNormEventId) return false;
        const evtStatus = evt.extendedProperties?.private?.bookingStatus;
        if (evtStatus === '仮登録') return false;
        const evtStart = new Date(evt.start.dateTime || evt.start.date);
        const evtEnd = new Date(evt.end.dateTime || evt.end.date || new Date(evtStart.getTime() + 60 * 60 * 1000));
        return evtStart < slotEnd && evtEnd > slotStart;
      });
      if (overlappingNorm.length > 0) {
        const { dateStr: alertDateStr, hourStr: alertHourStr } = formatBookingDateTime(bookingDateStr);
        const overlapSummary = overlappingNorm.map(e => `"${e.summary}" (${e.start.dateTime || e.start.date})`).join(', ');
        const alertMsg = `[警告] 予約完了後に時間重複を検出\n日時: ${alertDateStr} ${alertHourStr}\n予約者: ${properties.summary}\n重複イベント: ${overlapSummary}`;
        await sendChatWorkSystemAlert(alertMsg);
        console.warn('[重複警告] 予約完了後に重複イベントを検出:', overlapSummary);
      }
    } catch (verifyError) {
      console.error('[重複検証] エラー:', verifyError);
    }

    // ChatWork予約完了通知（通常予約）
    const { dateStr: normDateStr, hourStr: normHourStr } = formatBookingDateTime(bookingDateStr);
    await sendChatWorkBookingNotice(bookingDateStr, `[info][title]【予約完了】通常予約[/title]日付: ${normDateStr} ${normHourStr}\nお名前: ${properties.summary || ''}\nXリンク: ${properties.xLink || 'なし'}\n備考: ${properties.remarks || 'なし'}\n経路: X DM（通常）\nmyfans登録: ${properties.myfansStatus || ''}\nP登録: ${properties.premiumStatus || ''}[/info]`);

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
