// @sahaibat/anc-engine · src/kbScreening.ts
//
// THE CONDITIONS A FORMULATION TURNS ON, AND THE QUESTIONS THAT ESTABLISH THEM.
//
// ── WHERE EVERY RULE COMES FROM ─────────────────────────────────────────────
//
// Pedoman Pelayanan Kontrasepsi dan Keluarga Berencana, Direktorat Kesehatan
// Keluarga, Kementerian Kesehatan RI, cetakan pertama November 2020. The
// per-method lists headed "Yang tidak boleh menggunakan ...":
//
//   AKDR Copper   p43     Implan  p53     KSP  p63-64
//   KPK           p69-70  KPP     p75
//
// Nothing here is translated from WHO, inferred from another method, or
// written from memory. Every condition carries the page it was read from, and
// a condition that is not on a method's page is NOT attached to that method --
// absence in the source is absence here.
//
// ── WHAT THIS FILE DOES NOT DO ──────────────────────────────────────────────
//
// It does not assign a category. Deciding that a given condition makes a given
// method category 2 rather than 3 is the next piece of work and needs the
// category tables, not these prose lists. What this file answers is narrower
// and useful on its own:
//
//   · which conditions could possibly matter for the formulation she chose
//   · which of those the record already answers
//   · which must therefore be ASKED
//
// That is the "ask only the unanswered questions" half of the design, and it
// is the half that can be built honestly from prose lists.
//
// ── MISSING IS NOT NO ───────────────────────────────────────────────────────
//
// Every answer is boolean | null and null means NOT ASKED. No function here
// ever reads null as false. A screening that treated an unanswered question as
// "she does not have it" would hand back a clean sheet for a woman nobody
// examined, which is the single worst thing this file could do.

import { kbFormulation, type KbFormulationCode, type KbHormone } from './contraception';

/* ── HOW A CONDITION BECOMES KNOWN ─────────────────────────────────────── */

export type KbEvidenceKind =
  /** A coded diagnosis already in the record. */
  | 'diagnosis'
  /** A measurement: blood pressure, age, days since delivery. */
  | 'measurement'
  /** Only the woman can say. Smoking, breastfeeding, current medicines. */
  | 'ask';

export interface KbCondition {
  code: string;
  label_id: string;
  label_en: string;
  evidence: KbEvidenceKind;
  /**
   * ICD-10 prefixes that establish this condition from the record.
   *
   * PREFIXES, matched case-insensitively against the start of a coded
   * diagnosis, because clinics code at different depths -- I50, I50.0 and
   * I50.9 are all heart failure. Empty where no code implies it.
   */
  icd10?: readonly string[];
  /** The page of the 2020 Pedoman this condition was read from. */
  pages: readonly number[];
}

/**
 * The conditions named in the lists above, de-duplicated across methods.
 *
 * Deliberately NOT a complete MEC condition set -- that is thousands of rows
 * and belongs with the category tables. This is exactly what the Indonesian
 * per-method pages name, which is what a midwife is trained against.
 */
