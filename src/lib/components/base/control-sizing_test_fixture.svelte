<script lang="ts">
	import '../../../app.css';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from './button/index.js';
	import { Checkbox, CheckboxSurface, checkboxVariants } from './checkbox/index.js';
	import { Input } from './input/index.js';
	import * as InputGroup from './input-group/index.js';
	import * as Select from './select/index.js';
	import { Toggle } from './toggle/index.js';
	import * as SegmentedToggle from '../derived/segmented-toggle/index.js';
	import { CONTROL_SIZES } from './control_sizing.js';

	let selected = $state('one');
	let segmented = $state('one');
	let checked = $state(false);
	let dynamicInputGroupSize = $state<'sm' | 'xl'>('sm');
</script>

<div data-testid="explicit-matrix">
	{#each CONTROL_SIZES as size (size)}
		<div data-size={size}>
			<Button {size} aria-label={`Text button ${size}`}><CheckIcon data-icon />Button</Button>
			<Button {size} format="icon" aria-label={`Button ${size}`}
				><CheckIcon data-icon /></Button
			>
			<Input {size} aria-label={`Input ${size}`} />
			<Select.Root type="single" bind:value={selected}>
				<Select.Trigger {size} aria-label={`Select ${size}`}>One</Select.Trigger>
			</Select.Root>
			<Checkbox {size} aria-label={`Checkbox ${size}`} checked />
			<Toggle {size} format="icon" aria-label={`Toggle ${size}`}
				><CheckIcon data-icon /></Toggle
			>
			<SegmentedToggle.Root {size} bind:value={segmented} aria-label={`Switcher ${size}`}>
				<SegmentedToggle.Item value="one" format="icon" aria-label={`Switcher item ${size}`}
					><CheckIcon data-icon /></SegmentedToggle.Item
				>
			</SegmentedToggle.Root>
		</div>
	{/each}
</div>

<div data-testid="input-group-explicit-matrix">
	{#each CONTROL_SIZES as size (size)}
		<div data-size={size}>
			<Input {size} aria-label={`Standalone input group peer ${size}`} />
			<InputGroup.Root {size} aria-label={`Input group ${size}`}>
				<InputGroup.Input aria-label={`Inherited input group control ${size}`} />
				<InputGroup.Addon align="inline-end">unit</InputGroup.Addon>
			</InputGroup.Root>
		</div>
	{/each}
</div>

<Input aria-label="Standalone responsive input group peer" />
<InputGroup.Root aria-label="Responsive input group">
	<InputGroup.Input aria-label="Responsive inherited input group control" />
</InputGroup.Root>

<Input size="sm" aria-label="Standalone overridden input group peer" />
<InputGroup.Root size="xl" aria-label="Override input group">
	<InputGroup.Input size="sm" aria-label="Overridden input group control" />
</InputGroup.Root>

<Input size={dynamicInputGroupSize} aria-label="Standalone dynamic input group peer" />
<InputGroup.Root size={dynamicInputGroupSize} aria-label="Dynamic input group">
	<InputGroup.Input aria-label="Dynamic inherited input group control" />
</InputGroup.Root>
<button
	type="button"
	onclick={() => (dynamicInputGroupSize = dynamicInputGroupSize === 'sm' ? 'xl' : 'sm')}
>
	Change input group size
</button>

<div data-testid="responsive-matrix">
	<Button aria-label="Responsive button">Responsive button</Button>
	<Input aria-label="Responsive input" />
	<Select.Root type="single" bind:value={selected}
		><Select.Trigger aria-label="Responsive select">One</Select.Trigger></Select.Root
	>
	<Checkbox aria-label="Responsive checkbox" />
	<Toggle>Responsive toggle</Toggle>
	<SegmentedToggle.Root bind:value={segmented} aria-label="Responsive switcher">
		<SegmentedToggle.Item value="one">A label</SegmentedToggle.Item>
	</SegmentedToggle.Root>
</div>

<div data-testid="nonsemantic-checkbox-owner" class={checkboxVariants({ size: 'md' }).owner()}>
	<CheckboxSurface size="md" checked />
</div>

<Checkbox aria-label="Interactive checkbox" bind:checked />
<Checkbox aria-label="Mixed checkbox" indeterminate />
<Checkbox aria-label="Disabled checkbox" disabled />
