import fs from "node:fs";
import path from "node:path";

export const fileExists = (p: string): boolean => {
    try {
        return fs.existsSync(p);
    } catch {
        return false;
    }
};

export const readText = (p: string): string | null => {
    try {
        return fs.readFileSync(p, "utf8");
    } catch {
        return null;
    }
};

export const listDir = (dir: string): string[] => {
    try {
        return fs.readdirSync(dir);
    } catch {
        return [];
    }
}

export const join = path.join;