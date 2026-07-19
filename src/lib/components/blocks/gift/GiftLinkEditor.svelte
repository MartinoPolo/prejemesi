<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import GiftLinkRow from './GiftLinkRow.svelte';
	import { MAX_GIFT_LINKS, type GiftLink } from '$lib/modules/gifts/types.js';
	import { createGiftLinkId, normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';

	interface GiftLinkEditorProps {
		links: GiftLink[];
		maxLinks?: number;
		disabled?: boolean;
		onlinkschange: (links: GiftLink[]) => void;
	}

	let {
		links,
		maxLinks = MAX_GIFT_LINKS,
		disabled = false,
		onlinkschange,
	}: GiftLinkEditorProps = $props();

	const isAtCap = $derived(links.length >= maxLinks);

	function addLink() {
		if (isAtCap) {
			return;
		}
		onlinkschange([...links, { url: '', id: createGiftLinkId() }]);
	}

	function removeLink(index: number) {
		onlinkschange(links.filter((_, i) => i !== index));
	}

	function moveUp(index: number) {
		if (index <= 0) {
			return;
		}
		const updated = [...links];
		[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
		onlinkschange(updated);
	}

	function moveDown(index: number) {
		if (index >= links.length - 1) {
			return;
		}
		const updated = [...links];
		[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
		onlinkschange(updated);
	}

	function updateUrl(index: number, url: string) {
		const updated = [...links];
		updated[index] = { ...updated[index], url };
		onlinkschange(updated);
	}

	function updateLabel(index: number, label: string) {
		const updated = [...links];
		updated[index] = { ...updated[index], label: label || undefined };
		onlinkschange(updated);
	}

	function urlError(url: string): string | undefined {
		if (url.trim() === '') {
			return undefined;
		}
		if (normalizeGiftUrl(url) === null) {
			return m.draft_grid_link_url_invalid();
		}
		return undefined;
	}
</script>

<div class="flex flex-col gap-2">
	<Label>{m.gift_url_label()}</Label>

	{#if links.length > 0}
		<div class="flex flex-col gap-2">
			{#each links as link, index (link.id ?? index)}
				<GiftLinkRow
					{link}
					isPrimary={index === 0}
					isOnly={links.length === 1}
					canMoveUp={index > 0}
					canMoveDown={index < links.length - 1}
					urlError={urlError(link.url)}
					{disabled}
					onurlchange={(url: string) => updateUrl(index, url)}
					onlabelchange={(label: string) => updateLabel(index, label)}
					onremove={() => removeLink(index)}
					onmoveup={() => moveUp(index)}
					onmovedown={() => moveDown(index)}
				/>
			{/each}
		</div>
	{/if}

	<div class="flex items-center gap-2">
		<Button intent="ghost" size="sm" disabled={isAtCap || disabled} onclick={addLink}>
			<PlusIcon data-icon="inline-start" />
			{m.gift_link_add()}
		</Button>

		{#if isAtCap}
			<span class="text-xs text-muted-foreground">{m.gift_link_max_reached()}</span>
		{:else if links.length >= 5}
			<span class="text-xs text-muted-foreground">
				{m.gift_link_cap_counter({ current: links.length, max: maxLinks })}
			</span>
		{/if}
	</div>
</div>
