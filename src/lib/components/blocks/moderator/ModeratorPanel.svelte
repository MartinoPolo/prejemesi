<script lang="ts">
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import ModeratorListItem from './ModeratorListItem.svelte';
	import { moderatorPanelVariants } from './moderator-panel-variants.js';
	import {
		getModeratorsForWishlist,
		generateModeratorInviteLink,
		revokeModeratorInvite,
		removeModerator,
		selfPromoteToModerator,
	} from '$lib/modules/moderators/moderators.remote.js';
	import type { ModeratorWithUser, PendingInvite } from '$lib/modules/moderators/types.js';
	import { toast } from 'svelte-sonner';
	import LinkIcon from '@lucide/svelte/icons/link';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';

	interface ModeratorPanelProps {
		wishlistId: string;
		wishlistShortId: string;
		ownerIsModerator: boolean;
		open: boolean;
		onopenchange?: (open: boolean) => void;
		onselfpromoted?: () => void;
	}

	let {
		wishlistId,
		wishlistShortId,
		ownerIsModerator,
		open = $bindable(false),
		onopenchange,
		onselfpromoted,
	}: ModeratorPanelProps = $props();

	const styles = moderatorPanelVariants();

	let moderators = $state<ModeratorWithUser[]>([]);
	let pendingInvites = $state<PendingInvite[]>([]);
	let isLoading = $state(false);
	let isGenerating = $state(false);
	let isRemoving = $state(false);
	let isRevokingId = $state<string | null>(null);
	let isSelfPromoting = $state(false);
	let linkCopied = $state(false);
	let generatedInvitePath = $state<string | null>(null);

	async function loadModerators() {
		isLoading = true;
		try {
			const data = await getModeratorsForWishlist(wishlistId);
			moderators = data.moderators;
			pendingInvites = data.pendingInvites;
		} catch (thrown) {
			console.error('Failed to load moderators:', thrown);
		} finally {
			isLoading = false;
		}
	}

	async function handleGenerateInvite() {
		isGenerating = true;
		linkCopied = false;
		generatedInvitePath = null;
		try {
			const result = await generateModeratorInviteLink({ wishlistId });
			generatedInvitePath = result.invitePath;
			await loadModerators();
			toast.success('Pozvanka byla vygenerovana');
		} catch (thrown) {
			const message =
				thrown instanceof Error ? thrown.message : 'Nepodarilo se vygenerovat pozvanku';
			toast.error(message);
		} finally {
			isGenerating = false;
		}
	}

	async function handleCopyLink() {
		if (generatedInvitePath === null) {
			return;
		}
		try {
			const fullUrl = `${window.location.origin}${generatedInvitePath}`;
			await navigator.clipboard.writeText(fullUrl);
			linkCopied = true;
			toast.success('Odkaz byl zkopirovan');
			setTimeout(() => {
				linkCopied = false;
			}, 3000);
		} catch {
			toast.error('Nepodarilo se zkopirovat odkaz');
		}
	}

	async function handleRevokeInvite(inviteId: string) {
		isRevokingId = inviteId;
		try {
			await revokeModeratorInvite({ inviteId });
			await loadModerators();
			// Clear generated link if it was for this invite
			generatedInvitePath = null;
			toast.success('Pozvanka byla zrusena');
		} catch (thrown) {
			const message =
				thrown instanceof Error ? thrown.message : 'Nepodarilo se zrusit pozvanku';
			toast.error(message);
		} finally {
			isRevokingId = null;
		}
	}

	async function handleRemoveModerator(assignmentId: string) {
		isRemoving = true;
		try {
			await removeModerator({ assignmentId });
			await loadModerators();
			toast.success('Moderator byl odebran');
		} catch (thrown) {
			const message =
				thrown instanceof Error ? thrown.message : 'Nepodarilo se odebrat moderatora';
			toast.error(message);
		} finally {
			isRemoving = false;
		}
	}

	async function handleSelfPromote() {
		isSelfPromoting = true;
		try {
			await selfPromoteToModerator({ wishlistId });
			toast.success('Nyni vidite stav rezervaci');
			onselfpromoted?.();
		} catch (thrown) {
			const message =
				thrown instanceof Error ? thrown.message : 'Nepodarilo se aktivovat zobrazeni';
			toast.error(message);
		} finally {
			isSelfPromoting = false;
		}
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		onopenchange?.(newOpen);
		if (newOpen) {
			void loadModerators();
		} else {
			// Reset state
			generatedInvitePath = null;
			linkCopied = false;
		}
	}
