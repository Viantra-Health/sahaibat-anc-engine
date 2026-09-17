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
eq(comma('hb 10,5').t6LabHb, 10.5, 'Hb: comma decimal survives');
eq(comma('gds 145,5').bloodSugarMg, 145.5, 'blood sugar: comma decimal survives');
eq(comma('tfu 26,5').t3FundalHeightCm, 26.5, 'fundal height: accepts a decimal at all');
eq(comma('tb ibu 155,5').motherHeightCm, 155.5, 'mother height: comma decimal survives');

// Hb 7,5 must still be severe anaemia — a truncation to 7 would have passed
// this by luck, so assert the value as well as the flag.
eq(comma('hb 7,5').t6LabHb, 7.5, 'Hb 7,5 parses exactly');
ok(has(generateClinicalFlags(base({ labHb: comma('hb 7,5').t6LabHb! })), 'SEVERE_ANAEMIA'),
   'Hb 7,5 is still severe anaemia');

// Vocabulary midwives actually use.
eq(comma('tensi 140/90').t2BpSystolic, 140, 'BP: "tensi" is understood, not just "TD"');
eq(comma('tensi 140/90').t2BpDiastolic, 90, 'BP: "tensi" diastolic too');
eq(comma('timbang 60').t1WeightKg, 60, 'weight: "timbang" — the T in 10T');

// TTD (Tablet Tambah Darah) is the standard Indonesian term for iron tablets.
// `tt` had no word boundary, so "TTD 90" was read as tetanus status "d" and
// the iron count was lost entirely.
eq(comma('ttd 90').t5FeTablets, 90, 'Fe: "TTD 90" is ninety iron tablets');
eq(comma('ttd 90').t4TtStatus, null, 'Fe: "TTD 90" is NOT a tetanus status');
eq(comma('tt2, fe 90').t4TtStatus, '2', 'tetanus: real TT status still parses');
eq(comma('tt lengkap').t4TtStatus, 'lengkap', 'tetanus: worded status still parses');
eq(comma('tetanus lengkap, ttd 90').t5FeTablets, 90,
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

// ═══ report ══════════════════════════════════════════════════════════════════
console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('  all green\n');
