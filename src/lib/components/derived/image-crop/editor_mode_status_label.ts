import * as m from '$lib/paraglide/messages.js';
import { IMAGE_EDITOR_MODES, type ImageEditorMode } from '$lib/modules/images/index.js';

/** Status chip text of a preview tile whose target uses the given editor mode. */
export function editorModeStatusLabel(mode: ImageEditorMode): string {
	if (mode === IMAGE_EDITOR_MODES.manual) {
		return m.image_crop_status_manual();
	}
	return mode === IMAGE_EDITOR_MODES.fit ? m.image_fit_fit() : m.image_fit_fill();
}
