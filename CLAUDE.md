# Mortgage Viz

## Overview
Interactive heatmap visualization of monthly mortgage payments. Users configure loan parameters and see a D3-powered heatmap with house price on the x-axis and annual property tax on the y-axis. Each cell shows the estimated total monthly payment.

## Tech Stack
- Language: JavaScript (JSX)
- Framework: React (via Vite)
- Visualization: D3.js
- Styling: CSS (dark theme)
- Package manager: npm

## Commands
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (hot reload)
npm run build        # Production build to dist/
npm run preview      # Preview production build locally
```

## Core Features

### Heatmap
- X-axis: House price (configurable range, e.g. $100k-$800k)
- Y-axis: Annual property tax amount (e.g. $1,000-$15,000)
- Cell value: Total estimated monthly payment
- Color scale: Diverging or sequential, dark-theme friendly
- Tooltip on hover showing exact values

### Configurable Parameters (sidebar/controls)
- Interest rate (%)
- Loan term (15 or 30 years)
- Down payment (%)
- Insurance rate (annual %)
- HOA (monthly $)

### Monthly Payment Calculation
```
Total Monthly = Principal & Interest + Monthly Tax + Monthly Insurance + HOA

Principal & Interest = P * [r(1+r)^n] / [(1+r)^n - 1]
  where P = price - down payment, r = monthly rate, n = total months

Monthly Tax = annual tax amount / 12
Monthly Insurance = (price * insurance rate) / 12
```

## Visual Style
- Dark background (#1a1a2e or similar)
- Vibrant heatmap palette (cool-to-warm gradient)
- Clean sans-serif typography
- Controls panel on left or top, heatmap fills remaining space
- Responsive layout

## Project Structure
```
mortgage-viz/
├── CLAUDE.md
├── package.json
├── vite.config.js
├── index.html
├── public/
└── src/
    ├── main.jsx           # React entry point
    ├── App.jsx            # Root component (layout)
    ├── components/
    │   ├── Heatmap.jsx    # D3 heatmap visualization
    │   └── Controls.jsx   # Input controls panel
    ├── utils/
    │   └── mortgage.js    # Payment calculation functions
    └── styles/
        └── index.css      # Global styles (dark theme)
```

## Conventions
- Keep D3 rendering in useEffect/useRef hooks - don't fight React's DOM
- Pure calculation functions in utils/mortgage.js with no side effects
- Controls should update App state, which flows down to Heatmap as props
- Use CSS custom properties for theme colors so the palette is easy to tweak

## When Working Here
1. `npm install` if node_modules is missing
2. `npm run dev` to start the dev server
3. Open the URL shown in terminal (usually http://localhost:5173)
4. The heatmap should render immediately with default parameter values