export const KB_CONDITIONS: readonly KbCondition[] = [
  // ── Reproductive timing ───────────────────────────────────────────────
  { code: 'pp_lt_3w_no_bf', label_id: 'Tidak menyusui, kurang dari 3 minggu pascasalin', label_en: 'Not breastfeeding, under 3 weeks postpartum', evidence: 'measurement', pages: [69] },
  { code: 'pp_3_6w_no_bf_vte', label_id: 'Tidak menyusui, 3–6 minggu pascasalin dengan risiko TVD tambahan', label_en: 'Not breastfeeding, 3–6 weeks postpartum with added VTE risk', evidence: 'measurement', pages: [70] },
  { code: 'bf_6w_6m', label_id: 'Terutama menyusui, 6 minggu–6 bulan pascasalin', label_en: 'Mainly breastfeeding, 6 weeks to 6 months postpartum', evidence: 'measurement', pages: [70] },
  { code: 'bf_lt_6w', label_id: 'Menyusui, kurang dari 6 minggu pascasalin', label_en: 'Breastfeeding, under 6 weeks postpartum', evidence: 'measurement', pages: [63] },
  { code: 'pp_48h_4w', label_id: 'Antara 48 jam dan 4 minggu pascasalin', label_en: 'Between 48 hours and 4 weeks postpartum', evidence: 'measurement', pages: [43] },

  // ── Smoking and age ───────────────────────────────────────────────────
  { code: 'smoker_35_plus', label_id: 'Usia 35 tahun atau lebih dan merokok', label_en: 'Aged 35 or over and smoking', evidence: 'ask', pages: [70] },

  // ── Cardiovascular ────────────────────────────────────────────────────
  { code: 'htn_140_159', label_id: 'Tekanan darah 140–159 / 90–99 mmHg', label_en: 'Blood pressure 140–159 / 90–99 mmHg', evidence: 'measurement', icd10: ['I10', 'I11', 'I12', 'I13', 'I15'], pages: [70] },
  { code: 'htn_controlled', label_id: 'Hipertensi terkontrol, dapat dievaluasi lanjut', label_en: 'Controlled hypertension, further evaluation possible', evidence: 'diagnosis', icd10: ['I10', 'I11', 'I12', 'I13', 'I15'], pages: [70] },
  { code: 'htn_history_unmeasurable', label_id: 'Riwayat hipertensi dan tekanan darah tidak dapat diukur', label_en: 'History of hypertension and blood pressure cannot be measured', evidence: 'ask', icd10: ['O13', 'O14', 'O16'], pages: [70] },
  { code: 'htn_160_100', label_id: 'Tekanan darah 160/100 mmHg atau lebih', label_en: 'Blood pressure 160/100 mmHg or above', evidence: 'measurement', icd10: ['I10', 'I11', 'I12', 'I13', 'I15'], pages: [63] },
  { code: 'vte_acute', label_id: 'Penggumpalan darah akut pada vena dalam (kaki atau paru)', label_en: 'Acute deep vein thrombosis or pulmonary embolism', evidence: 'diagnosis', icd10: ['I80', 'I82', 'I26'], pages: [53, 63, 75] },
  { code: 'ihd', label_id: 'Riwayat atau sedang menderita penyakit jantung iskemik', label_en: 'Current or past ischaemic heart disease', evidence: 'diagnosis', icd10: ['I20', 'I21', 'I22', 'I24', 'I25'], pages: [63] },
  { code: 'cvd_multiple_risk', label_id: 'Faktor risiko kardiovaskular multipel', label_en: 'Multiple cardiovascular risk factors', evidence: 'ask', pages: [70] },

  // ── Neurological ──────────────────────────────────────────────────────
  { code: 'migraine_no_aura_35_plus', label_id: 'Usia 35 tahun atau lebih dengan migrain tanpa aura', label_en: 'Aged 35 or over with migraine without aura', evidence: 'diagnosis', icd10: ['G43'], pages: [70] },
  { code: 'migraine_no_aura_on_method', label_id: 'Di bawah 35 tahun, migrain tanpa aura yang muncul atau memberat saat memakai KPK', label_en: 'Under 35, migraine without aura starting or worsening on the combined pill', evidence: 'ask', icd10: ['G43'], pages: [70] },

  // ── Metabolic ─────────────────────────────────────────────────────────
  { code: 'diabetes_20y_or_damage', label_id: 'Diabetes lebih dari 20 tahun, atau dengan kerusakan pembuluh darah, mata, ginjal atau saraf', label_en: 'Diabetes over 20 years, or with vascular, eye, kidney or nerve damage', evidence: 'diagnosis', icd10: ['E10', 'E11', 'E13', 'E14'], pages: [70, 64] },

  // ── Cancer and liver ──────────────────────────────────────────────────
  { code: 'breast_ca_past_5y', label_id: 'Kanker payudara lebih dari 5 tahun lalu, tidak kambuh', label_en: 'Breast cancer more than 5 years ago, no recurrence', evidence: 'diagnosis', icd10: ['C50', 'Z85.3'], pages: [70, 64, 53, 75] },
  { code: 'liver_cirrhosis_tumour', label_id: 'Sirosis hati atau tumor hati', label_en: 'Liver cirrhosis or liver tumour', evidence: 'diagnosis', icd10: ['K70', 'K74', 'C22', 'D13.4'], pages: [64, 53, 75] },
  { code: 'gallbladder', label_id: 'Penyakit kandung empedu, sedang atau dalam pengobatan', label_en: 'Gallbladder disease, current or treated', evidence: 'diagnosis', icd10: ['K80', 'K81', 'K82'], pages: [70] },
  { code: 'jaundice_on_cocp', label_id: 'Riwayat jaundis saat memakai KPK sebelumnya', label_en: 'Jaundice while previously on the combined pill', evidence: 'ask', pages: [70] },
  { code: 'ovarian_ca', label_id: 'Kanker ovarium', label_en: 'Ovarian cancer', evidence: 'diagnosis', icd10: ['C56'], pages: [43] },

  // ── Reproductive tract and infection ──────────────────────────────────
  { code: 'unexplained_bleeding', label_id: 'Perdarahan vagina yang belum dijelaskan sebelum dievaluasi', label_en: 'Unexplained vaginal bleeding before evaluation', evidence: 'diagnosis', icd10: ['N93', 'N92'], pages: [53, 64] },
  { code: 'gtd_benign', label_id: 'Penyakit trofoblas gestasional jinak', label_en: 'Benign gestational trophoblastic disease', evidence: 'diagnosis', icd10: ['O01', 'D39.2'], pages: [43] },
  { code: 'sti_high_risk', label_id: 'Risiko individual sangat tinggi untuk IMS saat pemasangan', label_en: 'Very high individual STI risk at the time of insertion', evidence: 'ask', pages: [43] },
  { code: 'hiv_advanced', label_id: 'Penyakit HIV klinis berat atau lanjut', label_en: 'Severe or advanced clinical HIV disease', evidence: 'diagnosis', icd10: ['B20', 'B21', 'B22', 'B23', 'B24'], pages: [43] },

  // ── Autoimmune ────────────────────────────────────────────────────────
  { code: 'sle_apl', label_id: 'SLE dengan antibodi antifosfolipid positif atau tidak diketahui', label_en: 'SLE with positive or unknown antiphospholipid antibodies', evidence: 'diagnosis', icd10: ['M32', 'D68.6'], pages: [53, 64, 75] },
  { code: 'sle_thrombocytopenia', label_id: 'SLE dengan trombositopenia berat', label_en: 'SLE with severe thrombocytopenia', evidence: 'diagnosis', icd10: ['M32', 'D69'], pages: [43, 64] },

  // ── Medicines ─────────────────────────────────────────────────────────
  { code: 'enzyme_inducers', label_id: 'Terapi barbiturat, karbamazepin, okskarbazepin, fenitoin, primidon, topiramat, rifampisin atau rifabutin', label_en: 'On barbiturates, carbamazepine, oxcarbazepine, phenytoin, primidone, topiramate, rifampicin or rifabutin', evidence: 'ask', pages: [70, 75] },
  { code: 'lamotrigine', label_id: 'Terapi lamotrigin', label_en: 'On lamotrigine', evidence: 'ask', pages: [70] },
];

