/**
 * Model Manager - Handles model selection, download, and switching
 * 
 * CHANGE MODEL: Edit AVAILABLE_MODELS to add new models
 * Models must be GGUF format compatible with llama.cpp
 */

// Available models - add new ones here
export const AVAILABLE_MODELS = {
  qwen: {
    id: 'qwen',
    repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    // Try different quantization variants
    files: [
      'qwen2.5-1.5b-instruct-q4_k_m.gguf',
      'qwen2.5-1.5b-instruct-q4_0.gguf',
      'qwen2.5-1.5b-instruct-q5_k_m.gguf'
    ],
    displayName: 'Qwen 2.5 1.5B Instruct',
    size: '~1GB',
    quality: 'Excellent',
    qualityNote: 'Native Chinese support - best for Omega DSL',
    speed: 'Fast',
    recommended: true,
    isDefault: true
  },
  tinyllama: {
    id: 'tinyllama',
    repo: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF',
    files: [
      'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
      'tinyllama-1.1b-chat-v1.0.Q4_0.gguf'
    ],
    displayName: 'TinyLlama 1.1B Chat',
    size: '~600MB',
    quality: 'Moderate',
    qualityNote: 'Fast but less accurate with Chinese characters',
    speed: 'Very Fast',
    recommended: false,
    isDefault: false
  }
};

// Runtime state
let currentModel = null;
let modelInstances = {};
let config = {
  defaultModel: 'qwen',
  enabledModels: ['qwen', 'tinyllama'],
  initialized: false
};

/**
 * Initialize model manager
 */
export function initModelManager() {
  // Load config from storage if available
  try {
    // TODO: Load from persistent storage
    config.initialized = true;
  } catch (e) {
    console.warn('Could not load model config, using defaults');
  }
  return config;
}

/**
 * Get list of all available models with their metadata
 */
export function listModels() {
  return Object.values(AVAILABLE_MODELS).map(model => ({
    ...model,
    enabled: config.enabledModels.includes(model.id),
    isCurrentDefault: config.defaultModel === model.id,
    isLoaded: !!modelInstances[model.id]
  }));
}

/**
 * Get a specific model's configuration
 */
export function getModel(modelId) {
  return AVAILABLE_MODELS[modelId] || null;
}

/**
 * Get the default model
 */
export function getDefaultModel() {
  return AVAILABLE_MODELS[config.defaultModel] || AVAILABLE_MODELS.qwen;
}

/**
 * Set the default model
 */
export function setDefaultModel(modelId) {
  if (!AVAILABLE_MODELS[modelId]) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  config.defaultModel = modelId;
  return getDefaultModel();
}

/**
 * Enable/disable a model
 */
export function setModelEnabled(modelId, enabled) {
  if (!AVAILABLE_MODELS[modelId]) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  
  if (enabled && !config.enabledModels.includes(modelId)) {
    config.enabledModels.push(modelId);
  } else if (!enabled) {
    config.enabledModels = config.enabledModels.filter(id => id !== modelId);
    // Can't disable the default model
    if (modelId === config.defaultModel && config.enabledModels.length > 0) {
      config.defaultModel = config.enabledModels[0];
    }
  }
  
  return listModels();
}

/**
 * Create HuggingFace model spec for Elide LLM API
 */
export function createModelSpec(modelId, llmModule) {
  const modelConfig = AVAILABLE_MODELS[modelId];
  if (!modelConfig) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  
  // Use the first available file variant
  const modelFile = modelConfig.files[0];
  
  return llmModule.huggingface({
    repo: modelConfig.repo,
    model: modelFile,
    name: modelFile
  });
}

/**
 * Get or create a cached model instance
 */
export function getModelInstance(modelId, llmModule) {
  if (!modelInstances[modelId]) {
    modelInstances[modelId] = createModelSpec(modelId, llmModule);
  }
  return modelInstances[modelId];
}

/**
 * Clear cached model instances
 */
export function clearModelCache() {
  modelInstances = {};
}

/**
 * Get current configuration
 */
export function getConfig() {
  return { ...config };
}

/**
 * Update configuration
 */
export function updateConfig(updates) {
  if (updates.defaultModel && AVAILABLE_MODELS[updates.defaultModel]) {
    config.defaultModel = updates.defaultModel;
  }
  if (updates.enabledModels) {
    config.enabledModels = updates.enabledModels.filter(id => AVAILABLE_MODELS[id]);
  }
  return getConfig();
}

export default {
  AVAILABLE_MODELS,
  initModelManager,
  listModels,
  getModel,
  getDefaultModel,
  setDefaultModel,
  setModelEnabled,
  createModelSpec,
  getModelInstance,
  clearModelCache,
  getConfig,
  updateConfig
};
