// @sahaibat/anc-engine · src/carePlan.ts
//
// The suggested care plan.
//
// WHAT THIS IS
// ------------
// Every other module here answers "what is wrong". This answers "and so what
// should be done about it" — the step a midwife actually performs, and the one
// the app has so far left entirely to her memory.
//
// It exists because of how Indonesian midwifery actually works. A bidan runs
// nearly the whole pregnancy herself; referral is the exception, not the
// destination. An app that only flags and refers is useless to her on the
// ninety per cent of days when the answer is "give her iron twice daily,
// counsel her about tea with meals, and recheck the haemoglobin in a month".
//
// WHAT IT IS NOT
// --------------
// It is NOT a generator. Every line below is transcribed from the Kemenkes
// standards — Buku KIA 2024 and the Buku Saku Pelayanan Kesehatan Ibu — and
// keyed to the flag that triggers it. Nothing is inferred, nothing is
// composed at runtime, and adding a suggestion means a person writing it here
// and a clinician reviewing it. That constraint is the whole point: a plan
// that is wrong in a way nobody can trace is worse than no plan.
//
// It is also NOT an instruction. The midwife signs off, edits or declines each
// line, and what she declines is not recorded as care. The plan is a draft she
// authors; the app's job is to make sure she is never re-deriving the standard
// from memory at the end of a twelve-hour day.
//
// ⚠ EVERY LINE NEEDS CLINICAL REVIEW BEFORE THIS SHIPS TO A REAL DISTRICT.
//   Reviewer, read this file as a list of standing orders, because that is how
//   it will read on a phone at 6am. Dosages are deliberately sparse: where the
//   national protocol is specific and safe for a midwife to act on alone it is
//   stated, and where it is not the line says "per protokol" and refers.

import type { ClinicalFlag } from './clinicalFlags';

export type PlanCategory =
  | 'rujukan'      // refer — first, always
  | 'tatalaksana'  // what to do now (feeds T9)
  | 'konseling'    // what to tell her (feeds T7)
  | 'jadwal';      // when to come back (feeds T10)

export interface PlanItem {
  code: string;
  /** The flag type or due code that produced this. Never inferred. */
  trigger: string;
  category: PlanCategory;
  action_id: string;
  action_en: string;
  /** Lower sorts first. */
  priority: number;
}

export interface CarePlanInput {
  flags: ClinicalFlag[];
  gestationalWeeks?: number | null;
  /**
   * Outstanding items the app already knows about — 'hb', 'tt', 'fe', 'p4k'.
   * Passed in rather than recomputed so the plan and the what's-due panel can
   * never disagree with each other on screen.
   */
  due?: string[];
}

type Rule = Omit<PlanItem, 'trigger'> & { on: string };

