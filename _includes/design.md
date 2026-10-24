# Site design system

This document records the visual language currently implemented by the site. Use it as the baseline for future restyling: preserve the underlying hierarchy and reusable patterns unless a redesign explicitly changes them.

## Source of truth

The rendered site is the authority when this document and the code disagree. Its design is primarily defined in:

- `assets/css/inline.css` — tokens, reset, and global element styles.
- `assets/css/global.css` — layout, components, and utilities.
- `components/head.njk` — font and icon dependencies, CSS inclusion, and critical-CSS delivery.
- `layouts/base.njk` — the shared page shell.
- `layouts/home.njk`, `layouts/page.njk`, `layouts/post.njk`, and `layouts/contact.njk` — page-level compositions.

All paths above are relative to `_includes/`. Both stylesheets are concatenated, minified, and inlined into every page by `components/head.njk`. The CSS cascade order is explicit:

```css
@layer reset, tokens, base, layout, components, utilities;
```

Keep new rules in the appropriate layer. Prefer changing a token over repeating a literal value across components.

## Design character

The site is a text-first editorial blog expressed through modern brutalism. Its character comes from:

- a nearly monochrome white-and-black foundation;
- a vivid safety-orange accent, with a darker accessible orange for text links;
- large, tightly tracked headlines paired with relaxed body copy;
- monospaced navigation and metadata;
- hard black rules, square corners, and offset shadows that expose structure;
- generous whitespace on desktop and a compact single-column layout on small screens.

The overall feeling should remain direct, readable, bold, and slightly technical. The brutalist details add energy without compromising long-form reading or turning the site into visual noise.

## Foundations

### Color

| Role | Token | Current value | Use |
| --- | --- | --- | --- |
| Page canvas | `--color-canvas` | `#ffffff` | Body background and focus-ring separation |
| Default surface | `--color-surface` | `#ffffff` | Standard content surfaces |
| Raised surface | `--color-surface-raised` | `#fff7f2` | Form controls and subtly distinct UI |
| Primary ink | `--color-ink` | `#111111` | Headings, navigation, and strong text |
| Muted ink | `--color-ink-muted` | `#3c3535` | Body copy, metadata, and secondary text |
| Rule | `--color-line` | `#111111` | Structural dividers and borders |
| Strong rule | `--color-line-strong` | `#111111` | Emphatic borders and tag underlines |
| Accessible accent | `--color-accent` | `#c63f00` | Text links and focus states; 5.11:1 contrast on white |
| Accent hover | `--color-accent-hover` | `#8f2d00` | Darker hover state for text links |
| Loud accent | `--color-accent-loud` | `#ff4f00` | High-impact orange fills with 6.37:1 black-text contrast |
| Accent wash | `--color-accent-soft` | `#ffd8c4` | Blockquotes, current pages, and secondary emphasis |
| Code surface | `--color-code-bg` | `#fff0e8` | Inline code background |
| Code ink | `--color-code-ink` | `#191919` | Inline code text |

Color usage is intentionally limited. The two orange tokens have different jobs: use `--color-accent` when orange is text on white, and use `--color-accent-loud` as a fill with `--color-ink` on top. Do not place white text on the loud orange. Add a new color only when it introduces a durable semantic role, and define it as a token. The current site declares `color-scheme: light`; there is no dark theme.

Legacy aliases such as `--contrast`, `--base`, `--accent`, and `--text-*` exist only for compatibility. New styling should use the canonical `--color-*`, `--font-size-*`, `--weight-*`, and measure tokens.

### Typography

The primary typeface is **Inter** for reading and headings. **Reddit Mono** is the secondary face for the site title, navigation, metadata, table-of-contents numbers, sidebar lists, and footer. Both are loaded from Google Fonts, with system fallbacks defined in `--font-sans` and `--font-mono`.

Weights in active use:

- Regular: `--weight-regular` (`400`)
- Medium: `--weight-medium` (`600`)
- Bold: `--weight-bold` (`800`)

The fluid type scale uses `clamp()`:

| Token | Range |
| --- | --- |
| `--font-size-xs` | `0.75rem`–`0.8125rem` |
| `--font-size-sm` | `0.875rem`–`0.9375rem` |
| `--font-size-base` | `1rem`–`1.125rem` |
| `--font-size-lg` | `1.125rem`–`1.375rem` |
| `--font-size-xl` | `1.35rem`–`1.875rem` |
| `--font-size-2xl` | `1.7rem`–`2.5rem` |
| `--font-size-3xl` | `2.15rem`–`3.5rem` |
| `--font-size-4xl` | `2.75rem`–`5rem` |

Body text uses a `1.65` line height. Heading tokens provide tight (`1.15`), snug (`1.35`), and body (`1.7`) leading; headings currently use tight leading and balanced wrapping. Standard `h1`–`h4` elements descend through the scale. The primary page and post titles use `--font-size-4xl`, a maximum width of `24ch`, and `-0.045em` letter spacing.

