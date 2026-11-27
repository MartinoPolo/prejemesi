import { writeFileSync, mkdirSync } from 'node:fs';

// Procedural foley for the collage film: every sound is synthesized so the mix has no licensing strings.
const sampleRate = 48000;
const outputDirectory = 'audio/sfx';
mkdirSync(outputDirectory, { recursive: true });

function random(seed) {
	let state = seed >>> 0 || 1;
	return () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return (state >>> 0) / 4294967296;
	};
}

const buffer = (seconds) => [
	new Float32Array(Math.ceil(seconds * sampleRate)),
	new Float32Array(Math.ceil(seconds * sampleRate)),
];

function biquad(type, frequency, q = 0.707) {
	const omega = (2 * Math.PI * frequency) / sampleRate;
	const alpha = Math.sin(omega) / (2 * q);
	const cosine = Math.cos(omega);
	let b0, b1, b2, a0, a1, a2;
	if (type === 'lowpass') {
		[b0, b1, b2] = [(1 - cosine) / 2, 1 - cosine, (1 - cosine) / 2];
	}
	if (type === 'highpass') {
		[b0, b1, b2] = [(1 + cosine) / 2, -(1 + cosine), (1 + cosine) / 2];
	}
	if (type === 'bandpass') {
		[b0, b1, b2] = [alpha, 0, -alpha];
	}
	[a0, a1, a2] = [1 + alpha, -2 * cosine, 1 - alpha];
	let x1 = 0,
		x2 = 0,
		y1 = 0,
		y2 = 0;
	return (x) => {
		const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
		[x2, x1, y2, y1] = [x1, x, y1, y];
		return y;
	};
}

// Time-varying filter: recomputes coefficients each 64 samples from a frequency function.
function sweepFilter(type, frequencyAt, q = 1) {
	let filter = biquad(type, frequencyAt(0), q);
	let counter = 0;
	return (x, time) => {
		if (counter++ % 64 === 0) {
			filter = biquad(type, Math.min(20000, Math.max(20, frequencyAt(time))), q);
		}
		return filter(x);
	};
}

const envelope = (time, attack, decay) =>
	time < 0 ? 0 : time < attack ? time / attack : Math.exp(-(time - attack) / decay);

function addTone(
	target,
	{
		start = 0,
		frequency,
		frequencyEnd = frequency,
		duration,
		attack = 0.002,
		decay = 0.1,
		gain = 0.5,
		pan = 0,
		shape = 'sine',
		partials = [[1, 1]],
	},
) {
	const [left, right] = target;
	const startIndex = Math.floor(start * sampleRate);
	const length = Math.floor(duration * sampleRate);
	const phases = partials.map(() => 0);
	for (let index = 0; index < length && startIndex + index < left.length; index++) {
		const time = index / sampleRate;
		const progress = time / duration;
		const frequencyNow = frequency * Math.pow(frequencyEnd / frequency, progress);
		let value = 0;
		partials.forEach(([ratio, weight, partialDecay = decay], partialIndex) => {
			phases[partialIndex] += (2 * Math.PI * frequencyNow * ratio) / sampleRate;
			const wave =
				shape === 'triangle'
					? (2 / Math.PI) * Math.asin(Math.sin(phases[partialIndex]))
					: Math.sin(phases[partialIndex]);
			value += wave * weight * envelope(time, attack, partialDecay);
		});
		value *= gain;
		left[startIndex + index] += value * Math.cos(((pan + 1) * Math.PI) / 4);
		right[startIndex + index] += value * Math.sin(((pan + 1) * Math.PI) / 4);
	}
}

function addNoise(
	target,
	{ start = 0, duration, gain = 0.3, seed = 1, filters = [], envelopeAt, pan = 0, panEnd = pan },
) {
	const [left, right] = target;
	const next = random(seed);
	const startIndex = Math.floor(start * sampleRate);
	const length = Math.floor(duration * sampleRate);
	let brown = 0;
	for (let index = 0; index < length && startIndex + index < left.length; index++) {
		const time = index / sampleRate;
		let value = next() * 2 - 1;
		brown = brown * 0.6 + value * 0.4;
		value = brown;
		for (const filter of filters) {
			value = filter(value, time);
		}
		value *= gain * envelopeAt(time, time / duration);
		const panNow = pan + (panEnd - pan) * (time / duration);
		left[startIndex + index] += value * Math.cos(((panNow + 1) * Math.PI) / 4);
		right[startIndex + index] += value * Math.sin(((panNow + 1) * Math.PI) / 4);
	}
}

