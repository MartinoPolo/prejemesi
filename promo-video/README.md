# Přejeme si – promo films

Procedurally drawn cut-paper animations: pure JavaScript on a canvas, with narration, music and
foley. Each film lives in `films/<name>/` (`cs` Czech, `en` English); its `cues.json` is the single
timing source for both the animation marks and the mix.

## Commands

Run all commands from this directory. Every tool takes `--film <name>` and defaults to `cs`.

| Step                                                                | Command                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| Preview at http://localhost:4610/films/en/                          | `node tools/serve.mjs 4610`                                   |
| Stills for QA (`?t=` or `?gallery=`)                                | `node tools/frames.mjs <outDir> 12.5 gallery:0 --film en`     |
| Mix the soundtrack to `audio/mix/<film>.{wav,mp3}` at −14 LUFS      | `node tools/mix.mjs --film en`                                |
| Render `dist/prejemesi-promo-<film>.mp4` (needs the server running) | `node tools/render.mjs --film en [output.mp4] [--height 720]` |
| Build the single-file `dist/prejemesi-promo-<film>.html`            | `node tools/build.mjs --film en`                              |
| AI critique of audio or video (needs `GEMINI_API_KEY`)              | `node tools/listen.mjs <file> <prompt…>`                      |

## Asset generation

The one-off asset tools need `GEMINI_API_KEY`:

- `narration.mjs <film> [voice] [take] [script]`: Gemini TTS from `films/<film>/<script>.json`
  (default `narration`), voice Sulafat; run it from the repository root.
- `music.mjs` and `lyria-realtime.mjs`: Lyria music.
- `sfx.mjs`: synthesised effects.
- `beats.mjs`: beat grid.
- `transcribe.mjs`: VO word timings.

## Layout

- `src/engine.js`: the paper, pencil and sticker primitives.
- `src/art.js`: props; `src/puppets.js`: characters; `src/stage.js`: shared scenery and motion.
- `src/main.js`: loading, playback and the prop gallery.
- `films/<name>/scenes.js`: that film's scenes, registered with `P.stage.film`.
- `films/<name>/index.html`: the film's page, inlined into one file by `build.mjs`.
