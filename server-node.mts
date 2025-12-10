// Omega Compressor - Elide Server using Node.js http module
// Run with: elide server-node.mts

import http from 'node:http';
import zlib from 'node:zlib';

console.log('🔮 Omega Compressor initializing...');

// Binary compression helpers (gzip for transport)
function gzipCompress(text: string): Buffer {
  return zlib.gzipSync(Buffer.from(text, 'utf-8'));
}

function gzipDecompress(compressed: Buffer): string {
  return zlib.gunzipSync(compressed).toString('utf-8');
}

// Base64 helpers for transport
function toBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

function fromBase64(b64: string): Buffer {
  return Buffer.from(b64, 'base64');
}

const llm = require('elide:llm');
console.log('LLM API version:', llm.version());

const PORT = 8080;

const MODELS = {
  // Qwen 2.5 3B - better for translation tasks, still relatively small
  qwen3b: { id: 'qwen3b', repo: 'Qwen/Qwen2.5-3B-Instruct-GGUF', file: 'qwen2.5-3b-instruct-q4_k_m.gguf', displayName: 'Qwen 2.5 3B', maxInputChars: 2000 },
  // Qwen 2.5 1.5B - smallest Qwen  
  qwen: { id: 'qwen', repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF', file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', displayName: 'Qwen 2.5 1.5B', maxInputChars: 1000 },
  // Phi-3 Mini - Microsoft's efficient small model
  phi3: { id: 'phi3', repo: 'microsoft/Phi-3-mini-4k-instruct-gguf', file: 'Phi-3-mini-4k-instruct-q4.gguf', displayName: 'Phi-3 Mini 4K', maxInputChars: 3000 },
  tinyllama: { id: 'tinyllama', repo: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF', file: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf', displayName: 'TinyLlama 1.1B', maxInputChars: 500 }
};
let defaultModelId = 'tinyllama';  // Use TinyLlama by default (fastest on CPU)

// Get max input chars for a model (or default)
function getMaxInputChars(modelId: string): number {
  const m = MODELS[modelId] || MODELS[defaultModelId];
  return m?.maxInputChars || 1500;
}

function getModelSpec(modelId: string) {
  // Handle custom model format: "custom:repo/file.gguf"
  if (modelId.startsWith('custom:')) {
    const customPath = modelId.substring(7);
    const lastSlash = customPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const repo = customPath.substring(0, lastSlash);
      const file = customPath.substring(lastSlash + 1);
      console.log(`[getModelSpec] Using custom model: repo=${repo}, file=${file}`);
      return llm.huggingface({ repo, name: file });
    }
  }
  const m = MODELS[modelId] || MODELS[defaultModelId];
  return llm.huggingface({ repo: m.repo, name: m.file });
}

