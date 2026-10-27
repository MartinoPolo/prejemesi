import {
	allCombinations,
	allPairs,
	type Combination,
	type Dimensions,
} from './support/pairwise.js';

/*
 * Capability inventory of the interaction suite (docs/TESTING.md#test-tiers). Each surface lists
 * only the interactions it really offers, the states that change their outcome, and the
 * requirement each expectation comes from. Specs generate their cases from these entries.
 */

export type InteractionCategory = 'gesture' | 'keyboard' | 'scroll' | 'layout' | 'motion';
/**
 * `pointer` is touch on phones and the mouse on wider viewports; `none` marks layout checks of a
 * resting state, which press nothing.
 */
export type InputModality = 'touch' | 'mouse' | 'pointer' | 'keyboard' | 'none';

/** `touch` viewports are phones, pressed with touch; the others use mouse and keyboard. */
export const VIEWPORTS = {
	narrow: { width: 360, height: 780, touch: true },
	mobile: { width: 390, height: 844, touch: true },
	tablet: { width: 768, height: 1024, touch: false },
	desktop: { width: 1280, height: 800, touch: false },
} as const;
export type ViewportName = keyof typeof VIEWPORTS;

export interface SurfaceCapability<D extends Dimensions, Outcome extends string> {
	interaction: string;
	category: InteractionCategory;
	input: InputModality;
	/** Restricts the surface's dimension values; unlisted dimensions keep all of them. */
	narrows?: { [Name in keyof D]?: readonly D[Name][number][] };
	/**
	 * Expected outcome per value of the surface's `outcomeDimension` (or `all` without one); a
	 * value without an outcome is a state where the surface does not offer the interaction.
	 */
	outcomes: Partial<Record<D[keyof D][number] | 'all', Outcome>>;
	/** Requirement source: a `.mpx/DECISIONS.md` date, an issue or design brief, with a short quote. */
	requirement: string;
}

export interface Surface<D extends Dimensions, Outcome extends string> {
	surfaceTag: `@${string}`;
	name: string;
	/** The riskiest surface runs every possible state; others sample all value pairs. */
	sampling: 'full' | 'pairwise';
	dimensions: D;
	outcomeDimension?: keyof D;
	/** Prunes states the product cannot reach. */
	isPossibleState: (state: Combination<D>) => boolean;
	requirementSources: readonly string[];
	capabilities: readonly SurfaceCapability<D, Outcome>[];
}

/** Positional capability constructor, so each surface's table reads one capability per entry. */
function capabilityFactory<D extends Dimensions, Outcome extends string>() {
	return (
		interaction: string,
		category: InteractionCategory,
		input: InputModality,
		narrows: SurfaceCapability<D, Outcome>['narrows'],
		outcomes: SurfaceCapability<D, Outcome>['outcomes'],
		requirement: string,
	): SurfaceCapability<D, Outcome> => ({
		interaction,
		category,
		input,
		narrows,
		outcomes,
		requirement,
	});
}

export interface SurfaceCase<D extends Dimensions, Outcome extends string> {
	capability: SurfaceCapability<D, Outcome>;
	state: Combination<D>;
	outcome: Outcome;
}

/** Expands each capability over the surface's possible states, by its sampling strategy. */
export function surfaceCases<D extends Dimensions, Outcome extends string>(
	surface: Surface<D, Outcome>,
): SurfaceCase<D, Outcome>[] {
	return surface.capabilities.flatMap((capability) => {
		const dimensions = Object.fromEntries(
			Object.entries(surface.dimensions).map(([name, values]) => [
				name,
				capability.narrows?.[name as keyof D] ?? values,
			]),
		) as unknown as D;
		const outcomeOf = (state: Combination<D>) =>
			surface.outcomeDimension === undefined
				? capability.outcomes.all
				: capability.outcomes[state[surface.outcomeDimension] as D[keyof D][number]];
		const isPossible = (state: Combination<D>) =>
			surface.isPossibleState(state) && outcomeOf(state) !== undefined;
		const states =
			surface.sampling === 'full'
				? allCombinations(dimensions, isPossible)
				: allPairs(dimensions, isPossible);
		return states.map((state) => ({ capability, state, outcome: outcomeOf(state)! }));
	});
}

// --- Gift card (`@gift-card`) -------------------------------------------------------------------

export const GIFT_CARD_DIMENSIONS = {
	viewport: ['mobile', 'desktop'],
	role: ['manager', 'visitor'],
	mode: ['browse', 'selection', 'reorder'],
	view: ['card', 'list'],
	grouping: ['none', 'priority'],
} as const satisfies Dimensions;

export type GiftCardState = Combination<typeof GIFT_CARD_DIMENSIONS>;

export type GiftCardOutcome =
	| 'opens-detail'
	| 'opens-actions-sheet'
	| 'opens-actions-menu'
	| 'opens-context-menu'
	| 'opens-category-popover'
	| 'opens-new-tab'
	| 'toggles-like'
	| 'toggles-selection'
	/** Not a long press: no actions Sheet or drag; the browser decides whether the release taps. */
	| 'no-long-press'
	/** No layer, selection, order or URL change. */
	| 'does-nothing'
	| 'starts-drag-in-place'
	| 'reorders'
	| 'scrolls-page';

const CONTENT_PRESS =
	'DECISIONS 2026-10-06 (#450): „Card press belongs to presses that start on card content; inner controls and open action surfaces never press the card"';
const DETAIL_BY_ROLE =
	'DECISIONS 2026-10-07 (#440): „Opening a gift without edit rights always shows the Gift viewer"';
const MOBILE_ACTIONS =
	'#286 REQ-2: „Render the desktop menu near the pointer and the mobile menu as a bottom action sheet"; #450 REQ-2: „On mobile, tapping More only opens the actions bottom sheet"';
const LONG_PRESS =
	'DECISIONS 2026-10-26: „Outside reorder mode, a 500 ms touch long press on a gift card opens its actions, or earlier when the browser fires its native `contextmenu`"; „Moving more than 8 px, scrolling or a second finger cancels the press"';
const SELECTION_LONG_PRESS =
	'DECISIONS 2026-10-26: „In selection mode a long press toggles selection like a tap and never opens the actions"';
const NO_TOUCH_CONTEXT_MENU =
	'#286 design brief: „Never open a floating Bits UI context menu on touch"; #574: „Touch and pen contextmenu now belong to the long-press recognizer"';
const TOUCH_REORDER =
	'DECISIONS 2026-10-22 (#530): „On touch the grip drags at once and a 300 ms long press elsewhere on the card starts a drag, so swiping over cards still scrolls"';
const POINTER_REORDER =
	'DECISIONS 2026-10-22 (#530): „In reorder mode a mouse or pen press anywhere on a card drags it, since cards cannot be opened there"';
