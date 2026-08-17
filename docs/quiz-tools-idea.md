I dug into the current quiz/social landscape rather than just expanding the usual “What animal are you?” list. The pattern is pretty clear: **identity + curiosity + social comparison + a useful recommendation** is much stronger than trivia alone. Current quiz products are leaning heavily into shareable personality results, while recommendation quizzes can turn a short questionnaire into practical decisions. ([Jotform][1])

---

## Index — Discovery Engine (Epic 10) planning artifacts

This document is the **raw research** behind the Discovery Engine. The 2026-08-17 fresh brainstorm pass + full bMAD cascade produced these canonical planning artifacts:

| Artifact | Path |
|---|---|
| Brainstorm intent (fresh pass) | `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/brainstorm-intent.md` |
| Future tasks (companion) | `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/discovery-engine-future-tasks.md` |
| PRD (FR-22..33, UJ-5..8, NFR-11..14) | `_bmad-output/planning-artifacts/prds/prd-discovery-engine-2026-08-17/prd.md` |
| Architecture spine (AD-16..19) | `_bmad-output/planning-artifacts/architecture/architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md` |
| UX design (visual) | `_bmad-output/planning-artifacts/ux-designs/ux-discovery-engine-2026-08-17/DESIGN.md` |
| UX experience (behavioral) | `_bmad-output/planning-artifacts/ux-designs/ux-discovery-engine-2026-08-17/EXPERIENCE.md` |
| UX review — rubric walker (9.5/10) | `_bmad-output/planning-artifacts/ux-designs/ux-discovery-engine-2026-08-17/review-rubric.md` |
| UX review — accessibility (conditional pass; 3 blocking items) | `_bmad-output/planning-artifacts/ux-designs/ux-discovery-engine-2026-08-17/review-accessibility.md` |
| Epics + stories (Epic 10 appended) | `_bmad-output/planning-artifacts/epics.md` |
| Sprint status (Epic 10 block) | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Per-story docs (10.1..10.19) | `_bmad-output/implementation-artifacts/10-1-*.md` … `10-19-*.md` |
| Implementation-readiness report | `_bmad-output/planning-artifacts/implementation-readiness-report-discovery-engine-2026-08-17.md` |

**Scope:** 6-quiz MVP (Spirit Animal, Future Partner, What Would You Do, Decision Style, Friend Match, Car Finder) — see Story 10.7 for the authored roster. The full 20-candidate catalog lives in the brainstorm intent.

**Verdict:** Conditional pass — gated on Story 10.14 (a11y blocking items B1/B2/B3 + H1..H5) before Stories 10.10 + 10.12 ship. Pack total ≤ 80 KB gz; home page unaffected.

---

Also, viral quiz content is currently appearing heavily around **friend groups, relationship archetypes, personality/vibe labels, and visually shareable results**. ([Snapchat][2])

One caveat: nobody can honestly promise a quiz will “go viral.” What we can do is maximize the characteristics that make virality more likely.

# The product I would build

Don't think:

> “I have 20 quizzes.”

Think:

> **“I have a discovery engine that keeps telling people interesting things about themselves and helping them make decisions.”**

Your existing template is the engine. These are the experiences I'd put on top of it.

---

# My top 20

