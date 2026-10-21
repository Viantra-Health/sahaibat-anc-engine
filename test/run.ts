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
import { parsePncData } from '../src/parseBidanInput';
import { generatePncFlags, shouldReferPnc, kfForDay } from '../src/pncFlags';
import { generateDeliveryFlags, shouldReferDelivery, linakes } from '../src/deliveryFlags';
import { generateKnFlags, shouldReferKn, knForDay } from '../src/knFlags';
import { suggestCarePlan, planToFields } from '../src/carePlan';
import {
  nextStep, counselledWithoutChoosing, dueFor, kbppWindow, kbEndReason, switchedTo,
} from '../src/contraception';
import * as contraception from '../src/contraception';
import {
  VACCINE_SCHEDULE, translateLegacy, immunisationStatus, unmatchedGiven, nextDue, immunisationSummary,
} from '../src/immunisation';

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
eq(d.t4FundalHeightCm, 26, 'TFU');
eq(d.lilaCm, 22, 'LILA');
eq(d.djjBpm, 140, 'DJJ');
eq(d.t7FeTablets, 30, 'Fe tablets');
eq(d.t8LabHb, 9.8, 'Hb — decimal preserved');
ok(!!d.complaints, 'complaints captured');
ok(d.rawInput.length > 0, 'raw input preserved verbatim for later re-parsing');

// An unparseable field must come back NULL, never 0 — a zero would read as
// "measured and normal" downstream, which is the opposite of "not recorded".
const empty = parseAncData('tidak ada apa-apa');
eq(empty.t1WeightKg, null, 'missing weight is null, not 0');
eq(empty.t2BpSystolic, null, 'missing BP is null, not 0');
eq(empty.t8LabHb, null, 'missing Hb is null, not 0');

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
  t1WeightKg: 58, t2BpSystolic: 120, t2BpDiastolic: 80, t4FundalHeightCm: 30,
  t6TtStatus: 'lengkap', t7FeTablets: 30, t8LabHb: 11.5, t8LabProtein: '-',
  t10CounsellingTopics: ['gizi'], t5Presentation: 'kepala',
  t9CaseManagement: 'normal', followupPlan: 'kontrol 2 minggu',
};
eq(score10T(full).score, 10, 'everything done at term → 10/10');

// T5 (presentation) is not expected before 36 weeks, so its absence must NOT
// be counted against her. Scoring it would push midwives to record a
// measurement that is not yet clinically meaningful.
const early = { ...full, gestationalWeeks: 28, t5Presentation: null };
eq(score10T(early).score, 10, 'presentation not expected at 28wk → still 10/10');
ok(score10T(early).notExpected.includes('t5'), 't5 (presentation) marked not-expected at 28wk');
ok(!score10T(early).expectedButSkipped.includes('t5'), 't5 (presentation) is not a gap at 28wk');

// At 38 weeks it IS expected, so omitting it is a real gap.
const lateNoPres = { ...full, t5Presentation: null };
ok(score10T(lateNoPres).score < 10, 'presentation missing at 38wk → score drops');
ok(score10T(lateNoPres).expectedButSkipped.includes('t5'), 't5 (presentation) is a gap at 38wk');

// Likewise T3 before 12 weeks.
const veryEarly = { ...full, gestationalWeeks: 8, t4FundalHeightCm: null, t5Presentation: null };
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

// ═══ Indonesian number and vocabulary handling ═══════════════════════════════
// Indonesia writes decimals with a comma. Before this, every numeric regex
// accepted only a dot, so a midwife writing her numbers the ordinary way had
// them silently truncated — and on LILA that truncation crossed a clinical
// threshold and diagnosed KEK on a mother who did not have it.

const comma = (t: string) => parseAncData(t, 28);

eq(comma('lila 23,5').lilaCm, 23.5, 'LILA: comma decimal is read, not truncated');
eq(comma('lila 23.5').lilaCm, 23.5, 'LILA: dot decimal still works');
ok(!has(generateClinicalFlags(base({ lilaCm: comma('lila 23,5').lilaCm! })), 'KEK'),
   'LILA 23,5 is NOT KEK — the bug this test exists to prevent');
ok(has(generateClinicalFlags(base({ lilaCm: comma('lila 23,4').lilaCm! })), 'KEK'),
   'LILA 23,4 IS KEK — the threshold still bites just below it');

eq(comma('bb 58,5').t1WeightKg, 58.5, 'weight: comma decimal survives');
eq(comma('hb 10,5').t8LabHb, 10.5, 'Hb: comma decimal survives');
eq(comma('gds 145,5').bloodSugarMg, 145.5, 'blood sugar: comma decimal survives');
eq(comma('tfu 26,5').t4FundalHeightCm, 26.5, 'fundal height: accepts a decimal at all');
eq(comma('tb ibu 155,5').motherHeightCm, 155.5, 'mother height: comma decimal survives');

// Hb 7,5 must still be severe anaemia — a truncation to 7 would have passed
// this by luck, so assert the value as well as the flag.
eq(comma('hb 7,5').t8LabHb, 7.5, 'Hb 7,5 parses exactly');
ok(has(generateClinicalFlags(base({ labHb: comma('hb 7,5').t8LabHb! })), 'SEVERE_ANAEMIA'),
   'Hb 7,5 is still severe anaemia');

// Vocabulary midwives actually use.
eq(comma('tensi 140/90').t2BpSystolic, 140, 'BP: "tensi" is understood, not just "TD"');
eq(comma('tensi 140/90').t2BpDiastolic, 90, 'BP: "tensi" diastolic too');
eq(comma('timbang 60').t1WeightKg, 60, 'weight: "timbang" — the T in 10T');

// TTD (Tablet Tambah Darah) is the standard Indonesian term for iron tablets.
// `tt` had no word boundary, so "TTD 90" was read as tetanus status "d" and
// the iron count was lost entirely.
eq(comma('ttd 90').t7FeTablets, 90, 'Fe: "TTD 90" is ninety iron tablets');
eq(comma('ttd 90').t6TtStatus, null, 'Fe: "TTD 90" is NOT a tetanus status');
eq(comma('tt2, fe 90').t6TtStatus, '2', 'tetanus: real TT status still parses');
eq(comma('tt lengkap').t6TtStatus, 'lengkap', 'tetanus: worded status still parses');
eq(comma('tetanus lengkap, ttd 90').t7FeTablets, 90,
   'tetanus and TTD in one message: both are read, neither eats the other');

// ═══ POSTNATAL ═══════════════════════════════════════════════════════════════
// These pin the four rules carried over from production plus the ones added
// around them. The four PRESERVED assertions must never change without a
// clinician saying so — they are what the WhatsApp path has been doing.

const pnc = (over: Partial<Parameters<typeof generatePncFlags>[0]> = {}) =>
  generatePncFlags({ daysPostpartum: 3, ...over });
const hasP = (fl: ReturnType<typeof generatePncFlags>, t: string) => fl.some((f) => f.type === t);

// ── PRESERVED from production ────────────────────────────────────────────────
ok(hasP(pnc({ bleeding: 'high' }), 'PPH'), 'PRESERVED: heavy bleeding → PPH');
ok(hasP(pnc({ bpSystolic: 145, bpDiastolic: 95 }), 'HYPERTENSION_PNC'),
   'PRESERVED: systolic 145 → HYPERTENSION_PNC');
