/**
 * PromptBuilder のユニットテスト
 * t_wadaさんの教えに従い、純粋関数的な部分を重点的にテスト
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { PromptBuilder } from "./PromptBuilder.ts";
import { ThreadContext } from "../types/discord.ts";

Deno.test("PromptBuilder.buildPrompt", async (t) => {
  const promptBuilder = new PromptBuilder();

  await t.step("単一メッセージの場合、シンプルなプロンプトを生成する", () => {
    // Arrange: 単一メッセージのコンテキスト
    const context: ThreadContext = {
      messages: [{
        author: "testuser",
        content: "こんにちは、ボット！",
        timestamp: "2024-01-01T12:00:00.000Z",
      }],
    };

    // Act: プロンプト構築
    const prompt = promptBuilder.buildPrompt(context);

    // Assert: 期待される形式であること
    assertEquals(prompt.includes("Discordでメンションを受けました"), true);
    assertEquals(prompt.includes("testuser"), true);
    assertEquals(prompt.includes("こんにちは、ボット！"), true);
    assertEquals(prompt.includes("2024-01-01T12:00:00.000Z"), true);
  });

  await t.step(
    "複数メッセージの場合、会話履歴形式のプロンプトを生成する",
    () => {
      // Arrange: 複数メッセージのコンテキスト
      const context: ThreadContext = {
        messages: [
          {
            author: "user1",
            content: "最初のメッセージ",
            timestamp: "2024-01-01T12:00:00.000Z",
          },
          {
            author: "user2",
            content: "返答メッセージ",
            timestamp: "2024-01-01T12:01:00.000Z",
          },
          {
            author: "user1",
            content: "最新のメッセージ",
            timestamp: "2024-01-01T12:02:00.000Z",
          },
        ],
      };

      // Act: プロンプト構築
      const prompt = promptBuilder.buildPrompt(context);

      // Assert: 期待される形式であること
      assertEquals(prompt.includes("Discordスレッドの会話履歴"), true);
      assertEquals(prompt.includes("3件のメッセージ"), true);
      assertEquals(prompt.includes("→"), true); // 最新メッセージのマーカー
      assertEquals(prompt.includes("最初のメッセージ"), true);
      assertEquals(prompt.includes("最新のメッセージ"), true);
    },
  );

  await t.step("空のメッセージでもエラーにならない", () => {
    // Arrange: 空のコンテンツを含むコンテキスト
    const context: ThreadContext = {
      messages: [{
        author: "testuser",
        content: "",
        timestamp: "2024-01-01T12:00:00.000Z",
      }],
    };

    // Act: プロンプト構築
    const prompt = promptBuilder.buildPrompt(context);

    // Assert: エラーにならずプロンプトが生成されること
    assertEquals(typeof prompt, "string");
    assertEquals(prompt.length > 0, true);
  });
});

Deno.test("PromptBuilder.formatTimestamp (private method testing)", async (t) => {
  const promptBuilder = new PromptBuilder();
  // deno-lint-ignore no-explicit-any
  const formatTimestamp = (promptBuilder as any).formatTimestamp.bind(
    promptBuilder,
  );

  await t.step("有効なISO文字列を日本時間形式に変換する", () => {
    // Arrange: 有効なISO文字列
    const isoString = "2024-01-01T12:30:45.000Z";

    // Act: フォーマット実行
    const result = formatTimestamp(isoString);

    // Assert: HH:MM形式であること
    assertEquals(/^\d{2}:\d{2}$/.test(result), true);
  });

  await t.step("無効な文字列の場合はフォールバック処理される", () => {
    // Arrange: 無効な文字列
    const invalidString = "invalid-timestamp";

    // Act: フォーマット実行
    const result = formatTimestamp(invalidString);

    // Assert: エラーにならず、何らかの文字列が返される
    assertEquals(typeof result, "string");
  });
});
