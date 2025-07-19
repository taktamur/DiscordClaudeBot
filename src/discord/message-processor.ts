import { Message } from "../../deps.ts";
import { CONFIG } from "../config.ts";
import { Logger } from "../utils/logger.ts";

export interface ThreadContext {
  messages: Array<{
    author: string;
    content: string;
    timestamp: string;
  }>;
}

export class MessageProcessor {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  async getThreadHistory(msg: Message): Promise<ThreadContext> {
    this.logger.info("Fetching thread history");
    
    try {
      // 現在のメッセージのみを含むシンプルなコンテキストとして処理
      const context: ThreadContext = {
        messages: [{
          author: msg.author.username,
          content: msg.content,
          timestamp: msg.createdAt.toISOString(),
        }]
      };

      this.logger.info(`Using current message as context`);
      return context;

    } catch (error) {
      this.logger.error(`Failed to fetch thread history: ${error}`);
      throw error;
    }
  }

  buildPrompt(context: ThreadContext): string {
    const messageHistory = context.messages
      .map(msg => `[${msg.timestamp}] ${msg.author}: ${msg.content}`)
      .join('\n');

    return `以下はDiscordスレッドの会話履歴です。この文脈を理解して、適切に応答してください。

会話履歴:
${messageHistory}

上記の会話の流れを踏まえて、適切な返答をしてください。`;
  }

  async sendResponse(msg: Message, response: string): Promise<void> {
    this.logger.info("Sending response to Discord");

    try {
      if (response.length <= CONFIG.MAX_MESSAGE_LENGTH) {
        await msg.reply(response);
      } else {
        await this.sendSplitMessage(msg, response);
      }
      
      this.logger.info("Response sent successfully");
      
    } catch (error) {
      this.logger.error(`Failed to send response: ${error}`);
      throw error;
    }
  }

  private async sendSplitMessage(msg: Message, response: string): Promise<void> {
    const chunks = this.splitMessage(response);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prefix = i === 0 ? "" : "(続き) ";
      
      if (i === 0) {
        await msg.reply(prefix + chunk);
      } else {
        await msg.channel.send(prefix + chunk);
      }
      
      await this.delay(1000 / CONFIG.RATE_LIMIT_MESSAGES_PER_SECOND);
    }
  }

  private splitMessage(message: string): string[] {
    const chunks: string[] = [];
    let currentChunk = "";
    
    const lines = message.split('\n');
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > CONFIG.MAX_MESSAGE_LENGTH) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        
        if (line.length > CONFIG.MAX_MESSAGE_LENGTH) {
          const words = line.split(' ');
          for (const word of words) {
            if (currentChunk.length + word.length + 1 > CONFIG.MAX_MESSAGE_LENGTH) {
              chunks.push(currentChunk.trim());
              currentChunk = word;
            } else {
              currentChunk += (currentChunk ? ' ' : '') + word;
            }
          }
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}