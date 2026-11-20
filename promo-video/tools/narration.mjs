import { readFileSync } from 'node:fs';
import { speak, transcribe } from './gemini.mjs';

/* Usage (from the repository root): node promo-video/tools/narration.mjs <film> [voice] [take] [script] */
const [film = 'cs', voiceOverride, take = '1', scriptName = 'narration'] = process.argv.slice(2);
const script = JSON.parse(readFileSync(`promo-video/films/${film}/${scriptName}.json`, 'utf8'));
const voice = voiceOverride ?? script.voice;
const outputPath = `promo-video/audio/vo/${film}-${scriptName}-${voice}-${take}.wav`;
await speak({ text: script.lines.join(' <long pause> '), style: script.style, voice, outputPath });
console.log(outputPath);
console.log(await transcribe({ audioPath: outputPath, language: script.language }));