| Rank | Tool                                            | Viral | Useful | Repeatable | My verdict    |
| ---- | ----------------------------------------------- | ----: | -----: | ---------: | ------------- |
| 🥇   | **What Kind of Person Are You, Really?**        | 10/10 |   8/10 |      10/10 | Must build    |
| 🥈   | **What Would Your Future Partner Be Like?**     | 10/10 |   6/10 |       9/10 | Must build    |
| 🥉   | **What Would You Do? — Real Life Situations**   | 10/10 |   9/10 |      10/10 | Must build    |
| 4    | **Which Car Is Actually Right for You?**        |  8/10 |  10/10 |       9/10 | Must build    |
| 5    | **Which Bike Is Right for You?**                |  9/10 |  10/10 |       9/10 | Excellent     |
| 6    | **What Kind of Partner Are You?**               | 10/10 |   8/10 |       9/10 | Excellent     |
| 7    | **What Is Your Hidden Personality?**            |  9/10 |   8/10 |      10/10 | Excellent     |
| 8    | **Which Country/City Fits Your Life?**          |  9/10 |  10/10 |       9/10 | Excellent     |
| 9    | **What's Your Money Personality?**              |  8/10 |  10/10 |       9/10 | Excellent     |
| 10   | **What Kind of Leader Would You Be?**           |  8/10 |  10/10 |       8/10 | Excellent     |
| 11   | **What Is Your Spirit Animal?**                 |  9/10 |   4/10 |      10/10 | Viral traffic |
| 12   | **What's Your Secret Superpower?**              |  9/10 |   5/10 |      10/10 | Viral traffic |
| 13   | **What Kind of Friend Are You?**                | 10/10 |   7/10 |       9/10 | Very strong   |
| 14   | **Which Career Actually Fits You?**             |  8/10 |  10/10 |       9/10 | Evergreen     |
| 15   | **How Good Are You at Reading People?**         |  9/10 |   9/10 |       9/10 | Very strong   |
| 16   | **Can You Beat This Logic Test?**               |  8/10 |   9/10 |      10/10 | Great game    |
| 17   | **What If You Became a Millionaire Tomorrow?**  | 10/10 |   7/10 |      10/10 | Viral         |
| 18   | **What Kind of Life Do You Actually Want?**     |  8/10 |  10/10 |       8/10 | Deep          |
| 19   | **Which Phone/Laptop Is Right for You?**        |  8/10 |  10/10 |       9/10 | Utility       |
| 20   | **What Would Your Life Look Like in 10 Years?** | 10/10 |   7/10 |       9/10 | Viral         |

---

# 1. What Kind of Person Are You, Really?

Don't make it an MBTI clone.

The hook is:

> **“Answer 12 uncomfortable questions and discover the person you actually are.”**

Questions should be **situational**, not obvious.

For example:

> Your friend gets a better opportunity than you. Your first reaction is...

> Someone insults you but nobody else hears it. You...

> You have a completely free Sunday. You...

> You suddenly receive $10,000. Your first thought is...

Result:

**THE QUIET STRATEGIST**

Then:

```text
Independence       89%
Ambition           82%
Empathy            74%
Risk Taking        41%
Social Energy      56%
Need for Control   77%
```

And, critically:

> **Your contradiction:**
> You want freedom, but you also want to control the outcome.

That “contradiction” section makes results much more interesting.

Personality quizzes work because people are attracted to identity and self-discovery, and shareable results give them a natural social artifact. ([Fyrebox][3])

---

# 2. What Would Your Future Partner Be Like?

This could be one of your biggest traffic generators.

Don't ask:

> Favorite color?

Instead determine:

**Personality**
**Lifestyle**
**Communication**
**Money attitude**
**Social behavior**
**Conflict style**
**Ambition**
**Family orientation**

Result:

> ❤️ **Your future partner is likely to be a “Quiet Builder.”**

Then reveal:

```text
Personality      Calm, grounded
Social style     Small circle
Communication    Direct but gentle
Career attitude  Ambitious
Money            Practical
Love style       Acts of service
Conflict         Needs time before talking
```

And create a highly shareable card:

> **“My result says my future partner will be calm, ambitious and secretly romantic.”**

That is infinitely more social-media-friendly than:

> “Your result is Type B.”

Relationship content is demonstrably part of the current viral quiz ecosystem. ([Snapchat][4])

---

# 3. What Would You Do? — Real Life Situations

This may actually be the **best long-term platform idea**.

Every quiz is a sequence of dilemmas.

Example:

> You discover your coworker is taking credit for your work.

A. Confront them
B. Tell your manager
C. Ignore it
D. Collect evidence first

Next:

> Your best friend asks you to lie for them.

Then:

> You receive an anonymous message revealing a secret about someone you know.

Your result isn't merely “You are X.”

It becomes:

## **Your Decision Profile**

```text
Under pressure       Strategic
Conflict             Avoidant → Direct
Risk                 Moderate
Empathy              High
Rule following       Low
Loyalty              Very High
```

Then:

> **Your biggest strength:** You don't panic under pressure.

> **Your blind spot:** Loyalty sometimes makes you tolerate behavior you shouldn't.

This creates an **infinite content engine**.

You can have:

* Relationship edition
* Workplace edition
* Friendship edition
* Moral dilemmas
* Emergency edition
* Money edition
* Leadership edition
* Dating edition
* Survival edition

Same engine. Different content.

---

# 4. Which Car Is Actually Right for You?

This one is different because it combines **fun + utility**.

A recommendation quiz is already proven as a practical use case; for example, The Car Mom has used a car recommendation quiz as a major acquisition tool. ([Interact][5])

Ask:

> Budget?

> City or highway?

> Number of passengers?

