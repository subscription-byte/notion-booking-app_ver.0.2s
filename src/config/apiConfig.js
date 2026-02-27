/**
 * 予約システム - API設定
 */

/**
 * Google Calendar API設定（旧Notion API設定から移行）
 */
export const NOTION_CONFIG = {
  // GoogleカレンダーID（互換性のため変数名は維持）
  calendarDatabaseId: 'c763018544ac641008a928e7411242bdefc77de1f79fc28ef22d30ab0ea0321b@group.calendar.google.com',

  // Google Calendar APIエンドポイント（Netlify Functions経由）
  endpoints: {
    query: '/.netlify/functions/google-calendar-query',
    create: '/.netlify/functions/google-calendar-create',
    archive: '/.netlify/functions/google-calendar-delete',
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
  const scope = LINE_CONFIG.scope.replace(/ /g, '%20');

  return `${LINE_CONFIG.authBaseUrl}?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
};
