import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  TaskMetadata,
  RouteDecision,
  RouteEntry,
  Provider,
  Model,
  EffortLevel,
  PlanConfig,
} from "../types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

let routeTable: RouteEntry[] = [];
let planConfig: PlanConfig | null = null;

export function loadConfig(): void {
  const routesPath = join(__dirname, "..", "..", "config", "routes.json");
  const planPath = join(__dirname, "..", "..", "config", "plan.json");

  const routesData = JSON.parse(readFileSync(routesPath, "utf-8"));
  routeTable = routesData.routes as RouteEntry[];

  planConfig = JSON.parse(readFileSync(planPath, "utf-8")) as PlanConfig;
}

function findRoute(taskType: string): RouteEntry | undefined {
  return routeTable.find((r) => r.taskType === taskType);
}

function isModelAvailable(model: Model): boolean {
  if (!planConfig) return false;
  const claudeModels = planConfig.claude.models as string[];
  const openaiModels = planConfig.openai.models as string[];
  return claudeModels.includes(model) || openaiModels.includes(model);
}

function adjustForComplexity(
  entry: RouteEntry,
  meta: TaskMetadata,
): { effort: EffortLevel; provider: Provider; model: Model } {
  let effort = entry.effort;
  let provider = entry.preferredProvider;

  if (meta.complexity === "critical" || meta.risk === "high") {
    effort = "high";
    provider = "claude";
  }

  if (meta.complexity === "low" && meta.risk === "low" && entry.effort !== "low") {
    effort = "medium";
  }

  const costPref = planConfig?.limits.prefer_cost;
  if (costPref === "min_cost") {
    provider = "claude";
    if (effort === "high" || effort === "xhigh") {
      effort = "medium-high";
    }
  } else if (costPref === "max_quality") {
    effort = effort === "low" ? "medium" : effort;
  }

  const model =
    provider === "claude" ? entry.claude : entry.openai;

  return { effort, provider, model };
}

export function route(
  meta: TaskMetadata,
  overrides?: {
    provider?: Provider;
    model?: Model;
    effort?: EffortLevel;
  },
): RouteDecision {
  if (!routeTable.length) loadConfig();

  if (overrides?.provider && overrides?.model && overrides?.effort) {
    return {
      provider: overrides.provider,
      model: overrides.model,
      effort: overrides.effort,
      layer: overrides.provider === "openai" ? "direct_api" : "direct_api",
      reason: "User override: all parameters specified manually",
    };
  }

  const entry = findRoute(meta.type);
  if (!entry) {
    return {
      provider: "claude",
      model: "sonnet",
      effort: "medium",
      layer: "direct_api",
      reason: `No route found for task type '${meta.type}', falling back to sonnet/medium`,
    };
  }

  const adjusted = adjustForComplexity(entry, meta);

  if (overrides?.provider) adjusted.provider = overrides.provider;
  if (overrides?.model) adjusted.model = overrides.model;
  if (overrides?.effort) adjusted.effort = overrides.effort;

  if (!isModelAvailable(adjusted.model)) {
    const fallback =
      adjusted.provider === "claude" ? "sonnet" : "gpt-5.4";
    return {
      provider: adjusted.provider,
      model: fallback as Model,
      effort: adjusted.effort,
      layer: adjusted.provider === "openai" ? "direct_api" : "direct_api",
      reason: `Model ${adjusted.model} unavailable in plan, fell back to ${fallback}`,
    };
  }

  return {
    provider: adjusted.provider,
    model: adjusted.model,
    effort: adjusted.effort,
    layer: adjusted.provider === "openai" ? "direct_api" : "direct_api",
    reason: `Route: ${meta.type}/${meta.complexity}/${meta.risk} -> ${adjusted.provider}/${adjusted.model}/${adjusted.effort}`,
  };
}

export function getRouteTable(): RouteEntry[] {
  if (!routeTable.length) loadConfig();
  return routeTable;
}

export function getPlan(): PlanConfig | null {
  if (!planConfig) loadConfig();
  return planConfig;
}
