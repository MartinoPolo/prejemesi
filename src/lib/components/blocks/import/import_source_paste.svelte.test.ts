import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import ImportSourcePaste from './ImportSourcePaste.svelte';

function pasteEvent(text: string): ClipboardEvent {
	const event = new Event('paste', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'clipboardData', {
		value: {
			getData: (type: string) => (type === 'text/plain' ? text : ''),
		},
	});
	return event as ClipboardEvent;
}

describe('ImportSourcePaste', () => {
	it('keeps the paste surface read-only while parsing pasted tabular text', () => {
		const onparsed = vi.fn();
		const screen = render(ImportSourcePaste, {
			onparsed,
			onerror: vi.fn(),
			disabled: false,
		});
		const pasteSurface = screen.getByRole('textbox');
		const event = pasteEvent('Název\tCena\nKniha\t299');

		expect(pasteSurface.element()).toHaveProperty('readOnly', true);
		pasteSurface.element().dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		expect(onparsed).toHaveBeenCalledWith({
			rows: [
				['Název', 'Cena'],
				['Kniha', '299'],
			],
		});
	});
});
