#!/usr/bin/env node
/**
 * MCP Response Compressor
 * 
 * Middleware for compressing MCP responses based on target model's tokenizer.
 * Uses Omega for Qwen-family models, English summarization for GPT/Claude.
 * 
 * Usage:
 *   import { compressMCPResponse, detectModelFamily } from './mcp-compressor.mjs';
 *   const compressed = compressMCPResponse(response, 'qwen2.5:3b');
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL FAMILY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_FAMILIES = {
  qwen: ['qwen', 'qwen2', 'qwen2.5', 'qwen3'],
  gpt: ['gpt-4', 'gpt-4o', 'gpt-4.1', 'gpt-3.5', 'o1', 'o3'],
  claude: ['claude', 'claude-3', 'claude-sonnet', 'claude-opus', 'claude-haiku'],
  gemini: ['gemini', 'gemini-pro', 'gemini-flash', 'gemini-2'],
  deepseek: ['deepseek', 'deepseek-v3', 'deepseek-coder'],
  llama: ['llama', 'llama2', 'llama3', 'llama-3'],
  mistral: ['mistral', 'mixtral', 'mistral-large'],
  grok: ['grok', 'grok-3']
};

// Models with efficient Chinese tokenizers (benefit from Omega)
const OMEGA_EFFICIENT = ['qwen', 'deepseek', 'llama'];

// Models with inefficient Chinese tokenizers (Omega costs more tokens)
const OMEGA_INEFFICIENT = ['gpt', 'claude', 'gemini'];

export function detectModelFamily(modelName) {
  const lower = modelName.toLowerCase();
  for (const [family, patterns] of Object.entries(MODEL_FAMILIES)) {
    if (patterns.some(p => lower.includes(p))) {
      return family;
    }
  }
  return 'unknown';
}

export function shouldUseOmega(modelName) {
  const family = detectModelFamily(modelName);
  return OMEGA_EFFICIENT.includes(family);
}

// ═══════════════════════════════════════════════════════════════════════════════
// OMEGA COMPRESSION (Simplified)
// ═══════════════════════════════════════════════════════════════════════════════

const OMEGA_MAPPINGS = {
  // Common MCP response patterns
  'success': '✓',
  'error': '✗',
  'warning': '⚠',
  'info': 'ℹ',
  'message': 'msg',
  'result': '→',
  'data': '資',
  'status': '態',
  'completed': '完',
  'pending': '待',
  'failed': '敗',
  'created': '建',
  'updated': '改',
  'deleted': '刪',
  'timestamp': 'ts',
  'description': '述',
  'content': '容',
  'response': '應',
  'request': '請',
  'agent': 'Agt',
  'channel': 'ch',
  'author': 'by'
};

export function toOmega(text) {
  let result = text;
  for (const [english, omega] of Object.entries(OMEGA_MAPPINGS)) {
    result = result.replace(new RegExp(english, 'gi'), omega);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPRESSION STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════════

export function compressMCPResponse(response, targetModel, options = {}) {
  const { maxLength = 1000, preserveStructure = true } = options;
  
  const family = detectModelFamily(targetModel);
  const useOmega = shouldUseOmega(targetModel);
  
  // Convert to string if object
  const text = typeof response === 'object' 
    ? JSON.stringify(response, null, preserveStructure ? 2 : 0)
    : String(response);
  
  // Short responses: no compression needed
  if (text.length < 200) {
    return { 
      compressed: text, 
      strategy: 'none',
      savings: 0,
      family 
    };
  }
  
  // Apply compression based on model family
  let compressed;
  let strategy;
  
  if (useOmega) {
    compressed = toOmega(text);
    strategy = 'omega';
  } else {
    // For GPT/Claude: just truncate/summarize (Omega costs more tokens)
    compressed = text.length > maxLength 
      ? text.slice(0, maxLength) + '...[truncated]'
      : text;
    strategy = 'truncate';
  }
  
  const savings = ((1 - compressed.length / text.length) * 100).toFixed(1);
  
  return {
    compressed,
    strategy,
    savings: parseFloat(savings),
    family,
    originalLength: text.length,
    compressedLength: compressed.length
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO
// ═══════════════════════════════════════════════════════════════════════════════

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('MCP Compressor Demo\n');
  
  const testResponse = {
    status: 'success',
    message: 'Agent completed the task successfully',
    data: {
      created: '2025-12-18T19:00:00Z',
      author: 'augment-opus-omega',
      channel: 'dev-backend',
      content: 'This is a test message with some content that needs compression'
    }
  };
  
  const models = ['qwen2.5:3b', 'gpt-4o', 'claude-sonnet-4', 'deepseek-v3'];
  
  for (const model of models) {
    const result = compressMCPResponse(testResponse, model);
    console.log(`\n${model} (${result.family}):`);
    console.log(`  Strategy: ${result.strategy}`);
    console.log(`  Savings: ${result.savings}%`);
    console.log(`  ${result.originalLength} → ${result.compressedLength} chars`);
  }
}

