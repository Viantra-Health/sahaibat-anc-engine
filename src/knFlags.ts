// @sahaibat/anc-engine · src/knFlags.ts
//
// KN1–KN3 — the newborn visits, 0 to 28 days.
//
// WHY THIS IS NOT KADER'S NEONATAL ENGINE
// ---------------------------------------
// Kader already ships a neonatal triage engine covering the same 28 days, and
// the two are complementary rather than duplicate. Kader answers "is this baby
// sick right now" when a mother brings her in. This answers "has the scheduled
// contact been done, and what did it find". A kader spotting a sick baby on
// day 9 and a midwife doing KN2 on day 5 are both correct.
//
// There is no handover event between them. One member_id, both surfaces write,
// nobody is cut off at day 28 — see the product design.
//
// SOURCES. MTBM (Manajemen Terpadu Bayi Muda) and Buku KIA 2024. A newborn
// decompensates far faster than an adult, so several thresholds that would be
// a warning in a mother are an emergency here — hypothermia most of all.
//
// ⚠ Clinical review before shipping, as with the antenatal and postnatal sets.

import type { ClinicalFlag } from './clinicalFlags';

export interface KnInput {
  /** Days since birth. 0 is the day of delivery. */
  dayOfLife: number;
  /** Weight at this visit, grams. */
  weightGrams?: number | null;
  /** Birth weight, to measure the change against. */
  birthWeightGrams?: number | null;
  temperatureC?: number | null;

  /** Feeding well, or not at all — the earliest sign of nearly everything. */
  feedingWell?: boolean | null;
  /** Cord red, wet, smelly or discharging. */
  cordInfected?: boolean | null;

  /** Visible jaundice, and how far it extends. Palms and soles are severe. */
  jaundice?: boolean | null;
  jaundicePalmsSoles?: boolean | null;

  convulsions?: boolean | null;
  /** ≥ 60 per minute, or severe chest indrawing. */
  fastBreathing?: boolean | null;
  chestIndrawing?: boolean | null;
  /** Moves only when stimulated, or not at all. */
  lethargic?: boolean | null;

  // Mandated newborn care, carried from the birth when it was recorded there.
  hepatitisB0?: boolean | null;
  bcg?: boolean | null;
  polio0?: boolean | null;
  vitaminK?: boolean | null;
  /** Skrining Hipotiroid Kongenital — heel prick, ideally 48–72 hours. */
  shk?: boolean | null;
}

/** KN1 0–2 days · KN2 3–7 · KN3 8–28. Null once past the newborn period. */
export function knForDay(days: number): 'KN1' | 'KN2' | 'KN3' | null {
  if (days < 0) return null;
  if (days <= 2) return 'KN1';
  if (days <= 7) return 'KN2';
  if (days <= 28) return 'KN3';
  return null;
}