// ════════════════════════════════════════════════════════════════════════════
// THE RULES
// ----------------------------------------------------------------------------
// One row per (finding → action). A finding with four actions is four rows,
// because she accepts or declines them individually: giving the iron and
// declining the referral is a real and common combination.
// ════════════════════════════════════════════════════════════════════════════
const RULES: Rule[] = [
  // ── Anaemia ───────────────────────────────────────────────────────────────
  { on: 'SEVERE_ANAEMIA', code: 'sa_refer', category: 'rujukan', priority: 1,
    action_id: 'Rujuk untuk pemeriksaan dan penanganan anemia berat',
    action_en: 'Refer for assessment and management of severe anaemia' },
  { on: 'SEVERE_ANAEMIA', code: 'sa_fe', category: 'tatalaksana', priority: 2,
    action_id: 'Beri tablet tambah darah 2×1 per hari sambil menunggu rujukan',
    action_en: 'Give iron tablets twice daily while the referral is arranged' },
  { on: 'SEVERE_ANAEMIA', code: 'sa_cause', category: 'tatalaksana', priority: 3,
    action_id: 'Cari penyebab: cacingan, malaria, perdarahan, gizi kurang',
    action_en: 'Look for a cause: worms, malaria, bleeding, undernutrition' },
  { on: 'SEVERE_ANAEMIA', code: 'sa_facility', category: 'konseling', priority: 4,
    action_id: 'Rencanakan persalinan di fasilitas — risiko perdarahan meningkat',
    action_en: 'Plan a facility birth — the haemorrhage risk is raised' },

  { on: 'MILD_ANAEMIA', code: 'ma_fe', category: 'tatalaksana', priority: 2,
    action_id: 'Beri tablet tambah darah 2×1 per hari selama 90 hari',
    action_en: 'Give iron tablets twice daily for 90 days' },
  { on: 'MILD_ANAEMIA', code: 'ma_food', category: 'konseling', priority: 5,
    action_id: 'Konseling gizi: hati, daging, ikan, sayur hijau, ditambah buah kaya vitamin C',
    action_en: 'Nutrition counselling: liver, meat, fish, green vegetables, with vitamin-C rich fruit' },
  { on: 'MILD_ANAEMIA', code: 'ma_tea', category: 'konseling', priority: 6,
    action_id: 'Jangan minum tablet dengan teh atau kopi — hambat penyerapan zat besi',
    action_en: 'Do not take the tablets with tea or coffee — it blocks iron absorption' },
  { on: 'MILD_ANAEMIA', code: 'ma_recheck', category: 'jadwal', priority: 8,
    action_id: 'Periksa ulang Hb dalam 1 bulan',
    action_en: 'Recheck haemoglobin in one month' },

  // ── Undernutrition ────────────────────────────────────────────────────────
  { on: 'KEK', code: 'kek_pmt', category: 'tatalaksana', priority: 2,
    action_id: 'Beri PMT ibu hamil dan pantau kenaikan berat tiap kunjungan',
    action_en: 'Give supplementary feeding and track weight gain at every visit' },
  { on: 'KEK', code: 'kek_counsel', category: 'konseling', priority: 5,
    action_id: 'Konseling gizi: tambah 1 porsi makan per hari, utamakan protein',
    action_en: 'Nutrition counselling: one extra meal a day, protein first' },
  { on: 'KEK', code: 'kek_cause', category: 'tatalaksana', priority: 3,
    action_id: 'Periksa penyakit penyerta: TB, cacingan, penyakit kronis',
    action_en: 'Check for a co-existing illness: TB, worms, chronic disease' },
  { on: 'KEK', code: 'kek_bblr', category: 'konseling', priority: 6,
    action_id: 'Jelaskan risiko BBLR dan pentingnya persalinan di fasilitas',
    action_en: 'Explain the low-birth-weight risk and why a facility birth matters' },

  { on: 'BMI_UNDERWEIGHT', code: 'bmiu_pmt', category: 'tatalaksana', priority: 3,
    action_id: 'Konseling gizi dan pertimbangkan PMT',
    action_en: 'Nutrition counselling; consider supplementary feeding' },

  // ── Hypertensive disease ──────────────────────────────────────────────────
  { on: 'PRE_ECLAMPSIA', code: 'pe_refer', category: 'rujukan', priority: 0,
    action_id: 'RUJUK SEGERA — dampingi ibu, jangan lepaskan pemantauan di jalan',
    action_en: 'REFER NOW — go with her and keep monitoring en route' },
  { on: 'PRE_ECLAMPSIA', code: 'pe_mgso4', category: 'tatalaksana', priority: 1,
    action_id: 'Siapkan MgSO4 dosis awal sesuai protokol bila tersedia dan ada tanda berat',
    action_en: 'Prepare a loading dose of MgSO4 per protocol if available and severe features are present' },
  { on: 'PRE_ECLAMPSIA', code: 'pe_left', category: 'tatalaksana', priority: 2,
    action_id: 'Posisikan miring kiri, pantau tekanan darah dan DJJ',
    action_en: 'Position her on her left side; monitor blood pressure and fetal heart rate' },

  { on: 'HYPERTENSION', code: 'ht_refer', category: 'rujukan', priority: 1,
    action_id: 'Rujuk untuk evaluasi hipertensi dalam kehamilan',
    action_en: 'Refer for assessment of hypertension in pregnancy' },
  { on: 'HYPERTENSION', code: 'ht_recheck', category: 'jadwal', priority: 7,
    action_id: 'Kontrol tekanan darah setiap minggu',
    action_en: 'Check her blood pressure weekly' },
  { on: 'HYPERTENSION', code: 'ht_danger', category: 'konseling', priority: 5,
    action_id: 'Ajarkan tanda bahaya: sakit kepala hebat, pandangan kabur, nyeri ulu hati, bengkak mendadak',
    action_en: 'Teach the danger signs: severe headache, blurred vision, epigastric pain, sudden swelling' },
  { on: 'HYPERTENSION', code: 'ht_rest', category: 'konseling', priority: 6,
    action_id: 'Istirahat cukup, kurangi garam, hindari kerja berat',
    action_en: 'Adequate rest, less salt, avoid heavy work' },

  { on: 'PROTEINURIA_ISOLATED', code: 'prot_recheck', category: 'tatalaksana', priority: 3,
    action_id: 'Ulangi pemeriksaan protein urin dan periksa tekanan darah',
    action_en: 'Repeat the urine protein test and check her blood pressure' },

  // ── Infections ────────────────────────────────────────────────────────────
  { on: 'HIV_REACTIVE', code: 'hiv_ppia', category: 'rujukan', priority: 1,
    action_id: 'Rujuk ke layanan PPIA untuk ARV — pencegahan penularan ke bayi',
    action_en: 'Refer to the PMTCT service for antiretrovirals — preventing transmission to the baby' },
  { on: 'HIV_REACTIVE', code: 'hiv_facility', category: 'konseling', priority: 4,
    action_id: 'Rencanakan persalinan di fasilitas dan konseling pemberian makan bayi',
    action_en: 'Plan a facility birth and counsel on infant feeding' },
  { on: 'HIV_REACTIVE', code: 'hiv_partner', category: 'konseling', priority: 5,
    action_id: 'Tawarkan pemeriksaan untuk pasangan',
    action_en: 'Offer testing for her partner' },

  { on: 'SYPHILIS_REACTIVE', code: 'syph_treat', category: 'tatalaksana', priority: 1,
    action_id: 'Beri benzatin penisilin sesuai protokol — sifilis kongenital dapat dicegah',
    action_en: 'Give benzathine penicillin per protocol — congenital syphilis is preventable' },
  { on: 'SYPHILIS_REACTIVE', code: 'syph_partner', category: 'tatalaksana', priority: 3,
    action_id: 'Obati pasangan, kalau tidak ibu akan tertular kembali',
    action_en: 'Treat her partner, or she will simply be reinfected' },

  { on: 'HBSAG_REACTIVE', code: 'hbsag_hb0', category: 'tatalaksana', priority: 2,
    action_id: 'Catat rencana HB0 dan HBIg untuk bayi dalam 24 jam pertama',
    action_en: 'Record the plan for HB0 and HBIg for the baby within 24 hours' },
  { on: 'HBSAG_REACTIVE', code: 'hbsag_facility', category: 'konseling', priority: 4,
    action_id: 'Rencanakan persalinan di fasilitas agar HBIg tersedia',
    action_en: 'Plan a facility birth so HBIg is available' },

  { on: 'MALARIA_POSITIVE', code: 'mal_treat', category: 'tatalaksana', priority: 1,
    action_id: 'Obati sesuai protokol menurut trimester, rujuk bila malaria berat',
    action_en: 'Treat per protocol for the trimester; refer if severe' },
  { on: 'MALARIA_POSITIVE', code: 'mal_net', category: 'konseling', priority: 5,
    action_id: 'Pastikan ibu tidur di bawah kelambu berinsektisida',
    action_en: 'Make sure she sleeps under an insecticide-treated net' },

  // ── Fetal ─────────────────────────────────────────────────────────────────
  { on: 'MALPRESENTATION', code: 'malp_refer', category: 'rujukan', priority: 2,
    action_id: 'Rujuk untuk USG dan penilaian rencana persalinan',
    action_en: 'Refer for ultrasound and a delivery-plan assessment' },
  { on: 'MALPRESENTATION', code: 'malp_facility', category: 'konseling', priority: 4,
    action_id: 'Rencanakan persalinan di fasilitas dengan kemampuan SC',
    action_en: 'Plan a facility birth where caesarean section is available' },

  { on: 'IUGR_SUSPECT', code: 'iugr_refer', category: 'rujukan', priority: 2,
    action_id: 'Rujuk untuk USG — curiga pertumbuhan janin terhambat',
    action_en: 'Refer for ultrasound — suspected growth restriction' },
  { on: 'FUNDAL_DISCREPANCY', code: 'fd_refer', category: 'rujukan', priority: 3,
    action_id: 'Rujuk untuk USG — tinggi fundus tidak sesuai usia kehamilan',
    action_en: 'Refer for ultrasound — fundal height does not match the dates' },

  { on: 'REDUCED_FETAL_MOVEMENT', code: 'rfm_count', category: 'tatalaksana', priority: 2,
    action_id: 'Ajarkan hitung gerakan janin: berbaring miring, hitung 10 gerakan dalam 2 jam',
    action_en: 'Teach fetal movement counting: lie on her side, count 10 movements in 2 hours' },
  { on: 'REDUCED_FETAL_MOVEMENT', code: 'rfm_refer', category: 'rujukan', priority: 1,
    action_id: 'Rujuk bila gerakan tetap berkurang setelah dihitung',
    action_en: 'Refer if movements are still reduced after counting' },

  { on: 'POST_TERM', code: 'pt_refer', category: 'rujukan', priority: 1,
    action_id: 'Rujuk untuk evaluasi kehamilan lewat waktu',
    action_en: 'Refer for assessment of a post-term pregnancy' },
  { on: 'PRETERM_SIGNS', code: 'ptl_refer', category: 'rujukan', priority: 0,
    action_id: 'RUJUK SEGERA — tanda persalinan prematur',
    action_en: 'REFER NOW — signs of preterm labour' },

  { on: 'BLEEDING', code: 'bl_refer', category: 'rujukan', priority: 0,
    action_id: 'RUJUK SEGERA — jangan lakukan periksa dalam',
    action_en: 'REFER NOW — do not perform a vaginal examination' },
  { on: 'PLACENTA_PREVIA', code: 'pp_novt', category: 'tatalaksana', priority: 1,
    action_id: 'Jangan lakukan periksa dalam. Rencanakan persalinan di RS dengan kemampuan SC',
    action_en: 'Do not perform a vaginal examination. Plan delivery in a hospital with caesarean capability' },

  // ── Birth planning ────────────────────────────────────────────────────────
  { on: 'NO_BIRTH_PLAN', code: 'p4k_place', category: 'tatalaksana', priority: 4,
    action_id: 'Lengkapi P4K: tentukan tempat bersalin dan tempel stiker di rumah',
    action_en: 'Complete the birth plan: agree the place of birth and put the sticker on her house' },
  { on: 'NO_TRANSPORT_PLAN', code: 'p4k_transport', category: 'tatalaksana', priority: 4,
    action_id: 'Tentukan transportasi dan nomor yang bisa dihubungi — daftarkan ambulans desa bila ada',
    action_en: 'Agree transport and a number to call — register the village ambulance if there is one' },
  { on: 'NO_FUNDING_PLAN', code: 'p4k_funding', category: 'tatalaksana', priority: 4,
    action_id: 'Pastikan BPJS aktif atau daftarkan Jampersal',
    action_en: 'Check her BPJS is active, or enrol her in Jampersal' },
  { on: 'HOME_DELIVERY_HIGH_RISK', code: 'hdhr', category: 'konseling', priority: 3,
    action_id: 'Konseling persalinan di fasilitas — jelaskan risikonya, jangan menyalahkan',
    action_en: 'Counsel a facility birth — explain the risk without blaming her' },

  // ── Age and metabolic ─────────────────────────────────────────────────────
  { on: 'ADOLESCENT_PREGNANCY', code: 'adol_care', category: 'konseling', priority: 5,
    action_id: 'Pantau lebih ketat: risiko anemia, KEK, preeklampsia dan BBLR lebih tinggi',
    action_en: 'Watch her more closely: anaemia, undernutrition, pre-eclampsia and low birth weight are all likelier' },
  { on: 'VERY_YOUNG_PREGNANCY', code: 'vyoung_support', category: 'konseling', priority: 3,
    action_id: 'Dukungan psikososial dan libatkan keluarga; rencanakan persalinan di fasilitas',
    action_en: 'Psychosocial support, involve the family, and plan a facility birth' },
  { on: 'ADVANCED_MATERNAL_AGE', code: 'ama_screen', category: 'tatalaksana', priority: 5,
    action_id: 'Skrining tekanan darah dan gula darah setiap kunjungan',
    action_en: 'Screen blood pressure and blood sugar at every visit' },

  { on: 'GDM_HIGH', code: 'gdm_refer', category: 'rujukan', priority: 2,
    action_id: 'Rujuk untuk pemeriksaan gula darah lanjutan dan penanganan',
    action_en: 'Refer for further blood sugar testing and management' },
  { on: 'GDM_HIGH', code: 'gdm_diet', category: 'konseling', priority: 5,
    action_id: 'Konseling diet: kurangi gula dan nasi putih, makan porsi kecil lebih sering',
    action_en: 'Diet counselling: less sugar and white rice, smaller portions more often' },
  { on: 'GDM_WARNING', code: 'gdmw_diet', category: 'konseling', priority: 6,
    action_id: 'Konseling diet dan ulangi pemeriksaan gula darah',
    action_en: 'Diet counselling, and repeat the blood sugar test' },
  { on: 'BMI_OBESE', code: 'obese_screen', category: 'tatalaksana', priority: 6,
    action_id: 'Skrining gula darah dan tekanan darah; target kenaikan berat lebih rendah',
    action_en: 'Screen blood sugar and blood pressure; aim for a lower weight gain' },
];

