/* Variant B – V kontextu: the crop window IS the image slot of the real component (gift card,
   List row, reservation, wishlist card, polaroid, link preview) at true size on the page
   background. The photo outside the slot appears only while dragging or zooming. */

const B_CONTEXTS = {
	gift: {
		card: { target: 'square', label: 'Karta' },
		list: { target: 'thumb', label: 'Seznam', devices: ['desktop'] },
		mobileList: { target: 'thumb', label: 'Seznam na mobilu' },
		reservation: { target: 'thumb', label: 'Rezervace' },
	},
	wishlist: {
		overview: { target: 'card', label: 'Karta v Přehledu' },
		polaroid: { target: 'thumbnail', label: 'Polaroid' },
		social: { target: 'social', label: 'Sdílení odkazu' },
	},
};
S.ui.ctx = { gift: 'card', wishlist: 'overview' };

const bContexts = () =>
	Object.entries(B_CONTEXTS[S.editor]).filter(([, ctx]) => !ctx.devices || ctx.devices.includes(S.device));
const bCtxKey = () => S.ui.ctx[S.editor];
const bCtx = () => B_CONTEXTS[S.editor][bCtxKey()];

const rowHeight = () => MOBILE_ROW.heights[S.rowVariant];

/** Per-context geometry: window size, offset to centre the whole component, radius, chrome. */
const B_LAYOUTS = {
	card: {
		size: () => GIFT_TARGETS.square.real[S.device],
		body: () => (S.device === 'desktop' ? 112 : 92),
		radius: () => '14px 14px 0 0',
		offset() {
			return { x: 0, y: -this.body() / 2 };
		},
		chrome(g) {
			const body = this.body();
			const small = S.device === 'mobile';
			return `<div class="b-shell" style="left:0;top:0;width:${g.windowWidth}px;height:${g.windowHeight + body}px;border-width:0 0 ${body}px;border-radius:14px"></div>
				<div class="b-line" style="top:${g.windowHeight}px;width:${g.windowWidth}px"></div>
				<div class="b-badges" style="left:0;top:0;width:${g.windowWidth}px;height:${g.windowHeight}px">${giftImageBadges()}</div>
				<div class="b-text" style="top:${g.windowHeight + 10}px;left:12px;right:12px">
					<div class="m-title m-clamp2" style="font-size:${small ? 15 : 17}px">${GIFT_TEXT.title}</div>
					${small ? '' : `<div class="m-desc m-clamp1">${GIFT_TEXT.desc}</div>`}
					<div class="m-foot" style="margin-top:6px"><span class="m-price">${GIFT_TEXT.price}</span><span class="btn btn-sm btn-primary">Rezervovat</span></div>
				</div>`;
		},
	},
	list: {
		size: () => ({ w: 146, h: 146 }),
		body: 440,
		radius: () => '12px 0 0 12px',
		offset() {
			return { x: -this.body / 2, y: 0 };
		},
		chrome(g) {
			return `<div class="b-shell" style="left:0;top:0;width:${g.windowWidth + this.body}px;height:${g.windowHeight}px;border-width:0 ${this.body}px 0 0;border-radius:12px"></div>
				<div class="b-vline" style="left:${g.windowWidth}px;height:${g.windowHeight}px"></div>
				<div class="b-text" style="top:12px;left:${g.windowWidth + 14}px;width:${this.body - 28}px;height:${g.windowHeight - 24}px;display:flex;flex-direction:column;gap:4px">
					<div class="m-title m-clamp1" style="font-size:22px">${GIFT_TEXT.title}</div>
					<div class="m-desc m-clamp1">${GIFT_TEXT.desc}</div>
					<div class="m-foot" style="margin-top:auto"><span><span class="m-price">${GIFT_TEXT.price}</span> · <span class="m-link">bazos.cz</span></span><span class="btn btn-sm btn-primary">Rezervovat</span></div>
				</div>`;
		},
	},
	mobileList: {
		size: () => ({ w: rowHeight(), h: rowHeight() }),
		rowWidth: 358,
		radius: () => '0',
		offset() {
			return { x: -(this.rowWidth - MOBILE_ROW.width) / 2, y: 0 };
		},
		// Only the row must fit; the clipped overhang may run past the stage edge.
		reserve() {
			return { w: this.rowWidth - rowHeight(), h: 0 };
		},
		guides: () => mobileBand(),
		chrome(g) {
			const overhang = (g.windowWidth - MOBILE_ROW.width) / 2;
			const body = this.rowWidth - MOBILE_ROW.width;
			const title = S.rowVariant === 'short' ? 'Retro rádio' : GIFT_TEXT.title;
			return `<div class="b-cover" style="left:-4px;top:-4px;width:${overhang + 4}px;height:${g.windowHeight + 8}px"></div>
				<div class="b-shell" style="left:${overhang}px;top:0;width:${MOBILE_ROW.width + body}px;height:${g.windowHeight}px;border-width:0 ${body}px 0 0;border-radius:12px"></div>
				<div class="b-vline" style="left:${overhang + MOBILE_ROW.width}px;height:${g.windowHeight}px"></div>
				<div class="b-text" style="top:8px;left:${overhang + MOBILE_ROW.width + 10}px;width:${body - 20}px;height:${g.windowHeight - 16}px;display:flex;flex-direction:column;gap:4px">
					<div class="m-title m-clamp2" style="font-size:16px">${title}</div>
					${S.rowVariant === 'long' ? `<div class="m-desc m-clamp2">${GIFT_TEXT.desc}</div>` : ''}
					<div class="m-foot" style="margin-top:auto"><span class="m-price">${GIFT_TEXT.price}</span><span class="btn btn-sm btn-primary">Rezervovat</span></div>
				</div>`;
		},
	},
	reservation: {
		size: () => ({ w: 146, h: 146 }),
		pad: 12,
		body: 170,
		radius: () => '6px',
		offset() {
			return { x: -this.body / 2, y: 0 };
		},
		chrome(g) {
			const pad = this.pad;
			return `<div class="b-shell" style="left:${-pad}px;top:${-pad}px;width:${g.windowWidth + 2 * pad + this.body}px;height:${g.windowHeight + 2 * pad}px;border-width:${pad}px ${this.body + pad}px ${pad}px ${pad}px;border-radius:18px"></div>
				<div class="b-text" style="top:20px;left:${g.windowWidth + 14}px;width:${this.body - 10}px;display:grid;gap:6px">
					<div class="eyebrow">Rezervujete</div><div class="m-title" style="font-size:16px">${GIFT_TEXT.title}</div><span class="m-price">${GIFT_TEXT.price}</span>
					<span class="btn btn-sm btn-primary" style="justify-self:start">Potvrdit</span>
				</div>`;
		},
	},
	overview: {
		size: () => WISHLIST_SLOTS.card.real[S.device],
		body: 92,
		radius: () => '14px 14px 0 0',
		offset() {
			return { x: 0, y: -this.body / 2 };
		},
		chrome(g) {
			return `<div class="b-shell" style="left:0;top:0;width:${g.windowWidth}px;height:${g.windowHeight + this.body}px;border-width:0 0 ${this.body}px;border-radius:14px"></div>
				<div class="b-line" style="top:${g.windowHeight}px;width:${g.windowWidth}px"></div>
				<div class="b-text" style="top:${g.windowHeight + 10}px;left:12px;right:12px;display:grid;gap:4px">
					<div class="m-title">${WISHLIST_TEXT.title}</div><div class="m-desc">${WISHLIST_TEXT.meta}</div>
					<div style="display:flex;gap:6px"><span class="chip">4 rezervováno</span><span class="chip chip-accent">Sdíleno</span></div>
				</div>`;
		},
	},
	polaroid: {
		size: () => ({ w: 146, h: 146 }),
		radius: () => '0',
		offset: () => ({ x: 0, y: -10 }),
		chrome(g) {
			return `<div class="b-shell b-paper" style="left:-9px;top:-9px;width:${g.windowWidth + 18}px;height:${g.windowHeight + 39}px;border-width:9px 9px 30px;border-radius:2px"></div>
				<div class="b-tape" style="left:${g.windowWidth / 2 - 32}px;top:-20px"></div>
				<div class="b-text" style="top:${g.windowHeight + 6}px;left:0;right:0;text-align:center;font-family:var(--font-head);font-size:13px">${WISHLIST_TEXT.title}</div>`;
		},
	},
	social: {
		size: () => WISHLIST_SLOTS.social.real[S.device],
		body: 70,
		radius: () => '9px 9px 0 0',
		offset() {
			return { x: 0, y: -this.body / 2 };
		},
		reserve() {
			return { w: 0, h: this.body };
		},
		chrome(g) {
			return `<div class="b-shell b-social" style="left:0;top:0;width:${g.windowWidth}px;height:${g.windowHeight + this.body}px;border-width:0 0 ${this.body}px;border-radius:10px"></div>
				<div class="b-text" style="top:${g.windowHeight + 8}px;left:12px;right:12px;font-family:system-ui,sans-serif">
					<div class="m-social-domain">prejemesi.cz</div><div class="m-social-title">${WISHLIST_TEXT.title} – seznam přání</div><div class="m-social-desc">${WISHLIST_TEXT.owner} vám posílá seznam přání.</div>
				</div>`;
		},
	},
};

