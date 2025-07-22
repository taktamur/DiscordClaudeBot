import { assertEquals, assertExists } from "../../deps.ts";
import { MessageProcessingRules } from "./MessageProcessingRules.ts";
import { Logger } from "../utils/Logger.ts";
import { Message } from "../../deps.ts";

// モックMessage作成用のヘルパー関数
function createMockMessage(options: {
  id?: string;
  authorId?: string;
  authorBot?: boolean;
  content?: string;
  mentionedUsers?: string[];
}): Message {
  const {
    id = "test-message-id",
    authorId = "user-123",
    authorBot = false,
    content = "test message",
    mentionedUsers = [],
  } = options;

  return {
    id,
    author: {
      id: authorId,
      bot: authorBot,
    },
    content,
    mentions: {
      users: {
        has: (userId: string) => mentionedUsers.includes(userId),
        keys: () => mentionedUsers,
      },
    },
  } as unknown as Message;
}

Deno.test("MessageProcessingRules", async (t) => {
  const botId = "bot-123";
  const logger = new Logger();

  await t.step("コンストラクタ", async (t) => {
    await t.step("正常にインスタンスが作成される", () => {
      const rules = new MessageProcessingRules(botId, logger);
      assertExists(rules);
    });
  });

  await t.step("shouldProcess - 自分のメッセージ", async (t) => {
    const rules = new MessageProcessingRules(botId, logger);

    await t.step("自分のメッセージは処理しない", () => {
      const msg = createMockMessage({
        authorId: botId,
        content: "hello world",
      });

      const result = rules.shouldProcess(msg);
      assertEquals(result, false);
    });

    await t.step("他のユーザーのメッセージは処理対象", () => {
      const msg = createMockMessage({
        authorId: "other-user",
        content: `<@${botId}> hello`,
        mentionedUsers: [botId],
      });

      const result = rules.shouldProcess(msg);
      assertEquals(result, true);
    });
  });

  await t.step("shouldProcess - メンション検知", async (t) => {
    const rules = new MessageProcessingRules(botId, logger);

    await t.step("mentions.users.hasでメンション検知", () => {
      const msg = createMockMessage({
        authorId: "user-123",
        content: "hello bot",
        mentionedUsers: [botId],
      });

      const result = rules.shouldProcess(msg);
      assertEquals(result, true);
    });

    await t.step("文字列パターンでメンション検知", () => {
      const msg = createMockMessage({
        authorId: "user-123",
        content: `<@${botId}> hello world`,
        mentionedUsers: [], // mentions.usersには含まれていない
      });

      const result = rules.shouldProcess(msg);
      assertEquals(result, true);
    });

    await t.step("メンションなしは処理しない", () => {
      const msg = createMockMessage({
        authorId: "user-123",
        content: "hello world",
        mentionedUsers: [],
      });

      const result = rules.shouldProcess(msg);
      assertEquals(result, false);
    });
  });

  await t.step("updateBotId", async (t) => {
    await t.step("botIdが更新される", () => {
      const rules = new MessageProcessingRules("old-bot-id", logger);
      const newBotId = "new-bot-123";

      rules.updateBotId(newBotId);

      // 新しいbotIdで自分のメッセージ判定をテスト
      const msg = createMockMessage({
        authorId: newBotId,
        content: "test",
      });

      const result = rules.shouldProcess(msg);
      assertEquals(result, false); // 自分のメッセージなので処理しない
    });
  });
});
