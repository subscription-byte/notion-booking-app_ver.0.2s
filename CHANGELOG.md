## 最新の変更履歴

### 2026年3月24日
- **機能追加**: 通常フロー（X経由）の入力キャッシュ機能
  - `CalendarBooking.jsx`: 名前・Xリンク・myfans/P登録状況を初期フォーム通過時にlocalStorageへ保存
  - 次回アクセス時に自動復元し入力の手間を省略
- **スキル更新**: `/dplogupd` `/upd` にREADME確認ルールを追記（リファクタリング時も旧記述チェックを必須化）

### 2026年3月23日
- **リファクタリング**: Notion関連の命名をGoogleカレンダー対応に全面変更
  - `src/components/EnhancedNotionBooking.jsx` → `CalendarBooking.jsx`（ファイル名変更）
  - コンポーネント名: `EnhancedNotionBooking` → `CalendarBooking`
  - 設定オブジェクト: `NOTION_CONFIG` → `CALENDAR_CONFIG`（`apiConfig.js`）
  - State: `notionEvents` / `setNotionEvents` → `calendarEvents` / `setCalendarEvents`
  - 関数: `fetchNotionCalendar` → `fetchCalendar`、`createNotionEvent` → `createCalendarEvent`、`validateNotionData` → `validateCalendarData`
  - 変数: `hasNotionEvent` → `hasCalendarEvent`
  - コメント内「Notion API」→「Google Calendar API」に修正（各所）
  - `src/setupProxy.js`（旧Notion開発プロキシ・未使用）を削除

### 2026年3月23日
- **強化**: 予約作成後の重複検証アラートを追加
  - `google-calendar-create.js`: セッションフロー・通常フロー両方の予約作成後にGoogleカレンダーを再クエリし、作成済みイベント以外に時間重複するイベントがあればChatWork（`CHATWORK_ROOM_ID`）にアラートを送信
  - 重複時メッセージ例: `[警告] 予約完了後に時間重複を検出 / 日時・予約者・重複イベント名`
  - `sendChatWorkSystemAlert` ヘルパー関数を追加（`CHATWORK_ROOM_ID` 宛の汎用アラート送信）

### 2026年3月23日
- **UI調整**: 冒頭注意事項のフォントサイズ・レイアウト調整
  - 見出し「ご予約の前にお読みください」を中央揃えに変更
  - 本文を左揃えに変更
  - 最終フォントサイズ: 見出し 0.95rem・本文 0.85rem
- **UX改善**: 予約完了モーダルのX遷移ボタンにコピー完了フィードバックを追加
  - ボタン上部に「押すと自動コピー・DM画面で貼り付けるだけ」の説明文を追加
  - 押下後1.5秒間「コピーしました！Xへ移動中...」と表示してから遷移（`copiedForX` stateで制御）
  - 二重押し防止（`disabled`制御）
- **ドキュメント**: `docs/claude-code-instructions.md` に確認方法の判断基準を追記
  - ビジュアル変更はローカル確認優先（`npm start`）
  - 外部API連携・Netlify Functionsはデプロイ優先

### 2026年3月23日
- **機能追加**: 冒頭注意事項の常時表示（初期フォーム画面に追加）
  - 対応時間外の対応不可、予約後の連絡必須、チャット対応時間（12:00〜21:00）の3点を初期フォーム画面上部に常時表示
- **機能改善**: 予約完了後モーダルを追加、自動リダイレクトタイマーを廃止
  - `EnhancedNotionBooking.jsx`: 予約完了時にポップアップモーダルを表示
  - 通常リンク：「コピーしてXへ移動」ボタンで手動リダイレクト
  - LINE連携：「LINEを開く」ボタンでLINEアプリ手動起動
  - 「あとで送る」でスキップ可能
  - 10秒カウントダウン自動リダイレクト（`countdown` state・`useEffect`）を完全廃止

