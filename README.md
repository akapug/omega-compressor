# Omega Compressor

> **Reference implementation for multilayer semantic compression in agent-to-agent (A2A) communications**

This repository defines the **Omega Compression Spec** for contextOS and serves as the canonical reference for implementing efficient A2A message compression.

## Purpose

Reduce token/bandwidth costs in multi-agent systems by compressing natural language instructions into dense symbolic representations. Designed for:

- **contextOS MCP messages** - Agent coordination, task handoffs, status updates
- **System prompts** - Compress verbose agent instructions for context window efficiency  
- **A2A protocols** - Efficient inter-agent communication

## Compression Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTILAYER COMPRESSION SPEC                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: SEMANTIC DICTIONARY (instant, deterministic)          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  English Phrases → Chinese/Symbols                       │    │
│  │  "you are a" → "你為"    "pull request" → "PR"          │    │
│  │  "best practices" → "優踐"  "error handling" → "錯處"   │    │
│  │  Achieves: 3-5x character compression                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  Layer 2: LLM NORMALIZATION (optional, 30-60s)                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Tiny LLM simplifies vocabulary to dictionary-friendly   │    │
│  │  "refrain from" → "never"  "validate" → "check"         │    │
│  │  Improves dictionary hit rate for edge cases             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  Layer 3: BINARY COMPRESSION (optional, for transport)          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  gzip/zstd with domain-specific dictionary               │    │
│  │  Additional 30-40% size reduction                        │    │
│  │  Best for: network transport, storage                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  TOTAL: 3-5x character reduction, 2-4x byte reduction           │
└─────────────────────────────────────────────────────────────────┘
```

## Compression Modes

| Mode | Latency | Compression | Use Case |
|------|---------|-------------|----------|
| **Fast** | <50ms | 3-5x chars | Real-time A2A messaging |
| **LLM-assisted** | 30-60s | 4-6x chars | System prompts, one-time compression |
| **Binary** | <10ms | +30-40% bytes | Network transport |

## Omega DSL Specification

### Output Format
```
Ω核:[compressed content]
```

### Symbol Vocabulary

| Symbol | Meaning | Example |
|--------|---------|--------|
| `→` | leads to, then | `訊至→析` (message arrives → analyze) |
| `↦` | maps to, becomes | `意↦策` (intent maps to strategy) |
| `·` | separator (and) | `簡·準·助` (concise · accurate · helpful) |
| `\|` | or, alternative | `成功\|失敗` (success or failure) |
| `¬` | not, never | `¬猜` (never guess) |
| `μ` | uncertainty | `μ時述μ` (when uncertain, state uncertainty) |
| `>` | prioritize over | `意>詞` (intent over words) |

### Domain Dictionaries

#### Core Agent Terms
| English | Omega | English | Omega |
|---------|-------|---------|-------|
| you are | 你為 | always | 恆 |
| user | 用 | never | 禁 |
| assistant | 助 | first | 首 |
| helpful | 助益 | then | 次 |
| analyze | 析 | before | 前 |
| implement | 實 | after | 後 |
| verify | 驗 | error | 錯 |
| test | 測 | code | 碼 |

#### contextOS Terms
| English | Omega | English | Omega |
|---------|-------|---------|-------|
| agent status | 代理態 | task assignment | 任分配 |
| group chat | 群聊 | direct message | DM |
| mcp server | MCP服 | channel publish | 頻發 |
| resource lock | 資鎖 | zone claim | 區占 |
| branch merge | 支併 | PR review | PR審 |
| handoff ready | 交接備 | knowledge base | KB |

## Example Compressions

### System Prompt
**Input (332 chars):**
```
You are a helpful coding assistant. Always prioritize understanding 
the user true intent over their literal words. When you receive a 
request, first analyze the domain, then gather relevant context, 
form a hypothesis, and provide a well-structured response. Be concise 
but thorough. Admit uncertainty when you do not know something.
```

**Output (76 chars):**
```
Ω核:你為助益碼助·恆意>詞用真意·訊至→請·首析域·次集相關境·成假設·供構良應答·簡詳·μ時述μ
```

**Compression: 4.4x characters, ~3x bytes with gzip**

### contextOS Message
**Input:**
```
Agent claims task, publishes to group chat, waits for PR review, then releases the resource lock.
```

**Output:**
```
Ω核:代理占任·發群聊·待PR審·次釋資鎖
```

**Compression: 2.4x**

## API Reference

### Compress Endpoint
```bash
POST /api/compress
Content-Type: application/json

{
  "spec": "Your English text here",
  "modelId": "fast"  // fast | tinyllama | qwen
}
```

**Response:**
```json
{
  "success": true,
  "omega": "Ω核:你為助益",
  "stats": {
    "originalChars": 100,
    "compressedChars": 25,
    "charRatio": 4.0,
    "originalBytes": 100,
    "omegaBytes": 62,
    "gzipBytesEst": 37,
    "totalRatioEst": 2.7
  }
}
```

## Quick Start

```bash
# Run server
cd omega-compressor
elide server-node.mts

# Test compression
curl -X POST http://localhost:8080/api/compress \
  -H "Content-Type: application/json" \
  -d '{"spec":"You are helpful", "modelId":"fast"}'
```

## Integration with contextOS

### For MCP Message Compression
```typescript
// Compress before sending
const compressed = await fetch('http://localhost:8080/api/compress', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ spec: message, modelId: 'fast' })
}).then(r => r.json());

// Send compressed
mcp.publish(channel, { omega: compressed.omega });
```

### For Agent System Prompts
```typescript
// Compress verbose instructions once at startup
const omegaKernel = compress(verboseSystemPrompt, 'fast');
// Use compressed kernel for all agent instances
```

## Implementation Guide for Agents

When implementing Omega compression in your agent:

1. **Use Fast mode for real-time** - Dictionary-only is instant and deterministic
2. **Pre-compress system prompts** - LLM mode is fine for one-time compression
3. **Extend dictionaries** - Add domain-specific terms to `PHRASE_MAP` and `WORD_MAP`
4. **Preserve semantics** - Compression must not change meaning
5. **Include stats** - Always report compression ratios for monitoring

## File Structure

```
omega-compressor/
├── server-node.mts      # Main server with compression logic
├── README.md            # This spec document
├── SPEC.md              # Full protocol specification
├── dictionary.json      # Extensible dictionaries
├── tests/
│   └── e2e.spec.js      # End-to-end tests
└── samples/             # Example inputs/outputs
```

## Roadmap

- [ ] Static dictionary file (JSON) for easy extension
- [ ] Pre-shared zstd dictionary for contextOS messages
- [ ] Decompression endpoint for human-readable logs
- [ ] Streaming compression for large documents
- [ ] WHIPLASH native implementation (Rust + zstd)

## License

MIT - Part of the Elide/contextOS ecosystem
