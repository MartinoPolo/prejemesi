/* Shared mockup engine: geometry identical to src/lib/modules/images/crop.ts (cover window
   size 1/zoom on the bounding axis, origin = focal% * (1 - size)), a fixed true-size crop
   window with the image panned/zoomed behind it, live in-context previews, and the
   persisted image_meta each edit would save. */

// ── Geometry ────────────────────────────────────────────────────────────────
const ZOOM_MAX = 3;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const coverScale = (image, frameWidth, frameHeight) =>
	Math.max(frameWidth / image.w, frameHeight / image.h);
const containZoom = (image, frameWidth, frameHeight) =>
	Math.min(frameWidth / image.w, frameHeight / image.h) / coverScale(image, frameWidth, frameHeight);
const CENTERED = () => ({ mode: 'cover', focal: { x: 50, y: 50 }, zoom: 1 });

function layoutImage(image, frameWidth, frameHeight, meta) {
	if (meta.mode === 'contain') {
		const scale = Math.min(frameWidth / image.w, frameHeight / image.h);
		const width = image.w * scale;
		const height = image.h * scale;
		return { x: (frameWidth - width) / 2, y: (frameHeight - height) / 2, w: width, h: height };
	}
	const scale = coverScale(image, frameWidth, frameHeight) * meta.zoom;
	const width = image.w * scale;
	const height = image.h * scale;
	return {
		x: (meta.focal.x / 100) * (frameWidth - width),
		y: (meta.focal.y / 100) * (frameHeight - height),
		w: width,
		h: height,
	};
}

function focalFromOffset(offset, frameSize, imageSize) {
	const travel = frameSize - imageSize;
	return Math.abs(travel) < 0.5 ? 50 : clamp((offset / travel) * 100, 0, 100);
}

/** Fit is cover at the frame's contain zoom, so editing from Fit starts from what is shown. */
function toCoverMeta(image, frameWidth, frameHeight, meta) {
	return meta.mode === 'contain'
		? { mode: 'cover', focal: { x: 50, y: 50 }, zoom: containZoom(image, frameWidth, frameHeight) }
		: meta;
}

function panMeta(image, frameWidth, frameHeight, meta, dx, dy) {
	const cover = toCoverMeta(image, frameWidth, frameHeight, meta);
	const layout = layoutImage(image, frameWidth, frameHeight, cover);
	return {
		mode: 'cover',
		zoom: cover.zoom,
		focal: {
			x: focalFromOffset(layout.x + dx, frameWidth, layout.w),
			y: focalFromOffset(layout.y + dy, frameHeight, layout.h),
		},
	};
}

function zoomMetaAt(image, frameWidth, frameHeight, meta, nextZoom, pointX, pointY) {
	const cover = toCoverMeta(image, frameWidth, frameHeight, meta);
	const zoom = clamp(nextZoom, containZoom(image, frameWidth, frameHeight), ZOOM_MAX);
	const layout = layoutImage(image, frameWidth, frameHeight, cover);
	const anchorX = (pointX - layout.x) / layout.w;
	const anchorY = (pointY - layout.y) / layout.h;
	const scale = coverScale(image, frameWidth, frameHeight) * zoom;
	const width = image.w * scale;
	const height = image.h * scale;
	return {
		mode: 'cover',
		zoom,
		focal: {
			x: focalFromOffset(pointX - anchorX * width, frameWidth, width),
			y: focalFromOffset(pointY - anchorY * height, frameHeight, height),
		},
	};
}

/** Normalized source window (the persisted editing cropRect) for a frame aspect. */
function cropRectOf(image, frameWidth, frameHeight, meta) {
	const layout = layoutImage(image, frameWidth, frameHeight, meta);
	return {
		x: -layout.x / layout.w,
		y: -layout.y / layout.h,
		w: frameWidth / layout.w,
		h: frameHeight / layout.h,
	};
}

// ── Generated source photos ─────────────────────────────────────────────────
const SOURCES = {
	landscape: { label: 'Na šířku 2400×1600', w: 2400, h: 1600 },
	portrait: { label: 'Na výšku 1200×1800', w: 1200, h: 1800 },
	panorama: { label: 'Panorama 3600×1200', w: 3600, h: 1200 },
};

