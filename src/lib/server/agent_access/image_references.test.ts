import { describe, expect, it } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { splitImageReference } from './image_references.js';

function galleryWithMargin(margin: number) {
	return {
		imageReferences: [
			{ imageReference: 'image-1', imageMeta: { fitMode: 'contain-padded', margin } },
		],
	};
}

describe('imageReferences entry framing', () => {
	it('keeps a Fit margin within the allowed range', () => {
		expect(splitImageReference(galleryWithMargin(0.05))).toMatchObject({
			kind: 'gallery',
			gallery: [{ imageReference: 'image-1', imageMeta: { margin: 0.05 } }],
		});
	});

	it('rejects a Fit margin above a fifth of the frame', () => {
		let thrown: unknown;
		try {
			splitImageReference(galleryWithMargin(0.5));
		} catch (caught) {
			thrown = caught;
		}
		expect(isHttpError(thrown, 400)).toBe(true);
		expect(thrown).toMatchObject({
			body: { message: SERVER_ERROR.AGENT_IMAGE_REFERENCES_INVALID },
		});
	});
});
