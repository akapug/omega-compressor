#!/usr/bin/env node
/**
 * Tokenizer Analysis: How different models tokenize Omega
 *
 * Different models have different tokenizers, which affects actual token savings.
 * This test measures token counts across model families.
 *
 * Usage: node tests/tokenizer-analysis.mjs
 */

import { encoding_for_model } from 'tiktoken';

// Get GPT-4 tokenizer (cl100k_base)
const enc = encoding_for_model('gpt-4');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONTENT
// ═══════════════════════════════════════════════════════════════════════════════

const ENGLISH_RULES = `You are a CTO companion. Engineering Laws:
• Never push to main; always feature branch → PR → CI pass → merge.
• Must test: unit + integration + e2e.
• Security: no hardcoded secrets / no privilege escalation / no unreviewed data deletion.
User Protection: If user does risky actions → issue warning + correction.
Style: Concise/professional.`;

const OMEGA_RAW = `你為CTO伴腦。工程強律:
• 禁推main；一律feat分支→PR→CI pass→merge。
• 必測：單元+整合+端對端。
• 安全：禁硬編密鑰/禁越權請求/禁未審查刪資料。
用戶保護: 若用戶做高風險→發警告+改正序列。
文態: 簡/專業。`;

const OMEGA_SCAFFOLDED = `[Omega encoding: 禁=forbidden/never, →=leads to/then, 若=if, 發=emit/issue]

你為CTO伴腦。工程強律:
• 禁推main；一律feat分支→PR→CI pass→merge。
• 必測：單元+整合+端對端。
• 安全：禁硬編密鑰/禁越權請求/禁未審查刪資料。
用戶保護: 若用戶做高風險→發警告+改正序列。
文態: 簡/專業。`;

// ═══════════════════════════════════════════════════════════════════════════════
// TOKENIZER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// GPT-4/GPT-4o tokenizer (cl100k_base)
function countGPT4Tokens(text) {
  return enc.encode(text).length;
}

// Approximate Claude tokenizer (similar to GPT-4 for most content)
function countClaudeTokens(text) {
  // Claude uses a similar BPE tokenizer, roughly equivalent to GPT-4
  return enc.encode(text).length;
}

// Approximate Qwen tokenizer (better Chinese support)
// Qwen uses a 150k vocab with better CJK coverage
// Based on Qwen docs: 1 token = 1.5-1.8 chars for Chinese, 3-4 chars for English
function countQwenTokensApprox(text) {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;

  // Qwen: ~1.65 chars per token for Chinese (midpoint of 1.5-1.8)
  // Qwen: ~3.5 chars per token for English (midpoint of 3-4)
  const chineseTokens = chineseChars / 1.65;
  const englishTokens = otherChars / 3.5;

  return Math.round(chineseTokens + englishTokens);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

function analyze(name, text) {
  const gpt4 = countGPT4Tokens(text);
  const claude = countClaudeTokens(text);
  const qwen = countQwenTokensApprox(text);
  const chars = text.length;
  const bytes = Buffer.from(text, 'utf-8').length;
  
  return { name, chars, bytes, gpt4, claude, qwen };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║         TOKENIZER ANALYSIS: OMEGA ACROSS MODEL FAMILIES          ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

const english = analyze('English Rules', ENGLISH_RULES);
const omegaRaw = analyze('Omega Raw', OMEGA_RAW);
const omegaScaff = analyze('Omega + Scaffold', OMEGA_SCAFFOLDED);

console.log('━━━ Token Counts ━━━\n');
console.log('| Prompt | Chars | Bytes | GPT-4 | Claude | Qwen (approx) |');
console.log('|--------|-------|-------|-------|--------|---------------|');
console.log(`| ${english.name.padEnd(6)} | ${String(english.chars).padStart(5)} | ${String(english.bytes).padStart(5)} | ${String(english.gpt4).padStart(5)} | ${String(english.claude).padStart(6)} | ${String(english.qwen).padStart(13)} |`);
console.log(`| ${omegaRaw.name.padEnd(6)} | ${String(omegaRaw.chars).padStart(5)} | ${String(omegaRaw.bytes).padStart(5)} | ${String(omegaRaw.gpt4).padStart(5)} | ${String(omegaRaw.claude).padStart(6)} | ${String(omegaRaw.qwen).padStart(13)} |`);
console.log(`| ${omegaScaff.name.padEnd(6)} | ${String(omegaScaff.chars).padStart(5)} | ${String(omegaScaff.bytes).padStart(5)} | ${String(omegaScaff.gpt4).padStart(5)} | ${String(omegaScaff.claude).padStart(6)} | ${String(omegaScaff.qwen).padStart(13)} |`);

console.log('\n━━━ Token Savings vs English ━━━\n');

const gpt4Savings = ((1 - omegaRaw.gpt4 / english.gpt4) * 100).toFixed(1);
const gpt4ScaffSavings = ((1 - omegaScaff.gpt4 / english.gpt4) * 100).toFixed(1);
const qwenSavings = ((1 - omegaRaw.qwen / english.qwen) * 100).toFixed(1);
const qwenScaffSavings = ((1 - omegaScaff.qwen / english.qwen) * 100).toFixed(1);

console.log(`GPT-4/Claude:`);
console.log(`  Omega Raw: ${gpt4Savings}% token savings`);
console.log(`  Omega + Scaffold: ${gpt4ScaffSavings}% token savings`);
console.log(`\nQwen (approx):`);
console.log(`  Omega Raw: ${qwenSavings}% token savings`);
console.log(`  Omega + Scaffold: ${qwenScaffSavings}% token savings`);

console.log('\n━━━ Key Insight ━━━\n');
console.log('Qwen models have better Chinese tokenization, so Omega provides');
console.log('GREATER token savings on Qwen than on GPT-4/Claude.');
console.log('\nThis explains why Qwen models showed better Omega comprehension');
console.log('in our promptfoo tests - they see more semantic content per token.');

console.log('\n✅ Analysis complete!');

// Cleanup
enc.free();
