// Omega Compressor - Elide HTTP Router Pattern
// Run with: elide server.js

console.log('🔮 Omega Compressor initializing...');

// ============================================
// HTTP SERVER SETUP (Elide.http pattern)
// ============================================
const server = Elide.http;
const router = server.getRouter();
const config = server.getConfig();

config.setPort(8080);
config.setAutoStart(true);

// ============================================
// LLM MODULE
// ============================================
const llm = require('elide:llm');
console.log('LLM API version:', llm.version());

// ============================================
// MODEL CONFIGURATION  
// ============================================
const MODELS = {
  qwen: {
    id: 'qwen',
    repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    displayName: 'Qwen 2.5 1.5B',
    size: '~1GB',
    quality: 'Excellent',
    qualityNote: 'Native Chinese - best for Omega DSL',
    speed: 'Fast',
    recommended: true
  },
  tinyllama: {
    id: 'tinyllama', 
    repo: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF',
    file: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    displayName: 'TinyLlama 1.1B',
    size: '~600MB',
    quality: 'Moderate',
    qualityNote: 'Fast but less accurate with Chinese',
    speed: 'Very Fast',
    recommended: false
  }
};

let defaultModelId = 'qwen';

function getModelSpec(modelId) {
  const m = MODELS[modelId] || MODELS[defaultModelId];
  // Use 'name' for the GGUF file (not 'model' or 'file')
  return llm.huggingface({ repo: m.repo, name: m.file });
}

function getParams() {
  // Use defaults like the working example
  return llm.params();
}

// ============================================
// OMEGA COMPILER PROMPTS
// ============================================
const SYSTEM_PROMPT = `You are an Omega Kernel Compiler. Transform verbose natural-language AI agent specifications into ultra-compressed Omega DSL kernels.

RULES:
1. Output ONLY the Omega kernel - NO explanations
2. Use dense Classical Chinese + symbolic notation
3. Preserve ALL behavioral intent
4. Target 5-15x compression

OMEGA DSL STRUCTURE:
- Ω核: Core identity
- 「」for key principles
- → for flows, ↦ for transforms
- {} for sets, ; for separation
- μ=uncertainty, λ=conditional, γ=risk

COMPRESSION:
- "You are a..." → role noun
- "Always X" → X
- "When X then Y" → X→Y
- "be concise" → 簡
- "be thorough" → 全
- "admit uncertainty" → μ時述μ`;

const EXAMPLES = [
  { in: 'You are a helpful coding assistant. Always prioritize understanding the user\'s true intent. Be concise but thorough.',
    out: 'Ω核:「意>詞」。你為碼助。簡而全。' },
  { in: 'You are a senior engineer. Analyze domain, gather context, form hypothesis, implement, verify. Handle errors. Admit uncertainty.',
    out: 'Ω核: 你為資工。訊至→析域↦補參↦構假↦實作↦驗。遵錯處。μ時述μ。' }
];

function buildCompressPrompt(spec) {
  let prompt = SYSTEM_PROMPT + '\n\n';
  EXAMPLES.forEach((ex, i) => {
    prompt += 'Example ' + (i+1) + ':\nINPUT: ' + ex.in + '\nOUTPUT: ' + ex.out + '\n\n';
  });
  prompt += 'Now compress:\nINPUT: ' + spec + '\nOUTPUT:';
  return prompt;
}