ok(hasP(pnc({ epdsScore: 10 }), 'EPDS_POSITIVE'), 'PRESERVED: EPDS 10 → positive');
ok(hasP(pnc({ jaundiceSevere: true }), 'SEVERE_JAUNDICE'), 'PRESERVED: severe jaundice');

// ── sepsis: the rule that did not exist ─────────────────────────────────────
ok(hasP(pnc({ temperatureC: 38.0 }), 'PUERPERAL_FEVER'), 'fever 38.0 → puerperal fever');
ok(hasP(pnc({ temperatureC: 38.5, lochiaFoul: true }), 'PUERPERAL_SEPSIS'),
   'fever + foul lochia → sepsis, not just fever');
ok(!hasP(pnc({ temperatureC: 37.4 }), 'PUERPERAL_FEVER'), '37.4 is not a fever');
ok(hasP(pnc({ temperatureC: 37.6 }), 'LOW_GRADE_FEVER'), '37.6 → low grade, watch');
ok(hasP(pnc({ temperatureC: 35.0 }), 'HYPOTHERMIA'), 'hypothermia is also sepsis');
eq(shouldReferPnc(pnc({ temperatureC: 38.2 })).urgency, 'emergency', 'fever refers as emergency');

// The whole point of the decimal fix, end to end: 38,5 must not become 38.0's
// neighbour 38 by truncation — and must not become "no fever" either.
eq(parsePncData('suhu 38,5').temperatureC, 38.5, 'PNC: comma decimal on temperature');
ok(hasP(pnc({ temperatureC: parsePncData('suhu 38,5').temperatureC }), 'PUERPERAL_FEVER'),
   'suhu 38,5 raises a fever flag');

// ── the bleeding phrase that used to raise nothing ──────────────────────────
eq(parsePncData('perdarahan sangat banyak').bleeding, 'high',
   '"sangat banyak" is heavy — the phrasing that used to be silent');
ok(hasP(pnc({ bleeding: parsePncData('perdarahan sangat banyak').bleeding }), 'PPH'),
   '"perdarahan sangat banyak" → PPH');
eq(parsePncData('perdarahan tidak banyak').bleeding, 'none',
   'negation must not raise a false emergency');
ok(!hasP(pnc({ bleeding: parsePncData('perdarahan tidak banyak').bleeding }), 'PPH'),
   '"tidak banyak" does NOT raise PPH');

// ── blood pressure tiers ────────────────────────────────────────────────────
ok(hasP(pnc({ bpSystolic: 165, bpDiastolic: 100 }), 'SEVERE_HYPERTENSION_PNC'), 'systolic 165 → severe');
ok(hasP(pnc({ bpSystolic: 130, bpDiastolic: 115 }), 'SEVERE_HYPERTENSION_PNC'), 'diastolic 115 → severe');
ok(!hasP(pnc({ bpSystolic: 165 }), 'HYPERTENSION_PNC'), 'severe does not also raise the mild flag');
ok(hasP(pnc({ bpSystolic: 85 }), 'HYPOTENSION_SHOCK'), 'systolic 85 → shock');

// ── infection without a thermometer ─────────────────────────────────────────
ok(hasP(pnc({ lochiaFoul: true }), 'FOUL_LOCHIA'), 'foul lochia refers with no temperature');
eq(shouldReferPnc(pnc({ woundInfected: true })).urgency, 'urgent',
   'wound infection refers, urgent not emergency');

// ── mental health tiers ─────────────────────────────────────────────────────
ok(hasP(pnc({ epdsScore: 13 }), 'EPDS_PROBABLE_DEPRESSION'), 'EPDS 13 → probable depression');
eq(shouldReferPnc(pnc({ epdsScore: 13 })).refer, true, 'EPDS 13 refers');
eq(shouldReferPnc(pnc({ epdsScore: 10 })).refer, false, 'EPDS 10 warns but does not refer');

// ── the baby ────────────────────────────────────────────────────────────────
ok(hasP(pnc({ babyWeightKg: 1.8 }), 'VERY_LOW_BIRTH_WEIGHT'), '1.8 kg → emergency');
ok(hasP(pnc({ babyWeightKg: 2.4 }), 'LOW_BIRTH_WEIGHT'), '2.4 kg → LBW');
ok(!hasP(pnc({ babyWeightKg: 3.0 }), 'LOW_BIRTH_WEIGHT'), '3.0 kg is fine');
eq(parsePncData('bb bayi 2,4').babyWeightKg, 2.4, 'baby weight: comma decimal');
ok(hasP(pnc({ breastfeedingEstablished: false }), 'BREASTFEEDING_PROBLEM'), 'feeding problem warns');
eq(parsePncData('asi belum lancar').breastfeedingEstablished, false,
   '"belum lancar" is NOT established — negation before the positive word');

// ── quiet visit ─────────────────────────────────────────────────────────────
eq(pnc({ bpSystolic: 110, bpDiastolic: 70, temperatureC: 36.8, bleeding: 'normal',
         breastfeedingEstablished: true, babyWeightKg: 3.2, epdsScore: 3 }).length, 0,
   'a normal postnatal visit raises nothing at all');

// ── KF windows ──────────────────────────────────────────────────────────────
eq(kfForDay(1), 'KF1', 'day 1 → KF1');
eq(kfForDay(5), 'KF2', 'day 5 → KF2');
eq(kfForDay(20), 'KF3', 'day 20 → KF3');
eq(kfForDay(40), 'KF4', 'day 40 → KF4');
eq(kfForDay(50), null, 'day 50 is past the postnatal period');

// ═══ DELIVERY ════════════════════════════════════════════════════════════════
// The event the whole record exists for, and the one the product had nowhere
// to store. These pin both the clinical thresholds and the linakes derivation,
// which nothing else in the system can produce.

const del = (over: Partial<Parameters<typeof generateDeliveryFlags>[0]> = {}) =>
  generateDeliveryFlags({ babies: [{ order: 1, outcome: 'hidup' }], ...over });
const hasD = (fl: ReturnType<typeof generateDeliveryFlags>, t: string) => fl.some((f) => f.type === t);

// ── linakes: the indicator, both halves ─────────────────────────────────────
eq(linakes({ babies: [], attendant: 'bidan', place: 'puskesmas' }),
   { skilledAttendant: true, atFacility: true }, 'bidan at a puskesmas is linakes and facility');
eq(linakes({ babies: [], attendant: 'bidan', place: 'rumah' }),
   { skilledAttendant: true, atFacility: false },
   'bidan at home is skilled but NOT a facility birth — the two must not collapse');
eq(linakes({ babies: [], attendant: 'dukun', place: 'rumah' }),
   { skilledAttendant: false, atFacility: false }, 'dukun at home is neither');
eq(linakes({ babies: [], attendant: 'dokter_spesialis', place: 'rs' }),
   { skilledAttendant: true, atFacility: true }, 'specialist at a hospital');

