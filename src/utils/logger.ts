export class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  info(message: string): void {
    console.log(`[${this.formatTimestamp()}] INFO: ${message}`);
  }

  error(message: string): void {
    console.error(`[${this.formatTimestamp()}] ERROR: ${message}`);
  }

  warn(message: string): void {
    console.warn(`[${this.formatTimestamp()}] WARN: ${message}`);
  }

  debug(message: string): void {
    console.debug(`[${this.formatTimestamp()}] DEBUG: ${message}`);
  }
}