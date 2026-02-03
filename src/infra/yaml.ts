import yaml from "js-yaml";
import type { IuPipesConfig } from "../domain/types";

export function parseYaml(text: string): IuPipesConfig {
    const obj = yaml.load(text);
    if (!obj || typeof obj !== "object") return {};
    return obj as IuPipesConfig;
}