/**
 * ClaudeExecutor のユニットテスト
 * t_wadaさんの教えに従い、外部依存（コマンド実行）をモックしてテスト
 * このテストでは、Loggerへの出力は考慮しない。
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { ClaudeExecutor } from "./ClaudeExecutor.ts";
import { Logger } from "../utils/Logger.ts";

const mockLogger = {
  info: (() => {}),
  warn: (() => {}),
  error: (() => {}),
  debug: (() => {}),
  formatTimestamp: () => "2025-07-22T12:00:00.000Z",
} as unknown as Logger;

// Deno.Commandをモックするためのヘルパー
class MockCommand {
  // deno-lint-ignore no-explicit-any
  constructor(public command: string, public options: any) {}

  output(): Promise<{
    success: boolean;
    stdout: Uint8Array;
    stderr: Uint8Array;
  }> {
    // 即座に解決してタイマーリークを防ぐ
    return Promise.resolve({
      success: true,
      stdout: new TextEncoder().encode("テスト応答メッセージ"),
      stderr: new TextEncoder().encode(""),
    });
  }
}

class MockFailedCommand {
  // deno-lint-ignore no-explicit-any
  constructor(public command: string, public options: any) {}

  output(): Promise<{
    success: boolean;
    stdout: Uint8Array;
    stderr: Uint8Array;
  }> {
    // 即座に解決してタイマーリークを防ぐ
    return Promise.resolve({
      success: false,
      stdout: new TextEncoder().encode(""),
      stderr: new TextEncoder().encode("Error: Command failed"),
    });
  }
}

Deno.test("ClaudeExecutor.execute", async (t) => {
  await t.step("正常なプロンプトで成功応答を返す", async () => {
    // Arrange: Deno.Commandをモック
    const originalCommand = Deno.Command;
    const originalSetTimeout = globalThis.setTimeout;

    // @ts-ignore テスト用のモック
    Deno.Command = MockCommand;

    // setTimeoutもモックしてタイマーリークを防ぐ
    globalThis.setTimeout =
      // deno-lint-ignore no-explicit-any
      ((_cb: (...args: any[]) => void, _delay: number) => {
        // 即座に実行せず、単にIDを返す
        return 1;
      }) as typeof setTimeout;

    const executor = new ClaudeExecutor(mockLogger);
    const testPrompt = "テストプロンプトです";

    try {
      // Act: Claude実行
      const result = await executor.execute(testPrompt);

      // Assert: 期待される応答が返される
      assertEquals(result, "テスト応答メッセージ");
    } finally {
      // Cleanup: モックを元に戻す
      Deno.Command = originalCommand;
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  await t.step("コマンド実行失敗時にエラーを投げる", async () => {
    // Arrange: 失敗するコマンドをモック
    const originalCommand = Deno.Command;
    const originalSetTimeout = globalThis.setTimeout;

    // @ts-ignore テスト用のモック
    Deno.Command = MockFailedCommand;
    // deno-lint-ignore no-explicit-any
    globalThis.setTimeout = ((_cb: (...args: any[]) => void, _delay: number) =>
      1) as typeof setTimeout;

    const executor = new ClaudeExecutor(mockLogger);
    const testPrompt = "テストプロンプトです";

    try {
      // Act & Assert: エラーが投げられる
      await assertRejects(
        () =>
          executor.execute(testPrompt),
        Error,
        "Claude CLI error: Error: Command failed",
      );
    } finally {
      // Cleanup: モックを元に戻す
      Deno.Command = originalCommand;
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  await t.step("空のプロンプトでも正常に動作する", async () => {
    // Arrange: Deno.Commandをモック
    const originalCommand = Deno.Command;
    const originalSetTimeout = globalThis.setTimeout;

    // @ts-ignore テスト用のモック
    Deno.Command = MockCommand;
    // deno-lint-ignore no-explicit-any
    globalThis.setTimeout = ((_cb: (...args: any[]) => void, _delay: number) =>
      1) as typeof setTimeout;

    const executor = new ClaudeExecutor(mockLogger);

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
      Deno.Command = originalCommand;
      globalThis.setTimeout = originalSetTimeout;
      console.log = originalLog;
    }
  });
});

// 注意: タイムアウトテストは複雑なので、今回は基本的な機能テストに集中
// 実際のプロダクションでは統合テストでタイムアウト動作を確認することを推奨
