# Drishti Design System
## Futuristic Minimal AI-Native Grayscale Design

---

## 🎨 Color Palette

### Background Layers (Pure Black → Soft Charcoal)
```
bg-primary:    #000000  - Pure black, main background
bg-secondary:  #0A0A0A  - Soft black, elevated surfaces
bg-tertiary:   #111111  - Charcoal, cards & containers
bg-elevated:   #1A1A1A  - Elevated panels
bg-subtle:     #0F0F0F  - Subtle backgrounds
```

### Text Colors (White → Gray → Zinc)
```
text-primary:   #FFFFFF  - Headings, emphasis
text-secondary: #E5E5E5  - Body content
text-tertiary:  #A3A3A3  - Labels, captions
text-muted:     #737373  - Placeholders, hints
text-disabled:  #525252  - Disabled state
```

### Border Colors (Subtle → Visible)
```
border-subtle:  #1A1A1A  - Barely visible
border-default: #262626  - Default borders
border-medium:  #404040  - Medium emphasis
border-strong:  #525252  - Strong borders
border-accent:  #737373  - Accent borders
```

### Interactive States
```
interactive-primary:   #FFFFFF  - Primary buttons
interactive-secondary: #E5E5E5  - Secondary buttons
interactive-hover:     #F5F5F5  - Hover state
interactive-active:    #D4D4D4  - Active/pressed
```

### Glass & Overlays
```
overlay-light:  rgba(255, 255, 255, 0.05)
overlay-medium: rgba(255, 255, 255, 0.10)
overlay-strong: rgba(255, 255, 255, 0.15)
glass-bg:       rgba(10, 10, 10, 0.6)
glass-border:   rgba(255, 255, 255, 0.08)
```

---

## 📝 Typography Hierarchy

### Headings
```
h1: 3.75rem (60px) - font-weight: 700, letter-spacing: -0.02em
h2: 3rem (48px)    - font-weight: 700, letter-spacing: -0.02em
h3: 2.25rem (36px) - font-weight: 700, letter-spacing: -0.02em
h4: 1.875rem (30px)- font-weight: 700, letter-spacing: -0.02em
h5: 1.5rem (24px)  - font-weight: 700, letter-spacing: -0.02em
h6: 1.25rem (20px) - font-weight: 700, letter-spacing: -0.02em
```

### Body Text
```
base: 1rem (16px)     - line-height: 1.6
lg:   1.125rem (18px) - line-height: 1.75
sm:   0.875rem (14px) - line-height: 1.25
xs:   0.75rem (12px)  - line-height: 1
```

### Usage Classes
```
.text-heading - White, bold, tight letter-spacing
.text-body    - Light gray (#E5E5E5), readable line-height
.text-caption - Medium gray (#A3A3A3), small size
.text-muted   - Dark gray (#737373), subdued
```

---

## 🔲 Border Styles

### Border Classes
```
.border-thin-subtle  - 1px solid #1A1A1A (barely visible)
.border-thin-default - 1px solid #262626 (default)
.border-thin-medium  - 1px solid #404040 (medium)
.border-thin-strong  - 1px solid #525252 (strong)
```

### Accent Borders
```
.border-accent-top    - Elegant top border
.border-accent-bottom - Elegant bottom border
```

### Border Radius Scale
```
sm:  0.25rem (4px)
md:  0.625rem (10px)
lg:  0.75rem (12px)
xl:  1rem (16px)
2xl: 1.25rem (20px)
3xl: 1.5rem (24px)
```

---

## 🪟 Glassmorphism

### Glass Variants
```css
.glassmorphism
  background: rgba(10, 10, 10, 0.6)
  backdrop-filter: blur(20px)
  border: 1px solid rgba(255, 255, 255, 0.08)

.glassmorphism-light
  background: rgba(26, 26, 26, 0.7)
  backdrop-filter: blur(16px)
  border: 1px solid rgba(255, 255, 255, 0.12)

.glassmorphism-strong
  background: rgba(17, 17, 17, 0.8)
  backdrop-filter: blur(24px)
  border: 1px solid rgba(255, 255, 255, 0.15)
```

