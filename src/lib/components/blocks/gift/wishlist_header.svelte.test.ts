import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import WishlistHeader from './WishlistHeader.svelte';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

const baseProps = {
	title: 'Velmi dlouhý název narozeninového seznamu přání pro naši Aničku',
	recipientDisplayName: 'Anička',
	recipientImage: null,
	isForSomeoneElse: true,
	managerNames: ['Martin'],
	description: 'Popis seznamu, který na mobilu nemá zvětšovat hero.',
	imageKey: null,
	imageSrc: null,
	imageSlots: null,
	themeEmoji: '🎁',
	eventDate: null,
	status: 'active' as const,
	role: 'moderator' as const,
	giftCount: 13,
	recipientIsModerator: false,
	onshare: vi.fn(),
	onmoderators: vi.fn(),
	onarchive: vi.fn(),
	oneditimage: vi.fn(),
	oneditrecipient: vi.fn(),
	onsettings: vi.fn(),
};

afterEach(async () => {
	await page.viewport(1280, 720);
});

function expectRectanglesSeparated(first: DOMRect, second: DOMRect): void {
	const greatestAxisSeparation = Math.max(
		second.left - first.right,
		first.left - second.right,
		second.top - first.bottom,
		first.top - second.bottom,
	);
	expectPixelsAtLeast(greatestAxisSeparation, 0);
}

function computedRotation(element: HTMLElement) {
	const transform = getComputedStyle(element).transform;
	if (transform === 'none') {
		return 0;
	}
	const matrix = new DOMMatrixReadOnly(transform);
	return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
}

