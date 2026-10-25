// @sahaibat/anc-engine · src/kbCategory.ts
//
// THE CATEGORY, THE AGGREGATION RULE, AND THE ROWS WE DO NOT HAVE.
//
// ── WHAT THE PEDOMAN ACTUALLY GIVES US ──────────────────────────────────────
//
// Pedoman Pelayanan Kontrasepsi dan Keluarga Berencana, Kemenkes 2020:
//
//   p99       the four categories, defined
//   p100      the facility-tier simplification: at a limited facility 1-2
//             collapse to "boleh" and 3-4 to "tidak boleh"
//   p101      the scales that are NOT 1-4 — A/C/D for fertility awareness,
//             A/C/D/S for tubektomi and vasektomi
//   p102-103  how Roda KLOP is read, and what a letter suffix means
//   p104      the tabel bantu: its eight method columns, three worked rows,
//             and the rule for which methods are recommended
//   p105      what happens after: agree -> informed consent; disagree ->
//             re-counsel next visit, barrier method meanwhile
//
// What it does NOT give is the matrix. The condition-by-method categories live
// on the Roda KLOP wheel itself, which we do not hold. So this file carries
// the STRUCTURE and the RULES, which are fully sourced, and exactly the three
// rows the book prints. Everything else answers 'unknown' and says so.
//
// ── THE AGGREGATION RULE, PROVEN RATHER THAN ASSUMED ────────────────────────
//
// A woman usually has more than one condition, and the book never states in
// words how to combine them. Its worked example does. For a client who is
// 48 hours to 4 weeks postpartum, hypertensive at 160+, and diabetic, p104
// concludes: pil progestin, implan, vasektomi.
//
// Taking the WORST category per method across her conditions reproduces that
// list exactly -- PP 2, implan 2, vasektomi C recommended; KIK 4, DMPA 3,
// AKDR-Cu 3, AKDR-LNG 3, tubektomi S not. Any other aggregation (best, first,
// average) gives a different answer. So worst-wins is the rule, and it is
// checkable against a printed example rather than taken on trust.

import { kbFormulation, type KbFormulationCode } from './contraception';

/** 1-4 for ordinary methods; A/C/D for fertility awareness; A/C/D/S for surgery. */
export type KbCategory = 1 | 2 | 3 | 4 | 'A' | 'C' | 'D' | 'S';
/** A dash in the printed table: this condition has no bearing on this method. */
export type KbCell = KbCategory | 'na';

/** The eight columns of the Pedoman p104 tabel bantu, as printed. */
export type KbMethodColumn =
  | 'KIK' | 'PP' | 'DMPA_NETEN' | 'IMPLAN' | 'AKDR_CU' | 'AKDR_LNG'
  | 'TUBEKTOMI' | 'VASEKTOMI';

/**
 * Which column a formulation is scored under.
 *
 * COARSER THAN OUR FORMULATIONS, and deliberately not corrected. KIK covers
 * the combined methods together, and DMPA and NET-EN share one column — the
 * wheel does not separate them, so neither does this. Splitting a column the
 * source keeps joined would be inventing a distinction.
 *
 * The book never expands "KIK". Its categories in the worked rows match the
 * combined-hormonal profile (4 at BP 160+, 4 under 4 weeks postpartum), which
 * is why the combined formulations map to it; the expansion itself is not
 * asserted here because the source does not give it.
 */
const COLUMN_OF: Partial<Record<KbFormulationCode, KbMethodColumn>> = {
  kpk: 'KIK', ksk: 'KIK',
  kpp: 'PP',
  ksp_dmpa: 'DMPA_NETEN', ksp_neten: 'DMPA_NETEN',
  implan: 'IMPLAN',
  akdr_cu: 'AKDR_CU',
  akdr_lng: 'AKDR_LNG',
  mow: 'TUBEKTOMI',
  mop: 'VASEKTOMI',
};

