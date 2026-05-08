# WATCHA WANNA EAT? — Brand Pass Spec
## Claude Code Instructions · Next.js + Tailwind v4

> **How to use this in Claude Code:**
> Paste this document and say: "Apply the brand pass to [screen name] following
> this spec. Touch only className values — no logic, no state, no routing."

---

## 🏗 Setup (Do This Once First)

### Step 1 — Delete `tailwind.config.js`
If you have one, delete it. In Tailwind v4, the config file does nothing.
All tokens live in `globals.css` now.

### Step 2 — Add fonts via `next/font`

In `app/layout.tsx`:

```tsx
import { Nunito, Manrope } from 'next/font/google'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

Then in `globals.css`, inside the `@theme` block, update font vars to:
```css
--font-display: var(--font-nunito);
--font-body: var(--font-manrope);
```

### Step 3 — Merge `globals.css`
Drop in the provided `globals.css`. It:
- Preserves your existing `@import "tailwindcss"` approach
- Preserves your `.safe-top` and `.scrollbar-hide` utilities
- Adds an `@theme` block with all brand tokens
- Adds `@keyframes` for all animations
- Adds `@layer components` with all reusable classes

**Important:** If you have an existing `@theme inline` block for `--background`
and `--foreground`, keep it — the brand tokens go in a separate `@theme` block.

---

## 📋 Brand Rules — Apply Everywhere

| Rule | Class / Value |
|------|--------------|
| App background | `bg-charcoal` (`#1C1A18`) |
| Card surfaces | `bg-charcoal-mid` (`#2A2420`) |
| Primary accent | `bg-orange` / `text-orange` (`#E8621A`) |
| Match accent | `bg-match` / `text-match` — **MATCH SCREEN ONLY** |
| Headline font | `font-display font-black` (Nunito 900) |
| Body / UI font | `font-body` (Manrope) |
| All buttons | `rounded-pill` — never square |
| All cards | `rounded-2xl` minimum |
| Primary CTA | `btn-primary` or `btn-primary-full` |
| Secondary text | `text-muted` (`#8A7F78`) |
| Dividers | `border-white/[0.06]` |
| Section labels | `label-eyebrow` class |
| Animations | Always ease-based — use the named `animate-*` classes |

---

## 📱 Screen 01 — Splash Screen

**Goal:** Brand lands before anything is asked. One button. No tour.

```tsx
// Full-screen layout
<main className="page-full noise-overlay flex flex-col items-center justify-center gap-8 bg-charcoal">
  {/* Subtle radial glow — leave as inline style, Tailwind can't express this cleanly */}
  <div className="absolute inset-0 pointer-events-none"
       style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(232,98,26,0.12) 0%, transparent 60%)' }} />

  {/* App icon */}
  <div className="w-24 h-24 bg-orange rounded-[22%] flex items-center justify-center
                  shadow-glow-orange animate-qmark-resolve">
    <span className="font-display font-black text-5xl text-white animate-pulse-soft">?</span>
  </div>

  {/* Wordmark */}
  <div className="text-center">
    <h1 className="font-display font-black text-4xl text-white leading-none">
      Watcha<span className="text-orange">?</span>
    </h1>
    <p className="font-body text-muted text-sm tracking-widest uppercase mt-3">
      Stop asking. Start eating.
    </p>
  </div>

  {/* CTA — pushed down */}
  <div className="absolute bottom-12 left-5 right-5 animate-slide-up"
       style={{ animationDelay: '0.4s' }}>
    <button className="btn-primary-full">Let's go</button>
    <p className="text-center text-muted text-[11px] tracking-widest uppercase mt-4">
      Detroit, MI
    </p>
  </div>
</main>
```

**Key:** Only ONE button. The `?` pulses via `animate-pulse-soft`. Icon enters via `animate-qmark-resolve`. CTA slides up with 0.4s delay.

---

## 📱 Screen 02 — Onboarding

**Goal:** Feels like a conversation, not a form. Light screen for contrast.

