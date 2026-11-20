import { transcribe } from './gemini.mjs';
for (const audioPath of process.argv.slice(2)) {
	console.log('==', audioPath, '\n' + (await transcribe({ audioPath })));
}