describe('WishlistHeader responsive presentation', () => {
	it('renders a compact mobile hero with an equally inset thumbnail and one management trigger', async () => {
		await page.viewport(390, 720);
		// Visačka decorates only the end edge, so the thumbnail keeps equal start and top insets.
		const screen = await render(WishlistHeader, { ...baseProps, heroFrame: 'tag' as const });
		const hero = screen.getByTestId('wishlist-mobile-hero');
		const photo = screen.getByTestId('wishlist-mobile-photo');
		const heroBox = await hero.element().getBoundingClientRect();
		const photoBox = await photo.element().getBoundingClientRect();

		expectPixelsAtLeast(heroBox.height, 104);
		expectPixelsAtMost(heroBox.height, 120);
		expectPixelsAtLeast(photoBox.width, 84);
		expectPixelsAtMost(photoBox.width, 96);
		expectPixelsNear(photoBox.width, photoBox.height);
		expectPixelsNear(photoBox.left - heroBox.left, photoBox.top - heroBox.top);
		await expect.element(screen.getByTestId('wishlist-banner')).not.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.gift_more_actions() }))
			.toHaveStyle({ width: '40px', height: '40px' });
		await screen.unmount();
	});

	it('grows every mobile hero frame around a two-line title and a wrapping meta line', async () => {
		await page.viewport(390, 720);
		const insetsByFrame = new Map<string, { top: number; bottom: number }>();
		// The page gutter narrows the copy column to what a phone shows.
		const pageHost = document.createElement('div');
		pageHost.style.paddingInline = 'var(--page-gutter)';
		document.body.appendChild(pageHost);
		try {
			for (const heroFrame of HERO_FRAMES) {
				const screen = await render(
					WishlistHeader,
					{
						...baseProps,
						heroFrame,
						occasion: 'birthday' as const,
						eventDate: new Date('2020-01-01T12:00:00Z'),
						giftCount: 3,
					},
					{ baseElement: pageHost },
				);
				const hero = screen.getByTestId('wishlist-mobile-hero').element() as HTMLElement;
				const meta = screen.getByTestId('wishlist-mobile-meta').element();
				const title = screen
					.getByRole('heading', { level: 1, name: baseProps.title })
					.element();
				const contentBoxes = [
					screen.getByTestId('wishlist-mobile-photo').element(),
					screen.getByTestId('wishlist-mobile-recipient').element(),
					title,
					meta,
					hero.querySelector('[data-testid="wishlist-header-actions"]')!,
				].map((element) => element.getBoundingClientRect());
				expect(title.getBoundingClientRect().height).toBeGreaterThan(
					parseFloat(getComputedStyle(title).lineHeight) * 1.5,
				);
				expect(meta.getBoundingClientRect().height).toBeGreaterThan(
					parseFloat(getComputedStyle(meta).lineHeight) * 1.5,
				);

				const heroBox = hero.getBoundingClientRect();
				// The Dárek band belongs to the frame, so its paper starts below the band.
				const topBand = hero.querySelector('.gift-band');
				const paperTop =
					topBand?.getBoundingClientRect().bottom ?? heroBox.top + hero.clientTop;
				const paperBottom = heroBox.top + hero.clientTop + hero.clientHeight;
				const contentTop = Math.min(...contentBoxes.map((box) => box.top));
				const contentBottom = Math.max(...contentBoxes.map((box) => box.bottom));
				insetsByFrame.set(heroFrame, {
					top: contentTop - paperTop,
					bottom: paperBottom - contentBottom,
				});
				await screen.unmount();
			}
		} finally {
			pageHost.remove();
		}

		const plainPaperInset = insetsByFrame.get('notebook')!.top;
		expectPixelsAtLeast(plainPaperInset, 4);
		for (const [heroFrame, insets] of insetsByFrame) {
			expectPixelsNear(insets.bottom, plainPaperInset, `${heroFrame} bottom inset`, 1);
			// The Pozvánka flap only adds room above the content.
			if (heroFrame === 'invitation') {
				expectPixelsAtLeast(insets.top, insets.bottom, `${heroFrame} top inset`, 1);
			} else {
				expectPixelsNear(insets.top, insets.bottom, `${heroFrame} top inset`, 1);
			}
		}
	});

	it('opens hero More with the shared inset Wishlist bottom-sheet geometry', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistHeader, baseProps);
		await screen.getByRole('button', { name: m.gift_more_actions() }).click();
		const dialog = screen.getByRole('dialog', { name: m.gift_more_actions() }).element();
		const rect = dialog.getBoundingClientRect();
		const style = getComputedStyle(dialog);

		expect(dialog).toHaveAttribute('data-side', 'bottom');
		expectPixelsNear(rect.left, 8);
		expectPixelsNear(rect.right, 382);
		expect(style.bottom).toBe('0px');
		expect(parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
		expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
		expect(parseFloat(style.borderLeftWidth)).toBeGreaterThan(0);
		expect(parseFloat(style.borderRightWidth)).toBeGreaterThan(0);
		await screen.unmount();
	});

	it('keeps lifecycle and privacy notices outside the compact hero', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistHeader, {
			...baseProps,
			status: 'archived' as const,
			role: 'moderator' as const,
		});
		const hero = screen.getByTestId('wishlist-mobile-hero');
		const archivedNotice = screen.getByText(m.wishlist_archived_banner());
		const privacyNotice = screen.getByText(
			m.wishlist_moderator_sees_reservations({ name: baseProps.recipientDisplayName }),
		);
		expect(hero.element().contains(archivedNotice.element())).toBe(false);
		expect(hero.element().contains(privacyNotice.element())).toBe(false);
		await screen.unmount();
	});

	it.each([390, 1280])(
		'centers the archive action with its depth clearance at %ipx',
		async (width) => {
			await page.viewport(width, 720);
			const screen = await render(WishlistHeader, {
				...baseProps,
				eventDate: new Date('2020-01-01T12:00:00Z'),
			});
			const action = screen
				.getByRole('button', { name: m.wishlist_archive_button() })
				.element();
			const alert = action.closest<HTMLElement>('[data-slot="alert"]')!;
			const shadowOffset = parseFloat(
				getComputedStyle(action).getPropertyValue('--elevation-ordinary-offset'),
			);
			try {
				for (const [depth, depthClearance] of [
					['soft', 0],
					['ink', shadowOffset],
					['black', shadowOffset],
				] as const) {
					document.documentElement.dataset.depth = depth;
					const buttonBox = action.getBoundingClientRect();
					const alertBox = alert.getBoundingClientRect();

					expectPixelsNear(
						(buttonBox.top + buttonBox.bottom + depthClearance) / 2,
						(alertBox.top + alertBox.bottom) / 2,
					);
				}
			} finally {
				delete document.documentElement.dataset.depth;
			}
			await screen.unmount();
		},
	);

	it('reserves desktop copy space for hero actions at the 640px breakpoint', async () => {
		await page.viewport(640, 720);
		const screen = await render(WishlistHeader, baseProps);
		const banner = screen.getByTestId('wishlist-banner').element();
		const actions = banner.querySelector(
			'.desktop-header-actions [data-testid="wishlist-header-actions"]',
		) as HTMLElement;
		const title = screen.getByRole('heading', { level: 1, name: baseProps.title }).element();
		const recipient = Array.from(banner.querySelectorAll('strong')).find(
			(element) => element.textContent === baseProps.recipientDisplayName,
		) as HTMLElement;
		const actionsBox = actions.getBoundingClientRect();
		for (const content of [title, recipient]) {
			const box = content.getBoundingClientRect();
			expectRectanglesSeparated(box, actionsBox);
		}
		await screen.unmount();
	});

	it('exposes desktop management workflows only through the hero More menu', async () => {
		await page.viewport(1280, 720);
		const screen = await render(WishlistHeader, baseProps);
		const banner = screen.getByTestId('wishlist-banner').element();
		const visibleButtons = Array.from(
			banner.querySelectorAll<HTMLButtonElement>('button'),
		).filter((button) => button.getClientRects().length > 0);

		expect(
			visibleButtons.filter(
				(button) => button.getAttribute('aria-label') === m.gift_more_actions(),
			),
		).toHaveLength(1);
		for (const label of [
			m.wishlist_share_label(),
			m.wishlist_moderators_label(),
			m.wishlist_archive_label(),
		]) {
			expect(
				visibleButtons.some((button) => button.getAttribute('aria-label') === label),
			).toBe(false);
		}
		await screen.unmount();
	});

	it('preserves the notebook presentation and fixture heading contract from sm upward', async () => {
		await page.viewport(640, 720);
		const fixtureImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';
		const screen = await render(WishlistHeader, {
			...baseProps,
			headingLevel: 2 as const,
			imageSrc: fixtureImage,
		});
		await expect.element(screen.getByTestId('wishlist-banner')).toBeVisible();
		await expect.element(screen.getByTestId('wishlist-mobile-hero')).not.toBeVisible();
		await expect
			.element(screen.getByRole('heading', { level: 2, name: baseProps.title }))
			.toBeVisible();
		expect(
			screen.getByTestId('wishlist-banner').element().querySelector('.polaroid'),
		).not.toBeNull();
		expect(
			screen
				.getByTestId('wishlist-banner')
				.element()
				.querySelector('img')
				?.getAttribute('src'),
		).toBe(fixtureImage);
		await screen.unmount();
	});

	it('keeps reassurance and trust notices horizontal, contained, and operable', async () => {
		const variants = [
			{
				recipientIsModerator: false,
				text: m.wishlist_moderator_sees_reservations({
					name: baseProps.recipientDisplayName,
				}),
			},
			{
				recipientIsModerator: true,
				text: m.wishlist_trust_warning({ name: baseProps.recipientDisplayName }),
			},
		];

		for (const width of [320, 390, 1280]) {
			for (const variant of variants) {
				await page.viewport(width, 720);
				const onarchive = vi.fn();
				const screen = await render(WishlistHeader, {
					...baseProps,
					eventDate: new Date('2000-01-01T00:00:00.000Z'),
					recipientIsModerator: variant.recipientIsModerator,
					onarchive,
				});
				const title = screen.getByText(variant.text);
				const notice = title.element().closest<HTMLElement>('[data-slot="alert"]')!;
				const assertHorizontal = () =>
					expect(Math.abs(computedRotation(notice))).toBeLessThan(0.001);

				await expect.element(title).toBeVisible();
				assertHorizontal();
				await title.hover();
				assertHorizontal();
				notice.tabIndex = 0;
				notice.focus();
				expect(document.activeElement).toBe(notice);
				assertHorizontal();

				const bounds = notice.getBoundingClientRect();
				expectPixelsAtLeast(bounds.left, 0);
				expectPixelsAtMost(bounds.right, width);
				expect(parseFloat(getComputedStyle(notice).borderTopWidth)).toBeGreaterThan(0);

				const archive = screen.getByRole('button', { name: m.wishlist_archive_button() });
				await expect.element(archive).toBeVisible();
				await archive.click();
				expect(onarchive).toHaveBeenCalledOnce();
				await screen.unmount();
			}
		}
	});
});

