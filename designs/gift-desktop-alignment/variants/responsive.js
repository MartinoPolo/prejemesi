(() => {
	const imageRoot = '../../../static/demo/v1/';
	const gifts = [
		{
			id: 'headphones',
			title: 'Sluchátka Sony WH-1000XM5',
			description: 'Bezdrátová, ideálně černá. Hodí se i na dlouhé cesty vlakem.',
			image: 'headphones.jpg',
			category: 'Elektronika',
			priority: 'Moc si přeji',
			price: '7 990 Kč',
			quantity: 1,
			links: [
				['Alza', 'https://www.alza.cz/'],
				['Sony', 'https://www.sony.cz/'],
			],
			state: 'available',
		},
		{
			id: 'backpack',
			title: 'Lehký turistický batoh Osprey Talon 22 v tmavě modré barvě',
			description: 'Lehký zádový systém, správná velikost a pláštěnka.',
			image: 'backpack.jpg',
			category: 'Sport, výlety a opravdu dlouhý název kategorie',
			priority: 'Vysoká priorita',
			price: '2 890–4 299 Kč',
			quantity: 1,
			links: [
				['4camping.cz – správná velikost', 'https://www.4camping.cz/'],
				['Hanibal', 'https://www.hanibal.cz/'],
				['Osprey', 'https://www.osprey.com/eu/'],
			],
			state: 'reserved',
			reserver: 'Jana Dvořáková',
		},
		{
			id: 'teapot',
			title: 'Čajová konvice',
			description: '',
			image: 'teapot.jpg',
			category: 'Domov',
			priority: null,
			price: 'Cena neuvedena',
			quantity: 1,
			links: [],
			state: 'own',
		},
		{
			id: 'watercolours',
			title: 'Profesionální akvarelové barvy Schmincke Horadam v dřevěné kazetě se štětci',
			description: 'Sada s půlpánvičkami; prosím bez studentské řady.',
			image: 'watercolours.jpg',
			category: 'Tvoření',
			priority: 'Moc si přeji',
			price: '3 499–12 999 Kč',
			quantity: 2,
			links: [
				['Výtvarné potřeby', 'https://www.vytvarne-potreby.cz/'],
				['Výrobce', 'https://www.schmincke.de/'],
			],
			state: 'received',
		},
		{
			id: 'keyboard',
			title: 'Mechanická klávesnice s českým rozložením a tichými spínači',
			description: 'Nízkoprofilová, bez RGB a pro tři zařízení.',
			image: null,
			category: null,
			priority: null,
			price: '1 800–6 499 Kč',
			quantity: 1,
			links: [['Keychron – evropský obchod', 'https://www.keychron.com/']],
			state: 'multi',
		},
	];
	const controls = Object.fromEntries(
		[
			'mode',
			'width',
			'columns',
			'theme',
			'palette',
			'role',
			'lifecycle',
			'content',
			'crop',
			'zoom',
		].map((name) => [name, document.querySelector(`#${name}-control`)]),
	);
	const collection = document.querySelector('#collection'),
		workspace = document.querySelector('#workspace'),
		emptyState = document.querySelector('#empty-state'),
		dialog = document.querySelector('#detail-dialog'),
		popover = document.querySelector('#more-popover');
	let menuTrigger;
	const escapeHtml = (value) =>
		String(value).replace(
			/[&<>"']/g,
			(character) =>
				({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
					character
				],
		);
	const giftView = (gift) => ({
		...gift,
		description: controls.content.value === 'nodesc' ? '' : gift.description,
		category:
			controls.content.value === 'stress' && gift.id === 'keyboard'
				? 'Elektronika, pracovní vybavení a příslušenství na cesty'
				: gift.category,
		price:
			controls.content.value === 'stress' && gift.id === 'watercolours'
				? '123 456–1 234 567 Kč'
				: gift.price,
	});
	function statusMarkup(gift) {
		const role = controls.role.value;
		if (role === 'recipient') return '';
		if (gift.state === 'received') return '<span class="state-overlay">Dárek předán</span>';
		if (gift.state === 'own') {
			const ownsReservation = ['manager', 'visitor', 'anonymous'].includes(role);
			return `<span class="state-overlay${ownsReservation ? ' own' : ''}">${ownsReservation ? 'Vaše rezervace' : 'Rezervováno'}</span>`;
		}
		if (['reserved', 'multi'].includes(gift.state)) {
			const identity =
				role === 'manager'
					? `<span class="reservation-identity">${gift.state === 'multi' ? 'Rezervováno více lidmi' : escapeHtml(gift.reserver)}</span>`
					: '';
			return `<span class="state-overlay">Rezervováno</span>${identity}`;
		}
		return '';
	}
	function likeMarkup(gift) {
		if (['recipient'].includes(controls.role.value) || controls.lifecycle.value === 'archive')
			return '';
		const count = (gift.id.length % 4) + 1;
		if (controls.role.value === 'promoted')
			return `<span class="like-readonly" aria-label="To se líbí ${count} lidem">♡ ${count}</span>`;
		return `<button class="like-button" data-demo type="button" aria-label="To se mi líbí, počet ${count}">♡ ${count}</button>`;
	}
	function actions(gift) {
		if (controls.lifecycle.value === 'archive')
			return '<button class="card-action secondary" data-overflow-command disabled>Jen pro čtení</button>';
		const role = controls.role.value;
		if (['recipient', 'promoted'].includes(role))
			return `<button class="card-action secondary" data-overflow-command data-demo>${gift.state === 'received' ? 'Vrátit' : 'Přijato'}</button>`;
		if (role === 'manager')
			return `${gift.state === 'available' ? '<button class="card-action primary" data-overflow-command data-demo>Rezervovat</button>' : ''}<button class="card-action secondary" data-overflow-command data-demo>${gift.state === 'received' ? 'Vrátit' : 'Přijato'}</button>`;
		if (gift.state === 'own' && role === 'visitor')
			return '<button class="card-action secondary" data-overflow-command data-demo>Koupeno</button>';
		if (['reserved', 'multi', 'received', 'own'].includes(gift.state)) return '';
		return '<button class="card-action primary" data-overflow-command data-demo>Rezervovat</button>';
	}
	function cardMarkup(source) {
		const gift = giftView(source);
		const image = gift.image
			? `<div class="square-composition"><img src="${imageRoot}${gift.image}" alt=""></div>`
			: '<div class="image-placeholder" aria-hidden="true">🎁</div>';
		const shown = gift.links.slice(0, 2);
		const links = shown.length
			? shown
					.map(
						([label, url]) =>
							`<a class="link-chip" href="${url}" target="_blank" rel="noopener">↗ ${escapeHtml(label)}</a>`,
					)
					.join('')
			: '<span class="link-empty">Bez odkazu</span>';
		return `<article class="gift-card" data-gift-id="${gift.id}" tabindex="0" role="button" aria-label="Otevřít detail: ${escapeHtml(gift.title)}"><div class="image-area">${image}${gift.category ? `<span class="category-badge">${escapeHtml(gift.category)}</span>` : ''}${likeMarkup(gift)}${gift.priority ? `<span class="priority-badge">${escapeHtml(gift.priority)}</span>` : ''}${statusMarkup(gift)}</div><div class="card-main"><div class="name-row"><h2 class="gift-title" title="${escapeHtml(gift.title)}">${escapeHtml(gift.title)}</h2>${gift.quantity > 1 ? `<span class="quantity">×${gift.quantity}</span>` : ''}</div><div class="description-row">${escapeHtml(gift.description)}</div><div class="link-track">${links}${gift.links.length > 2 ? `<button class="link-overflow" data-more="${gift.id}">+${gift.links.length - 2} další</button>` : ''}</div><div class="bottom-row"><span class="price${gift.price === 'Cena neuvedena' ? ' empty' : ''}">${escapeHtml(gift.price)}</span><div class="action-group">${actions(gift)}<button class="more-button" data-more="${gift.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Více akcí pro ${escapeHtml(gift.title)}">•••</button></div></div></div></article>`;
	}
	function roleCopy() {
		return {
			recipient:
				'Obdarovaný: rezervace, identity i To se mi líbí zůstávají skryté. Přijato a Více upravují obsah.',
			promoted:
				'Povýšený obdarovaný: pouze počty To se mi líbí; bez rezervace, nákupu, zrušení a identity.',
			manager: 'Správce: Rezervovat + Přijato; vlastní Zrušit a Koupeno jsou ve Více.',
			visitor: 'Návštěvník: vlastní Koupeno a Zrušit; cizí identity zůstávají skryté.',
			anonymous: 'Anonymní: bez Koupeno; vlastní anonymní rezervaci lze zrušit ve Více.',
		}[controls.role.value];
	}
	function render() {
		closeMore(false);
		const mode = controls.mode.value;
		workspace.className = `workspace ${mode}`;
		collection.className = `collection ${mode} ${controls.crop.value}`;
		collection.dataset.columns = controls.columns.value;
		collection.style.setProperty('--mobile-columns', controls.columns.value);
		workspace.style.setProperty('--workspace-width', `${controls.width.value}px`);
		document.documentElement.classList.toggle('dark', controls.theme.value === 'dark');
		document.documentElement.classList.toggle('text-zoom', controls.zoom.checked);
		document.documentElement.dataset.palette = controls.palette.value;
		const visitorDraft =
			controls.lifecycle.value === 'draft' &&
			!['recipient', 'promoted', 'manager'].includes(controls.role.value);
		collection.hidden = visitorDraft;
		emptyState.hidden = !visitorDraft;
		document.querySelector('#role-note').textContent =
			controls.lifecycle.value === 'archive'
				? `${roleCopy()} Archiv je pouze ke čtení.`
				: roleCopy();
		document.querySelector('#mode-note').textContent =
			mode === 'desktop-list'
				? 'Desktop seznam: nejmenší společná výška, čtvercový obraz přes celý řádek.'
				: mode === 'mobile-list'
					? 'Mobilní seznam: portrétní obraz zabírá dynamicky nejvýše 35 % šířky (max. 152 px) a celou výšku.'
					: 'Mobilní mřížka: jeden sloupec plyne přirozeně; dva sloupce se zarovnají.';
		document.querySelector('#crop-note').textContent =
			controls.crop.value === 'sidecrop'
				? 'Ořez stran promítá stejnou čtvercovou kompozici thumb (1:1) do portrétního okna, takže část obsahu mizí; editor tuto podobu neukazuje.'
				: 'Fit zachová celý čtvercový thumb (1:1), ale přidá volné plochy. Není to přesný portrétní WYSIWYG. Karta square používá 4:3.';
		if (visitorDraft) return;
		collection.innerHTML = gifts.map(cardMarkup).join('');
		collection.classList.toggle(
			'no-description',
			!gifts.some((gift) => giftView(gift).description),
		);
		requestAnimationFrame(() => document.fonts.ready.then(syncGeometry));
	}
	function fitMobileActions(cards) {
		if (!controls.mode.value.startsWith('mobile-')) return;
		cards.forEach((card) => {
			const group = card.querySelector('.action-group');
			const commands = [...group.querySelectorAll('[data-overflow-command]')];
			const more = group.querySelector('.more-button');
			const gap = Number.parseFloat(getComputedStyle(group).columnGap) || 0;
			const requiredWidth = () => {
				const visible = [...commands.filter((button) => !button.hidden), more];
				return (
					visible.reduce(
						(width, button) => width + button.getBoundingClientRect().width,
						0,
					) +
					Math.max(0, visible.length - 1) * gap
				);
			};
			const overflowOrder = [
				...commands.filter((button) => button.classList.contains('secondary')),
				...commands.filter((button) => button.classList.contains('primary')),
			];
			for (const command of overflowOrder) {
				if (requiredWidth() <= group.clientWidth + 0.5) break;
				command.hidden = true;
			}
		});
	}
	function arrangeMobileGridOverlays(cards) {
		if (controls.mode.value !== 'mobile-grid') return;
		const rectangleIntersects = (first, second) =>
			first.left < second.right - 0.5 &&
			first.right > second.left + 0.5 &&
			first.top < second.bottom - 0.5 &&
			first.bottom > second.top + 0.5;
		const requiredHeights = cards.map((card) => {
			const image = card.querySelector('.image-area');
			const overlays = [
				...image.querySelectorAll(
					'.category-badge,.like-button,.like-readonly,.state-overlay,.reservation-identity,.priority-badge',
				),
			];
			const rectangles = overlays.map((overlay) => overlay.getBoundingClientRect());
			const collision = rectangles.some((rectangle, index) =>
				rectangles.slice(index + 1).some((other) => rectangleIntersects(rectangle, other)),
			);
			const imageRectangle = image.getBoundingClientRect();
			if (!collision) return imageRectangle.height;
			card.classList.add('overlay-stacked');
			const category = card.querySelector('.category-badge');
			const like = card.querySelector('.like-button,.like-readonly');
			const state = card.querySelector('.state-overlay');
			const identity = card.querySelector('.reservation-identity');
			const priority = card.querySelector('.priority-badge');
			let top = Math.max(
				7,
				...[category, like]
					.filter(Boolean)
					.map(
						(overlay) =>
							overlay.getBoundingClientRect().bottom - imageRectangle.top + 7,
					),
			);
			for (const overlay of [state, identity].filter(Boolean)) {
				overlay.style.top = `${top}px`;
				top += overlay.getBoundingClientRect().height + 7;
			}
			const priorityHeight = priority?.getBoundingClientRect().height || 0;
			return Math.max(imageRectangle.height, top + priorityHeight + (priority ? 14 : 7));
		});
		if (!cards.some((card) => card.classList.contains('overlay-stacked'))) return;
		const sharedImageHeight = Math.max(...requiredHeights);
		cards.forEach((card) => {
			const image = card.querySelector('.image-area');
			image.style.aspectRatio = 'auto';
			image.style.height = `${sharedImageHeight}px`;
		});
	}
	function syncGeometry() {
		if (!popover.hidden) closeMore(false);
		const cards = [...collection.querySelectorAll('.gift-card')];
		if (!cards.length) return;
		for (const property of [
			'--shared-row-height',
			'--grid-title-track',
			'--grid-description-track',
			'--grid-link-track',
			'--grid-price-track',
			'--grid-action-track',
		])
			collection.style.removeProperty(property);
		cards.forEach((card) => {
			card.style.removeProperty('min-height');
			card.classList.remove('overlay-stacked');
			card.querySelector('.image-area').style.removeProperty('height');
			card.querySelector('.image-area').style.removeProperty('aspect-ratio');
			card.querySelector('.bottom-row').classList.remove('stack-bottom');
			card.querySelectorAll('[data-overflow-command]').forEach((button) => {
				button.hidden = false;
			});
			for (const overlay of card.querySelectorAll(
				'.category-badge,.like-button,.like-readonly,.state-overlay,.reservation-identity,.priority-badge',
			))
				overlay.style.removeProperty('top');
		});
		fitMobileActions(cards);
		arrangeMobileGridOverlays(cards);
		if (controls.mode.value === 'desktop-list') {
			let height = 154;
			for (let iteration = 0; iteration < 8; iteration += 1) {
				collection.style.setProperty('--shared-row-height', `${height}px`);
				cards.forEach((card) => {
					const bottom = card.querySelector('.bottom-row'),
						price = card.querySelector('.price'),
						actions = card.querySelector('.action-group');
					bottom.classList.toggle(
						'stack-bottom',
						price.scrollWidth + actions.scrollWidth + 18 > bottom.clientWidth,
					);
				});
				const needed = Math.max(
					154,
					...cards.map((card) =>
						Math.ceil(card.querySelector('.card-main').scrollHeight),
					),
				);
				if (needed <= height + 1) break;
				height = needed;
			}
			collection.style.setProperty('--shared-row-height', `${height}px`);
			return;
		}
		if (controls.mode.value === 'mobile-grid' && controls.columns.value === '2') {
			const trackDefinitions = [
				['--grid-title-track', '.name-row'],
				['--grid-description-track', '.description-row'],
				['--grid-link-track', '.link-track'],
				['--grid-price-track', '.price'],
				['--grid-action-track', '.action-group'],
			];
			for (const [property, selector] of trackDefinitions) {
				const height = Math.max(
					0,
					...cards.map((card) =>
						Math.ceil(card.querySelector(selector).getBoundingClientRect().height),
					),
				);
				collection.style.setProperty(property, `${height}px`);
			}
			return;
		}
		if (controls.mode.value === 'mobile-list') {
			cards.forEach((card) => {
				const category = card.querySelector('.category-badge'),
					like = card.querySelector('.like-button,.like-readonly'),
					state = card.querySelector('.state-overlay'),
					identity = card.querySelector('.reservation-identity'),
					priority = card.querySelector('.priority-badge');
				let top = 7;
				if (category) {
					category.style.top = `${top}px`;
					top += category.getBoundingClientRect().height + 7;
				}
				if (like) {
					like.style.top = `${top}px`;
					top += like.getBoundingClientRect().height + 7;
				}
				if (state) {
					state.style.top = `${top}px`;
					top += state.getBoundingClientRect().height + 7;
				}
				if (identity) {
					identity.style.top = `${top}px`;
					top += identity.getBoundingClientRect().height + 7;
				}
				const priorityHeight = priority?.getBoundingClientRect().height || 0;
				const overlayHeight = top + priorityHeight + (priority ? 7 : 0);
				const contentHeight = Math.ceil(card.querySelector('.card-main').scrollHeight);
				card.style.minHeight = `${Math.max(190, Math.ceil(overlayHeight), contentHeight)}px`;
			});
		}
	}
	function linkMarkup(gift, menu = false) {
		return gift.links.length
			? gift.links
					.map(
						([label, url]) =>
							`<a${menu ? ' role="menuitem"' : ''} href="${url}" target="_blank" rel="noopener">↗ ${escapeHtml(label)}</a>`,
					)
					.join('')
			: '<span class="link-empty">Bez odkazu</span>';
	}
	function openDetail(id) {
		const gift = giftView(gifts.find((item) => item.id === id));
		document.querySelector('#detail-title').textContent = gift.title;
		document.querySelector('#detail-description').textContent =
			gift.description || 'K tomuto přání není přidaný popis.';
		document.querySelector('#detail-links').innerHTML = linkMarkup(gift);
		dialog.showModal();
	}
	function openMore(id, trigger) {
		closeMore(false);
		menuTrigger = trigger;
		trigger.setAttribute('aria-expanded', 'true');
		const gift = gifts.find((item) => item.id === id),
			role = controls.role.value,
			disabled = controls.lifecycle.value === 'archive' ? ' disabled' : '';
		document.querySelector('#more-title').textContent = gift.title;
		document.querySelector('#more-links').innerHTML = linkMarkup(gift, true);
		const menuItems = [];
		const menuLabels = new Set();
		const addMenuItem = (label, attributes = '') => {
			if (menuLabels.has(label)) return;
			menuLabels.add(label);
			menuItems.push(
				`<button class="menu-action" role="menuitem"${attributes}>${label}</button>`,
			);
		};
		trigger
			.closest('.gift-card')
			.querySelectorAll('[data-overflow-command][hidden]')
			.forEach((command) =>
				addMenuItem(
					command.textContent.trim(),
					`${command.hasAttribute('data-demo') ? ' data-demo' : ''}${command.disabled ? ' disabled' : ''}`,
				),
			);
		if (['recipient', 'promoted', 'manager'].includes(role))
			addMenuItem('Upravit přání', disabled);
		else addMenuItem('Zobrazit celý detail', ' data-detail');
		if (gift.state === 'own' && ['manager', 'visitor', 'anonymous'].includes(role))
			addMenuItem('Zrušit moji rezervaci', ' data-demo');
		if (gift.state === 'own' && ['manager', 'visitor'].includes(role))
			addMenuItem('Koupeno', ` data-demo${disabled}`);
		document.querySelector('#more-actions').innerHTML = menuItems.join('');
		popover.hidden = false;
		const rectangle = trigger.getBoundingClientRect();
		popover.style.left = `${Math.max(12, Math.min(innerWidth - 312, rectangle.right - 290))}px`;
		popover.style.top = `${Math.max(12, Math.min(innerHeight - popover.offsetHeight - 12, rectangle.bottom + 6))}px`;
		popover.querySelector('[role=menuitem]')?.focus();
	}
	function closeMore(focus = true) {
		if (menuTrigger) menuTrigger.setAttribute('aria-expanded', 'false');
		popover.hidden = true;
		if (focus) menuTrigger?.focus();
		menuTrigger = null;
	}
	function demo() {
		const toast = document.querySelector('#toast');
		toast.textContent = 'Ukázková akce — nic se neukládá ani nemění.';
		toast.classList.add('visible');
		setTimeout(() => toast.classList.remove('visible'), 1800);
	}
	Object.values(controls).forEach((control) => control.addEventListener('change', render));
	collection.addEventListener('click', (event) => {
		const more = event.target.closest('[data-more]');
		if (more) {
			event.stopPropagation();
			openMore(more.dataset.more, more);
			return;
		}
		if (event.target.closest('[data-demo]')) {
			event.stopPropagation();
			demo();
			return;
		}
		if (event.target.closest('a')) return;
		const card = event.target.closest('.gift-card');
		if (card) openDetail(card.dataset.giftId);
	});
	collection.addEventListener('keydown', (event) => {
		if (['Enter', ' '].includes(event.key) && event.target.classList.contains('gift-card')) {
			event.preventDefault();
			openDetail(event.target.dataset.giftId);
		}
		if (event.key === 'ArrowDown' && event.target.matches('[data-more]')) {
			event.preventDefault();
			openMore(event.target.dataset.more, event.target);
		}
	});
	popover.addEventListener('click', (event) => {
		if (event.target.closest('[data-demo]')) demo();
		if (event.target.closest('[data-detail]')) {
			const id = menuTrigger?.dataset.more;
			closeMore(false);
			openDetail(id);
		}
	});
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && !popover.hidden) {
			event.preventDefault();
			closeMore();
		}
	});
	window.addEventListener('resize', syncGeometry);
	render();
})();
