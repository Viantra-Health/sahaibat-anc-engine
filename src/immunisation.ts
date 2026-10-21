// @sahaibat/anc-engine · src/immunisation.ts
//
// THE CHILD IMMUNISATION SCHEDULE, ONCE.
//
// ── WHY IT IS HERE AND NOT IN THREE PLACES ──────────────────────────────────
//
// Before this file there were THREE vocabularies for the same vaccines, and
// two of them were wrong about the data:
//
//   sahai_immunization_records   DPT_HB_HIB + dose_number      935 rows, REAL
//   kasih_immunisation_tracker   DPT1, MR1, ROTA1, POLIO0      200 rows, 0 used
//   ngo/layer2/route.ts          DPT_HB_HIB_1 (code + '_' + n) a hardcoded map
//
// The third agrees with the first because it derives `code_dose` at read time.
// The second does not agree with anything: it renames DPT_HB_HIB to DPT,
// CAMPAK_R to MR, RV to ROTA, and -- worst -- numbers polio from ZERO, so its
// POLIO0 is the same injection as the live table's POLIO dose 1. Nothing has
// ever reconciled the two, which is survivable only because every one of its
// 200 rows is still untouched: 0 done, 0 skipped, 0 reminded.
//
// So this module speaks the vocabulary with 935 rows behind it -- a base code
// plus a dose number -- and carries a translation for the other one rather than
// pretending it does not exist. A vocabulary that lives in two repositories has
// to be pinned on both sides, and an unknown value is kept, never dropped.
//
// ── WHAT IS CLINICAL HERE, AND WHAT IS ARITHMETIC ───────────────────────────
//
// ARITHMETIC: the due date of a dose given a date of birth, and whether today
// is before or after it. That is all this file decides.
//
// CLINICAL, AND NOT DECIDED HERE: whether a dose may be given late, caught up,
// or skipped. A child who missed DPT-HB-Hib 2 does not simply get it "now" --
// the interval to dose 3 matters. This module reports a dose as overdue and
// stops. It never says what to do about it, because that is a judgement the
// ANC, PNC and KN engines in this package only make where a clinician signed
// the rule off.
//
// THE OFFSETS ARE CARRIED, NOT RECONSTRUCTED. They come from the Kemenkes 2023
// schedule as it was already implemented in sahaibat-healthcare's Kasih module,
// moved here unchanged. Treat the timings as inherited and unverified: they
// have NOT had the review dr. Rathi gave the ANC, PNC and KN engines, and this
// file should not be read as though they had.

/** A base vaccine code as the live records table stores it. */
export type VaccineCode =
  | 'HB0' | 'BCG' | 'POLIO' | 'DPT_HB_HIB' | 'PCV' | 'RV' | 'IPV' | 'CAMPAK_R'
  // School-age, delivered through the BIAS programme rather than at a posyandu.
  // No live row carries these yet -- they are scheduled by the Kasih tracker and
  // have never been recorded -- so they keep the tracker's spelling, which is
  // the only spelling anything has ever used for them.
  | 'BIAS_DT' | 'BIAS_MR' | 'BIAS_TD' | 'BIAS_HPV';

/**
 * `dasar` and `lanjutan` are the only two values the live `category` column
 * holds, and this module does not invent a third. Whether a dose belongs to the
 * routine infant programme or to the school programme is a separate axis --
 * see `programme` -- precisely so that a BIAS dose can be written to that
 * column without widening a vocabulary this package does not own.
 */
export type VaccineCategory = 'dasar' | 'lanjutan';
export type VaccineProgramme = 'rutin' | 'bias';

export interface ScheduledDose {
  code: VaccineCode;
  /** 1-based, matching sahai_immunization_records.dose_number. */
  dose: number;
  label_id: string;
  label_en: string;
  category: VaccineCategory;
  programme: VaccineProgramme;
  /** Days after date of birth at the EARLIEST end of the recommended window. */
  due_day: number;
  window_id: string;
  window_en: string;
}

/**
 * The schedule, earliest first.
 *
 * Polio is numbered FROM ONE here. The live table's POLIO dose 1 is the drop
 * given at birth, which the Kasih tracker calls POLIO0 -- see LEGACY_CODE_MAP.
 */
