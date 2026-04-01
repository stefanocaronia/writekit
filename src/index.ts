/**
 * writekit — public Node API
 *
 * Import functions directly:
 *   import { loadConfig, loadChapters, buildFormat } from "writekit";
 */

// Project loading
export { loadConfig, loadChapters, loadContributors, loadParts, loadBackcover, parseFrontmatter } from "./project/parse.js";
export type { BookConfig, Chapter, Contributor, PartInfo, SectionKind } from "./project/parse.js";

// Typography
export { loadTypography } from "./support/typography.js";
export type { Typography } from "./support/typography.js";

// Type system
export { loadType, allTypeNames, hasType, resolveTypeFile } from "./project/project-type.js";
export type { ProjectType, TypeFeatures, Section, SampleFile, FrontmatterSchema } from "./project/project-type.js";

// Build (registry-based — specify format by name)
export { buildFormat, hasFormat, allFormatNames, builtinFormatNames } from "./formats/format-registry.js";
export type { FormatBuildContext, FormatBuildResult, FormatPlugin } from "./formats/format-registry.js";

// Print presets
export { getPreset, presetNames, resolvePrintPreset } from "./formats/print-presets.js";
export type { PrintPreset } from "./formats/print-presets.js";

// Check & sync
export { checkProject, type CheckResult } from "./commands/check.js";
export { syncProject } from "./commands/sync.js";

// Translation
export {
    loadTranslationConfig,
    resolveSourceDir,
    loadGlossary,
    extractGlossary,
    getTranslationStatus,
    verifyTranslation,
    syncTranslation,
    scaffoldManuscript,
    buildTranslationConfig,
    serializeGlossary,
} from "./project/translation.js";
export type {
    TranslationConfig,
    TranslationGlossary,
    GlossaryEntry,
    FileStatus,
    VerifyIssue,
    SyncResult,
} from "./project/translation.js";

// Utilities
export { fileExists, dirExists, assertProject, frontmatter, bookFilename } from "./support/fs-utils.js";
export { supportedLanguages, getLabels } from "./support/i18n.js";
export type { Labels } from "./support/i18n.js";
export { slugify, padNumber } from "./support/slug.js";