const KEYBOARD_REORDER =
	'DECISIONS 2026-10-06 (#454): „In-group moves permute the group\'s existing global slots; cross-group drag or keyboard moves insert before the new next neighbour"';
const SELECTION_PRESS =
	'DECISIONS 2026-10-22 (#520, #550): „badges never intercept the selection click"';
const CATEGORY_MORE =
	'DECISIONS 2026-10-24 (#529): a „+X" button „whose popover lists them all and which never presses the card"';
const SOURCE_LINKS =
	'DECISIONS 2026-05-30: „Source links are immediately accessible in every gift view"';
const LIKES =
	'DECISIONS 2026-10-02: „Preserve the ghost heart/count and accessible targets"; #450: inner controls never press the card';
const MENU_KEYBOARD =
	'#286: „Context menus should use standard icon, separator, submenu, focus, keyboard, and dismissal behavior"';
const CONTEXT_MENU_KEY =
	'#286 design brief: „`Shift+F10` or the Context Menu key opens the same desktop menu"';
const RIGHT_CLICK_MENU =
	'#286 design brief: the desktop context menu opens on „Right-click, `Shift+F10`, or Context Menu key"';
const LAYER_KEYBOARD =
	'WAI-ARIA APG dialog pattern: Escape closes the layer and focus returns to the element that opened it';

const mobileTouch = { viewport: ['mobile'] } as const;
const desktopPointer = { viewport: ['desktop'] } as const;
const bothGroupings = ['none', 'priority'] as const;
const ungrouped = ['none'] as const;

const capability = capabilityFactory<typeof GIFT_CARD_DIMENSIONS, GiftCardOutcome>();

/** Gift cards on the wishlist page, in its Card and List views. */
export const GIFT_CARD_SURFACE: Surface<typeof GIFT_CARD_DIMENSIONS, GiftCardOutcome> = {
	surfaceTag: '@gift-card',
	name: 'Gift card',
	sampling: 'full',
	dimensions: GIFT_CARD_DIMENSIONS,
	outcomeDimension: 'mode',
	isPossibleState: (state) =>
		// Selection and reorder belong to managers (#521).
		state.mode === 'browse' || state.role === 'manager',
	requirementSources: [
		CONTENT_PRESS,
		DETAIL_BY_ROLE,
		LONG_PRESS,
		SELECTION_LONG_PRESS,
		TOUCH_REORDER,
		CATEGORY_MORE,
	],
	capabilities: [
		// Touch on phones.
		capability(
			'tap content',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: bothGroupings },
			{ browse: 'opens-detail', selection: 'toggles-selection', reorder: 'does-nothing' },
			`${CONTENT_PRESS}; ${DETAIL_BY_ROLE}; ${POINTER_REORDER}`,
		),
		capability(
			'double tap content',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'opens-detail' },
			CONTENT_PRESS,
		),
		capability(
			'hold 150 ms',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'opens-detail', reorder: 'does-nothing' },
			`${LONG_PRESS}; ${TOUCH_REORDER}`,
		),
		capability(
			'hold 375 ms',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'no-long-press', reorder: 'starts-drag-in-place' },
			`${LONG_PRESS}; ${TOUCH_REORDER}`,
		),
		capability(
			'hold 900 ms',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: bothGroupings },
			{
				browse: 'opens-actions-sheet',
				selection: 'toggles-selection',
				reorder: 'starts-drag-in-place',
			},
			`${LONG_PRESS}; ${SELECTION_LONG_PRESS}; ${TOUCH_REORDER}`,
		),
		capability(
			'hold with 4 px drift',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'opens-actions-sheet', reorder: 'starts-drag-in-place' },
			LONG_PRESS,
		),
		capability(
			'hold with 12 px drift',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'no-long-press', reorder: 'does-nothing' },
			LONG_PRESS,
		),
		capability(
			'hold then scroll',
			'scroll',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'scrolls-page', selection: 'scrolls-page', reorder: 'scrolls-page' },
			`${LONG_PRESS}; ${TOUCH_REORDER}`,
		),
		capability(
			'swipe over cards',
			'scroll',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'scrolls-page', selection: 'scrolls-page', reorder: 'scrolls-page' },
			TOUCH_REORDER,
		),
		capability(
			'long press with native contextmenu',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'opens-actions-sheet', reorder: 'starts-drag-in-place' },
			`${LONG_PRESS}; ${NO_TOUCH_CONTEXT_MENU}`,
		),
		capability(
			'release outside',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'does-nothing', selection: 'does-nothing', reorder: 'does-nothing' },
			CONTENT_PRESS,
		),
		capability(
			'second finger during hold',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'no-long-press' },
			LONG_PRESS,
		),
		capability(
			'long press drag to neighbour',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: bothGroupings },
			{ reorder: 'reorders' },
			TOUCH_REORDER,
		),
		capability(
			'grip drag to neighbour',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: bothGroupings },
			{ reorder: 'reorders' },
			TOUCH_REORDER,
		),
		capability(
			'tap More',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'opens-actions-sheet' },
			`${CONTENT_PRESS}; ${MOBILE_ACTIONS}`,
		),
		capability(
			'tap source link',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'opens-new-tab' },
			`${CONTENT_PRESS}; ${SOURCE_LINKS}`,
		),
		capability(
			'tap category "+X"',
			'gesture',
			'touch',
			{ ...mobileTouch, grouping: ungrouped },
			{ browse: 'opens-category-popover', selection: 'toggles-selection' },
			`${CATEGORY_MORE}; ${SELECTION_PRESS}`,
		),
		capability(
			'tap Like',
			'gesture',
			'touch',
			{ ...mobileTouch, role: ['visitor'], grouping: ungrouped },
			{ browse: 'toggles-like' },
			`${CONTENT_PRESS}; ${LIKES}`,
		),

		// Mouse on desktops.
		capability(
			'click content',
			'gesture',
			'mouse',
			{ ...desktopPointer, grouping: bothGroupings },
			{ browse: 'opens-detail', selection: 'toggles-selection', reorder: 'does-nothing' },
			`${CONTENT_PRESS}; ${DETAIL_BY_ROLE}; ${POINTER_REORDER}`,
		),
		capability(
			'right-click content',
			'gesture',
			'mouse',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'opens-context-menu', selection: 'does-nothing', reorder: 'does-nothing' },
			RIGHT_CLICK_MENU,
		),
		capability(
			'right-click source link',
			'gesture',
			'mouse',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'does-nothing' },
			CONTENT_PRESS,
		),
		capability(
			'release outside',
			'gesture',
			'mouse',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'does-nothing', selection: 'does-nothing' },
			CONTENT_PRESS,
		),
		capability(
			'mouse drag to neighbour',
			'gesture',
			'mouse',
			{ ...desktopPointer, grouping: bothGroupings },
			{ reorder: 'reorders' },
			POINTER_REORDER,
		),
		capability(
			'click More',
			'gesture',
			'mouse',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'opens-actions-menu' },
			`${CONTENT_PRESS}; ${MOBILE_ACTIONS}`,
		),
		capability(
			'click source link',
			'gesture',
			'mouse',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'opens-new-tab' },
			`${CONTENT_PRESS}; ${SOURCE_LINKS}`,
		),
		capability(
			'click category "+X"',
			'gesture',
			'mouse',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'opens-category-popover', selection: 'toggles-selection' },
			`${CATEGORY_MORE}; ${SELECTION_PRESS}`,
		),
		capability(
			'click Like',
			'gesture',
			'mouse',
			{ ...desktopPointer, role: ['visitor'], grouping: ungrouped },
			{ browse: 'toggles-like' },
			`${CONTENT_PRESS}; ${LIKES}`,
		),

		// Keyboard on desktops.
		capability(
			'Enter on card',
			'keyboard',
			'keyboard',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'opens-detail', selection: 'toggles-selection' },
			`${DETAIL_BY_ROLE}; ${LAYER_KEYBOARD}`,
		),
		capability(
			'Space on card',
			'keyboard',
			'keyboard',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'opens-detail', selection: 'toggles-selection' },
			`${DETAIL_BY_ROLE}; ${LAYER_KEYBOARD}`,
		),
		capability(
			'Shift+F10 on card',
			'keyboard',
			'keyboard',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'opens-context-menu' },
			`${CONTEXT_MENU_KEY}; ${MENU_KEYBOARD}`,
		),
		capability(
			'Enter on More',
			'keyboard',
			'keyboard',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'opens-actions-menu' },
			`${MOBILE_ACTIONS}; ${MENU_KEYBOARD}`,
		),
		capability(
			'Enter on category "+X"',
			'keyboard',
			'keyboard',
			{ ...desktopPointer, grouping: ungrouped },
			{ browse: 'opens-category-popover' },
			`${CATEGORY_MORE}; ${LAYER_KEYBOARD}`,
		),
		capability(
			'Enter on Like',
			'keyboard',
			'keyboard',
			{ ...desktopPointer, role: ['visitor'], grouping: ungrouped },
			{ browse: 'toggles-like' },
			LIKES,
		),
		capability(
			'arrow keys on grip',
			'keyboard',
			'keyboard',
			{ ...desktopPointer, grouping: bothGroupings },
			{ reorder: 'reorders' },
			KEYBOARD_REORDER,
		),
	],
};

