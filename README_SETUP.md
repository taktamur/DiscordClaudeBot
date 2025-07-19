# セットアップガイド

## 1. 環境設定

### 必要な環境
- Deno 1.30以降
- Claude Code CLI (インストール済み)
- Discord Bot Token ([DISCORD_BOT_SETUP.md](./DISCORD_BOT_SETUP.md) 参照)

### 環境変数設定
```bash
# .env ファイルを作成
cp .env.example .env

# DISCORD_BOT_TOKEN を設定
vim .env
```

`.env` ファイルの設定例:
```
DISCORD_BOT_TOKEN=your_actual_discord_bot_token_here
```

## 2. 実行方法

### 開発時 (30秒でタイムアウト)
```bash
deno task dev
# または
deno run --allow-net --allow-env --allow-run main.ts --timeout 30
```

### 本番運用時
```bash
deno task start
# または
deno run --allow-net --allow-env --allow-run main.ts
```

## 3. 動作確認

1. Botが起動したら、Discordサーバーでボットにメンション
2. `@ボット名 こんにちは` のようにメッセージを送信
3. Claude Code からの応答が返ってくることを確認

## 4. トラブルシューティング

### Bot Token エラー
- `.env` ファイルの `DISCORD_BOT_TOKEN` が正しく設定されているか確認
- Discord Developer Portal でBot Tokenを再生成

### Claude CLI エラー
- `claude --version` でClaude Code CLIが正しくインストールされているか確認
- Claude Code の認証が完了しているか確認

### 権限エラー
- ボットに必要な権限（メッセージ送信、履歴読み取り）が付与されているか確認