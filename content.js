class AutoScroller {
    #isScrolling = false;
    #isDelaying = false;
    #speed = 5;
    #direction = 'down';
    #animationId = null;
    #lastTimestamp = 0;
    #resizeObserver = null;

    constructor() {
        this.#setupMessageListener();
        this.#setupResizeObserver();
    }

    #setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sendResponse) => {
            const actions = {
                startScroll: async () => {
                    await this.#startScroll(request.speed, request.direction, request.delay);
                    return { success: true };
                },
                stopScroll: () => {
                    this.#stopScroll();
                    return { success: true };
                },
                getStatus: () => ({
                    isScrolling: this.#isScrolling || this.#isDelaying,
                    direction: this.#direction,
                    speed: this.#speed
                })
            };

            const result = actions[request.action]?.();
            if (result) {
                sendResponse(result);
            }
        });
    }

    #setupResizeObserver() {
        this.#resizeObserver = new ResizeObserver(() => {
            if (this.#isScrolling && this.#isAtBoundary()) {
                this.#stopScroll();
            }
        });
        this.#resizeObserver.observe(document.documentElement);
    }

    async #startScroll(speed, direction, delay = 0) {
        this.#stopScroll();

        this.#speed = speed;
        this.#direction = direction;
        this.#isDelaying = true;

        if (delay > 0) {
            await this.#countdown(delay);
        }

        if (!this.#isDelaying) return;

        this.#isDelaying = false;
        this.#isScrolling = true;
        this.#lastTimestamp = performance.now();
        this.#scroll();
    }

    #stopScroll() {
        this.#isScrolling = false;
        this.#isDelaying = false;

        if (this.#animationId) {
            cancelAnimationFrame(this.#animationId);
            this.#animationId = null;
        }
    }

    #scroll() {
        if (!this.#isScrolling) return;

        const currentTimestamp = performance.now();
        const deltaTime = currentTimestamp - this.#lastTimestamp;

        if (deltaTime >= 16) {
            const scrollStep = this.#speed * (deltaTime / 16);

            if (!this.#performScroll(scrollStep)) {
                this.#stopScroll();
                return;
            }

            this.#lastTimestamp = currentTimestamp;
        }

        this.#animationId = requestAnimationFrame(() => this.#scroll());
    }

    #performScroll(scrollStep) {
        const { x: currentX, y: currentY } = this.#getCurrentScroll();
        const { width: docWidth, height: docHeight } = this.#getDocumentSize();
        const { width: viewWidth, height: viewHeight } = this.#getViewportSize();

        let newX = currentX;
        let newY = currentY;

        const directions = {
            down: () => {
                newY = currentY + scrollStep;
                return newY < docHeight - viewHeight;
            },
            up: () => {
                newY = currentY - scrollStep;
                return newY > 0;
            },
            right: () => {
                newX = currentX + scrollStep;
                return newX < docWidth - viewWidth;
            },
            left: () => {
                newX = currentX - scrollStep;
                return newX > 0;
            }
        };

        const canContinue = directions[this.#direction]?.();

        if (canContinue) {
            window.scrollTo({
                left: Math.max(0, newX),
                top: Math.max(0, newY),
                behavior: 'instant'
            });
            return true;
        }

        return false;
    }

    #getCurrentScroll() {
        return {
            x: window.scrollX,
            y: window.scrollY
        };
    }

    #getDocumentSize() {
        return {
            width: Math.max(
                document.body.scrollWidth,
                document.body.offsetWidth,
                document.documentElement.clientWidth,
                document.documentElement.scrollWidth,
                document.documentElement.offsetWidth
            ),
            height: Math.max(
                document.body.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.clientHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
            )
        };
    }

    #getViewportSize() {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }

    #isAtBoundary() {
        const { x: currentX, y: currentY } = this.#getCurrentScroll();
        const { width: docWidth, height: docHeight } = this.#getDocumentSize();
        const { width: viewWidth, height: viewHeight } = this.#getViewportSize();

        const boundaries = {
            down: currentY >= docHeight - viewHeight - 1,
            up: currentY <= 1,
            right: currentX >= docWidth - viewWidth - 1,
            left: currentX <= 1
        };

        return boundaries[this.#direction] ?? false;
    }

    async #countdown(seconds) {
        for (let i = seconds; i > 0; i--) {
            if (!this.#isDelaying) return;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    destroy() {
        this.#stopScroll();
        this.#resizeObserver?.disconnect();
    }
}

const autoScroller = new AutoScroller();

window.addEventListener('beforeunload', () => {
    autoScroller.destroy();
}, { once: true }); 