import { CONFIG } from "../config.ts";
import { Logger } from "../utils/logger.ts";

/**
 * Claude Code CLI を実行するクラス
 * Discord から受け取ったプロンプトを Claude Code に渡し、結果を取得します
 */
export class ClaudeExecutor {
  private logger: Logger;

  /**
   * ClaudeExecutor のコンストラクタ
   * ログ出力用の Logger インスタンスを初期化します
   */
  constructor() {
    this.logger = new Logger();
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
      // Claude Code CLI コマンドを設定
      // --dangerously-skip-permissions: 権限確認をスキップ（自動実行のため）
      // -p: プロンプトを直接指定
      const cmd = new Deno.Command("claude", {
        args: ["--dangerously-skip-permissions", "-p", prompt],
        stdout: "piped",
        stderr: "piped",
      });

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

      // Claude Code の実行とタイムアウトを競合させる
      const executionPromise = cmd.output();
      const result = await Promise.race([executionPromise, timeoutPromise]);

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

        // より詳細なエラーメッセージを提供
        let errorMessage = "Claude CLI execution failed";
        if (
          stderr.includes("command not found") ||
          stderr.includes("No such file")
        ) {
          errorMessage =
            "Claude CLI command not found. Please install Claude CLI or check PATH.";
        } else if (stderr.includes("permission denied")) {
          errorMessage =
            "Permission denied. Please check Claude CLI permissions.";
        } else if (
          stderr.includes("network") || stderr.includes("connection")
        ) {
          errorMessage = "Network error. Please check internet connection.";
        } else if (stderr.includes("quota") || stderr.includes("limit")) {
          errorMessage =
            "Rate limit or quota exceeded. Please try again later.";
        } else if (stderr.trim()) {
          errorMessage = `Claude CLI error: ${stderr.trim()}`;
        }

        throw new Error(errorMessage);
      }

      this.logger.info("Claude Codeの実行が正常に完了しました");
      this.logger.info(
        `受信レスポンス: ${stdout.substring(0, 200)}${
          stdout.length > 200 ? "..." : ""
        }`,
      );
      return stdout.trim();
    } catch (error) {
      this.logger.error(`Claude実行エラー: ${error}`);
      throw error;
    }
  }
}
