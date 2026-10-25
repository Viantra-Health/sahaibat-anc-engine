// @sahaibat/anc-engine · src/kbPractice.ts
//
// STARTING, CONTINUING, AND COMPARING — the practice half of family planning.
//
// MEC answers whether a method is medically appropriate for her. This answers
// the three questions that come after:
//
//   · if she starts today, does she need cover for a few days?
//   · she is late for a dose — give it, or exclude pregnancy first?
//   · how do the available methods actually differ?
//
// ── WHERE EVERY RULE COMES FROM ─────────────────────────────────────────────
//
// Pedoman Kerja Puskesmas (ILP), Klaster 3, Kemenkes 2024:
//   p288  per-visit checks while starting and using contraception
//   p289  method-by-method: choosing, instructions, side effects
//   p290  missed injection, missed pill, emergency contraception, follow-up
//
// Pedoman Pelayanan Kontrasepsi dan Keluarga Berencana, Kemenkes 2020:
//   p62   injectable types and doses      p76  KPP postpartum start table
//
// H1 framed initiation and continuation as needing WHO SPR. It does not:
// Kemenkes has published the operative version, in Indonesian, and that is
// what a clinician here is accountable to. Nothing below is translated from
// WHO.
//
// ── ONE TRANSCRIPTION NOTE, RECORDED RATHER THAN CORRECTED ──────────────────
//
// Klaster 3 p290's first bullet reads "Jika terlambat < 2 minggu (NET-EN)
// atau > 4 minggu (DMPA) : berikan injeksi". The second comparator must be
// "<" for the sentence to mean anything, since the next bullet handles
// "> 4 minggu". Both bullets agree on the two THRESHOLDS, so the thresholds
// are what is encoded and the stray ">" is noted here rather than silently
// fixed. Whoever verifies the transcription should look at that line.

import {
  kbFormulation, KB_FORMULATIONS,
  type KbFormulationCode, type KbFormulation,
} from './contraception';

const DAY = 86_400_000;

function asDate(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return Number.isNaN(Date.parse(s.slice(0, 10))) ? null : s.slice(0, 10);
}
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

/* ══ PIECE 5a · STARTING ═══════════════════════════════════════════════════
 *
 * Whether she needs a few days of extra cover depends on where she is in her
 * cycle, and the cut-off differs by method. Klaster 3 p289.
 */

export interface StartAdvice {
  formulation: KbFormulationCode;
  /** Days of condoms or abstinence needed. 0 when none. */
  backupDays: number;
  /** Exclude pregnancy before this is given or fitted. */
  pregnancyCheckFirst: boolean;
  /** The rule, in the source's own terms. */
  reason_id: string;
  reason_en: string;
  source: string;
}

/**
 * Starting today, at this point in her cycle.
 *
 * `cycleDay` is days since her period started; null when she does not know,
 * and null is treated as "cannot be sure" rather than as day 1. Assuming the
 * favourable case is how a woman goes home with no cover and no warning.
 */