> Fuel economy vs performance?

> New or used?

> How much driving?

> Comfort or handling?

Then:

# Your Match

**Toyota X**

**87% compatibility**

And:

```text
Budget fit         92%
Family fit         96%
Fuel efficiency    88%
Performance        62%
Maintenance        91%
```

Then show:

### Why you match

### Why you don't

### 3 alternatives

This turns the quiz from entertainment into something people can **actually use before buying**.

---

# 5. Which Bike Is Right for You?

Especially interesting because you can localize it.

For example:

> City commuter
> Daily office rider
> Weekend rider
> Long-distance traveler
> Performance enthusiast

Then recommend actual models.

This can eventually become:

**Bangladesh Bike Finder**

which is much more commercially interesting than a generic personality quiz.

---

# 6. What Kind of Partner Are You?

Instead of predicting the partner, analyze **the user**.

Potential outcomes:

* The Protector
* The Romantic
* The Independent
* The Communicator
* The Avoider
* The Caregiver
* The Adventurer
* The Builder

The result can include:

> ❤️ Your love strength

> ⚠️ Your relationship weakness

> 💬 What you need from a partner

> 🧠 How you react during conflict

> 💕 What type of person complements you

Then:

**“Send this to your partner and see whether they agree.”**

That's the viral loop.

---

# 7. What's Your Hidden Personality?

This is different from #1.

The hook:

> **“Your friends see one version of you. This quiz tries to find the other.”**

Ask indirect questions.

Result:

> **You have a surprisingly competitive side.**

This type of framing works well because the user expects the quiz to reveal something they *don't already know*.

---

# 8. Which Country/City Fits Your Life?

This is an excellent utility/viral hybrid.

Inputs:

```text
Weather
Budget
Career
Nightlife
Nature
Safety
Social life
Family
Work-life balance
Transportation
```

Output:

> 🌍 **Your best city: Copenhagen**

Compatibility:

```text
Lifestyle       94%
Career          81%
Budget          62%
Weather         48%
Social life     86%
```

Then:

> **3 cities you should also consider**

This can eventually connect to travel content.

---

# 9. What's Your Money Personality?

Very useful and surprisingly personal.

Possible outcomes:

**The Builder**

**The Spender**

**The Optimizer**

**The Risk Taker**

**The Security Seeker**

**The Avoider**

Questions can be behavioral:

> You suddenly receive an unexpected $5,000. What do you do?

> Your investment drops 25%. What happens next?

> You get a 20% salary increase...

Result:

> You aren't actually a spender.

> **You're a “comfort buyer.”**

That kind of unexpected observation is much more compelling.

---

# 10. What Kind of Leader Would You Be?

This can pull in a more professional audience.

Results:

* The Strategist
* The Coach
* The Commander
* The Diplomat
* The Operator
* The Visionary

Then:

```text
Decision making
Delegation
Conflict handling
Communication
Risk tolerance
People development
Execution
```

And:

> **Your biggest leadership risk**

That makes this useful for professionals rather than just teenagers.

---

# 11. Spirit Animal

Definitely build it.

But don't make it the star of the whole platform.

It's perfect for **cheap viral traffic**.

Possible results:

🐺 Wolf
🦅 Eagle
🐙 Octopus
🦊 Fox
🐘 Elephant
🐬 Dolphin
🐆 Panther
🦉 Owl

Make the result visually gorgeous.

The current social environment is already showing strong activity around playful personality identities and archetypes. ([Snapchat][2])

---

# 12. What's Your Secret Superpower?

This is extremely TikTok/Instagram friendly.

Results:

> 🧠 Pattern Recognition

> 👀 Reading People

> 🎯 Focus

> 🗣️ Persuasion

> 🧘 Emotional Control

> ⚡ Improvisation

Then:

> **Most people with your result don't realize they have this ability.**

That's a strong curiosity hook.

---

# 13. What Kind of Friend Are You?

This should absolutely include **friend comparison**.

First person takes it.

Then:

> **Challenge your friend**

Generate:

**“Sanjit got The Protector.”**

Friend takes it.

Then:

```text
Your friendship compatibility: 84%

You:
Protector

Your friend:
Chaos Agent
```

Now the quiz doesn't end when one user finishes.

**The result recruits another user.**

That's the viral mechanic you want.

---

# 14. Which Career Actually Fits You?

Don't use only personality.

Combine:

```text
Interest
Income preference
Risk
Social interaction
Creativity
Problem solving
Routine tolerance
Work-life balance
Leadership
Independence
```

