const fs = require("fs");
const path = require("path");

function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function resolveRuntimeVersion({ workspace, workingDirectory, runtime }) {
  const wd = path.join(workspace, workingDirectory || ".");
  const root = workspace;

  // Helpers: try in working dir first, then root
  const tryFiles = (relPaths) => {
    for (const base of [wd, root]) {
      for (const rel of relPaths) {
        const p = path.join(base, rel);
        if (exists(p)) return { path: p, content: safeRead(p) };
      }
    }
    return { path: null, content: null };
  };

  if (runtime === "node") {
    // .nvmrc
    const nvm = tryFiles([".nvmrc"]);
    if (nvm.content) {
      const v = nvm.content.trim().replace(/^v/i, "").replace(/\.x$/i, "");
      if (v) return v;
    }
    // package.json engines.node
    const pkg = tryFiles(["package.json"]);
    if (pkg.content) {
      try {
        const obj = JSON.parse(pkg.content);
        const eng = obj?.engines?.node;
        if (typeof eng === "string" && eng.trim()) {
          // Simplify: pick first number group like 18/20
          const m = eng.match(/(\d{2})/);
          if (m) return m[1];
        }
      } catch {
        // ignore
      }
    }
    return "20";
  }

  if (runtime === "go") {
    const gomod = tryFiles(["go.mod"]);
    if (gomod.content) {
      const m = gomod.content.match(/^\s*go\s+(\d+\.\d+)\s*$/m);
      if (m) return m[1];
    }
    return "1.22";
  }

  if (runtime === "python") {
    // MVP: look for .python-version, else default
    const pyver = tryFiles([".python-version"]);
    if (pyver.content) {
      const v = pyver.content.trim();
      if (v) return v;
    }
    // Later: parse pyproject.toml (python requires)
    return "3.11";
  }

  if (runtime === "java") {
    // MVP: if there is a gradle wrapper property file or pom hint, keep simple.
    // Later: parse maven-compiler-plugin / toolchains / gradle toolchain.
    return "17";
  }

  return "unknown";
}

module.exports = { resolveRuntimeVersion };