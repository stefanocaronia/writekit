#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { watchCommand } from "./commands/watch.js";
import { addCommand } from "./commands/add.js";
import { themeCommand } from "./commands/theme.js";
import { removeCommand } from "./commands/remove.js";
import { syncCommand } from "./commands/sync.js";
import { statsCommand } from "./commands/stats.js";
import { renameCommand } from "./commands/rename.js";
import { translateCommand } from "./commands/translate.js";
import { exportCommand } from "./commands/export.js";
import { importCommand } from "./commands/import.js";

const program = new Command();

program
    .name("wk")
    .description("CLI toolkit for writing books, essays, and articles")
    .version("1.0.3");

program.addCommand(initCommand);
program.addCommand(buildCommand);
program.addCommand(checkCommand);
program.addCommand(watchCommand);
program.addCommand(addCommand);
program.addCommand(removeCommand);
program.addCommand(syncCommand);
program.addCommand(statsCommand);
program.addCommand(renameCommand);
program.addCommand(themeCommand);
program.addCommand(translateCommand);
program.addCommand(exportCommand);
program.addCommand(importCommand);

program.parse();
