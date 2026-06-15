import { getAuthStatus } from "../providers/auth.ts";
import { getPlan, getRouteTable } from "../engine/router.ts";
import { getLedgerStats } from "../engine/ledger.ts";

export interface StatusResult {
  auth: {
    loaded: boolean;
    mode: string | null;
    expired: boolean;
    expiresAt: string | null;
  };
  plan: {
    name: string;
    claudeModels: string[];
    openaiModels: string[];
    costPreference: string;
  } | null;
  routes: {
    count: number;
    taskTypes: string[];
  };
  ledger: {
    totalEntries: number;
    taskTypes: string[];
    models: string[];
  };
}

export function handleStatus(): StatusResult {
  const auth = getAuthStatus();
  const plan = getPlan();
  const routes = getRouteTable();
  const ledger = getLedgerStats();

  return {
    auth: {
      loaded: auth.loaded,
      mode: auth.authMode,
      expired: auth.expired,
      expiresAt: auth.expiresAt
        ? new Date(auth.expiresAt).toISOString()
        : null,
    },
    plan: plan
      ? {
          name: plan.name,
          claudeModels: plan.claude.models,
          openaiModels: plan.openai.models,
          costPreference: plan.limits.prefer_cost,
        }
      : null,
    routes: {
      count: routes.length,
      taskTypes: routes.map((r) => r.taskType),
    },
    ledger,
  };
}
