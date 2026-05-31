import type { Preview } from '@storybook/svelte';
import '../src/app.css';
import ThemeDecorator from '../src/lib/storybook/ThemeDecorator.svelte';

const preview: Preview = {
	decorators: [() => ({ Component: ThemeDecorator })],
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /date$/i,
			},
		},
		a11y: {
			// 'todo' - show a11y violations in the test UI only
			// 'error' - fail CI on a11y violations
			// 'off' - skip a11y checks entirely
			test: 'todo',
		},
	},
};

export default preview;
