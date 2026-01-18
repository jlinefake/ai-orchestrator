/**
 * NDJSON Parser - Parses newline-delimited JSON stream from Claude CLI
 */

import type { CliStreamMessage } from '../../shared/types/cli.types';

export class NdjsonParser {
  private buffer: string = '';

  /**
   * Parse incoming chunk and return complete messages
   */
  parse(chunk: string): CliStreamMessage[] {
    this.buffer += chunk;
    const messages: CliStreamMessage[] = [];

    // Split by newlines and process complete lines
    const lines = this.buffer.split('\n');

    // Keep the last potentially incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed) as CliStreamMessage;
        parsed.timestamp = parsed.timestamp || Date.now();
        messages.push(parsed);
      } catch (error) {
        // Log parse errors but continue processing
        console.warn('Failed to parse NDJSON line:', trimmed, error);
      }
    }

    return messages;
  }

  /**
   * Flush any remaining buffer content
   */
  flush(): CliStreamMessage[] {
    if (!this.buffer.trim()) {
      this.buffer = '';
      return [];
    }

    try {
      const parsed = JSON.parse(this.buffer.trim()) as CliStreamMessage;
      parsed.timestamp = parsed.timestamp || Date.now();
      this.buffer = '';
      return [parsed];
    } catch {
      // Final content wasn't valid JSON
      console.warn('Discarding incomplete NDJSON buffer:', this.buffer);
      this.buffer = '';
      return [];
    }
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.buffer = '';
  }

  /**
   * Check if there's pending data in buffer
   */
  hasPendingData(): boolean {
    return this.buffer.trim().length > 0;
  }
}