// Comprehensive semantic dictionary for Omega compression
// Organized by: phrases (longest first), then single words
const PHRASE_MAP: Record<string, string> = {
  // Multi-word phrases → single symbols (highest compression)
  'you are a': '你為', 'you are an': '你為', 'you are': '你為',
  'when you receive': '訊至→', 'when receiving': '訊至→',
  'in order to': '以', 'as well as': '及', 'such as': '如',
  'make sure': '確保', 'do not': '勿', 'if you': '若',
  'based on': '據', 'according to': '據',
  'at the same time': '並', 'on the other hand': '另',
  'for example': '例', 'in this case': '此況',
  'keep in mind': '記', 'be aware': '注',
  'take into account': '慮', 'pay attention': '注',
  'step by step': '步步', 'one by one': '逐一',
  'as soon as': '即', 'right away': '即',
  'more than': '逾', 'less than': '少於',
  'at least': '至少', 'at most': '至多',
  'in addition': '且', 'furthermore': '且',
  'however': '然', 'therefore': '故', 'because': '因',
  'although': '雖', 'unless': '除非', 'until': '至',
  'before you': '先', 'after you': '後',
  'instead of': '替', 'rather than': '替',
  'as long as': '只要', 'provided that': '若',
  'in case of': '若遇', 'in the event': '若遇',
  'with respect to': '關於', 'regarding': '關於',
  'focus on': '專注', 'concentrate on': '專注',
  'think about': '思', 'consider': '慮',
  'be careful': '慎', 'be cautious': '慎',
  'important to': '要', 'necessary to': '須',
  'able to': '能', 'capable of': '能',
  'responsible for': '責', 'in charge of': '責',
  'dealing with': '處', 'working with': '與',
  'looking for': '尋', 'searching for': '尋',
  'waiting for': '待', 'expecting': '待',
  
  // Agent-specific phrases
  'prioritize understanding': '意>詞',
  'true intent': '真意', 'literal words': '字面',
  'user intent': '用意', "user's intent": '用意',
  'admit uncertainty': 'μ時述μ',
  'when uncertain': 'μ時', "don't know": '不知',
  'be concise': '簡', 'be thorough': '詳',
  'be accurate': '準', 'be helpful': '助',
  'be friendly': '親', 'be professional': '專業',
  
  // Technical phrases
  'edge case': '邊界', 'edge cases': '邊界',
  'error handling': '錯處', 'exception handling': '例外處',
  'best practice': '優踐', 'best practices': '優踐',
  'code review': '碼審', 'pull request': 'PR', 'pull requests': 'PR',
  'unit test': '單測', 'unit tests': '單測',
  'integration test': '整測', 'integration tests': '整測',
  'end to end': 'E2E', 'e2e test': 'E2E測', 'e2e tests': 'E2E測',
  'continuous integration': 'CI', 'continuous deployment': 'CD', 'ci/cd': 'CI/CD',
  'version control': '版控', 'source control': '源控',
  'machine learning': 'ML', 'artificial intelligence': 'AI',
  'natural language': 'NL', 'large language model': 'LLM',
  'application programming interface': 'API',
  'user interface': 'UI', 'user experience': 'UX',
  'command line': 'CLI', 'graphical user interface': 'GUI',
  'after testing': '測後', 'before testing': '測前',
  'submit a': '提交', 'create a': '創',
  'well structured': '構良', 'well-structured': '構良',
  'form a': '成', 'gather relevant': '集相關',
  
  // contextOS / Agent-specific phrases
  'agent status': '代理態', 'agent claim': '代理占',
  'task assignment': '任分配', 'task complete': '任完',
  'group chat': '群聊', 'direct message': 'DM',
  'mcp server': 'MCP服', 'mcp call': 'MCP調',
  'channel publish': '頻發', 'channel subscribe': '頻訂',
  'work queue': '工隊', 'inbox message': '收訊',
  'handoff ready': '交接備', 'handoff complete': '交接完',
  'resource lock': '資鎖', 'resource unlock': '資解鎖',
  'zone claim': '區占', 'zone release': '區釋',
  'branch claim': '支占', 'branch merge': '支併',
  'pr review': 'PR審', 'ci pass': 'CI過',
  'role assignment': '角分配', 'role coordinator': '協調',
  'role reviewer': '審查', 'role coder': '碼師',
  'knowledge base': 'KB', 'shared document': '共文',
};

