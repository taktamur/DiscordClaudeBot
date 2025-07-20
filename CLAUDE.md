# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

Discord のスレッド内で特定のメンション（@ボット名）を受け取ると、そのスレッドの履歴をコンテキストとして Claude Code に渡し、レスポンスを Discord に投稿するボットシステム。

## 技術スタック

- **Runtime**: Deno
- **Discord API**: Harmony ライブラリ
- **Claude Code**: CLI経由で実行 (`claude -p "プロンプト"`)

## アーキテクチャ

システムは以下の4つの主要コンポーネントで構成される：

1. **Discord Bot**: `@ボット名` メンション検知、スレッド内メッセージ履歴取得、応答メッセージ投稿
2. **コンテキスト処理部**: スレッド履歴をテキスト形式で整理、Claude Code向けプロンプト構築
3. **Claude Code実行部**: `claude -p "プロンプト"` 実行、標準出力/エラー出力キャッチ
4. **応答処理部**: Claude Codeの出力をDiscord形式に整形、コードブロック、ファイル添付等の対応

## データフロー

```
Discord Thread → Bot検知 → 履歴収集 → プロンプト構築 
→ claude CLI実行 → 出力整形 → Discord投稿
```

## 開発時の注意事項

### メンション検知実装
```typescript
client.on('messageCreate', (msg: Message): void => {
  // ボット宛メンション検知
  if (msg.mentions.users.has(client.user?.id)) {
    // スレッド履歴取得 + Claude Code実行
  }
})
```

### プロセス実行
Deno.Command APIを使用してClaude Code CLIを実行する。

### 開発・動作確認方式
Bot は event loop で永続実行されるため、コマンド引数によるタイムアウト制御を実装する：

```typescript
// コマンド引数解析
const timeoutIndex = Deno.args.indexOf('--timeout');
const timeoutSeconds = timeoutIndex !== -1 ? 
  parseInt(Deno.args[timeoutIndex + 1]) : null;

// タイムアウト設定
if (timeoutSeconds) {
  setTimeout(() => {
    console.log("タイムアウトにより終了");
    client.destroy();
    Deno.exit(0);
  }, timeoutSeconds * 1000);
}
```

**実行例:**
```bash
# 開発時：30秒で自動終了
deno run --allow-net --allow-env --allow-read main.ts --timeout 30

# 運用時：タイムアウトなし
deno run --allow-net --allow-env --allow-read main.ts

# テストモード：自動テスト実行
deno run --allow-net --allow-env --allow-read --allow-run main.ts --test --timeout 90
```

### 技術的考慮事項
- スレッド履歴の取得範囲（最新N件 vs 全履歴）
- 長文応答の分割投稿
- コードブロック形式の保持
- エラーハンドリング
- 長時間処理時のDiscord応答方法（タイピング表示等）
- コンテキスト長制限への対応

## 実装済み機能

### メンション機能
- 返信時に自動で`<@ユーザーID>`メンションを付与
- 分割メッセージでは最初のメッセージにのみメンション追加

### タイムアウト設定
- Claude Code CLI実行タイムアウト: 1800秒（30分）
- 長時間の複雑な処理にも対応可能

### テスト自動化機能
- `--test`オプションで自動テストモード実行
- 自己メンション機能による機能テスト
- 3つのテストシナリオ（基本応答・Claude連携・短文処理）
- 詳細なテスト結果レポート出力
- CI/CD対応（終了コード: 成功=0、失敗=1）

### 設定項目 (src/config.ts)
```typescript
export const CONFIG = {
  DISCORD_TOKEN: Deno.env.get("DISCORD_BOT_TOKEN") || "",
  TEST_CHANNEL_ID: Deno.env.get("TEST_CHANNEL_ID") || "",  // テスト用
  CLAUDE_TIMEOUT_SECONDS: 1800,  // 30分
  MAX_MESSAGE_LENGTH: 2000,
  MAX_HISTORY_MESSAGES: 50,
  RATE_LIMIT_MESSAGES_PER_SECOND: 5,
} as const;
```

## 実装計画

### フェーズ1: 基盤設定（高優先度）
1. **プロジェクト構造決定** - ファイル構成とモジュール分割
2. **依存関係設定** - deno.json, deps.ts でHarmonyライブラリ設定  
3. **環境設定** - .env.example作成、TOKEN管理方法確立
4. **【ユーザ作業】Discord Bot設定** - Developer PortalでBot作成・Token取得 (`DISCORD_BOT_SETUP.md`参照)
5. **基本Bot実装** - Discord接続、メンション検知の最小構成
6. **【ユーザ作業】Bot招待** - サーバーに招待・権限設定

### フェーズ2: 核心機能実装（中優先度）
7. **スレッド履歴取得** - メッセージ履歴の収集と整理
8. **Claude CLI実行** - コマンド引数タイムアウト制御付きプロセス実行
9. **応答処理** - 2000文字制限対応の分割投稿機能
10. **エラーハンドリング** - 堅牢な例外処理とログ出力

### フェーズ3: 仕上げ（低優先度）  
11. **動作テスト** - 各機能の統合テストとデバッグ
12. **ドキュメント整備** - README.md更新、使用方法説明

### ユーザ作業タイミング
- **4番目**: 基本実装前にBot作成・Token取得を完了
- **6番目**: 接続テスト前にサーバー招待・権限設定を完了

## 参考資料
- [Harmony GitHub](https://github.com/harmonyland/harmony)
- [Harmony Documentation](https://harmony.mod.land/)
- [Discord Bot Setup Guide](./DISCORD_BOT_SETUP.md)

## テスト戦略

### ユニットテスト
- ユニットテストに関しては、t_wadaさんのつもりになって行動してください。

### 開発ワークフロー
- コミットする前に、fmt lint unittestを実行するようにしてください。