<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, within } from 'storybook/test';
	import { Stepper } from './index.js';

	const { Story } = defineMeta({
		title: 'Derived/Stepper',
		component: Stepper,
		tags: ['autodocs'],
		args: {
			stepLabels: ['Základ', 'Oprávnění', 'Token'],
			currentStepIndex: 1,
			label: 'Kroky',
		},
		argTypes: {
			currentStepIndex: { control: { type: 'number', min: 0, max: 2 } },
		},
	});

	const playCurrentStep = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const steps = within(canvasElement).getByRole('list', { name: 'Kroky' });
		const currentSteps = steps.querySelectorAll('[aria-current="step"]');
		await expect(currentSteps).toHaveLength(1);
		await expect(currentSteps[0]).toHaveTextContent('Oprávnění');
	};
</script>

<Story name="Default" play={playCurrentStep} />

<Story name="Every Step">
	{#snippet template(args)}
		<div class="flex max-w-xl flex-col gap-6">
			{#each [0, 1, 2] as currentStepIndex (currentStepIndex)}
				<Stepper {...args} {currentStepIndex} />
			{/each}
		</div>
	{/snippet}
</Story>
