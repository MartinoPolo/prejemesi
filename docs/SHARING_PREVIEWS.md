# Sharing previews and share links

Owner checklist for link previews (Open Graph/Twitter tags) and the share wizard's methods. Tag generation lives in `src/lib/modules/sharing/social_meta.ts`, share intents in `src/lib/modules/sharing/types.ts`.

## How previews are built

- `/`, `/en` and `/w/<id>` emit `og:site_name`, `og:locale`, `og:type`, `og:url`, `og:title`, `og:description`, `og:image` (with dimensions when known), `og:image:alt` and the matching `twitter:*` tags. Wishlists stay `noindex`; crawlers still read their tags.
- A wishlist uses its `social` image slot (1200×630 crop); without an image it uses the branded fallback `src/lib/assets/social-preview.png`.
- The fallback is generated: run `pnpm social-preview:generate` after a brand, palette, font or landing-copy change and commit the PNG. It is bundled with a content-hashed file name, so every regeneration gets a new URL that link-preview caches have never seen.

## Refresh a stale preview

Facebook, Messenger and others cache a page's preview, including the image, for weeks. After a deploy that changes tags or the fallback image:

1. Open the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), enter `https://prejemesi.cz/` and click **Debug**, then **Scrape Again**. Repeat for `https://prejemesi.cz/en` and each wishlist link already shared (`https://prejemesi.cz/w/<id>`). Messenger uses the same cache.
2. Check the debugger shows no warnings, the new image, the title and the description.
3. Messages already sent keep their old preview; only links shared after the re-scrape get the new one.
4. Optionally check [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) and [opengraph.xyz](https://www.opengraph.xyz/). Telegram caches per link: send the URL to [@WebpageBot](https://t.me/WebpageBot) to refresh it. WhatsApp has no refresh tool; a changed page URL or time clears it.

## Check share links

On a phone and a desktop, share a test wishlist through the wizard and confirm each method:

| Method | Expected |
| --- | --- |
| Copy | Link copied; pasted into Messenger/WhatsApp it unfurls with the current preview |
| WhatsApp | `wa.me` opens WhatsApp with the message and link prefilled |
| E-mail | The mail app opens with subject and body (message and link) prefilled |
| Telegram | `t.me/share` opens Telegram with the link and message |
| SMS | Phones open Messages with the body prefilled; desktops may have no SMS app |
| More options | Shown only where the browser has a share sheet (most phones): it opens with the title, message and link; pick Messenger and check the prefill; dismissing it shows no error |

Messenger has no button of its own: its only web intent, Facebook's Send dialog, needs a registered Facebook app id, and `fb-messenger://share` works only inside the mobile app. Phones reach it through More options; elsewhere sharing to Messenger is copy and paste.
