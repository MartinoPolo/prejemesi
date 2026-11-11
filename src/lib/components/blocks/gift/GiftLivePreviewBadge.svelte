<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Badge } from '$lib/components/base/badge/index.js';
	import {
		GIFT_LIVE_PREVIEW,
		type GiftLivePreviewKind,
	} from '$lib/components/blocks/change-proposals/change_row_model.js';
	import { cn } from '$lib/utils.js';

	/** Marks a gift the chat would change; only the user deciding the proposal sees the preview. */
	let { kind, class: className }: { kind: GiftLivePreviewKind; class?: string } = $props();
</script>

<Badge
	tone={kind === GIFT_LIVE_PREVIEW.deletion ? 'danger' : 'info'}
	class={cn('shrink-0', className)}
	data-kind={kind}
	data-testid="gift-live-preview-badge"
>
	{#snippet icon()}
		{#if kind === GIFT_LIVE_PREVIEW.deletion}
			<Trash2Icon class="size-3" data-icon aria-hidden="true" />
		{:else}
			<SparklesIcon class="size-3" data-icon aria-hidden="true" />
		{/if}
	{/snippet}
	{#if kind === GIFT_LIVE_PREVIEW.deletion}
		{m.gift_live_preview_deletion()}
	{:else}
		{m.gift_live_preview_proposed()}<span class="sr-only">{m.gift_live_preview_only_you()}</span
		>
	{/if}
</Badge>
