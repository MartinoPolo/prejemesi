<script lang="ts">
	import * as Sheet from './index.js';
	import type { Side } from './index.js';

	let { side }: { side: Side } = $props();
</script>

<Sheet.Root open>
	<Sheet.Content {side}>
		<Sheet.Title>Sheet</Sheet.Title>
	</Sheet.Content>
</Sheet.Root>
