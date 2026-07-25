// Layout-invariant suite (issue #210): measures real computed geometry, so the compiled
// Tailwind utilities must be present (mirrors gift_detail_form.svelte.test.ts).
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: ReserveModal } = await import('./ReserveModal.svelte');

// Single unbroken 90-char token (issue #210 REQ-2 fixture): no space, so the browser has
// no break opportunity and the un-fixed layout let it force the dialog wider.
const HOSTILE_NAME = 'x'.repeat(90);

function makeGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: HOSTILE_NAME,
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: null,
		priceMax: null,
		currency: null,
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

describe('ReserveModal contains an unbreakable gift name (issue #210)', () => {
	it('does not let the gift name push Dialog.Content past its own max-width', async () => {
		// isAuthenticated=true skips the anonymous form (and TurnstileWidget), which is
		// irrelevant to this layout invariant.
		await render(ReserveModal, {
			open: true,
			gift: makeGift({ name: HOSTILE_NAME }),
			redirectHref: '/w/abc',
			isAuthenticated: true,
		});

		const contentEl = document.querySelector('[data-slot="dialog-content"]') as HTMLElement;
		const nameEl = document.querySelector('p') as HTMLElement;

		expect(contentEl).toBeTruthy();
		expect(nameEl).toBeTruthy();
		expect(nameEl.textContent).toBe(HOSTILE_NAME);

		const contentRect = contentEl.getBoundingClientRect();
		const nameRect = nameEl.getBoundingClientRect();

		// The name element must stay within the dialog's own box – before the `min-w-0`
		// fix on `body`, the unbreakable name's min-content width dragged it (and
		// visibly, unclipped, past the dialog's edge since Dialog.Content has no
		// `overflow-hidden`) well past `contentRect.right`.
		expect(nameRect.right).toBeLessThanOrEqual(contentRect.right + 0.5);
	});

	it('clamps the gift name to two lines instead of a nowrap ellipsis truncation', async () => {
		await render(ReserveModal, {
			open: true,
			gift: makeGift({ name: HOSTILE_NAME }),
			redirectHref: '/w/abc',
			isAuthenticated: true,
		});

		const nameEl = document.querySelector('p') as HTMLElement;
		const nameStyle = getComputedStyle(nameEl);

		// Before the fix `giftName` was `truncate` (nowrap + ellipsis, single line).
		expect(nameStyle.whiteSpace).not.toBe('nowrap');
		expect(nameStyle.getPropertyValue('-webkit-line-clamp')).toBe('2');
	});
});
