<script lang="ts">
	import * as ContextMenu from './context-menu/index.js';
	import * as Popover from './popover/index.js';
	import * as Select from './select/index.js';

	interface Props {
		kind: 'select' | 'popover' | 'context-menu';
		shadowedTrigger?: boolean;
	}

	let { kind, shadowedTrigger }: Props = $props();
</script>

<div style:padding="120px 40px">
	{#if kind === 'select'}
		<Select.Root type="single" open>
			<Select.Trigger data-testid="floating-trigger">Vyberte</Select.Trigger>
			<Select.Content data-testid="floating-content">
				<Select.Item value="first" label="První">První</Select.Item>
			</Select.Content>
		</Select.Root>
	{:else if kind === 'popover'}
		<Popover.Root open>
			<Popover.Trigger data-testid="floating-trigger">Otevřít</Popover.Trigger>
			<Popover.Content data-testid="floating-content" {shadowedTrigger}>Obsah</Popover.Content
			>
		</Popover.Root>
	{:else}
		<ContextMenu.Root>
			<ContextMenu.Trigger data-testid="floating-trigger">
				<div style:width="200px" style:height="80px">Pravé tlačítko</div>
			</ContextMenu.Trigger>
			<ContextMenu.Content data-testid="floating-content">
				<ContextMenu.Item>Položka</ContextMenu.Item>
			</ContextMenu.Content>
		</ContextMenu.Root>
	{/if}
</div>