describe('WishlistHeader permanent wishlist', () => {
	it('shows visitors the permanent chip and a calm note that the list changes over time', async () => {
		await page.viewport(900, 720);
		const screen = await render(WishlistHeader, {
			...baseProps,
			kind: 'permanent' as const,
			role: 'visitor' as const,
		});

		const chip = screen.getByTestId('wishlist-occasion-chip');
		await expect.element(chip).toBeVisible();
		await expect.element(chip).toHaveTextContent(m.wishlist_kind_permanent());
		const note = screen.getByTestId('wishlist-permanent-note');
		await expect.element(note).toBeVisible();
		await expect.element(note).toHaveTextContent(m.wishlist_permanent_visitor_note());
		expect(computedRotation(note.element() as HTMLElement)).toBe(0);
		await screen.unmount();
	});

	it('shows managers the chip without the visitor note', async () => {
		await page.viewport(900, 720);
		const screen = await render(WishlistHeader, { ...baseProps, kind: 'permanent' as const });

		await expect.element(screen.getByTestId('wishlist-occasion-chip')).toBeVisible();
		await expect.element(screen.getByTestId('wishlist-permanent-note')).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('marks neither chip nor note on an occasion wishlist', async () => {
		const screen = await render(WishlistHeader, { ...baseProps, role: 'visitor' as const });

		await expect.element(screen.getByTestId('wishlist-occasion-chip')).not.toBeInTheDocument();
		await expect.element(screen.getByTestId('wishlist-permanent-note')).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('names the permanent kind in the compact mobile meta line', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistHeader, { ...baseProps, kind: 'permanent' as const });

		await expect
			.element(screen.getByTestId('wishlist-mobile-hero'))
			.toHaveTextContent(m.wishlist_kind_permanent());
		expect(screen.getByTestId('wishlist-mobile-meta').element().textContent?.trim()).toBe(
			`${m.dashboard_status_shared()} · ${m.wishlist_kind_permanent()} · ${m.wishlist_gift_count_other({ count: 13 })}`,
		);
		// A narrow meta column may wrap between segments, never inside "13 přání".
		const giftCountSegment = screen
			.getByTestId('wishlist-mobile-meta')
			.getByText(m.wishlist_gift_count_other({ count: 13 }), { exact: true })
			.element();
		expect(getComputedStyle(giftCountSegment).whiteSpace).toBe('nowrap');
		await screen.unmount();
	});

	it('separates the compact mobile recipient prefix from the name', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistHeader, baseProps);

		expect(screen.getByTestId('wishlist-mobile-recipient').element().textContent?.trim()).toBe(
			`${m.wishlist_header_for_prefix()} ${baseProps.recipientDisplayName}`,
		);
		await screen.unmount();
	});

	it('separates status and gift count with a spaced dot on an occasion wishlist', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistHeader, baseProps);

		expect(screen.getByTestId('wishlist-mobile-meta').element().textContent?.trim()).toBe(
			`${m.dashboard_status_shared()} · ${m.wishlist_gift_count_other({ count: 13 })}`,
		);
		await screen.unmount();
	});
});

