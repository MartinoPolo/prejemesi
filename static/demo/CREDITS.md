# Landing-demo photo credits

Photos used by the landing page's interactive demo section (issue #218). Every file is
covered by the standard free license of its platform — **free for commercial use, no
attribution required**. This file exists as provenance, not as a legal obligation.

Files were re-downloaded from each platform's CDN and optimized for their rendered size;
the originals are not kept in the repository.

| File               | Subject                | Source photo page                                                                                       | Photographer                     | License         |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------- |
| `v1/teapot.jpg`       | Ceramic teapot         | https://www.pexels.com/photo/minimalist-white-ceramic-teapot-on-counter-31940584/                        | Rodrigo Ortega                   | Pexels License  |
| `v1/headphones.jpg`   | Wireless headphones    | https://www.pexels.com/photo/white-wireless-headphones-3394650/                                          | Sound On                         | Pexels License  |
| `v1/plant-book.jpg`   | Book with plant sprig  | https://unsplash.com/photos/closed-white-book-beside-green-leaf-plant-jmm8F_V9tiA                        | Olia Gozha                       | Unsplash License |
| `v1/candle.jpg`       | Scented pillar candles | https://www.pexels.com/photo/white-decorative-candles-with-manufacturer-labels-19949965/                 | Nicat Guseynov                   | Pexels License  |
| `v1/backpack.jpg`     | Leather backpack       | https://unsplash.com/photos/brown-leather-backpack-on-white-surface-3o-X8WJOP5E                          | Wiser by the Mile                | Unsplash License |
| `v1/watercolours.jpg` | Watercolour paint set  | https://unsplash.com/photos/multicolored-pastel-paints-lot-BpFAG6JSugE                                   | Maureen Sgro                     | Unsplash License |
| `v1/cover-1.webp`      | Birthday banner set    | https://www.pexels.com/photo/happy-birthday-banner-and-balloons-7599526/                                 | Thirdman                         | Pexels License  |
| `v1/pane-recipient.webp` | Smiling young woman    | https://www.pexels.com/photo/photo-of-woman-smiling-3785843/                                             | Andrea Piacquadio                | Pexels License  |
| `v1/pane-gifter.webp`  | Friends handing over gifts | https://www.pexels.com/photo/friends-giving-gifts-to-an-expecting-mother-7802480/                    | Kampus Production                | Pexels License  |

The two `pane-*.webp` photos are the demo pane headers. Both are stored **pre-cropped to a
square 344 × 344** — `v1/pane-recipient.webp` centred on the face, `v1/pane-gifter.webp` on the gift
being handed over — so the panes need no `object-position` tuning.

`v1/backpack.jpg` was requested with imgix white padding (`fit=fill&fill-color=FFFFFF`) so the
tall studio shot fits the 4:3 gift card without cropping the bag; the studio background is
white, so the padding is invisible.
