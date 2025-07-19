/**
 * Discord Claude Bot の設定ファイル
 * ボットの動作に必要な設定値を定義します
 */

export const CONFIG = {
  /** Discord Bot のトークン（環境変数 DISCORD_BOT_TOKEN から取得） */
  DISCORD_TOKEN: Deno.env.get("DISCORD_BOT_TOKEN") || "",

  /** Claude CLI 実行のタイムアウト時間（秒）- 長時間処理対応のため30分設定 */
  CLAUDE_TIMEOUT_SECONDS: 1800,

  /** Discord メッセージの最大長（Discord API制限：2000文字） */
  MAX_MESSAGE_LENGTH: 2000,

  /** 取得するスレッド履歴の最大メッセージ数 */
  MAX_HISTORY_MESSAGES: 50,

  /** レート制限：1秒あたりのメッセージ送信数上限 */
  RATE_LIMIT_MESSAGES_PER_SECOND: 5,
} as const;

/**
 * 設定の妥当性を検証する関数
 * @returns 設定が有効な場合 true、無効な場合 false
 */
export function validateConfig(): boolean {
  // 実行時に環境変数を動的に取得（テスト用）
  const token = Deno.env.get("DISCORD_BOT_TOKEN") || "";
  if (!token) {
    console.error("DISCORD_BOT_TOKEN environment variable is required");
    return false;
  }
  return true;
}
