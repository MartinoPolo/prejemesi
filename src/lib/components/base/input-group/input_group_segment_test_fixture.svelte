<script lang="ts">
	import '../../../../app.css';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import * as InputGroup from './index.js';

	interface Props {
		decorative?: boolean;
		onCopy?: () => void;
	}

	let { decorative = false, onCopy }: Props = $props();
</script>

<div style="width: 320px">
	<InputGroup.Root size="xl" data-testid="copy-field">
		<InputGroup.Input value="prejemesi.cz/w/vanoce" readonly aria-label="Odkaz" />
		<InputGroup.Segment {decorative} onclick={onCopy}>
			<CopyIcon />
			Kopírovat
		</InputGroup.Segment>
	</InputGroup.Root>
</div>
