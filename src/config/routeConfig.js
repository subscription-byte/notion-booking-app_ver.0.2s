/**
 * 予約システム - 経路別設定ファイル
 *
 * ここで各経路（通常/personA/personB）の挙動を制御します
 * 設定変更時はこのファイルのみ編集してください
 */

export const ROUTE_CONFIG = {
  // 通常リンク（refパラメータなし）
  normal: {
    mode: 'nameAndX',          // 'nameAndX' | 'lineLogin'
    routeTag: '公認X',         // Notionの経路タグ
    requireXLink: true,        // Xリンク入力必須
    requireRouteTag: false,    // 経路タグ選択必須（modeがnameAndXの場合のみ有効）
  },

  // personA（?ref=personA）
  personA: {
    mode: 'lineLogin',         // 'nameAndX' | 'lineLogin'
    routeTag: '',              // Notionの経路タグ（空＝Notion側で手動入力）
    requireXLink: false,       // Xリンク入力必須
    requireRouteTag: false,    // 経路タグ選択必須（falseでプルダウン非表示）
  },

  // personB（?ref=personB）
  personB: {
    mode: 'nameAndX',          // 'nameAndX' | 'lineLogin'
    routeTag: 'まゆ紹介',      // Notionの経路タグ
    requireXLink: true,        // Xリンク入力必須
    requireRouteTag: false,    // 経路タグ選択必須
  },
};

/**
 * 経路タグの選択肢
 */
export const ROUTE_TAG_OPTIONS = [
  { value: '', label: '選択してください' },
  { value: '公認X', label: '公認X' },
  { value: 'まゆ紹介', label: 'まゆ紹介' },
  { value: 'その他', label: 'その他' },
];

/**
 * ref パラメータから設定を取得
 * @param {string} ref - URLパラメータの ref 値
 * @returns {object} 該当する設定オブジェクト
 */
export const getRouteConfig = (ref) => {
  if (ref === 'personA') return ROUTE_CONFIG.personA;
  if (ref === 'personB') return ROUTE_CONFIG.personB;
  return ROUTE_CONFIG.normal;
};
