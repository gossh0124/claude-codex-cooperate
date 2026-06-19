import { classifyTask } from "../src/engine/classifier.ts";
import { route, loadConfig } from "../src/engine/router.ts";

loadConfig();

const cases = [
  {
    name: "debug task -> high effort",
    task: "Debug this crash in the payment module",
    paths: ["src/payment/processor.ts"],
  },
  {
    name: "simple explain -> low effort",
    task: "Explain what this function does",
    paths: [],
  },
  {
    name: "security audit -> high effort, high risk",
    task: "Audit this auth middleware for XSS vulnerabilities",
    paths: ["src/auth/middleware.ts"],
  },
  {
    name: "code generation -> medium effort",
    task: "Generate a REST API endpoint for user profile",
    paths: ["src/api/users.ts"],
  },
  {
    name: "refactor -> medium-high effort",
    task: "Refactor and simplify the data processing pipeline",
    paths: ["src/pipeline/transform.ts", "src/pipeline/load.ts", "src/pipeline/extract.ts"],
  },
  {
    name: "docs -> low effort",
    task: "Write JSDoc comments for the utility functions",
    paths: ["src/utils/helpers.ts"],
  },
  {
    name: "architecture -> high effort",
    task: "Design the system architecture for the new microservices migration",
    paths: [],
  },
  {
    name: "test generation -> medium effort",
    task: "Write unit tests for the authentication service",
    paths: ["src/auth/service.ts"],
  },
];

console.log("=== CCC Routing Tests ===\n");

let passed = 0;
let failed = 0;

for (const c of cases) {
  const meta = classifyTask(c.task, c.paths.length ? c.paths : undefined);
  const decision = route(meta);

  const ok =
    (c.name.includes("debug") && meta.type === "debug" && decision.effort === "high") ||
    (c.name.includes("explain") && meta.type === "explain" && decision.effort === "low") ||
    (c.name.includes("security") && meta.type === "security_audit" && decision.effort === "high") ||
    (c.name.includes("code generation") && meta.type === "code_generation") ||
    (c.name.includes("refactor") && meta.type === "refactor") ||
    (c.name.includes("docs") && meta.type === "docs" && decision.effort === "low") ||
    (c.name.includes("architecture") && meta.type === "architecture" && decision.effort === "high") ||
    (c.name.includes("test generation") && meta.type === "test_generation");

  const status = ok ? "[PASS]" : "[FAIL]";
  if (ok) passed++; else failed++;

  console.log(`${status} ${c.name}`);
  console.log(`  classified: type=${meta.type} complexity=${meta.complexity} risk=${meta.risk}`);
  console.log(`  routed:     ${decision.provider}/${decision.model} effort=${decision.effort}`);
  console.log(`  reason:     ${decision.reason}`);
  console.log();
}

console.log(`--- ${passed} passed, ${failed} failed ---`);

if (failed > 0) process.exit(1);
