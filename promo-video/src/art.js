/* Prop library: every object is cut paper + pencil, cached as boiling sticker sprites. */
(() => {
	const P = window.P;
	const C = P.C;
	const S = P.shape;
	const art = (P.art = {});

	const part = (
		context,
		points,
		color,
		{
			seed = 1,
			line = 3,
			shade = 1,
			lineColor = C.ink,
			cut = true,
			lineAlpha = 0.85,
			spacing = 16,
		} = {},
	) => {
		const outline = P.piece(context, points, color, { seed, shade, cut, spacing });
		if (line) {
			P.pencil(context, outline, {
				closed: true,
				seed,
				width: line,
				color: lineColor,
				alpha: lineAlpha,
			});
		}
		return outline;
	};
	art.part = part;

	const line = (context, points, options = {}) =>
		P.pencil(context, P.resample(points, 5), { gaps: false, passes: 2, ...options });
	art.line = line;

	const text = (
		context,
		value,
		x,
		y,
		{
			size = 40,
			font = P.font.hand,
			weight = 700,
			color = C.ink,
			align = 'center',
			baseline = 'middle',
			rotation = 0,
			letterSpacing = 0,
		} = {},
	) => {
		context.save();
		context.translate(x, y);
		context.rotate(rotation + (P.hash(P.variant, value.length) - 0.5) * 0.01);
		context.font = `${weight} ${size}px ${font}`;
		context.textAlign = align;
		context.textBaseline = baseline;
		if (letterSpacing) {
			context.letterSpacing = `${letterSpacing}px`;
		}
		context.fillStyle = color;
		context.fillText(
			value,
			(P.hash(P.variant, 7) - 0.5) * 1.2,
			(P.hash(P.variant, 9) - 0.5) * 1.2,
		);
		context.restore();
	};
	art.text = text;

	const sparkleShape = (cx, cy, radius) => {
		const points = [];
		for (let index = 0; index < 8; index++) {
			const angle = (index * Math.PI) / 4 - Math.PI / 2;
			const r = index % 2 === 0 ? radius : radius * 0.28;
			points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
		}
		return points;
	};
	art.sparkleShape = sparkleShape;

	/* ---------- gifts ---------- */
	art.giftBody = (color = C.sky, ribbon = C.sun, key = '') =>
		P.sprite(`gift-body-${color}-${ribbon}-${key}`, 230, 170, (context) => {
			const body = part(context, S.rect(-105, -80, 210, 165), color, { seed: 3 });
			P.hatch(context, body, { region: S.rect(40, -80, 80, 170), alpha: 0.12, seed: 4 });
			if (key === 'dots') {
				P.dots(context, body, { color: C.white, radius: 6, spacing: 34, alpha: 0.7 });
			}
			if (key === 'stripes') {
				P.stripes(context, body, {
					color: C.white,
					width: 14,
					spacing: 42,
					angle: 0.6,
					alpha: 0.55,
				});
			}
			part(context, S.rect(-19, -80, 38, 165), ribbon, { seed: 5, line: 2.4, spacing: 20 });
		});

	art.giftLid = (color = C.sky, ribbon = C.sun, key = '') =>
		P.sprite(`gift-lid-${color}-${ribbon}-${key}`, 270, 150, (context) => {
			const loop = (side) => {
				const points = S.bezier([
					[0, 22],
					[side * 20, -40],
					[side * 110, -70],
					[side * 92, -8],
					[side * 80, 30],
					[side * 30, 30],
					[0, 22],
				]);
				const outline = part(context, points, ribbon, { seed: side + 9, line: 2.6 });
				line(
					context,
					[
						[side * 12, 16],
						[side * 55, -20],
						[side * 70, -24],
					],
					{ seed: side + 20, width: 2, alpha: 0.6 },
				);
				return outline;
			};
			context.save();
			context.translate(0, -30);
			loop(-1);
			loop(1);
			context.restore();
			const lid = part(context, S.rect(-122, -8, 244, 62), color, { seed: 7 });
			if (key === 'dots') {
				P.dots(context, lid, { color: C.white, radius: 6, spacing: 34, alpha: 0.7 });
			}
			if (key === 'stripes') {
				P.stripes(context, lid, {
					color: C.white,
					width: 14,
					spacing: 42,
					angle: 0.6,
					alpha: 0.55,
				});
			}
			P.hatch(context, lid, { region: S.rect(-130, 34, 270, 30), alpha: 0.14, seed: 8 });
			part(context, S.rect(-19, -8, 38, 62), ribbon, { seed: 11, line: 2.4, spacing: 20 });
			part(context, S.ellipse(0, -8, 24, 20, 20), ribbon, { seed: 12, line: 2.6 });
		});

	/* Closed gift = body + lid; lidLift in px for opening animation. */
	art.drawGift = (
		context,
		x,
		y,
		{
			color = C.sky,
			ribbon = C.sun,
			key = '',
			scale = 1,
			rotation = 0,
			time = 0,
			lift = 0,
			lidLift = 0,
			lidRotation = 0,
			alpha = 1,
		} = {},
	) => {
		const body = art.giftBody(color, ribbon, key);
		const lid = art.giftLid(color, ribbon, key);
		P.draw(context, body, x, y, { scale, rotation, time, lift, alpha });
		const cosine = Math.cos(rotation);
		const sine = Math.sin(rotation);
		const lidOffsetY = (-102 - lidLift) * scale;
		P.draw(context, lid, x - sine * lidOffsetY, y + cosine * lidOffsetY, {
			scale,
			rotation: rotation + lidRotation,
			time,
			lift: lift + P.clamp(lidLift / 200),
			alpha,
			anchorY: 0.62,
		});
	};

	/* ---------- duplicate-gift world ---------- */
	art.scarf = (main = C.coral, stripe = C.sunPale, key = 'a') =>
		P.sprite(`scarf-${main}-${stripe}-${key}`, 520, 250, (context) => {
			const centerline = S.bezier(
				[
					[-230, 30],
					[-150, -90],
					[-40, 90],
					[40, -10],
					[110, -90],
					[180, 20],
					[235, -40],
				],
				30,
			);
			const outline = part(context, S.ribbon(centerline, 50), main, { seed: 21 });
			const bands = [];
			for (let index = 2; index < centerline.length - 2; index += 7) {
				bands.push(index);
			}
			context.save();
			P.tracePath(context, outline);
			context.clip();
			for (const index of bands) {
				const band = S.ribbon(centerline.slice(index, index + 3), 42);
				P.piece(context, band, stripe, { seed: index, spacing: 12 });
			}
			P.hatch(context, outline, { alpha: 0.1, spacing: 7, angle: 1.1, seed: 22 });
			context.restore();
			for (const end of [0, centerline.length - 1]) {
				const [x, y] = centerline[end];
				const direction = end === 0 ? -1 : 1;
				for (let fringe = -3; fringe <= 3; fringe++) {
					line(
						context,
						[
							[x + direction * 2, y + fringe * 11],
							[x + direction * 34, y + fringe * 13 + 6],
						],
						{
							seed: fringe + end,
							width: 4,
							color: main === C.coral ? '#d75a3c' : C.inkSoft,
							alpha: 0.95,
						},
					);
				}
			}
		});

	art.mug = (color = C.creamDark, key = 'plain') =>
		P.sprite(`mug-${color}-${key}`, 220, 200, (context) => {
			part(context, S.arcBand(62, 0, 58, 32, -Math.PI / 2, Math.PI / 2, 24), color, {
				seed: 31,
			});
			const body = part(context, S.roundRect(-90, -85, 160, 175, 22), color, { seed: 32 });
			P.hatch(context, body, { region: S.rect(20, -90, 60, 190), alpha: 0.14, seed: 33 });
			part(context, S.ellipse(-10, -85, 80, 16, 32), C.inkSoft, {
				seed: 34,
				line: 2.4,
				shade: 0,
			});
			part(context, S.heart(-10, 5, 32), C.coral, { seed: 35, line: 2.2 });
			for (const offset of [-40, 0, 30]) {
				const wisp = [];
				for (let step = 0; step < 12; step++) {
					wisp.push([offset - 10 + Math.sin(step * 0.9 + offset) * 9, -110 - step * 7]);
				}
				line(context, wisp, { seed: offset + 3, width: 2.4, alpha: 0.35 });
			}
		});

	art.sock = (color = C.mintPale, key = 'a') =>
		P.sprite(`sock-${color}-${key}`, 160, 240, (context) => {
			const outline = S.bezier([
				[-40, -110],
				[-40, -40],
				[-40, 10],
				[-40, 50],
				[-40, 110],
				[40, 115],
				[70, 90],
				[90, 60],
				[40, 40],
				[35, 10],
				[35, -40],
				[35, -110],
				[-40, -110],
			]);
			const sock = part(context, outline, color, { seed: 41 });
			P.stripes(context, sock, {
				color: C.white,
				width: 10,
				spacing: 30,
				angle: Math.PI / 2,
				alpha: 0.6,
			});
			part(context, S.rect(-44, -115, 84, 30), C.white, { seed: 42, line: 2.2 });
		});

	art.target = () =>
		P.sprite('target', 360, 470, (context) => {
			line(
				context,
				[
					[-80, 120],
					[-120, 230],
				],
				{ seed: 51, width: 9, color: C.kraftDark },
			);
			line(
				context,
				[
					[80, 120],
					[120, 230],
				],
				{ seed: 52, width: 9, color: C.kraftDark },
			);
			const colors = [C.deep, C.white, C.coral, C.white, C.sun];
			colors.forEach((color, index) =>
				part(context, S.ellipse(0, -50, 170 - index * 34, 170 - index * 34, 56), color, {
					seed: 53 + index,
					line: 2.6,
					shade: index === 0 ? 1 : 0,
				}),
			);
		});

	art.arrow = () =>
		P.sprite('arrow', 330, 90, (context) => {
			line(
				context,
				[
					[-150, 0],
					[120, 0],
				],
				{ seed: 61, width: 7, color: C.kraftDark, passes: 1 },
			);
			for (const side of [-1, 1]) {
				part(
					context,
					[
						[-160, 0],
						[-120, side * 34],
						[-86, side * 30],
						[-110, 0],
					],
					C.sky,
					{ seed: 62 + side, line: 2.2 },
				);
			}
			part(
				context,
				S.transform(S.heart(0, 0, 30), { x: 140, rotation: Math.PI / 2 }),
				C.sakura,
				{ seed: 64, line: 2.6 },
			);
		});

	art.scissors = (open = 0) => {
		const blade = (side) => (context) => {
			context.save();
			context.rotate(side * (0.08 + open * 0.34));
			const bladeShape = S.bezier([
				[0, -14],
				[120, -26],
				[260, -16],
				[330, 0],
				[260, 10],
				[120, 16],
				[0, 14],
			]);
			const outline = part(context, S.transform(bladeShape, { scaleY: side }), '#cfd9e3', {
				seed: 70 + side,
				line: 3,
			});
			line(
				context,
				S.transform(
					[
						[20, 0],
						[300, side * 2],
					],
					{},
				),
				{ seed: 72, width: 1.6, alpha: 0.35 },
			);
			P.hatch(context, outline, { alpha: 0.12, spacing: 8, seed: 73 + side });
			const handle = S.transform(S.ellipse(-100, -side * 40, 62, 44, 36, -side * 0.3), {});
			part(context, handle, C.sky, { seed: 74 + side, line: 3.2 });
			part(context, S.ellipse(-100, -side * 40, 34, 20, 24, -side * 0.3), C.skyPale, {
				seed: 76 + side,
				line: 2.4,
				shade: 0,
			});
			part(context, S.rect(-50, -side * 16 - 8, 56, 16), C.sky, { seed: 78 + side, line: 2 });
			context.restore();
		};
		const key = `scissors-${Math.round(open * 20)}`;
		return P.sprite(key, 520, 280, (context) => {
			context.translate(-40, 0);
			blade(1)(context);
			blade(-1)(context);
			part(context, S.ellipse(0, 0, 12, 12, 16), C.ink, { seed: 79, line: 0 });
		});
	};

	/* ---------- vivid world ---------- */
	art.cloud = (width = 300, key = 'a') =>
		P.sprite(
			`cloud-${width}-${key}`,
			width,
			width * 0.62,
			(context) => {
				const next = P.random(width + key.length * 3);
				const unit = width / 300;
				const puffs = [
					[-95, 20, 52],
					[-40, -18, 72],
					[38, -30, 84],
					[100, 8, 58],
					[0, 30, 60],
				].map(([x, y, radius]) => [
					x * unit,
					(y + 6) * unit,
					radius * unit * (0.9 + next() * 0.2),
				]);
				const points = [];
				for (let index = 0; index < 120; index++) {
					const angle = (index / 120) * Math.PI * 2;
					const directionX = Math.cos(angle);
					const directionY = Math.sin(angle);
					let farthest = 0;
					for (const [x, y, radius] of puffs) {
						const along = directionX * x + directionY * y;
						const discriminant = along * along - (x * x + y * y) + radius * radius;
						if (discriminant >= 0) {
							farthest = Math.max(farthest, along + Math.sqrt(discriminant));
						}
					}
					points.push([
						directionX * farthest,
						Math.min(directionY * farthest, 62 * unit),
					]);
				}
				const outline = part(context, points, C.white, {
					seed: width,
					line: 2.4,
					lineColor: C.bright,
					lineAlpha: 0.9,
					shade: 0,
				});
				P.hatch(context, outline, {
					region: S.rect(-width, width * 0.02, width * 2, width),
					color: C.bright,
					alpha: 0.35,
					spacing: 10,
					seed: width + 1,
				});
			},
			{ border: 0 },
		);

	art.sun = () =>
		P.sprite('sun', 300, 300, (context) => {
			for (let index = 0; index < 12; index++) {
				const angle = (index / 12) * Math.PI * 2;
				const ray = [
					[Math.cos(angle - 0.12) * 95, Math.sin(angle - 0.12) * 95],
					[Math.cos(angle) * 142, Math.sin(angle) * 142],
					[Math.cos(angle + 0.12) * 95, Math.sin(angle + 0.12) * 95],
				];
				part(context, ray, index % 2 ? C.sun : C.sunPale, {
					seed: 80 + index,
					line: 2.2,
					cut: false,
				});
			}
			const face = part(context, S.ellipse(0, 0, 100, 100, 56), C.sun, { seed: 93 });
			P.crayon(context, S.ellipse(-50, 26, 22, 14, 16), C.coral, 0.5);
			P.crayon(context, S.ellipse(50, 26, 22, 14, 16), C.coral, 0.5);
			for (const side of [-1, 1]) {
				line(
					context,
					[
						[side * 50 - 16, -6],
						[side * 50, -20],
						[side * 50 + 16, -6],
					],
					{ seed: 94 + side, width: 4.5 },
				);
			}
			line(
				context,
				S.bezier(
					[
						[-26, 22],
						[-14, 44],
						[14, 44],
						[26, 22],
					],
					12,
				),
				{ seed: 96, width: 4.5 },
			);
			P.hatch(context, face, { region: S.ellipse(40, 40, 90, 90), alpha: 0.1, seed: 97 });
		});

	art.house = (color = C.coral, roof = C.deep, key = 'a', width = 170, height = 150) =>
		P.sprite(`house-${color}-${roof}-${key}-${width}`, width + 40, height + 110, (context) => {
			const top = -height / 2 + 10;
			const wall = part(context, S.rect(-width / 2, top, width, height), color, {
				seed: width + 1,
			});
			P.hatch(context, wall, {
				region: S.rect(width * 0.2, top, width, height),
				alpha: 0.12,
				seed: width + 2,
			});
			part(
				context,
				[
					[-width / 2 - 18, top + 4],
					[0, top - 90],
					[width / 2 + 18, top + 4],
				],
				roof,
				{ seed: width + 3 },
			);
			const windowSize = width * 0.22;
			for (const side of [-1, 1]) {
				const windowShape = S.rect(
					side * width * 0.22 - windowSize / 2,
					top + 26,
					windowSize,
					windowSize,
				);
				part(context, windowShape, C.sunPale, { seed: width + side + 5, line: 2.4 });
				line(
					context,
					[
						[side * width * 0.22, top + 26],
						[side * width * 0.22, top + 26 + windowSize],
					],
					{ seed: width + side + 7, width: 2 },
				);
			}
			part(
				context,
				S.roundRect(
					-width * 0.1,
					top + height - height * 0.36,
					width * 0.2,
					height * 0.36,
					8,
				),
				C.ink,
				{ seed: width + 9, line: 0 },
			);
		});

	/* Torn landscape strip (hills). Drawn full width, no sticker border. */
	art.hills = (color, key, amplitude = 60, width = 2200, height = 360) =>
		P.sprite(
			`hills-${color}-${key}`,
			width,
			height,
			(context) => {
				const next = P.random(key.length * 13 + amplitude);
				const points = [];
				const phase = next() * 6;
				for (let x = -width / 2; x <= width / 2; x += 40) {
					points.push([
						x,
						-height / 2 +
							amplitude +
							Math.sin(x / 260 + phase) * amplitude * 0.6 +
							Math.sin(x / 110 + phase * 2) * amplitude * 0.25,
					]);
				}
				points.push([width / 2, height / 2], [-width / 2, height / 2]);
				const outline = P.torn(points, key.length * 7, { spacing: 6, amplitude: 3.5 });
				P.tracePath(context, outline);
				context.fillStyle = P.paperFill(context, color);
				context.fill();
				context.save();
				context.clip();
				context.strokeStyle = 'rgba(255,255,255,0.55)';
				context.lineWidth = 5;
				P.tracePath(context, outline.slice(0, Math.floor(outline.length * 0.45)), false);
				context.stroke();
				context.restore();
			},
			{ border: 0, variants: 1 },
		);

	/* ---------- logo ---------- */
	const giftIconPaths = [
		'M12 7v14',
		'M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8',
		'M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5',
		'M4 7h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
	];
	art.logoMark = () =>
		P.sprite('logo-mark', 300, 300, (context) => {
			const square = S.roundRect(-140, -140, 280, 280, 84, 10);
			const outline = P.cut(square, 101, { spacing: 18, wander: 1.2 });
			P.tracePath(context, outline);
			const gradient = context.createLinearGradient(0, -140, 0, 140);
			gradient.addColorStop(0, C.sky);
			gradient.addColorStop(1, C.deep);
			context.fillStyle = gradient;
			context.fill();
			context.save();
			context.clip();
			context.globalCompositeOperation = 'multiply';
			context.fillStyle = P.paperFill(context, '#ffffff');
			context.fillRect(-150, -150, 300, 300);
			context.restore();
			P.pencil(context, outline, {
				closed: true,
				seed: 102,
				width: 9,
				alpha: 1,
				wobble: 1.2,
			});
			context.save();
			context.translate(-100, -100);
			context.scale(200 / 24, 200 / 24);
			context.strokeStyle = C.white;
			context.lineCap = 'round';
			context.lineJoin = 'round';
			context.lineWidth = 2.3;
			const jitter = (P.variant - 1) * 0.04;
			context.translate(jitter, -jitter);
			for (const path of giftIconPaths) {
				context.stroke(new Path2D(path));
			}
			context.restore();
		});

	/* Cut-out letter sticker in the heading font. */
	art.letter = (
		character,
		{ color = C.ink, size = 210, font = P.font.display, weight = 700, fade = false } = {},
	) => {
		const key = `letter-${character}-${color}-${size}-${weight}`;
		const measure = P.canvas(10, 10).getContext('2d');
		measure.font = `${weight} ${size}px ${font}`;
		const width = Math.max(size * 0.3, measure.measureText(character).width);
		return P.sprite(
			key,
			width + 10,
			size * 1.25,
			(context) => {
				context.font = `${weight} ${size}px ${font}`;
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				const wobbleX = (P.variant - 1) * 0.6;
				context.fillStyle = P.paperFill(context, color);
				context.globalAlpha = fade ? 0.5 : 1;
				context.fillText(character, wobbleX, size * 0.06);
				context.globalCompositeOperation = 'source-atop';
				context.fillStyle = 'rgba(255,255,255,0.14)';
				context.fillRect(-width, -size, width * 2, size * 0.7);
			},
			{ border: size * 0.07 },
		);
	};

	/* ---------- wishlist items ---------- */
	art.headphones = () =>
		P.sprite('headphones', 300, 280, (context) => {
			const band = part(
				context,
				S.arcBand(0, 10, 128, 100, Math.PI * 1.02, Math.PI * 1.98, 40),
				C.ink,
				{ seed: 111, line: 2 },
			);
			part(
				context,
				S.arcBand(0, 10, 116, 106, Math.PI * 1.12, Math.PI * 1.88, 30),
				C.bright,
				{ seed: 112, line: 0, shade: 0 },
			);
			P.hatch(context, band, { alpha: 0.1 });
			for (const side of [-1, 1]) {
				part(context, S.roundRect(side * 118 - 26, -10, 52, 130, 24), C.sky, {
					seed: 113 + side,
				});
				part(context, S.roundRect(side * 96 - 18, 2, 36, 108, 16), C.coral, {
					seed: 115 + side,
					line: 2.4,
				});
				line(
					context,
					[
						[side * 118 - 6, 10],
						[side * 118 - 6, 100],
					],
					{ seed: 117 + side, width: 2, color: C.white, alpha: 0.7 },
				);
			}
		});

	art.book = (title = 'Hvězdy') =>
		P.sprite(`book-${title}`, 240, 290, (context) => {
			part(context, S.rect(-88, -118, 190, 240), C.white, { seed: 121, line: 2.4 });
			const cover = part(context, S.roundRect(-100, -128, 188, 244, 10), C.mint, {
				seed: 122,
			});
			part(context, S.rect(-100, -128, 30, 244), '#0f8a5b', { seed: 123, line: 2 });
			part(context, S.rect(-50, -80, 110, 60), C.sunPale, { seed: 124, line: 2.2 });
			text(context, title, 5, -50, { size: 34, font: P.font.hand });
			part(context, S.star(5, 40, 34, 14), C.sun, { seed: 125, line: 2.4 });
			P.hatch(context, cover, { region: S.rect(40, -130, 60, 250), alpha: 0.14 });
		});

	art.plant = () =>
		P.sprite('plant', 240, 300, (context) => {
			const leaves = [
				[-0.9, 120],
				[-0.35, 150],
				[0.1, 140],
				[0.55, 130],
				[1.0, 110],
			];
			leaves.forEach(([angle, length], index) => {
				context.save();
				context.translate(0, 20);
				context.rotate(angle);
				const leaf = S.bezier([
					[0, 0],
					[-34, -length * 0.35],
					[-18, -length * 0.85],
					[0, -length],
					[18, -length * 0.85],
					[34, -length * 0.35],
					[0, 0],
				]);
				part(context, leaf, index % 2 ? C.leaf : C.mint, { seed: 131 + index, line: 2.4 });
				line(
					context,
					[
						[0, -6],
						[0, -length * 0.85],
					],
					{ seed: 136 + index, width: 1.8, alpha: 0.55 },
				);
				context.restore();
			});
			const pot = part(
				context,
				[
					[-80, 20],
					[80, 20],
					[60, 140],
					[-60, 140],
				],
				C.coralPale,
				{ seed: 141 },
			);
			part(context, S.rect(-90, 10, 180, 36), C.coral, { seed: 142, line: 2.6 });
			P.hatch(context, pot, { region: S.rect(20, 0, 80, 150), alpha: 0.14 });
		});

	art.teapot = () =>
		P.sprite('teapot', 330, 260, (context) => {
			part(
				context,
				S.arcBand(95, 10, 70, 44, -Math.PI / 2.2, Math.PI / 2.4, 24),
				C.sakuraPale,
				{ seed: 151 },
			);
			part(
				context,
				[
					[-80, 30],
					[-160, -40],
					[-148, -52],
					[-70, -10],
				],
				C.sakuraPale,
				{ seed: 152 },
			);
			const body = part(context, S.ellipse(0, 20, 110, 90, 48), C.sakuraPale, { seed: 153 });
			P.dots(context, body, { color: C.sakura, radius: 6, spacing: 34, alpha: 0.75 });
			P.hatch(context, body, { region: S.ellipse(60, 60, 110, 100), alpha: 0.14 });
			part(context, S.ellipse(0, -66, 60, 16, 28), C.sakura, { seed: 154, line: 2.4 });
			part(context, S.ellipse(0, -88, 16, 14, 16), C.sakura, { seed: 155, line: 2.4 });
		});

	art.teddy = () =>
		P.sprite('teddy', 280, 320, (context) => {
			const brown = '#c98f5a';
			for (const side of [-1, 1]) {
				part(context, S.ellipse(side * 60, 110, 44, 36, 28), brown, { seed: 161 + side });
				part(context, S.ellipse(side * 92, 30, 30, 50, 28, side * 0.5), brown, {
					seed: 163 + side,
				});
				part(context, S.ellipse(side * 66, -118, 34, 34, 24), brown, { seed: 165 + side });
				part(context, S.ellipse(side * 66, -118, 17, 17, 16), C.sunPale, {
					seed: 167 + side,
					line: 2,
				});
			}
			const belly = part(context, S.ellipse(0, 50, 86, 92, 40), brown, { seed: 169 });
			part(context, S.ellipse(0, 60, 50, 56, 32), C.sunPale, { seed: 170, line: 2.2 });
			P.hatch(context, belly, { region: S.ellipse(50, 90, 80, 90), alpha: 0.14 });
			const head = part(context, S.ellipse(0, -70, 84, 74, 40), brown, { seed: 171 });
			P.hatch(context, head, { region: S.ellipse(60, -30, 70, 60), alpha: 0.12 });
			part(context, S.ellipse(0, -48, 34, 26, 24), C.sunPale, { seed: 172, line: 2.2 });
			part(context, S.ellipse(0, -58, 12, 9, 12), C.ink, { seed: 173, line: 0 });
			line(
				context,
				S.bezier(
					[
						[-12, -40],
						[-6, -32],
						[6, -32],
						[12, -40],
					],
					8,
				),
				{ seed: 174, width: 3 },
			);
			for (const side of [-1, 1]) {
				part(context, S.ellipse(side * 32, -86, 8, 10, 12), C.ink, {
					seed: 175 + side,
					line: 0,
				});
			}
			P.crayon(context, S.ellipse(-50, -60, 16, 10, 12), C.coral, 0.45);
			P.crayon(context, S.ellipse(50, -60, 16, 10, 12), C.coral, 0.45);
			part(
				context,
				[
					[-10, 2],
					[-46, -18],
					[-46, 22],
				],
				C.sky,
				{ seed: 177, line: 2.2 },
			);
			part(
				context,
				[
					[10, 2],
					[46, -18],
					[46, 22],
				],
				C.sky,
				{ seed: 178, line: 2.2 },
			);
			part(context, S.ellipse(0, 2, 12, 12, 12), C.deep, { seed: 179, line: 2 });
		});

	art.kite = () =>
		P.sprite('kite', 260, 380, (context) => {
			const tail = S.bezier(
				[
					[0, 110],
					[40, 160],
					[-40, 210],
					[10, 260],
				],
				20,
			);
			line(context, tail, { seed: 181, width: 2.6 });
			[0.3, 0.6, 0.9].forEach((amount, index) => {
				const [x, y] = tail[Math.floor(amount * (tail.length - 1))];
				part(
					context,
					[
						[x, y],
						[x - 22, y - 14],
						[x - 22, y + 14],
					],
					index % 2 ? C.sun : C.coral,
					{ seed: 182 + index, line: 2, cut: false },
				);
				part(
					context,
					[
						[x, y],
						[x + 22, y - 14],
						[x + 22, y + 14],
					],
					index % 2 ? C.sun : C.coral,
					{ seed: 185 + index, line: 2, cut: false },
				);
			});
			const quadrants = [
				[
					[0, -170],
					[0, -20],
					[-100, -40],
				],
				[
					[0, -170],
					[100, -40],
					[0, -20],
				],
				[
					[-100, -40],
					[0, -20],
					[0, 110],
				],
				[
					[100, -40],
					[0, 110],
					[0, -20],
				],
			];
			const colors = [C.sun, C.sky, C.sky, C.sun];
			quadrants.forEach((points, index) =>
				part(context, points, colors[index], { seed: 188 + index, line: 2.6, cut: false }),
			);
		});

	/* ---------- paper UI ---------- */
	art.tape = (width = 150, color = 'rgba(255,233,168,0.82)', key = 'a') =>
		P.sprite(
			`tape-${width}-${key}`,
			width,
			48,
			(context) => {
				const points = P.torn(S.rect(-width / 2, -20, width, 40), width + key.length, {
					spacing: 4,
					amplitude: 2.5,
				});
				P.tracePath(context, points);
				context.fillStyle = color;
				context.fill();
				context.save();
				context.clip();
				context.globalAlpha = 0.25;
				for (let x = -width / 2; x < width / 2; x += 18) {
					context.fillStyle = C.white;
					context.fillRect(x, -24, 7, 48);
				}
				context.restore();
			},
			{ border: 0, variants: 1 },
		);

	art.priceTag = (label = '1 290 Kč') =>
		P.sprite(`price-${label}`, 290, 120, (context) => {
			const tag = part(
				context,
				[
					[-130, -46],
					[90, -46],
					[135, 0],
					[90, 46],
					[-130, 46],
				],
				C.sun,
				{ seed: 201 },
			);
			part(context, S.ellipse(92, 0, 11, 11, 14), C.paper, { seed: 202, line: 2, shade: 0 });
			P.hatch(context, tag, { region: S.rect(-140, 20, 300, 40), alpha: 0.12 });
			text(context, label, -24, 4, { size: 58, font: P.font.hand });
		});

	art.linkChip = (label = 'odkaz') =>
		P.sprite(`link-chip-${label}`, 270, 100, (context) => {
			part(context, S.roundRect(-128, -40, 256, 80, 40), C.skyPale, { seed: 211 });
			context.save();
			context.translate(-78, 0);
			context.rotate(-0.78);
			for (const offset of [-15, 15]) {
				const ring = S.roundRect(offset - 22, -12, 44, 24, 12);
				P.pencil(context, ring, {
					closed: true,
					seed: 212 + offset,
					width: 5.5,
					color: C.deep,
					alpha: 1,
					gaps: false,
				});
			}
			context.restore();
			text(context, label, 26, 2, {
				size: Math.min(50, 400 / label.length),
				font: P.font.hand,
				color: C.deep,
			});
		});

	art.stickyNote = (label = '?', color = C.sunPale, key = 'a') =>
		P.sprite(
			`sticky-${label}-${color}-${key}`,
			190,
			190,
			(context) => {
				const note = S.transform(
					[
						[-86, -86],
						[86, -86],
						[88, 70],
						[70, 88],
						[-86, 86],
					],
					{},
				);
				part(context, note, color, { seed: 221 + key.length, line: 1.8, lineAlpha: 0.5 });
				part(
					context,
					[
						[88, 70],
						[70, 70],
						[70, 88],
					],
					C.creamDark,
					{ seed: 222, line: 1.6, cut: false },
				);
				text(context, label, 0, 4, {
					size: 130,
					font: P.font.display,
					color: C.deep,
					weight: 700,
				});
			},
			{ border: 0 },
		);

	art.paperPlane = () =>
		P.sprite('paper-plane', 300, 170, (context) => {
			part(
				context,
				[
					[140, -10],
					[-130, -70],
					[-40, 10],
				],
				C.white,
				{ seed: 231, line: 2.6, cut: false, shade: 0 },
			);
			part(
				context,
				[
					[140, -10],
					[-40, 10],
					[-70, 70],
				],
				'#e4eef6',
				{ seed: 232, line: 2.6, cut: false, shade: 0 },
			);
			part(
				context,
				[
					[140, -10],
					[-40, 10],
					[-60, 30],
				],
				'#c9dbe8',
				{ seed: 233, line: 2.2, cut: false, shade: 0 },
			);
		});

	/* A phone showing the shared wishlist. */
	art.phone = (accent = C.sky, key = 'a', title = 'Janina přání') =>
		P.sprite(`phone-${accent}-${key}-${title}`, 190, 360, (context) => {
			part(context, S.roundRect(-88, -170, 176, 340, 30), C.ink, {
				seed: 241,
				line: 2,
				shade: 0,
			});
			part(context, S.roundRect(-74, -150, 148, 300, 16), C.white, {
				seed: 242,
				line: 0,
				shade: 0,
				cut: false,
			});
			part(context, S.roundRect(-74, -150, 148, 54, 16), accent, {
				seed: 243,
				line: 0,
				shade: 0,
				cut: false,
			});
			text(context, title, 0, -122, { size: 26, font: P.font.hand, color: C.white });
			const itemColors = [C.sky, C.mint, C.leaf, C.sakura];
			itemColors.forEach((color, index) => {
				const y = -74 + index * 52;
				part(context, S.roundRect(-62, y, 36, 36, 8), color, {
					seed: 244 + index,
					line: 1.4,
					shade: 0,
				});
				line(
					context,
					[
						[-16, y + 12],
						[52, y + 12],
					],
					{ seed: 250 + index, width: 5, color: C.creamDark, alpha: 1 },
				);
				line(
					context,
					[
						[-16, y + 26],
						[22, y + 26],
					],
					{ seed: 255 + index, width: 4, color: C.skyPale, alpha: 1 },
				);
			});
			part(context, S.roundRect(-24, -164, 48, 10, 5), '#2d4a6b', {
				seed: 260,
				line: 0,
				shade: 0,
				cut: false,
			});
		});

	art.registrationCard = (title = 'Registrace', fields = ['E-mail', 'Heslo']) =>
		P.sprite(`registration-card-${title}`, 440, 330, (context) => {
			part(context, S.roundRect(-205, -150, 410, 300, 26), C.white, { seed: 271, shade: 0 });
			text(context, title, 0, -104, { size: 46, font: P.font.display, weight: 600 });
			fields.forEach((label, index) => {
				const y = index === 0 ? -40 : 56;
				text(context, label, -168, y - 32, {
					size: 26,
					font: P.font.body,
					weight: 500,
					align: 'left',
					color: C.inkSoft,
				});
				part(context, S.roundRect(-170, y - 14, 340, 50, 12), C.cream, {
					seed: 272 + y,
					line: 2,
					shade: 0,
				});
				if (index === 1) {
					text(context, '• • • • • •', -150, y + 12, {
						size: 26,
						align: 'left',
						font: P.font.body,
						color: C.grey,
					});
				}
			});
		});

	art.badge = (lines = ['bez', 'registrace'], color = C.mint) =>
		P.sprite(`badge-${lines.join('-')}`, 300, 300, (context) => {
			const points = [];
			for (let index = 0; index < 72; index++) {
				const angle = (index / 72) * Math.PI * 2;
				const radius = 130 + (index % 2 === 0 ? 10 : -4);
				points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
			}
			part(context, points, color, { seed: 281, cut: false });
			P.pencil(context, S.ellipse(0, 0, 104, 104, 48), {
				closed: true,
				seed: 282,
				width: 2.4,
				color: C.white,
				alpha: 0.9,
			});
			text(context, lines[0], 0, -34, {
				size: 60,
				font: P.font.display,
				color: C.white,
				weight: 700,
			});
			text(context, lines[1], 0, 30, {
				size: 38,
				font: P.font.display,
				color: C.white,
				weight: 600,
			});
			line(
				context,
				[
					[-26, 76],
					[-8, 92],
					[28, 60],
				],
				{ seed: 283, width: 7, color: C.white, alpha: 1 },
			);
		});

	art.stampTool = () =>
		P.sprite('stamp-tool', 200, 300, (context) => {
			part(context, S.ellipse(0, -110, 52, 40, 28), C.kraft, { seed: 291 });
			part(context, S.rect(-20, -84, 40, 110), C.kraftDark, { seed: 292, line: 2.4 });
			const base = part(context, S.roundRect(-90, 20, 180, 56, 10), C.kraft, { seed: 293 });
			P.hatch(context, base, { alpha: 0.14 });
			part(context, S.rect(-84, 76, 168, 26), C.mint, { seed: 294, line: 2.2 });
		});

	/* Inked rubber-stamp impression; transparent where ink skipped. */
	art.stampMark = (label = 'REZERVOVÁNO', color = C.mint) =>
		P.sprite(
			`stamp-mark-${label}`,
			420,
			130,
			(context) => {
				const layer = P.canvas(480, 170);
				const layerContext = layer.getContext('2d');
				layerContext.translate(240, 85);
				layerContext.strokeStyle = color;
				layerContext.lineWidth = 8;
				const frame = S.roundRect(-214, -54, 428, 108, 20);
				P.tracePath(layerContext, P.cut(frame, 301, { spacing: 12, wander: 1.5 }));
				layerContext.stroke();
				layerContext.lineWidth = 3;
				P.tracePath(
					layerContext,
					P.cut(S.roundRect(-200, -42, 400, 84, 14), 302, { spacing: 12, wander: 1.2 }),
				);
				layerContext.stroke();
				layerContext.font = `700 50px ${P.font.display}`;
				layerContext.textAlign = 'center';
				layerContext.textBaseline = 'middle';
				layerContext.fillStyle = color;
				layerContext.fillText(label, 0, 4);
				layerContext.globalCompositeOperation = 'destination-out';
				const next = P.random(303);
				for (let index = 0; index < 900; index++) {
					layerContext.globalAlpha = 0.2 + next() * 0.6;
					layerContext.fillRect(
						-240 + next() * 480,
						-85 + next() * 170,
						1 + next() * 3,
						1 + next() * 2,
					);
				}
				context.drawImage(layer, -240, -85);
			},
			{ border: 0, variants: 1 },
		);

	art.card = (itemKey, label, price) =>
		P.sprite(`card-${itemKey}-${label}`, 330, 400, (context) => {
			part(context, S.roundRect(-150, -185, 300, 370, 22), C.white, {
				seed: 311 + label.length,
				shade: 0,
			});
			part(context, S.roundRect(-128, -163, 256, 220, 14), C.skyPale, {
				seed: 312,
				line: 2,
				shade: 0,
			});
			text(context, label, -120, 94, { size: 44, font: P.font.hand, align: 'left' });
			text(context, price, -120, 142, {
				size: 30,
				font: P.font.body,
				weight: 600,
				align: 'left',
				color: C.deep,
			});
		});

	art.speechBubble = (
		label = 'psst!',
		width = 280,
		key = 'a',
		{ color = C.white, size = 70, textColor = C.ink, tail = -1 } = {},
	) =>
		P.sprite(`bubble-${label}-${key}-${color}`, width, 190, (context) => {
			const points = S.ellipse(0, -14, width * 0.46, 66, 48);
			const tailIndex = Math.floor(points.length * (tail < 0 ? 0.3 : 0.2));
			points.splice(tailIndex, 0, [tail * width * 0.2, 88]);
			part(context, points, color, { seed: 321, shade: 0 });
			text(context, label, 0, -14, { size, font: P.font.hand, color: textColor });
		});

	art.balloon = (color = C.sky) =>
		P.sprite(`balloon-${color}`, 180, 420, (context) => {
			line(
				context,
				S.bezier(
					[
						[0, 60],
						[30, 150],
						[-30, 230],
						[8, 330],
					],
					24,
				),
				{ seed: 331, width: 2.2, alpha: 0.7 },
			);
			const balloon = part(
				context,
				S.bezier(
					[
						[0, 70],
						[-100, 40],
						[-100, -150],
						[0, -150],
						[100, -150],
						[100, 40],
						[0, 70],
					],
					20,
				),
				color,
				{ seed: 332 },
			);
			part(
				context,
				[
					[0, 66],
					[-14, 86],
					[14, 86],
				],
				color,
				{ seed: 333, line: 2.2, cut: false },
			);
			P.crayon(context, S.ellipse(-40, -80, 18, 34, 16, 0.4), C.white, 0.6);
			P.hatch(context, balloon, { region: S.ellipse(60, 20, 70, 110), alpha: 0.14 });
		});

	art.heart = (color = C.sakura, size = 60) =>
		P.sprite(`heart-${color}-${size}`, size * 2.2, size * 2.2, (context) => {
			const heart = part(context, S.heart(0, 0, size), color, { seed: 341 + size, line: 3 });
			P.crayon(
				context,
				S.ellipse(-size * 0.45, -size * 0.35, size * 0.18, size * 0.28, 12, 0.6),
				C.white,
				0.55,
			);
			P.hatch(context, heart, {
				region: S.ellipse(size * 0.5, size * 0.4, size, size),
				alpha: 0.12,
			});
		});

	art.sparkle = (color = C.sun, size = 50) =>
		P.sprite(
			`sparkle-${color}-${size}`,
			size * 2.2,
			size * 2.2,
			(context) => {
				part(context, sparkleShape(0, 0, size), color, {
					seed: 351 + size,
					line: 2.6,
					cut: false,
				});
			},
			{ border: size * 0.12 },
		);

	art.bunting = (width = 1700) =>
		P.sprite(
			`bunting-${width}`,
			width,
			230,
			(context) => {
				const string = S.bezier(
					[
						[-width / 2, -90],
						[-width / 4, 10],
						[width / 4, 10],
						[width / 2, -90],
					],
					60,
				);
				const colors = [C.coral, C.sun, C.sky, C.mint, C.sakura];
				const count = 15;
				for (let index = 0; index < count; index++) {
					const amount = (index + 0.5) / count;
					const [x, y] = string[Math.floor(amount * (string.length - 1))];
					part(
						context,
						[
							[x - 42, y],
							[x + 42, y],
							[x + (P.hash(index) - 0.5) * 10, y + 96],
						],
						colors[index % colors.length],
						{ seed: 361 + index, line: 2.4, cut: false },
					);
				}
				line(context, string, { seed: 380, width: 3 });
			},
			{ border: 0 },
		);

	art.banner = (label = 'Všechno nejlepší!') =>
		P.sprite(`banner-${label}`, 760, 150, (context) => {
			part(
				context,
				[
					[-360, -52],
					[360, -52],
					[330, 0],
					[360, 52],
					[-360, 52],
					[-330, 0],
				],
				C.white,
				{ seed: 391, shade: 0 },
			);
			text(context, label, 0, 4, { size: 82, font: P.font.hand, color: C.ink });
		});

	art.notebook = () =>
		P.sprite(
			'notebook',
			820,
			920,
			(context) => {
				part(context, S.roundRect(-392, -438, 800, 890, 18), C.creamDark, {
					seed: 401,
					line: 2,
					shade: 0,
				});
				const page = part(context, S.roundRect(-400, -450, 800, 890, 18), C.paper, {
					seed: 402,
					shade: 0,
				});
				context.save();
				P.tracePath(context, page);
				context.clip();
				context.strokeStyle = 'rgba(85,185,243,0.45)';
				context.lineWidth = 2;
				for (let y = -300; y < 440; y += 58) {
					context.beginPath();
					context.moveTo(-400, y);
					context.lineTo(400, y);
					context.stroke();
				}
				context.strokeStyle = 'rgba(236,95,163,0.45)';
				context.beginPath();
				context.moveTo(-290, -450);
				context.lineTo(-290, 450);
				context.stroke();
				context.restore();
				for (let y = -400; y < 420; y += 70) {
					part(context, S.ellipse(-352, y, 13, 13, 14), C.creamDark, {
						seed: 410 + y,
						line: 1.6,
						shade: 0,
					});
					P.pencil(
						context,
						S.bezier(
							[
								[-352, y],
								[-392, y - 30],
								[-430, y - 8],
								[-410, y + 16],
							],
							10,
						),
						{
							seed: 420 + y,
							width: 7,
							color: C.grey,
							alpha: 1,
							gaps: false,
							passes: 1,
						},
					);
				}
			},
			{ border: 0 },
		);

	/* ---------- occasions ---------- */
	const drips = (left, right, top, depth, waves) => {
		const points = [
			[left, top - 10],
			[right, top - 10],
		];
		for (let index = 0; index <= 60; index++) {
			const amount = index / 60;
			const wave = Math.max(0, Math.sin(amount * Math.PI * waves * 2 + 0.6));
			points.push([P.lerp(right, left, amount), top + 6 + wave ** 2.5 * depth]);
		}
		return points;
	};

	art.cake = () =>
		P.sprite('cake', 340, 390, (context) => {
			part(context, S.ellipse(0, 158, 164, 26, 40), C.white, {
				seed: 1501,
				shade: 0,
				line: 2.4,
			});
			const bottom = part(context, S.roundRect(-134, 40, 268, 116, 16), C.sakuraPale, {
				seed: 1502,
			});
			P.hatch(context, bottom, { region: S.rect(60, 30, 90, 140), alpha: 0.14, seed: 1503 });
			part(context, drips(-138, 138, 40, 34, 5), C.white, {
				seed: 1504,
				line: 2.4,
				shade: 0,
			});
			const next = P.random(1505);
			for (let index = 0; index < 16; index++) {
				context.save();
				context.translate(-118 + next() * 236, 100 + next() * 46);
				context.rotate(next() * Math.PI);
				context.fillStyle = art.confettiColors[index % art.confettiColors.length];
				context.fillRect(-7, -2.5, 14, 5);
				context.restore();
			}
			const top = part(context, S.roundRect(-94, -36, 188, 80, 14), C.sunPale, {
				seed: 1506,
			});
			P.hatch(context, top, { region: S.rect(40, -40, 70, 90), alpha: 0.14, seed: 1507 });
			part(context, drips(-98, 98, -36, 26, 4), C.white, { seed: 1508, line: 2.4, shade: 0 });
			[-54, 0, 54].forEach((x, index) => {
				part(
					context,
					S.roundRect(x - 10, -116, 20, 82, 7),
					[C.sky, C.coral, C.mint][index],
					{
						seed: 1510 + index,
						line: 2.2,
					},
				);
				for (const y of [-100, -76, -52]) {
					line(
						context,
						[
							[x - 9, y + 5],
							[x + 9, y - 5],
						],
						{ seed: 1513 + index + y, width: 3, color: C.white, alpha: 0.85 },
					);
				}
				line(
					context,
					[
						[x, -116],
						[x + 1, -128],
					],
					{ seed: 1516 + index, width: 2.4 },
				);
				part(
					context,
					S.bezier(
						[
							[x, -178],
							[x + 22, -150],
							[x + 18, -126],
							[x, -126],
							[x - 18, -126],
							[x - 22, -150],
							[x, -178],
						],
						12,
					),
					C.sun,
					{ seed: 1519 + index, line: 2.2 },
				);
				P.tracePath(context, S.ellipse(x, -140, 6, 10, 12));
				context.fillStyle = C.coral;
				context.fill();
			});
		});

	art.christmasTree = () =>
		P.sprite('christmas-tree', 320, 420, (context) => {
			part(context, S.rect(-22, 140, 44, 50), C.kraftDark, { seed: 1531, line: 2.4 });
			const tier = (top, bottom, halfWidth, color, seed) => {
				const outline = part(
					context,
					[
						[0, top],
						[halfWidth, bottom],
						[halfWidth * 0.5, bottom + 14],
						[0, bottom + 4],
						[-halfWidth * 0.5, bottom + 14],
						[-halfWidth, bottom],
					],
					color,
					{ seed },
				);
				P.hatch(context, outline, {
					region: S.rect(16, top, halfWidth, bottom - top + 20),
					alpha: 0.14,
					seed: seed + 1,
				});
			};
			tier(0, 146, 146, C.leaf, 1532);
			tier(-72, 68, 118, '#4fb06b', 1534);
			tier(-140, -8, 88, C.leaf, 1536);
			for (const [points, seed] of [
				[
					[
						[-62, -40],
						[-20, -20],
						[30, -26],
						[70, -48],
					],
					1538,
				],
				[
					[
						[-96, 44],
						[-40, 70],
						[40, 64],
						[100, 36],
					],
					1539,
				],
			]) {
				line(context, S.bezier(points, 16), { seed, width: 5, color: C.sun, alpha: 1 });
			}
			const baubles = [
				[-54, 10, C.coral],
				[44, -2, C.sky],
				[-18, 100, C.sun],
				[78, 112, C.sakura],
				[-100, 120, C.sky],
				[12, -86, C.coral],
				[30, 56, C.sakura],
				[-60, 72, C.bright],
			];
			baubles.forEach(([x, y, color], index) => {
				part(context, S.ellipse(x, y, 13, 13, 16), color, { seed: 1541 + index, line: 2 });
				P.crayon(context, S.ellipse(x - 4, y - 4, 4, 4, 8), C.white, 0.8);
			});
			part(context, S.star(0, -160, 38, 16), C.sun, { seed: 1550 });
		});

	art.weddingRings = () =>
		P.sprite('wedding-rings', 340, 300, (context) => {
			const ring = (cx, cy, seed) => {
				const layer = P.canvas(360, 320);
				const layerContext = layer.getContext('2d');
				layerContext.translate(180, 160);
				const outline = part(layerContext, S.ellipse(cx, cy, 80, 80, 48), C.sun, { seed });
				P.hatch(layerContext, outline, {
					region: S.ellipse(cx + 40, cy + 40, 60, 60),
					alpha: 0.16,
					seed: seed + 1,
				});
				layerContext.globalCompositeOperation = 'destination-out';
				P.tracePath(layerContext, S.ellipse(cx, cy, 60, 60, 40));
				layerContext.fill();
				layerContext.globalCompositeOperation = 'source-over';
				P.pencil(layerContext, S.ellipse(cx, cy, 60, 60, 40), {
					closed: true,
					seed: seed + 2,
					width: 2.6,
					color: C.ink,
					alpha: 0.85,
				});
				P.crayon(
					layerContext,
					S.arcBand(cx, cy, 75, 66, Math.PI * 1.1, Math.PI * 1.45, 12),
					C.white,
					0.75,
				);
				return layer;
			};
			const left = ring(-44, 16, 1551);
			const right = ring(44, -6, 1555);
			context.drawImage(right, -180, -160);
			context.drawImage(left, -180, -160);
			context.save();
			P.tracePath(context, S.ellipse(-13, -47, 26, 26, 20));
			context.clip();
			context.drawImage(right, -180, -160);
			context.restore();
			part(
				context,
				[
					[-44, -118],
					[-18, -92],
					[-44, -62],
					[-70, -92],
				],
				C.skyPale,
				{ seed: 1559, line: 2.4 },
			);
			line(
				context,
				[
					[-70, -92],
					[-18, -92],
				],
				{ seed: 1560, width: 2, alpha: 0.6 },
			);
		});

	art.daisy = () =>
		P.sprite('daisy', 260, 400, (context) => {
			const stem = S.bezier(
				[
					[0, -40],
					[-12, 60],
					[18, 120],
					[4, 190],
				],
				20,
			);
			part(context, S.ribbon(stem, 7), C.leaf, { seed: 1561, line: 2.2 });
			for (const side of [-1, 1]) {
				part(
					context,
					S.ellipse(side * 36, 116 - side * 22, 38, 14, 20, side * -0.6),
					'#4fb06b',
					{ seed: 1562 + side, line: 2.2 },
				);
			}
			for (let index = 0; index < 12; index++) {
				const angle = (index / 12) * Math.PI * 2;
				part(
					context,
					S.ellipse(Math.cos(angle) * 56, -64 + Math.sin(angle) * 56, 38, 16, 20, angle),
					C.white,
					{ seed: 1565 + index, line: 2.2, shade: 0 },
				);
			}
			const center = part(context, S.ellipse(0, -64, 32, 32, 28), C.sun, { seed: 1580 });
			P.dots(context, center, { color: '#e0a000', radius: 3, spacing: 12, alpha: 0.8 });
			P.hatch(context, center, { region: S.ellipse(16, -48, 28, 28), alpha: 0.16 });
		});

	/* ---------- list editor ---------- */
	art.paintChip = (color) =>
		P.sprite(`paint-chip-${color}`, 120, 250, (context) => {
			part(context, S.roundRect(-52, -115, 104, 230, 10), C.white, { seed: 1591, shade: 0 });
			part(context, S.roundRect(-40, -103, 80, 150, 6), color, { seed: 1592, line: 2 });
			for (const [y, width] of [
				[72, 64],
				[92, 40],
			]) {
				line(
					context,
					[
						[-36, y],
						[-36 + width, y],
					],
					{ seed: 1593 + y, width: 4, color: C.creamDark, alpha: 1 },
				);
			}
		});

	art.brush = (color) =>
		P.sprite(`brush-${color}`, 420, 90, (context) => {
			const handle = part(context, S.roundRect(30, -14, 176, 28, 14), C.deep, { seed: 1595 });
			P.hatch(context, handle, { region: S.rect(20, 2, 200, 16), alpha: 0.2 });
			part(context, S.rect(-32, -19, 66, 38), C.grey, { seed: 1596, line: 2.4 });
			part(
				context,
				S.bezier(
					[
						[-32, -19],
						[-84, -24],
						[-124, -8],
						[-160, 0],
						[-124, 8],
						[-84, 24],
						[-32, 19],
					],
					12,
				),
				'#e8cc98',
				{ seed: 1597, line: 2.4 },
			);
			part(
				context,
				S.bezier(
					[
						[-96, -20],
						[-118, -14],
						[-138, -6],
						[-160, 0],
						[-138, 6],
						[-118, 14],
						[-96, 20],
					],
					10,
				),
				color,
				{ seed: 1598, line: 2.2 },
			);
		});

	art.polaroid = () =>
		P.sprite('polaroid', 290, 330, (context) => {
			part(context, S.rect(-130, -150, 260, 300), C.white, { seed: 1601, shade: 0 });
			const photo = part(context, S.rect(-110, -130, 220, 200), '#cfe8f7', {
				seed: 1602,
				line: 2,
				shade: 0,
			});
			context.save();
			P.tracePath(context, photo);
			context.clip();
			P.crayon(context, S.ellipse(70, -100, 70, 44, 20), C.white, 0.55);
			P.draw(context, art.headphones(), 0, -22, { scale: 0.62, shadowAlpha: 0.22 });
			context.restore();
		});

	art.priorityStar = (filled) =>
		P.sprite(`priority-star-${filled}`, 110, 110, (context) => {
			const star = S.star(0, 4, 48, 21);
			part(context, star, filled ? C.sun : C.cream, {
				seed: 1611,
				line: 2.8,
				lineColor: filled ? C.ink : C.grey,
				shade: filled ? 1 : 0,
			});
			if (filled) {
				P.crayon(context, S.ellipse(-12, -6, 8, 12, 10, 0.5), C.white, 0.6);
			}
		});

	art.chip = (
		label,
		{
			color = C.skyPale,
			textColor = C.deep,
			width = 240,
			height = 84,
			size = 50,
			font = P.font.hand,
		} = {},
	) =>
		P.sprite(`chip-${label}-${color}-${width}`, width, height + 16, (context) => {
			part(
				context,
				S.roundRect(-width / 2 + 6, -height / 2, width - 12, height, height / 2),
				color,
				{ seed: 1621 + label.length },
			);
			text(context, label, 0, 3, { size, font, color: textColor });
		});

	/* Quantity stepper; the number itself is drawn live so it can tick up. */
	art.counter = () =>
		P.sprite('counter', 300, 110, (context) => {
			part(context, S.roundRect(-140, -44, 280, 88, 44), C.white, { seed: 1631, shade: 0 });
			for (const side of [-1, 1]) {
				part(context, S.ellipse(side * 94, 0, 32, 32, 24), C.skyPale, {
					seed: 1632 + side,
					line: 2.4,
				});
				line(
					context,
					[
						[side * 94 - 14, 0],
						[side * 94 + 14, 0],
					],
					{ seed: 1634 + side, width: 5, color: C.deep, alpha: 1 },
				);
			}
			line(
				context,
				[
					[94, -14],
					[94, 14],
				],
				{ seed: 1636, width: 5, color: C.deep, alpha: 1 },
			);
		});

	art.heartOutline = (size = 40) =>
		P.sprite(`heart-outline-${size}`, size * 2.2, size * 2.2, (context) => {
			part(context, S.heart(0, 0, size), C.white, {
				seed: 1641 + size,
				shade: 0,
				line: 3.5,
				lineColor: C.sakura,
				lineAlpha: 1,
			});
		});

	art.emptySlot = () =>
		P.sprite(
			'empty-slot',
			330,
			400,
			(context) => {
				context.save();
				context.setLineDash([18, 14]);
				context.lineWidth = 5;
				context.strokeStyle = 'rgba(18,101,168,0.55)';
				P.tracePath(context, S.roundRect(-146, -180, 292, 360, 22));
				context.stroke();
				context.restore();
				text(context, '+', 0, -6, { size: 150, font: P.font.display, color: C.bright });
			},
			{ border: 0 },
		);

	art.pencilTool = () =>
		P.sprite('pencil-tool', 70, 420, (context) => {
			const body = part(context, S.rect(-18, -170, 36, 292), C.sun, { seed: 1651 });
			P.hatch(context, body, { region: S.rect(6, -180, 20, 310), alpha: 0.18 });
			part(context, S.rect(-19, -194, 38, 26), C.grey, { seed: 1652, line: 2.2 });
			part(context, S.roundRect(-18, -222, 36, 32, 9), C.sakura, { seed: 1653, line: 2.2 });
			part(
				context,
				[
					[-18, 122],
					[18, 122],
					[0, 184],
				],
				'#f3d3a6',
				{ seed: 1654, line: 2.2, cut: false },
			);
			part(
				context,
				[
					[-6, 164],
					[6, 164],
					[0, 186],
				],
				C.ink,
				{ seed: 1655, line: 0, cut: false },
			);
		});

	/* ---------- sharing ---------- */
	art.chatBubble = (color, key = 'a') =>
		P.sprite(`chat-bubble-${color}-${key}`, 270, 180, (context) => {
			const points = S.roundRect(-118, -70, 236, 116, 36);
			points.splice(14, 0, [-34, 46], [-86, 86], [-70, 46]);
			part(context, points, color, { seed: 1661 + key.length });
			context.save();
			context.translate(-62, -14);
			context.rotate(-0.78);
			for (const offset of [-11, 11]) {
				P.pencil(context, S.roundRect(offset - 16, -9, 32, 18, 9), {
					closed: true,
					seed: 1662 + offset,
					width: 4.5,
					color: C.deep,
					alpha: 1,
					gaps: false,
				});
			}
			context.restore();
			for (const [y, width] of [
				[-32, 110],
				[4, 80],
			]) {
				line(
					context,
					[
						[-22, y],
						[-22 + width, y],
					],
					{ seed: 1665 + y, width: 7, color: C.white, alpha: 0.95 },
				);
			}
		});

	art.envelope = (color = C.sunPale) =>
		P.sprite(`envelope-${color}`, 250, 180, (context) => {
			const body = part(context, S.rect(-110, -72, 220, 144), color, { seed: 1671 });
			P.hatch(context, body, { region: S.rect(40, -80, 90, 160), alpha: 0.12 });
			line(
				context,
				[
					[-108, 70],
					[0, 6],
					[108, 70],
				],
				{ seed: 1672, width: 2.4, alpha: 0.55 },
			);
			part(
				context,
				[
					[-110, -72],
					[110, -72],
					[0, 18],
				],
				C.white,
				{ seed: 1673, line: 2.4, cut: false, shade: 0 },
			);
			part(context, S.heart(0, 12, 20), C.sakura, { seed: 1674, line: 2.2 });
		});

	art.bell = () =>
		P.sprite('bell', 150, 170, (context) => {
			part(context, S.ellipse(0, 58, 16, 16, 16), C.kraftDark, { seed: 1681, line: 2.2 });
			const body = part(
				context,
				S.bezier(
					[
						[-58, 46],
						[-50, 30],
						[-50, -44],
						[0, -54],
						[50, -44],
						[50, 30],
						[58, 46],
					],
					14,
				),
				C.sun,
				{ seed: 1682 },
			);
			P.hatch(context, body, { region: S.rect(16, -60, 50, 110), alpha: 0.16 });
			part(context, S.roundRect(-66, 38, 132, 18, 9), '#f0b000', { seed: 1683, line: 2.2 });
			part(context, S.ellipse(0, -60, 11, 11, 12), C.sun, { seed: 1684, line: 2.2 });
			P.crayon(context, S.ellipse(-24, -16, 7, 18, 10, 0.2), C.white, 0.6);
		});

	art.notification = (label) =>
		P.sprite(`notification-${label}`, 820, 150, (context) => {
			part(context, S.roundRect(-400, -62, 800, 124, 30), C.white, { seed: 1691, shade: 0 });
			part(context, S.roundRect(-380, -44, 88, 88, 22), C.skyPale, { seed: 1692, line: 2 });
			P.draw(context, art.bell(), -336, 2, { scale: 0.5, shadowAlpha: 0 });
			text(context, 'přejeme si', -268, -22, {
				size: 26,
				font: P.font.display,
				weight: 600,
				align: 'left',
				color: C.deep,
			});
			text(context, label, -268, 18, {
				size: 31,
				font: P.font.body,
				weight: 600,
				align: 'left',
				color: C.ink,
			});
		});

	/* ---------- managing and handing over ---------- */
	art.ticket = (label, color = C.sunPale) =>
		P.sprite(`ticket-${label}-${color}`, 420, 190, (context) => {
			const outline = [
				[-190, -76],
				[190, -76],
			];
			for (let index = 0; index <= 12; index++) {
				const angle = -Math.PI / 2 - (index / 12) * Math.PI;
				outline.push([190 + Math.cos(angle) * 22, Math.sin(angle) * 22]);
			}
			outline.push([190, 76], [-190, 76]);
			for (let index = 0; index <= 12; index++) {
				const angle = Math.PI / 2 - (index / 12) * Math.PI;
				outline.push([-190 + Math.cos(angle) * 22, Math.sin(angle) * 22]);
			}
			const body = part(context, outline, color, { seed: 1701 + label.length });
			P.hatch(context, body, { region: S.rect(100, -80, 100, 160), alpha: 0.12 });
			for (let y = -66; y <= 66; y += 16) {
				P.tracePath(context, S.ellipse(-104, y, 3.2, 3.2, 8));
				context.fillStyle = 'rgba(22,56,92,0.45)';
				context.fill();
			}
			part(context, S.heart(-148, 2, 24), C.sakura, { seed: 1702, line: 2.2 });
			text(context, label, 46, 2, {
				size: 52,
				font: P.font.display,
				weight: 700,
				color: C.ink,
			});
		});

	art.rosette = (label = 'Manager', color = C.sky) =>
		P.sprite(`rosette-${label}-${color}`, 250, 350, (context) => {
			for (const side of [-1, 1]) {
				part(
					context,
					[
						[side * 12, 30],
						[side * 52, 30],
						[side * 74, 160],
						[side * 54, 140],
						[side * 30, 164],
					],
					side < 0 ? color : C.deep,
					{ seed: 1711 + side, line: 2.4 },
				);
			}
			const points = [];
			for (let index = 0; index < 96; index++) {
				const angle = (index / 96) * Math.PI * 2;
				const radius = 104 + Math.abs(Math.sin(angle * 12)) * 12;
				points.push([Math.cos(angle) * radius, -30 + Math.sin(angle) * radius]);
			}
			part(context, points, color, { seed: 1714, cut: false });
			part(context, S.ellipse(0, -30, 76, 76, 48), C.white, {
				seed: 1715,
				shade: 0,
				line: 2.4,
			});
			part(context, S.star(0, -76, 30, 13), C.sun, { seed: 1716, line: 2 });
			text(context, label, 0, -22, {
				size: Math.min(46, 250 / label.length),
				font: P.font.hand,
				color: C.deep,
			});
		});

	art.heightChart = () =>
		P.sprite('height-chart', 170, 940, (context) => {
			part(context, S.rect(-62, -450, 124, 900), C.cream, { seed: 1721, shade: 0 });
			part(context, S.rect(-62, -450, 124, 40), C.sky, { seed: 1722, line: 2 });
			for (let y = -390, index = 0; y <= 430; y += 30, index++) {
				line(
					context,
					[
						[-62, y],
						[-62 + (index % 3 === 0 ? 54 : 26), y],
					],
					{ seed: 1723 + index, width: 3, alpha: 0.65 },
				);
			}
		});

	/* ---------- receiving ---------- */
	art.checkBadge = () =>
		P.sprite('check-badge', 150, 150, (context) => {
			const points = [];
			for (let index = 0; index < 48; index++) {
				const angle = (index / 48) * Math.PI * 2;
				const radius = 62 + (index % 2 ? -4 : 3);
				points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
			}
			part(context, points, C.mint, { seed: 1731, cut: false });
			line(
				context,
				[
					[-28, 2],
					[-8, 24],
					[30, -22],
				],
				{ seed: 1732, width: 11, color: C.white, alpha: 1 },
			);
		});

	/* Kraft pocket in three layers so cards can slide between back and front, then the flap folds over. */
	art.pocketBack = () =>
		P.sprite('pocket-back', 500, 300, (context) => {
			part(context, S.rect(-230, -120, 460, 250), C.kraftDark, { seed: 1741, shade: 0 });
		});
	art.pocketFront = (label) =>
		P.sprite(`pocket-front-${label}`, 520, 240, (context) => {
			const front = part(
				context,
				S.bezier(
					[
						[-240, -40],
						[-120, -10],
						[120, -10],
						[240, -40],
					],
					24,
				).concat([
					[240, 110],
					[-240, 110],
				]),
				C.kraft,
				{ seed: 1742 },
			);
			P.hatch(context, front, { region: S.rect(120, -50, 140, 170), alpha: 0.14 });
			part(context, S.roundRect(-120, 16, 240, 70, 12), C.white, {
				seed: 1743,
				shade: 0,
				line: 2.2,
			});
			text(context, label, 18, 52, { size: 50, font: P.font.hand, color: C.ink });
			line(
				context,
				[
					[-98, 50],
					[-86, 64],
					[-64, 36],
				],
				{ seed: 1744, width: 6, color: C.mint, alpha: 1 },
			);
		});
	/* Hinge sits at the sprite centre so a negative scaleY folds it down over the front. */
	art.pocketFlap = () =>
		P.sprite('pocket-flap', 500, 260, (context) => {
			part(
				context,
				[
					[-230, 0],
					[230, 0],
					[160, -110],
					[-160, -110],
				],
				C.kraft,
				{ seed: 1745 },
			);
			part(context, S.ellipse(0, -80, 22, 22, 18), C.coral, { seed: 1746, line: 2.2 });
		});

	/* ---------- the end card ---------- */
	/* The English sign keeps its original key, whose length seeds the paper border. */
	art.adSign = (title = 'ADS', note = 'buy now!!') =>
		P.sprite(title === 'ADS' ? 'ad-sign' : `ad-sign-${title}`, 320, 320, (context) => {
			for (const side of [-1, 1]) {
				part(context, S.rect(side * 70 - 12, 40, 24, 110), C.kraftDark, {
					seed: 1751 + side,
					line: 2.2,
				});
			}
			part(context, S.roundRect(-140, -120, 280, 180, 16), C.creamDark, { seed: 1753 });
			part(context, S.roundRect(-124, -104, 248, 148, 10), C.white, {
				seed: 1754,
				shade: 0,
				line: 2,
			});
			text(context, title, 0, -38, {
				size: Math.min(92, 330 / title.length),
				font: P.font.display,
				weight: 700,
			});
			text(context, note, 0, 26, { size: 36, font: P.font.hand, color: C.grey });
		});

	art.magnifier = () =>
		P.sprite('magnifier', 440, 680, (context) => {
			const handle = part(context, S.roundRect(-26, 96, 52, 220, 24), C.kraftDark, {
				seed: 1761,
			});
			P.hatch(context, handle, { region: S.rect(6, 90, 30, 240), alpha: 0.2 });
			part(context, S.rect(-30, 80, 60, 30), C.grey, { seed: 1762, line: 2.2 });
			const ring = P.canvas(440, 440);
			const ringContext = ring.getContext('2d');
			ringContext.translate(220, 220);
			const outline = part(ringContext, S.ellipse(0, 0, 200, 200, 72), C.inkSoft, {
				seed: 1763,
			});
			P.hatch(ringContext, outline, { region: S.ellipse(90, 90, 160, 160), alpha: 0.2 });
			ringContext.globalCompositeOperation = 'destination-out';
			P.tracePath(ringContext, S.ellipse(0, 0, 176, 176, 72));
			ringContext.fill();
			ringContext.globalCompositeOperation = 'source-over';
			P.crayon(
				ringContext,
				S.arcBand(0, 0, 196, 184, Math.PI * 1.05, Math.PI * 1.45, 16),
				C.bright,
				0.8,
			);
			context.drawImage(ring, -220, -340);
		});

	art.confettiColors = [C.sky, C.sun, C.coral, C.mint, C.sakura, C.bright, C.deep];
})();
