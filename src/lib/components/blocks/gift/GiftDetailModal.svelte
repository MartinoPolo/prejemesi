<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import {
		giftDetailModalVariants,
		type GiftDetailModalMode,
	} from './gift_detail_modal_variants.js';
	import type { GiftByRole, CreateGiftInput, UpdateGiftInput } from '$lib/modules/gifts/types.js';
	import type { GiftPriorityLevel } from '$lib/modules/gifts/types.js';
	import GiftDetailForm from './GiftDetailForm.svelte';

	interface Props {
		open: boolean;
		mode: GiftDetailModalMode;
		gift?: GiftByRole | null;
		wishlistId: string;
		priorityLevels: GiftPriorityLevel[];
		isOwner?: boolean;
		canEdit?: boolean;
		canDelete?: boolean;
		isSubmitting?: boolean;
		isDeleting?: boolean;
		oncreate?: (input: CreateGiftInput) => void;
		onupdate?: (input: UpdateGiftInput) => void;
		ondelete?: (giftId: string) => void;
		onreceived?: (giftId: string, received: boolean) => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		mode,
		gift = null,
		wishlistId,
		priorityLevels,
		isOwner = false,
		canEdit = true,
		canDelete = true,
		isSubmitting = false,
		isDeleting = false,
		oncreate,
		onupdate,
		ondelete,
		onreceived,
		onclose,
	}: Props = $props();

	const styles = giftDetailModalVariants();
	const isEdit = $derived(mode === 'edit');
	const title = $derived(isEdit ? m.gift_edit_title() : m.gift_add_title());

	function handleOpenChange(newOpen: boolean) {
		if (!newOpen) {
			onclose?.();
		}
		open = newOpen;
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class={styles.content()} showCloseButton={true}>
		<Dialog.Title class="sr-only">{title}</Dialog.Title>
		<Dialog.Description class="sr-only">
			{isEdit ? m.gift_edit_description() : m.gift_add_description()}
		</Dialog.Description>

		<GiftDetailForm
			{mode}
			{gift}
			{wishlistId}
			{priorityLevels}
			{isOwner}
			{canEdit}
			{canDelete}
			{isSubmitting}
			{isDeleting}
			{oncreate}
			{onupdate}
			{ondelete}
			{onreceived}
		/>
	</Dialog.Content>
</Dialog.Root>
