import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type {
  ScoreLedger,
  ScoreEntry,
  Provider,
  Layer,
  RouteDecision,
} from "../types.ts";
import { SCORE_WEIGHTS } from "../types.ts";

const LEDGER_DIR = join(homedir(), ".ccc");
const LEDGER_PATH = join(LEDGER_DIR, "score_ledger.json");
const DECAY_ALPHA = 0.3;

function emptyLedger(): ScoreLedger {
  return {
    schema_version: 2,
    decay_alpha: DECAY_ALPHA,
    entries: {},
  };
}

export function loadLedger(): ScoreLedger {
  if (!existsSync(LEDGER_PATH)) return emptyLedger();
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf-8")) as ScoreLedger;
  } catch {
    return emptyLedger();
  }
}

function saveLedger(ledger: ScoreLedger): void {
  if (!existsSync(LEDGER_DIR)) {
    mkdirSync(LEDGER_DIR, { recursive: true });
  }
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), "utf-8");
}

function computeWeightedAvg(scores: ScoreEntry["scores"]): number {
  return (
    scores.correctness * SCORE_WEIGHTS.correctness +
    scores.completeness * SCORE_WEIGHTS.completeness +
    scores.style * SCORE_WEIGHTS.style +
    scores.efficiency * SCORE_WEIGHTS.efficiency
  );
}

function emaUpdate(oldVal: number, newVal: number, alpha: number): number {
  return alpha * newVal + (1 - alpha) * oldVal;
}

export interface RecordInput {
  taskType: string;
  route: RouteDecision;
  scores: {
    correctness: number;
    completeness: number;
    style: number;
    efficiency: number;
  };
  latency_ms: number;
  cost_usd: number;
}

export function recordResult(input: RecordInput): void {
  const ledger = loadLedger();
  const { taskType, route, scores, latency_ms, cost_usd } = input;
  const modelKey = `${route.provider}/${route.model}`;

  if (!ledger.entries[taskType]) {
    ledger.entries[taskType] = {};
  }

  const existing = ledger.entries[taskType]![modelKey];

  if (existing) {
    existing.scores.correctness = emaUpdate(
      existing.scores.correctness,
      scores.correctness,
      DECAY_ALPHA,
    );
    existing.scores.completeness = emaUpdate(
      existing.scores.completeness,
      scores.completeness,
      DECAY_ALPHA,
    );
    existing.scores.style = emaUpdate(
      existing.scores.style,
      scores.style,
      DECAY_ALPHA,
    );
    existing.scores.efficiency = emaUpdate(
      existing.scores.efficiency,
      scores.efficiency,
      DECAY_ALPHA,
    );
    existing.weighted_avg = computeWeightedAvg(existing.scores);
    existing.sample_count++;
    existing.last_updated = new Date().toISOString();
    existing.avg_latency_ms = emaUpdate(
      existing.avg_latency_ms,
      latency_ms,
      DECAY_ALPHA,
    );
    existing.avg_cost_usd = emaUpdate(
      existing.avg_cost_usd,
      cost_usd,
      DECAY_ALPHA,
    );
  } else {
    const entry: ScoreEntry = {
      scores: { ...scores },
      weighted_avg: computeWeightedAvg(scores),
      sample_count: 1,
      last_updated: new Date().toISOString(),
      provider: route.provider as Provider,
      layer: route.layer as Layer,
      avg_latency_ms: latency_ms,
      avg_cost_usd: cost_usd,
    };
    ledger.entries[taskType]![modelKey] = entry;
  }

  saveLedger(ledger);
}

export function getLedgerStats(): {
  totalEntries: number;
  taskTypes: string[];
  models: string[];
} {
  const ledger = loadLedger();
  const taskTypes = Object.keys(ledger.entries);
  const models = new Set<string>();
  for (const taskEntries of Object.values(ledger.entries)) {
    for (const modelKey of Object.keys(taskEntries)) {
      models.add(modelKey);
    }
  }
  return {
    totalEntries: taskTypes.reduce(
      (sum, t) => sum + Object.keys(ledger.entries[t]!).length,
      0,
    ),
    taskTypes,
    models: [...models],
  };
}
