exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const requestBody = JSON.parse(event.body);

    // セキュリティ: 許可されたデータベースIDのみ書き込み可能
    const ALLOWED_DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';
    const targetDatabaseId = requestBody?.parent?.database_id;

    if (targetDatabaseId !== ALLOWED_DATABASE_ID) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden: Invalid database ID' })
      };
    }

    // 必須フィールドの検証
    const requiredFields = ['名前', '予定日', 'X'];
    const properties = requestBody?.properties || {};

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
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};