function reverb(target, { mix = 0.25, room = 0.82, damping = 0.35 }) {
	const combTunings = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
	const allpassTunings = [556, 441, 341, 225];
	return target.map((channel, channelIndex) => {
		const spread = channelIndex * 23;
		const combs = combTunings.map((tuning) => ({
			data: new Float32Array(tuning + spread),
			index: 0,
			store: 0,
		}));
		const allpasses = allpassTunings.map((tuning) => ({
			data: new Float32Array(tuning + spread),
			index: 0,
		}));
		const output = new Float32Array(channel.length);
		for (let index = 0; index < channel.length; index++) {
			const input = channel[index] * 0.015;
			let wet = 0;
			for (const comb of combs) {
				const delayed = comb.data[comb.index];
				comb.store = delayed * (1 - damping) + comb.store * damping;
				comb.data[comb.index] = input + comb.store * room;
				comb.index = (comb.index + 1) % comb.data.length;
				wet += delayed;
			}
			for (const allpass of allpasses) {
				const delayed = allpass.data[allpass.index];
				allpass.data[allpass.index] = wet + delayed * 0.5;
				allpass.index = (allpass.index + 1) % allpass.data.length;
				wet = delayed - wet;
			}
			output[index] = channel[index] * (1 - mix) + wet * mix * 3;
		}
		return output;
	});
}

function save(name, target, { peak = 0.89, reverbOptions } = {}) {
	let channels = reverbOptions ? reverb(target, reverbOptions) : target;
	let maximum = 0;
	for (const channel of channels) {
		for (const value of channel) {
			maximum = Math.max(maximum, Math.abs(value));
		}
	}
	const scale = maximum > 0 ? peak / maximum : 1;
	const frames = channels[0].length;
	const fade = Math.min(frames, Math.floor(0.01 * sampleRate));
	const data = Buffer.alloc(frames * 4);
	for (let index = 0; index < frames; index++) {
		const tail = index > frames - fade ? (frames - index) / fade : 1;
		for (let channel = 0; channel < 2; channel++) {
			const value = Math.max(-1, Math.min(1, channels[channel][index] * scale * tail));
			data.writeInt16LE(Math.round(value * 32767), index * 4 + channel * 2);
		}
	}
	const header = Buffer.alloc(44);
	header.write('RIFF', 0);
	header.writeUInt32LE(36 + data.length, 4);
	header.write('WAVEfmt ', 8);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(2, 22);
	header.writeUInt32LE(sampleRate, 24);
	header.writeUInt32LE(sampleRate * 4, 28);
	header.writeUInt16LE(4, 32);
	header.writeUInt16LE(16, 34);
	header.write('data', 36);
	header.writeUInt32LE(data.length, 40);
	writeFileSync(`${outputDirectory}/${name}.wav`, Buffer.concat([header, data]));
	console.log(name, (frames / sampleRate).toFixed(2) + 's');
}

const bell = [
	[1, 1],
	[2.76, 0.35, 0.25],
	[5.4, 0.18, 0.12],
	[8.93, 0.08, 0.06],
];
const marimba = [
	[1, 1],
	[3.93, 0.25, 0.05],
	[10.6, 0.08, 0.015],
];

// Pops: cut-out appears with a soft wooden "bloop".
[
	['pop1', 780, 1],
	['pop2', 920, 2],
	['pop3', 660, 3],
	['pop-low', 420, 4],
].forEach(([name, frequency, seed]) => {
	const target = buffer(0.3);
	addTone(target, {
		frequency,
		frequencyEnd: frequency * 0.42,
		duration: 0.12,
		attack: 0.001,
		decay: 0.045,
		gain: 0.8,
	});
	addTone(target, {
		frequency: frequency * 2.02,
		frequencyEnd: frequency * 0.9,
		duration: 0.05,
		attack: 0.001,
		decay: 0.012,
		gain: 0.25,
	});
	addNoise(target, {
		duration: 0.02,
		seed,
		gain: 0.5,
		filters: [biquad('highpass', 2500)],
		envelopeAt: (time) => envelope(time, 0.0005, 0.004),
	});
	save(name, target, { reverbOptions: { mix: 0.12 } });
});