export function generateKnFlags(d: KnInput): ClinicalFlag[] {
  const flags: ClinicalFlag[] = [];
  const day = d.dayOfLife;

  // ═══ DANGER SIGNS — MTBM, any one of these is a referral ═════════════════
  if (d.convulsions === true) {
    flags.push({
      type: 'KN_CONVULSIONS', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 KEJANG — tanda bahaya. Jaga jalan napas, jaga kehangatan, RUJUK SEGERA.',
      message_en: '🔴 CONVULSIONS — danger sign. Airway, keep warm, REFER NOW.',
    });
  }
  if (d.feedingWell === false) {
    flags.push({
      type: 'KN_NOT_FEEDING', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 TIDAK MAU MENYUSU / MENYUSU LEMAH — tanda bahaya. RUJUK SEGERA.',
      message_en: '🔴 NOT FEEDING OR FEEDING POORLY — danger sign. REFER NOW.',
    });
  }
  if (d.lethargic === true) {
    flags.push({
      type: 'KN_LETHARGY', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 BERGERAK HANYA BILA DIRANGSANG — tanda bahaya. RUJUK SEGERA.',
      message_en: '🔴 MOVES ONLY WHEN STIMULATED — danger sign. REFER NOW.',
    });
  }
  if (d.fastBreathing === true || d.chestIndrawing === true) {
    flags.push({
      type: 'KN_BREATHING', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 NAPAS CEPAT / TARIKAN DINDING DADA — tanda bahaya. RUJUK SEGERA.',
      message_en: '🔴 FAST BREATHING OR CHEST INDRAWING — danger sign. REFER NOW.',
    });
  }

  // ═══ TEMPERATURE ═════════════════════════════════════════════════════════
  // A newborn loses heat far faster than she can make it, and hypothermia is
  // both a killer in itself and the commonest presenting sign of sepsis. It is
  // an emergency here where it would be a warning in a mother.
  if (d.temperatureC != null) {
    if (d.temperatureC < 36.0) {
      flags.push({
        type: 'KN_SEVERE_HYPOTHERMIA', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 HIPOTERMIA BERAT — ${d.temperatureC}°C (< 36,0). Metode kanguru sekarang, RUJUK.`,
        message_en: `🔴 SEVERE HYPOTHERMIA — ${d.temperatureC}°C (< 36.0). Kangaroo care now, REFER.`,
      });
    } else if (d.temperatureC < 36.5) {
      flags.push({
        type: 'KN_HYPOTHERMIA', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 HIPOTERMIA — ${d.temperatureC}°C (< 36,5). Hangatkan, kontak kulit ke kulit, ukur ulang 1 jam.`,
        message_en: `🔴 HYPOTHERMIA — ${d.temperatureC}°C (< 36.5). Warm her, skin to skin, recheck in 1 hour.`,
      });
    } else if (d.temperatureC >= 37.5) {
      flags.push({
        type: 'KN_FEVER', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 DEMAM — ${d.temperatureC}°C (≥ 37,5). Curiga infeksi berat. RUJUK SEGERA.`,
        message_en: `🔴 FEVER — ${d.temperatureC}°C (≥ 37.5). Suspect serious infection. REFER NOW.`,
      });
    }
  }

  // ═══ CORD ════════════════════════════════════════════════════════════════
  if (d.cordInfected === true) {
    flags.push({
      type: 'KN_CORD_INFECTION', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 INFEKSI TALI PUSAT — merah / bernanah / berbau. RUJUK SEGERA.',
      message_en: '🔴 CORD INFECTION — red, discharging or foul-smelling. REFER NOW.',
    });
  }

  // ═══ JAUNDICE — the day it appears is the whole diagnosis ════════════════
  if (d.jaundicePalmsSoles === true) {
    flags.push({
      type: 'KN_JAUNDICE_SEVERE', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 IKTERUS SAMPAI TELAPAK TANGAN / KAKI — risiko kernikterus. RUJUK SEGERA.',
      message_en: '🔴 JAUNDICE REACHING PALMS OR SOLES — kernicterus risk. REFER NOW.',
    });
  } else if (d.jaundice === true) {
    if (day <= 1) {
      // Jaundice in the first 24 hours is pathological until proven otherwise;
      // physiological jaundice does not appear that early.
      flags.push({
        type: 'KN_JAUNDICE_DAY1', severity: 'EMERGENCY', referral: true,
        message_id: '🔴 IKTERUS PADA HARI PERTAMA — selalu patologis. RUJUK SEGERA.',
        message_en: '🔴 JAUNDICE ON DAY ONE — always pathological. REFER NOW.',
      });
    } else if (day > 14) {
      flags.push({
        type: 'KN_JAUNDICE_PROLONGED', severity: 'WARNING', referral: true,
        message_id: `🟡 IKTERUS MENETAP — hari ke-${day} (> 14 hari). Perlu pemeriksaan lanjut.`,
        message_en: `🟡 PROLONGED JAUNDICE — day ${day} (> 14 days). Needs further assessment.`,
      });
    } else {
      flags.push({
        type: 'KN_JAUNDICE', severity: 'WARNING', referral: false,
        message_id: `🟡 Ikterus hari ke-${day} — pantau, pastikan menyusu sering, nilai ulang.`,
        message_en: `🟡 Jaundice on day ${day} — monitor, ensure frequent feeding, reassess.`,
      });
    }
  }

  // ═══ WEIGHT ══════════════════════════════════════════════════════════════
  // Losing up to a tenth in the first week is physiological. More than that,
  // or still below birth weight at two weeks, is a feeding problem.
  if (d.weightGrams != null && d.birthWeightGrams != null
      && d.weightGrams > 0 && d.birthWeightGrams > 0) {
    const lostPct = ((d.birthWeightGrams - d.weightGrams) / d.birthWeightGrams) * 100;

    if (lostPct > 10) {
      flags.push({
        type: 'KN_WEIGHT_LOSS', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 BERAT TURUN ${lostPct.toFixed(0)}% dari lahir (> 10%) — masalah menyusu. RUJUK.`,
        message_en: `🔴 WEIGHT DOWN ${lostPct.toFixed(0)}% from birth (> 10%) — feeding problem. REFER.`,
      });
    } else if (day >= 14 && d.weightGrams < d.birthWeightGrams) {
      flags.push({
        type: 'KN_NOT_REGAINED', severity: 'WARNING', referral: true,
        message_id: `🟡 Berat belum kembali ke berat lahir pada hari ke-${day} — konseling menyusui, nilai perlekatan.`,
        message_en: `🟡 Has not regained birth weight by day ${day} — feeding counselling, check attachment.`,
      });
    }
  }

  if (d.weightGrams != null && d.weightGrams > 0 && d.weightGrams < 2500) {
    flags.push({
      type: 'KN_LOW_WEIGHT', severity: 'WARNING', referral: false,
      message_id: `🟡 Berat ${d.weightGrams} g (< 2500 g) — jaga kehangatan, metode kanguru, pantau ketat.`,
      message_en: `🟡 Weight ${d.weightGrams} g (< 2500 g) — keep warm, kangaroo care, close monitoring.`,
    });
  }

  // ═══ MANDATED CARE, BY ITS OWN DEADLINE ══════════════════════════════════
  // Only an explicit false counts. Unrecorded is not undone.
  if (d.hepatitisB0 === false && day >= 1) {
    flags.push({
      type: 'KN_NO_HB0', severity: 'WARNING', referral: false,
      message_id: '🟡 HB0 belum diberikan — idealnya dalam 24 jam pertama, berikan sesegera mungkin.',
      message_en: '🟡 Hepatitis B0 not given — ideally within 24 hours; give as soon as possible.',
    });
  }
  if (d.vitaminK === false) {
    flags.push({
      type: 'KN_NO_VITAMIN_K', severity: 'WARNING', referral: false,
      message_id: '🟡 Vitamin K1 belum diberikan — risiko perdarahan. Berikan sekarang.',
      message_en: '🟡 Vitamin K1 not given — bleeding risk. Give now.',
    });
  }
  if (d.bcg === false && day >= 7) {
    flags.push({
      type: 'KN_NO_BCG', severity: 'INFO', referral: false,
      message_id: 'ℹ️ BCG belum diberikan — jadwalkan sebelum usia 1 bulan.',
      message_en: 'ℹ️ BCG not given — schedule before one month.',
    });
  }
  if (d.polio0 === false && day >= 7) {
    flags.push({
      type: 'KN_NO_POLIO0', severity: 'INFO', referral: false,
      message_id: 'ℹ️ Polio 0 belum diberikan — jadwalkan.',
      message_en: 'ℹ️ Polio 0 not given — schedule it.',
    });
  }
  // SHK is a heel prick sent to a laboratory, so this prompts the sample being
  // taken rather than a result being known. Its window is 48–72 hours.
  if (d.shk === false && day >= 3) {
    flags.push({
      type: 'KN_NO_SHK', severity: 'WARNING', referral: false,
      message_id: `ℹ️ SHK belum diambil (hari ke-${day}) — idealnya 48–72 jam. Ambil sampel sesegera mungkin.`,
      message_en: `ℹ️ Congenital hypothyroid screening not taken (day ${day}) — ideally 48–72 hours. Take the sample as soon as possible.`,
    });
  }

  // ═══ SCHEDULE ════════════════════════════════════════════════════════════
  if (day > 28) {
    flags.push({
      type: 'KN_OUT_OF_WINDOW', severity: 'INFO', referral: false,
      message_id: `ℹ️ Hari ke-${day} sudah di luar masa neonatal (28 hari) — lanjutkan pemantauan di Posyandu.`,
      message_en: `ℹ️ Day ${day} is past the neonatal period (28 days) — continue monitoring at the Posyandu.`,
    });
  }

  return flags;
}

/** Mirrors the other three, so every surface routes referrals identically. */
export function shouldReferKn(flags: ClinicalFlag[]): {
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