function selectContext(key) {
	S.ui.ctx[S.editor] = key;
	setActive(B_CONTEXTS[S.editor][key].target);
}

const ctxChips = () =>
	`<div class="seg" role="group">${bContexts()
		.map(([key, ctx]) => `<button type="button" data-action="ctx" data-ctx="${key}" aria-pressed="${key === bCtxKey()}">${ctx.label}</button>`)
		.join('')}</div>`;

/** Small live previews of every other place, each a shortcut into that context. */
function otherPlaces() {
	const mobile = S.device === 'mobile';
	const previews = {
		card: () => scaled(giftCardMock(mobile ? 178 : 356), mobile ? 0.62 : 0.4),
		list: () => scaled(desktopListRowMock(560), 0.4),
		mobileList: () => scaled(mobileListRowMock(), 0.5),
		reservation: () => scaled(reservationMock(), 0.42),
		overview: () => scaled(overviewCardMock(), 0.45),
		polaroid: () => `<div style="display:flex;gap:10px;align-items:center"><div style="padding:6px 4px">${scaled(polaroidMock(), 0.6)}</div>${scaled(navMock(), 0.6)}</div>`,
		social: () => scaled(socialMock(), 0.36),
	};
	return bContexts()
		.filter(([key]) => key !== bCtxKey())
		.map(([key, ctx]) => `<button type="button" class="b-place" data-action="ctx" data-ctx="${key}"><span class="ctx-label">${ctx.label}${key !== 'card' && ctx.target === 'thumb' ? ' <span class="badge-fallback" data-fallback-badge hidden>přebírá ořez Karty</span>' : ''}</span>${previews[key]()}</button>`)
		.join('');
}

