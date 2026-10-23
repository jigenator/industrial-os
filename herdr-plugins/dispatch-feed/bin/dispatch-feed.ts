#!/usr/bin/env bun
import { run } from "../src/terminal.ts";
await run(process.argv.slice(2)).catch(() => {
  console.error("Dispatch feed could not start; run with --help for usage.");
  process.exitCode = 1;
});