const WORD_MAP: Record<string, string> = {
  // Pronouns/subjects
  'you': '你', 'your': '你', 'user': '用', "user's": '用',
  'i': '我', 'we': '我們', 'they': '彼',
  
  // Roles
  'assistant': '助', 'helper': '助', 'agent': '代理',
  'coding': '碼', 'developer': '發', 'coder': '碼師',
  'programmer': '程師', 'engineer': '工',
  'expert': '專', 'senior': '資深', 'junior': '初',
  'architect': '架構', 'designer': '設師',
  'analyst': '析師', 'consultant': '顧問',
  
  // Actions (verbs)
  'analyze': '析', 'analyse': '析',
  'implement': '實', 'implementation': '實現',
  'design': '設', 'create': '創', 'build': '建',
  'verify': '驗', 'validate': '驗', 'check': '查',
  'test': '測', 'debug': '調', 'fix': '修',
  'review': '審', 'examine': '檢', 'inspect': '察',
  'document': '記', 'describe': '述', 'explain': '釋',
  'gather': '集', 'collect': '收', 'aggregate': '聚',
  'evaluate': '評', 'assess': '評估', 'judge': '判',
  'follow': '循', 'adhere': '守', 'comply': '從',
  'ensure': '確', 'guarantee': '保', 'confirm': '確認',
  'provide': '供', 'offer': '獻', 'give': '予',
  'identify': '識', 'recognize': '認', 'detect': '偵',
  'write': '寫', 'compose': '撰', 'draft': '擬',
  'read': '讀', 'parse': '解析', 'interpret': '釋',
  'understand': '解', 'comprehend': '悟',
  'prioritize': '優先', 'rank': '排',
  'optimize': '優化', 'improve': '改',
  'generate': '生', 'produce': '產',
  'execute': '執', 'run': '運', 'perform': '行',
  'modify': '改', 'change': '變', 'update': '更',
  'delete': '刪', 'remove': '移', 'clear': '清',
  'add': '加', 'insert': '插', 'append': '附',
  'search': '搜', 'find': '找', 'locate': '定位',
  'sort': '排序', 'filter': '濾', 'select': '選',
  'transform': '轉', 'convert': '換',
  'communicate': '通', 'notify': '通知', 'alert': '警',
  'respond': '應', 'reply': '覆', 'answer': '答',
  'ask': '問', 'query': '詢', 'request': '請',
  'think': '思', 'reason': '理', 'infer': '推',
  'learn': '學', 'adapt': '適', 'evolve': '進',
  'submit': '提', 'submitting': '提交中', 'submitted': '已提',
  'testing': '測中', 'tested': '已測',
  'relevant': '相關', 'appropriate': '適當',
  'structured': '構化', 'hypothesis': '假設',
  'claim': '占', 'release': '釋', 'lock': '鎖', 'unlock': '解鎖',
  'publish': '發', 'subscribe': '訂', 'broadcast': '廣播',
  'coordinate': '協調', 'synchronize': '同步', 'sync': '同步',
  'queue': '隊列', 'stack': '棧', 'list': '列',
  'assign': '分配', 'allocate': '配置', 'distribute': '分發',
  'merge': '併', 'split': '分', 'combine': '合',
  'track': '追蹤', 'monitor': '監', 'observe': '觀',
  'log': '誌', 'record': '記錄', 'capture': '捕',
  'warn': '警告',
  'approve': '批', 'reject': '拒', 'accept': '受',
  'complete': '完', 'finish': '完成', 'done': '完',
  'pending': '待', 'active': '活', 'idle': '閒',
  'ready': '備', 'waiting': '待中', 'blocked': '阻',
  
  // Concepts
  'problem': '問', 'issue': '題', 'bug': '蟲',
  'solution': '解', 'result': '果',
  'approach': '法', 'method': '方', 'technique': '技',
  'pattern': '模', 'template': '範', 'structure': '構',
  'process': '程', 'workflow': '流', 'pipeline': '管線',
  'context': '境', 'environment': '環境', 'setting': '設定',
  'constraint': '約', 'limit': '限', 'restriction': '制',
  'requirement': '需', 'specification': '規', 'criteria': '準則',
  'code': '碼', 'script': '腳本', 'program': '程式',
  'error': '錯', 'exception': '例外', 'fault': '故障',
  'security': '安', 'safety': '全', 'protection': '護',
  'performance': '效', 'speed': '速', 'efficiency': '率',
  'scalability': '擴', 'flexibility': '彈',
  'maintainability': '維', 'reliability': '靠',
  'quality': '質', 'standard': '標準',
  'data': '數據', 'information': '資訊', 'knowledge': '知',
  'system': '系統', 'component': '件', 'module': '模組',
  'function': '函', 'class': '類',
  'variable': '變量', 'parameter': '參', 'argument': '引',
  'input': '入', 'output': '出',
  'file': '檔', 'directory': '目錄', 'path': '路徑',
  'database': '庫', 'table': '表',
  'network': '網', 'server': '服務器', 'client': '客端',
  'msg': '訊', 'response': '應答',
  'task': '任', 'job': '工作', 'action': '動作',
  'event': '事件', 'trigger': '觸發', 'handler': '處理器',
  'state': '態', 'status': '狀態', 'condition': '條件',
  'logic': '邏輯', 'algorithm': '演算法',
  'intent': '意', 'purpose': '目的', 'goal': '目標',
  'domain': '域', 'scope': '範圍', 'area': '領域',
  'layer': '層', 'level': '級', 'tier': '階',
  
  // Modifiers
  'always': '恆', 'never': '禁', 'sometimes': '有時',
  'often': '常', 'rarely': '罕', 'usually': '通常',
  'best': '優', 'worst': '劣', 'good': '良', 'bad': '壞',
  'comprehensive': '全',
  'proper': '正', 'correct': '對', 'wrong': '誤',
  'simple': '簡', 'complex': '繁', 'complicated': '複雜',
  'obvious': '顯', 'vague': '模糊',
  'concise': '簡潔', 'brief': '短', 'verbose': '冗',
  'accurate': '準', 'precise': '精', 'exact': '確切',
  'helpful': '助益', 'useful': '用', 'valuable': '值',
  'thorough': '詳', 'detailed': '細', 'deep': '深',
  'uncertain': '疑', 'unknown': '未知', 'ambiguous': '歧',
  'alternative': '替', 'optional': '選',
  'important': '要', 'critical': '關鍵', 'essential': '必',
  'primary': '主', 'secondary': '次', 'tertiary': '三',
  'current': '當前', 'previous': '前', 'next': '下',
  'new': '新', 'old': '舊', 'existing': '現有',
  'specific': '特定', 'general': '通用', 'common': '常見',
  'unique': '唯一', 'distinct': '獨特',
  'valid': '有效', 'invalid': '無效',
  'available': '可用', 'unavailable': '不可用',
  'inactive': '不活躍',
  'enabled': '啟用', 'disabled': '禁用',
  
  // Sequence/structure
  'first': '首', 'second': '二', 'third': '三',
  'then': '次', 'finally': '終', 'lastly': '末',
  'before': '前', 'after': '後', 'during': '期間',
  'start': '始', 'end': '終', 'middle': '中',
  'phase': '階', 'step': '步', 'stage': '段',
  'guideline': '則', 'rule': '規', 'policy': '策',
  'practice': '踐', 'procedure': '程序',
  'principle': '原則', 'concept': '概念',
};

