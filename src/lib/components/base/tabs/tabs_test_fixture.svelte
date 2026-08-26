<script lang="ts">
	import { Tabs, Tab } from './index.js';

	let { disabledSecond = false }: { disabledSecond?: boolean } = $props();
	let active = $state('First');
</script>

<Tabs aria-label="Example tabs" class="max-w-48 overflow-x-auto">
	<Tab active={active === 'First'} onclick={() => (active = 'First')}>First</Tab>
	<Tab active={active === 'Second'} disabled={disabledSecond} onclick={() => (active = 'Second')}
		>Second</Tab
	>
	<Tab active={active === 'Third'} onclick={() => (active = 'Third')}>Third</Tab>
	<Tab active={active === 'Fourth'} onclick={() => (active = 'Fourth')}>Fourth</Tab>
</Tabs>