// --- Přehled carousel rows (`@carousel`) --------------------------------------------------------

export const CAROUSEL_DIMENSIONS = {
	viewport: ['narrow', 'mobile', 'tablet', 'desktop'],
	row: ['recent', 'category'],
	/** Where the row is scrolled to before the interaction. */
	position: ['start', 'end'],
	motion: ['full', 'reduced'],
} as const satisfies Dimensions;

export type CarouselState = Combination<typeof CAROUSEL_DIMENSIONS>;

export type CarouselOutcome =
	/** The row overflows and the next card peeks at its right edge. */
	| 'peeks-next-card'
	/** The row is scrolled to its end, its last card fully visible; category rows end with „Zobrazit vše". */
	| 'reaches-row-end'
	/** The row scrolls toward its other end; the page and URL stay. */
	| 'scrolls-row'
	/** The page scrolls; the row stays. */
	| 'scrolls-page'
	| 'opens-card-link'
	/** The row follows the pointer, keeps gliding after release, and the release opens nothing. */
	| 'drags-row-and-glides'
	/** The next (or previous) card becomes the leading one, gliding unless motion is reduced. */
	| 'glides-one-card'
	| 'glides-two-cards';

const OVERVIEW_ROWS =
	'DECISIONS 2026-08-07: „horizontal, next-card-peeking carousels on desktop and mobile"; „category rows end with “Zobrazit vše”"';
const ROW_PEEK =
	'DECISIONS 2026-10-26: „At every width a next card peeks while a row has more to show"; #225 design brief: „peek ≥ 24px of the next card at all widths whenever the row overflows"';
const ROW_END = 'DECISIONS 2026-10-26: „the last card is fully visible at the row\'s end"';
const ROW_ARROW_STEPS =
	'DECISIONS 2026-10-26: „Previous and Next each move one whole card, including at either end"';
const NATIVE_ROWS =
	'DECISIONS 2026-10-25 (#573): „touch, trackpad and Shift+wheel scroll on the compositor thread"';
const ROW_ARROWS =
	'DECISIONS 2026-10-25 (#573): „arrows glide one card with native smooth scrolling"';
const ROW_MOUSE_DRAG =
	'DECISIONS 2026-10-25 (#573): „mouse click-and-drag (with a short release glide)"; #573: „a drag doesn\'t open the card under the pointer"';
const ROW_CARDS = 'DECISIONS 2026-08-07: rows „Reuse WishlistCard", which links to its wishlist';
const MOTION_GATING =
	'DECISIONS 2026-07-10: „Motion uses shared duration/easing tokens and reduced-motion gating"; DECISIONS 2026-09-24: „Preserve reduced-motion handling"';

const carouselCapability = capabilityFactory<typeof CAROUSEL_DIMENSIONS, CarouselOutcome>();
const phones = ['narrow', 'mobile'] as const;
const pointerViewports = ['tablet', 'desktop'] as const;
const fullMotion = ['full'] as const;
const atStart = ['start'] as const;
/** Behaviour that does not depend on width runs once per input, on the most common viewport. */
const onePhone = { viewport: ['mobile'], motion: fullMotion } as const;
const oneDesktop = { viewport: ['desktop'], motion: fullMotion } as const;

/**
 * The Nedávné (large) and Moje seznamy (category) rows on Přehled. Row geometry differs per
 * viewport and row, so the resting layout and the arrow glides sample all of them; motion matters
 * only for the arrow glide; the trailing „Zobrazit vše" card needs more lists than the row shows.
 */