export const VACCINE_SCHEDULE: readonly ScheduledDose[] = [
  { code: 'HB0',        dose: 1, label_id: 'Hepatitis B (HB0)',   label_en: 'Hepatitis B (birth dose)', category: 'dasar',    programme: 'rutin', due_day: 0,    window_id: 'Saat lahir',   window_en: 'At birth' },
  { code: 'POLIO',      dose: 1, label_id: 'Polio tetes 1',        label_en: 'Oral polio 1',             category: 'dasar',    programme: 'rutin', due_day: 0,    window_id: 'Saat lahir',   window_en: 'At birth' },
  { code: 'BCG',        dose: 1, label_id: 'BCG',                  label_en: 'BCG',                      category: 'dasar',    programme: 'rutin', due_day: 30,   window_id: '1 bulan',      window_en: '1 month' },

  { code: 'DPT_HB_HIB', dose: 1, label_id: 'DPT-HB-Hib 1',         label_en: 'DTP-HepB-Hib 1',           category: 'dasar',    programme: 'rutin', due_day: 60,   window_id: '2 bulan',      window_en: '2 months' },
  { code: 'POLIO',      dose: 2, label_id: 'Polio tetes 2',        label_en: 'Oral polio 2',             category: 'dasar',    programme: 'rutin', due_day: 60,   window_id: '2 bulan',      window_en: '2 months' },
  { code: 'PCV',        dose: 1, label_id: 'PCV 1',                label_en: 'PCV 1',                    category: 'dasar',    programme: 'rutin', due_day: 60,   window_id: '2 bulan',      window_en: '2 months' },
  { code: 'RV',         dose: 1, label_id: 'Rotavirus 1',          label_en: 'Rotavirus 1',              category: 'dasar',    programme: 'rutin', due_day: 60,   window_id: '2 bulan',      window_en: '2 months' },

  { code: 'DPT_HB_HIB', dose: 2, label_id: 'DPT-HB-Hib 2',         label_en: 'DTP-HepB-Hib 2',           category: 'dasar',    programme: 'rutin', due_day: 90,   window_id: '3 bulan',      window_en: '3 months' },
  { code: 'POLIO',      dose: 3, label_id: 'Polio tetes 3',        label_en: 'Oral polio 3',             category: 'dasar',    programme: 'rutin', due_day: 90,   window_id: '3 bulan',      window_en: '3 months' },
  { code: 'PCV',        dose: 2, label_id: 'PCV 2',                label_en: 'PCV 2',                    category: 'dasar',    programme: 'rutin', due_day: 90,   window_id: '3 bulan',      window_en: '3 months' },
  { code: 'RV',         dose: 2, label_id: 'Rotavirus 2',          label_en: 'Rotavirus 2',              category: 'dasar',    programme: 'rutin', due_day: 90,   window_id: '3 bulan',      window_en: '3 months' },

  { code: 'DPT_HB_HIB', dose: 3, label_id: 'DPT-HB-Hib 3',         label_en: 'DTP-HepB-Hib 3',           category: 'dasar',    programme: 'rutin', due_day: 120,  window_id: '4 bulan',      window_en: '4 months' },
  { code: 'POLIO',      dose: 4, label_id: 'Polio tetes 4',        label_en: 'Oral polio 4',             category: 'dasar',    programme: 'rutin', due_day: 120,  window_id: '4 bulan',      window_en: '4 months' },
  { code: 'IPV',        dose: 1, label_id: 'IPV 1 (polio suntik)', label_en: 'IPV 1 (injected polio)',   category: 'dasar',    programme: 'rutin', due_day: 120,  window_id: '4 bulan',      window_en: '4 months' },
  { code: 'RV',         dose: 3, label_id: 'Rotavirus 3',          label_en: 'Rotavirus 3',              category: 'dasar',    programme: 'rutin', due_day: 120,  window_id: '4 bulan',      window_en: '4 months' },

  { code: 'CAMPAK_R',   dose: 1, label_id: 'Campak-Rubela 1',      label_en: 'Measles-Rubella 1',        category: 'dasar',    programme: 'rutin', due_day: 270,  window_id: '9 bulan',      window_en: '9 months' },
  { code: 'IPV',        dose: 2, label_id: 'IPV 2 (polio suntik)', label_en: 'IPV 2 (injected polio)',   category: 'dasar',    programme: 'rutin', due_day: 300,  window_id: '10 bulan',     window_en: '10 months' },
  { code: 'PCV',        dose: 3, label_id: 'PCV 3',                label_en: 'PCV 3',                    category: 'lanjutan', programme: 'rutin', due_day: 365,  window_id: '12 bulan',     window_en: '12 months' },

  { code: 'DPT_HB_HIB', dose: 4, label_id: 'DPT-HB-Hib lanjutan',  label_en: 'DTP-HepB-Hib booster',     category: 'lanjutan', programme: 'rutin', due_day: 548,  window_id: '18 bulan',     window_en: '18 months' },
  { code: 'CAMPAK_R',   dose: 2, label_id: 'Campak-Rubela lanjutan', label_en: 'Measles-Rubella booster', category: 'lanjutan', programme: 'rutin', due_day: 548,  window_id: '18 bulan',     window_en: '18 months' },

  { code: 'BIAS_DT',    dose: 1, label_id: 'DT (BIAS kelas 1)',    label_en: 'DT (school year 1)',       category: 'lanjutan', programme: 'bias',  due_day: 2190, window_id: 'Kelas 1 SD',   window_en: 'School year 1' },
  { code: 'BIAS_MR',    dose: 1, label_id: 'Campak-Rubela (BIAS kelas 1)', label_en: 'MR (school year 1)', category: 'lanjutan', programme: 'bias', due_day: 2190, window_id: 'Kelas 1 SD', window_en: 'School year 1' },
  { code: 'BIAS_TD',    dose: 1, label_id: 'Td (BIAS kelas 5)',    label_en: 'Td (school year 5)',       category: 'lanjutan', programme: 'bias',  due_day: 3650, window_id: 'Kelas 5 SD',   window_en: 'School year 5' },
  { code: 'BIAS_HPV',   dose: 1, label_id: 'HPV 1 (BIAS kelas 5)', label_en: 'HPV 1 (school year 5)',    category: 'lanjutan', programme: 'bias',  due_day: 3650, window_id: 'Kelas 5 SD',   window_en: 'School year 5' },
  { code: 'BIAS_HPV',   dose: 2, label_id: 'HPV 2 (BIAS kelas 6)', label_en: 'HPV 2 (school year 6)',    category: 'lanjutan', programme: 'bias',  due_day: 3835, window_id: 'Kelas 6 SD',   window_en: 'School year 6' },
];

