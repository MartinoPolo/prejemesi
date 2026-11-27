import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filmFrom, takeOption } from './film.mjs';

/*
 * Mixes a film's soundtrack from its cues.json: narration atoms, the music edit (ducked under the
 * voice), and every sound effect, then normalises to streaming loudness.
 * Usage: node tools/mix.mjs [--film cs] [--target -14]
 */
const argumentsList = process.argv.slice(2);
const film = filmFrom(argumentsList);
const targetLoudness = Number(takeOption(argumentsList, '--target', '-14'));
const { cues } = film;
const rate = 48000;
const inputs = [];
const filters = [];
const addInput = (file) => inputs.push(file) - 1;
const milliseconds = (seconds) => Math.max(0, Math.round(seconds * 1000));
const delay = (seconds) => `adelay=${milliseconds(seconds)}|${milliseconds(seconds)}`;
const normalizeFormat = `aresample=${rate},aformat=sample_fmts=fltp:channel_layouts=stereo`;

/* Atoms may come from different takes (e.g. a native-Czech brand name inside the English read). */
const voiceTakes = Map.groupBy(
	cues.vo.map((atom, index) => ({ ...atom, index })),
	(atom) => atom.file ?? cues.voSource,
);
for (const [file, atoms] of voiceTakes) {
	const input = addInput(file);
	filters.push(
		`[${input}:a]${normalizeFormat},asplit=${atoms.length}${atoms.map((atom) => `[voiceSource${atom.index}]`).join('')}`,
	);
}
cues.vo.forEach((atom, index) => {
	const start = Math.max(0, atom.source[0] - cues.voPreRoll);
	const end = atom.source[1] + cues.voTail;
	const length = end - start;
	filters.push(
		`[voiceSource${index}]atrim=${start.toFixed(3)}:${end.toFixed(3)},asetpts=PTS-STARTPTS,` +
			`afade=t=in:d=0.015,afade=t=out:st=${(length - 0.06).toFixed(3)}:d=0.06,` +
			`volume=${atom.gain ?? 0}dB,${delay(atom.at - (atom.source[0] - start))}[voice${index}]`,
	);
});
filters.push(
	`${cues.vo.map((_, index) => `[voice${index}]`).join('')}amix=inputs=${cues.vo.length}:normalize=0,` +
		`highpass=f=80,equalizer=f=3200:t=q:w=1.2:g=2,` +
		`acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,` +
		`asplit=2[voiceBus][voiceKey]`,
);

/* Generated music can carry steady whines; each cue lists notches measured on its file. */
cues.music.forEach((cue, index) => {
	const input = addInput(cue.file);
	const length = cue.until - cue.at;
	const notches = (cue.notches ?? []).map(
		({ frequency, q, gain }) => `equalizer=f=${frequency}:t=q:w=${q}:g=${gain},`,
	);
	filters.push(
		`[${input}:a]${normalizeFormat},${notches.join('')}atrim=${cue.source.toFixed(3)}:${(cue.source + length).toFixed(3)},asetpts=PTS-STARTPTS,` +
			`afade=t=in:d=${cue.fadeIn},afade=t=out:st=${(length - cue.fadeOut).toFixed(3)}:d=${cue.fadeOut},` +
			`volume=${cue.gain}dB,${delay(cue.at)}[music${index}]`,
	);
});
filters.push(
	`${cues.music.map((_, index) => `[music${index}]`).join('')}amix=inputs=${cues.music.length}:normalize=0,volume=-5dB[musicBus]`,
	`[musicBus][voiceKey]sidechaincompress=threshold=0.04:ratio=5:attack=25:release=350:makeup=1[musicDucked]`,
);

const effectInputs = new Map();
cues.sfx.forEach((effect) => {
	if (!effectInputs.has(effect.sound)) {
		effectInputs.set(effect.sound, {
			input: addInput(`audio/sfx/${effect.sound}.wav`),
			uses: [],
		});
	}
	effectInputs.get(effect.sound).uses.push(effect);
});
const effectLabels = [];
for (const [sound, { input, uses }] of effectInputs) {
	const sources = uses.map((_, index) => `[sfx-${sound}-${index}]`);
	filters.push(`[${input}:a]${normalizeFormat},asplit=${uses.length}${sources.join('')}`);
	uses.forEach((effect, index) => {
		const label = `[effect-${sound}-${index}]`;
		filters.push(`${sources[index]}volume=${effect.gain}dB,${delay(effect.at)}${label}`);
		effectLabels.push(label);
	});
}
filters.push(
	`${effectLabels.join('')}amix=inputs=${effectLabels.length}:normalize=0,volume=-2dB[effectBus]`,
);
filters.push(
	`[voiceBus][musicDucked][effectBus]amix=inputs=3:normalize=0,` +
		`apad=whole_dur=${cues.duration},atrim=0:${cues.duration},afade=t=out:st=${cues.duration - 0.6}:d=0.6,` +
		`alimiter=limit=0.95:attack=2:release=40[premaster]`,
);

const workDirectory = join(tmpdir(), 'promo-mix');
mkdirSync(workDirectory, { recursive: true });
mkdirSync('audio/mix', { recursive: true });
const run = (extraFilter, outputArguments) => {
	const script = join(workDirectory, `filter-${film.name}.txt`);
	writeFileSync(script, [...filters, `[premaster]${extraFilter}[out]`].join(';\n'));
	const result = spawnSync(
		'ffmpeg',
		[
			'-hide_banner',
			'-y',
			...inputs.flatMap((file) => ['-i', file]),
			'-filter_complex_script',
			script,
			'-map',
			'[out]',
			...outputArguments,
		],
		{ encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 },
	);
	if (result.status !== 0) {
		console.error(result.stderr?.slice(-4000));
		throw new Error(`ffmpeg failed (${result.status ?? result.signal})`);
	}
	return result.stderr;
};

const analysis = run(`loudnorm=I=${targetLoudness}:TP=-1.2:LRA=9:print_format=json`, [
	'-f',
	'null',
	'-',
]);
const measured = JSON.parse(
	analysis.slice(analysis.lastIndexOf('{'), analysis.lastIndexOf('}') + 1),
);
const normalize =
	`loudnorm=I=${targetLoudness}:TP=-1.2:LRA=9:linear=true:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
	`:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset},aresample=${rate}`;
run(normalize, ['-c:a', 'pcm_s24le', `${film.mix}.wav`]);
spawnSync(
	'ffmpeg',
	[
		'-hide_banner',
		'-y',
		'-i',
		`${film.mix}.wav`,
		'-c:a',
		'libmp3lame',
		'-b:a',
		'256k',
		`${film.mix}.mp3`,
	],
	{ timeout: 60000 },
);
const check = spawnSync(
	'ffmpeg',
	['-hide_banner', '-i', `${film.mix}.wav`, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
	{ encoding: 'utf8', timeout: 60000 },
);
console.log(`${film.mix}.wav`);
console.log(check.stderr.slice(check.stderr.lastIndexOf('Summary')).trim());
