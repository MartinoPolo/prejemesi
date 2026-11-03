<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import { stepperVariants, stepProgress, type StepperProps } from './stepper_variants.js';

	let { stepLabels, currentStepIndex, label, ref = $bindable(null) }: StepperProps = $props();

	const styles = stepperVariants();
</script>

<ol bind:this={ref} class={styles.root()} aria-label={label} data-slot="stepper">
	{#each stepLabels as stepLabel, index (index)}
		{@const progress = stepProgress(index, currentStepIndex)}
		{@const stepStyles = stepperVariants({ progress })}
		{#if index > 0}
			<li class={styles.connector()} aria-hidden="true">
				<div
					class={styles.connectorFill()}
					data-stepper-connector={index}
					style:transform="scaleX({index <= currentStepIndex ? 1 : 0})"
				></div>
			</li>
		{/if}
		<li
			class={stepStyles.step()}
			aria-current={progress === 'current' ? 'step' : undefined}
			data-progress={progress}
		>
			<span class={stepStyles.marker()}>
				{#if progress === 'completed'}
					<CheckIcon class="size-3.5" aria-hidden="true" />
				{:else}
					{index + 1}
				{/if}
			</span>
			<span class={stepStyles.label()}>{stepLabel}</span>
		</li>
	{/each}
</ol>
