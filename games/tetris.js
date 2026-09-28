/**
 * Tetris - Game cho N3DS
 * Màn trên: Bảng Tetris chính + score
 * Màn dưới: Touch controls + Next piece + Hold
 */

function startTetris(n3ds) {

    // ====== TETROMINO DEFINITIONS ======
    const SHAPES = {
        I: { blocks: [[0,0],[1,0],[2,0],[3,0]], color: '#00f0f0', dark: '#00c8c8', glow: 'rgba(0,240,240,0.3)' },
        O: { blocks: [[0,0],[1,0],[0,1],[1,1]], color: '#f0f000', dark: '#c8c800', glow: 'rgba(240,240,0,0.3)' },
        T: { blocks: [[0,0],[1,0],[2,0],[1,1]], color: '#a000f0', dark: '#8000c8', glow: 'rgba(160,0,240,0.3)' },
        S: { blocks: [[1,0],[2,0],[0,1],[1,1]], color: '#00f000', dark: '#00c800', glow: 'rgba(0,240,0,0.3)' },
        Z: { blocks: [[0,0],[1,0],[1,1],[2,1]], color: '#f00000', dark: '#c80000', glow: 'rgba(240,0,0,0.3)' },
        J: { blocks: [[0,0],[0,1],[1,1],[2,1]], color: '#0000f0', dark: '#0000c8', glow: 'rgba(0,0,240,0.3)' },
        L: { blocks: [[2,0],[0,1],[1,1],[2,1]], color: '#f0a000', dark: '#c88000', glow: 'rgba(240,160,0,0.3)' },
    };
    const SHAPE_KEYS = Object.keys(SHAPES);

    const COLS = 10;
    const ROWS = 20;

    // ====== GAME STATE ======
    const game = {
        board: [],            // ROWS x COLS, null hoặc color string
        current: null,        // { type, blocks, x, y, color, dark, glow }
        next: null,
        held: null,
        canHold: true,
        score: 0,
        lines: 0,
        level: 1,
        state: 'playing',    // playing | paused | gameover
        dropTimer: 0,
        dropInterval: 1.0,   // giây / drop
        lockDelay: 0,
        lockTimer: 0,
        clearAnim: null,     // { rows: [], timer: 0 }
        particles: [],
        // Touch repeat
        repeatAction: null,
        repeatTimer: 0,
        repeatDelay: 0.25,
        repeatRate: 0.07,
        repeatFired: false,
        // Stats
        combo: -1,
    };

    function createBoard() {
        game.board = [];
        for (let r = 0; r < ROWS; r++) {
            game.board.push(new Array(COLS).fill(null));
        }
    }

    // ====== BAG RANDOMIZER ======
    let bag = [];
    function nextPieceType() {
        if (bag.length === 0) {
            bag = [...SHAPE_KEYS];
            // Fisher-Yates shuffle
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
        }
        return bag.pop();
    }

    function createPiece(type) {
        const s = SHAPES[type];
        return {
            type,
            blocks: s.blocks.map(b => [...b]),
            x: Math.floor(COLS / 2) - 1,
            y: 0,
            color: s.color,
            dark: s.dark,
            glow: s.glow,
        };
    }

    function spawnPiece() {
        game.current = game.next || createPiece(nextPieceType());
        game.next = createPiece(nextPieceType());
        game.current.x = Math.floor(COLS / 2) - 1;
        game.current.y = 0;
        game.canHold = true;
        game.lockTimer = 0;

        // Game over check
        if (!isValid(game.current, game.current.x, game.current.y)) {
            game.state = 'gameover';
        }
    }

    // ====== COLLISION ======
    function isValid(piece, px, py) {
        for (const [bx, by] of piece.blocks) {
            const x = px + bx;
            const y = py + by;
            if (x < 0 || x >= COLS || y >= ROWS) return false;
            if (y >= 0 && game.board[y][x]) return false;
        }
        return true;
    }

    // ====== MOVEMENT ======
    function moveLeft() {
        if (!game.current || game.state !== 'playing') return;
        if (isValid(game.current, game.current.x - 1, game.current.y)) {
            game.current.x--;
            if (!isValid(game.current, game.current.x, game.current.y + 1)) {
                game.lockTimer = 0; // reset lock delay on move
            }
        }
    }

    function moveRight() {
        if (!game.current || game.state !== 'playing') return;
        if (isValid(game.current, game.current.x + 1, game.current.y)) {
            game.current.x++;
            if (!isValid(game.current, game.current.x, game.current.y + 1)) {
                game.lockTimer = 0;
            }
        }
    }

    function softDrop() {
        if (!game.current || game.state !== 'playing') return;
        if (isValid(game.current, game.current.x, game.current.y + 1)) {
            game.current.y++;
            game.score += 1;
            game.dropTimer = 0;
        }
    }

    function hardDrop() {
        if (!game.current || game.state !== 'playing') return;
        let drops = 0;
        while (isValid(game.current, game.current.x, game.current.y + 1)) {
            game.current.y++;
            drops++;
        }
        game.score += drops * 2;
        lockPiece();
    }

    function rotate(dir) { // dir: 1 = CW, -1 = CCW
        if (!game.current || game.state !== 'playing') return;
        const rotated = game.current.blocks.map(([bx, by]) => {
            return dir === 1 ? [by, -bx] : [-by, bx];
        });

        // Normalize: shift so min x,y = 0
        const minX = Math.min(...rotated.map(b => b[0]));
        const minY = Math.min(...rotated.map(b => b[1]));
        const normalized = rotated.map(([bx, by]) => [bx - minX, by - minY]);

        const testPiece = { ...game.current, blocks: normalized };

        // Wall kick offsets
        const kicks = [[0,0], [-1,0], [1,0], [0,-1], [-2,0], [2,0], [-1,-1], [1,-1]];
        for (const [kx, ky] of kicks) {
            if (isValid(testPiece, game.current.x + kx, game.current.y + ky)) {
                game.current.blocks = normalized;
                game.current.x += kx;
                game.current.y += ky;
                if (!isValid(game.current, game.current.x, game.current.y + 1)) {
                    game.lockTimer = 0;
                }
                return;
            }
        }
    }

    function holdPiece() {
        if (!game.current || !game.canHold || game.state !== 'playing') return;
        const type = game.current.type;
        if (game.held) {
            game.current = createPiece(game.held);
            game.current.x = Math.floor(COLS / 2) - 1;
            game.current.y = 0;
        } else {
            spawnPiece();
        }
        game.held = type;
        game.canHold = false;
        game.lockTimer = 0;
    }

    // ====== LOCK & CLEAR ======
    function lockPiece() {
        if (!game.current) return;
        for (const [bx, by] of game.current.blocks) {
            const x = game.current.x + bx;
            const y = game.current.y + by;
            if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
                game.board[y][x] = game.current.color;
            }
        }

        // Check for line clears
        const fullRows = [];
        for (let r = 0; r < ROWS; r++) {
            if (game.board[r].every(c => c !== null)) {
                fullRows.push(r);
            }
        }

        if (fullRows.length > 0) {
            game.clearAnim = { rows: fullRows, timer: 0.35 };
            game.combo++;

            // Scoring: 100, 300, 500, 800
            const lineScores = [0, 100, 300, 500, 800];
            const base = lineScores[Math.min(fullRows.length, 4)] || 0;
            const comboBonus = game.combo > 0 ? 50 * game.combo : 0;
            game.score += (base + comboBonus) * game.level;
            game.lines += fullRows.length;
            game.level = Math.floor(game.lines / 10) + 1;
            game.dropInterval = Math.max(0.05, 1.0 - (game.level - 1) * 0.07);

            // Particles
            for (const row of fullRows) {
                for (let c = 0; c < COLS; c++) {
                    const color = game.board[row][c];
                    if (color) {
                        for (let p = 0; p < 3; p++) {
                            game.particles.push({
                                x: c, y: row,
                                vx: (Math.random() - 0.5) * 8,
                                vy: -2 - Math.random() * 4,
                                life: 0.5 + Math.random() * 0.3,
                                color,
                            });
                        }
                    }
                }
            }
        } else {
            game.combo = -1;
        }

        if (!game.clearAnim) {
            spawnPiece();
        }
    }

    function clearRows(rows) {
        // Remove rows top-to-bottom
        const sorted = [...rows].sort((a, b) => a - b);
        for (const r of sorted) {
            game.board.splice(r, 1);
            game.board.unshift(new Array(COLS).fill(null));
        }
    }

    // ====== GHOST PIECE ======
    function getGhostY() {
        if (!game.current) return 0;
        let gy = game.current.y;
        while (isValid(game.current, game.current.x, gy + 1)) gy++;
        return gy;
    }

    // ====== KEYBOARD (bonus) ======
    document.addEventListener('keydown', (e) => {
        if (game.state === 'gameover') {
            if (e.key === 'Enter') restartGame();
            return;
        }
        switch (e.key) {
            case 'ArrowLeft': e.preventDefault(); moveLeft(); break;
            case 'ArrowRight': e.preventDefault(); moveRight(); break;
            case 'ArrowDown': e.preventDefault(); softDrop(); break;
            case 'ArrowUp': e.preventDefault(); rotate(1); break;
            case 'z': case 'Z': rotate(-1); break;
            case ' ': e.preventDefault(); hardDrop(); break;
            case 'c': case 'C': holdPiece(); break;
            case 'p': case 'P':
                game.state = game.state === 'paused' ? 'playing' : 'paused';
                break;
        }
    });

    // ====== INIT ======
    function restartGame() {
        createBoard();
        bag = [];
        game.current = null;
        game.next = null;
        game.held = null;
        game.canHold = true;
        game.score = 0;
        game.lines = 0;
        game.level = 1;
        game.state = 'playing';
        game.dropTimer = 0;
        game.dropInterval = 1.0;
        game.lockTimer = 0;
        game.clearAnim = null;
        game.particles = [];
        game.combo = -1;
        game.repeatAction = null;
        spawnPiece();
    }

    restartGame();

    // ====== BOTTOM SCREEN: TOUCH CONTROLS ======
    // Layout: buttons arranged on the bottom screen
    const buttons = [];

    function layoutButtons() {
        const w = n3ds.bottom.width;
        const h = n3ds.bottom.height;
        const bw = w * 0.22;  // button width
        const bh = h * 0.18;  // button height
        const pad = w * 0.03;
        const bottomY = h - bh - pad;
        const midY = bottomY - bh - pad;

        buttons.length = 0;
        buttons.push(
            // D-Pad area (left side)
            { id: 'left',    x: pad,          y: bottomY,  w: bw, h: bh, label: '◀',      action: moveLeft,       repeats: true },
            { id: 'right',   x: pad + bw + pad, y: bottomY, w: bw, h: bh, label: '▶',     action: moveRight,      repeats: true },
            { id: 'down',    x: pad + (bw + pad) * 0.5, y: midY, w: bw, h: bh, label: '▼ Soft', action: softDrop, repeats: true },

            // Action buttons (right side)
            { id: 'rotate',  x: w - bw - pad,            y: bottomY,  w: bw, h: bh, label: '↻ Rotate', action: () => rotate(1) },
            { id: 'drop',    x: w - bw - pad,            y: midY,     w: bw, h: bh, label: '⬇ Drop',   action: hardDrop },
            { id: 'hold',    x: w - (bw + pad) * 2,      y: bottomY,  w: bw, h: bh, label: '⏏ Hold',   action: holdPiece },
        );
    }

    function findButton(x, y) {
        for (const b of buttons) {
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
        }
        return null;
    }

    let activeBtn = null;

    n3ds.bottom.onTap = (x, y) => {
        if (game.state === 'gameover') { restartGame(); return; }
        if (game.state === 'paused') { game.state = 'playing'; return; }

        const btn = findButton(x, y);
        if (btn) {
            btn.action();
            activeBtn = btn;
            if (btn.repeats) {
                game.repeatAction = btn.action;
                game.repeatTimer = 0;
                game.repeatFired = false;
            }
        }
    };

    n3ds.bottom.onMove = (x, y) => {
        const btn = findButton(x, y);
        if (btn !== activeBtn) {
            activeBtn = btn;
            if (btn && btn.repeats) {
                game.repeatAction = btn.action;
                game.repeatTimer = 0;
                game.repeatFired = false;
            } else {
                game.repeatAction = null;
            }
        }
    };

    n3ds.bottom.onRelease = () => {
        activeBtn = null;
        game.repeatAction = null;
    };

    // ====== GAME LOOP ======
    n3ds.run((dt, time) => {
        layoutButtons();

        // === UPDATE ===
        if (game.state === 'playing') {
            // Clear animation
            if (game.clearAnim) {
                game.clearAnim.timer -= dt;
                if (game.clearAnim.timer <= 0) {
                    clearRows(game.clearAnim.rows);
                    game.clearAnim = null;
                    spawnPiece();
                }
            } else if (game.current) {
                // Auto drop
                game.dropTimer += dt;
                if (game.dropTimer >= game.dropInterval) {
                    game.dropTimer = 0;
                    if (isValid(game.current, game.current.x, game.current.y + 1)) {
                        game.current.y++;
                    } else {
                        // Lock delay
                        game.lockTimer += game.dropInterval;
                        if (game.lockTimer >= 0.5) {
                            lockPiece();
                        }
                    }
                }

                // Check if landed
                if (!isValid(game.current, game.current.x, game.current.y + 1)) {
                    game.lockTimer += dt;
                    if (game.lockTimer >= 0.5) {
                        lockPiece();
                    }
                } else {
                    game.lockTimer = 0;
                }
            }

            // Button repeat
            if (game.repeatAction) {
                game.repeatTimer += dt;
                const threshold = game.repeatFired ? game.repeatRate : game.repeatDelay;
                if (game.repeatTimer >= threshold) {
                    game.repeatAction();
                    game.repeatTimer = 0;
                    game.repeatFired = true;
                }
            }
        }

        // Particles
        for (let i = game.particles.length - 1; i >= 0; i--) {
            const p = game.particles[i];
            p.life -= dt;
            if (p.life <= 0) { game.particles.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 12 * dt;
        }

        // === DRAW TOP SCREEN (game board) ===
        drawTopScreen(time);

        // === DRAW BOTTOM SCREEN (controls) ===
        drawBottomScreen(time);
    });

    // ====== DRAW: TOP SCREEN ======
    function drawTopScreen(time) {
        const top = n3ds.top;
        const ctx = top.ctx;
        const w = top.width, h = top.height;

        // Background
        const hue = (time * 0.01) % 360;
        ctx.fillStyle = `hsl(${hue}, 30%, 8%)`;
        ctx.fillRect(0, 0, w, h);

        // Calculate board dimensions
        const cellSize = Math.floor(Math.min((h - 20) / ROWS, (w * 0.5) / COLS));
        const boardW = cellSize * COLS;
        const boardH = cellSize * ROWS;
        const boardX = Math.floor((w * 0.6 - boardW) / 2) + 10;
        const boardY = Math.floor((h - boardH) / 2);

        // Board background
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(boardX - 2, boardY - 2, boardW + 4, boardH + 4);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        for (let c = 0; c <= COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(boardX + c * cellSize, boardY);
            ctx.lineTo(boardX + c * cellSize, boardY + boardH);
            ctx.stroke();
        }
        for (let r = 0; r <= ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(boardX, boardY + r * cellSize);
            ctx.lineTo(boardX + boardW, boardY + r * cellSize);
            ctx.stroke();
        }

        // Clear animation flash
        if (game.clearAnim) {
            const flash = Math.sin(game.clearAnim.timer * 30) > 0;
            if (flash) {
                for (const row of game.clearAnim.rows) {
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.fillRect(boardX, boardY + row * cellSize, boardW, cellSize);
                }
            }
        }

        // Draw board cells
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const color = game.board[r][c];
                if (!color) continue;
                drawCell(ctx, boardX + c * cellSize, boardY + r * cellSize, cellSize, color);
            }
        }

        // Ghost piece
        if (game.current && game.state === 'playing') {
            const ghostY = getGhostY();
            if (ghostY !== game.current.y) {
                ctx.globalAlpha = 0.25;
                for (const [bx, by] of game.current.blocks) {
                    const x = boardX + (game.current.x + bx) * cellSize;
                    const y = boardY + (ghostY + by) * cellSize;
                    drawCell(ctx, x, y, cellSize, game.current.color);
                }
                ctx.globalAlpha = 1;
            }
        }

        // Current piece
        if (game.current && game.state !== 'gameover') {
            for (const [bx, by] of game.current.blocks) {
                const x = boardX + (game.current.x + bx) * cellSize;
                const y = boardY + (game.current.y + by) * cellSize;
                if (game.current.y + by >= 0) {
                    drawCell(ctx, x, y, cellSize, game.current.color);
                }
            }
        }

        // Particles
        for (const p of game.particles) {
            ctx.globalAlpha = p.life / 0.8;
            ctx.fillStyle = p.color;
            const px = boardX + p.x * cellSize + cellSize / 2;
            const py = boardY + p.y * cellSize + cellSize / 2;
            ctx.fillRect(px - 2, py - 2, 4, 4);
        }
        ctx.globalAlpha = 1;

        // Board border
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(boardX - 2, boardY - 2, boardW + 4, boardH + 4);

        // === Right panel: Score, Next, Hold ===
        const panelX = boardX + boardW + 20;
        const panelW = w - panelX - 10;

        // Score
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('SCORE', panelX, boardY + 15);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(String(game.score).padStart(8, '0'), panelX, boardY + 40);

        // Level
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.fillText('LEVEL', panelX, boardY + 65);
        ctx.fillStyle = '#4ecdc4';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(String(game.level), panelX, boardY + 88);

        // Lines
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.fillText('LINES', panelX + 60, boardY + 65);
        ctx.fillStyle = '#ffe66d';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(String(game.lines), panelX + 60, boardY + 88);

        // Next piece
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.fillText('NEXT', panelX, boardY + 120);
        if (game.next) {
            drawMiniPiece(ctx, panelX + 5, boardY + 130, cellSize * 0.7, game.next);
        }

        // Hold piece
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.fillText('HOLD', panelX, boardY + 210);
        if (game.held) {
            const holdPc = createPiece(game.held);
            ctx.globalAlpha = game.canHold ? 1 : 0.4;
            drawMiniPiece(ctx, panelX + 5, boardY + 220, cellSize * 0.7, holdPc);
            ctx.globalAlpha = 1;
        }

        // Combo
        if (game.combo > 0) {
            ctx.fillStyle = game.combo >= 3 ? '#ff6b6b' : '#ffe66d';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`🔥 ${game.combo} COMBO`, panelX, boardY + 310);
        }

        // Game Over overlay
        if (game.state === 'gameover') {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 42px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', w / 2, h / 2 - 30);
            ctx.fillStyle = '#fff';
            ctx.font = '22px Arial';
            ctx.fillText(`Score: ${game.score}`, w / 2, h / 2 + 10);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '16px Arial';
            ctx.fillText('Chạm màn dưới để chơi lại', w / 2, h / 2 + 50);
        }

        // Paused
        if (game.state === 'paused') {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⏸ PAUSED', w / 2, h / 2);
            ctx.font = '16px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText('Chạm màn dưới để tiếp tục', w / 2, h / 2 + 35);
        }
    }

    function drawCell(ctx, x, y, size, color) {
        const s = size - 1;
        // Main
        ctx.fillStyle = color;
        ctx.fillRect(x + 0.5, y + 0.5, s, s);
        // Highlight (top-left)
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + 0.5, y + 0.5, s, 2);
        ctx.fillRect(x + 0.5, y + 0.5, 2, s);
        // Shadow (bottom-right)
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 0.5, y + s - 1.5, s, 2);
        ctx.fillRect(x + s - 1.5, y + 0.5, 2, s);
    }

    function drawMiniPiece(ctx, x, y, cellSize, piece) {
        for (const [bx, by] of piece.blocks) {
            drawCell(ctx, x + bx * cellSize, y + by * cellSize, cellSize, piece.color);
        }
    }

    // ====== DRAW: BOTTOM SCREEN ======
    function drawBottomScreen(time) {
        const bot = n3ds.bottom;
        const ctx = bot.ctx;
        const w = bot.width, h = bot.height;

        // BG
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, '#0a0a1a');
        bg.addColorStop(1, '#151530');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Subtle pattern
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

        if (game.state === 'gameover') {
            bot.drawText('GAME OVER', h / 2 - 30, { color: '#ff4444', font: 'bold 32px Arial' });
            bot.drawText(`Score: ${game.score}  |  Lines: ${game.lines}`, h / 2 + 10, { font: '18px Arial' });
            bot.drawText('Chạm để chơi lại', h / 2 + 50, { color: 'rgba(255,255,255,0.4)', font: '14px Arial' });
            return;
        }

        if (game.state === 'paused') {
            bot.drawText('⏸ PAUSED', h / 2, { font: 'bold 28px Arial' });
            bot.drawText('Chạm để tiếp tục', h / 2 + 35, { color: 'rgba(255,255,255,0.4)', font: '14px Arial' });
            return;
        }

        // Title bar
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, 0, w, 35);
        bot.drawText('🎮 CONTROLS', 18, { color: 'rgba(255,255,255,0.5)', font: 'bold 13px Arial' });

        // Draw buttons
        for (const btn of buttons) {
            const isActive = (btn === activeBtn);

            // Button bg
            ctx.fillStyle = isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)';
            const radius = 8;
            roundRect(ctx, btn.x, btn.y, btn.w, btn.h, radius);
            ctx.fill();

            // Button border
            ctx.strokeStyle = isActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, btn.x, btn.y, btn.w, btn.h, radius);
            ctx.stroke();

            // Label
            ctx.fillStyle = isActive ? '#fff' : 'rgba(255,255,255,0.7)';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
        }
        ctx.textBaseline = 'alphabetic';

        // Info area (middle)
        const infoY = 45;
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';

        // Quick stats
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '13px Arial';
        ctx.fillText(`Score: ${game.score}  |  Lv.${game.level}  |  Lines: ${game.lines}`, w / 2, infoY + 10);

        // Keyboard hint
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '11px Arial';
        ctx.fillText('⌨ ←→↓ Move  |  ↑ Rotate  |  Space Drop  |  C Hold  |  P Pause', w / 2, infoY + 30);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}