```tsx
// Light-mode screen — cream background
<main className="page-full bg-cream flex flex-col">
  {/* Progress bar */}
  <div className="h-1 bg-cream-dark rounded-full mx-5 mt-4">
    <div className="h-full bg-orange rounded-full transition-all duration-[600ms]"
         style={{ width: `${(step / totalSteps) * 100}%` }} />
  </div>

  {/* Content */}
  <div className="flex-1 px-5 pt-10">
    <p className="label-eyebrow" style={{ color: '#E8621A' }}>Step {step} of {totalSteps}</p>
    <h2 className="font-display font-black text-3xl text-charcoal leading-tight mt-4">
      What are you usually in the mood for?
    </h2>
    <p className="font-body text-base text-charcoal/60 mt-2">
      Pick everything that sounds good.
    </p>

    {/* Option chips grid */}
    <div className="grid grid-cols-2 gap-3 mt-8">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => toggle(opt.id)}
          className={`option-chip ${selected.includes(opt.id) ? 'option-chip-selected' : ''}`}
        >
          {opt.emoji} {opt.label}
        </button>
      ))}
    </div>
  </div>

  {/* Sticky CTA — light bg */}
  <div className="px-5 pb-8 pt-4" style={{ background: '#FAF6F1' }}>
    <button
      className="btn-primary-full"
      disabled={selected.length === 0}
      style={{ opacity: selected.length === 0 ? 0.4 : 1 }}
    >
      Continue
    </button>
  </div>
</main>
```

**Key:** Background is `bg-cream` (light). Text is `text-charcoal`. Option chips use `.option-chip` + `.option-chip-selected`. CTA is disabled/dim until at least one selection.

---

## 📱 Screen 03 — Home Screen

**Goal:** Shared decision-making is the visual hero. Everything flows from it.

```tsx
<main className="page">
  {/* Header */}
  <header className="flex items-center justify-between pt-4">
    <span className="wordmark">Watcha<span>?</span></span>
    <button className="w-9 h-9 rounded-full bg-charcoal-soft flex items-center justify-center
                       font-display font-black text-sm text-white">
      {initials}
    </button>
  </header>

  {/* Greeting */}
  <div className="mt-8">
    <p className="font-body text-sm text-muted">Good evening,</p>
    <h1 className="font-display font-black text-4xl text-white leading-tight mt-1">
      What are we<br />eating?
    </h1>
  </div>

  {/* HERO CARD — Shared session (orange, full-width) */}
  <div className="card-hero mt-6">
    <p className="label-eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>Deciding Together</p>
    <h2 className="font-display font-black text-2xl text-white mt-1">
      Watcha wanna eat?
    </h2>
    <p className="font-body text-sm text-white/75 mt-2">
      Both swipe. First match wins. Takes 2 minutes.
    </p>
    <div className="flex gap-3 mt-5">
      {/* Inverted white CTA inside orange card */}
      <button className="flex-1 bg-white text-orange font-display font-black text-sm
                         py-3 rounded-pill hover:bg-cream active:scale-95 transition-all duration-[200ms]">
        Start a session
      </button>
      <button className="btn-secondary px-5 py-3 text-sm border-white/30 hover:border-white/60">
        Join
      </button>
    </div>
  </div>

  {/* Secondary mode cards */}
  <div className="grid grid-cols-2 gap-3 mt-4">
    <div className="card cursor-pointer hover:bg-charcoal-soft transition-colors duration-[200ms]">
      <span className="text-2xl">🧠</span>
      <h3 className="font-display font-bold text-base text-white mt-3">Just Me</h3>
      <p className="text-muted text-xs font-body mt-1">Your deck, your call.</p>
      <span className="text-orange font-bold mt-4 block">→</span>
    </div>
    <div className="card cursor-pointer hover:bg-charcoal-soft transition-colors duration-[200ms]">
      <span className="text-2xl">⚡</span>
      <h3 className="font-display font-bold text-base text-white mt-3">Decide for Me</h3>
      <p className="text-muted text-xs font-body mt-1">One tap. No swiping.</p>
      <span className="text-orange font-bold mt-4 block">→</span>
    </div>
  </div>

  {/* Recent decisions */}
  <div className="mt-8">
    <p className="label-eyebrow mb-4">Recent</p>
    <div className="flex gap-2 flex-wrap">
      {recents.map(m => <span key={m} className="badge-dark">{m}</span>)}
    </div>
  </div>
</main>

{/* Bottom nav */}
<nav className="nav-bar">
  {['Home','Saved','History','Profile'].map(item => (
    <button key={item} className={`nav-item ${active === item ? 'nav-item-active' : ''}`}>
      <span className="text-xl leading-none">{icons[item]}</span>
      {item}
    </button>
  ))}
</nav>
```

---

## 📱 Screen 04 — Building the Deck

