import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('HistoryManager', () => {
  let userDataDir = '';

  beforeEach(() => {
    vi.resetModules();
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'history-manager-'));
    vi.doMock('electron', () => ({
      app: {
        getPath: vi.fn((name: string) => {
          if (name === 'userData') {
            return userDataDir;
          }

          throw new Error(`Unexpected path lookup: ${name}`);
        }),
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock('electron');
    vi.resetModules();
    if (userDataDir) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  it('creates a safety backup before clearing conversation history', async () => {
    const storageDir = path.join(userDataDir, 'conversation-history');
    fs.mkdirSync(storageDir, { recursive: true });

    const entry = {
      id: 'entry-1',
      displayName: 'Example',
      createdAt: 1,
      endedAt: 2,
      workingDirectory: '/tmp/example',
      messageCount: 1,
      firstUserMessage: 'hello',
      lastUserMessage: 'hello',
      status: 'completed' as const,
      originalInstanceId: 'instance-1',
      sessionId: 'session-1',
    };

    const conversationData = {
      entry,
      messages: [
        {
          id: 'message-1',
          timestamp: 1,
          type: 'user',
          content: 'hello',
        },
      ],
    };

    fs.writeFileSync(
      path.join(storageDir, 'index.json'),
      JSON.stringify(
        {
          version: 1,
          lastUpdated: Date.now(),
          entries: [entry],
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(storageDir, `${entry.id}.json.gz`),
      zlib.gzipSync(JSON.stringify(conversationData))
    );

    const { HistoryManager } = await import('./history-manager');
    const manager = new HistoryManager();

    await manager.clearAll();

    const backupDirs = fs
      .readdirSync(userDataDir)
      .filter(name => name.startsWith('conversation-history.bak-'));

    expect(backupDirs).toHaveLength(1);

    const backupDir = path.join(userDataDir, backupDirs[0]);
    expect(fs.existsSync(path.join(backupDir, 'index.json'))).toBe(true);
    expect(fs.existsSync(path.join(backupDir, `${entry.id}.json.gz`))).toBe(true);

    const activeIndex = JSON.parse(
      fs.readFileSync(path.join(storageDir, 'index.json'), 'utf-8')
    ) as { entries: unknown[] };

    expect(activeIndex.entries).toEqual([]);
    expect(fs.existsSync(path.join(storageDir, `${entry.id}.json.gz`))).toBe(false);
  });

  it('archives a history entry without deleting the conversation file', async () => {
    const storageDir = path.join(userDataDir, 'conversation-history');
    fs.mkdirSync(storageDir, { recursive: true });

    const entry = {
      id: 'entry-archive',
      displayName: 'Archive me',
      createdAt: 10,
      endedAt: 20,
      workingDirectory: '/tmp/archive-me',
      messageCount: 2,
      firstUserMessage: 'hello',
      lastUserMessage: 'bye',
      status: 'completed' as const,
      originalInstanceId: 'instance-archive',
      parentId: null,
      sessionId: 'session-archive',
    };

    const conversationData = {
      entry,
      messages: [
        {
          id: 'message-1',
          timestamp: 10,
          type: 'user',
          content: 'hello',
        },
      ],
    };

    fs.writeFileSync(
      path.join(storageDir, 'index.json'),
      JSON.stringify(
        {
          version: 1,
          lastUpdated: Date.now(),
          entries: [entry],
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(storageDir, `${entry.id}.json.gz`),
      zlib.gzipSync(JSON.stringify(conversationData))
    );

    const { HistoryManager } = await import('./history-manager');
    const manager = new HistoryManager();

    await expect(manager.archiveEntry(entry.id)).resolves.toBe(true);

    const index = JSON.parse(
      fs.readFileSync(path.join(storageDir, 'index.json'), 'utf-8')
    ) as { entries: Array<{ archivedAt?: number | null }> };

    expect(index.entries[0]?.archivedAt).toEqual(expect.any(Number));
    expect(fs.existsSync(path.join(storageDir, `${entry.id}.json.gz`))).toBe(true);
  });
});
