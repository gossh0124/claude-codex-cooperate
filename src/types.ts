export type Provider = "claude" | "openai";

export type ClaudeModel = "opus" | "sonnet" | "haiku";
export type OpenAIModel = "gpt-5.5" | "gpt-5.4" | "gpt-5.4-mini";
export type Model = ClaudeModel | OpenAIModel;

export type EffortLevel = "low" | "medium" | "medium-high" | "high" | "xhigh";

export type TaskType =
  | "quick_completion"
  | "code_generation"
  | "code_review"
  | "refactor"
  | "architecture"
  | "debug"
  | "security_audit"
  | "docs"
  | "test_generation"
  | "explain";

export type Complexity = "low" | "medium" | "high" | "critical";

export type Layer = "direct_api" | "codex_sdk";

export interface TaskMetadata {
  type: TaskType;
  complexity: Complexity;
  risk: "low" | "medium" | "high";
  estimatedFiles?: number;
  keywords: string[];
  filePaths?: string[];
}

export interface RouteDecision {
  provider: Provider;
  model: Model;
  effort: EffortLevel;
  layer: Layer;
  reason: string;
}

export interface RouteEntry {
  taskType: TaskType;
  effort: EffortLevel;
  claude: ClaudeModel;
  openai: OpenAIModel;
  preferredProvider: Provider;
}

export interface ScoreEntry {
  scores: {
    correctness: number;
    completeness: number;
    style: number;
    efficiency: number;
  };
  weighted_avg: number;
  sample_count: number;
  last_updated: string;
  provider: Provider;
  layer: Layer;
  avg_latency_ms: number;
  avg_cost_usd: number;
}

export interface ScoreLedger {
  schema_version: number;
  decay_alpha: number;
  entries: Record<string, Record<string, ScoreEntry>>;
}

export interface PlanConfig {
  name: string;
  claude: {
    subscription: string;
    models: ClaudeModel[];
  };
  openai: {
    subscription: string;
    models: OpenAIModel[];
    auth_source: string;
  };
  limits: {
    max_parallel_agents: number;
    prefer_cost: "min_cost" | "balanced" | "max_quality";
  };
}

export interface CodexAuthData {
  auth_mode: string;
  OPENAI_API_KEY: string | null;
  tokens: {
    id_token: string;
    access_token: string;
    refresh_token: string;
    account_id: string;
  };
  last_refresh: string;
}

export interface OpenAIRequest {
  model: string;
  instructions: string;
  input: OpenAIMessage[];
  stream: true;
  store: false;
  reasoning?: {
    effort: string;
    summary?: string;
  };
  tools?: OpenAITool[];
}

export interface OpenAIMessage {
  type: "message";
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenAITool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface DispatchRequest {
  task: string;
  context?: string;
  filePaths?: string[];
  forceProvider?: Provider;
  forceModel?: Model;
  forceEffort?: EffortLevel;
}

export interface DispatchResult {
  response: string;
  route: RouteDecision;
  metadata: TaskMetadata;
  latency_ms: number;
  token_usage?: {
    input: number;
    output: number;
  };
}

export const EFFORT_TO_OPENAI: Record<EffortLevel, string> = {
  low: "low",
  medium: "medium",
  "medium-high": "high",
  high: "high",
  xhigh: "xhigh",
};

export const SCORE_WEIGHTS = {
  correctness: 0.4,
  completeness: 0.3,
  style: 0.15,
  efficiency: 0.15,
} as const;
