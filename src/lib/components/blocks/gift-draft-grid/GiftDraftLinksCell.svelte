<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import type { GiftLink } from '$lib/modules/gifts/types.js';
	import { MAX_GIFT_LINKS } from '$lib/modules/gifts/types.js';
	import { extractGiftUrlDomain, normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		links: GiftLink[];
		onAddLink: (url: string) => void;
		onRemoveLink: (index: number) => void;
		disabled?: boolean;
	}

	let { links, onAddLink, onRemoveLink, disabled = false }: Props = $props();

	let showInput = $state(false);
	let linkInputValue = $state('');

	function handleAddLinkClick() {
		showInput = true;
	}

	function commitLink() {
		const url = linkInputValue.trim();
		if (url !== '') {
			onAddLink(url);
		}
		linkInputValue = '';
		showInput = false;
	}

	function handleLinkKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitLink();
		} else if (event.key === 'Escape') {
			linkInputValue = '';
			showInput = false;
		}
	}

	function handleLinkBlur() {
		commitLink();
	}

	const atLimit = $derived(links.length >= MAX_GIFT_LINKS);
</script>

<div class="flex flex-col gap-1.5">
	{#each links as link, index (index)}
		<div
			class="flex items-center gap-1.5 rounded border border-border bg-surface px-2 py-1 text-sm"
		>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- external product link -->
			<a
				href={normalizeGiftUrl(link.url) ?? '#'}
				target="_blank"
				rel="external noopener noreferrer"
				class="flex min-w-0 flex-1 items-center gap-1 truncate text-primary hover:underline"
			>
				<ExternalLinkIcon class="size-3.5 shrink-0" />
				<span class="truncate">{extractGiftUrlDomain(link.url) ?? link.url}</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<button
				type="button"
				class="shrink-0 rounded p-0.5 text-foreground-muted hover:bg-surface-hover hover:text-foreground"
				onclick={() => onRemoveLink(index)}
				{disabled}
				aria-label={m.draft_grid_remove_link({
					domain: extractGiftUrlDomain(link.url) ?? link.url,
				})}
			>
				<XIcon class="size-3.5" />
			</button>
		</div>
	{/each}

	{#if showInput}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="url"
			class="rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-ring"
			placeholder="https://..."
			bind:value={linkInputValue}
			onkeydown={handleLinkKeydown}
			onblur={handleLinkBlur}
			autofocus
		/>
	{:else}
		<Button
			intent="ghost"
			size="sm"
			onclick={handleAddLinkClick}
			disabled={disabled || atLimit}
			class="justify-start"
		>
			<PlusIcon data-icon="inline-start" />
			{m.draft_grid_add_link()}
		</Button>
	{/if}
</div>