/**
 * The Kasih tracker's spelling, translated to the live one.
 *
 * ⚠ POLIO IS OFF BY ONE. The tracker numbers oral polio from zero, so POLIO0
 * is the birth drop that the records table calls POLIO dose 1. Reading the
 * tracker without this map does not merely mislabel a dose, it attributes every
 * polio dose to the wrong visit.
 *
 * Anything absent from this map is UNKNOWN, not invalid -- see `translateLegacy`.
 */
export const LEGACY_CODE_MAP: Readonly<Record<string, { code: VaccineCode; dose: number }>> = {
  HB0: { code: 'HB0', dose: 1 },
  BCG: { code: 'BCG', dose: 1 },
  POLIO0: { code: 'POLIO', dose: 1 },
  POLIO1: { code: 'POLIO', dose: 2 },
  POLIO2: { code: 'POLIO', dose: 3 },
  POLIO3: { code: 'POLIO', dose: 4 },
  DPT1: { code: 'DPT_HB_HIB', dose: 1 },
  DPT2: { code: 'DPT_HB_HIB', dose: 2 },
  DPT3: { code: 'DPT_HB_HIB', dose: 3 },
  DPT4: { code: 'DPT_HB_HIB', dose: 4 },
  PCV1: { code: 'PCV', dose: 1 },
  PCV2: { code: 'PCV', dose: 2 },
  PCV3: { code: 'PCV', dose: 3 },
  ROTA1: { code: 'RV', dose: 1 },
  ROTA2: { code: 'RV', dose: 2 },
  ROTA3: { code: 'RV', dose: 3 },
  IPV1: { code: 'IPV', dose: 1 },
  IPV2: { code: 'IPV', dose: 2 },
  MR1: { code: 'CAMPAK_R', dose: 1 },
  MR2: { code: 'CAMPAK_R', dose: 2 },
  BIAS_DT: { code: 'BIAS_DT', dose: 1 },
  BIAS_MR: { code: 'BIAS_MR', dose: 1 },
  BIAS_TD: { code: 'BIAS_TD', dose: 1 },
  BIAS_HPV1: { code: 'BIAS_HPV', dose: 1 },
  BIAS_HPV2: { code: 'BIAS_HPV', dose: 2 },
};

/**
 * Translate one legacy code, or say plainly that it is unrecognised.
 *
 * Returns null rather than guessing. A caller that drops a null silently loses
 * a dose a child was given; a caller that shows it as unrecognised does not.
 */
export function translateLegacy(legacyCode: string | null | undefined): { code: VaccineCode; dose: number } | null {
  const k = String(legacyCode ?? '').trim().toUpperCase();
  return LEGACY_CODE_MAP[k] ?? null;
}

/** A dose that was actually given. Only the three fields that decide status. */
export interface GivenDose {
  vaccine_code: string;
  dose_number: number | null;
  /** ISO date. A dose with no date counts as given but cannot date a timeline. */
  administered_date?: string | null;
}

export type DoseState =
  /** Recorded as given. */
  | 'done'
  /** Due now, or inside a tolerated window after the due day. */
  | 'due'
  /** Past the due day by more than the grace period, and not recorded. */
  | 'overdue'
  /** The due day has not arrived. */
  | 'not_yet';

export interface DoseStatus extends ScheduledDose {
  state: DoseState;
  /** ISO date this dose became or becomes due. Null when the dob is unknown. */
  due_date: string | null;
  /** When state is 'done'. */
  given_date?: string | null;
  /** Negative before the due date, positive after. Null without a dob. */
  days_from_due: number | null;
}

