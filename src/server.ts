import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { handleDispatch } from "./tools/dispatch.ts";
import { handleCall } from "./tools/call.ts";
import { handleStatus } from "./tools/status.ts";
import { loadAuth } from "./providers/auth.ts";
import { loadConfig } from "./engine/router.ts";

const server = new Server(
  { name: "ccc", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ccc_dispatch",
      description:
        "Dispatch a task to the optimal AI model. Automatically classifies the task, routes it via the rules engine, calls the chosen model, and records the result. For Claude-side tasks, returns routing info for use with Claude Code subagents.",
      inputSchema: {
        type: "object" as const,
        properties: {
          task: {
            type: "string",
            description: "The task description / prompt to send to the model",
          },
          context: {
            type: "string",
            description: "Optional context (code snippets, file contents, etc.)",
          },
          filePaths: {
            type: "array",
            items: { type: "string" },
            description:
              "File paths involved in the task (used for risk/complexity classification)",
          },
          forceProvider: {
            type: "string",
            enum: ["claude", "openai"],
            description: "Override: force a specific provider",
          },
          forceModel: {
            type: "string",
            description:
              "Override: force a specific model (e.g. 'opus', 'gpt-5.5')",
          },
          forceEffort: {
            type: "string",
            enum: ["low", "medium", "medium-high", "high", "xhigh"],
            description: "Override: force a specific reasoning effort level",
          },
        },
        required: ["task"],
      },
    },
    {
      name: "ccc_call",
      description:
        "Directly call a specific provider/model/effort combination, bypassing the rules engine. Use for manual control or debugging.",
      inputSchema: {
        type: "object" as const,
        properties: {
          provider: {
            type: "string",
            enum: ["claude", "openai"],
            description: "Which provider to use",
          },
          model: {
            type: "string",
            description:
              "Model to use (claude: opus/sonnet/haiku, openai: gpt-5.5/gpt-5.4/gpt-5.4-mini)",
          },
          effort: {
            type: "string",
            enum: ["low", "medium", "medium-high", "high", "xhigh"],
            description: "Reasoning effort level",
          },
          prompt: {
            type: "string",
            description: "The prompt to send",
          },
          systemPrompt: {
            type: "string",
            description: "Optional system prompt override",
          },
        },
        required: ["provider", "model", "effort", "prompt"],
      },
    },
    {
      name: "ccc_status",
      description:
        "Get CCC system status: auth state, subscription plan, available models, route table summary, and score ledger stats.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "ccc_dispatch": {
        const result = await handleDispatch(args as unknown as Parameters<typeof handleDispatch>[0]);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "ccc_call": {
        const result = await handleCall(args as unknown as Parameters<typeof handleCall>[0]);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "ccc_status": {
        const result = handleStatus();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  try {
    loadConfig();
  } catch (e) {
    console.error("Warning: could not load config:", e);
  }

  try {
    loadAuth();
  } catch (e) {
    console.error("Warning: Codex auth not loaded:", e);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
