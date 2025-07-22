/**
 * MessageProcessor のユニットテスト
 * t_wadaさんの教えに従い、純粋関数的な部分を重点的にテスト
 * 副作用のある部分はモックを使用
 */

import { assertEquals, assertRejects } from "../../deps.ts";
import type { Message } from "../../deps.ts";
import { MessageProcessor } from "./MessageProcessor.ts";
import { Logger } from "../utils/Logger.ts";

// テスト用モック関数とログの記録
interface MockCall {
  method: string;
  args: unknown[];
}

interface MockLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
  formatTimestamp: () => string;
  calls: MockCall[];
}

// テスト用のモックオブジェクト作成関数
function createMockLogger(): MockLogger {
  const calls: MockCall[] = [];
  return {
    info: (message: string) => calls.push({ method: "info", args: [message] }),
    warn: (message: string) => calls.push({ method: "warn", args: [message] }),
    error: (message: string) =>
      calls.push({ method: "error", args: [message] }),
    debug: (message: string) =>
      calls.push({ method: "debug", args: [message] }),
    formatTimestamp: () => "2025-07-22T12:00:00.000Z",
    calls,
  };
}

function createMockMessage(overrides: Partial<{
  id: string;
  content: string;
  author: { username?: string; tag?: string; bot: boolean };
  createdAt: Date;
  channel: {
    fetchMessages: (options: { limit: number; before: string }) => Promise<{
      array: () => unknown[];
    }>;
    send: (content: string) => Promise<void>;
  };
  reply: (content: string) => Promise<void>;
}> = {}) {
  return {
    id: overrides.id || "test-message-id",
    content: overrides.content || "test message",
    author: {
      username: overrides.author?.username || "testuser",
      tag: overrides.author?.tag || "testuser#1234",
      bot: overrides.author?.bot || false,
    },
    createdAt: overrides.createdAt || new Date("2025-07-22T12:00:00.000Z"),
    channel: overrides.channel || {
      fetchMessages: () =>
        Promise.resolve({
          array: () => [],
        }),
      send: () => Promise.resolve(),
    },
    reply: overrides.reply || (() => Promise.resolve()),
  };
}

