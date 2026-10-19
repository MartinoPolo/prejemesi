<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { useNarrowViewportState } from '$lib/components/derived/narrow_viewport_state.svelte.js';
	import AccessGrantRowShell from './AccessGrantRowShell.svelte';
	import {
		accessTokenAbilitySentence,
		accessTokenWishlistLine,
		formatAccessTokenDate,
	} from '$lib/modules/access_tokens/access_token_display.js';
	import { formatRelativeTime } from '$lib/modules/notifications/notification_display.js';
	import type { ConnectedAppSummary } from '$lib/modules/access_tokens/index.js';
	import PlugIcon from '@lucide/svelte/icons/plug';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';

	interface ConnectedAppRowProps {
		app: ConnectedAppSummary;
		onrevoke: (app: ConnectedAppSummary, trigger: HTMLElement) => void;
	}

	let { app, onrevoke }: ConnectedAppRowProps = $props();

	const narrowViewport = useNarrowViewportState();

	const abilitySentence = $derived(
		accessTokenAbilitySentence(app.scopes, app.wishlists?.length ?? null),
	);
</script>

<AccessGrantRowShell data-app-id={app.id} data-testid="connected-app-row">
	{#snippet main()}
		<h4 class="access-grant-name">{app.name}</h4>
		<p class="access-grant-sentence">
			<PlugIcon class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
			<span>{abilitySentence}</span>
		</p>
		<p class="ps-5 text-(length:--text-sm) text-muted-foreground">
			{accessTokenWishlistLine(app.wishlists)}
		</p>

		<ul class="access-grant-meta">
			<li>
				{#if app.verifiedHost === null}
					{m.access_tokens_app_unverified()}
				{:else}
					<ShieldCheckIcon
						class="size-3.25 text-status-success-text"
						aria-hidden="true"
					/>
					<span class="sr-only">
						{m.access_tokens_app_verified_host({ host: app.verifiedHost })}
					</span>
					<code aria-hidden="true">{app.verifiedHost}</code>
				{/if}
			</li>
			<li class="separated">
				{app.lastUsedAt === null
					? m.access_tokens_never_used()
					: m.access_tokens_last_used({ when: formatRelativeTime(app.lastUsedAt) })}
			</li>
			<li class="separated">
				{m.access_tokens_app_connected_on({ date: formatAccessTokenDate(app.createdAt) })}
			</li>
		</ul>
	{/snippet}

	{#snippet actions()}
		<Button
			intent="danger"
			size={narrowViewport.current ? 'lg' : 'sm'}
			aria-label={m.access_tokens_app_revoke_label({ name: app.name })}
			onclick={(event) => onrevoke(app, event.currentTarget)}
		>
			{m.access_tokens_app_revoke()}
		</Button>
	{/snippet}
</AccessGrantRowShell>