// ── haemorrhage, with the caesarean threshold ───────────────────────────────
ok(hasD(del({ bloodLossMl: 500 }), 'PPH_DELIVERY'), '500 ml vaginal → PPH');
ok(!hasD(del({ bloodLossMl: 499 }), 'PPH_DELIVERY'), '499 ml is not PPH');
ok(!hasD(del({ bloodLossMl: 600, mode: 'sc' }), 'PPH_DELIVERY'), '600 ml after caesarean is not PPH');
ok(hasD(del({ bloodLossMl: 1000, mode: 'sc' }), 'PPH_DELIVERY'), '1000 ml after caesarean is');
eq(shouldReferDelivery(del({ bloodLossMl: 800 })).urgency, 'emergency', 'PPH refers as emergency');

// ── complications, from her words ───────────────────────────────────────────
ok(hasD(del({ complications: ['retensio plasenta'] }), 'RETAINED_PLACENTA'), 'retained placenta');
ok(hasD(del({ complications: ['kejang'] }), 'ECLAMPSIA'), 'seizure → eclampsia');
ok(hasD(del({ complications: ['partus lama'] }), 'OBSTRUCTED_LABOUR'), 'prolonged labour');
ok(hasD(del({ complications: ['robekan perineum'] }), 'SEVERE_TEAR'), 'perineal tear');

// ── the baby ────────────────────────────────────────────────────────────────
ok(hasD(del({ babies: [{ order: 1, outcome: 'hidup', criedImmediately: false }] }), 'BIRTH_ASPHYXIA'),
   'did not cry → asphyxia, the most time-critical newborn finding');
ok(!hasD(del({ babies: [{ order: 1, outcome: 'hidup', criedImmediately: true }] }), 'BIRTH_ASPHYXIA'),
   'cried → no asphyxia flag');
ok(hasD(del({ babies: [{ order: 1, outcome: 'hidup', weightGrams: 1800 }] }), 'VERY_LOW_BIRTH_WEIGHT'),
   '1800 g → emergency');
ok(hasD(del({ babies: [{ order: 1, outcome: 'hidup', weightGrams: 2400 }] }), 'LOW_BIRTH_WEIGHT'),
   '2400 g → BBLR');
ok(!hasD(del({ babies: [{ order: 1, outcome: 'hidup', weightGrams: 3200 }] }), 'LOW_BIRTH_WEIGHT'),
   '3200 g is fine');
ok(hasD(del({ babies: [{ order: 1, outcome: 'hidup', weightGrams: 4200 }] }), 'MACROSOMIA'),
   '4200 g → watch blood sugar');

// A stillbirth must not then be checked for asphyxia or vitamin K.
const still = del({ babies: [{ order: 1, outcome: 'mati', criedImmediately: false, vitaminK: false }] });
ok(hasD(still, 'STILLBIRTH'), 'stillbirth recorded');
ok(!hasD(still, 'BIRTH_ASPHYXIA'), 'a stillborn baby is not flagged for asphyxia');
ok(!hasD(still, 'NO_VITAMIN_K'), 'a stillborn baby is not flagged for missing vitamin K');

// ── twins ───────────────────────────────────────────────────────────────────
const twins = del({ babies: [
  { order: 1, outcome: 'hidup', weightGrams: 2300 },
  { order: 2, outcome: 'hidup', weightGrams: 2100 },
] });
eq(twins.filter((f) => f.type === 'LOW_BIRTH_WEIGHT').length, 2, 'both twins flagged separately');
ok(twins.some((f) => f.message_id.includes('bayi 2')), 'the message says which baby');

// ── mandated newborn care ───────────────────────────────────────────────────
ok(hasD(del({ babies: [{ order: 1, outcome: 'hidup', vitaminK: false }] }), 'NO_VITAMIN_K'), 'vitamin K1');
ok(hasD(del({ babies: [{ order: 1, outcome: 'hidup', hepatitisB0: false }] }), 'NO_HB0'), 'HB0');
ok(hasD(del({ babies: [{ order: 1, outcome: 'hidup', imd: false }] }), 'NO_IMD'), 'IMD');
// Unknown is not "not done". A midwife who has not answered yet is not failing.
ok(!hasD(del({ babies: [{ order: 1, outcome: 'hidup' }] }), 'NO_VITAMIN_K'),
   'unrecorded vitamin K is NOT flagged as missing');

// ── timing ──────────────────────────────────────────────────────────────────
ok(hasD(del({ gestationalWeeks: 35 }), 'PRETERM_BIRTH'), '35 weeks → preterm');
ok(!hasD(del({ gestationalWeeks: 38 }), 'PRETERM_BIRTH'), '38 weeks is term');
ok(hasD(del({ gestationalWeeks: 42 }), 'POST_TERM_BIRTH'), '42 weeks → post-term');

// ── place and attendant: quality signals, never clinical ────────────────────
ok(hasD(del({ attendant: 'dukun', place: 'rumah' }), 'UNSKILLED_ATTENDANT'), 'dukun noted');
eq(del({ attendant: 'dukun', place: 'rumah' }).find((f) => f.type === 'UNSKILLED_ATTENDANT')!.severity,
   'INFO', 'and noted as INFO — a transport problem, not a rebuke');
ok(hasD(del({ attendant: 'bidan', place: 'rumah' }), 'HOME_BIRTH_SKILLED'), 'skilled home birth noted');
ok(!hasD(del({ attendant: 'bidan', place: 'puskesmas' }), 'UNSKILLED_ATTENDANT'), 'facility birth is quiet');

// ── a normal birth says nothing ─────────────────────────────────────────────
eq(del({
  gestationalWeeks: 39, place: 'puskesmas', attendant: 'bidan', mode: 'spontan',
  bloodLossMl: 200, motherOutcome: 'hidup',
  babies: [{ order: 1, outcome: 'hidup', weightGrams: 3100, criedImmediately: true,
             imd: true, vitaminK: true, hepatitisB0: true }],
}).length, 0, 'an uncomplicated facility birth raises nothing at all');


// ═══ KN — the newborn visits ═════════════════════════════════════════════════
// A newborn is not a small adult. Several of these thresholds are deliberately
// stricter than their postnatal equivalents in the mother, and the day of life
// changes the meaning of the finding rather than just its urgency.

function kn(over: Partial<Parameters<typeof generateKnFlags>[0]> = {}) {
  return generateKnFlags({ dayOfLife: 5, ...over } as Parameters<typeof generateKnFlags>[0]);
}
function hasK(flags: ReturnType<typeof generateKnFlags>, type: string) {
  return flags.some((f) => f.type === type);
}

// ── the windows ─────────────────────────────────────────────────────────────
eq(knForDay(0), 'KN1', 'day 0 is KN1');
eq(knForDay(2), 'KN1', 'day 2 is still KN1 — the window is 6 to 48 hours');
eq(knForDay(3), 'KN2', 'day 3 opens KN2');
eq(knForDay(7), 'KN2', 'day 7 closes KN2');
eq(knForDay(8), 'KN3', 'day 8 opens KN3');
eq(knForDay(28), 'KN3', 'day 28 is the last day that counts as KN3');
eq(knForDay(29), null, 'day 29 is past the neonatal period');
eq(knForDay(-1), null, 'a negative day is not a visit');