Deno.test("MessageProcessor", async (t) => {
  await t.step("コンストラクタ", async (t) => {
    await t.step("正常にインスタンスが作成される", () => {
      const mockLogger = createMockLogger();
      const processor = new MessageProcessor(mockLogger as unknown as Logger);

      assertEquals(typeof processor, "object");
    });
  });

  await t.step("getThreadHistory", async (t) => {
    await t.step("正常なメッセージ履歴取得", async () => {
      const mockLogger = createMockLogger();
      const processor = new MessageProcessor(mockLogger as unknown as Logger);

      const fetchedMessages = [
        {
          id: "msg-1",
          content: "previous message",
          author: { username: "user1", tag: "user1#1234", bot: false },
          createdAt: new Date("2025-07-22T11:59:00.000Z"),
        },
        {
          id: "msg-2",
          content: "another message",
          author: { username: "user2", tag: "user2#5678", bot: false },
          createdAt: new Date("2025-07-22T11:59:30.000Z"),
        },
      ];

      const mockMessage = createMockMessage({
        channel: {
          fetchMessages: () =>
            Promise.resolve({
              array: () => fetchedMessages,
            }),
          send: () => Promise.resolve(),
        },
      });

      const result = await processor.getThreadHistory(
        mockMessage as unknown as Message,
      );

      // 履歴メッセージ + 現在のメッセージ = 3件
      assertEquals(result.messages.length, 3);
      // reverse()により古い順に並び、最後に現在のメッセージが追加される
      assertEquals(result.messages[0].author, "user2"); // より新しい履歴メッセージが最初
      assertEquals(result.messages[0].content, "another message");
      assertEquals(result.messages[1].author, "user1"); // より古い履歴メッセージが2番目
      assertEquals(result.messages[1].content, "previous message");
      assertEquals(result.messages[2].author, "testuser"); // 現在のメッセージが最後
      assertEquals(result.messages[2].content, "test message");
    });

    await t.step("メッセージ取得失敗時のフォールバック", async () => {
      const mockLogger = createMockLogger();
      const processor = new MessageProcessor(mockLogger as unknown as Logger);

      const mockMessage = createMockMessage({
        channel: {
          fetchMessages: () => Promise.reject(new Error("API Error")),
          send: () => Promise.resolve(),
        },
      });

      const result = await processor.getThreadHistory(
        mockMessage as unknown as Message,
      );

      // フォールバック: 現在のメッセージのみ
      assertEquals(result.messages.length, 1);
      assertEquals(result.messages[0].author, "testuser");
      assertEquals(result.messages[0].content, "test message");
    });

    await t.step("空の履歴でもフォールバック動作", async () => {
      const mockLogger = createMockLogger();
      const processor = new MessageProcessor(mockLogger as unknown as Logger);

      const mockMessage = createMockMessage({
        channel: {
          fetchMessages: () =>
            Promise.resolve({
              array: () => [],
            }),
          send: () => Promise.resolve(),
        },
      });

      const result = await processor.getThreadHistory(
        mockMessage as unknown as Message,
      );

      // フォールバック: 現在のメッセージのみ
      assertEquals(result.messages.length, 1);
      assertEquals(result.messages[0].author, "testuser");
    });
  });

  await t.step("sendResponse", async (t) => {
    await t.step("単一チャンクの送信", async () => {
      const mockLogger = createMockLogger();
      const processor = new MessageProcessor(mockLogger as unknown as Logger);

      const replyCalls: string[] = [];
      const mockMessage = createMockMessage({
        reply: (content: string) => {
          replyCalls.push(content);
          return Promise.resolve();
        },
      });

      const chunks = ["Hello, world!"];
      await processor.sendResponse(mockMessage as unknown as Message, chunks);

      assertEquals(replyCalls.length, 1);
      assertEquals(replyCalls[0], "Hello, world!");
    });

    await t.step("複数チャンクの分割送信", async () => {
      const mockLogger = createMockLogger();
      const processor = new MessageProcessor(mockLogger as unknown as Logger);

      const replyCalls: string[] = [];
      const sendCalls: string[] = [];

      const mockMessage = createMockMessage({
        reply: (content: string) => {
          replyCalls.push(content);
          return Promise.resolve();
        },
        channel: {
          fetchMessages: () => Promise.resolve({ array: () => [] }),
          send: (content: string) => {
            sendCalls.push(content);
            return Promise.resolve();
          },
        },
      });

      const chunks = [
        "First chunk of the message",
        "Second chunk continues here",
        "Third and final chunk",
      ];

      await processor.sendResponse(mockMessage as unknown as Message, chunks);

      // 最初のチャンクはreply、残りはsend
      assertEquals(replyCalls.length, 1);
      assertEquals(replyCalls[0], "First chunk of the message");

      assertEquals(sendCalls.length, 2);
      assertEquals(sendCalls[0], "(続き) Second chunk continues here");
      assertEquals(sendCalls[1], "(続き) Third and final chunk");
    });

    await t.step("空のチャンク配列でもエラーにならない", async () => {
      const mockLogger = createMockLogger();
      const processor = new MessageProcessor(mockLogger as unknown as Logger);

      const mockMessage = createMockMessage();
      const chunks: string[] = [];

      // エラーが発生しないことを確認
      await processor.sendResponse(mockMessage as unknown as Message, chunks);
    });

    await t.step("送信エラー時の例外処理", async () => {
      const mockLogger = createMockLogger();
      const processor = new MessageProcessor(mockLogger as unknown as Logger);

      const mockMessage = createMockMessage({
        reply: () => Promise.reject(new Error("Network error")),
      });

      const chunks = ["Test message"];

      await assertRejects(
        () => processor.sendResponse(mockMessage as unknown as Message, chunks),
        Error,
        "Network error",
      );
    });
  });

  await t.step("統合テスト", async (t) => {
    await t.step("履歴取得から送信までの完全なフロー", async () => {
      const mockLogger = createMockLogger();
      const processor = new MessageProcessor(mockLogger as unknown as Logger);

      const fetchedMessages = [
        {
          id: "hist-1",
          content: "historical message",
          author: {
            username: "history_user",
            tag: "history_user#9999",
            bot: false,
          },
          createdAt: new Date("2025-07-22T11:58:00.000Z"),
        },
      ];

      const replyCalls: string[] = [];
      const mockMessage = createMockMessage({
        content: "current message asking question",
        channel: {
          fetchMessages: () =>
            Promise.resolve({
              array: () => fetchedMessages,
            }),
          send: () => Promise.resolve(),
        },
        reply: (content: string) => {
          replyCalls.push(content);
          return Promise.resolve();
        },
      });

      // 1. 履歴取得
      const context = await processor.getThreadHistory(
        mockMessage as unknown as Message,
      );
      assertEquals(context.messages.length, 2); // 履歴 + 現在

      // 2. 応答送信
      const chunks = ["Response to the question"];
      await processor.sendResponse(mockMessage as unknown as Message, chunks);

      assertEquals(replyCalls.length, 1);
      assertEquals(replyCalls[0], "Response to the question");
    });
  });
});