export const CAROUSEL_SURFACE: Surface<typeof CAROUSEL_DIMENSIONS, CarouselOutcome> = {
	surfaceTag: '@carousel',
	name: 'Přehled carousel rows',
	sampling: 'pairwise',
	dimensions: CAROUSEL_DIMENSIONS,
	outcomeDimension: 'position',
	isPossibleState: () => true,
	requirementSources: [
		OVERVIEW_ROWS,
		ROW_PEEK,
		ROW_END,
		ROW_ARROW_STEPS,
		NATIVE_ROWS,
		ROW_ARROWS,
		ROW_MOUSE_DRAG,
		MOTION_GATING,
	],
	capabilities: [
		// One entry per position, so every viewport and row is checked at both ends.
		carouselCapability(
			'row at rest',
			'layout',
			'none',
			{ motion: fullMotion, position: atStart },
			{ start: 'peeks-next-card' },
			`${OVERVIEW_ROWS}; ${ROW_PEEK}`,
		),
		carouselCapability(
			'row at rest',
			'layout',
			'none',
			{ motion: fullMotion, position: ['end'] },
			{ end: 'reaches-row-end' },
			`${OVERVIEW_ROWS}; ${ROW_END}`,
		),
		carouselCapability(
			'horizontal swipe',
			'scroll',
			'touch',
			{ ...onePhone, row: ['category'] },
			{ start: 'scrolls-row', end: 'scrolls-row' },
			NATIVE_ROWS,
		),
		carouselCapability(
			'vertical swipe over a row',
			'scroll',
			'touch',
			{ ...onePhone, row: ['category'], position: atStart },
			{ start: 'scrolls-page' },
			NATIVE_ROWS,
		),
		carouselCapability(
			'tap card',
			'gesture',
			'touch',
			{ ...onePhone, row: ['recent'], position: atStart },
			{ start: 'opens-card-link' },
			ROW_CARDS,
		),
		carouselCapability(
			'tap arrow',
			'motion',
			'touch',
			{ viewport: phones },
			{ start: 'glides-one-card', end: 'glides-one-card' },
			`${ROW_ARROW_STEPS}; ${ROW_ARROWS}; ${MOTION_GATING}`,
		),
		carouselCapability(
			'Shift+wheel',
			'scroll',
			'mouse',
			{ ...oneDesktop, row: ['recent'] },
			{ start: 'scrolls-row', end: 'scrolls-row' },
			NATIVE_ROWS,
		),
		carouselCapability(
			'mouse drag across cards',
			'gesture',
			'mouse',
			{ ...oneDesktop, row: ['category'], position: atStart },
			{ start: 'drags-row-and-glides' },
			ROW_MOUSE_DRAG,
		),
		carouselCapability(
			'click card',
			'gesture',
			'mouse',
			{ ...oneDesktop, row: ['recent'], position: atStart },
			{ start: 'opens-card-link' },
			`${ROW_CARDS}; ${ROW_MOUSE_DRAG}`,
		),
		carouselCapability(
			'click arrow',
			'motion',
			'mouse',
			{ viewport: pointerViewports },
			{ start: 'glides-one-card', end: 'glides-one-card' },
			`${ROW_ARROW_STEPS}; ${ROW_ARROWS}; ${MOTION_GATING}`,
		),
		carouselCapability(
			'click Next twice quickly',
			'motion',
			'mouse',
			{ ...oneDesktop, row: ['recent'], position: atStart },
			{ start: 'glides-two-cards' },
			`${ROW_ARROW_STEPS}; ${ROW_ARROWS}`,
		),
		carouselCapability(
			'Enter on an arrow button',
			'keyboard',
			'keyboard',
			{ ...oneDesktop, row: ['category'] },
			{ start: 'glides-one-card', end: 'glides-one-card' },
			`${ROW_ARROW_STEPS}; ${ROW_ARROWS}; #225 design brief: „arrows focusable"`,
		),
	],
};

// --- Assistant panel resize handle (`@assistant-resize`) ----------------------------------------

export const ASSISTANT_RESIZE_DIMENSIONS = {
	/** Both dock the panel; below 640 px it becomes a sheet without the handle. */
	viewport: ['tablet', 'desktop'],
	/** The panel width before the interaction. */
	start: ['min', 'default', 'max'],
} as const satisfies Dimensions;

export type AssistantResizeState = Combination<typeof ASSISTANT_RESIZE_DIMENSIONS>;

export type AssistantResizeOutcome =
	/** The width changes by the pointer travel, clamped to the limits. */
	| 'follows-pointer-within-limits'
	| 'widens-one-step'
	| 'narrows-one-step'
	| 'stays-at-max'
	| 'stays-at-min'
	| 'jumps-to-min'
	| 'jumps-to-max'
	/** The default width, clamped to the limits. */
	| 'restores-default'
	/** The wishlist content ends where the panel begins. */
	| 'reserves-list-space';

const DOCKED_PANEL =
	'DECISIONS 2026-10-19: „The chatbot is a resizable, right-docked panel … with reserved list space"';
const PANEL_WIDTHS =
	'DECISIONS 2026-10-26: „The chatbot panel opens 420 px wide and resizes between 360 px and the smaller of 640 px and half the viewport"';
const PANEL_LIMITS = `${PANEL_WIDTHS}; #478 design brief (designs/ai-chatbot, chosen 2026-10-19): „draggable from the left edge"`;
const SEPARATOR_KEYS = `${PANEL_WIDTHS}; #478 design brief: „the resize handle is keyboard-operable (arrow keys)"; WAI-ARIA APG window splitter: Home and End move to the limits`;
const DOUBLE_CLICK_DEFAULT = `${PANEL_WIDTHS}; #478 design brief: „double-click on the handle resets to 420 px"`;

const assistantResizeCapability = capabilityFactory<
	typeof ASSISTANT_RESIZE_DIMENSIONS,
	AssistantResizeOutcome
>();

/**
 * The left-edge separator of the docked AI assistant panel. Every outcome also requires the
 * separator's value to match the rendered width and the list to keep its space.
 */
export const ASSISTANT_RESIZE_SURFACE: Surface<
	typeof ASSISTANT_RESIZE_DIMENSIONS,
	AssistantResizeOutcome
