/**
 * Discord Claude Bot の設定ファイル
 * ボットの動作に必要な設定値を定義します
 */

/**
 * 環境別の.envファイルを読み込む
 * @param environment 環境名（test, production, development）
 */
async function loadEnvironmentConfig(environment?: string): Promise<void> {
  const env = environment || Deno.env.get("NODE_ENV") || "development";

  let envFile = ".env";

  // 環境に応じて適切な.envファイルを選択
  switch (env) {
    case "test":
      envFile = ".env.e2e";
      break;
    case "production":
    case "development":
    default:
      envFile = ".env";
      break;
  }

  try {
    // 指定された環境ファイルが存在する場合のみ読み込み
    const envPath = new URL(`../${envFile}`, import.meta.url).pathname;
    const envContent = await Deno.readTextFile(envPath);

    // 環境変数を設定
    envContent.split("\n").forEach((line) => {
      line = line.trim();
      if (line && !line.startsWith("#")) {
        const [key, ...valueParts] = line.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=");
          Deno.env.set(key, value);
        }
      }
    });

    console.log(`Environment config loaded: ${envFile}`);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.warn(
        `Environment file ${envFile} not found, using system environment variables`,
      );
    } else {
      console.error(`Error loading environment file ${envFile}:`, error);
    }
  }
}

// アプリケーション起動時に環境設定を読み込み
await loadEnvironmentConfig();

export const CONFIG = {
  /** Discord Bot のトークン（環境変数 DISCORD_BOT_TOKEN から取得） */
  DISCORD_TOKEN: Deno.env.get("DISCORD_BOT_TOKEN") || "",

  /** テスト用チャンネルID（環境変数 TEST_CHANNEL_ID から取得） */
  TEST_CHANNEL_ID: Deno.env.get("TEST_CHANNEL_ID") || "",

  /** Claude CLI 実行のタイムアウト時間（秒）- 長時間処理対応のため30分設定 */
  CLAUDE_TIMEOUT_SECONDS: parseInt(
    Deno.env.get("CLAUDE_TIMEOUT_SECONDS") || "1800",
  ),

  /** Discord メッセージの最大長（Discord API制限：2000文字） */
  MAX_MESSAGE_LENGTH: parseInt(Deno.env.get("MAX_MESSAGE_LENGTH") || "2000"),

  /** 取得するスレッド履歴の最大メッセージ数 */
  MAX_HISTORY_MESSAGES: parseInt(Deno.env.get("MAX_HISTORY_MESSAGES") || "50"),

  /** レート制限：1秒あたりのメッセージ送信数上限 */
  RATE_LIMIT_MESSAGES_PER_SECOND: parseInt(
    Deno.env.get("RATE_LIMIT_MESSAGES_PER_SECOND") || "5",
  ),

  /** 現在の環境 */
  ENVIRONMENT: Deno.env.get("NODE_ENV") || "development",
} as const;

/**
 * 手動で環境設定を読み込む（実行時切り替え用）
 * @param environment 環境名（test, production, development）
 */
export async function switchEnvironment(environment: string): Promise<void> {
  await loadEnvironmentConfig(environment);

  // CONFIGオブジェクトの値を再取得
  Object.assign(CONFIG, {
    DISCORD_TOKEN: Deno.env.get("DISCORD_BOT_TOKEN") || "",
    TEST_CHANNEL_ID: Deno.env.get("TEST_CHANNEL_ID") || "",
    CLAUDE_TIMEOUT_SECONDS: parseInt(
      Deno.env.get("CLAUDE_TIMEOUT_SECONDS") || "1800",
    ),
    MAX_MESSAGE_LENGTH: parseInt(Deno.env.get("MAX_MESSAGE_LENGTH") || "2000"),
    MAX_HISTORY_MESSAGES: parseInt(
      Deno.env.get("MAX_HISTORY_MESSAGES") || "50",
    ),
    RATE_LIMIT_MESSAGES_PER_SECOND: parseInt(
      Deno.env.get("RATE_LIMIT_MESSAGES_PER_SECOND") || "5",
    ),
    ENVIRONMENT: Deno.env.get("NODE_ENV") || "development",
  });
}

/**
 * 設定の妥当性を検証する関数
 * @param isTestMode テストモードかどうか
 * @returns 設定が有効な場合 true、無効な場合 false
 */
export function validateConfig(isTestMode = false): boolean {
  // 実行時に環境変数を動的に取得（テスト用）
  const token = Deno.env.get("DISCORD_BOT_TOKEN") || "";
  if (!token) {
    console.error("DISCORD_BOT_TOKEN environment variable is required");
    return false;
  }

  // テストモード時はTEST_CHANNEL_IDも必須
  if (isTestMode) {
    const testChannelId = Deno.env.get("TEST_CHANNEL_ID") || "";
    if (!testChannelId) {
      console.error(
        "TEST_CHANNEL_ID environment variable is required for test mode",
      );
      console.error("Please set TEST_CHANNEL_ID in your .env file");
      return false;
    }
  }

  return true;
}
