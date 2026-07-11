<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import ModeratorListItem from './ModeratorListItem.svelte';
	import { moderatorPanelVariants } from './moderator_panel_variants.js';
	import {
		getModeratorsForWishlist,
		generateModeratorInviteLink,
		revokeModeratorInvite,
		removeModerator,
		selfPromoteToModerator,
	} from '$lib/modules/moderators/moderators.remote.js';
	import { renameRecipient } from '$lib/modules/wishlists/wishlists.remote.js';
	import type { ModeratorWithUser, PendingInvite } from '$lib/modules/moderators/types.js';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { getApplicationUrl } from '$lib/config/site.js';
	import LinkIcon from '@lucide/svelte/icons/link';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';

	interface ModeratorPanelProps {
		wishlistId: string;
		/** Linked recipient self-promoted to see reservation state; toggles the disclosure section. */
		recipientIsModerator: boolean;
		open: boolean;
		onopenchange?: (open: boolean) => void;
		onselfpromoted?: () => void;
	}

	let {
		wishlistId,
		recipientIsModerator,
		open = $bindable(false),
		onopenchange,
		onselfpromoted,
	}: ModeratorPanelProps = $props();

	const styles = moderatorPanelVariants();

	let moderators = $state.raw<ModeratorWithUser[]>([]);
	let pendingInvites = $state.raw<PendingInvite[]>([]);
	// For-someone lists (free-text recipient) expose a rename section pre-filled with the current name.
	let isForSomeoneElse = $state(false);
	let recipientNameDraft = $state('');
	let isLoading = $state(false);
	let isGenerating = $state(false);
	let isRemoving = $state(false);
	let isRevokingId = $state<string | null>(null);
	let isSelfPromoting = $state(false);
	let isRenamingRecipient = $state(false);
	let linkCopied = $state(false);
	let generatedInvitePath = $state<string | null>(null);
	let inviteEmail = $state('');

	async function loadModerators() {
		isLoading = true;
		try {
			const data = await getModeratorsForWishlist(wishlistId);
			moderators = data.moderators;
			pendingInvites = data.pendingInvites;
			isForSomeoneElse = data.isForSomeoneElse;
			recipientNameDraft = data.recipientName ?? '';
		} catch (thrown) {
			console.error('Failed to load moderators:', thrown);
		} finally {
			isLoading = false;
		}
	}

	async function handleRenameRecipient() {
		const trimmed = recipientNameDraft.trim();
		if (trimmed === '') {
			return;
		}
		isRenamingRecipient = true;
		try {
			await renameRecipient({ id: wishlistId, recipientName: trimmed });
			recipientNameDraft = trimmed;
			toastSuccess(m.recipient_rename_toast_success());
		} catch (thrown) {
			toastError(translateServerError(thrown, m.recipient_rename_error()));
		} finally {
			isRenamingRecipient = false;
		}
	}

	async function handleGenerateInvite() {
		isGenerating = true;
		linkCopied = false;
		generatedInvitePath = null;
		try {
			const trimmed = inviteEmail.trim();
			const result = await generateModeratorInviteLink(
				trimmed === '' ? { wishlistId } : { wishlistId, email: trimmed },
			);
			generatedInvitePath = result.invitePath;
			await loadModerators();
			if (trimmed === '') {
				toastSuccess(m.moderator_toast_invite_generated());
			} else {
				toastSuccess(m.moderator_toast_invite_sent({ email: trimmed }));
				inviteEmail = '';
			}
		} catch (thrown) {
			toastError(translateServerError(thrown, m.moderator_error_generate()));
		} finally {
			isGenerating = false;
		}
	}

	async function handleCopyLink() {
		if (generatedInvitePath === null) {
			return;
		}
		try {
			const fullUrl = getApplicationUrl(generatedInvitePath, window.location.origin);
			await navigator.clipboard.writeText(fullUrl);
			linkCopied = true;
			toastSuccess(m.moderator_toast_link_copied());
			setTimeout(() => {
				linkCopied = false;
			}, 3000);
		} catch {
			toastError(m.moderator_error_copy());
		}
	}

	async function handleRevokeInvite(inviteId: string) {
		isRevokingId = inviteId;
		try {
			await revokeModeratorInvite({ inviteId });
			await loadModerators();
			// Clear generated link if it was for this invite
			generatedInvitePath = null;
			toastSuccess(m.moderator_toast_invite_revoked());
		} catch (thrown) {
			toastError(translateServerError(thrown, m.moderator_error_revoke()));
		} finally {
			isRevokingId = null;
		}
	}

	async function handleRemoveModerator(assignmentId: string) {
		isRemoving = true;
		try {
			await removeModerator({ assignmentId });
			await loadModerators();
			toastSuccess(m.moderator_toast_removed());
		} catch (thrown) {
			toastError(translateServerError(thrown, m.moderator_error_remove()));
		} finally {
			isRemoving = false;
		}
	}

	async function handleSelfPromote() {
		isSelfPromoting = true;
		try {
			await selfPromoteToModerator({ wishlistId });
			toastSuccess(m.moderator_toast_self_promoted());
			onselfpromoted?.();
		} catch (thrown) {
			toastError(translateServerError(thrown, m.moderator_error_activate()));
		} finally {
			isSelfPromoting = false;
		}
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		onopenchange?.(newOpen);
	}

	// Load moderator/invite data whenever the panel opens. Driven by an $effect on the
	// bound `open` prop rather than only `onOpenChange`, because the panel is opened
	// programmatically from the wishlist header (parent sets `open = true`). bits-ui's
	// `onOpenChange` fires only for internally-initiated open changes (trigger/ESC/overlay),
	// NOT parent-driven ones – so without this effect the panel would render empty.
	$effect(() => {
		if (open) {
			void loadModerators();
		} else {
			// Reset transient state when the panel closes.
			generatedInvitePath = null;
			linkCopied = false;
			inviteEmail = '';
		}
	});
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>{m.moderator_title()}</Dialog.Title>
			<Dialog.Description>{m.moderator_description()}</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-6">
			<!-- Rename recipient (for-someone lists only): edit the free-text obdarovaný name -->
			{#if isForSomeoneElse}
				<div class={styles.section()}>
					<div class={styles.sectionTitle()}>{m.recipient_section_title()}</div>
					<div class="flex flex-col gap-1.5">
						<label for="recipient-name" class="text-sm text-muted-foreground">
							{m.recipient_rename_label()}
						</label>
						<div class="flex items-center gap-2">
							<Input
								id="recipient-name"
								bind:value={recipientNameDraft}
								disabled={isRenamingRecipient}
							/>
							<Button
								size="sm"
								intent="outline"
								disabled={isRenamingRecipient || recipientNameDraft.trim() === ''}
								onclick={handleRenameRecipient}
							>
								{m.recipient_rename_button()}
							</Button>
						</div>
					</div>
				</div>

				<Separator />
			{/if}

			<!-- Active moderators -->
			<div class={styles.section()}>
				<div class={styles.sectionTitle()}>{m.moderator_active_title()}</div>

				{#if isLoading}
					<div class={styles.emptyText()}>{m.moderator_loading()}</div>
				{:else if moderators.length === 0}
					<div class={styles.emptyText()}>{m.moderator_empty()}</div>
				{:else}
					{#each moderators as moderator (moderator.id)}
						<ModeratorListItem
							{moderator}
							canRemove={true}
							{isRemoving}
							onremove={handleRemoveModerator}
						/>
					{/each}
				{/if}
			</div>

			<Separator />

			<!-- Generate invite -->
			<div class={styles.section()}>
				<div class={styles.sectionTitle()}>{m.moderator_invite_title()}</div>
				<div class={styles.sectionDescription()}>
					{m.moderator_invite_description()}
				</div>

				{#if generatedInvitePath !== null}
					<div class="flex items-center gap-2">
						<div
							class="flex-1 truncate rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs"
							data-testid="invite-link"
						>
							{getApplicationUrl(generatedInvitePath, window.location.origin)}
						</div>
						<Button
							size="sm"
							intent={linkCopied ? 'primary' : 'outline'}
							aria-label={m.moderator_copy_link()}
							data-testid="copy-invite-link"
							onclick={handleCopyLink}
						>
							{#if linkCopied}
								<CheckIcon class="size-4" />
							{:else}
								<CopyIcon class="size-4" />
							{/if}
						</Button>
					</div>
				{/if}

				<div class="flex flex-col gap-1.5">
					<label for="invite-email" class="text-sm text-muted-foreground">
						{m.moderator_invite_email_label()}
					</label>
					<Input
						id="invite-email"
						type="email"
						placeholder={m.moderator_invite_email_placeholder()}
						bind:value={inviteEmail}
						disabled={isGenerating}
					/>
				</div>

				<Button
					size="sm"
					intent="outline"
					disabled={isGenerating}
					onclick={handleGenerateInvite}
				>
					<LinkIcon data-icon="inline-start" />
					{isGenerating ? m.moderator_generating() : m.moderator_generate_invite()}
				</Button>
			</div>

			<!-- Pending invites -->
			{#if pendingInvites.length > 0}
				<Separator />

				<div class={styles.section()}>
					<div class={styles.sectionTitle()}>
						{m.moderator_pending_title({ count: pendingInvites.length })}
					</div>

					{#each pendingInvites as invite (invite.id)}
						<div class={styles.inviteRow()}>
							<div class="min-w-0 flex-1">
								<div class={styles.inviteToken()}>
									...{invite.token.slice(-8)}
								</div>
								<div class={styles.inviteDate()}>
									{new Intl.DateTimeFormat(getLocale(), {
										day: 'numeric',
										month: 'short',
										hour: '2-digit',
										minute: '2-digit',
									}).format(new Date(invite.createdAt))}
								</div>
							</div>
							<Button
								size="sm"
								intent="ghost"
								class="text-destructive hover:text-destructive"
								disabled={isRevokingId === invite.id}
								aria-label={m.moderator_revoke_invite()}
								onclick={() => handleRevokeInvite(invite.id)}
							>
								<XIcon class="size-4" />
							</Button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Reservation visibility (self lists only): recipient self-promotion + disclosure -->
			{#if !isForSomeoneElse}
				<Separator />

				<!-- Self-promote section -->
				{#if !recipientIsModerator}
					<div class={styles.section()}>
						<div class={styles.sectionTitle()}>{m.moderator_reservations_title()}</div>

						<div class={styles.selfPromoteWarning()}>
							<div class="flex items-center gap-2">
								<AlertTriangleIcon class="size-4 flex-shrink-0" />
								<div class={styles.selfPromoteTitle()}>
									{m.moderator_see_reservations_title()}
								</div>
							</div>
							<div class={styles.selfPromoteDescription()}>
								{m.moderator_see_reservations_description()}
							</div>
							<Button
								size="sm"
								intent="outline"
								class="mt-1 self-start"
								disabled={isSelfPromoting}
								onclick={handleSelfPromote}
							>
								<EyeIcon data-icon="inline-start" />
								{isSelfPromoting
									? m.moderator_activating()
									: m.moderator_activate_button()}
							</Button>
						</div>
					</div>
				{:else}
					<div class={styles.section()}>
						<div class={styles.sectionTitle()}>{m.moderator_reservations_title()}</div>
						<div class={styles.disclosureBanner()}>
							<EyeIcon class="size-4 flex-shrink-0" />
							<span>{m.moderator_active_disclosure()}</span>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
