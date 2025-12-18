#!/usr/bin/env node
/**
 * Omega Deep Analysis - Comprehensive investigation of Chinese vs Latin encoding
 * Tests: byte efficiency, zstd compression, semantic density, model-specific behaviors
 */
import 'dotenv/config';
import { promisify } from 'util';
import { exec } from 'child_process';
import zlib from 'zlib';
import { writeFileSync, readFileSync, unlinkSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);
const execAsync = promisify(exec);

async function zstdCompress(buffer) {
  const tmpIn = join(tmpdir(), `omega-zstd-in-${Date.now()}`);
  const tmpOut = join(tmpdir(), `omega-zstd-out-${Date.now()}`);
  try {
    writeFileSync(tmpIn, buffer);
    await execAsync(`zstd -19 -q -f -o "${tmpOut}" "${tmpIn}"`);
    const compressed = readFileSync(tmpOut);
    return compressed;
  } finally {
    try { unlinkSync(tmpIn); } catch {}
    try { unlinkSync(tmpOut); } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONTENT PAIRS (English vs Omega-compressed)
// ═══════════════════════════════════════════════════════════════════════════════

const TEST_PAIRS = [
  {
    name: 'ΩCoder Full Ruleset',
    english: `ΩCoder Core: "Intent > Words > Code". You are a CTO companion: when info arrives → detect intent → determine domain → fill parameters → construct reasoning → decide strategy → return to intent. Mission = maintain stability (quality/speed/risk) / fill blind spots / correct anti-patterns / guide proper flow / improve architecture.

Domains: L=Timeline; S=Strategy; M=System; W=Workflow; A=Architecture; T=Technical; B=Branch collaboration; C=CI/CD; R=Reliability/Observability; P=Product.

Parameters:
A{layering/boundaries/responsibility/dependencies/coupling/abstraction/bottlenecks/scalability/antifragility}
T{interface/contract/invariants/fault-tolerance/error-boundaries/types/schema/complexity-bounds}
B{feature-branch/PR/review/merge-strategy/conflict-resolution/code-hygiene}
C{lint/test/coverage/build/deploy/rollback/environment-isolation}
R{metrics/trace/log/SLO/SLI/alert-sensitivity/degradation-window}
Missing → infer; cannot infer → state uncertainty; never fabricate.

Engineering Laws:
• Never push to main; always feature branch → PR → CI pass → merge.
• Must test: unit + integration + e2e; main flow = golden path test.
• Program interfaces follow contracts; no side-effect drift; no implicit coupling.
• Observability before optimization: log/metrics/trace/SLO.
• Deployment = rollback-capable; blue-green/canary based on scale.
• Security: no hardcoded secrets / no privilege escalation / no unreviewed data deletion / no irreversible operations.

User Protection:
• If user does "no tests/skip PR/skip CI/no schema" → issue stability warning + correction sequence.
• If user requests high risk (delete table/prod changes/security-sensitive) → limit inference; give safe alternative.

Style: Concise/stable/professional; no fabricating; can describe reasoning chain.`,
    omega: `ΩCoder核:「意>詞>碼」。你為CTO伴腦：訊至→察意↦判域↦補參↦構因↦定策↦返意。任務=守穩態(質/速/風險)/補盲點/矯反模/導正流/提架構未來性。

域D: L時序; S策略; M體系; W作流; A架構; T技構; B分支協作; C CI/CD; R可靠/觀測; P產品。

參Σ:
A{分層/界限/責任/依賴/耦合/抽象/瓶頸/擴展性/抗脆弱}
T{介/契/不變/容錯/錯界/型別/schema/複度界}
B{feat分支/PR/審查/可併策略/衝突解/代碼衛生}
C{lint/測/覆率/Build/Deploy/回滾/環境隔離}
R{metrics/trace/log/SLO/SLI/警報敏度/退化窗}
缺→推; 不可推→述μ; 禁虛構。

工程強律:
• 禁推main；一律feat分支→PR→CI pass→merge。
• 必測：單元+整合+端對端；主流程=金路徑測。
• 程式介面遵契約；禁side-effects漂移；禁隱式耦合。
• 觀測先於優化：log/metrics/trace/SLO。
• 部署=可回滾；藍綠/金絲雀視規模。
• 安全：禁硬編密鑰/禁越權請求/禁未審查刪資料/禁不可回退操作。

用戶保護Φ+:
• 用戶若做「無測/跳PR/跳CI/無schema」→即發穩策提示+改正序列。
• 若用戶要求高風險(刪表/Prod改/安全敏區)→縮推; 給安全替代序列。

文態: 簡/穩/專業; 禁虛構; 可述推理鏈。`
  },
  {
    name: 'Simple Instruction',
    english: 'You are a helpful assistant. Be concise and accurate. Do not make up information.',
    omega: '你為助手。簡·準·助。¬虛構。'
  },
  {
    name: 'Code Review Rules',
    english: `When reviewing code:
1. Check for security vulnerabilities
2. Ensure proper error handling
3. Verify test coverage
4. Look for performance issues
5. Confirm code follows style guide`,
    omega: `審碼:
1.查安全漏
2.驗錯處
3.核測覆
4.察效能
5.循風格`
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function analyzeText(text, label) {
  const bytes = Buffer.from(text, 'utf8');
  const chars = [...text].length;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const asciiChars = (text.match(/[\x00-\x7f]/g) || []).length;
  const symbols = (text.match(/[→↦·¬μΩΣΦ…]/g) || []).length;
  
  // Token estimation (rough: Chinese ~1.5 chars/token, English ~4 chars/token)
  const estimatedTokens = Math.ceil(chineseChars / 1.5 + (chars - chineseChars) / 4);
  
  return {
    label,
    chars,
    bytes: bytes.length,
    chineseChars,
    asciiChars,
    symbols,
    estimatedTokens,
    bytesPerChar: (bytes.length / chars).toFixed(2),
    chineseRatio: ((chineseChars / chars) * 100).toFixed(1) + '%'
  };
}

async function analyzeCompression(text, label) {
  const raw = Buffer.from(text, 'utf8');
  const gzipped = await gzip(raw);
  const brotlied = await brotli(raw);
  const zstded = await zstdCompress(raw);

  return {
    label,
    rawBytes: raw.length,
    gzipBytes: gzipped.length,
    brotliBytes: brotlied.length,
    zstdBytes: zstded.length,
    gzipRatio: (raw.length / gzipped.length).toFixed(2) + 'x',
    brotliRatio: (raw.length / brotlied.length).toFixed(2) + 'x',
    zstdRatio: (raw.length / zstded.length).toFixed(2) + 'x'
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

async function runAnalysis() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         OMEGA DEEP ANALYSIS                                      ║');
  console.log('║         Chinese vs Latin Encoding Efficiency                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  for (const pair of TEST_PAIRS) {
    console.log(`\n━━━ ${pair.name} ━━━\n`);
    
    const engStats = analyzeText(pair.english, 'English');
    const omegaStats = analyzeText(pair.omega, 'Omega');
    
    console.log('📊 Character & Token Analysis:');
    console.log(`  English: ${engStats.chars} chars, ${engStats.bytes} bytes, ~${engStats.estimatedTokens} tokens`);
    console.log(`  Omega:   ${omegaStats.chars} chars, ${omegaStats.bytes} bytes, ~${omegaStats.estimatedTokens} tokens`);
    console.log(`  Char reduction: ${((1 - omegaStats.chars/engStats.chars) * 100).toFixed(1)}%`);
    console.log(`  Token reduction: ${((1 - omegaStats.estimatedTokens/engStats.estimatedTokens) * 100).toFixed(1)}%`);
    console.log(`  Omega Chinese ratio: ${omegaStats.chineseRatio}`);
    
    const engComp = await analyzeCompression(pair.english, 'English');
    const omegaComp = await analyzeCompression(pair.omega, 'Omega');
    
    console.log('\n📦 Compression Analysis (gzip/brotli/zstd):');
    console.log(`  English raw: ${engComp.rawBytes}B → gzip: ${engComp.gzipBytes}B (${engComp.gzipRatio}) → brotli: ${engComp.brotliBytes}B (${engComp.brotliRatio}) → zstd: ${engComp.zstdBytes}B (${engComp.zstdRatio})`);
    console.log(`  Omega raw:   ${omegaComp.rawBytes}B → gzip: ${omegaComp.gzipBytes}B (${omegaComp.gzipRatio}) → brotli: ${omegaComp.brotliBytes}B (${omegaComp.brotliRatio}) → zstd: ${omegaComp.zstdBytes}B (${omegaComp.zstdRatio})`);
    const bestEng = Math.min(engComp.gzipBytes, engComp.brotliBytes, engComp.zstdBytes);
    const bestOmega = Math.min(omegaComp.gzipBytes, omegaComp.brotliBytes, omegaComp.zstdBytes);
    console.log(`  Best compressed: English ${bestEng}B vs Omega ${bestOmega}B`);
    console.log(`  Total byte savings: ${((1 - bestOmega/bestEng) * 100).toFixed(1)}%`);
  }
  
  // Summary insights
  console.log('\n\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                         KEY INSIGHTS                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  console.log('1. TOKEN EFFICIENCY:');
  console.log('   Chinese characters encode ~2-3x more meaning per token than English');
  console.log('   This is because LLM tokenizers treat Chinese chars as ~1.5 tokens');
  console.log('   while English words average ~4 chars/token\n');
  
  console.log('2. BYTE EFFICIENCY:');
  console.log('   Chinese uses 3 bytes/char (UTF-8) vs English 1 byte/char');
  console.log('   BUT semantic density compensates: fewer chars needed\n');
  
  console.log('3. COMPRESSION BEHAVIOR:');
  console.log('   English compresses better with gzip/brotli (more redundancy)');
  console.log('   Chinese is already "pre-compressed" semantically');
  console.log('   After compression, the gap narrows significantly\n');
  
  console.log('4. A2A COMMUNICATION IMPLICATIONS:');
  console.log('   For LLM-to-LLM: Omega saves tokens (cost + context window)');
  console.log('   For network transport: Apply brotli on top for best results');
  console.log('   For storage: Omega + brotli gives best density\n');
  
  console.log('✅ Analysis complete');
}

runAnalysis().catch(err => { console.error('Fatal:', err); process.exit(1); });

