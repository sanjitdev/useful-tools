# Handy Tools

A collection of 34 small, useful everyday tools — age calculator, unit converter, password generator, QR code generator, Bangladesh income tax calculator, space calculator, animal race, lifespan simulator, and more. **Zero dependencies, fully offline, hosted on GitHub Pages.**

## What's inside

**Date & Time**
- Age Calculator
- Date Difference
- Stopwatch & Timer
- Pomodoro Timer
- Countdown to Date
- World Clock

**Converters & Calculators**
- Unit Converter
- Tip Calculator
- Percentage Calculator
- Grade Calculator
- Compound Interest
- Loan Calculator
- Bangladesh Tax Calculator (AY 2026-27, bilingual EN/BN)

**Health & Body**
- Lifespan Simulator (statistical lifespan estimate from lifestyle, health, and habits)
- BMI Calculator
- Calorie Estimator

**Text & Writing**
- Word & Character Counter
- Lorem Ipsum Generator
- Markdown Previewer
- JSON Formatter
- GPA Calculator

**Generators**
- Random Tools (number / password / dice / coin)
- Password Strength Checker
- QR Code Generator

**Colors**
- Color Tools (HEX / RGB / HSL picker)

**Planning & Decisions**
- Decision Wheel
- Pros & Cons
- Eisenhower Matrix

**Productivity**
- Habit Tracker

**Fun & Curious**
- Space Calculator (age, weight, jump, free-fall on every planet)
- Animal Race (frame-perfect 100 m race with a custom human runner)

**Developer**
- Base64 Codec
- URL Codec
- Regex Tester

## Running locally

No build step. Just open `index.html` in a browser, or run a static server:

```bash
python -m http.server 8080
# then open http://localhost:8080
```

## Deploying to GitHub Pages

1. Push the repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch** → `main` → `/ (root)`.
4. (Optional) The included `.github/workflows/pages.yml` can auto-deploy on push.

## Project structure

```
useful-tools/
├── index.html              # Home page — grid of tools, grouped by category
├── assets/
│   ├── css/                # base.css, components.css, tools.css
│   ├── js/                 # layout.js, utils.js, theme.js, qrcode.js
│   └── icons/              # SVG sprite
└── tools/<tool-name>/      # Each tool has its own index.html + CSS + JS
```

## Adding a new tool

1. Copy any existing tool folder, e.g. `tools/stopwatch/`, and rename it.
2. Edit the three files inside (`index.html`, `*.css`, `*.js`).
3. Add a card to `index.html` in the appropriate category section.

That's it — no build, no registration, no config.

## Developer hooks (optional)

After cloning, optionally install the pre-commit hook that auto-regenerates
the 35 shell pages when you edit a chrome source file:

```bash
make install-hooks
```

This copies `scripts/hooks/pre-commit` into `.git/hooks/`. The hook is a
no-op for normal commits (only fires when `assets/shell/*.html` or
`scripts/shell-template.py` is staged) and blocks the commit with a
visible error if the drift or a11y gates fail after regeneration. The
hook is portable across macOS/Linux/Git-Bash-on-Windows (no Node
required). See `scripts/hooks/README.md` for details.

## License

MIT
