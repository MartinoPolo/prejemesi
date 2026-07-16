<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { resolve } from '$app/paths';
	import { getLocalizedAuthHref } from '$lib/i18n/locale.js';
	import { reserveModalVariants } from './reserve_modal_variants.js';
	import { formatPrice } from '$lib/modules/gifts/gift_display.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { ReserveGiftInput } from '$lib/modules/reservations/types.js';
	import TurnstileWidget from '$lib/components/blocks/security/TurnstileWidget.svelte';

	interface ReserveModalProps {
		open: boolean;
		gift: GiftForVisitor | null;
		redirectHref: string;
		isAuthenticated: boolean;
		isSubmitting?: boolean;
		onreserve?: (input: ReserveGiftInput) => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		gift,
		redirectHref,
		isAuthenticated,
		isSubmitting = false,
		onreserve,
		onclose,
	}: ReserveModalProps = $props();

	const styles = reserveModalVariants();

	// Form state
	let quantity = $state(1);
	let anonymousName = $state('');
	let anonymousEmail = $state('');
	let nameError = $state('');
	let quantityError = $state('');
	let turnstileToken = $state<string | null>(null);
	let turnstileResetSignal = $state(0);

	// Computed
	const maxQuantity = $derived(gift ? (gift.quantity ?? 1) : 1);
	const reservedCount = $derived(gift?.reservedCount ?? 0);
	const availableCount = $derived(maxQuantity - reservedCount);
	const showQuantitySelector = $derived(maxQuantity > 1);
	const priceDisplay = $derived(
		gift ? formatPrice(gift.price, gift.currency, gift.priceMax) : '',
	);

	function incrementQuantity() {
		if (quantity < availableCount) {
			quantity += 1;
		}
	}

	function decrementQuantity() {
		if (quantity > 1) {
			quantity -= 1;
		}
	}

	function validate(): boolean {
		nameError = '';
		quantityError = '';

		if (!isAuthenticated && anonymousName.trim() === '') {
			nameError = m.reserve_name_required();
			return false;
		}

		if (quantity < 1 || quantity > availableCount) {
			quantityError = m.reserve_quantity_error({ max: availableCount });
			return false;
		}

		return true;
	}

	async function handleSubmit() {
		if (gift === null || !validate()) {
			return;
		}

		await onreserve?.({
			giftId: gift.id,
			quantity,
			anonymousName: !isAuthenticated ? anonymousName.trim() : undefined,
			anonymousEmail:
				!isAuthenticated && anonymousEmail.trim() !== ''
					? anonymousEmail.trim()
					: undefined,
			turnstileToken: !isAuthenticated ? (turnstileToken ?? undefined) : undefined,
		});
		if (!isAuthenticated) {
			turnstileToken = null;
			turnstileResetSignal += 1;
		}
	}

	function handleOpenChange(newOpen: boolean) {
		if (newOpen) {
			quantity = 1;
			anonymousName = '';
			anonymousEmail = '';
			nameError = '';
			quantityError = '';
			turnstileToken = null;
			turnstileResetSignal += 1;
		} else {
			onclose?.();
		}
		open = newOpen;
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class={styles.content()} showCloseButton={true}>
		<Dialog.Header>
			<Dialog.Title>{m.reserve_title()}</Dialog.Title>
			<Dialog.Description class="sr-only">{m.reserve_description()}</Dialog.Description>
		</Dialog.Header>

		{#if gift}
			<div class={styles.body()}>
				<!-- Gift summary -->
				<div class={styles.giftSummary()}>
					<GiftImage
						class={styles.giftImage()}
						imageUrl={gift.imageUrl}
						imageMeta={gift.imageMeta}
						target="square"
						alt={gift.name}
					/>
					<div class={styles.giftInfo()}>
						<p class={styles.giftName()}>{gift.name}</p>
						<p class={styles.giftAvailability()}>
							{#if showQuantitySelector}
								{m.gift_available({
									available: availableCount,
									total: maxQuantity,
								})}
							{:else}
								{priceDisplay}
							{/if}
						</p>
					</div>
				</div>

				<!-- Quantity selector (only for multi-quantity gifts) -->
				{#if showQuantitySelector}
					<div class={styles.formField()}>
						<Label>{m.reserve_quantity_label()}</Label>
						<div class={styles.quantityRow()}>
							<Button
								size="icon"
								intent="outline"
								disabled={quantity <= 1}
								onclick={decrementQuantity}
								aria-label={m.reserve_quantity_decrease()}
							>
								<MinusIcon />
							</Button>
							<span class="min-w-[3ch] text-center text-lg font-semibold">
								{quantity}
							</span>
							<Button
								size="icon"
								intent="outline"
								disabled={quantity >= availableCount}
								onclick={incrementQuantity}
								aria-label={m.reserve_quantity_increase()}
							>
								<PlusIcon />
							</Button>
							<span class={styles.quantityLabel()}>
								{m.reserve_quantity_of({ count: availableCount })}
							</span>
						</div>
						{#if quantityError}
							<span class={styles.errorText()}>{quantityError}</span>
						{/if}
					</div>
				{/if}

				<!-- Anonymous form (not authenticated) -->
				{#if !isAuthenticated}
					<Separator />

					<div class={styles.formField()}>
						<Label for="reserve-name">{m.reserve_name_label()}</Label>
						<Input
							id="reserve-name"
							bind:value={anonymousName}
							placeholder={m.reserve_name_placeholder()}
							aria-invalid={nameError !== '' ? true : undefined}
						/>
						{#if nameError}
							<span class={styles.errorText()}>{nameError}</span>
						{/if}
					</div>

					<div class={styles.formField()}>
						<Label for="reserve-email">{m.reserve_email_label()}</Label>
						<Input
							id="reserve-email"
							bind:value={anonymousEmail}
							placeholder={m.reserve_email_placeholder()}
							type="email"
						/>
					</div>

					{#key turnstileResetSignal}
						<TurnstileWidget bind:token={turnstileToken} />
					{/key}

					<div class={styles.authPrompt()}>
						<p class={styles.authPromptText()}>
							{m.reserve_auth_prompt()}
						</p>
						<div class={styles.authPromptLinks()}>
							<a
								href={getLocalizedAuthHref(resolve('/login'), redirectHref)}
								class="text-primary hover:underline"
							>
								{m.reserve_login()}
							</a>
							<span class={styles.separator()}>{m.or()}</span>
							<a
								href={getLocalizedAuthHref(resolve('/register'), redirectHref)}
								class="text-primary hover:underline"
							>
								{m.reserve_register()}
							</a>
						</div>
					</div>
				{/if}

				<!-- Actions -->
				<div class={styles.actions()}>
					<Button intent="outline" onclick={() => handleOpenChange(false)}
						>{m.cancel()}</Button
					>
					<Button
						disabled={isSubmitting || (!isAuthenticated && turnstileToken === null)}
						onclick={handleSubmit}
					>
						{#if isSubmitting}
							{m.reserve_submitting()}
						{:else}
							{m.reserve_submit()}
						{/if}
					</Button>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
