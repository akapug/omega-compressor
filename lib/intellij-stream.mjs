/**
 * IntelliJ MCP Terminal Streaming Integration
 *
 * Concept: Instead of large MCP responses polluting agent context windows,
 * stream terminal output to files that agents can read on-demand.
 *
 * Architecture:
 * 1. IntelliJ MCP Server executes commands
 * 2. Output streams to a log file (Omega compressed)
 * 3. Agents read file (no context pollution)
 * 4. contextOS aggregates team insights
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Simple Omega-style compression for demo
 * In production, use the full compressor with LLM
 */
function simpleOmegaCompress(text) {
  // Basic substitutions for demo
  return text
    .replace(/completed/gi, '✅')
    .replace(/error|issue|problem/gi, '❌')
    .replace(/warning/gi, '⚠️')
    .replace(/code review/gi, '審')
    .replace(/pull request|PR/gi, 'PR')
    .replace(/found/gi, '發現')
    .replace(/fixed/gi, '修')
    .replace(/ready for review/gi, '待審');
}

// Stream log directory
const STREAM_DIR = '.omega-stream';

/**
 * Initialize the stream directory
 */
export function initStreamDir(projectRoot = process.cwd()) {
  const streamPath = join(projectRoot, STREAM_DIR);
  if (!existsSync(streamPath)) {
    mkdirSync(streamPath, { recursive: true });
  }
  return streamPath;
}

/**
 * Stream a message to the log file
 * @param {string} agentId - The agent posting the message
 * @param {string} message - The message content
 * @param {Object} options - Options
 * @param {boolean} options.compress - Whether to Omega compress (default: true)
 * @param {string} options.channel - Channel name (default: 'general')
 */
export function streamMessage(agentId, message, options = {}) {
  const { compress = true, channel = 'general' } = options;
  const streamDir = initStreamDir();
  const logFile = join(streamDir, `${channel}.log`);
  
  const timestamp = new Date().toISOString();
  const content = compress ? simpleOmegaCompress(message) : message;
  
  const entry = `[${timestamp}] ${agentId}: ${content}\n`;
  appendFileSync(logFile, entry);
  
  return { logged: true, file: logFile, compressed: compress };
}

/**
 * Read recent messages from stream
 * @param {string} channel - Channel name
 * @param {number} lines - Number of lines to read (default: 50)
 */
export function readStream(channel = 'general', lines = 50) {
  const streamDir = initStreamDir();
  const logFile = join(streamDir, `${channel}.log`);

  if (!existsSync(logFile)) {
    return { messages: [], count: 0 };
  }

  const content = readFileSync(logFile, 'utf-8');
  const allLines = content.trim().split('\n').filter(Boolean);
  const recentLines = allLines.slice(-lines);

  const messages = recentLines.map(line => {
    const match = line.match(/^\[([^\]]+)\] ([^:]+): (.+)$/);
    if (match) {
      return { timestamp: match[1], author: match[2], content: match[3] };
    }
    return { raw: line };
  });

  return { messages, count: messages.length };
}

/**
 * Format for IntelliJ MCP execute_terminal_command
 * This generates the command that IntelliJ MCP would run
 */
export function formatIntelliJCommand(command, options = {}) {
  const { timeout = 30000, maxLines = 100, truncateMode = 'end' } = options;
  
  return {
    tool: 'execute_terminal_command',
    params: {
      command,
      executeInShell: true,
      reuseExistingTerminalWindow: true,
      timeout,
      maxLinesCount: maxLines,
      truncateMode
    }
  };
}

/**
 * Demo: Simulate IntelliJ MCP streaming workflow
 */
export async function demo() {
  console.log('=== IntelliJ MCP Terminal Streaming Demo ===\n');
  
  // 1. Agent posts a status update
  const result1 = streamMessage('augment-opus', 
    'Completed code review of auth module. Found 3 issues: missing input validation, hardcoded timeout, unused import.',
    { compress: true, channel: 'dev-backend' }
  );
  console.log('1. Streamed message:', result1);
  
  // 2. Another agent posts
  const result2 = streamMessage('claude-code', 
    'Fixed the input validation issue. PR #42 ready for review.',
    { compress: true, channel: 'dev-backend' }
  );
  console.log('2. Streamed message:', result2);
  
  // 3. Read the stream
  const stream = readStream('dev-backend', 10);
  console.log('\n3. Stream contents:');
  stream.messages.forEach(m => {
    console.log(`   [${m.timestamp}] ${m.author}: ${m.content}`);
  });
  
  // 4. Show IntelliJ MCP command format
  console.log('\n4. IntelliJ MCP command format:');
  console.log(JSON.stringify(formatIntelliJCommand('npm test'), null, 2));
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}

