#!/usr/bin/env node
/**
 * Compression Stack Test: Omega + zstd/brotli
 * 
 * Tests the full compression stack for A2A communications:
 * - Layer 1: Raw text (baseline)
 * - Layer 2: Omega semantic compression
 * - Layer 3: Wire compression (zstd/brotli)
 * 
 * Usage: node tests/compression-stack-test.mjs
 */

import { gzipSync, brotliCompressSync } from 'zlib';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST MESSAGES AT VARIOUS LENGTHS
// ═══════════════════════════════════════════════════════════════════════════════

const TEST_CASES = [
  {
    name: "Short A2A message",
    english: "Agent A: I need help with the database schema. Can you review?",
    omega: "A→B: 需DB schema審查"
  },
  {
    name: "Medium A2A message",
    english: `Agent A: I've completed the user authentication module. 
Key changes:
- Added JWT token validation
- Implemented refresh token flow
- Added rate limiting (100 req/min)
Please review the PR at #123.`,
    omega: `A→B: 完成用戶認證模組
變更:
• JWT驗證
• 刷新令牌流
• 限速(100/分)
審PR#123`
  },
  {
    name: "Long A2A message (full context)",
    english: `Agent A: Comprehensive status update on the payment integration project.

Completed Tasks:
1. Stripe API integration - webhooks configured
2. Payment intent creation flow
3. Subscription management endpoints
4. Invoice generation system
5. Refund processing logic

Pending Tasks:
1. Currency conversion (need exchange rate API)
2. Tax calculation integration
3. Payment failure retry logic
4. Audit logging for compliance

Blockers:
- Waiting for legal review on terms of service
- Need production Stripe keys from DevOps

Next Steps:
1. Complete currency conversion by EOD
2. Schedule meeting with legal team
3. Coordinate with DevOps for key rotation

Please review PR #456 for the completed work.`,
    omega: `A→B: 支付整合狀態

完成:
1. Stripe API+webhooks
2. 支付意圖流
3. 訂閱端點
4. 發票系統
5. 退款邏輯

待辦:
1. 貨幣轉換(需匯率API)
2. 稅務整合
3. 支付失敗重試
4. 審計日誌

阻塞:
• 等法務審條款
• 需DevOps提供Prod密鑰

下步:
1. EOD完成貨幣轉換
2. 約法務會議
3. 協調DevOps密鑰輪換

審PR#456`
  },
  {
    name: "ΩCoder System Prompt",
    english: `You are a CTO companion. Engineering Laws:
• Never push to main; always feature branch → PR → CI pass → merge.
• Must test: unit + integration + e2e.
• Security: no hardcoded secrets / no privilege escalation / no unreviewed data deletion.
User Protection: If user does risky actions → issue warning + correction.
Style: Concise/professional.`,
    omega: `你為CTO伴腦。工程強律:
• 禁推main；一律feat分支→PR→CI pass→merge。
• 必測：單元+整合+端對端。
• 安全：禁硬編密鑰/禁越權請求/禁未審查刪資料。
用戶保護: 若用戶做高風險→發警告+改正序列。
文態: 簡/專業。`
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPRESSION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function compress(text, algorithm) {
  const buffer = Buffer.from(text, 'utf-8');
  switch (algorithm) {
    case 'gzip':
      return gzipSync(buffer);
    case 'brotli':
      return brotliCompressSync(buffer);
    case 'none':
      return buffer;
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}

function analyze(name, english, omega) {
  const results = {
    name,
    english: {
      chars: english.length,
      bytes: Buffer.from(english, 'utf-8').length,
      gzip: compress(english, 'gzip').length,
      brotli: compress(english, 'brotli').length
    },
    omega: {
      chars: omega.length,
      bytes: Buffer.from(omega, 'utf-8').length,
      gzip: compress(omega, 'gzip').length,
      brotli: compress(omega, 'brotli').length
    }
  };
  
  // Calculate savings
  results.savings = {
    charReduction: ((1 - results.omega.chars / results.english.chars) * 100).toFixed(1),
    byteReduction: ((1 - results.omega.bytes / results.english.bytes) * 100).toFixed(1),
    omegaVsEnglishGzip: ((1 - results.omega.gzip / results.english.gzip) * 100).toFixed(1),
    omegaVsEnglishBrotli: ((1 - results.omega.brotli / results.english.brotli) * 100).toFixed(1),
    omegaBrotliVsEnglishRaw: ((1 - results.omega.brotli / results.english.bytes) * 100).toFixed(1),
    bestOmega: Math.min(results.omega.bytes, results.omega.gzip, results.omega.brotli),
    bestEnglish: Math.min(results.english.bytes, results.english.gzip, results.english.brotli)
  };
  
  results.savings.totalSavings = ((1 - results.savings.bestOmega / results.savings.bestEnglish) * 100).toFixed(1);
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║         OMEGA + WIRE COMPRESSION STACK TEST                      ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

const allResults = [];

for (const tc of TEST_CASES) {
  const result = analyze(tc.name, tc.english, tc.omega);
  allResults.push(result);
  
  console.log(`\n━━━ ${tc.name} ━━━`);
  console.log(`English: ${result.english.chars} chars → ${result.english.bytes} bytes`);
  console.log(`  gzip: ${result.english.gzip} bytes | brotli: ${result.english.brotli} bytes`);
  console.log(`Omega:   ${result.omega.chars} chars → ${result.omega.bytes} bytes`);
  console.log(`  gzip: ${result.omega.gzip} bytes | brotli: ${result.omega.brotli} bytes`);
  console.log(`\nSavings:`);
  console.log(`  Char reduction: ${result.savings.charReduction}%`);
  console.log(`  Byte reduction: ${result.savings.byteReduction}%`);
  console.log(`  Omega+brotli vs English raw: ${result.savings.omegaBrotliVsEnglishRaw}%`);
  console.log(`  Best Omega (${result.savings.bestOmega}b) vs Best English (${result.savings.bestEnglish}b): ${result.savings.totalSavings}%`);
}

console.log('\n\n═══════════════════════════════════════════════════════════════════');
console.log('SUMMARY: Optimal Compression Strategy');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('| Message Type | Best Strategy | Total Savings |');
console.log('|--------------|---------------|---------------|');
for (const r of allResults) {
  const bestStrategy = r.omega.brotli < r.omega.bytes ? 'Omega+brotli' : 'Omega only';
  console.log(`| ${r.name.padEnd(12).slice(0,12)} | ${bestStrategy.padEnd(13)} | ${r.savings.totalSavings.padStart(12)}% |`);
}

console.log('\n✅ Test complete!');

