/** The `data:` payloads of a server-sent event stream, one per event. */
export async function* serverSentEventData(
	body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffered = '';
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			buffered += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n');
			let boundary = buffered.indexOf('\n\n');
			while (boundary !== -1) {
				const data = eventData(buffered.slice(0, boundary));
				buffered = buffered.slice(boundary + 2);
				if (data !== null) {
					yield data;
				}
				boundary = buffered.indexOf('\n\n');
			}
		}
		const trailing = eventData(buffered);
		if (trailing !== null) {
			yield trailing;
		}
	} finally {
		reader.releaseLock();
	}
}

function eventData(rawEvent: string): string | null {
	const dataLines = rawEvent
		.split('\n')
		.filter((line) => line.startsWith('data:'))
		.map((line) => line.slice('data:'.length).trimStart());
	return dataLines.length === 0 ? null : dataLines.join('\n');
}
