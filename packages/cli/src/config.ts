import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_BASE_URL = 'https://prejemesi.cz';

/** What `login` stores; the token never leaves this file except as a request header. */
export interface CliConfig {
	baseUrl: string;
	token: string;
}

type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

/** `%APPDATA%\prejemesi\config.json` on Windows, `$XDG_CONFIG_HOME/prejemesi/config.json` elsewhere. */
export function defaultConfigPath(
	variables: EnvironmentVariables,
	platform: NodeJS.Platform,
	homeDirectory: string,
): string {
	const platformPath = platform === 'win32' ? path.win32 : path.posix;
	const configHome =
		platform === 'win32'
			? (variables.APPDATA ?? platformPath.join(homeDirectory, 'AppData', 'Roaming'))
			: (variables.XDG_CONFIG_HOME ?? platformPath.join(homeDirectory, '.config'));
	return platformPath.join(configHome, 'prejemesi', 'config.json');
}

function isCliConfig(value: unknown): value is CliConfig {
	return (
		typeof value === 'object' &&
		value !== null &&
		'baseUrl' in value &&
		typeof value.baseUrl === 'string' &&
		'token' in value &&
		typeof value.token === 'string'
	);
}

export async function readConfig(configPath: string): Promise<CliConfig | null> {
	let text: string;
	try {
		text = await readFile(configPath, 'utf8');
	} catch {
		return null;
	}
	try {
		const parsed: unknown = JSON.parse(text);
		return isCliConfig(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/** Readable by the user only, since the file holds a credential. */
export async function writeConfig(configPath: string, config: CliConfig): Promise<void> {
	await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
	await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
	await chmod(configPath, 0o600);
}

export async function removeConfig(configPath: string): Promise<void> {
	await rm(configPath, { force: true });
}
