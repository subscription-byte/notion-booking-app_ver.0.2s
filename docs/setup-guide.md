# 予約システム セットアップガイド

このガイドでは、Notion連携予約システムを新しい環境にセットアップする手順を説明します。

## 必要な準備

### 1. アカウント・サービス
- **GitHubアカウント** - ソースコード管理用
- **Netlifyアカウント** - アプリケーションのホスティング用
- **Notionアカウント** - 予約データ管理用

### 2. 必要な環境
- Node.js (v16以上推奨)
- npm または yarn
- Git

## セットアップ手順

### ステップ1: リポジトリの取得

#### 方法A: GitHubからフォーク（推奨）
1. GitHubで `https://github.com/tttsystem/apokanri` にアクセス
2. 「Fork」ボタンをクリックして自分のアカウントにコピー
3. フォークしたリポジトリをローカルにクローン：
```bash
git clone https://github.com/[あなたのユーザー名]/apokanri.git
cd apokanri
```

#### 方法B: 直接譲渡を受ける場合
1. 現在のオーナーから共同編集者として招待を受ける
2. または、リポジトリの所有権を譲渡してもらう

### ステップ2: Notionの設定

#### 2.1 Notionデータベースの作成
1. Notionで新しいページを作成
2. データベース（カレンダービュー）を追加
3. 以下のプロパティを設定：
   - **名前** (タイトル) - 予約者名
   - **予定日** (日付) - 予約日時（時間範囲も含む）
   - **X** (URL) - X(Twitter)プロフィールリンク
   - **備考** (テキスト) - 任意のメモ
   - **対応者** (ユーザー) - 担当者
   - **通話方法** (セレクト) - 「対面」「オンライン」など

#### 2.2 Notion Integration（統合）の作成
1. https://www.notion.so/my-integrations にアクセス
2. 「New integration」をクリック
3. 基本情報を入力：
   - Name: 予約システム（任意の名前）
   - Associated workspace: 使用するワークスペースを選択
4. Capabilities（機能）で以下を有効化：
   - Read content
   - Update content
   - Insert content
5. 「Submit」をクリックして作成
6. **Internal Integration Token**をコピー（後で使用）

#### 2.3 データベースへのアクセス権限付与
1. Notionで作成したデータベースページを開く
2. 右上の「...」メニューから「Connections」を選択
3. 作成したIntegrationを検索して追加
4. データベースのURLから**データベースID**を取得：
   ```
   https://www.notion.so/[ワークスペース名]/[データベースID]?v=xxx
   ```
   `?v=`より前の32文字の英数字がデータベースID

### ステップ3: コードの設定変更

#### 3.1 NotionBookingSystem.jsxの修正
`src/components/NotionBookingSystem.jsx`を開いて以下を変更：

1. **データベースID**の変更（36行目付近）：
```javascript
const CALENDAR_DATABASE_ID = 'ここに新しいデータベースIDを入力';
```

2. **対応者ID**の変更（147行目付近）：
```javascript
'対応者': {
  people: [
    {
      id: 'ここに対応者のユーザーIDを入力'
    }
  ]
}
```

対応者IDの取得方法：
- Notionでユーザーページを開く
- URLから取得：`https://www.notion.so/[ワークスペース]/[ユーザーID]`

### ステップ4: Netlifyへのデプロイ

#### 4.1 Netlifyアカウントの設定
1. https://www.netlify.com でログイン
2. 「Add new site」→「Import an existing project」を選択
3. GitHubと連携して、フォークしたリポジトリを選択

#### 4.2 環境変数の設定
Netlifyのサイト設定で以下の環境変数を追加：

1. サイトの設定画面を開く
2. 「Site configuration」→「Environment variables」
3. 以下を追加：
   - **Key**: `NOTION_TOKEN`
   - **Value**: Notion Integrationのトークン（ステップ2.2でコピーしたもの）

#### 4.3 デプロイ設定
1. Build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
2. Functions directory: `netlify/functions`

#### 4.4 デプロイの実行
1. 「Deploy site」をクリック
2. デプロイが完了するまで待つ（通常2-3分）
3. 提供されたURLでアプリケーションにアクセス

## カスタマイズ

### システム設定の変更
`src/components/NotionBookingSystem.jsx`の19-26行目で変更可能：

```javascript
const settings = {
  immediateButtonText: '今すぐ予約する',  // ボタンテキスト
  startHour: 11,                          // 営業開始時間
  endHour: 21,                           // 営業終了時間
  systemTitle: '予約システム',            // システムタイトル
  description: 'ご希望の日時を選択してください'  // 説明文
};
```

### 祝日の設定
29-34行目の`holidays2025`配列に祝日を追加/削除：

```javascript
const holidays2025 = [
  '2025-01-01', // 元日
  '2025-01-13', // 成人の日
  // ... 追加の祝日
];
```

## トラブルシューティング

### よくある問題と解決方法

1. **予約が作成されない**
   - Notion Tokenが正しく設定されているか確認
   - データベースIDが正しいか確認
   - Integrationがデータベースに接続されているか確認

2. **時間帯が重複してブロックされない**
   - ブラウザのコンソールでエラーを確認
   - Notionデータベースの「予定日」プロパティが日付型であることを確認

3. **Netlifyでビルドエラー**
   - Node.jsのバージョンを確認（package.jsonで指定可能）
   - 環境変数が正しく設定されているか確認

## サポート

問題が解決しない場合は、以下の情報を準備して前のオーナーに連絡してください：
- エラーメッセージの全文
- ブラウザのコンソールログ
- Netlifyのデプロイログ
- 実行した手順の詳細

## セキュリティ注意事項

- **Notion Token**は絶対に公開しないでください
- GitHubにトークンをコミットしないよう注意
- 本番環境では必ずHTTPS経由でアクセス
- 定期的にトークンを更新することを推奨

---

最終更新日: 2025年1月