const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const NOTION_TOKEN = process.env.NOTION_TOKEN || process.env.REACT_APP_NOTION_TOKEN;
const NOTION_DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';

async function checkData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().split('T')[0];

  console.log(`今日の日付: ${todayISO}`);
  console.log('Notionデータベースを確認中...\n');

  // 今日以降のデータを取得
  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: {
        property: '予定日',
        date: {
          on_or_after: todayISO
        }
      }
    })
  });

  const data = await response.json();
  const pages = data.results || [];

  console.log(`取得件数: ${pages.length}件\n`);

  // 各レコードの詳細を表示
  pages.forEach((page, index) => {
    const name = page.properties['名前']?.title?.[0]?.plain_text || '（名前なし）';
    const dateInfo = page.properties['予定日']?.date;
    const sessionId = page.properties['セッションID']?.rich_text?.[0]?.plain_text || '';

    if (dateInfo) {
      console.log(`${index + 1}. ${name}`);
      console.log(`   日付: ${dateInfo.start} ${dateInfo.end ? '→ ' + dateInfo.end : ''}`);
      if (sessionId) console.log(`   セッションID: ${sessionId}`);
      console.log('');
    }
  });
}

checkData().catch(console.error);
