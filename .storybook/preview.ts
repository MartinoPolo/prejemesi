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
			test: 'todo',
		},
	},
};

export default preview;
