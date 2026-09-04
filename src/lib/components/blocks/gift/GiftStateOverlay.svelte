<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		GiftOverlayKind,
		GiftStateOverlayModel,
	} from '$lib/modules/gifts/gift_display_state.js';
	import { cn } from '$lib/utils.js';

	interface GiftStateOverlayProps {
		model: GiftStateOverlayModel | null;
		class?: string;
	}

	let { model, class: className }: GiftStateOverlayProps = $props();

	function label(kind: GiftOverlayKind, state: GiftStateOverlayModel): string {
		switch (kind) {
			case 'received':
				return m.gift_received_badge();
			case 'own-reservation':
				return m.gift_reserved_by_me_overlay();
			case 'unavailable':
				return m.gift_reserved_by_other_overlay();
			case 'partial':
				return m.gift_remaining_capacity({
					remaining: state.remaining ?? 0,
					total: state.total ?? 0,
				});
		}
	}

	const primaryLabel = $derived(model === null ? null : label(model.kind, model));
	const supportLabel = $derived(
		model?.supportKind === undefined ? null : label(model.supportKind, model),
	);
</script>

{#if model !== null}
	<div
		class={cn(
			'pointer-events-none absolute inset-0 z-10 flex items-center justify-center',
			className,
		)}
		data-testid="gift-state-overlay"
	>
		<span
			class={cn(
				'flex w-[calc(100%_-_0.5rem)] max-w-[7.5rem] -rotate-1 flex-col items-center rounded-panel border-2 border-ink px-0.5 text-center text-[11px] leading-[13px] font-extrabold shadow-sticker sm:max-w-[8.25rem]',
				model.kind === 'own-reservation' &&
					'bg-[var(--gift-overlay-own-reservation)] text-white',
				model.kind === 'unavailable' && 'bg-[var(--gift-overlay-unavailable)] text-white',
				model.kind === 'partial' && 'bg-card text-foreground',
				model.kind === 'received' && 'bg-[var(--footer-bg)] text-white',
			)}
		>
			<span
				data-state-primary
				class={cn(
					'max-w-full font-black [overflow-wrap:anywhere]',
					(model.kind !== 'unavailable' || supportLabel !== null) && 'whitespace-nowrap',
				)}>{primaryLabel}</span
			>
			{#if supportLabel !== null}
				<small
					data-reservation-support
					class="max-w-full text-[9px] leading-[11px] font-semibold whitespace-nowrap"
					>{supportLabel}</small
				>
			{/if}
		</span>
	</div>
{/if}