### 2026年3月17日
- **バグ修正**: ブロック判定の境界値ずれを修正（ブロック終了時刻ちょうどのスロットが誤ってブロックされていた）
  - `netlify/functions/shared/businessRules.js` / `src/config/businessRules.js` / `src/config/blockingRules.js`: 判定条件を `>=` / `<=` から `>` / `<` に変更
  - 例: 対面15:00終了 + 3時間後ブロック → 18:00スロットが正しく開放されるように修正

### 2026年3月17日
- **バグ修正・仕様整理**: カレンダー色IDのPersonA/PersonC割り当てが逆になっていた問題を修正
  - `google-calendar-create.js`: PersonA LINE連携予約 = `'11'`（トマト）、PersonC LINE連携予約 = `'2'`（セージ）に修正（三項演算子が逆だった）
  - `src/config/businessRules.js`: 対面ブロック判定のcolorIdを `'7'`（ピーコック）→ `'1'`（ラベンダー）に修正（通常予約色`'7'`と競合していた）
  - `src/config/blockingRules.js`: 同上（フロントエンド側も修正）
  - `docs/google-calendar-api.md` / `README.md`: 色ID運用ルールのドキュメントを正確な内容に更新

### 2026年3月16日
- **バグ修正・仕様変更**: ChatWork予約完了通知のフォーマットを全経路で統一
  - `google-calendar-create.js`: LINE連携通知にmyfans登録・P登録を追加
  - LINE連携通知のPersonA/C表記・経路欄をlineChannelで動的に切替（PersonA=公認LINE、PersonC=まえかぶLINE）
  - LINE連携通知から不要な「LINE名」「通話方法」を削除
  - 通常予約通知から「通話方法」を削除、経路欄を「X DM（通常）」固定に変更
  - Xリンク未入力時は「なし」表示（LINE連携でプロパティなしの場合も対応）

### 2026年3月16日
- **仕様変更**: Googleカレンダーの予約色を予約経路別に再整理
  - `google-calendar-create.js`: PersonA（LINE）= `'2'`トマト、PersonC（LINE）= `'11'`セージ、通常リンク = `'7'`ピーコック（水色）に変更
  - `shared/businessRules.js`: 対面ブロック判定のcolorIdを `'7'`ピーコック → `'1'`ラベンダーに変更（通常予約の色と競合解消）

### 2026年3月13日
- **仕様変更**: 前日リマインダーをGoogle MeetリンクからZOOMリンクに変更
  - `scheduled-reminder.js`: カレンダーイベントのメモ欄（description）から `zoom.us` URLを正規表現で抽出して送信
  - ZOOMリンクがある場合のみ `Zoom: {url}` を追記、ない場合は省略

### 2026年3月12日
- **UX改善**: 戻るボタンの位置・サイズを全画面で統一
  - `EnhancedNotionBooking.jsx`: 予約フォーム画面（showBookingForm）の戻るボタンをabsolute配置からインラインflex配置に変更
  - 時間選択・予約内容確認・予約フォームの3画面すべてで同じボタンクラス・アイコンサイズに統一
  - 予約内容確認カードの `pt-10` を削除し、ボタン分の余白を解消

### 2026年3月12日
- **UX改善**: 予約フォーム画面のレイアウト改善
  - `EnhancedNotionBooking.jsx`: 予約フォームコンテナに `scale-90` を適用（登録済展開時のはみ出し解消）
  - 「予約情報入力」ヘッダーテキストを削除（戻るボタンのみに簡略化）
  - お名前入力欄の注意書きをLINE連携時は「LINE上での表示名をご入力ください」に変更
  - 予約内容確認画面の戻るボタンをカード内の絶対位置配置に変更し上部に詰める

### 2026年3月12日
- **UX改善**: 時間選択・予約完了画面を縮小して1画面に収まるよう修正
  - `EnhancedNotionBooking.jsx`: 時間選択画面・予約完了画面のコンテナを `scale-90` に変更
  - 19時・20時の時間ボタンおよび「トップに戻る」ボタンが画面外にはみ出す問題を解消

