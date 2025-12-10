/**
 * Omega Compressor Smoketest
 * 
 * Run with: elide run tests/smoketest.js
 * 
 * Tests basic functionality without requiring a running server
 */

console.log('🧪 Omega Compressor Smoketest');
console.log('============================\n');

// Import modules (use require for elide:*, dynamic import for local)
const llm = require('elide:llm');
const modelsModule = await import('../lib/models.js');
const promptsModule = await import('../lib/prompts.js');
const compressorModule = await import('../lib/compressor.js');
const agentModule = await import('../lib/agent.js');

// Destructure
const { initModelManager, listModels, getDefaultModel, AVAILABLE_MODELS } = modelsModule;
const { buildCompressPrompt, extractOmegaKernel, calculateStats, FEW_SHOT_EXAMPLES } = promptsModule;
const { initCompressor, compress, compressSync } = compressorModule;
const { initAgent, chat } = agentModule;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition, msg = '') {
  if (!condition) {
    throw new Error(msg || 'Assertion failed');
  }
}

// ============================================
// MODEL MANAGER TESTS
// ============================================

console.log('📦 Model Manager Tests\n');

test('initModelManager returns config', () => {
  const config = initModelManager();
  assertTrue(config !== null, 'Config should not be null');
  assertTrue(config.defaultModel === 'qwen', 'Default model should be qwen');
});

test('listModels returns array with models', () => {
  const models = listModels();
  assertTrue(Array.isArray(models), 'Should return array');
  assertTrue(models.length >= 2, 'Should have at least 2 models');
});

test('getDefaultModel returns qwen', () => {
  const model = getDefaultModel();
  assertEqual(model.id, 'qwen', 'Default model ID');
  assertTrue(model.displayName.includes('Qwen'), 'Should be Qwen model');
});

test('AVAILABLE_MODELS has correct structure', () => {
  assertTrue(AVAILABLE_MODELS.qwen !== undefined, 'Should have qwen');
  assertTrue(AVAILABLE_MODELS.tinyllama !== undefined, 'Should have tinyllama');
  assertTrue(AVAILABLE_MODELS.qwen.repo.includes('Qwen'), 'Qwen repo');
  assertTrue(AVAILABLE_MODELS.tinyllama.repo.includes('TinyLlama'), 'TinyLlama repo');
});

// ============================================
// PROMPTS TESTS
// ============================================

console.log('\n📝 Prompts Tests\n');

test('buildCompressPrompt includes spec', () => {
  const spec = 'Test specification';
  const prompt = buildCompressPrompt(spec);
  assertTrue(prompt.includes(spec), 'Prompt should include spec');
  assertTrue(prompt.includes('Omega Kernel Compiler'), 'Should have system prompt');
});

test('buildCompressPrompt includes few-shot examples', () => {
  const prompt = buildCompressPrompt('test');
  assertTrue(prompt.includes('Example 1:'), 'Should have example 1');
  assertTrue(prompt.includes('OUTPUT:'), 'Should have OUTPUT markers');
});

test('extractOmegaKernel cleans output', () => {
  const raw = 'Here is your kernel:\n\nΩ核: test\n\nThis is an explanation.';
  const kernel = extractOmegaKernel(raw);
  assertTrue(kernel.includes('Ω核'), 'Should preserve kernel');
  assertTrue(!kernel.includes('Here is'), 'Should remove preamble');
});

test('extractOmegaKernel handles code blocks', () => {
  const raw = '```\nΩ核: test\n```';
  const kernel = extractOmegaKernel(raw);
  assertTrue(kernel === 'Ω核: test', 'Should extract from code block');
});

test('calculateStats returns correct values', () => {
  const stats = calculateStats('Hello World', 'HW');
  assertEqual(stats.originalChars, 11, 'Original chars');
  assertEqual(stats.compressedChars, 2, 'Compressed chars');
  assertTrue(stats.charRatio > 5, 'Ratio should be > 5');
});

test('FEW_SHOT_EXAMPLES are valid', () => {
  assertTrue(FEW_SHOT_EXAMPLES.length >= 2, 'Should have examples');
  for (const ex of FEW_SHOT_EXAMPLES) {
    assertTrue(ex.input.length > 0, 'Input should not be empty');
    assertTrue(ex.output.includes('Ω'), 'Output should have Omega');
  }
});

// ============================================
// LLM MODULE TESTS
// ============================================

console.log('\n🤖 LLM Module Tests\n');

test('elide:llm module is available', () => {
  assertTrue(llm !== null, 'LLM module should exist');
  assertTrue(typeof llm.version === 'function', 'Should have version()');
  assertTrue(typeof llm.huggingface === 'function', 'Should have huggingface()');
  assertTrue(typeof llm.params === 'function', 'Should have params()');
});

test('llm.version() returns v1', () => {
  const version = llm.version();
  assertEqual(version, 'v1', 'LLM API version');
});

test('llm.params() returns params object', () => {
  const params = llm.params();
  assertTrue(params !== null, 'Params should exist');
});

test('llm.huggingface() creates model spec', () => {
  const model = llm.huggingface({
    repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    model: 'qwen2.5-1.5b-instruct-q4_k_m.gguf'
  });
  assertTrue(model !== null, 'Model spec should exist');
});

// ============================================
// COMPRESSOR TESTS (Integration)
// ============================================

console.log('\n🔮 Compressor Tests\n');

test('initCompressor accepts llm module', () => {
  initCompressor(llm);
  // No error means success
  assertTrue(true, 'Init should succeed');
});

// ============================================
// AGENT TESTS
// ============================================

console.log('\n🤖 Agent Tests\n');

test('initAgent accepts llm module', () => {
  initAgent(llm);
  assertTrue(true, 'Init should succeed');
});

// ============================================
// SUMMARY
// ============================================

console.log('\n============================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('============================\n');

if (failed > 0) {
  console.log('❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('✅ All smoketests passed!');
  console.log('\nNote: Full integration tests require running the server.');
  console.log('Run: elide run server.js');
  console.log('Then use Playwright for E2E tests.');
}