> = {
	surfaceTag: '@assistant-resize',
	name: 'Assistant panel resize handle',
	sampling: 'pairwise',
	dimensions: ASSISTANT_RESIZE_DIMENSIONS,
	outcomeDimension: 'start',
	// At 768 px half the viewport is below the default width, so default and max coincide.
	isPossibleState: (state) => !(state.viewport === 'tablet' && state.start === 'default'),
	requirementSources: [DOCKED_PANEL, PANEL_LIMITS, SEPARATOR_KEYS, DOUBLE_CLICK_DEFAULT],
	capabilities: [
		assistantResizeCapability(
			'open panel at rest',
			'layout',
			'none',
			undefined,
			{
				min: 'reserves-list-space',
				default: 'reserves-list-space',
				max: 'reserves-list-space',
			},
			DOCKED_PANEL,
		),
		assistantResizeCapability(
			'drag handle 120 px left',
			'gesture',
			'mouse',
			undefined,
			{
				min: 'follows-pointer-within-limits',
				default: 'follows-pointer-within-limits',
				max: 'follows-pointer-within-limits',
			},
			`${DOCKED_PANEL}; ${PANEL_LIMITS}`,
		),
		assistantResizeCapability(
			'drag handle 120 px right',
			'gesture',
			'mouse',
			undefined,
			{
				min: 'follows-pointer-within-limits',
				default: 'follows-pointer-within-limits',
				max: 'follows-pointer-within-limits',
			},
			`${DOCKED_PANEL}; ${PANEL_LIMITS}`,
		),
		assistantResizeCapability(
			'ArrowLeft on handle',
			'keyboard',
			'keyboard',
			undefined,
			{ min: 'widens-one-step', default: 'widens-one-step', max: 'stays-at-max' },
			SEPARATOR_KEYS,
		),
		assistantResizeCapability(
			'ArrowRight on handle',
			'keyboard',
			'keyboard',
			undefined,
			{ min: 'stays-at-min', default: 'narrows-one-step', max: 'narrows-one-step' },
			SEPARATOR_KEYS,
		),
		assistantResizeCapability(
			'Home on handle',
			'keyboard',
			'keyboard',
			undefined,
			{ default: 'jumps-to-min', max: 'jumps-to-min' },
			SEPARATOR_KEYS,
		),
		assistantResizeCapability(
			'End on handle',
			'keyboard',
			'keyboard',
			undefined,
			{ min: 'jumps-to-max', default: 'jumps-to-max' },
			SEPARATOR_KEYS,
		),
		assistantResizeCapability(
			'double-click handle',
			'gesture',
			'mouse',
			undefined,
			{ min: 'restores-default', max: 'restores-default' },
			DOUBLE_CLICK_DEFAULT,
		),
	],
};

// --- Wishlist background focal picker (`@focal-picker`) -----------------------------------------

export const FOCAL_PICKER_DIMENSIONS = {
	viewport: ['mobile', 'desktop'],
	/** Where the focal point sits before the interaction. */
	start: ['center', 'corner'],
} as const satisfies Dimensions;

export type FocalPickerState = Combination<typeof FOCAL_PICKER_DIMENSIONS>;

export type FocalPickerOutcome =
	/** The point lands under the press and its accessible value names the new position. */
	| 'places-point-under-press'
	/** The point follows the pointer and ends under the release; the settings sheet does not scroll. */
	| 'follows-pointer'
	/** Dragged past the preview, the point stops at its edge. */
	| 'stops-at-preview-edge'
	| 'moves-one-step'
	/** The point moves in the arrow direction, farther than a plain arrow step. */
	| 'moves-a-larger-step'
	| 'stays-at-preview-edge';

const FOCAL_POINT =
	'CONTEXT.md: the Wishlist background library image or custom photo comes „with focal point", whose „x/y in percent 0–100"';
const FOCAL_HINT =
	'Shipped hint copy, no issue or DECISIONS entry: „Klikněte do náhledu, táhněte bod nebo použijte šipky"';
const FOCAL_KEYBOARD =
	'DECISIONS 2026-10-26: „The wishlist background focal picker uses the crop stage\'s keyboard steps, including its larger Shift+Arrow step"; DECISIONS 2026-10-23: the crop stage uses „arrows pan, Shift for larger steps"';

const focalPickerCapability = capabilityFactory<
	typeof FOCAL_PICKER_DIMENSIONS,
	FocalPickerOutcome
>();
const desktopOnly = { viewport: ['desktop'] } as const;
const mobileOnly = { viewport: ['mobile'] } as const;
const fromCenter = { start: ['center'] } as const;

/** The focal preview in Nastavení seznamu → Vzhled → Pozadí stránky: Knihovna. */
export const FOCAL_PICKER_SURFACE: Surface<typeof FOCAL_PICKER_DIMENSIONS, FocalPickerOutcome> = {
	surfaceTag: '@focal-picker',
	name: 'Wishlist background focal picker',
	sampling: 'pairwise',
	dimensions: FOCAL_PICKER_DIMENSIONS,
	outcomeDimension: 'start',
	isPossibleState: () => true,
	requirementSources: [FOCAL_POINT, FOCAL_HINT, FOCAL_KEYBOARD],
	capabilities: [
		focalPickerCapability(
			'click in the preview',
			'gesture',
			'mouse',
			desktopOnly,
			{ center: 'places-point-under-press', corner: 'places-point-under-press' },
			FOCAL_HINT,
		),
		focalPickerCapability(
			'tap in the preview',
			'gesture',
			'touch',
			mobileOnly,
			{ center: 'places-point-under-press', corner: 'places-point-under-press' },
			FOCAL_HINT,
		),
		focalPickerCapability(
			'mouse drag the point',
			'gesture',
			'mouse',
			desktopOnly,
			{ center: 'follows-pointer', corner: 'follows-pointer' },
			FOCAL_HINT,
		),
		focalPickerCapability(
			'touch drag the point',
			'gesture',
			'touch',
			mobileOnly,
			{ center: 'follows-pointer', corner: 'follows-pointer' },
			FOCAL_HINT,
		),
		focalPickerCapability(
			'mouse drag past the preview edge',
			'gesture',
			'mouse',
			{ ...desktopOnly, ...fromCenter },
			{ center: 'stops-at-preview-edge' },
			`${FOCAL_HINT}; ${FOCAL_POINT} (0–100 %)`,
		),
		focalPickerCapability(
			'touch drag past the preview edge',
			'gesture',
			'touch',
			{ ...mobileOnly, ...fromCenter },
			{ center: 'stops-at-preview-edge' },
			`${FOCAL_HINT}; ${FOCAL_POINT} (0–100 %)`,
		),
		focalPickerCapability(
			'ArrowLeft on the point',
			'keyboard',
			'keyboard',
			desktopOnly,
			{ center: 'moves-one-step', corner: 'stays-at-preview-edge' },
			`${FOCAL_KEYBOARD}; ${FOCAL_POINT} (0–100 %)`,
		),
		focalPickerCapability(
			'ArrowDown on the point',
			'keyboard',
			'keyboard',
			desktopOnly,
			{ center: 'moves-one-step', corner: 'moves-one-step' },
			FOCAL_KEYBOARD,
		),
		focalPickerCapability(
			'Shift+ArrowLeft on the point',
			'keyboard',
			'keyboard',
			{ ...desktopOnly, ...fromCenter },
			{ center: 'moves-a-larger-step' },
			FOCAL_KEYBOARD,
		),
	],
};

// --- Category settings rows (`@category-settings`) ----------------------------------------------

export const CATEGORY_SETTINGS_DIMENSIONS = {
	viewport: ['narrow', 'mobile', 'tablet', 'desktop'],
	/** The row the interaction starts on; each is used by a gift, the rows between them are not. */
	row: ['first', 'middle', 'last'],
	motion: ['full', 'reduced'],
} as const satisfies Dimensions;

export type CategorySettingsState = Combination<typeof CATEGORY_SETTINGS_DIMENSIONS>;

