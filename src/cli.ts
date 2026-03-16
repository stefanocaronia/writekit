#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { watchCommand } from "./commands/watch.js";
import { addCommand } from "./commands/add.js";
import { themeCommand } from "./commands/theme.js";

const program = new Command();

program
    .name("wk")
    .description("CLI framework for creating books")
    .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(buildCommand);
program.addCommand(checkCommand);
program.addCommand(watchCommand);
program.addCommand(addCommand);
program.addCommand(themeCommand);

program.parse();
