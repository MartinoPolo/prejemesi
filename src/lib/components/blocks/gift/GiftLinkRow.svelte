<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import XIcon from '@lucide/svelte/icons/x';
	import type { GiftLink } from '$lib/modules/gifts/types.js';

	interface GiftLinkRowProps {
		link: GiftLink;
		isPrimary: boolean;
		isOnly: boolean;
		canMoveUp: boolean;
		canMoveDown: boolean;
		urlError?: string;
		disabled?: boolean;
		onurlchange: (url: string) => void;
		onlabelchange: (label: string) => void;
		onremove: () => void;
		onmoveup: () => void;
		onmovedown: () => void;
	}

	let {
		link,
		isPrimary,
		isOnly,
		canMoveUp,
		canMoveDown,
		urlError,
		disabled = false,
		onurlchange,
		onlabelchange,
		onremove,
		onmoveup,
		onmovedown,
	}: GiftLinkRowProps = $props();

	const hasUrlError = $derived(urlError != null && urlError !== '');
	// `link.id` is always populated by ensureGiftLinkIds in the editor; fall back to the URL
	// so the describedby target stays stable even for an id-less link.
	const urlErrorId = $derived(
		hasUrlError ? `gift-link-${link.id ?? link.url}-url-error` : undefined,
	);
</script>

<div class="flex flex-col gap-1.5 rounded-md border border-border/60 p-2.5">
	<div class="flex items-center gap-1.5">
		{#if isPrimary}
			<Badge tone="neutral" badgeStyle="subtle" class="shrink-0 text-[10px]">
				{m.gift_link_primary()}
			</Badge>
		{/if}

		<Input
			class="flex-1"
			value={link.url}
			placeholder="alza.cz/darek"
			type="text"
			data-testid="gift-link-url"
			{disabled}
			state={hasUrlError ? 'error' : 'default'}
			aria-invalid={hasUrlError ? true : undefined}
			aria-describedby={urlErrorId}
			oninput={(e: Event) => onurlchange((e.target as HTMLInputElement).value)}
		/>

		{#if !isOnly}
			<div class="flex shrink-0 items-center gap-0.5">
				<Button
					intent="ghost"
					size="icon-sm"
					onclick={onmoveup}
					aria-label={m.gift_link_move_up()}
					disabled={!canMoveUp || disabled}
				>
					<ArrowUpIcon />
				</Button>
				<Button
					intent="ghost"
					size="icon-sm"
					onclick={onmovedown}
					aria-label={m.gift_link_move_down()}
					disabled={!canMoveDown || disabled}
				>
					<ArrowDownIcon />
				</Button>
			</div>
		{/if}

		<Button
			intent="ghost"
			size="icon-sm"
			class="shrink-0 text-muted-foreground hover:text-destructive"
			{disabled}
			onclick={onremove}
			aria-label={m.gift_link_remove()}
		>
			<XIcon />
		</Button>
	</div>

	<Input
		class="text-sm"
		value={link.label ?? ''}
		placeholder={m.gift_link_label_placeholder()}
		type="text"
		{disabled}
		oninput={(e: Event) => onlabelchange((e.target as HTMLInputElement).value)}
	/>

	{#if hasUrlError}
		<span id={urlErrorId} class="text-xs text-destructive">{urlError}</span>
	{/if}
</div>
