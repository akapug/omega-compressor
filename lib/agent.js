/**
 * Test Agent - Chat with an agent using an Omega kernel
 * 
 * Allows validating that compressed kernels produce correct agent behavior
 */

const prompts = await import('./prompts.js');
const models = await import('./models.js');

const { buildTestAgentPrompt } = prompts;
const { getModelInstance, getDefaultModel } = models;

// LLM module reference (injected at runtime)
let llmModule = null;

// Active conversations (kernel -> message history)
const conversations = new Map();

/**
 * Initialize test agent with Elide LLM module
 * @param {object} llm - The elide:llm module
 */
export function initAgent(llm) {
  llmModule = llm;
}

/**
 * Get LLM parameters for chat
 */
function getChatParams() {
  return llmModule.params({
    allowDownload: true,
    contextSize: 4096,
    verbose: false
  });
}

/**
 * Create a unique conversation ID from a kernel
 */
function kernelToId(kernel) {
  // Simple hash for conversation tracking
  let hash = 0;
  for (let i = 0; i < kernel.length; i++) {
    const char = kernel.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `conv_${Math.abs(hash).toString(36)}`;
}

/**
 * Build chat prompt including conversation history
 */
function buildChatPrompt(systemPrompt, history, userMessage) {
  let prompt = systemPrompt + '\n\n';
  
  // Add conversation history
  for (const msg of history) {
    if (msg.role === 'user') {
      prompt += `User: ${msg.content}\n`;
    } else {
      prompt += `Assistant: ${msg.content}\n`;
    }
  }
  
  // Add current message
  prompt += `User: ${userMessage}\nAssistant:`;
  
  return prompt;
}

/**
 * Chat with a test agent using an Omega kernel
 * @param {string} omegaKernel - The Omega kernel to use as system prompt
 * @param {string} message - User message
 * @param {string} modelId - Model ID to use (or null for default)
 * @param {boolean} newConversation - Start a fresh conversation
 * @returns {Promise<object>} - Chat response
 */
export async function chat(omegaKernel, message, modelId = null, newConversation = false) {
  if (!llmModule) {
    throw new Error('Agent not initialized. Call initAgent() first.');
  }
  
  if (!omegaKernel || omegaKernel.trim().length === 0) {
    throw new Error('Omega kernel cannot be empty');
  }
  
  if (!message || message.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  
  const convId = kernelToId(omegaKernel);
  const targetModelId = modelId || getDefaultModel().id;
  const model = getModelInstance(targetModelId, llmModule);
  const params = getChatParams();
  
  // Get or create conversation history
  if (newConversation || !conversations.has(convId)) {
    conversations.set(convId, []);
  }
  const history = conversations.get(convId);
  
  // Build prompts
  const systemPrompt = buildTestAgentPrompt(omegaKernel);
  const fullPrompt = buildChatPrompt(systemPrompt, history, message);
  
  console.log(`[Agent] Conv ${convId}, ${history.length} prior messages`);
  console.log(`[Agent] Using model: ${targetModelId}`);
  
  const startTime = Date.now();
  
  try {
    const response = await llmModule.infer(params, model, fullPrompt);
    const elapsed = Date.now() - startTime;
    
    // Clean up response (remove any trailing "User:" if model continued)
    let cleanResponse = response.trim();
    const userIdx = cleanResponse.indexOf('\nUser:');
    if (userIdx > 0) {
      cleanResponse = cleanResponse.substring(0, userIdx).trim();
    }
    
    // Update history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: cleanResponse });
    
    // Limit history to last 10 exchanges (20 messages)
    while (history.length > 20) {
      history.shift();
    }
    
    console.log(`[Agent] Response in ${elapsed}ms`);
    
    return {
      success: true,
      conversationId: convId,
      message,
      response: cleanResponse,
      modelId: targetModelId,
      elapsed,
      historyLength: history.length
    };
  } catch (error) {
    console.error(`[Agent] Error:`, error);
    return {
      success: false,
      conversationId: convId,
      error: error.message || String(error),
      message
    };
  }
}

/**
 * Clear a conversation history
 * @param {string} omegaKernel - The kernel whose conversation to clear
 */
export function clearConversation(omegaKernel) {
  const convId = kernelToId(omegaKernel);
  conversations.delete(convId);
  return { cleared: true, conversationId: convId };
}

/**
 * Clear all conversations
 */
export function clearAllConversations() {
  const count = conversations.size;
  conversations.clear();
  return { cleared: count };
}

/**
 * Get conversation history
 * @param {string} omegaKernel - The kernel whose conversation to get
 */
export function getConversation(omegaKernel) {
  const convId = kernelToId(omegaKernel);
  return {
    conversationId: convId,
    history: conversations.get(convId) || []
  };
}

export default {
  initAgent,
  chat,
  clearConversation,
  clearAllConversations,
  getConversation
};
