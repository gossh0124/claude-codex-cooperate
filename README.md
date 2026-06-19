# CCC — Claude Codex Cooperate

Cross-provider AI model orchestration for Claude Code. Dynamically routes tasks to the optimal model (Claude or OpenAI) with the right reasoning effort — minimizing cost, maximizing correctness.

## What it does

CCC is a Claude Code MCP server + skill that acts as an intelligent dispatcher:

- **Rules engine** assigns each task to the best model based on type, complexity, and risk
- **Two-layer OpenAI integration**: direct API for pure LLM calls, Codex SDK for full agent tasks
- **Score ledger** tracks model performance over time (EMA-based), improving routing decisions
- **Subscription-aware**: uses your existing Claude Max + ChatGPT Pro quota — no extra API costs

## Architecture

```
Claude Code (host)
├── Claude models → native subagent (Max subscription quota)
└── OpenAI models → CCC MCP Server
     ├── Layer 2: Direct API (chatgpt.com/backend-api/codex/responses)
     ├── Layer 1: Codex SDK (full agent mode)  [v2]
     └── Rules Engine (deterministic model + effort assignment)
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `ccc_dispatch` | Auto-route: classify task → pick model → call → record result |
| `ccc_call` | Manual: specify provider/model/effort directly |
| `ccc_status` | View quota, available models, current plan |

## Quick Start

> **Prerequisites**: Claude Code with Max subscription, Codex CLI logged in (`codex login`)

```bash
# Clone
git clone https://github.com/gossh0124/claude-codex-cooperate.git
cd claude-codex-cooperate

# Install
bun install

# Add to your project's .mcp.json
# (see Configuration below)
```

### Configuration

Add CCC to any project by creating or editing `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "ccc": {
      "command": "bun",
      "args": ["run", "D:/path/to/claude-codex-cooperate/src/server.ts"]
    }
  }
}
```

Or add it globally for all projects via `~/.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "ccc": {
      "command": "bun",
      "args": ["run", "D:/path/to/claude-codex-cooperate/src/server.ts"]
    }
  }
}
```

Replace `D:/path/to/claude-codex-cooperate` with your actual clone path.

## Route Table

| Task Type | Effort | Claude | OpenAI |
|-----------|--------|--------|--------|
| Quick completion | low | Haiku | GPT-5.4-mini |
| Code generation | medium | Sonnet | GPT-5.4 |
| Code review | medium-high | Sonnet | GPT-5.4 |
| Architecture | high | Opus | GPT-5.5 |
| Debug (hard) | high | Opus | GPT-5.5 |
| Security audit | high | Opus | GPT-5.5 |
| Docs / comments | low | Haiku | GPT-5.4-mini |

Routes are configurable via `config/routes.json`. The score ledger adjusts recommendations over time based on actual performance.

## Roadmap

- [x] Design & plan
- [x] v1: MCP server + direct OpenAI API + static routes
- [x] v1: Score ledger (write-only)
- [x] v1: SKILL.md (replaces DNC v3)
- [x] v1: Heuristic task classifier + rules engine
- [x] v1: Routing tests
- [ ] v2: Codex SDK integration (Layer 1 — full agent mode)
- [ ] v2: AI fallback classifier for ambiguous tasks
- [ ] v2: EMA feedback loop (ledger scores influence routing)
- [ ] v2: Multi-plan support
- [ ] v3: Claude Code plugin packaging
- [ ] v3: npm package for standalone use

## License

Apache-2.0