export type CategorySettingsOutcome =
	/** Grip, name, color and remove controls stay inside the row and the viewport, one row per line. */
	| 'controls-fit-the-row'
	/** The dragged row lands where it was dropped, the others close up, and the draft awaits Save. */
	| 'moves-to-drop-position'
	/** Escape cancels only the drag: the saved order returns and the settings dialog stays open. */
	| 'restores-order-in-open-dialog'
	/** The row swaps with its neighbour and focus stays on its grip; it glides unless motion is reduced. */
	| 'moves-one-place'
	| 'stays-in-place'
	/** The new name shows, focus returns to the name, and the draft awaits Save. */
	| 'renames-and-returns-focus'
	/** Escape leaves the name and the dialog as they were, with focus back on the name. */
	| 'keeps-label-in-open-dialog'
	/** The row stays, struck through, says how many gifts lose it, and offers a focused „Vrátit". */
	| 'stages-removal-with-undo'
	/** „Vrátit" brings the row back as it was, with focus on its remove button. */
	| 'restores-row'
	/** The unused row below leaves the list at once and the draft awaits Save. */
	| 'removes-unused-at-once';

const CATEGORY_LIST =
	'DECISIONS 2026-10-24 (#534): „Wishlist categories are one list in manager order, reordered by grip drag or arrow keys, each renamable and recolorable"';
const CATEGORY_REMOVAL =
	'DECISIONS 2026-10-24 (#534): „Removing a category that gifts use is staged in the list with “Vrátit” and applied on Save … the row shows how many gifts lose the category"';
const UNUSED_CATEGORY_REMOVAL =
	'DECISIONS 2026-10-24 (#534): „An unused category leaves the list at once"';
const CATEGORY_LAYOUT = '#534: „a layout that works for ordering: one column on mobile"';
const CATEGORY_GRIP =
	'#534 design brief (variant A): „Drag uses a grip … and FLIP settling, matching the gift reorder decisions; the grip also moves with arrow keys"';
const CATEGORY_DRAG_ESCAPE =
	'#454: „Escape still cancels a drag in progress"; #534 design brief: category drag is „matching the gift reorder decisions"';
const CATEGORY_RENAME =
	'#534 design brief: „Clicking the badge swaps it for a text input (Enter or blur keeps, Esc reverts)"';

const categorySettingsCapability = capabilityFactory<
	typeof CATEGORY_SETTINGS_DIMENSIONS,
	CategorySettingsOutcome
>();
const withFullMotion = { motion: fullMotion } as const;
const everyRow = (outcome: CategorySettingsOutcome) =>
	({ first: outcome, middle: outcome, last: outcome }) as const;

/** The category rows in Nastavení seznamu → Kategorie; nothing is ever saved. */
export const CATEGORY_SETTINGS_SURFACE: Surface<
	typeof CATEGORY_SETTINGS_DIMENSIONS,
	CategorySettingsOutcome
> = {
	surfaceTag: '@category-settings',
	name: 'Category settings rows',
	sampling: 'pairwise',
	dimensions: CATEGORY_SETTINGS_DIMENSIONS,
	outcomeDimension: 'row',
	isPossibleState: () => true,
	requirementSources: [
		CATEGORY_LIST,
		CATEGORY_REMOVAL,
		UNUSED_CATEGORY_REMOVAL,
		CATEGORY_LAYOUT,
		CATEGORY_GRIP,
		CATEGORY_RENAME,
	],
	capabilities: [
		categorySettingsCapability(
			'rows at rest',
			'layout',
			'none',
			{ row: ['first'], ...withFullMotion },
			{ first: 'controls-fit-the-row' },
			CATEGORY_LAYOUT,
		),
		categorySettingsCapability(
			'touch drag the grip two rows along',
			'gesture',
			'touch',
			{ viewport: ['narrow', 'mobile'], ...withFullMotion },
			everyRow('moves-to-drop-position'),
			`${CATEGORY_LIST}; ${CATEGORY_GRIP}`,
		),
		categorySettingsCapability(
			'mouse drag the grip two rows along',
			'gesture',
			'mouse',
			{ viewport: ['tablet', 'desktop'], ...withFullMotion },
			everyRow('moves-to-drop-position'),
			`${CATEGORY_LIST}; ${CATEGORY_GRIP}`,
		),
		categorySettingsCapability(
			'Escape during a mouse drag',
			'keyboard',
			'keyboard',
			{ viewport: ['desktop'], row: ['middle'], ...withFullMotion },
			{ middle: 'restores-order-in-open-dialog' },
			CATEGORY_DRAG_ESCAPE,
		),
		categorySettingsCapability(
			'ArrowUp on the grip',
			'keyboard',
			'keyboard',
			{ viewport: ['desktop'], ...withFullMotion },
			{ first: 'stays-in-place', middle: 'moves-one-place', last: 'moves-one-place' },
			`${CATEGORY_LIST}; ${CATEGORY_GRIP}`,
		),
		categorySettingsCapability(
			'ArrowDown on the grip',
			'motion',
			'keyboard',
			{ viewport: ['desktop'] },
			{ first: 'moves-one-place', middle: 'moves-one-place', last: 'stays-in-place' },
			`${CATEGORY_GRIP}; ${MOTION_GATING}`,
		),
		categorySettingsCapability(
			'rename and press Enter',
			'keyboard',
			'keyboard',
			{ viewport: ['mobile', 'desktop'], row: ['middle'], ...withFullMotion },
			{ middle: 'renames-and-returns-focus' },
			`${CATEGORY_LIST}; ${CATEGORY_RENAME}`,
		),
		categorySettingsCapability(
			'Escape while renaming',
			'keyboard',
			'keyboard',
			{ viewport: ['desktop'], row: ['first'], ...withFullMotion },
			{ first: 'keeps-label-in-open-dialog' },
			`${CATEGORY_LIST}; ${CATEGORY_RENAME}`,
		),
		categorySettingsCapability(
			'remove a used category',
			'gesture',
			'pointer',
			{ viewport: ['mobile', 'desktop'], row: ['first', 'last'], ...withFullMotion },
			{ first: 'stages-removal-with-undo', last: 'stages-removal-with-undo' },
			CATEGORY_REMOVAL,
		),
		categorySettingsCapability(
			'remove, then Vrátit',
			'gesture',
			'pointer',
			{ viewport: ['mobile', 'desktop'], row: ['middle'], ...withFullMotion },
			{ middle: 'restores-row' },
			CATEGORY_REMOVAL,
		),
		categorySettingsCapability(
			'remove the unused row below',
			'gesture',
			'pointer',
			{ viewport: ['mobile', 'desktop'], row: ['first'], ...withFullMotion },
			{ first: 'removes-unused-at-once' },
			UNUSED_CATEGORY_REMOVAL,
		),
	],
};

// --- Gift category "+X" popover (`@category-popover`) -------------------------------------------

