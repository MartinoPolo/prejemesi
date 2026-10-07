<script lang="ts">
	import * as SegmentedToggle from './index.js';
	import type { SegmentedTogglePresentation } from './index.js';

	let { presentation = 'default' }: { presentation?: SegmentedTogglePresentation } = $props();
	let value = $state('first');
</script>

<div class="flex w-[400px] flex-col">
	<SegmentedToggle.Root bind:value aria-label="Layout" size="md" {presentation}>
		<SegmentedToggle.Item value="first">First</SegmentedToggle.Item>
		<SegmentedToggle.Item value="second">Second</SegmentedToggle.Item>
		<SegmentedToggle.Item value="third">Third</SegmentedToggle.Item>
	</SegmentedToggle.Root>
</div>
<button type="button" onclick={() => (value = 'third')}>Select third programmatically</button>
<output data-testid="bound-value">{value}</output>
