/**
 * Tests for IntelliJ MCP Terminal Streaming
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  initStreamDir,
  streamMessage,
  streamStatus,
  streamClaim,
  readStream,
  formatIntelliJCommand,
  MESSAGE_TYPES
} from '../lib/omega-stream.mjs';

const TEST_CHANNEL = 'test-channel';
const STREAM_DIR = '.omega-stream';

describe('IntelliJ Stream', () => {
  beforeEach(() => {
    // Clean up test files
    const testFile = join(STREAM_DIR, `${TEST_CHANNEL}.log`);
    if (existsSync(testFile)) {
      rmSync(testFile);
    }
  });

  afterEach(() => {
    // Clean up test files
    const testFile = join(STREAM_DIR, `${TEST_CHANNEL}.log`);
    if (existsSync(testFile)) {
      rmSync(testFile);
    }
  });

  describe('initStreamDir', () => {
    it('should create stream directory if not exists', () => {
      const dir = initStreamDir();
      assert.ok(existsSync(dir), 'Stream directory should exist');
    });
  });

  describe('streamMessage', () => {
    it('should stream a message to log file', () => {
      const result = streamMessage('test-agent', 'Hello world', { 
        channel: TEST_CHANNEL,
        compress: false 
      });
      
      assert.strictEqual(result.logged, true);
      assert.ok(result.file.includes(TEST_CHANNEL));
      assert.strictEqual(result.compressed, false);
    });

    it('should compress messages when compress=true', () => {
      const result = streamMessage('test-agent', 'Completed code review', { 
        channel: TEST_CHANNEL,
        compress: true 
      });
      
      assert.strictEqual(result.compressed, true);
      
      // Read the file and check compression happened
      const content = readFileSync(result.file, 'utf-8');
      assert.ok(content.includes('✅'), 'Should contain compressed symbol');
    });

    it('should append multiple messages', () => {
      streamMessage('agent-1', 'First message', { channel: TEST_CHANNEL, compress: false });
      streamMessage('agent-2', 'Second message', { channel: TEST_CHANNEL, compress: false });
      
      const stream = readStream(TEST_CHANNEL);
      assert.strictEqual(stream.count, 2);
    });
  });

  describe('readStream', () => {
    it('should return empty array for non-existent channel', () => {
      const stream = readStream('non-existent-channel');
      assert.strictEqual(stream.count, 0);
      assert.deepStrictEqual(stream.messages, []);
    });

    it('should parse Omega format messages correctly', () => {
      streamMessage('test-agent', 'Test message', { channel: TEST_CHANNEL, compress: false });

      const stream = readStream(TEST_CHANNEL);
      assert.strictEqual(stream.count, 1);
      // New format uses abbreviated agent ID (removes -agent suffix, max 8 chars)
      assert.strictEqual(stream.messages[0].author, 'test');
      assert.strictEqual(stream.messages[0].message, 'Test message');
      assert.strictEqual(stream.messages[0].type, 'cht');
      assert.ok(stream.messages[0].timestamp, 'Should have timestamp');
    });

    it('should limit messages returned', () => {
      for (let i = 0; i < 10; i++) {
        streamMessage('agent', `Message ${i}`, { channel: TEST_CHANNEL, compress: false });
      }

      const stream = readStream(TEST_CHANNEL, 5);
      assert.strictEqual(stream.count, 5);
      // Should get the last 5 messages
      assert.ok(stream.messages[0].message.includes('Message 5'));
    });
  });

  describe('formatIntelliJCommand', () => {
    it('should format command for IntelliJ MCP', () => {
      const cmd = formatIntelliJCommand('npm test');
      
      assert.strictEqual(cmd.tool, 'execute_terminal_command');
      assert.strictEqual(cmd.params.command, 'npm test');
      assert.strictEqual(cmd.params.executeInShell, true);
    });

    it('should accept custom options', () => {
      const cmd = formatIntelliJCommand('npm test', { 
        timeout: 60000, 
        maxLines: 200 
      });
      
      assert.strictEqual(cmd.params.timeout, 60000);
      assert.strictEqual(cmd.params.maxLinesCount, 200);
    });
  });

  describe('Omega Compression', () => {
    it('should compress "completed" to ✅', () => {
      streamMessage('agent', 'Task completed successfully', {
        channel: TEST_CHANNEL,
        compress: true
      });

      const stream = readStream(TEST_CHANNEL);
      assert.ok(stream.messages[0].message.includes('✅'));
    });

    it('should compress "error" to ❌', () => {
      streamMessage('agent', 'Found an error in the code', {
        channel: TEST_CHANNEL,
        compress: true
      });

      const stream = readStream(TEST_CHANNEL);
      assert.ok(stream.messages[0].message.includes('❌'));
    });

    it('should compress "code review" to 審', () => {
      streamMessage('agent', 'Starting code review now', {
        channel: TEST_CHANNEL,
        compress: true
      });

      const stream = readStream(TEST_CHANNEL);
      assert.ok(stream.messages[0].message.includes('審'));
    });
  });

  describe('Status Updates', () => {
    it('should stream status updates', () => {
      streamStatus('test-agent', 'active', 'auth-module', 50, { channel: TEST_CHANNEL });

      const stream = readStream(TEST_CHANNEL);
      assert.strictEqual(stream.count, 1);
      assert.strictEqual(stream.messages[0].type, 'sta');
      assert.strictEqual(stream.messages[0].status, 'act');
      assert.strictEqual(stream.messages[0].workingOn, 'auth-module');
    });
  });

  describe('Claims', () => {
    it('should stream claim announcements', () => {
      streamClaim('test-agent', 'schema.ts', 'claim', { channel: TEST_CHANNEL });

      const stream = readStream(TEST_CHANNEL);
      assert.strictEqual(stream.count, 1);
      assert.strictEqual(stream.messages[0].type, 'clm');
      assert.strictEqual(stream.messages[0].action, '⊳');
      assert.strictEqual(stream.messages[0].workingOn, 'schema.ts');
    });

    it('should stream release announcements', () => {
      streamClaim('test-agent', 'schema.ts', 'release', { channel: TEST_CHANNEL });

      const stream = readStream(TEST_CHANNEL);
      assert.strictEqual(stream.messages[0].action, '⊥');
    });
  });

  describe('MESSAGE_TYPES', () => {
    it('should export message type constants', () => {
      assert.strictEqual(MESSAGE_TYPES.CHAT, 'cht');
      assert.strictEqual(MESSAGE_TYPES.STATUS, 'sta');
      assert.strictEqual(MESSAGE_TYPES.CLAIM, 'clm');
      assert.strictEqual(MESSAGE_TYPES.TASK, 'tsk');
      assert.strictEqual(MESSAGE_TYPES.ERROR, 'err');
      assert.strictEqual(MESSAGE_TYPES.SYNC, 'syn');
    });
  });
});

