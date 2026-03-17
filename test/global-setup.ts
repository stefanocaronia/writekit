import { rmSync } from "node:fs";
import { join } from "node:path";

export function setup() {
    rmSync(join(process.cwd(), "sandbox"), { recursive: true, force: true });
}