// ── danger signs, MTBM ──────────────────────────────────────────────────────
ok(hasK(kn({ convulsions: true }), 'KN_CONVULSIONS'), 'convulsions');
ok(hasK(kn({ feedingWell: false }), 'KN_NOT_FEEDING'), 'not feeding');
ok(hasK(kn({ lethargic: true }), 'KN_LETHARGY'), 'moves only when stimulated');
ok(hasK(kn({ fastBreathing: true }), 'KN_BREATHING'), 'fast breathing');
ok(hasK(kn({ chestIndrawing: true }), 'KN_BREATHING'), 'chest indrawing — same flag');
ok(shouldReferKn(kn({ convulsions: true })).urgency === 'emergency', 'a danger sign is an emergency referral');
ok(!hasK(kn({ feedingWell: true }), 'KN_NOT_FEEDING'), 'feeding well is silent');
ok(!hasK(kn({}), 'KN_NOT_FEEDING'), 'unrecorded feeding is NOT a danger sign');

// ── temperature: hypothermia is an emergency in a newborn ───────────────────
ok(hasK(kn({ temperatureC: 36.4 }), 'KN_HYPOTHERMIA'), '36.4 is hypothermia');
eq(kn({ temperatureC: 36.4 }).find((f) => f.type === 'KN_HYPOTHERMIA')!.severity,
   'EMERGENCY', 'and it is an EMERGENCY — a newborn cannot rewarm herself');
ok(hasK(kn({ temperatureC: 35.9 }), 'KN_SEVERE_HYPOTHERMIA'), '35.9 is severe');
ok(!hasK(kn({ temperatureC: 35.9 }), 'KN_HYPOTHERMIA'), 'severe does not also raise the milder flag');
ok(!hasK(kn({ temperatureC: 36.5 }), 'KN_HYPOTHERMIA'), '36.5 exactly is normal');
ok(!hasK(kn({ temperatureC: 37.4 }), 'KN_FEVER'), '37.4 is normal');
ok(hasK(kn({ temperatureC: 37.5 }), 'KN_FEVER'), '37.5 is fever — lower than the 38 used for the mother');

// ── cord ────────────────────────────────────────────────────────────────────
ok(hasK(kn({ cordInfected: true }), 'KN_CORD_INFECTION'), 'cord infection refers');
ok(!hasK(kn({ cordInfected: false }), 'KN_CORD_INFECTION'), 'a clean cord is silent');

// ── jaundice: the day is the diagnosis ──────────────────────────────────────
eq(kn({ dayOfLife: 1, jaundice: true }).find((f) => f.type === 'KN_JAUNDICE_DAY1')!.severity,
   'EMERGENCY', 'jaundice on day 1 is pathological, never physiological');
ok(hasK(kn({ dayOfLife: 4, jaundice: true }), 'KN_JAUNDICE'), 'jaundice on day 4 is monitored');
eq(kn({ dayOfLife: 4, jaundice: true }).find((f) => f.type === 'KN_JAUNDICE')!.referral,
   false, 'and does not by itself refer');
ok(hasK(kn({ dayOfLife: 20, jaundice: true }), 'KN_JAUNDICE_PROLONGED'), 'past 14 days it is prolonged');
ok(hasK(kn({ dayOfLife: 20, jaundice: true, jaundicePalmsSoles: true }), 'KN_JAUNDICE_SEVERE'),
   'palms and soles outrank every other jaundice rule');
ok(!hasK(kn({ dayOfLife: 20, jaundice: true, jaundicePalmsSoles: true }), 'KN_JAUNDICE_PROLONGED'),
   'and suppresses them, so the midwife sees one instruction');

// ── weight ──────────────────────────────────────────────────────────────────
ok(!hasK(kn({ dayOfLife: 3, birthWeightGrams: 3000, weightGrams: 2750 }), 'KN_WEIGHT_LOSS'),
   'losing 8% in the first days is physiological');
ok(hasK(kn({ dayOfLife: 3, birthWeightGrams: 3000, weightGrams: 2650 }), 'KN_WEIGHT_LOSS'),
   'losing 12% is not');
ok(hasK(kn({ dayOfLife: 16, birthWeightGrams: 3000, weightGrams: 2950 }), 'KN_NOT_REGAINED'),
   'still under birth weight at day 16 is a feeding problem');
ok(!hasK(kn({ dayOfLife: 10, birthWeightGrams: 3000, weightGrams: 2950 }), 'KN_NOT_REGAINED'),
   'but not yet at day 10 — she has until two weeks');
ok(!hasK(kn({ dayOfLife: 16, birthWeightGrams: 3000, weightGrams: 3050 }), 'KN_NOT_REGAINED'),
   'and not once she is above it');
ok(hasK(kn({ weightGrams: 2400 }), 'KN_LOW_WEIGHT'), 'under 2500 g needs warmth and watching');
ok(!hasK(kn({ weightGrams: 2500 }), 'KN_LOW_WEIGHT'), '2500 g exactly is not low');
ok(!hasK(kn({ weightGrams: 2900 }), 'KN_WEIGHT_LOSS'), 'no birth weight recorded, no loss calculated');

// ── mandated care: only an explicit no counts ───────────────────────────────
ok(hasK(kn({ dayOfLife: 2, hepatitisB0: false }), 'KN_NO_HB0'), 'HB0 not given is flagged');
ok(!hasK(kn({ dayOfLife: 2, hepatitisB0: true }), 'KN_NO_HB0'), 'HB0 given is silent');
ok(!hasK(kn({ dayOfLife: 2 }), 'KN_NO_HB0'), 'HB0 unrecorded is NOT the same as not given');
ok(hasK(kn({ vitaminK: false }), 'KN_NO_VITAMIN_K'), 'vitamin K not given is a bleeding risk');
ok(!hasK(kn({ dayOfLife: 3, bcg: false }), 'KN_NO_BCG'), 'BCG is not chased on day 3');
ok(hasK(kn({ dayOfLife: 10, bcg: false }), 'KN_NO_BCG'), 'but is by day 10');
ok(!hasK(kn({ dayOfLife: 2, shk: false }), 'KN_NO_SHK'), 'SHK is not chased inside its own 48–72h window');
ok(hasK(kn({ dayOfLife: 5, shk: false }), 'KN_NO_SHK'), 'but is once that window has passed');

// ── schedule ────────────────────────────────────────────────────────────────
ok(hasK(kn({ dayOfLife: 35 }), 'KN_OUT_OF_WINDOW'), 'past 28 days the visit is noted as late');
eq(kn({ dayOfLife: 35 }).find((f) => f.type === 'KN_OUT_OF_WINDOW')!.referral,
   false, 'a late visit is still a visit — it is never a referral');

// ── a well baby says nothing ────────────────────────────────────────────────
eq(kn({
  dayOfLife: 5, weightGrams: 3050, birthWeightGrams: 3100, temperatureC: 36.8,
  feedingWell: true, cordInfected: false, jaundice: false,
  convulsions: false, fastBreathing: false, chestIndrawing: false, lethargic: false,
  hepatitisB0: true, vitaminK: true, bcg: true, polio0: true, shk: true,
}).length, 0, 'a well newborn at KN2 raises nothing at all');
eq(shouldReferKn([]), { refer: false, urgency: 'none', reasons: [] }, 'and refers nobody');


