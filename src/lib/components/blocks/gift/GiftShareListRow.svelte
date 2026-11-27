<script lang="ts">
	import LockIcon from '@lucide/svelte/icons/lock';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import Avatar from '$lib/components/derived/avatar/Avatar.svelte';
	import { choiceRowVariants } from '$lib/components/derived/choice-row/index.js';
	import { cn } from '$lib/utils.js';
	import { getInitials } from '$lib/utils/initials.js';

	interface Props {
		checkboxId: string;
		checked: boolean;
		disabled?: boolean;
		recipientName: string;
		recipientImage: string | null;
		/** The list's title, or null when the viewer may not see which list it is. */
		wishlistTitle: string | null;
		/** A short muted remark after the names, such as „tento seznam“. */
		note?: string | null;
		/** The row's list stays in the share whatever the viewer does, marked with a lock. */
		locked?: boolean;
		/** The row stays as `checked` says; a click only asks for the change. */
		oncheckedchange?: (checked: boolean) => void;
	}

	let {
		checkboxId,
		checked,
		disabled = false,
		recipientName,
		recipientImage,
		wishlistTitle,
		note = null,
		locked = false,
		oncheckedchange,
	}: Props = $props();
</script>

<label
	for={checkboxId}
	class={cn(
		choiceRowVariants({ selected: checked }),
		'gap-2.5 px-2.5 py-1.5',
		disabled && 'cursor-not-allowed',
	)}
	data-testid="gift-share-list-row"
>
	<Checkbox
		id={checkboxId}
		size="sm"
		bind:checked={() => checked, (value) => oncheckedchange?.(value)}
		{disabled}
	/>
	<Avatar
		appearance="recipient"
		src={recipientImage}
		alt=""
		initials={getInitials(recipientName)}
	/>
	<span data-slot="choice-row-label" class="flex min-w-0 flex-col">
		<span class="truncate">{recipientName}</span>
		{#if wishlistTitle !== null || note !== null}
			<span class="truncate text-xs font-normal text-muted-foreground">
				{[wishlistTitle, note].filter((part) => part !== null).join(' · ')}
			</span>
		{/if}
	</span>
	{#if locked}
		<LockIcon
			class="ms-auto size-4 shrink-0 text-muted-foreground"
			aria-hidden="true"
			data-testid="gift-share-row-lock"
		/>
	{/if}
</label>
