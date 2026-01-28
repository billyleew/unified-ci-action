const fs = require("fs");
const path = require("path");

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function detectJavaBuildTool(workspace, workingDirectory) {
  const wd = path.join(workspace, workingDirectory || ".");
  const root = workspace;

  for (const base of [wd, root]) {
    if (exists(path.join(base, "pom.xml"))) return "maven";
    if (exists(path.join(base, "build.gradle")) || exists(path.join(base, "build.gradle.kts"))) {
      // prefer wrapper if present
      if (exists(path.join(base, "gradlew"))) return "gradle-wrapper";
      return "gradle";
    }
  }
  return "maven";
}

function buildCommands({ runtime, workspace, workingDirectory, goal }) {
  const wd = path.join(workspace, workingDirectory || ".");
  const root = workspace;
  const baseDirs = [wd, root];

  const noop = "";

  if (runtime === "node") {
    const fs = require("fs");
    const path = require("path");

    const wd = path.join(workspace, workingDirectory || ".");
    const hasLock = fs.existsSync(path.join(wd, "package-lock.json")) || fs.existsSync(path.join(workspace, "package-lock.json"));
    const installCmd = hasLock ? "npm ci" : "npm install";

    return {
      install: installCmd,
      test: "npm test --if-present",
      build: "npm run build --if-present"
    };
  }

  if (runtime === "python") {
    // Find requirements file (MVP)
    let req = "requirements.txt";
    for (const base of baseDirs) {
      const files = safeListDir(base);
      const found = files.find((f) => /^requirements.*\.txt$/i.test(f));
      if (found) {
        req = found;
        break;
      }
      if (exists(path.join(base, "requirements.txt"))) {
        req = "requirements.txt";
        break;
      }
    }

    // Keep it safe: if no req exists, install is noop
    const installCmd = req ? `python -m pip install -r ${req}` : noop;

    // Test: if pytest likely, run it; else noop
    // MVP: assume pytest
    const testCmd = "pytest -q";

    return {
      install: installCmd,
      test: testCmd,
      build: noop
    };
  }

  if (runtime === "go") {
    return {
      install: noop,
      test: "go test ./...",
      build: goal === "pr-check" ? noop : "go build ./..."
    };
  }

  if (runtime === "java") {
    const tool = detectJavaBuildTool(workspace, workingDirectory);

    if (tool === "maven") {
      return {
        install: "", // maven resolves deps during build/test
        test: "mvn -B test",
        build: goal === "pr-check" ? "mvn -B -DskipTests package" : "mvn -B -DskipTests package"
      };
    }

    if (tool === "gradle-wrapper") {
      return {
        install: "",
        test: "./gradlew test",
        build: "./gradlew build -x test"
      };
    }

    // gradle without wrapper
    return {
      install: "",
      test: "gradle test",
      build: "gradle build -x test"
    };
  }

  return { install: "", test: "", build: "" };
}

function buildPlanAndMatrix({ workspace, workingDirectory, runtime, runtimeVersion, goal, iupipes }) {
  const commands = buildCommands({ runtime, workspace, workingDirectory, goal });

  // Setup info is primarily used by the workflow (with minimal IFs) in MVP.
  // Still included in plan_json for traceability.
  const setup = {
    runtime,
    runtimeVersion
  };

  const plan = {
    version: 1,
    goal,
    project: iupipes?.project || {},
    detected: {
      runtime,
      runtimeVersion,
      workingDirectory
    },
    setup,
    commands,
    artifacts: defaultArtifacts(runtime)
  };

  // Matrix: 3 stages visible in UI as jobs.
  // Each stage job will do: setup runtime (handled in workflow via IF on runtime) + run stage command (if not empty).
  const matrix = {
    include: [
      {
        step_name: "Setup",
        stage: "setup",
        run: "" // setup is handled by workflow steps
      },
      {
        step_name: "Test",
        stage: "test",
        run: combine(commands.install, commands.test)
      },
      {
        step_name: "Build",
        stage: "build",
        run: commands.build || ""
      }
    ]
  };

  return { plan, matrix };
}

function combine(a, b) {
  const parts = [];
  if (a && a.trim()) parts.push(a.trim());
  if (b && b.trim()) parts.push(b.trim());
  return parts.join("\n");
}

function defaultArtifacts(runtime) {
  if (runtime === "node") return ["dist/**", "coverage/**"];
  if (runtime === "python") return ["coverage/**", "test-results/**"];
  if (runtime === "go") return ["coverage/**"];
  if (runtime === "java") return ["target/**", "build/**", "**/surefire-reports/**", "**/test-results/**"];
  return [];
}

function safeListDir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

module.exports = { buildPlanAndMatrix };