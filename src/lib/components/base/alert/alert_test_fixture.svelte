<script lang="ts">
	import '../../../../app.css';
	import * as Alert from './index.js';
	import type { AlertTone } from './alert_variants.js';

	let { tone }: { tone: AlertTone } = $props();
</script>

<Alert.Root {tone}>
	<Alert.Title>Title</Alert.Title>
	<Alert.Description>Description</Alert.Description>
</Alert.Root>