export function columnFor(formulation: unknown): KbMethodColumn | null {
  const f = kbFormulation(formulation);
  return f ? (COLUMN_OF[f.code] ?? null) : null;
}

/* ── THE ROWS WE HAVE ──────────────────────────────────────────────────────
 *
 * Exactly the three the Pedoman prints on p104, no more.
 *
 * A DASH IS NOT A BLANK, and getting that wrong cost a wrong answer. The
 * first version of this table dropped the printed dashes, so vasektomi came
 * back 'unknown' for the p104 client while the book plainly recommends it:
 * two of her three conditions have a dash in that column, and dropping them
 * made them look untranscribed. A dash means the condition has no bearing on
 * that method -- hypertension in the woman says nothing about her husband's
 * vasectomy -- which is information, and 'na' now carries it.
 *
 * 'A/D' on tubektomi for the postpartum row is stored as printed: two codes,
 * meaning the answer depends on circumstances the wheel's back page explains.
 * Flattening it to one would be choosing on the source's behalf.
 */
export interface CategoryRow {
  condition: string;
  label_id: string;
  label_en: string;
  cells: Partial<Record<KbMethodColumn, readonly KbCell[]>>;
  source: string;
}

export const CATEGORY_ROWS: readonly CategoryRow[] = [
  {
    condition: 'htn_160_100',
    label_id: 'Hipertensi 160 mmHg atau lebih',
    label_en: 'Hypertension 160 mmHg or above',
    cells: { KIK: [4], PP: [2], DMPA_NETEN: [3], IMPLAN: [2], AKDR_CU: [1], AKDR_LNG: [1], TUBEKTOMI: ['S'], VASEKTOMI: ['na'] },
    source: 'Pedoman 2020 p104',
  },
  {
    condition: 'diabetes',
    label_id: 'Diabetes melitus',
    label_en: 'Diabetes mellitus',
    cells: { KIK: [2], PP: [2], DMPA_NETEN: [2], IMPLAN: [2], AKDR_CU: [1], AKDR_LNG: [2], TUBEKTOMI: ['C'], VASEKTOMI: ['C'] },
    source: 'Pedoman 2020 p104',
  },
  {
    condition: 'pp_48h_4w',
    label_id: 'Pascapersalinan 48 jam sampai kurang dari 4 minggu',
    label_en: '48 hours to under 4 weeks postpartum',
    cells: { KIK: [4], PP: [2], DMPA_NETEN: [3], IMPLAN: [2], AKDR_CU: [3], AKDR_LNG: [3], TUBEKTOMI: ['A', 'D'], VASEKTOMI: ['na'] },
    source: 'Pedoman 2020 p104',
  },
];

const ROW_OF = new Map(CATEGORY_ROWS.map((r) => [r.condition, r]));

/* ── THE RULE ──────────────────────────────────────────────────────────── */

/** p104: 1 and 2 are recommended; A and C are, for the surgical methods. */
export function isRecommended(c: KbCategory): boolean {
  return c === 1 || c === 2 || c === 'A' || c === 'C';
}

/**
 * The worst of several categories. Proven against the p104 worked example.
 *
 * Numbers order naturally. Letters order S worst, then D, then C, then A —
 * which is the same direction as the numbers and the same split p104 draws
 * between recommended and not. A number and a letter never meet in one cell,
 * because a method is scored on one scale.
 */
const LETTER_RANK: Record<string, number> = { A: 1, C: 2, D: 3, S: 4 };
export function worstCategory(cats: readonly KbCategory[]): KbCategory | null {
  if (cats.length === 0) return null;
  const nums = cats.filter((c): c is 1 | 2 | 3 | 4 => typeof c === 'number');
  if (nums.length) return Math.max(...nums) as 1 | 2 | 3 | 4;
  const lets = cats.filter((c): c is 'A' | 'C' | 'D' | 'S' => typeof c === 'string');
  if (!lets.length) return null;
  return lets.reduce((a, b) => (LETTER_RANK[b] > LETTER_RANK[a] ? b : a));
}

