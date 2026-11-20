import { readFileSync } from 'node:fs';

/* Shared `--film <name>` handling: every tool works on films/<name>/ and runs from the promo-video directory. */
export const takeOption = (argumentsList, name, fallback) => {
	const index = argumentsList.indexOf(name);
	if (index === -1) {
		return fallback;
	}
	const [value] = argumentsList.splice(index, 2).slice(1);
	return value;
};

export const filmFrom = (argumentsList) => {
	const name = takeOption(argumentsList, '--film', 'cs');
	const directory = `films/${name}`;
	return {
		name,
		directory,
		cues: JSON.parse(readFileSync(`${directory}/cues.json`, 'utf8')),
		mix: `audio/mix/${name}`,
		url: (port = 4610) => `http://localhost:${port}/${directory}/`,
	};
};