// ═══ the suggested care plan ═════════════════════════════════════════════════
// These tests pin the PROPERTIES rather than the wording: that a finding
// produces a plan at all, that referral sorts first, that nothing is invented
// without a trigger, and that a declined line never reaches the record. The
// wording itself is a clinical review question, not a test question.

function plan(flagTypes: string[], gw = 28, due: string[] = []) {
  return suggestCarePlan({
    flags: flagTypes.map((t) => ({ type: t, severity: 'WARNING', referral: false,
                                   message_id: '', message_en: '' })),
    gestationalWeeks: gw, due,
  });
}
const codes = (p: ReturnType<typeof plan>) => p.map((x) => x.code);

// ── every suggestion is traceable to a trigger ──────────────────────────────
ok(plan(['MILD_ANAEMIA']).every((p) => p.trigger.length > 0),
   'every plan item names what produced it');
ok(plan([], 28).every((p) => p.trigger === 'schedule'),
   'with no findings the only suggestion is the next visit');
ok(plan([]).length === 1, 'and there is exactly one of those, never an empty plan');

// ── a finding with several actions yields several lines ─────────────────────
ok(codes(plan(['MILD_ANAEMIA'])).includes('ma_fe'), 'anaemia suggests iron');
ok(codes(plan(['MILD_ANAEMIA'])).includes('ma_tea'), 'and the tea-with-tablets counselling');
ok(codes(plan(['MILD_ANAEMIA'])).includes('ma_recheck'), 'and a recheck date');
ok(plan(['MILD_ANAEMIA']).filter((p) => p.trigger === 'MILD_ANAEMIA').length >= 3,
   'because she accepts or declines each one separately');

// ── referral sorts to the top ───────────────────────────────────────────────
eq(plan(['PRE_ECLAMPSIA'])[0].category, 'rujukan',
   'when referral is needed it is the first line, never buried under advice');
eq(plan(['BLEEDING'])[0].code, 'bl_refer', 'bleeding refers first');
ok(codes(plan(['BLEEDING'])).includes('bl_refer'),
   'and carries the do-not-examine instruction with it');

// ── the plan always ends with a date ────────────────────────────────────────
ok(codes(plan(['KEK'])).includes('next_visit'), 'a plan always books the next contact');
ok(plan(['KEK']).find((p) => p.code === 'next_visit')!.action_id.includes('2 minggu'),
   'fortnightly at 28 weeks');
ok(plan(['KEK'], 20).find((p) => p.code === 'next_visit')!.action_id.includes('4 minggu'),
   'monthly before 28 weeks');
ok(plan(['KEK'], 38).find((p) => p.code === 'next_visit')!.action_id.includes('1 minggu'),
   'weekly from 36 weeks');
eq(plan([], 46).length, 0, 'and nothing at all past 45 weeks — the dates are wrong, not the mother');

// ── outstanding things, not just abnormal ones ──────────────────────────────
ok(codes(plan([], 28, ['hb'])).includes('due_hb'), 'a never-checked Hb reaches the plan');
ok(codes(plan([], 28, ['fe', 'p4k'])).includes('due_fe'), 'so does the iron shortfall');
ok(codes(plan([], 28, ['fe', 'p4k'])).includes('due_p4k'), 'and the incomplete birth plan');
ok(!codes(plan([], 28, ['nonsense'])).includes('undefined'),
   'an unknown due code is ignored rather than producing a blank line');

// ── deterministic ───────────────────────────────────────────────────────────
eq(codes(plan(['KEK', 'MILD_ANAEMIA'], 30, ['fe'])),
   codes(plan(['KEK', 'MILD_ANAEMIA'], 30, ['fe'])),
   'the same findings always produce the same plan in the same order');
ok(new Set(codes(plan(['KEK', 'BMI_UNDERWEIGHT']))).size === codes(plan(['KEK', 'BMI_UNDERWEIGHT'])).length,
   'and never the same line twice, however many findings raise it');

// ── what she declines is not recorded as care ───────────────────────────────
{
  const p = plan(['MILD_ANAEMIA'], 28);
  const accepted = p.filter((x) => x.code !== 'ma_fe');   // she declined the iron
  const { t9, t10 } = planToFields(accepted);
  ok(!t9.includes('tablet tambah darah'), 'a declined line is absent from the record');
  ok(t9.includes('teh'), 'while the accepted counselling is still there');
  ok(t10.includes('Kunjungan berikutnya'), 'and the schedule lands in T10, not T9');
  eq(planToFields([]).t9, '', 'accepting nothing writes nothing');
}
eq(planToFields(plan(['KEK']), 'en').t10, 'Next visit in 2 weeks', 'English is a full translation, not a fallback');

// ═══ report ══════════════════════════════════════════════════════════════════
/* ── AN UNRECORDED AGE IS NOT DAY ZERO ──────────────────────────────────────
   dayOfLife was typed `number`, so the Bidan app coerced a blank field to 0
   before sending it. A visit with no age recorded was therefore assessed as a
   birth-day visit, and day 0 decides which jaundice rule applies — end-to-end
   testing found a record reading "usia ? hari" on screen and day 0 stored.

   Null now means not recorded, every day-dependent rule is guarded, and the
   engine says the rules did not run rather than leaving the silence to read
   as reassurance. */
{
  const noAge = kn({ dayOfLife: null, jaundice: true });
  ok(!(noAge.some((f) => f.type === 'KN_JAUNDICE_DAY1')), 'a null age does not fire the day-one jaundice rule');
  ok(!(noAge.some((f) => f.type === 'KN_JAUNDICE_PROLONGED')), 'nor the prolonged one');
  ok(noAge.some((f) => f.type === 'KN_AGE_UNKNOWN'), 'and it says the age-based rules did not run');

  // The rule that needs no day must be unaffected: this is the emergency.
  const palms = kn({ dayOfLife: null, jaundice: true, jaundicePalmsSoles: true });
  ok(palms.some((f) => f.type === 'KN_JAUNDICE_SEVERE' && f.severity === 'EMERGENCY'), 'palms and soles is still an emergency with no age');

  // And a real day still behaves exactly as before.
  const dayOne = kn({ dayOfLife: 1, jaundice: true });
  ok(dayOne.some((f) => f.type === 'KN_JAUNDICE_DAY1'), 'day one jaundice is unchanged');
  ok(!(dayOne.some((f) => f.type === 'KN_AGE_UNKNOWN')), 'a known age does not claim the rules were skipped');
}

