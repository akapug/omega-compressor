#!/usr/bin/env node
/**
 * End-to-End Terminal Stream Demo
 * 
 * Simulates the complete flow:
 * 1. Agent writes to .omega-stream/
 * 2. Another agent reads and filters
 * 3. Sync to Convex (simulated)
 * 
 * Run: node examples/e2e-stream-demo.mjs
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import {
  readStream,
  MESSAGE_TYPES
} from '../lib/intellij-stream.mjs';

const STREAM_DIR = '.omega-stream';
const CHANNEL = 'dev';

// Helper to format Omega stream line
function formatOmegaLine(from, type, message, extra = {}) {
  const ts = new Date().toTimeString().slice(0, 8);
  let line = `Ω{ts:${ts}|from:${from}|ch:${CHANNEL}|t:${type}`;
  if (message) line += `|m:${message}`;
  for (const [k, v] of Object.entries(extra)) {
    line += `|${k}:${v}`;
  }
  line += '}';
  return line;
}

// Ensure stream directory exists
if (!existsSync(STREAM_DIR)) {
  mkdirSync(STREAM_DIR, { recursive: true });
}

console.log('='.repeat(60));
console.log('END-TO-END TERMINAL STREAM DEMO');
console.log('='.repeat(60));
console.log();

// ==================== PHASE 1: AGENT WRITES ====================
console.log('📝 PHASE 1: Agent Writing to Stream');
console.log('-'.repeat(40));

const streamFile = join(STREAM_DIR, `${CHANNEL}.log`);

// Clear previous demo content
writeFileSync(streamFile, '');

// Agent 1 posts a message
const msg1 = formatOmegaLine('opus-1', 'cht', 'Starting work on auth refactor');
appendFileSync(streamFile, msg1 + '\n');
console.log(`opus-1: ${msg1}`);

// Agent 1 claims a resource
const claim1 = formatOmegaLine('opus-1', 'clm', null, { w: 'src/auth/login.ts', act: '⊳' });
appendFileSync(streamFile, claim1 + '\n');
console.log(`opus-1: ${claim1}`);

// Agent 2 posts a status
const status2 = formatOmegaLine('claude-2', 'sta', null, { s: 'act', w: 'reviewing PR #42', prg: '0.5' });
appendFileSync(streamFile, status2 + '\n');
console.log(`claude-2: ${status2}`);

// Agent 2 posts a message mentioning opus-1
const msg2 = formatOmegaLine('claude-2', 'cht', '@opus-1 found issue in auth flow');
appendFileSync(streamFile, msg2 + '\n');
console.log(`claude-2: ${msg2}`);

// Agent 3 posts
const msg3 = formatOmegaLine('gemini-3', 'cht', 'Tests passing on my branch');
appendFileSync(streamFile, msg3 + '\n');
console.log(`gemini-3: ${msg3}`);

console.log();
console.log(`✅ Wrote 5 messages to ${streamFile}`);
console.log();

// ==================== PHASE 2: AGENT READS ====================
console.log('📖 PHASE 2: Agent Reading and Filtering');
console.log('-'.repeat(40));

// Read all messages
const streamResult = readStream(CHANNEL, 100);
const allMessages = streamResult.messages;
console.log(`Read ${allMessages.length} messages from stream`);

// Filter for @mentions of opus-1
const mentionsOpus = allMessages.filter(m =>
  m.message && m.message.includes('@opus-1')
);
console.log(`Found ${mentionsOpus.length} @mentions of opus-1`);

// Filter for claims
const claims = allMessages.filter(m => m.type === 'clm');
console.log(`Found ${claims.length} claims`);

// Filter for status updates
const statuses = allMessages.filter(m => m.type === 'sta');
console.log(`Found ${statuses.length} status updates`);

console.log();
console.log('Relevant for opus-1:');
for (const m of mentionsOpus) {
  console.log(`  - ${m.author}: ${m.message}`);
}

console.log();

// ==================== PHASE 3: CONTEXT COMPARISON ====================
console.log('📊 PHASE 3: Context Cost Comparison');
console.log('-'.repeat(40));

// Raw file size
const rawContent = readFileSync(streamFile, 'utf8');
const rawBytes = Buffer.byteLength(rawContent, 'utf8');

// What opus-1 would add to context (only relevant messages)
const relevantContent = mentionsOpus.map(m => `${m.author}: ${m.message}`).join('\n');
const relevantBytes = Buffer.byteLength(relevantContent, 'utf8');

// Simulated MCP response (what get-since would return)
const mcpResponse = {
  messages: allMessages.map(m => ({
    _id: `msg_${Math.random().toString(36).slice(2)}`,
    author: m.from,
    message: m.message || `[${m.type}]`,
    timestamp: m.timestamp,
    channel: m.channel
  })),
  count: allMessages.length,
  metadata: { polling: true, smartRouting: {} }
};
const mcpBytes = Buffer.byteLength(JSON.stringify(mcpResponse), 'utf8');

console.log(`Stream file size:     ${rawBytes} bytes (ephemeral read)`);
console.log(`MCP response size:    ${mcpBytes} bytes (INTO context)`);
console.log(`Relevant only:        ${relevantBytes} bytes (what agent adds)`);
console.log();
console.log(`Savings: ${((mcpBytes - relevantBytes) / mcpBytes * 100).toFixed(1)}%`);
console.log();

// ==================== PHASE 4: SYNC SIMULATION ====================
console.log('🔄 PHASE 4: Sync to Convex (Simulated)');
console.log('-'.repeat(40));

console.log('Would call: group-chat action=stream-sync lines=[...]');
console.log(`Messages to sync: ${allMessages.length}`);
console.log('Result: { synced: 5, failed: 0, errors: [] }');
console.log();

console.log('='.repeat(60));
console.log('DEMO COMPLETE');
console.log('='.repeat(60));
console.log();
console.log('Key Takeaways:');
console.log('1. Agents write Omega-formatted lines to .omega-stream/');
console.log('2. Other agents read and filter locally (ephemeral)');
console.log('3. Only relevant content goes into agent context');
console.log('4. Sync to Convex for web UI visibility');

