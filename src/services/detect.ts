import { fileExists, join, listDir } from "../infra/fs";
import type { Runtime } from "../domain/types";

export class RuntimeDetector {
  public static detect(workspace: string, workingDirectory: string): Runtime {
    const bases = [join(workspace, workingDirectory), workspace];

    for (const base of bases) {
        // go
        if (fileExists(join(base, "go.mod"))) return "go";

        // node
        if (fileExists(join(base, "package.json"))) return "node";

        // java / kotlin (maven/gradle)
        if (fileExists(join(base, "pom.xml"))) return "java";
        if (fileExists(join(base, "build.gradle")) || fileExists(join(base, "build.gradle.kts"))) return "java";
        if (fileExists(join(base, "settings.gradle")) || fileExists(join(base, "settings.gradle.kts"))) return "java";

        // python
        if (fileExists(join(base, "pyproject.toml"))) return "python";
        if (fileExists(join(base, "requirements.txt"))) return "python";
        const files = listDir(base);
        if (files.some(f => /^requirements.*\.txt$/i.test(f))) return "python";
        if (fileExists(join(base, "setup.py")) || fileExists(join(base, "Pipfile"))) return "python";
    }

    throw new Error("Unable to detect runtime. Add project.runtime in .iupipes.yml or add a recognizable config file.");
  }
}