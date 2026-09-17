# Panda AI Pet

## Assets and processing

The supplied pose sheet is `public/assets/pet.png`. Generated transparent sprite strips and the runtime manifest are in `public/panda/`.

Regenerate them after changing `scripts/panda-assets.json`:

```powershell
cd E:\Hanflix\frontend
py -3 scripts/process_panda_assets.py
```

The reusable Pillow pipeline crops the configured grid cell, removes only near-white background connected to the crop edges, normalizes the subject against a bottom-center anchor, and writes lossless WebP strips. The source currently has one pose per action rather than true temporal frames, so motion profiles create subtle scale/translation frames without redrawing the Panda.

To add an action, add its grid cell and motion metadata to `scripts/panda-assets.json`, add a motion profile in the script, regenerate assets, then extend `PandaState` if it is a new runtime state.

## Runtime states

Available states are `idle`, `thinking`, `working`, `searching`, `success`, `sleeping`, and `error`.

```tsx
import { usePandaPet } from './components/panda-pet';

const { setPandaState, handlePandaAIEvent } = usePandaPet();
setPandaState('thinking');
handlePandaAIEvent({ type: 'tool_start' });
```

`success` and `error` automatically return to `idle`; changing state first cancels that old timeout. Inactivity moves `idle` to `sleeping`, and user activity wakes it. Position is clamped and saved under `panda-pet-position` in local storage.

The AI event adapter accepts `thinking`, `searching`, `tool_start`, `tool_end`, `completed`, and `error`. A future SSE client should parse backend events and call `handlePandaAIEvent`; the backend does not need to know sprite details.

## Development playground

Run `pnpm dev`, then open `http://localhost:5173/dev/panda`. It exposes state controls, the full test flow, animation metadata, position, and reduced-motion status. Vite excludes this route from the production UI.
