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
      const updateResponse = await fetch(`https://api.notion.com/v1/pages/${sessionRecord.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          properties: {
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
          }
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update booking: ${errorText}`);
      }

      const updatedData = await updateResponse.json();
      console.log('Booking updated successfully');

      // 3. LINE通知を送信
      if (LINE_CHANNEL_ACCESS_TOKEN) {
        try {
          const bookingDate = properties['予定日']?.date?.start;
          const customerName = properties['名前']?.title?.[0]?.text?.content;
          const remarks = properties['備考']?.rich_text?.[0]?.text?.content || '';

          const message = `【予約完了】\n\n日付: ${bookingDate}\nお名前: ${customerName}\n${remarks ? `備考: ${remarks}\n` : ''}\n予約が完了しました！\n担当者から折り返しご連絡いたします。`;

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