### 2026年3月12日
- **バグ修正**: 時間選択画面・予約完了画面でコンテンツが画面外にはみ出しスクロール不可だった問題を修正
  - `EnhancedNotionBooking.jsx`: ルートコンテナの `overflow-hidden` を `overflow-x-hidden` に変更
  - 19時・20時の時間ボタンおよび「トップに戻る」ボタンがスクロールで届くように修正
  - 背景アニメーションの横方向はみ出し防止は維持

### 2026年3月12日
- **機能追加**: PersonC予約リンク（`?ref=personC`）を実装
  - `routeConfig.js`: `personC` エントリ追加（`lineLogin` モード）
  - `apiConfig.js`: PersonC用redirect URI (`line-callback-c`) を追加、`generateLineAuthUrl` をref別callback URL対応に変更
  - `EnhancedNotionBooking.jsx`: PersonCのLINEボタンは `REACT_APP_LINE_CHANNEL_ID_C` を使用
  - Netlifyに追加が必要な環境変数: `REACT_APP_LINE_CHANNEL_ID_C`
  - PersonC予約URL: `https://mfagencybooking.netlify.app/?ref=personC`

### 2026年3月12日
- **機能追加**: PersonC用LINE連携フローを実装
  - `netlify/functions/line-callback-c.js` 新規作成（`LINE_CHANNEL_ID_C` / `LINE_CHANNEL_SECRET_C` 使用）
  - `lineChannel: 'personC'` をセッション・予約イベントに保存
  - `google-calendar-create.js`: LINE予約完了通知をチャネル別トークンで送信（`LINE_ACCESS_TOKENS` マップ）
  - `scheduled-reminder.js`: token mapに `personC` エントリ追加
  - Netlifyへの登録が必要な環境変数: `LINE_CHANNEL_ID_C` / `LINE_CHANNEL_SECRET_C` / `LINE_CHANNEL_ACCESS_TOKEN_C`

- **機能追加**: `lineChannel` プロパティをPersonAフローにも明示保存
  - `line-callback.js`: セッション作成時に `lineChannel: 'personA'` を保存
  - `google-calendar-create.js`: 予約確定時にセッションから `lineChannel` を引き継ぎ
  - 既存データ（フィールドなし）は `personA` にフォールバック

- **機能追加**: 前日リマインドにGoogle MeetリンクをLINE通知へ自動付与
  - `scheduled-reminder.js`: カレンダーイベントの `hangoutLink` / `conferenceData` からMeetURLを取得
  - Meetリンクが設定されていれば通知文に `Google Meet: <URL>` を追加、なければ省略
  - `events.list` に `conferenceDataVersion: 1` を追加（conferenceData取得に必要）

### 2026年3月6日
- **リファクタリング**: 未使用のNotion関連ファイルを削除（デッドコード整理）
  - `netlify/functions/notion-query.js` 削除
  - `netlify/functions/notion-create.js` 削除
  - `netlify/functions/notion-archive.js` 削除
  - `src/components/NotionBookingSystem.jsx` 削除（`App.js` から未参照）
  - `src/components/ModernBookingSystem.jsx` 削除（`App.js` から未参照）
  - `src/components/EnhancedNotionBooking.jsx.backup` 削除（不要バックアップ）
  - 現在の有効コンポーネントは `EnhancedNotionBooking.jsx` のみ

### 2026年3月6日
- **運用整理**: scheduled-reminder を前日通知専用に統一
  - 15分前通知ロジックを削除
  - スケジュールを毎日15:00 JST 実行（`0 6 * * *` UTC）に変更