// ── Things outstanding, rather than things wrong ────────────────────────────
// These come from the due list, not the flags: nothing is abnormal, something
// simply has not been done yet.
const DUE_RULES: Record<string, Omit<PlanItem, 'trigger'>> = {
  hb: { code: 'due_hb', category: 'tatalaksana', priority: 3,
    action_id: 'Periksa Hb hari ini — belum pernah diperiksa selama kehamilan ini',
    action_en: 'Check haemoglobin today — it has never been done this pregnancy' },
  hb_low: { code: 'due_hb_low', category: 'tatalaksana', priority: 3,
    action_id: 'Periksa ulang Hb — hasil terakhir di bawah 11',
    action_en: 'Recheck haemoglobin — the last result was below 11' },
  tt: { code: 'due_tt', category: 'tatalaksana', priority: 5,
    action_id: 'Tanyakan dan catat status imunisasi TT; lengkapi bila perlu',
    action_en: 'Ask and record her TT immunisation status; complete it if needed' },
  fe: { code: 'due_fe', category: 'tatalaksana', priority: 4,
    action_id: 'Beri tablet tambah darah — total minimal 90 tablet selama kehamilan',
    action_en: 'Dispense iron tablets — at least 90 across the pregnancy' },
  p4k: { code: 'due_p4k', category: 'tatalaksana', priority: 4,
    action_id: 'Lengkapi P4K bersama ibu dan keluarga',
    action_en: 'Complete the birth plan with her and her family' },
};

