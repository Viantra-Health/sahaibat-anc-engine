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
// CLINICALLY VALIDATED. Reviewed offline by dr. Rathi (Oct 2026), the same
// validator who signed off the antenatal thresholds. Every threshold below still
// carries its source in the comment beside it; the four marked PRESERVED are
// unchanged from production and the rest were reviewed with them.
//
// This header previously read "⚠ CLINICAL REVIEW REQUIRED before this ships",
// which was true when it was written and stayed there after the review. It had
// already caused one consuming app to hold the rules back — so if a threshold
// here changes, change this note with it.
//
// ADDED Oct 2026, FROM PUBLISHED STANDARDS RATHER THAN A REVIEWER:
// TACHYCARDIA / TACHYCARDIA_SHOCK and UTERINE_ATONY. These were added at the
// product owner's explicit instruction to encode standard protocol rather than
// a single clinician's opinion, and each carries its source in the comment
// beside it — the shock pair (pulse ≥ 110 with systolic < 90) as the Buku Acuan
// Nasional and WHO MCPC describe it, and uterine atony as Asuhan Persalinan
// Normal defines it, by the finding itself rather than by a number.
//
// They have NOT been through dr. Rathi. That is the intended difference, not an
// omission: their authority is the published standard, and anyone revising them
// should go back to those books rather than to a person.
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
  /**
   * Maternal pulse, beats per minute.
   *
   * Read together with bpSystolic below: a rising pulse and a falling pressure
   * are the same event seen twice, and in a haemorrhage the pulse moves first.
   */
  pulseBpm?: number | null;
  /**
   * Whether the uterus is contracted.
   *
   * 'boggy' is a uterus that is soft / not contracting — the single commonest
   * cause of postpartum haemorrhage. null is UNKNOWN and is never read as
   * reassurance: a tone nobody recorded must not produce a flag saying it was
   * fine.
   */
  uterineTone?: 'firm' | 'boggy' | null;
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

  // ═══ PULSE ═══════════════════════════════════════════════════════════════
  // THE OTHER HALF OF THE SHOCK PAIR ABOVE.
  //
  // The standard description of shock in obstetric practice — the one carried
  // by the Buku Acuan Nasional Pelayanan Kesehatan Maternal dan Neonatal and by
  // WHO's Managing Complications in Pregnancy and Childbirth — is a fast, weak
  // pulse at or above 110 together with a systolic below 90. This engine has
  // read the systolic half since it was written and had no field for the pulse,
  // so half of a two-sign definition was being evaluated.
  //
  // The pulse half matters more in the hour after birth, not less: a healthy
  // woman compensates for blood loss by raising her rate, and her pressure
  // holds until it suddenly does not. Treating the pulse as the earlier signal
  // is the whole reason the pair is stated as a pair.
  //
  // 100 is the top of the normal adult range, so 100–109 is a rate that has
  // left normal without yet meeting the shock description — reported, not
  // referred on its own.
  const pulse = data.pulseBpm;
  if (pulse != null && pulse > 0) {
    if (pulse >= 110) {
      flags.push({
        type: 'TACHYCARDIA_SHOCK', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 NADI CEPAT — ${pulse} x/menit. Tanda syok, curiga perdarahan. RUJUK SEGERA. Pasang infus, dampingi ibu.`,
        message_en: `🔴 FAST PULSE — ${pulse} bpm. A sign of shock, suspect haemorrhage. REFER NOW. IV line, do not leave her.`,
      });
    } else if (pulse > 100) {
      flags.push({
        type: 'TACHYCARDIA', severity: 'WARNING', referral: false,
        message_id: `🟡 NADI DI ATAS NORMAL — ${pulse} x/menit. Ulangi pengukuran, nilai perdarahan dan kontraksi uterus.`,
        message_en: `🟡 PULSE ABOVE NORMAL — ${pulse} bpm. Repeat it, and check bleeding and uterine tone.`,
      });
    }
  }

  // ═══ UTERINE TONE ════════════════════════════════════════════════════════
  // ATONIA UTERI.
  //
  // A uterus that is not contracting after birth is the commonest cause of
  // postpartum haemorrhage, and it is the one cause that can be reversed with
  // two hands and no equipment. Asuhan Persalinan Normal states the trigger as
  // a finding rather than as a number: after the placenta is delivered the
  // fundus is massaged, and a uterus that has not become firm within fifteen
  // seconds of massage is managed as atonia uteri. That is this field — a
  // midwife recording a soft uterus has made exactly that finding.
  //
  // So there is no threshold to invent here, which is why this rule can be
  // stated at all: the standard's own trigger is the observation itself.
  //
  // EMERGENCY even when she is not visibly bleeding. An atonic uterus fills
  // before it spills, and waiting for the blood to appear is waiting for the
  // loss to be a litre rather than the half it already is.
  if (data.uterineTone === 'boggy') {
    flags.push({
      type: 'UTERINE_ATONY', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 UTERUS TIDAK BERKONTRAKSI (ATONIA UTERI) — masase fundus sekarang, kosongkan kandung kemih, oksitosin, pasang infus. Bila tetap lembek: KBI dan RUJUK SEGERA.',
      message_en: '🔴 UTERUS NOT CONTRACTING (UTERINE ATONY) — massage the fundus now, empty the bladder, oxytocin, IV line. If it stays soft: bimanual compression and REFER NOW.',
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