export function startAdvice(
  formulation: unknown,
  cycleDay: number | null | undefined,
): StartAdvice | null {
  const f = kbFormulation(formulation);
  if (!f) return null;

  /* ── Number(null) IS 0, AND SO IS Number('') ──────────────────────────
     Caught in testing: `Number.isFinite(Number(cycleDay))` accepts null,
     turns it into day 0, and a woman whose cycle day nobody knows was being
     told she needs no cover at all — the single most dangerous answer this
     function can give. The guard has to reject null BEFORE the conversion. */
  const raw = cycleDay;
  const day = (raw === null || raw === undefined || raw === ('' as unknown))
    ? null
    : (Number.isFinite(Number(raw)) ? Number(raw) : null);
  const unknown = day === null;

  // Copper IUD: the question is pregnancy, not cover. Klaster 3 p289.
  if (f.code === 'akdr_cu') {
    const late = unknown || day! > 12;
    return {
      formulation: f.code, backupDays: 0, pregnancyCheckFirst: late,
      reason_id: late
        ? 'Dipasang setelah hari ke-12 siklus (atau siklus tidak diketahui) — periksa kehamilan dahulu.'
        : 'Dipasang dalam 12 hari pertama siklus — tidak perlu periksa kehamilan.',
      reason_en: late
        ? 'Fitted after day 12 of the cycle (or the cycle is unknown) — exclude pregnancy first.'
        : 'Fitted within the first 12 days of the cycle — no pregnancy check needed.',
      source: 'Klaster 3 p289',
    };
  }

  // Progestin pill: two days. Pedoman p76.
  if (f.code === 'kpp') {
    const late = unknown || day! > 5;
    return {
      formulation: f.code, backupDays: late ? 2 : 0, pregnancyCheckFirst: false,
      reason_id: late
        ? 'Dimulai di luar hari-hari awal siklus — perlu kondom atau pantang 2 hari pertama.'
        : 'Dimulai pada hari-hari awal siklus — tidak perlu metode tambahan.',
      reason_en: late
        ? 'Started outside the early cycle days — condoms or abstinence for the first 2 days.'
        : 'Started in the early cycle days — no additional method needed.',
      source: 'Pedoman 2020 p76',
    };
  }

  // Implant and progestin injectables: seven days past day 5. Klaster 3 p289.
  if (f.code === 'implan' || f.code === 'ksp_dmpa' || f.code === 'ksp_neten') {
    const late = unknown || day! > 5;
    return {
      formulation: f.code, backupDays: late ? 7 : 0, pregnancyCheckFirst: false,
      reason_id: late
        ? 'Dimulai setelah hari ke-5 siklus — gunakan kondom atau pantang selama 7 hari.'
        : 'Dimulai dalam 5 hari pertama siklus — tidak perlu metode tambahan.',
      reason_en: late
        ? 'Started after day 5 of the cycle — condoms or abstinence for 7 days.'
        : 'Started within the first 5 days of the cycle — no additional method needed.',
      source: 'Klaster 3 p289',
    };
  }

  /* Everything else has no transcribed starting rule. Null, not a guess:
     a confident "no cover needed" for a method nobody transcribed is the
     failure mode this whole file is trying to avoid. */
  return null;
}

/* ══ PIECE 5b · A MISSED DOSE ══════════════════════════════════════════════ */

export type MissedAction =
  | 'give_now'            // simply give it
  | 'check_pregnancy'     // exclude pregnancy first
  | 'take_now_plus_backup'
  | 'none';

export interface MissedDoseAdvice {
  action: MissedAction;
  backupDays: number;
  /** Offer emergency contraception as well. */
  offerEmergency: boolean;
  advice_id: string;
  advice_en: string;
  source: string;
}

/**
 * She is late. Klaster 3 p290.
 *
 * `unprotectedSexLast5Days` decides the emergency-contraception offer, and
 * null means NOT ASKED — which is reported as "ask", never as no.
 */