// ── FEVER IN PREGNANCY, AND THE MALARIA TEST IT TRIGGERS ────────────────────
// Thresholds approved 2026-10-12. The point of this set is that MALARIA_POSITIVE
// existed from v1 and was almost unreachable: nothing told her to run the test.
{
  const anc = (over: Record<string, unknown>) =>
    generateClinicalFlags(base(over) as any);
  const types = (fs: ReturnType<typeof generateClinicalFlags>) => fs.map((f) => f.type);

  // The ladder.
  ok(types(anc({ temperatureC: 39.2 })).includes('HIGH_FEVER_PREGNANCY'),
     '39.2 is a high fever');
  ok(anc({ temperatureC: 39.2 }).some((f) => f.type === 'HIGH_FEVER_PREGNANCY' && f.severity === 'EMERGENCY' && f.referral),
     '...and refers');
  ok(types(anc({ temperatureC: 38.2 })).includes('FEVER_PREGNANCY'),
     '38.2 is a fever');
  ok(anc({ temperatureC: 38.2 }).every((f) => f.type !== 'FEVER_PREGNANCY' || (f.severity === 'WARNING' && !f.referral)),
     '...and WARNS rather than referring, unlike the postnatal set');
  ok(types(anc({ temperatureC: 37.6 })).includes('LOW_GRADE_FEVER'),
     '37.6 is low grade');
  ok(types(anc({ temperatureC: 37.4 })).length === 0,
     '37.4 raises nothing at all');
  ok(anc({ temperatureC: 35.2 }).some((f) => f.type === 'HYPOTHERMIA' && f.severity === 'EMERGENCY' && f.referral),
     '35.2 is hypothermia, a sepsis sign, and refers');

  // Exact boundaries, because these are the numbers that were signed off.
  ok(types(anc({ temperatureC: 38.0 })).includes('FEVER_PREGNANCY'), '38.0 exactly is a fever');
  ok(types(anc({ temperatureC: 39.0 })).includes('HIGH_FEVER_PREGNANCY'), '39.0 exactly is high');
  ok(!types(anc({ temperatureC: 39.0 })).includes('FEVER_PREGNANCY'), '39.0 is not also the lower band');
  ok(types(anc({ temperatureC: 37.5 })).includes('LOW_GRADE_FEVER'), '37.5 exactly is low grade');
  ok(types(anc({ temperatureC: 35.5 })).includes('LOW_GRADE_FEVER') === false
     && !types(anc({ temperatureC: 35.5 })).includes('HYPOTHERMIA'),
     '35.5 exactly is not yet hypothermia');

  // THE RULE THAT MAKES THE TEST HAPPEN -- the whole reason for this set.
  ok(types(anc({ temperatureC: 38.4 })).includes('MALARIA_TEST_REQUIRED'),
     'a fever requires the malaria test');
  ok(types(anc({ feverLast48h: true })).includes('MALARIA_TEST_REQUIRED'),
     'a fever in the last 48 hours requires it too, with no thermometer at all');
  ok(!types(anc({ feverLast48h: false })).includes('MALARIA_TEST_REQUIRED'),
     'answering no does not require it');
  ok(!types(anc({})).includes('MALARIA_TEST_REQUIRED'),
     'not asking does not require it -- absent is not a fever');
  ok(!types(anc({ temperatureC: 38.4, malariaRdt: 'negatif' })).includes('MALARIA_TEST_REQUIRED'),
     'a negative result is an answer: stop asking');
  ok(!types(anc({ temperatureC: 38.4, malariaRdt: 'positif' })).includes('MALARIA_TEST_REQUIRED'),
     'a positive result is an answer too');
  ok(types(anc({ temperatureC: 38.4, malariaRdt: 'positif' })).includes('MALARIA_POSITIVE'),
     'and a positive result is the emergency it always was');

  // NULL IS NOT NO FEVER. A midwife with no thermometer must not be
  // silently downgraded -- the same rule the postnatal set already holds.
  ok(types(anc({ temperatureC: null })).length === 0, 'no temperature raises nothing');
  ok(types(anc({ temperatureC: null, feverLast48h: true })).includes('MALARIA_TEST_REQUIRED'),
     'but the history question still works without one');

  // Temperature is NOT one of the ten. Adding it must not move any denominator.
  const sParams = { gestationalWeeks: 28, t1WeightKg: 55, t2BpSystolic: 110, t2BpDiastolic: 70 } as any;
  const before = score10T(sParams);
  const after = score10T({ ...sParams, temperatureC: 38.5 } as any);
  eq(after.score, before.score, 'a temperature does not change the 10T score');
}