// Paper swishes of various lengths.
[
	['swish-short', 0.28, 3],
	['swish', 0.5, 5],
	['swish-long', 0.9, 7],
].forEach(([name, duration, seed]) => {
	const target = buffer(duration + 0.3);
	addNoise(target, {
		duration,
		seed,
		gain: 0.9,
		pan: -0.4,
		panEnd: 0.4,
		filters: [
			sweepFilter(
				'bandpass',
				(time) => 900 + 2600 * Math.sin((Math.PI * time) / duration),
				0.8,
			),
			biquad('highpass', 300),
		],
		envelopeAt: (time, progress) => Math.sin(Math.PI * Math.min(1, progress * 1.15)) ** 1.6,
	});
	const next = random(seed * 11);
	for (let crackle = 0; crackle < duration * 40; crackle++) {
		const start = next() * duration * 0.9;
		addNoise(target, {
			start,
			duration: 0.012,
			seed: seed * 100 + crackle,
			gain: 0.25 * next(),
			filters: [biquad('bandpass', 2500 + next() * 4000, 2)],
			envelopeAt: (time) => envelope(time, 0.0005, 0.003),
			pan: next() - 0.5,
		});
	}
	save(name, target, { reverbOptions: { mix: 0.1 } });
});

// Crinkly paper handling for folds and page settles.
{
	const target = buffer(0.8);
	const next = random(42);
	for (let crackle = 0; crackle < 70; crackle++) {
		const start = Math.pow(next(), 1.4) * 0.55;
		addNoise(target, {
			start,
			duration: 0.02 + next() * 0.03,
			seed: 500 + crackle,
			gain: 0.4 * next() + 0.1,
			filters: [biquad('bandpass', 1800 + next() * 5000, 1.5)],
			envelopeAt: (time) => envelope(time, 0.001, 0.008),
			pan: (next() - 0.5) * 0.8,
		});
	}
	save('crinkle', target, { reverbOptions: { mix: 0.1 } });
}

// Scissor snip: shear hiss plus metallic ring and click.
[1, 2, 3].forEach((seed) => {
	const target = buffer(0.35);
	addNoise(target, {
		duration: 0.09,
		seed,
		gain: 0.55,
		filters: [sweepFilter('bandpass', (time) => 3000 + time * 30000, 2)],
		envelopeAt: (time, progress) => progress ** 1.5,
	});
	addNoise(target, {
		start: 0.09,
		duration: 0.01,
		seed: seed + 10,
		gain: 0.9,
		filters: [biquad('highpass', 3000)],
		envelopeAt: (time) => envelope(time, 0.0003, 0.002),
	});
	addTone(target, {
		start: 0.09,
		frequency: 3150 + seed * 90,
		duration: 0.2,
		decay: 0.03,
		gain: 0.12,
	});
	addTone(target, {
		start: 0.09,
		frequency: 5230 - seed * 70,
		duration: 0.2,
		decay: 0.02,
		gain: 0.08,
	});
	save(`snip${seed}`, target, { reverbOptions: { mix: 0.12 } });
});

// Rubber stamp thud.
[1, 2, 3].forEach((seed) => {
	const target = buffer(0.5);
	addTone(target, {
		frequency: 150 - seed * 8,
		frequencyEnd: 55,
		duration: 0.25,
		attack: 0.001,
		decay: 0.07,
		gain: 1,
	});
	addNoise(target, {
		duration: 0.06,
		seed,
		gain: 0.7,
		filters: [biquad('lowpass', 1200)],
		envelopeAt: (time) => envelope(time, 0.001, 0.015),
	});
	addNoise(target, {
		start: 0.005,
		duration: 0.09,
		seed: seed + 7,
		gain: 0.25,
		filters: [biquad('bandpass', 420, 1.2)],
		envelopeAt: (time) => envelope(time, 0.004, 0.03),
	});
	save(`stamp${seed}`, target, { reverbOptions: { mix: 0.15, room: 0.7 } });
});

// Paper-plane whoosh across the stereo field.
{
	const target = buffer(1.4);
	addNoise(target, {
		duration: 1.1,
		seed: 77,
		gain: 1,
		pan: -0.9,
		panEnd: 0.9,
		filters: [
			sweepFilter(
				'bandpass',
				(time) => 500 + 2200 * Math.sin((Math.PI * time) / 1.1) ** 2,
				1.4,
			),
		],
		envelopeAt: (time, progress) => Math.sin(Math.PI * progress) ** 2,
	});
	save('whoosh', target, { reverbOptions: { mix: 0.18 } });
}

