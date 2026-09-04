# @sahaibat/anc-engine

Indonesia's **10T** antenatal standard as executable rules: parsing, quality
scoring, and clinical flags. Pure functions — no database, no network, no
environment variables, zero dependencies.

```ts
import { parseAncData, score10T, generateClinicalFlags, shouldRefer } from '@sahaibat/anc-engine';
```

## Why it is a package

Two surfaces record an ANC visit: the Bidan app and the WhatsApp fallback in
`sahaibat-healthcare`. If they run different copies of these rules, they can
disagree about whether a mother is pre-eclamptic — and nobody would notice,
because both would look like they were working.

Being pure is also what lets the app score a visit and raise flags **with no
signal at all**. That is the point of the offline design, not a side effect.

## What is in it

| Module | Job |
|---|---|
| `parseBidanInput` | One free-text line → ~30 typed clinical fields |
| `score10T` | Scores the visit against the 10T standard, adjusted for gestational age |
| `clinicalFlags` | 37 threshold rules → EMERGENCY / WARNING / INFO, and a referral decision |

`score10T` scores the **midwife**, not the mother: it counts which of the ten
mandated procedures were actually performed, while excluding items not yet due
— fundal height before 12 weeks, fetal presentation before 36. Penalising a
measurement that is not yet clinically meaningful would push people to record
numbers rather than to do the work.

## Tests

```
npm test
```

76 assertions, no framework. They exist to **pin clinical thresholds** — Hb < 8
is severe anaemia, LILA < 23.5 is KEK, DJJ outside 120–160 is abnormal, high BP
alone is hypertension but high BP *with* proteinuria is pre-eclampsia. If one
fails, either something broke in extraction or someone moved a threshold, and
both need a clinician to look rather than a green tick.

Boundary cases are asserted on both sides deliberately: Hb 8.0 is mild not
severe, LILA 23.5 is not KEK, 139/89 is below the hypertension threshold.

## Provenance

Extracted verbatim from `sahaibat-healthcare/lib/triage/` — `parseBidanInput.ts`,
`score10T.ts` and `clinicalFlags.ts` were already dependency-free, so this was a
move rather than a rewrite, and the copies are byte-identical to the originals.

The server should import from here and delete its local copies, so there is one
definition rather than two that drift.

## Install

```json
"@sahaibat/anc-engine": "github:Viantra-Health/sahaibat-anc-engine"
```

Source-only. Consumers add it to `transpilePackages` in `next.config.js`.
Must be a **public** repo, or Vercel builds cannot resolve it without a token.
