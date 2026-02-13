

# Fix: Infinite Re-render in RouteHistoryImporter

## Root Cause

In `src/components/route/RouteHistoryImporter.tsx` (lines 62-64), `loadPatterns()` is called directly in the component body:

```typescript
if (!loaded && user) {
  loadPatterns();
}
```

This is a **state update during render**. `loadPatterns()` calls `setLoadingPatterns(true)` synchronously, which triggers a new render before `loaded` becomes `true` (async). This creates an infinite loop.

## Fix

Replace the direct call with a `useEffect`:

**File:** `src/components/route/RouteHistoryImporter.tsx`

Replace lines 61-64:
```typescript
// Load on first render
if (!loaded && user) {
  loadPatterns();
}
```

With:
```typescript
useEffect(() => {
  if (!loaded && user) {
    loadPatterns();
  }
}, [user, loaded, loadPatterns]);
```

Also add `useEffect` to the import on line 1:
```typescript
import { useState, useCallback, useEffect } from 'react';
```

This is a one-line structural change that eliminates the infinite re-render loop.