const BY_CODE = new Map(KB_CONDITIONS.map((c) => [c.code, c]));
export function kbCondition(code: unknown): KbCondition | null {
  return BY_CODE.get(String(code ?? '').trim().toLowerCase()) ?? null;
}

/* ── WHICH CONDITIONS A FORMULATION TURNS ON ───────────────────────────── */

/**
 * The condition codes named on each formulation's own page.
 *
 * ONE ENTRY PER PAGE READ. A formulation whose page has not been transcribed
 * is ABSENT from this map, and screeningFor() then returns an empty set with
 * `source: null` rather than borrowing another method's list. Borrowing is how
 * a progestin-only rule ends up applied to a combined pill.
 */
interface FormulationList {
  /** The page(s) of the 2020 Pedoman THIS formulation's list was read from. */
  pages: readonly number[];
  conditions: readonly string[];
}

const BY_FORMULATION: Partial<Record<KbFormulationCode, FormulationList>> = {
  kpk: { pages: [69, 70], conditions: [
    'pp_lt_3w_no_bf', 'pp_3_6w_no_bf_vte', 'bf_6w_6m', 'smoker_35_plus',
    'htn_140_159', 'htn_controlled', 'htn_history_unmeasurable',
    'jaundice_on_cocp', 'gallbladder',
    'migraine_no_aura_35_plus', 'migraine_no_aura_on_method',
    'breast_ca_past_5y', 'diabetes_20y_or_damage', 'cvd_multiple_risk',
    'enzyme_inducers', 'lamotrigine',
  ] },
  kpp: { pages: [75], conditions: [
    'vte_acute', 'breast_ca_past_5y', 'liver_cirrhosis_tumour', 'sle_apl',
    'enzyme_inducers',
  ] },
  ksp_dmpa: { pages: [63, 64], conditions: [
    'bf_lt_6w', 'htn_160_100', 'vte_acute', 'ihd', 'unexplained_bleeding',
    'breast_ca_past_5y', 'diabetes_20y_or_damage', 'liver_cirrhosis_tumour',
    'sle_apl', 'sle_thrombocytopenia',
  ] },
  implan: { pages: [53], conditions: [
    'vte_acute', 'unexplained_bleeding', 'breast_ca_past_5y',
    'liver_cirrhosis_tumour', 'sle_apl',
  ] },
  akdr_cu: { pages: [43], conditions: [
    'pp_48h_4w', 'gtd_benign', 'ovarian_ca', 'sti_high_risk', 'hiv_advanced',
    'sle_thrombocytopenia',
  ] },
};
/* NET-EN shares the KSP page: the Pedoman writes one eligibility list for
   Kontrasepsi Suntik Progestin and distinguishes DMPA from NET-EN only by
   interval and late window. So the same set, pointed at deliberately rather
   than by falling through to a default. */
