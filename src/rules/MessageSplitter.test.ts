import { assertEquals } from "../../deps.ts";
import { MessageSplitter } from "../rules/MessageSplitter.ts";

Deno.test("MessageSplitter - 短いメッセージは分割されない", () => {
  const message = "Hello, world!";
  const result = MessageSplitter.split(message);

  assertEquals(result.length, 1);
  assertEquals(result[0], "Hello, world!");
});

Deno.test("MessageSplitter - 制限を超える長いメッセージが分割される", () => {
  const longMessage = "A".repeat(3000);
  const result = MessageSplitter.split(longMessage, 2000);

  assertEquals(result.length, 2);
  assertEquals(result[0].length, 2000);
  assertEquals(result[1].length, 1000);
});

Deno.test("MessageSplitter - 複数行メッセージが適切に分割される", () => {
  const lines = Array.from(
    { length: 100 },
    (_, i) => `Line ${i + 1}: ${"x".repeat(30)}`,
  );
  const message = lines.join("\\n");
  const result = MessageSplitter.split(message, 2000);

  assertEquals(result.length > 1, true);
  result.forEach((chunk) => {
    assertEquals(chunk.length <= 2000, true);
  });
});

Deno.test("MessageSplitter - 非常に長い単一行が単語単位で分割される", () => {
  const words = Array.from({ length: 200 }, (_, i) => `word${i}`);
  const message = words.join(" ");
  const result = MessageSplitter.split(message, 500);

  assertEquals(result.length > 1, true);
  result.forEach((chunk) => {
    assertEquals(chunk.length <= 500, true);
  });
});

Deno.test("MessageSplitter - 空メッセージの処理", () => {
  const result = MessageSplitter.split("");
  assertEquals(result.length, 0);
});

Deno.test("MessageSplitter - 改行のみのメッセージの処理", () => {
  const result = MessageSplitter.split("\n\n\n");
  assertEquals(result.length, 0);
});

Deno.test("MessageSplitter - カスタム制限値での分割", () => {
  const message = "A".repeat(150);
  const result = MessageSplitter.split(message, 100);

  assertEquals(result.length, 2);
  assertEquals(result[0].length, 100);
  assertEquals(result[1].length, 50);
});
