import { join, readText } from "../infra/fs";
import type { Runtime } from "../domain/types";

export class RuntimeVersionResolver {
  public static resolve(params: {
    workspace: string;
    workingDirectory: string;
    runtime: Runtime;
  }): string {
    const { workspace, workingDirectory, runtime } = params;
    const wd = join(workspace, workingDirectory);

    const tryRead = (rel: string): string | null => {
      return readText(join(wd, rel)) ?? readText(join(workspace, rel));
    };

    if (runtime === "node") {
      const nvmrc = tryRead(".nvmrc");
      if (nvmrc) {
        const v = nvmrc.trim().replace(/^v/i, "").replace(/\.x$/i, "");
        if (v) return v;
      }
      const pkgRaw = tryRead("package.json");
      if (pkgRaw) {
        try {
          const pkg = JSON.parse(pkgRaw) as any;
          const eng: unknown = pkg?.engines?.node;
          if (typeof eng === "string") {
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
      const gomod = tryRead("go.mod");
      if (gomod) {
        const m = gomod.match(/^\s*go\s+(\d+\.\d+)\s*$/m);
        if (m) return m[1];
      }
      return "1.22";
    }

    if (runtime === "python") {
      const pyv = tryRead(".python-version");
      if (pyv && pyv.trim()) return pyv.trim();
      return "3.11";
    }

    // java
    return "17";
  }

  public static normalize(version: string): string {
    return version.trim().replace(/^v/i, "").replace(/\.x$/i, "");
  }
}