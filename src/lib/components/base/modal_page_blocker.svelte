<!--
	Blocks the page beneath a modal layer in place of Bits UI's `pointer-events: none` on <body>, an
	inherited style that restyles every element on large lists. A menu or select inside a dialog or
	sheet leaves that layer interactive, because its overlay already blocks the page. A dialog or
	sheet keeps blocking through its exit animation, after its overlay has unmounted, so a tap cannot
	act on the page before a handed-off action runs.
-->
<script lang="ts">
	import { isInsideModalLayer } from './modal_layer_context.js';

	let {
		active,
		blockEnclosingLayer = false,
	}: {
		active: boolean;
		/** Also block a dialog or sheet this layer is nested in. */
		blockEnclosingLayer?: boolean;
	} = $props();

	const insideModalLayer = isInsideModalLayer();
</script>

{#if active && (blockEnclosingLayer || !insideModalLayer)}
	<div
		data-slot="modal-page-blocker"
		class="fixed inset-0 z-(--z-modal)"
		aria-hidden="true"
	></div>
{/if}
