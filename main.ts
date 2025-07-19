/**
 * Discord Claude Bot のエントリーポイント
 * コマンドライン引数を解析してボットを起動します
 */

import { DiscordBot } from "./src/bot.ts";
import { validateConfig } from "./src/config.ts";
import { Logger } from "./src/utils/logger.ts";

const logger = new Logger();

/**
 * コマンドライン引数を解析する関数
 * --timeout オプションによる自動終了機能をサポート
 * @returns 解析されたオプション
 */
function parseCommandLineArgs(): { timeoutSeconds?: number } {
  const timeoutIndex = Deno.args.indexOf("--timeout");
  const timeoutSeconds = timeoutIndex !== -1
    ? parseInt(Deno.args[timeoutIndex + 1])
    : undefined;

  return { timeoutSeconds };
}

/**
 * アプリケーションのメイン関数
 * 設定検証 → ボット初期化 → タイムアウト設定 → ボット起動の流れを実行
 */
async function main(): Promise<void> {
  logger.info("Discord Claude Botを起動中");

  // 設定の妥当性を検証
  if (!validateConfig()) {
    logger.error("設定の検証に失敗しました");
    Deno.exit(1);
  }

  const { timeoutSeconds } = parseCommandLineArgs();
  const bot = new DiscordBot();

  // 開発時用のタイムアウト機能（--timeout オプション指定時）
  // 運用時はタイムアウトなしで永続実行
  if (timeoutSeconds) {
    logger.info(`タイムアウトを${timeoutSeconds}秒に設定しました`);
    setTimeout(() => {
      logger.info("タイムアウトに達したため、ボットを終了します");
      bot.stop();
      Deno.exit(0);
    }, timeoutSeconds * 1000);
  }

  try {
    await bot.start();
    logger.info("ボットが正常に起動しました");
  } catch (error) {
    logger.error(`ボットの起動に失敗しました: ${error}`);
    Deno.exit(1);
  }
}

// ファイルが直接実行された場合のみメイン関数を実行
if (import.meta.main) {
  main().catch((error) => {
    logger.error(`未処理エラー: ${error}`);
    Deno.exit(1);
  });
}
