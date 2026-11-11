<script lang="ts">
	import * as Carousel from './index.js';

	let { onkeydown }: { onkeydown?: (event: KeyboardEvent) => void } = $props();
</script>

<Carousel.Root tabindex={0} aria-label="Example row" class="w-64" {onkeydown}>
	<Carousel.Content>
		{#each ['First', 'Second', 'Third', 'Fourth'] as name (name)}
			<Carousel.Item class="basis-40">
				<!-- A slide control that owns its arrow keys, like a gallery inside a card. -->
				<button type="button" onkeydown={(event) => event.preventDefault()}>{name}</button>
			</Carousel.Item>
		{/each}
	</Carousel.Content>
</Carousel.Root>
