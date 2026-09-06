// @sahaibat/anc-engine · src/pncFlags.ts
//
// Postnatal clinical flags (KF1–KF4).
//
// WHY THIS FILE EXISTS
// --------------------
// Four postnatal rules lived inline in bidanEngine.ts, typed `any[]`, untested,
// and unreachable from the Bidan app — which is why the app rejected PNC rather
// than half-supporting it. All four are preserved here exactly, and the gaps
// around them are filled.
//
// The gap that mattered most: `suhu` was parsed and stored on every postnatal
// visit and no rule ever read it. Puerperal sepsis is a leading direct cause of
// maternal death in Indonesia, its sign is a fever, and we were writing the
// fever into a column and moving on.
//
// ⚠ CLINICAL REVIEW REQUIRED before this ships. Every threshold below carries
// its source. The four marked PRESERVED are unchanged from production; the rest
// are standard obstetric cut-offs and need a midwife or obstetrician to sign
// them off, exactly as the ANC thresholds were signed off.
//
// Severity means: EMERGENCY = refer now. WARNING = act, may not need referral.
// INFO = record it. `referral` is separate from severity on purpose — mild
// anaemia is a WARNING that does not refer, and the same distinction holds here.

import type { ClinicalFlag } from './clinicalFlags';

export interface PncClinicalInput {
  daysPostpartum: number;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  temperatureC?: number | null;
  bleeding?: 'none' | 'normal' | 'high' | null;
  lochiaFoul?: boolean | null;
  woundInfected?: boolean | null;
  breastfeedingEstablished?: boolean | null;
  babyWeightKg?: number | null;
  jaundiceSevere?: boolean | null;
  epdsScore?: number | null;
  complaints?: string | null;
}

