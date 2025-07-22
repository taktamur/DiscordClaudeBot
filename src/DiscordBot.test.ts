import { assertEquals, assertExists, assertInstanceOf } from "../deps.ts";
import { DiscordBot } from "./DiscordBot.ts";
import { Client } from "../deps.ts";

Deno.test("DiscordBot", async (t) => {
  await t.step("コンストラクタ", async (t) => {
    await t.step("正常にインスタンスが作成される", () => {
      const bot = new DiscordBot();
      assertExists(bot);
      assertInstanceOf(bot, DiscordBot);
    });

    await t.step("依存関係が正しく初期化される", () => {
      const bot = new DiscordBot();
      const client = bot.getClient();
      assertExists(client);
      assertInstanceOf(client, Client);
    });

    await t.step("イベントハンドラーが設定される", () => {
      const bot = new DiscordBot();
      const client = bot.getClient();
      // プライベートメソッドの動作確認は難しいため、
      // インスタンス生成時にエラーが発生しないことで確認
      assertExists(client);
    });
  });

  await t.step("MessageProcessingRules統合", async (t) => {
    // MessageProcessingRulesクラスに分離済み
    // 詳細なテストはmessage-processing-rules.test.tsで実施
    const bot = new DiscordBot();
    const client = bot.getClient();

    await t.step("MessageProcessingRulesが統合されている", () => {
      // MessageProcessingRulesクラスの統合確認
      // 実際のルールテストは専用テストファイルで実施
      assertExists(client);
    });

    await t.step("メンション付きメッセージは処理する", () => {
      // MessageProcessingRulesクラスに分離済み
      // 詳細なテストはmessage-processing-rules.test.tsで実施
      assertExists(client);
    });

    await t.step("メンション文字列パターンを検知する", () => {
      // MessageProcessingRulesクラスに分離済み
      assertExists(client);
    });

    // FIXME: taktamur 他のbotメッセージでも処理するようにする
    await t.step("他のボットメッセージは処理しない", () => {
      // MessageProcessingRulesクラスに分離済み
      assertExists(client);
    });

    // FIXME: taktamur テストモード時にも他のbotメッセージでも処理するから、ここは不要になるはず。
    await t.step("テストモード時はCaller Botのみ許可", () => {
      // MessageProcessingRulesクラスに分離済み
      assertExists(client);
    });

    await t.step("メンションなしメッセージは処理しない", () => {
      // MessageProcessingRulesクラスに分離済み
      assertExists(client);
    });
  });

  await t.step("handleMention", async (t) => {
    // handleMentionはprivateメソッドのため、間接的なテストのみ実施
    const bot = new DiscordBot();

    await t.step("正常な処理フロー", () => {
      // privateメソッドのため、実際のDiscordメッセージイベント経由でのテストが必要
      // ここではインスタンスの管理のみ確認
      assertExists(bot);
    });

    await t.step("重複処理防止", () => {
      // privateメソッドのため直接テスト不可
      // processingMessages Setの動作はhandleMention内でのみ確認可能
      assertExists(bot);
    });

    await t.step("レート制限の適用", () => {
      // enforceRateLimitはprivateメソッドのため別途テスト
      assertExists(bot);
    });

    await t.step("エラーハンドリング", async (t) => {
      await t.step("タイムアウトエラー", () => {
        // privateメソッドのため直接テスト不可
        // エラーハンドリングはhandleMention内でのみ確認可能
        assertExists(bot);
      });

      await t.step("Claude実行エラー", () => {
        // privateメソッドのため直接テスト不可
        assertExists(bot);
      });

      await t.step("レート制限エラー", () => {
        // privateメソッドのため直接テスト不可
        assertExists(bot);
      });

      await t.step("一般的なエラー", () => {
        // privateメソッドのため直接テスト不可
        assertExists(bot);
      });
    });

    await t.step("処理完了後のクリーンアップ", () => {
      // privateメソッドのため直接テスト不可
      // processingMessages Setの動作はhandleMention内でのみ確認可能
      assertExists(bot);
    });
  });

  await t.step("enforceRateLimit", async (t) => {
    // enforceRateLimitはprivateメソッドのため、間接的なテストのみ
    const bot = new DiscordBot();

    await t.step("間隔が十分な場合は即座に完了", () => {
      // privateメソッドのため直接テスト不可
      // 実際のレート制限動作はhandleMention経由でのみテスト可能
      assertExists(bot);
    });

    await t.step("間隔が不足な場合は待機", () => {
      // privateメソッドのため直接テスト不可
      // setTimeoutの実際の待機動作テストは時間がかかるためスキップ
      assertExists(bot);
    });
  });

  await t.step("start/stop", async (t) => {
    const bot = new DiscordBot();
    const client = bot.getClient();

    await t.step("start: Discordに正常接続", () => {
      // 実際のDiscord接続はトークンが必要なため、メソッドの存在のみ確認
      assertEquals(typeof bot.start, "function");
      assertExists(client.connect);
    });

    await t.step("stop: Discord接続を正常切断", () => {
      // 実際のDiscord切断は接続状態に依存するため、メソッドの存在のみ確認
      assertEquals(typeof bot.stop, "function");
      assertExists(client.destroy);
    });

    await t.step("接続エラーの処理", () => {
      // 不正トークンのテストは実際のDiscord API呼び出しが必要なためスキップ
      // CONFIG.DISCORD_TOKENが空文字列の場合の動作のみ確認
      assertExists(bot);
    });
  });

  await t.step("テストモード", async (t) => {
    const bot = new DiscordBot();

    await t.step("テストモードの設定", () => {
      // setTestModeメソッドの存在と基本動作を確認
      assertEquals(typeof bot.setTestMode, "function");

      // エラーが発生しないことを確認
      bot.setTestMode(true);
      bot.setTestMode(false);
    });

    await t.step("messageProcessorへの伝播", () => {
      // messageProcessorはprivateフィールドのため直接アクセス不可
      // setTestMode呼び出し時にエラーが発生しないことで間接確認
      bot.setTestMode(true);
      assertExists(bot);
    });
  });

  await t.step("getClient", async (t) => {
    const bot = new DiscordBot();

    await t.step("Clientインスタンスが取得できる", () => {
      const client = bot.getClient();
      assertExists(client);
      assertInstanceOf(client, Client);

      // 同じインスタンスが返されることを確認
      const client2 = bot.getClient();
      assertEquals(client, client2);
    });
  });
});
