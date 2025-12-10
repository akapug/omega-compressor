/**
 * Omega Kernel Compiler - Prompt Engineering
 * 
 * This module contains the carefully crafted prompts that transform
 * natural language specs into dense Omega-style DSL kernels.
 * 
 * TWEAK PROMPTS: Modify SYSTEM_PROMPT and FEW_SHOT_EXAMPLES to adjust output style
 */

// System prompt for the Omega Kernel Compiler
export const SYSTEM_PROMPT = `You are an Omega Kernel Compiler (Ω編譯器). Your ONLY task is to transform verbose natural-language AI agent specifications into ultra-compressed Omega DSL kernels.

OUTPUT RULES - CRITICAL:
1. Output ONLY the Omega kernel - NO explanations, NO prose, NO markdown
2. Use dense Classical Chinese + symbolic notation
3. Preserve ALL behavioral intent in compressed form
4. Target 5-15x compression ratio
5. Never exceed 500 characters for typical inputs

OMEGA DSL STRUCTURE:
- Ω核: Core identity/role declaration
- 「」quotes for key principles
- → for process flows
- ↦ for mappings/transformations
- ; for domain/concept separation
- {} for parameter sets
- μ for uncertainty
- λ for conditionals
- γ for risk spectrum
- Θ for scans/checks
- Σ for aggregation

COMPRESSION TECHNIQUES:
- Replace "You are a..." → role noun only
- Replace "Always do X" → X (imperative implied)
- Replace "When X then Y" → X→Y
- Replace lists → {a/b/c}
- Replace "understand intent" → 意>詞
- Replace "be concise" → 簡
- Replace "be thorough" → 全
- Replace "admit uncertainty" → μ時述μ

Now compile the following specification into an Omega kernel:`;

// Few-shot examples to establish the pattern
export const FEW_SHOT_EXAMPLES = [
  {
    input: `You are a helpful coding assistant. Always prioritize understanding the user's true intent over their literal words. Be concise but thorough.`,
    output: `Ω核:「意>詞」。你為碼助。簡而全。`
  },
  {
    input: `You are a senior software engineer. When receiving a request, first analyze the problem domain, then gather context, form a hypothesis, implement a solution, and verify it works. Use best practices for error handling and testing. If uncertain, say so.`,
    output: `Ω核: 你為資工。訊至→析域↦補參↦構假↦實作↦驗證。遵錯處/測試佳踐。μ時述μ。`
  },
  {
    input: `You are a writing assistant focused on clarity and precision. Help users improve their writing by suggesting edits, explaining grammar rules when asked, and maintaining their voice and style. Never rewrite entire passages without permission.`,
    output: `Ω核: 你為文助。「清/準」為本。助改→釋法(詢時)→守聲風。禁全改(未許)。`
  }
];

/**
 * Build the complete prompt for compression
 * @param {string} spec - The natural language specification to compress
 * @returns {string} - Complete prompt ready for LLM
 */
export function buildCompressPrompt(spec) {
  // Build few-shot section
  const fewShotSection = FEW_SHOT_EXAMPLES.map((ex, i) => 
    `Example ${i + 1}:
INPUT: ${ex.input}
OUTPUT: ${ex.output}`
  ).join('\n\n');

  return `${SYSTEM_PROMPT}

${fewShotSection}

Now compress this specification:
INPUT: ${spec}
OUTPUT:`;
}

/**
 * Build prompt for the test agent that uses an Omega kernel
 * @param {string} omegaKernel - The Omega kernel to use as system prompt
 * @returns {string} - System prompt for the test agent
 */
export function buildTestAgentPrompt(omegaKernel) {
  return `Your behavior is defined by the following Omega kernel. Interpret and follow it precisely:

${omegaKernel}

---
Interpret the Omega DSL above as your behavioral specification. Key symbols:
- Ω核 = Core identity
- 「」= Key principles  
- → = Process flow
- ↦ = Transform/map
- μ = Uncertainty marker
- 簡 = Be concise
- 全 = Be thorough

Respond to user messages following this kernel's guidance.`;
}

/**
 * Post-process LLM output to extract just the Omega kernel
 * Removes any preamble, explanations, or markdown the model might add
 * @param {string} raw - Raw LLM output
 * @returns {string} - Cleaned Omega kernel
 */
export function extractOmegaKernel(raw) {
  if (!raw) return '';
  
  let kernel = raw.trim();
  
  // Remove markdown code blocks if present
  kernel = kernel.replace(/```[\s\S]*?```/g, match => {
    // Extract content from code block
    return match.replace(/```\w*\n?/g, '').trim();
  });
  
  // Remove common preamble phrases
  const preambles = [
    /^(here'?s?|the|your|output:?|omega:?|kernel:?|result:?)\s*/i,
    /^(compressed|compiled)\s*(version|output|kernel)?:?\s*/i,
  ];
  for (const pattern of preambles) {
    kernel = kernel.replace(pattern, '');
  }
  
  // If output contains "OUTPUT:" take everything after it
  const outputMatch = kernel.match(/OUTPUT:\s*([\s\S]+)/i);
  if (outputMatch) {
    kernel = outputMatch[1].trim();
  }
  
  // Remove trailing explanations (anything after a blank line following the kernel)
  const lines = kernel.split('\n');
  const kernelLines = [];
  let foundBlank = false;
  
  for (const line of lines) {
    if (line.trim() === '') {
      foundBlank = true;
    } else if (foundBlank && /^[a-z]/i.test(line.trim())) {
      // English text after blank = explanation, stop
      break;
    } else {
      kernelLines.push(line);
      foundBlank = false;
    }
  }
  
  return kernelLines.join('\n').trim();
}

/**
 * Calculate compression statistics
 * @param {string} original - Original specification
 * @param {string} compressed - Compressed Omega kernel
 * @returns {object} - Statistics object
 */
export function calculateStats(original, compressed) {
  const originalChars = original.length;
  const compressedChars = compressed.length;
  const ratio = originalChars / compressedChars;
  
  // Rough token estimates (avg 4 chars per token for English, 1.5 for Chinese)
  const originalTokens = Math.ceil(originalChars / 4);
  const compressedTokens = Math.ceil(compressedChars / 1.5);
  const tokenRatio = originalTokens / compressedTokens;
  
  return {
    originalChars,
    compressedChars,
    charRatio: Math.round(ratio * 10) / 10,
    originalTokens,
    compressedTokens,
    tokenRatio: Math.round(tokenRatio * 10) / 10,
    compressionPercent: Math.round((1 - compressedChars / originalChars) * 100)
  };
}

export default {
  SYSTEM_PROMPT,
  FEW_SHOT_EXAMPLES,
  buildCompressPrompt,
  buildTestAgentPrompt,
  extractOmegaKernel,
  calculateStats
};