export type Verdict = 'recommended' | 'not_recommended' | 'unknown';

export interface MethodVerdict {
  formulation: KbFormulationCode;
  column: KbMethodColumn | null;
  verdict: Verdict;
  /** The worst category found, or null when nothing is known. */
  category: KbCategory | null;
  /** Conditions that had a row. */
  scored: string[];
  /** Conditions with NO transcribed row — why a verdict may be unknown. */
  unscored: string[];
  source: string | null;
}

/**
 * What the transcribed rows say about this formulation, for these conditions.
 *
 * UNKNOWN IS THE DEFAULT AND IS NOT A FAILURE. Only three rows exist, so most
 * real clients will return 'unknown' with their conditions listed under
 * `unscored`. That is the honest answer, and it is what sends the clinician to
 * Roda KLOP. A verdict of 'recommended' derived from an empty table would be
 * the most dangerous output this package could produce.
 *
 * A condition WITH a row but no cell for that column is also unknown, not
 * safe: a blank cell in the book is not a verdict.
 */
export function verdictFor(
  formulation: unknown,
  conditionCodes: readonly string[],
): MethodVerdict | null {
  const f = kbFormulation(formulation);
  if (!f) return null;
  const column = COLUMN_OF[f.code] ?? null;

  const scored: string[] = [];
  const unscored: string[] = [];
  const found: KbCategory[] = [];

  for (const code of conditionCodes) {
    const row = ROW_OF.get(code);
    const cell = row && column ? row.cells[column] : undefined;
    if (row && cell && cell.length) {
      /* 'na' is an ANSWER -- the book printed a dash -- so the condition
         counts as scored and simply contributes no category. Treating it as
         unscored is what made vasektomi come back unknown. */
      scored.push(code);
      found.push(...cell.filter((c): c is KbCategory => c !== 'na'));
    } else unscored.push(code);
  }

  const worst = worstCategory(found);
  /* Any unscored condition makes the whole verdict unknown. Saying
     "recommended" while silently ignoring a condition nobody has a row for
     is exactly the failure this guard exists to prevent. */
  const verdict: Verdict =
    worst === null || unscored.length > 0
      ? 'unknown'
      : (isRecommended(worst) ? 'recommended' : 'not_recommended');

  return {
    formulation: f.code, column, verdict, category: worst,
    scored, unscored,
    source: scored.length ? 'Pedoman 2020 p104' : null,
  };
}

/* ── FROM THE SCREENING'S VOCABULARY TO THE TABLE'S ────────────────────── */

/**
 * The screening and the category table name some conditions differently.
 *
 * kbScreening's codes come from the per-method prose lists; these come from
 * the p104 table's row labels, and the two were written by the same ministry
 * at different levels of detail. Two of the three already match exactly
 * (htn_160_100, pp_48h_4w); the table's row is simply "DM" where the prose
 * list says "diabetes over 20 years, or with vascular damage".
 *
 * THE ALIAS GOES ONLY ONE WAY, from the narrower prose condition to the
 * broader table row. A client whose record says long-standing diabetes is
 * covered by the DM row; the reverse does not hold, and nothing here infers
 * the prose condition from the table.
 */
const ALIASES: Record<string, string> = {
  diabetes_20y_or_damage: 'diabetes',
};

/**
 * Which category rows these screening conditions correspond to.
 *
 * Unmapped codes are RETURNED AS THEY ARE rather than dropped, so verdictFor()
 * counts them as unscored and the verdict goes to 'unknown'. Dropping them
 * would quietly shrink her condition list and produce a confident answer
 * about a woman whose other conditions were never considered.
 */
export function categoryConditions(codes: readonly string[]): string[] {
  return codes.map((c) => ALIASES[c] ?? c);
}

