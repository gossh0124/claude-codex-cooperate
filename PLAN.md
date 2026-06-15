# CCC — Claude Codex Cooperate

> Cross-provider AI model orchestration plugin for Claude Code.
> Dynamically routes tasks to the optimal model (Claude or OpenAI) with the right reasoning effort.

## Vision

A single MCP server + skill that replaces DNC v3, enabling Claude Code to dispatch subtasks to the best model across providers — minimizing cost while maximizing correctness.

## Architecture

```
Claude Code (host, Max subscription)
├── Claude models → native subagent/workflow (Max quota)
│
└── OpenAI models → CCC MCP Server (stdio)
     ├── Layer 2: Direct HTTP → chatgpt.com/backend-api/codex/responses
     │   (pure LLM call, zero overhead, subscription quota)
     │
     ├── Layer 1: @openai/codex-sdk  [v2+]
     │   (full Codex agent w/ sandbox & tool use)
     │
     └── Rules Engine → deterministic model+effort assignment
          based on task metadata (type, complexity, risk)
```

### Key Design Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Host environment | Claude Code skill + MCP server |
| 2 | Primary orchestrator | Claude (Code) as host |
| 3 | OpenAI integration | MCP server wrapping Codex API |
| 4 | Task dispatch logic | Auto-route with user override (mixed) |
| 5 | Same-task model selection | Default single, optional dual-verify |
| 6 | Dynamic config | Deterministic rules engine (code, not AI) |
| 7 | Task metadata source | Heuristic fast-scan + lightweight AI fallback |
| 8 | CCC vs DNC | CCC fully replaces DNC v3 |
| 9 | Language | TypeScript (all components) |
| 10 | Project structure | Claude Code plugin shell + npm core package |
| 11 | OpenAI auth | Read ~/.codex/auth.json (Codex subscription OAuth) |
| 12 | OpenAI integration layer | Two-layer: direct API (default) + SDK (agent tasks) |
| 13 | Score ledger | Inherit DNC v3 EMA (α=0.3) + extend for cross-provider |
| 14 | MCP lifecycle | Claude Code auto-managed (stdio) |
| 15 | Tool interface | High-level (ccc_dispatch) + low-level (ccc_call) |

## Workflow Phases (full pipeline)

```
Phase 1: Research / Discovery
  → Low-cost models (Haiku / GPT-5.4-mini) parallel scan
  → Output: structured context map

Phase 2: Analyze / Plan
  → Mid-cost models (Sonnet / GPT-5.4) architecture analysis
  → Output: task decomposition + per-task model config suggestion

Phase 3: Execute
  → Each subtask dynamically assigned optimal model by rules engine
  → pipeline() parallel processing, no inter-task blocking

Phase 4: Verify
  → Independent model cross-verification (never self-verify)
  → Adversarial checks: actively try to refute

Phase 5: Synthesize / Merge
  → High-tier models (Opus / GPT-5.5) final integration & QA
  → Output: final result + cost report
```

## Default Route Table

| Task Type | Effort | Claude Model | OpenAI Model |
|-----------|--------|-------------|--------------|
| Quick completion / explain | low | Haiku | GPT-5.4-mini |
| General code generation | medium | Sonnet | GPT-5.4 |
| Code review / refactor | medium-high | Sonnet | GPT-5.4 |
| Complex architecture | high | Opus | GPT-5.5 |
| Debug (hard) | high | Opus | GPT-5.5 |
| Security audit | high | Opus | GPT-5.5 |
| Docs / comments | low | Haiku | GPT-5.4-mini |

## MCP Tool Interface

### Primary (daily use)

- **`ccc_dispatch`** — One-stop: classify + route + call + record. Returns result.
- **`ccc_dispatch_batch`** — Batch dispatch multiple tasks. [v2+]

### Advanced (manual control / debug)

- **`ccc_call`** — Specify provider + model + effort, bypass rules engine.
- **`ccc_status`** — Quota, available models, current plan.
- **`ccc_ledger`** — Query / reset score ledger. [v2+]

## Score Ledger (extended from DNC v3)

