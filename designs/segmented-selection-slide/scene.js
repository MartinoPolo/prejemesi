(() => {
	const root = document.documentElement;
	const query = new URLSearchParams(window.location.search);
	const device = query.get('device') === 'mobile' ? 'mobile' : 'desktop';
	const contextKey = query.get('context') ?? 'toolbar';
	const frameId = query.get('frame') ?? '';
	const capture = window.appReference?.[device]?.[contextKey];
	if (!capture) return;

	const scene = document.querySelector('[data-scene]');
	const mount = document.querySelector('[data-context-mount]');
	mount.innerHTML = capture.html;
	const container = mount.firstElementChild;
	if (capture.palette) scene.dataset.palette = capture.palette;
	if (capture.fixed) {
		// Dialogs are fixed to the app viewport; keep their captured box in normal flow instead.
		scene.dataset.dialog = '';
		Object.assign(container.style, {
			position: 'relative',
			inset: 'auto',
			transform: 'none',
			translate: 'none',
			animation: 'none',
			margin: '0 auto',
			width: `${capture.width}px`,
			maxWidth: '100%',
			height: `${capture.height}px`,
			maxHeight: 'none'
		});
	} else {
		// Page panels size to the viewport, which here is the auto-sized frame itself.
		container.style.minHeight = '0';
	}

	const optionSelector = ':scope > [role="radio"], :scope > [role="tab"], :scope > a';
	const selectedSelector = '[aria-checked="true"], [aria-selected="true"], [aria-current="page"]';
	const hiddenDecoration = ['background-color', 'border-color', 'box-shadow', 'outline-color'];

	// The connected toolbar switcher paints its selected face on the inner elevation surface.
	const isConnected = (group) => group.classList.contains('segmented-toggle-connected');
	const faceOf = (option) =>
		isConnected(option.parentElement) ? option.querySelector('.elevation-surface') : option;

	// Captured markup has no app runtime; mirror each control's own selected-state attributes.
	function selectOption(option, options) {
		const previous = options.find((element) => element.matches(selectedSelector));
		if (!previous || previous === option) return false;
		if (option.matches('[role="radio"]')) {
			for (const element of options) {
				const isSelected = element === option;
				element.dataset.state = isSelected ? 'on' : 'off';
				element.setAttribute('aria-checked', String(isSelected));
				element.tabIndex = isSelected ? 0 : -1;
			}
		} else if (option.matches('[role="tab"]')) {
			[option.className, previous.className] = [previous.className, option.className];
			option.setAttribute('aria-selected', 'true');
			previous.setAttribute('aria-selected', 'false');
			option.tabIndex = 0;
			previous.tabIndex = -1;
		} else {
			option.setAttribute('aria-current', 'page');
			previous.removeAttribute('aria-current');
		}
		return true;
	}

	function setupGroup(group) {
		const options = [...group.querySelectorAll(optionSelector)];
		group.dataset.slideGroup = isConnected(group) ? 'backing' : 'face';

		function sync(animate) {
			for (const option of options) {
				for (const property of hiddenDecoration) faceOf(option).style.removeProperty(property);
			}
			const selected = options.find((element) => element.matches(selectedSelector));
			const face = selected && faceOf(selected);
			if (!face || face.offsetWidth === 0) {
				delete group.dataset.slideVisible;
				return;
			}
			if (!animate) delete group.dataset.slideReady;
			face.style.setProperty('transition', 'none', 'important');
			const style = getComputedStyle(face);
			// Layout offsets ignore transforms, so pressed faces and animating ancestors measure at rest.
			let x = 0;
			let y = 0;
			for (let element = face; element && element !== group; element = element.offsetParent) {
				x += element.offsetLeft;
				y += element.offsetTop;
			}
			const sides = ['top', 'right', 'bottom', 'left'];
			const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
			const properties = {
				'--slide-x': `${x}px`,
				'--slide-y': `${y}px`,
				'--slide-width': `${face.offsetWidth}px`,
				'--slide-height': `${face.offsetHeight}px`,
				'--slide-background': style.backgroundColor,
				'--slide-border-width': sides.map((side) => style.getPropertyValue(`border-${side}-width`)).join(' '),
				'--slide-border-style': sides.map((side) => style.getPropertyValue(`border-${side}-style`)).join(' '),
				'--slide-border-color': sides.map((side) => style.getPropertyValue(`border-${side}-color`)).join(' '),
				'--slide-radius': corners.map((corner) => style.getPropertyValue(`border-${corner}-radius`)).join(' '),
				'--slide-outline': `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
				'--slide-outline-offset': style.outlineOffset,
				'--slide-shadow': style.boxShadow
			};
			for (const [name, value] of Object.entries(properties)) group.style.setProperty(name, value);
			for (const property of hiddenDecoration) {
				face.style.setProperty(property, property === 'box-shadow' ? 'none' : 'transparent', 'important');
			}
			void getComputedStyle(face).backgroundColor;
			face.style.removeProperty('transition');
			group.dataset.slideVisible = '';
			if (!animate) {
				void getComputedStyle(group, '::after').translate;
				requestAnimationFrame(() => (group.dataset.slideReady = ''));
			}
		}

		group.addEventListener('click', (event) => {
			const option = event.target.closest(optionSelector.replaceAll(':scope > ', ''));
			if (!option || !options.includes(option)) return;
			event.preventDefault();
			if (selectOption(option, options)) sync(true);
		});
		group.addEventListener('keydown', (event) => {
			const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
			const current = options.indexOf(event.target.closest('[role="radio"], [role="tab"]'));
			if (!(event.key in steps) || current === -1) return;
			event.preventDefault();
			const next = options[(current + steps[event.key] + options.length) % options.length];
			next.focus();
			if (selectOption(next, options)) sync(true);
		});
		new ResizeObserver(() => sync(false)).observe(group);
		return () => sync(false);
	}

	const resyncGroups = [...container.querySelectorAll(capture.control)].map(setupGroup);
	const resyncAll = () => requestAnimationFrame(() => resyncGroups.forEach((resync) => resync()));

	function applyAppearance(appearance) {
		if (!appearance || typeof appearance !== 'object') return;
		if (typeof appearance.dark === 'boolean') root.classList.toggle('dark', appearance.dark);
		if (['soft', 'ink', 'black'].includes(appearance.depth)) root.dataset.depth = appearance.depth;
		if (typeof appearance.palette === 'string' && /^[a-z]+$/.test(appearance.palette)) {
			const palette = appearance.palette === 'captured' ? capture.palette : appearance.palette;
			if (palette) scene.dataset.palette = palette;
			else delete scene.dataset.palette;
		}
		resyncAll();
	}

	function reportHeight() {
		window.parent?.postMessage(
			{ type: 'slide-study-height', frame: frameId, height: scene.getBoundingClientRect().height },
			'*'
		);
	}

	applyAppearance({
		depth: query.get('depth'),
		dark: query.has('dark') ? query.get('dark') === '1' : undefined
	});
	window.addEventListener('message', (event) => {
		if (event.source === window.parent && event.data?.type === 'slide-study-appearance') {
			applyAppearance(event.data);
		}
	});
	// Dialog bodies scroll; centre the control in its own scroller without moving the review page.
	function revealControl() {
		const control = container.querySelector(capture.control);
		for (let scroller = control?.parentElement; scroller && scroller !== container.parentElement; scroller = scroller.parentElement) {
			if (scroller.scrollHeight <= scroller.clientHeight) continue;
			const offset = control.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
			scroller.scrollTop += offset - scroller.clientHeight / 2;
			return;
		}
	}
	revealControl();
	new ResizeObserver(reportHeight).observe(scene);
	document.fonts.ready.then(() => {
		reportHeight();
		resyncAll();
	});
})();
