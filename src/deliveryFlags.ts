// @sahaibat/anc-engine · src/deliveryFlags.ts
//
// The birth: the event every antenatal visit was working toward, and the one
// the product had nowhere to record.
//
// WHY THIS MATTERS BEYOND THE CLINICAL RULES
// ------------------------------------------
// Two of the six national indicators a midwife is measured on could not be
// produced from our data, because the events had nowhere to live. `Linakes` —
// birth attended by a skilled provider — is derived here, from the attendant
// and the place, and nothing else in the system can produce it.
//
// SOURCES. Thresholds follow the Kemenkes/WHO/POGI/HOGSI/PB IBI pocket book
// (Buku Saku Pelayanan Kesehatan Ibu di Fasilitas Kesehatan Dasar dan Rujukan)
// and the Buku KIA 2024. Each carries its basis in a comment.
//
// ⚠ Same standing rule as the postnatal set: a midwife or obstetrician should
// read these before they ship. They are transcribed, not invented, but
// transcription can be wrong.

import type { ClinicalFlag } from './clinicalFlags';

/** Where the birth happened. */
export type BirthPlace =
  | 'rs' | 'puskesmas' | 'poskesdes' | 'polindes' | 'klinik' | 'pmb'   // facilities
  | 'rumah' | 'perjalanan' | 'lainnya';                                 // not facilities

/** Who attended it. The first three are "tenaga kesehatan" for linakes. */
export type Attendant =
  | 'dokter_spesialis' | 'dokter' | 'bidan'
  | 'perawat' | 'dukun' | 'keluarga' | 'tidak_ada';

export type DeliveryMode = 'spontan' | 'sc' | 'vakum' | 'forceps';

export type BirthOutcome = 'hidup' | 'mati';

export interface BabyOutcome {
  /** 1 for a single birth, 1..n for multiples. */
  order: number;
  outcome: BirthOutcome | null;
  sex?: 'L' | 'P' | null;
  weightGrams?: number | null;
  lengthCm?: number | null;
  /** Did the baby breathe or cry without help? The asphyxia question. */
  criedImmediately?: boolean | null;
  /** Inisiasi Menyusu Dini — Buku KIA pp. 24–25. */
  imd?: boolean | null;
  vitaminK?: boolean | null;
  hepatitisB0?: boolean | null;
}

export interface DeliveryInput {
  gestationalWeeks?: number | null;
  place?: BirthPlace | null;
  attendant?: Attendant | null;
  mode?: DeliveryMode | null;
  /** Estimated blood loss in millilitres. */
  bloodLossMl?: number | null;
  /** Free-text or coded complications recorded by the midwife. */
  complications?: string[] | null;
  motherOutcome?: 'hidup' | 'mati' | null;
  babies: BabyOutcome[];
}

const FACILITY_PLACES: BirthPlace[] = ['rs', 'puskesmas', 'poskesdes', 'polindes', 'klinik', 'pmb'];
const SKILLED: Attendant[] = ['dokter_spesialis', 'dokter', 'bidan'];

/**
 * Linakes — "persalinan ditolong tenaga kesehatan".
 *
 * Reported two ways in Indonesia and both matter, so both are returned rather
 * than collapsed: the national indicator counts a skilled attendant, and the
 * facility-delivery figure counts where it happened. A bidan attending at home
 * is skilled but not a facility birth, and conflating them would overstate one
 * and understate the other.
 */
export function linakes(d: DeliveryInput): { skilledAttendant: boolean; atFacility: boolean } {
  return {
    skilledAttendant: d.attendant != null && SKILLED.includes(d.attendant),
    atFacility: d.place != null && FACILITY_PLACES.includes(d.place),
  };
}

