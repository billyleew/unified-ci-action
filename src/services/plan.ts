import { fileExists, join, listDir } from "../infra/fs.js";
import type { Goal, Phases, Plan, Runtime, Matrix } from "../domain/types.js";

export class PlanBuilder {
    public static build(params: {
        workspace: string;
        workingDirectory: string;
        runtime: Runtime;
        runtimeVersion: string;
        goal: Goal;
        project?: any;
    }): { plan: Plan; matrix: Matrix} {
        const { workspace, workingDirectory, runtime, runtimeVersion, goal, project } = params;
        const phases = this.buildPhases({ workspace, workingDirectory, runtime, goal });

        const plan: Plan = {
            version: 1,
            detected: { runtime, runtimeVersion, workingDirectory, goal },
            project,
            phases,
            artifacts: this.defaultArtifacts(runtime)
        };

        const matrix: Matrix = {
            include: [
                { step_name: "PRE-INSTALL", stage: "pre_install", run: phases.pre_install.join("\n") },
                { step_name: "INSTALL", stage: "install", run: phases.install.join("\n") },
                { step_name: "PRE-BUILD", stage: "pre_build", run: phases.pre_build.join("\n") },
                { step_name: "BUILD", stage: "build", run: phases.build.join("\n") },
                { step_name: "TEST", stage: "test", run: phases.test.join("\n") },
                { step_name: "POST", stage: "post", run: phases.post.join("\n") },
                { step_name: "PUBLISH", stage: "publish", run: phases.publish.join("\n")}
            ]
        };

        return { plan, matrix };
    }

    private static buildPhases(args: {
        workspace: string;
        workingDirectory: string;
        runtime: Runtime;
        goal: Goal;
    }): Phases {
        const { workspace, workingDirectory, runtime, goal } = args;
        const wd = join(workspace, workingDirectory);

        const phases: Phases = {
            pre_install: [],
            install: [],
            pre_build: [],
            build: [],
            test: [],
            post: [],
            publish: []
        };

        if (runtime === "node") {
            const hasLock = fileExists(join(wd, "package-lock.json")) || fileExists(join(workspace, "package-lock.json"));
            phases.pre_install.push('echo "NODE_OPTIONS=--max-old-space-size=4096" >> $GITHUB_ENV');
            phases.install.push(hasLock ? "npm ci" : "npm install");
            phases.test.push("npm test --if-present");
            phases.build.push("npm run build --if-present");
            return phases;
        }

        if (runtime === "python") {
            const bases = [wd, workspace];
            let req: string | null = null;

            for (const base of bases) {
                const files = listDir(base);
                const found = files.find(f => /^requirements.*\.txt$/i.test(f));
                if (found) { req = found; break; }
                if (fileExists(join(base, "requirements.txt"))) { req = "requirements.txt"; break; }
            }

            if (req) phases.install.push(`python -m pip install -r ${req}`);
            phases.test.push("pytest -q");
            return phases;
        }

        if (runtime === "go") {
            phases.test.push("go test ./...");
            if (goal !== "pr-check") phases.build.push("go build ./...");
            return phases;
        }

        const tool = this.detectJavaTool(workspace, workingDirectory);
        if (tool === "maven") {
            phases.test.push("mvn -B test");
            phases.build.push("mvn -B -DskipTests package");
        } else if (tool === "gradle-wrapper") {
            phases.test.push("./gradlew test");
            phases.build.push("./gradlew build -x test");
        } else {
            phases.test.push("gradle test");
            phases.build.push("gradle build -x test");
        }
        return phases;
    }

    private static detectJavaTool(workspace: string, workingDirectory: string): "maven" | "gradle" | "gradle-wrapper" {
        const wd = join(workspace, workingDirectory);
        const bases = [wd, workspace];

        for (const base of bases) {
            if (fileExists(join(base, "pom.xml"))) return "maven";
            if (fileExists(join(base, "build.gradle")) || fileExists(join(base, "build.gradle.kts"))) {
                if (fileExists(join(base, "gradlew"))) return "gradle-wrapper";
                return "gradle";
            }
        }
        return "maven";
    }

    private static defaultArtifacts(runtime: Runtime): string[] {
        if (runtime === "node") return ["dist/**", "coverage/**"];
        if (runtime === "python") return ["coverage/**", "test-results/**"];
        if (runtime === "go") return ["coverage/**"];
        return ["target/**", "build/**", "**/surefire-reports/**", "**/test-results/**"];
    }
}