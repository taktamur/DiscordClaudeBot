/**
 * MessageProcessor のユニットテスト
 * t_wadaさんの教えに従い、純粋関数的な部分を重点的にテスト
 * 副作用のある部分はモックを使用
 */

import {
  assertEquals,
  assertRejects,
  assertSpyCall,
  assertSpyCalls,
  spy,
} from "../../deps.ts";
import type { Message } from "../../deps.ts";
import { MessageProcessor } from "./MessageProcessor.ts";
import { Logger } from "../utils/Logger.ts";

// テスト用のシンプルなmockLogger（空の関数で構成）
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  formatTimestamp: () => "2025-07-22T12:00:00.000Z",
} as unknown as Logger;

Deno.test("MessageProcessor", async (t) => {
  await t.step("コンストラクタ", async (t) => {
    await t.step("正常にインスタンスが作成される", () => {
      const processor = new MessageProcessor(mockLogger);

      assertEquals(typeof processor, "object");
    });
  });

  await t.step("getThreadHistory", async (t) => {
    await t.step("正常なメッセージ履歴取得", async () => {
      const processor = new MessageProcessor(mockLogger);

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

      // spy()を使用したシンプルなモック作成
      const fetchMessagesSpy = spy(() =>
        Promise.resolve({
          array: () => fetchedMessages,
        })
      );

      const mockMessage = {
        id: "current-msg-id",
        content: "test message",
        author: { username: "testuser", tag: "testuser#1234", bot: false },
        createdAt: new Date("2025-07-22T12:00:00.000Z"),
        channel: {
          fetchMessages: fetchMessagesSpy,
        },
      } as unknown as Message;

      const result = await processor.getThreadHistory(mockMessage);

      // spy()でfetchMessages呼び出しを検証
      assertSpyCalls(fetchMessagesSpy, 1);
      assertSpyCall(fetchMessagesSpy, 0, {
        args: [{ limit: 50, before: "current-msg-id" }],
      });

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
      const processor = new MessageProcessor(mockLogger);

      // spy()を使用したエラーを投げるモック
      const fetchMessagesSpy = spy(() =>
        Promise.reject(new Error("API Error"))
      );

      const mockMessage = {
        id: "error-msg-id",
        content: "test message",
        author: { username: "testuser", tag: "testuser#1234", bot: false },
        createdAt: new Date("2025-07-22T12:00:00.000Z"),
        channel: {
          fetchMessages: fetchMessagesSpy,
        },
      } as unknown as Message;

      const result = await processor.getThreadHistory(mockMessage);

      // spy()でfetchMessages呼び出しを検証（エラーが発生しても呼び出される）
      assertSpyCalls(fetchMessagesSpy, 1);
      assertSpyCall(fetchMessagesSpy, 0, {
        args: [{ limit: 50, before: "error-msg-id" }],
      });

      // フォールバック: 現在のメッセージのみ
      assertEquals(result.messages.length, 1);
      assertEquals(result.messages[0].author, "testuser");
      assertEquals(result.messages[0].content, "test message");
    });

    await t.step("空の履歴でもフォールバック動作", async () => {
      const processor = new MessageProcessor(mockLogger);

      // spy()を使用した空配列を返すモック
      const fetchMessagesSpy = spy(() =>
        Promise.resolve({
          array: () => [],
        })
      );

      const mockMessage = {
        id: "empty-msg-id",
        content: "test message",
        author: { username: "testuser", tag: "testuser#1234", bot: false },
        createdAt: new Date("2025-07-22T12:00:00.000Z"),
        channel: {
          fetchMessages: fetchMessagesSpy,
        },
      } as unknown as Message;

      const result = await processor.getThreadHistory(mockMessage);

      // spy()でfetchMessages呼び出しを検証
      assertSpyCalls(fetchMessagesSpy, 1);
      assertSpyCall(fetchMessagesSpy, 0, {
        args: [{ limit: 50, before: "empty-msg-id" }],
      });

      // フォールバック: 現在のメッセージのみ
      assertEquals(result.messages.length, 1);
      assertEquals(result.messages[0].author, "testuser");
    });
  });

  await t.step("sendResponse", async (t) => {
    await t.step("単一チャンクの送信", async () => {
      const processor = new MessageProcessor(mockLogger);

      // spy()を使用したシンプルなモック作成
      const replySpy = spy(() => Promise.resolve());
      const mockMessage = {
        reply: replySpy,
      } as unknown as Message;

      const chunks = ["Hello, world!"];
      await processor.sendResponse(mockMessage, chunks);

      // spy()の標準アサーションを使用
      assertSpyCalls(replySpy, 1);
      assertSpyCall(replySpy, 0, { args: ["Hello, world!"] });
    });

    await t.step("複数チャンクの分割送信", async () => {
      const processor = new MessageProcessor(mockLogger);

      // spy()を使用したシンプルなモック作成
      const replySpy = spy(() => Promise.resolve());
      const sendSpy = spy(() => Promise.resolve());

      const mockMessage = {
        reply: replySpy,
        channel: {
          send: sendSpy,
        },
      } as unknown as Message;

      const chunks = [
        "First chunk of the message",
        "Second chunk continues here",
        "Third and final chunk",
      ];

      await processor.sendResponse(mockMessage, chunks);

      // spy()の標準アサーションで検証
      // 最初のチャンクはreply、残りはsend
      assertSpyCalls(replySpy, 1);
      assertSpyCall(replySpy, 0, { args: ["First chunk of the message"] });

      assertSpyCalls(sendSpy, 2);
      assertSpyCall(sendSpy, 0, {
        args: ["(続き) Second chunk continues here"],
      });
      assertSpyCall(sendSpy, 1, { args: ["(続き) Third and final chunk"] });
    });

    await t.step("空のチャンク配列でもエラーにならない", async () => {
      const processor = new MessageProcessor(mockLogger);

      // spy()を直接プロパティに設定（アサーション不要のため短縮化）
      const mockMessage = {
        reply: spy(() => Promise.resolve()),
        channel: {
          send: spy(() => Promise.resolve()),
        },
      } as unknown as Message;

      const chunks: string[] = [];

      // エラーが発生しないことを確認
      await processor.sendResponse(mockMessage, chunks);
    });

    await t.step("送信エラー時の例外処理", async () => {
      const processor = new MessageProcessor(mockLogger);

      // spy()を使用したエラーを投げるモック
      const replySpy = spy(() => Promise.reject(new Error("Network error")));
      const mockMessage = {
        reply: replySpy,
      } as unknown as Message;

      const chunks = ["Test message"];

      await assertRejects(
        () => processor.sendResponse(mockMessage, chunks),
        Error,
        "Network error",
      );

      // エラーが発生してもspy呼び出しは記録される
      assertSpyCalls(replySpy, 1);
      assertSpyCall(replySpy, 0, { args: ["Test message"] });
    });
  });
});
