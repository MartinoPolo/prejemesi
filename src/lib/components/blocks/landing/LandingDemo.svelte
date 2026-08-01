<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import LandingDemoPane from './LandingDemoPane.svelte';
	import { setLandingDemoGiftContexts } from './landing_demo_contexts.js';
	import {
		createLandingDemoGifts,
		createLandingDemoPairGift,
		reserveDemoGift,
		toRecipientView,
	} from './landing_demo_fixtures.js';
	import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';

	/** Which side of the invariant the narrow layout is currently showing. */
	const DEMO_VIEWPOINTS = { gifter: 'gifter', recipient: 'recipient' } as const;

	type DemoViewpoint = (typeof DEMO_VIEWPOINTS)[keyof typeof DEMO_VIEWPOINTS];

	/** A birthday wishlist gets its own warm identity, scoped to this subtree only. */
	const DEMO_PALETTE = 'honey';

	let mobileViewpoint = $state<DemoViewpoint>(DEMO_VIEWPOINTS.gifter);
	// Bits UI's single ToggleGroup writes '' through its bound value on a re-click of the
	// active item; binding a writable $derived lets onValueChange undo that (see GiftViewSwitcher).
	let selectedViewpoint = $derived(mobileViewpoint);

	// The one source of truth for the whole demo. Plain local state: it never leaves the
	// component, never reaches the network, and a reload starts the visitor over.
	const reservedGiftIds = new SvelteSet<string>();

	const demoGifts = $derived(createLandingDemoGifts());
	const gifterGifts = $derived(
		demoGifts.map((gift) =>
			reservedGiftIds.has(gift.id) ? reserveDemoGift(gift, true) : gift,
		),
	);
	const recipientGifts = $derived(demoGifts.map(toRecipientView));

	// The hook above the toggle is a frozen snapshot of one gift, reserved by someone else.
	// `isArchived` is what the product renders for a gift nobody can act on any more, which
	// is exactly the pair's job: show the reservation signal, offer no control.
	const pairGift = $derived(createLandingDemoPairGift());
	const pairGifterGift = $derived(reserveDemoGift(pairGift, false));
	const pairRecipientGift = $derived(toRecipientView(pairGift));

	// Context setup sits after the $derived block (against the usual script ordering)
	// because its closures capture pairGifterGift, which must be declared first.
	setLandingDemoGiftContexts(
		() => [pairGifterGift],
		() => WISHLIST_ROLES.visitor,
	);

	function handleReserve(gift: GiftForVisitor) {
		reservedGiftIds.add(gift.id);
	}

	function handleUnreserve(gift: GiftForVisitor) {
		reservedGiftIds.delete(gift.id);
	}
</script>

<section
	class="bg-stripes scroll-mt-16"
	id="ukazka"
	aria-label={m.landing_demo_section_label()}
	data-testid="landing-demo"