```jsonc
{
  "schema_version": 2,
  "decay_alpha": 0.3,
  "entries": {
    "<task_type>": {
      "<provider>/<model>": {
        "scores": {
          "correctness": 4.2,   // weight: 0.40
          "completeness": 3.8,  // weight: 0.30
          "style": 4.0,         // weight: 0.15
          "efficiency": 4.5     // weight: 0.15
        },
        "weighted_avg": 4.12,
        "sample_count": 12,
        "last_updated": "2026-06-15T...",
        // NEW fields (vs DNC v3)
        "provider": "openai",
        "layer": "direct_api",
        "avg_latency_ms": 3200,
        "avg_cost_usd": 0.003
      }
    }
  }
}
```

## Auth Flow (OpenAI side)

1. Read `~/.codex/auth.json` → extract `access_token`, `refresh_token`, `account_id`
2. On each request: check token expiry (JWT `exp` claim)
3. If < 30s remaining: refresh via `POST https://auth.openai.com/oauth/token`
   - `grant_type=refresh_token`
   - `client_id=app_EMoamEEZ73f0CkXaXp7hrann`
4. Set headers: `Authorization: Bearer <token>`, `ChatGPT-Account-Id: <account_id>`
5. POST to `https://chatgpt.com/backend-api/codex/responses`
6. Required body fields: `stream: true`, `store: false`, `instructions`
7. Parse SSE response events

## Subscription Plan System

```jsonc
// ~/.ccc/plan.json (v1: single plan, self-use)
{
  "name": "personal",
  "claude": {
    "subscription": "max",
    "models": ["opus", "sonnet", "haiku"]
  },
  "openai": {
    "subscription": "pro",
    "models": ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"],
    "auth_source": "~/.codex/auth.json"
  },
  "limits": {
    "max_parallel_agents": 16,
    "prefer_cost": "balanced"  // "min_cost" | "balanced" | "max_quality"
  }
}
```

## v1 Scope

| Component | v1 | v2+ |
|-----------|-----|------|
| MCP Server | stdio, TypeScript, bun | — |
| Tools | `ccc_dispatch` + `ccc_call` + `ccc_status` | `ccc_dispatch_batch`, `ccc_ledger` |
| OpenAI Layer 2 | Direct HTTP to chatgpt.com | — |
| OpenAI Layer 1 | — | @openai/codex-sdk integration |
| Auth | Read ~/.codex/auth.json + auto refresh | OAuth login flow, multi-account |
| Rules Engine | Static route table (JSON config) | Heuristic classifier + AI fallback |
| Score Ledger | Record only (write) | EMA feedback influencing routes |
| Plan System | Single config file (self-use) | Multi-plan, quota management |
| Skill | SKILL.md (replaces DNC v3) | — |
| Plugin wrapper | — | plugin.json + marketplace |
| npm package | — | Extract core for standalone use |

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict)
- **MCP SDK**: `@modelcontextprotocol/sdk` (v1.29+)
- **HTTP client**: native `fetch` (Bun built-in)
- **Schema validation**: Zod
- **Package manager**: pnpm or bun

## Project Structure

```
claude-codex-cooperate/
├── src/
│   ├── server.ts          # MCP server entry (stdio)
│   ├── tools/
│   │   ├── dispatch.ts    # ccc_dispatch tool
│   │   ├── call.ts        # ccc_call tool
│   │   └── status.ts      # ccc_status tool
│   ├── engine/
│   │   ├── router.ts      # Rules engine (static route table)
│   │   ├── classifier.ts  # Task metadata classifier (heuristic)
│   │   └── ledger.ts      # Score ledger read/write
│   ├── providers/
│   │   ├── openai.ts      # Layer 2: direct API to chatgpt.com
│   │   └── auth.ts        # OAuth token management + refresh
│   └── types.ts           # Shared type definitions
├── config/
│   ├── routes.json        # Default route table
│   └── plan.json          # Subscription plan config
├── SKILL.md               # Claude Code skill definition
├── .mcp.json              # MCP server registration
├── package.json
├── tsconfig.json
├── PLAN.md                # This file
├── LICENSE                # Apache-2.0
└── README.md
```

## References

- DNC v3 SKILL.md: `~/.claude/skills/dnc-pipeline/SKILL.md`
- BEST-Route (Microsoft ICML 2025)
- OrcaRouter (2026)
- Reflexion (2023)
- Sherlock (Microsoft 2025)
- Simon Willison's "Codex backdoor API": simonwillison.net/2026/Apr/23/gpt-5-5/
- OpenAI Codex CLI source: github.com/openai/codex