export const CATEGORY_POPOVER_DIMENSIONS = {
	viewport: ['narrow', 'mobile', 'desktop'],
	view: ['card', 'list'],
} as const satisfies Dimensions;

export type CategoryPopoverState = Combination<typeof CATEGORY_POPOVER_DIMENSIONS>;

export type CategoryPopoverOutcome =
	/** Every category of the gift shows, each badge fully inside the viewport. */
	| 'fits-the-viewport'
	/** The popover closes and the tapped gift does not open. */
	| 'dismisses-without-pressing'
	/** A press inside the popover keeps it open and presses nothing underneath. */
	| 'stays-open'
	/** The list scrolls and the popover closes instead of trailing it. */
	| 'dismisses-and-scrolls'
	/** Resting the pointer on the chip opens nothing. */
	| 'stays-closed';

const CATEGORY_MORE_POPOVER =
	'DECISIONS 2026-10-24 (#529): a „+X" button „whose popover lists them all and which never presses the card"';
const CATEGORY_POPOVER_TRIGGER =
	'DECISIONS 2026-10-26: „The category “+X” popover opens on click or tap, never on hover, and a click or tap outside closes it without pressing what lies beneath"';
const CATEGORY_POPOVER_DISMISSAL =
	'#574: „An outside touch now only dismisses the popover"; „The popover trailed the list while scrolling. Scrolling now closes it"';

const categoryPopoverCapability = capabilityFactory<
	typeof CATEGORY_POPOVER_DIMENSIONS,
	CategoryPopoverOutcome
>();

/**
 * The "+X" chip's popover on a gift with more categories than its lane shows. Opening it and
 * closing it with Escape belong to `@gift-card`; this surface covers hovering the chip and what
 * happens while the popover is open.
 */
export const CATEGORY_POPOVER_SURFACE: Surface<
	typeof CATEGORY_POPOVER_DIMENSIONS,
	CategoryPopoverOutcome
> = {
	surfaceTag: '@category-popover',
	name: 'Gift category "+X" popover',
	sampling: 'pairwise',
	dimensions: CATEGORY_POPOVER_DIMENSIONS,
	isPossibleState: () => true,
	requirementSources: [
		CATEGORY_MORE_POPOVER,
		CATEGORY_POPOVER_TRIGGER,
		CATEGORY_POPOVER_DISMISSAL,
	],
	capabilities: [
		categoryPopoverCapability(
			'popover open at rest',
			'layout',
			'none',
			undefined,
			{ all: 'fits-the-viewport' },
			CATEGORY_MORE_POPOVER,
		),
		categoryPopoverCapability(
			'tap another gift while open',
			'gesture',
			'touch',
			{ viewport: ['narrow', 'mobile'] },
			{ all: 'dismisses-without-pressing' },
			`${CATEGORY_POPOVER_TRIGGER}; ${CATEGORY_POPOVER_DISMISSAL}`,
		),
		categoryPopoverCapability(
			'click another gift while open',
			'gesture',
			'mouse',
			{ viewport: ['desktop'] },
			{ all: 'dismisses-without-pressing' },
			CATEGORY_POPOVER_TRIGGER,
		),
		categoryPopoverCapability(
			'hover the "+X" chip',
			'gesture',
			'mouse',
			{ viewport: ['desktop'] },
			{ all: 'stays-closed' },
			CATEGORY_POPOVER_TRIGGER,
		),
		categoryPopoverCapability(
			'tap a category inside the popover',
			'gesture',
			'touch',
			{ viewport: ['mobile'] },
			{ all: 'stays-open' },
			`${CATEGORY_MORE_POPOVER}; ${CATEGORY_POPOVER_DISMISSAL}`,
		),
		categoryPopoverCapability(
			'swipe the list while open',
			'scroll',
			'touch',
			{ viewport: ['mobile'] },
			{ all: 'dismisses-and-scrolls' },
			CATEGORY_POPOVER_DISMISSAL,
		),
		categoryPopoverCapability(
			'wheel over the list while open',
			'scroll',
			'mouse',
			{ viewport: ['desktop'] },
			{ all: 'dismisses-and-scrolls' },
			CATEGORY_POPOVER_DISMISSAL,
		),
	],
};

// --- Image crop stage (`@crop-stage`) -----------------------------------------------------------

export const CROP_STAGE_DIMENSIONS = {
	viewport: ['narrow', 'mobile', 'tablet', 'desktop'],
	/** The framing the edited target shows before the interaction; `manual` is zoomed in. */
	framing: ['fill', 'fit', 'manual'],
} as const satisfies Dimensions;

export type CropStageState = Combination<typeof CROP_STAGE_DIMENSIONS>;

export type CropStageOutcome =
	/** The crop window stays whole inside the stage, and the stage inside the dialog. */
	| 'window-inside-stage'
	/** The photo follows the pointer at the same zoom, and the target becomes Manual. */
	| 'pans-with-pointer'
	/** The photo zooms in while the point under the fingers or pointer stays put; Manual. */
	| 'zooms-around-point'
	/** The photo zooms in around the window centre, and the target becomes Manual. */
	| 'zooms-in-and-promotes'
	/** One arrow press moves the photo along that axis only, at the same zoom. */
	| 'pans-one-step'
	/** With Shift, one press moves the photo further than without it. */
	| 'pans-larger-step'
	/** The photo is centred in the window again. */
	| 'recenters'
	/** The photo's top-left corner meets the window's top-left corner. */
	| 'aligns-to-corner'
	/** The photo point picked on the minimap moves to the window centre. */
	| 'centres-on-picked-point';

const CROP_WINDOW =
	'DECISIONS 2026-10-23 (#533): „Both image editors use one fixed-window stage", „the photo pans and zooms behind it", „any pan or zoom promotes that target or slot to Manual"';
const CROP_CONTROLS =
	'DECISIONS 2026-10-23: „The crop stage is keyboard operable (arrows pan, Shift for larger steps, +/− zoom, 0 recenters) alongside drag, wheel and pinch around the pointer, a navigator minimap and a 3×3 alignment pad"';

const cropStageCapability = capabilityFactory<typeof CROP_STAGE_DIMENSIONS, CropStageOutcome>();
const cropDesktop = { viewport: ['desktop'] } as const;
const cropPhone = { viewport: ['mobile'] } as const;
/** Fill and Manual leave room to pan; Fit already shows the whole photo. */
const pannable = { fill: 'pans-with-pointer', manual: 'pans-with-pointer' } as const;
/** Fill and Manual keep the anchor; Fit centres the letterboxed axis while zooming in. */
const anchoredZoom = { fill: 'zooms-around-point', manual: 'zooms-around-point' } as const;

