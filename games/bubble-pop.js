/**
 * Bubble Pop! - Game cho N3DS
 * Chạm bong bóng trên màn dưới để ghi điểm!
 */

function startBubblePop(n3ds) {
    // ====== GAME STATE ======
    const game = {
        score: 0,
        combo: 0,
        maxCombo: 0,
        level: 1,
        bubbles: [],
        particles: [],
        floatingTexts: [],
        missed: 0,
        spawnTimer: 0,
        spawnInterval: 1.5,
        maxBubbles: 4,
        bubbleLifetime: 3.0,
        state: 'playing',
        shakeTime: 0,
    };

    const COLORS = [
        { fill: '#ff6b6b', stroke: '#ee5a5a', glow: 'rgba(255,107,107,0.4)' },
        { fill: '#4ecdc4', stroke: '#3dbdb5', glow: 'rgba(78,205,196,0.4)' },
        { fill: '#ffe66d', stroke: '#eedd55', glow: 'rgba(255,230,109,0.4)' },
        { fill: '#a29bfe', stroke: '#918af0', glow: 'rgba(162,155,254,0.4)' },
        { fill: '#fd79a8', stroke: '#e66b97', glow: 'rgba(253,121,168,0.4)' },
        { fill: '#00cec9', stroke: '#00b8b3', glow: 'rgba(0,206,201,0.4)' },
        { fill: '#ff9ff3', stroke: '#ee8ee2', glow: 'rgba(255,159,243,0.4)' },
        { fill: '#ffa502', stroke: '#ee9900', glow: 'rgba(255,165,2,0.4)' },
    ];

    function spawnBubble() {
        const w = n3ds.bottom.width, h = n3ds.bottom.height;
        const minR = 25, maxR = 45;
        const r = minR + Math.random() * (maxR - minR);
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        game.bubbles.push({
            x: r + Math.random() * (w - r * 2),
            y: r + Math.random() * (h - r * 2),
            r, color,
            points: Math.ceil((maxR - r) / 5) + 1,
            life: game.bubbleLifetime,
            maxLife: game.bubbleLifetime,
            wobble: Math.random() * Math.PI * 2,
            popping: false,
            popTime: 0,
        });
    }

    function spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            const speed = 80 + Math.random() * 120;
            game.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: 2 + Math.random() * 4,
                life: 0.5 + Math.random() * 0.4,
                maxLife: 0.9,
                color: color.fill,
            });
        }
    }

    // ====== TOUCH ======
    n3ds.bottom.onTap = (x, y) => {
        if (game.state === 'gameover') {
            Object.assign(game, {
                score: 0, combo: 0, maxCombo: 0, level: 1,
                missed: 0, bubbles: [], particles: [], floatingTexts: [],
                spawnTimer: 0, spawnInterval: 1.5, maxBubbles: 4,
                bubbleLifetime: 3.0, state: 'playing',
            });
            return;
        }

        let hit = false;
        for (let i = game.bubbles.length - 1; i >= 0; i--) {
            const b = game.bubbles[i];
            if (b.popping) continue;
            const dx = x - b.x, dy = y - b.y;
            if (dx * dx + dy * dy <= b.r * b.r) {
                game.combo++;
                if (game.combo > game.maxCombo) game.maxCombo = game.combo;
                const mult = Math.min(game.combo, 5);
                const earned = b.points * mult;
                game.score += earned;

                game.level = Math.floor(game.score / 50) + 1;
                game.spawnInterval = Math.max(0.4, 1.5 - game.level * 0.08);
                game.maxBubbles = Math.min(10, 4 + Math.floor(game.level / 2));
                game.bubbleLifetime = Math.max(1.2, 3.0 - game.level * 0.1);

                spawnParticles(b.x, b.y, b.color, 10 + mult * 2);
                game.floatingTexts.push({
                    x: b.x, y: b.y - b.r,
                    text: mult > 1 ? `+${earned} x${mult}` : `+${earned}`,
                    color: b.color.fill, life: 1, maxLife: 1,
                });

                b.popping = true;
                b.popTime = 0.15;
                hit = true;
                break;
            }
        }
        if (!hit) { game.combo = 0; game.shakeTime = 0.15; }
    };

    // ====== GAME LOOP ======
    n3ds.run((dt, time) => {
        if (game.state === 'playing') {
            // Spawn
            game.spawnTimer -= dt;
            if (game.spawnTimer <= 0 && game.bubbles.length < game.maxBubbles) {
                spawnBubble();
                game.spawnTimer = game.spawnInterval * (0.7 + Math.random() * 0.6);
            }

            // Update bubbles
            for (let i = game.bubbles.length - 1; i >= 0; i--) {
                const b = game.bubbles[i];
                if (b.popping) { b.popTime -= dt; if (b.popTime <= 0) game.bubbles.splice(i, 1); continue; }
                b.life -= dt;
                b.wobble += dt * 3;
                if (b.life <= 0) {
                    game.missed++; game.combo = 0; game.shakeTime = 0.2;
                    game.bubbles.splice(i, 1);
                    if (game.missed >= 10) game.state = 'gameover';
                }
            }

            // Update particles
            for (let i = game.particles.length - 1; i >= 0; i--) {
                const p = game.particles[i];
                p.life -= dt; if (p.life <= 0) { game.particles.splice(i, 1); continue; }
                p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.r *= 0.98;
            }

            // Update floating texts
            for (let i = game.floatingTexts.length - 1; i >= 0; i--) {
                const ft = game.floatingTexts[i];
                ft.life -= dt; if (ft.life <= 0) { game.floatingTexts.splice(i, 1); continue; }
                ft.y -= 60 * dt;
            }

            if (game.shakeTime > 0) game.shakeTime -= dt;
        }

        // ====== DRAW BOTTOM ======
        const bot = n3ds.bottom;
        const bCtx = bot.ctx;
        bCtx.save();

        if (game.shakeTime > 0) {
            const s = game.shakeTime * 30;
            bCtx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
        }

        // BG
        const bg = bCtx.createLinearGradient(0, 0, 0, bot.height);
        bg.addColorStop(0, '#0f0f23'); bg.addColorStop(1, '#1a1a3e');
        bCtx.fillStyle = bg; bCtx.fillRect(0, 0, bot.width, bot.height);

        // Grid
        bCtx.strokeStyle = 'rgba(255,255,255,0.03)'; bCtx.lineWidth = 1;
        for (let x = 0; x < bot.width; x += 30) { bCtx.beginPath(); bCtx.moveTo(x, 0); bCtx.lineTo(x, bot.height); bCtx.stroke(); }
        for (let y = 0; y < bot.height; y += 30) { bCtx.beginPath(); bCtx.moveTo(0, y); bCtx.lineTo(bot.width, y); bCtx.stroke(); }

        if (game.state === 'gameover') {
            bCtx.fillStyle = 'rgba(0,0,0,0.7)'; bCtx.fillRect(0, 0, bot.width, bot.height);
            bot.drawText('GAME OVER', bot.height / 2 - 50, { color: '#ff6b6b', font: 'bold 36px Arial' });
            bot.drawText(`Điểm: ${game.score}`, bot.height / 2, { font: '20px Arial' });
            bot.drawText(`Max Combo: x${game.maxCombo}`, bot.height / 2 + 30, { font: '20px Arial' });
            bot.drawText('Chạm để chơi lại', bot.height / 2 + 80, { color: 'rgba(255,255,255,0.5)', font: '16px Arial' });
            bCtx.restore();
        } else {
            // Bubbles
            for (const b of game.bubbles) {
                const lifeRatio = b.life / b.maxLife;
                bCtx.save();
                if (b.popping) {
                    const scale = 1 + (1 - b.popTime / 0.15) * 0.5;
                    bCtx.globalAlpha = b.popTime / 0.15;
                    bCtx.translate(b.x, b.y); bCtx.scale(scale, scale); bCtx.translate(-b.x, -b.y);
                }
                const wx = Math.sin(b.wobble) * 2, wy = Math.cos(b.wobble * 1.3) * 2;
                bCtx.shadowColor = b.color.glow; bCtx.shadowBlur = 15;
                bCtx.beginPath(); bCtx.arc(b.x + wx, b.y + wy, b.r, 0, Math.PI * 2);
                bCtx.fillStyle = b.color.fill; bCtx.fill();
                bCtx.strokeStyle = b.color.stroke; bCtx.lineWidth = 2; bCtx.stroke();
                bCtx.shadowBlur = 0;
                bCtx.beginPath(); bCtx.arc(b.x + wx - b.r * 0.25, b.y + wy - b.r * 0.25, b.r * 0.35, 0, Math.PI * 2);
                bCtx.fillStyle = 'rgba(255,255,255,0.35)'; bCtx.fill();
                if (!b.popping && lifeRatio < 0.8) {
                    bCtx.beginPath(); bCtx.arc(b.x + wx, b.y + wy, b.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifeRatio);
                    bCtx.strokeStyle = lifeRatio < 0.3 ? '#ff4444' : 'rgba(255,255,255,0.5)'; bCtx.lineWidth = 2; bCtx.stroke();
                }
                bCtx.fillStyle = 'rgba(255,255,255,0.9)'; bCtx.font = `bold ${Math.round(b.r * 0.5)}px Arial`;
                bCtx.textAlign = 'center'; bCtx.textBaseline = 'middle'; bCtx.fillText(b.points, b.x + wx, b.y + wy);
                bCtx.restore();
            }

            // Particles
            for (const p of game.particles) {
                bCtx.globalAlpha = p.life / p.maxLife; bCtx.fillStyle = p.color;
                bCtx.beginPath(); bCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); bCtx.fill();
            }
            bCtx.globalAlpha = 1;

            // Floating texts
            for (const ft of game.floatingTexts) {
                bCtx.globalAlpha = ft.life / ft.maxLife; bCtx.fillStyle = ft.color;
                bCtx.font = 'bold 18px Arial'; bCtx.textAlign = 'center'; bCtx.fillText(ft.text, ft.x, ft.y);
            }
            bCtx.globalAlpha = 1;

            if (game.score === 0 && game.bubbles.length > 0) {
                bot.drawText('👆 Chạm vào bong bóng!', bot.height - 30, { color: 'rgba(255,255,255,0.4)', font: '16px Arial' });
            }
            bCtx.restore();
        }

        // ====== DRAW TOP ======
        const top = n3ds.top;
        const tCtx = top.ctx;
        const hue = (time * 0.02) % 360;
        const tbg = tCtx.createLinearGradient(0, 0, top.width, top.height);
        tbg.addColorStop(0, `hsl(${hue}, 60%, 15%)`);
        tbg.addColorStop(0.5, `hsl(${(hue + 40) % 360}, 50%, 12%)`);
        tbg.addColorStop(1, `hsl(${(hue + 80) % 360}, 60%, 15%)`);
        tCtx.fillStyle = tbg; tCtx.fillRect(0, 0, top.width, top.height);

        // Stars
        tCtx.fillStyle = 'rgba(255,255,255,0.15)';
        for (let i = 0; i < 30; i++) {
            const sx = (Math.sin(i * 127.1 + time * 0.0001 * (i % 3 + 1)) * 0.5 + 0.5) * top.width;
            const sy = (Math.cos(i * 311.7 + time * 0.00005 * (i % 2 + 1)) * 0.5 + 0.5) * top.height;
            tCtx.beginPath(); tCtx.arc(sx, sy, 1 + Math.sin(time * 0.002 + i) * 0.5, 0, Math.PI * 2); tCtx.fill();
        }

        top.drawText('🫧 Bubble Pop!', 50, { font: 'bold 32px Arial' });

        tCtx.font = 'bold 56px monospace';
        const sg = tCtx.createLinearGradient(top.width / 2 - 100, 100, top.width / 2 + 100, 100);
        sg.addColorStop(0, '#ffe66d'); sg.addColorStop(1, '#ff9ff3');
        tCtx.fillStyle = sg; tCtx.textAlign = 'center'; tCtx.fillText(String(game.score).padStart(6, '0'), top.width / 2, 130);

        top.drawText(`📊 Level ${game.level}`, 200, { color: '#4ecdc4', font: '22px Arial', align: 'left' });

        if (game.combo > 0) {
            const cs = Math.min(1.3, 1 + game.combo * 0.05);
            tCtx.save(); tCtx.translate(top.width / 2, 240); tCtx.scale(cs, cs);
            tCtx.font = 'bold 28px Arial'; tCtx.fillStyle = game.combo >= 5 ? '#ff6b6b' : game.combo >= 3 ? '#ffe66d' : '#fff';
            tCtx.textAlign = 'center'; tCtx.fillText(`🔥 COMBO x${game.combo}`, 0, 0); tCtx.restore();
        }

        let hearts = '';
        for (let i = 0; i < 10; i++) hearts += i < 10 - game.missed ? '❤️' : '🖤';
        top.drawText(hearts, 290, { font: '18px Arial' });

        tCtx.fillStyle = 'rgba(255,255,255,0.08)'; tCtx.fillRect(0, top.height - 60, top.width, 60);
        top.drawText(
            `Max Combo: x${game.maxCombo}  |  Missed: ${game.missed}/10  |  Bubbles: ${game.bubbles.filter(b => !b.popping).length}`,
            top.height - 30, { color: 'rgba(255,255,255,0.6)', font: '16px Arial' }
        );

        if (game.state === 'gameover') {
            tCtx.fillStyle = 'rgba(255, 50, 50, 0.15)'; tCtx.fillRect(0, 0, top.width, top.height);
            top.drawText('GAME OVER', top.height / 2 - 10, { color: '#ff4444', font: 'bold 48px Arial' });
            top.drawText('Chạm màn dưới để chơi lại', top.height / 2 + 30, { color: 'rgba(255,255,255,0.6)', font: '20px Arial' });
        }
    });
}

