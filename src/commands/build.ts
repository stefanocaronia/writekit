import { Command } from "commander";

const SUPPORTED_FORMATS = ["pdf", "epub", "html", "docx"] as const;
type Format = (typeof SUPPORTED_FORMATS)[number];

export const buildCommand = new Command("build")
  .description("Build the novel into the specified format")
  .argument("<format>", `Output format (${SUPPORTED_FORMATS.join(", ")})`)
  .action(async (format: string) => {
    if (!SUPPORTED_FORMATS.includes(format as Format)) {
      console.error(
        `Unknown format: "${format}". Supported: ${SUPPORTED_FORMATS.join(", ")}`,
      );
      process.exit(1);
    }

    // TODO: implement build pipeline
    console.log(`\nBuilding ${format}... (not yet implemented)\n`);
  });
