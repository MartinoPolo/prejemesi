(() => {
	const root = document.documentElement;
	const query = new URLSearchParams(window.location.search);
	const device = query.get('device') === 'desktop' ? 'desktop' : 'mobile';
	const appearanceDepths = new Set(['soft', 'ink', 'black']);
	const reference = window.toolbarReference?.[device];

	if (!reference) return;
	document.querySelector('[data-device-scene]').dataset.device = device;

	function removeVisualSemantics(element) {
		for (const attribute of [
			'id',
			'data-testid',
			'data-switcher',
			'data-toggle-group-root',
			'role',
			'tabindex',
			'aria-label',
			'aria-checked',
			'aria-pressed',
		]) {
			element.removeAttribute(attribute);
		}
	}

	function createVisualTray(sourceGroup) {
		const visualTray = sourceGroup.cloneNode(true);
		removeVisualSemantics(visualTray);
		visualTray.classList.remove('elevation-owner', 'elevation-owner-raised');
		visualTray.classList.add('elevation-surface');
		visualTray.dataset.proposalSurface = '';
		visualTray.setAttribute('aria-hidden', 'true');

		visualTray.querySelectorAll('button').forEach((sourceButton) => {
			const visualButton = document.createElement('div');
			for (const attribute of sourceButton.attributes) {
				if (
					![
						'id',
						'data-testid',
						'data-segment',
						'role',
						'tabindex',
						'aria-checked',
						'aria-pressed',
						'aria-label',
					].includes(attribute.name)
				) {
					visualButton.setAttribute(attribute.name, attribute.value);
				}
			}
			while (sourceButton.firstChild) visualButton.append(sourceButton.firstChild);
			sourceButton.replaceWith(visualButton);
		});
		visualTray
			.querySelectorAll('[id], [data-testid], [role], [tabindex]')
			.forEach((element) => removeVisualSemantics(element));
		return visualTray;
	}

	const mount = document.querySelector('[data-toolbar-mount]');
	mount.innerHTML = reference.html;
	const toolbar = mount.firstElementChild;
	toolbar.dataset.palette = reference.palette;
	const group = toolbar.querySelector('[data-testid="gift-view-switcher"]');
	group.dataset.switcher = '';
	const buttons = Array.from(group.querySelectorAll(':scope > button'));
	buttons.forEach((button) => {
		button.dataset.segment = button.dataset.value;
		button.setAttribute('aria-pressed', String(button.getAttribute('aria-checked') === 'true'));
	});
	group.append(createVisualTray(group));
	const visualButtons = Array.from(
		group.querySelectorAll(
			':scope > [data-proposal-surface] > [data-slot="toggle-group-item"]',
		),
	);
	let selectedValue = buttons.find((button) => button.getAttribute('aria-checked') === 'true')
		?.dataset.value;

	function setSelection(value, focusButton) {
		selectedValue = value;
		buttons.forEach((button) => {
			const selected = button.dataset.value === selectedValue;
			button.dataset.state = selected ? 'on' : 'off';
			button.setAttribute('aria-pressed', String(selected));
			button.setAttribute('aria-checked', String(selected));
			button.tabIndex = selected ? 0 : -1;
		});
		visualButtons.forEach((button) => {
			button.dataset.state = button.dataset.value === selectedValue ? 'on' : 'off';
		});
		focusButton?.focus();
	}

	function moveSelection(button, direction) {
		const index = buttons.indexOf(button);
		const nextIndex =
			direction === 'home'
				? 0
				: direction === 'end'
					? buttons.length - 1
					: (index + direction + buttons.length) % buttons.length;
		const nextButton = buttons[nextIndex];
		setSelection(nextButton.dataset.value, nextButton);
	}

	buttons.forEach((button) => {
		button.addEventListener('click', () => setSelection(button.dataset.value, button));
		button.addEventListener('keydown', (event) => {
			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
				event.preventDefault();
				moveSelection(button, 1);
			} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				event.preventDefault();
				moveSelection(button, -1);
			} else if (event.key === 'Home') {
				event.preventDefault();
				moveSelection(button, 'home');
			} else if (event.key === 'End') {
				event.preventDefault();
				moveSelection(button, 'end');
			}
		});
	});
	setSelection(selectedValue ?? buttons[0].dataset.value);

	function applyAppearance(appearance) {
		if (!appearance || typeof appearance !== 'object') return;
		if (typeof appearance.dark === 'boolean') root.classList.toggle('dark', appearance.dark);
		if (appearanceDepths.has(appearance.depth)) root.dataset.depth = appearance.depth;
	}

	window.setPreviewAppearance = applyAppearance;
	window.addEventListener('message', (event) => {
		if (event.source === window.parent && event.data?.type === 'switcher-preview-appearance') {
			applyAppearance(event.data);
		}
	});
})();