**Goal:** Waiting feels intentional. Two tastes combining. Builds anticipation.

```tsx
<main className="page-full flex flex-col items-center justify-center bg-charcoal gap-0">
  {/* Avatars combining */}
  <div className="flex items-center gap-4 mb-12">
    <div className="w-14 h-14 rounded-full bg-charcoal-soft flex items-center justify-center
                    font-display font-black text-lg text-white">
      {user1Initial}
    </div>
    <span className="font-display font-black text-2xl text-orange">+</span>
    <div className="w-14 h-14 rounded-full bg-charcoal-soft flex items-center justify-center
                    font-display font-black text-lg text-white">
      {user2Initial}
    </div>
  </div>

  {/* Pulsing orb */}
  <div className="deck-orb">
    <div className="deck-orb-inner">?</div>
  </div>

  {/* Rotating copy — swap phrase with key to retrigger animation */}
  <div className="mt-12 text-center px-8">
    <p key={phraseIndex}
       className="font-display font-bold text-xl text-white animate-fade-in">
      {phrases[phraseIndex]}
    </p>
    <p className="text-muted text-sm font-body mt-2">Takes about 3 seconds</p>
  </div>

  {/* Progress dots */}
  <div className="flex gap-2 mt-8">
    {[0,1,2].map(i => (
      <div key={i} className={`w-2 h-2 rounded-full transition-colors duration-[400ms]
                               ${i === activeDot ? 'bg-orange' : 'bg-charcoal-soft'}`} />
    ))}
  </div>
</main>
```

**Phrases to rotate through:**
1. "Finding what you'll both actually want..."
2. "Filtering out the hard nos..."
3. "Building your deck..."
4. "Almost there..."

---

## 📱 Screen 05 — Swipe Deck

**Goal:** Fast, tactile, irresistible. The card IS the product.

```tsx
<main className="flex flex-col min-h-dvh bg-charcoal overflow-hidden">
  {/* Header */}
  <header className="flex justify-between items-center px-5 pt-4 pb-2">
    <div>
      <p className="font-body text-sm text-muted">Deciding with {partnerName}</p>
      <p className="font-body text-xs text-muted/60 mt-0.5">{remaining} left</p>
    </div>
    <button className="btn-ghost">End</button>
  </header>

  {/* Instruction banner — show on first load, dismiss on tap */}
  {showInstructions && (
    <div className="mx-5 mb-3 animate-slide-down">
      <div className="bg-charcoal-mid rounded-pill px-5 py-2.5 flex items-center justify-center gap-6">
        <span className="font-body text-sm text-muted">← Pass</span>
        <div className="w-px h-4 bg-white/10" />
        <span className="font-body text-sm text-match font-semibold">Yes →</span>
      </div>
      <button onClick={dismissInstructions}
              className="w-full text-center text-muted text-xs font-body mt-2">
        Got it
      </button>
    </div>
  )}

  {/* Swipe card stack */}
  <div className="flex-1 relative px-5 mt-2">
    {/* Back card (depth effect) */}
    <div className="swipe-card absolute inset-x-5 scale-[0.95] -translate-y-2 opacity-50 pointer-events-none"
         style={{ backgroundColor: '#2A2420' }} />

    {/* Top card */}
    <div className="swipe-card relative"
         style={{ background: archetypeGradient(meal.archetype) }}>

      {/* YES / NO indicators — set opacity via drag state */}
      <div className="swipe-indicator-yes" style={{ opacity: dragX > 40 ? Math.min((dragX-40)/60, 1) : 0 }}>
        YES ✓
      </div>
      <div className="swipe-indicator-no" style={{ opacity: dragX < -40 ? Math.min((-dragX-40)/60, 1) : 0 }}>
        NOPE
      </div>

      {/* Food emoji placeholder (until real photos) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[100px] leading-none
                      drop-shadow-[0_-8px_24px_rgba(0,0,0,0.5)]">
        {meal.emoji}
      </div>

      {/* Scrim */}
      <div className="swipe-card-scrim" />

      {/* Card content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
        <h2 className="font-display font-black text-2xl text-white">{meal.name}</h2>
        <p className="font-body text-sm text-white/80 mt-1 line-clamp-2">{meal.description}</p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {meal.tags.map(tag => (
            <span key={tag} className="badge-dark">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  </div>

  {/* Action buttons */}
  <div className="flex gap-4 justify-center py-6 pb-safe">
    <button onClick={swipeLeft}
            className="w-16 h-16 rounded-full bg-charcoal-mid border border-white/10
                       flex items-center justify-center text-2xl text-white/60
                       active:scale-90 transition-transform duration-[150ms]">
      ✕
    </button>
    <button onClick={swipeRight}
            className="w-16 h-16 rounded-full bg-orange shadow-glow-orange
                       flex items-center justify-center text-2xl text-white
                       active:scale-90 transition-transform duration-[150ms]">
      ✓
    </button>
  </div>
</main>
```

