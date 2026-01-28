const core = require("@actions/core");
const fs = require("fs");
const path = require("path");

const { parseIupipes } = require("./parse-iupipes");
const { detectRuntime } = require("./detect");
const { resolveRuntimeVersion } = require("./resolve-runtime");
const { buildPlanAndMatrix } = require("./build-plan");

function safeReadFile(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function normalizeWorkingDir(wd) {
  if (!wd || wd.trim() === "") return ".";
  // keep relative
  const cleaned = wd.replace(/\\/g, "/").replace(/\/+$/g, "");
  return cleaned === "" ? "." : cleaned;
}

async function run() {
  try {
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();

    // 1) Read .iupipes.yml if present
    const iupipesPath = path.join(workspace, ".iupipes.yml");
    const iupipesRaw = safeReadFile(iupipesPath);
    const iupipes = iupipesRaw ? parseIupipes(iupipesRaw) : {};

    const project = iupipes.project || {};
    const goal = project.goal || "ci";

    const workingDirectory = normalizeWorkingDir(project["working-directory"] || project.workingDirectory || ".");
    const absWorkingDir = path.join(workspace, workingDirectory);

    if (!fileExists(absWorkingDir)) {
      core.warning(
        `working-directory '${workingDirectory}' does not exist. Falling back to workspace root '.'`
      );
    }

    // 2) Determine runtime
    let runtime = (project.runtime || "auto").toString().trim().toLowerCase();
    if (runtime === "" || runtime === "auto") {
      runtime = detectRuntime(workspace, workingDirectory);
    }
    if (!["node", "java", "python", "go"].includes(runtime)) {
      throw new Error(
        `Unsupported or undetected runtime '${runtime}'. Supported: node|java|python|go.`
      );
    }

    // 3) Determine runtime version
    let runtimeVersion = (project["runtime-version"] || project.runtimeVersion || "auto")
      .toString()
      .trim()
      .toLowerCase();

    if (runtimeVersion === "" || runtimeVersion === "auto") {
      runtimeVersion = resolveRuntimeVersion({ workspace, workingDirectory, runtime });
    } else {
      // normalize: allow "v20" / "20.x"
      runtimeVersion = runtimeVersion.replace(/^v/i, "").replace(/\.x$/i, "");
    }

    // 4) Build plan + matrix
    const { plan, matrix } = buildPlanAndMatrix({
      workspace,
      workingDirectory,
      runtime,
      runtimeVersion,
      goal,
      iupipes
    });

    // 5) Outputs
    core.setOutput("runtime", runtime);
    core.setOutput("runtime_version", runtimeVersion);
    core.setOutput("working_directory", workingDirectory);
    core.setOutput("plan_json", JSON.stringify(plan));
    core.setOutput("matrix", JSON.stringify(matrix));

    core.info(`Detected runtime: ${runtime}`);
    core.info(`Resolved runtime version: ${runtimeVersion}`);
    core.info(`Working directory: ${workingDirectory}`);
    core.info(`Goal: ${goal}`);
    core.info(`Matrix stages: ${matrix.include.map((x) => x.step_name).join(", ")}`);
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();


