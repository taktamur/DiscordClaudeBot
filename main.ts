import { DiscordBot } from "./src/bot.ts";
import { validateConfig } from "./src/config.ts";
import { Logger } from "./src/utils/logger.ts";

const logger = new Logger();

function parseCommandLineArgs(): { timeoutSeconds?: number } {
  const timeoutIndex = Deno.args.indexOf('--timeout');
  const timeoutSeconds = timeoutIndex !== -1 ? 
    parseInt(Deno.args[timeoutIndex + 1]) : undefined;
  
  return { timeoutSeconds };
}

async function main(): Promise<void> {
  logger.info("Starting Discord Claude Bot");

  if (!validateConfig()) {
    logger.error("Configuration validation failed");
    Deno.exit(1);
  }

  const { timeoutSeconds } = parseCommandLineArgs();
  const bot = new DiscordBot();

  if (timeoutSeconds) {
    logger.info(`Setting timeout for ${timeoutSeconds} seconds`);
    setTimeout(() => {
      logger.info("Timeout reached, shutting down bot");
      bot.stop();
      Deno.exit(0);
    }, timeoutSeconds * 1000);
  }

  try {
    await bot.start();
    logger.info("Bot started successfully");
  } catch (error) {
    logger.error(`Failed to start bot: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    logger.error(`Unhandled error: ${error}`);
    Deno.exit(1);
  });
}