/**
 * Category conditions from ALL her clinical facts, not just the screening.
 *
 * ── THE BUG THIS EXISTS TO FIX ─────────────────────────────────────────────
 *
 * Found in end-to-end testing, 24 Oct 2026, and it was the dangerous
 * direction. The verdict was built only from screening answers, and
 * `pp_48h_4w` appears on the COPPER IUD screening list and no other — so for
 * a woman 23 days postpartum the combined pill came back "recommended,
 * category 2" when the p104 table scores that row KIK 4.
 *
 * Two of four methods changed once the postpartum row was included, both
 * toward not-recommended. A screening list says which conditions a given
 * method's own page discusses; it is NOT the list of facts true about her.
 * The category table is indexed by condition, not by method, so every row
 * that applies to her applies to every method.
 *
 * `today` defaults to now. A null delivery date simply contributes nothing.
 */
export function categoryConditionsFrom(facts: {
  screeningPresent?: readonly string[];
  deliveryDate?: string | null;
  today?: string | Date;
}): string[] {
  const out = new Set(categoryConditions(facts.screeningPresent ?? []));

  const d = String(facts.deliveryDate ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    const nowRaw = facts.today ?? new Date();
    const now = typeof nowRaw === 'string' ? nowRaw : nowRaw.toISOString().slice(0, 10);
    const day = Math.round((Date.parse(now.slice(0, 10)) - Date.parse(d.slice(0, 10))) / 86_400_000);
    /* 48 hours to under 4 weeks, as the row is labelled. Day 0 and 1 are
       outside it -- the Pedoman treats the first 48 hours separately -- and so
       is day 28 onwards. */
    if (day >= 2 && day < 28) out.add('pp_48h_4w');
  }

  return [...out];
}

/* ── THE FACILITY TIER ─────────────────────────────────────────────────── */

export type FacilityTier = 'lengkap' | 'terbatas';

/**
 * How a category is shown at this facility. Pedoman p100.
 *
 * At a limited facility — the book names a Puskesmas — categories 1 and 2 are
 * shown as one ("boleh digunakan") and 3 and 4 as the other ("tidak boleh").
 * At a full clinic all four are shown. The surgical letters are untouched:
 * p100 speaks only of the 1-4 scale.
 */
export function displayCategory(
  c: KbCategory | null,
  tier: FacilityTier,
): { text_id: string; text_en: string; recommended: boolean | null } {
  if (c === null) {
    return { text_id: 'Belum diketahui', text_en: 'Not known', recommended: null };
  }
  const ok = isRecommended(c);
  if (typeof c === 'string') {
    return {
      text_id: `Kategori ${c}`, text_en: `Category ${c}`, recommended: ok,
    };
  }
  if (tier === 'terbatas') {
    return {
      text_id: ok ? 'Boleh digunakan' : 'Tidak boleh digunakan',
      text_en: ok ? 'May be used' : 'May not be used',
      recommended: ok,
    };
  }
  return { text_id: `Kategori ${c}`, text_en: `Category ${c}`, recommended: ok };
}

/* ── AFTER THE SCREENING ───────────────────────────────────────────────── */

/**
 * What p105 says to do once she has heard the result.
 *
 * Included because it is the step most likely to be dropped: a product that
 * ends at the verdict leaves the clinician with a screen and no next move,
 * and the book is explicit that disagreement is a legitimate outcome with its
 * own path rather than a refusal to be overridden.
 */
export const AFTER_SCREENING = {
  agrees: {
    id: 'Lanjutkan dengan informed consent, lalu berikan pelayanan sesuai standar.',
    en: 'Continue to informed consent, then provide the service to standard.',
  },
  disagrees: {
    id: 'Lakukan konseling ulang pada kunjungan berikutnya, atau beri kesempatan berdiskusi dengan pasangan. Sementara itu anjurkan metode barier atau kondom.',
    en: 'Re-counsel at the next visit, or give her the chance to discuss it with her partner. Meanwhile recommend a barrier method or condoms.',
  },
  source: 'Pedoman 2020 p105',
} as const;
