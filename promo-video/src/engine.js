/* Collage engine: paper textures, scissor-cut shapes, pencil strokes, sticker sprites. */
(() => {
	const P = (window.P = window.P || {});
	P.W = 1920;
	P.H = 1080;
	P.FPS = 30;
	P.BOIL_FPS = 8;

	P.C = {
		ink: '#16385c',
		inkSoft: '#2d5580',
		sky: '#1e9be9',
		deep: '#1265a8',
		bright: '#55b9f3',
		skyPale: '#d7eefc',
		sun: '#ffc93c',
		sunPale: '#ffe9a8',
		paper: '#fffdf7',
		cream: '#f8f1e2',
		creamDark: '#eadfc8',
		kraft: '#c8a57c',
		kraftDark: '#a9845c',
		coral: '#f97250',
		coralPale: '#ffc2ad',
		mint: '#14a56f',
		mintPale: '#9fdcbf',
		leaf: '#3f9a5b',
		sakura: '#ec5fa3',
		sakuraPale: '#f9c6dd',
		ruby: '#e23a57',
		grape: '#8b5cf6',
		skin: '#f7cfae',
		skinShade: '#e7aa86',
		cheek: '#f59a8a',
		hairBrown: '#6b3f2a',
		hairDark: '#2f2a33',
		hairGrey: '#c9c7cf',
		hairGinger: '#d9773a',
		grey: '#9aa6b2',
		white: '#ffffff',
	};

	/* ---------- math ---------- */
	P.clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
	P.lerp = (a, b, amount) => a + (b - a) * amount;
	P.progress = (time, start, duration) => P.clamp((time - start) / duration);
	P.hash = (...values) => {
		let hashValue = 2166136261;
		for (const value of values) {
			hashValue ^= Math.floor(value * 1000) | 0;
			hashValue = Math.imul(hashValue, 16777619);
			hashValue ^= hashValue >>> 13;
			hashValue = Math.imul(hashValue, 1274126177);
		}
		return ((hashValue ^ (hashValue >>> 16)) >>> 0) / 4294967296;
	};
	P.random = (seed) => {
		let state = Math.floor(seed * 7919 + 1) >>> 0 || 1;
		return () => {
			state ^= state << 13;
			state ^= state >>> 17;
			state ^= state << 5;
			return (state >>> 0) / 4294967296;
		};
	};
	P.noise = (x, seed = 0) => {
		const floor = Math.floor(x);
		const fraction = x - floor;
		const smooth = fraction * fraction * (3 - 2 * fraction);
		return P.lerp(P.hash(floor, seed), P.hash(floor + 1, seed), smooth) * 2 - 1;
	};
	P.ease = {
		linear: (x) => x,
		inQuad: (x) => x * x,
		outQuad: (x) => 1 - (1 - x) * (1 - x),
		inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
		inCubic: (x) => x * x * x,
		outCubic: (x) => 1 - (1 - x) ** 3,
		inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
		outQuint: (x) => 1 - (1 - x) ** 5,
		inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
		outBack: (x, overshoot = 1.9) =>
			1 + (overshoot + 1) * (x - 1) ** 3 + overshoot * (x - 1) ** 2,
		inBack: (x, overshoot = 1.7) => (overshoot + 1) * x * x * x - overshoot * x * x,
		outElastic: (x) =>
			x === 0 || x === 1
				? x
				: 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
	};
	/* Damped spring from 0 to 1: the signature "paper settles" motion. */
	P.spring = (time, frequency = 3.2, damping = 5.5) => {
		if (time <= 0) {
			return 0;
		}
		return 1 - Math.exp(-damping * time) * Math.cos(2 * Math.PI * frequency * time);
	};
	/* Stepped time for stop-motion feel: motion updates on twos at 15 fps. */
	P.step = (time, fps = 15) => Math.floor(time * fps) / fps;
	P.boilFrame = (time) => Math.floor(time * P.BOIL_FPS);

	/* ---------- canvases & textures ---------- */
	P.canvas = (width, height) => {
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.ceil(width));
		canvas.height = Math.max(1, Math.ceil(height));
		return canvas;
	};

	function grainCanvas(size, seed, { strength = 1, fibers = 60, speckles = 900 } = {}) {
		const canvas = P.canvas(size, size);
		const context = canvas.getContext('2d');
		const image = context.createImageData(size, size);
		const next = P.random(seed);
		const cells = [8, 32, 128];
		const lattices = cells.map((cellCount) =>
			Array.from({ length: cellCount * cellCount }, () => next()),
		);
		const sample = (lattice, cellCount, x, y) => {
			const gx = (x / size) * cellCount;
			const gy = (y / size) * cellCount;
			const x0 = Math.floor(gx);
			const y0 = Math.floor(gy);
			const fx = gx - x0;
			const fy = gy - y0;
			const at = (ix, iy) =>
				lattice[
					((iy + cellCount) % cellCount) * cellCount + ((ix + cellCount) % cellCount)
				];
			const sx = fx * fx * (3 - 2 * fx);
			const sy = fy * fy * (3 - 2 * fy);
			return P.lerp(
				P.lerp(at(x0, y0), at(x0 + 1, y0), sx),
				P.lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx),
				sy,
			);
		};
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const low = sample(lattices[0], 8, x, y);
				const middle = sample(lattices[1], 32, x, y);
				const high = sample(lattices[2], 128, x, y);
				const fine = next();
				const value =
					1 - strength * (0.05 * low + 0.05 * middle + 0.05 * high + 0.07 * fine);
				const index = (y * size + x) * 4;
				const level = Math.round(255 * value);
				image.data[index] = level;
				image.data[index + 1] = level;
				image.data[index + 2] = Math.round(level * 0.985);
				image.data[index + 3] = 255;
			}
		}
		context.putImageData(image, 0, 0);
		context.lineCap = 'round';
		for (let index = 0; index < fibers; index++) {
			const x = next() * size;
			const y = next() * size;
			const angle = next() * Math.PI * 2;
			const length = 6 + next() * 22;
			context.strokeStyle = `rgba(90,70,40,${0.05 + next() * 0.08})`;
			context.lineWidth = 0.6 + next() * 0.6;
			context.beginPath();
			context.moveTo(x, y);
			context.quadraticCurveTo(
				x + Math.cos(angle + 0.6) * length * 0.5,
				y + Math.sin(angle + 0.6) * length * 0.5,
				x + Math.cos(angle) * length,
				y + Math.sin(angle) * length,
			);
			context.stroke();
		}
		for (let index = 0; index < speckles; index++) {
			context.fillStyle = `rgba(60,50,40,${next() * 0.12})`;
			context.fillRect(next() * size, next() * size, 1 + next(), 1 + next());
		}
		return canvas;
	}

	const patternCache = new Map();
	let grain;
	let crayonGrain;
	P.initTextures = () => {
		grain = grainCanvas(512, 11);
		crayonGrain = (() => {
			const canvas = P.canvas(256, 256);
			const context = canvas.getContext('2d');
			const image = context.createImageData(256, 256);
			const next = P.random(5);
			for (let index = 0; index < 256 * 256; index++) {
				const y = Math.floor(index / 256);
				const streak = 0.5 + 0.5 * Math.sin(y * 1.7 + next() * 0.8);
				const alpha = next() < 0.18 + 0.2 * streak ? 0 : 255;
				image.data[index * 4 + 3] = alpha;
			}
			context.putImageData(image, 0, 0);
			return canvas;
		})();
		P.grain = grain;
	};

	/* A colored paper fill: flat color multiplied by the shared grain, cached per color. */
	P.paperFill = (context, color) => {
		let pattern = patternCache.get(color);
		if (!pattern) {
			const canvas = P.canvas(512, 512);
			const paperContext = canvas.getContext('2d');
			paperContext.fillStyle = color;
			paperContext.fillRect(0, 0, 512, 512);
			paperContext.globalCompositeOperation = 'multiply';
			paperContext.drawImage(grain, 0, 0);
			pattern = { canvas };
			patternCache.set(color, pattern);
		}
		return context.createPattern(pattern.canvas, 'repeat');
	};

	/* ---------- shapes as point lists ---------- */
	P.shape = {
		ellipse(cx, cy, rx, ry, count = 48, rotation = 0) {
			const points = [];
			for (let index = 0; index < count; index++) {
				const angle = (index / count) * Math.PI * 2;
				const x = Math.cos(angle) * rx;
				const y = Math.sin(angle) * ry;
				points.push([
					cx + x * Math.cos(rotation) - y * Math.sin(rotation),
					cy + x * Math.sin(rotation) + y * Math.cos(rotation),
				]);
			}
			return points;
		},
		rect(x, y, width, height) {
			return [
				[x, y],
				[x + width, y],
				[x + width, y + height],
				[x, y + height],
			];
		},
		roundRect(x, y, width, height, radius, cornerSteps = 6) {
			const points = [];
			const corners = [
				[x + width - radius, y + radius, -Math.PI / 2],
				[x + width - radius, y + height - radius, 0],
				[x + radius, y + height - radius, Math.PI / 2],
				[x + radius, y + radius, Math.PI],
			];
			for (const [cx, cy, startAngle] of corners) {
				for (let step = 0; step <= cornerSteps; step++) {
					const angle = startAngle + (step / cornerSteps) * (Math.PI / 2);
					points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
				}
			}
			return points;
		},
		arcBand(cx, cy, outerRadius, innerRadius, startAngle, endAngle, count = 32) {
			const outer = [];
			const inner = [];
			for (let index = 0; index <= count; index++) {
				const angle = startAngle + ((endAngle - startAngle) * index) / count;
				outer.push([
					cx + Math.cos(angle) * outerRadius,
					cy + Math.sin(angle) * outerRadius,
				]);
				inner.push([
					cx + Math.cos(angle) * innerRadius,
					cy + Math.sin(angle) * innerRadius,
				]);
			}
			return outer.concat(inner.reverse());
		},
		/* Thick ribbon following a centerline with per-point half-widths. */
		ribbon(centerline, widthAt) {
			const left = [];
			const right = [];
			centerline.forEach((point, index) => {
				const previous = centerline[Math.max(0, index - 1)];
				const next = centerline[Math.min(centerline.length - 1, index + 1)];
				const angle =
					Math.atan2(next[1] - previous[1], next[0] - previous[0]) + Math.PI / 2;
				const halfWidth =
					typeof widthAt === 'function'
						? widthAt(index / (centerline.length - 1))
						: widthAt;
				left.push([
					point[0] + Math.cos(angle) * halfWidth,
					point[1] + Math.sin(angle) * halfWidth,
				]);
				right.push([
					point[0] - Math.cos(angle) * halfWidth,
					point[1] - Math.sin(angle) * halfWidth,
				]);
			});
			return left.concat(right.reverse());
		},
		bezier(points, count = 40) {
			const result = [];
			for (let segment = 0; segment + 3 < points.length; segment += 3) {
				const [p0, p1, p2, p3] = points.slice(segment, segment + 4);
				for (let index = segment === 0 ? 0 : 1; index <= count; index++) {
					const t = index / count;
					const u = 1 - t;
					result.push([
						u * u * u * p0[0] +
							3 * u * u * t * p1[0] +
							3 * u * t * t * p2[0] +
							t * t * t * p3[0],
						u * u * u * p0[1] +
							3 * u * u * t * p1[1] +
							3 * u * t * t * p2[1] +
							t * t * t * p3[1],
					]);
				}
			}
			return result;
		},
		heart(cx, cy, size) {
			const points = [];
			for (let index = 0; index < 60; index++) {
				const t = (index / 60) * Math.PI * 2;
				const x = 16 * Math.sin(t) ** 3;
				const y = -(
					13 * Math.cos(t) -
					5 * Math.cos(2 * t) -
					2 * Math.cos(3 * t) -
					Math.cos(4 * t)
				);
				points.push([cx + (x * size) / 16, cy + (y * size) / 16]);
			}
			return points;
		},
		star(cx, cy, outerRadius, innerRadius, count = 5, rotation = -Math.PI / 2) {
			const points = [];
			for (let index = 0; index < count * 2; index++) {
				const radius = index % 2 === 0 ? outerRadius : innerRadius;
				const angle = rotation + (index * Math.PI) / count;
				points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
			}
			return points;
		},
		transform(points, { x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1 }) {
			const cosine = Math.cos(rotation);
			const sine = Math.sin(rotation);
			return points.map(([px, py]) => [
				x + px * scaleX * cosine - py * scaleY * sine,
				y + px * scaleX * sine + py * scaleY * cosine,
			]);
		},
	};

	/* Scissor-cut edge: resample closed outline into short straight snips with slight wander. */
	P.cut = (points, seed = 1, { spacing = 16, wander = 1.6 } = {}) => {
		const next = P.random(seed);
		const result = [];
		const closed = points.concat([points[0]]);
		let carry = 0;
		for (let index = 0; index < closed.length - 1; index++) {
			const [x0, y0] = closed[index];
			const [x1, y1] = closed[index + 1];
			const length = Math.hypot(x1 - x0, y1 - y0);
			const normalX = -(y1 - y0) / (length || 1);
			const normalY = (x1 - x0) / (length || 1);
			let position = carry;
			while (position < length) {
				const amount = position / length;
				const offset = (next() * 2 - 1) * wander;
				result.push([
					x0 + (x1 - x0) * amount + normalX * offset,
					y0 + (y1 - y0) * amount + normalY * offset,
				]);
				position += spacing * (0.6 + next() * 0.8);
			}
			carry = position - length;
		}
		return result;
	};

	/* Torn edge: fine jagged noise, used for torn paper sheets. */
	P.torn = (points, seed = 1, { spacing = 5, amplitude = 5 } = {}) => {
		const next = P.random(seed);
		const result = [];
		const closed = points.concat([points[0]]);
		let walk = 0;
		for (let index = 0; index < closed.length - 1; index++) {
			const [x0, y0] = closed[index];
			const [x1, y1] = closed[index + 1];
			const length = Math.hypot(x1 - x0, y1 - y0);
			const normalX = -(y1 - y0) / (length || 1);
			const normalY = (x1 - x0) / (length || 1);
			for (let position = 0; position < length; position += spacing) {
				walk = walk * 0.7 + (next() * 2 - 1) * amplitude * 0.6;
				const offset = walk + (next() * 2 - 1) * amplitude * 0.35;
				const amount = position / length;
				result.push([
					x0 + (x1 - x0) * amount + normalX * offset,
					y0 + (y1 - y0) * amount + normalY * offset,
				]);
			}
		}
		return result;
	};

	P.tracePath = (context, points, closed = true) => {
		context.beginPath();
		points.forEach(([x, y], index) =>
			index === 0 ? context.moveTo(x, y) : context.lineTo(x, y),
		);
		if (closed) {
			context.closePath();
		}
	};

	/* ---------- drawing primitives for sprites ---------- */
	/* The sprite builder sets P.variant so pencil lines boil while cut paper stays fixed. */
	P.variant = 0;

	P.piece = (
		context,
		points,
		color,
		{ seed = 1, cut = true, spacing = 16, wander = 1.4, shade = 0, alpha = 1 } = {},
	) => {
		const outline = cut ? P.cut(points, seed, { spacing, wander }) : points;
		context.save();
		context.globalAlpha = alpha;
		P.tracePath(context, outline);
		context.fillStyle = P.paperFill(context, color);
		context.fill();
		if (shade) {
			context.clip();
			const bounds = P.bounds(outline);
			const gradient = context.createLinearGradient(
				bounds.x,
				bounds.y,
				bounds.x + bounds.width,
				bounds.y + bounds.height,
			);
			gradient.addColorStop(0, 'rgba(255,255,255,0.12)');
			gradient.addColorStop(0.55, 'rgba(255,255,255,0)');
			gradient.addColorStop(1, `rgba(22,56,92,${0.18 * shade})`);
			context.fillStyle = gradient;
			context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
		}
		context.restore();
		return outline;
	};

	P.bounds = (points) => {
		let minimumX = Infinity,
			minimumY = Infinity,
			maximumX = -Infinity,
			maximumY = -Infinity;
		for (const [x, y] of points) {
			minimumX = Math.min(minimumX, x);
			minimumY = Math.min(minimumY, y);
			maximumX = Math.max(maximumX, x);
			maximumY = Math.max(maximumY, y);
		}
		return {
			x: minimumX,
			y: minimumY,
			width: maximumX - minimumX,
			height: maximumY - minimumY,
		};
	};

	/* Graphite/ink pencil stroke with pressure variation, gaps and overshoot; boils per variant. */
	P.pencil = (
		context,
		points,
		{
			closed = false,
			seed = 1,
			width = 3,
			color = P.C.ink,
			alpha = 0.9,
			wobble = 1.6,
			passes = 2,
			gaps = true,
		} = {},
	) => {
		const path = closed ? points.concat([points[0], points[1] || points[0]]) : points;
		context.save();
		context.lineCap = 'round';
		context.lineJoin = 'round';
		context.strokeStyle = color;
		for (let pass = 0; pass < passes; pass++) {
			const next = P.random(seed * 31 + pass * 7 + P.variant * 101);
			const offsetX = (next() - 0.5) * wobble;
			const offsetY = (next() - 0.5) * wobble;
			let drawing = true;
			context.beginPath();
			let started = false;
			for (let index = 0; index < path.length; index++) {
				const [x, y] = path[index];
				const jitterX = x + offsetX + (next() - 0.5) * wobble * 0.8;
				const jitterY = y + offsetY + (next() - 0.5) * wobble * 0.8;
				if (gaps && index > 2 && next() < 0.012) {
					drawing = !drawing;
				}
				if (!drawing) {
					started = false;
					if (next() < 0.5) {
						drawing = true;
					}
					continue;
				}
				if (!started) {
					context.moveTo(jitterX, jitterY);
					started = true;
				} else {
					context.lineTo(jitterX, jitterY);
				}
			}
			context.globalAlpha = alpha * (pass === 0 ? 1 : 0.45);
			context.lineWidth = pass === 0 ? width : width * 0.6;
			context.stroke();
		}
		context.restore();
	};

	/* Crayon hatching clipped to a shape. */
	P.hatch = (
		context,
		points,
		{
			angle = -0.9,
			spacing = 9,
			color = P.C.ink,
			alpha = 0.18,
			width = 1.6,
			seed = 1,
			region = null,
		} = {},
	) => {
		const bounds = P.bounds(points);
		context.save();
		P.tracePath(context, points);
		context.clip();
		if (region) {
			P.tracePath(context, region);
			context.clip();
		}
		context.strokeStyle = color;
		context.lineWidth = width;
		context.lineCap = 'round';
		context.globalAlpha = alpha;
		const next = P.random(seed + P.variant * 13);
		const diagonal = Math.hypot(bounds.width, bounds.height);
		const cx = bounds.x + bounds.width / 2;
		const cy = bounds.y + bounds.height / 2;
		context.beginPath();
		for (
			let offset = -diagonal / 2;
			offset < diagonal / 2;
			offset += spacing * (0.8 + next() * 0.4)
		) {
			const dx = Math.cos(angle);
			const dy = Math.sin(angle);
			const startX = cx - dx * diagonal * 0.6 - dy * offset;
			const startY = cy - dy * diagonal * 0.6 + dx * offset;
			context.moveTo(startX + (next() - 0.5) * 4, startY + (next() - 0.5) * 4);
			context.lineTo(
				startX + dx * diagonal * 1.2 + (next() - 0.5) * 4,
				startY + dy * diagonal * 1.2 + (next() - 0.5) * 4,
			);
		}
		context.stroke();
		context.restore();
	};

	/* Soft crayon fill (for cheeks, highlights): grainy, semi-transparent. */
	P.crayon = (context, points, color, alpha = 0.6) => {
		context.save();
		P.tracePath(context, points);
		context.clip();
		const bounds = P.bounds(points);
		const layer = P.canvas(bounds.width + 4, bounds.height + 4);
		const layerContext = layer.getContext('2d');
		layerContext.fillStyle = color;
		layerContext.fillRect(0, 0, layer.width, layer.height);
		layerContext.globalCompositeOperation = 'destination-in';
		layerContext.fillStyle = layerContext.createPattern(crayonGrain, 'repeat');
		layerContext.fillRect(0, 0, layer.width, layer.height);
		context.globalAlpha = alpha;
		context.drawImage(layer, bounds.x - 2, bounds.y - 2);
		context.restore();
	};

	P.dots = (
		context,
		points,
		{ color = P.C.white, radius = 5, spacing = 26, alpha = 0.8, seed = 1 } = {},
	) => {
		const bounds = P.bounds(points);
		const next = P.random(seed);
		context.save();
		P.tracePath(context, points);
		context.clip();
		context.fillStyle = color;
		context.globalAlpha = alpha;
		for (let y = bounds.y; y < bounds.y + bounds.height + spacing; y += spacing) {
			for (
				let x = bounds.x + ((Math.round(y / spacing) % 2) * spacing) / 2;
				x < bounds.x + bounds.width + spacing;
				x += spacing
			) {
				P.tracePath(
					context,
					P.shape.ellipse(
						x + (next() - 0.5) * 3,
						y + (next() - 0.5) * 3,
						radius,
						radius * (0.9 + next() * 0.2),
						10,
					),
				);
				context.fill();
			}
		}
		context.restore();
	};

	P.stripes = (
		context,
		points,
		{ color, width = 18, spacing = 44, angle = 0, alpha = 1, seed = 1 } = {},
	) => {
		const bounds = P.bounds(points);
		context.save();
		P.tracePath(context, points);
		context.clip();
		const cx = bounds.x + bounds.width / 2;
		const cy = bounds.y + bounds.height / 2;
		context.translate(cx, cy);
		context.rotate(angle);
		context.globalAlpha = alpha;
		const extent = Math.hypot(bounds.width, bounds.height);
		const next = P.random(seed);
		for (let offset = -extent; offset < extent; offset += spacing) {
			const stripe = P.cut(P.shape.rect(offset, -extent, width, extent * 2), seed + offset, {
				spacing: 30,
				wander: 1.2,
			});
			P.tracePath(context, stripe);
			context.fillStyle = P.paperFill(context, color);
			context.fill();
			next();
		}
		context.restore();
	};

	/* ---------- sprites ---------- */
	const sprites = new Map();

	/*
	 * Builds a sticker sprite: art drawn centered at origin inside a width x height box, then a
	 * white paper border grown around its silhouette. Several variants re-draw pencil lines for boil.
	 */
	P.sprite = (
		key,
		width,
		height,
		draw,
		{ border = 9, variants = 3, borderColor = P.C.paper, scale = 1 } = {},
	) => {
		if (sprites.has(key)) {
			return sprites.get(key);
		}
		const pad = border + 14;
		const canvasWidth = (width + pad * 2) * scale;
		const canvasHeight = (height + pad * 2) * scale;
		const frames = [];
		for (let variant = 0; variant < variants; variant++) {
			P.variant = variant;
			const art = P.canvas(canvasWidth, canvasHeight);
			const artContext = art.getContext('2d');
			artContext.scale(scale, scale);
			artContext.translate(width / 2 + pad, height / 2 + pad);
			draw(artContext, variant);
			const frame = P.canvas(canvasWidth, canvasHeight);
			const frameContext = frame.getContext('2d');
			if (border > 0) {
				const silhouette = P.canvas(canvasWidth, canvasHeight);
				const silhouetteContext = silhouette.getContext('2d');
				const steps = 20;
				const next = P.random(key.length * 17 + 3);
				for (let step = 0; step < steps; step++) {
					const angle = (step / steps) * Math.PI * 2;
					const distance = border * scale * (0.92 + next() * 0.16);
					silhouetteContext.drawImage(
						art,
						Math.cos(angle) * distance,
						Math.sin(angle) * distance,
					);
				}
				silhouetteContext.drawImage(art, 0, 0);
				silhouetteContext.globalCompositeOperation = 'source-in';
				silhouetteContext.fillStyle = P.paperFill(silhouetteContext, borderColor);
				silhouetteContext.fillRect(0, 0, canvasWidth, canvasHeight);
				frameContext.drawImage(silhouette, 0, 0);
			}
			frameContext.drawImage(art, 0, 0);
			frames.push(frame);
		}
		P.variant = 0;
		const shadow = P.canvas(canvasWidth, canvasHeight);
		const shadowContext = shadow.getContext('2d');
		shadowContext.filter = `blur(${5 * scale}px)`;
		shadowContext.drawImage(frames[0], 0, 0);
		shadowContext.filter = 'none';
		shadowContext.globalCompositeOperation = 'source-in';
		shadowContext.fillStyle = 'rgba(22,40,70,1)';
		shadowContext.fillRect(0, 0, canvasWidth, canvasHeight);
		const sprite = {
			key,
			frames,
			shadow,
			width: canvasWidth / scale,
			height: canvasHeight / scale,
			scale,
		};
		sprites.set(key, sprite);
		return sprite;
	};
	P.getSprite = (key) => sprites.get(key);

	/*
	 * Draws a sprite. `lift` raises the sticker off the page: bigger, softer, further shadow.
	 * anchorX/anchorY are fractions of the art box (0.5 = center).
	 */
	P.draw = (
		context,
		sprite,
		x,
		y,
		{
			scale = 1,
			rotation = 0,
			alpha = 1,
			time = 0,
			lift = 0,
			anchorX = 0.5,
			anchorY = 0.5,
			flipX = false,
			scaleY = 1,
			shadowAlpha = 0.34,
			boilOffset = 0,
		} = {},
	) => {
		if (!sprite || alpha <= 0 || scale <= 0.001) {
			return;
		}
		const frame = sprite.frames[(P.boilFrame(time) + boilOffset) % sprite.frames.length];
		const width = sprite.width;
		const height = sprite.height;
		const offsetX = -width * anchorX;
		const offsetY = -height * anchorY;
		context.save();
		context.globalAlpha = alpha * shadowAlpha * (1 - lift * 0.35);
		const shadowDistance = 5 + lift * 22;
		context.translate(x + shadowDistance * 0.7 * scale, y + shadowDistance * scale);
		context.rotate(rotation);
		context.scale(
			scale * (1 + lift * 0.03) * (flipX ? -1 : 1),
			scale * scaleY * (1 + lift * 0.03),
		);
		context.drawImage(sprite.shadow, offsetX, offsetY, width, height);
		context.restore();
		context.save();
		context.globalAlpha = alpha;
		context.translate(x, y);
		context.rotate(rotation);
		context.scale(
			scale * (1 + lift * 0.04) * (flipX ? -1 : 1),
			scale * scaleY * (1 + lift * 0.04),
		);
		context.drawImage(frame, offsetX, offsetY, width, height);
		context.restore();
	};

	/* Pop-in with overshoot, used for most sticker entrances. Returns scale and lift. */
	P.popIn = (time, start, duration = 0.45) => {
		const local = time - start;
		if (local <= 0) {
			return { scale: 0, lift: 1, alpha: 0 };
		}
		const amount = P.spring(local, 2.4, 7);
		return { scale: amount, lift: P.clamp(1 - local / duration), alpha: 1 };
	};

	/* ---------- hand lettering ---------- */
	P.font = {
		display: '"DynaPuff", "Comic Sans MS", sans-serif',
		hand: '"Caveat", "Comic Sans MS", cursive',
		body: '"Geist", system-ui, sans-serif',
	};

	/* Handwritten text that writes on left to right; boils slightly with the pencil. */
	P.handText = (
		context,
		text,
		x,
		y,
		{
			size = 64,
			color = P.C.ink,
			weight = 700,
			reveal = 1,
			align = 'left',
			time = 0,
			rotation = 0,
			font = P.font.hand,
			alpha = 1,
			stroke = null,
			strokeWidth = 0,
		} = {},
	) => {
		if (reveal <= 0) {
			return;
		}
		context.save();
		const boil = P.boilFrame(time);
		context.translate(x + (P.hash(boil, 1) - 0.5) * 1.2, y + (P.hash(boil, 2) - 0.5) * 1.2);
		context.rotate(rotation + (P.hash(boil, 3) - 0.5) * 0.004);
		context.font = `${weight} ${size}px ${font}`;
		context.textAlign = align;
		context.textBaseline = 'alphabetic';
		const metrics = context.measureText(text);
		const width = metrics.width;
		const startX = align === 'center' ? -width / 2 : align === 'right' ? -width : 0;
		if (reveal < 1) {
			context.beginPath();
			const edge = startX + width * reveal;
			context.moveTo(startX - 20, -size * 1.2);
			context.lineTo(edge + size * 0.3, -size * 1.2);
			context.lineTo(edge, size * 0.5);
			context.lineTo(startX - 20, size * 0.5);
			context.closePath();
			context.clip();
		}
		context.globalAlpha = alpha;
		if (stroke) {
			context.lineJoin = 'round';
			context.strokeStyle = stroke;
			context.lineWidth = strokeWidth;
			context.strokeText(text, 0, 0);
		}
		context.fillStyle = color;
		context.fillText(text, 0, 0);
		context.restore();
		return width;
	};

	/* Pencil line that draws itself along a polyline (0..1). */
	P.drawOn = (context, points, amount, options = {}) => {
		if (amount <= 0) {
			return;
		}
		const lengths = [0];
		for (let index = 1; index < points.length; index++) {
			lengths.push(
				lengths[index - 1] +
					Math.hypot(
						points[index][0] - points[index - 1][0],
						points[index][1] - points[index - 1][1],
					),
			);
		}
		const target = lengths[lengths.length - 1] * P.clamp(amount);
		const visible = [];
		for (let index = 0; index < points.length; index++) {
			if (lengths[index] <= target) {
				visible.push(points[index]);
			} else {
				const previous = points[index - 1];
				const fraction =
					(target - lengths[index - 1]) / (lengths[index] - lengths[index - 1]);
				visible.push([
					P.lerp(previous[0], points[index][0], fraction),
					P.lerp(previous[1], points[index][1], fraction),
				]);
				break;
			}
		}
		if (visible.length > 1) {
			P.pencil(context, visible, { gaps: false, ...options });
		}
	};

	/* Resample a polyline to evenly spaced points (smooth pencil). */
	P.resample = (points, spacing = 6) => {
		const result = [points[0]];
		let carry = 0;
		for (let index = 1; index < points.length; index++) {
			const [x0, y0] = points[index - 1];
			const [x1, y1] = points[index];
			const length = Math.hypot(x1 - x0, y1 - y0);
			let position = spacing - carry;
			while (position <= length) {
				result.push([
					x0 + ((x1 - x0) * position) / length,
					y0 + ((y1 - y0) * position) / length,
				]);
				position += spacing;
			}
			carry = length - (position - spacing);
		}
		result.push(points[points.length - 1]);
		return result;
	};
})();
