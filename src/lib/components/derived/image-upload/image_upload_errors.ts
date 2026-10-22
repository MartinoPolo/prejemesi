import {
	IMAGE_PREPARATION_FAILURES,
	ImagePreparationError,
} from '$lib/modules/uploads/prepare_image.js';
import * as m from '$lib/paraglide/messages.js';

const BYTES_PER_MEGABYTE = 1024 * 1024;

/** The localized message shown when an image cannot be prepared or uploaded. */
export function imageUploadErrorMessage(thrown: unknown, maxBytes: number): string {
	if (!(thrown instanceof ImagePreparationError)) {
		return m.image_upload_error_failed();
	}
	switch (thrown.reason) {
		case IMAGE_PREPARATION_FAILURES.unsupportedType:
			return m.image_upload_error_unsupported_type();
		case IMAGE_PREPARATION_FAILURES.unreadable:
			return m.image_upload_error_unreadable();
		case IMAGE_PREPARATION_FAILURES.tooLarge:
			return m.image_upload_error_too_large({
				maxMegabytes: String(Math.round(maxBytes / BYTES_PER_MEGABYTE)),
			});
	}
}
