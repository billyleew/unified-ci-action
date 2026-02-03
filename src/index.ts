import * as core from "@actions/core";

import { IuPipesReader } from "./services/iupipes.js";
import { RuntimeDetector } from "./services/detect.js";
import { RuntimeVersionResolver } from "./services/runtime.js";
import { PlanBuilder } from "./services/plan.js";
import type { Goal, Runtime } from "./domain/types.js";

function normalizeWorkingDir(wd: string | undefined): string {
  const raw = (wd ?? ".").trim();
  const cleaned = raw.replace(/\\/g, "/").replace(/\/+$/g, "");
  return cleaned.length ? cleaned : ".";
}

function normalizeGoal(g: string | undefined): Goal {
  const v = (g ?? "ci").toLowerCase().trim();
  if (v === "pr-check" || v === "ci" || v === "release") return v;
  return "ci";
}

function normalizeRuntime(r: string | undefined): Runtime | "auto" {
  const v = (r ?? "auto").toLowerCase().trim();
  if (v === "auto") return "auto";
  if (v === "node" || v === "java" || v === "python" || v === "go") return v;
  return "auto";
}

async function run(): Promise<void> {
  try {
    const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();

    const cfg = IuPipesReader.read(workspace);
    const project = cfg.project ?? {};

    const workingDirectory = normalizeWorkingDir(project["working-directory"]);
    const goal = normalizeGoal(project.goal);

    // runtime
    let runtime = normalizeRuntime(project.runtime);
    if (runtime === "auto") {
      runtime = RuntimeDetector.detect(workspace, workingDirectory);
    }

    // version
    let rv = (project["runtime-version"] ?? "auto").toString().trim().toLowerCase();
    const runtimeVersion =
      rv === "auto" || rv === ""
        ? RuntimeVersionResolver.resolve({ workspace, workingDirectory, runtime })
        : RuntimeVersionResolver.normalize(rv);

    const { plan, matrix } = PlanBuilder.build({
      workspace,
      workingDirectory,
      runtime,
      runtimeVersion,
      goal,
      project
    });

    // outputs core
    core.setOutput("runtime", runtime);
    core.setOutput("runtime_version", runtimeVersion);
    core.setOutput("working_directory", workingDirectory);
    core.setOutput("plan_json", JSON.stringify(plan));
    core.setOutput("matrix", JSON.stringify(matrix));

    // phase outputs
    core.setOutput("cmd_pre_install", plan.phases.pre_install.join("\n"));
    core.setOutput("cmd_install", plan.phases.install.join("\n"));
    core.setOutput("cmd_pre_build", plan.phases.pre_build.join("\n"));
    core.setOutput("cmd_build", plan.phases.build.join("\n"));
    core.setOutput("cmd_test", plan.phases.test.join("\n"));
    core.setOutput("cmd_post", plan.phases.post.join("\n"));

    core.info(`runtime=${runtime}`);
    core.info(`runtime_version=${runtimeVersion}`);
    core.info(`working_directory=${workingDirectory}`);
    core.info(`goal=${goal}`);
  } catch (e: any) {
    core.setFailed(e?.message ?? String(e));
  }
}

void run();