function extractKernel(raw) {
  if (!raw) return '';
  let k = raw.trim();
  k = k.replace(/```[\s\S]*?```/g, function(m) { return m.replace(/```\w*\n?/g, '').trim(); });
  k = k.replace(/^(here'?s?|the|your|output:?|omega:?)\s*/i, '');
  const m = k.match(/OUTPUT:\s*([\s\S]+)/i);
  if (m) k = m[1].trim();
  const lines = k.split('\n');
  const kernelLines = [];
  let blank = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { blank = true; }
    else if (blank && /^[a-z]/i.test(line.trim())) break;
    else { kernelLines.push(line); blank = false; }
  }
  return kernelLines.join('\n').trim();
}

function calcStats(orig, comp) {
  const oLen = orig.length, cLen = comp.length;
  return {
    originalChars: oLen,
    compressedChars: cLen,
    charRatio: Math.round(oLen / cLen * 10) / 10,
    compressionPercent: Math.round((1 - cLen / oLen) * 100)
  };
}

// ============================================
// COMPRESSION FUNCTIONS
// ============================================

// Mock compression for demo (until Elide LLM inference is implemented)
function mockCompress(spec, modelId) {
  // Simplified compression rules for demo
  var omega = spec
    .replace(/You are (a |an )?/gi, '你為')
    .replace(/helpful /gi, '')
    .replace(/coding /gi, '碼')
    .replace(/assistant/gi, '助')
    .replace(/Always /gi, '')
    .replace(/prioritize /gi, '')
    .replace(/understanding /gi, '察')
    .replace(/the user'?s? /gi, '')
    .replace(/true /gi, '')
    .replace(/intent/gi, '意')
    .replace(/before /gi, '先')
    .replace(/acting/gi, '行')
    .replace(/Be /gi, '')
    .replace(/concise /gi, '簡')
    .replace(/but /gi, '而')
    .replace(/thorough/gi, '全')
    .replace(/\. /g, '。')
    .replace(/\s+/g, '');
  
  omega = 'Ω核:「意>詞」。' + omega;
  
  return {
    success: true,
    modelId: modelId || defaultModelId,
    original: spec,
    omega: omega,
    stats: calcStats(spec, omega),
    elapsed: 50,
    mock: true,
    note: 'Demo mode - Elide LLM inference not yet implemented'
  };
}

function compressWithLLM(spec, modelId) {
  try {
    const model = getModelSpec(modelId || defaultModelId);
    const params = getParams();
    const prompt = buildCompressPrompt(spec);
    
    console.log('[Compress] Starting sync inference...');
    const start = Date.now();
    
    // Use inferSync directly from llm module
    const raw = llm.inferSync(params, model, prompt);
    const elapsed = Date.now() - start;
    
    const omega = extractKernel(raw);
    const stats = calcStats(spec, omega);
    
    console.log('[Compress] Done in ' + elapsed + 'ms, ratio: ' + stats.charRatio + 'x');
    
    return {
      success: true,
      modelId: modelId || defaultModelId,
      original: spec,
      omega: omega,
      stats: stats,
      elapsed: elapsed
    };
  } catch(e) {
    // Fall back to mock if LLM not available
    console.log('[Compress] LLM error, using mock:', String(e));
    return mockCompress(spec, modelId);
  }
}

// ============================================
// TEST AGENT
// ============================================
function buildAgentPrompt(kernel) {
  return 'Your behavior is defined by this Omega kernel:\n\n' + kernel + '\n\nInterpret: Ω核=identity, 「」=principles, →=flow, ↦=transform, μ=uncertainty, 簡=concise, 全=thorough.\n\nRespond following the kernel.';
}

function chatWithAgent(kernel, message, modelId) {
  const model = getModelSpec(modelId || defaultModelId);
  const params = getParams();
  const prompt = buildAgentPrompt(kernel) + '\n\nUser: ' + message + '\nAssistant:';
  
  console.log('[Agent] Chat...');
  const start = Date.now();
  
  try {
    const response = llm.inferSync(params, model, prompt);
    const elapsed = Date.now() - start;
    
    let clean = response.trim();
    const userIdx = clean.indexOf('\nUser:');
    if (userIdx > 0) clean = clean.substring(0, userIdx).trim();
    
    return { success: true, response: clean, elapsed: elapsed };
  } catch(e) {
    // Mock response if LLM not available
    return { 
      success: true, 
      response: '[Demo Mode] I understand your message: "' + message + '". Following my Omega kernel, I would respond concisely and thoroughly.',
      elapsed: 30,
      mock: true
    };
  }
}

// ============================================
// HTTP HELPERS
// ============================================
function sendJson(response, status, data) {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.send(status, JSON.stringify(data));
}

function sendHtml(response, html) {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.send(200, html);
}

// Helper to parse request body
async function parseRequestBody(request) {
  try {
    // Debug: enumerate all properties and methods
    var keys = [];
    for (var k in request) { keys.push(k); }
    console.log('[parseBody] All keys:', keys.join(', '));
    
    // Try various approaches
    if (typeof request.text === 'function') {
      console.log('[parseBody] Using text()');
      var text = await request.text();
      console.log('[parseBody] Got text:', text);
      return JSON.parse(text);
    }
    
    if (request.body) {
      console.log('[parseBody] body exists, type:', typeof request.body);
      // If it's already a string
      if (typeof request.body === 'string') {
        return JSON.parse(request.body);
      }
      // If it's a ReadableStream
      if (typeof request.body.getReader === 'function') {
        console.log('[parseBody] Reading stream...');
        var reader = request.body.getReader();
        var result = await reader.read();
        console.log('[parseBody] Read result:', result);
        if (result.value) {
          var decoder = new TextDecoder();
          var text = decoder.decode(result.value);
          console.log('[parseBody] Decoded:', text);
          return JSON.parse(text);
        }
      }
    }
    
    console.log('[parseBody] No body method worked');
    return null;
  } catch(e) {
    console.log('[parseBody] Error:', String(e));
    return null;
  }
}

async function handleRequest(request) {
  try {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
  
  // API Routes
  if (path === '/api/health') {
    // Debug: list what's available on the llm module and submodules
    var llmKeys = [];
    for (var k in llm) { llmKeys.push(k); }
    var localKeys = [];
    if (llm.local) { for (var k in llm.local) { localKeys.push(k); } }
    var remoteKeys = [];
    if (llm.remote) { for (var k in llm.remote) { remoteKeys.push(k); } }
    return jsonResponse({ 
      success: true, 
      status: 'healthy', 
      llmVersion: llm.version(),
      llmMethods: llmKeys,
      localMethods: localKeys,
      remoteMethods: remoteKeys
    });
  }
  
  if (path === '/api/models') {
    const list = Object.values(MODELS).map(function(m) { 
      return Object.assign({}, m, { isDefault: m.id === defaultModelId }); 
    });
    return jsonResponse({ success: true, models: list, defaultModelId: defaultModelId });
  }
  
  if (path === '/api/models/select' && method === 'POST') {
    try {
      const body = await parseRequestBody(request);
      if (!body || !body.modelId || !MODELS[body.modelId]) {
        return jsonResponse({ success: false, error: 'Invalid modelId' }, 400);
      }
      defaultModelId = body.modelId;
      return jsonResponse({ success: true, defaultModelId: defaultModelId });
    } catch(e) {
      return jsonResponse({ success: false, error: String(e) }, 400);
    }
  }
  
  // Support GET with query param for compress
  if (path === '/api/compress') {
    // Parse query string manually instead of using searchParams (Elide bug workaround)
    var queryStr = url.search || '';
    var qparams = {};
    if (queryStr.startsWith('?')) {
      queryStr.substring(1).split('&').forEach(function(pair) {
        var parts = pair.split('=');
        if (parts.length === 2) {
          qparams[parts[0]] = decodeURIComponent(parts[1].replace(/\+/g, ' '));
        }
      });
    }
    var spec = qparams.spec;
    if (spec) {
      // Try real LLM first, falls back to mock if not available
      return jsonResponse(compressWithLLM(spec, qparams.modelId));
    }
    return jsonResponse({ success: false, error: 'Missing spec parameter' }, 400);
  }
  
  if (path === '/api/compress' && method === 'POST') {
    try {
      // Debug the body object
      var bodyDebug = {
        exists: !!request.body,
        type: typeof request.body,
        keys: [],
        hasGetReader: false,
        hasLocked: false
      };
      if (request.body) {
        for (var k in request.body) { bodyDebug.keys.push(k); }
        bodyDebug.hasGetReader = typeof request.body.getReader === 'function';
        bodyDebug.hasLocked = 'locked' in request.body;
        bodyDebug.locked = request.body.locked;
      }
      
      // Try to read body - single read to avoid hanging
      var bodyText = null;
      var readError = null;
      if (request.body && typeof request.body.getReader === 'function') {
        try {
          var reader = request.body.getReader();
          var chunk = await reader.read();
          bodyDebug.chunkDone = chunk.done;
          bodyDebug.chunkHasValue = !!chunk.value;
          bodyDebug.chunkValueType = typeof chunk.value;
          if (chunk.value) {
            // chunk.value might be Uint8Array or string
            if (typeof chunk.value === 'string') {
              bodyText = chunk.value;
            } else if (chunk.value.buffer || chunk.value.length !== undefined) {
              var decoder = new TextDecoder();
              bodyText = decoder.decode(chunk.value);
            }
          }
        } catch(e) {
          readError = String(e);
        }
      }
      
      var parsedBody = null;
      if (bodyText) {
        try {
          parsedBody = JSON.parse(bodyText);
        } catch(e) {
          readError = 'JSON parse: ' + String(e);
        }
      }
      
      if (!parsedBody || !parsedBody.spec) {
        return jsonResponse({ 
          success: false, 
          error: 'Missing spec', 
          bodyDebug: bodyDebug,
          bodyText: bodyText,
          parsedBody: parsedBody,
          readError: readError
        }, 400);
      }
      const result = await compressAsync(parsedBody.spec, parsedBody.modelId);
      return jsonResponse(result);
    } catch(e) {
      return jsonResponse({ success: false, error: String(e) }, 500);
    }
  }
  
  if (path === '/api/compare' && method === 'POST') {
    try {
      const body = await parseRequestBody(request);
      if (!body || !body.spec) {
        return jsonResponse({ success: false, error: 'Missing spec' }, 400);
      }
      
      const results = {};
      let bestId = null, bestRatio = 0;
      const start = Date.now();
      
      for (var id of Object.keys(MODELS)) {
        try {
          results[id] = await compressAsync(body.spec, id);
          if (results[id].stats.charRatio > bestRatio) {
            bestRatio = results[id].stats.charRatio;
            bestId = id;
          }
        } catch(e) {
          results[id] = { success: false, error: String(e) };
        }
      }
      
      return jsonResponse({
        success: true,
        results: results,
        bestModelId: bestId,
        bestRatio: bestRatio,
        totalElapsed: Date.now() - start
      });
    } catch(e) {
      return jsonResponse({ success: false, error: String(e) }, 500);
    }
  }
  
  if (path === '/api/test-agent' && method === 'POST') {
    try {
      const body = await parseRequestBody(request);
      if (!body || !body.omegaKernel || !body.message) {
        return jsonResponse({ success: false, error: 'Missing omegaKernel or message' }, 400);
      }
      const result = chatWithAgent(body.omegaKernel, body.message, body.modelId);
      return jsonResponse(result);
    } catch(e) {
      console.log('[Error] Agent:', e);
      return jsonResponse({ success: false, error: String(e) }, 500);
    }
  }
  
  // Serve HTML UI
  if (path === '/' || path === '/index.html') {
    var html = getHTML();
    var headers = new Headers();
    headers.set('Content-Type', 'text/html; charset=utf-8');
    return new Response(html, { status: 200, headers: headers });
  }
  
  return jsonResponse({ error: 'Not found' }, 404);
  } catch(globalError) {
    return jsonResponse({ success: false, error: 'Server error: ' + String(globalError) }, 500);
  }
}

function getHTML() {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Omega Compressor</title>\n  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    :root { --bg: #0a0a0f; --surface: #12121a; --surface2: #1a1a24; --border: #2a2a3a; --text: #e0e0e8; --dim: #888898; --accent: #7c5cff; --accent2: #ff5c8a; --success: #4caf50; }\n    body { font-family: "SF Mono", monospace; background: var(--bg); color: var(--text); min-height: 100vh; padding: 20px; }\n    .container { max-width: 1200px; margin: 0 auto; }\n    header { display: flex; align-items: center; justify-content: space-between; padding: 20px 0; border-bottom: 1px solid var(--border); margin-bottom: 30px; }\n    .logo { font-size: 24px; font-weight: bold; background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }\n    .model-select { display: flex; gap: 10px; align-items: center; }\n    .model-select select { background: var(--surface); color: var(--text); border: 1px solid var(--border); padding: 8px 12px; border-radius: 6px; }\n    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }\n    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }\n    .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }\n    .panel-header { background: var(--surface2); padding: 12px 16px; font-weight: bold; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; }\n    .panel-body { padding: 16px; }\n    textarea { width: 100%; min-height: 180px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-family: inherit; font-size: 13px; resize: vertical; }\n    textarea:focus { outline: none; border-color: var(--accent); }\n    .output { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; min-height: 180px; font-size: 14px; white-space: pre-wrap; color: #ffd700; }\n    .btn { background: var(--accent); color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; margin: 5px 5px 5px 0; }\n    .btn:hover { opacity: 0.9; }\n    .btn:disabled { opacity: 0.5; cursor: not-allowed; }\n    .btn-secondary { background: var(--surface2); border: 1px solid var(--border); }\n    .btn-compare { background: linear-gradient(135deg, var(--accent), var(--accent2)); }\n    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }\n    .stat { background: var(--surface2); padding: 12px; border-radius: 8px; text-align: center; }\n    .stat-value { font-size: 22px; font-weight: bold; color: var(--accent); }\n    .stat-label { font-size: 10px; color: var(--dim); text-transform: uppercase; }\n    .loading { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--dim); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; }\n    @keyframes spin { to { transform: rotate(360deg); } }\n    .chat-box { display: none; margin-top: 16px; }\n    .chat-box.active { display: block; }\n    .chat-msgs { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; min-height: 120px; max-height: 200px; overflow-y: auto; margin-bottom: 10px; }\n    .msg { margin-bottom: 10px; padding: 8px 12px; border-radius: 8px; }\n    .msg.user { background: var(--accent); color: white; margin-left: 20%; }\n    .msg.bot { background: var(--surface2); margin-right: 20%; }\n    .chat-input { display: flex; gap: 10px; }\n    .chat-input input { flex: 1; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 10px; font-family: inherit; }\n    .comparison { display: none; margin-top: 20px; }\n    .comparison.active { display: block; }\n    .comp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }\n    .comp-item { background: var(--surface2); border-radius: 8px; padding: 16px; }\n    .comp-item.winner { border: 2px solid var(--success); }\n    footer { margin-top: 40px; padding: 20px 0; border-top: 1px solid var(--border); text-align: center; color: var(--dim); font-size: 11px; }\n  </style>\n</head>\n<body>\n  <div class="container">\n    <header>\n      <div class="logo">Ω Omega Compressor</div>\n      <div class="model-select">\n        <span style="color:var(--dim)">Model:</span>\n        <select id="modelSel" onchange="setModel()"></select>\n      </div>\n    </header>\n    <div class="grid">\n      <div class="panel">\n        <div class="panel-header"><span>📝 Input Specification</span><span id="charCount" style="color:var(--dim);font-size:12px">0 chars</span></div>\n        <div class="panel-body">\n          <textarea id="specIn" placeholder="Paste your agent instructions here..." oninput="updateCount()"></textarea>\n          <div style="margin-top:12px">\n            <button class="btn" onclick="compress()" id="compBtn">🔮 Compress</button>\n            <button class="btn btn-compare" onclick="compare()" id="cmpBtn">⚖️ Compare Models</button>\n            <button class="btn btn-secondary" onclick="clearAll()">Clear</button>\n          </div>\n        </div>\n      </div>\n      <div class="panel">\n        <div class="panel-header"><span>✨ Omega Kernel</span><span id="outMeta" style="color:var(--dim);font-size:12px"></span></div>\n        <div class="panel-body">\n          <div class="output" id="omegaOut">Your compressed kernel will appear here...</div>\n          <div class="stats" id="statsBox" style="display:none">\n            <div class="stat"><div class="stat-value" id="sRatio">-</div><div class="stat-label">Compression</div></div>\n            <div class="stat"><div class="stat-value" id="sOrig">-</div><div class="stat-label">Original</div></div>\n            <div class="stat"><div class="stat-value" id="sComp">-</div><div class="stat-label">Omega</div></div>\n          </div>\n          <button class="btn btn-secondary" id="testBtn" onclick="toggleChat()" disabled style="margin-top:16px">🤖 Test Agent</button>\n          <div class="chat-box" id="chatBox">\n            <div class="chat-msgs" id="chatMsgs"></div>\n            <div class="chat-input">\n              <input type="text" id="chatIn" placeholder="Test the kernel..." onkeypress="if(event.key===\'Enter\')sendChat()">\n              <button class="btn" onclick="sendChat()">Send</button>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n    <div class="comparison" id="compBox">\n      <div class="panel">\n        <div class="panel-header"><span>⚖️ Model Comparison</span><button class="btn btn-secondary" onclick="hideComp()">Close</button></div>\n        <div class="panel-body"><div class="comp-grid" id="compGrid"></div></div>\n      </div>\n    </div>\n    <footer>Omega Compressor v1.0 • Powered by Elide</footer>\n  </div>\n  <script>\n    let models = [], currentModel = "qwen", currentOmega = null;\n    async function init() {\n      const r = await fetch("/api/models");\n      const d = await r.json();\n      models = d.models; currentModel = d.defaultModelId;\n      const sel = document.getElementById("modelSel");\n      sel.innerHTML = models.map(function(m) { return \'<option value="\'+m.id+\'"\'+(m.id===currentModel?\' selected\':\'\')+\'>\'+m.displayName+\'</option>\'; }).join("");\n    }\n    async function setModel() {\n      currentModel = document.getElementById("modelSel").value;\n      await fetch("/api/models/select", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({modelId:currentModel}) });\n    }\n    function updateCount() {\n      document.getElementById("charCount").textContent = document.getElementById("specIn").value.length + " chars";\n    }\n    async function compress() {\n      const spec = document.getElementById("specIn").value.trim();\n      if (!spec) return alert("Enter a specification");\n      const btn = document.getElementById("compBtn");\n      btn.disabled = true; btn.innerHTML = \'<span class="loading"></span> Compressing...\';\n      document.getElementById("omegaOut").textContent = "Compressing...";\n      document.getElementById("statsBox").style.display = "none";\n      try {\n        const r = await fetch("/api/compress?spec=" + encodeURIComponent(spec) + "&modelId=" + currentModel);\n        const d = await r.json();\n        if (d.success) {\n          currentOmega = d.omega;\n          document.getElementById("omegaOut").textContent = d.omega;\n          document.getElementById("outMeta").textContent = d.elapsed + "ms • " + d.modelId;\n          document.getElementById("statsBox").style.display = "grid";\n          document.getElementById("sRatio").textContent = d.stats.charRatio + "x";\n          document.getElementById("sOrig").textContent = d.stats.originalChars;\n          document.getElementById("sComp").textContent = d.stats.compressedChars;\n          document.getElementById("testBtn").disabled = false;\n        } else {\n          document.getElementById("omegaOut").textContent = "Error: " + d.error;\n        }\n      } catch(e) { document.getElementById("omegaOut").textContent = "Error: " + e.message; }\n      btn.disabled = false; btn.innerHTML = "🔮 Compress";\n    }\n    async function compare() {\n      const spec = document.getElementById("specIn").value.trim();\n      if (!spec) return alert("Enter a specification");\n      const btn = document.getElementById("cmpBtn");\n      btn.disabled = true; btn.innerHTML = \'<span class="loading"></span> Comparing...\';\n      try {\n        const r = await fetch("/api/compare", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({spec: spec}) });\n        const d = await r.json();\n        if (d.success) showComp(d);\n      } catch(e) { alert("Error: " + e.message); }\n      btn.disabled = false; btn.innerHTML = "⚖️ Compare Models";\n    }\n    function showComp(d) {\n      const grid = document.getElementById("compGrid");\n      grid.innerHTML = Object.entries(d.results).map(function(entry) {\n        var id = entry[0], r = entry[1];\n        var m = models.find(function(x) { return x.id === id; });\n        var winner = id === d.bestModelId;\n        return \'<div class="comp-item\'+(winner?\' winner\':\'\')+\'"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><strong>\'+(m?m.displayName:id)+\'</strong>\'+(winner?\'<span style="color:var(--success)">Best</span>\':\'\')+\'</div>\'+(r.success?\'<div class="output" style="min-height:80px;font-size:12px">\'+esc(r.omega)+\'</div><div style="margin-top:8px;font-size:11px;color:var(--dim)"><strong>\'+r.stats.charRatio+\'x</strong> • \'+r.stats.compressedChars+\' chars • \'+r.elapsed+\'ms</div>\':\'<div style="color:var(--accent2)">Error: \'+r.error+\'</div>\')+\'</div>\';\n      }).join("");\n      grid.innerHTML += \'<div style="grid-column:1/-1;text-align:center;padding:12px;color:var(--dim)">Total: \'+d.totalElapsed+\'ms</div>\';\n      document.getElementById("compBox").classList.add("active");\n    }\n    function hideComp() { document.getElementById("compBox").classList.remove("active"); }\n    function toggleChat() {\n      var box = document.getElementById("chatBox");\n      box.classList.toggle("active");\n      if (box.classList.contains("active")) document.getElementById("chatMsgs").innerHTML = \'<div style="color:var(--dim);text-align:center">Chat with your Omega agent</div>\';\n    }\n    async function sendChat() {\n      var input = document.getElementById("chatIn");\n      var msg = input.value.trim();\n      if (!msg || !currentOmega) return;\n      input.value = "";\n      var msgs = document.getElementById("chatMsgs");\n      msgs.innerHTML += \'<div class="msg user">\'+esc(msg)+\'</div>\';\n      msgs.innerHTML += \'<div class="msg bot"><span class="loading"></span></div>\';\n      msgs.scrollTop = msgs.scrollHeight;\n      try {\n        var r = await fetch("/api/test-agent", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({omegaKernel: currentOmega, message: msg}) });\n        var d = await r.json();\n        msgs.removeChild(msgs.lastChild);\n        msgs.innerHTML += \'<div class="msg bot">\'+(d.success?esc(d.response):"Error: "+d.error)+\'</div>\';\n        msgs.scrollTop = msgs.scrollHeight;\n      } catch(e) { msgs.removeChild(msgs.lastChild); msgs.innerHTML += \'<div class="msg bot">Error: \'+e.message+\'</div>\'; }\n    }\n    function clearAll() {\n      document.getElementById("specIn").value = "";\n      document.getElementById("omegaOut").textContent = "Your compressed kernel will appear here...";\n      document.getElementById("statsBox").style.display = "none";\n      document.getElementById("outMeta").textContent = "";\n      document.getElementById("testBtn").disabled = true;\n      document.getElementById("chatBox").classList.remove("active");\n      document.getElementById("compBox").classList.remove("active");\n      currentOmega = null;\n      updateCount();\n    }\n    function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }\n    init();\n  </script>\n</body>\n</html>';
}

// Return the fetch handler function directly
handleRequest;