- **機能追加/修正**: 予約完了時のChatWork通知を実装・整理
  - `chatwork-notify.js`: `booking_complete` タイプを追加（`CHATWORK_BOOKING_ROOM_ID` の専用ルームへ送信）
  - `google-calendar-create.js`: 予約完了通知をバックエンド送信に統一（通常予約/LINE予約）
  - 通常予約とLINE連携の2パターンを `bookingType` フィールドで判別
  - ChatWorkマークアップ `[info][title]...[/title]...[/info]` 形式で送信
  - 通常予約フォーマット: 日付・お名前・Xリンク・備考・経路・通話方法・myfans登録・P登録
  - LINE連携フォーマット: 日付・お名前・LINE名・Xリンク・備考・経路・通話方法（公式LINE固定）
  - `EnhancedNotionBooking.jsx`: フロント側の予約完了通知呼び出しは削除し、二重送信を解消

### 2026年3月5日
- **UX改善**: 画面左上のデバッグ状態表示を削除
  - `Initial / TimeSlots / BookingForm / ConfirmScreen / Confirmation` の固定表示を除去
  - 本番画面に開発用表示が出ない状態に統一

- **機能改善**: Googleカレンダー色IDによるブロック判定を強化
  - `colorId '7'`（ピーコック）を対面予約として判定（前後3時間ブロック）
  - `colorId '3'`（グレープ）を撮影予約として判定（当日 + 後3時間ブロック）
  - フロント空き枠判定とバックエンド最終重複チェックの両方に反映
  - `google-calendar-query` レスポンスに `colorId` を追加し、判定情報の受け渡しを明確化

- **ドキュメント整備**: Google Calendar APIリファレンスを作成
  - docs/google-calendar-api.md を新規作成
  - カレンダー色ID一覧（正確な情報）
  - イベント構造、API仕様、データ構造を記載
  - Claude Code等の開発ツールが正確な情報を参照できるように整備

- **機能追加**: 予約元を一覧で識別できるように場所情報と色分けを追加
  - 通常リンク: 場所「X DM」、colorId '2'（セージ色・緑）
  - PersonA（LINE連携）: 場所「公式LINE（公認）」、colorId '11'（トマト色・赤）
  - Googleカレンダーの一覧表示で予約元が一目で分かるように改善

- **セキュリティ**: 検索エンジン・AI学習クローラーのアクセスを拒否
  - robots.txt: 全クローラー + AI/LLMクローラーを明示的に拒否
  - index.html: noindex/nofollowメタタグを追加
  - 直リンクでのアクセスは引き続き可能
  - Google検索結果に表示されず、AI学習データとして収集されない

### 2026年2月14日〜3月4日 - Google Calendar API移行作業
- **重要**: Notion APIからGoogle Calendar APIへの完全移行を実施
  - フロントエンドのAPIリクエストを全てGoogle Calendar形式に変更
  - バックエンド関数（line-callback, scheduled-reminder）をGoogle Calendar APIに移行
  - セッションID検索を2099年データから取得する方式に変更
  - 日付フォーマットをISO 8601形式（JST）に統一

- **バグ修正**: LINE予約の動作を修正
  - セッション方式の予約作成フローを修正
  - 戻るボタンで確認画面状態を正しくリセット
  - 日付フォーマットを統一してタイムゾーンのズレを解消

- **UX改善**: デバッグ機能の追加と削除
  - 画面左上に状態表示を追加（開発時）
  - 予約エラーをアラート表示
  - PWAインストールプロンプトを無効化
  - デバッグ情報はテストモード時のみ表示

### 2026年2月13日
- **機能追加**: 通常リンク・personBでXリンク/IDのバリデーション実装
  - X（x.com/twitter.com）のリンクまたは@で始まるIDのみ入力可能に
  - myfans.jp等のリンクは明示的に拒否
  - エラーメッセージで分かりやすく案内
- **UX改善**: 名前欄に注意書きを追加
  - 全画面で「X上でのお名前をご入力ください」と表示
  - プレースホルダーも「X上でのお名前を入力」に統一

