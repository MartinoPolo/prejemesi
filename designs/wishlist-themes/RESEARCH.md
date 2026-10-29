# Wishlist themes — research (#535)

## Reference video

“The one thing vibe coding CAN'T fix about your website”, Kole Jain, 2026-08-19, 8:58
(<https://www.youtube.com/watch?v=RCneB_MQ7qs>).

### What could be extracted

- **Transcript: not extractable.** Attempts on 2026-10-22:
  - `yt-dlp --write-auto-subs` (default client): `ERROR: Unable to download video subtitles for 'en': HTTP Error 429: Too Many Requests`.
  - `yt-dlp` with `player_client=web_safari,tv`: `ERROR: [youtube] RCneB_MQ7qs: The page needs to be reloaded.`
  - `yt-dlp` with `player_client=ios,mweb`: HTTP 429 again; a delayed `mweb` retry reported `There are missing subtitles languages because a PO token was not provided. Automatic captions for 21 languages are missing.`
  - `r.jina.ai` proxy of the watch page: metadata only; the transcript panel was empty (`NaN / NaN`) behind YouTube's “Sign in to confirm you're not a bot” (HTTP 401).
  - `youtubetotranscript.com`: HTTP 403.
  - `kolejain.com/resources?scrollTo=vibe-coding-cant-fix`: only five downloadable “Brand Board” images, no text.
- **Description and chapters (verbatim).** “Here's exactly how to take a website that feels 'fine' to unforgettable. We break down why a clean, functional site can still feel soulless, then rebuild it including the visual identity and animations.” Chapters: The problem with this site · Visual Identity · Frankensteining a site · Sectioning · Animation.

### Ideas the chapters point to and how they apply here

These are inferred from the description, the chapter titles and the brand-board resources. They are not a transcript summary.

| Video idea | Meaning | Application to Přejeme si |
| --- | --- | --- |
| A clean site can still feel soulless | Being functional is the minimum. Personality comes from a deliberate identity. | Palettes alone recolor the same blank page. A theme should give each wishlist a recognizable occasion identity, and the empty desktop side gutters are the obvious place for it. |
| Visual identity / brand board | A small board defines colors, type, imagery and shape language that all work together. | A **theme is a brand board for one wishlist**: palette + background + illustration set + a few shape tokens (corners, borders, image mat, heading font) chosen as a coherent preset. |
| “Frankensteining” | Combine pieces from several references into one identity, without copying any of them whole. | Users start from a curated preset and override individual tokens. Presets keep each combination coherent, and the overrides make the list feel owned. |
| Sectioning | Give sections a distinct rhythm and backgrounds so the page reads as designed chapters. | Category groups get a themed heading plate. The notebook header, toolbar and gift grid stay structurally identical, and only the surfaces around them change. |
| Animation | Subtle, purposeful motion makes a page feel alive. | Decorations drift at different depths while the page scrolls (parallax). The motion is gated by reduced motion and is never required to understand the content. |

## Wishlist and registry personalization patterns

These come from product knowledge and a web search. Current Zola background controls could not be confirmed from an official page.

- **Wedding/registry sites (Zola, The Knot, Joy):** many templates, then color, font and photo overrides on top of a chosen template. The template sets the mood, and users mostly change the hero photo and the accent color. Large template counts compete on volume and dilute quality. A small curated set fits this product better.
- **Notion/Trello covers and board backgrounds:** a curated gallery plus “upload your own”, a focal point for the image, and the image confined to a non-content region (cover strip or board backdrop). Content cards stay opaque, so text contrast never depends on the image.
- **Amazon/Target baby and kids registries:** occasion illustration packs (balloons, stars, toys), little customization and a strong occasion signal. Parents of young children respond to playful illustration more than to typography choices.
- **Social profile themes (Discord/Steam profiles, Bluesky banners):** a backdrop image plus one accent color and an optional effect. Most users apply one gesture (pick a background) and stop there, so the defaults must be good.
- **Parallax/scroll motion practice:** CSS scroll-driven animations (`animation-timeline: scroll()`) run on the compositor without scroll listeners. Animate only `transform`/`translate`/`opacity`, cap the drift distance, honor `prefers-reduced-motion`, and keep image layers at a sensible resolution for mobile.

## Takeaways for #535

1. Theme = coherent preset (palette + background + decorative art + wishlist-scoped tokens). Users pick one, then may override a few tokens.
2. Decorations live **outside** content surfaces: desktop side gutters, plus a slim top strip on mobile. Content surfaces stay opaque, so the existing AA palette guarantees still hold.
3. Expose shape tokens such as corners, border weight, image mat and heading font. Keep text colors, body font, control geometry and shadow depth (a viewer preference) brand-locked.
4. Use one scroll-driven motion, compositor-only and reduced-motion-gated.
