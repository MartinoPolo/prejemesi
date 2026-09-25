import { readFileSync } from 'node:fs';

/*
 * Asks Gemini for phrase timestamps of a narration take, to place VO atoms in cues.json.
 * Usage: node tools/timings.mjs <audio.wav> [model]
 */
const [audioPath, model = 'gemini-3.5-transcribe'] = process.argv.slice(2);
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
					parts: [
						{
							text: 'Transcribe this narration with precise timestamps. Return only JSON lines, one per word: {"start": seconds, "end": seconds, "word": "..."}. Use seconds with two decimals, measured from the start of the file.',
						},
						{
							inlineData: {
								mimeType: 'audio/wav',
								data: readFileSync(audioPath).toString('base64'),
							},
						},
					],
				},
			],
		}),
		signal: AbortSignal.timeout(240_000),
	},
);
const json = await response.json();
console.log(
	json.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') ??
		JSON.stringify(json).slice(0, 1500),
);
