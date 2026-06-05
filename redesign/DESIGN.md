---
name: Neon Glass Audio
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#b9caca'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#849495'
  outline-variant: '#3a494a'
  surface-tint: '#00dce5'
  primary: '#e9feff'
  on-primary: '#003739'
  primary-container: '#00f5ff'
  on-primary-container: '#006c71'
  inverse-primary: '#00696e'
  secondary: '#ffabf3'
  on-secondary: '#5b005b'
  secondary-container: '#fe00fe'
  on-secondary-container: '#500050'
  tertiary: '#f6ffd3'
  on-tertiary: '#283500'
  tertiary-container: '#bfef00'
  on-tertiary-container: '#536900'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#63f7ff'
  primary-fixed-dim: '#00dce5'
  on-primary-fixed: '#002021'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#ffd7f5'
  secondary-fixed-dim: '#ffabf3'
  on-secondary-fixed: '#380038'
  on-secondary-fixed-variant: '#810081'
  tertiary-fixed: '#c3f400'
  tertiary-fixed-dim: '#abd600'
  on-tertiary-fixed: '#161e00'
  on-tertiary-fixed-variant: '#3c4d00'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  headline-xl:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  data-display:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1440px
---

## Brand & Style

This design system establishes a high-fidelity, cyberpunk aesthetic tailored for immersive audio visualization. The brand personality is technical, energetic, and futuristic, prioritizing "performance" through high-contrast accents and "depth" through layered translucency.

The visual style is a hybrid of **Cyberpunk Minimalism** and **Glassmorphism**. It utilizes deep charcoal backgrounds to allow vibrant neon data to "pop" with emissive glows. Surfaces are treated as frosted digital panes—semi-transparent with back-drop blurs—creating a sense of sophisticated, multi-layered information architecture. The emotional response is one of precision, late-night focus, and cutting-edge digital craftsmanship.

## Colors

The palette is anchored in a dark-mode-only experience. The core background is a "Deep Void" charcoal, providing the necessary contrast for the neon accent system.

- **Primary (Cyan):** Used for active data states, primary interactive elements, and focused glowing borders.
- **Secondary (Magenta):** Reserved for peak indicators, high-frequency data, and secondary UI highlights.
- **Tertiary (Lime):** Applied to success states, hardware status, and alternative visualizer modes.
- **Neutrals:** A range of deep grays and blacks are used to define the "glass" containers and structural scaffolding.

Surface colors must always utilize an alpha channel (70-85% opacity) to facilitate the glassmorphic effect when layered over moving visualizers.

## Typography

The typography strategy pairs the geometric, modern **Sora** for headlines with the technical, monospaced **JetBrains Mono** for all functional data and body text. 

- **Headlines:** Use Sora to provide a bold, futuristic look. Tracking should be tightened for large display sizes to maintain a compact, "designed" feel.
- **Functional Text:** JetBrains Mono is used for all settings, sliders, and audio readouts to emphasize the "tool" nature of the application. Its fixed width ensures that rapidly changing numerical data (like decibel levels or frequencies) does not cause layout jitter.
- **Hierarchy:** High contrast in weight and the use of uppercase labels for technical parameters help users navigate dense control panels quickly.

## Layout & Spacing

This design system uses a **Modular Fluid Grid** based on 4px increments. The layout is designed to maximize the "Canvas" area—the region where the audio visualization occurs—while pinning controls to the perimeter or floating them in glass modules.

- **Desktop:** A 12-column grid with 16px gutters. Control panels should be docked in sidebars or bottom "dashboards" that use backdrop blurs.
- **Mobile:** A single-column stack. Bottom-anchored sheets provide access to settings, ensuring the visualizer remains visible in the upper two-thirds of the screen.
- **Rhythm:** Generous internal padding (24px - 32px) within glass cards prevents the dense technical data from feeling cluttered.

## Elevation & Depth

Depth is conveyed through **Backdrop Refraction** rather than traditional shadows. 

1. **Base Layer:** The darkest neutral black, serving as the "void" for background visualizer particles.
2. **Glass Layer:** 70% opacity charcoal with a `backdrop-filter: blur(20px)`. This creates the signature glassmorphic look.
3. **Interactive Layer:** Elements like buttons or active sliders use a `box-shadow` of 0 0 15px of their respective neon accent color to simulate "light emission."
4. **Border Details:** Every glass card features a 1px inner border. The top and left edges use a higher opacity to simulate a subtle top-down light source reflecting off the glass edge.

## Shapes

The shape language is primarily **Soft-Industrial**. We use a base `rounded-sm` (4px) for most interactive components to maintain a technical, "machined" edge, while parent glass containers use `rounded-lg` (16px) to soften the overall interface and make it feel like a modern piece of software hardware.

Visualizer bars and data points should remain sharp (0px) to emphasize digital precision.

## Components

- **Glass Cards:** The primary container. Must include a 1px border (`rgba(255,255,255,0.1)`) and `backdrop-filter: blur(12px)`.
- **Neon Sliders:** Tracks are dark charcoal. The active "fill" uses a neon gradient (e.g., Cyan to Blue). The thumb/handle is a bright white circle with a neon outer glow.
- **Action Buttons:** Ghost-style buttons with neon borders. On hover, the background fills with a 10% opacity neon tint, and the border glow intensifies.
- **Status Chips:** Small, monospaced text indicators with a leading dot. The dot pulses when a data stream is active.
- **Data Visualizers:** All bars, waves, and points should utilize additive blending modes (`screen` or `color-dodge`) to ensure colors become more intense where they overlap.
- **Segmented Controls:** Used for switching between "Bars", "Waveform", and "Spectrum". Selected states are indicated by an underline glow in the Primary color.