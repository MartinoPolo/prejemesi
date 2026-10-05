# Playground catalog provenance

`src/lib/server/demo/catalog.ts` is curated starting content for the temporary playground, not
product inventory or live prices. The Czech and English copy is selected when the visitor creates or
resets the playground; interface language changes do not translate existing gifts. CZK estimates are
illustrative. Outbound Heureka URLs search for the gift category or type, **not an exact pictured
SKU**; merchants and prices may change. Automated HEAD requests to Heureka returned 403, so
individual shopping-result availability is unverified.

Images under `static/demo/playground/` are locally hosted, resized copies of photos from the
existing development seed image manifest (`src/lib/server/db/seed_images.ts`), covered by the
[Unsplash License](https://unsplash.com/license). Photos were visually reviewed as a contact sheet
against the gift text; they represent categories, not exact merchant products. The source URLs below
are the manifest originals (downloads used `w=480` instead of `w=800`). Existing landing images
reused via `/demo/v1/` have their individual photographer, page and license credits in
[`static/demo/CREDITS.md`](../static/demo/CREDITS.md). These shared files are immutable; no
seed-cache, database or upload path is required to render the playground.

| Local file (`static/demo/playground/`) | Source                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `advent.jpg`                           | https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=800&q=80 |
| `batoh.jpg`                            | https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800&q=80 |
| `bunda.jpg`                            | https://images.unsplash.com/photo-1487793433179-ce0b55eda342?w=800&q=80 |
| `caj.jpg`                              | https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80    |
| `catan.jpg`                            | https://images.unsplash.com/photo-1606733847546-db8546099013?w=800&q=80 |
| `hodinky-d.jpg`                        | https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&q=80 |
| `kabelka.jpg`                          | https://images.unsplash.com/photo-1683921470299-b8f0f3331657?w=800&q=80 |
| `kavovar.jpg`                          | https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&q=80 |
| `kindle.jpg`                           | https://images.unsplash.com/photo-1455541504462-57ebb2a9cec1?w=800&q=80 |
| `kolo.jpg`                             | https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=800&q=80 |
| `kytara.jpg`                           | https://images.unsplash.com/photo-1589131626349-2799f057b43a?w=800&q=80 |
| `kytice.jpg`                           | https://images.unsplash.com/photo-1487070183336-b863922373d4?w=800&q=80 |
| `lampicka.jpg`                         | https://images.unsplash.com/photo-1547091267-6b2be403a763?w=800&q=80    |
| `lego.jpg`                             | https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&q=80 |
| `mixer.jpg`                            | https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80 |
| `monitor.jpg`                          | https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80 |
| `monstera.jpg`                         | https://images.unsplash.com/photo-1503149779833-1de50ebe5f8a?w=800&q=80 |
| `parfem.jpg`                           | https://images.unsplash.com/photo-1583545889266-55be2d76c6c5?w=800&q=80 |
| `ponozky.jpg`                          | https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=800&q=80 |
| `poukaz.jpg`                           | https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80 |
| `ps5.jpg`                              | https://images.unsplash.com/photo-1622297845775-5ff3fef71d13?w=800&q=80 |
| `sachy.jpg`                            | https://images.unsplash.com/photo-1528819622765-d6bcf132f793?w=800&q=80 |
| `sapiens.jpg`                          | https://images.unsplash.com/photo-1710578472398-1edbbd348b79?w=800&q=80 |
| `satek.jpg`                            | https://images.unsplash.com/photo-1753807971479-5a51e1445b78?w=800&q=80 |
| `sklenice.jpg`                         | https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80 |
| `stan.jpg`                             | https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80 |