// ─────────────────────────────────────────────────────────────────────────────
// IMMUNISATION — the vocabulary is the interface, and it had three spellings.
//
// These pin the SPELLING as hard as the other blocks pin thresholds. The live
// table holds 935 rows as `DPT_HB_HIB` + dose_number; the Kasih tracker calls
// the same injection `DPT1` and numbers polio from zero. If a test here fails
// because a code changed, 935 records just stopped matching the schedule.
// ─────────────────────────────────────────────────────────────────────────────
{
  const codes = new Set(VACCINE_SCHEDULE.map((s) => s.code));
  // The eight codes that actually exist in sahai_immunization_records.
  for (const c of ['HB0', 'BCG', 'POLIO', 'DPT_HB_HIB', 'PCV', 'RV', 'IPV', 'CAMPAK_R']) {
    ok(codes.has(c as any), `schedule speaks the live vocabulary: ${c}`);
  }
  // And none of the tracker's renames leaked in.
  for (const c of ['DPT1', 'MR1', 'MR2', 'ROTA1', 'POLIO0']) {
    ok(!codes.has(c as any), `schedule does NOT use the legacy spelling ${c}`);
  }

  // Polio from ONE, and the tracker's zero maps onto it. Getting this wrong
  // attributes every polio dose to the wrong visit.
  const polio = VACCINE_SCHEDULE.filter((s) => s.code === 'POLIO').map((s) => s.dose).sort();
  eq(polio, [1, 2, 3, 4], 'oral polio is four doses numbered from one');

  // ── THE THREE TIMINGS THE CARRIED COPY GOT WRONG ───────────────────────
  // Each of these is pinned because the Kasih schedule disagreed with the
  // Ministry's published one and the disagreement was invisible.
  const at = (code: string, dose: number) =>
    VACCINE_SCHEDULE.find((s) => s.code === code && s.dose === dose)!.due_day;

  // BIRTH IS HB0 ALONE. OPV 1 is at one month, with BCG. Shipping Kasih's
  // version would have read every newborn as overdue for polio from the day
  // she was born until her one-month visit.
  eq(at('HB0', 1), 0, 'HB0 is the only dose at birth');
  eq(at('POLIO', 1), 30, 'OPV 1 is at ONE MONTH, not at birth');
  eq(at('BCG', 1), 30, 'BCG is at one month, beside OPV 1');
  ok(!VACCINE_SCHEDULE.some((s) => s.due_day === 0 && s.code !== 'HB0'),
     'nothing but HB0 is scheduled for day 0');

  // IPV 2 belongs at 9 months with MR 1, not at 10.
  eq(at('IPV', 2), 270, 'IPV 2 is at 9 months');
  eq(at('CAMPAK_R', 1), 270, 'MR 1 is at 9 months, beside IPV 2');

  // Ten months is Japanese Encephalitis, and it was missing entirely.
  eq(at('JE', 1), 300, 'JE is at 10 months');
  eq(VACCINE_SCHEDULE.find((s) => s.code === 'JE')!.conditional, 'endemic',
     'JE is marked as applying only in designated areas');

  // ── A CONDITIONAL DOSE IS NEVER OWED UNLESS ASKED FOR ──────────────────
  const je = (opts?: { endemic?: boolean }) =>
    immunisationStatus('2025-01-01', [], '2026-06-01', opts).find((d) => d.code === 'JE')!;
  eq(je().state, 'not_yet', 'JE is not overdue outside an endemic area, 17 months on');
  eq(je({ endemic: true }).state, 'overdue', 'JE IS overdue inside one');
  // And a child who received it reads done either way -- the record survives
  // the question being unanswered.
  eq(immunisationStatus('2025-01-01', [{ vaccine_code: 'JE', dose_number: 1, administered_date: '2025-11-01' }],
     '2026-06-01').find((d) => d.code === 'JE')!.state, 'done',
     'a JE dose that WAS given still reads done with no endemic flag');
  ok(!nextDue('2025-01-01', [], '2026-06-01')!.conditional,
     'nextDue never names a conditional dose outside an endemic area');
  eq(translateLegacy('POLIO0'), { code: 'POLIO', dose: 1 }, 'POLIO0 is the birth drop, which is dose 1');
  eq(translateLegacy('POLIO3'), { code: 'POLIO', dose: 4 }, 'POLIO3 is dose 4, not dose 3');
  eq(translateLegacy('MR1'), { code: 'CAMPAK_R', dose: 1 }, 'MR1 is CAMPAK_R dose 1');
  eq(translateLegacy('ROTA2'), { code: 'RV', dose: 2 }, 'ROTA2 is RV dose 2');
  eq(translateLegacy('NOT_A_VACCINE'), null, 'an unrecognised legacy code is null, not a guess');

  // The schedule is ordered, because a screen renders it in array order.
  let monotonic = true;
  for (let i = 1; i < VACCINE_SCHEDULE.length; i++) {
    if (VACCINE_SCHEDULE[i].due_day < VACCINE_SCHEDULE[i - 1].due_day) monotonic = false;
  }
  ok(monotonic, 'the schedule is sorted by due day');

  // category never takes a third value: the live column holds only these two.
  ok(VACCINE_SCHEDULE.every((s) => s.category === 'dasar' || s.category === 'lanjutan'),
     'category stays within the vocabulary the database owns');

  // ── NO DATE OF BIRTH MEANS NO VERDICT ──────────────────────────────────
  const noDob = immunisationStatus(null, []);
  ok(noDob.every((d) => d.state === 'not_yet'), 'with no dob nothing is due');
  ok(noDob.every((d) => d.state !== 'overdue'), 'with no dob NOTHING is overdue');
  ok(noDob.every((d) => d.due_date === null), 'with no dob there are no due dates');

  // ── DUE, THEN OVERDUE, WITH A POSYANDU-SHAPED GRACE PERIOD ─────────────
  const bcgOn = (today: string) =>
    immunisationStatus('2026-01-01', [], today).find((d) => d.code === 'BCG')!;
  eq(bcgOn('2026-01-15').state, 'not_yet', 'BCG is not due at two weeks');
  eq(bcgOn('2026-01-31').state, 'due', 'BCG is due at one month');
  eq(bcgOn('2026-02-14').state, 'due', 'still due 14 days after the due day');
  eq(bcgOn('2026-02-16').state, 'overdue', 'overdue once past the grace period');

  // ── DONE IS MATCHED ON CODE AND DOSE TOGETHER ──────────────────────────
  const given = [
    { vaccine_code: 'DPT_HB_HIB', dose_number: 1, administered_date: '2026-03-05' },
    { vaccine_code: 'DPT_HB_HIB', dose_number: 2, administered_date: null },
  ];
  const st = immunisationStatus('2026-01-01', given, '2027-01-01');
  eq(st.find((d) => d.code === 'DPT_HB_HIB' && d.dose === 1)!.state, 'done', 'dose 1 recorded');
  eq(st.find((d) => d.code === 'DPT_HB_HIB' && d.dose === 2)!.state, 'done', 'dose 2 recorded even with no date');
  eq(st.find((d) => d.code === 'DPT_HB_HIB' && d.dose === 3)!.state, 'overdue', 'dose 3 is still owed');
  eq(st.find((d) => d.code === 'DPT_HB_HIB' && d.dose === 1)!.given_date, '2026-03-05', 'the date given is carried');

  // ── A DOSE WE CANNOT PLACE IS SHOWN, NEVER DROPPED ─────────────────────
  const odd = [
    // Deliberately a vaccine Indonesia's routine schedule does not carry. This
    // fixture used to say 'JE', which stopped being unknown the day the
    // Ministry schedule was checked and JE was added -- the assertion caught it.
    { vaccine_code: 'TIFOID', dose_number: 1, administered_date: '2026-06-01' },
    { vaccine_code: 'BCG', dose_number: null, administered_date: '2026-02-01' },
  ];
  eq(unmatchedGiven(odd).length, 2, 'an unknown vaccine and a dose with no number both surface');
  eq(immunisationStatus('2026-01-01', odd, '2026-07-01').find((d) => d.code === 'BCG')!.state,
     'overdue', 'a BCG row with no dose number is NOT assumed to be dose 1');

  // ── WHAT IS OWED NEXT: MISSED BEFORE MERELY DUE ────────────────────────
  // Born 2026-01-01, today is 2026-03-10. BCG (day 30) is long past and not
  // given; the 2-month doses are also open. The missed one must be named.
  const nd = nextDue('2026-01-01', [], '2026-03-10')!;
  eq(nd.state, 'overdue', 'nextDue reports an overdue dose, not the nearest one');
  ok(nd.due_day <= 60, 'and it is the earliest overdue dose');
  eq(nextDue('2026-01-01', VACCINE_SCHEDULE.map((s) => ({ vaccine_code: s.code, dose_number: s.dose })), '2030-01-01'),
     null, 'a fully immunised child owes nothing');

  const sum = immunisationSummary('2026-01-01', given, '2027-01-01');
  eq(sum.done, 2, 'summary counts the two recorded doses');
  eq(sum.total, VACCINE_SCHEDULE.length, 'summary totals the whole schedule');
}


