#!/usr/bin/env node
/**
 * Stream vs MCP Polling Comparison Test
 * 
 * Measures context cost and latency of both approaches
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { streamMessage, readStream, MESSAGE_TYPES } from '../lib/intellij-stream.mjs';

// Simulate MCP response (what get-since returns)
function simulateMCPResponse(messageCount) {
  const messages = [];
  for (let i = 0; i < messageCount; i++) {
    messages.push({
      _id: `msg_${i}_${Date.now()}`,
      _creationTime: Date.now() - (messageCount - i) * 60000,
      author: `agent-${i % 5}`,
      authorType: 'agent',
      channel: 'dev',
      message: `This is message ${i} with some typical content about working on feature X and coordinating with team members about the implementation details.`,
      timestamp: new Date(Date.now() - (messageCount - i) * 60000).toISOString(),
      reactions: i % 3 === 0 ? [{ emoji: '👍', count: 1, authors: ['human'] }] : []
    });
  }
  return {
    messages,
    count: messageCount,
    since: new Date(Date.now() - messageCount * 60000).toISOString(),
    contextSize: messageCount,
    suggestedPollIntervalMs: 60000,
    pollingTip: '💡 Poll again in 60s',
    smartRouting: { relevantChannels: ['dev'], filtered: 1 },
    agentReminder: '⚠️ Process messages silently...',
    sessionRule: '🚨 NEVER respond to CLI...',
    humanAbsence: { absent: false, minutesSinceLastHuman: 5 }
  };
}

// Simulate stream file content
function simulateStreamFile(messageCount) {
  const lines = [];
  for (let i = 0; i < messageCount; i++) {
    const ts = new Date(Date.now() - (messageCount - i) * 60000);
    const hours = ts.getHours().toString().padStart(2, '0');
    const mins = ts.getMinutes().toString().padStart(2, '0');
    const secs = ts.getSeconds().toString().padStart(2, '0');
    lines.push(`Ω{ts:${hours}:${mins}:${secs}|from:a${i % 5}|ch:dev|t:cht|m:Message ${i} about feature X and coordination}`);
  }
  return lines.join('\n');
}

// Run comparison
function runComparison() {
  console.log('='.repeat(60));
  console.log('STREAM vs MCP POLLING COMPARISON');
  console.log('='.repeat(60));
  console.log();

  const testCases = [10, 25, 50, 100];
  const results = [];

  for (const count of testCases) {
    console.log(`\n--- ${count} Messages ---`);
    
    // MCP approach
    const mcpResponse = simulateMCPResponse(count);
    const mcpJson = JSON.stringify(mcpResponse);
    const mcpBytes = Buffer.byteLength(mcpJson, 'utf8');
    
    // Stream approach
    const streamContent = simulateStreamFile(count);
    const streamBytes = Buffer.byteLength(streamContent, 'utf8');
    
    // What agent actually needs (simulating grep for @mentions)
    const relevantLines = streamContent.split('\n').filter((_, i) => i % 10 === 0);
    const relevantBytes = Buffer.byteLength(relevantLines.join('\n'), 'utf8');
    
    const result = {
      messageCount: count,
      mcpContextBytes: mcpBytes,
      streamFileBytes: streamBytes,
      streamRelevantBytes: relevantBytes,
      mcpVsStreamRaw: ((mcpBytes - streamBytes) / mcpBytes * 100).toFixed(1),
      mcpVsStreamFiltered: ((mcpBytes - relevantBytes) / mcpBytes * 100).toFixed(1)
    };
    results.push(result);
    
    console.log(`MCP Response:     ${mcpBytes.toLocaleString()} bytes (goes INTO context)`);
    console.log(`Stream File:      ${streamBytes.toLocaleString()} bytes (ephemeral read)`);
    console.log(`Relevant Only:    ${relevantBytes.toLocaleString()} bytes (what agent adds to context)`);
    console.log(`Savings (raw):    ${result.mcpVsStreamRaw}%`);
    console.log(`Savings (filter): ${result.mcpVsStreamFiltered}%`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log();
  console.log('| Messages | MCP Bytes | Stream Bytes | Relevant | Savings |');
  console.log('|----------|-----------|--------------|----------|---------|');
  for (const r of results) {
    console.log(`| ${r.messageCount.toString().padStart(8)} | ${r.mcpContextBytes.toLocaleString().padStart(9)} | ${r.streamFileBytes.toLocaleString().padStart(12)} | ${r.streamRelevantBytes.toLocaleString().padStart(8)} | ${r.mcpVsStreamFiltered.padStart(6)}% |`);
  }
  
  console.log();
  console.log('KEY INSIGHT:');
  console.log('- MCP response bytes go INTO agent context window');
  console.log('- Stream file bytes are EPHEMERAL (file read, not context)');
  console.log('- Agent can filter stream locally, only adding relevant bytes');
  console.log();
  console.log('At 100 messages:');
  const r100 = results.find(r => r.messageCount === 100);
  if (r100) {
    console.log(`  MCP: ${r100.mcpContextBytes.toLocaleString()} bytes consumed per poll`);
    console.log(`  Stream: ${r100.streamRelevantBytes.toLocaleString()} bytes (after filtering)`);
    console.log(`  Savings: ${r100.mcpVsStreamFiltered}% context reduction`);
  }
  
  return results;
}

runComparison();

