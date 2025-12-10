/**
 * Omega Compressor E2E Tests
 * 
 * Run with Playwright MCP server
 * Requires server running at http://localhost:3000
 */

// Test configuration
const BASE_URL = 'http://localhost:3000';

// Sample specs for testing
const SAMPLE_SPECS = {
  simple: `You are a helpful assistant. Be concise.`,
  
  medium: `You are a helpful coding assistant. Always prioritize understanding the user's true intent over their literal words. Be concise but thorough. Admit uncertainty when you don't know something.`,
  
  complex: `You are a senior software engineer and architect. When receiving a request, follow this process:
1. First analyze the problem domain and identify key constraints
2. Gather relevant context from the codebase
3. Form a hypothesis about the best solution approach
4. Implement the solution incrementally with proper error handling
5. Write tests to verify the implementation
6. Document your decisions and trade-offs

Always use best practices for:
- Error handling and logging
- Code organization and modularity
- Performance optimization
- Security considerations

If you're uncertain about something, clearly state your uncertainty and provide alternatives. Never make up information - if you don't know, say so.`
};

// Expected compression targets
const EXPECTED_COMPRESSION = {
  simple: { min: 3, max: 10 },    // 3-10x compression
  medium: { min: 5, max: 15 },   // 5-15x compression
  complex: { min: 7, max: 20 }   // 7-20x compression
};

/**
 * E2E Test Runner
 * Uses Playwright MCP for browser automation
 */
export async function runE2ETests(playwright) {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  async function test(name, fn) {
    console.log(`\n🧪 ${name}`);
    try {
      await fn();
      console.log(`   ✅ Passed`);
      results.passed++;
      results.tests.push({ name, passed: true });
    } catch (e) {
      console.log(`   ❌ Failed: ${e.message}`);
      results.failed++;
      results.tests.push({ name, passed: false, error: e.message });
    }
  }

  // Navigate to app
  await playwright.navigate(BASE_URL);
  await playwright.waitFor({ time: 2 });

  // Test: Page loads
  await test('Page loads successfully', async () => {
    const snapshot = await playwright.snapshot();
    if (!snapshot.includes('Omega Compressor')) {
      throw new Error('Page title not found');
    }
  });

  // Test: Model selector exists
  await test('Model selector is present', async () => {
    const snapshot = await playwright.snapshot();
    if (!snapshot.includes('Model:')) {
      throw new Error('Model selector not found');
    }
  });

  // Test: Simple compression
  await test('Simple spec compression works', async () => {
    // Type spec
    await playwright.type({
      ref: 'specInput',
      text: SAMPLE_SPECS.simple,
      element: 'Specification input textarea'
    });

    // Click compress
    await playwright.click({
      ref: 'compressBtn',
      element: 'Compress button'
    });

    // Wait for result
    await playwright.waitFor({ time: 10 });

    // Check output
    const snapshot = await playwright.snapshot();
    if (!snapshot.includes('Ω') && !snapshot.includes('核')) {
      throw new Error('Omega output not found');
    }
  });

  // Test: Stats display
  await test('Compression stats are displayed', async () => {
    const snapshot = await playwright.snapshot();
    if (!snapshot.includes('Compression') || !snapshot.includes('x')) {
      throw new Error('Stats not displayed');
    }
  });

  // Test: Model comparison
  await test('Model comparison works', async () => {
    // Clear and enter new spec
    await playwright.click({
      ref: 'clearBtn',
      element: 'Clear button'
    });

    await playwright.type({
      ref: 'specInput',
      text: SAMPLE_SPECS.medium,
      element: 'Specification input textarea'
    });

    // Click compare
    await playwright.click({
      ref: 'compareBtn',
      element: 'Compare Models button'
    });

    // Wait for results
    await playwright.waitFor({ time: 30 });

    // Check comparison grid
    const snapshot = await playwright.snapshot();
    if (!snapshot.includes('Best')) {
      throw new Error('Comparison results not shown');
    }
  });

  // Test: Test agent
  await test('Test agent chat works', async () => {
    // First compress something
    await playwright.click({
      ref: 'compressBtn',
      element: 'Compress button'
    });
    await playwright.waitFor({ time: 10 });

    // Open test agent
    await playwright.click({
      ref: 'testAgentBtn',
      element: 'Test This Kernel button'
    });

    // Type message
    await playwright.type({
      ref: 'chatInput',
      text: 'Hello, can you help me?',
      element: 'Chat input'
    });

    // Send
    await playwright.click({
      element: 'Send button'
    });

    // Wait for response
    await playwright.waitFor({ time: 15 });

    // Check for response
    const snapshot = await playwright.snapshot();
    if (!snapshot.includes('assistant')) {
      throw new Error('Agent response not received');
    }
  });

  // Summary
  console.log('\n====================================');
  console.log(`E2E Results: ${results.passed} passed, ${results.failed} failed`);
  console.log('====================================\n');

  return results;
}

