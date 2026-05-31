<script lang="ts">
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { resolve } from '$app/paths';
	import { reserveModalVariants } from './reserve-modal-variants.js';
	import { formatPrice } from '$lib/modules/gifts/gift-display.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { ReserveGiftInput } from '$lib/modules/reservations/types.js';

	interface ReserveModalProps {
		open: boolean;
		gift: GiftForVisitor | null;
		isAuthenticated: boolean;
		isSubmitting?: boolean;
		onreserve?: (input: ReserveGiftInput) => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		gift,
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

	// Computed
	const maxQuantity = $derived(gift ? (gift.quantity ?? 1) : 1);
	const reservedCount = $derived(gift?.reservedCount ?? 0);
	const availableCount = $derived(maxQuantity - reservedCount);
	const showQuantitySelector = $derived(maxQuantity > 1);
	const priceDisplay = $derived(gift ? formatPrice(gift.price, gift.currency) : '');

	// Reset form when modal opens
	$effect(() => {
		if (open) {
			quantity = 1;
			anonymousName = '';
			anonymousEmail = '';
			nameError = '';
			quantityError = '';
		}
	});

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
			nameError = 'Jmeno je povinne';
			return false;
		}

		if (quantity < 1 || quantity > availableCount) {
			quantityError = `Mnozstvi musi byt 1 az ${availableCount}`;
			return false;
		}

		return true;
	}

	function handleSubmit() {
		if (gift === null || !validate()) {
			return;
		}

		onreserve?.({
			giftId: gift.id,
			quantity,
			anonymousName: !isAuthenticated ? anonymousName.trim() : undefined,
			anonymousEmail:
				!isAuthenticated && anonymousEmail.trim() !== ''
					? anonymousEmail.trim()
					: undefined,
		});
	}

	function handleOpenChange(newOpen: boolean) {
		if (!newOpen) {
			onclose?.();
		}
		open = newOpen;
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class={styles.content()} showCloseButton={true}>
		<Dialog.Header>
			<Dialog.Title>Rezervovat darek</Dialog.Title>
			<Dialog.Description class="sr-only">Formular pro rezervaci darku</Dialog.Description>
		</Dialog.Header>

		{#if gift}
			<div class={styles.body()}>
				<!-- Gift summary -->
				<div class={styles.giftSummary()}>
					<div class={styles.giftImage()}>
						{#if gift.imageUrl}
							<img
								src={gift.imageUrl}
								alt={gift.name}
								class={styles.giftImageElement()}
							/>
						{:else}
							<div class={styles.giftImagePlaceholder()}>
								<GiftIcon class="size-5 text-muted-foreground/40" />
							</div>
						{/if}
					</div>
					<div class={styles.giftInfo()}>
						<p class={styles.giftName()}>{gift.name}</p>
						<p class={styles.giftAvailability()}>
							{#if showQuantitySelector}
								Dostupne: {availableCount} z {maxQuantity}
							{:else}
								{priceDisplay}
							{/if}
						</p>
					</div>
				</div>

				<!-- Quantity selector (only for multi-quantity gifts) -->
				{#if showQuantitySelector}
					<div class={styles.formField()}>
						<Label>Pocet</Label>
						<div class={styles.quantityRow()}>
							<Button
								size="icon"
								variant="outline"
								disabled={quantity <= 1}
								onclick={decrementQuantity}
								aria-label="Snizit pocet"
							>
								<MinusIcon class="size-4" />
							</Button>
							<span class="min-w-[3ch] text-center text-lg font-semibold">
								{quantity}
							</span>
							<Button
								size="icon"
								variant="outline"
								disabled={quantity >= availableCount}
								onclick={incrementQuantity}
								aria-label="Zvysit pocet"
							>
								<PlusIcon class="size-4" />
							</Button>
							<span class={styles.quantityLabel()}>
								z {availableCount} dostupnych
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
						<Label for="reserve-name">Vase jmeno *</Label>
						<Input
							id="reserve-name"
							bind:value={anonymousName}
							placeholder="Jan Novak"
							aria-invalid={nameError !== '' ? true : undefined}
						/>
						{#if nameError}
							<span class={styles.errorText()}>{nameError}</span>
						{/if}
					</div>

					<div class={styles.formField()}>
						<Label for="reserve-email">E-mail (volitelne)</Label>
						<Input
							id="reserve-email"
							bind:value={anonymousEmail}
							placeholder="jan@email.cz"
							type="email"
						/>
					</div>

					<div class={styles.authPrompt()}>
						<p class={styles.authPromptText()}>
							Pro spravcu rezervaci se muzete prihlasit.
						</p>
						<div class={styles.authPromptLinks()}>
							<a href={resolve('/login')} class="text-primary hover:underline">
								Prihlasit se
							</a>
							<span class={styles.separator()}>nebo</span>
							<a href={resolve('/register')} class="text-primary hover:underline">
								Registrovat
							</a>
						</div>
					</div>
				{/if}

				<!-- Actions -->
				<div class={styles.actions()}>
					<Button variant="outline" onclick={() => handleOpenChange(false)}>
						Zrusit
					</Button>
					<Button disabled={isSubmitting} onclick={handleSubmit}>
						{#if isSubmitting}
							Rezervuji...
						{:else}
							Rezervovat
						{/if}
					</Button>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
