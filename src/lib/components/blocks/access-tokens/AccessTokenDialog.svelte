<script lang="ts" module>
	import type { CreatedAccessToken } from '$lib/modules/access_tokens/index.js';

	export interface AccessTokenReveal {
		created: CreatedAccessToken;
		/** The prefix of the value a regeneration replaced; null for a new token. */
		replacedPrefix: string | null;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import AccessTokenBasicsStep from './AccessTokenBasicsStep.svelte';
	import AccessTokenCloseGuard from './AccessTokenCloseGuard.svelte';
	import AccessTokenPermissionsStep from './AccessTokenPermissionsStep.svelte';
	import AccessTokenSteps from './AccessTokenSteps.svelte';
	import TokenRevealPanel from './TokenRevealPanel.svelte';
	import { WISHLIST_RESTRICTION, type WishlistRestriction } from './access_token_form.js';
	import {
		ACCESS_TOKEN_DEFAULT_EXPIRY_DAYS,
		type AccessTokenExpiryPresetDays,
		type AgentScope,
	} from '$lib/modules/access_tokens/index.js';
	import type { CreateAccessTokenInput } from '$lib/modules/access_tokens/types.js';
	import LoaderIcon from '@lucide/svelte/icons/loader';

	interface AccessTokenDialogProps {
		open: boolean;
		/** The shown-once token; set by the parent after creating or regenerating one. */
		revealed: AccessTokenReveal | null;
		apiBaseUrl: string;
		/** Creates the token and sets `revealed`; failures are reported by the parent. */
		oncreate: (input: CreateAccessTokenInput) => Promise<void>;
		/** Runs once the dialog has fully closed, so the parent can clear `revealed`. */
		onclosed: () => void;
		/** Where focus goes when the dialog closes; the default is the opening control. */
		closeFocusTarget?: () => HTMLElement | null;
	}

	const STEP = { basics: 'basics', permissions: 'permissions' } as const;
	type Step = (typeof STEP)[keyof typeof STEP];

	let {
		open = $bindable(false),
		revealed,
		apiBaseUrl,
		oncreate,
		onclosed,
		closeFocusTarget,
	}: AccessTokenDialogProps = $props();

	let step = $state<Step>(STEP.basics);
	let name = $state('');
	let restriction = $state<WishlistRestriction>(WISHLIST_RESTRICTION.all);
	let selectedWishlistIds = $state<string[]>([]);
	let wishlistSearch = $state('');
	let expiryDays = $state<AccessTokenExpiryPresetDays>(ACCESS_TOKEN_DEFAULT_EXPIRY_DAYS);
	let scopes = $state<AgentScope[]>([]);
	let fastForward = $state(false);
	let nameError = $state(false);
	let wishlistsError = $state(false);
	let pending = $state(false);
	let copied = $state(false);
	let closeGuardOpen = $state(false);
	let nameInput = $state<HTMLInputElement | null>(null);
	let body = $state<HTMLElement | null>(null);
	let revealPanel = $state<ReturnType<typeof TokenRevealPanel> | null>(null);

	const currentStepIndex = $derived(revealed !== null ? 2 : step === STEP.permissions ? 1 : 0);
	const title = $derived.by(() => {
		if (revealed === null) {
			return m.access_tokens_create_title();
		}
		return revealed.replacedPrefix === null
			? m.access_tokens_revealed_title()
			: m.access_tokens_regenerated_title();
	});

	function requestOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			open = true;
			return;
		}
		if (pending) {
			return;
		}
		if (revealed !== null && !copied) {
			closeGuardOpen = true;
			return;
		}
		open = false;
	}

	function closeWithoutCopying() {
		closeGuardOpen = false;
		open = false;
	}

	function resetForm() {
		step = STEP.basics;
		name = '';
		restriction = WISHLIST_RESTRICTION.all;
		selectedWishlistIds = [];
		wishlistSearch = '';
		expiryDays = ACCESS_TOKEN_DEFAULT_EXPIRY_DAYS;
		scopes = [];
		fastForward = false;
		nameError = false;
		wishlistsError = false;
		copied = false;
	}

	async function continueToPermissions() {
		nameError = name.trim() === '';
		wishlistsError =
			restriction === WISHLIST_RESTRICTION.some && selectedWishlistIds.length === 0;
		if (nameError) {
			nameInput?.focus();
			return;
		}
		if (wishlistsError) {
			body?.querySelector<HTMLElement>(
				'[data-wishlist-picker] input, [data-wishlist-picker] [data-slot=checkbox]',
			)?.focus();
			return;
		}
		step = STEP.permissions;
		await tick();
		body?.querySelector<HTMLElement>('[data-slot=checkbox]:not([disabled])')?.focus();
	}

	async function backToBasics() {
		step = STEP.basics;
		await tick();
		nameInput?.focus();
	}

	async function create() {
		pending = true;
		try {
			await oncreate({
				name: name.trim(),
				scopes,
				wishlistIds: restriction === WISHLIST_RESTRICTION.all ? null : selectedWishlistIds,
				expiryDays,
				fastForward,
			});
		} finally {
			pending = false;
		}
		await tick();
		revealPanel?.focusCopyButton();
	}
