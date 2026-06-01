<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import ShareMethodButton from './ShareMethodButton.svelte';
	import { shareWizardVariants } from './share_wizard_variants.js';
	import {
		SHARE_WIZARD_STEPS,
		SHARE_PLATFORM_INFO,
		SHARE_PLATFORM_ORDER,
		buildShareMessage,
	} from '$lib/modules/sharing/types.js';
	import { useSharing } from '$lib/modules/sharing/sharing.context.svelte.js';
	import { shareWishlist } from '$lib/modules/sharing/sharing.remote.js';
	import { toastError } from '$lib/components/base/toast/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import XIcon from '@lucide/svelte/icons/x';
	import CircleCheckBigIcon from '@lucide/svelte/icons/circle-check-big';

	interface ShareWizardProps {
		wishlistId: string;
		wishlistTitle: string;
		giftCount: number;
		onshared?: () => void;
	}

	let { wishlistId, wishlistTitle, giftCount, onshared }: ShareWizardProps = $props();

	const sharing = useSharing();
	const styles = shareWizardVariants();

	let isSubmitting = $state(false);

	const step = $derived(sharing.wizardStep.current);
	const isOpen = $derived(sharing.wizardOpen.current);
	const linkCopied = $derived(sharing.linkCopied.current);
	const shareUrl = $derived(sharing.shareUrl.current);
	const shareUrlDisplay = $derived(sharing.shareUrlDisplay.current);
	const shareMessage = $derived(buildShareMessage(wishlistTitle));

	const giftCountLabel = $derived.by(() => {
		if (giftCount === 1) {
			return m.wishlist_gift_count_one();
		}
		return m.wishlist_gift_count_other({ count: giftCount });
	});

	// Step indicator state
	const step1State = $derived.by(() => {
		if (step === 'confirm') {
			return 'active' as const;
		}
		return 'done' as const;
	});

	const step2State = $derived.by(() => {
		if (step === 'confirm') {
			return 'pending' as const;
		}
		if (step === 'share') {
			return 'active' as const;
		}
		return 'done' as const;
	});

	const step3State = $derived.by((): 'active' | 'done' | 'pending' => {
		if (step === 'success') {
			return 'active';
		}
		return 'pending';
	});

	const connector1State = $derived(step === 'confirm' ? 'pending' : 'done');
	const connector2State = $derived(step === 'success' ? 'done' : 'pending');

	function getDotClass(state: 'active' | 'done' | 'pending') {
		if (state === 'active') {
			return styles.stepDotActive();
		}
		if (state === 'done') {
			return styles.stepDotDone();
		}
		return styles.stepDotPending();
	}

	function getLabelClass(state: 'active' | 'done' | 'pending') {
		if (state === 'active') {
			return styles.stepLabelActive();
		}
		return styles.stepLabel();
	}

	async function handleConfirmShare() {
		isSubmitting = true;
		try {
			await shareWishlist(wishlistId);
			sharing.markShared();
			sharing.goToStep(SHARE_WIZARD_STEPS.success);
			onshared?.();
		} catch (thrown) {
			toastError(translateServerError(thrown, m.share_error()));
		} finally {
			isSubmitting = false;
		}
	}

	function handleClose() {
		sharing.closeWizard();
	}

	function handleOpenChange(open: boolean) {
		if (!open) {
			sharing.closeWizard();
		}
	}
</script>

<Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-[560px] gap-0 overflow-y-auto p-0" showCloseButton={false}>
		<Dialog.Title class="sr-only">{m.share_dialog_title()}</Dialog.Title>
		<Dialog.Description class="sr-only">{m.share_dialog_description()}</Dialog.Description>

		<!-- Step Progress Indicator -->
		<div class={styles.progressBar()}>
			<div class={styles.step()}>
				<div class="{styles.stepDot()} {getDotClass(step1State)}">
					{#if step1State === 'done'}
						<CheckIcon class="size-2.5" />
					{:else}
						1
					{/if}
				</div>
				<span class={getLabelClass(step1State)}>{m.share_step_confirm()}</span>
			</div>
			<div
				class={connector1State === 'done' ? styles.connectorDone() : styles.connector()}
			></div>
			<div class={styles.step()}>
				<div class="{styles.stepDot()} {getDotClass(step2State)}">
					{#if step2State === 'done'}
						<CheckIcon class="size-2.5" />
					{:else}
						2
					{/if}
				</div>
				<span class={getLabelClass(step2State)}>{m.share_step_share()}</span>
			</div>
			<div
				class={connector2State === 'done' ? styles.connectorDone() : styles.connector()}
			></div>
			<div class={styles.step()}>
				<div class="{styles.stepDot()} {getDotClass(step3State)}">
					{#if step3State === 'done'}
						<CheckIcon class="size-2.5" />
					{:else}
						3
					{/if}
				</div>
				<span class={getLabelClass(step3State)}>{m.share_step_done()}</span>
			</div>
		</div>

		<!-- ═══════════ STEP 1: CONFIRMATION ═══════════ -->
		{#if step === 'confirm'}
			<div class="flex flex-col gap-5 px-6 pb-6">
				<div class={styles.confirmHero()}>
					<div class={styles.warnIconWrap()}>
						<AlertTriangleIcon class="size-9" strokeWidth={1.8} />
					</div>
					<div class={styles.confirmTitle()}>{m.share_confirm_title()}</div>
					<p class={styles.confirmBodyText()}>
						{m.share_confirm_body()}
					</p>
				</div>

				<!-- Wishlist preview card -->
				<div class={styles.previewCard()}>
					<div class={styles.previewThumb()}>
						<!-- Placeholder emoji based on title -->
						<span aria-hidden="true">&#127873;</span>
					</div>
					<div class="min-w-0 flex-1">
						<div class={styles.previewName()}>{wishlistTitle}</div>
						<div class={styles.previewMeta()}>{giftCountLabel}</div>
					</div>
					<span class={styles.previewBadge()}>{m.share_preview_badge()}</span>
				</div>

				<!-- Actions -->
				<div class={styles.actions()}>
					<Button intent="outline" onclick={handleClose}>{m.cancel()}</Button>
					<Button class="flex-1" disabled={isSubmitting} onclick={handleConfirmShare}>
						{m.share_confirm_button()}
						<ArrowRightIcon data-icon="inline-end" />
					</Button>
				</div>
			</div>

			<!-- ═══════════ STEP 2: SHARE METHODS ═══════════ -->
		{:else if step === 'share'}
			<div class="flex items-center justify-between px-6 pt-4">
				<div>
					<div class={styles.shareTitle()}>{m.share_title()}</div>
					<div class={styles.shareSub()}>
						{wishlistTitle} &middot; {giftCountLabel}
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-5 px-6 pb-6 pt-4">
				<!-- Copy link section -->
				<div>
					<div class={styles.sectionEyebrow()}>{m.share_link_eyebrow()}</div>
					<div class={styles.copyLinkRow()}>
						<div class={styles.linkInputWrap()}>
							<span class={styles.linkUrlText()}>
								<strong class={styles.linkUrlDomain()}>
									{shareUrlDisplay.split('/w/')[0]}
								</strong>/w/{sharing.wishlistShortId.current}
							</span>
						</div>
						{#if linkCopied}
							<Button intent="primary" class="h-11 flex-shrink-0" aria-live="polite">
								<CheckIcon data-icon="inline-start" />
								{m.share_link_copied()}
							</Button>
						{:else}
							<Button
								intent="primary"
								class="h-11 flex-shrink-0"
								onclick={() => sharing.copyLink()}
							>
								<CopyIcon data-icon="inline-start" />
								{m.share_copy()}
							</Button>
						{/if}
					</div>
					{#if linkCopied}
						<div class={styles.copiedLabel()} aria-live="polite">
							<CheckIcon class="size-2.5" />
							{m.share_copied()}
						</div>
					{/if}
				</div>

				<!-- Social share buttons -->
				<div>
					<div class={styles.sectionEyebrow()}>{m.share_via_eyebrow()}</div>
					<div class={styles.socialButtonsList()} role="list">
						{#each SHARE_PLATFORM_ORDER as platformKey (platformKey)}
							{@const platform = SHARE_PLATFORM_INFO[platformKey]}
							<ShareMethodButton {platform} {shareUrl} message={shareMessage}>
								{#snippet icon()}
									{#if platformKey === 'whatsapp'}
										<svg
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="currentColor"
											aria-hidden="true"
										>
											<path
												d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"
											/>
										</svg>
									{:else if platformKey === 'email'}
										<svg
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											aria-hidden="true"
										>
											<path
												d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
											/>
											<polyline points="22,6 12,13 2,6" />
										</svg>
									{:else if platformKey === 'messenger'}
										<svg
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="currentColor"
											aria-hidden="true"
										>
											<path
												d="M12 2C6.477 2 2 6.145 2 11.243c0 2.936 1.43 5.556 3.667 7.288V22l3.338-1.834A10.5 10.5 0 0 0 12 20.486c5.523 0 10-4.144 10-9.243C22 6.145 17.523 2 12 2zm1.007 12.44l-2.545-2.71-4.97 2.71 5.467-5.802 2.606 2.71 4.908-2.71-5.466 5.802z"
											/>
										</svg>
									{:else if platformKey === 'telegram'}
										<svg
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="currentColor"
											aria-hidden="true"
										>
											<path
												d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
											/>
										</svg>
									{:else if platformKey === 'sms'}
										<svg
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											aria-hidden="true"
										>
											<path
												d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
											/>
										</svg>
									{/if}
								{/snippet}
							</ShareMethodButton>
						{/each}
					</div>
				</div>

				<!-- Pre-filled message preview -->
				<div class={styles.messagePreview()}>
					<div class={styles.messagePreviewLabel()}>
						{m.share_message_label()}
					</div>
					<div class={styles.messagePreviewText()}>
						{shareMessage}
						{shareUrlDisplay}
					</div>
				</div>

				<!-- Actions -->
				<div class={styles.actions()}>
					<Button intent="outline" onclick={handleClose}>{m.close()}</Button>
					<Button
						class="flex-1"
						onclick={() => sharing.goToStep(SHARE_WIZARD_STEPS.success)}
					>
						{m.share_step_done()}
						<CheckIcon data-icon="inline-end" />
					</Button>
				</div>
			</div>

			<!-- ═══════════ STEP 3: SUCCESS ═══════════ -->
		{:else if step === 'success'}
			<div class="flex flex-col gap-5 px-6 pb-6 pt-2">
				<div class={styles.successHero()}>
					<div class={styles.successIconWrap()}>
						<CircleCheckBigIcon class="size-10" strokeWidth={1.8} />
					</div>
					<div class={styles.successTitle()}>{m.share_success_title()}</div>
					<p class={styles.successSub()}>
						{m.share_success_body({ title: wishlistTitle, url: shareUrlDisplay })}
					</p>
				</div>

				<!-- Permissions guidance card -->
				<div
					class={styles.permissionsCard()}
					role="region"
					aria-label={m.share_permissions_label()}
				>
					<div class={styles.permissionsCardLabel()}>{m.share_permissions_label()}</div>
					<div class={styles.permissionsHeading()}>
						{m.share_permissions_heading()}
					</div>
					<div class={styles.permissionsList()}>
						<div class={styles.permissionRow()}>
							<div class={styles.permissionCheck()} aria-hidden="true">
								<CheckIcon class="size-2.5" />
							</div>
							<span class={styles.permissionText()}>{m.share_permissions_view()}</span
							>
						</div>
						<div class={styles.permissionRow()}>
							<div class={styles.permissionCheck()} aria-hidden="true">
								<CheckIcon class="size-2.5" />
							</div>
							<span class={styles.permissionText()}>{m.share_permissions_add()}</span>
						</div>
						<div class={styles.permissionRow()}>
							<div class={styles.permissionCheck()} aria-hidden="true">
								<CheckIcon class="size-2.5" />
							</div>
							<span class={styles.permissionText()}
								>{m.share_permissions_moderators()}</span
							>
						</div>
						<div class={styles.permissionRow()}>
							<div class={styles.permissionCheck()} aria-hidden="true">
								<CheckIcon class="size-2.5" />
							</div>
							<span class={styles.permissionText()}
								>{m.share_permissions_reshare()}</span
							>
						</div>
					</div>
					<!-- Restriction warning -->
					<div class={styles.permissionsWarning()} role="note">
						<div class={styles.warnX()} aria-hidden="true">
							<XIcon class="size-[9px]" />
						</div>
						<span class={styles.permissionsWarningText()}>
							{m.share_permissions_warning()}
						</span>
					</div>
				</div>

				<!-- Close CTA -->
				<Button class="w-full" onclick={handleClose}>
					{m.share_step_done()}
					<CheckIcon data-icon="inline-end" />
				</Button>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
