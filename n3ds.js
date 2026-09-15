/**
 * N3DS - Framework mô phỏng Nintendo 3DS với 2 màn hình
 * 
 * Cách dùng:
 * 
 *   const n3ds = new N3DS({ bg: 'test.png' });
 * 
 *   // Vẽ lên màn trên
 *   n3ds.top.clear('#000');
 *   n3ds.top.ctx.fillStyle = 'red';
 *   n3ds.top.ctx.fillRect(10, 10, 100, 50);
 * 
 *   // Lắng nghe touch trên màn dưới
 *   n3ds.bottom.onTap = (x, y) => console.log('Chạm tại', x, y);
 * 
 *   // Game loop
 *   n3ds.run((dt, time) => {
 *       n3ds.top.clear();
 *       n3ds.bottom.clear('#1a1a2e');
 *       // vẽ gì đó...
 *   });
 */

class N3DSScreen {
    /**
     * @param {string} id - CSS selector cho canvas
     */
    constructor(id) {
        /** @type {HTMLCanvasElement} */
        this.canvas = document.querySelector(id);
        /** @type {CanvasRenderingContext2D} */
        this.ctx = this.canvas.getContext('2d');

        // Event callbacks - gán để dùng
        /** @type {(x: number, y: number) => void} */
        this.onTap = null;
        /** @type {(x: number, y: number) => void} */
        this.onMove = null;
        /** @type {(x: number, y: number) => void} */
        this.onRelease = null;

        // Internal
        this._pressed = false;

        // Bind events
        this._bindEvents();
    }

    /** Chiều rộng canvas (pixels) */
    get width() { return this.canvas.width; }

    /** Chiều cao canvas (pixels) */
    get height() { return this.canvas.height; }

    /**
     * Xóa toàn bộ màn hình
     * @param {string} [color] - Nếu truyền vào sẽ fill màu nền
     */
    clear(color) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        if (color) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
    }

    /**
     * Vẽ text căn giữa màn hình
     * @param {string} text
     * @param {number} y - Vị trí y
     * @param {object} [opts] - { color, font, align }
     */
    drawText(text, y, opts = {}) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = opts.color || '#ffffff';
        ctx.font = opts.font || '20px Arial';
        ctx.textAlign = opts.align || 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, opts.align === 'left' ? 10 : this.width / 2, y);
        ctx.restore();
    }

    /**
     * Vẽ hình tròn
     * @param {number} x
     * @param {number} y
     * @param {number} r - Bán kính
     * @param {string} color
     */
    drawCircle(x, y, r, color) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    /**
     * Vẽ hình chữ nhật
     */
    drawRect(x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, w, h);
    }

    /**
     * Vẽ ảnh lên canvas
     * @param {HTMLImageElement} img
     * @param {number} x
     * @param {number} y
     * @param {number} [w]
     * @param {number} [h]
     */
    drawImage(img, x, y, w, h) {
        if (w !== undefined && h !== undefined) {
            this.ctx.drawImage(img, x, y, w, h);
        } else {
            this.ctx.drawImage(img, x, y);
        }
    }

    // === Internal ===

    _getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }

    _bindEvents() {
        const c = this.canvas;

        // Touch
        c.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this._pressed = true;
            const p = this._getPos(e);
            if (this.onTap) this.onTap(p.x, p.y);
        }, { passive: false });

        c.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this._pressed) return;
            const p = this._getPos(e);
            if (this.onMove) this.onMove(p.x, p.y);
        }, { passive: false });

        c.addEventListener('touchend', (e) => {
            e.preventDefault();
            this._pressed = false;
            if (this.onRelease) this.onRelease();
        }, { passive: false });

        // Mouse
        c.addEventListener('mousedown', (e) => {
            this._pressed = true;
            const p = this._getPos(e);
            if (this.onTap) this.onTap(p.x, p.y);
        });

        c.addEventListener('mousemove', (e) => {
            if (!this._pressed) return;
            const p = this._getPos(e);
            if (this.onMove) this.onMove(p.x, p.y);
        });

        c.addEventListener('mouseup', () => {
            this._pressed = false;
            if (this.onRelease) this.onRelease();
        });

        c.addEventListener('mouseleave', () => {
            if (this._pressed) {
                this._pressed = false;
                if (this.onRelease) this.onRelease();
            }
        });
    }
}

class N3DS {
    /**
     * @param {object} opts
     * @param {string} opts.bg - Đường dẫn ảnh nền 3DS
     * @param {string} [opts.container='#n3ds'] - CSS selector cho container
     */
    constructor(opts = {}) {
        const bgSrc = opts.bg || 'test.png';
        const containerSel = opts.container || '#n3ds';

        // Kích thước gốc của ảnh nền & vị trí 2 màn hình (pixels trên ảnh gốc)
        this._bgNative = { w: 1254, h: 1254 };
        this._screenDefs = {
            top:    { x: 250, y: 100, w: 755, h: 455 },
            bottom: { x: 326, y: 690, w: 604, h: 455 },
        };

        // DOM
        this._container = document.querySelector(containerSel);
        this._bgImg = this._container.querySelector('.bg');

        // Screens
        /** @type {N3DSScreen} Màn hình trên (chỉ hiển thị) */
        this.top = new N3DSScreen('#screen-top');

        /** @type {N3DSScreen} Màn hình dưới (touch) */
        this.bottom = new N3DSScreen('#screen-bottom');
        this.bottom.canvas.style.cursor = 'pointer';

        // Layout
        this._layout();
        this._bgImg.addEventListener('load', () => this._layout());
        window.addEventListener('resize', () => this._layout());

        // Loop
        this._loopFn = null;
        this._lastTime = 0;
    }

    /**
     * Bắt đầu game loop
     * @param {(dt: number, time: number) => void} fn
     *   - dt: delta time (giây) từ frame trước
     *   - time: tổng thời gian (ms) từ lúc bắt đầu
     */
    run(fn) {
        this._loopFn = fn;
        this._lastTime = 0;
        const loop = (time) => {
            const dt = this._lastTime ? Math.min((time - this._lastTime) / 1000, 0.1) : 0;
            this._lastTime = time;
            this._loopFn(dt, time);
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    // === Internal ===

    _layout() {
        const imgW = this._bgImg.clientWidth;
        const imgH = this._bgImg.clientHeight;
        if (!imgW || !imgH) return;

        for (const key of ['top', 'bottom']) {
            const def = this._screenDefs[key];
            const canvas = this[key].canvas;

            const cx = Math.round((def.x / this._bgNative.w) * imgW);
            const cy = Math.round((def.y / this._bgNative.h) * imgH);
            const cw = Math.round((def.w / this._bgNative.w) * imgW);
            const ch = Math.round((def.h / this._bgNative.h) * imgH);

            canvas.style.left = cx + 'px';
            canvas.style.top = cy + 'px';
            canvas.width = cw;
            canvas.height = ch;
            canvas.style.width = cw + 'px';
            canvas.style.height = ch + 'px';
        }
    }
}

