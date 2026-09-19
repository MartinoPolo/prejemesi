<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';
	import type { GiftActionPlacementSnapshot } from '$lib/components/blocks/wishlist/gift_context_invocation.js';
	import GiftActionRow from './GiftActionRow.svelte';

	interface Props {
		contentWidth?: number;
		hostWidth?: number;
		persistentMore?: boolean;
		enableMore?: boolean;
		moreOpen?: boolean;
		secondaryLabel?: string;
		primaryLabel?: string;
		onplacementchange?: (overflowActions: readonly GiftContextAction[]) => void;
		onmore?: (anchor: HTMLButtonElement, snapshot: GiftActionPlacementSnapshot) => void;
	}

	let {
		contentWidth,
		hostWidth = contentWidth ?? 260,
		persistentMore = false,
		enableMore = true,
		moreOpen = false,
		secondaryLabel = 'Received',
		primaryLabel = 'Reserve',
		onplacementchange,
		onmore,
	}: Props = $props();
	let secondaryActivated = $state(false);
</script>

<button data-testid="outside-action">Outside</button>
<div style:width={`${hostWidth}px`}>
	{#snippet received()}
		<Button
			data-testid="received-action"
			size="md"
			onclick={() => (secondaryActivated = true)}
			disabled={secondaryActivated}
			data-pending={secondaryActivated}
		>
			{secondaryLabel}{secondaryActivated ? ' pending' : ''}
		</Button>
	{/snippet}
	<GiftActionRow
		{contentWidth}
		{persistentMore}
		secondary={received}
		secondaryAction="received"
		primaryAction="reserve"
		onmore={enableMore ? (onmore ?? (() => {})) : undefined}
		{moreOpen}
		{onplacementchange}
		controlSizing="intrinsic"
	>
		<Button data-testid="reserve-action" size="md">{primaryLabel}</Button>
	</GiftActionRow>
</div>