/**
 * The crop stage in Nastavení seznamu → Obrázek. The gift editor mounts the same stage
 * (`ImageCropStage.svelte`), so only the wishlist editor runs here; nothing is saved.
 */
export const CROP_STAGE_SURFACE: Surface<typeof CROP_STAGE_DIMENSIONS, CropStageOutcome> = {
	surfaceTag: '@crop-stage',
	name: 'Image crop stage',
	sampling: 'pairwise',
	dimensions: CROP_STAGE_DIMENSIONS,
	outcomeDimension: 'framing',
	isPossibleState: () => true,
	requirementSources: [CROP_WINDOW, CROP_CONTROLS],
	capabilities: [
		cropStageCapability(
			'stage at rest',
			'layout',
			'none',
			{ framing: ['fill'] },
			{ fill: 'window-inside-stage' },
			CROP_WINDOW,
		),
		cropStageCapability(
			'mouse drag the photo',
			'gesture',
			'mouse',
			cropDesktop,
			pannable,
			`${CROP_WINDOW}; ${CROP_CONTROLS}`,
		),
		cropStageCapability(
			'touch drag the photo',
			'gesture',
			'touch',
			cropPhone,
			pannable,
			`${CROP_WINDOW}; ${CROP_CONTROLS}`,
		),
		cropStageCapability(
			'pinch out over the photo',
			'gesture',
			'touch',
			cropPhone,
			anchoredZoom,
			CROP_CONTROLS,
		),
		cropStageCapability(
			'wheel up over the photo',
			'scroll',
			'mouse',
			cropDesktop,
			anchoredZoom,
			CROP_CONTROLS,
		),
		cropStageCapability(
			'+ on the stage',
			'keyboard',
			'keyboard',
			cropDesktop,
			{ fill: 'zooms-in-and-promotes', fit: 'zooms-in-and-promotes' },
			`${CROP_WINDOW}; ${CROP_CONTROLS}`,
		),
		cropStageCapability(
			'ArrowRight on the stage',
			'keyboard',
			'keyboard',
			cropDesktop,
			{ manual: 'pans-one-step' },
			CROP_CONTROLS,
		),
		cropStageCapability(
			'Shift+ArrowRight on the stage',
			'keyboard',
			'keyboard',
			cropDesktop,
			{ manual: 'pans-larger-step' },
			CROP_CONTROLS,
		),
		cropStageCapability(
			'0 on the stage',
			'keyboard',
			'keyboard',
			cropDesktop,
			{ manual: 'recenters' },
			CROP_CONTROLS,
		),
		cropStageCapability(
			'press top-left on the pad',
			'gesture',
			'pointer',
			{ viewport: ['mobile', 'desktop'] },
			{ manual: 'aligns-to-corner' },
			CROP_CONTROLS,
		),
		cropStageCapability(
			'press the minimap',
			'gesture',
			'mouse',
			cropDesktop,
			{ manual: 'centres-on-picked-point' },
			CROP_CONTROLS,
		),
	],
};

// --- Display control (`@display-sheet`) ---------------------------------------------------------

export const DISPLAY_SHEET_DIMENSIONS = {
	viewport: ['mobile', 'desktop'],
	/** The Display section the interaction reaches: sorting, grouping or filters. */
	section: ['sort', 'grouping', 'filter'],
} as const satisfies Dimensions;

export type DisplaySheetState = Combination<typeof DISPLAY_SHEET_DIMENSIONS>;

export type DisplaySheetOutcome =
	/** One sheet titled Možnosti zobrazení opens on the Sort section. */
	| 'opens-labeled-sheet'
	/** The same open sheet shows the chosen section; it never closes and reopens. */
	| 'switches-in-place'
	/** The section opens beside its still-visible parent; each Escape closes one layer. */
	| 'cascades-and-closes-one-layer'
	/** One press closes Display and opens More. */
	| 'swaps-menus-in-one-press'
	/** With a filter active, the Filter section offers Reset and no active-filter pills; Reset clears it. */
	| 'resets-filters';

const MOBILE_DISPLAY_SHEET =
	'DECISIONS 2026-09-04: „Mobile Display is one stable, labeled bottom sheet switching sort/group/filter sections in place"';
const MOBILE_FILTER_RESET =
	'DECISIONS 2026-10-26: „The mobile Display sheet offers Reset next to its Filter selector, without active-filter pills"';
const DESKTOP_DISPLAY_MENUS =
	'DECISIONS 2026-09-10: „Desktop Display/bulk categories use adjacent cascading dropdowns with their parent menus still visible"; „Switching an available sibling control closes the old surface and opens the new one in one action"';

const displaySheetCapability = capabilityFactory<
	typeof DISPLAY_SHEET_DIMENSIONS,
	DisplaySheetOutcome
>();

/**
 * The combined Display control in the wishlist toolbar of a list the user manages. Menu placement
 * at viewport edges belongs to tests/release/dropdown-viewport.spec.ts and sheet paint order to
 * tests/release/mobile-wishlist-sheets.spec.ts.
 */
export const DISPLAY_SHEET_SURFACE: Surface<typeof DISPLAY_SHEET_DIMENSIONS, DisplaySheetOutcome> =
	{
		surfaceTag: '@display-sheet',
		name: 'Display control',
		sampling: 'pairwise',
		dimensions: DISPLAY_SHEET_DIMENSIONS,
		isPossibleState: () => true,
		requirementSources: [MOBILE_DISPLAY_SHEET, MOBILE_FILTER_RESET, DESKTOP_DISPLAY_MENUS],
		capabilities: [
			displaySheetCapability(
				'tap Display',
				'gesture',
				'touch',
				{ viewport: ['mobile'], section: ['sort'] },
				{ all: 'opens-labeled-sheet' },
				MOBILE_DISPLAY_SHEET,
			),
			displaySheetCapability(
				'tap a section switch in the sheet',
				'gesture',
				'touch',
				{ viewport: ['mobile'], section: ['grouping', 'filter'] },
				{ all: 'switches-in-place' },
				MOBILE_DISPLAY_SHEET,
			),
			displaySheetCapability(
				'tap Reset after choosing a filter',
				'gesture',
				'touch',
				{ viewport: ['mobile'], section: ['filter'] },
				{ all: 'resets-filters' },
				MOBILE_FILTER_RESET,
			),
			displaySheetCapability(
				'ArrowRight into a section, then Escape twice',
				'keyboard',
				'keyboard',
				{ viewport: ['desktop'] },
				{ all: 'cascades-and-closes-one-layer' },
				DESKTOP_DISPLAY_MENUS,
			),
			displaySheetCapability(
				'click More while Display is open',
				'gesture',
				'mouse',
				{ viewport: ['desktop'], section: ['sort'] },
				{ all: 'swaps-menus-in-one-press' },
				DESKTOP_DISPLAY_MENUS,
			),
		],
	};
