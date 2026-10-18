#!/usr/bin/env node
import { homedir } from 'node:os';
import process from 'node:process';
import { runCli } from './cli.js';
import { defaultConfigPath } from './config.js';
import { readSecret, readStandardInput } from './terminal.js';

process.exitCode = await runCli(process.argv.slice(2), {
	fetch: (input, init) => fetch(input, init),
	configPath: defaultConfigPath(process.env, process.platform, homedir()),
	variables: process.env,
	readSecret,
	readStandardInput,
	writeOutput: (text) => process.stdout.write(text),
	writeError: (text) => process.stderr.write(text),
});
