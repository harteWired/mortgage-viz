@../../CLAUDE.md

# Mortgage Viz

Interactive heatmap of monthly mortgage payments. D3-powered heatmap with house price on x-axis and annual property tax on y-axis. Each cell shows estimated total monthly payment.

## Commands

```bash
npm install
npm run dev          # Vite dev server (hot reload)
npm run build        # Production build to dist/
npx playwright test  # E2E tests (dev server must be running)
```

## Core Features

### Heatmap Axes
- X-axis: House price (configurable range, e.g. $100k-$800k)
- Y-axis: Annual property tax amount (e.g. $1,000-$15,000)
- Cell value: Total estimated monthly payment
- Tooltip on hover showing exact values

### Configurable Parameters
Interest rate, loan term (15/30yr), down payment %, insurance rate, HOA

### Monthly Payment Calculation
```
Total Monthly = P&I + Monthly Tax + Monthly Insurance + HOA
P&I = P * [r(1+r)^n] / [(1+r)^n - 1]
  where P = price - down payment, r = monthly rate, n = total months
```

## Visual Style

Dark background (#1a1a2e), cool-to-warm heatmap gradient, clean sans-serif type. Controls panel on left, heatmap fills remaining space. Responsive layout.

## Conventions

- Keep D3 rendering in useEffect/useRef hooks — don't fight React's DOM
- Pure calculation functions in `utils/mortgage.js` with no side effects
- Controls update App state, which flows down to Heatmap as props
- Use CSS custom properties for theme colors

## Testing

- E2E tests use Playwright (`@playwright/test`) in `tests/`
- Dev server must be running before running tests
- `test-results/` is gitignored ephemeral output
