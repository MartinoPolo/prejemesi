<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
	import type { DescriptionAppend } from '$lib/modules/gifts/types.js';
	import GiftDescription from './GiftDescription.svelte';
	import { giftDetailModalVariants } from './gift_detail_modal_variants.js';

	interface Props {
		description: string;
		/** A reserved gift keeps its description; the owner adds notes below it instead. */
		frozen: boolean;
		/** The saved description the gifter reserved against, shown read-only while frozen. */
		savedDescription: string;
		descriptionAppends: DescriptionAppend[];
		appendText: string;
		/** The note being corrected inline, or null. */
		editingAppendIndex: number | null;
		editingAppendText: string;
		graceNow: Date;
		onsaveappend: (index: number) => void | Promise<void>;
		ondeleteappend: (index: number) => void | Promise<void>;
	}

	let {
		description = $bindable(),
		frozen,
		savedDescription,
		descriptionAppends,
		appendText = $bindable(),
		editingAppendIndex = $bindable(),
		editingAppendText = $bindable(),
		graceNow,
		onsaveappend,
		ondeleteappend,
	}: Props = $props();

	function startEditAppend(index: number, text: string) {
		editingAppendIndex = index;
		editingAppendText = text;
	}

	function cancelEditAppend() {
		editingAppendIndex = null;
		editingAppendText = '';
	}
</script>

<div class="flex flex-col gap-1.5" data-testid="gift-description-field">
	{#if frozen}
		<Label>{m.gift_description_label()}</Label>
		{#if savedDescription.trim() !== ''}
			<p class="text-sm whitespace-pre-line text-muted-foreground">{savedDescription}</p>
		{/if}
		<GiftDescription description={null} {descriptionAppends} maxVisibleAppends={1} />
		<!-- Recent description appends can be corrected only during their own grace window. -->
		{#each descriptionAppends as append, index (`${append.addedAt}:${index}`)}
			{#if isWithinGraceWindow(append.addedAt, graceNow)}
				{#if editingAppendIndex === index}
					<div
						class="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-2"
					>
						<Textarea bind:value={editingAppendText} rows={2} />
						<div class="flex gap-(--nested-control-gap)">
							<Button
								size="sm"
								onclick={() => void onsaveappend(index)}
								disabled={editingAppendText.trim() === ''}
							>
								{m.save()}
							</Button>
							<Button size="sm" intent="ghost" onclick={cancelEditAppend}>
								{m.cancel()}
							</Button>
						</div>
					</div>
				{:else}
					<div class="flex w-fit gap-1 rounded-md border border-border bg-surface-2 p-1">
						<Button
							size="sm"
							format="icon"
							intent="ghost"
							aria-label={m.gift_description_append_edit_aria()}
							onclick={() => startEditAppend(index, append.text)}
						>
							<PencilIcon />
						</Button>
						<Button
							size="sm"
							format="icon"
							intent="ghost"
							aria-label={m.gift_description_append_delete_aria()}
							onclick={() => void ondeleteappend(index)}
						>
							<TrashIcon />
						</Button>
					</div>
				{/if}
			{/if}
		{/each}
		<Label class="mt-2">{m.gift_description_add_note_label()}</Label>
		<Textarea bind:value={appendText} rows={2} />
		<HelpText>{m.gift_description_add_note_help()}</HelpText>
	{:else}
		<Label for="gift-description">{m.gift_description_label()}</Label>
		<Textarea
			id="gift-description"
			bind:value={description}
			class={giftDetailModalVariants().descriptionInput()}
			placeholder={m.gift_description_placeholder()}
		/>
	{/if}
</div>