Body copy is muted ink; headings and strong text return to primary ink. Navigation and other compact labels use uppercase mono text with modest tracking (`0.04em`, or `0.1em` for sidebar headings).

### Spacing

Spacing follows an 8px base grid:

| Token | Value | Pixels at default root size |
| --- | --- | --- |
| `--space-0` | `0` | 0 |
| `--space-1` | `0.5rem` | 8 |
| `--space-2` | `1rem` | 16 |
| `--space-3` | `1.5rem` | 24 |
| `--space-4` | `2rem` | 32 |
| `--space-5` | `2.5rem` | 40 |
| `--space-6` | `3rem` | 48 |
| `--space-8` | `4rem` | 64 |
| `--space-10` | `5rem` | 80 |
| `--space-12` | `6rem` | 96 |

Do not introduce one-off spacing values when a scale value is close enough. Component exceptions expressed in `em`, such as inline-code padding and link underline offsets, are relative to their text and are intentional.

### Shape, borders, and focus

- Small and medium radii are both `0`; controls, cards, media, and pagination remain square.
- Standard border: `--border-thin`, a 2px solid black rule.
- Emphatic border: `--border-heavy`, a 3px solid black rule.
- Brutalist elevation: `--shadow-brutal`, a hard `4px 4px 0` black offset with no blur.
- Focus: `--shadow-focus`, a clearly separated orange focus ring.

The system uses visible construction: hard edges, strong rules, solid fills, and a small number of purposeful offset shadows. Avoid soft shadows, gradients, glass effects, hairline-gray borders, and ornamental rounding. Offset shadows belong on discrete interactive or framed elements, not every section.

## Layout

### Site shell

`body > .site` is centered, capped at `--measure-wide` (`78rem`), and inset by `--space-3` on each side. It contains three regions:

1. Header — brand and primary navigation separated from the page by a heavy bottom rule.
2. Main — content and browsing sidebar in a two-column grid.
3. Footer — centered small print separated by a top rule.

The main grid uses:

- content column: up to `--measure-copy` (`68ch`);
- sidebar: `--sidebar-width` (`16rem`), never narrower than `12rem`;
- gap: `--layout-gap`, fluid from `--space-4` to `--space-10`;
- vertical padding: fluid from `--space-6` to `--space-12`.

The copy measure is a deliberate readability constraint. Do not widen long-form text merely to fill available space.

### Responsive behavior

There are two principal breakpoints:

- At `52rem` and below, the main grid becomes one column. The sidebar moves below the content, loses its left border, and gains a top border and padding.
- At `36rem` and below, the page gutters shrink from `--space-3` to `--space-2`, and the header stacks the brand above the navigation.

Fluid type and spacing handle most intermediate widths. Add breakpoints only for a demonstrated layout failure, not to target specific devices.

## Content rhythm and composition

Direct children of `main`, `article`, and `section` receive a default `--space-3` flow gap. Section headings (`h2`–`h4`) receive a larger `--space-6` top margin. Page-level `.layout__cozy` increases sibling spacing to `--space-4`.

Available composition utilities:

- `.flow` — vertical rhythm controlled by `--flow-space`, defaulting to `--space-3`.
- `.cluster` — wrapping horizontal group controlled by `--cluster-gap`, defaulting to `--space-2`.
- `.stack` — vertical flex stack controlled by `--stack-gap`, defaulting to `--space-3`.
- `.measure` — caps content at the copy measure.
- `.layout__cozy` — `--space-4` between siblings.
- `.layout__compact` — `--space-2` between siblings.
- `.layout__condense` — `--space-1` between siblings.
- `.text-muted` — applies secondary text color.
- `.visually-hidden` — hides content visually while keeping it available to assistive technology.

Prefer these primitives for new template composition before adding a narrowly named layout class.

## Components

### Header and navigation

The header is a flexible row with the site title on the left and navigation on the right. Both use small, bold, uppercase mono type. The site title is a vivid-orange label with a black border and hard offset shadow. Navigation links are ink-colored by default; hovered and current links use blunt rectangular fills rather than delicate underlines. Navigation wraps when space is limited and stacks with the header on narrow screens.

### Page and post titles

Generic pages start with an `h1` in `.main-content`. Posts use an article `.hero` containing the title and metadata. Both primary title treatments are oversized, tightly tracked, and limited to `24ch`. A post hero has a bottom rule plus `--space-8` padding and margin, giving the article a deliberate editorial opening.

### Post lists

Each `.post-list` presents a linked `h3`, metadata, and optional excerpt, followed by a horizontal rule. Titles are primary ink with slight negative tracking; hover adds the accent color and an underline. The component uses `--space-4` vertical padding.

### Metadata and tags

`.metadata` is a wrapping inline group in small muted mono type. Dates and tags share the same scale. Tags are plain text links prefixed with `#` in the template and marked by a single strong bottom rule; they are not pills or badges.