### Archetype gradient map

```ts
// Use this until real food photos are in place
const archetypeGradients: Record<string, string> = {
  bowl:           'linear-gradient(160deg, #2D4A1E 0%, #1A2E10 100%)',
  pasta:          'linear-gradient(160deg, #5C2D0A 0%, #3D1F05 100%)',
  handheld:       'linear-gradient(160deg, #4A2800 0%, #2D1800 100%)',
  flatbread:      'linear-gradient(160deg, #3D1A00 0%, #1F0E00 100%)',
  salad:          'linear-gradient(160deg, #1E3D1A 0%, #0F2010 100%)',
  stir_fry:       'linear-gradient(160deg, #3D2800 0%, #201400 100%)',
  plated_protein: 'linear-gradient(160deg, #2D1A00 0%, #180E00 100%)',
  comfort_plate:  'linear-gradient(160deg, #3D2010 0%, #201008 100%)',
  soup:           'linear-gradient(160deg, #3D2800 0%, #201500 100%)',
  breakfast:      'linear-gradient(160deg, #3D2010 0%, #201008 100%)',
  loaded_plate:   'linear-gradient(160deg, #3D2800 0%, #1F1400 100%)',
  vegetarian:     'linear-gradient(160deg, #1E3A1A 0%, #0F1E0E 100%)',
}
```

---

## 📱 Screen 06 — The Match Moment

**Goal:** The payoff. Green enters for the first and only time. Decision snaps into place.

```tsx
<main className="page-full flex flex-col items-center justify-center px-6 bg-charcoal">
  {/* Match burst — green ring + checkmark */}
  <div className="match-burst">
    <span className="match-checkmark">✓</span>
  </div>

  {/* Staggered reveals */}
  <h1 className="font-display font-black text-4xl text-white text-center mt-8 animate-slide-up">
    It's a match.
  </h1>

  <p className="font-display font-bold text-2xl text-match text-center mt-2 animate-slide-up"
     style={{ animationDelay: '0.1s' }}>
    {meal.name}
  </p>

  <p className="font-body text-sm text-white/70 text-center mt-3 max-w-xs animate-slide-up"
     style={{ animationDelay: '0.15s' }}>
    {meal.description}
  </p>

  {/* Why this works — AI-generated reason */}
  <div className="card w-full mt-6 animate-slide-up border-l-4 border-match"
       style={{ animationDelay: '0.2s' }}>
    <p className="label-eyebrow">Why this works</p>
    <p className="font-body text-sm text-white/80 leading-relaxed mt-2">
      {match.reason}
      {/* e.g. "You both swipe right on Mexican most. Sade loves mild spice. Alex hasn't rejected tacos once." */}
    </p>
  </div>

  {/* Confirming avatars */}
  <div className="flex items-center gap-3 mt-6 animate-fade-in"
       style={{ animationDelay: '0.25s' }}>
    {[user1, user2].map(u => (
      <div key={u.id} className="relative">
        <div className="w-10 h-10 rounded-full bg-charcoal-soft flex items-center justify-center
                        font-display font-black text-sm text-white">
          {u.initial}
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-match
                        flex items-center justify-center text-white text-[10px] font-black">
          ✓
        </div>
      </div>
    ))}
  </div>

  {/* CTAs */}
  <div className="flex flex-col gap-3 w-full mt-8 animate-slide-up"
       style={{ animationDelay: '0.3s' }}>
    {/* Match CTA — green, not orange */}
    <button className="btn-primary-full bg-match hover:bg-match-light shadow-glow-match">
      Let's eat 🙌
    </button>
    <button className="btn-ghost w-full">Keep swiping</button>
  </div>
</main>
```

**Key:** Green (`bg-match`, `text-match`, `shadow-glow-match`) appears ONLY on this screen. Everything staggers in. `animate-match-pop` on the burst. Trigger `navigator.vibrate([80, 40, 80])` on mount if available.

