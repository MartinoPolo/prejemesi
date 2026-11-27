/* Scene toolkit shared by the films: timing curves, pops, skies, confetti, the wordmark, and the camera pass. */
(() => {
	const P = window.P;
	const C = P.C;
	const A = P.art;
	const S = P.shape;
	const E = P.ease;
	const W = P.W;
	const H = P.H;
	const stage = (P.stage = {});

	/* ---------- room backgrounds ---------- */
	stage.wallSprite = () =>
		P.sprite(
			'room-wall',
			W * 2.2,
			H,
			(context) => {
				const width = W * 2.2;
				context.fillStyle = P.paperFill(context, C.cream);
				context.fillRect(-width / 2, -H / 2, width, H);
				for (let x = -width / 2; x < width / 2; x += 150) {
					context.fillStyle = P.paperFill(context, '#f1e6cf');
					P.tracePath(
						context,
						P.torn(S.rect(x, -H / 2 - 10, 58, H + 20), x, {
							spacing: 12,
							amplitude: 1.2,
						}),
					);
					context.fill();
				}
				for (let x = -width / 2 + 75; x < width / 2; x += 150) {
					for (let y = -H / 2 + 60; y < H / 2; y += 120) {
						const flower = S.star(x, y + ((x / 150) % 2) * 60, 9, 4, 5);
						P.tracePath(context, flower);
						context.fillStyle = 'rgba(169,132,92,0.35)';
						context.fill();
					}
				}
			},
			{ border: 0, variants: 1 },
		);

	stage.tableSprite = () =>
		P.sprite(
			'room-table',
			W * 2.2,
			360,
			(context) => {
				const width = W * 2.2;
				const top = P.torn(S.rect(-width / 2, -150, width, 330), 17, {
					spacing: 7,
					amplitude: 3,
				});
				P.tracePath(context, top);
				context.fillStyle = P.paperFill(context, C.kraft);
				context.fill();
				context.save();
				context.clip();
				context.fillStyle = P.paperFill(context, C.kraftDark);
				context.fillRect(-width / 2, -40, width, 16);
				for (let x = -width / 2; x < width / 2; x += 34) {
					context.fillStyle = 'rgba(255,255,255,0.18)';
					context.fillRect(x, -150, 12, 110);
				}
				context.restore();
			},
			{ border: 0, variants: 1 },
		);

	stage.frameSprite = () =>
		P.sprite('wall-frame', 300, 240, (context) => {
			A.part(context, S.rect(-140, -110, 280, 220), C.kraftDark, { seed: 801 });
			A.part(context, S.rect(-112, -84, 224, 168), C.skyPale, { seed: 802, line: 2 });
			A.part(
				context,
				[
					[-112, 84],
					[-40, 0],
					[20, 60],
					[60, 20],
					[112, 84],
				],
				C.mintPale,
				{ seed: 803, line: 2, cut: false },
			);
			A.part(context, S.ellipse(60, -40, 20, 20, 16), C.sunPale, { seed: 804, line: 2 });
		});

	/* ---------- timing ---------- */
	stage.ramp = (time, start, duration, easing = E.inOutCubic) =>
		easing(P.progress(time, start, duration));
	stage.settle = (time, start, frequency = 2.6, damping = 6.5) =>
		P.spring(time - start, frequency, damping);
	stage.between = (time, start, end) => time >= start && time < end;
	stage.bounce = (time) =>
		-Math.abs(Math.sin(Math.PI * ((time - P.cues.beat.first) / P.cues.beat.seconds)));
	stage.shakeAt = (time, start, amplitude = 10, duration = 0.35) => {
		const local = time - start;
		if (local < 0 || local > duration) {
			return [0, 0];
		}
		const decay = (1 - local / duration) ** 2;
		return [
			Math.sin(local * 90) * amplitude * decay,
			Math.cos(local * 70) * amplitude * decay * 0.7,
		];
	};
	stage.arcPath = (from, to, height, amount) => [
		P.lerp(from[0], to[0], amount),
		P.lerp(from[1], to[1], amount) - Math.sin(Math.PI * amount) * height,
	];

	/* Pop-in with overshoot; returns draw options for P.draw. */
	stage.popOptions = (time, start, { rotation = 0, duration = 0.5, from = 0 } = {}) => {
		const local = time - start;
		if (local < 0) {
			return null;
		}
		const amount = from + (1 - from) * P.spring(local, 2.3, 6.5);
		return {
			scale: amount,
			lift: P.clamp(1 - local / duration),
			rotation: rotation + (1 - P.clamp(local / 0.5)) * 0.25 * Math.sin(local * 18),
			time,
		};
	};
	stage.drawPop = (
		context,
		sprite,
		x,
		y,
		time,
		start,
		{ scale = 1, rotation = 0, ...rest } = {},
	) => {
		const options = stage.popOptions(time, start, { rotation });
		if (!options) {
			return;
		}
		P.draw(context, sprite, x, y, { ...rest, ...options, scale: options.scale * scale });
	};

	/* ---------- backgrounds and particles ---------- */
	stage.skyBackground = (
		context,
		time,
		{ sun = true, clouds = true, sunX = 1660, sunY = 190, drift = 1 } = {},
	) => {
		context.fillStyle = P.paperFill(context, '#e6f4fd');
		context.fillRect(0, 0, W, H);
		const glow = context.createRadialGradient(
			W * 0.5,
			H * 0.35,
			80,
			W * 0.5,
			H * 0.45,
			W * 0.75,
		);
		glow.addColorStop(0, 'rgba(255,255,255,0.55)');
		glow.addColorStop(1, 'rgba(255,255,255,0)');
		context.fillStyle = glow;
		context.fillRect(0, 0, W, H);
		if (sun) {
			P.draw(context, A.sun(), sunX, sunY + Math.sin(time * 1.4) * 6, {
				scale: 0.85,
				rotation: time * 0.12,
				time,
			});
		}
		if (clouds) {
			const layout = [
				[260, 170, 320, 'a', 22],
				[1150, 120, 260, 'b', 16],
				[760, 300, 200, 'c', 30],
				[1500, 420, 240, 'd', 20],
				[120, 520, 220, 'e', 26],
			];
			for (const [x, y, width, key, speed] of layout) {
				const travel = ((x + time * speed * drift + 300) % (W + 600)) - 300;
				P.draw(context, A.cloud(width, key), travel, y, { time, shadowAlpha: 0.18 });
			}
		}
	};

	stage.confetti = (
		context,
		time,
		start,
		{
			count = 90,
			originX = W / 2,
			originY = H / 2,
			spread = 1,
			power = 1,
			seed = 1,
			gravity = 900,
		} = {},
	) => {
		const local = time - start;
		if (local < 0 || local > 6) {
			return;
		}
		const next = P.random(seed);
		for (let index = 0; index < count; index++) {
			const delay = next() * 0.12;
			const angle = -Math.PI / 2 + (next() - 0.5) * 2.2 * spread;
			const speed = (700 + next() * 900) * power;
			const spin = 4 + next() * 10;
			const flutter = 30 + next() * 50;
			const color = A.confettiColors[index % A.confettiColors.length];
			const size = 12 + next() * 16;
			const shape = next();
			const age = local - delay;
			if (age < 0) {
				continue;
			}
			const drag = 1 - Math.exp(-age * 2.2);
			const x =
				originX +
				(Math.cos(angle) * speed * drag) / 2.2 +
				Math.sin(age * 5 + index) * flutter * P.clamp(age);
			const y = originY + (Math.sin(angle) * speed * drag) / 2.2 + gravity * 0.18 * age * age;
			if (y > H + 60) {
				continue;
			}
			context.save();
			context.translate(x, y);
			context.rotate(age * spin + index);
			context.scale(1, Math.cos(age * spin * 0.8 + index));
			context.fillStyle = color;
			if (shape < 0.6) {
				context.fillRect(-size / 2, -size * 0.3, size, size * 0.6);
			} else {
				P.tracePath(context, S.ellipse(0, 0, size * 0.4, size * 0.4, 10));
				context.fill();
			}
			context.restore();
		}
	};

	stage.sparkleBurst = (
		context,
		time,
		start,
		centerX,
		centerY,
		{ count = 7, radius = 420, seed = 1, colors = [C.sun, C.white, C.bright] } = {},
	) => {
		const next = P.random(seed);
		for (let index = 0; index < count; index++) {
			const raw = next();
			const angle = (raw < 0.5 ? -1 : 1) * Math.PI * (0.2 + (raw % 0.5) * 1.2);
			const distance = radius * (0.6 + next() * 0.5);
			const delay = next() * 0.35;
			const local = time - start - delay;
			if (local < 0 || local > 1.4) {
				continue;
			}
			const size =
				local < 0.25 ? E.outBack(local / 0.25) : 1 - E.inQuad(P.clamp((local - 0.8) / 0.6));
			P.draw(
				context,
				A.sparkle(colors[index % colors.length], 46),
				centerX + Math.cos(angle) * distance,
				centerY + Math.sin(angle) * distance * 0.55,
				{
					scale: Math.max(0, size) * (0.6 + next() * 0.6),
					rotation: local * 2,
					time,
					shadowAlpha: 0.2,
				},
			);
		}
	};

	stage.drawTown = (context, time, rise) => {
		const offset = (1 - rise) * 420;
		P.draw(context, A.hills('#bfe3cf', 'back', 50), W / 2, 860 + offset * 1.2, {
			shadowAlpha: 0,
			time,
		});
		const houses = [
			[180, 700, C.coralPale, C.deep, 'a', 150, 130],
			[560, 690, C.skyPale, C.coral, 'b', 130, 150],
			[1350, 700, C.sunPale, C.sky, 'c', 140, 130],
			[1760, 690, C.sakuraPale, C.deep, 'd', 150, 140],
		];
		for (const [x, y, color, roof, key, width, height] of houses) {
			P.draw(context, A.house(color, roof, key, width, height), x, y + offset * 1.1, {
				time,
				scale: 0.9,
				shadowAlpha: 0.22,
			});
		}
		P.draw(context, A.hills('#8fd0ae', 'front', 40), W / 2, 960 + offset, {
			shadowAlpha: 0.2,
			time,
		});
	};

	/* ---------- the wordmark: logo slam, then letters hop in one per sixteenth note ---------- */
	let wordLayout;
	const layoutWordmark = () => {
		const measure = P.canvas(10, 10).getContext('2d');
		const layout = (text, size) => {
			measure.font = `700 ${size}px ${P.font.display}`;
			return [...text].map((character, index) => {
				const before = measure.measureText(text.slice(0, index)).width;
				const width = measure.measureText(character).width;
				return { character, x: before + width / 2 };
			});
		};
		const main = layout('přejeme si', 190);
		measure.font = `700 190px ${P.font.display}`;
		const mainWidth = measure.measureText('přejeme si').width;
		const tld = layout('.cz', 150);
		measure.font = `700 150px ${P.font.display}`;
		const tldWidth = measure.measureText('.cz').width;
		return { main, mainWidth, tld, tldWidth };
	};

	stage.drawWordmark = (
		context,
		time,
		start,
		{ x: centerX, y, withTld = false, scale = 1, lettersDelay = 0.22, tldDelay = 1.05 },
	) => {
		wordLayout ??= layoutWordmark();
		const markSize = 250;
		const gap = 50;
		const total =
			markSize + gap + wordLayout.mainWidth + (withTld ? wordLayout.tldWidth + 10 : 0);
		const left = centerX - (total * scale) / 2;
		const local = time - start;
		if (local < 0) {
			return;
		}
		const slam =
			local < 0.14
				? P.lerp(2.3, 1, E.inQuad(local / 0.14))
				: 1 + (1 - P.spring(local - 0.14, 3, 7)) * -0.12;
		P.draw(context, A.logoMark(), left + (markSize / 2) * scale, y, {
			scale: slam * scale * (markSize / 300),
			rotation: -0.07 + Math.sin(time * 1.7) * 0.015,
			lift: P.clamp(1 - local / 0.14),
			time,
		});
		const lettersStart = start + lettersDelay;
		const step = P.cues.beat.seconds / 4;
		const baseX = left + (markSize + gap) * scale;
		wordLayout.main.forEach((letter, index) => {
			if (letter.character === ' ') {
				return;
			}
			const appear = lettersStart + index * step;
			const pop = stage.popOptions(time, appear, {
				rotation: (P.hash(index, 4) - 0.5) * 0.12,
			});
			if (!pop) {
				return;
			}
			const idle = Math.sin(time * 2.4 + index * 0.8) * 4;
			const drop = (1 - P.clamp((time - appear) / 0.12)) * -80;
			P.draw(
				context,
				A.letter(letter.character, { color: C.ink, size: 190 }),
				baseX + letter.x * scale,
				y + drop + idle,
				{ ...pop, scale: pop.scale * scale },
			);
		});
		if (withTld) {
			const tldStart = start + tldDelay;
			wordLayout.tld.forEach((letter, index) => {
				const pop = stage.popOptions(time, tldStart + index * step, {
					rotation: (P.hash(index, 9) - 0.5) * 0.14,
				});
				if (!pop) {
					return;
				}
				P.draw(
					context,
					A.letter(letter.character, { color: C.sky, size: 150 }),
					baseX + (wordLayout.mainWidth + 10 + letter.x) * scale,
					y + 16 + Math.sin(time * 2.4 + index) * 4,
					{ ...pop, scale: pop.scale * scale },
				);
			});
		}
	};

	/* Incoming sheets cast a soft shadow so wipes read as paper sliding over paper. */
	stage.sheetShadow = (context) => {
		context.save();
		context.shadowColor = 'rgba(22,40,70,0.4)';
		context.shadowBlur = 40;
		context.fillStyle = C.paper;
		context.fillRect(0, 0, W, H);
		context.restore();
	};

	/* ---------- post: grain, vignette, projector flicker ---------- */
	let vignette;
	const post = (context, time) => {
		const boil = P.boilFrame(time);
		context.save();
		context.globalCompositeOperation = 'multiply';
		context.globalAlpha = 0.28;
		const pattern = context.createPattern(P.grain, 'repeat');
		pattern.setTransform(new DOMMatrix().translate((boil * 137) % 512, (boil * 71) % 512));
		context.fillStyle = pattern;
		context.fillRect(0, 0, W, H);
		context.restore();
		if (!vignette) {
			vignette = P.canvas(W, H);
			const vignetteContext = vignette.getContext('2d');
			const gradient = vignetteContext.createRadialGradient(
				W / 2,
				H / 2,
				H * 0.45,
				W / 2,
				H / 2,
				H * 1.05,
			);
			gradient.addColorStop(0, 'rgba(22,40,70,0)');
			gradient.addColorStop(1, 'rgba(22,40,70,0.22)');
			vignetteContext.fillStyle = gradient;
			vignetteContext.fillRect(0, 0, W, H);
		}
		context.drawImage(vignette, 0, 0);
		const flicker = (P.hash(boil, 77) - 0.5) * 0.025;
		context.fillStyle =
			flicker > 0 ? `rgba(255,250,240,${flicker})` : `rgba(22,40,70,${-flicker * 0.6})`;
		context.fillRect(0, 0, W, H);
	};

	/*
	 * Registers a film. `prepare(marks)` runs once after the cues load; `draw(context, time)` paints a
	 * frame on a stepped clock (animation on twos) under a hand-held camera drift, before the post pass.
	 */
	stage.film = ({ prepare, draw }) => {
		P.prepare = () => {
			P.duration = P.cues.duration;
			prepare(P.cues.marks);
			const scratch = P.canvas(W, H).getContext('2d');
			for (let time = 0; time < P.duration; time += 0.25) {
				P.render(scratch, time);
			}
		};
		P.render = (context, rawTime) => {
			const time = P.step(Math.max(0, rawTime), 15);
			context.save();
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.fillStyle = C.paper;
			context.fillRect(0, 0, W, H);
			const driftX = P.noise(time * 0.35, 1) * 5 + (P.hash(P.boilFrame(time), 5) - 0.5) * 1.2;
			const driftY = P.noise(time * 0.3, 2) * 4 + (P.hash(P.boilFrame(time), 6) - 0.5) * 1.2;
			context.translate(W / 2 + driftX, H / 2 + driftY);
			context.rotate(P.noise(time * 0.25, 3) * 0.0025);
			context.scale(1.012, 1.012);
			context.translate(-W / 2, -H / 2);
			draw(context, time);
			context.restore();
			post(context, time);
		};
	};
})();
