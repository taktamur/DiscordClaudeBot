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
      const channel = msg.channel;
      const fetchedMessages = await this.fetchChannelMessages(channel, msg, CONFIG.MAX_HISTORY_MESSAGES);
      
      if (fetchedMessages.length > 0) {
        this.logger.info(`Fetched ${fetchedMessages.length} messages from history`);
        return {
          messages: fetchedMessages.map((m: Message) => ({
            author: m.author.username || m.author.tag || 'Unknown',
            content: m.content || '',
            timestamp: m.createdAt.toISOString(),
          }))
        };
      }
      
      // フォールバック: 現在のメッセージのみ
      this.logger.warn("Could not fetch history, using current message only");
      return this.createFallbackContext(msg);

    } catch (error) {
      this.logger.error(`Failed to fetch thread history: ${error}`);
      return this.createFallbackContext(msg);
    }
  }

  private async fetchChannelMessages(channel: any, currentMsg: Message, limit: number): Promise<Message[]> {
    // パターン1: fetchMessages with options object
    if (typeof channel.fetchMessages === 'function') {
      try {
        this.logger.debug("Trying fetchMessages with options object");
        const result = await channel.fetchMessages({
          limit: Math.min(limit, 100),
          before: currentMsg.id
        });
        
        if (result && typeof result.array === 'function') {
          const messages = result.array().reverse(); // 時系列順に並び替え
          messages.push(currentMsg); // 現在のメッセージを最後に追加
          return messages;
        }
      } catch (error) {
        this.logger.debug(`fetchMessages with options failed: ${error}`);
      }
    }

    // パターン2: fetchMessages with number parameter
    if (typeof channel.fetchMessages === 'function') {
      try {
        this.logger.debug("Trying fetchMessages with number parameter");
        const result = await channel.fetchMessages(Math.min(limit, 100));
        
        if (result && typeof result.array === 'function') {
          const messages = result.array().reverse();
          return messages.filter((m: Message) => m.id !== currentMsg.id).concat([currentMsg]);
        }
      } catch (error) {
        this.logger.debug(`fetchMessages with number failed: ${error}`);
      }
    }

    // パターン3: messages manager直接アクセス
    if (channel.messages && typeof channel.messages.fetch === 'function') {
      try {
        this.logger.debug("Trying messages.fetch");
        // 現在キャッシュされているメッセージを取得
        const cachedMessages = channel.messages.array?.() || [];
        if (cachedMessages.length > 0) {
          return cachedMessages.reverse().slice(0, limit);
        }
      } catch (error) {
        this.logger.debug(`messages.fetch failed: ${error}`);
      }
    }

    this.logger.warn("All message fetching methods failed");
    return [];
  }

  private createFallbackContext(msg: Message): ThreadContext {
    return {
      messages: [{
        author: msg.author.username || msg.author.tag || 'Unknown',
        content: msg.content || '',
        timestamp: msg.createdAt.toISOString(),
      }]
    };
  }

  buildPrompt(context: ThreadContext): string {
    const messageCount = context.messages.length;
    
    if (messageCount === 1) {
      // 単一メッセージの場合はシンプルなプロンプト
      const currentMessage = context.messages[0];
      return `Discordでメンションを受けました。以下のメッセージに適切に応答してください。

ユーザー: ${currentMessage.author}
メッセージ: ${currentMessage.content}
時刻: ${currentMessage.timestamp}

上記のメッセージに対して、適切な返答をしてください。`;
    }

    // 複数メッセージの場合は会話履歴として処理
    const messageHistory = context.messages
      .map((msg, index) => {
        const timeStr = this.formatTimestamp(msg.timestamp);
        const isLatest = index === context.messages.length - 1;
        const prefix = isLatest ? '→' : ' ';
        return `${prefix} [${timeStr}] ${msg.author}: ${msg.content}`;
      })
      .join('\n');

    return `以下はDiscordスレッドの会話履歴です（${messageCount}件のメッセージ）。最新のメッセージ（→印）に対して、会話の文脈を踏まえて適切に応答してください。

会話履歴:
${messageHistory}

会話の流れを理解して、最新のメッセージに対する適切な返答をしてください。`;
  }

  private formatTimestamp(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('ja-JP', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return isoString.split('T')[1]?.split('.')[0] || isoString;
    }
  }

  async sendResponse(msg: Message, response: string): Promise<void> {
    this.logger.info("Sending response to Discord");

    try {
      const mentionResponse = `<@${msg.author.id}> ${response}`;
      
      if (mentionResponse.length <= CONFIG.MAX_MESSAGE_LENGTH) {
        await msg.reply(mentionResponse);
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
      const prefix = i === 0 ? `<@${msg.author.id}> ` : "(続き) ";
      
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