export function generateDeliveryFlags(d: DeliveryInput): ClinicalFlag[] {
  const flags: ClinicalFlag[] = [];
  const babies = d.babies ?? [];

  // ═══ THE MOTHER ══════════════════════════════════════════════════════════

  // Postpartum haemorrhage. Pocket book: ≥500 ml vaginal, ≥1000 ml caesarean.
  // Estimation is imprecise in the field, which is an argument for acting on
  // it rather than for ignoring it.
  if (d.bloodLossMl != null) {
    const threshold = d.mode === 'sc' ? 1000 : 500;
    if (d.bloodLossMl >= threshold) {
      flags.push({
        type: 'PPH_DELIVERY', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 PERDARAHAN ${d.bloodLossMl} ml (≥ ${threshold} ml) — masase uterus, oksitosin, pasang infus, RUJUK.`,
        message_en: `🔴 BLOOD LOSS ${d.bloodLossMl} ml (≥ ${threshold} ml) — uterine massage, oxytocin, IV line, REFER.`,
      });
    }
  }

  if (d.motherOutcome === 'mati') {
    flags.push({
      type: 'MATERNAL_DEATH', severity: 'EMERGENCY', referral: false,
      message_id: '🔴 KEMATIAN IBU — wajib dilaporkan dan diaudit (AMP).',
      message_en: '🔴 MATERNAL DEATH — mandatory notification and audit (AMP).',
    });
  }

  // Complications the midwife recorded. Matched on substrings because this
  // arrives as her words or as codes depending on the surface.
  const comp = (d.complications ?? []).join(' ').toLowerCase();
  const has = (...words: string[]) => words.some((w) => comp.includes(w));

  if (has('eklampsia', 'kejang')) {
    flags.push({
      type: 'ECLAMPSIA', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 EKLAMPSIA / KEJANG — MgSO4 sesuai protokol, RUJUK SEGERA.',
      message_en: '🔴 ECLAMPSIA / SEIZURE — MgSO4 per protocol, REFER NOW.',
    });
  }
  if (has('retensio', 'plasenta tertinggal', 'retained')) {
    flags.push({
      type: 'RETAINED_PLACENTA', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 RETENSIO PLASENTA — risiko perdarahan, RUJUK SEGERA.',
      message_en: '🔴 RETAINED PLACENTA — haemorrhage risk, REFER NOW.',
    });
  }
  if (has('partus lama', 'macet', 'obstructed', 'prolonged')) {
    flags.push({
      type: 'OBSTRUCTED_LABOUR', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 PARTUS LAMA / MACET — RUJUK SEGERA.',
      message_en: '🔴 PROLONGED / OBSTRUCTED LABOUR — REFER NOW.',
    });
  }
  if (has('robekan', 'ruptur', 'laserasi derajat 3', 'laserasi derajat 4')) {
    flags.push({
      type: 'SEVERE_TEAR', severity: 'WARNING', referral: true,
      message_id: '🟡 ROBEKAN JALAN LAHIR — nilai derajat, rujuk bila derajat 3–4.',
      message_en: '🟡 PERINEAL TEAR — grade it; refer if third or fourth degree.',
    });
  }

  // ═══ TIMING ══════════════════════════════════════════════════════════════
  if (d.gestationalWeeks != null && d.gestationalWeeks > 0) {
    if (d.gestationalWeeks < 37) {
      flags.push({
        type: 'PRETERM_BIRTH', severity: 'WARNING', referral: false,
        message_id: `🟡 PERSALINAN PRETERM — ${d.gestationalWeeks} minggu. Jaga kehangatan bayi, pantau napas.`,
        message_en: `🟡 PRETERM BIRTH — ${d.gestationalWeeks} weeks. Keep the baby warm, watch breathing.`,
      });
    } else if (d.gestationalWeeks >= 42) {
      flags.push({
        type: 'POST_TERM_BIRTH', severity: 'INFO', referral: false,
        message_id: `ℹ️ Persalinan lewat waktu — ${d.gestationalWeeks} minggu.`,
        message_en: `ℹ️ Post-term birth — ${d.gestationalWeeks} weeks.`,
      });
    }
  }

  // ═══ EACH BABY ═══════════════════════════════════════════════════════════
  for (const b of babies) {
    const who = babies.length > 1 ? ` (bayi ${b.order})` : '';
    const whoEn = babies.length > 1 ? ` (baby ${b.order})` : '';

    if (b.outcome === 'mati') {
      flags.push({
        type: 'STILLBIRTH', severity: 'EMERGENCY', referral: false,
        message_id: `🔴 LAHIR MATI${who} — wajib dilaporkan dan diaudit (AMP).`,
        message_en: `🔴 STILLBIRTH${whoEn} — mandatory notification and audit (AMP).`,
      });
      continue;   // the checks below are about a living newborn
    }

    // Asphyxia. The single most time-critical newborn finding there is.
    if (b.criedImmediately === false) {
      flags.push({
        type: 'BIRTH_ASPHYXIA', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 BAYI TIDAK MENANGIS SPONTAN${who} — resusitasi segera, RUJUK.`,
        message_en: `🔴 BABY DID NOT BREATHE OR CRY${whoEn} — resuscitate now, REFER.`,
      });
    }

    if (b.weightGrams != null && b.weightGrams > 0) {
      if (b.weightGrams < 2000) {
        flags.push({
          type: 'VERY_LOW_BIRTH_WEIGHT', severity: 'EMERGENCY', referral: true,
          message_id: `🔴 BERAT LAHIR ${b.weightGrams} g (< 2000 g)${who} — RUJUK. Jaga kehangatan, metode kanguru.`,
          message_en: `🔴 BIRTH WEIGHT ${b.weightGrams} g (< 2000 g)${whoEn} — REFER. Keep warm, kangaroo care.`,
        });
      } else if (b.weightGrams < 2500) {
        flags.push({
          type: 'LOW_BIRTH_WEIGHT', severity: 'WARNING', referral: true,
          message_id: `🟡 BBLR — ${b.weightGrams} g (< 2500 g)${who}. Pantau ketat, konseling menyusui.`,
          message_en: `🟡 Low birth weight — ${b.weightGrams} g (< 2500 g)${whoEn}. Close monitoring, feeding support.`,
        });
      } else if (b.weightGrams >= 4000) {
        flags.push({
          type: 'MACROSOMIA', severity: 'INFO', referral: false,
          message_id: `ℹ️ Berat lahir ${b.weightGrams} g (≥ 4000 g)${who} — pantau gula darah bayi.`,
          message_en: `ℹ️ Birth weight ${b.weightGrams} g (≥ 4000 g)${whoEn} — monitor the baby's blood sugar.`,
        });
      }
    }

    // Mandated newborn care. INFO, not WARNING: these are usually still
    // possible in the hours after the birth, so this is a prompt rather than
    // a failure — and scolding a midwife on a form she is filling at 3am is
    // how the form gets abandoned.
    if (b.vitaminK === false) {
      flags.push({
        type: 'NO_VITAMIN_K', severity: 'WARNING', referral: false,
        message_id: `🟡 Vitamin K1 belum diberikan${who} — berikan dalam 1 jam pertama.`,
        message_en: `🟡 Vitamin K1 not given${whoEn} — give within the first hour.`,
      });
    }
    if (b.hepatitisB0 === false) {
      flags.push({
        type: 'NO_HB0', severity: 'WARNING', referral: false,
        message_id: `🟡 HB0 belum diberikan${who} — berikan dalam 24 jam pertama.`,
        message_en: `🟡 Hepatitis B0 not given${whoEn} — give within 24 hours.`,
      });
    }
    if (b.imd === false) {
      flags.push({
        type: 'NO_IMD', severity: 'INFO', referral: false,
        message_id: `ℹ️ IMD belum dilakukan${who} — mulai menyusu sedini mungkin.`,
        message_en: `ℹ️ Early breastfeeding initiation not done${whoEn} — start as soon as possible.`,
      });
    }
  }

  // ═══ WHERE AND BY WHOM ═══════════════════════════════════════════════════
  // A quality signal, never a clinical one, and deliberately not a rebuke: a
  // birth attended by a dukun is usually a transport or a cost problem, and
  // the midwife recording it honestly is doing exactly the right thing.
  const { skilledAttendant, atFacility } = linakes(d);
  if (d.attendant != null && !skilledAttendant) {
    flags.push({
      type: 'UNSKILLED_ATTENDANT', severity: 'INFO', referral: false,
      message_id: 'ℹ️ Persalinan tidak ditolong tenaga kesehatan — pastikan kunjungan nifas & KN dijadwalkan.',
      message_en: 'ℹ️ Birth not attended by a skilled provider — make sure postnatal and newborn visits are scheduled.',
    });
  } else if (d.place != null && !atFacility && skilledAttendant) {
    flags.push({
      type: 'HOME_BIRTH_SKILLED', severity: 'INFO', referral: false,
      message_id: 'ℹ️ Persalinan di luar fasilitas kesehatan, ditolong tenaga kesehatan.',
      message_en: 'ℹ️ Birth outside a health facility, attended by a skilled provider.',
    });
  }

  return flags;
}

/** Mirrors shouldRefer / shouldReferPnc so all three surfaces route alike. */
export function shouldReferDelivery(flags: ClinicalFlag[]): {
  refer: boolean;
  urgency: 'emergency' | 'urgent' | 'routine' | 'none';
  reasons: string[];
} {
  const referring = flags.filter((f) => f.referral);
  if (referring.length === 0) return { refer: false, urgency: 'none', reasons: [] };
  const emergency = referring.some((f) => f.severity === 'EMERGENCY');
  return {
    refer: true,
    urgency: emergency ? 'emergency' : 'urgent',
    reasons: referring.map((f) => f.type),
  };
}
