<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Collapsible from '$lib/components/base/collapsible/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button, type ButtonIntent } from '$lib/components/base/button/index.js';
	import { useNarrowViewportState } from '$lib/components/derived/narrow_viewport_state.svelte.js';
	import { cn } from '$lib/utils.js';
	import AccessGrantDetails from './AccessGrantDetails.svelte';
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

<li
	class={cn('access-grant-row', token.expired && 'is-expired', highlighted && 'is-highlighted')}
	data-token-id={token.id}
	data-testid="access-grant-row"
>
	<div class="access-grant-main">
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
	</div>

	<div class="access-grant-actions">
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
	</div>

	<div class="access-grant-disclosure">
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
	</div>
</li>

<style>
	/* A nested sub-panel inside the settings card: the section supplies --access-grant-inset so the
	   7px radius stays parallel to the card's corner, and content lines up with the card's 24px. */
	.access-grant-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'main' 'details' 'action';
		gap: var(--space-2);
		padding: 14px calc(var(--space-6) - var(--access-grant-inset, 0px) - 2px) 12px;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-btn);
		background: var(--card);
		transition: background-color var(--duration-normal) var(--ease-standard);
	}

	.access-grant-row:hover {
		background: var(--panel-hover);
	}

	.access-grant-row.is-highlighted {
		border-color: var(--brand);
		background: color-mix(in oklab, var(--primary) 8%, var(--card));
	}

	.access-grant-row.is-expired {
		--access-grant-text: var(--muted-foreground);
		--access-grant-icon: var(--muted-foreground);

		border-style: dashed;
		background: var(--muted);
	}

	.access-grant-main {
		grid-area: main;
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: var(--space-1);
	}

	.access-grant-name {
		display: -webkit-box;
		min-width: 0;
		overflow: hidden;
		font-size: var(--text-lg);
		font-weight: 600;
		line-height: 1.3;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.access-grant-sentence {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		font-size: var(--text-md);
		font-weight: 500;
	}

	.access-grant-sentence :global(svg) {
		color: var(--access-grant-icon, var(--brand));
	}

	.access-grant-name,
	.access-grant-sentence {
		color: var(--access-grant-text, currentcolor);
	}

	.access-grant-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 2px var(--space-3);
		margin-top: 2px;
		font-size: var(--text-sm);
		color: var(--muted-foreground);
	}

	.access-grant-meta li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.access-grant-meta code {
		padding: 0 var(--space-1);
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--muted);
		color: var(--foreground);
		font-size: var(--text-sm);
	}

	.access-grant-actions {
		grid-area: action;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		place-self: end;
		gap: var(--nested-control-gap);
	}

	.access-grant-disclosure {
		grid-area: details;
		min-width: 0;
	}

	@media (width >= 640px) {
		.access-grant-row {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas: 'main action' 'details details';
			align-items: center;
			gap: 10px var(--space-4);
		}

		.access-grant-actions {
			align-self: center;
		}

		.access-grant-meta {
			column-gap: 0;
		}

		.separated::before {
			content: '·';
			margin: 0 7px;
		}
	}
</style>
