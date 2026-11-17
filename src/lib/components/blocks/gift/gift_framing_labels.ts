import * as m from '$lib/paraglide/messages.js';
import type { GiftEditorCropTarget, GiftFraming } from '$lib/modules/images/index.js';

/** A view's framing status: Vyplnit, Celý or Vlastní. */
export const giftFramingLabels = {
	fill: () => m.image_fit_fill(),
	whole: () => m.image_crop_whole(),
	custom: () => m.gift_image_framing_custom(),
} as const satisfies Record<GiftFraming, () => string>;

/** The gift editor's two framed views by the surfaces visitors know: Karta and Seznam. */
export const giftFramingTargetLabels = {
	square: () => m.gift_view_card(),
	thumb: () => m.gift_view_list(),
} as const satisfies Record<GiftEditorCropTarget, () => string>;

/** „Karta: vlastní · Seznam: celý“, the statuses lowercase inside the sentence. */
export function giftFramingStatusLine(framings: Record<GiftEditorCropTarget, GiftFraming>): string {
	return m.gift_image_framing_status({
		card: giftFramingLabels[framings.square]().toLocaleLowerCase(),
		list: giftFramingLabels[framings.thumb]().toLocaleLowerCase(),
	});
}