/**
 * How long after the due day a dose is still called 'due' rather than 'overdue'.
 *
 * Fourteen days, and it is a presentation choice rather than a clinical one: a
 * posyandu runs monthly, so a child whose dose fell due last week is not late,
 * she is waiting for the session. Calling that overdue would mark most of a
 * healthy cohort red.
 */
export const DUE_GRACE_DAYS = 14;

const DAY = 86_400_000;

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY).toISOString().slice(0, 10);
}

/** ISO date, or null when the input is not a usable date. */
function asDate(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return Number.isNaN(Date.parse(s.slice(0, 10))) ? null : s.slice(0, 10);
}

/**
 * The whole schedule for one child, each dose marked done, due, overdue or
 * not yet.
 *
 * WITH NO DATE OF BIRTH nothing can be dated, so every dose comes back either
 * 'done' (it was recorded) or 'not_yet' with a null due_date -- never
 * 'overdue'. Telling a clinic that a child with no recorded birthday is late
 * for eleven vaccines would be an artefact of the missing date, not a finding.
 * This is the same refusal knFlags makes when a baby has no age.
 *
 * `given` may hold codes this module does not know, and they are simply not
 * matched -- call unmatchedGiven() to see them rather than losing them.
 */
export function immunisationStatus(
  dob: string | null | undefined,
  given: readonly GivenDose[] = [],
  today: string | Date = new Date(),
): DoseStatus[] {
  const born = asDate(dob);
  const now = asDate(typeof today === 'string' ? today : today.toISOString()) ?? new Date().toISOString().slice(0, 10);

  const givenKey = new Map<string, GivenDose>();
  for (const g of given) {
    const code = String(g.vaccine_code ?? '').trim().toUpperCase();
    // A dose number is required to place a dose in the schedule. A row without
    // one is kept out of the matching rather than assumed to be dose 1.
    if (g.dose_number == null) continue;
    givenKey.set(`${code}|${g.dose_number}`, g);
  }

  return VACCINE_SCHEDULE.map((s) => {
    const hit = givenKey.get(`${s.code}|${s.dose}`);
    if (hit) {
      return {
        ...s,
        state: 'done' as DoseState,
        due_date: born ? addDays(born, s.due_day) : null,
        given_date: asDate(hit.administered_date),
        days_from_due: null,
      };
    }
    if (!born) {
      return { ...s, state: 'not_yet' as DoseState, due_date: null, days_from_due: null };
    }
    const due = addDays(born, s.due_day);
    const diff = Math.round((Date.parse(now) - Date.parse(due)) / DAY);
    const state: DoseState = diff < 0 ? 'not_yet' : diff <= DUE_GRACE_DAYS ? 'due' : 'overdue';
    return { ...s, state, due_date: due, days_from_due: diff };
  });
}

/**
 * Doses that were given but match nothing in the schedule.
 *
 * Exists so a caller can SHOW them. A vaccine this package has not heard of is
 * still a vaccine a child received, and the one thing that must not happen is
 * for it to disappear between the register and the screen.
 */
export function unmatchedGiven(given: readonly GivenDose[] = []): GivenDose[] {
  const known = new Set(VACCINE_SCHEDULE.map((s) => `${s.code}|${s.dose}`));
  return given.filter((g) => {
    const code = String(g.vaccine_code ?? '').trim().toUpperCase();
    return g.dose_number == null || !known.has(`${code}|${g.dose_number}`);
  });
}

/**
 * The next thing owed to this child, or null when the routine schedule is
 * complete.
 *
 * Overdue outranks due: a child who missed DPT-HB-Hib 2 and is also due PCV 2
 * needs the missed one named first. Within the same state, the earlier due day
 * wins.
 */
export function nextDue(
  dob: string | null | undefined,
  given: readonly GivenDose[] = [],
  today: string | Date = new Date(),
): DoseStatus | null {
  const rank: Record<DoseState, number> = { overdue: 0, due: 1, not_yet: 2, done: 3 };
  const open = immunisationStatus(dob, given, today)
    .filter((d) => d.state !== 'done')
    .sort((a, b) => rank[a.state] - rank[b.state] || a.due_day - b.due_day);
  return open[0] ?? null;
}

/** Counts for a cohort screen. `done` counts only scheduled doses. */
export function immunisationSummary(
  dob: string | null | undefined,
  given: readonly GivenDose[] = [],
  today: string | Date = new Date(),
): { done: number; due: number; overdue: number; not_yet: number; unmatched: number; total: number } {
  const all = immunisationStatus(dob, given, today);
  const n = (s: DoseState) => all.filter((d) => d.state === s).length;
  return {
    done: n('done'), due: n('due'), overdue: n('overdue'), not_yet: n('not_yet'),
    unmatched: unmatchedGiven(given).length,
    total: all.length,
  };
}
