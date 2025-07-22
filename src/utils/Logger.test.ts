/**
 * Logger のユニットテスト
 * t_wadaさんの教えに従い、副作用（console出力）をスパイでテスト
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { Logger } from "./Logger.ts";

// console出力をキャプチャするためのスパイ関数
function createConsoleSpies() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalDebug = console.debug;

  const logs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const debugs: string[] = [];

  console.log = (message: string) => logs.push(message);
  console.error = (message: string) => errors.push(message);
  console.warn = (message: string) => warnings.push(message);
  console.debug = (message: string) => debugs.push(message);

  return {
    logs,
    errors,
    warnings,
    debugs,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.debug = originalDebug;
    },
  };
}

Deno.test("Logger.info", async (t) => {
  await t.step("適切なフォーマットでINFOログを出力する", () => {
    // Arrange: スパイを設定
    const spies = createConsoleSpies();
    const logger = new Logger();
    const testMessage = "テスト情報メッセージ";

    try {
      // Act: ログ出力
      logger.info(testMessage);

      // Assert: 適切にログが出力される
      assertEquals(spies.logs.length, 1);
      const logOutput = spies.logs[0];

      // タイムスタンプフォーマットチェック
      assertEquals(logOutput.includes("INFO:"), true);
      assertEquals(logOutput.includes(testMessage), true);

      // ISO形式のタイムスタンプが含まれているかチェック
      const timestampRegex = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
      assertEquals(timestampRegex.test(logOutput), true);
    } finally {
      spies.restore();
    }
  });
});

Deno.test("Logger.error", async (t) => {
  await t.step("適切なフォーマットでERRORログを出力する", () => {
    // Arrange: スパイを設定
    const spies = createConsoleSpies();
    const logger = new Logger();
    const testMessage = "テストエラーメッセージ";

    try {
      // Act: ログ出力
      logger.error(testMessage);

      // Assert: 適切にログが出力される
      assertEquals(spies.errors.length, 1);
      const logOutput = spies.errors[0];

      assertEquals(logOutput.includes("ERROR:"), true);
      assertEquals(logOutput.includes(testMessage), true);
    } finally {
      spies.restore();
    }
  });
});

Deno.test("Logger.warn", async (t) => {
  await t.step("適切なフォーマットでWARNログを出力する", () => {
    // Arrange: スパイを設定
    const spies = createConsoleSpies();
    const logger = new Logger();
    const testMessage = "テスト警告メッセージ";

    try {
      // Act: ログ出力
      logger.warn(testMessage);

      // Assert: 適切にログが出力される
      assertEquals(spies.warnings.length, 1);
      const logOutput = spies.warnings[0];

      assertEquals(logOutput.includes("WARN:"), true);
      assertEquals(logOutput.includes(testMessage), true);
    } finally {
      spies.restore();
    }
  });
});

Deno.test("Logger.debug", async (t) => {
  await t.step("適切なフォーマットでDEBUGログを出力する", () => {
    // Arrange: スパイを設定
    const spies = createConsoleSpies();
    const logger = new Logger();
    const testMessage = "テストデバッグメッセージ";

    try {
      // Act: ログ出力
      logger.debug(testMessage);

      // Assert: 適切にログが出力される
      assertEquals(spies.debugs.length, 1);
      const logOutput = spies.debugs[0];

      assertEquals(logOutput.includes("DEBUG:"), true);
      assertEquals(logOutput.includes(testMessage), true);
    } finally {
      spies.restore();
    }
  });
});

Deno.test("Logger.formatTimestamp (private method testing)", async (t) => {
  await t.step("現在時刻のISO文字列が返される", () => {
    // Arrange: Loggerインスタンス
    const logger = new Logger();
    // deno-lint-ignore no-explicit-any
    const formatTimestamp = (logger as any).formatTimestamp.bind(logger);

    // Act: タイムスタンプフォーマット
    const timestamp = formatTimestamp();

    // Assert: ISO形式の文字列であること
    assertEquals(typeof timestamp, "string");

    // ISO形式かチェック
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    assertEquals(isoRegex.test(timestamp), true);

    // 実際にDateオブジェクトとしてパースできること
    const parsedDate = new Date(timestamp);
    assertEquals(isNaN(parsedDate.getTime()), false);
  });
});

Deno.test("Logger複数呼び出しテスト", async (t) => {
  await t.step("複数のログレベルを連続で呼び出しても正しく動作する", () => {
    // Arrange: スパイを設定
    const spies = createConsoleSpies();
    const logger = new Logger();

    try {
      // Act: 複数のログを出力
      logger.info("情報1");
      logger.warn("警告1");
      logger.error("エラー1");
      logger.debug("デバッグ1");
      logger.info("情報2");

      // Assert: 各レベルで適切に出力される
      assertEquals(spies.logs.length, 2);
      assertEquals(spies.warnings.length, 1);
      assertEquals(spies.errors.length, 1);
      assertEquals(spies.debugs.length, 1);

      // 順序が保たれていることを確認
      assertEquals(spies.logs[0].includes("情報1"), true);
      assertEquals(spies.logs[1].includes("情報2"), true);
    } finally {
      spies.restore();
    }
  });
});