Output:

> **Software Architect — 92%**

But also:

> Product Manager — 84%

> UX Designer — 72%

> Entrepreneur — 68%

That makes it significantly more useful than generic “What career should I choose?” quizzes.

---

# 15. How Good Are You at Reading People?

Now you're entering **game territory**.

Show a situation:

> Someone says: “No, it's totally fine.”

Then give behavioral context.

Or:

> A person receives bad news and responds this way...

Ask:

**What do you think they're actually feeling?**

Score:

```text
Observation       92%
Emotional reading 81%
Deception spotting 67%
Context awareness 89%
```

That can become a whole family:

**Can You Read People?**

**Can You Detect Lies?**

**Can You Read Body Language?**

**Can You Understand Emotions?**

---

# 16. Can You Beat This Logic Test?

I'd make this much more game-like than an IQ exam.

Give users:

**10 questions**

**90 seconds**

**Difficulty increases dynamically**

Then:

> 🧠 **You scored better than 83% of players.**

The crucial part is **dynamic generation**.

Static quiz databases are easy to copy.

A generator can continuously produce:

* sequences
* pattern problems
* number puzzles
* deduction problems
* spatial challenges

That gives you a much stronger technical moat.

---

# 17. What If You Became a Millionaire Tomorrow?

This is exactly the sort of concept that makes someone say:

> “Okay, let's see what mine says.”

Questions:

> What's the first thing you would buy?

> Would you tell your friends?

> Would you quit your job?

> How much would you give your family?

> Would you invest or spend?

Then:

# Your Millionaire Personality

**The Quiet Builder**

> You wouldn't actually live extravagantly.

> You'd spend most of the money creating freedom.

This can be very shareable.

---

# 18. What Kind of Life Do You Actually Want?

This is more serious.

People answer questions around:

**Money**

**Family**

**Freedom**

**Career**

**Adventure**

**Community**

**Status**

**Peace**

Then show:

> **Your ideal life isn't actually about being rich.**

> It's about having control over your time.

That kind of result can create surprisingly strong emotional engagement.

---

# 19. Which Phone/Laptop Is Right for You?

Same framework as cars.

But now you can generate:

**Best for coding**

**Best for gaming**

**Best for photography**

**Best for battery**

**Best value**

**Best productivity**

This is where your platform begins moving from **viral entertainment → actual consumer decision engine**.

---

# 20. What Would Your Life Look Like in 10 Years?

This is probably one of the highest-curiosity concepts.

Ask about:

* ambitions
* risk
* relationships
* career
* money
* lifestyle
* social preferences
* priorities

Don't pretend to predict the future.

Frame it as:

> **“Based on your answers, here's the kind of life you're currently moving toward.”**

Then:

### Your likely lifestyle

### Your likely priorities

### What you'll probably value more later

### Your biggest risk

### What you should start doing now

That's much more intellectually honest and actually more useful.

---

# What I'd launch first

I would **not** launch all 20.

I'd launch these **10**:

### Viral acquisition

**1. What Kind of Person Are You, Really?**

**2. What Would Your Future Partner Be Like?**

**3. What Kind of Friend Are You?**

**4. What's Your Secret Superpower?**

**5. What's Your Spirit Animal?**

### Utility

**6. Which Car Is Right for You?**

**7. Which Bike Is Right for You?**

**8. Which Career Fits You?**

### Game/retention

**9. What Would You Do?**

**10. Can You Beat This Logic Test?**

That gives you a very healthy mix:

```text
              YOUR PLATFORM

        ┌───────────────────────┐
        │      VIRAL QUizzes    │
        │                       │
        │ Personality           │
        │ Relationships         │
        │ Spirit Animal         │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   SOCIAL CHALLENGE    │
        │                       │
        │ "Send to your friend" │
        │ "Compare results"     │
        │ "Who knows you best?" │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │       USEFUL          │
        │                       │
        │ Car                   │
        │ Bike                  │
        │ Career                │
        │ Phone                 │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │       GAMES           │
        │                       │
        │ Logic                 │
        │ Reaction              │
        │ Memory                │
        │ Reading People        │
        └───────────────────────┘
```

# But there is one feature I would consider mandatory

## **Challenge a Friend**

This is more important than adding another 50 quizzes.

At the end of the result:

> **Think your friend knows you?**

Generate a link.

Your friend answers **without seeing your answers**.

Then:

# HOW WELL DO YOU KNOW SANJIT?