</script>

<Sheet.Root {open} onOpenChange={handleOpenChange}>
	<Sheet.Content side="right" class="w-full sm:max-w-md">
		<Sheet.Header>
			<Sheet.Title>Moderatori</Sheet.Title>
			<Sheet.Description>Spravujte moderatory vaseho seznamu prani.</Sheet.Description>
		</Sheet.Header>

		<div class="flex flex-col gap-6 px-4 py-4">
			<!-- Active moderators -->
			<div class={styles.section()}>
				<div class={styles.sectionTitle()}>Aktivni moderatori</div>

				{#if isLoading}
					<div class={styles.emptyText()}>Nacitam...</div>
				{:else if moderators.length === 0}
					<div class={styles.emptyText()}>Zatim zadni moderatori</div>
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
				<div class={styles.sectionTitle()}>Pozvat moderatora</div>
				<div class={styles.sectionDescription()}>
					Vygenerujte odkaz a poslete ho osobe, kterou chcete pridat jako moderatora.
				</div>

				{#if generatedInvitePath !== null}
					<div class="flex items-center gap-2">
						<div
							class="flex-1 truncate rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs"
						>
							{window.location.origin}{generatedInvitePath}
						</div>
						<Button
							size="sm"
							variant={linkCopied ? 'default' : 'outline'}
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

				<Button
					size="sm"
					variant="outline"
					disabled={isGenerating}
					onclick={handleGenerateInvite}
				>
					<LinkIcon data-icon="inline-start" />
					{isGenerating ? 'Generuji...' : 'Generovat pozvanku'}
				</Button>
			</div>

			<!-- Pending invites -->
			{#if pendingInvites.length > 0}
				<Separator />

				<div class={styles.section()}>
					<div class={styles.sectionTitle()}>
						Cekajici pozvanky ({pendingInvites.length})
					</div>

					{#each pendingInvites as invite (invite.id)}
						<div class={styles.inviteRow()}>
							<div class="min-w-0 flex-1">
								<div class={styles.inviteToken()}>
									...{invite.token.slice(-8)}
								</div>
								<div class={styles.inviteDate()}>
									{new Intl.DateTimeFormat('cs-CZ', {
										day: 'numeric',
										month: 'short',
										hour: '2-digit',
										minute: '2-digit',
									}).format(new Date(invite.createdAt))}
								</div>
							</div>
							<Button
								size="sm"
								variant="ghost"
								class="text-destructive hover:text-destructive"
								disabled={isRevokingId === invite.id}
								aria-label="Zrusit pozvanku"
								onclick={() => handleRevokeInvite(invite.id)}
							>
								<XIcon class="size-4" />
							</Button>
						</div>
					{/each}
				</div>
			{/if}

			<Separator />

			<!-- Self-promote section -->
			{#if !ownerIsModerator}
				<div class={styles.section()}>
					<div class={styles.sectionTitle()}>Zobrazeni rezervaci</div>

					<div class={styles.selfPromoteWarning()}>
						<div class="flex items-center gap-2">
							<AlertTriangleIcon class="size-4 flex-shrink-0" />
							<div class={styles.selfPromoteTitle()}>
								Chcete videt stav rezervaci?
							</div>
						</div>
						<div class={styles.selfPromoteDescription()}>
							Po aktivaci uvidite, ktere darky jsou rezervovane. Vsem navstevnikum se
							zobrazi upozorneni, ze vlastnik vidi stav rezervaci. Tuto akci nelze
							vzit zpet.
						</div>
						<Button
							size="sm"
							variant="outline"
							class="mt-1 self-start"
							disabled={isSelfPromoting}
							onclick={handleSelfPromote}
						>
							<EyeIcon data-icon="inline-start" />
							{isSelfPromoting ? 'Aktivuji...' : 'Aktivovat zobrazeni'}
						</Button>
					</div>
				</div>
			{:else}
				<div class={styles.section()}>
					<div class={styles.sectionTitle()}>Zobrazeni rezervaci</div>
					<div class={styles.disclosureBanner()}>
						<EyeIcon class="size-4 flex-shrink-0" />
						<span>Vidite stav rezervaci tohoto seznamu.</span>
					</div>
				</div>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