---

## 📱 Screen 07 — Decided Home

**Goal:** Decision made. "Let's eat" is the CTA. Order/Cook reveals on tap.

```tsx
<main className="page bg-charcoal">
  {/* Match banner — green, top of screen */}
  <div className="card-match -mx-5 -mt-4 rounded-none rounded-b-3xl px-5 pt-safe pb-6">
    <div className="flex justify-between items-center">
      <div>
        <p className="label-eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>Tonight's Pick</p>
        <h2 className="font-display font-black text-2xl text-white mt-1">{meal.name}</h2>
      </div>
      <span className="text-5xl">{meal.emoji}</span>
    </div>
    <button onClick={toggleEatOptions}
            className="mt-4 w-full bg-white text-match font-display font-black text-base
                       py-4 rounded-pill hover:bg-cream active:scale-95 transition-all duration-[200ms]">
      Let's eat 🙌
    </button>

    {/* Revealed on tap — initially hidden */}
    {showEatOptions && (
      <div className="grid grid-cols-2 gap-3 mt-4 animate-slide-down">
        <button className="card flex flex-col items-start gap-1 cursor-pointer
                           hover:bg-charcoal-soft transition-colors duration-[200ms]">
          <span className="text-2xl">🚗</span>
          <span className="font-display font-bold text-base text-white">Order In</span>
          <span className="text-muted text-xs font-body">We'll find the options</span>
        </button>
        <button className="card flex flex-col items-start gap-1 cursor-pointer
                           hover:bg-charcoal-soft transition-colors duration-[200ms]">
          <span className="text-2xl">🍳</span>
          <span className="font-display font-bold text-base text-white">Cook It</span>
          <span className="text-muted text-xs font-body">See what you need</span>
        </button>
      </div>
    )}
  </div>

  {/* Saved meals below */}
  <section className="mt-8">
    <p className="label-eyebrow mb-4">Saved Meals</p>
    {/* meal list here */}
  </section>
</main>

<nav className="nav-bar">
  {/* Home active */}
</nav>
```

---

## 📱 Screen 08 — Saved Meals

```tsx
<main className="page">
  <header className="pt-4">
    <span className="wordmark">Watcha<span>?</span></span>
    <h1 className="font-display font-black text-3xl text-white mt-6">Saved Meals</h1>
  </header>

  {/* Filter tabs */}
  <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-4 -mx-5 px-5">
    {['All','Favorites','Matched','By Cuisine'].map(tab => (
      <button key={tab}
              className={activeTab === tab ? 'badge-orange whitespace-nowrap' : 'badge-dark whitespace-nowrap'}>
        {tab}
      </button>
    ))}
  </div>

  {/* Pinned meals */}
  <section className="mt-6">
    <p className="label-eyebrow mb-3">Pinned</p>
    <div className="flex flex-col gap-3">
      {pinned.map(meal => (
        <div key={meal.id} className="card flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-charcoal-soft flex items-center justify-center text-3xl flex-shrink-0">
            {meal.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-base text-white truncate">{meal.name}</p>
            <p className="text-muted text-xs font-body mt-0.5">{meal.meta}</p>
          </div>
          {meal.isTonight && <span className="badge-match flex-shrink-0">Tonight</span>}
          {meal.isMatched && !meal.isTonight && <span className="badge-orange flex-shrink-0">Matched</span>}
        </div>
      ))}
    </div>
  </section>
</main>

<nav className="nav-bar">{/* Saved active */}</nav>
```

---

## 📱 Screen 09 — Flavor Profile

