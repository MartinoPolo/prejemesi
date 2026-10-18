import { stderr, stdin } from 'node:process';

const CONTROL = { enter: '\r', newline: '\n', interrupt: '\u0003', backspace: '\u007f' } as const;

export async function readStandardInput(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
	}
	return Buffer.concat(chunks).toString('utf8');
}

/** A line typed without echo, so the secret never shows on screen or in a terminal recording. */
function readHiddenLine(prompt: string): Promise<string> {
	stderr.write(prompt);
	stdin.setRawMode(true);
	stdin.setEncoding('utf8');
	stdin.resume();
	let typed = '';
	return new Promise<string>((resolve, reject) => {
		const finish = (settle: () => void) => {
			stdin.off('data', onData);
			stdin.setRawMode(false);
			stdin.pause();
			stderr.write('\n');
			settle();
		};
		const onData = (data: string) => {
			for (const character of data) {
				if (character === CONTROL.enter || character === CONTROL.newline) {
					finish(() => resolve(typed));
					return;
				}
				if (character === CONTROL.interrupt) {
					finish(() => reject(new Error('Login cancelled')));
					return;
				}
				typed = character === CONTROL.backspace ? typed.slice(0, -1) : typed + character;
			}
		};
		stdin.on('data', onData);
	});
}

/** Hidden terminal input, or the first line of standard input when it is piped. */
export async function readSecret(prompt: string): Promise<string> {
	if (stdin.isTTY) {
		return readHiddenLine(prompt);
	}
	const [firstLine = ''] = (await readStandardInput()).split(/\r?\n/);
	return firstLine;
}
