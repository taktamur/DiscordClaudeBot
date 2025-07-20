/**
 * Discord Claude Bot のエントリーポイント
 * コマンドライン引数を解析してボットを起動します
 */

import { DiscordBot } from "./src/bot.ts";
import { validateConfig } from "./src/config.ts";
import { Logger } from "./src/utils/logger.ts";
import { E2ETestRunner } from "./e2e/runner.ts";

const logger = new Logger();

/**
 * コマンドライン引数を解析する関数
 * --timeout オプションによる自動終了機能と --test オプションをサポート
 * @returns 解析されたオプション
 */
function parseCommandLineArgs(): {
  timeoutSeconds?: number;
  isTestMode: boolean;
} {
  const timeoutIndex = Deno.args.indexOf("--timeout");
  const timeoutSeconds = timeoutIndex !== -1
    ? parseInt(Deno.args[timeoutIndex + 1])
    : undefined;

  const isTestMode = Deno.args.includes("--test");

  return { timeoutSeconds, isTestMode };
}

/**
 * アプリケーションのメイン関数
 * 設定検証 → ボット初期化 → タイムアウト設定 → ボット起動の流れを実行
 */
async function main(): Promise<void> {
  const { timeoutSeconds, isTestMode } = parseCommandLineArgs();

  if (isTestMode) {
    logger.info("Discord Claude Bot（テストモード）を起動中");
  } else {
    logger.info("Discord Claude Botを起動中");
  }

  // 設定の妥当性を検証（テストモード考慮）
  if (!validateConfig(isTestMode)) {
    logger.error("設定の検証に失敗しました");
    Deno.exit(1);
  }

  const bot = new DiscordBot();

  // テストモード設定
  if (isTestMode) {
    bot.setTestMode(true);
  }

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

    if (isTestMode) {
      // テストモード実行
      await runTestMode(bot);
    }
  } catch (error) {
    logger.error(`ボットの起動に失敗しました: ${error}`);
    Deno.exit(1);
  }
}

/**
 * テストモードを実行する関数
 * @param bot 起動済みのDiscordBotインスタンス
 */
async function runTestMode(bot: DiscordBot): Promise<void> {
  logger.info("テストモードを開始します");

  try {
    // ボットが完全に起動するまで少し待機
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // E2ETestRunnerを初期化して実行
    const e2eTestRunner = new E2ETestRunner(bot.getClient());
    await e2eTestRunner.runE2ETests();

    // テスト結果に基づいて終了コード決定
    const allPassed = e2eTestRunner.isAllE2ETestsPassed();
    logger.info(
      `E2Eテスト完了: ${allPassed ? "全テスト成功" : "一部テスト失敗"}`,
    );

    // ボットを停止
    await bot.stop();

    // 終了コード設定（CI/CD対応）
    Deno.exit(allPassed ? 0 : 1);
  } catch (error) {
    logger.error(`テストの実行に失敗しました: ${error}`);
    await bot.stop();
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
