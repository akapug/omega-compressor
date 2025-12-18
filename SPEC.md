# Omega A2A Compression Protocol Specification

> Version 1.0.0 | For contextOS and Multi-Agent Systems

## Abstract

This specification defines a multilayer compression protocol for agent-to-agent (A2A) communications. The protocol achieves 3-5x compression while **often improving rule adherence** compared to English prompts. Testing across 7 models shows Omega prompts outperform English in 6 of 7 cases for rule enforcement scenarios.

## 1. Design Goals

1. **Semantic Preservation** - Compressed output must preserve the exact meaning of the input
2. **Rule Adherence** - Compressed format should maintain or improve instruction following
3. **Deterministic** - Same input always produces same output (dictionary mode)
4. **Layered** - Each compression layer is optional and composable
5. **Extensible** - Domain dictionaries can be added without protocol changes
6. **Human-Inspectable** - Compressed output uses meaningful symbols, not opaque binary
7. **Model-Agnostic** - Works across model families (tested: GPT, Claude, Grok, Qwen, DeepSeek)

## 2. Protocol Layers

### Layer 1: Semantic Dictionary Compression (Required)

**Purpose**: Replace English words/phrases with dense Chinese characters and symbols.

**Algorithm**:
1. Normalize input to lowercase
2. Apply symbol replacements (operators like `→`, `·`)
3. Apply phrase mappings (longest match first)
4. Apply word mappings (longest match first)
5. Remove stopwords
6. Clean whitespace and punctuation
7. Prefix with `Ω核:`

**Characteristics**:
- Latency: <50ms
- Compression: 3-5x characters
- Deterministic: Yes

### Layer 2: LLM Normalization (Optional)

**Purpose**: Pre-process input to use dictionary-friendly vocabulary.

**Algorithm**:
1. Send input to small LLM with normalization prompt
2. LLM simplifies synonyms to dictionary-preferred forms
3. Pass normalized output to Layer 1

**Characteristics**:
- Latency: 30-60s (depends on model)
- Improvement: +10-30% compression
- Deterministic: No (LLM output varies)

**When to use**: System prompts, one-time compressions, maximum compression needed.

### Layer 3: Binary Compression (Optional)

**Purpose**: Additional byte-level compression for transport.

**Algorithm**:
1. Apply gzip or zstd to Layer 1/2 output
2. Optionally use pre-shared dictionary tuned to Omega output
3. Base64 encode for text transport (or use binary directly)

**Characteristics**:
- Latency: <10ms
- Improvement: 30-40% byte reduction
- Best for: Network transport, storage

## 3. Output Format

### Standard Format
```
Ω核:[compressed_content]
```

### With Metadata (Extended Format)
```json
{
  "omega": "Ω核:[content]",
  "version": "1.0",
  "layers": ["dict", "gzip"],
  "stats": {
    "originalChars": 332,
    "compressedChars": 76,
    "ratio": 4.4
  }
}
```

## 4. Symbol Vocabulary

### Structural Operators
| Symbol | Unicode | Meaning | Usage |
|--------|---------|---------|-------|
| `→` | U+2192 | sequence, leads to | `A→B` (A then B) |
| `↦` | U+21A6 | maps to, becomes | `意↦策` (intent maps to strategy) |
| `·` | U+00B7 | separator, and | `簡·準·助` (concise and accurate and helpful) |
| `|` | U+007C | or, alternative | `A|B` (A or B) |
| `¬` | U+00AC | not, negation | `¬猜` (do not guess) |
| `>` | U+003E | priority | `意>詞` (intent over words) |

### Semantic Markers
| Symbol | Unicode | Meaning | Usage |
|--------|---------|---------|-------|
| `μ` | U+03BC | uncertainty | `μ時` (when uncertain) |
| `Ω` | U+03A9 | omega/kernel | Prefix marker |
| `…` | U+2026 | continuation | `等…` (etc.) |

## 5. Dictionary Structure

### Hierarchy
```
dictionary/
├── symbols/        # Structural operators
├── phrases/        # Multi-word → single char (highest priority)
│   ├── structural/ # Language patterns
│   ├── agent/      # Agent instruction patterns  
│   ├── technical/  # Technical terms
│   └── contextOS/  # Domain-specific
├── words/          # Single word → single char
│   ├── pronouns/
│   ├── roles/
│   ├── verbs/
│   ├── nouns/
│   └── modifiers/
└── stopwords/      # Words to remove
```

### Matching Priority
1. Symbols (exact match)
2. Phrases (longest first)
3. Words (longest first)
4. Stopwords (remove)

## 6. Implementation Requirements

### Compression
1. MUST prefix output with `Ω核:`
2. MUST apply phrase mappings before word mappings
3. MUST match longest phrases/words first
4. SHOULD remove stopwords after mappings
5. SHOULD collapse multiple separators (`··` → `·`)
6. MAY include compression statistics

### Decompression (Future)
1. MUST recognize `Ω核:` prefix
2. MUST have reverse dictionary mappings
3. SHOULD preserve word boundaries with separators
4. MAY use LLM for ambiguous expansions

## 7. contextOS Integration

### MCP Message Compression
```typescript
// Before sending MCP message
const compressed = omegaCompress(message, { mode: 'fast' });
channel.publish({ omega: compressed.omega, v: '1.0' });

// Receiving agent can either:
// 1. Process compressed directly (if LLM understands)
// 2. Decompress for human-readable logs
```

### Capability Negotiation
```typescript
// Agent profile includes compression capability
profile.capabilities = {
  omegaCompression: {
    version: '1.0',
    modes: ['fast', 'llm'],
    dictionaries: ['core', 'contextOS']
  }
};
```

## 8. Security Considerations

1. **No secrets in compression** - Dictionary is public, compression provides no confidentiality
2. **Validate input** - Sanitize before compression to prevent injection
3. **Bound output size** - Large inputs could produce large outputs
4. **Dictionary integrity** - Use versioned dictionaries, verify checksums

## 9. Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Fast mode latency | <50ms | Dictionary only |
| LLM mode latency | <60s | With normalization |
| Character compression | 3-5x | Varies by content |
| Byte compression (with gzip) | 2-4x | Total reduction |
| Dictionary size | <100KB | JSON format |

## 10. Versioning

- **1.0**: Initial spec with core dictionary
- **1.1** (planned): Extended contextOS dictionary
- **2.0** (planned): Binary format option, streaming support

## Appendix A: Reference Implementation

See `server-node.mts` for the reference implementation:
- `semanticCompress()` - Layer 1 dictionary compression
- `normalizeWithLLM()` - Layer 2 LLM normalization
- `PHRASE_MAP`, `WORD_MAP` - Dictionary definitions

## Appendix B: Sample Outputs

See `samples/` directory for:
- `system-prompts.json` - Agent instruction compression examples
- `contextos-messages.json` - MCP message compression examples
