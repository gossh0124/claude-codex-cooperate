import type { TaskMetadata, TaskType, Complexity } from "../types.ts";

const TYPE_KEYWORDS: Record<TaskType, string[]> = {
  quick_completion: ["complete", "autocomplete", "fill in", "finish"],
  code_generation: [
    "generate",
    "create",
    "write",
    "implement",
    "build",
    "add",
    "new feature",
  ],
  code_review: ["review", "check", "inspect", "audit code", "look at"],
  refactor: ["refactor", "clean up", "simplify", "restructure", "reorganize"],
  architecture: [
    "architect",
    "design",
    "system design",
    "plan",
    "structure",
    "high-level",
  ],
  debug: [
    "debug",
    "fix",
    "bug",
    "error",
    "crash",
    "broken",
    "failing",
    "issue",
    "troubleshoot",
  ],
  security_audit: [
    "security",
    "vulnerability",
    "CVE",
    "injection",
    "XSS",
    "CSRF",
    "auth bypass",
    "OWASP",
  ],
  docs: [
    "document",
    "comment",
    "readme",
    "docstring",
    "jsdoc",
    "explain in docs",
  ],
  test_generation: ["test", "spec", "coverage", "unit test", "integration test"],
  explain: ["explain", "what does", "how does", "why does", "walk through"],
};

const HIGH_RISK_PATHS = [
  /\bauth\b/i,
  /\bpayment\b/i,
  /\bbilling\b/i,
  /\bsecur/i,
  /\bcrypto\b/i,
  /\btoken\b/i,
  /\bsession\b/i,
  /\bpassword\b/i,
  /\bpermission\b/i,
  /\baccess.?control\b/i,
  /\bmigration\b/i,
];

function classifyType(task: string, keywords: string[]): TaskType {
  const lower = task.toLowerCase();

  let bestMatch: TaskType = "code_generation";
  let bestScore = 0;

  for (const [type, typeKeywords] of Object.entries(TYPE_KEYWORDS)) {
    let score = 0;
    for (const kw of typeKeywords) {
      if (lower.includes(kw)) score++;
    }
    for (const kw of keywords) {
      if (typeKeywords.some((tk) => tk.includes(kw.toLowerCase()))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type as TaskType;
    }
  }

  return bestMatch;
}

function classifyComplexity(
  task: string,
  filePaths?: string[],
): Complexity {
  const fileCount = filePaths?.length ?? 0;
  const taskLength = task.length;

  if (fileCount > 10 || taskLength > 1000) return "critical";
  if (fileCount > 5 || taskLength > 500) return "high";
  if (fileCount > 2 || taskLength > 200) return "medium";
  return "low";
}

function classifyRisk(
  type: TaskType,
  filePaths?: string[],
): "low" | "medium" | "high" {
  if (type === "security_audit") return "high";

  if (filePaths?.some((p) => HIGH_RISK_PATHS.some((re) => re.test(p)))) {
    return "high";
  }

  if (["architecture", "debug"].includes(type)) return "medium";
  if (["quick_completion", "explain", "docs"].includes(type)) return "low";
  return "medium";
}

function extractKeywords(task: string): string[] {
  const words = task.toLowerCase().split(/\s+/);
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "can", "shall",
    "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "this", "that", "these", "those", "it", "its", "my", "your",
    "and", "or", "but", "not", "no", "so", "if", "then",
  ]);
  return words.filter((w) => w.length > 2 && !stopWords.has(w));
}

export function classifyTask(
  task: string,
  filePaths?: string[],
): TaskMetadata {
  const keywords = extractKeywords(task);
  const type = classifyType(task, keywords);
  const complexity = classifyComplexity(task, filePaths);
  const risk = classifyRisk(type, filePaths);

  return {
    type,
    complexity,
    risk,
    estimatedFiles: filePaths?.length,
    keywords,
    filePaths,
  };
}