// ─────────────────────────────────────────────────────────────────────────────
// KELUARGA BERENCANA — dates and states, and the two refusals.
//
// The refusals are the point. A device with no recorded life gets NO expiry
// date, because a removal reminder on a date nobody chose is worse than none.
// And eligibility (WHO MEC / Roda KLOP) is absent entirely: it is clinical
// advice and no clinician has signed it here.
// ─────────────────────────────────────────────────────────────────────────────
{
  // ── THE FOUR STATES ARE FOUR ─────────────────────────────────────────────
  eq(nextStep({}), 'counsel', 'nothing recorded -> counsel');
  eq(nextStep({ counselled_at: '2026-10-01' }), 'select', 'counselled, nothing chosen -> select');
  eq(nextStep({ counselled_at: '2026-10-01', method_code: 'suntik_3', selected_at: '2026-10-01' }),
     'provide', 'chosen, not given -> provide');
  eq(nextStep({ method_code: 'suntik_3', selected_at: '2026-10-01', provided_at: '2026-10-01' }),
     'schedule_follow_up', 'given, nothing in the diary -> schedule follow-up');
  eq(nextStep({ counselled_at: '2026-10-01', method_code: 'pil', selected_at: '2026-10-01',
                provided_at: '2026-10-01', follow_up_due: '2026-10-29' }),
     'complete', 'all four facts -> complete');
  eq(nextStep({ provided_at: '2026-01-01', ended_at: '2026-06-01' }), 'ended', 'a closed episode is ended');

  // A dose provided with no counselling recorded does NOT send anybody back
  // for a tick -- the gap is noted, the next action is the follow-up.
  eq(nextStep({ method_code: 'implan', selected_at: '2026-10-01', provided_at: '2026-10-01' }),
     'schedule_follow_up', 'a missing counselling tick does not rewind the episode');

  // Counselled and chose nothing is a REAL outcome, not an unfinished form.
  ok(counselledWithoutChoosing({ counselled_at: '2026-09-01' }),
     'counselled without choosing is its own state');
  ok(!counselledWithoutChoosing({ counselled_at: '2026-09-01', selected_at: '2026-09-01' }),
     '...and stops being true once she chooses');

  // ── METHOD-AWARE DUE DATES ───────────────────────────────────────────────
  const d = (over: any) => dueFor({ provided_at: '2026-10-01', ...over }, '2026-10-20');
  eq(d({ method_code: 'suntik_3' }).due_date, '2026-12-30', 'three-monthly injectable: 90 days');
  eq(d({ method_code: 'suntik_3' }).kind, 'injection', '...and it is an injection');
  eq(d({ method_code: 'suntik_1' }).due_date, '2026-10-31', 'monthly injectable: 30 days');
  eq(d({ method_code: 'pil' }).due_date, '2026-10-29', 'pill cycle: 28 days');
  eq(d({ method_code: 'pil' }).kind, 'refill', '...and it is a refill, not an injection');

  // MAL is REVIEWED, not repeated. Treating it as a refill would leave a woman
  // counted as protected.
  eq(d({ method_code: 'mal' }).kind, 'review', 'lactational amenorrhoea is reviewed, not repeated');
  eq(d({ method_code: 'mal' }).due_date, '2027-03-30', '...at six months');

  // Permanent and barrier methods owe nothing.
  eq(d({ method_code: 'mow' }).kind, 'none', 'sterilisation owes nothing');
  eq(d({ method_code: 'mow' }).reason, 'method_not_recurring', '...and says why');
  eq(d({ method_code: 'kondom' }).kind, 'none', 'condoms owe nothing on a schedule');

  // ── A DEVICE WITH NO RECORDED LIFE GETS NO DATE ──────────────────────────
  const noLife = d({ method_code: 'implan' });
  eq(noLife.due_date, null, 'an implant with no recorded duration has NO expiry date');
  eq(noLife.reason, 'duration_unknown', '...and says exactly why');
  eq(noLife.state, 'unknown', '...and is not reported as not-yet-due');
  eq(d({ method_code: 'akdr' }).reason, 'duration_unknown', 'same for an IUD');

  // With a life recorded, the arithmetic follows -- in MONTHS, so a three-year
  // implant expires on the day of the month it was inserted.
  eq(d({ method_code: 'implan', device_months: 36 }).due_date, '2029-10-01', 'implant: 36 months');
  eq(d({ method_code: 'implan', device_months: 36 }).kind, 'device_expiry', '...as an expiry');
  eq(d({ method_code: 'akdr', device_months: 120 }).due_date, '2036-10-01', 'copper IUD at 120 months');
  eq(d({ method_code: 'akdr', device_months: 60 }).due_date, '2031-10-01', 'hormonal IUD at 60 months');

  // Month arithmetic must not drift off the end of a short month.
  eq(dueFor({ method_code: 'implan', provided_at: '2026-01-31', device_months: 1 }, '2026-02-10').due_date,
     '2026-02-28', '31 January plus one month is 28 February, not 3 March');

  // ── DUE, THEN OVERDUE ────────────────────────────────────────────────────
  const inj = (today: string) => dueFor({ method_code: 'suntik_3', provided_at: '2026-01-01' }, today);
  eq(inj('2026-03-01').state, 'not_yet', 'not due before 90 days');
  eq(inj('2026-04-01').state, 'due', 'due at 90 days');
  eq(inj('2026-04-14').state, 'due', 'still due inside the grace period');
  eq(inj('2026-04-20').state, 'overdue', 'overdue past it');

  // ── NO DATE, NO VERDICT ──────────────────────────────────────────────────
  eq(dueFor({ method_code: 'suntik_3' }).reason, 'no_service_date',
     'a method never provided has no due date');
  eq(dueFor({ method_code: 'suntik_3' }).state, 'unknown', '...and is not overdue');
  eq(dueFor({ method_code: 'something_new', provided_at: '2026-01-01' }).reason, 'method_unknown',
     'an unrecognised method yields no date but is not an error');
  eq(dueFor({ method_code: 'suntik_3', provided_at: '2026-01-01', ended_at: '2026-02-01' }).reason,
     'ended', 'a closed episode owes nothing');

  // ── KB PASCA PERSALINAN: 42 DAYS ─────────────────────────────────────────
  eq(kbppWindow('2026-10-01', '2026-10-10')!.state, 'open', 'KBPP window open at day 9');
  eq(kbppWindow('2026-10-01', '2026-10-10')!.closes_on, '2026-11-12', '...closing 42 days after delivery');
  eq(kbppWindow('2026-10-01', '2026-11-08')!.state, 'closing', 'closing inside the last week');
  eq(kbppWindow('2026-10-01', '2026-11-20')!.state, 'closed', 'closed past 42 days');
  eq(kbppWindow(null), null, 'no delivery date, no window');
  // 'closed', never 'missed' -- a woman who starts on day 50 has still started.
  ok(!['missed', 'failed'].includes(kbppWindow('2026-10-01', '2026-12-01')!.state),
     'a closed window is never reported as missed');

  // ── SWITCHING KEEPS BOTH EPISODES ────────────────────────────────────────
  const first  = { method_code: 'suntik_3', provided_at: '2026-01-01', ended_at: '2026-06-01', end_reason: 'ganti_cara' };
  const second = { method_code: 'implan',   provided_at: '2026-06-01', device_months: 36 };
  eq(switchedTo(first, [first, second]), second, 'an episode ended for ganti_cara finds the one that followed');
  // The reason alone is a claim; the next episode is the evidence.
  eq(switchedTo(first, [first]), null,
     'ganti_cara with nothing following is a woman who meant to switch and did not');
  eq(switchedTo({ ...first, end_reason: 'efek_samping' }, [first, second]), null,
     'stopping for side effects is not a switch');
  eq(kbEndReason('GANTI_CARA'), 'ganti_cara', 'end reasons are case-insensitive');
  eq(kbEndReason('something'), 'lainnya', 'an unknown end reason degrades to lainnya, never throws');

  // ── NO ELIGIBILITY FUNCTION. Asserted, so adding one is deliberate. ──────
  const api = Object.keys(contraception);
  ok(!api.some((k) => /mec|eligib|klop/i.test(k)),
     'the engine exposes NO eligibility verdict -- that needs a named clinical reviewer');
}

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('  all green\n');
