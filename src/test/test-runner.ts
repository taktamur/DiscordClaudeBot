/**
 * Discord Claude Bot のテスト実行クラス
 * 自己メンション機能を使ったボット機能の自動テストを実行します
 */

import { Client, Message, TextChannel } from "../../deps.ts";
import { CONFIG } from "../config.ts";
import { Logger } from "../utils/logger.ts";

/**
 * テストシナリオの定義
 */
interface TestScenario {
  name: string;
  message: string;
  expectedPattern?: RegExp;
  timeoutMs: number;
}

/**
 * テスト結果の定義
 */
interface TestResult {
  scenario: string;
  success: boolean;
  responseTime: number;
  error?: string;
  response?: string;
}

/**
 * Discord Bot のテスト実行クラス
 * 指定されたチャンネルで自動テストシナリオを実行します
 */
export class TestRunner {
  private client: Client;
  private logger: Logger;
  private testResults: TestResult[] = [];
  private currentTestId: string | null = null;
  private responseWaiter: {
    resolve: (value: string) => void;
    reject: (reason: string) => void;
  } | null = null;

  /**
   * デフォルトのテストシナリオ
   */
  private readonly DEFAULT_SCENARIOS: TestScenario[] = [
    {
      name: "基本応答テスト",
      message: "こんにちは",
      timeoutMs: 30000, // 30秒
    },
    {
      name: "Claude連携テスト",
      message: "2+2は？",
      expectedPattern: /4/,
      timeoutMs: 60000, // 60秒（Claude実行時間考慮）
    },
    {
      name: "短文処理テスト",
      message: "はい",
      timeoutMs: 30000,
    },
  ];

  constructor(client: Client) {
    this.client = client;
    this.logger = new Logger();
    this.setupMessageListener();
  }

  /**
   * ボットからの応答を監視するリスナーを設定
   */
  private setupMessageListener(): void {
    this.client.on("messageCreate", (msg: Message) => {
      // ボット自身のメッセージかつ、テスト実行中の場合
      if (msg.author.id === this.client.user?.id && this.responseWaiter) {
        this.responseWaiter.resolve(msg.content);
        this.responseWaiter = null;
      }
    });
  }

  /**
   * テストスイートを実行
   * @param scenarios 実行するテストシナリオ（省略時はデフォルトシナリオ）
   */
  async runTests(
    scenarios: TestScenario[] = this.DEFAULT_SCENARIOS,
  ): Promise<TestResult[]> {
    this.logger.info("テストスイートを開始します");

    const channel = await this.getTestChannel();
    if (!channel) {
      throw new Error("テストチャンネルが見つかりません");
    }

    this.testResults = [];

    for (const scenario of scenarios) {
      this.logger.info(`テスト実行中: ${scenario.name}`);
      const result = await this.runSingleTest(channel, scenario);
      this.testResults.push(result);

      // テスト間のインターバル（レート制限回避）
      await this.delay(2000);
    }

    this.generateReport();
    return this.testResults;
  }

  /**
   * テストチャンネルを取得
   */
  private async getTestChannel(): Promise<TextChannel | null> {
    try {
      const channel = await this.client.channels.fetch(CONFIG.TEST_CHANNEL_ID);
      if (channel && channel.type === 0) { // GUILD_TEXT
        return channel as TextChannel;
      }
    } catch (error) {
      this.logger.error(`テストチャンネルの取得に失敗: ${error}`);
    }
    return null;
  }

  /**
   * 単一のテストシナリオを実行
   */
  private async runSingleTest(
    channel: TextChannel,
    scenario: TestScenario,
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // 自己メンション付きメッセージを送信
      const mentionMessage = `<@${this.client.user?.id}> ${scenario.message}`;
      this.currentTestId = `test_${Date.now()}`;

      await channel.send(mentionMessage);

      // 応答を待機
      const response = await this.waitForResponse(scenario.timeoutMs);
      const responseTime = Date.now() - startTime;

      // 応答パターンの検証
      const success = scenario.expectedPattern
        ? scenario.expectedPattern.test(response)
        : response.length > 0;

      return {
        scenario: scenario.name,
        success,
        responseTime,
        response: response.substring(0, 100), // 最初の100文字のみ記録
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        scenario: scenario.name,
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * ボットからの応答を待機
   */
  private waitForResponse(timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.responseWaiter = { resolve, reject };

      setTimeout(() => {
        if (this.responseWaiter) {
          this.responseWaiter.reject("タイムアウト");
          this.responseWaiter = null;
        }
      }, timeoutMs);
    });
  }

  /**
   * 指定時間待機
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * テスト結果レポートを生成・出力
   */
  private generateReport(): void {
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter((r) => r.success).length;
    const failedTests = totalTests - successfulTests;

    this.logger.info("=".repeat(50));
    this.logger.info("テスト結果レポート");
    this.logger.info("=".repeat(50));
    this.logger.info(`総テスト数: ${totalTests}`);
    this.logger.info(`成功: ${successfulTests}`);
    this.logger.info(`失敗: ${failedTests}`);
    this.logger.info(
      `成功率: ${((successfulTests / totalTests) * 100).toFixed(1)}%`,
    );
    this.logger.info("-".repeat(50));

    for (const result of this.testResults) {
      const status = result.success ? "✅ 成功" : "❌ 失敗";
      this.logger.info(
        `${status} ${result.scenario} (${result.responseTime}ms)`,
      );

      if (result.error) {
        this.logger.info(`  エラー: ${result.error}`);
      }

      if (result.response) {
        this.logger.info(`  応答: ${result.response}`);
      }
    }

    this.logger.info("=".repeat(50));
  }

  /**
   * テスト実行の成功判定
   */
  isAllTestsPassed(): boolean {
    return this.testResults.every((result) => result.success);
  }
}
