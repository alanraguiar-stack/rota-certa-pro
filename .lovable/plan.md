

# Fix: ADV import error + duplicate upload locations

## Root cause

**Error: "invalid input syntax for type integer: '15.01'"**

The `order_items.quantity` column is `integer` in the database. When the ADV parser extracts quantities like `15.01` (from BR number format parsing), the decimal value gets inserted directly, causing a PostgreSQL type error.

The parser at line 1469 of `advParser.ts` sets `quantity: isWeightBased ? 1 : (itemQuantity > 0 ? itemQuantity : 1)` — this can be a float like `15.01` for non-weight items.

Similarly, `weight_kg` based items set `quantity: 1` (fine), but for unit-based items the raw parsed float passes through.

**Duplicate upload locations**: The `import_adv` step has both `ADVUploadSection` AND `LoadingManifest` (which has its own ADV upload inside). Need to keep only `ADVUploadSection`.

## Changes

### 1. `src/hooks/useRoutes.ts` — Round quantity to integer before insert

In the `reimportItems` mutation (~line 1257), wrap `quantity` with `Math.round()`:

```typescript
quantity: Math.round(item.quantity),
```

This ensures all quantities are integers before hitting the DB.

### 2. `src/pages/RouteDetails.tsx` — Remove duplicate upload

In the `import_adv` step (~line 1005-1013), remove the `onReimportItems` and `isReimporting` props from `LoadingManifest` so it only displays the consolidated manifest without its own upload button. The `ADVUploadSection` above it is the single upload point.

```typescript
<LoadingManifest
  routeName={route.name}
  date={new Date(route.created_at).toLocaleDateString('pt-BR')}
  trucks={truckDataForComponents}
  routeId={route.id}
  // Remove onReimportItems and isReimporting — upload only via ADVUploadSection
/>
```

### 3. `src/lib/advParser.ts` — Ensure quantity is always integer at parse time

At line 1469, round the quantity:

```typescript
quantity: isWeightBased ? 1 : Math.round(itemQuantity > 0 ? itemQuantity : 1),
```

## Result
- No more "invalid input syntax for integer" errors
- Single upload location for ADV file (the prominent `ADVUploadSection`)
- `LoadingManifest` only shows the consolidated data, no redundant upload

