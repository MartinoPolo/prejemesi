import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
	throw new Error('GEMINI_API_KEY missing');
}
const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

async function postJson(url, body, timeoutMilliseconds = 300_000) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await postJsonOnce(url, body, timeoutMilliseconds);
		} catch (error) {
			const retryable = /HTTP (429|500|502|503|504)|timeout|fetch failed/i.test(
				error.message,
			);
			if (!retryable || attempt >= (Number(process.env.MAX_ATTEMPTS) || 6)) {
				throw error;
			}
			const delay = 5000 * attempt;
			console.error(`retry ${attempt} in ${delay}ms: ${error.message.slice(0, 120)}`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
}

async function postJsonOnce(url, body, timeoutMilliseconds) {
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMilliseconds),
	});
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${text.slice(0, 1500)}`);
	}
	return JSON.parse(text);
}

function collectAudio(json) {
	const found = [];
	const visit = (node) => {
		if (!node || typeof node !== 'object') {
			return;
		}
		if (typeof node.data === 'string' && node.data.length > 1000) {
			found.push(node);
		}
		for (const value of Object.values(node)) {
			visit(value);
		}
	};
	visit(json);
	return found;
}

export async function speak({
	text,
	style,
	voice = 'Kore',
	model = 'gemini-3.8-flash-tts',
	outputPath,
}) {
	const content = { type: 'text', text };
	if (style) {
		content.annotations = [{ type: 'speech_metadata', style }];
	}
	const json = await postJson(`${baseUrl}/interactions`, {
		model,
		input: [{ type: 'user_input', content: [content] }],
		response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 48000 },
		generation_config: { speech_config: [{ voice }] },
	});
	const [audio] = collectAudio(json);
	if (!audio) {
		throw new Error('No audio in response: ' + JSON.stringify(json).slice(0, 800));
	}
	await writeFile(outputPath, Buffer.from(audio.data, 'base64'));
	return audio.mime_type ?? audio.mimeType;
}

export async function compose({ prompt, model = 'lyria-3.5', outputPath }) {
	const json = await postJson(
		`${baseUrl}/interactions`,
		{ model, input: prompt, response_format: { type: 'audio' } },
		600_000,
	);
	const audios = collectAudio(json);
	if (!audios.length) {
		throw new Error('No audio: ' + JSON.stringify(json).slice(0, 800));
	}
	await writeFile(outputPath, Buffer.from(audios[0].data, 'base64'));
	const texts = [];
	JSON.stringify(json, (key, value) => {
		if (key === 'text' && typeof value === 'string') {
			texts.push(value);
		}
		return value;
	});
	return { mime: audios[0].mime_type ?? audios[0].mimeType, texts };
}

export async function paint({
	prompt,
	referencePaths = [],
	aspectRatio = '1:1',
	imageSize = '2K',
	model = 'gemini-3-pro-image',
	outputPath,
}) {
	const parts = [{ text: prompt }];
	for (const referencePath of referencePaths) {
		const extension = path.extname(referencePath).slice(1).replace('jpg', 'jpeg');
		parts.push({
			inlineData: {
				mimeType: `image/${extension}`,
				data: (await readFile(referencePath)).toString('base64'),
			},
		});
	}
	const json = await postJson(`${baseUrl}/models/${model}:generateContent`, {
		contents: [{ role: 'user', parts }],
		generationConfig: {
			responseModalities: ['IMAGE'],
			imageConfig: { aspectRatio, imageSize },
		},
	});
	const imagePart = json.candidates?.[0]?.content?.parts?.find((part) => part.inlineData);
	if (!imagePart) {
		throw new Error('No image: ' + JSON.stringify(json).slice(0, 800));
	}
	await writeFile(outputPath, Buffer.from(imagePart.inlineData.data, 'base64'));
	return imagePart.inlineData.mimeType;
}

export async function transcribe({
	audioPath,
	language = 'Czech',
	model = process.env.LISTEN_MODEL ?? 'gemini-3.7-flash',
}) {
	const data = (await readFile(audioPath)).toString('base64');
	const mimeType = audioPath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
	const json = await postJson(`${baseUrl}/models/${model}:generateContent`, {
		contents: [
			{
				role: 'user',
				parts: [
					{
						text: `Transcribe this ${language} audio verbatim. Then, on a new line starting "NOTES:", critique pronunciation errors, unnatural prosody, accent, glitches or artifacts, as a strict ${language} voice director. Any Czech brand name should sound natively Czech.`,
					},
					{ inlineData: { mimeType, data } },
				],
			},
		],
	});
	return (
		json.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') ??
		JSON.stringify(json)
	);
}
