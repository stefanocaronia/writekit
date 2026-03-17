import { defineConfig } from "vitest/config";
import { rmSync } from "node:fs";
import { join } from "node:path";

export default defineConfig({
    test: {
        globalSetup: "./test/global-setup.ts",
    },
});
