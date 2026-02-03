import { join, readText } from "../infra/fs";
import { parseYaml } from "../infra/yaml";
import type { IuPipesConfig } from "../domain/types";

export class IuPipesReader {
    public static read(workspace: string): IuPipesConfig {
        const p = join(workspace, ".iupipes.yml");
        const raw = readText(p);
        if (!raw) return {};
        return parseYaml(raw);
    }
}