function paintScene(kind) {
	const spec = SOURCES[kind];
	const canvas = document.createElement('canvas');
	canvas.width = spec.w;
	canvas.height = spec.h;
	const g = canvas.getContext('2d');
	const W = spec.w;
	const H = spec.h;
	const unit = Math.min(W, H) / 1000;
	const wall = g.createLinearGradient(0, 0, W, H);
	wall.addColorStop(0, '#f4e7d3');
	wall.addColorStop(1, '#e6cfb0');
	g.fillStyle = wall;
	g.fillRect(0, 0, W, H);
	// Window with daylight.
	const windowX = W * 0.08;
	const windowY = H * 0.08;
	g.fillStyle = '#cfe8fb';
	g.fillRect(windowX, windowY, W * 0.22, H * 0.42);
	g.strokeStyle = '#fff';
	g.lineWidth = 14 * unit;
	g.strokeRect(windowX, windowY, W * 0.22, H * 0.42);
	g.beginPath();
	g.moveTo(windowX + W * 0.11, windowY);
	g.lineTo(windowX + W * 0.11, windowY + H * 0.42);
	g.moveTo(windowX, windowY + H * 0.21);
	g.lineTo(windowX + W * 0.22, windowY + H * 0.21);
	g.stroke();
	// Wall stripes for zoom detail.
	g.strokeStyle = 'rgba(160,120,80,0.10)';
	g.lineWidth = 3 * unit;
	for (let x = 0; x < W; x += 40 * unit) {
		g.beginPath();
		g.moveTo(x, 0);
		g.lineTo(x, H * 0.66);
		g.stroke();
	}
	// Table with wood grain.
	const tableTop = H * 0.66;
	g.fillStyle = '#9a6a43';
	g.fillRect(0, tableTop, W, H - tableTop);
	g.strokeStyle = 'rgba(60,35,15,0.25)';
	g.lineWidth = 2 * unit;
	for (let y = tableTop + 10 * unit; y < H; y += 18 * unit) {
		g.beginPath();
		g.moveTo(0, y);
		for (let x = 0; x <= W; x += 60 * unit) g.lineTo(x, y + Math.sin(x / (90 * unit) + y) * 4 * unit);
		g.stroke();
	}
	g.fillStyle = '#7d5232';
	g.fillRect(0, tableTop, W, 16 * unit);

	const radio = (cx, base, size) => {
		const w = 300 * size * unit;
		const h = 190 * size * unit;
		const x = cx - w / 2;
		const y = base - h;
		g.fillStyle = 'rgba(40,20,5,0.25)';
		g.beginPath();
		g.ellipse(cx, base + 4 * unit, w * 0.55, 12 * size * unit, 0, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = '#c8402f';
		roundRect(g, x, y, w, h, 28 * size * unit);
		g.fill();
		g.fillStyle = '#f6ead8';
		roundRect(g, x + w * 0.06, y + h * 0.14, w * 0.52, h * 0.72, 14 * size * unit);
		g.fill();
		g.fillStyle = '#5b3a24';
		for (let row = 0; row < 7; row++)
			for (let col = 0; col < 11; col++) {
				g.beginPath();
				g.arc(x + w * 0.1 + col * w * 0.042, y + h * 0.22 + row * h * 0.085, 4.2 * size * unit, 0, Math.PI * 2);
				g.fill();
			}
		g.fillStyle = '#f6ead8';
		g.beginPath();
		g.arc(x + w * 0.78, y + h * 0.38, h * 0.17, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = '#16385c';
		g.beginPath();
		g.arc(x + w * 0.78, y + h * 0.38, h * 0.06, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = '#16385c';
		g.font = `700 ${26 * size * unit}px Georgia, serif`;
		g.textAlign = 'center';
		g.fillText('TESLA', x + w * 0.78, y + h * 0.82);
		g.fillStyle = '#3a2416';
		g.fillRect(x + w * 0.62, y - 70 * size * unit, 5 * size * unit, 72 * size * unit);
	};
	const plant = (cx, base, size) => {
		const potW = 120 * size * unit;
		g.fillStyle = '#2f8f5b';
		for (let i = 0; i < 9; i++) {
			g.save();
			g.translate(cx, base - 110 * size * unit);
			g.rotate(-1.2 + i * 0.3);
			g.beginPath();
			g.ellipse(0, -90 * size * unit, 26 * size * unit, 90 * size * unit, 0, 0, Math.PI * 2);
			g.fill();
			g.restore();
		}
		g.fillStyle = '#e0e7ef';
		roundRect(g, cx - potW / 2, base - 120 * size * unit, potW, 120 * size * unit, 12 * size * unit);
		g.fill();
	};
	const books = (x, base, size) => {
		const colors = ['#1265a8', '#ffc93c', '#14a56f', '#8b5cf6'];
		colors.forEach((color, i) => {
			g.fillStyle = color;
			g.fillRect(x - i * 6 * unit, base - (i + 1) * 34 * size * unit, (230 - i * 14) * size * unit, 32 * size * unit);
		});
	};
	const mug = (cx, base, size) => {
		g.fillStyle = '#ffffff';
		roundRect(g, cx - 45 * size * unit, base - 110 * size * unit, 90 * size * unit, 110 * size * unit, 10 * size * unit);
		g.fill();
		g.strokeStyle = '#ffffff';
		g.lineWidth = 14 * size * unit;
		g.beginPath();
		g.arc(cx + 52 * size * unit, base - 60 * size * unit, 24 * size * unit, -1.2, 1.2);
		g.stroke();
		g.fillStyle = '#1e9be9';
		g.fillRect(cx - 45 * size * unit, base - 80 * size * unit, 90 * size * unit, 18 * size * unit);
	};

	const tableBase = tableTop + 40 * unit;
	if (kind === 'landscape') {
		books(W * 0.12, tableBase, 1.1);
		plant(W * 0.42, tableBase, 1.3);
		mug(W * 0.55, tableBase, 0.8);
		radio(W * 0.78, tableBase, 0.75);
	} else if (kind === 'portrait') {
		plant(W * 0.25, tableBase, 1);
		radio(W * 0.62, tableBase, 0.95);
		mug(W * 0.88, tableBase, 0.7);
	} else {
		radio(W * 0.1, tableBase, 0.55);
		books(W * 0.4, tableBase, 1);
		plant(W * 0.62, tableBase, 1.2);
		mug(W * 0.88, tableBase, 0.8);
	}
	return { url: canvas.toDataURL('image/jpeg', 0.86), w: W, h: H };
}

function roundRect(g, x, y, w, h, r) {
	g.beginPath();
	g.moveTo(x + r, y);
	g.arcTo(x + w, y, x + w, y + h, r);
	g.arcTo(x + w, y + h, x, y + h, r);
	g.arcTo(x, y + h, x, y, r);
	g.arcTo(x, y, x + w, y, r);
	g.closePath();
}

const sourceCache = {};
const currentImage = () => (sourceCache[S.source] ??= paintScene(S.source));

// ── Targets & slots (crop_targets.ts) ───────────────────────────────────────
const GIFT_TARGETS = {
	square: {
		label: 'Karta',
		aspectLabel: '4:3',
		real: { desktop: { w: 356, h: 267 }, mobile: { w: 178, h: 134 } },
	},
	thumb: {
		label: 'Seznam a rezervace',
		aspectLabel: '1:1',
		real: { desktop: { w: 146, h: 146 }, mobile: { w: 146, h: 146 } },
	},
};
const WISHLIST_SLOTS = {
	card: {
		label: 'Karta v Přehledu',
		aspectLabel: '2,84:1',
		real: { desktop: { w: 364, h: 128 }, mobile: { w: 342, h: 128 } },
	},
	thumbnail: {
		label: 'Polaroid a miniatury',
		aspectLabel: '1:1',
		real: { desktop: { w: 146, h: 146 }, mobile: { w: 146, h: 146 } },
	},
	social: {
		label: 'Náhled při sdílení',
		aspectLabel: '1,91:1',
		real: { desktop: { w: 1200, h: 630 }, mobile: { w: 1200, h: 630 } },
	},
};
const MODE_LABELS = { fill: 'Vyplnit', fit: 'Přizpůsobit', manual: 'Ručně' };
/** Mobile List row heights driven by content; the frame width stays fixed. */
const MOBILE_ROW = {
	width: 96,
	variants: { short: 'Krátký', two: '2 řádky', long: 'S popisem' },
	heights: { short: 96, two: 118, long: 160 },
};
/** Window-normalized x band of the square thumb composition still visible in the mobile List row. */
export function mobileBand() {
	// Fit letterboxes the whole photo into the row frame itself, so nothing is side-clipped.
	if (resolveMeta('thumb').mode === 'contain') return null;
	const visible = Math.min(1, MOBILE_ROW.width / MOBILE_ROW.heights[S.rowVariant]);
	return { from: (1 - visible) / 2, to: (1 + visible) / 2 };
}

// ── State ───────────────────────────────────────────────────────────────────
const S = {
	editor: 'gift',
	device: 'desktop',
	source: 'landscape',
	ghost: true,
	rowVariant: 'long',
	gift: { mode: 'fill', active: 'square', targets: {}, mat: 'dots' },
	wishlist: {
		active: 'card',
		mat: 'dots',
		slots: { card: { mode: 'fill' }, thumbnail: { mode: 'fill' }, social: { mode: 'fill' } },
	},
	ui: {},
};

const activeKey = () => (S.editor === 'gift' ? S.gift.active : S.wishlist.active);
const activeSpec = () => (S.editor === 'gift' ? GIFT_TARGETS : WISHLIST_SLOTS)[activeKey()];
const activeMode = () =>
	S.editor === 'gift' ? S.gift.mode : S.wishlist.slots[S.wishlist.active].mode;
const currentMat = () => (S.editor === 'gift' ? S.gift.mat : S.wishlist.mat);

/** What a consumer of `key` renders right now (gift target or wishlist slot). */
function resolveMeta(key) {
	if (key in GIFT_TARGETS) {
		if (S.gift.mode === 'fill') return CENTERED();
		if (S.gift.mode === 'fit') return { mode: 'contain' };
		return S.gift.targets[key] ?? (key === 'thumb' ? S.gift.targets.square : null) ?? CENTERED();
	}
	const slot = S.wishlist.slots[key];
	if (slot.mode === 'fill') return CENTERED();
	if (slot.mode === 'fit') return { mode: 'contain' };
	return slot.meta ?? CENTERED();
}

/** True when the thumb consumer currently borrows the Karta crop (targets.thumb ?? targets.square). */
const thumbBorrowsSquare = () =>
	S.editor === 'gift' && S.gift.mode === 'manual' && !S.gift.targets.thumb && !!S.gift.targets.square;

function setMode(mode) {
	if (S.editor === 'gift') {
		if (mode === 'manual' && S.gift.mode !== 'manual') {
			S.gift.targets = {};
		}
		S.gift.mode = mode;
	} else {
		const slot = S.wishlist.slots[S.wishlist.active];
		if (mode === 'manual' && slot.mode !== 'manual') slot.meta = undefined;
		slot.mode = mode;
	}
	rerender();
}

function setActive(key) {
	if (S.editor === 'gift') S.gift.active = key;
	else S.wishlist.active = key;
	rerender();
}

/** Any pan/zoom edits the active crop; touching Fill/Fit framing promotes to Manual. */
function editActive(meta) {
	let promoted = false;
	if (S.editor === 'gift') {
		if (S.gift.mode !== 'manual') {
			S.gift.mode = 'manual';
			S.gift.targets = {};
			promoted = true;
		}
		S.gift.targets[S.gift.active] = meta;
	} else {
		const slot = S.wishlist.slots[S.wishlist.active];
		if (slot.mode !== 'manual') {
			slot.mode = 'manual';
			promoted = true;
		}
		slot.meta = meta;
	}
	// Refresh in place: a re-render would replace the stage mid-gesture and drop pointer capture/focus.
	if (promoted) toast('Přepnuto na Ručně – ořez se uloží jen pro „' + activeSpec().label + '“');
	refresh();
}

function resetActive() {
	editActive(CENTERED());
}

function wholeImageActive() {
	const real = activeSpec().real[S.device];
	const image = currentImage();
	editActive({ mode: 'cover', focal: { x: 50, y: 50 }, zoom: containZoom(image, real.w, real.h) });
}

function zoomActiveBy(factor) {
	const real = activeSpec().real[S.device];
	const image = currentImage();
	const meta = toCoverMeta(image, real.w, real.h, resolveMeta(activeKey()));
	editActive(zoomMetaAt(image, real.w, real.h, meta, meta.zoom * factor, real.w / 2, real.h / 2));
}

function zoomActiveTo(zoom) {
	const real = activeSpec().real[S.device];
	const image = currentImage();
	const meta = toCoverMeta(image, real.w, real.h, resolveMeta(activeKey()));
	editActive(zoomMetaAt(image, real.w, real.h, meta, zoom, real.w / 2, real.h / 2));
}

/** Drops the own thumb crop so it follows Karta again via `targets.thumb ?? targets.square`. */
function followSquareInThumb() {
	delete S.gift.targets.thumb;
	toast('Seznam a rezervace znovu přebírá ořez Karty');
	rerender();
}

// ── Persisted image_meta (formats unchanged) ────────────────────────────────
const round = (value) => Math.round(value * 10000) / 10000;
const roundRect01 = (rect) => ({ x: round(rect.x), y: round(rect.y), w: round(rect.w), h: round(rect.h) });
const bgColorOf = (mat) => (mat === 'dots' ? null : mat === 'white' ? '#ffffff' : '#000000');

function persistedCrop(meta, spec) {
	const real = spec.real.desktop;
	return {
		cropRect: roundRect01(cropRectOf(currentImage(), real.w, real.h, meta)),
		focal: { x: round(meta.focal.x), y: round(meta.focal.y) },
		zoom: round(meta.zoom),
	};
}

function persistedMeta() {
	if (S.editor === 'gift') {
		const bgColor = bgColorOf(S.gift.mat);
		if (S.gift.mode === 'fit') return { fitMode: 'contain-padded', cropRect: null, focal: { x: 50, y: 50 }, zoom: 1, bgColor };
		const base = { fitMode: 'cover-crop', cropRect: null, focal: { x: 50, y: 50 }, zoom: 1, bgColor };
		if (S.gift.mode === 'fill') return base;
		const targets = {};
		for (const key of Object.keys(GIFT_TARGETS)) {
			if (S.gift.targets[key]) targets[key] = persistedCrop(S.gift.targets[key], GIFT_TARGETS[key]);
		}
		return { ...base, targets };
	}
	const bgColor = bgColorOf(S.wishlist.mat);
	const slots = {};
	for (const [key, slot] of Object.entries(S.wishlist.slots)) {
		if (slot.mode === 'fit') slots[key] = { fitMode: 'contain-padded', cropRect: null, focal: { x: 50, y: 50 }, zoom: 1, bgColor };
		else if (slot.mode === 'fill' || !slot.meta) slots[key] = { fitMode: 'cover-crop', cropRect: null, focal: { x: 50, y: 50 }, zoom: 1, bgColor };
		else slots[key] = { fitMode: 'cover-crop', ...persistedCrop(slot.meta, WISHLIST_SLOTS[key]), bgColor };
	}
	return { image_slots: slots };
}

// ── Crop stage ──────────────────────────────────────────────────────────────
const stages = new Set();

export class CropStage {
	/**
	 * cfg.windowSize(): { w, h } true CSS size of the window (scaled down only if it cannot fit)
	 * cfg.offset?(): { x, y } shift of the window from the stage centre (room for chrome)
	 * cfg.chrome?(geometry): HTML drawn above the dim (component around the window)
	 * cfg.guides?(): { from, to, label } visible band in window-normalized x
	 * cfg.pad, cfg.hint
	 */
	constructor(host, cfg = {}) {
		this.host = host;
		this.cfg = cfg;
		this.pointers = new Map();
		host.classList.add('cs');
		host.tabIndex = 0;
		host.setAttribute('role', 'application');
		host.setAttribute('aria-label', 'Ořez: táhněte pro posun, kolečkem nebo gestem přibližte, šipkami posunete, + a − přiblíží');
		host.innerHTML = `<div class="cs-mat"></div><img class="cs-img" alt="" draggable="false">
			<div class="cs-window"><div class="cs-guides"></div><div class="cs-thirds"></div></div>
			<div class="cs-chrome"></div><div class="cs-size"></div>
			${cfg.hint === false ? '' : `<div class="cs-hint">${cfg.hint ?? 'Táhněte · kolečko / dva prsty = zoom · dvojklik = vycentrovat'}</div>`}`;
		this.parts = {
			mat: host.querySelector('.cs-mat'),
			img: host.querySelector('.cs-img'),
			window: host.querySelector('.cs-window'),
			guides: host.querySelector('.cs-guides'),
			chrome: host.querySelector('.cs-chrome'),
			size: host.querySelector('.cs-size'),
		};
		host.addEventListener('pointerdown', (event) => this.onDown(event));
		host.addEventListener('pointermove', (event) => this.onMove(event));
		host.addEventListener('pointerup', (event) => this.onUp(event));
		host.addEventListener('pointercancel', (event) => this.onUp(event));
		host.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
		host.addEventListener('dblclick', () => resetActive());
		host.addEventListener('keydown', (event) => this.onKey(event));
		new ResizeObserver(() => this.render()).observe(host);
		stages.add(this);
		this.render();
	}

	geometry() {
		const stageWidth = this.host.clientWidth;
		const stageHeight = this.host.clientHeight;
		const size = (this.cfg.windowSize ?? (() => activeSpec().real[S.device]))();
		const offset = this.cfg.offset?.() ?? { x: 0, y: 0 };
		const pad = this.cfg.pad ?? 28;
		const reserve = this.cfg.reserve?.() ?? { w: 0, h: 0 };
		const scale = Math.min(1, (stageWidth - 2 * pad - reserve.w) / size.w, (stageHeight - 2 * pad - reserve.h) / size.h);
		const windowWidth = size.w * scale;
		const windowHeight = size.h * scale;
		return {
			stageWidth,
			stageHeight,
			size,
			scale,
			windowWidth,
			windowHeight,
			windowX: (stageWidth - windowWidth) / 2 + offset.x,
			windowY: (stageHeight - windowHeight) / 2 + offset.y,
		};
	}

	render() {
		if (!this.host.isConnected) {
			stages.delete(this);
			return;
		}
		const g = this.geometry();
		const image = currentImage();
		const meta = resolveMeta(activeKey());
		const layout = layoutImage(image, g.windowWidth, g.windowHeight, meta);
		const { mat, img, window: frame, guides, chrome, size } = this.parts;
		if (img.getAttribute('src') !== image.url) img.src = image.url;
		Object.assign(img.style, px({ left: g.windowX + layout.x, top: g.windowY + layout.y, width: layout.w, height: layout.h }));
		const windowBox = px({ left: g.windowX, top: g.windowY, width: g.windowWidth, height: g.windowHeight });
		Object.assign(mat.style, windowBox);
		Object.assign(frame.style, windowBox);
		Object.assign(chrome.style, windowBox);
		const radius = this.cfg.windowRadius?.() ?? '0';
		frame.style.borderRadius = radius;
		mat.style.borderRadius = radius;
		mat.className = 'cs-mat mat-' + currentMat();
		this.host.classList.toggle('no-ghost', !S.ghost);
		chrome.innerHTML = this.cfg.chrome ? this.cfg.chrome(g) : '';
		const band = this.cfg.guides?.();
		guides.innerHTML = band
			? `<div class="cs-band-out" style="left:0;width:${band.from * 100}%"></div><div class="cs-band-out" style="left:${band.to * 100}%;right:0"></div>
			   <div class="cs-band-line" style="left:${band.from * 100}%"></div><div class="cs-band-line" style="left:${band.to * 100}%"></div>`
			: '';
		const real = g.scale >= 0.999;
		size.textContent = `${g.size.w} × ${g.size.h} px · ${real ? 'skutečná velikost' : 'zmenšeno na ' + Math.round(g.scale * 100) + ' %'}`;
		Object.assign(size.style, px({ left: g.windowX, top: Math.max(4, g.windowY - 24) }));
		if (this.cfg.sizeLabel === false) size.style.display = 'none';
	}

	pointInWindow(clientX, clientY) {
		const rect = this.host.getBoundingClientRect();
		const g = this.geometry();
		return { x: clientX - rect.left - g.windowX, y: clientY - rect.top - g.windowY, g };
	}

	currentCover(g) {
		return toCoverMeta(currentImage(), g.windowWidth, g.windowHeight, resolveMeta(activeKey()));
	}

	pan(dx, dy) {
		const g = this.geometry();
		editActive(panMeta(currentImage(), g.windowWidth, g.windowHeight, this.currentCover(g), dx, dy));
	}

	zoomAt(factor, clientX, clientY) {
		const point = this.pointInWindow(clientX, clientY);
		const g = point.g;
		const cover = this.currentCover(g);
		editActive(zoomMetaAt(currentImage(), g.windowWidth, g.windowHeight, cover, cover.zoom * factor, point.x, point.y));
	}

	onDown(event) {
		this.host.setPointerCapture(event.pointerId);
		this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		this.host.classList.add('dragging');
		this.pinch = null;
	}

	onMove(event) {
		const previous = this.pointers.get(event.pointerId);
		if (!previous) return;
		this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (this.pointers.size === 1) {
			this.pan(event.clientX - previous.x, event.clientY - previous.y);
			return;
		}
		const [first, second] = [...this.pointers.values()];
		const distance = Math.hypot(first.x - second.x, first.y - second.y);
		const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
		if (this.pinch) {
			this.zoomAt(distance / this.pinch.distance, middle.x, middle.y);
			this.pan(middle.x - this.pinch.middle.x, middle.y - this.pinch.middle.y);
		}
		this.pinch = { distance, middle };
	}

	onUp(event) {
		this.pointers.delete(event.pointerId);
		this.pinch = null;
		if (this.pointers.size === 0) this.host.classList.remove('dragging');
	}

	onWheel(event) {
		event.preventDefault();
		this.host.classList.add('dragging');
		clearTimeout(this.wheelTimer);
		this.wheelTimer = setTimeout(() => this.pointers.size || this.host.classList.remove('dragging'), 700);
		this.zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
	}

	onKey(event) {
		const step = event.shiftKey ? 24 : 4;
		const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
		if (moves[event.key]) {
			event.preventDefault();
			this.pan(...moves[event.key]);
		} else if (event.key === '+' || event.key === '=') {
			zoomActiveBy(1.1);
		} else if (event.key === '-') {
			zoomActiveBy(1 / 1.1);
		} else if (event.key === '0') {
			resetActive();
		}
	}
}

const px = (values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value + 'px']));

// ── Navigator minimap (whole photo with the window's source rect) ───────────
export class Minimap {
	constructor(host, { width = 150 } = {}) {
		this.host = host;
		this.width = width;
		host.classList.add('minimap');
		host.innerHTML = '<img alt="" draggable="false"><div class="minimap-rect"></div>';
		this.img = host.querySelector('img');
		this.rect = host.querySelector('.minimap-rect');
		host.addEventListener('pointerdown', (event) => {
			event.stopPropagation();
			host.setPointerCapture(event.pointerId);
			this.dragging = true;
			this.jumpTo(event);
		});
		host.addEventListener('pointermove', (event) => this.dragging && this.jumpTo(event));
		host.addEventListener('pointerup', () => (this.dragging = false));
		host.addEventListener('wheel', (event) => event.stopPropagation());
		stages.add(this);
		this.render();
	}

	jumpTo(event) {
		const image = currentImage();
		const real = activeSpec().real[S.device];
		const box = this.host.getBoundingClientRect();
		const u = clamp((event.clientX - box.left) / box.width, 0, 1);
		const v = clamp((event.clientY - box.top) / box.height, 0, 1);
		const cover = toCoverMeta(image, real.w, real.h, resolveMeta(activeKey()));
		const layout = layoutImage(image, real.w, real.h, cover);
		// Centre the window on the clicked source point.
		const x = real.w / 2 - u * layout.w;
		const y = real.h / 2 - v * layout.h;
		editActive({
			mode: 'cover',
			zoom: cover.zoom,
			focal: { x: focalFromOffset(x, real.w, layout.w), y: focalFromOffset(y, real.h, layout.h) },
		});
	}

	render() {
		if (!this.host.isConnected) {
			stages.delete(this);
			return;
		}
		const image = currentImage();
		const height = (this.width * image.h) / image.w;
		Object.assign(this.host.style, px({ width: this.width, height }));
		if (this.img.getAttribute('src') !== image.url) this.img.src = image.url;
		const real = activeSpec().real[S.device];
		const rect = cropRectOf(image, real.w, real.h, resolveMeta(activeKey()));
		const left = clamp(rect.x, 0, 1);
		const top = clamp(rect.y, 0, 1);
		Object.assign(this.rect.style, {
			left: left * 100 + '%',
			top: top * 100 + '%',
			width: (clamp(rect.x + rect.w, 0, 1) - left) * 100 + '%',
			height: (clamp(rect.y + rect.h, 0, 1) - top) * 100 + '%',
		});
	}
}

// ── Preview frames ──────────────────────────────────────────────────────────
function paintFrames(root = document) {
	const image = currentImage();
	for (const el of root.querySelectorAll('.frame[data-key]')) {
		const meta = resolveMeta(el.dataset.key);
		const frameWidth = el.clientWidth;
		const frameHeight = el.clientHeight;
		if (!frameWidth || !frameHeight) continue;
		let img = el.querySelector(':scope > img');
		if (!img) {
			img = document.createElement('img');
			img.alt = '';
			el.append(img);
		}
		if (img.getAttribute('src') !== image.url) img.src = image.url;
		el.classList.remove('mat-dots', 'mat-white', 'mat-black');
		el.classList.add('mat-' + (el.dataset.key in GIFT_TARGETS ? S.gift.mat : S.wishlist.mat));
		let layout;
		if (el.dataset.side === '1' && meta.mode !== 'contain') {
			// Saved square composition, centred side-window in a taller frame (DECISIONS 2026-09-24).
			const box = Math.max(frameWidth, frameHeight);
			layout = layoutImage(image, box, box, meta);
			layout.x += (frameWidth - box) / 2;
			layout.y += (frameHeight - box) / 2;
		} else {
			layout = layoutImage(image, frameWidth, frameHeight, meta);
		}
		Object.assign(img.style, px({ left: layout.x, top: layout.y, width: layout.w, height: layout.h }));
		el.classList.toggle('is-active', el.dataset.key === activeKey() && el.dataset.highlight !== '0');
	}
	for (const el of root.querySelectorAll('[data-fallback-badge]')) {
		el.hidden = !thumbBorrowsSquare();
	}
	for (const el of root.querySelectorAll('[data-action="follow-square"]')) {
		el.hidden = !S.gift.targets.thumb;
	}
}

// ── Mock builders (HTML strings) ────────────────────────────────────────────
const frame = (key, width, height, extra = '') =>
	`<div class="frame" data-key="${key}" style="width:${width}px;${height ? `height:${height}px;` : ''}" ${extra}></div>`;

const GIFT_TEXT = {
	title: 'Retro rádio Tesla Talisman',
	desc: 'Ideálně v krémové nebo červené barvě, klidně z bazaru. Hlavně ať hraje.',
	price: '1 290 Kč',
};

/** Category and priority badges float over the card image and hide part of the crop. */
const giftImageBadges = (top = 8, bottom = 8) =>
	`<span class="m-badge m-badge-cat" style="top:${top}px;left:8px">Elektronika</span><span class="m-badge m-badge-prio" style="bottom:${bottom}px;left:8px">Vysoká</span>`;

export function giftCardMock(width = 356) {
	const height = Math.round((width * 3) / 4);
	return `<article class="m-card" style="width:${width + 5}px">
		<div class="m-card-img" style="position:relative">${frame('square', width, height)}${giftImageBadges()}</div>
		<div class="m-card-body">
			<div class="m-title m-clamp2" style="font-size:${width < 250 ? 15 : 17}px">${GIFT_TEXT.title}</div>
			${width < 250 ? '' : `<div class="m-desc m-clamp2">${GIFT_TEXT.desc}</div>`}
			<div class="m-foot"><span class="m-price">${GIFT_TEXT.price}</span><span class="btn btn-sm btn-primary">Rezervovat</span></div>
		</div></article>`;
}

export function desktopListRowMock(width = 640) {
	return `<div class="m-row" style="width:${width}px;min-height:150px">
		${frame('thumb', 146, 0, 'data-side="1"')}
		<div class="m-row-body">
			<div class="m-title m-clamp1" style="font-size:22px">${GIFT_TEXT.title}</div>
			<div class="m-desc m-clamp1">${GIFT_TEXT.desc}</div>
			<div class="m-foot"><span><span class="m-price">${GIFT_TEXT.price}</span> · <span class="m-link">bazos.cz</span></span><span class="btn btn-sm btn-primary">Rezervovat</span></div>
		</div></div>`;
}

export function mobileListRowMock(variant = S.rowVariant, width = 358) {
	const title = variant === 'short' ? 'Retro rádio' : GIFT_TEXT.title;
	return `<div class="m-row" data-mobile-row style="width:${width}px;height:${MOBILE_ROW.heights[variant]}px">
		${frame('thumb', MOBILE_ROW.width, 0, 'data-side="1"')}
		<div class="m-row-body">
			<div class="m-title m-clamp2" style="font-size:16px">${title}</div>
			${variant === 'long' ? `<div class="m-desc m-clamp2">${GIFT_TEXT.desc}</div><span class="m-link">bazos.cz · aukro.cz</span>` : ''}
			<div class="m-foot"><span class="m-price">${GIFT_TEXT.price}</span><span class="btn btn-sm btn-primary">Rezervovat</span></div>
		</div></div>`;
}

export function reservationMock() {
	return `<div class="m-card" style="width:330px;padding:12px;display:flex;gap:12px;align-items:center">
		${frame('thumb', 146, 146, 'style="border-radius:10px;border:2px solid var(--ink)"')}
		<div style="display:grid;gap:6px"><div class="eyebrow">Rezervujete</div><div class="m-title" style="font-size:16px">${GIFT_TEXT.title}</div><span class="m-price">${GIFT_TEXT.price}</span></div>
	</div>`;
}

const WISHLIST_TEXT = { title: 'Vánoce 2026', owner: 'Martin Novák', meta: '24. 12. 2026 · 12 dárků' };

export function overviewCardMock(width = 364) {
	return `<article class="m-card" style="width:${width + 5}px">
		<div class="m-card-img">${frame('card', width, 128)}</div>
		<div class="m-card-body">
			<div class="m-title">${WISHLIST_TEXT.title}</div>
			<div class="m-desc">${WISHLIST_TEXT.meta}</div>
			<div style="display:flex;gap:6px"><span class="chip">4 rezervováno</span><span class="chip chip-accent">Sdíleno</span></div>
		</div></article>`;
}

export function polaroidMock(size = 146) {
	return `<figure class="m-polaroid" style="margin:0">${frame('thumbnail', size, size)}<figcaption>${WISHLIST_TEXT.title}</figcaption></figure>`;
}

export function navMock() {
	return `<div class="m-nav">
		<div class="m-nav-row on">${frame('thumbnail', 34, 34)}<span>${WISHLIST_TEXT.title}</span></div>
		<div class="m-nav-row"><span style="width:34px;height:34px;border-radius:8px;background:var(--primary-soft);display:grid;place-items:center">🎂</span><span>Narozeniny</span></div>
		<div style="border-top:1.5px solid var(--border);margin:2px 0"></div>
		<div class="m-nav-row">${frame('thumbnail', 44, 44)}<span>${WISHLIST_TEXT.title}<br><span class="muted tiny" style="font-weight:400">12 dárků</span></span></div>
	</div>`;
}

export function socialMock(width = 500) {
	return `<div class="m-social" style="width:${width}px">${frame('social', width, Math.round((width * 630) / 1200))}
		<div class="m-social-body"><div class="m-social-domain">prejemesi.cz</div><div class="m-social-title">${WISHLIST_TEXT.title} – seznam přání</div><div class="m-social-desc">${WISHLIST_TEXT.owner} vám posílá seznam přání.</div></div></div>`;
}

/** Faded gift form column: context only, the mockups do not change the fields. */
export function giftFieldsMock() {
	return `<div class="fields-mock">
		<div class="field"><label>Název</label><div class="input">${GIFT_TEXT.title}</div></div>
		<div class="field"><label>Odkaz</label><div class="input">https://www.bazos.cz/radio-tesla</div></div>
		<div class="field"><label>Cena</label><div class="input">${GIFT_TEXT.price}</div></div>
		<div class="field"><label>Popis</label><div class="input area">${GIFT_TEXT.desc}</div></div>
		<div class="field"><label>Obrázek</label><div style="display:flex;gap:8px"><div class="input" style="flex:1">radio-tesla.jpg</div><span class="btn">Nahrát</span></div></div>
	</div>`;
}

const WISHLIST_TABS = ['Podrobnosti', 'Kategorie', 'Vzhled', 'Obrázek a ořezy', 'Import a export', 'Nebezpečná zóna'];
export const wishlistTabs = () =>
	`<div class="wl-tabs" role="tablist">${WISHLIST_TABS.map((tab) => `<span class="wl-tab ${tab === 'Obrázek a ořezy' ? 'on' : ''}">${tab}</span>`).join('')}</div>`;

export const sourceRow = () =>
	`<div class="source-row"><div class="frame-src" style="background-image:url(${currentImage().url})"></div>
	<div style="flex:1;min-width:0"><div class="small" style="font-weight:600">vanoce-2026.jpg</div><div class="tiny muted">${SOURCES[S.source].label} px</div></div>
	<span class="btn btn-sm">Změnit</span><span class="btn btn-sm btn-ghost">Odebrat</span></div>`;

/** Wraps a mock at a scale; `zoom` keeps layout size honest for neighbours. */
export const scaled = (html, scale) => `<div class="scaled" style="--k:${scale}">${html}</div>`;

// ── UI controls ─────────────────────────────────────────────────────────────
function segmented(name, options, value, extraClass = '') {
	return `<div class="seg ${extraClass}" role="group">${Object.entries(options)
		.map(([key, label]) => `<button type="button" data-set="${name}" data-value="${key}" aria-pressed="${key === value}">${label}</button>`)
		.join('')}</div>`;
}

export const modePill = (extraClass = '') => segmented('mode', MODE_LABELS, activeMode(), extraClass);

export function zoomBar({ compact = false } = {}) {
	const real = activeSpec().real[S.device];
	const image = currentImage();
	const min = containZoom(image, real.w, real.h);
	return `<div class="zoombar" data-zoombar>
		<button class="btn btn-icon btn-sm" data-action="zoom-out" title="Oddálit (−)">−</button>
		<input type="range" min="${min}" max="${ZOOM_MAX}" step="any" data-zoom-range aria-label="Přiblížení">
		<button class="btn btn-icon btn-sm" data-action="zoom-in" title="Přiblížit (+)">+</button>
		<output data-zoom-out></output>
		${compact ? '' : `<button class="btn btn-sm" data-action="whole" title="Celý obrázek s okraji">Celý</button><button class="btn btn-sm" data-action="reset" title="Vycentrovat a vyplnit (0)">Vycentrovat</button>`}
	</div>`;
}

const MAT_LABELS = { white: 'Bílé', black: 'Černé', dots: 'Průhledné' };
export const matPicker = () =>
	`<div class="shell-group" style="color:inherit"><span class="small muted">Okraje</span>${segmented('mat', MAT_LABELS, currentMat(), 'seg-sm')}</div>`;

export const ghostToggle = () =>
	`<label class="small" style="display:inline-flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-ghost ${S.ghost ? 'checked' : ''}> Zobrazit fotku i mimo ořez</label>`;

export const rowVariantPicker = () => segmented('rowVariant', MOBILE_ROW.variants, S.rowVariant, 'seg-sm');

function updateZoomBars() {
	const meta = resolveMeta(activeKey());
	const real = activeSpec().real[S.device];
	const zoom = meta.mode === 'contain' ? containZoom(currentImage(), real.w, real.h) : meta.zoom;
	for (const range of document.querySelectorAll('[data-zoom-range]')) range.value = zoom;
	for (const output of document.querySelectorAll('[data-zoom-out]')) output.textContent = Math.round(zoom * 100) + ' %';
}

let toastTimer;
function toast(message) {
	let el = document.querySelector('.toast');
	if (!el) {
		el = document.createElement('div');
		el.className = 'toast';
		document.body.append(el);
	}
	el.textContent = message;
	el.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Shell ───────────────────────────────────────────────────────────────────
let VARIANT;

export function start(variant) {
	VARIANT = variant;
	const params = new URLSearchParams(location.search);
	S.editor = params.get('editor') ?? S.editor;
	S.device = params.get('device') ?? S.device;
	S.source = params.get('source') ?? S.source;
	const style = document.createElement('style');
	style.textContent = variant.css ?? '';
	document.head.append(style);
	document.body.innerHTML = `<header class="shell-bar">
		<a href="index.html">← Přehled variant</a><h1>${variant.title}</h1><span class="grow"></span>
		<span class="shell-group">Editor <span data-slot="editor"></span></span>
		<span class="shell-group">Zařízení <span data-slot="device"></span></span>
		<span class="shell-group">Fotka <span data-slot="source"></span></span>
	</header><main class="shell-main"><div data-stage-root></div>
	<aside class="shell-notes">${variant.notes}<details open><summary class="small"><b>Uloží se (image_meta)</b></summary><pre data-json></pre></details></aside></main>`;
	document.addEventListener('click', onClick);
	document.addEventListener('input', onInput);
	rerender();
}

function onClick(event) {
	const setter = event.target.closest('[data-set]');
	if (setter) {
		const { set, value } = setter.dataset;
		if (set === 'mode') return setMode(value);
		if (set === 'active') return setActive(value);
		if (set === 'mat') {
			if (S.editor === 'gift') S.gift.mat = value;
			else S.wishlist.mat = value;
		} else {
			S[set] = value;
		}
		return rerender();
	}
	const action = event.target.closest('[data-action]')?.dataset.action;
	if (!action) {
		const target = event.target.closest('[data-target]');
		if (target) setActive(target.dataset.target);
		return;
	}
	const actions = {
		'zoom-in': () => zoomActiveBy(1.15),
		'zoom-out': () => zoomActiveBy(1 / 1.15),
		whole: wholeImageActive,
		reset: resetActive,
		'follow-square': followSquareInThumb,
	};
	actions[action]?.();
	VARIANT.onAction?.(action, event);
}

function onInput(event) {
	if (event.target.matches('[data-zoom-range]')) zoomActiveTo(Number(event.target.value));
	if (event.target.matches('[data-ghost]')) {
		S.ghost = event.target.checked;
		refresh();
	}
}

function rerender() {
	document.querySelector('[data-slot="editor"]').innerHTML = segmented('editor', { gift: 'Dárek', wishlist: 'Seznam – Obrázek a ořezy' }, S.editor, 'seg-sm');
	document.querySelector('[data-slot="device"]').innerHTML = segmented('device', { desktop: 'Desktop', mobile: 'Mobil' }, S.device, 'seg-sm');
	document.querySelector('[data-slot="source"]').innerHTML = segmented('source', { landscape: 'Na šířku', portrait: 'Na výšku', panorama: 'Panorama' }, S.source, 'seg-sm');
	const root = document.querySelector('[data-stage-root]');
	stages.clear();
	const body = VARIANT.render();
	root.innerHTML =
		S.device === 'desktop'
			? `<div class="desk-backdrop">${body}</div>`
			: `<div class="phone"><div class="phone-screen"><div class="phone-status"><span>9:41</span><span>▮▮▮ 100 %</span></div>${body}</div></div>`;
	VARIANT.mount?.(root);
	requestAnimationFrame(refresh);
}

function refresh() {
	for (const stage of [...stages]) stage.render();
	paintFrames();
	updateZoomBars();
	for (const button of document.querySelectorAll('[data-set="mode"]')) {
		button.setAttribute('aria-pressed', String(button.dataset.value === activeMode()));
	}
	VARIANT.onRefresh?.();
	const json = document.querySelector('[data-json]');
	if (json) json.textContent = JSON.stringify(persistedMeta(), null, 1);
}
