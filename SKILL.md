# CCC — Claude-Codex Cooperate Skill

> Cross-provider AI model orchestration for Claude Code.
> Replaces DNC v3. Every task gets the right model, right effort, right provider.

## When to Use

Use CCC whenever you are executing a multi-step workflow (especially under ultracode), or dispatching any non-trivial task that could benefit from model selection. CCC decides whether a task should run on Claude (opus/sonnet/haiku) or OpenAI (gpt-5.5/gpt-5.4/gpt-5.4-mini) and at what reasoning effort level.

## MCP Tools

CCC exposes three tools via its MCP server:

### `ccc_dispatch` — Smart Routing (Primary Tool)

Classifies the task, routes it via the rules engine, and either calls OpenAI directly or returns Claude routing info for use with `agent()`.

```json
{
  "task": "Debug the race condition in the session manager",
  "filePaths": ["src/auth/session.ts", "src/auth/refresh.ts"],
  "context": "<optional code snippets or file contents>"
}
```

Overrides (optional): `forceProvider`, `forceModel`, `forceEffort`.

**Return shape:**
- For OpenAI tasks: `{ response, provider, model, effort, latency_ms, classification }`
- For Claude tasks: `{ claudeRouting: { model, effort }, classification }` — use this to configure your `agent()` call.

### `ccc_call` — Direct Call (Bypass Engine)

Calls a specific provider/model/effort directly. Use for manual control or A/B testing.

```json
{
  "provider": "openai",
  "model": "gpt-5.5",
  "effort": "high",
  "prompt": "Analyze this architecture..."
}
```

### `ccc_status` — System Status

Returns auth state, plan config, route table summary, and score ledger stats. Call at workflow start to confirm the system is ready.

## 5-Phase Workflow Protocol

When orchestrating complex tasks (especially under ultracode), follow this protocol. Each phase dispatches through CCC for optimal model assignment.

### Phase 1: Research

Gather all relevant context before making decisions.

```
ccc_dispatch({
  task: "Research: <what to find>",
  filePaths: [<relevant paths>]
})
```

Typical routing: low-medium effort, haiku/gpt-5.4-mini for file scanning, sonnet/gpt-5.4 for deeper reading.

### Phase 2: Analyze

Synthesize findings into a structured assessment.

```
ccc_dispatch({
  task: "Analyze: <what to evaluate>",
  context: "<research findings>"
})
```

Typical routing: medium-high effort, sonnet/gpt-5.4 for standard analysis, opus/gpt-5.5 for architecture or security.

### Phase 3: Execute

Implement the changes. This is where most token budget is spent.

```
ccc_dispatch({
  task: "Implement: <what to build/fix>",
  filePaths: [<files to modify>],
  context: "<analysis results>"
})
```

Typical routing: effort scales with complexity and risk. High-risk paths (auth, payment, crypto) automatically get opus/high.

### Phase 4: Verify

Validate the implementation against requirements and for regressions.

```
ccc_dispatch({
  task: "Verify: <what to check>",
  filePaths: [<modified files>],
  context: "<implementation summary>"
})
```

Typical routing: medium-high effort. Security-sensitive changes get high effort adversarial review.

### Phase 5: Synthesize

Produce the final summary, commit message, or PR description.

```
ccc_dispatch({
  task: "Summarize: <what was done>",
  context: "<all phase results>"
})
```

Typical routing: low-medium effort, haiku/gpt-5.4-mini for summaries.

## Workflow Integration

### In `agent()` calls

When CCC routes to Claude, use the returned model info:

```js
const result = await ccc_dispatch({ task: "...", filePaths: [...] });
if (result.claudeRouting) {
  const output = await agent(task, {
    model: result.claudeRouting.model,  // "opus", "sonnet", "haiku"
    label: `ccc:${result.classification.type}`,
  });
}
```

### In `pipeline()` / `parallel()`

Fan out tasks through CCC for per-item model selection:

```js
const results = await pipeline(
  items,
  item => ccc_dispatch({ task: `Review: ${item.path}`, filePaths: [item.path] }),
  (dispatched, item) => {
    if (dispatched.response) return dispatched;  // OpenAI already answered
    return agent(dispatched.task, { model: dispatched.claudeRouting.model });
  }
);
```

### Status check at workflow start

Always verify CCC is operational before a multi-phase workflow:

```js
phase('Init')
const status = await ccc_status({});
if (!status.auth.loaded || status.auth.expired) {
  log('[WARN] OpenAI auth unavailable — falling back to Claude-only routing');
}
```

## Route Table

| Task Type        | Effort      | Claude  | OpenAI       | Preferred |
|------------------|-------------|---------|--------------|-----------|
| quick_completion | low         | haiku   | gpt-5.4-mini | claude    |
| explain          | low         | haiku   | gpt-5.4-mini | claude    |
| docs             | low         | haiku   | gpt-5.4-mini | claude    |
| code_generation  | medium      | sonnet  | gpt-5.4      | openai    |
| test_generation  | medium      | sonnet  | gpt-5.4      | claude    |
| code_review      | medium-high | sonnet  | gpt-5.4      | claude    |
| refactor         | medium-high | sonnet  | gpt-5.4      | openai    |
| architecture     | high        | opus    | gpt-5.5      | claude    |
| debug            | high        | opus    | gpt-5.5      | claude    |
| security_audit   | high        | opus    | gpt-5.5      | claude    |

Dynamic adjustments:
- **High-risk paths** (auth, payment, crypto, etc.) → auto-elevate to high effort + claude
- **Critical complexity** (>10 files or >1000 char task) → auto-elevate to high effort
- **Low complexity + low risk** → may downgrade to medium effort to save tokens

## Score Ledger

CCC tracks model performance over time at `~/.ccc/score_ledger.json`. Each task_type x provider/model combination gets an EMA score (alpha=0.3) across four dimensions:

- **correctness** (weight 0.4) — did the model produce correct output?
- **completeness** (weight 0.3) — was the answer thorough?
- **style** (weight 0.15) — code quality, formatting, conventions
- **efficiency** (weight 0.15) — token usage, latency

v1 is write-only (records but doesn't influence routing). v2 will use ledger scores to break ties between equivalent routes.

## Differences from DNC v3

| Aspect | DNC v3 | CCC |
|--------|--------|-----|
| Model tracking | null in all entries | Mandatory provider + model fields |
| Provider support | Claude only | Claude + OpenAI (Codex subscription) |
| Routing | Single model, varied effort | Cross-provider, per-task model selection |
| Score dimensions | Overall score only | 4-dimension weighted EMA |
| Task classification | Manual | Automatic heuristic classifier |
| OpenAI integration | None | Layer 2 direct API (subscription quota) |
| Workflow protocol | Ad-hoc | Structured 5-phase (Research/Analyze/Execute/Verify/Synthesize) |