### 2026年2月9日
- **UX改善**: 通常リンク予約完了後のリダイレクトタイマーを延長
  - 自動リダイレクトを3秒→10秒に変更
  - カウントダウン表示を実装（10, 9, 8... と視覚的に表示）
  - 急ぐユーザーは「コピーしてすぐに移動する」ボタンで即座に遷移可能

### 2026年2月4日
- **機能追加**: 第一月曜16時のブロック時間を追加
  - 毎月1日〜7日の月曜日16:00-17:00を予約不可に設定
  - blockingRules.jsに新ルール追加
  - isFixedBlockedTime関数に第一月曜判定ロジック追加

- **バグ修正**: キャッシュに有効期限（15分）を追加してNotion削除が反映されない問題を解決
  - 問題: Notionから予定を削除してもキャッシュが残り続け、空き枠として表示されない
  - 原因: キャッシュに有効期限がなく、一度取得したデータがずっと使われていた
  - 解決: キャッシュにタイムスタンプを追加し、15分経過後は自動で再取得
  - キャッシュ構造を `data` から `{ data, timestamp }` に変更
  - キャッシュクリアタイミング:
    1. 手動の再読み込み（ユーザー操作）
    2. 15分経過時（セッションタイムアウト）
    3. 予約失敗時（ダブルブッキング検出時）

- **UX改善**: 予約情報入力画面で名前とXリンクを編集可能に
  - 以前は表示のみだったが、入力フィールドに変更
  - LINE連携時も名前を修正できるように改善
  - Xリンクも引き続き編集可能

- **修正**: ブラウザキャッシュ制御を強化して古いJSファイルが残る問題を解決
  - HTMLにキャッシュ制御metaタグを追加（no-cache, no-store）
  - Netlify _headersファイルを追加
    - HTMLは常に最新取得（no-cache）
    - JS/CSS/メディアファイルはハッシュ付きで永続キャッシュ（immutable）
  - バージョンを0.1.0 → 0.2.0に更新
  - デプロイ後は確実に最新版が読み込まれる

### 2026年1月26日
- **バグ修正**: 年表示が2025年固定になっていた問題を修正
  - 日付カードの年表示を動的取得に変更（`date.getFullYear()`を使用）
  - 2026年以降も正しい年が表示されるように改善

### 2026年1月22日
- **重大なバグ修正**: 土日アクセス時の週表示バグを修正
  - `getDay()`が日曜=0を返すため、月曜日の計算が狂っていた問題を解消
  - 土曜日にアクセスすると先週、日曜日にアクセスすると翌週が表示されていた
  - 予約状況がNotionデータと不一致になり、空きがあるように見えるバグを修正
- **設計改善**: 週計算ロジックを日曜基準に統一
  - `getDay()`の日曜=0をそのまま使用（補正処理を削除）
  - 日〜土の7日分を取得し、表示時に平日のみフィルタリング
  - 週計算の共通関数を`businessConfig.js`に追加（保守性向上）
  - `getSundayOfWeek(weekOffset)`: 日曜基準で週の開始日を取得
  - `getWeekDates(weekOffset)`: 日〜土の7日分を取得
  - `getWeekdayDates(weekOffset)`: 月〜金のみを取得
- **コード削減**: 約70行のコード削減（重複ロジックの統一化）

### 2025年12月24日
- **機能追加**: myfans登録状況とプレミアムクリエイター登録状況の入力フィールド
  - 予約情報入力画面にmyfans登録状況（登録済/未登録）の選択フィールドを追加（必須）
  - myfans登録済の場合のみプレミアムクリエイター登録状況の選択フィールドを表示（必須）
  - myfans未登録の場合はP登録状況フィールドが非表示になり自動リセット
  - Notionデータベースの「myfans登録状況」「P登録状況」列に自動登録
  - 全ての経路（通常リンク・personA・personB）で統一対応

