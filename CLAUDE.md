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

### 技術的考慮事項
- スレッド履歴の取得範囲（最新N件 vs 全履歴）
- 長文応答の分割投稿
- コードブロック形式の保持
- エラーハンドリング
- 長時間処理時のDiscord応答方法（タイピング表示等）
- コンテキスト長制限への対応

## 参考資料
- [Harmony GitHub](https://github.com/harmonyland/harmony)
- [Harmony Documentation](https://harmony.mod.land/)