```text
You got 8 / 10

🔥 80% Match

You know them better than 74% of players.
```

Then allow:

**Compare your personalities**

**Find your friendship type**

**See where you disagree**

**Try another challenge**

Now one user's session naturally creates another user's session.

That's the kind of loop you want.

Socially shareable, visually striking result cards and friend/group challenges are repeatedly emphasized in current quiz products and social quiz trends. ([Blindspot App Blog][6])

---

# And I'd make every result look like a mini personality profile

Not:

> Your result is Wolf.

Instead:

```text
╭──────────────────────────────╮
│                              │
│        🐺 THE WOLF           │
│                              │
│   Independent • Loyal        │
│                              │
│   Independence    ████████░  │
│   Loyalty         █████████  │
│   Risk            █████░░░░  │
│   Empathy         ████████░  │
│                              │
│   YOUR UNEXPECTED TRAIT     │
│   You need people more      │
│   than you admit.            │
│                              │
│       [ Share Result ]       │
│       [ Challenge Friend ]   │
│                              │
╰──────────────────────────────╯
```

The **unexpected trait** is particularly valuable.

People don't share:

> “I'm an introvert.”

They share:

> **“Apparently my biggest problem is that I try to solve everyone's problems 😂”**

That gives you much better social content.

---

# The architecture I'd build around this

Since you already have the quiz template, I'd make the content completely data-driven.

```text
Quiz Definition
      ↓
Question Engine
      ↓
Answer → Trait Signals
      ↓
Scoring Engine
      ↓
Personality / Recommendation Model
      ↓
Result Generator
      ↓
Share Card
      ↓
Challenge Friend
      ↓
New User
```

A quiz should mostly become JSON/content rather than custom programming.

For example:

```text
quiz
 ├── questions
 ├── answer options
 ├── traits
 ├── scoring rules
 ├── result archetypes
 ├── result descriptions
 ├── recommendations
 └── share metadata
```

That gives you the ability to go from **10 quizzes → 100 quizzes** without creating 100 applications.

---

# The most important strategic decision

I would **not call the site an IQ/quiz site**.

I'd position it around:

## **“Discover things about yourself.”**

Then your navigation becomes:

**Discover Me**
Personality, relationships, strengths, hidden traits

**What If?**
Alternate-life scenarios and decisions

**Find My Match**
Car, bike, career, phone, city, destination

**Challenge**
Logic, memory, observation, trivia

**With Friends**
Compare, challenge, compatibility

That is a significantly more defensible product concept than “another quiz website.”

And there's a useful market signal here: current quiz products that are getting attention aren't relying purely on traditional tests; they're turning results into **internet-native identity labels that people want to screenshot and share**. ([SBTI][7])

### My strongest recommendation

Build **10 excellent experiences, not 100 mediocre ones**.

The first three I'd put serious effort into are:

**① What Kind of Person Are You, Really?**
**② What Would Your Future Partner Be Like?**
**③ What Would You Do? — Real Life Situations**

Then immediately add **Challenge a Friend** across all three.

That combination gives you the best balance of **curiosity + entertainment + personalization + social loop**, while your car/bike/career recommendation tools give the platform a useful side that most viral quiz sites don't have.

[1]: https://www.jotform.com/blog/how-to-make-a-personality-quiz/?utm_source=chatgpt.com "How to make a personality quiz (free, no-code, and actually fun) | Jotform Blog"
[2]: https://www.snapchat.com/topic/viral-personality-test?utm_source=chatgpt.com "Viral Personality Test Videos"
[3]: https://www.fyrebox.com/blog/how-to-build-personality-quiz?utm_source=chatgpt.com "How to Create Shareable Personality Quizzes That Generate Leads"
[4]: https://www.snapchat.com/topic/relationship-advice-quiz?utm_source=chatgpt.com "Relationship Advice Quiz Videos"
[5]: https://www.tryinteract.com/blog/the-car-mom-quiz-case-study/?utm_source=chatgpt.com "The Car Mom's Best Email List Growth Tool is a Car Recommendation Quiz | Interact Blog"
[6]: https://blog.whatdomyfriendsthinkofme.com/share-my-personality-test-results/?utm_source=chatgpt.com "How to Share My Personality Test Results and Go Viral"
[7]: https://www.sbti-test.org/en/blog/what-is-sbti?utm_source=chatgpt.com "What Is SBTI? From Structured Entertainment Quiz to Full-Blown Social Phenomenon | SBTI"
