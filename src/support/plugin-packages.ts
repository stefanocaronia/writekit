import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileExists } from "./fs-utils.js";

const require = createRequire(import.meta.url);

const PLUGIN_PREFIXES = {
    type: "writekit-type-",
    format: "writekit-format-",
} as const;

export type PluginKind = keyof typeof PLUGIN_PREFIXES;

interface WritekitKindConfig {
    name?: string;
}

interface WritekitPackageConfig {
    type?: WritekitKindConfig & { definition?: string };
    format?: WritekitKindConfig & { entry?: string };
}

export interface InstalledPluginPackage {
    packageName: string;
    packageRoot: string;
    packageJson: Record<string, unknown>;
    pluginName: string;
}

function nodeModulesDirs(startDir: string): string[] {
    const dirs: string[] = [];
    let current = resolve(startDir);

    while (true) {
        dirs.push(join(current, "node_modules"));
        const parent = dirname(current);
        if (parent === current) break;
        current = parent;
    }

    return dirs;
}

function packageStem(packageName: string): string {
    return basename(packageName);
}

function matchesPluginPrefix(packageName: string, kind: PluginKind): boolean {
    return packageStem(packageName).startsWith(PLUGIN_PREFIXES[kind]);
}

function inferPluginName(packageName: string, kind: PluginKind): string {
    return packageStem(packageName).slice(PLUGIN_PREFIXES[kind].length);
}

async function listPackagesAt(nodeModulesDir: string, kind: PluginKind): Promise<string[]> {
    try {
        const entries = await readdir(nodeModulesDir, { withFileTypes: true });
        const packages: string[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            if (entry.name.startsWith("@")) {
                const scopeDir = join(nodeModulesDir, entry.name);
                const scopedEntries = await readdir(scopeDir, { withFileTypes: true });
                for (const scopedEntry of scopedEntries) {
                    if (!scopedEntry.isDirectory()) continue;
                    const packageName = `${entry.name}/${scopedEntry.name}`;
                    if (matchesPluginPrefix(packageName, kind)) {
                        packages.push(packageName);
                    }
                }
                continue;
            }

            if (matchesPluginPrefix(entry.name, kind)) {
                packages.push(entry.name);
            }
        }

        return packages;
    } catch {
        return [];
    }
}

async function resolvePackageRoot(packageName: string, startDir: string): Promise<string> {
    const entryPath = require.resolve(packageName, { paths: [startDir] });
    let current = dirname(entryPath);

    while (true) {
        const packageJsonPath = join(current, "package.json");
        if (await fileExists(packageJsonPath)) {
            const raw = await readFile(packageJsonPath, "utf-8");
            const packageJson = JSON.parse(raw) as Record<string, unknown>;
            if (packageJson.name === packageName) {
                return current;
            }
        }

        const parent = dirname(current);
        if (parent === current) break;
        current = parent;
    }

    throw new Error(`Unable to resolve package root for ${packageName}`);
}

async function readInstalledPluginPackage(
    kind: PluginKind,
    packageName: string,
    startDir: string,
): Promise<InstalledPluginPackage> {
    const packageRoot = await resolvePackageRoot(packageName, startDir);
    const raw = await readFile(join(packageRoot, "package.json"), "utf-8");
    const packageJson = JSON.parse(raw) as Record<string, unknown>;
    const writekit = packageJson.writekit as WritekitPackageConfig | undefined;
    const pluginConfig = writekit?.[kind];
    const pluginName = pluginConfig?.name || inferPluginName(packageName, kind);

    return {
        packageName,
        packageRoot,
        packageJson,
        pluginName,
    };
}

export async function listInstalledPluginPackages(
    kind: PluginKind,
    startDir: string,
): Promise<InstalledPluginPackage[]> {
    const packages = new Map<string, InstalledPluginPackage>();

    for (const nodeModulesDir of nodeModulesDirs(startDir)) {
        const packageNames = await listPackagesAt(nodeModulesDir, kind);
        for (const packageName of packageNames) {
            if (packages.has(packageName)) continue;
            try {
                packages.set(packageName, await readInstalledPluginPackage(kind, packageName, startDir));
            } catch {
                // Skip broken packages during discovery; explicit loads will fail later.
            }
        }
    }

    return [...packages.values()].sort((a, b) => a.pluginName.localeCompare(b.pluginName));
}

export async function findInstalledPluginPackage(
    kind: PluginKind,
    pluginName: string,
    startDir: string,
): Promise<InstalledPluginPackage | null> {
    const packages = await listInstalledPluginPackages(kind, startDir);
    return packages.find((pkg) => pkg.pluginName === pluginName) ?? null;
}

export function packageWritekitConfig(
    pluginPackage: InstalledPluginPackage,
): WritekitPackageConfig | undefined {
    return pluginPackage.packageJson.writekit as WritekitPackageConfig | undefined;
}

export function resolvePluginPackageFile(
    pluginPackage: InstalledPluginPackage,
    relativePath: string,
): string {
    const resolvedPath = resolve(pluginPackage.packageRoot, relativePath);
    const packageRoot = resolve(pluginPackage.packageRoot);
    const packageRootWithSep = packageRoot.endsWith(sep)
        ? packageRoot
        : `${packageRoot}${sep}`;

    if (resolvedPath !== packageRoot && !resolvedPath.startsWith(packageRootWithSep)) {
        throw new Error(`Plugin file path escapes package root: ${relativePath}`);
    }

    return resolvedPath;
}

export function resolvePluginPackageEntry(
    pluginPackage: InstalledPluginPackage,
    startDir: string,
): string {
    return require.resolve(pluginPackage.packageName, { paths: [startDir] });
}
