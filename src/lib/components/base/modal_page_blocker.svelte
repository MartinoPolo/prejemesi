<!--
	Blocks the page beneath a modal menu or select in place of Bits UI's `pointer-events: none` on
	<body>, an inherited style that restyles every element on large lists. Inside a dialog or sheet
	the overlay already blocks the page, and the dialog itself stays interactive as before.
-->
<script lang="ts">
	import { isInsideModalLayer } from './modal_layer_context.js';

	let { active }: { active: boolean } = $props();

	const insideModalLayer = isInsideModalLayer();
</script>

{#if active && !insideModalLayer}
	<div
		data-slot="modal-page-blocker"
		class="fixed inset-0 z-(--z-modal)"
		aria-hidden="true"
	></div>
{/if}
