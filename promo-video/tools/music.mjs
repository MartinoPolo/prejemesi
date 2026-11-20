import { compose } from './gemini.mjs';

const [model = 'lyria-3.5', name = 'take1'] = process.argv.slice(2);
const prompt = `A 46-second instrumental music cue for a whimsical hand-made paper-collage animated commercial about a family wishlist app. Warm, playful, heartfelt, charming, like a cosy European indie animation. Instruments: ukulele, glockenspiel, celesta, pizzicato strings, upright piano, soft brushed drums, light hand claps, finger snaps, a little whistle melody. Key of C major, 104 BPM, clean professional mix, gentle and not too busy so a narrator can speak over it.
[0:00 - 0:09] Curious, slightly comedic tiptoeing intro: pizzicato strings and a playful bassoon, a little awkward and funny.
[0:09 - 0:11] A magical rising glockenspiel sparkle and short drum fill, a bright reveal moment.
[0:11 - 0:37] Main bouncy theme: ukulele strumming, glockenspiel and whistle melody, claps, happy and light, steady groove.
[0:37 - 0:43] Joyful celebratory peak, fuller strings, a warm and uplifting lift.
[0:43 - 0:46] A clean final button: one last sweet glockenspiel note and a soft ring-out ending.
Instrumental only, no vocals.`;

const result = await compose({ prompt, model, outputPath: `promo-video/audio/music/${name}.mp3` });
console.log(result.mime, result.texts.join('\n').slice(0, 2000));
