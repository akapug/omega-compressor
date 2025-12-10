/**
 * Omega Compressor - Core compression logic
 * 
 * Handles LLM calls and compression orchestration
 */

const prompts = await import('./prompts.js');
const models = await import('./models.js');

const { buildCompressPrompt, extractOmegaKernel, calculateStats } = prompts;
const { getModelInstance, getDefaultModel, listModels } = models;

// LLM module reference (injected at runtime)
let llmModule = null;

/**
 * Initialize compressor with Elide LLM module
 * @param {object} llm - The elide:llm module
 */
export function initCompressor(llm) {
  llmModule = llm;
}

/**
 * Get LLM parameters optimized for compression
 */
function getInferenceParams() {
  return llmModule.params({
    allowDownload: true,
    contextSize: 4096,
    verbose: false
  });
}

/**
 * Compress a specification using a specific model
 * @param {string} spec - Natural language specification
 * @param {string} modelId - Model ID to use (or null for default)
 * @returns {Promise<object>} - Compression result
 */
export async function compress(spec, modelId = null) {
  if (!llmModule) {
    throw new Error('Compressor not initialized. Call initCompressor() first.');
  }
  
  if (!spec || spec.trim().length === 0) {
    throw new Error('Specification cannot be empty');
  }
  
  const targetModelId = modelId || getDefaultModel().id;
  const model = getModelInstance(targetModelId, llmModule);
  const params = getInferenceParams();
  const prompt = buildCompressPrompt(spec);
  
  console.log(`[Compressor] Using model: ${targetModelId}`);
  console.log(`[Compressor] Spec length: ${spec.length} chars`);
  
  const startTime = Date.now();
  
  try {
    // Use async inference
    const rawOutput = await llmModule.infer(params, model, prompt);
    const elapsed = Date.now() - startTime;
    
    // Extract and clean the omega kernel
    const omega = extractOmegaKernel(rawOutput);
    const stats = calculateStats(spec, omega);
    
    console.log(`[Compressor] Done in ${elapsed}ms. Compression: ${stats.charRatio}x`);
    
    return {
      success: true,
      modelId: targetModelId,
      original: spec,
      omega,
      stats,
      elapsed,
      raw: rawOutput // Include raw for debugging
    };
  } catch (error) {
    console.error(`[Compressor] Error:`, error);
    return {
      success: false,
      modelId: targetModelId,
      error: error.message || String(error),
      original: spec
    };
  }
}

/**
 * Compress synchronously (for simple cases)
 * @param {string} spec - Natural language specification
 * @param {string} modelId - Model ID to use (or null for default)
 * @returns {object} - Compression result
 */
export function compressSync(spec, modelId = null) {
  if (!llmModule) {
    throw new Error('Compressor not initialized. Call initCompressor() first.');
  }
  
  if (!spec || spec.trim().length === 0) {
    throw new Error('Specification cannot be empty');
  }
  
  const targetModelId = modelId || getDefaultModel().id;
  const model = getModelInstance(targetModelId, llmModule);
  const params = getInferenceParams();
  const prompt = buildCompressPrompt(spec);
  
  console.log(`[Compressor/Sync] Using model: ${targetModelId}`);
  
  const startTime = Date.now();
  
  try {
    const rawOutput = llmModule.inferSync(params, model, prompt);
    const elapsed = Date.now() - startTime;
    
    const omega = extractOmegaKernel(rawOutput);
    const stats = calculateStats(spec, omega);
    
    console.log(`[Compressor/Sync] Done in ${elapsed}ms. Compression: ${stats.charRatio}x`);
    
    return {
      success: true,
      modelId: targetModelId,
      original: spec,
      omega,
      stats,
      elapsed,
      raw: rawOutput
    };
  } catch (error) {
    console.error(`[Compressor/Sync] Error:`, error);
    return {
      success: false,
      modelId: targetModelId,
      error: error.message || String(error),
      original: spec
    };
  }
}

/**
 * Compare compression across multiple models
 * @param {string} spec - Natural language specification
 * @param {string[]} modelIds - Array of model IDs to compare (or null for all enabled)
 * @returns {Promise<object>} - Comparison results
 */
export async function compare(spec, modelIds = null) {
  if (!llmModule) {
    throw new Error('Compressor not initialized. Call initCompressor() first.');
  }
  
  // Get models to compare
  const models = listModels().filter(m => m.enabled);
  const targetIds = modelIds || models.map(m => m.id);
  
  console.log(`[Compressor] Comparing ${targetIds.length} models...`);
  
  const results = {};
  const startTime = Date.now();
  
  // Run compression with each model
  for (const modelId of targetIds) {
    console.log(`[Compressor] Running ${modelId}...`);
    results[modelId] = await compress(spec, modelId);
  }
  
  const totalElapsed = Date.now() - startTime;
  
  // Find best result (highest compression ratio)
  let bestModelId = null;
  let bestRatio = 0;
  
  for (const [modelId, result] of Object.entries(results)) {
    if (result.success && result.stats.charRatio > bestRatio) {
      bestRatio = result.stats.charRatio;
      bestModelId = modelId;
    }
  }
  
  return {
    success: true,
    original: spec,
    results,
    bestModelId,
    bestRatio,
    totalElapsed,
    modelsCompared: targetIds.length
  };
}

export default {
  initCompressor,
  compress,
  compressSync,
  compare
};
