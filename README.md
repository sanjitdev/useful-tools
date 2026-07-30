# Handy Tools

A collection of 32 small, useful everyday tools — age calculator, unit converter, password generator, QR code generator, Bangladesh income tax calculator, space calculator, and more. **Zero dependencies, fully offline, hosted on GitHub Pages.**

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
- BMI Calculator
- Tip Calculator
- Percentage Calculator
- Grade Calculator
- Compound Interest
- Loan Calculator
- Calorie Estimator
- Bangladesh Tax Calculator (AY 2026-27, bilingual EN/BN)

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
├── index.html              # Home page — grid of 20 tools, grouped by category
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

## License

MIT
