import { getValidToken } from "./auth.ts";
import type { OpenAIRequest, EffortLevel } from "../types.ts";
import { EFFORT_TO_OPENAI } from "../types.ts";

const CODEX_RESPONSES_URL =
  "https://chatgpt.com/backend-api/codex/responses";

export interface OpenAICallOptions {
  model: string;
  effort: EffortLevel;
  prompt: string;
  systemPrompt?: string;
  authConfigPath?: string;
}

export interface OpenAICallResult {
  text: string;
  model: string;
  latency_ms: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

function buildRequest(opts: OpenAICallOptions): OpenAIRequest {
  return {
    model: opts.model,
    instructions: opts.systemPrompt ?? "You are a helpful coding assistant.",
    input: [
      {
        type: "message",
        role: "user",
        content: opts.prompt,
      },
    ],
    stream: true,
    store: false,
    reasoning: {
      effort: EFFORT_TO_OPENAI[opts.effort] ?? "medium",
      summary: "auto",
    },
  };
}

async function parseSSE(response: Response): Promise<{
  text: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
}> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let resultText = "";
  let usage: { input_tokens: number; output_tokens: number; total_tokens: number } | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);

          if (event.type === "response.output_text.delta") {
            resultText += event.delta ?? "";
          }

          if (event.type === "response.completed" && event.response?.usage) {
            const u = event.response.usage;
            usage = {
              input_tokens: u.input_tokens ?? 0,
              output_tokens: u.output_tokens ?? 0,
              total_tokens: u.total_tokens ?? 0,
            };
          }
        } catch {
          // skip unparseable lines
        }
      }
    }
  }

  return { text: resultText, usage };
}

export async function callOpenAI(
  opts: OpenAICallOptions,
): Promise<OpenAICallResult> {
  const { accessToken, accountId } = await getValidToken(opts.authConfigPath);
  const body = buildRequest(opts);
  const start = performance.now();

  const response = await fetch(CODEX_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "ChatGPT-Account-Id": accountId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API error (${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  const { text, usage } = await parseSSE(response);
  const latency_ms = Math.round(performance.now() - start);

  return {
    text,
    model: opts.model,
    latency_ms,
    usage,
  };
}
