const query = new URLSearchParams(window.location.search);
const device = query.get('device') === 'desktop' ? 'desktop' : 'mobile';
const frame = document.querySelector('iframe');
const widthControl = document.querySelector('[data-width-control]');
const depthControl = document.querySelector('[data-depth-control]');
const modeControl = document.querySelector('[data-mode-control]');
const sizes = device === 'mobile' ? [320, 390, 430] : [1024, 1280, 1440];
const defaultWidth = device === 'mobile' ? 390 : 1280;

document.body.dataset.device = device;
frame.src = `preview.html?device=${device}`;
frame.style.setProperty('--preview-width', `${defaultWidth}px`);
frame.title = `Finální ${device === 'mobile' ? 'mobilní' : 'desktopová'} lišta`;

document.querySelectorAll('[data-device-link]').forEach((link) => {
	if (link.dataset.deviceLink === device) link.setAttribute('aria-current', 'page');
});
for (const width of sizes) {
	const option = document.createElement('option');
	option.value = String(width);
	option.textContent = `${width} px`;
	option.selected = width === defaultWidth;
	widthControl.append(option);
}
function updateAppearance() {
	const dark = document.documentElement.classList.contains('dark');
	document.documentElement.dataset.depth = depthControl.value;
	frame.contentWindow?.postMessage(
		{ type: 'switcher-preview-appearance', dark, depth: depthControl.value },
		'*',
	);
}
widthControl.addEventListener('change', () =>
	frame.style.setProperty('--preview-width', `${widthControl.value}px`),
);
depthControl.addEventListener('change', updateAppearance);
modeControl.addEventListener('click', () => {
	const dark = document.documentElement.classList.toggle('dark');
	modeControl.setAttribute('aria-pressed', String(dark));
	modeControl.textContent = dark ? 'Světlý režim' : 'Tmavý režim';
	updateAppearance();
});
frame.addEventListener('load', updateAppearance);
