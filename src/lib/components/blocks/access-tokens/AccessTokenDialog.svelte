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
	import AccessTokenBasicsStep from './AccessTokenBasicsStep.svelte';
	import { ConfirmDialog } from '$lib/components/derived/confirm-dialog/index.js';
	import AccessTokenPermissionsStep from './AccessTokenPermissionsStep.svelte';
	import { Stepper } from '$lib/components/derived/stepper/index.js';
	import TokenRevealPanel from './TokenRevealPanel.svelte';
	import { WISHLIST_RESTRICTION, type WishlistRestriction } from './access_token_form.js';
	import {
		ACCESS_TOKEN_DEFAULT_EXPIRY_DAYS,
		type AccessTokenExpiryPresetDays,
		type AgentScope,
	} from '$lib/modules/access_tokens/index.js';
	import type { CreateAccessTokenInput } from '$lib/modules/access_tokens/types.js';
	import { Spinner } from '$lib/components/base/spinner/index.js';

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
	let body = $state<HTMLDivElement | null>(null);
	let revealPanel = $state<ReturnType<typeof TokenRevealPanel> | null>(null);

	const stepLabels = [
		m.access_tokens_step_basics(),
		m.access_tokens_step_permissions(),
		m.access_tokens_step_token(),
	];
	const currentStepIndex = $derived(revealed !== null ? 2 : step === STEP.permissions ? 1 : 0);
	/** A regenerated token skips the basics and permissions, so it has no steps to show. */
	const showsSteps = $derived(revealed?.replacedPrefix == null);
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
		<Button intent="outline" onclick={() => requestOpenChange(false)}>
			{m.cancel()}
		</Button>
		<Button onclick={continueToPermissions}>{m.access_tokens_continue()}</Button>
	{:else}
		<Button intent="outline" disabled={pending} onclick={backToBasics}>
			{m.access_tokens_back()}
		</Button>
		<Button disabled={pending} onclick={create}>
			{#if pending}
				<Spinner data-icon="inline-start" />
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
		layout="scroll"
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
		<Dialog.Header divided={showsSteps}>
			<Dialog.Title>{title}</Dialog.Title>
			{#if showsSteps}
				<Stepper {stepLabels} {currentStepIndex} label={m.access_tokens_steps_label()} />
			{/if}
		</Dialog.Header>

		<Dialog.Body bind:ref={body} class="flex flex-col gap-5.5">
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
		</Dialog.Body>

		<Dialog.Footer>
			{@render footerActions()}
		</Dialog.Footer>

		<!-- The secret is shown only once; losing it is recovered by regenerating, so red outline. -->
		<ConfirmDialog
			bind:open={closeGuardOpen}
			title={m.access_tokens_close_guard_title()}
			description={m.access_tokens_close_guard_description()}
			cancelLabel={m.access_tokens_back()}
			confirmLabel={m.access_tokens_close_guard_confirm()}
			confirmIntent="danger"
			data-testid="access-token-close-guard"
			onconfirm={closeWithoutCopying}
		/>
	</Dialog.Content>
</Dialog.Root>
