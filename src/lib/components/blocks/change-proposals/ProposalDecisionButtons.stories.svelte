<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, userEvent, within } from 'storybook/test';
	import ProposalDecisionButtons from './ProposalDecisionButtons.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/ChangeProposals/ProposalDecisionButtons',
		component: ProposalDecisionButtons,
		tags: ['autodocs'],
		args: {
			testIdPrefix: 'change-review',
			onrejectall: fn(),
			onacceptall: fn(),
		},
		argTypes: {
			testIdPrefix: { control: 'select', options: ['change-review', 'chat-proposal'] },
		},
	});
</script>

<Story
	name="Review Page"
	play={async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByTestId('change-review-reject-all'));
		await expect(args.onrejectall).toHaveBeenCalledOnce();
		await userEvent.click(canvas.getByTestId('change-review-accept-all'));
		await expect(args.onacceptall).toHaveBeenCalledOnce();
	}}
>
	{#snippet template(args)}
		<div class="flex gap-(--nested-control-gap)">
			<ProposalDecisionButtons {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Chat" args={{ testIdPrefix: 'chat-proposal', size: 'md' }}>
	{#snippet template(args)}
		<div class="flex gap-2">
			<ProposalDecisionButtons {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Pending" args={{ disabled: true }}>
	{#snippet template(args)}
		<div class="flex gap-(--nested-control-gap)">
			<ProposalDecisionButtons {...args} />
		</div>
	{/snippet}
</Story>
