// lib/triage/score10T.ts
// Pure function: scores ANC visit quality against Indonesia's 10T standard
// No side effects, no database calls, no API calls

export interface AncVisitData {
  gestationalWeeks: number;
  t1WeightKg?: number | null;
  t2BpSystolic?: number | null;
  t2BpDiastolic?: number | null;
  t3FundalHeightCm?: number | null;
  t4TtStatus?: string | null;
  t5FeTablets?: number | null;
  t6LabHb?: number | null;
  t6LabProtein?: string | null;
  t6LabOther?: Record<string, any> | null;
  t7CounsellingTopics?: string[] | null;
  t8Presentation?: string | null;
  t9CaseManagement?: string | null;
  t10FollowupPlan?: string | null;
}

export interface QualityResult {
  score: number;                    // 0-10
  completed: string[];              // e.g., ['t1','t2','t3']
  skipped: string[];                // e.g., ['t10']
  expectedButSkipped: string[];     // items that SHOULD have been done at this gestational age
  notExpected: string[];            // items not expected at this gestational age (e.g., T8 before 36w)
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

  // T3: Tinggi Fundus Uteri (expected from ~12 weeks)
  if (data.gestationalWeeks >= 12) {
    if (data.t3FundalHeightCm != null && data.t3FundalHeightCm > 0) {
      completed.push('t3');
    } else {
      skipped.push('t3');
    }
  } else {
    notExpected.push('t3');
    // Don't penalise: too early for fundal height
  }

  // T4: Tetanus Toxoid (always expected)
  if (data.t4TtStatus != null && data.t4TtStatus.trim().length > 0) {
    completed.push('t4');
  } else {
    skipped.push('t4');
  }

  // T5: Tablet Fe (always expected)
  if (data.t5FeTablets != null && data.t5FeTablets > 0) {
    completed.push('t5');
  } else {
    skipped.push('t5');
  }

  // T6: Tes Laboratorium (always expected, critical at K1)
  const hasLab = (data.t6LabHb != null) ||
                 (data.t6LabProtein != null && data.t6LabProtein.trim().length > 0) ||
                 (data.t6LabOther != null && Object.keys(data.t6LabOther).length > 0);
  if (hasLab) {
    completed.push('t6');
  } else {
    skipped.push('t6');
  }

  // T7: Temu Wicara / Counselling (always expected)
  if (data.t7CounsellingTopics != null && data.t7CounsellingTopics.length > 0) {
    completed.push('t7');
  } else {
    skipped.push('t7');
  }

  // T8: Presentasi Janin (expected from 36 weeks)
  if (data.gestationalWeeks >= 36) {
    if (data.t8Presentation != null && data.t8Presentation.trim().length > 0) {
      completed.push('t8');
    } else {
      skipped.push('t8');
    }
  } else {
    notExpected.push('t8');
  }

  // T9: Tata Laksana Kasus (always expected)
  if (data.t9CaseManagement != null && data.t9CaseManagement.trim().length > 0) {
    completed.push('t9');
  } else {
    skipped.push('t9');
  }

  // T10: Tindak Lanjut (always expected)
  if (data.t10FollowupPlan != null && data.t10FollowupPlan.trim().length > 0) {
    completed.push('t10');
  } else {
    skipped.push('t10');
  }

  // Calculate score: completed items out of EXPECTED items
  const totalExpected = 10 - notExpected.length;
  const score = totalExpected > 0 ? Math.round((completed.length / totalExpected) * 10) : 10;

  // expectedButSkipped: items that should have been done and weren't
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
