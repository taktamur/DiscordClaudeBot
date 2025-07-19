/**
 * config.ts のユニットテスト
 * t_wadaさんの教えに従い、純粋関数的な部分を重点的にテスト
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { validateConfig } from "./config.ts";

Deno.test("validateConfig", async (t) => {
  await t.step(
    "環境変数DISCORD_BOT_TOKENが設定されている場合はtrueを返す",
    () => {
      // Arrange: 環境変数を一時的に設定
      const originalToken = Deno.env.get("DISCORD_BOT_TOKEN");
      Deno.env.set("DISCORD_BOT_TOKEN", "test-token-12345");

      // console.errorをモックして副作用を防ぐ
      const originalError = console.error;
      console.error = () => {}; // no-op

      try {
        // Act: 検証実行
        const result = validateConfig();

        // Assert: 結果確認
        assertEquals(result, true);
      } finally {
        // Cleanup: 環境変数とconsoleを元に戻す
        console.error = originalError;
        if (originalToken) {
          Deno.env.set("DISCORD_BOT_TOKEN", originalToken);
        } else {
          Deno.env.delete("DISCORD_BOT_TOKEN");
        }
      }
    },
  );

  await t.step(
    "環境変数DISCORD_BOT_TOKENが設定されていない場合はfalseを返す",
    () => {
      // Arrange: 環境変数を一時的に削除
      const originalToken = Deno.env.get("DISCORD_BOT_TOKEN");
      Deno.env.delete("DISCORD_BOT_TOKEN");

      // Act: 検証実行
      const result = validateConfig();

      // Assert: 結果確認
      assertEquals(result, false);

      // Cleanup: 環境変数を元に戻す
      if (originalToken) {
        Deno.env.set("DISCORD_BOT_TOKEN", originalToken);
      }
    },
  );

  await t.step("環境変数DISCORD_BOT_TOKENが空文字の場合はfalseを返す", () => {
    // Arrange: 環境変数を空文字に設定
    const originalToken = Deno.env.get("DISCORD_BOT_TOKEN");
    Deno.env.set("DISCORD_BOT_TOKEN", "");

    // Act: 検証実行
    const result = validateConfig();

    // Assert: 結果確認
    assertEquals(result, false);

    // Cleanup: 環境変数を元に戻す
    if (originalToken) {
      Deno.env.set("DISCORD_BOT_TOKEN", originalToken);
    } else {
      Deno.env.delete("DISCORD_BOT_TOKEN");
    }
  });
});

Deno.test("CONFIG値の検証", async (t) => {
  // 動的インポートで設定値をテスト時に取得
  await t.step("CONFIG定数が適切な型と値を持つ", async () => {
    const { CONFIG } = await import("./config.ts");

    // タイムアウト値は正の数であること
    assertEquals(typeof CONFIG.CLAUDE_TIMEOUT_SECONDS, "number");
    assertEquals(CONFIG.CLAUDE_TIMEOUT_SECONDS > 0, true);

    // メッセージ長制限はDiscordの制限以下であること
    assertEquals(typeof CONFIG.MAX_MESSAGE_LENGTH, "number");
    assertEquals(CONFIG.MAX_MESSAGE_LENGTH <= 2000, true);

    // 履歴メッセージ数は正の数であること
    assertEquals(typeof CONFIG.MAX_HISTORY_MESSAGES, "number");
    assertEquals(CONFIG.MAX_HISTORY_MESSAGES > 0, true);

    // レート制限は正の数であること
    assertEquals(typeof CONFIG.RATE_LIMIT_MESSAGES_PER_SECOND, "number");
    assertEquals(CONFIG.RATE_LIMIT_MESSAGES_PER_SECOND > 0, true);
  });
});
