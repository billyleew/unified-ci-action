export type Runtime = "node" | "java" | "python" | "go";
export type Goal = "pr-check" | "ci" | "release";

export interface IuPipesConfig {
  project?: {
    name?: string;
    runtime?: string; // "auto" | Runtime
    "runtime-version"?: string; // "auto" | version
    "working-directory"?: string;
    goal?: string;
  };
  sonar?: Record<string, unknown>;
  sast?: Record<string, unknown>;
  deploy?: Record<string, unknown>;
}

export interface DetectedProject {
  runtime: Runtime;
  runtimeVersion: string;
  workingDirectory: string;
  goal: Goal;
}

export interface Phases {
  pre_install: string[];
  install: string[];
  pre_build: string[];
  build: string[];
  test: string[];
  post: string[];
  publish: string[];
}

export interface Plan {
    version: number;
    detected: DetectedProject;
    project: IuPipesConfig["project"];
    phases: Phases;
    artifacts: string[];
}

export interface Matrix {
    include: Array<{ step_name: string; stage: keyof Phases; run: string}>;
}