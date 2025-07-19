# Discord Claude Bot

Discord と Claude Code を連携させるボットシステム

> ⚠️ **実験的プロジェクト**  
> このプロジェクトは技術検証・学習目的の実験的な実装です。本格的な運用環境での使用は想定していません。

## 概要

Discord のスレッド内で特定のメンション（@ボット名）を受け取ると、そのスレッドの履歴をコンテキストとして Claude Code に渡し、レスポンスを Discord に投稿するシステム。

## 🔍 調査完了状況

実装前の技術調査が完了しました。詳細は `docs/` ディレクトリを参照してください。

- ✅ **Harmonyライブラリ調査** - Discord API連携の基本仕様
- ✅ **Claude CLI調査** - コマンド実行と出力形式の詳細
- ✅ **Deno.Command調査** - プロセス管理の実装方法
- ✅ **Discord API制限調査** - メッセージ長・レート制限への対策
- ✅ **セキュリティ調査** - 安全な実装のためのガイドライン
- ✅ **エラーハンドリング調査** - 想定エラーシナリオと対処法
- ✅ **パフォーマンス最適化調査** - 効率的な実装手法

## システム構想

### 基本フロー
1. Discord スレッドでボットにメンション
2. スレッド履歴を取得・整形
3. `claude -p "プロンプト"` でClaude Code実行
4. レスポンスをDiscordに投稿

### 技術要件
- **言語**: Deno
- **Discord API**: Harmony ライブラリ
- **Claude Code**: CLI経由で実行

## システム構成要素

### 1. Discord Bot（ボット名未定）
- `@ボット名` メンション検知
- スレッド内メッセージ履歴取得
- 応答メッセージ投稿

### 2. コンテキスト処理部
- スレッド履歴をテキスト形式で整理
- Claude Code向けプロンプト構築

### 3. Claude Code実行部
- `claude -p "プロンプト"` 実行
- 標準出力/エラー出力キャッチ

### 4. 応答処理部
- Claude Codeの出力をDiscord形式に整形
- コードブロック、ファイル添付等の対応

## データフロー

```
Discord Thread → Bot検知 → 履歴収集 → プロンプト構築 
→ claude CLI実行 → 出力整形 → Discord投稿
```

## 技術スタック

### Deno + Harmony
- **Discord API**: Harmony（DenoのDiscordライブラリ）
- **プロセス実行**: `Deno.Command` API
- **HTTP通信**: 標準fetch API

### Harmony ライブラリ調査結果
- Deno向けのDiscord APIライブラリ
- オブジェクト指向アプローチ
- スラッシュコマンド対応
- 組み込みコマンドフレームワーク
- TypeScriptで作成
- デコレータ対応

**確認済み機能:**
- `messageCreate` イベントハンドリング
- メッセージ送信 (`msg.channel.send()`)
- 基本的なメッセージ処理
- メンション検知が可能と推測

**想定メンション検知実装:**
```typescript
client.on('messageCreate', (msg: Message): void => {
  // ボット宛メンション検知
  if (msg.mentions.users.has(client.user?.id)) {
    // スレッド履歴取得 + Claude Code実行
  }
})
```

## 📚 調査ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [harmony-library-research.md](docs/harmony-library-research.md) | Harmonyライブラリの使用方法とAPI詳細 |
| [claude-cli-research.md](docs/claude-cli-research.md) | Claude Code CLIの仕様と出力形式 |
| [deno-process-management.md](docs/deno-process-management.md) | Deno.Commandによるプロセス管理 |
| [discord-api-limits.md](docs/discord-api-limits.md) | Discord API制限と対処法 |
| [security-considerations.md](docs/security-considerations.md) | セキュリティ対策の実装例 |
| [error-scenarios.md](docs/error-scenarios.md) | エラーシナリオと対処法 |
| [performance-optimization.md](docs/performance-optimization.md) | パフォーマンス最適化手法 |

## 🔑 実装の要点

### メンション検知（確認済み）
```typescript
client.on('messageCreate', (msg: Message) => {
  if (msg.mentions.users.has(client.user?.id)) {
    // ボット宛メンション処理
  }
});
```

### Claude実行（検証済み）
```typescript
const cmd = new Deno.Command("claude", {
  args: ["-p", prompt],
  stdout: "piped",
  stderr: "piped"
});
const result = await cmd.output();
```

### 制限事項への対策（調査済み）
- **メッセージ長制限**: 2000文字で自動分割
- **レート制限**: 5メッセージ/秒で制御
- **特殊文字**: エスケープ処理不要（検証済み）
- **タイムアウト**: 60秒で強制終了
- **セキュリティ**: 入力検証・コマンドインジェクション対策

## 実装状況（2025-07-19）

### ✅ フェーズ1完了 - 基盤実装
1. ✅ **プロジェクト構造決定** - モジュール化されたファイル構成
2. ✅ **依存関係設定** - JSR @harmony/harmony v2.9.1 使用
3. ✅ **環境設定** - .env ファイル、セットアップガイド作成
4. ✅ **基本Bot実装** - TypeScript型チェック通過、動作確認済み

### 🎯 動作確認済み機能
- ✅ **Discord Bot接続** - Token認証・ログイン成功
- ✅ **メンション検知** - @ボット名 での反応確認
- ✅ **Claude CLI実行** - claude -p コマンド実行成功（約5秒）
- ✅ **Discord応答** - メッセージ送信機能動作

### 📊 テスト結果
```
[2025-07-19T00:36:08] INFO: Processing mention from ahirunotamura
[2025-07-19T00:36:08] INFO: Using current message as context
[2025-07-19T00:36:13] INFO: Claude Code execution completed successfully
[2025-07-19T00:36:14] INFO: Response sent successfully
```

### 🔧 現在の実装状態
- **実行コマンド**: `deno task dev` (30秒タイムアウト) / `deno task start` (永続実行)
- **権限設定**: `--allow-net --allow-env --allow-run --allow-read --env-file=.env`
- **メッセージ履歴**: 現在のメッセージのみ（シンプル実装）

### 📋 次のステップ
1. ⏳ **フェーズ2**: スレッド履歴取得機能の拡張
2. ⏳ **エラーハンドリング強化**
3. ⏳ **メッセージ分割投稿テスト**
4. ⏳ **パフォーマンス最適化**

## ⚠️ 注意事項

- **実験目的**: 技術検証・学習のためのプロジェクトです
- **セキュリティ**: 本格運用レベルのセキュリティ対策は実装していません
- **パフォーマンス**: 大規模な負荷には対応していません
- **保守性**: コードの可読性・保守性より動作確認を優先しています

## 参考資料

- [Harmony GitHub](https://github.com/harmonyland/harmony)
- [Harmony Documentation](https://harmony.mod.land/)
- Claude Code CLI リファレンス