export function missedDose(
  formulation: unknown,
  daysLate: number,
  unprotectedSexLast5Days: boolean | null = null,
): MissedDoseAdvice | null {
  const f = kbFormulation(formulation);
  if (!f) return null;
  const late = Math.max(0, Math.round(daysLate));

  if (f.code === 'ksp_dmpa' || f.code === 'ksp_neten') {
    const window = f.late_window_days ?? 0;        // 28 DMPA, 14 NET-EN
    if (late <= window) {
      return {
        action: 'give_now', backupDays: 0, offerEmergency: false,
        advice_id: `Terlambat ${late} hari, masih dalam batas ${window} hari — berikan suntikan.`,
        advice_en: `${late} days late, within the ${window}-day window — give the injection.`,
        source: 'Klaster 3 p290',
      };
    }
    return {
      action: 'check_pregnancy', backupDays: 7,
      offerEmergency: unprotectedSexLast5Days !== false,
      advice_id: `Terlambat ${late} hari, melewati batas ${window} hari — periksa kehamilan dahulu. `
        + 'Jika tidak hamil: beri suntikan, lalu kondom atau pantang 7 hari. '
        + (unprotectedSexLast5Days === null
            ? 'Tanyakan apakah ada hubungan tanpa pengaman dalam 5 hari terakhir.'
            : unprotectedSexLast5Days
              ? 'Ada hubungan tanpa pengaman dalam 5 hari terakhir — tawarkan kontrasepsi darurat.'
              : ''),
      advice_en: `${late} days late, past the ${window}-day window — exclude pregnancy first. `
        + 'If not pregnant: give the injection, then condoms or abstinence for 7 days. '
        + (unprotectedSexLast5Days === null
            ? 'Ask whether there was unprotected sex in the last 5 days.'
            : unprotectedSexLast5Days
              ? 'There was unprotected sex in the last 5 days — offer emergency contraception.'
              : ''),
      source: 'Klaster 3 p290',
    };
  }

  /* The pills are counted in HOURS on p290, not days, so daysLate cannot
     answer them and this refuses rather than approximating. A pill rule
     answered from the wrong unit is worse than no rule. */
  return null;
}

/** Missed progestin-only pill: the rule is in hours. Klaster 3 p290. */
export function missedProgestinPill(hoursLate: number): MissedDoseAdvice {
  const late = hoursLate > 3;
  return {
    action: late ? 'take_now_plus_backup' : 'give_now',
    backupDays: late ? 30 : 0,
    offerEmergency: late,
    advice_id: late
      ? 'Terlambat lebih dari 3 jam — minum segera setelah ingat, lanjutkan, dan gunakan kondom atau pantang sampai akhir bulan. Jika ada hubungan tanpa pengaman dalam 5 hari terakhir, tawarkan kontrasepsi darurat.'
      : 'Terlambat kurang dari 3 jam — minum sekarang, lanjutkan seperti biasa.',
    advice_en: late
      ? 'More than 3 hours late — take it as soon as remembered, continue, and use condoms or abstain until the end of the month. If there was unprotected sex in the last 5 days, offer emergency contraception.'
      : 'Less than 3 hours late — take it now and carry on as usual.',
    source: 'Klaster 3 p290',
  };
}

/** Emergency contraception, as Klaster 3 p290 doses it. */
export interface EmergencyAdvice {
  eligible: boolean;
  dose_id: string;
  dose_en: string;
  source: string;
}
export function emergencyContraception(
  hoursSinceUnprotectedSex: number,
  onEnzymeInducer: boolean | null = null,
): EmergencyAdvice {
  const within = hoursSinceUnprotectedSex <= 72;
  const boosted = onEnzymeInducer === true;
  return {
    eligible: within,
    dose_id: !within
      ? 'Lewat 3 hari sejak hubungan tanpa pengaman — di luar jendela yang tercantum. Pertimbangkan AKDR tembaga dan konsultasi.'
      : (boosted
          ? 'Sedang memakai ARV, rifampisin atau fenitoin: tawarkan AKDR tembaga, atau naikkan levonorgestrel menjadi dosis tunggal 3 mg.'
          : 'Levonorgestrel dosis tunggal 1,5 mg per oral, diberikan secepatnya.')
        + ' Jika muntah kurang dari 2 jam setelah minum, ulangi dosisnya.',
    dose_en: !within
      ? 'More than 3 days since unprotected sex — outside the stated window. Consider a copper IUD and advice.'
      : (boosted
          ? 'On ARV, rifampicin or phenytoin: offer a copper IUD, or raise levonorgestrel to a single 3 mg dose.'
          : 'Levonorgestrel 1.5 mg orally as a single dose, as soon as possible.')
        + ' If she vomits within 2 hours, repeat the dose.',
    source: 'Klaster 3 p290',
  };
}

