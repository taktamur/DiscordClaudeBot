import { Client, Message, GatewayIntents } from "../deps.ts";
import { CONFIG } from "./config.ts";
import { ClaudeExecutor } from "./claude/executor.ts";
import { MessageProcessor } from "./discord/message-processor.ts";
import { Logger } from "./utils/logger.ts";

export class DiscordBot {
  private client: Client;
  private claudeExecutor: ClaudeExecutor;
  private messageProcessor: MessageProcessor;
  private logger: Logger;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntents.GUILDS,
        GatewayIntents.GUILD_MESSAGES,
        GatewayIntents.MESSAGE_CONTENT,
      ],
    });
    this.claudeExecutor = new ClaudeExecutor();
    this.messageProcessor = new MessageProcessor();
    this.logger = new Logger();
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      this.logger.info(`Bot logged in as ${this.client.user?.username}`);
    });

    this.client.on('messageCreate', async (msg: Message) => {
      if (this.shouldProcessMessage(msg)) {
        await this.handleMention(msg);
      }
    });
  }

  private shouldProcessMessage(msg: Message): boolean {
    return !msg.author.bot && 
           msg.mentions.users.has(this.client.user?.id || "");
  }

  private async handleMention(msg: Message): Promise<void> {
    try {
      this.logger.info(`Processing mention from ${msg.author.username}`);
      
      const context = await this.messageProcessor.getThreadHistory(msg);
      const prompt = this.messageProcessor.buildPrompt(context);
      const response = await this.claudeExecutor.execute(prompt);
      
      await this.messageProcessor.sendResponse(msg, response);
      
    } catch (error) {
      this.logger.error(`Error processing mention: ${error}`);
      await msg.reply("エラーが発生しました。しばらく時間をおいて再度お試しください。");
    }
  }

  async start(): Promise<void> {
    await this.client.connect(CONFIG.DISCORD_TOKEN, [
      GatewayIntents.GUILDS,
      GatewayIntents.GUILD_MESSAGES,
      GatewayIntents.MESSAGE_CONTENT,
    ]);
  }

  async stop(): Promise<void> {
    await this.client.destroy();
  }
}