/**
 * API Tests (no browser needed)
 */
export async function runAPITests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  async function test(name, fn) {
    console.log(`\n🧪 ${name}`);
    try {
      await fn();
      console.log(`   ✅ Passed`);
      results.passed++;
      results.tests.push({ name, passed: true });
    } catch (e) {
      console.log(`   ❌ Failed: ${e.message}`);
      results.failed++;
      results.tests.push({ name, passed: false, error: e.message });
    }
  }

  // Health check
  await test('Health endpoint returns OK', async () => {
    const resp = await fetch(`${BASE_URL}/api/health`);
    const data = await resp.json();
    if (!data.success || data.status !== 'healthy') {
      throw new Error('Health check failed');
    }
  });

  // Models endpoint
  await test('Models endpoint returns list', async () => {
    const resp = await fetch(`${BASE_URL}/api/models`);
    const data = await resp.json();
    if (!data.success || !Array.isArray(data.models) || data.models.length < 2) {
      throw new Error('Models list invalid');
    }
  });

  // Compression endpoint
  await test('Compress endpoint works', async () => {
    const resp = await fetch(`${BASE_URL}/api/compress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: SAMPLE_SPECS.simple })
    });
    const data = await resp.json();
    if (!data.success || !data.omega || !data.omega.includes('Ω')) {
      throw new Error('Compression failed: ' + JSON.stringify(data));
    }
    console.log(`   Compression ratio: ${data.stats.charRatio}x`);
  });

  // Compression ratio check
  await test('Compression achieves target ratio', async () => {
    const resp = await fetch(`${BASE_URL}/api/compress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: SAMPLE_SPECS.complex })
    });
    const data = await resp.json();
    if (!data.success) {
      throw new Error('Compression failed');
    }
    const ratio = data.stats.charRatio;
    const target = EXPECTED_COMPRESSION.complex;
    if (ratio < target.min) {
      throw new Error(`Compression ratio ${ratio}x is below target ${target.min}x`);
    }
    console.log(`   Achieved ${ratio}x compression (target: ${target.min}-${target.max}x)`);
  });

  // Test agent endpoint
  await test('Test agent endpoint works', async () => {
    // First get a kernel
    const compResp = await fetch(`${BASE_URL}/api/compress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: SAMPLE_SPECS.simple })
    });
    const compData = await compResp.json();
    
    // Then test chat
    const chatResp = await fetch(`${BASE_URL}/api/test-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        omegaKernel: compData.omega,
        message: 'Hello'
      })
    });
    const chatData = await chatResp.json();
    if (!chatData.success || !chatData.response) {
      throw new Error('Test agent failed');
    }
  });

  // Summary
  console.log('\n====================================');
  console.log(`API Results: ${results.passed} passed, ${results.failed} failed`);
  console.log('====================================\n');

  return results;
}

// Export for external use
export { SAMPLE_SPECS, EXPECTED_COMPRESSION, BASE_URL };
