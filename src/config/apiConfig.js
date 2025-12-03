/**
 * 予約システム - API設定
 */

/**
 * Notion API設定
 */
export const NOTION_CONFIG = {
  // カレンダーデータベースID
  calendarDatabaseId: '1fa44ae2d2c780a5b27dc7aae5bae1aa',

  // Notion APIエンドポイント（Netlify Functions経由）
  endpoints: {
    query: '/.netlify/functions/notion-query',
    create: '/.netlify/functions/notion-create',
    archive: '/.netlify/functions/notion-archive',
  },
};

/**
 * LINE API設定
 */
export const LINE_CONFIG = {
  // LINE認証URL生成用
  authBaseUrl: 'https://access.line.me/oauth2/v2.1/authorize',
  redirectUri: 'https://mfagencybooking.netlify.app/.netlify/functions/line-callback',
  scope: 'profile openid',

  // LINE Messaging APIエンドポイント（Netlify Functions経由）
  endpoints: {
    notify: '/.netlify/functions/line-notify',
  },
};

/**
 * ChatWork API設定
 */
export const CHATWORK_CONFIG = {
  endpoints: {
    notify: '/.netlify/functions/chatwork-notify',
  },
};

/**
 * LINE認証URLを生成
 * @param {string} channelId - LINE Channel ID
 * @param {string} ref - refパラメータ（'personA', 'personB', ''など）
 * @returns {string} - LINE認証URL
 */
export const generateLineAuthUrl = (channelId, ref = '') => {
  const redirectUri = encodeURIComponent(LINE_CONFIG.redirectUri);
  // stateにrefパラメータを含める（カンマ区切りでランダム文字列と結合）
  const randomState = Math.random().toString(36).substring(7);
  const state = ref ? `${randomState},${ref}` : randomState;
  const scope = encodeURIComponent(LINE_CONFIG.scope.replace(/ /g, '%20'));

  return `${LINE_CONFIG.authBaseUrl}?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
};