BY_FORMULATION.ksp_neten = BY_FORMULATION.ksp_dmpa;

/* ── THE SCREENING ─────────────────────────────────────────────────────── */

/** What the record already says. null everywhere means nothing is known. */
export interface KbKnownFacts {
  /** Coded diagnoses from the record, any depth. */
  icd10?: readonly (string | null | undefined)[];
  /** Answers already recorded, by condition code. null = not asked. */
  answers?: Readonly<Record<string, boolean | null | undefined>>;
}

export interface KbScreeningItem {
  condition: KbCondition;
  /** true/false where known, null where NOT ASKED. Never defaulted. */
  answer: boolean | null;
  /** How this answer arrived. 'unanswered' when it has not. */
  from: 'diagnosis' | 'answer' | 'unanswered';
  /** The coded diagnosis that established it, when one did. */
  via?: string;
}

export interface KbScreening {
  formulation: KbFormulationCode | null;
  hormone: KbHormone | null;
  /** The Pedoman pages this set was read from. Null when untranscribed. */
  source: readonly number[] | null;
  items: readonly KbScreeningItem[];
  /** Conditions that came back true. The reason to look at the screen. */
  present: readonly KbScreeningItem[];
  /** Conditions nobody has answered. The reason it is not finished. */
  unanswered: readonly KbScreeningItem[];
}

function icdMatches(c: KbCondition, codes: readonly (string | null | undefined)[]): string | null {
  if (!c.icd10 || c.icd10.length === 0) return null;
  for (const raw of codes) {
    const s = String(raw ?? '').trim().toUpperCase();
    if (!s) continue;
    for (const p of c.icd10) if (s.startsWith(p.toUpperCase())) return s;
  }
  return null;
}

/**
 * What to ask about, for the formulation she is considering.
 *
 * A coded diagnosis can only ever turn an answer ON. The absence of a code is
 * NOT evidence of absence -- plenty of real conditions were never coded -- so
 * a condition with no matching code and no recorded answer stays `null` and
 * lands in `unanswered`, where somebody has to deal with it.
 */
export function screeningFor(
  formulation: unknown,
  known: KbKnownFacts = {},
): KbScreening {
  const f = kbFormulation(formulation);
  const codes = f ? BY_FORMULATION[f.code] : undefined;

  if (!f || !codes) {
    return {
      formulation: f ? f.code : null,
      hormone: f ? f.hormone : null,
      source: null,
      items: [], present: [], unanswered: [],
    };
  }

  const icd = known.icd10 ?? [];
  const answers = known.answers ?? {};
  const items: KbScreeningItem[] = [];

  for (const code of codes.conditions) {
    const c = BY_CODE.get(code);
    if (!c) continue;                       // a typo must not become a question
    const recorded = answers[code];
    if (recorded === true || recorded === false) {
      items.push({ condition: c, answer: recorded, from: 'answer' });
      continue;
    }
    const hit = icdMatches(c, icd);
    if (hit) {
      items.push({ condition: c, answer: true, from: 'diagnosis', via: hit });
      continue;
    }
    items.push({ condition: c, answer: null, from: 'unanswered' });
  }

  return {
    formulation: f.code,
    hormone: f.hormone,
    /* THIS formulation's own pages. Unioning the pages of every condition
       would cite p53 and p75 on a combined-pill screening, because conditions
       are shared across methods and their pages are not. A citation that
       names a page the rule was not read from is worse than none. */
    source: codes.pages,
    items,
    present: items.filter((i) => i.answer === true),
    unanswered: items.filter((i) => i.answer === null),
  };
}

/**
 * Is the screening complete?
 *
 * Complete means every question has an answer, NOT that every answer is no.
 * A screening with three conditions present is complete and concerning; one
 * with three unanswered is neither.
 */
export function screeningComplete(s: KbScreening): boolean {
  return s.source !== null && s.unanswered.length === 0;
}

/** Does this formulation have a transcribed list at all? */
export function hasScreening(formulation: unknown): boolean {
  const f = kbFormulation(formulation);
  return !!f && !!BY_FORMULATION[f.code];
}