/** Routine follow-up after starting. Klaster 3 p290. */
export function followUpSchedule(formulation: unknown): { days: number[]; note_id: string; note_en: string; source: string } | null {
  const f = kbFormulation(formulation);
  if (!f) return null;
  if (f.code === 'kpk') {
    return {
      days: [90, 455],
      note_id: 'Kontrol 3 bulan setelah mulai, lalu setiap tahun.',
      note_en: 'Follow up 3 months after starting, then yearly.',
      source: 'Klaster 3 p290',
    };
  }
  if (f.code === 'akdr_cu' || f.code === 'akdr_lng') {
    return {
      days: [42],
      note_id: 'Kontrol 6 minggu setelah pemasangan untuk memeriksa benang.',
      note_en: 'Follow up 6 weeks after insertion to check the threads.',
      source: 'Klaster 3 p290',
    };
  }
  return null;
}

/* ══ PIECE 6 · POSTPARTUM ══════════════════════════════════════════════════
 *
 * KBPP is a REPORTING window: contraception started within 42 days of
 * delivery. Medical eligibility is a different question with different
 * numbers, and the two must not be read off one another. A woman on day 50
 * has not become ineligible; what closed is the programme's definition.
 */

export interface PostpartumVerdict {
  /** Days since delivery, or null when the delivery date is unknown. */
  day: number | null;
  /** A restriction from this formulation's own page applies. */
  restricted: boolean;
  /** Null when nothing is transcribed for this formulation. */
  reason_id: string | null;
  reason_en: string | null;
  source: string | null;
}

/**
 * Does a postpartum restriction apply to this formulation today?
 *
 * `breastfeeding` is boolean | null and null means NOT ASKED. Several of the
 * rules below turn on it, so an unasked answer returns `restricted: true`
 * with a reason that says the question is open -- the cautious direction, and
 * the only honest one when the rule itself depends on the answer.
 */
export function postpartumRestriction(
  formulation: unknown,
  deliveryDate: string | null | undefined,
  breastfeeding: boolean | null,
  today: string | Date = new Date(),
): PostpartumVerdict {
  const f = kbFormulation(formulation);
  const d = asDate(deliveryDate);
  const now = asDate(typeof today === 'string' ? today : today.toISOString())
    ?? new Date().toISOString().slice(0, 10);
  const day = d ? daysBetween(d, now) : null;

  const none: PostpartumVerdict = { day, restricted: false, reason_id: null, reason_en: null, source: null };
  if (!f || day === null || day < 0) return none;

  const unknownBf = breastfeeding === null || breastfeeding === undefined;

  // Combined pill — Pedoman p69-70.
  if (f.code === 'kpk' || f.code === 'ksk') {
    if (unknownBf) {
      return { day, restricted: true, source: 'Pedoman 2020 p69-70',
        reason_id: 'Status menyusui belum ditanyakan, padahal batasan pascasalin untuk metode kombinasi bergantung padanya.',
        reason_en: 'Breastfeeding status has not been asked, and the postpartum restriction for combined methods depends on it.' };
    }
    if (!breastfeeding && day < 21) {
      return { day, restricted: true, source: 'Pedoman 2020 p69',
        reason_id: `Tidak menyusui dan baru ${day} hari pascasalin (kurang dari 3 minggu).`,
        reason_en: `Not breastfeeding and only ${day} days postpartum (under 3 weeks).` };
    }
    if (!breastfeeding && day < 42) {
      return { day, restricted: true, source: 'Pedoman 2020 p70',
        reason_id: `Tidak menyusui, ${day} hari pascasalin (3–6 minggu) — tertahan bila ada risiko TVD tambahan.`,
        reason_en: `Not breastfeeding, ${day} days postpartum (3–6 weeks) — restricted if there is added VTE risk.` };
    }
    if (breastfeeding && day >= 42 && day < 182) {
      return { day, restricted: true, source: 'Pedoman 2020 p70',
        reason_id: `Terutama menyusui, ${day} hari pascasalin (6 minggu–6 bulan).`,
        reason_en: `Mainly breastfeeding, ${day} days postpartum (6 weeks to 6 months).` };
    }
    return none;
  }

  // Progestin injectables — Pedoman p63.
  if (f.code === 'ksp_dmpa' || f.code === 'ksp_neten') {
    if (unknownBf) {
      return { day, restricted: true, source: 'Pedoman 2020 p63',
        reason_id: 'Status menyusui belum ditanyakan, padahal batasan 6 minggu bergantung padanya.',
        reason_en: 'Breastfeeding status has not been asked, and the 6-week restriction depends on it.' };
    }
    if (breastfeeding && day < 42) {
      return { day, restricted: true, source: 'Pedoman 2020 p63',
        reason_id: `Menyusui dan baru ${day} hari pascasalin (kurang dari 6 minggu).`,
        reason_en: `Breastfeeding and only ${day} days postpartum (under 6 weeks).` };
    }
    return none;
  }

  // Copper IUD — Pedoman p43. Breastfeeding is irrelevant here.
  if (f.code === 'akdr_cu') {
    if (day >= 2 && day < 28) {
      return { day, restricted: true, source: 'Pedoman 2020 p43',
        reason_id: `${day} hari pascasalin — antara 48 jam dan 4 minggu, pemasangan tertahan.`,
        reason_en: `${day} days postpartum — between 48 hours and 4 weeks, insertion is restricted.` };
    }
    return none;
  }

  return none;
}

