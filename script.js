class TimerApp {
	constructor() {
		this.elements = {
			minutes: document.getElementById('minutes'),
			seconds: document.getElementById('seconds'),
			startPauseBtn: document.getElementById('startPauseBtn'),
			resetBtn: document.getElementById('resetBtn'),
			minusBtn: document.getElementById('minusBtn'),
			plusBtn: document.getElementById('plusBtn'),
			tickToggle: document.getElementById('tickToggle'),
			presetButtons: Array.from(document.querySelectorAll('[data-preset]')),
			progressRing: document.querySelector('.ring__progress'),
			confettiCanvas: document.getElementById('confettiCanvas'),
			brandTop: document.getElementById('brandTop'),
			brandBottom: document.getElementById('brandBottom'),
			editTitleBtn: document.getElementById('editTitleBtn')
		};

		this.config = {
			radius: 52,
			circumference: 2 * Math.PI * 52,
			defaultMinutes: 25,
			soothingInterval: 5
		};

		this.state = {
			totalSeconds: this.config.defaultMinutes * 60,
			remainingSeconds: this.config.defaultMinutes * 60,
			isRunning: false,
			lastTickTimestamp: null,
			lastSoothingAt: 0,
			isEditingTitle: false
		};

		this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		this.confettiPieces = [];
		this.confettiCtx = this.elements.confettiCanvas.getContext('2d');

		this.init();
	}

	init() {
		this.setupProgressRing();
		this.setupEventListeners();
		this.setupConfetti();
		this.restoreState();
		this.updateDisplay();
		this.updateProgressRing();
	}

	setupProgressRing() {
		this.elements.progressRing.style.strokeDasharray = `${this.config.circumference} ${this.config.circumference}`;
		this.elements.progressRing.style.strokeDashoffset = '0';
	}

	setupEventListeners() {
		this.elements.startPauseBtn.addEventListener('click', () => this.toggleTimer());
		this.elements.resetBtn.addEventListener('click', () => this.reset());
		this.elements.minusBtn.addEventListener('click', () => this.adjustTime(-1));
		this.elements.plusBtn.addEventListener('click', () => this.adjustTime(1));

		this.elements.presetButtons.forEach(btn => {
			btn.addEventListener('click', () => {
				const minutes = parseInt(btn.getAttribute('data-preset') || '0', 10);
				this.setTotalMinutes(minutes);
				this.pause();
			});
		});

		this.elements.editTitleBtn.addEventListener('click', () => this.toggleTitleEditing());
		this.elements.brandTop.addEventListener('keydown', (e) => this.handleTitleKeydown(e, 'brandTop'));
		this.elements.brandBottom.addEventListener('keydown', (e) => this.handleTitleKeydown(e, 'brandBottom'));

		document.addEventListener('keydown', (e) => this.handleKeyboard(e));

		['click', 'change', 'input', 'blur'].forEach(eventType => {
			document.addEventListener(eventType, (e) => this.handlePersistence(e), { capture: true });
		});

		window.addEventListener('resize', () => this.resizeConfettiCanvas());
	}

	playSoothing() {
		const now = this.audioCtx.currentTime;
		const gain = this.audioCtx.createGain();
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
		gain.connect(this.audioCtx.destination);

		const osc1 = this.audioCtx.createOscillator();
		osc1.type = 'sine';
		osc1.frequency.setValueAtTime(660, now);
		osc1.frequency.exponentialRampToValueAtTime(880, now + 0.4);
		osc1.connect(gain);
		osc1.start(now);
		osc1.stop(now + 0.6);

		const osc2 = this.audioCtx.createOscillator();
		osc2.type = 'sine';
		osc2.frequency.setValueAtTime(990, now);
		osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.4);
		
		const gain2 = this.audioCtx.createGain();
		gain2.gain.setValueAtTime(0, now);
		gain2.gain.linearRampToValueAtTime(0.03, now + 0.02);
		gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
		osc2.connect(gain2).connect(this.audioCtx.destination);
		osc2.start(now + 0.02);
		osc2.stop(now + 0.62);
	}

	playDone() {
		const now = this.audioCtx.currentTime;
		const gain = this.audioCtx.createGain();
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
		gain.connect(this.audioCtx.destination);

		const osc = this.audioCtx.createOscillator();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(660, now);
		osc.frequency.linearRampToValueAtTime(440, now + 0.5);
		osc.connect(gain);
		osc.start(now);
		osc.stop(now + 0.8);
	}

	updateDisplay() {
		const minutes = Math.floor(this.state.remainingSeconds / 60);
		const seconds = Math.floor(this.state.remainingSeconds % 60);
		this.elements.minutes.textContent = String(minutes).padStart(2, '0');
		this.elements.seconds.textContent = String(seconds).padStart(2, '0');
	}

	updateProgressRing() {
		const elapsed = this.state.totalSeconds - this.state.remainingSeconds;
		const percentage = this.state.totalSeconds > 0 ? (elapsed / this.state.totalSeconds) : 0;
		const offset = this.config.circumference - percentage * this.config.circumference;
		this.elements.progressRing.style.strokeDashoffset = String(offset);
		this.elements.progressRing.style.stroke = 'url(#ringGradient)';
	}

	setTotalMinutes(minutes) {
		this.state.totalSeconds = Math.max(0, Math.floor(minutes * 60));
		this.state.remainingSeconds = this.state.totalSeconds;
		this.updateDisplay();
		this.updateProgressRing();
	}

	adjustTime(minutes) {
		this.setTotalMinutes((this.state.totalSeconds / 60) + minutes);
	}

	reset() {
		this.state.isRunning = false;
		this.state.remainingSeconds = this.state.totalSeconds;
		this.updateDisplay();
		this.updateProgressRing();
		this.elements.startPauseBtn.textContent = 'Start';
		this.elements.startPauseBtn.setAttribute('aria-pressed', 'false');
	}

	toggleTimer() {
		if (this.state.isRunning) {
			this.pause();
		} else {
			this.start();
		}
	}

	start() {
		if (this.state.remainingSeconds <= 0) return;
		
		if (this.audioCtx.state === 'suspended') {
			this.audioCtx.resume();
		}
		
		this.state.isRunning = true;
		this.elements.startPauseBtn.textContent = 'Pause';
		this.elements.startPauseBtn.setAttribute('aria-pressed', 'true');
		this.state.lastTickTimestamp = null;
		this.state.lastSoothingAt = Math.floor(this.state.totalSeconds - this.state.remainingSeconds);
		requestAnimationFrame((timestamp) => this.timerStep(timestamp));
	}

	pause() {
		this.state.isRunning = false;
		this.elements.startPauseBtn.textContent = 'Start';
		this.elements.startPauseBtn.setAttribute('aria-pressed', 'false');
	}

	timerStep(timestamp) {
		if (!this.state.isRunning) return;
		
		if (this.state.lastTickTimestamp === null) {
			this.state.lastTickTimestamp = timestamp;
			requestAnimationFrame((ts) => this.timerStep(ts));
			return;
		}

		const delta = (timestamp - this.state.lastTickTimestamp) / 1000;
		this.state.lastTickTimestamp = timestamp;

		if (this.state.remainingSeconds > 0) {
			this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - delta);
			
			if (this.elements.tickToggle.checked) {
				const elapsed = Math.floor(this.state.totalSeconds - this.state.remainingSeconds);
				if (elapsed - this.state.lastSoothingAt >= this.config.soothingInterval) {
					if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
					this.playSoothing();
					this.state.lastSoothingAt = elapsed;
				}
			}
			
			this.updateDisplay();
			this.updateProgressRing();
			requestAnimationFrame((ts) => this.timerStep(ts));
		} else {
			this.completeTimer();
		}
	}

	completeTimer() {
		this.state.isRunning = false;
		this.elements.startPauseBtn.textContent = 'Start';
		this.elements.startPauseBtn.setAttribute('aria-pressed', 'false');
		this.fireConfetti();
		
		if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
		this.playDone();
	}

	toggleTitleEditing() {
		this.state.isEditingTitle = !this.state.isEditingTitle;
		this.elements.brandTop.contentEditable = String(this.state.isEditingTitle);
		this.elements.brandBottom.contentEditable = String(this.state.isEditingTitle);
		this.elements.brandTop.setAttribute('aria-live', 'polite');
		this.elements.brandBottom.setAttribute('aria-live', 'polite');
		this.elements.editTitleBtn.textContent = this.state.isEditingTitle ? 'Save title' : 'Edit title';
		this.elements.editTitleBtn.setAttribute('aria-pressed', String(this.state.isEditingTitle));
		
		if (!this.state.isEditingTitle) {
			this.persistState();
		}
	}

	handleTitleKeydown(event, element) {
		if (this.state.isEditingTitle && event.key === 'Enter') {
			event.preventDefault();
			this.toggleTitleEditing();
		}
	}

	handleKeyboard(event) {
		if (['INPUT', 'TEXTAREA'].includes((event.target && event.target.tagName) || '')) {
			return;
		}

		switch (event.code) {
			case 'Space':
				event.preventDefault();
				this.toggleTimer();
				break;
		}

		switch (event.key.toLowerCase()) {
			case 'r':
				this.reset();
				break;
			case 'arrowup':
				this.adjustTime(1);
				break;
			case 'arrowdown':
				this.adjustTime(-1);
				break;
			case '1':
				this.setTotalMinutes(10);
				this.pause();
				break;
			case '5':
				this.setTotalMinutes(50);
				this.pause();
				break;
			case '0':
				this.setTotalMinutes(25);
				this.pause();
				break;
		}
	}

	restoreState() {
		try {
			const saved = JSON.parse(localStorage.getItem('cfgTimer') || '{}');
			
			if (typeof saved.totalSeconds === 'number') {
				this.state.totalSeconds = Math.max(0, Math.floor(saved.totalSeconds));
				this.state.remainingSeconds = this.state.totalSeconds;
			}
			
			if (typeof saved.tick === 'boolean') {
				this.elements.tickToggle.checked = saved.tick;
			}
			
			if (typeof saved.brandTop === 'string') {
				this.elements.brandTop.textContent = saved.brandTop;
			}
			
			if (typeof saved.brandBottom === 'string') {
				this.elements.brandBottom.textContent = saved.brandBottom;
			}
		} catch (error) {
			console.warn('Failed to restore state:', error);
		}
	}

	persistState() {
		try {
			const saved = JSON.parse(localStorage.getItem('cfgTimer') || '{}');
			const stateToSave = {
				...saved,
				totalSeconds: this.state.totalSeconds,
				tick: !!this.elements.tickToggle.checked,
				brandTop: this.elements.brandTop.textContent.trim(),
				brandBottom: this.elements.brandBottom.textContent.trim()
			};
			localStorage.setItem('cfgTimer', JSON.stringify(stateToSave));
		} catch (error) {
			console.warn('Failed to persist state:', error);
		}
	}

	handlePersistence(event) {
		if (event.target === this.elements.brandTop || event.target === this.elements.brandBottom) {
			this.persistState();
		} else if (event.type !== 'input') {
			this.persistState();
		}
	}

	setupConfetti() {
		this.resizeConfettiCanvas();
	}

	fireConfetti() {
		this.resizeConfettiCanvas();
		this.confettiPieces = this.createConfettiPieces(180);
		let startTimestamp;
		
		const animateConfetti = (timestamp) => {
			if (!startTimestamp) startTimestamp = timestamp;
			const elapsed = (timestamp - startTimestamp) / 1000;
			
			this.updateConfettiPieces(elapsed);
			this.renderConfettiPieces();
			
			if (elapsed < 3) {
				requestAnimationFrame(animateConfetti);
			}
		};
		
		requestAnimationFrame(animateConfetti);
	}

	createConfettiPieces(count) {
		const colors = ['#ff4ea1', '#ff7ac0', '#7c3aed', '#facc15', '#34d399'];
		const pieces = [];
		
		for (let i = 0; i < count; i++) {
			pieces.push({
				x: Math.random() * this.elements.confettiCanvas.width,
				y: -20 - Math.random() * 60,
				radius: 4 + Math.random() * 5,
				velocityX: -100 + Math.random() * 200,
				velocityY: 80 + Math.random() * 120,
				rotation: Math.random() * Math.PI * 2,
				rotationSpeed: -6 + Math.random() * 12,
				color: colors[Math.floor(Math.random() * colors.length)],
				shape: Math.random() < 0.5 ? 'rect' : 'circle'
			});
		}
		
		return pieces;
	}

	updateConfettiPieces(deltaTime) {
		const gravity = 120;
		const timeStep = 0.016;
		
		for (const piece of this.confettiPieces) {
			piece.velocityY += gravity * timeStep;
			piece.x += piece.velocityX * timeStep;
			piece.y += piece.velocityY * timeStep;
			piece.rotation += piece.rotationSpeed * timeStep;
			
			if (piece.y > this.elements.confettiCanvas.height + 20) {
				piece.y = -10;
				piece.velocityY *= -0.2;
			}
		}
	}

	renderConfettiPieces() {
		this.confettiCtx.clearRect(0, 0, this.elements.confettiCanvas.width, this.elements.confettiCanvas.height);
		
		for (const piece of this.confettiPieces) {
			this.confettiCtx.save();
			this.confettiCtx.translate(piece.x, piece.y);
			this.confettiCtx.rotate(piece.rotation);
			this.confettiCtx.fillStyle = piece.color;
			
			if (piece.shape === 'rect') {
				this.confettiCtx.fillRect(-piece.radius, -piece.radius, piece.radius * 2, piece.radius * 2);
			} else {
				this.confettiCtx.beginPath();
				this.confettiCtx.arc(0, 0, piece.radius, 0, Math.PI * 2);
				this.confettiCtx.fill();
			}
			
			this.confettiCtx.restore();
		}
	}

	resizeConfettiCanvas() {
		this.elements.confettiCanvas.width = window.innerWidth;
		this.elements.confettiCanvas.height = window.innerHeight;
	}
}

document.addEventListener('DOMContentLoaded', () => {
	new TimerApp();
});
