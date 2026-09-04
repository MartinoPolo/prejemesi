<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		GiftOverlayKind,
		GiftStateOverlayModel,
	} from '$lib/modules/gifts/gift_display_state.js';
	import { cn } from '$lib/utils.js';

	interface GiftStateOverlayProps {
		model: GiftStateOverlayModel | null;
		topRightAction?: boolean;
		class?: string;
	}

	let { model, topRightAction = false, class: className }: GiftStateOverlayProps = $props();

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
			'pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center justify-center',
			topRightAction ? 'right-12' : 'right-0',
			className,
		)}
		data-testid="gift-state-overlay"
	>
		<span
			class={cn(
				'flex min-w-0 max-w-full -rotate-3 flex-col items-center rounded-panel border-2 border-ink px-1 py-1.5 text-center text-xs font-extrabold shadow-sticker',
				model.kind === 'own-reservation' && 'bg-reserved text-white',
				model.kind === 'unavailable' && 'bg-ink text-background',
				model.kind === 'partial' && 'bg-card text-foreground',
				model.kind === 'received' && 'bg-primary text-primary-foreground',
			)}
		>
			<span class="max-w-full [overflow-wrap:anywhere]">{primaryLabel}</span>
			{#if supportLabel !== null}
				<small
					data-reservation-support
					class="max-w-full font-semibold [overflow-wrap:anywhere]">{supportLabel}</small
				>
			{/if}
		</span>
	</div>
{/if}
