import { beforeEach, describe, expect, it } from 'vitest';
import { DisplayItemProcessor } from './display-item-processor.service';
import type { OutputMessage } from '../../core/state/instance/instance.types';

function makeMsg(overrides: Partial<OutputMessage> = {}): OutputMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    type: 'assistant',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('DisplayItemProcessor', () => {
  let processor: DisplayItemProcessor;

  beforeEach(() => {
    processor = new DisplayItemProcessor();
  });

  it('should process a single message into a display item', () => {
    const msg = makeMsg();
    const items = processor.process([msg]);
    expect(items.length).toBe(1);
    expect(items[0].type).toBe('message');
    expect(items[0].message?.id).toBe(msg.id);
  });

  it('should group consecutive tool messages into a tool-group', () => {
    const msgs = [
      makeMsg({ type: 'tool_use', id: 'tu1' }),
      makeMsg({ type: 'tool_result', id: 'tr1' }),
    ];
    const items = processor.process(msgs);
    expect(items.length).toBe(1);
    expect(items[0].type).toBe('tool-group');
    expect(items[0].toolMessages?.length).toBe(2);
  });

  it('should collapse repeated identical messages', () => {
    const msgs = [
      makeMsg({ content: 'Error', type: 'system', id: 'e1' }),
      makeMsg({ content: 'Error', type: 'system', id: 'e2' }),
      makeMsg({ content: 'Error', type: 'system', id: 'e3' }),
    ];
    const items = processor.process(msgs);
    expect(items.length).toBe(1);
    expect(items[0].repeatCount).toBe(3);
  });

  it('should create thought-group for messages with thinking', () => {
    const msg = makeMsg({
      type: 'assistant',
      thinking: [{ id: 'think1', content: 'Let me think...', format: 'structured' }],
    });
    const items = processor.process([msg]);
    expect(items.length).toBe(1);
    expect(items[0].type).toBe('thought-group');
  });

  it('should incrementally append new messages', () => {
    const msg1 = makeMsg({ timestamp: 1000, content: 'First message' });
    processor.process([msg1]);

    const msg2 = makeMsg({ timestamp: 2000, content: 'Second message' });
    const items = processor.process([msg1, msg2]);
    expect(items.length).toBe(2);
  });

  it('should compute showHeader based on sender and time gap', () => {
    const now = Date.now();
    const msgs = [
      makeMsg({ type: 'assistant', timestamp: now, id: 'a1', content: 'Message one' }),
      makeMsg({ type: 'assistant', timestamp: now + 1000, id: 'a2', content: 'Message two' }),
      makeMsg({ type: 'assistant', timestamp: now + 200000, id: 'a3', content: 'Message three' }),
    ];
    const items = processor.process(msgs);
    expect(items[0].showHeader).toBe(true);
    expect(items[1].showHeader).toBe(false);
    expect(items[2].showHeader).toBe(true);
  });

  it('should reset on instance switch', () => {
    const msg1 = makeMsg({ id: 'a' });
    processor.process([msg1], 'instance-1');

    const msg2 = makeMsg({ id: 'b' });
    const items = processor.process([msg2], 'instance-2');
    expect(items.length).toBe(1);
    expect(items[0].message?.id).toBe('b');
  });

  it('should track newItemCount correctly', () => {
    const msg1 = makeMsg({ id: 'a' });
    processor.process([msg1]);
    expect(processor.newItemCount).toBe(1);

    const msg2 = makeMsg({ id: 'b' });
    processor.process([msg1, msg2]);
    expect(processor.newItemCount).toBe(1);
  });
});