/* ══ PIECE 7 · COMPARING METHODS ═══════════════════════════════════════════
 *
 * NEVER A RANKING, AND NEVER A SCORE. Permenkes No. 2 Tahun 2025 frames
 * contraception as a right exercised without coercion, and a product that
 * ordered methods best-first would be arguing with that. These are the facts
 * a clinician lays side by side so the woman can choose; the order is the
 * order they are given in.
 *
 * Everything here is from Klaster 3 p289 and the Pedoman pages already cited.
 */

export interface MethodFacts {
  formulation: KbFormulation;
  /** How long one application lasts, in words. */
  duration_id: string;
  duration_en: string;
  /** Must a trained provider insert or remove it? */
  providerRequired: boolean;
  /** How quickly fertility returns, in the source's own terms. */
  fertilityReturn_id: string;
  fertilityReturn_en: string;
  /** The side effects the source names, in its own words. */
  sideEffects_id: readonly string[];
  sideEffects_en: readonly string[];
  source: string;
}

const FACTS: Partial<Record<KbFormulationCode, Omit<MethodFacts, 'formulation'>>> = {
  akdr_cu: {
    duration_id: 'Efektif sampai 10 tahun', duration_en: 'Effective for up to 10 years',
    providerRequired: true,
    fertilityReturn_id: 'Kesuburan kembali setelah pelepasan',
    fertilityReturn_en: 'Fertility returns after removal',
    sideEffects_id: ['Haid lebih banyak atau nyeri, biasanya membaik dalam 3–6 bulan',
                     'Rujuk bila perdarahan berlebih atau lemas dengan Hb < 12 g/dL',
                     'Benang mengiritasi pasangan — dapat dipotong lebih pendek'],
    sideEffects_en: ['Heavier or more painful periods, usually settling in 3–6 months',
                     'Refer if bleeding is excessive, or she is weak with Hb under 12 g/dL',
                     'Threads irritating her partner — they can be trimmed'],
    source: 'Klaster 3 p289',
  },
  implan: {
    duration_id: 'Bertahan 3 tahun (levonorgestrel satu batang)',
    duration_en: 'Lasts 3 years (single-rod levonorgestrel)',
    providerRequired: true,
    fertilityReturn_id: 'Kesuburan kembali setelah pelepasan',
    fertilityReturn_en: 'Fertility returns after removal',
    sideEffects_id: ['Amenorea — umum terjadi', 'Perdarahan tidak teratur — umum',
                     'Jerawat', 'Nyeri kepala', 'Berat badan naik',
                     'Murung — tanyakan dua pertanyaan penapisan, pertimbangkan ganti cara'],
    sideEffects_en: ['Amenorrhoea — common', 'Irregular bleeding — common',
                     'Acne', 'Headache', 'Weight gain',
                     'Low mood — ask the two screening questions, consider switching'],
    source: 'Klaster 3 p289',
  },
  ksp_dmpa: {
    duration_id: 'Suntikan tiap 12 minggu (DMPA IM 150 mg)',
    duration_en: 'Injection every 12 weeks (DMPA IM 150 mg)',
    providerRequired: true,
    fertilityReturn_id: 'Kesuburan dapat tertunda sampai 1 tahun',
    fertilityReturn_en: 'Fertility may be delayed by up to a year',
    sideEffects_id: ['Perdarahan tidak teratur', 'Berat badan naik',
                     'Tidak perlu mengubah jarak dosis karena ARV, OAT atau obat epilepsi'],
    sideEffects_en: ['Irregular bleeding', 'Weight gain',
                     'No dose-interval change needed for ARV, TB or epilepsy medicines'],
    source: 'Klaster 3 p289',
  },
  ksp_neten: {
    duration_id: 'Suntikan tiap 8 minggu (NET-EN IM 200 mg)',
    duration_en: 'Injection every 8 weeks (NET-EN IM 200 mg)',
    providerRequired: true,
    fertilityReturn_id: 'Kesuburan dapat tertunda sampai 1 tahun',
    fertilityReturn_en: 'Fertility may be delayed by up to a year',
    sideEffects_id: ['Perdarahan tidak teratur', 'Berat badan naik',
                     'Tidak perlu mengubah jarak dosis karena ARV, OAT atau obat epilepsi'],
    sideEffects_en: ['Irregular bleeding', 'Weight gain',
                     'No dose-interval change needed for ARV, TB or epilepsy medicines'],
    source: 'Klaster 3 p289',
  },
  kpp: {
    duration_id: 'Diminum setiap hari pada jam yang sama',
    duration_en: 'Taken every day at the same time',
    providerRequired: false,
    fertilityReturn_id: 'Kesuburan kembali begitu pil dihentikan',
    fertilityReturn_en: 'Fertility returns as soon as the pills stop',
    sideEffects_id: ['Perlu kedisiplinan harian — terlambat 3 jam sudah dihitung terlewat'],
    sideEffects_en: ['Needs daily discipline — 3 hours late already counts as missed'],
    source: 'Klaster 3 p289',
  },
};

export function methodFacts(formulation: unknown): MethodFacts | null {
  const f = kbFormulation(formulation);
  if (!f) return null;
  const facts = FACTS[f.code];
  return facts ? { formulation: f, ...facts } : null;
}

/**
 * Facts for several methods, side by side.
 *
 * Returns them in the order asked for, and formulations with nothing
 * transcribed are OMITTED rather than shown blank -- an empty column reads as
 * "this method has no side effects", which is the opposite of what it means.
 * `missing` names them so the caller can say so.
 */
export function compareMethods(
  formulations: readonly unknown[],
): { rows: MethodFacts[]; missing: string[] } {
  const rows: MethodFacts[] = [];
  const missing: string[] = [];
  for (const c of formulations) {
    const m = methodFacts(c);
    if (m) rows.push(m);
    else {
      const f = kbFormulation(c);
      missing.push(f ? f.code : String(c ?? ''));
    }
  }
  return { rows, missing };
}

/** Every formulation that has comparison facts transcribed. */
export function comparableFormulations(): KbFormulationCode[] {
  return KB_FORMULATIONS.filter((f) => !!FACTS[f.code]).map((f) => f.code);
}
