/**
 * 予約システム - プロパティマッピング処理（CommonJS版）
 * フロントエンドからのフラット構造とGoogle Calendar APIの変換処理
 */

/**
 * フラット構造のプロパティからGoogle Calendar イベント説明文を生成
 * @param {Object} properties - フラット構造のプロパティ
 * @returns {string} - イベント説明文
 */
const createEventDescription = (properties) => {
  return `予約者: ${properties.summary || ''}
Xリンク: ${properties.xLink || ''}
備考: ${properties.remarks || ''}
経路: ${properties.route || ''}
通話方法: ${properties.callMethod || ''}
myfans登録状況: ${properties.myfansStatus || ''}
P登録状況: ${properties.premiumStatus || ''}`;
};

/**
 * フラット構造のプロパティからGoogle Calendar extendedPropertiesを生成
 * @param {Object} properties - フラット構造のプロパティ
 * @param {Object} additionalProps - 追加プロパティ（lineUserId, assigneeなど）
 * @returns {Object} - extendedProperties.private オブジェクト
 */
const createExtendedProperties = (properties, additionalProps = {}) => {
  return {
    xLink: properties.xLink || '',
    remarks: properties.remarks || '',
    route: properties.route || '',
    callMethod: additionalProps.callMethod || properties.callMethod || '',
    myfansStatus: properties.myfansStatus || '',
    premiumStatus: properties.premiumStatus || '',
    assignee: properties.assignee || additionalProps.assignee || '',
    lineUserId: additionalProps.lineUserId || '',
    bookingStatus: additionalProps.bookingStatus || '予約完了',
    sessionId: additionalProps.sessionId || '',
  };
};

module.exports = {
  createEventDescription,
  createExtendedProperties
};