### 2025年12月15日
- **重大なバグ修正**: ダブルブッキング防止機能を実装
  - バックエンド（notion-create.js）に予約重複チェック機能を追加
  - 土日・祝日・休業日チェックをバックエンドでも実施
  - 固定ブロック時間・対面通話・撮影のブロック判定を追加
  - 既存予約との時間重複を検出して409エラーで拒否
  - セッション方式（LINE連携）にも同様のチェックを実装
- **重大なバグ修正**: 休業日判定のタイムゾーンバグを修正
  - `toISOString()`によるUTC変換で日付が1日ズレる問題を解消
  - ローカル日付（getFullYear/getMonth/getDate）で直接判定するよう修正
  - 12月29日等の休業日が正しく認識されるように修正
- **機能追加**: セッションタイムアウト機能（15分）
  - ページアクセスから15分経過で自動再読み込み
  - スマホのタブ維持でも確実に動作（実時間比較）
  - 古いデータでの予約を防止
- **バグ修正**: 4週分キャッシュが機能しない問題を解決
  - Reactのクロージャ問題でallWeeksDataが常に空オブジェクトだった
  - useRefとuseEffectで最新のキャッシュを参照するよう修正
  - 週遷移時のローディングを削減（キャッシュから即座に表示）
- **バグ修正**: 4週分データ取得の重複実行を修正
  - setAllWeeksDataの非同期性により初回ロードが2-3回実行されていた問題を解消
  - isInitialLoadDoneRefフラグで同期的にチェックして重複を防止
- **パフォーマンス改善**: 休業日データの取得スキップ
  - 4週分データ取得時に休業日（土日・祝日・会社休業日）を除外
  - 不要なデータ取得を削減してパフォーマンス向上
- **UX改善**: 予約重複時の自動再読み込み
  - 409/403エラー時に明確なメッセージ表示
  - エラー後に自動で最新データを再取得
- **UX改善**: 予約ボタンの連打防止を強化
  - handleBooking関数の最初で即座にisLoadingチェック＆設定
  - 処理開始前の連打を完全に防止
  - すべての早期return箇所でローディング解除を追加
- **バグ修正**: 日付ズレ検知の誤検知を修正
  - タイムゾーンの影響で正常な予約を誤検知していた問題を解消
  - ローカル日付で直接比較するよう修正

### 2025年12月12日
- **機能追加**: 通常リンク専用の自動リダイレクトUI
  - 予約確認画面に「予約確定後の流れ」を表示（オレンジ色の警告ボックス）
  - 確定ボタンのテキストを「確定してXのDMへ進む」に変更
  - 確定ボタン押下時に予約情報を自動的にクリップボードへコピー
  - 予約完了後、3秒で自動的にX公認代理店プロフィール（https://x.com/myfans_agency_）へ遷移
  - リダイレクト待ち画面に確定日時を大きく表示
  - 「コピーしてすぐに移動する」ボタンで即座に遷移可能
- **UX改善**: 送り忘れ防止のための自動化
  - ユーザーアクション（ボタンクリック）時のコピーなので許可不要
  - 予約情報のコピー→X DMへの遷移が自動化され、送信漏れを防止
- **仕様**: PersonA/PersonBは従来通り（変更なし）

### 2025年12月3日
- **大規模リファクタリング**: 設定ファイルの外出し（83行削減）
  - 7つの設定ファイルを作成（routeConfig, businessConfig, blockingRules, holidays, uiConfig, apiConfig）
  - ハードコードを削除して保守性・可読性が大幅に向上
  - 設定変更時に本体コードを触る必要がなくなった
- **機能追加**: 2026年祝日データ追加（18件）
- **機能追加**: 年末年始休業日設定（2025/12/27-2026/1/4）
- **機能追加**: 翌々週データの事前読み込み（3週分キャッシュでさらに高速化）
- **設定変更**: 経路タグの変更
  - 通常リンク → 経路タグ「公認X」固定
  - personAリンク（`?ref=personA`）→ LINE連携 + 経路タグ手動選択
  - personBリンク（`?ref=personB`）→ 名前+X入力 + 経路タグ「まゆ紹介」固定
