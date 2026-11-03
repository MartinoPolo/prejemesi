<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import DecisionToggle from './DecisionToggle.svelte';
	import { DECISION_TOGGLE_FORMATS, DECISION_TOGGLE_TONES } from './decision_toggle_variants.js';

	const { Story } = defineMeta({
		title: 'Blocks/ChangeProposals/DecisionToggle',
		component: DecisionToggle,
		tags: ['autodocs'],
		args: {
			tone: 'accept',
			icon: CheckIcon,
			label: 'Přijmout',
			pressed: false,
		},
		argTypes: {
			format: { control: 'select', options: [...DECISION_TOGGLE_FORMATS] },
			tone: { control: 'select', options: [...DECISION_TOGGLE_TONES] },
			pressed: { control: 'select', options: [true, false, 'mixed'] },
		},
	});
</script>

<script lang="ts">
	let fieldDecision = $state<'accepted' | 'rejected' | null>(null);
	let editorOpen = $state(false);
	let deleteChoice = $state<boolean | null>(null);

	function toggleFieldDecision(decision: 'accepted' | 'rejected') {
		fieldDecision = fieldDecision === decision ? null : decision;
	}

	function chooseDelete(choice: boolean) {
		deleteChoice = deleteChoice === choice ? null : choice;
	}
</script>

<Story name="Playground" />

<Story
	name="Icon Format"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const accept = canvas.getByRole('button', { name: 'Přijmout: Cena' });
		await expect(accept).toHaveAttribute('aria-pressed', 'false');
		await userEvent.click(accept);
		await expect(accept).toHaveAttribute('aria-pressed', 'true');
		await userEvent.click(accept);
		await expect(accept).toHaveAttribute('aria-pressed', 'false');
	}}
>
	{#snippet template()}
		<span class="flex gap-1" role="group" aria-label="Rozhodnutí: Cena">
			<DecisionToggle
				format="icon"
				tone="accept"
				icon={CheckIcon}
				label="Přijmout: Cena"
				title="Přijmout"
				pressed={fieldDecision === 'accepted'}
				onclick={() => toggleFieldDecision('accepted')}
			/>
			<DecisionToggle
				format="icon"
				tone="reject"
				icon={XIcon}
				label="Zamítnout: Cena"
				title="Zamítnout"
				pressed={fieldDecision === 'rejected'}
				onclick={() => toggleFieldDecision('rejected')}
			/>
			<DecisionToggle
				format="icon"
				tone="edit"
				icon={PencilIcon}
				label="Upravit hodnotu: Cena"
				title="Upravit"
				aria-expanded={editorOpen}
				onclick={() => (editorOpen = !editorOpen)}
			/>
		</span>
	{/snippet}
</Story>

<Story name="Text Format">
	{#snippet template()}
		<div class="flex flex-col gap-3">
			<span class="flex gap-1" role="group" aria-label="Rozhodnutí: Smazání">
				<DecisionToggle
					tone="danger"
					icon={Trash2Icon}
					label="Smazat"
					pressed={deleteChoice === true}
					onclick={() => chooseDelete(true)}
				/>
				<DecisionToggle
					tone="reject"
					icon={XIcon}
					label="Ponechat"
					pressed={deleteChoice === false}
					onclick={() => chooseDelete(false)}
				/>
			</span>
			<span class="flex gap-1" role="group" aria-label="Celý dárek">
				<DecisionToggle
					tone="accept"
					icon={CheckIcon}
					label="Přijmout vše"
					pressed="mixed"
					compactOnPhone
				/>
				<DecisionToggle
					tone="reject"
					icon={XIcon}
					label="Zamítnout vše"
					pressed="false"
					compactOnPhone
				/>
			</span>
		</div>
	{/snippet}
</Story>
