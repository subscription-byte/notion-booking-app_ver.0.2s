# 予約システム - Notion連携予約アプリ

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## 概要

Notion APIと連携したモバイルファースト対応の予約システムです。URLパスで営業者を識別し、自動でNotionに予約データを登録・管理できます。

## 最新の変更履歴

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

## 主な機能

### 📅 予約管理
- 平日のみ予約可能（祝日を自動除外）
- 1時間単位の時間枠管理
- リアルタイムで予約状況を表示
- 固定ブロック時間設定（火曜11:00-16:00など）
- 対面通話・撮影の前後ブロック機能

### 🏷️ 営業経路タグ付け
- URLパスで営業者を識別
- Notionの「経路」列（select型）に自動タグ付け
- 同じコードベースで複数の営業経路に対応

**アクセスURL**:
- 通常: `https://mfagencybooking.netlify.app/` → タグなし
- PersonA: `https://mfagencybooking.netlify.app/personA` → 「公認X」タグ
- PersonB: `https://mfagencybooking.netlify.app/personB` → 「まゆ紹介」タグ

### 📱 レスポンシブUI
- モバイルファースト設計
- ガラスモーフィズムデザイン
- Fluid背景アニメーション
- タッチ操作最適化

### 🔔 エラー検知・通知
- システムエラー検知
- 日付ズレ検知
- ChatWork通知連携
- データ検証機能

### 📤 予約情報共有
- LINE・X（Twitter）共有ボタン
- ワンタップコピー機能
- 予約完了画面から直接共有可能

### 🔐 LINE連携機能（実装済み）
- LINE Login OAuth 2.0 認証
- プロフィール情報の自動取得
- 予約完了時のLINE通知送信
- NotionへのLINE User ID保存

### 🧪 テストモード
- 隠しテストモード（ヘッダー3回タップ）
- ID/PW認証でアクセス制限
- 本番環境で開発機能をテスト可能

## 技術スタック

### フロントエンド
- **React** 19.1.0
- **Tailwind CSS** 3.4.17
- **Lucide React** (アイコン)
- **Create React App** 5.0.1

### バックエンド（Netlify Functions）
- **Notion API** (データベース操作)
- **ChatWork API** (通知機能)
- **LINE Messaging API** (通知送信)
- **LINE Login API** (OAuth認証)
- Serverless Functions

### ホスティング
- **Netlify**
- リダイレクト機能でURLパス管理

## プロジェクト構成

```
booking-app/
├── src/
│   ├── components/
│   │   ├── EnhancedNotionBooking.jsx  # メイン予約コンポーネント
│   │   ├── FluidCanvas.jsx            # 背景アニメーション
│   │   └── FluidBackground.jsx        # 背景ラッパー
│   ├── App.js                          # アプリエントリーポイント
│   └── index.js
├── netlify/
│   └── functions/
│       ├── notion-create.js            # Notion予約作成API
│       ├── notion-query.js             # Notionデータ取得API
│       ├── notion-archive.js           # Notion予定削除API
│       ├── chatwork-notify.js          # ChatWork通知API
│       ├── line-callback.js            # LINE OAuth コールバック
│       └── line-notify.js              # LINE通知送信API
├── netlify.toml                         # Netlify ビルド設定
├── public/
│   └── _redirects                      # Netlifyリダイレクト設定
└── package.json
```

## 環境変数

`.env.local` に以下を設定:

```
# Notion API
NOTION_TOKEN=your_notion_integration_token

# ChatWork API
CHATWORK_API_TOKEN=your_chatwork_api_token
CHATWORK_ROOM_ID=your_chatwork_room_id

# LINE Messaging API（通知用）
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token

# LINE Login（OAuth認証用）
LINE_CHANNEL_ID=your_line_login_channel_id
LINE_CHANNEL_SECRET=your_line_login_channel_secret

# React アプリ用（フロントエンド）
REACT_APP_LINE_CHANNEL_ID=your_line_login_channel_id
REACT_APP_TEST_USER_ID=your_test_user_id
REACT_APP_TEST_USER_PW=your_test_user_password
```

**注意**: Netlifyの環境変数設定に加えて、`netlify.toml` の `[build.environment]` にも `REACT_APP_LINE_CHANNEL_ID` を設定する必要があります。

## Notion データベース構造

