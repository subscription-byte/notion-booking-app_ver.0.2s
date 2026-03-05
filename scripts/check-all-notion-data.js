const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const NOTION_TOKEN = process.env.NOTION_TOKEN || process.env.REACT_APP_NOTION_TOKEN;
const NOTION_DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';

async function checkAllData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().split('T')[0];

  console.log(`今日の日付: ${todayISO}`);
  console.log('Notionデータベースを全件取得中...\n');

  let allPages = [];
  let hasMore = true;
  let startCursor = undefined;

  // ページネーション処理で全件取得
  while (hasMore) {
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
        },
        start_cursor: startCursor
      })
    });

    const data = await response.json();
    allPages = allPages.concat(data.results || []);
    hasMore = data.has_more;
    startCursor = data.next_cursor;

    console.log(`取得中... 現在 ${allPages.length}件`);
  }

  console.log(`\n全件取得完了: ${allPages.length}件\n`);

  // 2026年の予約のみフィルタ
  const futureBookings = allPages.filter(page => {
    const dateInfo = page.properties['予定日']?.date;
    if (!dateInfo || !dateInfo.start) return false;
    return !dateInfo.start.includes('2099');
  });

  console.log(`2026年の予約: ${futureBookings.length}件\n`);

  // 各レコードの詳細を表示
  futureBookings.forEach((page, index) => {
    const name = page.properties['名前']?.title?.[0]?.plain_text || '（名前なし）';
    const dateInfo = page.properties['予定日']?.date;

    console.log(`${index + 1}. ${name}`);
    console.log(`   日付: ${dateInfo.start} ${dateInfo.end ? '→ ' + dateInfo.end : ''}`);
  });
}

checkAllData().catch(console.error);