### Sidebar filters

The sidebar is a structural index, not a card. Section labels are small uppercase headings highlighted with vivid-orange rectangular fills. List items use uppercase mono text and solid separators, with links and counts distributed across the row. The year filter is a compact two-column grid; each year/count pair uses its own two-column alignment.

### Table of contents and heading anchors

The table of contents is a square, black-bordered module with a hard offset shadow. Its heading uses the large text size; nested ordered lists remove default markers, while generated numbers use small bold mono type. Heading permalink anchors appear as `#`, remain hidden until the heading is hovered or the anchor receives keyboard focus, and turn orange when interactive.

### Links and interactive states

Text links use the accessible dark-orange accent with an `0.08em` underline and `0.2em` offset. Visited links intentionally retain the same color. Hover states darken the accent. Boxed controls use vivid orange with black text and hard black borders. Keyboard focus is always visible through the shared focus token. Do not communicate state by color alone when a structural indicator such as an underline, border, or fill is practical.

### Pagination

Post navigation and list pagination are flex rows separated from content by a heavy top rule. Links are square, black-bordered controls with compact padding, bold text, and a hard offset shadow. Hover and current states use orange fills while retaining black text.

### Social sharing

Social links are centered in a row after a heavy top rule, with `--space-3` gaps. Each icon sits in a square bordered control with a hard offset shadow. Icons come from the locally served Font Awesome bundle and use `--font-size-xl`. This component should remain visually secondary to the article.

### Forms

Forms are single-column grids capped at `38rem`. Labels are bold. Inputs, textareas, and selects fill the available width and use a pale-orange surface, hard black border, and square corners. Textareas have a `10rem` minimum height and resize vertically. The primary button uses vivid orange with black bold text, a black border, and an offset shadow; hover and active states should feel immediate and mechanical.

### Quotes and code

Blockquotes use the soft orange accent wash with a heavy black border and hard offset shadow. This keeps quotations quieter than primary controls while retaining the brutalist frame. Inline code uses the pale-orange code palette, a black border, and square padding. Code blocks use a heavy black border and offset shadow, scroll horizontally, and are rendered in the mono face. Prism's Okaidia theme is loaded separately for syntax highlighting, so fenced highlighted code may use that theme's dark palette.

### Images and media

Article media is displayed as a full-width `16 / 9` frame with square corners, a black border, and a hard offset shadow. The default `object-fit` is `contain`; cover images override this to `cover`. Use `.image--contain` for screenshots or diagrams that must never be cropped. The selectors deliberately target block-level Markdown images and `<picture>` output while avoiding inline images such as emoji.

When adding content images:

- provide meaningful alternative text;
- prefer the default 16:9 presentation for consistency;
- use cover behavior only when cropping is acceptable;
- use contain behavior for diagrams, UI screenshots, and images where every edge matters.

## Accessibility and motion

- Text and interactive colors must maintain readable contrast against their surfaces.
- Every keyboard-operable control receives a visible `:focus-visible` treatment.
- Current navigation and pagination states use semantic attributes (`data-current` or `aria-current`) in addition to visual styling.
- Smooth scrolling is disabled when `prefers-reduced-motion: reduce` is active.
- Layout must remain usable as the main grid collapses and text scales.
- Icon-only controls need an accessible name; do not rely on the icon glyph alone.
- Preserve semantic heading order and the `68ch` reading measure in long-form content.

## Rules for future restyling

1. Start with tokens. Palette, type scale, spacing, measures, radii, and border changes belong in the token layer.
2. Preserve semantics. Restyle existing elements and component hooks without replacing meaningful HTML with generic wrappers.
3. Keep the CSS layered. Put normalization in `reset`, global element behavior in `base`, shell/grid behavior in `layout`, named patterns in `components`, and reusable single-purpose helpers in `utilities`.
4. Design mobile behavior alongside desktop behavior. Verify the two-column-to-single-column transition and the stacked header.
5. Keep interaction states complete: default, hover, visited where relevant, focus-visible, and current/selected.
6. Reuse the spacing scale and existing composition utilities. Add a token or primitive only when it will recur.
7. Keep long-form reading primary. Decorative treatments should not compete with article titles, prose, or images.
8. Test representative templates after changes: home, blog list, post with TOC/code/images, archive, standard page, and contact form.

## Known exceptions and cleanup opportunities

These are part of the current implementation but should not be copied into new work:

- `category.njk` and `year.njk` contain an inline `text-transform` style. A reusable class would better fit the system.
- Compatibility token aliases duplicate the canonical token set and should be retired only after confirming no generated or legacy content uses them.
- Syntax-highlighted code uses external Prism Okaidia styling rather than the local light code palette.
- Font weights requested from Google Fonts include values beyond the three semantic weight tokens. Prefer the named tokens in site CSS.
- Some icon-only social and pagination links need explicit accessible labels.

Treat these as migration notes, not as reasons to change behavior incidentally during unrelated restyling.