---

## 📦 Card Components

### Base Card
```css
.card-base
  background: #111111
  border: 1px solid #262626
  border-radius: 0.75rem
  padding: 1.5rem
```

### Elevated Card
```css
.card-elevated
  background: #1A1A1A
  border: 1px solid #404040
  box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.15)
```

### Hover Card
```css
.card-hover:hover
  transform: translateY(-2px)
  border-color: #525252
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2)
```

---

## 📏 Spacing System

### Standard Scale
```
0.25rem (4px)   - xs spacing
0.5rem (8px)    - sm spacing
0.75rem (12px)  - base spacing
1rem (16px)     - md spacing
1.5rem (24px)   - lg spacing
2rem (32px)     - xl spacing
3rem (48px)     - 2xl spacing
4rem (64px)     - 3xl spacing
6rem (96px)     - section spacing
```

### Section Spacing
```
.spacing-section - 6rem top/bottom padding
.spacing-container - Responsive horizontal padding
```

---

## 🎬 Animations

### Available Animations
```
animate-glow-pulse  - Subtle pulsing glow effect
animate-slide-in    - Slide in from bottom
animate-fade-in     - Simple fade in
animate-scan        - Scanning line effect
animate-float-slow  - Slow floating animation
```

### Transition Timing
```
Duration: 0.2s - Interactive elements
Duration: 0.3s - Card hover effects
Duration: 0.6s - Page transitions
Easing: cubic-bezier(0.4, 0, 0.2, 1)
```

---

## 🖱️ Interactive States

### Focus States
```
outline: 2px solid rgba(255, 255, 255, 0.3)
outline-offset: 2px
```

### Hover States
- Buttons: slight scale (1.02x) or background change
- Cards: translateY(-2px) + border color change
- Links: color shift to #D4D4D4

### Disabled States
```
opacity: 0.5
cursor: not-allowed
background-color: #0A0A0A
```

---

## 🎨 Background Patterns

### Grid Pattern
```css
.grid-background
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
  background-size: 50px 50px
```

### Dot Pattern
```css
.dot-background
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)
  background-size: 20px 20px
```

---

## 🌓 Dark Mode

The entire system is built for dark mode:
- All backgrounds start from pure black (#000000)
- Text hierarchy ensures readability on dark backgrounds
- Borders use subtle whites/grays for minimal contrast
- Glass effects provide depth without color
- All interactive states optimized for dark theme

---

## 💡 Best Practices

1. **Use semantic color names** - `text-primary`, `bg-tertiary` instead of direct hex
2. **Maintain hierarchy** - h1-h6 for headings, text-body for content
3. **Consistent spacing** - Use the defined spacing scale
4. **Subtle borders** - Default to `border-thin-default` or `border-subtle`
5. **Glass over solid** - Use glassmorphism for floating elements
6. **Minimal animations** - Subtle hover effects, no excessive motion
7. **Tight letter-spacing** - Negative tracking for headings (-0.02em to -0.04em)

---

## 🚀 Usage Examples

### Primary Button
```jsx
<button className="bg-interactive-primary text-bg-primary px-6 py-3 rounded-lg font-medium">
  Click Me
</button>
```

### Card Component
```jsx
<div className="card-base card-hover">
  <h3 className="text-heading text-2xl mb-3">Title</h3>
  <p className="text-body">Content goes here</p>
</div>
```

### Glassmorphism Header
```jsx
<header className="glassmorphism border-b border-border-default">
  <div className="max-w-7xl mx-auto px-4 py-4">
    Navigation
  </div>
</header>
```

---

**Design Philosophy**: Minimal. Futuristic. AI-Native. Human-Crafted.
