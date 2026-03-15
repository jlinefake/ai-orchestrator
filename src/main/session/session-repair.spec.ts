import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateTranscript, cleanupOrphanedTmpFiles, repairFile } from './session-repair';
import type { ConversationEntry } from './session-continuity';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('validateTranscript', () => {
  function entry(overrides: Partial<ConversationEntry> & { role: ConversationEntry['role'] }): ConversationEntry {
    return {
      id: `test-${Math.random().toString(36).slice(2)}`,
      content: 'test content',
      timestamp: Date.now(),
      ...overrides,
    };
  }

  it('returns ok for a valid transcript', () => {
    const history = [
      entry({ role: 'user', content: 'hello' }),
      entry({ role: 'assistant', content: 'hi' }),
    ];
    const result = validateTranscript(history);
    expect(result.status).toBe('ok');
    expect(result.repairs).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
  });

  it('inserts synthetic tool_result for orphaned tool_use', () => {
    const history = [
      entry({ role: 'user', content: 'do something' }),
      entry({
        role: 'assistant',
        content: 'calling tool',
        toolUse: { toolName: 'bash', input: { cmd: 'ls' } },
      }),
    ];
    const result = validateTranscript(history);
    expect(result.status).toBe('repaired');
    expect(result.entries).toHaveLength(3);
    expect(result.entries[2].role).toBe('tool');
    expect(result.entries[2].content).toContain('interrupted');
    expect(result.repairs).toEqual(
      expect.arrayContaining([expect.stringContaining('orphaned')])
    );
  });

  it('does not insert synthetic result when tool_result follows', () => {
    const history = [
      entry({
        role: 'assistant',
        content: 'calling tool',
        toolUse: { toolName: 'bash', input: { cmd: 'ls' } },
      }),
      entry({ role: 'tool', content: 'file1.ts\nfile2.ts' }),
    ];
    const result = validateTranscript(history);
    expect(result.status).toBe('ok');
    expect(result.entries).toHaveLength(2);
  });

  it('removes empty entries with no tool_use', () => {
    const history = [
      entry({ role: 'user', content: 'hello' }),
      entry({ role: 'assistant', content: '' }),
      entry({ role: 'assistant', content: 'real response' }),
    ];
    const result = validateTranscript(history);
    expect(result.status).toBe('repaired');
    expect(result.entries).toHaveLength(2);
    expect(result.repairs).toEqual(
      expect.arrayContaining([expect.stringContaining('empty')])
    );
  });

  it('keeps entries with tool_use even if content is empty', () => {
    const history = [
      entry({
        role: 'assistant',
        content: '',
        toolUse: { toolName: 'read', input: { path: '/foo' } },
      }),
      entry({ role: 'tool', content: 'file contents' }),
    ];
    const result = validateTranscript(history);
    expect(result.entries).toHaveLength(2);
  });

  it('warns on non-monotonic timestamps without removing', () => {
    const now = Date.now();
    const history = [
      entry({ role: 'user', content: 'a', timestamp: now }),
      entry({ role: 'assistant', content: 'b', timestamp: now - 5000 }),
    ];
    const result = validateTranscript(history);
    expect(result.status).toBe('repaired');
    expect(result.entries).toHaveLength(2);
    expect(result.repairs).toEqual(
      expect.arrayContaining([expect.stringContaining('Non-monotonic')])
    );
  });

  it('does not mutate the input array', () => {
    const history = [
      entry({
        role: 'assistant',
        content: 'tool call',
        toolUse: { toolName: 'bash', input: {} },
      }),
    ];
    const originalLength = history.length;
    validateTranscript(history);
    expect(history).toHaveLength(originalLength);
  });

  it('handles empty history', () => {
    const result = validateTranscript([]);
    expect(result.status).toBe('ok');
    expect(result.entries).toHaveLength(0);
  });
});

describe('cleanupOrphanedTmpFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'repair-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('deletes .tmp when corresponding .json exists', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'state.json'), '{"valid": true}');
    await fs.promises.writeFile(path.join(tmpDir, 'state.json.tmp'), '{"partial": true}');

    const result = await cleanupOrphanedTmpFiles(tmpDir);
    expect(result.deleted).toHaveLength(1);
    expect(result.recovered).toHaveLength(0);

    const files = await fs.promises.readdir(tmpDir);
    expect(files).toEqual(['state.json']);
  });

  it('promotes .tmp to .json when .json is missing', async () => {
    await fs.promises.writeFile(path.join(tmpDir, 'orphan.json.tmp'), '{"recovered": true}');

    const result = await cleanupOrphanedTmpFiles(tmpDir);
    expect(result.recovered).toHaveLength(1);
    expect(result.deleted).toHaveLength(0);

    const files = await fs.promises.readdir(tmpDir);
    expect(files).toEqual(['orphan.json']);
  });

  it('handles empty directory', async () => {
    const result = await cleanupOrphanedTmpFiles(tmpDir);
    expect(result.recovered).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });
});

describe('repairFile', () => {
  let tmpDir: string;
  let quarantineDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'repair-file-'));
    quarantineDir = path.join(tmpDir, 'quarantine');
    await fs.promises.mkdir(quarantineDir);
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns ok for valid JSON file', () => {
    const filePath = path.join(tmpDir, 'good.json');
    fs.writeFileSync(filePath, JSON.stringify({ encrypted: false, data: '{"valid":true}' }));
    const result = repairFile(filePath, quarantineDir);
    expect(result.status).toBe('ok');
  });

  it('repairs outer JSON with trailing garbage', () => {
    const filePath = path.join(tmpDir, 'outer-truncated.json');
    const payload = JSON.stringify({ encrypted: false, data: '{"valid":true}' });
    fs.writeFileSync(filePath, `${payload} trailing`);

    const result = repairFile(filePath, quarantineDir);

    expect(result.status).toBe('repaired');
    const repaired = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { data: string };
    expect(JSON.parse(repaired.data)).toEqual({ valid: true });
  });

  it('repairs truncated inner JSON data', () => {
    const filePath = path.join(tmpDir, 'inner-truncated.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({ encrypted: false, data: '{"valid":true' })
    );

    const result = repairFile(filePath, quarantineDir);

    expect(result.status).toBe('repaired');
    const repaired = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { data: string };
    expect(JSON.parse(repaired.data)).toEqual({ valid: true });
  });

  it('returns ok for encrypted envelope without quarantining the file', () => {
    const filePath = path.join(tmpDir, 'encrypted.json');
    fs.writeFileSync(filePath, JSON.stringify({ encrypted: true, data: 'ZmFrZS1lbmNyeXB0ZWQtZGF0YQ==' }));
    const result = repairFile(filePath, quarantineDir);
    expect(result.status).toBe('ok');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('quarantines unrecoverable file', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(filePath, 'this is not json at all {{{{');
    const result = repairFile(filePath, quarantineDir);
    expect(result.status).toBe('quarantined');
    expect(result.quarantinedPath).toBeTruthy();
    expect(path.basename(result.quarantinedPath!)).toMatch(/^bad\.json\.\d+\.corrupt$/);
    expect(fs.existsSync(filePath)).toBe(false);
    expect(fs.existsSync(result.quarantinedPath!)).toBe(true);
  });

  it('quarantines file with valid envelope but corrupt inner data', () => {
    const filePath = path.join(tmpDir, 'partial.json');
    fs.writeFileSync(filePath, JSON.stringify({ encrypted: false, data: '{invalid json' }));
    const result = repairFile(filePath, quarantineDir);
    expect(['quarantined', 'unrecoverable']).toContain(result.status);
  });
});
