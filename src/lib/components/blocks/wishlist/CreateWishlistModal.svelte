<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Accordion from '$lib/components/base/accordion/index.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { DatePicker } from '$lib/components/derived/date-picker/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import RecipientPreview from './RecipientPreview.svelte';
	import WishlistPalettePicker from './WishlistPalettePicker.svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import { createWishlist } from '$lib/modules/wishlists/wishlists.remote.js';
	import { RECIPIENT_KIND, RECIPIENT_NAME_MAX_LENGTH } from '$lib/modules/wishlists/types.js';
	import { DEFAULT_PALETTE, type Palette } from '$lib/theme/palettes.js';
	import type { Attachment } from 'svelte/attachments';

	interface CreateWishlistModalProps {
		open: boolean;
		onimport?: () => void;
	}

	let { open = $bindable(false), onimport }: CreateWishlistModalProps = $props();

	// Typed as string (not RecipientKind) because ToggleGroup's single-select
	// value binding is `string`; comparisons against RECIPIENT_KIND narrow it.
	let recipientKind = $state<string>(RECIPIENT_KIND.self);
	let recipientName = $state('');
	let title = $state('');
	let eventDate = $state<Date | null>(null);
	let isSubmitting = $state(false);
	// Server/submit-level error (network or createWishlist failure). Field-level
	// "required" validation is handled by the per-field derived errors below.
	let errorMessage = $state('');
	// Optional metadata behind the "Další nastavení" accordion (issue #112).
	let description = $state('');
	let palette = $state<Palette>(DEFAULT_PALETTE);
	// Track whether the user has interacted with each required field so validation
	// only surfaces after a submit attempt or after the user edits then clears the
	// field — never on a freshly opened dialog.
	let titleTouched = $state(false);
	let recipientTouched = $state(false);

	const trimmedTitle = $derived(title.trim());
	const trimmedRecipientName = $derived(recipientName.trim());
	const isRecipientRequired = $derived(recipientKind === RECIPIENT_KIND.other);

	const titleError = $derived(
		titleTouched && trimmedTitle === '' ? m.wishlist_name_required() : '',
	);
	const recipientError = $derived(
		recipientTouched && isRecipientRequired && trimmedRecipientName === ''
			? m.create_recipient_name_required()
			: '',
	);

	// Focus the recipient-name input the moment the "other" branch mounts.
	const autofocusOnMount: Attachment<HTMLInputElement> = (node) => {
		node.focus();
	};

	function resetForm() {
		recipientKind = RECIPIENT_KIND.self;
		recipientName = '';
		title = '';
		eventDate = null;
		description = '';
		palette = DEFAULT_PALETTE;
		errorMessage = '';
		isSubmitting = false;
		titleTouched = false;
		recipientTouched = false;
	}

	function handleOpenChange(nextOpen: boolean) {
		open = nextOpen;
		if (!nextOpen) {
			resetForm();
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';

		// Mark required fields touched so their inline errors surface on an empty submit.
		titleTouched = true;
		if (isRecipientRequired) {
			recipientTouched = true;
		}

		if (trimmedTitle === '' || (isRecipientRequired && trimmedRecipientName === '')) {
			return;
		}

		isSubmitting = true;

		try {
			const created = await createWishlist(
				recipientKind === RECIPIENT_KIND.other
					? {
							recipientKind: RECIPIENT_KIND.other,
							recipientName: trimmedRecipientName,
							title: trimmedTitle,
							eventDate,
							palette,
							description: description.trim() || null,
						}
					: {
							recipientKind: RECIPIENT_KIND.self,
							title: trimmedTitle,
							eventDate,
							palette,
							description: description.trim() || null,
						},
			);

			// No dashboard refresh: we navigate straight to the new wishlist, and list
			// surfaces (pages, nav dropdowns) re-fetch when they are next opened (issue #108).
			open = false;
			resetForm();
			await goto(localizeInternalHref(resolve('/(app)/w/[id]', { id: created.shortId })));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : m.wishlist_create_error();
			isSubmitting = false;
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<!-- Top-anchored (override the base's vertical centering) so height changes from the
	     recipient toggle, the "more settings" accordion, or validation errors grow the box
	     downward instead of re-centering it — otherwise every height change shifts the top
	     edge and the modal "jumps". `max-h`/`overflow` still cap tall content on short/mobile
	     viewports; horizontal centering (left-1/2, -translate-x-1/2) is inherited unchanged. -->
	<Dialog.Content class="top-[10vh] max-h-[85vh] translate-y-0 overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_create_title()}</Dialog.Title>
			<Dialog.Description>{m.wishlist_create_description()}</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} novalidate class="flex flex-col gap-4">
			<ToggleGroup.Root
				type="single"
				intent="outline"
				size="lg"
				value={recipientKind}
				onValueChange={(newValue) => {
					if (newValue !== '') recipientKind = newValue;
					// Treat each switch into the recipient field as a fresh start — no error on appear.
					recipientTouched = false;
				}}
				disabled={isSubmitting}
				class="w-full gap-2"
			>
				<ToggleGroup.Item value={RECIPIENT_KIND.self} class="flex-1">
					{m.create_for_toggle_self()}
				</ToggleGroup.Item>
				<ToggleGroup.Item value={RECIPIENT_KIND.other} class="flex-1">
					{m.create_for_toggle_other()}
				</ToggleGroup.Item>
			</ToggleGroup.Root>

			{#if recipientKind === RECIPIENT_KIND.other}
				<Field
					fieldId="wishlist-recipient-name"
					label={m.create_recipient_name_label()}
					errorMessage={recipientError}
				>
					{#snippet children({ hasError, errorId }: FieldControlContext)}
						<Input
							id="wishlist-recipient-name"
							size="lg"
							bind:value={recipientName}
							placeholder={m.create_recipient_name_placeholder()}
							maxlength={RECIPIENT_NAME_MAX_LENGTH}
							required
							disabled={isSubmitting}
							state={hasError ? 'error' : 'default'}
							aria-invalid={hasError ? true : undefined}
							aria-describedby={errorId}
							oninput={() => (recipientTouched = true)}
							{@attach autofocusOnMount}
						/>
					{/snippet}
					{#snippet help()}
						<HelpText>{m.create_recipient_name_helper()}</HelpText>
					{/snippet}
				</Field>
				<RecipientPreview name={recipientName} />
			{/if}

			<Field
				fieldId="wishlist-title"
				label={m.wishlist_name_label()}
				errorMessage={titleError}
			>
				{#snippet children({ hasError, errorId }: FieldControlContext)}
					<Input
						id="wishlist-title"
						size="lg"
						bind:value={title}
						placeholder={m.wishlist_name_placeholder()}
						required
						disabled={isSubmitting}
						state={hasError ? 'error' : 'default'}
						aria-invalid={hasError ? true : undefined}
						aria-describedby={errorId}
						oninput={() => (titleTouched = true)}
					/>
				{/snippet}
			</Field>

			<div class="flex flex-col gap-2">
				<Label id="wishlist-event-date-label">{m.wishlist_event_date_label()}</Label>
				<DatePicker
					id="wishlist-event-date"
					ariaLabelledby="wishlist-event-date-label"
					size="lg"
					bind:value={eventDate}
					disabled={isSubmitting}
				/>
			</div>

			<!-- Optional metadata (issue #112): collapsed by default so the create flow stays
			     one field + title; power users can name a description and pick a palette upfront.
			     The dashed divider above + 8px/-8px spacing make the optional zone read as a
			     compact cluster (settled spec §4.8), tighter than the form's 16px gap-4; the
			     solid divider below is the import Separator sibling. -->
			<Accordion.Root
				type="single"
				class="border-t-2 border-dashed border-ink-faint pt-2 -mb-2"
			>
				<Accordion.Item value="more-settings" class="border-b-0">
					<Accordion.Trigger
						class="py-2 text-muted-foreground hover:text-foreground hover:no-underline"
					>
						<span class="flex items-center">
							<SlidersHorizontalIcon
								class="mr-2 size-4 shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
							{m.create_more_settings()}
						</span>
					</Accordion.Trigger>
					<Accordion.Content class="pb-0">
						<div class="flex flex-col gap-4 pt-1">
							<div class="flex flex-col gap-2">
								<Label for="wishlist-create-description"
									>{m.wishlist_description_label()}</Label
								>
								<Textarea
									id="wishlist-create-description"
									bind:value={description}
									placeholder={m.wishlist_description_placeholder()}
									disabled={isSubmitting}
								/>
							</div>
							<div class="flex flex-col gap-2">
								<Label id="wishlist-create-palette-label"
									>{m.create_palette_label()}</Label
								>
								<div role="group" aria-labelledby="wishlist-create-palette-label">
									<WishlistPalettePicker
										value={palette}
										onchange={(nextPalette) => (palette = nextPalette)}
										disabled={isSubmitting}
									/>
								</div>
							</div>
						</div>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>

			{#if errorMessage !== ''}
				<p class="text-destructive text-sm">{errorMessage}</p>
			{/if}

			{#if onimport}
				<Separator class="my-1" />
				<div class="flex items-center gap-2">
					<span class="text-muted-foreground text-sm">{m.or()}</span>
					<Button
						type="button"
						intent="ghost"
						size="sm"
						disabled={isSubmitting}
						onclick={() => {
							open = false;
							resetForm();
							onimport();
						}}
					>
						<FileUpIcon data-icon="inline-start" />
						{m.import_wizard_title()}
					</Button>
				</div>
			{/if}

			<Dialog.Footer>
				<Button
					type="button"
					intent="outline"
					size="lg"
					onclick={() => handleOpenChange(false)}
					disabled={isSubmitting}
				>
					{m.cancel()}
				</Button>
				<Button type="submit" size="lg" disabled={isSubmitting}>
					{#if isSubmitting}
						<LoaderIcon class="animate-spin" data-icon="inline-start" />
						{m.creating()}
					{:else}
						{m.create()}
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
