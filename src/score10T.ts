// src/score10T.ts
// Pure function: scores an ANC visit against Indonesia's 10T standard.
// No side effects, no database calls, no API calls.
//
// ── THE NUMBERS ARE THE STANDARD'S, AS OF 20 OCT 2026 ───────────────────────
//
// They were not. This file scored ten activities under its own numbering, and
// six of the nine that mapped sat under the wrong number:
//
//   was t3 fundal height    -> T4        was t7 counselling   -> T10
//   was t4 tetanus          -> T6        was t8 presentation  -> T5
//   was t5 iron tablets     -> T7        was t10 followup     -> not a 10T item
//   was t6 laboratory       -> T8
//
// That is not a cosmetic problem. v_clinic_anc_quality publishes these keys and
// a clinic dashboard printed them as T-numbers, so a Puskesmas supervisor
// trained on the standard read "T3: 90%" as nilai status gizi — the LILA
// measurement — when the figure was about fundal height. A true number about a
// different activity, under a name the reader trusts.
//
// Renumbered on Sanjib's instruction, 20 Oct 2026, with every stored visit
// confirmed as demo data so there is nothing to migrate.
//
// THE TEN, AS THE STANDARD NUMBERS THEM (Permenkes 30/2022 and the national ANC
// technical guidance — NOT Permenkes 11/2025, which is facility licensing and
// does not mention 10T at all):
//
//   T1  Timbang berat badan dan ukur tinggi badan
//   T2  Ukur tekanan darah
//   T3  Nilai status gizi / ukur LILA
//   T4  Ukur tinggi fundus uteri
//   T5  Tentukan presentasi janin dan DJJ
//   T6  Skrining status imunisasi tetanus
//   T7  Berikan tablet tambah darah
//   T8  Pemeriksaan laboratorium
//   T9  Tata laksana kasus
//   T10 Temu wicara / konseling
//
// ── WHAT CHANGED BESIDES THE NUMBERS, AND WHAT DID NOT ──────────────────────
//
// ADDED: T3. Nothing scored nutritional status before, so the ten had a hole in
// it while reporting out of ten. LILA was already captured and already raised a
// KEK flag below 23.5 cm, so the clinical half was covered and only the
// completeness figure was blind to it.
//
// REMOVED FROM THE SCORE: the follow-up plan. Recording when she should come
// back is good practice and is not one of the ten, so a visit was losing a
// tenth of its score for omitting something the standard never asked for. The
// field is still accepted and still stored; it simply no longer scores.
//
// UNCHANGED: what each activity TESTS, and when it is expected. Fundal height
// is still expected from 12 weeks and presentation still from 36. Renumbering
// is not an invitation to re-decide clinical windows, and two of them are worth
// a second look by somebody qualified rather than by this file — see the notes
// on T1 and T5.

export interface AncVisitData {
  gestationalWeeks: number;

  /** T1 — Timbang berat badan dan ukur tinggi badan.
   *  NOTE: only the WEIGHT is tested. Height is measured once and does not
   *  change, so requiring it at every contact would mark down every visit after
   *  the first. Whether T1 should therefore need height at the FIRST contact is
   *  a clinical question this file does not answer on its own. */
  t1WeightKg?: number | null;

  /** T2 — Ukur tekanan darah. */
  t2BpSystolic?: number | null;
  t2BpDiastolic?: number | null;

  /** T3 — Nilai status gizi, measured as mid-upper-arm circumference in cm.
   *  NEW to the score. See isFirstContact for when it is expected. */
  t3LilaCm?: number | null;

  /** T4 — Ukur tinggi fundus uteri. Was t3. */
  t4FundalHeightCm?: number | null;

  /** T5 — Tentukan presentasi janin dan DJJ. Was t8.
   *  NOTE: only the PRESENTATION is tested, and only from 36 weeks, which is
   *  when presentation becomes actionable. The standard pairs it with DJJ,
   *  which is listened for far earlier — so a visit at 24 weeks that recorded a
   *  fetal heart rate gets no credit for T5. Carried forward unchanged from
   *  before the renumber rather than quietly re-decided; it needs a clinical
   *  ruling, and `t5DjjBpm` is accepted below so that ruling has somewhere to
   *  land. */
  t5Presentation?: string | null;
  t5DjjBpm?: number | null;

  /** T6 — Skrining status imunisasi tetanus. Was t4. */
  t6TtStatus?: string | null;

  /** T7 — Berikan tablet tambah darah. Was t5. */
  t7FeTablets?: number | null;

  /** T8 — Pemeriksaan laboratorium. Was t6. */
  t8LabHb?: number | null;
  t8LabProtein?: string | null;
  t8LabOther?: Record<string, any> | null;

  /** T9 — Tata laksana kasus. */
  t9CaseManagement?: string | null;

  /** T10 — Temu wicara / konseling. Was t7. */
  t10CounsellingTopics?: string[] | null;