const HERO_FRAMES = ['notebook', 'gift', 'tag', 'invitation'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
	const date = new Date(Date.now() + days * DAY_MS);
	date.setHours(12, 0, 0, 0);
	return date;
}

/** Visible hero badges whose text mentions the given countdown. */
function visibleCountdownChips(banner: Element, countdownLabel: string): Element[] {
	return [...banner.querySelectorAll('[data-slot="badge"]')].filter(
		(badge) => badge.checkVisibility() && badge.textContent?.includes(countdownLabel),
	);
}

/** From 960 px: a stamp on Blok and Visačka, a kraft tag on Dárek, a wax seal on Pozvánka. */
const EMBLEM_TEST_IDS = {
	notebook: 'wishlist-hero-stamp',
	gift: 'wishlist-hero-tag',
	tag: 'wishlist-hero-stamp',
	invitation: 'wishlist-hero-seal',
} as const;

describe('WishlistHeader hero frames', () => {
	it.each(HERO_FRAMES)('renders the %s frame on desktop and mobile', async (heroFrame) => {
		const screen = await render(WishlistHeader, { ...baseProps, heroFrame });

		expect(screen.getByTestId('wishlist-banner').element()).toHaveAttribute(
			'data-hero-frame',
			heroFrame,
		);
		expect(screen.getByTestId('wishlist-mobile-hero').element()).toHaveAttribute(
			'data-hero-frame',
			heroFrame,
		);
		await screen.unmount();
	});

	it('keeps the taped polaroid only on the Blok frame', async () => {
		for (const heroFrame of HERO_FRAMES) {
			const screen = await render(WishlistHeader, { ...baseProps, heroFrame });
			const polaroid = screen
				.getByTestId('wishlist-banner')
				.element()
				.querySelector('.polaroid');
			expect(polaroid !== null).toBe(heroFrame === 'notebook');
			await screen.unmount();
		}
	});

	it.each(HERO_FRAMES)(
		'%s names the occasion and counts down in its emblem from 960 px',
		async (heroFrame) => {
			await page.viewport(1280, 720);
			const screen = await render(WishlistHeader, {
				...baseProps,
				heroFrame,
				occasion: 'birthday' as const,
				eventDate: daysFromNow(12),
			});
			const emblem = screen.getByTestId(EMBLEM_TEST_IDS[heroFrame]);

			await expect.element(emblem).toBeVisible();
			await expect.element(emblem).toHaveTextContent(m.wishlist_occasion_birthday());
			await expect.element(emblem).toHaveTextContent(m.countdown_days_many({ days: 12 }));
			await expect.element(screen.getByTestId('wishlist-occasion-chip')).not.toBeVisible();
			await screen.unmount();
		},
	);

	it.each(HERO_FRAMES)('%s shows the past-event state in its emblem', async (heroFrame) => {
		await page.viewport(1280, 720);
		const screen = await render(WishlistHeader, {
			...baseProps,
			heroFrame,
			occasion: 'wedding' as const,
			eventDate: daysFromNow(-3),
		});
		const emblem = screen.getByTestId(EMBLEM_TEST_IDS[heroFrame]);

		await expect.element(emblem).toHaveTextContent(m.wishlist_occasion_wedding());
		await expect.element(emblem).toHaveTextContent(m.wishlist_countdown_passed());
		await screen.unmount();
	});

	it('shows only the countdown for Jiná and no stamp without a date', async () => {
		await page.viewport(1280, 720);
		const dated = await render(WishlistHeader, { ...baseProps, eventDate: daysFromNow(12) });
		const stamp = dated.getByTestId('wishlist-hero-stamp');
		await expect.element(stamp).toHaveTextContent(m.countdown_days_many({ days: 12 }));
		await expect.element(stamp).not.toHaveTextContent(m.wishlist_occasion_other());
		await dated.unmount();

		const undated = await render(WishlistHeader, baseProps);
		await expect.element(undated.getByTestId('wishlist-hero-stamp')).not.toBeInTheDocument();
		await undated.unmount();
	});

	it('seals a Stálý seznam without a countdown', async () => {
		await page.viewport(1280, 720);
		const screen = await render(WishlistHeader, {
			...baseProps,
			heroFrame: 'invitation' as const,
			kind: 'permanent' as const,
		});
		const seal = screen.getByTestId('wishlist-hero-seal');

		await expect.element(seal).toBeVisible();
		expect(seal.element().textContent?.trim()).toBe(m.wishlist_kind_permanent());
		await screen.unmount();
	});

	it.each(HERO_FRAMES)(
		'%s moves the occasion into the meta line below 960 px',
		async (heroFrame) => {
			await page.viewport(900, 720);
			const props = {
				...baseProps,
				heroFrame,
				occasion: 'birthday' as const,
				eventDate: daysFromNow(12),
			};
			const screen = await render(WishlistHeader, props);

			await expect.element(screen.getByTestId(EMBLEM_TEST_IDS[heroFrame])).not.toBeVisible();
			const occasionSegment = [
				m.wishlist_occasion_birthday(),
				m.countdown_days_many({ days: 12 }),
			].join(' · ');
			const chip = screen.getByTestId('wishlist-occasion-chip');
			await expect.element(chip).toBeVisible();
			expect(chip.element().textContent?.trim()).toBe(occasionSegment);
			expect(chip.element().querySelector('svg')).not.toBeNull();
			expect(
				visibleCountdownChips(
					screen.getByTestId('wishlist-banner').element(),
					m.countdown_days_many({ days: 12 }),
				),
			).toEqual([chip.element()]);
			await screen.unmount();

			await page.viewport(390, 720);
			const mobileScreen = await render(WishlistHeader, props);
			expect(
				mobileScreen.getByTestId('wishlist-mobile-meta').element().textContent?.trim(),
			).toBe(
				[
					m.dashboard_status_shared(),
					occasionSegment,
					m.wishlist_gift_count_other({ count: 13 }),
				].join(' · '),
			);
			await mobileScreen.unmount();
		},
	);

	it('pairs the occasion with „proběhlo" in the chip below 960 px once the event passed', async () => {
		await page.viewport(900, 720);
		const screen = await render(WishlistHeader, {
			...baseProps,
			occasion: 'wedding' as const,
			eventDate: daysFromNow(-3),
		});
		const chip = screen.getByTestId('wishlist-occasion-chip');

		await expect.element(chip).toBeVisible();
		expect(chip.element().textContent?.trim()).toBe(
			[m.wishlist_occasion_wedding(), m.wishlist_countdown_passed()].join(' · '),
		);
		expect(
			visibleCountdownChips(
				screen.getByTestId('wishlist-banner').element(),
				m.wishlist_countdown_passed(),
			),
		).toEqual([chip.element()]);
		// Screen readers skip the dot but still hear a word boundary.
		const accessibleChip = chip.element().cloneNode(true) as Element;
		accessibleChip
			.querySelectorAll('[aria-hidden="true"]')
			.forEach((hidden) => hidden.remove());
		expect(accessibleChip.textContent?.trim().replace(/\s+/g, ' ')).toBe(
			`${m.wishlist_occasion_wedding()} ${m.wishlist_countdown_passed()}`,
		);
		await screen.unmount();
	});

	it('names only the occasion in the chip below 960 px without an event date', async () => {
		await page.viewport(900, 720);
		const screen = await render(WishlistHeader, {
			...baseProps,
			occasion: 'birthday' as const,
		});
		const chip = screen.getByTestId('wishlist-occasion-chip');

		await expect.element(chip).toBeVisible();
		expect(chip.element().textContent?.trim()).toBe(m.wishlist_occasion_birthday());
		expect(chip.element().querySelector('svg')).not.toBeNull();
		await screen.unmount();
	});

	it('shows only the countdown in the Jiná chip below 960 px', async () => {
		await page.viewport(900, 720);
		const screen = await render(WishlistHeader, { ...baseProps, eventDate: daysFromNow(12) });
		const chip = screen.getByTestId('wishlist-occasion-chip');

		await expect.element(chip).toBeVisible();
		expect(chip.element().textContent?.trim()).toBe(m.countdown_days_many({ days: 12 }));
		expect(chip.element().querySelector('svg')).not.toBeNull();
		expect(
			visibleCountdownChips(
				screen.getByTestId('wishlist-banner').element(),
				m.countdown_days_many({ days: 12 }),
			),
		).toEqual([chip.element()]);
		await screen.unmount();
	});

	it.each(HERO_FRAMES)('%s keeps its decorations off a long title', async (heroFrame) => {
		for (const width of [960, 1280]) {
			await page.viewport(width, 720);
			const screen = await render(WishlistHeader, {
				...baseProps,
				heroFrame,
				role: 'visitor' as const,
				occasion: 'graduation' as const,
				eventDate: daysFromNow(120),
			});
			const banner = screen.getByTestId('wishlist-banner').element();
			const title = screen
				.getByRole('heading', { level: 1, name: baseProps.title })
				.element();
			const titleBox = title.getBoundingClientRect();
			const decorations = banner.querySelectorAll<Element>(
				'[data-testid^="wishlist-hero-"], .gift-ribbon, .gift-bow, .tag-hole',
			);

			expect(decorations.length).toBeGreaterThan(0);
			for (const decoration of decorations) {
				expectRectanglesSeparated(titleBox, decoration.getBoundingClientRect());
			}
			await screen.unmount();
		}
	});
});
