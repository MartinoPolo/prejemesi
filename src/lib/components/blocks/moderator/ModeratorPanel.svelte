<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
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
	import {
		getClaimInvitesForWishlist,
		generateClaimInviteLink,
		revokeClaimInvite,
	} from '$lib/modules/claim/claim.remote.js';
	import type { ModeratorWithUser, PendingInvite } from '$lib/modules/moderators/types.js';
	import type { PendingClaimInvite } from '$lib/modules/claim/types.js';
	import { toastSuccess, toastError, toastInfo } from '$lib/components/base/toast/index.js';
	import { CopyField } from '$lib/components/derived/copy-field/index.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { getApplicationUrl } from '$lib/config/site.js';
	import LinkIcon from '@lucide/svelte/icons/link';
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
	// For-someone lists (free-text recipient) show the claim-link section.
	let isForSomeoneElse = $state(false);
	let isLoading = $state(false);
	let isGenerating = $state(false);
	let isRemoving = $state(false);
	let isRevokingId = $state<string | null>(null);
	let isSelfPromoting = $state(false);
	let generatedInvitePath = $state<string | null>(null);
	let inviteEmail = $state('');

	// Claim link („Pozvat obdarovaného", issue #150): only for-someone lists. Links a free-text
	// recipient's real account. Mirrors the správce-invite generate/email/copy/revoke flow.
	let claimInvites = $state.raw<PendingClaimInvite[]>([]);
	let isGeneratingClaim = $state(false);
	let isRevokingClaimId = $state<string | null>(null);
	let generatedClaimPath = $state<string | null>(null);
	let claimEmail = $state('');

	async function loadModerators() {
		isLoading = true;
		try {
			const [data, claimData] = await Promise.all([
				getModeratorsForWishlist(wishlistId),
				getClaimInvitesForWishlist(wishlistId),
			]);
			moderators = data.moderators;
			pendingInvites = data.pendingInvites;
			isForSomeoneElse = data.isForSomeoneElse;
			claimInvites = claimData.pendingInvites;
		} catch (thrown) {
			console.error('Failed to load moderators:', thrown);
		} finally {
			isLoading = false;
		}
	}

	async function handleGenerateInvite() {
		isGenerating = true;
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
				// Non-blocking heads-up: the invitee has no account yet, so they'll be
				// asked to register when they open the invite (the email still went out).
				if (result.unregisteredInvitee) {
					toastInfo(
						m.moderator_invite_unregistered_title(),
						m.moderator_invite_unregistered_body(),
					);
				}
				inviteEmail = '';
			}
		} catch (thrown) {
			toastError(translateServerError(thrown, m.moderator_error_generate()));
		} finally {
			isGenerating = false;
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

	async function handleGenerateClaim() {
		isGeneratingClaim = true;
		generatedClaimPath = null;
		try {
			const trimmed = claimEmail.trim();
			const result = await generateClaimInviteLink(
				trimmed === '' ? { wishlistId } : { wishlistId, email: trimmed },
			);
			generatedClaimPath = result.claimPath;
			await loadModerators();
			if (trimmed === '') {
				toastSuccess(m.claim_toast_generated());
			} else {
				toastSuccess(m.claim_toast_sent({ email: trimmed }));
				if (result.unregisteredInvitee) {
					toastInfo(
						m.claim_invite_unregistered_title(),
						m.claim_invite_unregistered_body(),
					);
				}
				claimEmail = '';
			}
		} catch (thrown) {
			toastError(translateServerError(thrown, m.claim_error_generate()));
		} finally {
			isGeneratingClaim = false;
		}
	}

	async function handleRevokeClaim(inviteId: string) {
		isRevokingClaimId = inviteId;
		try {
			await revokeClaimInvite({ inviteId });
			await loadModerators();
			generatedClaimPath = null;
			toastSuccess(m.claim_toast_revoked());
		} catch (thrown) {
			toastError(translateServerError(thrown, m.claim_error_revoke()));
		} finally {
			isRevokingClaimId = null;
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
			inviteEmail = '';
			generatedClaimPath = null;
			claimEmail = '';
		}
	});
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content size="2xl" layout="scroll">
		<Dialog.Header>
			<Dialog.Title>{m.moderator_title()}</Dialog.Title>
			<Dialog.Description>{m.moderator_description()}</Dialog.Description>
		</Dialog.Header>

		<Dialog.Body>
			<div class="flex flex-col gap-6">
				{#if isForSomeoneElse}
					<!-- Claim link (issue #150): nudge to link the free-text recipient's real account.
				     Mirrors the správce-invite generate/email/copy/revoke flow. -->
					<div class={styles.section()}>
						<div class={styles.sectionTitle()}>{m.claim_section_title()}</div>
						<Alert.Root tone="info">
							<LinkIcon aria-hidden="true" />
							<Alert.Title>{m.claim_nudge_title()}</Alert.Title>
							<Alert.Description>{m.claim_nudge_description()}</Alert.Description>
						</Alert.Root>

						{#if generatedClaimPath !== null}
							<div data-testid="claim-link">
								<CopyField
									value={getApplicationUrl(
										generatedClaimPath,
										window.location.origin,
									)}
									label={m.claim_link_label()}
								/>
							</div>
						{/if}

						<div class="flex flex-col gap-1.5">
							<Label for="claim-email">
								{m.claim_email_label()}
							</Label>
							<Input
								id="claim-email"
								size="lg"
								type="email"
								placeholder={m.claim_email_placeholder()}
								bind:value={claimEmail}
								disabled={isGeneratingClaim}
							/>
						</div>

						<Button
							size="lg"
							intent="primary"
							class="w-full"
							disabled={isGeneratingClaim}
							onclick={handleGenerateClaim}
						>
							<LinkIcon data-icon="inline-start" />
							{isGeneratingClaim ? m.claim_generating() : m.claim_generate_button()}
						</Button>

						{#if claimInvites.length > 0}
							<div class={styles.sectionTitle()}>
								{m.claim_pending_title({ count: claimInvites.length })}
							</div>
							{#each claimInvites as invite (invite.id)}
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
										intent="ghost-danger"
										disabled={isRevokingClaimId === invite.id}
										aria-label={m.claim_revoke_invite()}
										onclick={() => handleRevokeClaim(invite.id)}
									>
										<XIcon data-icon="solo" />
									</Button>
								</div>
							{/each}
						{/if}
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
						<div data-testid="invite-link">
							<CopyField
								value={getApplicationUrl(
									generatedInvitePath,
									window.location.origin,
								)}
								label={m.moderator_invite_link_label()}
							/>
						</div>
					{/if}

					<div class="flex flex-col gap-1.5">
						<Label for="invite-email">
							{m.moderator_invite_email_label()}
						</Label>
						<Input
							id="invite-email"
							size="lg"
							type="email"
							placeholder={m.moderator_invite_email_placeholder()}
							bind:value={inviteEmail}
							disabled={isGenerating}
						/>
					</div>

					<Button
						size="lg"
						intent="primary"
						class="w-full"
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
									intent="ghost-danger"
									disabled={isRevokingId === invite.id}
									aria-label={m.moderator_revoke_invite()}
									onclick={() => handleRevokeInvite(invite.id)}
								>
									<XIcon data-icon="solo" />
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
							<div class={styles.sectionTitle()}>
								{m.moderator_reservations_title()}
							</div>

							<Alert.Root tone="warning">
								<AlertTriangleIcon aria-hidden="true" />
								<Alert.Title>{m.moderator_see_reservations_title()}</Alert.Title>
								<Alert.Description>
									{m.moderator_see_reservations_description()}
								</Alert.Description>
								<Alert.Action placement="below">
									<Button
										size="sm"
										intent="outline"
										disabled={isSelfPromoting}
										onclick={handleSelfPromote}
									>
										<EyeIcon data-icon="inline-start" />
										{isSelfPromoting
											? m.moderator_activating()
											: m.moderator_activate_button()}
									</Button>
								</Alert.Action>
							</Alert.Root>
						</div>
					{:else}
						<div class={styles.section()}>
							<div class={styles.sectionTitle()}>
								{m.moderator_reservations_title()}
							</div>
							<Alert.Root tone="info">
								<EyeIcon aria-hidden="true" />
								<Alert.Description
									>{m.moderator_active_disclosure()}</Alert.Description
								>
							</Alert.Root>
						</div>
					{/if}
				{/if}
			</div>
		</Dialog.Body>
	</Dialog.Content>
</Dialog.Root>