  /**
   * NOT ONE OF THE TEN, and no longer scored. Was t10.
   * Accepted and stored because it is useful; it does not move the score.
   */
  followupPlan?: string | null;

  /**
   * Is this her FIRST antenatal contact?
   *
   * Decides whether T3 is expected. Nutritional status is assessed at the first
   * contact; re-measuring LILA at every later visit is not what the standard
   * asks for, and expecting it would mark down a clinic doing exactly the right
   * thing.
   *
   * ABSENT MEANS NOT EXPECTED, deliberately. The visit-by-visit matrix in the
   * national primary-care guidance is what properly decides this and it is not
   * encoded here, so the default is the one that cannot accuse anybody: a
   * caller that does not say gets no T3 requirement, and a LILA supplied anyway
   * still counts as done.
   */
  isFirstContact?: boolean | null;
}

export interface QualityResult {
  score: number;                    // 0-10
  completed: string[];              // e.g. ['t1','t2','t4']
  skipped: string[];
  /** Items that should have been done at this gestational age and were not. */
  expectedButSkipped: string[];
  /** Items not expected here — T4 before 12 weeks, T5 before 36, T3 after the
   *  first contact. Not counted against the visit. */
  notExpected: string[];
  gestationalAgeAdjusted: boolean;
}

export function score10T(data: AncVisitData): QualityResult {
  const completed: string[] = [];
  const skipped: string[] = [];
  const notExpected: string[] = [];

  // T1: Timbang (always expected)
  if (data.t1WeightKg != null && data.t1WeightKg > 0) {
    completed.push('t1');
  } else {
    skipped.push('t1');
  }

  // T2: Tekanan Darah (always expected)
  if (data.t2BpSystolic != null && data.t2BpDiastolic != null) {
    completed.push('t2');
  } else {
    skipped.push('t2');
  }

  /* T3: Nilai status gizi / LILA.
     Expected at the first contact. A LILA recorded at any other visit still
     counts — doing more than the standard asks is never a deduction. */
  if (data.t3LilaCm != null && data.t3LilaCm > 0) {
    completed.push('t3');
  } else if (data.isFirstContact === true) {
    skipped.push('t3');
  } else {
    notExpected.push('t3');
  }

  // T4: Tinggi Fundus Uteri (expected from ~12 weeks)
  if (data.gestationalWeeks >= 12) {
    if (data.t4FundalHeightCm != null && data.t4FundalHeightCm > 0) {
      completed.push('t4');
    } else {
      skipped.push('t4');
    }
  } else {
    notExpected.push('t4');
    // Don't penalise: too early for fundal height
  }

  // T5: Presentasi Janin dan DJJ (expected from 36 weeks)
  if (data.gestationalWeeks >= 36) {
    if (data.t5Presentation != null && data.t5Presentation.trim().length > 0) {
      completed.push('t5');
    } else {
      skipped.push('t5');
    }
  } else {
    notExpected.push('t5');
  }

  // T6: Tetanus Toxoid (always expected)
  if (data.t6TtStatus != null && data.t6TtStatus.trim().length > 0) {
    completed.push('t6');
  } else {
    skipped.push('t6');
  }

  // T7: Tablet Fe (always expected)
  if (data.t7FeTablets != null && data.t7FeTablets > 0) {
    completed.push('t7');
  } else {
    skipped.push('t7');
  }

  // T8: Pemeriksaan Laboratorium (always expected, critical at the first contact)
  const hasLab = (data.t8LabHb != null) ||
                 (data.t8LabProtein != null && data.t8LabProtein.trim().length > 0) ||
                 (data.t8LabOther != null && Object.keys(data.t8LabOther).length > 0);
  if (hasLab) {
    completed.push('t8');
  } else {
    skipped.push('t8');
  }

  // T9: Tata Laksana Kasus (always expected)
  if (data.t9CaseManagement != null && data.t9CaseManagement.trim().length > 0) {
    completed.push('t9');
  } else {
    skipped.push('t9');
  }

  // T10: Temu Wicara / Konseling (always expected)
  if (data.t10CounsellingTopics != null && data.t10CounsellingTopics.length > 0) {
    completed.push('t10');
  } else {
    skipped.push('t10');
  }

  /* THE DENOMINATOR IS WHAT WAS APPLICABLE, not a flat ten. An early visit is
     not marked down for a measurement nobody should have taken yet, which is
     the whole reason notExpected exists. */
  const totalExpected = 10 - notExpected.length;
  const score = totalExpected > 0 ? Math.round((completed.length / totalExpected) * 10) : 10;

  const expectedButSkipped = skipped.filter(s => !notExpected.includes(s));

  return {
    score: Math.min(score, 10),
    completed,
    skipped,
    expectedButSkipped,
    notExpected,
    gestationalAgeAdjusted: notExpected.length > 0,
  };
}
