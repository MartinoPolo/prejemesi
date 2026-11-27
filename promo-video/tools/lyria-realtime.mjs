import { readFile, writeFile } from 'node:fs/promises';

const apiKey = process.env.GEMINI_API_KEY;
const [name = 'rt1', secondsArgument = '60'] = process.argv.slice(2);
const totalSeconds = Number(secondsArgument);
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic?key=${apiKey}`;

const presetPath = process.argv[4];
const preset = JSON.parse(await readFile(presetPath, 'utf8'));
const sections = preset.sections;

const chunks = [];
let receivedSamples = 0;
const sampleRate = 48000;
const channels = 2;

const socket = new WebSocket(url);
const done = new Promise((resolve, reject) => {
	const timer = setTimeout(() => reject(new Error('timeout')), (totalSeconds + 120) * 1000);
	socket.addEventListener('error', (event) =>
		reject(new Error('socket error ' + (event.message ?? ''))),
	);
	socket.addEventListener('close', (event) => {
		clearTimeout(timer);
		console.log('closed', event.code, event.reason);
		resolve();
	});
});

let sectionIndex = 0;
const send = (message) => socket.send(JSON.stringify(message));

socket.addEventListener('open', () => {
	send({ setup: { model: 'models/lyria-realtime-exp' } });
});

socket.addEventListener('message', async (event) => {
	const text =
		typeof event.data === 'string'
			? event.data
			: Buffer.from(await event.data.arrayBuffer()).toString();
	const message = JSON.parse(text);
	if (message.setupComplete) {
		console.log('setup complete');
		send({ clientContent: { weightedPrompts: sections[0].prompts } });
		send({
			musicGenerationConfig: preset.config,
		});
		send({ playbackControl: 'PLAY' });
		return;
	}
	if (message.filteredPrompt) {
		console.log('filtered', JSON.stringify(message.filteredPrompt));
	}
	for (const chunk of message.serverContent?.audioChunks ?? []) {
		const buffer = Buffer.from(chunk.data, 'base64');
		chunks.push(buffer);
		receivedSamples += buffer.length / 2 / channels;
		const seconds = receivedSamples / sampleRate;
		const next = sections[sectionIndex + 1];
		if (next && seconds >= next.at) {
			sectionIndex++;
			console.log('section', sectionIndex, seconds.toFixed(1));
			send({ clientContent: { weightedPrompts: next.prompts } });
		}
		if (seconds >= totalSeconds) {
			send({ playbackControl: 'STOP' });
			socket.close();
		}
	}
	if (!message.serverContent && !message.setupComplete && !message.filteredPrompt) {
		console.log(text.slice(0, 300));
	}
});

await done;
const pcm = Buffer.concat(chunks);
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(channels, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * channels * 2, 28);
header.writeUInt16LE(channels * 2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);
await writeFile(`promo-video/audio/music/${name}.wav`, Buffer.concat([header, pcm]));
console.log('seconds', (receivedSamples / sampleRate).toFixed(1));
process.exit(0);
