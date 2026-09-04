// @sahaibat/anc-engine · test/run.ts
//   npx tsx test/run.ts
//
// These tests exist to PIN CLINICAL THRESHOLDS. Every number asserted below is
// a decision a clinician signed off on — Hb < 8 is severe anaemia, LILA < 23.5
// is KEK, DJJ outside 120–160 is abnormal. If one of these fails, either the
// extraction broke something or someone changed a threshold, and both need a
// human to look rather than a green tick.
//
// No framework: this package has zero dependencies and should keep them.

import { parseAncInit, parseAncData, parsePncInit, calculateBMI } from '../src/parseBidanInput';
import { score10T } from '../src/score10T';
import { generateClinicalFlags, shouldRefer } from '../src/clinicalFlags';

let pass = 0;
const failures: string[] = [];

function eq(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass++;
  else failures.push(`${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`);
}
function ok(cond: boolean, label: string) {
  if (cond) pass++; else failures.push(label);
}

/** Does the flag set contain this type? */
function has(flags: ReturnType<typeof generateClinicalFlags>, type: string) {
  return flags.some((f) => f.type === type);
}
function base(over: Partial<Parameters<typeof generateClinicalFlags>[0]> = {}) {
  return { gestationalWeeks: 28, ...over } as Parameters<typeof generateClinicalFlags>[0];
}

// ═══ parseAncInit ════════════════════════════════════════════════════════════
eq(parseAncInit('ANC3, Siti Aminah, 28mgg'),
   { visitType: 'K3', motherName: 'Siti Aminah', gestationalWeeks: 28 },
   'parses the documented command form');
eq(parseAncInit('anc1 Budi 12 minggu')?.visitType, 'K1', 'lowercase + "minggu"');
eq(parseAncInit('ANC K2, Rina, 20mgg')?.visitType, 'K2', 'accepts the "ANC K2" spelling');
eq(parseAncInit('ANC7, X, 20mgg'), null, 'K7 does not exist — rejected');
eq(parseAncInit('ANC0, X, 20mgg'), null, 'K0 does not exist — rejected');
eq(parseAncInit('halo bu'), null, 'ordinary chat is not a command');
eq(parseAncInit('ANC3, Siti, 28mgg')?.gestationalWeeks, 28, 'gestational weeks extracted');

// ═══ parseAncData ════════════════════════════════════════════════════════════
const d = parseAncData(
  'BB 58, TB 155, TD 150/95, TFU 26, LILA 22, DJJ 140, Gol Darah B, TT lengkap, ' +
  'Fe 30, Lab Hb 9.8 protein ++, Konseling tanda bahaya, Keluhan pusing'
);
eq(d.t1WeightKg, 58, 'BB');
eq(d.motherHeightCm, 155, 'TB');
eq(d.t2BpSystolic, 150, 'TD systolic');
eq(d.t2BpDiastolic, 95, 'TD diastolic');
eq(d.t3FundalHeightCm, 26, 'TFU');
eq(d.lilaCm, 22, 'LILA');
eq(d.djjBpm, 140, 'DJJ');
eq(d.t5FeTablets, 30, 'Fe tablets');
eq(d.t6LabHb, 9.8, 'Hb — decimal preserved');
ok(!!d.complaints, 'complaints captured');
ok(d.rawInput.length > 0, 'raw input preserved verbatim for later re-parsing');

// An unparseable field must come back NULL, never 0 — a zero would read as
// "measured and normal" downstream, which is the opposite of "not recorded".
const empty = parseAncData('tidak ada apa-apa');
eq(empty.t1WeightKg, null, 'missing weight is null, not 0');
eq(empty.t2BpSystolic, null, 'missing BP is null, not 0');
eq(empty.t6LabHb, null, 'missing Hb is null, not 0');

// ═══ parsePncInit ════════════════════════════════════════════════════════════
eq(parsePncInit('KF2, Siti Aminah, hari ke-7')?.visitType, 'KF2', 'PNC visit type');
eq(parsePncInit('KF2, Siti Aminah, hari ke-7')?.daysPostpartum, 7, 'days postpartum');

// ═══ calculateBMI ════════════════════════════════════════════════════════════
eq(calculateBMI(58, 155).bmi, 24.1, 'BMI computed to 1dp');
eq(calculateBMI(58, 155).category, 'normal', 'BMI category');
eq(calculateBMI(40, 165).category, 'underweight', 'underweight');
eq(calculateBMI(null, 155).bmi, null, 'missing weight → null, not a guess');

