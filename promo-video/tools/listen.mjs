import { readFile } from 'node:fs/promises';

const [audioPath, ...promptWords] = process.argv.slice(2);
const prompt = promptWords.join(' ');
const models = (
	process.env.LISTEN_MODELS ??
	'gemini-3.7-flash,gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash'
).split(',');
const mimeType = audioPath.endsWith('.mp4')
	? 'video/mp4'
	: audioPath.endsWith('.mp3')
		? 'audio/mpeg'
		: 'audio/wav';
const data = (await readFile(audioPath)).toString('base64');

for (let round = 0; round < 6; round++) {
	for (const model of models) {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
			{
				method: 'POST',
				headers: {
					'x-goog-api-key': process.env.GEMINI_API_KEY,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					contents: [
						{
							role: 'user',
							parts: [{ text: prompt }, { inlineData: { mimeType, data } }],
						},
					],
				}),
				signal: AbortSignal.timeout(240_000),
			},
		).catch((error) => ({ ok: false, status: error.message, text: async () => '' }));
		if (response.ok) {
			const json = await response.json();
			console.log(
				`[${model}]`,
				json.candidates?.[0]?.content?.parts?.map((part) => part.text).join(''),
			);
			process.exit(0);
		}
		console.error(model, response.status);
	}
	await new Promise((resolve) => setTimeout(resolve, 15000));
}
process.exit(1);