export function generatePncFlags(data: PncClinicalInput): ClinicalFlag[] {
  const flags: ClinicalFlag[] = [];

  // ═══ HAEMORRHAGE ═════════════════════════════════════════════════════════
  // PRESERVED. Postpartum haemorrhage is the leading direct cause of maternal
  // death worldwide and kills fastest in the first 24 hours.
  if (data.bleeding === 'high') {
    flags.push({
      type: 'PPH', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 PERDARAHAN POSTPARTUM BERAT — RUJUK SEGERA. Masase uterus, pasang infus, dampingi ibu.',
      message_en: '🔴 SEVERE POSTPARTUM HAEMORRHAGE — REFER NOW. Uterine massage, IV line, do not leave her.',
    });
  }

  // Free-text catch, mirroring the ANC engine's bleeding rule. She may describe
  // it in her complaints rather than answering the bleeding field.
  if (data.bleeding !== 'high' && data.complaints) {
    const c = data.complaints.toLowerCase();
    if (/\b(perdarahan|pendarahan)\b/.test(c) && /\b(banyak|hebat|deras|berat)\b/.test(c)
        && !/\b(tidak|tdk|belum|berhenti)\b/.test(c)) {
      flags.push({
        type: 'PPH_REPORTED', severity: 'EMERGENCY', referral: true,
        message_id: '🔴 PERDARAHAN BERAT DILAPORKAN — RUJUK SEGERA.',
        message_en: '🔴 HEAVY BLEEDING REPORTED — REFER NOW.',
      });
    }
  }

  // ═══ SEPSIS — the rule that did not exist ════════════════════════════════
  // WHO defines puerperal fever as ≥38.0 °C. Combined with foul lochia or an
  // infected wound it is puerperal sepsis until proven otherwise.
  if (data.temperatureC != null) {
    if (data.temperatureC >= 38.0) {
      const focus = data.lochiaFoul === true || data.woundInfected === true;
      flags.push({
        type: focus ? 'PUERPERAL_SEPSIS' : 'PUERPERAL_FEVER',
        severity: 'EMERGENCY', referral: true,
        message_id: focus
          ? `🔴 DUGAAN SEPSIS NIFAS — suhu ${data.temperatureC}°C dengan tanda infeksi. RUJUK SEGERA.`
          : `🔴 DEMAM NIFAS — suhu ${data.temperatureC}°C (≥ 38°C). Curiga infeksi. RUJUK SEGERA.`,
        message_en: focus
          ? `🔴 SUSPECTED PUERPERAL SEPSIS — ${data.temperatureC}°C with signs of infection. REFER NOW.`
          : `🔴 PUERPERAL FEVER — ${data.temperatureC}°C (≥ 38°C). Suspect infection. REFER NOW.`,
      });
    } else if (data.temperatureC >= 37.5) {
      flags.push({
        type: 'LOW_GRADE_FEVER', severity: 'WARNING', referral: false,
        message_id: `🟡 Suhu ${data.temperatureC}°C — pantau ketat, ukur ulang dalam 4 jam.`,
        message_en: `🟡 Temperature ${data.temperatureC}°C — monitor closely, recheck in 4 hours.`,
      });
    } else if (data.temperatureC < 35.5) {
      flags.push({
        type: 'HYPOTHERMIA', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 HIPOTERMIA — suhu ${data.temperatureC}°C. Tanda sepsis berat. RUJUK SEGERA.`,
        message_en: `🔴 HYPOTHERMIA — ${data.temperatureC}°C. A sign of severe sepsis. REFER NOW.`,
      });
    }
  }

  // Infection signs without a recorded temperature still warrant referral —
  // a midwife with no thermometer must not be silently downgraded.
  if (data.lochiaFoul === true) {
    flags.push({
      type: 'FOUL_LOCHIA', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 LOKIA BERBAU — dugaan endometritis. RUJUK SEGERA.',
      message_en: '🔴 FOUL-SMELLING LOCHIA — suspected endometritis. REFER NOW.',
    });
  }
  if (data.woundInfected === true) {
    flags.push({
      type: 'WOUND_INFECTION', severity: 'WARNING', referral: true,
      message_id: '🟡 LUKA TERINFEKSI — perawatan luka, rujuk untuk antibiotik.',
      message_en: '🟡 WOUND INFECTION — wound care, refer for antibiotics.',
    });
  }

  // ═══ BLOOD PRESSURE ══════════════════════════════════════════════════════
  // Pre-eclampsia and eclampsia can appear or worsen AFTER delivery, and the
  // late presentation is the one that gets missed.
  const sys = data.bpSystolic ?? null;
  const dia = data.bpDiastolic ?? null;

  if ((sys != null && sys >= 160) || (dia != null && dia >= 110)) {
    flags.push({
      type: 'SEVERE_HYPERTENSION_PNC', severity: 'EMERGENCY', referral: true,
      message_id: `🔴 HIPERTENSI BERAT POSTPARTUM — TD ${sys}/${dia}. Risiko eklampsia. RUJUK SEGERA.`,
      message_en: `🔴 SEVERE POSTPARTUM HYPERTENSION — BP ${sys}/${dia}. Eclampsia risk. REFER NOW.`,
    });
  } else if (sys != null && sys >= 140) {
    // PRESERVED — the production rule was systolic ≥ 140, WARNING.
    flags.push({
      type: 'HYPERTENSION_PNC', severity: 'WARNING', referral: false,
      message_id: `🟡 TD TINGGI POSTPARTUM — ${sys}/${dia ?? '?'}. Pantau pre-eklampsia postpartum.`,
      message_en: `🟡 RAISED POSTPARTUM BP — ${sys}/${dia ?? '?'}. Monitor for postpartum pre-eclampsia.`,
    });
  }

  // Shock. After delivery a low systolic is bleeding until proven otherwise,
  // and it may be the only sign when the blood is still inside her.
  if (sys != null && sys < 90) {
    flags.push({
      type: 'HYPOTENSION_SHOCK', severity: 'EMERGENCY', referral: true,
      message_id: `🔴 TEKANAN DARAH RENDAH — ${sys}/${dia ?? '?'}. Curiga syok/perdarahan. RUJUK SEGERA.`,
      message_en: `🔴 LOW BLOOD PRESSURE — ${sys}/${dia ?? '?'}. Suspect shock/haemorrhage. REFER NOW.`,
    });
  }

  // ═══ MENTAL HEALTH ═══════════════════════════════════════════════════════
  // PRESERVED at ≥ 10. EPDS ≥ 13 is the usual cut-off for probable depression,
  // so that tier refers where 10 only warns.
  if (data.epdsScore != null) {
    if (data.epdsScore >= 13) {
      flags.push({
        type: 'EPDS_PROBABLE_DEPRESSION', severity: 'WARNING', referral: true,
        message_id: `🟡 EPDS ${data.epdsScore}/30 — kemungkinan depresi postpartum. Rujuk untuk kesehatan mental.`,
        message_en: `🟡 EPDS ${data.epdsScore}/30 — probable postnatal depression. Refer for mental health care.`,
      });
    } else if (data.epdsScore >= 10) {
      flags.push({
        type: 'EPDS_POSITIVE', severity: 'WARNING', referral: false,
        message_id: `🟡 EPDS ${data.epdsScore}/30 — risiko depresi postpartum, tindak lanjut kesehatan mental.`,
        message_en: `🟡 EPDS ${data.epdsScore}/30 — postnatal depression risk, mental health follow-up.`,
      });
    }
  }

  // ═══ THE BABY ════════════════════════════════════════════════════════════
  // PRESERVED. Severe jaundice in a newborn risks kernicterus, which is
  // permanent and preventable.
  if (data.jaundiceSevere === true) {
    flags.push({
      type: 'SEVERE_JAUNDICE', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 IKTERUS BERAT NEONATAL — RUJUK SEGERA.',
      message_en: '🔴 SEVERE NEONATAL JAUNDICE — REFER NOW.',
    });
  }

  if (data.babyWeightKg != null && data.babyWeightKg > 0) {
    if (data.babyWeightKg < 2.0) {
      flags.push({
        type: 'VERY_LOW_BIRTH_WEIGHT', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 BERAT BAYI ${data.babyWeightKg} kg (< 2,0 kg) — RUJUK SEGERA. Jaga kehangatan, metode kanguru.`,
        message_en: `🔴 BABY WEIGHT ${data.babyWeightKg} kg (< 2.0 kg) — REFER NOW. Keep warm, kangaroo care.`,
      });
    } else if (data.babyWeightKg < 2.5) {
      flags.push({
        type: 'LOW_BIRTH_WEIGHT', severity: 'WARNING', referral: true,
        message_id: `🟡 BBLR — berat bayi ${data.babyWeightKg} kg (< 2,5 kg). Pantau ketat, konseling menyusui.`,
        message_en: `🟡 Low birth weight — ${data.babyWeightKg} kg (< 2.5 kg). Close monitoring, feeding support.`,
      });
    }
  }

  if (data.breastfeedingEstablished === false) {
    flags.push({
      type: 'BREASTFEEDING_PROBLEM', severity: 'WARNING', referral: false,
      message_id: '🟡 Menyusui belum lancar — konseling laktasi, periksa perlekatan.',
      message_en: '🟡 Breastfeeding not established — lactation counselling, check attachment.',
    });
  }

  // ═══ SCHEDULE ════════════════════════════════════════════════════════════
  // Kemenkes KF windows. INFO only: a late visit is still a visit, and a
  // midwife who walked four hours to make it should not be scolded by a form.
  const late = kfWindowMiss(data.daysPostpartum);
  if (late) {
    flags.push({
      type: 'KF_SCHEDULE', severity: 'INFO', referral: false,
      message_id: `ℹ️ Kunjungan hari ke-${data.daysPostpartum} — ${late.id}`,
      message_en: `ℹ️ Day ${data.daysPostpartum} visit — ${late.en}`,
    });
  }

  return flags;
}

/** KF1 6h–2d · KF2 3–7d · KF3 8–28d · KF4 29–42d. Returns null when on time. */
function kfWindowMiss(days: number): { id: string; en: string } | null {
  if (days < 0) return null;
  if (days > 42) {
    return { id: 'di luar masa nifas (> 42 hari).', en: 'outside the postnatal period (> 42 days).' };
  }
  return null;
}

/** Which KF a given day belongs to, for scheduling the roll. */
export function kfForDay(days: number): 'KF1' | 'KF2' | 'KF3' | 'KF4' | null {
  if (days < 0) return null;
  if (days <= 2) return 'KF1';
  if (days <= 7) return 'KF2';
  if (days <= 28) return 'KF3';
  if (days <= 42) return 'KF4';
  return null;
}

/** Mirrors shouldRefer for ANC, so both surfaces route referrals identically. */
export function shouldReferPnc(flags: ClinicalFlag[]): {
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
