import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CodexAuthData } from "../types.ts";

const CODEX_AUTH_PATH = join(homedir(), ".codex", "auth.json");
const OPENAI_AUTH_URL = "https://auth.openai.com/oauth/token";
const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const REFRESH_MARGIN_MS = 30_000;

let cachedAuth: CodexAuthData | null = null;
let tokenExpiresAt = 0;

function resolveAuthPath(configPath?: string): string {
  if (configPath) {
    const resolved = configPath.replace(/^~/, homedir());
    if (existsSync(resolved)) return resolved;
  }
  return CODEX_AUTH_PATH;
}

function parseJwtExp(jwt: string): number {
  const parts = jwt.split(".");
  const payload = parts[1];
  if (!payload) return 0;
  const decoded = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf-8"),
  );
  return (decoded.exp as number) * 1000;
}

export function loadAuth(configPath?: string): CodexAuthData {
  const authPath = resolveAuthPath(configPath);
  if (!existsSync(authPath)) {
    throw new Error(
      `Codex auth not found at ${authPath}. Run 'codex login' first.`,
    );
  }
  const raw = readFileSync(authPath, "utf-8");
  cachedAuth = JSON.parse(raw) as CodexAuthData;
  tokenExpiresAt = parseJwtExp(cachedAuth.tokens.access_token);
  return cachedAuth;
}

function isTokenExpired(): boolean {
  return Date.now() >= tokenExpiresAt - REFRESH_MARGIN_MS;
}

async function refreshToken(): Promise<void> {
  if (!cachedAuth) throw new Error("Auth not loaded");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CODEX_CLIENT_ID,
    refresh_token: cachedAuth.tokens.refresh_token,
  });

  const res = await fetch(OPENAI_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    id_token?: string;
  };

  cachedAuth.tokens.access_token = data.access_token;
  if (data.refresh_token) {
    cachedAuth.tokens.refresh_token = data.refresh_token;
  }
  if (data.id_token) {
    cachedAuth.tokens.id_token = data.id_token;
  }
  cachedAuth.last_refresh = new Date().toISOString();
  tokenExpiresAt = parseJwtExp(data.access_token);

  const authPath = resolveAuthPath();
  writeFileSync(authPath, JSON.stringify(cachedAuth, null, 2), "utf-8");
}

export async function getValidToken(configPath?: string): Promise<{
  accessToken: string;
  accountId: string;
}> {
  if (!cachedAuth) loadAuth(configPath);
  if (!cachedAuth) throw new Error("Auth not loaded");

  if (isTokenExpired()) {
    await refreshToken();
  }

  return {
    accessToken: cachedAuth.tokens.access_token,
    accountId: cachedAuth.tokens.account_id,
  };
}

export function getAuthStatus(): {
  loaded: boolean;
  authMode: string | null;
  expiresAt: number;
  expired: boolean;
} {
  return {
    loaded: cachedAuth !== null,
    authMode: cachedAuth?.auth_mode ?? null,
    expiresAt: tokenExpiresAt,
    expired: isTokenExpired(),
  };
}
