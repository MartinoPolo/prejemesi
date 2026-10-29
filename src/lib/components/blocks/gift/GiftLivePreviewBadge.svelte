<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import {
		GIFT_LIVE_PREVIEW,
		type GiftLivePreviewKind,
	} from '$lib/components/blocks/change-proposals/change_row_model.js';
	import { cn } from '$lib/utils.js';

	/** Marks a gift the chat would change; only the user deciding the proposal sees the preview. */
	let { kind, class: className }: { kind: GiftLivePreviewKind; class?: string } = $props();
</script>

<span
	class={cn('live-preview-badge', className)}
	data-kind={kind}
	data-testid="gift-live-preview-badge"
>
	{#if kind === GIFT_LIVE_PREVIEW.deletion}
		<Trash2Icon aria-hidden="true" />{m.gift_live_preview_deletion()}
	{:else}
		<SparklesIcon aria-hidden="true" />{m.gift_live_preview_proposed()}<span class="sr-only"
			>{m.gift_live_preview_only_you()}</span
		>
	{/if}
</span>

<style>
	.live-preview-badge {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border: 2px solid var(--ink);
		border-radius: var(--radius-badge);
		background: var(--card);
		box-shadow: var(--elevation-compact);
		color: var(--brand-link);
		font-size: var(--text-xs);
		font-weight: 800;
		white-space: nowrap;
	}

	.live-preview-badge[data-kind='deletion'] {
		color: var(--status-danger-text);
	}

	.live-preview-badge :global(svg) {
		width: 12px;
		height: 12px;
	}
</style>
