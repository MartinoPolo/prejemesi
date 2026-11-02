/**
 * Prints the Manual `imageMeta` that frames a product inside a stored gift image:
 * per gift crop target, a window centered on the product's bounding box with the
 * given gap clear on each side of the frame's tighter axis (geometry and box
 * validation in `framedGiftImageMeta`, `src/lib/modules/images/crop.ts`). Used by
 * the add-gifts skill.
 *
 * Usage:
 *   pnpm exec tsx scripts/frame_gift_image.ts --width 800 --height 1141
 *   pnpm exec tsx scripts/frame_gift_image.ts --width 1500 --height 1000 --box 0.4,0.35,0.2,0.3
 *   pnpm exec tsx scripts/frame_gift_image.ts --width 1500 --height 1000 --box-px 600,350,300,300 --bg null
 */

import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { FULL_CROP_RECT, framedGiftImageMeta } from '../src/lib/modules/images/crop.js';
import {
	GIFT_FRAMING_DEFAULT_GAP_PER_SIDE,
	IMAGE_ZOOM_OUT_GAP_PER_SIDE,
	type ImageCropRect,
} from '../src/lib/modules/images/types.js';

const USAGE = `Usage: tsx scripts/frame_gift_image.ts --width <px> --height <px> [--box x,y,w,h | --box-px left,top,width,height] [--gap ${GIFT_FRAMING_DEFAULT_GAP_PER_SIDE}] [--bg "#rrggbb"|null]

  --width, --height  Stored image size in pixels (uploadImage returns them).
  --box              Product bounding box, normalized 0..1 (default: the whole image).
  --box-px           Product bounding box in source pixels.
  --gap              Share of the frame kept clear on each side of its tighter axis, 0..${IMAGE_ZOOM_OUT_GAP_PER_SIDE} (default ${GIFT_FRAMING_DEFAULT_GAP_PER_SIDE}).
  --bg               Mat colour behind the image: a "#rrggbb" hex matching the photo's background (default "#ffffff"), or null for the transparent mat.`;

const DEFAULT_BACKGROUND_COLOR = '#ffffff';
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

class UsageError extends Error {}

interface CommandOutput {
	log: (message: string) => void;
	error: (message: string) => void;
}

/** `Number('')` is 0, so blank input must not pass as a number. */
function parsedNumber(raw: string): number {
	return raw.trim() === '' ? Number.NaN : Number(raw);
}

function positiveNumber(name: string, raw: string | undefined): number {
	const value = raw === undefined ? Number.NaN : parsedNumber(raw);
	if (!Number.isFinite(value) || value <= 0) {
		throw new UsageError(`--${name} must be a positive number.`);
	}
	return value;
}

function gapPerSide(raw: string | undefined): number {
	if (raw === undefined) {
		return GIFT_FRAMING_DEFAULT_GAP_PER_SIDE;
	}
	const gap = parsedNumber(raw);
	if (!Number.isFinite(gap) || gap < 0 || gap > IMAGE_ZOOM_OUT_GAP_PER_SIDE) {
		throw new UsageError(`--gap must be a number from 0 to ${IMAGE_ZOOM_OUT_GAP_PER_SIDE}.`);
	}
	return gap;
}

function parseBoxValues(name: string, raw: string): [number, number, number, number] {
	const values = raw.split(',').map(parsedNumber);
	if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
		throw new UsageError(`--${name} must be four comma-separated numbers.`);
	}
	return [values[0], values[1], values[2], values[3]];
}

function productBox(
	values: { box?: string; 'box-px'?: string },
	width: number,
	height: number,
): ImageCropRect {
	if (values.box !== undefined && values['box-px'] !== undefined) {
		throw new UsageError('Use either --box or --box-px, not both.');
	}
	if (values.box !== undefined) {
		const [x, y, w, h] = parseBoxValues('box', values.box);
		return { x, y, w, h };
	}
	if (values['box-px'] !== undefined) {
		const [left, top, boxWidth, boxHeight] = parseBoxValues('box-px', values['box-px']);
		return { x: left / width, y: top / height, w: boxWidth / width, h: boxHeight / height };
	}
	return FULL_CROP_RECT;
}

function parseBackgroundColor(raw: string | undefined): string | null {
	if (raw === undefined) {
		return DEFAULT_BACKGROUND_COLOR;
	}
	const normalized = raw.trim().toLowerCase();
	if (normalized === 'null') {
		return null;
	}
	if (!HEX_COLOR_PATTERN.test(normalized)) {
		throw new UsageError('--bg must be a "#rrggbb" hex colour or null.');
	}
	return normalized;
}

/** The framed `imageMeta` as JSON, or null when only the usage was requested. */
function framedImageMetaJson(args: string[]): string | null {
	let parsed;
	try {
		parsed = parseArgs({
			args,
			options: {
				width: { type: 'string' },
				height: { type: 'string' },
				box: { type: 'string' },
				'box-px': { type: 'string' },
				gap: { type: 'string' },
				bg: { type: 'string' },
				help: { type: 'boolean' },
			},
			strict: true,
			allowPositionals: false,
		});
	} catch (error) {
		throw new UsageError(error instanceof Error ? error.message : String(error));
	}
	const { values } = parsed;
	if (values.help) {
		return null;
	}
	const width = positiveNumber('width', values.width);
	const height = positiveNumber('height', values.height);
	const framing = {
		width,
		height,
		box: productBox(values, width, height),
		gapPerSide: gapPerSide(values.gap),
		bgColor: parseBackgroundColor(values.bg),
	};
	try {
		return JSON.stringify(framedGiftImageMeta(framing), null, 2);
	} catch (error) {
		if (error instanceof RangeError) {
			throw new UsageError(error.message);
		}
		throw error;
	}
}

/** Runs the command and returns its exit code: 0 on success, 1 on invalid usage. */
export function main(args = process.argv.slice(2), output: CommandOutput = console): number {
	try {
		output.log(framedImageMetaJson(args) ?? USAGE);
		return 0;
	} catch (error) {
		if (error instanceof UsageError) {
			output.error(`Error: ${error.message}\n\n${USAGE}`);
			return 1;
		}
		throw error;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = main();
}