/**
 * The next scheduled contact, so the plan always ends with a date.
 *
 * A plan with no return date is the commonest way a woman is lost between
 * contacts: everything was explained, nothing was booked.
 */
function nextContact(gw: number): Omit<PlanItem, 'trigger'> | null {
  if (gw <= 0 || gw > 45) return null;
  // Contacts get closer together as term approaches, which is the schedule
  // rather than an invention: monthly, then fortnightly, then weekly.
  const weeks = gw < 28 ? 4 : gw < 36 ? 2 : 1;
  return {
    code: 'next_visit', category: 'jadwal', priority: 9,
    action_id: `Kunjungan berikutnya dalam ${weeks} minggu`,
    action_en: `Next visit in ${weeks} week${weeks > 1 ? 's' : ''}`,
  };
}

/**
 * Build the suggested plan.
 *
 * Deterministic and order-stable: the same findings always produce the same
 * plan in the same order, because a midwife who sees the list reshuffle
 * between visits stops trusting it.
 */
export function suggestCarePlan(input: CarePlanInput): PlanItem[] {
  const out: PlanItem[] = [];
  const seen = new Set<string>();

  const push = (item: Omit<PlanItem, 'trigger'>, trigger: string) => {
    if (seen.has(item.code)) return;      // one finding can be raised twice
    seen.add(item.code);
    out.push({ ...item, trigger });
  };

  const types = new Set(input.flags.map((f) => f.type));
  for (const r of RULES) {
    if (types.has(r.on)) {
      const { on, ...item } = r;
      push(item, on);
    }
  }

  for (const d of input.due ?? []) {
    const r = DUE_RULES[d];
    if (r) push(r, d);
  }

  const gw = input.gestationalWeeks ?? 0;
  const next = nextContact(gw);
  if (next) push(next, 'schedule');

  return out.sort((a, b) =>
    a.priority - b.priority || a.code.localeCompare(b.code));
}

/**
 * The accepted lines, as the two free-text fields the record already has.
 *
 * T9 takes what was done, T10 takes what happens next, and counselling folds
 * into T9 because that is where a midwife writes it on paper. Declined lines
 * are absent from both — the app must never record as care something she
 * explicitly refused.
 */
export function planToFields(
  accepted: PlanItem[],
  lang: 'id' | 'en' = 'id',
): { t9: string; t10: string } {
  const text = (p: PlanItem) => (lang === 'en' ? p.action_en : p.action_id);
  const t9 = accepted
    .filter((p) => p.category === 'tatalaksana' || p.category === 'konseling' || p.category === 'rujukan')
    .map(text);
  const t10 = accepted.filter((p) => p.category === 'jadwal').map(text);
  return { t9: t9.join('; '), t10: t10.join('; ') };
}
