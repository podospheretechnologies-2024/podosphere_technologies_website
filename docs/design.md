# Podo Social marketing design

References: Buffer (clarity, product-first), Later (calm product UI), Linear (precise type, restrained accent).

## Mode
Persuade — public marketing site `(marketing)/*`.

## Colour (60 / 30 / 10)
- **60%** page background: `#F7F7F5` warm neutral (not purple wash, not cream `#F4F1EA`)
- **30%** surface + ink: white cards `#FFFFFF`, ink `#111111`, muted `#5C5C5C`, hairline `#E8E8E4`
- **10%** brand primary `#612BD3` — CTAs and key numbers only (never full-bleed purple gradients)

## Do not use
- Radial purple/pink glows
- Gradient headline text / `bg-clip-text`
- Glow shadows (`shadow-primary/30`)
- Sparkles-as-logo
- Eyebrow kickers above H1s
- Same-size icon+title+blurb cards as the only page structure

## Type
- Display / UI: Plus Jakarta Sans (marketing layout)
- Body / mono: Geist Sans / Geist Mono (root)
- Headlines: tight tracking, weight 600–700, no gradient fill
- Body measure ~65–75ch

## Layout
- Max width `72rem` (≈ max-w-6xl)
- Generous section gaps; tighter inside groups
- Hero: brand + one headline + one sub + CTA group + one visual plane
- Mobile (`< md`): static product frame instead of WebGL hero

## Motion
Keep existing `Reveal` / `Stagger`. Prefer opacity + translateY. No decorative blur entrance spam.

## Voice
Plain, agency-specific, India-aware. Claim only features that ship. Prefer “you approve” over “AI magic”.
