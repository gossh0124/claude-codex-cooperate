import { callOpenAI } from "../providers/openai.ts";
import type { Provider, Model, EffortLevel } from "../types.ts";

export interface CallArgs {
  provider: Provider;
  model: Model;
  effort: EffortLevel;
  prompt: string;
  systemPrompt?: string;
}

export interface CallResult {
  response: string;
  provider: string;
  model: string;
  effort: string;
  latency_ms: number;
  token_usage?: {
    input: number;
    output: number;
  };
}

export async function handleCall(args: CallArgs): Promise<CallResult> {
  if (args.provider === "claude") {
    return {
      response: [
        `[CCC Direct Call] Claude / ${args.model} / effort=${args.effort}`,
        "",
        "Claude-side execution is handled natively by Claude Code.",
        "Use this info to configure your agent() call:",
        `  model: '${args.model}'`,
        "",
        `Prompt: ${args.prompt}`,
      ].join("\n"),
      provider: args.provider,
      model: args.model,
      effort: args.effort,
      latency_ms: 0,
    };
  }

  const result = await callOpenAI({
    model: args.model,
    effort: args.effort,
    prompt: args.prompt,
    systemPrompt: args.systemPrompt,
  });

  return {
    response: result.text,
    provider: args.provider,
    model: args.model,
    effort: args.effort,
    latency_ms: result.latency_ms,
    token_usage: result.usage
      ? { input: result.usage.input_tokens, output: result.usage.output_tokens }
      : undefined,
  };
}
