<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Collapsible from '$lib/components/base/collapsible/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button, type ButtonIntent } from '$lib/components/base/button/index.js';
	import { useNarrowViewportState } from '$lib/components/derived/narrow_viewport_state.svelte.js';
	import { cn } from '$lib/utils.js';
	import AccessGrantDetails from './AccessGrantDetails.svelte';
	import AccessGrantRowShell from './AccessGrantRowShell.svelte';
	import {
		accessTokenAbilitySentence,
		accessTokenWishlistLine,
		formatAccessTokenDate,
		isAccessTokenExpiringSoon,
	} from '$lib/modules/access_tokens/access_token_display.js';
	import { formatRelativeTime } from '$lib/modules/notifications/notification_display.js';
	import type { AccessTokenSummary } from '$lib/modules/access_tokens/index.js';
	import BotIcon from '@lucide/svelte/icons/bot';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ZapIcon from '@lucide/svelte/icons/zap';

	interface AccessGrantRowProps {
		token: AccessTokenSummary;
		/** Marks a just created or regenerated token. */
		highlighted?: boolean;
		onregenerate: (token: AccessTokenSummary, trigger: HTMLElement) => void;
		/** Revokes an active token, or removes an expired one. */
		onrevoke: (token: AccessTokenSummary, trigger: HTMLElement) => void;
	}

	let { token, highlighted = false, onregenerate, onrevoke }: AccessGrantRowProps = $props();

	const narrowViewport = useNarrowViewportState();

	let detailsOpen = $state(false);

	const actionSize = $derived(narrowViewport.current ? 'lg' : 'sm');
	const expiryDate = $derived(formatAccessTokenDate(token.expiresAt));
	const expiringSoon = $derived(isAccessTokenExpiringSoon(token));
	const abilitySentence = $derived(
		accessTokenAbilitySentence(token.scopes, token.wishlists?.length ?? null),
	);
</script>

{#snippet regenerateButton(intent: ButtonIntent)}
	<Button
		{intent}
		size={actionSize}
		aria-label={m.access_tokens_regenerate_label({ name: token.name })}
		onclick={(event) => onregenerate(token, event.currentTarget)}
	>
		<RefreshCwIcon data-icon="inline-start" />
		{m.access_tokens_regenerate()}
	</Button>
{/snippet}

<AccessGrantRowShell
	expired={token.expired}
	{highlighted}
	data-token-id={token.id}
	data-testid="access-grant-row"
>
	{#snippet main()}
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
			<h4 class="access-grant-name">{token.name}</h4>
			{#if token.fastForward && !token.expired}
				<Badge tone="warning">
					{#snippet icon()}<ZapIcon class="size-3" data-icon />{/snippet}
					{m.access_tokens_fast_forward()}
				</Badge>
			{/if}
			{#if token.expired}
				<Badge tone="danger">{m.access_tokens_expired_badge()}</Badge>
			{/if}
		</div>

		{#if token.expired}
			<p
				class="flex items-start gap-1.5 text-(length:--text-sm) font-semibold text-status-danger-text"
			>
				<TriangleAlertIcon class="mt-px size-3.5 shrink-0" aria-hidden="true" />
				<span>{m.access_tokens_expired_note({ date: expiryDate })}</span>
			</p>
		{/if}

		<p class="access-grant-sentence">
			<BotIcon class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
			<span>{abilitySentence}</span>
		</p>
		<p class="ps-5 text-(length:--text-sm) text-muted-foreground">
			{accessTokenWishlistLine(token.wishlists)}
		</p>

		<ul class="access-grant-meta">
			<li>
				<span class="sr-only">{m.access_tokens_prefix_label()}</span>
				<code>{token.prefix}…</code>
			</li>
			<li class="separated">
				{token.lastUsedAt === null
					? m.access_tokens_never_used()
					: m.access_tokens_last_used({ when: formatRelativeTime(token.lastUsedAt) })}
			</li>
			{#if token.expired}
				<li class="separated">{m.access_tokens_expired_on({ date: expiryDate })}</li>
			{:else if expiringSoon}
				<li class="separated font-bold text-status-warning-text" title={expiryDate}>
					<ClockIcon class="size-3.25" aria-hidden="true" />
					{m.access_tokens_expires_on({ date: formatRelativeTime(token.expiresAt) })}
				</li>
			{:else}
				<li class="separated">{m.access_tokens_expires_on({ date: expiryDate })}</li>
			{/if}
			<li class="separated">
				{token.rolledAt === null
					? m.access_tokens_created_on({ date: formatAccessTokenDate(token.createdAt) })
					: m.access_tokens_rolled_on({ date: formatAccessTokenDate(token.rolledAt) })}
			</li>
		</ul>
	{/snippet}

	{#snippet actions()}
		{#if token.expired}
			<Button
				intent="secondary"
				size={actionSize}
				aria-label={m.access_tokens_remove_label({ name: token.name })}
				onclick={(event) => onrevoke(token, event.currentTarget)}
			>
				{m.access_tokens_remove()}
			</Button>
			{@render regenerateButton('primary')}
		{:else}
			{@render regenerateButton('secondary')}
			<Button
				intent="danger"
				size={actionSize}
				aria-label={m.access_tokens_revoke_label({ name: token.name })}
				onclick={(event) => onrevoke(token, event.currentTarget)}
			>
				{m.access_tokens_revoke()}
			</Button>
		{/if}
	{/snippet}

	{#snippet details()}
		<Collapsible.Root bind:open={detailsOpen}>
			<Collapsible.Trigger
				class="-ms-1 inline-flex items-center gap-1 rounded-[5px] px-1 py-0.5 text-(length:--text-sm) font-semibold text-brand-link outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				{m.access_tokens_details()}
				<ChevronDownIcon
					class={cn(
						'size-3.5 transition-transform duration-(--duration-normal) motion-reduce:transition-none',
						detailsOpen && 'rotate-180',
					)}
					aria-hidden="true"
				/>
			</Collapsible.Trigger>
			<Collapsible.Content>
				<AccessGrantDetails {token} class="mt-2 border-t-2 border-ink-faint pt-2.5" />
			</Collapsible.Content>
		</Collapsible.Root>
	{/snippet}
</AccessGrantRowShell>