// ═══ score10T — the gestational-age adjustment is the subtle part ════════════
const full = {
  gestationalWeeks: 38,
  t1WeightKg: 58, t2BpSystolic: 120, t2BpDiastolic: 80, t3FundalHeightCm: 30,
  t4TtStatus: 'lengkap', t5FeTablets: 30, t6LabHb: 11.5, t6LabProtein: '-',
  t7CounsellingTopics: ['gizi'], t8Presentation: 'kepala',
  t9CaseManagement: 'normal', t10FollowupPlan: 'kontrol 2 minggu',
};
eq(score10T(full).score, 10, 'everything done at term → 10/10');

// T8 (presentation) is not expected before 36 weeks, so its absence must NOT
// be counted against her. Scoring it would push midwives to record a
// measurement that is not yet clinically meaningful.
const early = { ...full, gestationalWeeks: 28, t8Presentation: null };
eq(score10T(early).score, 10, 'presentation not expected at 28wk → still 10/10');
ok(score10T(early).notExpected.includes('t8'), 't8 marked not-expected at 28wk');
ok(!score10T(early).expectedButSkipped.includes('t8'), 't8 is not a gap at 28wk');

// At 38 weeks it IS expected, so omitting it is a real gap.
const lateNoPres = { ...full, t8Presentation: null };
ok(score10T(lateNoPres).score < 10, 'presentation missing at 38wk → score drops');
ok(score10T(lateNoPres).expectedButSkipped.includes('t8'), 't8 is a gap at 38wk');

// Likewise T3 before 12 weeks.
const veryEarly = { ...full, gestationalWeeks: 8, t3FundalHeightCm: null, t8Presentation: null };
ok(score10T(veryEarly).notExpected.includes('t3'), 'fundal height not expected at 8wk');

eq(score10T({ gestationalWeeks: 28 }).score, 0, 'nothing recorded → 0');

// ═══ clinicalFlags — thresholds ══════════════════════════════════════════════

// Pre-eclampsia needs high BP AND (proteinuria OR symptoms). High BP alone is
// hypertension, which is a warning, not an emergency referral.
ok(has(generateClinicalFlags(base({ bpSystolic: 150, bpDiastolic: 95, labProtein: '++' })), 'PRE_ECLAMPSIA'),
   'BP 150/95 + proteinuria → PRE_ECLAMPSIA');
ok(has(generateClinicalFlags(base({ bpSystolic: 150, bpDiastolic: 95, complaints: 'sakit kepala' })), 'PRE_ECLAMPSIA'),
   'BP high + headache → PRE_ECLAMPSIA');
ok(has(generateClinicalFlags(base({ bpSystolic: 150, bpDiastolic: 95 })), 'HYPERTENSION'),
   'BP high alone → HYPERTENSION only');
ok(!has(generateClinicalFlags(base({ bpSystolic: 150, bpDiastolic: 95 })), 'PRE_ECLAMPSIA'),
   'BP high alone is NOT pre-eclampsia');
ok(has(generateClinicalFlags(base({ bpSystolic: 140, bpDiastolic: 85, labProtein: '+' })), 'PRE_ECLAMPSIA'),
   'systolic 140 is the boundary and counts');
ok(!has(generateClinicalFlags(base({ bpSystolic: 139, bpDiastolic: 89, labProtein: '+' })), 'PRE_ECLAMPSIA'),
   '139/89 is below the threshold');
ok(!has(generateClinicalFlags(base({ bpSystolic: 150, bpDiastolic: 95, labProtein: '-' })), 'PRE_ECLAMPSIA'),
   "protein '-' is not proteinuria");

// Anaemia: < 8.0 severe, < 11.0 mild
ok(has(generateClinicalFlags(base({ labHb: 7.9 })), 'SEVERE_ANAEMIA'), 'Hb 7.9 → severe');
ok(has(generateClinicalFlags(base({ labHb: 8.0 })), 'MILD_ANAEMIA'), 'Hb 8.0 → mild, not severe');
ok(has(generateClinicalFlags(base({ labHb: 10.9 })), 'MILD_ANAEMIA'), 'Hb 10.9 → mild');
ok(!has(generateClinicalFlags(base({ labHb: 11.0 })), 'MILD_ANAEMIA'), 'Hb 11.0 → not anaemic');

// KEK: LILA < 23.5
ok(has(generateClinicalFlags(base({ lilaCm: 23.4 })), 'KEK'), 'LILA 23.4 → KEK');
ok(!has(generateClinicalFlags(base({ lilaCm: 23.5 })), 'KEK'), 'LILA 23.5 → not KEK');

// DJJ: normal 120–160; <100 or >180 emergency
eq(generateClinicalFlags(base({ djjBpm: 140 })).filter(f => f.type.startsWith('DJJ')).length, 0,
   'DJJ 140 is normal — no flag');
