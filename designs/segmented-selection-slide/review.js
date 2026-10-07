const contexts = [
	{
		key: 'toolbar',
		title: 'Wishlist toolbar · gift view switcher',
		description: 'Connected presentation: the tinted backing carries the shadow, the selected face is flat.'
	},
	{
		key: 'dashboard',
		title: 'Dashboard (Moje seznamy) · view toggle',
		description: 'Default presentation: flat tint, outlined selected face, no shadow.'
	},
	{
		key: 'image-source',
		title: 'Add-gift dialog · image source',
		description:
			'Default presentation inside the scrolling dialog body, scrolled to the image field, with the proposed tray fix: the tint hugs both options instead of spanning the field.'
	},
	{
		key: 'settings-tabs',
		title: 'Wishlist settings dialog · tabs',
		description:
			'Bordered track with an elevated selected tab. The track scrolls horizontally and clips vertically, as in the app.'
	},
	{
		key: 'auth-tabs',
		title: 'Login card · tabs',
		description: 'Bordered track with an elevated selected tab. In the app these are links to /login and /register.'
	}
];

const container = document.querySelector('[data-variants]');
const template = document.querySelector('[data-variant-template]');
const form = document.querySelector('.review-controls');
const frames = [];

function readControls() {
	const value = (name) => form.querySelector(`[name="${name}"]:checked`)?.value;
	return {
		device: value('device'),
		depth: value('depth'),
		dark: value('mode') === 'dark',
		palette: form.querySelector('[name="palette"]').value
	};
}

function postAppearance(frame) {
	const { depth, dark, palette } = readControls();
	frame.contentWindow?.postMessage(
		{ type: 'slide-study-appearance', depth, dark, palette },
		'*'
	);
}

function render() {
	const { device, depth, dark } = readControls();
	document.documentElement.dataset.depth = depth;
	document.documentElement.classList.toggle('dark', dark);
	document.body.dataset.device = device;
	for (const { key, frame } of frames) {
		const source = `scene.html?device=${device}&context=${key}&frame=${key}`;
		if (!frame.src.endsWith(source)) frame.src = source;
		else postAppearance(frame);
	}
}

for (const context of contexts) {
	const section = template.content.firstElementChild.cloneNode(true);
	section.querySelector('[data-variant-title]').textContent = context.title;
	section.querySelector('[data-variant-description]').textContent = context.description;
	const frame = section.querySelector('iframe');
	frame.title = context.title;
	frame.addEventListener('load', () => postAppearance(frame));
	frames.push({ key: context.key, frame });
	container.append(section);
}

window.addEventListener('message', (event) => {
	if (event.data?.type !== 'slide-study-height') return;
	const match = frames.find(({ key }) => key === event.data.frame);
	if (match && event.source === match.frame.contentWindow) {
		match.frame.style.height = `${Math.ceil(event.data.height)}px`;
	}
});
form.addEventListener('change', render);
render();
