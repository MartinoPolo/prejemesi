import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

// Estimates tempo and beat phase from the RMS envelope that ffmpeg prints every 10 ms.
const [audioPath, minimumBpm = '80', maximumBpm = '160'] = process.argv.slice(2);
const envelopePath = `${audioPath}.envelope.txt`;
execFileSync('ffmpeg', [
	'-hide_banner',
	'-loglevel',
	'error',
	'-y',
	'-i',
	audioPath,
	'-af',
	`aformat=channel_layouts=mono:sample_rates=48000,highpass=f=80,asetnsamples=n=480,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=${envelopePath.replaceAll('\\', '/').replace(':', '\\:')}`,
	'-f',
	'null',
	'-',
]);
const levels = readFileSync(envelopePath, 'utf8')
	.split('\n')
	.filter((line) => line.startsWith('lavfi'))
	.map((line) => Math.max(-80, Number(line.split('=')[1]) || -80));
rmSync(envelopePath);

const onset = levels.map((level, index) =>
	index === 0 ? 0 : Math.max(0, level - levels[index - 1]),
);
const mean = onset.reduce((sum, value) => sum + value, 0) / onset.length;
const centered = onset.map((value) => value - mean);
const framesPerSecond = 100;
const sampleAt = (position) => {
	const low = Math.floor(position);
	if (low + 1 >= centered.length) {
		return 0;
	}
	return centered[low] + (centered[low + 1] - centered[low]) * (position - low);
};

const candidates = [];
for (let bpm = Number(minimumBpm); bpm <= Number(maximumBpm); bpm += 0.25) {
	const lag = (60 / bpm) * framesPerSecond;
	let score = 0;
	for (let index = 0; index < centered.length; index++) {
		score +=
			centered[index] *
			(sampleAt(index + lag) +
				0.5 * sampleAt(index + 2 * lag) +
				0.5 * sampleAt(index + 4 * lag));
	}
	candidates.push({ bpm, score });
}
candidates.sort((a, b) => b.score - a.score);
const bpm = candidates[0].bpm;
const beatFrames = (60 / bpm) * framesPerSecond;
let bestPhase = 0;
let bestPhaseScore = -Infinity;
for (let phase = 0; phase < beatFrames; phase += 0.5) {
	let score = 0;
	for (let position = phase; position < centered.length; position += beatFrames) {
		score += sampleAt(position);
	}
	if (score > bestPhaseScore) {
		[bestPhase, bestPhaseScore] = [phase, score];
	}
}
// Strongest beat within each group of four marks the likely downbeat.
const barScores = [0, 0, 0, 0];
let beatIndex = 0;
for (let position = bestPhase; position < centered.length; position += beatFrames, beatIndex++) {
	barScores[beatIndex % 4] +=
		sampleAt(position) + sampleAt(position - 1) + sampleAt(position + 1);
}
const downbeatOffset = barScores.indexOf(Math.max(...barScores));
const result = {
	bpm,
	topTempos: candidates.slice(0, 5).map((candidate) => candidate.bpm),
	firstBeatSeconds: bestPhase / framesPerSecond,
	beatSeconds: 60 / bpm,
	firstDownbeatSeconds: (bestPhase + downbeatOffset * beatFrames) / framesPerSecond,
	barScores: barScores.map((score) => Number(score.toFixed(1))),
};
writeFileSync(`${audioPath}.beats.json`, JSON.stringify(result, null, '\t'));
console.log(JSON.stringify(result));