</script>

{#snippet footerActions()}
	{#if revealed !== null}
		<Button onclick={() => requestOpenChange(false)}>{m.done()}</Button>
	{:else if step === STEP.basics}
		<Button intent="secondary" onclick={() => requestOpenChange(false)}>
			{m.cancel()}
		</Button>
		<Button onclick={continueToPermissions}>{m.access_tokens_continue()}</Button>
	{:else}
		<Button intent="secondary" disabled={pending} onclick={backToBasics}>
			{m.access_tokens_back()}
		</Button>
		<Button disabled={pending} onclick={create}>
			{#if pending}
				<LoaderIcon class="animate-spin" data-icon="inline-start" />
				{m.access_tokens_creating()}
			{:else}
				{m.access_tokens_create()}
			{/if}
		</Button>
	{/if}
{/snippet}

<Dialog.Root
	bind:open={() => open, requestOpenChange}
	onOpenChangeComplete={(isOpen: boolean) => {
		if (!isOpen) {
			resetForm();
			onclosed();
		}
	}}
>
	<Dialog.Content
		size="xl"
		class="gap-0 overflow-hidden p-0"
		data-testid="access-token-dialog"
		onOpenAutoFocus={(event) => {
			if (revealed !== null) {
				event.preventDefault();
				revealPanel?.focusCopyButton();
			}
		}}
		onCloseAutoFocus={(event) => {
			const target = closeFocusTarget?.();
			if (target) {
				event.preventDefault();
				target.focus();
			}
		}}
	>
		<div class="dialog-frame">
			<div class="flex flex-col gap-3 px-4 pt-(--overlay-close-inset) pb-3 sm:px-6 sm:pb-4">
				<div
					class="flex min-h-(--size-control-lg) items-center pe-(--overlay-close-clearance-inside-dialog-padding)"
				>
					<Dialog.Title class="text-start text-xl in-data-close-button:px-0 sm:text-2xl">
						{title}
					</Dialog.Title>
				</div>
				{#if revealed?.replacedPrefix == null}
					<AccessTokenSteps {currentStepIndex} />
				{/if}
			</div>

			<Separator />

			<div
				bind:this={body}
				class="flex min-h-0 flex-1 flex-col gap-5.5 overflow-y-auto px-4 py-4 sm:px-6 sm:pt-5 sm:pb-6"
			>
				{#if revealed !== null}
					<TokenRevealPanel
						bind:this={revealPanel}
						created={revealed.created}
						replacedPrefix={revealed.replacedPrefix}
						{apiBaseUrl}
						oncopied={() => (copied = true)}
					/>
				{:else if step === STEP.basics}
					<AccessTokenBasicsStep
						bind:name
						bind:restriction
						bind:selectedWishlistIds
						bind:wishlistSearch
						bind:expiryDays
						bind:nameError
						bind:wishlistsError
						bind:nameInput
					/>
				{:else}
					<AccessTokenPermissionsStep bind:scopes bind:fastForward disabled={pending} />
				{/if}
			</div>

			<Separator />

			<Dialog.Footer class="shrink-0 px-4 py-3 sm:px-6 sm:pt-4 sm:pb-5">
				{@render footerActions()}
			</Dialog.Footer>
		</div>

		<AccessTokenCloseGuard bind:open={closeGuardOpen} onconfirm={closeWithoutCopying} />
	</Dialog.Content>
</Dialog.Root>

<style>
	/* The header and footer stay put while the body scrolls on short screens. */
	.dialog-frame {
		display: flex;
		min-height: 0;
		max-height: 85dvh;
		flex-direction: column;
	}
</style>
