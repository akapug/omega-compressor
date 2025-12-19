/**
 * Omega Stream Format Library
 *
 * Provides the omega format encoder/decoder for terminal streaming.
 * This is a generic library - integration code lives in consuming projects.
 *
 * Format: Ω{ts:HH:MM:SS|from:AGENT|ch:CHANNEL|t:TYPE|m:MESSAGE}
 *
 * Message types:
 * - cht: Chat message
 * - sta: Status update
 * - clm: Claim/lock
 * - tsk: Task update
 * - err: Error/alert
 * - syn: Sync marker
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Message types per spec
const MESSAGE_TYPES = {
  CHAT: 'cht',      // Chat message
  STATUS: 'sta',    // Status update
  CLAIM: 'clm',     // Claim/lock
  TASK: 'tsk',      // Task update
  ERROR: 'err',     // Error/alert
  SYNC: 'syn'       // Sync marker
};

/**
 * Abbreviate agent ID for compact format
 * @param {string} agentId - Full agent ID
 * @returns {string} Abbreviated ID (max 8 chars)
 */
function abbreviateAgentId(agentId) {
  // Remove common prefixes/suffixes
  return agentId
    .replace(/^(augment|claude|cursor|windsurf)-/, '')
    .replace(/-agent$/, '')
    .slice(0, 8);
}

/**
 * Get current timestamp in HH:MM:SS format
 */
function getTimestamp() {
  return new Date().toISOString().slice(11, 19);
}

/**
 * Simple Omega-style compression for message content
 * In production, use the full compressor with LLM
 */
