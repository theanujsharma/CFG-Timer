# CFGDegree Class Timer

A fun and minimal class timer with animated progress ring, keyboard shortcuts, confetti celebration, and subtle sounds.

## Run

Just open `index.html` in your browser. No build step, no dependencies.

## Features

- Animated circular progress ring with gradient glow
- Preset buttons: 5, 10, 15, 25, 45 minutes
- Start/Pause, Reset, ±1 minute
- Keyboard shortcuts: Space (start/pause), R (reset), ↑/↓ (±1m), 1/5/0 (10/50/25)
- Optional ticking sound during countdown; pleasant chime at completion
- Confetti celebration on finish
- Saves last duration and tick preference in `localStorage`

## Customize

- Default duration: change the `totalSeconds` initial value in `script.js`
- Colors: tweak CSS variables in `style.css` under `:root`
- Preset chips: edit the buttons with `data-preset` in `index.html`

## Credits

Built for the CFG classes.
