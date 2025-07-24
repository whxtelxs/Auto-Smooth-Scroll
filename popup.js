class ScrollExtensionPopup {
    #elements = {};
    #state = {
        currentDirection: 'down',
        isScrolling: false
    };

    async init() {
        this.#cacheElements();
        await this.#loadSettings();
        this.#bindEvents();
        await this.#checkCurrentStatus();
    }

    #cacheElements() {
        this.#elements = {
            speedSlider: document.getElementById('speedSlider'),
            speedValue: document.getElementById('speedValue'),
            delaySlider: document.getElementById('delaySlider'),
            delayValue: document.getElementById('delayValue'),
            directionBtns: document.querySelectorAll('.direction-btn'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            status: document.getElementById('status')
        };
    }

    #bindEvents() {
        this.#elements.speedSlider.addEventListener('input', this.#handleSpeedChange.bind(this));
        this.#elements.delaySlider.addEventListener('input', this.#handleDelayChange.bind(this));
        this.#elements.directionBtns.forEach(btn =>
            btn.addEventListener('click', this.#handleDirectionChange.bind(this))
        );
        this.#elements.startBtn.addEventListener('click', this.#handleStart.bind(this));
        this.#elements.stopBtn.addEventListener('click', this.#handleStop.bind(this));
    }

    #handleSpeedChange(e) {
        this.#elements.speedValue.textContent = e.target.value;
        this.#saveSettings();
    }

    #handleDelayChange(e) {
        const value = e.target.value;
        this.#elements.delayValue.textContent = value === '0' ? 'Без' : `${value}с`;
        this.#saveSettings();
    }

    #handleDirectionChange(e) {
        const btn = e.currentTarget;
        this.#elements.directionBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.#state.currentDirection = btn.dataset.direction;
        this.#saveSettings();
    }

    async #handleStart() {
        const speed = parseInt(this.#elements.speedSlider.value, 10);
        const delay = parseInt(this.#elements.delaySlider.value, 10);

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab?.id) {
                throw new Error('Активная вкладка не найдена');
            }

            this.#state.isScrolling = true;
            this.#updateUI();

            await chrome.tabs.sendMessage(tab.id, {
                action: 'startScroll',
                speed,
                direction: this.#state.currentDirection,
                delay
            });

            this.#updateStatus(`Скролл запущен (${this.#getDirectionText(this.#state.currentDirection)})`);
        } catch (error) {
            this.#state.isScrolling = false;
            this.#updateUI();
            this.#updateStatus('Ошибка: перезагрузите страницу');
        }
    }

    async #handleStop() {
        this.#state.isScrolling = false;
        this.#updateUI();

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (tab?.id) {
                await chrome.tabs.sendMessage(tab.id, { action: 'stopScroll' });
            }

            this.#updateStatus('Скролл остановлен');
        } catch (error) {
            this.#updateStatus('Скролл остановлен');
        }
    }

    async #loadSettings() {
        try {
            const { speed = 5, direction = 'down', delay = 0 } = await chrome.storage.local.get(['speed', 'direction', 'delay']);

            this.#elements.speedSlider.value = speed;
            this.#elements.speedValue.textContent = speed;
            this.#elements.delaySlider.value = delay;
            this.#elements.delayValue.textContent = delay === 0 ? 'Без' : `${delay}с`;
            this.#state.currentDirection = direction;

            this.#elements.directionBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.direction === direction);
            });
        } catch (error) {
            console.info('Использованы настройки по умолчанию');
        }
    }

    async #saveSettings() {
        try {
            await chrome.storage.local.set({
                speed: parseInt(this.#elements.speedSlider.value, 10),
                delay: parseInt(this.#elements.delaySlider.value, 10),
                direction: this.#state.currentDirection
            });
        } catch (error) {
            console.warn('Не удалось сохранить настройки:', error);
        }
    }

    #updateUI() {
        this.#elements.startBtn.disabled = this.#state.isScrolling;
        this.#elements.stopBtn.disabled = !this.#state.isScrolling;
    }

    #updateStatus(message) {
        this.#elements.status.textContent = message;
    }

    #getDirectionText(direction) {
        const directions = new Map([
            ['up', 'вверх'],
            ['down', 'вниз'],
            ['left', 'влево'],
            ['right', 'вправо']
        ]);
        return directions.get(direction) ?? direction;
    }

    async #checkCurrentStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab?.id) return;

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });

            if (response?.isScrolling) {
                this.#state.isScrolling = true;
                this.#updateUI();
                this.#updateStatus(`Скролл активен (${this.#getDirectionText(response.direction)})`);
            }
        } catch (error) {
            console.info('Статус скролла не получен');
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const popup = new ScrollExtensionPopup();
    await popup.init();
}); 