```tsx
<main className="page">
  <header className="pt-4">
    {/* Avatar */}
    <div className="w-20 h-20 rounded-full bg-charcoal-soft flex items-center justify-center
                    font-display font-black text-2xl text-orange">
      {initials}
    </div>
    <h1 className="font-display font-black text-2xl text-white mt-4">{name}'s Profile</h1>

    {/* Insight card */}
    <div className="card mt-4 border-l-4 border-orange">
      <p className="label-eyebrow">Watcha? Knows You</p>
      <p className="font-body text-sm text-white/80 leading-relaxed mt-2">
        {profile.insight}
      </p>
    </div>
  </header>

  {/* Flavor bars */}
  <section className="mt-6">
    <p className="label-eyebrow mb-4">Flavor Profile</p>
    {profile.flavors.map(f => (
      <div key={f.name} className="mb-4">
        <div className="flex justify-between mb-1.5">
          <span className="font-body text-sm text-white/80">{f.name}</span>
          <span className="font-display font-bold text-sm text-orange">{f.label}</span>
        </div>
        <div className="h-2 bg-charcoal-soft rounded-full">
          <div className="h-full bg-orange rounded-full transition-all duration-[600ms]"
               style={{ width: `${f.pct}%` }} />
        </div>
      </div>
    ))}
  </section>

  {/* Cuisines */}
  <section className="mt-6">
    <p className="label-eyebrow mb-3">Cuisines You Love</p>
    <div className="flex flex-wrap gap-2">
      {profile.cuisines.map(c => <span key={c} className="badge-dark">{c}</span>)}
    </div>
  </section>

  {/* Hard NOs */}
  <section className="mt-6">
    <p className="label-eyebrow mb-3">Hard NOs</p>
    <div className="flex flex-wrap gap-2">
      {profile.hardNos.map(n => (
        <span key={n}
              className="inline-flex items-center bg-red-950/60 text-red-400
                         font-body font-semibold text-[11px] px-3 py-1 rounded-pill
                         border border-red-900/40">
          {n}
        </span>
      ))}
      <button className="badge-dark cursor-pointer">+ Add</button>
    </div>
  </section>

  {/* Partner */}
  <section className="mt-6 pb-8">
    <p className="label-eyebrow mb-3">Deciding With</p>
    <div className="card flex items-center gap-4">
      <div className="w-11 h-11 rounded-full bg-charcoal-soft flex items-center justify-center
                      font-display font-black text-sm text-white">
        {partner.initial}
      </div>
      <span className="font-body text-sm text-white flex-1">{partner.name}</span>
      <span className="badge-match">{partner.compatibility}% match</span>
    </div>
  </section>
</main>

<nav className="nav-bar">{/* Profile active */}</nav>
```

---

## ⚡ Quick Copy-Paste Components

```tsx
// Wordmark
<span className="wordmark">Watcha<span>?</span></span>

// Primary CTA
<button className="btn-primary-full">Start a session</button>

// Orange hero card
<div className="card-hero">
  <p className="label-eyebrow" style={{color:'rgba(255,255,255,0.7)'}}>Label</p>
  <h2 className="font-display font-black text-2xl text-white mt-1">Headline</h2>
</div>

// Standard card
<div className="card">
  <p className="label-eyebrow">Section</p>
  <h3 className="font-display font-bold text-xl text-white mt-2">Title</h3>
  <p className="text-muted text-sm font-body mt-1">Supporting copy</p>
</div>

// Match burst
<div className="match-burst"><span className="match-checkmark">✓</span></div>

// Building deck orb
<div className="deck-orb"><div className="deck-orb-inner">?</div></div>

// Bottom nav
<nav className="nav-bar">
  {items.map(item => (
    <button key={item.label}
            className={`nav-item ${active === item.label ? 'nav-item-active' : ''}`}>
      <span className="text-xl">{item.icon}</span>
      {item.label}
    </button>
  ))}
</nav>

// Option chip (onboarding)
<button className={`option-chip ${selected ? 'option-chip-selected' : ''}`}>
  🌮 Mexican
</button>
```

---

## 🚫 Do Not Touch

| Never change | Why |
|---|---|
| API calls, fetch hooks, data-fetching | Logic layer only |
| State (useState, useContext, Zustand, etc.) | Functionality |
| Routing (next/navigation) | Navigation |
| Supabase queries, session logic | Shared sessions must work |
| Auth flow | Out of scope |
| `.env` / config files | Not in scope |
| Any `console.log` or error handling | Debug layer |

---

## ✅ Recommended Work Order in Claude Code

| Priority | Screen | Why |
|---|---|---|
| 1 | `globals.css` setup + fonts | Foundation — everything depends on this |
| 2 | Home screen | Biggest visual impact, most-seen screen |
| 3 | Swipe deck | Core interaction loop |
| 4 | Match moment | Emotional peak, highest ROI |
| 5 | Splash screen | First impression |
| 6 | Onboarding | Light-mode contrast screen |
| 7 | Building deck | Animation-heavy loader |
| 8 | Saved + Profile | Supporting screens |

---

*Watcha Wanna Eat? · Brand Pass v2.0 · Tailwind v4 · Detroit, MI*
