#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { buildCommand } from "./commands/build.js";

const program = new Command();

program
  .name("novel")
  .description("CLI framework for creating books")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(buildCommand);

program.parse();
