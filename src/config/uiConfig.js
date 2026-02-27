/**
 * 予約システム - UI設定（テキスト・メッセージ）
 */

/**
 * システム全般の設定
 */
export const SYSTEM_SETTINGS = {
  systemTitle: '予約システム',
  description: 'ご希望の日時を選択してください',
  immediateButtonText: '今すぐ予約する',
};

/**
 * アラートメッセージ
 */
export const ALERT_MESSAGES = {
  // LINE連携
  lineLoginSuccess: (name) => `✅ LINE連携成功！\n\nこんにちは、${name}さん\n予約完了時にLINE通知が届きます。`,
  lineLoginError: (error) => `❌ LINE連携エラー\n\n${error}`,

  // テストモード
  testModeEnabled: '🧪 テストモードを起動しました',
  testModeDisabled: 'テストモードを解除しました',
  testLoginFailed: 'IDまたはパスワードが間違っています',

  // データ読み込み
  dataLoading: 'データを読み込み中です。しばらくお待ちください。',
  siteUpdating: 'ただいまサイト情報の更新中です。お手数をおかけいたしますが、数分後に再度お試しください。',

  // 予約制限
  holidayNotAvailable: '祝日は予約できません。他の日付を選択してください。',
  fullyBooked: '選択した日付は満員です。他の日付を選択してください。',
  timeSlotNotAvailable: '選択した時間帯は予約できません。他の時間を選択してください。',
  holidayError: 'エラー: 祝日は予約できません。',
  alreadyBooked: 'エラー: 選択した時間帯は既に予約済みです。他の時間を選択してください。',

  // バリデーション
  nameRequired: 'お名前を入力してください',
  nameNotEntered: 'お名前が入力されていません',
  xLinkRequired: 'Xリンクを入力してください',
  xLinkInvalid: 'X（旧Twitter）のリンク（x.com/twitter.com）または@で始まるIDを入力してください。\nmyfans.jp等のリンクは入力できません。',
  routeTagRequired: '経路タグを選択してください',

  // 予約処理
  bookingFailed: '予約の作成に失敗しました。もう一度お試しください。',
  bookingSuccess: '予約が完了しました！',

  // 削除処理
  deleteConfirm: '本当にこの予約を削除しますか？',
  deleteSuccess: '予約を削除しました',
  deleteFailed: '削除に失敗しました',
};

/**
 * ボタンテキスト
 */
export const BUTTON_TEXTS = {
  login: 'ログイン',
  cancel: 'キャンセル',
  back: '戻る',
  next: '次へ',
  confirm: '確認画面へ',
  complete: '予約を確定する',
  proceedToBooking: '予約画面へ進む',
  lineLogin: 'LINEでログイン',
  copyReservation: '予約情報をコピー',
  shareX: 'Xで共有',
  shareLine: 'LINEで共有',
};

/**
 * ラベルテキスト
 */
export const LABEL_TEXTS = {
  customerName: 'お名前',
  xLink: 'Xリンク',
  lineUserId: 'LINE User ID',
  routeTag: '経路タグ',
  remarks: '備考',
  callMethod: '通話方法',
  date: '日付',
  time: '時間',
};

/**
 * プレースホルダーテキスト
 */
export const PLACEHOLDER_TEXTS = {
  customerName: 'X上でのお名前を入力',
  xLink: 'https://x.com/username',
  userId: 'ユーザーID',
  password: 'パスワード',
  remarks: 'ご要望や連絡事項がありましたらご記入ください',
};

/**
 * ヘルプテキスト
 */
export const HELP_TEXTS = {
  xLinkNote: '（Xをお持ちでない場合はmyfansのリンクをご記入ください）',
  remarksOptional: '(任意)',
};