- **セキュリティ強化**: LINE通知のスパム防止
  - テストモードからの送信のみUser ID検証を実施
  - 本番予約完了通知は全ユーザーに正常送信
- **バグ修正**: LINE連携時のrefパラメータ保持（stateで受け渡し）
- **バグ修正**: LINE認証URLのscope二重エンコード問題を解決

### 2025年12月2日
- **機能追加**: LINE連携機能を実装（OAuth 2.0認証）
  - LINE Loginチャネルを使用したユーザー認証
  - LINEプロフィール情報（User ID、表示名）の自動取得
  - 予約完了時にLINE通知を自動送信（LINE Messaging API）
  - Notionデータベースに「LINE User ID」列を追加
- **機能追加**: テストモード実装
  - ヘッダー3回タップ + ID/PW認証で入室
  - テストモード専用機能（LINE通知テストボタン）を追加
  - 認証情報を環境変数化してセキュリティ強化
- **セキュリティ強化**: Netlify Functions全般
  - Notion API呼び出しにデータベースID検証を追加
  - ChatWork通知APIに型ホワイトリスト・フィールド検証を追加
  - データ削除時の所有権検証を追加
- **トラブルシューティング**: 環境変数の埋め込み問題を解決
  - `netlify.toml` に `[build.environment]` を追加して環境変数を明示的に設定
  - React アプリの本番ビルドで `REACT_APP_LINE_CHANNEL_ID` が正しく埋め込まれるように修正

### 2025年12月1日
- **重要**: 予約終了時刻の判定ロジックを修正（11月20日の変更で導入されたバグを修正）
  - 予約が13:00に終わる場合、13:00-14:00の枠が正しく予約可能に
  - 12月の予約枠が誤ってブロックされていた問題を解消
- 予約情報入力画面の戻るボタンを修正（最初の画面→時間選択画面に戻るように変更）

### 2025年11月25日
- 初期ロード時に4週分のデータを一括取得し、空きのある週へ自動ジャンプ
- 過去の週（offset < 0）へのナビゲーション・データ取得を完全に無効化
- offset 0で左側の週状態表示を透明化（配置は維持）
- PC表示時の最大幅を制限（max-w-2xl: 672px）
- `handleWeekChange`に防御的チェックを追加

### 2025年11月20日（続き）
- スマホ表示の横幅を大幅に拡大（画面いっぱいに近い表示）
- 縦幅を調整してスクロール不要に最適化
- 週データのキャッシュ機能を実装（ページ遷移の高速化）
- 前週・翌週データの事前読み込み機能を追加
- 日付表示部分の幅を固定して中央揃えに統一
- 「ご予約可能な時間帯」の文字列を削除
- 各画面のパディング調整（トップページは広く、他ページは適切な余白）
- スマホ表示の縮小を解除（90%→100%）

### 2025年11月20日
- カルーセル式UIを追加（前週・翌週の予約状況を3D表示）
- スワイプ操作による週移動機能を追加
- 左右矢印クリックでの週移動機能を追加
- 空きのある週への自動ジャンプ機能を追加
- 予約終了時刻のスロット判定バグを修正（>=に変更）
- ヘッダー・ボタン・凡例の幅を日付カード幅に統一
- ヘッダーのフローティングアニメーションを削除

### 2025年11月10日
- 名前欄に「撮影」「対面」が含まれる場合もブロック判定を適用
- スマホ表示を90%縮小（PCは100%）
- スクロールバウンスエフェクトを無効化
- 予約情報入力画面の日時表示を拡大
- フッター説明文を削除

### 2025年10月27日
- 営業者ごとのタグ付け機能を追加
- URLパスで「公認X」「まゆ紹介」タグの自動設定
