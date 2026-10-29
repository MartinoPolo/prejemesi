<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import { TextLink } from '$lib/components/base/text-link/index.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import AccessGrantRow from '$lib/components/blocks/access-tokens/AccessGrantRow.svelte';
	import AccessTokenDialog, {
		type AccessTokenReveal,
	} from '$lib/components/blocks/access-tokens/AccessTokenDialog.svelte';
	import TokenRegenerateDialog from '$lib/components/blocks/access-tokens/TokenRegenerateDialog.svelte';
	import ConnectedAppRow from '$lib/components/blocks/access-tokens/ConnectedAppRow.svelte';
	import { getApplicationUrl } from '$lib/config/site.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { accessTokenCountLabel } from '$lib/modules/access_tokens/access_token_display.js';
	import {
		createAccessToken,
		getAccessTokens,
		getConnectedApps,
		revokeAccessToken,
		revokeConnectedApp,
		rollAccessToken,
		type AccessTokenExpiryPresetDays,
		type AccessTokenSummary,
		type ConnectedAppSummary,
	} from '$lib/modules/access_tokens/index.js';
	import type { CreateAccessTokenInput } from '$lib/modules/access_tokens/types.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import InfoIcon from '@lucide/svelte/icons/info';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import PlugIcon from '@lucide/svelte/icons/plug';
	import PlusIcon from '@lucide/svelte/icons/plus';

	interface SettingsAccessSectionProps {
		/** Demo accounts see the section but cannot create tokens. */
		demo: boolean;
	}

	type RevokeTarget =
		| { kind: 'token'; token: AccessTokenSummary }
		| { kind: 'app'; app: ConnectedAppSummary };

	const SKELETON_ROW_COUNT = 3;
	const HIGHLIGHT_DURATION_MILLISECONDS = 2400;

	let { demo }: SettingsAccessSectionProps = $props();

	let section = $state<HTMLDivElement | null>(null);
	let tokenDialogOpen = $state(false);
	let revealed = $state<AccessTokenReveal | null>(null);
	let highlightedTokenId = $state<string | null>(null);
	let regenerateTarget = $state<AccessTokenSummary | null>(null);
	let regenerateOpen = $state(false);
	let regenerateSession = $state(0);
	let revokeTarget = $state<RevokeTarget | null>(null);
	let revokeOpen = $state(false);
	let revokePending = $state(false);
	let focusAfterRevoke: HTMLElement | null = null;
	let revokeCompleted = false;

	const tokensQuery = $derived(demo ? null : getAccessTokens());
	const tokens = $derived(tokensQuery?.current);
	const tokensEmpty = $derived(tokens !== undefined && tokens.length === 0);
	const appsQuery = $derived(demo ? null : getConnectedApps());
	const apps = $derived(appsQuery?.current);
	const apiBaseUrl = $derived(getApplicationUrl('/api/v1', page.url.origin));
	const revokeCopy = $derived(
		revokeTarget?.kind === 'app'
			? {
					title: m.access_tokens_app_revoke_title({ name: revokeTarget.app.name }),
					description: m.access_tokens_app_revoke_description(),
					confirm: m.access_tokens_app_revoke_confirm(),
					pending: m.access_tokens_app_revoking(),
				}
			: {
					title: m.access_tokens_revoke_title({ name: revokeTarget?.token.name ?? '' }),
					description: m.access_tokens_revoke_description(),
					confirm: m.access_tokens_revoke_confirm(),
					pending: m.access_tokens_revoking(),
				},
	);

	function rowActionFor(tokenId: string): HTMLElement | null {
		return (
			section?.querySelector<HTMLElement>(
				`[data-token-id="${CSS.escape(tokenId)}"] button`,
			) ?? null
		);
	}

	/** The control to focus once a row disappears: a neighbouring row, else the section's first. */
	function focusTargetAfterRemoving(trigger: HTMLElement): HTMLElement | null {
		const row = trigger.closest('[data-token-id], [data-app-id]');
		const neighbour = row?.nextElementSibling ?? row?.previousElementSibling;
		return neighbour?.querySelector<HTMLElement>('button') ?? null;
	}

	async function focusAfterRemoval(target: HTMLElement | null) {
		await tick();
		const fallback = section?.querySelector<HTMLElement>('button:not([disabled])') ?? null;
		(target !== null && target.isConnected ? target : fallback)?.focus();
	}

	function openCreateDialog() {
		revealed = null;
		tokenDialogOpen = true;
	}

	async function createToken(input: CreateAccessTokenInput) {
		try {
			const created = await createAccessToken(input);
			highlightedTokenId = created.token.id;
			revealed = { created, replacedPrefix: null };
		} catch (error) {
			toastError(translateServerError(error, m.access_tokens_create_error()));
		}
	}

	function handleTokenDialogClosed() {
		if (revealed !== null) {
			toastSuccess(
				revealed.replacedPrefix === null
					? m.access_tokens_created_toast()
					: m.access_tokens_regenerated_toast(),
			);
		}
		revealed = null;
	}

	function openRegenerateDialog(token: AccessTokenSummary) {
		regenerateTarget = token;
		regenerateSession += 1;
		regenerateOpen = true;
	}

	async function regenerateToken(
		token: AccessTokenSummary,
		expiryDays: AccessTokenExpiryPresetDays,
	) {
		try {
			const created = await rollAccessToken({ tokenId: token.id, expiryDays });
			highlightedTokenId = created.token.id;
			revealed = { created, replacedPrefix: token.prefix };
			regenerateOpen = false;
			tokenDialogOpen = true;
		} catch (error) {
			toastError(translateServerError(error, m.access_tokens_regenerate_error()));
		}
	}

	async function requestRevoke(token: AccessTokenSummary, trigger: HTMLElement) {
		focusAfterRevoke = focusTargetAfterRemoving(trigger);
		revokeCompleted = false;
		if (!token.expired) {
			revokeTarget = { kind: 'token', token };
			revokeOpen = true;
			return;
		}
		// An expired token no longer grants anything, so removing it needs no confirmation.
		try {
			await revokeAccessToken({ tokenId: token.id });
			toastSuccess(m.access_tokens_removed_toast());
			await focusAfterRemoval(focusAfterRevoke);
		} catch (error) {
			toastError(translateServerError(error, m.access_tokens_revoke_error()));
		}
	}

	function requestAppRevoke(app: ConnectedAppSummary, trigger: HTMLElement) {
		focusAfterRevoke = focusTargetAfterRemoving(trigger);
		revokeCompleted = false;
		revokeTarget = { kind: 'app', app };
		revokeOpen = true;
	}

	async function confirmRevoke() {
		if (revokeTarget === null) {
			return;
		}
		const target = revokeTarget;
		revokePending = true;
		try {
			if (target.kind === 'app') {
				await revokeConnectedApp({ grantId: target.app.id });
			} else {
				await revokeAccessToken({ tokenId: target.token.id });
			}
			revokeCompleted = true;
			revokeOpen = false;
			toastSuccess(
				target.kind === 'app'
					? m.access_tokens_app_revoked_toast()
					: m.access_tokens_revoked_toast(),
			);
		} catch (error) {
			toastError(
				translateServerError(
					error,
					target.kind === 'app'
						? m.access_tokens_app_revoke_error()
						: m.access_tokens_revoke_error(),
				),
			);
		} finally {
			revokePending = false;
		}
	}

	$effect(() => {
		if (highlightedTokenId === null || tokenDialogOpen) {
			return;
		}
		const timer = setTimeout(() => {
			highlightedTokenId = null;
		}, HIGHLIGHT_DURATION_MILLISECONDS);
		return () => clearTimeout(timer);
	});
