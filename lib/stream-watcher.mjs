#!/usr/bin/env node
/**
 * Stream Watcher - Background sync process
 * 
 * Watches .omega-stream/ for changes and syncs to Convex via contextOS MCP.
 * 
 * Usage:
 *   node lib/stream-watcher.mjs                    # Watch and sync
 *   node lib/stream-watcher.mjs --dry-run          # Watch without syncing
 *   node lib/stream-watcher.mjs --once             # Sync once and exit
 * 
 * Environment:
 *   CONTEXTOS_MCP_URL - URL of contextOS MCP server (default: http://localhost:3000)
 */

import { watch, readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { readStream } from './intellij-stream.mjs';

const STREAM_DIR = '.omega-stream';
const STATE_FILE = join(STREAM_DIR, '.sync-state.json');

// Parse args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONCE = args.includes('--once');
const MCP_URL = process.env.CONTEXTOS_MCP_URL || 'http://localhost:3000';

// Track last synced line per channel
function loadState() {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Sync new lines from a channel
async function syncChannel(channel, state) {
  const result = readStream(channel, 1000);
  const messages = result.messages || [];
  
  const lastSynced = state[channel] || 0;
  const newMessages = messages.slice(lastSynced);
  
  if (newMessages.length === 0) {
    return { channel, synced: 0, total: messages.length };
  }
  
  console.log(`[${channel}] ${newMessages.length} new messages to sync`);
  
  if (DRY_RUN) {
    for (const m of newMessages) {
      console.log(`  [DRY] ${m.author}: ${m.message || `[${m.type}]`}`);
    }
  } else {
    // Format lines for sync
    const lines = newMessages.map(m => m.raw).filter(Boolean);
    
    try {
      // Call contextOS MCP to sync
      const response = await fetch(`${MCP_URL}/api/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'group-chat',
          args: {
            action: 'stream-sync',
            lines,
            source: `stream-watcher-${channel}`
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ Synced ${data.synced || lines.length} messages`);
      } else {
        console.log(`  ❌ Sync failed: ${response.status}`);
      }
    } catch (e) {
      console.log(`  ❌ Sync error: ${e.message}`);
      // Don't update state on error
      return { channel, synced: 0, error: e.message };
    }
  }
  
  // Update state
  state[channel] = messages.length;
  saveState(state);
  
  return { channel, synced: newMessages.length, total: messages.length };
}

// Get all channels (log files in stream dir)
function getChannels() {
  if (!existsSync(STREAM_DIR)) return [];
  return readdirSync(STREAM_DIR)
    .filter(f => f.endsWith('.log'))
    .map(f => f.replace('.log', ''));
}

// Main sync loop
async function syncAll() {
  const state = loadState();
  const channels = await getChannels();
  
  if (channels.length === 0) {
    console.log('No channels to sync');
    return;
  }
  
  console.log(`Syncing ${channels.length} channels...`);
  
  for (const channel of channels) {
    await syncChannel(channel, state);
  }
}

// Watch mode
async function watchMode() {
  console.log('='.repeat(50));
  console.log('STREAM WATCHER');
  console.log('='.repeat(50));
  console.log(`Watching: ${STREAM_DIR}/`);
  console.log(`MCP URL: ${MCP_URL}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('Press Ctrl+C to stop');
  console.log('='.repeat(50));
  
  // Ensure stream dir exists
  if (!existsSync(STREAM_DIR)) {
    mkdirSync(STREAM_DIR, { recursive: true });
  }
  
  // Initial sync
  await syncAll();
  
  // Watch for changes
  watch(STREAM_DIR, { persistent: true }, async (eventType, filename) => {
    if (!filename || !filename.endsWith('.log')) return;
    const channel = filename.replace('.log', '');
    console.log(`\n[${new Date().toISOString()}] Change detected: ${channel}`);
    const state = loadState();
    await syncChannel(channel, state);
  });
}

// Run
if (ONCE) {
  syncAll().then(() => process.exit(0));
} else {
  watchMode();
}

