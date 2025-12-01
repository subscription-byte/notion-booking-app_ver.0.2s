exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { databaseId, filter } = JSON.parse(event.body);

    // セキュリティ: 許可されたデータベースIDのみアクセス可能
    const ALLOWED_DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';
    if (databaseId !== ALLOWED_DATABASE_ID) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden: Invalid database ID' })
      };
    }

    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ filter })
    });

    const data = await response.json();
    
    return {
      statusCode: 200,
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