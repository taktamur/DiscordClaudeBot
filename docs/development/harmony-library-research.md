# Harmonyライブラリ調査結果

## 概要

Deno/Node.js用のDiscord APIライブラリ「Harmony」の調査結果をまとめました。

## 基本情報

- **GitHub**: https://github.com/harmonyland/harmony
- **ドキュメント**: https://doc.deno.land/https/deno.land/x/harmony/mod.ts
- **言語**: TypeScript
- **対応環境**: Deno, Node.js
- **特徴**: 軽量、オブジェクト指向、デコレータ対応

## 基本的な使用方法

### クライアント初期化

```typescript
import { Client, Message, GatewayIntents } from 'https://deno.land/x/harmony/mod.ts'

const client = new Client({
  intents: [
    'GUILDS',
    'DIRECT_MESSAGES', 
    'GUILD_MESSAGES'
  ]
})
```

### メッセージイベントハンドリング

```typescript
client.on('messageCreate', (msg: Message) => {
  // メッセージ処理
})
```

## メンション検知

### ボットへのメンション検知
```typescript
client.on('messageCreate', (msg: Message) => {
  // ボット宛メンション検知
  if (msg.mentions.users.has(client.user?.id)) {
    // メンション処理
  }
})
```

### メンション関連のクラス
- **MessageMentions**: メンション情報を管理
- **静的プロパティ**:
  - `USER_MENTION`: `/<@!?(\d{17,19})>/g`
  - `ROLE_MENTION`: `/<@&(\d{17,19})>/g`
  - `CHANNEL_MENTION`: `/<#(\d{17,19})>/g`
  - `EVERYONE_MENTION`: `/@(everyone|here)/g`

## メッセージ操作

### メッセージ送信
```typescript
// 通常送信
msg.channel.send('メッセージ内容')

// リプライ
msg.reply('リプライ内容')
```

### メッセージ履歴取得
- **MessagesManager**: メッセージの取得・管理を担当
- **メソッド**: `get(key: string)`, `set(key: string, value: MessagePayload)`

## スレッド関連

### 主要クラス
- **ThreadChannel**: スレッド操作
- **ThreadMembersManager**: スレッドメンバー管理
- **ThreadMetadata**: アーカイブ設定等のメタデータ

### ThreadMetadataの重要プロパティ
- `archived`: アーカイブ状態
- `autoArchiveDuration`: 自動アーカイブ時間（60, 1440, 4320, 10080分）
- `locked`: ロック状態

## プロジェクト構造

### 重要なディレクトリ
- `examples/`: 基本的な使用例
- `test/`: 詳細な実装例とテストコード
- `src/structures/`: 各種データ構造の定義
- `src/managers/`: データ管理クラス
- `src/gateway/handlers/`: イベントハンドラー

### 参考になるファイル
- `examples/ping.ts`: 基本的なメッセージ処理
- `test/cmds/mentions.ts`: メンション処理の例
- `src/structures/message.ts`: メッセージ構造の詳細
- `src/structures/messageMentions.ts`: メンション処理の実装

## Discord Claude Bot実装時の注意点

### メンション検知実装
```typescript
client.on('messageCreate', (msg: Message): void => {
  // ボット宛メンション検知
  if (msg.mentions.users.has(client.user?.id)) {
    // スレッド履歴取得
    // Claude Code実行
    // 結果をDiscordに投稿
  }
})
```

### 必要なIntents
```typescript
const client = new Client({
  intents: [
    GatewayIntents.GUILDS,
    GatewayIntents.GUILD_MESSAGES,
    GatewayIntents.DIRECT_MESSAGES
  ]
})
```

### 長時間処理対応
- タイピング表示: Discord APIの標準機能を使用
- 応答分割: 2000文字制限に対する分割送信が必要

## 技術的課題と対策

### 1. スレッド履歴取得
- `MessagesManager`を使用してメッセージ履歴を取得
- 取得範囲の設定が必要（最新N件 vs 全履歴）

### 2. Claude Code連携
- `Deno.Command` APIでプロセス実行
- 標準出力/エラー出力の適切なキャッチ

### 3. エラーハンドリング
- ボット同士の無限ループ防止
- API通信エラー時の適切な処理

## 次のステップ

1. プロトタイプ実装での動作確認
2. スレッド履歴取得ロジックの詳細設計
3. Claude Code連携部分の実装
4. 長文応答の分割処理実装

## 参考資料

- [Harmony GitHub](https://github.com/harmonyland/harmony)
- [Harmony Documentation](https://doc.deno.land/https/deno.land/x/harmony/mod.ts)
- [Harmony Guide](https://harmony.mod.land/)