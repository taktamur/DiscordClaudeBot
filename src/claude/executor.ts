import { CONFIG } from "../config.ts";
import { Logger } from "../utils/logger.ts";

export class ClaudeExecutor {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  async execute(prompt: string): Promise<string> {
    this.logger.info("Executing Claude Code CLI");
    
    try {
      const cmd = new Deno.Command("claude", {
        args: ["-p", prompt],
        stdout: "piped",
        stderr: "piped",
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Claude execution timed out after ${CONFIG.CLAUDE_TIMEOUT_SECONDS} seconds`));
        }, CONFIG.CLAUDE_TIMEOUT_SECONDS * 1000);
      });

      const executionPromise = cmd.output();
      const result = await Promise.race([executionPromise, timeoutPromise]);

      const stdout = new TextDecoder().decode(result.stdout);
      const stderr = new TextDecoder().decode(result.stderr);

      if (!result.success) {
        this.logger.error(`Claude CLI failed: ${stderr}`);
        throw new Error(`Claude execution failed: ${stderr}`);
      }

      this.logger.info("Claude Code execution completed successfully");
      return stdout.trim();

    } catch (error) {
      this.logger.error(`Claude execution error: ${error}`);
      throw error;
    }
  }
}