// Sparkle and magic riser.
function sparkle(target, start, count, seed, gain = 0.3) {
	const next = random(seed);
	const notes = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349.3, 2637, 3136];
	for (let index = 0; index < count; index++) {
		addTone(target, {
			start: start + index * 0.045 + next() * 0.02,
			frequency: notes[Math.floor(next() * notes.length)],
			duration: 0.6,
			decay: 0.18,
			gain: gain * (0.6 + next() * 0.4),
			pan: next() * 1.6 - 0.8,
			partials: bell,
		});
	}
}
{
	const target = buffer(1.4);
	sparkle(target, 0, 7, 9);
	save('sparkle', target, { reverbOptions: { mix: 0.35 } });
}
{
	const target = buffer(1.2);
	sparkle(target, 0, 4, 19, 0.25);
	save('twinkle', target, { reverbOptions: { mix: 0.4 } });
}
{
	const target = buffer(2.4);
	const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093, 2637];
	notes.forEach((frequency, index) =>
		addTone(target, {
			start: index * 0.13,
			frequency,
			duration: 0.9,
			decay: 0.3,
			gain: 0.22 + index * 0.02,
			pan: -0.6 + index * 0.17,
			partials: bell,
		}),
	);
	addNoise(target, {
		duration: 1.15,
		seed: 3,
		gain: 0.35,
		filters: [sweepFilter('bandpass', (time) => 1500 + time * 7000, 1.2)],
		envelopeAt: (time, progress) => progress ** 2,
	});
	sparkle(target, 1.05, 8, 31, 0.28);
	save('riser', target, { reverbOptions: { mix: 0.35 } });
}

// Pencil scribble.
[1, 2].forEach((seed) => {
	const target = buffer(0.8);
	const next = random(seed * 5);
	let strokePhase = 0;
	addNoise(target, {
		duration: 0.6,
		seed,
		gain: 0.5,
		filters: [biquad('highpass', 1800), biquad('lowpass', 7000)],
		envelopeAt: (time, progress) => {
			strokePhase += (2 * Math.PI * (14 + 5 * Math.sin(time * 9))) / sampleRate;
			return (
				(0.35 + 0.65 * Math.abs(Math.sin(strokePhase))) *
				Math.sin(Math.PI * progress) ** 0.5 *
				(0.8 + 0.2 * next())
			);
		},
	});
	save(`scribble${seed}`, target);
});

// Toppling pile: thuds and ceramic clinks.
{
	const target = buffer(1.6);
	const next = random(123);
	for (let index = 0; index < 9; index++) {
		const start = 0.08 * index + next() * 0.06;
		addTone(target, {
			start,
			frequency: 240 - index * 12,
			frequencyEnd: 70,
			duration: 0.2,
			decay: 0.05,
			gain: 0.7,
			pan: next() - 0.5,
		});
		addNoise(target, {
			start,
			duration: 0.05,
			seed: 900 + index,
			gain: 0.35,
			filters: [biquad('lowpass', 1500)],
			envelopeAt: (time) => envelope(time, 0.001, 0.012),
			pan: next() - 0.5,
		});
		if (index % 3 === 1) {
			addTone(target, {
				start: start + 0.01,
				frequency: 2100 + next() * 600,
				duration: 0.4,
				decay: 0.08,
				gain: 0.2,
				pan: next() - 0.5,
				partials: [
					[1, 1],
					[1.59, 0.6, 0.05],
					[2.35, 0.4, 0.03],
				],
			});
		}
	}
	save('clatter', target, { reverbOptions: { mix: 0.2 } });
}

// Cartoon boing for wobble.
{
	const target = buffer(0.7);
	const [left, right] = target;
	let phase = 0;
	for (let index = 0; index < 0.55 * sampleRate; index++) {
		const time = index / sampleRate;
		const frequency =
			180 +
			140 * Math.exp(-time * 4) +
			25 * Math.sin(2 * Math.PI * 11 * time) * Math.exp(-time * 3);
		phase += (2 * Math.PI * frequency) / sampleRate;
		const value =
			Math.sin(phase + 0.6 * Math.sin(phase * 2)) * envelope(time, 0.003, 0.16) * 0.6;
		left[index] += value;
		right[index] += value;
	}
	save('boing', target, { reverbOptions: { mix: 0.12 } });
}

