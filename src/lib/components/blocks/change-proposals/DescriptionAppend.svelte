<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	/** Text the change adds to the end of a gift's description. */
	let { text }: { text: string } = $props();
</script>

<div class="append">
	<span class="append-label">{m.change_review_append_label()}</span>
	<ins class="append-text"><span class="sr-only">{m.change_review_diff_added()} </span>{text}</ins
	>
</div>

<style>
	.append {
		flex-basis: 100%;
		padding: 6px var(--space-3);
		border-left: 4px solid var(--accent-loud);
		border-radius: 0 10px 10px 0;
		background: color-mix(in oklab, var(--accent-loud) 16%, var(--card));
		font-size: var(--text-md);
	}

	.append-label {
		display: block;
		color: var(--muted-foreground);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	.append-text {
		padding: 0 var(--space-1);
		border-radius: 4px;
		background: color-mix(in oklab, var(--status-success) 14%, var(--card));
		color: var(--diff-new-color, var(--status-success-text));
		font-weight: var(--diff-new-weight, 600);
		text-decoration: none;
	}

	.append-text::before {
		content: '+ ';
		font-weight: 800;
	}
</style>
