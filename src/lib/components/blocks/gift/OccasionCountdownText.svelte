<script lang="ts">
	import { INLINE_TEXT_SEPARATOR } from '$lib/utils/inline_text_separator.js';

	interface Props {
		/** Occasion label, or null for Jiná, which names nothing worth showing. */
		occasionLabel: string | null;
		/** „za 12 dní", „proběhlo" once the event passed, or null without an event date. */
		countdownLabel: string | null;
	}

	let { occasionLabel, countdownLabel }: Props = $props();

	const separatorDot = INLINE_TEXT_SEPARATOR.trim();
	const [separatorLeadingSpace, separatorTrailingSpace] =
		INLINE_TEXT_SEPARATOR.split(separatorDot);
</script>

<!-- One inline root keeps a flex parent's gap from splitting the segments. Only the dot is hidden
	from screen readers, so the spaces still mark the word boundary. -->
<span
	>{#if occasionLabel !== null}{occasionLabel}{/if}{#if occasionLabel !== null && countdownLabel !== null}{separatorLeadingSpace}<span
			aria-hidden="true">{separatorDot}</span
		>{separatorTrailingSpace}{/if}{#if countdownLabel !== null}{countdownLabel}{/if}</span
>