eq(generateClinicalFlags(base({ djjBpm: 120 })).filter(f => f.type.startsWith('DJJ')).length, 0,
   'DJJ 120 is the lower bound and is normal');
eq(generateClinicalFlags(base({ djjBpm: 160 })).filter(f => f.type.startsWith('DJJ')).length, 0,
   'DJJ 160 is the upper bound and is normal');
ok(has(generateClinicalFlags(base({ djjBpm: 99 })), 'DJJ_SEVERE_BRADYCARDIA'), 'DJJ 99 → severe bradycardia');
ok(has(generateClinicalFlags(base({ djjBpm: 110 })), 'DJJ_BRADYCARDIA'), 'DJJ 110 → bradycardia');
ok(has(generateClinicalFlags(base({ djjBpm: 170 })), 'DJJ_TACHYCARDIA'), 'DJJ 170 → tachycardia');
ok(has(generateClinicalFlags(base({ djjBpm: 190 })), 'DJJ_SEVERE_TACHYCARDIA'), 'DJJ 190 → severe tachycardia');

// Maternal age
ok(has(generateClinicalFlags(base({ motherAge: 15 })), 'VERY_YOUNG_PREGNANCY'), 'age 15 → emergency');
ok(has(generateClinicalFlags(base({ motherAge: 17 })), 'ADOLESCENT_PREGNANCY'), 'age 17 → warning');
ok(has(generateClinicalFlags(base({ motherAge: 35 })), 'ADVANCED_MATERNAL_AGE'), 'age 35 → warning');
eq(generateClinicalFlags(base({ motherAge: 25 })).filter(f => f.type.includes('PREGNANCY') || f.type.includes('MATERNAL_AGE')).length, 0,
   'age 25 → no age flag');

// Post-term
ok(has(generateClinicalFlags(base({ gestationalWeeks: 42 })), 'POST_TERM'), '42wk → post-term');
ok(!has(generateClinicalFlags(base({ gestationalWeeks: 41 })), 'POST_TERM'), '41wk → not yet');

// Malpresentation only counts from 36 weeks
ok(has(generateClinicalFlags(base({ gestationalWeeks: 36, presentation: 'sungsang' })), 'MALPRESENTATION'),
   'breech at 36wk → flag');
ok(!has(generateClinicalFlags(base({ gestationalWeeks: 30, presentation: 'sungsang' })), 'MALPRESENTATION'),
   'breech at 30wk → no flag, still has time to turn');

// Lab screening. "non-reaktif" must never trip the reactive flag.
ok(has(generateClinicalFlags(base({ hivStatus: 'reaktif' })), 'HIV_REACTIVE'), 'HIV reaktif');
ok(!has(generateClinicalFlags(base({ hivStatus: 'non-reaktif' })), 'HIV_REACTIVE'), 'HIV non-reaktif is NOT reactive');
ok(!has(generateClinicalFlags(base({ syphilisStatus: 'non reaktif' })), 'SYPHILIS_REACTIVE'), 'syphilis non-reaktif');
ok(has(generateClinicalFlags(base({ hbsagStatus: 'reaktif' })), 'HBSAG_REACTIVE'), 'HBsAg reaktif');

// GDM
ok(has(generateClinicalFlags(base({ bloodSugarMg: 200 })), 'GDM_HIGH'), 'glucose 200 → emergency');
ok(has(generateClinicalFlags(base({ bloodSugarMg: 140 })), 'GDM_WARNING'), 'glucose 140 → warning');
ok(!has(generateClinicalFlags(base({ bloodSugarMg: 139 })), 'GDM_WARNING'), 'glucose 139 → no flag');

// Bleeding, from free-text complaints
ok(has(generateClinicalFlags(base({ complaints: 'ada perdarahan sedikit' })), 'BLEEDING'), 'bleeding detected in complaints');

// ═══ shouldRefer ═════════════════════════════════════════════════════════════
eq(shouldRefer(generateClinicalFlags(base({}))).urgency, 'none', 'no flags → no referral');
eq(shouldRefer(generateClinicalFlags(base({ labHb: 7 }))).urgency, 'emergency', 'severe anaemia → emergency');
eq(shouldRefer(generateClinicalFlags(base({ labHb: 10 }))).urgency, 'none',
   'mild anaemia does not refer — referral:false on that flag');
eq(shouldRefer(generateClinicalFlags(base({ gestationalWeeks: 36, presentation: 'sungsang' }))).urgency, 'urgent',
   'malpresentation refers, but is urgent not emergency');
ok(shouldRefer(generateClinicalFlags(base({ labHb: 7 }))).reasons.length > 0, 'referral carries its reasons');

// ═══ report ══════════════════════════════════════════════════════════════════
console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('  all green\n');