// Phone notification: soft two-note marimba.
[1, 2, 3].forEach((seed) => {
	const target = buffer(0.9);
	const base = [1318.5, 1174.7, 1568][seed - 1];
	addTone(target, { frequency: base, duration: 0.5, decay: 0.12, gain: 0.5, partials: marimba });
	addTone(target, {
		start: 0.11,
		frequency: base * 1.335,
		duration: 0.6,
		decay: 0.16,
		gain: 0.5,
		partials: marimba,
	});
	save(`ding${seed}`, target, { reverbOptions: { mix: 0.2 } });
});

// Party popper.
{
	const target = buffer(1.6);
	addNoise(target, {
		duration: 0.05,
		seed: 8,
		gain: 1,
		filters: [biquad('highpass', 600)],
		envelopeAt: (time) => envelope(time, 0.0005, 0.01),
	});
	addTone(target, { frequency: 320, frequencyEnd: 90, duration: 0.15, decay: 0.04, gain: 0.8 });
	const next = random(55);
	for (let index = 0; index < 40; index++) {
		addNoise(target, {
			start: 0.05 + next() * 0.9,
			duration: 0.015,
			seed: 1000 + index,
			gain: 0.15 * next(),
			filters: [biquad('bandpass', 3000 + next() * 4000, 2)],
			envelopeAt: (time) => envelope(time, 0.0005, 0.004),
			pan: next() * 1.6 - 0.8,
		});
	}
	sparkle(target, 0.08, 10, 77, 0.22);
	save('popper', target, { reverbOptions: { mix: 0.25 } });
}

// Tape strip being pressed down.
{
	const target = buffer(0.4);
	addNoise(target, {
		duration: 0.22,
		seed: 13,
		gain: 0.6,
		filters: [sweepFilter('bandpass', (time) => 5000 - time * 12000, 1.5)],
		envelopeAt: (time, progress) => Math.sin(Math.PI * progress),
	});
	save('tape', target);
}

// Final button: glockenspiel chord with long bell tail.
{
	const target = buffer(4);
	[1046.5, 1318.5, 1568, 2093].forEach((frequency, index) =>
		addTone(target, {
			start: index * 0.012,
			frequency,
			duration: 3.5,
			decay: 1.1,
			gain: 0.3,
			pan: -0.3 + index * 0.2,
			partials: bell,
		}),
	);
	[261.63, 392].forEach((frequency) =>
		addTone(target, { frequency, duration: 2.5, decay: 0.6, gain: 0.35, partials: marimba }),
	);
	save('button', target, { reverbOptions: { mix: 0.3, room: 0.88 } });
}

// Tiny "hmm" wobble: a slide whistle down for the duplicate reveal.
{
	const target = buffer(0.9);
	addTone(target, {
		frequency: 1250,
		frequencyEnd: 420,
		duration: 0.7,
		attack: 0.03,
		decay: 0.5,
		gain: 0.35,
		shape: 'triangle',
	});
	save('slide-down', target, { reverbOptions: { mix: 0.2 } });
}
{
	const target = buffer(0.7);
	addTone(target, {
		frequency: 500,
		frequencyEnd: 1400,
		duration: 0.45,
		attack: 0.03,
		decay: 0.4,
		gain: 0.35,
		shape: 'triangle',
	});
	save('slide-up', target, { reverbOptions: { mix: 0.2 } });
}

// UI tap: a small wooden click.
{
	const target = buffer(0.25);
	addTone(target, {
		frequency: 1850,
		frequencyEnd: 900,
		duration: 0.05,
		decay: 0.012,
		gain: 0.6,
		partials: marimba,
	});
	addNoise(target, {
		duration: 0.012,
		seed: 21,
		gain: 0.6,
		filters: [biquad('bandpass', 3800, 1.5)],
		envelopeAt: (time) => envelope(time, 0.0003, 0.003),
	});
	save('click', target, { reverbOptions: { mix: 0.1 } });
}

