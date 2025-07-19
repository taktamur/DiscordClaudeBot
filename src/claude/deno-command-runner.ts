import {
  CommandOptions,
  CommandResult,
  CommandRunner,
} from "./command-runner.ts";

/**
 * Deno.Command を使用した CommandRunner の実装
 * 実際のシステムコマンドを実行する
 */
export class DenoCommandRunner implements CommandRunner {
  /**
   * コマンドを実行し、結果を返す
   * @param command 実行するコマンド名
   * @param args コマンド引数
   * @param options 実行オプション
   * @returns 実行結果
   */
  async execute(
    command: string,
    args: string[],
    options?: CommandOptions,
  ): Promise<CommandResult> {
    const cmd = new Deno.Command(command, {
      args,
      stdout: options?.stdout || "piped",
      stderr: options?.stderr || "piped",
      cwd: options?.cwd,
      env: options?.env,
    });

    const result = await cmd.output();

    return {
      success: result.success,
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}
