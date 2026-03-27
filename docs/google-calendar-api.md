# Google Calendar API リファレンス

このファイルは開発時の参照用です。Claude Codeがこのプロジェクトを扱う際に正確な情報を参照できるようにまとめています。

## カレンダー色ID一覧

Googleカレンダーのイベントに設定できる`colorId`の一覧です。

| ID | 色名 | HEX | RGB | 用途 |
|---|---|---|---|---|
| 0 | デフォルト | - | - | 色指定なし |
| 1 | ラベンダー | #7986CB | rgb(121, 134, 203) | **対面予約（ブロック判定用）** |
| 2 | セージ | #33B679 | rgb(51, 182, 121) | **PersonC LINE連携予約** |
| 3 | ブドウ | #8E24AA | rgb(142, 36, 170) | **撮影予約（ブロック判定用）** |
| 4 | フラミンゴ | #E67C73 | rgb(230, 124, 115) | - |
| 5 | バナナ | #F6BF26 | rgb(246, 191, 38) | - |
| 6 | ミカン | #F4511E | rgb(244, 81, 30) | - |
| 7 | ピーコック | #039BE5 | rgb(3, 155, 229) | **通常予約（X DM）** |
| 8 | グラファイト | #616161 | rgb(97, 97, 97) | - |
| 9 | ブルーベリー | #3F51B5 | rgb(63, 81, 181) | - |
| 10 | バジル | #0B8043 | rgb(11, 128, 67) | - |
| 11 | トマト | #D50000 | rgb(213, 0, 0) | **PersonA LINE連携予約** |

### このプロジェクトでの色分けルール

- **colorId '7' (ピーコック・水色)**: 通常リンクからの予約（X DM経由）
- **colorId '2' (セージ・緑)**: PersonC（LINE連携）からの予約
- **colorId '11' (トマト・赤)**: PersonA（LINE連携）からの予約
- **colorId '1' (ラベンダー)**: 対面予約（手動設定時、ブロック判定に使用）
- **colorId '3' (ブドウ・紫)**: 撮影予約（手動設定時、ブロック判定に使用）

## イベント構造

### 基本プロパティ

```javascript
{
  summary: "予約者名",
  description: "詳細説明（テンプレート形式）",
  location: "X DM" または "公式LINE（公認）",
  start: { dateTime: "2026-03-05T14:00:00+09:00" },
  end: { dateTime: "2026-03-05T15:00:00+09:00" },
  colorId: "11"（PersonA）/ "2"（PersonC）/ "7"（通常）,
  reminders: {
    useDefault: false,
    overrides: [
      { method: "popup", minutes: 10 },
      { method: "popup", minutes: 0 }
    ]
  }
}
```

### extendedProperties.private

システムが使用する内部データ（検索・フィルタリング・通知送信用）

```javascript
{
  xLink: "XまたはmyfansのURL",
  remarks: "備考",
  route: "公認X" または "まゆ紹介" など,
  assignee: "担当者名",
  callMethod: "対面" または "撮影" など,
  lineUserId: "LINE User ID（LINE連携時）",
  myfansStatus: "登録済" または "未登録",
  premiumStatus: "登録済" または "未登録",
  bookingStatus: "予約完了" または "仮登録",
  sessionId: "セッションID（仮登録時のみ）"
}
```

## 場所（location）フィールド

Googleカレンダーの一覧表示で見やすくするため、予約元を場所に記載：

- **通常リンク**: `X DM`
- **PersonA（LINE連携）**: `公式LINE（公認）`

## リマインダー設定

### 通常予約
- 10分前: `{ method: 'popup', minutes: 10 }`
- 時間ぴったり: `{ method: 'popup', minutes: 0 }`

### LINE連携予約（セッション方式）
- 10分前: `{ method: 'popup', minutes: 10 }`
- 1分前: `{ method: 'popup', minutes: 1 }`

## API エンドポイント

### イベント作成
```javascript
calendar.events.insert({
  calendarId: GOOGLE_CALENDAR_ID,
  requestBody: { /* イベントデータ */ }
})
```

### イベント取得
```javascript
calendar.events.list({
  calendarId: GOOGLE_CALENDAR_ID,
  timeMin: startDate.toISOString(),
  timeMax: endDate.toISOString(),
  singleEvents: true,
  maxResults: 500
})
```

### イベント更新
```javascript
calendar.events.patch({
  calendarId: GOOGLE_CALENDAR_ID,
  eventId: eventId,
  requestBody: { /* 更新データ */ }
})
```

### イベント削除
```javascript
calendar.events.delete({
  calendarId: GOOGLE_CALENDAR_ID,
  eventId: eventId
})
```

## 認証

サービスアカウント方式を使用：

```javascript
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
```

## 注意事項

1. **タイムゾーン**: JSTで処理（UTC+9時間）
2. **日付形式**: ISO 8601形式 `YYYY-MM-DDTHH:mm:ss+09:00`
3. **仮登録**: 2099年にイベント作成、sessionIdで管理
4. **セキュリティ**: カレンダーID検証、所有権検証を必ず実施
