<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { MAX_GIFT_LINKS, type GiftLink } from '$lib/modules/gifts/types.js';

	interface GiftDraftLinksCellProps {
		links: GiftLink[];
		disabled?: boolean;
		onchange: (links: GiftLink[]) => void;
	}

	let { links, disabled = false, onchange }: GiftDraftLinksCellProps = $props();

	const atLimit = $derived(links.length >= MAX_GIFT_LINKS);

	function addLink() {
		if (atLimit) {
			return;
		}
		onchange([...links, { url: '' }]);
	}

	function removeLink(index: number) {
		const next = links.filter((_, i) => i !== index);
		onchange(next);
	}

	function updateLinkUrl(index: number, url: string) {
		const next = links.map((link, i) => (i === index ? { ...link, url } : link));
		onchange(next);
	}
</script>

<div class="flex flex-col gap-1">
	{#each links as link, index (index)}
		<div class="flex items-center gap-1">
			<Input
				value={link.url}
				placeholder={m.batch_add_link_placeholder()}
				class="h-7 min-w-0 flex-1 text-xs"
				{disabled}
				oninput={(event: Event) => {
					const target = event.target as HTMLInputElement;
					updateLinkUrl(index, target.value);
				}}
			/>
			<Button
				size="icon-sm"
				intent="ghost"
				class="size-7 shrink-0"
				{disabled}
				aria-label={m.col_remove()}
				onclick={() => removeLink(index)}
			>
				<XIcon class="size-3.5" />
			</Button>
		</div>
	{/each}

	{#if atLimit}
		<span class="text-2xs text-muted-foreground">{m.batch_add_link_limit()}</span>
	{:else}
		<Button
			size="sm"
			intent="ghost"
			class="h-7 w-fit gap-1 px-2 text-xs"
			{disabled}
			onclick={addLink}
		>
			<PlusIcon class="size-3.5" />
			{m.batch_add_link()}
		</Button>
	{/if}
</div>