// Symbols for common structural patterns
const SYMBOL_MAP: Record<string, string> = {
  ' -> ': '→', ' => ': '→', ' leads to ': '→',
  ' maps to ': '↦', ' becomes ': '↦',
  ' and ': '·', ', and ': '·', ', ': '·',
  ' or ': '|', ', or ': '|',
  ' not ': '¬', ' no ': '¬',
  '...': '…', ' etc': '等',
};

function semanticCompress(spec: string, modelId?: string) {
  let omega = spec.toLowerCase();
  
  // Layer 1: Apply symbol replacements first (operators)
  for (const [pattern, symbol] of Object.entries(SYMBOL_MAP)) {
    omega = omega.split(pattern.toLowerCase()).join(symbol);
  }
  
  // Layer 2: Apply phrase translations (longest first for greedy matching)
  const phraseKeys = Object.keys(PHRASE_MAP).sort((a, b) => b.length - a.length);
  for (const phrase of phraseKeys) {
    omega = omega.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), PHRASE_MAP[phrase]);
  }
  
  // Layer 3: Apply word translations (longest first)
  const wordKeys = Object.keys(WORD_MAP).sort((a, b) => b.length - a.length);
  for (const word of wordKeys) {
    omega = omega.replace(new RegExp('\\b' + word + '\\b', 'gi'), WORD_MAP[word]);
  }
  
  // Remove common filler words
  omega = omega.replace(/\b(the|a|an|is|are|be|been|being|was|were|will|would|should|could|have|has|had|do|does|did|this|that|these|those|it|its|of|for|to|and|or|but|with|by|from|as|at|on|in|into|through|during|before|after|above|below|between|under|over|out|up|down|off|about|against|along|among|around|behind|beneath|beside|besides|beyond|concerning|despite|except|inside|outside|since|toward|towards|upon|within|without)\b/gi, '');
  
  // Clean up
  omega = omega.replace(/[,.:;!?()[\]{}'"]/g, '·');  // Punctuation to separator
  omega = omega.replace(/\s+/g, '');  // Remove whitespace
  omega = omega.replace(/·+/g, '·');  // Collapse multiple separators
  omega = omega.replace(/^·|·$/g, '');  // Trim separators
  
  omega = 'Ω核:' + omega;
  
  // Calculate compression stats
  // Note: Chinese characters are ~3 bytes in UTF-8
  const omegaBytes = omega.length * 2.5;  // Estimate for mixed Chinese/ASCII
  const originalBytes = spec.length;  // ASCII is ~1 byte per char
  
  // Estimate gzip compression (typically 30-50% for short text, better for longer)
  const estimatedGzipBytes = Math.round(omegaBytes * 0.6);
  
  const stats = { 
    originalChars: spec.length, 
    compressedChars: omega.length, 
    charRatio: omega.length > 0 ? Math.round(spec.length/omega.length*10)/10 : 0,
    // Byte-level stats (estimated)
    originalBytes: Math.round(originalBytes),
    omegaBytes: Math.round(omegaBytes),
    gzipBytesEst: estimatedGzipBytes,
    totalRatioEst: estimatedGzipBytes > 0 ? Math.round(originalBytes/estimatedGzipBytes*10)/10 : 0
  };
  
  return { 
    success: true, 
    modelId: modelId || defaultModelId, 
    omega,
    stats, 
    elapsed: 50, 
    mock: true 
  };
}

// Prompt for LLM to normalize/simplify English before dictionary compression
const NORMALIZE_PROMPT = `Simplify this text to basic vocabulary. Use these exact words when possible:
- "you are" not "you're", "act as", "serve as"
- "always" not "consistently", "invariably"  
- "never" not "avoid", "refrain from"
- "first" "then" "finally" for sequences
- "check" not "verify", "validate", "ensure"
- "error" not "exception", "fault", "issue"
- "user" not "client", "customer"
- "code" not "implementation", "solution"
- "test" not "validate", "verify"
- "before" "after" for time
- Remove filler words like "please", "kindly", "basically"
- Keep meaning exact, just simplify vocabulary

Simplify: `;

// Full translation prompt (fallback)
const TRANSLATE_PROMPT = `Translate to dense Chinese. One character per concept. Output only Chinese.
Example: "You are helpful" → 你為助
Translate: `;

// Timeout wrapper for LLM inference (30 second timeout)
const LLM_TIMEOUT_MS = 30000;

// Step 1: LLM normalizes English to dictionary-friendly vocabulary
function normalizeWithLLM(spec: string, model: any, params: any): string {
  console.log(`[normalize] Normalizing ${spec.length} chars with LLM`);
  try {
    const prompt = NORMALIZE_PROMPT + spec;
    const normalized = llm.inferSync(params, model, prompt);
    // Clean up LLM output
    let result = normalized.trim();
    result = result.replace(/^(Simplified|Here|Output|Result):\s*/i, '');
    result = result.replace(/^["']|["']$/g, '');
    console.log(`[normalize] Result: ${result.substring(0, 100)}...`);
    return result || spec;  // Fallback to original if empty
  } catch (e: any) {
    console.log(`[normalize] LLM error: ${e.message}, using original`);
    return spec;
  }
}

// Step 2: Apply dictionary compression to normalized text
function compressChunk(spec: string, modelId: string, model: any, params: any): string {
  console.log(`[compressChunk] Processing ${spec.length} chars`);
  
  // First normalize the English with LLM
  const normalized = normalizeWithLLM(spec, model, params);
  
  // Then apply dictionary compression
  const result = semanticCompress(normalized, modelId);
  return result.omega.replace(/^Ω核:/, '');
}

function compress(spec: string, modelId?: string) {
  const mid = modelId || defaultModelId;
  console.log(`[compress] Starting compression of ${spec.length} chars with model ${mid}`);
  
  // Fast mode - use dictionary compression only (no LLM)
  if (mid === 'fast') {
    console.log(`[compress] Fast mode - using dictionary compression`);
    return semanticCompress(spec, 'fast');
  }
  
  const maxChars = getMaxInputChars(mid);
  const model = getModelSpec(mid);
  const start = Date.now();
  
  // Optimize for AMD Ryzen 8745HS (8 cores/16 threads, no NVIDIA GPU)
  const params = llm.params({ 
    contextSize: 4096,
    allowDownload: true,
    disableGpu: true,       // No NVIDIA GPU available
    threadCount: 12,        // Use most threads (leave some for system)
    threadBatchCount: 12    // Batch threads for parallel processing
  });
  
  let omega = '';
  
  // If input is longer than max, chunk it
  if (spec.length > maxChars) {
    console.log(`[compress] Input exceeds ${maxChars} chars, chunking into ${Math.ceil(spec.length / maxChars)} parts`);
    
    // Split by sentences/paragraphs where possible
    const chunks: string[] = [];
    let remaining = spec;
    while (remaining.length > 0) {
      if (remaining.length <= maxChars) {
        chunks.push(remaining);
        break;
      }
      // Find a good split point (sentence end, paragraph, or just max chars)
      let splitAt = maxChars;
      const sentenceEnd = remaining.lastIndexOf('. ', maxChars);
      const newline = remaining.lastIndexOf('\n', maxChars);
      if (sentenceEnd > maxChars * 0.5) splitAt = sentenceEnd + 1;
      else if (newline > maxChars * 0.5) splitAt = newline + 1;
      
      chunks.push(remaining.substring(0, splitAt).trim());
      remaining = remaining.substring(splitAt).trim();
    }
    
    console.log(`[compress] Split into ${chunks.length} chunks`);
    const results: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[compress] Processing chunk ${i + 1}/${chunks.length}...`);
      results.push(compressChunk(chunks[i], mid, model, params));
    }
    omega = results.join('·');
  } else {
    omega = compressChunk(spec, mid, model, params);
  }
  
  const elapsed = Date.now() - start;
  console.log(`[compress] Done in ${elapsed}ms`);
  
  // Ensure it starts with Ω核: prefix
  if (!omega.startsWith('Ω核:')) {
    omega = 'Ω核:' + omega;
  }
  
  return { 
    success: true, 
    modelId: mid, 
    omega, 
    stats: { 
      originalChars: spec.length, 
      compressedChars: omega.length, 
      charRatio: omega.length > 0 ? Math.round(spec.length/omega.length*10)/10 : 0 
    }, 
    elapsed 
  };
}

function parseQuery(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const idx = url.indexOf('?');
  if (idx > -1) {
    url.substring(idx+1).split('&').forEach(p => {
      const [k,v] = p.split('=');
      if (k && v) params[k] = decodeURIComponent(v.replace(/\+/g, ' '));
    });
  }
  return params;
}

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Omega Compressor</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0a0f;--surface:#12121a;--border:#2a2a3a;--text:#e0e0e8;--accent:#7c5cff}
body{font-family:monospace;background:var(--bg);color:var(--text);min-height:100vh;padding:20px}
.container{max-width:900px;margin:0 auto}
h1{background:linear-gradient(135deg,var(--accent),#ff5c8a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:20px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:700px){.grid{grid-template-columns:1fr}}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px}
textarea,.output{width:100%;min-height:150px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:12px;font-family:inherit;font-size:13px}
.output{color:#ffd700;white-space:pre-wrap}
.btn{background:var(--accent);color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;margin-top:10px}
.btn:disabled{opacity:.5}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}
.stat{background:#1a1a24;padding:10px;border-radius:8px;text-align:center}
.stat-val{font-size:20px;font-weight:bold;color:var(--accent)}
.stat-lbl{font-size:10px;color:#888}
.loading{color:#888;font-style:italic}
.status-line{color:#7c5cff;margin-bottom:8px;font-size:12px}
.controls{margin:10px 0;display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.controls select{background:#1a1a24;color:#e0e0e8;border:1px solid #2a2a3a;padding:6px 10px;border-radius:4px}
.controls label{color:#888;font-size:12px}
</style>
</head>
<body>
<div class="container">
<h1>Ω Omega Compressor</h1>
<div class="grid">
<div class="panel">
<h3>Input Specification</h3>
<textarea id="specIn" placeholder="Paste agent instructions here...

Example: You are a helpful AI assistant that helps users with coding tasks. You should be concise, accurate, and friendly."></textarea>
<div class="controls">
<label>Model: <select id="modelSelect">
<option value="tinyllama" selected>TinyLlama 1.1B (fastest)</option>
<option value="qwen">Qwen 2.5 1.5B (better Chinese)</option>
<option value="qwen3b">Qwen 2.5 3B (best quality)</option>
<option value="fast">⚡ Fast Mode (no LLM)</option>
</select></label>
<input type="text" id="customModel" placeholder="repo/model-file.gguf" style="display:none;width:200px;margin-left:8px;padding:4px;background:#1a1a24;border:1px solid #2a2a3a;color:#e0e0e8;border-radius:4px">
</div>
<button class="btn" onclick="doCompress()" id="btn">🔮 Compress</button>
</div>
<div class="panel">
<h3>Omega Kernel</h3>
<div class="status-line" id="status"></div>
<div class="output" id="out">Result will appear here...</div>
<div class="stats" id="stats" style="display:none">
<div class="stat"><div class="stat-val" id="ratio">-</div><div class="stat-lbl">Ratio</div></div>
<div class="stat"><div class="stat-val" id="orig">-</div><div class="stat-lbl">Original</div></div>
<div class="stat"><div class="stat-val" id="comp">-</div><div class="stat-lbl">Compressed</div></div>
<div class="stat"><div class="stat-val" id="time">-</div><div class="stat-lbl">Time</div></div>
</div>
</div>
</div>
</div>
<script>
let timerInterval = null;
let startTime = 0;

// Handle model selector
document.getElementById("modelSelect").addEventListener("change", function() {
  const customInput = document.getElementById("customModel");
  customInput.style.display = this.value === "custom" ? "inline-block" : "none";
});

function updateStatus(msg) {
  document.getElementById("status").textContent = msg;
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? mins + "m " + secs + "s" : secs + "s";
  
  let msg = "⏳ Processing... " + timeStr + "\\n\\n";
  if (elapsed < 5) {
    msg += "🔄 Initializing model...";
  } else if (elapsed < 30) {
    msg += "📥 First run: Downloading model (~2GB)...\\n";
    msg += "   Check terminal for download progress.\\n";
    msg += "   This only happens once!";
  } else if (elapsed < 120) {
    msg += "📥 Still downloading... (" + Math.round(elapsed/60*100)/100 + " min)\\n";
    msg += "   Large models take time on first run.";
  } else {
    msg += "🧠 Model loaded, running inference...";
  }
  document.getElementById("out").textContent = msg;
}

async function doCompress(){
  const spec = document.getElementById("specIn").value.trim();
  if(!spec) return alert("Enter a spec");
  
  // Get selected model
  const modelSelect = document.getElementById("modelSelect");
  let modelId = modelSelect.value;
  if (modelId === "custom") {
    const customModel = document.getElementById("customModel").value.trim();
    if (!customModel) return alert("Enter a custom model path (e.g., TheBloke/model-GGUF/model.gguf)");
    modelId = "custom:" + customModel;
  }
  
  const btn = document.getElementById("btn");
  const out = document.getElementById("out");
  const stats = document.getElementById("stats");
  
  btn.disabled = true;
  btn.textContent = "⏳ Compressing...";
  stats.style.display = "none";
  
  // Start timer
  startTime = Date.now();
  updateStatus("🔄 Sending request to " + (modelId.startsWith("custom:") ? "custom model" : modelId) + "...");
  out.textContent = "⏳ Starting compression...";
  timerInterval = setInterval(updateTimer, 1000);
  
  try {
    updateStatus("🧠 Model is processing (may download on first run)...");
    const r = await fetch("/api/compress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec, modelId })
    });
    
    clearInterval(timerInterval);
    updateStatus("📦 Parsing response...");
    
    const d = await r.json();
    
    if(d.success) {
      const status = d.mock ? "✅ Compressed (fast mode)" : "✅ Compression complete!";
      updateStatus(status);
      out.textContent = d.omega;
      stats.style.display = "grid";
      document.getElementById("ratio").textContent = d.stats.charRatio + "x";
      document.getElementById("orig").textContent = d.stats.originalChars;
      document.getElementById("comp").textContent = d.stats.compressedChars;
      document.getElementById("time").textContent = (d.elapsed / 1000).toFixed(1) + "s";
    } else {
      updateStatus("❌ Error");
      out.textContent = "Error: " + d.error;
    }
  } catch(e) {
    clearInterval(timerInterval);
    updateStatus("❌ Request failed");
    out.textContent = "Error: " + e.message;
  }
  
  btn.disabled = false;
  btn.textContent = "🔮 Compress";
}
</script>
</body>
</html>`;

// Create HTTP server using Node.js pattern (works correctly with Elide)
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';
  
  // Health check
  if (url === '/api/health' && method === 'GET') {
    const json = JSON.stringify({ success: true, status: 'healthy' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', Buffer.byteLength(json, 'utf8').toString());
    res.write(json);
    res.end();
    return;
  }
  
  // Compress API - supports both GET (short specs) and POST (long specs)
  if (url.startsWith('/api/compress')) {
    res.setHeader('Content-Type', 'application/json');
    
    if (method === 'POST') {
      // Collect body for POST requests
      let body = '';
      req.on('data', (chunk: any) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.spec) {
            const err = JSON.stringify({ success: false, error: 'Missing spec' });
            res.setHeader('Content-Length', Buffer.byteLength(err, 'utf8').toString());
            res.write(err);
            res.end();
            return;
          }
          const result = compress(data.spec, data.modelId);
          const json = JSON.stringify(result);
          res.setHeader('Content-Length', Buffer.byteLength(json, 'utf8').toString());
          res.write(json);
          res.end();
        } catch (e: any) {
          const err = JSON.stringify({ success: false, error: 'Invalid JSON: ' + e.message });
          res.setHeader('Content-Length', Buffer.byteLength(err, 'utf8').toString());
          res.write(err);
          res.end();
        }
      });
      return;
    }
    
    // GET fallback for short specs
    const q = parseQuery(url);
    if (!q.spec) {
      const err = JSON.stringify({ success: false, error: 'Missing spec' });
      res.setHeader('Content-Length', Buffer.byteLength(err, 'utf8').toString());
      res.write(err);
      res.end();
      return;
    }
    const result = compress(q.spec, q.modelId);
    const json = JSON.stringify(result);
    res.setHeader('Content-Length', Buffer.byteLength(json, 'utf8').toString());
    res.write(json);
    res.end();
    return;
  }
  
  // Serve HTML for root
  if ((url === '/' || url === '/index.html') && method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(HTML, 'utf8').toString());
    res.write(HTML);
    res.end();
    return;
  }
  
  // 404
  const notFound = JSON.stringify({ error: 'Not found' });
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(notFound, 'utf8').toString());
  res.write(notFound);
  res.end();
});

// Listen on all interfaces so Windows host can access WSL
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Omega Compressor running at http://localhost:${PORT}`);
  console.log(`   (Also accessible from Windows at http://<WSL-IP>:${PORT})`);
});
