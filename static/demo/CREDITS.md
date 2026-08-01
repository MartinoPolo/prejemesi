# Landing-demo photo credits

Photos used by the landing page's interactive demo section (issue #218). Every file is
covered by the standard free license of its platform — **free for commercial use, no
attribution required**. This file exists as provenance, not as a legal obligation.

Files were re-downloaded from each platform's CDN at web sizes (long edge 800 px for the
gift photos, 1200 px for the cover); the originals are not kept in the repository.

| File               | Subject                | Source photo page                                                                                       | Photographer                     | License         |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------- |
| `teapot.jpg`       | Ceramic teapot         | https://www.pexels.com/photo/minimalist-white-ceramic-teapot-on-counter-31940584/                        | Rodrigo Ortega                   | Pexels License  |
| `headphones.jpg`   | Wireless headphones    | https://www.pexels.com/photo/white-wireless-headphones-3394650/                                          | Sound On                         | Pexels License  |
| `plant-book.jpg`   | Book with plant sprig  | https://unsplash.com/photos/closed-white-book-beside-green-leaf-plant-jmm8F_V9tiA                        | Olia Gozha                       | Unsplash License |
| `candle.jpg`       | Scented pillar candles | https://www.pexels.com/photo/white-decorative-candles-with-manufacturer-labels-19949965/                 | Nicat Guseynov                   | Pexels License  |
| `backpack.jpg`     | Leather backpack       | https://unsplash.com/photos/brown-leather-backpack-on-white-surface-3o-X8WJOP5E                          | Wiser by the Mile                | Unsplash License |
| `watercolours.jpg` | Watercolour paint set  | https://unsplash.com/photos/multicolored-pastel-paints-lot-BpFAG6JSugE                                   | Maureen Sgro                     | Unsplash License |
| `cover-1.jpg`      | Birthday banner set    | https://www.pexels.com/photo/happy-birthday-banner-and-balloons-7599526/                                 | Thirdman                         | Pexels License  |
| `pane-recipient.jpg` | Woman holding a gift box | https://unsplash.com/photos/young-woman-holding-a-gift-box-NWWFuis73ho                                | Vitaly Gariev                    | Unsplash License |
| `pane-gifter.jpg`  | Friends handing over gifts | https://www.pexels.com/photo/friends-giving-gifts-to-an-expecting-mother-7802480/                    | Kampus Production                | Pexels License  |

The two `pane-*.jpg` photos are the demo pane headers; both were downloaded at 800 px on the
long edge and are meant to be shown as a square `object-fit: cover` crop —
`pane-recipient.jpg` with `object-position: 66% 50%` (face) and `pane-gifter.jpg` with
`object-position: 75% 50%` (the gift being handed over).

`backpack.jpg` was requested with imgix white padding (`fit=fill&fill-color=FFFFFF`) so the
tall studio shot fits the 4:3 gift card without cropping the bag; the studio background is
white, so the padding is invisible.
