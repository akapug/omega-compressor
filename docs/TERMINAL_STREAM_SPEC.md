# Terminal Stream Format Specification

## Overview

The Terminal Stream is a file-based coordination layer for AI agents working in IntelliJ IDEA. Instead of MCP responses polluting agent context windows, agents read/write to a shared stream file.

## Goals

1. **Context Efficiency** - Agents read files (processed and discarded) instead of MCP responses (persist in context)
2. **Coordination** - Multiple agents can see each other's activity
3. **Omega Compression** - Messages are semantically compressed
4. **Admin Visibility** - Stream syncs to Glue backend for human oversight

## File Location

```
.omega-stream/
├── general.log      # General coordination
├── dev.log          # Development activity
├── alerts.log       # Urgent notifications
└── sync.json        # Sync state for Glue backend
```

## Message Format

Each line is a self-contained Omega-compressed message:

```
Ω{ts:ISO|from:AGENT|ch:CHANNEL|t:TYPE|m:MESSAGE}
```

### Fields

| Field | Description | Example |
|-------|-------------|---------|
| `ts` | ISO timestamp (truncated) | `21:12:42` |
| `from` | Agent ID (abbreviated) | `aug-opus` |
| `ch` | Channel | `dev` |
| `t` | Message type | `cht`, `sta`, `clm`, `tsk` |
| `m` | Message content | `Working on omega integration` |

### Message Types

| Type | Meaning | Example |
|------|---------|---------|
| `cht` | Chat message | `Ω{t:cht\|from:aug\|m:Hello team}` |
| `sta` | Status update | `Ω{t:sta\|from:aug\|s:act\|w:omega-port}` |
| `clm` | Claim/lock | `Ω{t:clm\|from:aug\|w:schema.ts\|act:⊳}` |
| `tsk` | Task update | `Ω{t:tsk\|tid:T-123\|s:dn}` |
| `err` | Error/alert | `Ω{t:err\|sev:high\|m:Build failed}` |
| `syn` | Sync marker | `Ω{t:syn\|seq:42\|ack:41}` |

## Reading the Stream

Agents use IntelliJ MCP's `get_file_text_by_path`:

```json
{
  "tool": "get_file_text_by_path",
  "params": {
    "pathInProject": ".omega-stream/general.log",
    "maxLinesCount": 50,
    "truncateMode": "start"
  }
}
```

**Key insight**: File reads are processed and discarded - no context pollution!

## Writing to the Stream

Agents use `execute_terminal_command`:

```json
{
  "tool": "execute_terminal_command",
  "params": {
    "command": "echo 'Ω{ts:21:12:42|from:aug|t:cht|m:Hello}' >> .omega-stream/general.log",
    "executeInShell": true
  }
}
```

Or use `replace_text_in_file` to append.

## Sync to Glue Backend

The `sync.json` file tracks what's been synced:

```json
{
  "lastSyncedLine": 142,
  "lastSyncTime": "2025-12-18T21:12:42Z",
  "pendingLines": 3
}
```

A background process (or agent) periodically:
1. Reads new lines from stream files
2. Posts to Glue backend API
3. Updates `sync.json`

## Integration with contextOS

For prototyping, we can:
1. Write to `.omega-stream/` files locally
2. Sync to contextOS Convex backend
3. Display in contextOS web UI

This lets us dogfood the pattern before porting to Glue.

## Benefits

1. **No context bloat** - File reads don't persist
2. **Fast** - Uses IntelliJ's file system, not network calls
3. **Offline-capable** - Works without backend connection
4. **Debuggable** - Human-readable log files
5. **Omega-compressed** - Efficient for AI parsing

## Future Extensions

1. **Channel-based routing** - Different files for different topics
2. **Retention policies** - Auto-rotate old logs
3. **Encryption** - For sensitive coordination
4. **Multi-project** - Sync across multiple IntelliJ projects

## Implementation Status

- [x] Format specification (this doc)
- [ ] omega-compressor: Stream writer/reader
- [ ] contextOS: Sync to Convex
- [ ] Glue: Backend API for stream ingestion
- [ ] IntelliJ: Agent integration demo