// Check mark: two quick pencil strokes and a bright marimba note.
[
	['tick1', 1318.5, 31],
	['tick2', 1568, 32],
	['tick3', 1760, 33],
].forEach(([name, frequency, seed]) => {
	const target = buffer(0.6);
	addNoise(target, {
		duration: 0.05,
		seed,
		gain: 0.35,
		filters: [biquad('highpass', 2200), biquad('lowpass', 7000)],
		envelopeAt: (time, progress) => Math.sin(Math.PI * progress),
	});
	addNoise(target, {
		start: 0.06,
		duration: 0.09,
		seed: seed + 50,
		gain: 0.4,
		filters: [biquad('highpass', 1800), biquad('lowpass', 7500)],
		envelopeAt: (time, progress) => Math.sin(Math.PI * progress),
	});
	addTone(target, {
		start: 0.08,
		frequency,
		duration: 0.45,
		decay: 0.14,
		gain: 0.45,
		partials: marimba,
	});
	save(name, target, { reverbOptions: { mix: 0.2 } });
});

// Heart like: a bubbly rising pop and a sprinkle of bells.
{
	const target = buffer(1.1);
	addTone(target, {
		frequency: 420,
		frequencyEnd: 1250,
		duration: 0.14,
		attack: 0.002,
		decay: 0.07,
		gain: 0.7,
	});
	addTone(target, {
		start: 0.1,
		frequency: 1568,
		duration: 0.5,
		decay: 0.16,
		gain: 0.3,
		partials: bell,
	});
	sparkle(target, 0.12, 4, 61, 0.18);
	save('heart', target, { reverbOptions: { mix: 0.25 } });
}

// Notification chime: three rising marimba notes.
{
	const target = buffer(1.2);
	[1046.5, 1318.5, 1568].forEach((frequency, index) =>
		addTone(target, {
			start: index * 0.09,
			frequency,
			duration: 0.7,
			decay: 0.18,
			gain: 0.45,
			pan: -0.2 + index * 0.2,
			partials: marimba,
		}),
	);
	save('chime', target, { reverbOptions: { mix: 0.25 } });
}

// Card sliding into a kraft pocket: a short slide and a soft paper thud.
{
	const target = buffer(0.6);
	addNoise(target, {
		duration: 0.22,
		seed: 71,
		gain: 0.55,
		filters: [sweepFilter('bandpass', (time) => 3200 - time * 8000, 1.2)],
		envelopeAt: (time, progress) => Math.sin(Math.PI * progress) ** 1.5,
	});
	addTone(target, {
		start: 0.2,
		frequency: 130,
		frequencyEnd: 70,
		duration: 0.18,
		decay: 0.05,
		gain: 0.6,
	});
	addNoise(target, {
		start: 0.2,
		duration: 0.04,
		seed: 72,
		gain: 0.35,
		filters: [biquad('lowpass', 900)],
		envelopeAt: (time) => envelope(time, 0.001, 0.012),
	});
	save('pocket', target, { reverbOptions: { mix: 0.12 } });
}

// Paint brush sweep: bristly filtered noise that flutters.
{
	const target = buffer(0.9);
	let flutterPhase = 0;
	addNoise(target, {
		duration: 0.62,
		seed: 81,
		gain: 0.6,
		pan: -0.5,
		panEnd: 0.5,
		filters: [
			sweepFilter('bandpass', (time) => 2200 + 2400 * Math.sin((Math.PI * time) / 0.62), 0.9),
		],
		envelopeAt: (time, progress) => {
			flutterPhase += (2 * Math.PI * 38) / sampleRate;
			return (
				Math.sin(Math.PI * progress) ** 0.8 * (0.7 + 0.3 * Math.abs(Math.sin(flutterPhase)))
			);
		},
	});
	save('brush', target, { reverbOptions: { mix: 0.12 } });
}

// Shooting star: an airy streak with a falling bell glissando.
{
	const target = buffer(2.2);
	addNoise(target, {
		duration: 0.9,
		seed: 91,
		gain: 0.35,
		pan: -0.8,
		panEnd: 0.8,
		filters: [sweepFilter('bandpass', (time) => 7000 - time * 4000, 2)],
		envelopeAt: (time, progress) => Math.sin(Math.PI * progress) ** 2,
	});
	[2637, 2349.3, 2093, 1760, 1568, 1318.5, 1046.5].forEach((frequency, index) =>
		addTone(target, {
			start: 0.08 + index * 0.08,
			frequency,
			duration: 1,
			decay: 0.35,
			gain: 0.2,
			pan: -0.7 + index * 0.23,
			partials: bell,
		}),
	);
	save('shooting-star', target, { reverbOptions: { mix: 0.4, room: 0.86 } });
}