</script>

{#snippet tokenStates(tokenList: AccessTokenSummary[] | undefined)}
	{#if tokensQuery?.error}
		<p class="nested-panel error-panel" role="alert">{m.access_tokens_load_error()}</p>
	{:else if tokenList === undefined}
		<div class="flex flex-col gap-2" aria-busy="true">
			<span class="sr-only" role="status">{m.access_tokens_loading()}</span>
			{#each Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => index) as index (index)}
				<div class="nested-panel skeleton-panel" aria-hidden="true">
					<Skeleton class="h-4 w-1/2" />
					<Skeleton class="h-3 w-3/5" />
					<Skeleton class="h-3 w-1/3" />
				</div>
			{/each}
		</div>
	{:else if tokenList.length === 0}
		<div class="nested-panel empty-panel">
			<h4 class="text-(length:--text-lg) font-semibold">{m.access_tokens_empty_title()}</h4>
			<p class="empty-description">{m.access_tokens_empty_description()}</p>
			<Button class="mt-2.5 w-full sm:w-auto" onclick={openCreateDialog}>
				<PlusIcon data-icon="inline-start" />
				{m.access_tokens_create()}
			</Button>
		</div>
	{:else}
		<ul class="flex flex-col gap-2" aria-label={m.access_tokens_tokens_heading()}>
			{#each tokenList as token (token.id)}
				<AccessGrantRow
					{token}
					highlighted={token.id === highlightedTokenId}
					onregenerate={openRegenerateDialog}
					onrevoke={requestRevoke}
				/>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet appStates(appList: ConnectedAppSummary[] | undefined)}
	{#if demo}
		<div class="nested-panel placeholder-panel">
			<PlugIcon class="mt-px size-4.5 shrink-0" aria-hidden="true" />
			<p>{m.access_tokens_apps_demo()}</p>
		</div>
	{:else if appsQuery?.error}
		<p class="nested-panel error-panel" role="alert">{m.access_tokens_apps_load_error()}</p>
	{:else if appList === undefined}
		<div class="nested-panel skeleton-panel" aria-busy="true">
			<span class="sr-only" role="status">{m.access_tokens_apps_loading()}</span>
			<Skeleton class="h-4 w-1/2" aria-hidden="true" />
			<Skeleton class="h-3 w-3/5" aria-hidden="true" />
		</div>
	{:else if appList.length === 0}
		<div class="nested-panel placeholder-panel">
			<PlugIcon class="mt-px size-4.5 shrink-0" aria-hidden="true" />
			<p>{m.access_tokens_apps_empty()}</p>
		</div>
	{:else}
		<ul class="flex flex-col gap-2" aria-label={m.access_tokens_apps_heading()}>
			{#each appList as app (app.id)}
				<ConnectedAppRow {app} onrevoke={requestAppRevoke} />
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet tokenGroup()}
	<div class="group-head">
		<h3>{m.access_tokens_tokens_heading()}</h3>
		{#if tokens !== undefined && tokens.length > 0}
			<span class="text-(length:--text-sm) text-muted-foreground">
				{accessTokenCountLabel(tokens)}
			</span>
		{/if}
	</div>
	{@render tokenStates(tokens)}
{/snippet}

{#snippet revokeDialog()}
	<Dialog.Root
		bind:open={
			() => revokeOpen,
			(nextOpen) => {
				if (!revokePending) {
					revokeOpen = nextOpen;
				}
			}
		}
	>
		<Dialog.Content
			size="md"
			showCloseButton={false}
			data-testid="access-token-revoke-dialog"
			onCloseAutoFocus={(event) => {
				// The opening row is gone after a revoke, so focus moves to a neighbour instead.
				if (revokeCompleted) {
					event.preventDefault();
					void focusAfterRemoval(focusAfterRevoke);
				}
			}}
		>
			<Dialog.Header>
				<Dialog.Title>
					{revokeCopy.title}
				</Dialog.Title>
				<Dialog.Description class="text-(length:--text-base) text-foreground">
					{revokeCopy.description}
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button
					intent="secondary"
					disabled={revokePending}
					onclick={() => (revokeOpen = false)}
				>
					{m.access_tokens_back()}
				</Button>
				<Button
					intent="primary-destructive"
					disabled={revokePending}
					onclick={confirmRevoke}
				>
					{#if revokePending}
						<LoaderIcon class="animate-spin" data-icon="inline-start" />
						{revokeCopy.pending}
					{:else}
						{revokeCopy.confirm}
					{/if}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/snippet}

<Card.Root
	bind:ref={section}
	class="gap-5 pb-(--access-grant-inset) [--access-grant-inset:calc(var(--radius-panel)-var(--border-w)-var(--radius-btn))] [--access-text-inset:calc(var(--space-6)-var(--access-grant-inset))]"
	data-testid="settings-access-section"
>
	<Card.Header>
		<div class="access-head">
			<KeyRoundIcon
				class="mt-1 size-5 text-muted-foreground [grid-area:icon]"
				aria-hidden="true"
			/>
			<div class="access-head-text">
				<Card.Title role="heading" aria-level={2}>{m.access_tokens_title()}</Card.Title>
				<Card.Description class="max-w-104">
					{m.access_tokens_description()}
				</Card.Description>
				<p class="mt-2 flex items-center gap-1.25 text-brand-link">
					<BookOpenIcon class="size-3.5 shrink-0" aria-hidden="true" />
					<TextLink href={resolve('/api/v1/openapi.json')} size="sm">
						{m.access_tokens_docs_link()}
					</TextLink>
				</p>
			</div>
			{#if !tokensEmpty}
				<div class="access-head-action">
					<Button
						class="w-full sm:w-auto"
						disabled={demo}
						aria-describedby={demo ? 'access-tokens-demo-note' : undefined}
						onclick={openCreateDialog}
					>
						<PlusIcon data-icon="inline-start" />
						{m.access_tokens_create()}
					</Button>
				</div>
			{/if}
		</div>
	</Card.Header>

	<Card.Content class="flex flex-col px-(--access-grant-inset)">
		{#if demo}
			<div class="nested-panel demo-panel">
				<InfoIcon class="mt-px size-4.5 shrink-0 text-brand-link" aria-hidden="true" />
				<p id="access-tokens-demo-note">{m.access_tokens_demo()}</p>
			</div>
		{:else}
			{@render tokenGroup()}
		{/if}

		<Separator
			class="mx-(--access-text-inset) mt-4.5 mb-4 data-[orientation=horizontal]:w-auto"
		/>
		<div class="group-head">
			<h3>{m.access_tokens_apps_heading()}</h3>
		</div>
		{@render appStates(apps)}
	</Card.Content>
</Card.Root>

{#if !demo}
	<AccessTokenDialog
		bind:open={tokenDialogOpen}
		{revealed}
		{apiBaseUrl}
		oncreate={createToken}
		onclosed={handleTokenDialogClosed}
		closeFocusTarget={() =>
			revealed === null ? null : rowActionFor(revealed.created.token.id)}
	/>

	{#if regenerateTarget !== null}
		{@const target = regenerateTarget}
		{#key regenerateSession}
			<TokenRegenerateDialog
				bind:open={regenerateOpen}
				token={target}
				onconfirm={(expiryDays) => regenerateToken(target, expiryDays)}
			/>
		{/key}
	{/if}

	{@render revokeDialog()}
{/if}

<style>
	.access-head {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-areas: 'icon text' 'action action';
		align-items: start;
		gap: var(--space-4) var(--space-2);
	}

	.access-head-text {
		grid-area: text;
		min-width: 0;
	}

	.access-head-action {
		grid-area: action;
	}

	/* Group headings and panels inside the inset body keep their text on the card's 24px line. */
	.group-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) 10px;
		padding: 0 var(--access-text-inset) 10px;
	}

	.group-head h3 {
		font-family: var(--font-head);
		font-size: var(--text-base);
		font-weight: 600;
	}

	.nested-panel {
		padding: var(--space-4) calc(var(--access-text-inset) - 2px);
		border-radius: var(--radius-btn);
	}

	.skeleton-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		border: 2px solid var(--border);
	}

	.empty-panel {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		border: 2px solid var(--border-strong);
		background: var(--secondary);
	}

	.empty-description {
		max-width: 54ch;
		color: var(--muted-foreground);
		font-size: var(--text-md);
	}

	.error-panel {
		border: 2px solid var(--border-strong);
		color: var(--status-danger-text);
		font-size: var(--text-md);
	}

	.demo-panel,
	.placeholder-panel {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		font-size: var(--text-md);
	}

	.demo-panel {
		border: 2px solid var(--border-strong);
		background: var(--tint);
	}

	.placeholder-panel {
		border: 2px dashed var(--border-strong);
		color: var(--muted-foreground);
	}

	@media (width >= 640px) {
		.access-head {
			grid-template-columns: auto minmax(0, 1fr) auto;
			grid-template-areas: 'icon text action';
		}

		.access-head-action {
			padding-inline-start: var(--space-4);
		}
	}
</style>
