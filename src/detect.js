const fs = require("fs");
const path = require("path");

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

// Detect runtime by looking for well-known files in working-dir first,
// then in repo root as a fallback.
function detectRuntime(workspace, workingDirectory) {
  const wd = path.join(workspace, workingDirectory || ".");
  const root = workspace;

  const candidates = [
    wd,
    root // fallback
  ];

  for (const base of candidates) {
    // Go
    if (exists(path.join(base, "go.mod"))) return "go";

    // Node
    if (exists(path.join(base, "package.json"))) return "node";

    // Java / Kotlin
    if (exists(path.join(base, "pom.xml"))) return "java";
    if (exists(path.join(base, "build.gradle")) || exists(path.join(base, "build.gradle.kts")))
      return "java";
    if (exists(path.join(base, "settings.gradle")) || exists(path.join(base, "settings.gradle.kts")))
      return "java";

    // Python
    if (exists(path.join(base, "pyproject.toml"))) return "python";
    if (exists(path.join(base, "requirements.txt"))) return "python";
    // common variants
    const files = safeListDir(base);
    if (files.some((f) => /^requirements.*\.txt$/i.test(f))) return "python";
    if (exists(path.join(base, "setup.py")) || exists(path.join(base, "Pipfile")))
      return "python";
  }

  return "unknown";
}

function safeListDir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

module.exports = { detectRuntime };