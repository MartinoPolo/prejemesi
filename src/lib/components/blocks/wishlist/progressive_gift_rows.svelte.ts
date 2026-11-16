import { tick, untrack } from 'svelte';
import { afterNextPaint } from '$lib/utils/after_next_paint.js';
import { GIFT_DISPLAY_ROW_KINDS, type GiftDisplayRow } from './gift_section_rows.js';

/** Script time one later batch may take; with its style and layout it stays near the 50 ms that blocks input. */
const BATCH_BUDGET_MS = 40;
const MAXIMUM_BATCH_GIFT_COUNT = 24;
/** Before any batch is timed, a card's cost is unknown; a slow device takes tens of ms for one. */
const FIRST_BATCH_GIFT_COUNT = 2;

/** The leading rows holding at most `giftLimit` gifts, with the headers that introduce them. */
export function leadingGiftRows(
	rows: readonly GiftDisplayRow[],
	giftLimit: number,
): readonly GiftDisplayRow[] {
	let gifts = 0;
	let end = 0;
	for (let index = 0; index < rows.length; index++) {
		if (rows[index]?.kind !== GIFT_DISPLAY_ROW_KINDS.gift) {
			continue;
		}
		if (++gifts > giftLimit) {
			// Headers and drop zones after the last mounted gift would introduce an empty section.
			return rows.slice(0, end);
		}
		end = index + 1;
	}
	return rows;
}

/** Gifts the next batch mounts so it takes about the batch budget at the measured cost per gift. */
function nextGiftBatchSize(millisecondsPerGift: number): number {
	if (!(millisecondsPerGift > 0)) {
		return FIRST_BATCH_GIFT_COUNT;
	}
	return Math.min(
		MAXIMUM_BATCH_GIFT_COUNT,
		Math.max(1, Math.floor(BATCH_BUDGET_MS / millisecondsPerGift)),
	);
}

interface ProgressiveGiftRowsOptions {
	getRows: () => readonly GiftDisplayRow[];
	/** Gifts mounted with the collection; read once, when it is created. */
	initialGiftLimit: number;
	/** Reorder and selection work on every gift, so they mount the rest at once. */
	needsEveryGift: () => boolean;
}

/**
 * Mounts the leading gifts with the collection and the rest in budgeted batches, one per frame,
 * so the first gifts and their images paint before every card has been created. Once every gift
 * is mounted, later sorting, filtering and grouping render the whole collection.
 */
export function createProgressiveGiftRows(options: ProgressiveGiftRowsOptions) {
	let giftLimit = $state(options.initialGiftLimit);
	const giftCount = $derived(
		options.getRows().filter((row) => row.kind === GIFT_DISPLAY_ROW_KINDS.gift).length,
	);
	const complete = $derived(giftLimit >= giftCount || options.needsEveryGift());

	$effect(() => {
		if (complete) {
			giftLimit = Number.POSITIVE_INFINITY;
			return;
		}
		let active = true;
		let cancelBatch = () => {};
		let millisecondsPerGift = 0;
		const mountBatch = async () => {
			const batchSize = nextGiftBatchSize(millisecondsPerGift);
			const started = performance.now();
			giftLimit = untrack(() => giftLimit) + batchSize;
			await tick();
			if (!active) {
				return;
			}
			millisecondsPerGift = (performance.now() - started) / batchSize;
			cancelBatch = afterNextPaint(() => void mountBatch());
		};
		cancelBatch = afterNextPaint(() => void mountBatch());
		return () => {
			active = false;
			cancelBatch();
		};
	});

	return {
		get rows() {
			const rows = options.getRows();
			return complete ? rows : leadingGiftRows(rows, giftLimit);
		},
		get complete() {
			return complete;
		},
	};
}