>
	<div class="mx-auto max-w-[var(--content-max-width)] px-4 py-16 md:px-8 md:py-24">
		<div class="mx-auto flex max-w-[640px] flex-col items-center text-center">
			<span class="section-eyebrow">
				<span aria-hidden="true">🎮</span>
				{m.landing_demo_eyebrow()}
			</span>
			<h2 class="section-headline demo-headline">{m.landing_demo_headline()}</h2>
			<p class="mb-4 text-(length:--text-lg) leading-relaxed text-muted-foreground">
				{m.landing_demo_intro()}
			</p>
			<span class="demo-ribbon mb-12" data-testid="landing-demo-badge">
				<span aria-hidden="true">✂️</span>
				{m.landing_demo_badge()}
			</span>
		</div>

		<!-- Scoped palette: the demo wishlist carries its own color identity exactly like a real
		     one, without leaking into the landing shell around it. -->
		<div class="flex min-w-0 flex-col gap-8" data-palette={DEMO_PALETTE}>
			<!-- Mobile hook: the same gift twice, side by side. Labels occupy the first row so
			     both cards still share the gift card's 7-band row subgrid and line up. -->
			<div class="lg:hidden">
				<h3 class="font-heading mb-3 text-center text-[19px] font-semibold">
					{m.landing_demo_pair_title()}
				</h3>
				<div class="grid grid-cols-2 gap-x-3 gap-y-0" data-testid="landing-demo-pair">
					<span class="pair-label mb-2">
						<span aria-hidden="true">👀</span>
						{m.landing_demo_gifter_label()}
					</span>
					<span class="pair-label mb-2">
						<span aria-hidden="true">🙈</span>
						{m.landing_demo_recipient_label()}
					</span>
					<div
						class="row-span-7 grid grid-rows-subgrid gap-y-0"
						data-testid="landing-demo-pair-gifter"
					>
						<GiftCard
							gift={pairGifterGift}
							role={WISHLIST_ROLES.visitor}
							isArchived={true}
						/>
					</div>
					<div
						class="row-span-7 grid grid-rows-subgrid gap-y-0"
						data-testid="landing-demo-pair-recipient"
					>
						<GiftCard gift={pairRecipientGift} role={WISHLIST_ROLES.recipient} />
					</div>
				</div>
				<p
					class="mt-3 text-center text-(length:--text-base) leading-relaxed text-muted-foreground"
				>
					{m.landing_demo_pair_caption()}
				</p>
			</div>

			<!-- Role switch: one pane at a time on narrow screens. -->
			<div class="flex flex-col items-center gap-2 lg:hidden">
				<span class="text-(length:--text-base) font-semibold">
					{m.landing_demo_role_label()}
				</span>
				<ToggleGroup.Root
					type="single"
					bind:value={selectedViewpoint}
					onValueChange={(newValue) => {
						if (newValue === '') {
							selectedViewpoint = mobileViewpoint;
							return;
						}
						mobileViewpoint = newValue as DemoViewpoint;
					}}
					aria-label={m.landing_demo_role_toggle_aria()}
					data-testid="landing-demo-role-toggle"
				>
					<ToggleGroup.Item
						value={DEMO_VIEWPOINTS.gifter}
						data-testid="landing-demo-role-gifter"
					>
						{m.landing_demo_role_gifter()}
					</ToggleGroup.Item>
					<ToggleGroup.Item
						value={DEMO_VIEWPOINTS.recipient}
						data-testid="landing-demo-role-recipient"
					>
						{m.landing_demo_role_recipient()}
					</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>

			<!-- Desktop: both panes at once, driven by the same local state. -->
			<div class="grid min-w-0 gap-6 lg:grid-cols-2">
				<LandingDemoPane
					role={WISHLIST_ROLES.visitor}
					gifts={gifterGifts}
					emoji="👀"
					label={m.landing_demo_gifter_label()}
					hint={m.landing_demo_gifter_hint()}
					{reservedGiftIds}
					testId="landing-demo-pane-gifter"
					onreserve={handleReserve}
					onunreserve={handleUnreserve}
					class={cn(mobileViewpoint !== DEMO_VIEWPOINTS.gifter && 'hidden lg:flex')}
				/>
				<LandingDemoPane
					role={WISHLIST_ROLES.recipient}
					gifts={recipientGifts}
					emoji="🙈"
					label={m.landing_demo_recipient_label()}
					hint={m.landing_demo_recipient_hint()}
					{reservedGiftIds}
					testId="landing-demo-pane-recipient"
					class={cn(mobileViewpoint !== DEMO_VIEWPOINTS.recipient && 'hidden lg:flex')}
				/>
			</div>

			<p
				class="hidden text-center text-(length:--text-lg) leading-relaxed text-muted-foreground lg:block"
				data-testid="landing-demo-note"
			>
				<span aria-hidden="true">🤫</span>
				{m.landing_demo_split_note()}
			</p>
		</div>
	</div>
</section>

<style>
	/* `.section-headline` is unlayered global CSS, so its 48px bottom margin (sized for
	   sections whose headline is the last element of the heading block) outranks any
	   Tailwind margin utility. This section continues with an intro paragraph. */
	.demo-headline {
		margin-bottom: var(--space-4);
	}

	/* Torn-off coupon marking the whole block as a mock-up (REQ-7) */
	.demo-ribbon {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px;
		border: 2px dashed var(--ink);
		border-radius: 999px;
		background: var(--note-tint);
		color: var(--note-ink);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		transform: rotate(-1.5deg);
	}

	.pair-label {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 0;
		font-size: 12.5px;
		font-weight: 700;
		text-align: center;
	}
</style>