const workshopTools = () => `
	<div class="b-toolbar">${modePill(S.editor === 'wishlist' ? 'seg-sm' : '')}${matPicker()}</div>
	<div class="b-toolbar">${ctxChips()}${bCtxKey() === 'mobileList' ? `<span class="small muted" style="display:flex;gap:6px;align-items:center">Řádek ${rowVariantPicker()}</span>` : ''}</div>
	${bCtx().target === 'thumb' ? '<div class="b-toolbar"><span class="tiny muted">Seznam i Rezervace sdílí jeden čtvercový ořez.</span><button class="btn btn-sm" data-action="follow-square">Převzít ořez z Karty</button></div>' : ''}`;

const VARIANT_B = {
	title: 'Varianta B – Úprava přímo v kontextu',
	notes: `<h3>Ořez přímo v komponentě</h3>
		<p>Okno ořezu je obrazová část skutečné karty, řádku, rezervace, polaroidu nebo náhledu odkazu ve skutečné velikosti na pozadí stránky. Fotka mimo okno se ukáže jen během posouvání nebo zoomu.</p>
		<ul><li>Přepínače kontextu určují cíl (Karta → <code>square</code>, Seznam/Rezervace → <code>thumb</code>)</li>
		<li>Mobilní řádek ukazuje ořezaný čtverec podle výšky řádku – při posouvání se ukáže šrafovaná skrytá část</li>
		<li>„Další místa“ jsou živé miniatury a zkratky do kontextu</li></ul>`,
	css: `
		.b-dialog { width: 1120px; }
		.b-grid { display: grid; grid-template-columns: 700px 1fr; gap: 20px; padding: 4px 20px 16px; }
		.b-workshop { display: grid; gap: 10px; align-content: start; }
		.b-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
		.b-stage { height: 470px; border: 2px solid var(--border); }
		.b-stage.cs { background: radial-gradient(var(--pattern-dot) 1.4px, transparent 1.5px) 0 0 / 18px 18px, var(--background); }
		.b-stage .cs-window { box-shadow: 0 0 0 4000px var(--background); outline: none; transition: box-shadow .2s; }
		.b-stage.dragging .cs-window { box-shadow: 0 0 0 4000px var(--stage-dim); outline: 2px solid #fff; }
		.b-stage .cs-mat { box-shadow: none; }
		.b-stage .cs-hint { color: var(--muted-foreground); }
		.b-stage.dragging .cs-hint { color: #fff; }
		.b-stage .cs-size { background: var(--ink); }
		.b-stage .cs-guides { opacity: 0; transition: opacity .2s; }
		.b-stage.dragging .cs-guides { opacity: 1; }
		.b-stage .cs-chrome > * { position: absolute; }
		.b-shell { border-style: solid; border-color: #fff; box-shadow: 0 0 0 2.5px var(--ink), 6px 6px 0 2.5px var(--hard-shadow); box-sizing: border-box; background: transparent; }
		.b-paper { box-shadow: 0 0 0 1.5px var(--border-strong), 5px 5px 0 1.5px var(--hard-shadow); }
		.b-social { border-color: #f0f2f5; box-shadow: 0 0 0 1px #ccd0d5; }
		.b-line { left: 0; height: 2.5px; background: var(--ink); }
		.b-badges { pointer-events: none; transition: opacity .2s; }
		.b-stage.dragging .b-badges { opacity: .35; }
		.b-vline { top: 0; width: 2.5px; background: var(--ink); }
		.b-cover { background: var(--background); transition: opacity .2s; }
		.b-stage.dragging .b-cover { opacity: 0; }
		.b-tape { width: 64px; height: 20px; transform: rotate(3deg); background: color-mix(in oklab, var(--p-bright) 45%, transparent); border: 1px solid color-mix(in oklab, var(--ink) 25%, transparent); }
		.b-places { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
		.b-place { all: unset; cursor: pointer; display: flex; flex-direction: column; border-radius: 8px; padding: 4px; }
		.b-place:hover { background: var(--secondary); }
		.b-place:focus-visible { outline: 2px solid var(--p-bright); }
		.b-mobile .b-pad { padding: 0 14px; display: grid; gap: 10px; }
		.b-mobile .b-stage { height: 380px; border-radius: 0; border-width: 2px 0; }
		.b-mobile .b-toolbar .seg { overflow-x: auto; max-width: 100%; }
		.b-wl-grid { display: grid; grid-template-columns: 700px 1fr; gap: 20px; padding: 14px 20px 16px; }
	`,
	render() {
		if (S.device === 'mobile' && bCtxKey() === 'list') S.ui.ctx.gift = 'mobileList';
		const mobile = S.device === 'mobile';
		const title = S.editor === 'gift' ? 'Upravit dárek' : 'Nastavení seznamu';
		const head = `<div class="dialog-head"><h2 ${mobile ? 'style="font-size:19px"' : ''}>${title}</h2><span class="close-x">✕</span></div>${S.editor === 'wishlist' ? wishlistTabs() : ''}`;
		const places = `<div class="eyebrow">Další místa</div><div class="b-places">${otherPlaces()}</div>`;
		if (mobile) {
			return `<div class="b-mobile">${head}
				<div class="b-pad" style="margin-top:8px">${S.editor === 'wishlist' ? sourceRow() : ''}${workshopTools()}</div>
				<div class="b-stage" data-stage style="margin-top:10px"></div>
				<div class="b-pad" style="margin:8px 0 14px">${zoomBar({ compact: true })}
					<div><span class="btn btn-sm" data-action="whole">Celý</span> <span class="btn btn-sm" data-action="reset">Vycentrovat</span></div>
					${places}${S.editor === 'gift' ? giftFieldsMock() : ''}</div>
				<div class="sheet-foot"><span class="btn">Zrušit</span><span class="btn btn-primary">Uložit</span></div></div>`;
		}
		const workshop = `<section class="b-workshop">${S.editor === 'wishlist' ? sourceRow() : ''}${workshopTools()}
			<div class="b-stage" data-stage></div>${zoomBar()}</section>`;
		const side = S.editor === 'gift' ? `<div style="display:grid;gap:14px;align-content:start">${giftFieldsMock()}${places}</div>` : `<div style="display:grid;gap:10px;align-content:start">${places}</div>`;
		return `<div class="dialog b-dialog">${head}<div class="${S.editor === 'gift' ? 'b-grid' : 'b-wl-grid'}">${workshop}${side}</div>
			<div class="dialog-foot"><span class="btn">Zrušit</span><span class="btn btn-primary">Uložit</span></div></div>`;
	},
	mount(root) {
		const layout = B_LAYOUTS[bCtxKey()];
		new CropStage(root.querySelector('[data-stage]'), {
			windowSize: () => layout.size(),
			offset: () => layout.offset(),
			reserve: () => layout.reserve?.() ?? { w: Math.abs(layout.offset().x) * 2, h: Math.abs(layout.offset().y) * 2 },
			windowRadius: () => layout.radius(),
			chrome: (g) => layout.chrome(g),
			guides: layout.guides,
			pad: S.device === 'mobile' ? 16 : 30,
			hint: 'Táhněte fotku v kartě · kolečko / dva prsty = zoom',
		});
	},
	onAction(action, event) {
		if (action === 'ctx') selectContext(event.target.closest('[data-ctx]').dataset.ctx);
	},
};

start(VARIANT_B);
