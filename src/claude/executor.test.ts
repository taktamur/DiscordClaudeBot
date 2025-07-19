/**
 * ClaudeExecutor のユニットテスト
 * t_wadaさんの教えに従い、外部依存（コマンド実行）をモックしてテスト
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { ClaudeExecutor } from "./executor.ts";
import { CommandResult, CommandRunner } from "./command-runner.ts";

// CommandRunnerのモック実装
class MockCommandRunner implements CommandRunner {
  constructor(private shouldSucceed: boolean = true) {}

  execute(): Promise<CommandResult> {
    // 即座に解決してタイマーリークを防ぐ
    return Promise.resolve({
      success: this.shouldSucceed,
      code: this.shouldSucceed ? 0 : 1,
      stdout: new TextEncoder().encode(
        this.shouldSucceed ? "テスト応答メッセージ" : "",
      ),
      stderr: new TextEncoder().encode(
        this.shouldSucceed ? "" : "Error: Command failed",
      ),
    });
  }
}

Deno.test("ClaudeExecutor.execute", async (t) => {
  await t.step("正常なプロンプトで成功応答を返す", async () => {
    // Arrange: MockCommandRunnerを使用
    const mockCommandRunner = new MockCommandRunner(true);
    const originalSetTimeout = globalThis.setTimeout;

    // setTimeoutもモックしてタイマーリークを防ぐ
    globalThis.setTimeout =
      // deno-lint-ignore no-explicit-any
      ((_cb: (...args: any[]) => void, _delay: number) => {
        // 即座に実行せず、単にIDを返す
        return 1;
      }) as typeof setTimeout;

    const executor = new ClaudeExecutor(mockCommandRunner);
    const testPrompt = "テストプロンプトです";

    // console出力をキャプチャ
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (message: string) => logs.push(message);

    try {
      // Act: Claude実行
      const result = await executor.execute(testPrompt);

      // Assert: 期待される応答が返される
      assertEquals(result, "テスト応答メッセージ");

      // ログが出力されている
      const hasExecutingLog = logs.some((log) =>
        log.includes("Claude Code CLIを実行中")
      );
      const hasCompletedLog = logs.some((log) =>
        log.includes("Claude Codeの実行が正常に完了しました")
      );
      assertEquals(hasExecutingLog, true);
      assertEquals(hasCompletedLog, true);
    } finally {
      // Cleanup: モックを元に戻す
      globalThis.setTimeout = originalSetTimeout;
      console.log = originalLog;
    }
  });

  await t.step("コマンド実行失敗時にエラーを投げる", async () => {
    // Arrange: 失敗するMockCommandRunnerを使用
    const mockCommandRunner = new MockCommandRunner(false);
    const originalSetTimeout = globalThis.setTimeout;

    // deno-lint-ignore no-explicit-any
    globalThis.setTimeout = ((_cb: (...args: any[]) => void, _delay: number) =>
      1) as typeof setTimeout;

    const executor = new ClaudeExecutor(mockCommandRunner);
    const testPrompt = "テストプロンプトです";

    // console出力をキャプチャ
    const originalError = console.error;
    const errors: string[] = [];
    console.error = (message: string) =>
      errors.push(message);

    try {
      // Act & Assert: エラーが投げられる
      await assertRejects(
        () => executor.execute(testPrompt),
        Error,
        "Claude execution failed: Error: Command failed",
      );

      // エラーログが出力されている
      const hasErrorLog = errors.some((error) =>
        error.includes("Claude CLIが失敗しました")
      );
      assertEquals(hasErrorLog, true);
    } finally {
      // Cleanup: モックを元に戻す
      globalThis.setTimeout = originalSetTimeout;
      console.error = originalError;
    }
  });

  await t.step("空のプロンプトでも正常に動作する", async () => {
    // Arrange: MockCommandRunnerを使用
    const mockCommandRunner = new MockCommandRunner(true);
    const originalSetTimeout = globalThis.setTimeout;

    // deno-lint-ignore no-explicit-any
    globalThis.setTimeout = ((_cb: (...args: any[]) => void, _delay: number) =>
      1) as typeof setTimeout;

    const executor = new ClaudeExecutor(mockCommandRunner);

    // console出力をキャプチャ
    const originalLog = console.log;
    console.log = () => {}; // no-op

    try {
      // Act: 空のプロンプトで実行
      const result = await executor.execute("");

      // Assert: エラーにならず応答が返される
      assertEquals(typeof result, "string");
    } finally {
      // Cleanup: モックを元に戻す
      globalThis.setTimeout = originalSetTimeout;
      console.log = originalLog;
    }
  });
});

// 注意: タイムアウトテストは複雑なので、今回は基本的な機能テストに集中
// 実際のプロダクションでは統合テストでタイムアウト動作を確認することを推奨
