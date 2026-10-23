// Mockup-only renderer for the Kategorie settings tab. Plain JS, no dependencies.
(function () {
	const ICONS = {
		grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
		trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
		pencil: '<path d="M21.2 6.8a2.8 2.8 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5z"/>',
		plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
		up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
		down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
		undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
		close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
	};
	const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

	const PALETTE = ['#0369A1', '#047857', '#A21CAF', '#C2410C', '#4F46E5', '#B91C1C', '#0F766E', '#7E22CE', '#DB2777', '#EA580C', '#FACC15', '#65A30D', '#06B6D4', '#2563EB', '#9333EA', '#E11D48', '#92400E', '#6B7280', '#000000', '#FFFFFF'];

	// Seeded presets keep their colors; Sport and the long label are user-created.
	const SEED = [
		{ id: 'games', label: 'Hry', color: '#7C3AED', used: 3 },
		{ id: 'toys', label: 'Hračky', color: '#D97706', used: 0 },
		{ id: 'books', label: 'Knihy', color: '#2563EB', used: 4 },
		{ id: 'clothing', label: 'Oblečení', color: '#DB2777', used: 2 },
		{ id: 'electronics', label: 'Elektronika', color: '#0F766E', used: 5 },
		{ id: 'sport', label: 'Sport', color: '#0369A1', used: 2 },
		{ id: 'home', label: 'Domácnost', color: '#B45309', used: 0 },
		{ id: 'experiences', label: 'Zážitky', color: '#15803D', used: 1 },
		{ id: 'cottage', label: 'Věci na chalupu a do dílny', color: '#FACC15', used: 1 },
		{ id: 'subscriptions', label: 'Předplatné', color: '#6D28D9', used: 0 },
		{ id: 'care', label: 'Drogerie', color: '#BE185D', used: 0 },
	];

	function luminance(hex) {
		const channel = (index) => {
			const value = parseInt(hex.slice(index, index + 2), 16) / 255;
			return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		};
		return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
	}
	function foreground(hex) {
		const light = luminance(hex);
		return (light + 0.05) / 0.05 >= 1.05 / (light + 0.05) ? '#000000' : '#FFFFFF';
	}
	const escapeHtml = (text) => text.replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
	const badge = (category, extra = '') =>
		`<span class="badge" style="background:${category.color};color:${foreground(category.color)}" title="${escapeHtml(category.label)}" ${extra}>${escapeHtml(category.label)}</span>`;

	class CategoryEditor {
		constructor(frame, options) {
			this.frame = frame;
			this.options = options;
			this.body = frame.querySelector('.dialog-body');
			this.footerNote = frame.querySelector('.dirty-note');
			this.reset('rest');
			this.frame.addEventListener('click', (event) => this.onClick(event));
			this.body.addEventListener('keydown', (event) => this.onKeydown(event));
			this.body.addEventListener('pointerdown', (event) => this.onPointerDown(event));
			this.frame.addEventListener('input', (event) => this.onInput(event));
			this.body.addEventListener('focusout', (event) => this.onFocusOut(event));
			this.body.addEventListener('scroll', () => this.positionPopover());
		}

		get isMobile() {
			return this.options.viewport === 'mobile';
		}
		get reorderMode() {
			return this.isMobile ? this.options.mobileReorder : this.options.desktopReorder;
		}
		get columns() {
			return this.isMobile ? 1 : this.options.desktopColumns;
		}
		get stacked() {
			return this.isMobile && this.options.mobileRowLayout === 'stacked';
		}

		reset(state) {
			this.categories = state === 'empty' ? [] : SEED.map((category) => ({ ...category, removed: false }));
			this.renamingId = null;
			this.renameDraft = '';
			this.colorOpenId = null;
			this.colorDraft = null;
			this.newOpen = false;
			this.newDraft = '';
			this.dirty = false;
			this.previewDrag = false;
			if (state === 'rename') {
				this.renamingId = 'books';
				this.renameDraft = 'Knihy a komiksy';
			}
			if (state === 'color') {
				this.colorOpenId = 'clothing';
				this.colorDraft = '#A21CAF';
			}
			if (state === 'delete') {
				this.categories.find((category) => category.id === 'books').removed = true;
				this.dirty = true;
			}
			if (state === 'new') {
				this.newOpen = true;
				this.newDraft = 'Sportovní vybavení';
			}
			if (state === 'drag') this.previewDrag = true;
			// No auto-focus: both frames show their editing state at once, and focusing one would blur the other.
			this.render();
			this.body.scrollTop = state === 'new' ? this.body.scrollHeight : 0;
		}

		nextColor() {
			return PALETTE[this.categories.length % 8];
		}

		rowHtml(category, index) {
			const total = this.categories.length;
			const renaming = this.renamingId === category.id;
			const badgeArea = renaming
				? `<input class="rename-input" value="${escapeHtml(this.renameDraft)}" maxlength="40" aria-label="Název kategorie" data-rename="${category.id}">`
				: `<button type="button" class="badge-button" data-action="rename" aria-label="Přejmenovat kategorii ${escapeHtml(category.label)}">${badge(category)}<span class="pencil">${icon('pencil')}</span></button>`;
			const usage = `<span class="usage">Použito: ${category.used}</span>`;
			const swatch = `<button type="button" class="swatch-trigger" data-action="color" style="background:${category.color}" aria-label="Barva kategorie ${escapeHtml(category.label)}"></button>`;
			const trash = `<button type="button" class="icon-button" data-action="remove" aria-label="Odebrat kategorii">${icon('trash')}</button>`;
			const grip = `<button type="button" class="grip" data-grip aria-label="Přesunout kategorii" title="Šipkami změníte pořadí">${icon('grip')}</button>`;
			const arrows = `<button type="button" class="icon-button" data-action="up" aria-label="Posunout nahoru" ${index === 0 ? 'disabled' : ''}>${icon('up')}</button><button type="button" class="icon-button" data-action="down" aria-label="Posunout dolů" ${index === total - 1 ? 'disabled' : ''}>${icon('down')}</button>`;
			const attributes = `class="category-row${this.stacked ? ' is-stacked' : ''}${category.removed ? ' is-removed' : ''}" data-id="${category.id}"`;

			if (category.removed) {
				const note = category.used > 0
					? `Při uložení se odebere z ${category.used} přání.`
					: 'Při uložení se odebere.';
				const undo = `<button type="button" class="button button-outline button-small" data-action="restore">${icon('undo')}Vrátit</button>`;
				if (this.stacked) {
					return `<div ${attributes}><div class="stack-top"><div class="badge-slot">${badge(category)}</div><span style="padding-right:4px">${undo}</span></div><span class="removal-note">${note}</span></div>`;
				}
				return `<div ${attributes}>${this.reorderMode === 'drag' ? `<span style="width:var(--control);flex-shrink:0"></span>` : ''}<div class="badge-slot">${badge(category)}</div><span class="removal-note">${note}</span>${undo}</div>`;
			}
			if (this.stacked) {
				const reorder = this.reorderMode === 'arrows' ? arrows : '';
				return `<div ${attributes}><div class="stack-top">${this.reorderMode === 'drag' ? grip : ''}<div class="badge-slot">${badgeArea}</div></div><div class="stack-bottom">${usage}${swatch}${reorder}${trash}</div></div>`;
			}
			const lead = this.reorderMode === 'drag' ? grip : '';
			const tail = this.reorderMode === 'arrows' ? arrows : '';
			if (this.isMobile || this.columns > 1) {
				return `<div ${attributes}>${lead}<div class="badge-slot is-column">${badgeArea}${renaming ? '' : usage}</div>${swatch}${tail}${trash}</div>`;
			}
			return `<div ${attributes}>${lead}<div class="badge-slot">${badgeArea}</div>${renaming ? '' : usage}${swatch}${tail}${trash}</div>`;
		}

		newRowHtml() {
			if (!this.newOpen) {
				return `<button type="button" class="new-row" data-action="open-new"><span class="plus">${icon('plus')}</span>Nová kategorie</button>`;
			}
			const preview = { label: this.newDraft.trim() || 'Nová kategorie', color: this.nextColor() };
			return `<div class="new-row is-open"><span class="plus">${icon('plus')}</span><input class="text-input" placeholder="Název kategorie" maxlength="40" value="${escapeHtml(this.newDraft)}" data-new aria-label="Název nové kategorie"><span class="new-preview">${badge(preview)}</span><button type="button" class="button button-primary" data-action="add" style="height:var(--control);margin-right:var(--depth-clearance)">Přidat</button></div>`;
		}

		popoverHtml() {
			const category = this.categories.find((item) => item.id === this.colorOpenId);
			if (!category) return '';
			const draft = this.colorDraft ?? category.color;
			const swatches = PALETTE.map((color) => `<button type="button" class="swatch" data-swatch="${color}" style="background:${color}" aria-label="${color}" aria-pressed="${color === draft}"></button>`).join('');
			return `<div class="popover" role="dialog" aria-label="Barva kategorie ${escapeHtml(category.label)}">
				<div class="preview">Náhled ${badge({ ...category, color: draft })}</div>
				<div class="swatch-grid" role="group" aria-label="Přednastavené barvy">${swatches}</div>
				<label>Barva v hex formátu<input class="text-input" value="${draft}" maxlength="7" data-hex></label>
				<button type="button" class="button button-outline button-small" style="justify-self:start">Vybrat libovolnou barvu</button>
				<div class="actions"><button type="button" class="button button-outline" data-action="color-cancel">Zrušit</button><button type="button" class="button button-primary" data-action="color-save">Uložit</button></div>
			</div>`;
		}

		render() {
			const scrollTop = this.body.scrollTop;
			const active = this.categories.filter((category) => !category.removed).length;
			const list = this.categories.map((category, index) => this.rowHtml(category, index)).join('');
			const empty = this.categories.length === 0 ? '<p class="empty-note">Seznam zatím nemá žádné kategorie. Přání pak zůstanou bez kategorie.</p>' : '';
			const reorderHint = this.reorderMode === 'drag' ? 'přetažením za úchyt' : 'šipkami';
			const intro = `<p class="category-intro">Kategorie řadí přání do skupin. Pořadí změníte ${reorderHint}, název kliknutím na štítek. Změny se uloží tlačítkem Uložit.</p>`;
			const main = `<div><div class="section-heading"><h3>Kategorie</h3><span class="count">${active} ${active === 1 ? 'kategorie' : active >= 2 && active <= 4 ? 'kategorie' : 'kategorií'}</span></div>${empty}<div class="category-list" style="--columns:${this.columns}">${list}</div><div style="margin-top:8px;${this.columns > 1 && this.newOpen ? 'max-width:600px' : ''}${this.columns > 1 && !this.newOpen ? `width:calc((100% - ${(this.columns - 1) * 8}px) / ${this.columns})` : ''}">${this.newRowHtml()}</div></div>`;
			const aside = this.options.aside && !this.isMobile
				? `<aside class="order-aside"><h3>Pořadí na seznamu</h3><p>Při seskupení podle kategorie se skupiny zobrazí v tomto pořadí. Přání bez kategorie budou poslední.</p><div class="badge-wrap">${this.categories.filter((category) => !category.removed).map((category) => badge(category)).join('')}</div></aside>`
				: '';
			this.body.innerHTML = `${intro}<div class="category-layout${aside ? ' has-aside' : ''}">${main}${aside}</div>`;
			this.body.scrollTop = scrollTop;
			this.positionPopover();
			if (this.footerNote) this.footerNote.textContent = this.dirty ? 'Neuložené změny' : '';
			if (this.previewDrag) this.applyDragPreview();
		}

		// Mirrors the portaled Bits UI popover: aligned to the trigger end, flipped above on collision.
		positionPopover() {
			this.frame.querySelector('.popover')?.remove();
			if (!this.colorOpenId) return;
			const trigger = this.body.querySelector(`[data-id="${this.colorOpenId}"] .swatch-trigger`);
			if (!trigger) return;
			const holder = document.createElement('div');
			holder.innerHTML = this.popoverHtml();
			const popover = holder.firstElementChild;
			this.frame.appendChild(popover);
			const frameRect = this.frame.getBoundingClientRect();
			const bounds = (this.frame.querySelector('.viewport') ?? this.frame.querySelector('.dialog')).getBoundingClientRect();
			const rect = trigger.getBoundingClientRect();
			const gap = 8;
			let left = rect.right - popover.offsetWidth;
			left = Math.max(bounds.left + gap, Math.min(left, bounds.right - popover.offsetWidth - gap));
			let top = rect.bottom + gap;
			if (top + popover.offsetHeight > bounds.bottom - gap) top = rect.top - gap - popover.offsetHeight;
			popover.style.left = `${left - frameRect.left}px`;
			popover.style.top = `${top - frameRect.top}px`;
		}

		// Static "drag in progress" snapshot: Hračky lifted between Oblečení and Elektronika.
		applyDragPreview() {
			const list = this.body.querySelector('.category-list');
			const dragged = list.querySelector('[data-id="toys"]');
			const target = list.querySelector('[data-id="electronics"]');
			if (!dragged || !target) return;
			const placeholder = document.createElement('div');
			placeholder.className = 'category-placeholder';
			placeholder.style.height = `${dragged.offsetHeight}px`;
			dragged.remove();
			list.insertBefore(placeholder, target);
			list.appendChild(dragged);
			dragged.classList.add('is-preview-drag');
			dragged.style.width = `${placeholder.offsetWidth}px`;
			dragged.style.left = `${placeholder.offsetLeft + 10}px`;
			dragged.style.top = `${placeholder.offsetTop - 18}px`;
		}

		capture() {
			const rects = new Map();
			this.body.querySelectorAll('.category-row[data-id]').forEach((row) => rects.set(row.dataset.id, row.getBoundingClientRect()));
			return rects;
		}
		play(before) {
			this.body.querySelectorAll('.category-row[data-id]').forEach((row) => {
				const previous = before.get(row.dataset.id);
				if (!previous) return;
				const now = row.getBoundingClientRect();
				const deltaX = previous.left - now.left;
				const deltaY = previous.top - now.top;
				if (!deltaX && !deltaY) return;
				row.animate([{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: 'none' }], { duration: 325, easing: 'cubic-bezier(.2,.8,.2,1)' });
			});
		}

		move(id, offset) {
			const index = this.categories.findIndex((category) => category.id === id);
			const target = index + offset;
			if (target < 0 || target >= this.categories.length) return;
			const before = this.capture();
			const [item] = this.categories.splice(index, 1);
			this.categories.splice(target, 0, item);
			this.dirty = true;
			this.render();
			this.play(before);
		}

		commitRename() {
			const category = this.categories.find((item) => item.id === this.renamingId);
			if (category && this.renameDraft.trim()) {
				if (category.label !== this.renameDraft.trim()) this.dirty = true;
				category.label = this.renameDraft.trim();
			}
			const id = this.renamingId;
			this.renamingId = null;
			this.render();
			this.body.querySelector(`[data-id="${id}"] .badge-button`)?.focus({ preventScroll: true });
		}

		addNew() {
			const label = this.newDraft.trim();
			if (!label) return;
			this.categories.push({ id: `new-${Date.now()}`, label, color: this.nextColor(), used: 0, removed: false });
			this.newDraft = '';
			this.dirty = true;
			this.render();
			this.body.querySelector('.new-row .text-input')?.focus({ preventScroll: true });
		}

		onClick(event) {
			const swatch = event.target.closest('[data-swatch]');
			if (swatch) {
				this.colorDraft = swatch.dataset.swatch;
				this.render();
				return;
			}
			const actionElement = event.target.closest('[data-action]');
			if (!actionElement) return;
			const id = actionElement.closest('[data-id]')?.dataset.id;
			const category = this.categories.find((item) => item.id === id);
			switch (actionElement.dataset.action) {
				case 'rename':
					this.renamingId = id;
					this.renameDraft = category.label;
					this.colorOpenId = null;
					this.render();
					this.body.querySelector('.rename-input')?.select();
					break;
				case 'color':
					this.colorOpenId = this.colorOpenId === id ? null : id;
					this.colorDraft = category.color;
					this.render();
					break;
				case 'color-cancel':
					this.colorOpenId = null;
					this.render();
					break;
				case 'color-save': {
					const target = this.categories.find((item) => item.id === this.colorOpenId);
					if (target.color !== this.colorDraft) this.dirty = true;
					target.color = this.colorDraft;
					this.colorOpenId = null;
					this.render();
					break;
				}
				case 'remove': {
					const before = this.capture();
					if (category.used > 0) {
						category.removed = true;
					} else {
						this.categories = this.categories.filter((item) => item.id !== id);
					}
					this.dirty = true;
					this.render();
					this.play(before);
					break;
				}
				case 'restore':
					category.removed = false;
					this.render();
					break;
				case 'up':
					this.move(id, -1);
					break;
				case 'down':
					this.move(id, 1);
					break;
				case 'open-new':
					this.newOpen = true;
					this.render();
					this.body.querySelector('.new-row .text-input')?.focus();
					break;
				case 'add':
					this.addNew();
					break;
			}
		}

		onInput(event) {
			if (event.target.matches('.rename-input')) this.renameDraft = event.target.value;
			if (event.target.matches('[data-new]')) {
				this.newDraft = event.target.value;
				const preview = this.body.querySelector('.new-preview');
				preview.innerHTML = badge({ label: this.newDraft.trim() || 'Nová kategorie', color: this.nextColor() });
			}
			if (event.target.matches('[data-hex]') && /^#[0-9A-Fa-f]{6}$/.test(event.target.value)) {
				this.colorDraft = event.target.value.toUpperCase();
				this.frame.querySelector('.popover .preview').innerHTML = `Náhled ${badge({ ...this.categories.find((item) => item.id === this.colorOpenId), color: this.colorDraft })}`;
			}
		}

		onFocusOut(event) {
			if (event.target.matches('.rename-input') && this.renamingId) {
				setTimeout(() => this.renamingId && document.activeElement !== event.target && this.commitRename(), 0);
			}
		}

		onKeydown(event) {
			if (event.target.matches('.rename-input')) {
				if (event.key === 'Enter') { event.preventDefault(); this.commitRename(); }
				if (event.key === 'Escape') { this.renamingId = null; this.render(); }
				return;
			}
			if (event.target.matches('[data-new]')) {
				if (event.key === 'Enter') { event.preventDefault(); this.addNew(); }
				if (event.key === 'Escape') { this.newOpen = false; this.newDraft = ''; this.render(); }
				return;
			}
			if (event.target.matches('[data-grip]')) {
				const id = event.target.closest('[data-id]').dataset.id;
				const step = { ArrowUp: -this.columns, ArrowDown: this.columns, ArrowLeft: -1, ArrowRight: 1 }[event.key];
				if (step === undefined || (this.columns === 1 && /Left|Right/.test(event.key))) return;
				event.preventDefault();
				this.move(id, step);
				this.body.querySelector(`[data-id="${id}"] [data-grip]`)?.focus({ preventScroll: true });
			}
		}

		// Pointer drag: the lifted row follows the pointer; the target follows the row's center.
		onPointerDown(event) {
			const grip = event.target.closest('[data-grip]');
			if (!grip || event.button !== 0) return;
			event.preventDefault();
			this.previewDrag = false;
			const row = grip.closest('.category-row');
			const list = row.parentElement;
			const rect = row.getBoundingClientRect();
			const offsetX = event.clientX - rect.left;
			const offsetY = event.clientY - rect.top;
			const placeholder = document.createElement('div');
			placeholder.className = 'category-placeholder';
			placeholder.style.height = `${rect.height}px`;
			list.insertBefore(placeholder, row);
			row.classList.add('is-dragging');
			Object.assign(row.style, { width: `${rect.width}px`, left: `${rect.left}px`, top: `${rect.top}px` });
			list.classList.add('is-sorting');
			let lastY = event.clientY;
			let scrollTimer = null;

			const reposition = (clientX, clientY) => {
				row.style.left = `${clientX - offsetX}px`;
				row.style.top = `${clientY - offsetY}px`;
				const dragged = row.getBoundingClientRect();
				const centerX = dragged.left + dragged.width / 2;
				const centerY = dragged.top + dragged.height / 2;
				const slots = [...list.children].filter((child) => child !== row);
				let closest = null;
				let distance = Infinity;
				for (const slot of slots) {
					const box = slot.getBoundingClientRect();
					const value = Math.hypot(box.left + box.width / 2 - centerX, box.top + box.height / 2 - centerY);
					if (value < distance) { distance = value; closest = slot; }
				}
				if (!closest || closest === placeholder) return;
				const before = new Map(slots.map((slot) => [slot, slot.getBoundingClientRect()]));
				const placeholderIndex = slots.indexOf(placeholder);
				const closestIndex = slots.indexOf(closest);
				list.insertBefore(placeholder, closestIndex > placeholderIndex ? closest.nextSibling : closest);
				for (const slot of slots) {
					if (slot === placeholder) continue;
					const previous = before.get(slot);
					const now = slot.getBoundingClientRect();
					if (previous.top !== now.top || previous.left !== now.left) {
						slot.animate([{ transform: `translate(${previous.left - now.left}px, ${previous.top - now.top}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
					}
				}
			};
			const autoScroll = () => {
				const bodyRect = this.body.getBoundingClientRect();
				const edge = 48;
				if (lastY < bodyRect.top + edge) this.body.scrollTop -= 8;
				else if (lastY > bodyRect.bottom - edge) this.body.scrollTop += 8;
			};
			const onMove = (moveEvent) => {
				lastY = moveEvent.clientY;
				reposition(moveEvent.clientX, moveEvent.clientY);
			};
			scrollTimer = setInterval(autoScroll, 16);
			const onUp = () => {
				clearInterval(scrollTimer);
				window.removeEventListener('pointermove', onMove);
				window.removeEventListener('pointerup', onUp);
				const target = placeholder.getBoundingClientRect();
				const current = row.getBoundingClientRect();
				list.insertBefore(row, placeholder);
				placeholder.remove();
				row.classList.remove('is-dragging');
				row.removeAttribute('style');
				list.classList.remove('is-sorting');
				row.animate([{ transform: `translate(${current.left - target.left}px, ${current.top - target.top}px)`, boxShadow: 'var(--elevation-lifted)' }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
				const order = [...list.querySelectorAll('.category-row')].map((element) => element.dataset.id);
				const changed = order.join() !== this.categories.map((category) => category.id).join();
				this.categories.sort((first, second) => order.indexOf(first.id) - order.indexOf(second.id));
				if (changed) this.dirty = true;
				setTimeout(() => { this.render(); this.body.querySelector(`[data-id="${row.dataset.id}"] [data-grip]`)?.focus({ preventScroll: true }); }, 210);
			};
			window.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', onUp);
		}
	}

	function dialogHtml() {
		const tabs = ['Podrobnosti', 'Kategorie', 'Vzhled', 'Obrázek a ořezy', 'Import a export', 'Nebezpečná zóna']
			.map((label) => `<span class="${label === 'Kategorie' ? 'is-selected' : ''}">${label}</span>`).join('');
		return `<div class="dialog" role="dialog" aria-label="Nastavení seznamu">
			<div class="dialog-header"><h2>Nastavení seznamu</h2><p>Tak tohle si přeji!</p><span class="close-button">${icon('close')}</span></div>
			<div class="tabs">${tabs}</div>
			<div class="dialog-body"></div>
			<div class="dialog-footer"><span class="dirty-note"></span><button type="button" class="button button-primary">Uložit</button></div>
		</div>`;
	}

	const STATES = [
		['rest', 'Klid'],
		['rename', 'Přejmenování'],
		['color', 'Výběr barvy'],
		['drag', 'Přetahování'],
		['delete', 'Odebrání'],
		['new', 'Nová kategorie'],
		['empty', 'Prázdný seznam'],
	];

	window.mountCategoryMockup = function (options) {
		const desktop = document.querySelector('[data-frame="desktop"]');
		const mobile = document.querySelector('[data-frame="mobile"]');
		desktop.innerHTML = `<p class="frame-label">Desktop, dialog 1024 px</p>${dialogHtml()}`;
		mobile.innerHTML = `<p class="frame-label">Mobil, 390 px</p><div class="viewport">${dialogHtml()}</div>`;
		const editors = [
			new CategoryEditor(desktop, { ...options, viewport: 'desktop' }),
			new CategoryEditor(mobile, { ...options, viewport: 'mobile' }),
		];
		const switcher = document.querySelector('.state-switch');
		switcher.innerHTML = STATES.map(([key, label]) => `<button type="button" data-state="${key}">${label}</button>`).join('');
		const apply = (state) => {
			switcher.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.state === state)));
			editors.forEach((editor) => editor.reset(state));
		};
		switcher.addEventListener('click', (event) => {
			const button = event.target.closest('[data-state]');
			if (!button) return;
			history.replaceState(null, '', `#${button.dataset.state}`);
			apply(button.dataset.state);
		});
		const initial = location.hash.slice(1);
		const start = () => apply(STATES.some(([key]) => key === initial) ? initial : 'rest');
		document.fonts.ready.then(start);
	};
})();
