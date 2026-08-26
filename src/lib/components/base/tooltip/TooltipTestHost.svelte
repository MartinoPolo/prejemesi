<script lang="ts">
	import * as Tooltip from './index.js';

	let { side = 'top' }: { side?: 'top' | 'bottom' | 'left' | 'right' } = $props();
</script>

<Tooltip.Provider>
	<div class="flex min-h-40 min-w-80 items-center justify-center">
		<Tooltip.Root open={true}>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<button {...props} type="button">Trigger</button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content {side} sideOffset={8} class="max-w-none bg-[#123456] px-[21px]">
				Tooltip content
			</Tooltip.Content>
		</Tooltip.Root>
	</div>
</Tooltip.Provider>
