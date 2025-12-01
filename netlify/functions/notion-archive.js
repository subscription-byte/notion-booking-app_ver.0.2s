exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pageId } = JSON.parse(event.body);

    if (!pageId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing pageId' })
      };
    }

    // セキュリティ: アーカイブ前にページが正しいデータベースに属しているか確認
    const ALLOWED_DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';

    const checkResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
      }
    });

    if (!checkResponse.ok) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Page not found' })
      };
    }

    const pageData = await checkResponse.json();
    const parentDatabaseId = pageData?.parent?.database_id;

    if (parentDatabaseId !== ALLOWED_DATABASE_ID) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden: Page does not belong to allowed database' })
      };
    }

    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        archived: true
      })
    });

    if (!response.ok) {
      throw new Error('Notion API error');
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
