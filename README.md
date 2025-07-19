# Discord Claude Bot

Discord と Claude Code を連携させるボットシステム

> ⚠️ **実験的プロジェクト**  
> このプロジェクトは技術検証・学習目的の実験的な実装です。本格的な運用環境での使用は想定していません。

## 概要

Discord のスレッド内で特定のメンション（@ボット名）を受け取ると、そのスレッドの履歴をコンテキストとして Claude Code に渡し、レスポンスを Discord に投稿するシステム。

## 基本フロー
1. Discord スレッドでボットにメンション
2. スレッド履歴を取得・整形
3. `claude -p "プロンプト"` でClaude Code実行
4. レスポンスをDiscordに投稿

## 技術スタック
- **言語**: Deno
- **Discord API**: Harmony ライブラリ
- **Claude Code**: CLI経由で実行

## 動作確認済み機能
- ✅ **Discord Bot接続** - Token認証・ログイン成功
- ✅ **メンション検知** - @ボット名 での反応確認
- ✅ **スレッド履歴取得** - 最大50件のメッセージ履歴取得
- ✅ **会話文脈理解** - 時系列順の会話履歴をClaude Codeに提供
- ✅ **Claude CLI実行** - claude -p コマンド実行成功
- ✅ **Discord応答** - メッセージ送信機能動作
- ✅ **テスト自動化** - 自己メンション機能による自動テスト

## 実行方法

### 通常実行
```bash
# 開発時（30秒タイムアウト）
deno task dev

# 運用時（永続実行）
deno task start
```

### テスト実行
```bash
# 標準テスト（90秒タイムアウト）
deno task test:bot

# クイックテスト（60秒タイムアウト）
deno task test:bot:quick

# フルテスト（120秒タイムアウト）
deno task test:bot:full

# 手動実行
deno run --allow-net --allow-env --allow-read --allow-run main.ts --test --timeout=90
```

**テストモード要件:**
- 環境変数 `TEST_CHANNEL_ID` にテスト用チャンネルIDを設定
- ボットがテストチャンネルで送信・読み取り権限を持つこと
- `--allow-run` フラグでClaude CLI実行権限が必要

## ドキュメント構成

### セットアップ
- [Discord Bot セットアップ](docs/setup/discord-setup.md)
- [環境セットアップ](docs/setup/setup.md)

### テスト
- [自動テスト機能](docs/testing/automated-testing.md)

### 開発資料
- [実装ステータス](docs/development/status.md)
- [Harmonyライブラリ調査](docs/development/harmony-library-research.md)
- [Claude CLI調査](docs/development/claude-cli-research.md)
- [Denoプロセス管理](docs/development/deno-process-management.md)
- [パフォーマンス最適化](docs/development/performance-optimization.md)

### アーキテクチャ
- [Discord API制限](docs/architecture/discord-api-limits.md)
- [セキュリティ考慮事項](docs/architecture/security-considerations.md)

### トラブルシューティング
- [エラーシナリオ](docs/troubleshooting/error-scenarios.md)

## 注意事項

- **実験目的**: 技術検証・学習のためのプロジェクトです
- **セキュリティ**: 本格運用レベルのセキュリティ対策は実装していません
- **パフォーマンス**: 大規模な負荷には対応していません