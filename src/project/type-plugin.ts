import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileExists } from "../support/fs-utils.js";
import {
    findInstalledPluginPackage,
    packageWritekitConfig,
    resolvePluginPackageEntry,
    resolvePluginPackageFile,
} from "../support/plugin-packages.js";
import type { Theme } from "../support/theme.js";
import type { BookConfig, Chapter } from "./parse.js";
import type { ProjectType } from "./project-type.js";
import type { ValidationIssue, Schema } from "./schema.js";

const LOCAL_PLUGIN_EXTS = [".mjs", ".js", ".cjs"] as const;

interface TypeContextBase {
    projectDir: string;
    typeName: string;
    typeDef: ProjectType;
    typeOptions: Record<string, unknown>;
}

export interface TypeInitContext extends TypeContextBase {
    config: BookConfig;
}

export interface TypeCheckContext extends TypeContextBase {
    config: BookConfig;
}

export interface TypeBuildContext extends TypeContextBase {
    config: BookConfig;
    chapters: Chapter[];
    theme: Theme;
    formats: string[];
}

export interface TypeSyncContext extends TypeContextBase {
    config: BookConfig;
}

export interface TypePlugin {
    name?: string;
    configSchema?: Schema;
    onInit?: (context: TypeInitContext) => Promise<void> | void;
    onCheck?: (context: TypeCheckContext) => Promise<ValidationIssue[] | void> | ValidationIssue[] | void;
    onBuild?: (context: TypeBuildContext) => Promise<void> | void;
    onSync?: (context: TypeSyncContext) => Promise<void> | void;
}

function localTypePluginDir(projectDir: string, name: string): string {
    return join(projectDir, "types", name);
}

async function resolveLocalTypePluginFile(projectDir: string, name: string): Promise<string | null> {
    const pluginDir = localTypePluginDir(projectDir, name);
    for (const ext of LOCAL_PLUGIN_EXTS) {
        const file = join(pluginDir, `index${ext}`);
        if (await fileExists(file)) return file;
    }
    return null;
}

function normalizePlugin(name: string, plugin: Partial<TypePlugin>): TypePlugin {
    if (!plugin || typeof plugin !== "object") {
        throw new Error(`Invalid type plugin "${name}": expected an object export`);
    }

    return {
        name: plugin.name ?? name,
        configSchema: plugin.configSchema,
        onInit: plugin.onInit,
        onCheck: plugin.onCheck,
        onBuild: plugin.onBuild,
        onSync: plugin.onSync,
    };
}

async function loadModulePlugin(file: string, name: string): Promise<TypePlugin> {
    const mod = await import(pathToFileURL(file).href);
    return normalizePlugin(name, (mod.default ?? mod.plugin ?? mod) as Partial<TypePlugin>);
}

export async function resolveTypePluginFile(name: string, projectDir?: string): Promise<string | null> {
    if (projectDir) {
        const localFile = await resolveLocalTypePluginFile(projectDir, name);
        if (localFile) return localFile;

        const pluginPackage = await findInstalledPluginPackage("type", name, projectDir);
        if (pluginPackage) {
            const typeConfig = packageWritekitConfig(pluginPackage)?.type;
            return typeConfig?.entry
                ? resolvePluginPackageFile(pluginPackage, typeConfig.entry)
                : resolvePluginPackageEntry(pluginPackage, projectDir);
        }
    }

    return null;
}

export async function loadTypePlugin(name: string, projectDir?: string): Promise<TypePlugin | null> {
    const pluginFile = await resolveTypePluginFile(name, projectDir);
    if (!pluginFile) return null;
    return loadModulePlugin(pluginFile, name);
}

export function typeOptions(config: BookConfig): Record<string, unknown> {
    const options = config.type_options;
    return options && typeof options === "object" && !Array.isArray(options) ? options : {};
}
