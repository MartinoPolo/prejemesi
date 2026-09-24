<script lang="ts">
	import { VIEW_MODES, type ViewMode } from '$lib/modules/wishlists/dashboard_types.js';
	import ViewToggle from './ViewToggle.svelte';

	let viewMode = $state<ViewMode>(VIEW_MODES.grid);
</script>

<ViewToggle bind:value={viewMode} />
<output data-testid="parent-view-mode">{viewMode}</output>
