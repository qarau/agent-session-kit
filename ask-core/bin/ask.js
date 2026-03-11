#!/usr/bin/env node
import { runCli } from '../src/cli/index.js';

runCli(process.argv.slice(2)).catch(error => {
  console.error(`[ask-core] ${error.message}`);
  process.exit(1);
});
