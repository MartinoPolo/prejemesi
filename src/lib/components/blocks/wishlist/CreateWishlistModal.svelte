<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { DatePicker } from '$lib/components/derived/date-picker/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import RecipientPreview from './RecipientPreview.svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import { createWishlist } from '$lib/modules/wishlists/wishlists.remote.js';
	import { RECIPIENT_KIND, RECIPIENT_NAME_MAX_LENGTH } from '$lib/modules/wishlists/types.js';
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
						}
					: {
							recipientKind: RECIPIENT_KIND.self,
							title: trimmedTitle,
							eventDate,
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
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_create_title()}</Dialog.Title>
			<Dialog.Description>{m.wishlist_create_description()}</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} novalidate class="flex flex-col gap-4">
			<ToggleGroup.Root
				type="single"
				intent="outline"
				value={recipientKind}
				onValueChange={(newValue) => {
					if (newValue !== '') recipientKind = newValue;
					// Treat each switch into the recipient field as a fresh start — no error on appear.
					recipientTouched = false;
				}}
				disabled={isSubmitting}
				class="border-ink shadow-sticker-sm rounded-btn w-full gap-0 overflow-hidden border-2"
			>
				<!-- Each item drops its own sticker chrome (border/shadow/radius/lift) so the two
				     segments read as one connected control; the outer Root carries the unified
				     ink border, radius, and offset shadow. The shadow cancels need `!`: the
				     sticker chrome's shadow-sticker/hover:shadow-sticker-lift/active:shadow-sticker-sm
				     are custom theme values tailwind-merge can't dedupe, and Tailwind emits them
				     after shadow-none, so a plain shadow-none loses the cascade and the hovered
				     segment (stacking-context'd by hover:translate-y-0) paints its 7px offset
				     shadow over the adjacent segment. border-transparent is repeated on the
				     data-[state=on] variant so the active segment's `border-ink` (from the
				     outline toggle intent) doesn't paint an inner ring. The second segment adds a
				     single ink left divider (immune to state) to avoid a double-thick middle border. -->
				<ToggleGroup.Item
					value={RECIPIENT_KIND.self}
					class="flex-1 rounded-none border-transparent shadow-none! hover:translate-y-0 hover:shadow-none! active:scale-100 active:shadow-none! data-[state=on]:border-transparent"
				>
					{m.create_for_toggle_self()}
				</ToggleGroup.Item>
				<ToggleGroup.Item
					value={RECIPIENT_KIND.other}
					class="flex-1 rounded-none border-transparent shadow-none! hover:translate-y-0 hover:shadow-none! active:scale-100 active:shadow-none! border-l-ink border-l-2 data-[state=on]:border-transparent data-[state=on]:border-l-ink"
				>
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
						<p class="text-muted-foreground text-sm">
							{m.create_recipient_name_helper()}
						</p>
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
				<Label for="wishlist-event-date">{m.wishlist_event_date_label()}</Label>
				<DatePicker
					id="wishlist-event-date"
					bind:value={eventDate}
					disabled={isSubmitting}
				/>
			</div>

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
					onclick={() => handleOpenChange(false)}
					disabled={isSubmitting}
				>
					{m.cancel()}
				</Button>
				<Button type="submit" disabled={isSubmitting}>
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
