# writekit Plugin API

writekit can be extended in three ways:

- `TypePlugin` for new project types and type-specific logic
- `FormatPlugin` for new output formats
- `PresetPlugin` for new print presets

Plugins can be:

- builtin
- local to a project
- external npm packages

Discovery order is always the most local first:

- types: local `types/` -> builtin -> `node_modules/writekit-type-*`
- formats: builtin -> local `formats/` -> `node_modules/writekit-format-*`
- presets: builtin -> local `presets/` -> `node_modules/writekit-preset-*`

## Config namespaces

Plugin-specific config should not add random top-level keys.

Use:

```yaml
type: screenplay
print_preset: roomy
build_formats:
  - html
  - fountain

type_options:
  scene_numbers: true
  dialogue_indent: 18

format_options:
  fountain:
    include_title_page: true
```

- `type_options` belongs to the active project type
- `format_options.<format>` belongs to one specific format plugin
- print presets stay declarative, so they do not need a dedicated options namespace

## Type plugins

A type has two parts:

1. a required `type.yaml` definition
2. an optional runtime plugin module

### Local type

```text
types/
  screenplay/
    type.yaml
    index.mjs
```

### npm package type

Package name:

```text
writekit-type-screenplay
```

Optional `package.json` metadata:

```json
{
  "name": "writekit-type-screenplay",
  "type": "module",
  "writekit": {
    "type": {
      "definition": "./defs/type.yaml",
      "entry": "./src/plugin.js"
    }
  }
}
```

If omitted:

- `definition` defaults to `type.yaml`
- `entry` defaults to the package entrypoint

### Runtime contract

```ts
export default {
  configSchema: {
    scene_numbers: { type: "boolean" }
  },

  async onInit(ctx) {},
  async onCheck(ctx) {
    return [];
  },
  async onBuild(ctx) {},
  async onSync(ctx) {}
}
```

Available hooks:

- `onInit(ctx)` after `wk init` has scaffolded the project
- `onCheck(ctx)` during `wk check`; return validation issues
- `onBuild(ctx)` before output formats are built
- `onSync(ctx)` during `wk sync`

Each hook receives:

- `projectDir`
- `typeName`
- `typeDef`
- `config`
- `typeOptions`

Build hooks also receive:

- `chapters`
- `theme`
- `formats`

### Validation issues

`onCheck` should return the same shape used by the core validator:

```ts
[
  { level: "warning", message: "..." },
  { level: "error", message: "..." }
]
```

### Example

```js
export default {
  configSchema: {
    atlas_mode: {
      type: "string",
      values: ["strict", "loose"]
    }
  },

  async onBuild(ctx) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    await mkdir(join(ctx.projectDir, "build"), { recursive: true });
    await writeFile(
      join(ctx.projectDir, "build", "atlas-hook.txt"),
      "formats=" + ctx.formats.join(",")
    );
  }
};
```

## Format plugins

### Local format

```text
formats/
  fountain.mjs
```

### npm package format

Package name:

```text
writekit-format-fountain
```

Optional `package.json` metadata:

```json
{
  "writekit": {
    "format": {
      "entry": "./src/plugin.js"
    }
  }
}
```

### Runtime contract

```ts
export default {
  name: "fountain",
  extension: "fountain",
  configSchema: {
    include_title_page: { type: "boolean" }
  },
  async build(ctx) {
    return "...";
  }
}
```

The plugin can return:

- `string`
- `Buffer`
- `{ content, extension? }`
- `{ path }`

The build context includes:

- `projectDir`
- `buildDir`
- `config`
- `chapters`
- `theme`
- `contributors`
- `backcover`
- `coverPath`
- `sections`
- `features`
- `typeDefaultPreset`
- `options` from `format_options.<name>`
- `filenameFor(ext)`
- `writeOutput(ext, content)`

### Example

```js
export default {
  extension: "txt",
  configSchema: {
    header: { type: "string" }
  },
  async build(ctx) {
    const header = typeof ctx.options.header === "string" ? ctx.options.header : "TITLE";
    return header + "=" + ctx.config.title + "\nCHAPTERS=" + ctx.chapters.length;
  }
};
```

## Preset plugins

Preset plugins are declarative by design. They add a new print preset but do not add hooks.

### Local preset

```text
presets/
  roomy.mjs
```

### npm package preset

Package name:

```text
writekit-preset-roomy
```

Optional `package.json` metadata:

```json
{
  "writekit": {
    "preset": {
      "entry": "./plugin.js"
    }
  }
}
```

### Contract

```ts
export default {
  preset: {
    name: "Roomy",
    description: "Large trim with generous inner margin",
    width: 160,
    height: 240,
    margin: { top: 20, bottom: 20, inner: 26, outer: 18 },
    bleed: 3,
    mirrorMargins: true,
    pageNumbers: true,
    runningHeader: true,
    rectoStart: true
  }
}
```

The resolved preset still passes through the normal `layout` overrides in `config.yaml`.

## Notes for plugin authors

- Plugin code is trusted code. It can touch the filesystem, network, or databases.
- Keep hooks narrow and deterministic where possible.
- Prefer `configSchema` over ad-hoc config parsing.
- Use project-local plugins when the customization is specific to one book or workspace.
- Use npm packages when you want to share a type, format, or preset across multiple projects.
