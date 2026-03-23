/**
 * 予約システム - API設定
 */

/**
 * Google Calendar API設定
 */
export const CALENDAR_CONFIG = {
  // GoogleカレンダーID
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
  redirectUriC: 'https://mfagencybooking.netlify.app/.netlify/functions/line-callback-c',
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
  const baseRedirectUri = ref === 'personC' ? LINE_CONFIG.redirectUriC : LINE_CONFIG.redirectUri;
  const redirectUri = encodeURIComponent(baseRedirectUri);
  // stateにrefパラメータを含める（カンマ区切りでランダム文字列と結合）
  const randomState = Math.random().toString(36).substring(7);
  const state = ref ? `${randomState},${ref}` : randomState;
  const scope = LINE_CONFIG.scope.replace(/ /g, '%20');

  return `${LINE_CONFIG.authBaseUrl}?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
};
