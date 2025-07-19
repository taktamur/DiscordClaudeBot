import { CONFIG } from "../config.ts";
import { Logger } from "../utils/logger.ts";
import { CommandRunner } from "./command-runner.ts";
import { DenoCommandRunner } from "./deno-command-runner.ts";

/**
 * Claude Code CLI を実行するクラス
 * Discord から受け取ったプロンプトを Claude Code に渡し、結果を取得します
 */
export class ClaudeExecutor {
  private logger: Logger;
  private commandRunner: CommandRunner;

  /**
   * ClaudeExecutor のコンストラクタ
   * @param commandRunner コマンド実行部（省略時はDenoCommandRunnerを使用）
   */
  constructor(commandRunner?: CommandRunner) {
    this.logger = new Logger();
    this.commandRunner = commandRunner || new DenoCommandRunner();
  }

  /**
   * Claude Code CLI を実行してプロンプトに対する応答を取得
   * @param prompt Claude Code に送信するプロンプト
   * @returns Claude Code からの応答文字列
   * @throws Error 実行に失敗した場合やタイムアウトした場合
   */
  async execute(prompt: string): Promise<string> {
    this.logger.info("Claude Code CLIを実行中");
    this.logger.info(
      `送信プロンプト: ${prompt.substring(0, 200)}${
        prompt.length > 200 ? "..." : ""
      }`,
    );

    try {
      this.logger.info(
        `コマンド引数: ["--dangerously-skip-permissions", "-p", "プロンプト(${prompt.length}文字)"]`,
      );

      // タイムアウト処理を設定（30分）
      // 長時間の複雑な処理にも対応できるよう余裕を持った設定
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Claude execution timed out after ${CONFIG.CLAUDE_TIMEOUT_SECONDS} seconds`,
            ),
          );
        }, CONFIG.CLAUDE_TIMEOUT_SECONDS * 1000);
      });

      // Claude Code CLI コマンドを実行
      // --dangerously-skip-permissions: 権限確認をスキップ（自動実行のため）
      // -p: プロンプトを直接指定
      const executionPromise = this.commandRunner.execute("claude", [
        "--dangerously-skip-permissions",
        "-p",
        prompt,
      ], {
        stdout: "piped",
        stderr: "piped",
      });

      this.logger.info("Claude Code実行開始...");
      const result = await Promise.race([executionPromise, timeoutPromise]);
      this.logger.info("Claude Code実行完了");

      // 実行結果を文字列に変換
      const stdout = new TextDecoder().decode(result.stdout);
      const stderr = new TextDecoder().decode(result.stderr);

      // デバッグ用にstderrも出力（エラーでなくても警告等が出力される場合がある）
      if (stderr.trim()) {
        this.logger.info(`Claude CLI stderr: ${stderr.trim()}`);
      }

      // 実行結果をチェックしてエラーハンドリング
      if (!result.success) {
        this.logger.error(
          `Claude CLIが失敗しました (exit code: ${result.code}): ${stderr}`,
        );
        this.logger.error(`stdout: ${stdout}`);
        this.logger.error(`プロンプト長: ${prompt.length}`);
        throw new Error(`Claude execution failed: ${stderr}`);
      }

      this.logger.info("Claude Codeの実行が正常に完了しました");
      this.logger.info(
        `受信レスポンス: ${stdout.substring(0, 200)}${
          stdout.length > 200 ? "..." : ""
        }`,
      );

      // 空の応答の場合はエラーとして扱う
      const response = stdout.trim();
      if (!response) {
        this.logger.error("Claude Codeから空の応答を受信しました");
        throw new Error("Empty response from Claude Code");
      }

      return response;
    } catch (error) {
      this.logger.error(`Claude実行エラー: ${error}`);
      throw error;
    }
  }
}
