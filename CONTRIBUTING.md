# Contributing to Handy Tools

Thanks for your interest in contributing! Handy Tools is a static, local-first, no-build site — see [`docs/README.md`](docs/README.md), [`docs/quality-rubric.md`](docs/quality-rubric.md), and [`docs/quality-audit.md`](docs/quality-audit.md) for the deep dive. This file covers the single most-frequently-asked question: *which pack does my new tool belong to?*

## Pack taxonomy

See [`docs/pack-taxonomy.md`](docs/pack-taxonomy.md) for the full criteria, in-pack examples, and out-of-pack examples for each of the five packs.

The five packs are: `travel`, `finance`, `study`, `developer`, `household`. The inclusion criteria, quoted verbatim from the taxonomy doc, are:

### `travel`

- The tool's primary user is in transit or coordinating across timezones.
- The tool does mobility, timezone, currency, or on-the-road logistics.
- The tool's primary use case has the user physically away from home (e.g., "I'm in Bangkok and want to call my team in Berlin").
- Date math across boundaries (countdowns, date differences between distant points) is part of the core surface.

### `finance`

- The tool produces a numeric money result: income, EMI, growth, tip, discount, tax, or similar monetary calculation.
- The tool's primary use case is a financial decision (saving, borrowing, paying, budgeting).
- The tool's inputs are denominated in a currency or interest rate.
- The tool's output is denominated in a currency or yield percentage.

### `study`

- The tool supports an academic or learning workflow: grading, GPA, focus sessions, or text generation.
- The tool's primary user is a student, teacher, or self-learner.
- The tool measures learning progress (sessions, grades, study time) or generates learning material (prompts, flashcards, summaries).
- The tool's outputs are useful for homework, classroom, or independent study.

### `developer`

- The tool manipulates structured text or developer-facing data: JSON, regex, encoding, URL, base64, IDs, or random.
- The tool's primary user is a software developer or technical writer.
- The tool's inputs are code, structured data, or developer-oriented text (URLs, secrets, tokens).
- The tool's outputs are code-shaped, machine-readable, or useful in a code review / debugging workflow.

### `household`

- The tool helps with a household or personal-life task: health metrics, decisions, life math, or at-home organization.
- The tool's primary use case has the user at home or in their local context (e.g., "I'm planning next week's meals").
- The tool covers domestic, area, volume, recipe, or at-home life math.
- The tool is useful for personal-life management (habits, age, color picking for a room, paint estimate for a wall).

A tool lands in a pack when its primary use case matches **at least one** of the bullets above. Multi-pack tools (e.g., a calculator useful both at home and in finance) appear in both lists.

The `travel` vs. `household` distinction is the most common question — see [docs/pack-taxonomy.md § Resolved definitions (PRD Open Q1)](docs/pack-taxonomy.md#resolved-definitions-prd-open-q1) for the decision rule.