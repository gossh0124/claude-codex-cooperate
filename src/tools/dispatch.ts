import { classifyTask } from "../engine/classifier.ts";
import { route } from "../engine/router.ts";
import { callOpenAI } from "../providers/openai.ts";
import { recordResult } from "../engine/ledger.ts";
import type { DispatchRequest, DispatchResult, TaskMetadata, RouteDecision } from "../types.ts";

export async function handleDispatch(
  args: DispatchRequest,
): Promise<DispatchResult> {
  const meta: TaskMetadata = classifyTask(args.task, args.filePaths);

  const decision: RouteDecision = route(meta, {
    provider: args.forceProvider,
    model: args.forceModel,
    effort: args.forceEffort,
  });

  if (decision.provider === "claude") {
    return {
      response: [
        `[CCC Route] ${decision.reason}`,
        `[Provider] Claude / ${decision.model} / effort=${decision.effort}`,
        "",
        "Claude-side execution is handled natively by Claude Code subagents.",
        "Use this routing info to configure your workflow agent() call:",
        `  model: '${decision.model}'`,
        "",
        `Task: ${args.task}`,
      ].join("\n"),
      route: decision,
      metadata: meta,
      latency_ms: 0,
    };
  }

  const prompt = args.context
    ? `Context:\n${args.context}\n\nTask:\n${args.task}`
    : args.task;

  const result = await callOpenAI({
    model: decision.model,
    effort: decision.effort,
    prompt,
  });

  recordResult({
    taskType: meta.type,
    route: decision,
    scores: {
      correctness: 0,
      completeness: 0,
      style: 0,
      efficiency: 0,
    },
    latency_ms: result.latency_ms,
    cost_usd: 0,
  });

  return {
    response: result.text,
    route: decision,
    metadata: meta,
    latency_ms: result.latency_ms,
    token_usage: result.usage
      ? { input: result.usage.input_tokens, output: result.usage.output_tokens }
      : undefined,
  };
}
