<script lang="ts">
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/base/button/index.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { useNarrowViewportState } from '$lib/components/derived/narrow_viewport_state.svelte.js';
	import WishlistBottomSheet from '$lib/components/blocks/wishlist/WishlistBottomSheet.svelte';
	import WishlistSheetBody from '$lib/components/blocks/wishlist/WishlistSheetBody.svelte';
	import WishlistSheetHeader from '$lib/components/blocks/wishlist/WishlistSheetHeader.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { closeOnOutsidePress } from '$lib/utils/outside_press.js';

	interface Props {
		title: string;
		/** The trigger button; spread `props` onto it so it opens and describes the layer. */
		trigger: Snippet<[{ props: Record<string, unknown>; open: boolean }]>;
		children: Snippet;
	}

	let { title, trigger, children }: Props = $props();

	const narrowViewport = useNarrowViewportState();
	const finePointer = new MediaQuery('(hover: hover) and (pointer: fine)', false);
	const titleId = $props.id();
	let open = $state(false);
	let triggerElement = $state<HTMLElement | null>(null);
	let popoverElement = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!open || narrowViewport.current) {
			return;
		}
		return closeOnOutsidePress(
			() => [popoverElement, triggerElement],
			() => (open = false),
		);
	});
</script>

{#if narrowViewport.current}
	{@render trigger({
		props: {
			'aria-haspopup': 'dialog',
			'aria-expanded': open,
			'data-prevent-gift-card-open': '',
			onclick: () => (open = true),
		},
		open,
	})}
	<Sheet.Root bind:open>
		{#if open}
			<WishlistBottomSheet>
				<WishlistSheetHeader>
					<Sheet.Title>{title}</Sheet.Title>
				</WishlistSheetHeader>
				<WishlistSheetBody>
					<div class="grid gap-3 px-4 pb-2" data-slot="gift-shared-info">
						{@render children()}
					</div>
				</WishlistSheetBody>
				<div class="px-4 pt-1 pb-3">
					<Button
						intent="outline"
						size="lg"
						class="w-full"
						onclick={() => (open = false)}
					>
						{m.close()}
					</Button>
				</div>
			</WishlistBottomSheet>
		{/if}
	</Sheet.Root>
{:else}
	<Popover.Root bind:open>
		<Popover.Trigger bind:ref={triggerElement} openOnHover={finePointer.current}>
			{#snippet child({ props })}
				{@render trigger({
					props: {
						...props,
						'aria-haspopup': 'dialog',
						'data-prevent-gift-card-open': '',
					},
					open,
				})}
			{/snippet}
		</Popover.Trigger>
		<Popover.Content
			bind:ref={popoverElement}
			class="w-80"
			collisionPadding={8}
			role="dialog"
			aria-labelledby={titleId}
			data-prevent-gift-card-open
			data-slot="gift-shared-popover"
		>
			<div class="flex items-center justify-between gap-2">
				<Popover.Label id={titleId}>{title}</Popover.Label>
				<Button
					intent="ghost"
					size="sm"
					format="icon"
					aria-label={m.close()}
					onclick={() => (open = false)}
				>
					<XIcon />
				</Button>
			</div>
			<div class="grid gap-3 px-2 pb-2" data-slot="gift-shared-info">
				{@render children()}
			</div>
		</Popover.Content>
	</Popover.Root>
{/if}
