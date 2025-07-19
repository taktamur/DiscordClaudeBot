export const CONFIG = {
  DISCORD_TOKEN: Deno.env.get("DISCORD_BOT_TOKEN") || "",
  CLAUDE_TIMEOUT_SECONDS: 1800,
  MAX_MESSAGE_LENGTH: 2000,
  MAX_HISTORY_MESSAGES: 50,
  RATE_LIMIT_MESSAGES_PER_SECOND: 5,
} as const;

export function validateConfig(): boolean {
  if (!CONFIG.DISCORD_TOKEN) {
    console.error("DISCORD_BOT_TOKEN environment variable is required");
    return false;
  }
  return true;
}