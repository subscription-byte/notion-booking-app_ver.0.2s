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
  const eventStart = event.properties['予定日']?.date?.start;
  const eventEnd = event.properties['予定日']?.date?.end;
  const callMethod = event.properties['通話方法']?.select?.name;
  const eventName = event.properties['名前']?.title?.[0]?.text?.content || '';

  if (!eventStart) return false;

  const isInPerson = callMethod === '対面' || eventName.includes('対面');
  if (!isInPerson) return false;

  const existingStart = new Date(eventStart);
  const existingEnd = eventEnd ? new Date(eventEnd) : new Date(existingStart.getTime() + 60 * 60 * 1000);
  const blockStart = new Date(existingStart.getTime() - 3 * 60 * 60 * 1000);
  const blockEnd = new Date(existingEnd.getTime() + 3 * 60 * 60 * 1000);

  return (blockStart <= slotEnd && blockEnd >= slotStart);
};

const isShootingBlocked = (event, slotStart, slotEnd) => {
  const eventStart = event.properties['予定日']?.date?.start;
  const eventEnd = event.properties['予定日']?.date?.end;
  const callMethod = event.properties['通話方法']?.select?.name;
  const eventName = event.properties['名前']?.title?.[0]?.text?.content || '';

  if (!eventStart) return false;

  const isShooting = callMethod === '撮影' || eventName.includes('撮影');
  if (!isShooting) return false;

  const existingStart = new Date(eventStart);
  const existingEnd = eventEnd ? new Date(eventEnd) : new Date(existingStart.getTime() + 60 * 60 * 1000);

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
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_DB_ID = process.env.NOTION_DB_ID;
    const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    // セキュリティ: 許可されたデータベースIDのみ書き込み可能
    const ALLOWED_DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';
    const targetDatabaseId = requestBody?.parent?.database_id;

    if (targetDatabaseId !== ALLOWED_DATABASE_ID) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden: Invalid database ID' })
      };
    }

    // セッションIDがある場合は、セッション方式の予約作成
    const sessionId = requestBody?.sessionId;
    if (sessionId) {
      console.log('Session-based booking creation:', sessionId);

      // 1. Notionからセッション情報を取得
      const queryResponse = await fetch('https://api.notion.com/v1/databases/' + NOTION_DB_ID + '/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          filter: {
            property: 'セッションID',
            rich_text: {
              equals: sessionId
            }
          }
        })
      });

      if (!queryResponse.ok) {
        throw new Error('Failed to query session from Notion');
      }

      const queryData = await queryResponse.json();
      const sessionRecord = queryData.results[0];

      if (!sessionRecord) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Invalid or expired session' })
        };
      }

      // セッションの状況チェック
      const sessionStatus = sessionRecord.properties['予約システム状況']?.select?.name;
      if (sessionStatus !== '仮登録') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Session already used or invalid' })
        };
      }

      // LINE User IDを取得
      const lineUserId = sessionRecord.properties['LINE User ID']?.rich_text?.[0]?.text?.content;
      if (!lineUserId) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Session record has no LINE User ID' })
        };
      }

      console.log('Session validated, LINE User ID:', lineUserId);

      // 2. 仮レコードを本レコードに更新
      const properties = requestBody?.properties || {};

      // ============================================
      // セッション方式でも同様のチェックを実施
      // ============================================
      const bookingDateStr = properties['予定日']?.date?.start;
      if (!bookingDateStr) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid booking date' })
        };
      }

      const bookingDate = new Date(bookingDateStr);
      const timeHour = bookingDate.getUTCHours() + 9; // JST変換

      // 土日チェック
      const dayOfWeek = bookingDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Weekends are not available for booking' })
        };
      }

      // 祝日チェック
      if (isHoliday(bookingDate)) {
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

      // Notionから既存予約を取得して重複チェック
      const queryExistingResponse = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          filter: {
            and: [
              {
                property: '予定日',
                date: {
                  on_or_after: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate()).toISOString().split('T')[0]
                }
              },
              {
                property: '予定日',
                date: {
                  on_or_before: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate() + 1).toISOString().split('T')[0]
                }
              }
            ]
          }
        })
      });

      if (!queryExistingResponse.ok) {
        throw new Error('Failed to query existing bookings from Notion');
      }

      const existingData = await queryExistingResponse.json();
      const existingEvents = existingData.results || [];

      // スロット時間の定義
      const slotStart = new Date(bookingDateStr);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

      // 既存予約との重複チェック（仮登録以外）
      for (const event of existingEvents) {
        // 仮登録は除外
        const eventStatus = event.properties['予約システム状況']?.select?.name;
        if (eventStatus === '仮登録') continue;

        const eventStart = event.properties['予定日']?.date?.start;
        if (!eventStart) continue;

        const existingStart = new Date(eventStart);
        const existingEnd = event.properties['予定日']?.date?.end
          ? new Date(event.properties['予定日'].date.end)
          : new Date(existingStart.getTime() + 60 * 60 * 1000);

        // 直接の時間重複チェック
        if (existingStart < slotEnd && existingEnd > slotStart) {
          return {
            statusCode: 409,
            body: JSON.stringify({ error: 'This time slot is already booked' })
          };
        }
      }

      // 対面通話ブロックチェック
      for (const event of existingEvents) {
        const eventStatus = event.properties['予約システム状況']?.select?.name;
        if (eventStatus === '仮登録') continue;

        if (isInPersonBlocked(event, slotStart, slotEnd)) {
          return {
            statusCode: 409,
            body: JSON.stringify({ error: 'This time slot is blocked due to an in-person appointment' })
          };
        }
      }

      // 撮影ブロックチェック
      for (const event of existingEvents) {
        const eventStatus = event.properties['予約システム状況']?.select?.name;
        if (eventStatus === '仮登録') continue;

        if (isShootingBlocked(event, slotStart, slotEnd)) {
          return {
            statusCode: 409,
            body: JSON.stringify({ error: 'This time slot is blocked due to a shooting session' })
          };
        }
      }

      // PATCH更新用のプロパティを構築
      const updateProperties = {
        ...properties,
        'LINE User ID': {
          rich_text: [{ text: { content: lineUserId } }]
        },
        '予約システム状況': {
          select: { name: '予約完了' }
        },
        'セッションID': {
          rich_text: []  // セッションIDを削除
        }
      };

      const updateResponse = await fetch(`https://api.notion.com/v1/pages/${sessionRecord.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          properties: updateProperties
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Notion update error:', errorText);
        console.error('Properties being sent:', JSON.stringify(properties, null, 2));
        throw new Error(`Failed to update booking: ${errorText}`);
      }

      const updatedData = await updateResponse.json();
      console.log('Booking updated successfully');

      // 3. LINE通知を送信
      if (LINE_CHANNEL_ACCESS_TOKEN) {
        try {
          const bookingDateStr = properties['予定日']?.date?.start;
          const customerName = properties['名前']?.title?.[0]?.text?.content;
          const remarks = properties['備考']?.rich_text?.[0]?.text?.content || '';

          // 日時フォーマット: 2025年12月12日 18時
          let formattedDate = bookingDateStr;
          if (bookingDateStr) {
            // ISO文字列から日時を直接抽出（タイムゾーン変換を避ける）
            const match = bookingDateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
            if (match) {
              const [, year, month, day, hour] = match;
              formattedDate = `${year}年${parseInt(month)}月${parseInt(day)}日 ${parseInt(hour)}時`;
            }
          }

          const message = `【予約完了】\n\n日付: ${formattedDate}\nお名前: ${customerName}\n${remarks ? `備考: ${remarks}\n` : ''}\n予約が完了しました！\n担当者から折り返しご連絡いたします。`;

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
          // LINE通知失敗しても予約は完了しているので続行
        }
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify(updatedData)
      };
    }

    // 従来方式（セッションIDなし）の予約作成
    const properties = requestBody?.properties || {};

    // 名前と予定日は常に必須
    const requiredFields = ['名前', '予定日'];

    // LINE User IDがない場合のみXリンクを必須に
    const hasLineUserId = properties['LINE User ID']?.rich_text?.[0]?.text?.content;
    if (!hasLineUserId) {
      requiredFields.push('X');
    }

    for (const field of requiredFields) {
      if (!properties[field]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Missing required field: ${field}` })
        };
      }
    }

    // ============================================
    // 重複チェック: Notionから最新データを取得
    // ============================================
    const bookingDateStr = properties['予定日']?.date?.start;
    if (!bookingDateStr) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid booking date' })
      };
    }

    const bookingDate = new Date(bookingDateStr);
    const timeHour = bookingDate.getUTCHours() + 9; // JST変換

    // 土日チェック
    const dayOfWeek = bookingDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Weekends are not available for booking' })
      };
    }

    // 祝日チェック
    if (isHoliday(bookingDate)) {
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

    // Notionから既存予約を取得
    const queryResponse = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        filter: {
          and: [
            {
              property: '予定日',
              date: {
                on_or_after: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate()).toISOString().split('T')[0]
              }
            },
            {
              property: '予定日',
              date: {
                on_or_before: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate() + 1).toISOString().split('T')[0]
              }
            }
          ]
        }
      })
    });

    if (!queryResponse.ok) {
      throw new Error('Failed to query existing bookings from Notion');
    }

    const queryData = await queryResponse.json();
    const existingEvents = queryData.results;

    // スロット時間の定義
    const slotStart = new Date(bookingDateStr);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

    // 既存予約との重複チェック
    for (const event of existingEvents) {
      const eventStart = event.properties['予定日']?.date?.start;
      if (!eventStart) continue;

      const existingStart = new Date(eventStart);
      const existingEnd = event.properties['予定日']?.date?.end
        ? new Date(event.properties['予定日'].date.end)
        : new Date(existingStart.getTime() + 60 * 60 * 1000);

      // 直接の時間重複チェック
      if (existingStart < slotEnd && existingEnd > slotStart) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'This time slot is already booked' })
        };
      }
    }

    // 対面通話ブロックチェック
    for (const event of existingEvents) {
      if (isInPersonBlocked(event, slotStart, slotEnd)) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'This time slot is blocked due to an in-person appointment' })
        };
      }
    }

    // 撮影ブロックチェック
    for (const event of existingEvents) {
      if (isShootingBlocked(event, slotStart, slotEnd)) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'This time slot is blocked due to a shooting session' })
        };
      }
    }

    // ============================================
    // すべてのチェックをパス → 予約作成
    // ============================================
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    return {
      statusCode: response.ok ? 200 : 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Notion create error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};