function simpleOmegaCompress(text) {
  return text
    .replace(/completed/gi, '✅')
    .replace(/error|issue|problem/gi, '❌')
    .replace(/warning/gi, '⚠️')
    .replace(/code review/gi, '審')
    .replace(/pull request|PR/gi, 'PR')
    .replace(/found/gi, '發現')
    .replace(/fixed/gi, '修')
    .replace(/ready for review/gi, '待審')
    .replace(/working on/gi, '→')
    .replace(/starting/gi, '▶')
    .replace(/finished/gi, '■');
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
 * Stream a message to the log file using Omega format
 * Format: Ω{ts:HH:MM:SS|from:AGENT|ch:CHANNEL|t:TYPE|m:MESSAGE}
 *
 * @param {string} agentId - The agent posting the message
 * @param {string} message - The message content
 * @param {Object} options - Options
 * @param {boolean} options.compress - Whether to Omega compress content (default: true)
 * @param {string} options.channel - Channel name (default: 'general')
 * @param {string} options.type - Message type: cht, sta, clm, tsk, err, syn (default: 'cht')
 */
export function streamMessage(agentId, message, options = {}) {
  const { compress = true, channel = 'general', type = MESSAGE_TYPES.CHAT } = options;
  const streamDir = initStreamDir();
  const logFile = join(streamDir, `${channel}.log`);

  const ts = getTimestamp();
  const from = abbreviateAgentId(agentId);
  const ch = channel.slice(0, 6); // Abbreviate channel
  const content = compress ? simpleOmegaCompress(message) : message;

  // New Omega format per spec
  const entry = `Ω{ts:${ts}|from:${from}|ch:${ch}|t:${type}|m:${content}}\n`;
  appendFileSync(logFile, entry);

  return { logged: true, file: logFile, compressed: compress, format: 'omega' };
}

/**
 * Stream a status update
 */
export function streamStatus(agentId, status, workingOn, progress, options = {}) {
  const { channel = 'general' } = options;
  const streamDir = initStreamDir();
  const logFile = join(streamDir, `${channel}.log`);

  const ts = getTimestamp();
  const from = abbreviateAgentId(agentId);
  const s = status === 'active' ? 'act' : status === 'idle' ? 'idl' : 'wait';
  const w = workingOn ? workingOn.slice(0, 20) : '';
  const prg = progress ? progress.toFixed(1) : '';

  const entry = `Ω{ts:${ts}|from:${from}|t:sta|s:${s}${w ? `|w:${w}` : ''}${prg ? `|prg:${prg}` : ''}}\n`;
  appendFileSync(logFile, entry);

  return { logged: true, file: logFile, type: 'status' };
}

/**
 * Stream a claim/lock announcement
 */
export function streamClaim(agentId, resource, action = 'claim', options = {}) {
  const { channel = 'general' } = options;
  const streamDir = initStreamDir();
  const logFile = join(streamDir, `${channel}.log`);

  const ts = getTimestamp();
  const from = abbreviateAgentId(agentId);
  const w = resource.slice(0, 30);
  const act = action === 'claim' ? '⊳' : action === 'release' ? '⊥' : action;

  const entry = `Ω{ts:${ts}|from:${from}|t:clm|w:${w}|act:${act}}\n`;
  appendFileSync(logFile, entry);

  return { logged: true, file: logFile, type: 'claim' };
}

/**
 * Read recent messages from stream and parse Omega format
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
    // Parse new Omega format: Ω{ts:...|from:...|...}
    const omegaMatch = line.match(/^Ω\{(.+)\}$/);
    if (omegaMatch) {
      const fields = {};
      omegaMatch[1].split('|').forEach(pair => {
        const [key, ...valueParts] = pair.split(':');
        fields[key] = valueParts.join(':'); // Handle colons in values
      });
      return {
        timestamp: fields.ts,
        author: fields.from,
        channel: fields.ch,
        type: fields.t,
        message: fields.m,
        status: fields.s,
        workingOn: fields.w,
        progress: fields.prg,
        action: fields.act,
        raw: line
      };
    }
    // Legacy format fallback
    const legacyMatch = line.match(/^\[([^\]]+)\] ([^:]+): (.+)$/);
    if (legacyMatch) {
      return { timestamp: legacyMatch[1], author: legacyMatch[2], message: legacyMatch[3], legacy: true };
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
 * Demo: Simulate IntelliJ MCP streaming workflow with new Omega format
 */
export async function demo() {
  console.log('=== IntelliJ MCP Terminal Streaming Demo (Omega Format) ===\n');

  // 1. Agent posts a chat message
  const result1 = streamMessage('augment-opus',
    'Completed code review of auth module. Found 3 issues.',
    { compress: true, channel: 'dev' }
  );
  console.log('1. Chat message:', result1);

  // 2. Agent posts a status update
  const result2 = streamStatus('augment-opus', 'active', 'auth-refactor', 45, { channel: 'dev' });
  console.log('2. Status update:', result2);

  // 3. Agent claims a resource
  const result3 = streamClaim('claude-code', 'schema.ts', 'claim', { channel: 'dev' });
  console.log('3. Resource claim:', result3);

  // 4. Another agent posts
  const result4 = streamMessage('claude-code',
    'Fixed the input validation issue. PR #42 ready for review.',
    { compress: true, channel: 'dev' }
  );
  console.log('4. Chat message:', result4);

  // 5. Read the stream
  const stream = readStream('dev', 10);
  console.log('\n5. Stream contents (parsed):');
  stream.messages.forEach(m => {
    if (m.type === 'cht') {
      console.log(`   [${m.timestamp}] ${m.author}: ${m.message}`);
    } else if (m.type === 'sta') {
      console.log(`   [${m.timestamp}] ${m.author} status: ${m.status} → ${m.workingOn}`);
    } else if (m.type === 'clm') {
      console.log(`   [${m.timestamp}] ${m.author} ${m.action} ${m.workingOn}`);
    } else {
      console.log(`   ${m.raw}`);
    }
  });

  // 6. Show IntelliJ MCP command format
  console.log('\n6. IntelliJ MCP command format:');
  console.log(JSON.stringify(formatIntelliJCommand('npm test'), null, 2));

  // 7. Show how to write to stream via IntelliJ MCP
  console.log('\n7. Write to stream via IntelliJ MCP:');
  const writeCmd = formatIntelliJCommand(
    `echo 'Ω{ts:${getTimestamp()}|from:agent|ch:dev|t:cht|m:Hello from IntelliJ}' >> .omega-stream/dev.log`
  );
  console.log(JSON.stringify(writeCmd, null, 2));
}

// Export MESSAGE_TYPES for external use
export { MESSAGE_TYPES };

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}