**必須プロパティ**:
- `名前` (title) - 予約者名
- `予定日` (date) - 予約日時
- `X` (url) - Xまたはmyfansリンク
- `備考` (rich_text) - 備考
- `経路` (select) - 営業経路タグ
- `対応者` (people) - 担当者
- `通話方法` (select) - 対面/撮影などの区分
- `LINE User ID` (text) - LINE連携時のユーザーID
- `myfans登録状況` (select) - myfans登録状況（登録済/未登録）
- `P登録状況` (select) - プレミアムクリエイター登録状況（登録済/未登録）

## 予約ロジック

### ブロック時間ルール
1. **火曜日**: 11:00-16:00 常にブロック
2. **水曜日**: 13:00のみブロック
3. **全日（火曜以外）**: 15:00-16:00ブロック
4. **対面通話**: 前後3時間ブロック
5. **撮影**: 当日すべて + 後3時間ブロック

### 祝日管理
2025年の祝日データをハードコーディング（[EnhancedNotionBooking.jsx](src/components/EnhancedNotionBooking.jsx):51-56）

---

## LINE連携の設定手順

### 1. LINE Developersコンソールで2つのチャネルを作成

#### LINE Messaging API チャネル（通知用）
1. プロバイダーを選択 → 新規チャネル作成 → **Messaging API**
2. チャネル基本設定から以下を取得：
   - **Channel Access Token** → `LINE_CHANNEL_ACCESS_TOKEN`

#### LINE Login チャネル（認証用）
1. プロバイダーを選択 → 新規チャネル作成 → **LINE Login**
2. チャネル基本設定から以下を取得：
   - **Channel ID** → `LINE_CHANNEL_ID` / `REACT_APP_LINE_CHANNEL_ID`
   - **Channel Secret** → `LINE_CHANNEL_SECRET`
3. LINE Login設定：
   - **コールバックURL**: `https://mfagencybooking.netlify.app/.netlify/functions/line-callback`
   - **OpenID Connect**: 有効化
   - **公開設定**: 開発中（テスターを追加）または公開済み

### 2. Netlifyに環境変数を設定
- Site settings → Environment variables → Add a variable
- 上記で取得した値を設定

### 3. netlify.toml に環境変数を追加
```toml
[build.environment]
  REACT_APP_LINE_CHANNEL_ID = "your_line_channel_id"
```

### 4. Notionデータベースに列を追加
- 列名: `LINE User ID`
- 型: テキスト

---

## 今後の追加予定機能

### ⏰ 予約リマインド機能
- 予約日前日の通知
- 予約日当日15分前の通知
- Notion定期スクリーニング + LINE通知

**実装方法**:
- **GitHub Actions**（推奨・無料）
  - 毎日定期実行でNotionをチェック
  - 該当予約にLINE通知送信
- **Netlify Scheduled Functions**（有料プラン必要）
- **外部サービス**（Zapier/Make.com）

**影響範囲**:
- 新規ファイル: `.github/workflows/reminder.yml`
- 新規スクリプト: `scripts/send-reminder.js`
- 既存コードへの影響: **なし**（完全独立システム）

### 💰 コスト概算
- LINE Messaging API: 無料枠あり（月1000通まで）
- GitHub Actions: 完全無料
- Netlify Scheduled Functions: 有料プラン（月$19〜）※使用しない場合

---

## デプロイ方法

### Netlify自動デプロイ（推奨）

このプロジェクトはGitHub連携で自動デプロイされます。

**手順:**
1. 変更をコミット
   ```bash
   git add .
   git commit -m "変更内容"
   ```
2. GitHubにプッシュ
   ```bash
   git push
   ```
3. Netlifyが自動的にビルド＆デプロイを開始

**デプロイ状況確認:**
- ダッシュボード: https://app.netlify.com/sites/mfagencybooking/deploys
- 本番URL: https://mfagencybooking.netlify.app

**所要時間:** 約2〜3分

### 手動デプロイ（非推奨）

緊急時のみ使用：
```bash
npm run build
npx netlify deploy --prod --dir=build --site=6bdba099-821f-44be-80eb-3782e6917a0b
```

---

## 開発の基本フロー

### ローカル開発環境の起動
```bash
npm start
```
→ http://localhost:3000 で開発サーバーが起動

### 本番ビルドのテスト
```bash
npm run build
```
→ `build/`フォルダに本番用ファイルが生成

### 変更を本番に反映
```bash
git add .
git commit -m "変更内容"
git push
```
→ Netlifyが自動デプロイ

---

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
