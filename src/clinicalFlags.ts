// lib/triage/clinicalFlags.ts
// v2: Added KEK (LILA < 23.5), DJJ abnormal, BMI category flags
// Clinical flag generation for Bidan ANC documentation

export interface ClinicalFlag {
  type: string;
  severity: 'EMERGENCY' | 'WARNING' | 'INFO';
  referral: boolean;
  message_id: string;   // Bahasa Indonesia
  message_en: string;   // English
}

export interface AncClinicalInput {
  gestationalWeeks: number;
  motherAge?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  labHb?: number | null;
  labProtein?: string | null;
  fundalHeightCm?: number | null;
  presentation?: string | null;
  complaints?: string | null;
  weightKg?: number | null;
  // v2: new fields
  lilaCm?: number | null;
  djjBpm?: number | null;
  bmi?: number | null;
  bmiCategory?: string | null;
  hivStatus?: string | null;
  syphilisStatus?: string | null;
   hbsagStatus?: string | null;
   bloodSugarMg?: number | null;
   malariaRdt?: string | null;
  /**
   * Maternal temperature in degrees Celsius, or null when not taken.
   *
   * NULL IS NOT "NO FEVER". Many midwives have no thermometer, and a silent
   * downgrade for want of equipment is the failure the postnatal set already
   * guards against. Which is why feverLast48h exists beside it.
   */
  temperatureC?: number | null;
  /**
   * Did she have a fever in the last 48 hours? null when not asked.
   *
   * This is in the Kemenkes malaria rule verbatim -- "fever, OR a history of
   * fever within the last 48 hours" -- and it is the clinically important
   * case: a woman afebrile at ten in the morning who had rigors at three.
   * It also needs no thermometer, which in a village is the difference
   * between a rule that fires and one that cannot.
   */
  feverLast48h?: boolean | null;
   // Phase B
  usgResults?: { plasenta: string | null; ketuban: string | null; kelainanJanin: string | null; tbjGram: number | null; catatan: string | null } | null;
   // Phase C
   birthPlan?: { fasilitas: string | null; transportasi: string | null; donorDarah: string | null; pendanaan: string | null; pendamping: string | null; catatan: string | null } | null;
   // trend data (optional, for future use)
  previousBpReadings?: { systolic: number; diastolic: number }[];
  previousHbReadings?: number[];
  previousWeights?: number[];
}

export function generateClinicalFlags(data: AncClinicalInput): ClinicalFlag[] {
  const flags: ClinicalFlag[] = [];
  const cl = (data.complaints || '').toLowerCase();

  // ═══ EMERGENCY FLAGS ═══

  // Pre-eclampsia
  const highBP = (data.bpSystolic ?? 0) >= 140 || (data.bpDiastolic ?? 0) >= 90;
  const proteinuria = data.labProtein != null && data.labProtein !== '-' && data.labProtein.includes('+');
  const peSymptoms = ['sakit kepala','headache','pandangan kabur','blurred','oedema','bengkak','kejang','seizure']
    .some(s => cl.includes(s));

  if (highBP && (proteinuria || peSymptoms)) {
    flags.push({ type: 'PRE_ECLAMPSIA', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 RISIKO PRE-EKLAMPSIA — TD tinggi + proteinuria/gejala. RUJUK ke PONED/PONEK hari ini.',
      message_en: '🔴 PRE-ECLAMPSIA RISK — High BP + proteinuria/symptoms. REFER to PONED/PONEK today.' });
  } else if (highBP) {
    flags.push({ type: 'HYPERTENSION', severity: 'WARNING', referral: false,
      message_id: '🟡 HIPERTENSI — TD meningkat. Pantau ketat, periksa protein urine.',
      message_en: '🟡 HYPERTENSION — Elevated BP. Monitor closely, check protein urine.' });
  }

  // Severe anaemia
  if (data.labHb != null && data.labHb < 8.0) {
    flags.push({ type: 'SEVERE_ANAEMIA', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 ANEMIA BERAT (Hb < 8) — RUJUK segera.',
      message_en: '🔴 SEVERE ANAEMIA (Hb < 8) — REFER immediately.' });
  } else if (data.labHb != null && data.labHb < 11.0) {
    flags.push({ type: 'MILD_ANAEMIA', severity: 'WARNING', referral: false,
      message_id: `🟡 ANEMIA (Hb ${data.labHb}) — Pastikan kepatuhan Fe.`,
      message_en: `🟡 ANAEMIA (Hb ${data.labHb}) — Confirm Fe adherence.` });
  }

  // Bleeding
  if (['perdarahan','bleeding','flek','darah'].some(s => cl.includes(s))) {
    flags.push({ type: 'BLEEDING', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 PERDARAHAN — RUJUK SEGERA.',
      message_en: '🔴 BLEEDING — REFER IMMEDIATELY.' });
  }

  // Post-term
  if (data.gestationalWeeks >= 42) {
    flags.push({ type: 'POST_TERM', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 POST-TERM (>=42 minggu) — RUJUK untuk induksi.',
      message_en: '🔴 POST-TERM (>=42 weeks) — REFER for induction.' });
  }

   // ═══ MATERNAL AGE FLAGS ═══
  if (data.motherAge != null) {
    if (data.motherAge < 16) {
      flags.push({ type: 'VERY_YOUNG_PREGNANCY', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 KEHAMILAN USIA SANGAT MUDA (${data.motherAge} tahun) — RUJUK untuk penanganan khusus. Risiko tinggi komplikasi.`,
        message_en: `🔴 VERY YOUNG PREGNANCY (${data.motherAge} years) — REFER for specialized care. High complication risk.` });
    } else if (data.motherAge < 18) {
      flags.push({ type: 'ADOLESCENT_PREGNANCY', severity: 'WARNING', referral: false,
        message_id: `🟡 KEHAMILAN REMAJA (${data.motherAge} tahun) — Pantau ketat. Konseling gizi dan psikososial.`,
        message_en: `🟡 ADOLESCENT PREGNANCY (${data.motherAge} years) — Monitor closely. Nutrition and psychosocial counselling.` });
    } else if (data.motherAge >= 35) {
      flags.push({ type: 'ADVANCED_MATERNAL_AGE', severity: 'WARNING', referral: false,
        message_id: `🟡 USIA IBU ≥35 TAHUN (${data.motherAge}) — Risiko komplikasi meningkat. Pantau TD, gula darah, pertumbuhan janin.`,
        message_en: `🟡 ADVANCED MATERNAL AGE (${data.motherAge}) — Increased complication risk. Monitor BP, blood sugar, fetal growth.` });
    }
  }

  // ═══ v2: DJJ ABNORMAL FLAG ═══
  // Normal fetal heart rate: 120–160 bpm (Buku KIA standard)
  if (data.djjBpm != null && data.djjBpm > 0) {
    if (data.djjBpm < 100) {
      // Severe bradycardia — emergency
      flags.push({ type: 'DJJ_SEVERE_BRADYCARDIA', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 DJJ SANGAT RENDAH (${data.djjBpm} dpm) — Bradikardia berat. RUJUK SEGERA.`,
        message_en: `🔴 SEVERE FHR BRADYCARDIA (${data.djjBpm} bpm) — REFER IMMEDIATELY.` });
    } else if (data.djjBpm < 120) {
      // Mild bradycardia — warning
      flags.push({ type: 'DJJ_BRADYCARDIA', severity: 'WARNING', referral: false,
        message_id: `🟡 DJJ RENDAH (${data.djjBpm} dpm) — Di bawah normal. Pantau ketat, periksa ulang.`,
        message_en: `🟡 LOW FHR (${data.djjBpm} bpm) — Below normal. Monitor closely, recheck.` });
    } else if (data.djjBpm > 180) {
      // Severe tachycardia — emergency
      flags.push({ type: 'DJJ_SEVERE_TACHYCARDIA', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 DJJ SANGAT TINGGI (${data.djjBpm} dpm) — Takikardia berat. RUJUK SEGERA.`,
        message_en: `🔴 SEVERE FHR TACHYCARDIA (${data.djjBpm} bpm) — REFER IMMEDIATELY.` });
    } else if (data.djjBpm > 160) {
      // Mild tachycardia — warning
      flags.push({ type: 'DJJ_TACHYCARDIA', severity: 'WARNING', referral: false,
        message_id: `🟡 DJJ TINGGI (${data.djjBpm} dpm) — Di atas normal. Pantau ketat, periksa ulang.`,
        message_en: `🟡 HIGH FHR (${data.djjBpm} bpm) — Above normal. Monitor closely, recheck.` });
    }
  }

  // ═══ WARNING FLAGS ═══

  // Malpresentation after 36 weeks
  if (data.gestationalWeeks >= 36 && data.presentation != null) {
    const pres = data.presentation.toLowerCase();
    if (['sungsang','breech','lintang','transverse','oblique'].some(s => pres.includes(s))) {
      flags.push({ type: 'MALPRESENTATION', severity: 'WARNING', referral: true,
        message_id: '🟡 MALPRESENTASI (≥36 mgg) — Pertimbangkan rujukan untuk evaluasi.',
        message_en: '🟡 MALPRESENTATION (≥36 wk) — Consider referral for evaluation.' });
    }
  }

  // Fundal height discrepancy (± 3 cm from gestational weeks)
  if (data.fundalHeightCm != null && data.gestationalWeeks >= 20) {
    const diff = Math.abs(data.fundalHeightCm - data.gestationalWeeks);
    if (diff >= 4) {
      flags.push({ type: 'FUNDAL_DISCREPANCY', severity: 'WARNING', referral: false,
        message_id: `🟡 TFU (${data.fundalHeightCm} cm) tidak sesuai usia kehamilan (${data.gestationalWeeks} mgg). Evaluasi pertumbuhan janin.`,
        message_en: `🟡 Fundal height (${data.fundalHeightCm} cm) discrepant with GA (${data.gestationalWeeks} wk). Evaluate fetal growth.` });
    }
  }

  // ═══ v2: KEK — LILA < 23.5 cm ═══
  // Kekurangan Energi Kronis (Chronic Energy Deficiency)
  // Buku KIA standard: LILA < 23.5 cm = KEK risk
  if (data.lilaCm != null && data.lilaCm > 0) {
    if (data.lilaCm < 23.5) {
      flags.push({ type: 'KEK', severity: 'WARNING', referral: false,
        message_id: `🟡 KEK — LILA ${data.lilaCm} cm (< 23.5 cm). Risiko Kekurangan Energi Kronis. Konseling gizi + pantau BB.`,
        message_en: `🟡 CED — MUAC ${data.lilaCm} cm (< 23.5 cm). Chronic Energy Deficiency risk. Nutrition counselling + monitor weight.` });
    }
  }

  // ═══ v2: BMI CATEGORY INFO FLAGS ═══
  if (data.bmi != null && data.bmiCategory) {
    const cat = data.bmiCategory.toLowerCase();
    if (cat === 'underweight') {
      flags.push({ type: 'BMI_UNDERWEIGHT', severity: 'WARNING', referral: false,
        message_id: `🟡 BMI KURANG (${data.bmi.toFixed(1)}) — Berat badan kurang. Konseling gizi, pantau kenaikan BB.`,
        message_en: `🟡 UNDERWEIGHT BMI (${data.bmi.toFixed(1)}) — Nutrition counselling, monitor weight gain.` });
    } else if (cat === 'obese') {
      flags.push({ type: 'BMI_OBESE', severity: 'WARNING', referral: false,
        message_id: `🟡 BMI OBESITAS (${data.bmi.toFixed(1)}) — Risiko kehamilan tinggi. Pantau TD dan gula darah.`,
        message_en: `🟡 OBESE BMI (${data.bmi.toFixed(1)}) — High-risk pregnancy. Monitor BP and blood glucose.` });
    } else if (cat === 'overweight') {
      flags.push({ type: 'BMI_OVERWEIGHT', severity: 'INFO', referral: false,
        message_id: `ℹ️ BMI BERLEBIH (${data.bmi.toFixed(1)}) — Pantau kenaikan BB sesuai target.`,
        message_en: `ℹ️ OVERWEIGHT BMI (${data.bmi.toFixed(1)}) — Monitor weight gain per target.` });
    }
    // Normal BMI — no flag needed
  }

  // ═══ v2 Phase A: LAB SCREENING FLAGS ═══
 
  // HIV reactive
  if (data.hivStatus && data.hivStatus.toLowerCase().includes('reaktif')
      && !data.hivStatus.toLowerCase().includes('non')) {
    flags.push({ type: 'HIV_REACTIVE', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 HIV REAKTIF — RUJUK segera untuk konfirmasi + PMTCT.',
      message_en: '🔴 HIV REACTIVE — REFER immediately for confirmation + PMTCT.' });
  }
 
  // Syphilis reactive
  if (data.syphilisStatus && data.syphilisStatus.toLowerCase().includes('reaktif')
      && !data.syphilisStatus.toLowerCase().includes('non')) {
    flags.push({ type: 'SYPHILIS_REACTIVE', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 SIFILIS REAKTIF — RUJUK untuk pengobatan. Risiko sifilis kongenital.',
      message_en: '🔴 SYPHILIS REACTIVE — REFER for treatment. Congenital syphilis risk.' });
  }
 
  // HBsAg reactive
  if (data.hbsagStatus && data.hbsagStatus.toLowerCase().includes('reaktif')
      && !data.hbsagStatus.toLowerCase().includes('non')) {
    flags.push({ type: 'HBSAG_REACTIVE', severity: 'WARNING', referral: true,
      message_id: '🟡 HBsAg REAKTIF — Hepatitis B positif. Rujuk: bayi perlu HB-0 + HBIg dalam 24 jam setelah lahir.',
      message_en: '🟡 HBsAg REACTIVE — Hepatitis B positive. Refer: baby needs HB-0 + HBIg within 24h of birth.' });
  }
 
  // Blood sugar — GDM screening
  if (data.bloodSugarMg != null && data.bloodSugarMg > 0) {
    if (data.bloodSugarMg >= 200) {
      flags.push({ type: 'GDM_HIGH', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 GULA DARAH SANGAT TINGGI (${data.bloodSugarMg} mg/dL) — RUJUK segera. Kemungkinan diabetes gestasional.`,
        message_en: `🔴 VERY HIGH BLOOD SUGAR (${data.bloodSugarMg} mg/dL) — REFER immediately. Possible GDM.` });
    } else if (data.bloodSugarMg >= 140) {
      flags.push({ type: 'GDM_WARNING', severity: 'WARNING', referral: false,
        message_id: `🟡 GULA DARAH MENINGKAT (${data.bloodSugarMg} mg/dL) — Pantau. Pertimbangkan TTGO/OGTT.`,
        message_en: `🟡 ELEVATED BLOOD SUGAR (${data.bloodSugarMg} mg/dL) — Monitor. Consider OGTT.` });
    }
  }
 
  // Malaria RDT positive
  const malariaPositive = !!data.malariaRdt && data.malariaRdt.toLowerCase().includes('positif');
  if (malariaPositive) {
    flags.push({ type: 'MALARIA_POSITIVE', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 MALARIA POSITIF — RUJUK untuk pengobatan antimalarial. Kehamilan berisiko tinggi.',
      message_en: '🔴 MALARIA POSITIVE — REFER for antimalarial treatment. High-risk pregnancy.' });
  }

  // ═══ FEVER IN PREGNANCY, AND THE TEST IT IS SUPPOSED TO TRIGGER ══════════
  //
  // WHY THIS SET EXISTS
  //
  // MALARIA_POSITIVE above has been here since v1 and was almost unreachable,
  // because nothing told a midwife to run the test. The Kemenkes malaria
  // pocket book is explicit: every person in an endemic area with fever, OR a
  // history of fever in the last 48 hours, must be tested by microscope or
  // RDT. There was no way to record a temperature in pregnancy at all, so the
  // rule could only fire if she happened to do an RDT unprompted. Papua
  // carries the great majority of Indonesia's malaria burden, and untreated
  // malaria in pregnancy causes miscarriage, preterm birth, low birth weight
  // and stillbirth.
  //
  // WHY 38.0 WARNS RATHER THAN REFERS, UNLIKE THE POSTNATAL SET
  //
  // There, 38.0 is an emergency: puerperal sepsis kills in hours. A fever at
  // twenty weeks in an endemic village is usually malaria, dengue or typhoid.
  // Auto-referring every 38.0 in Papua would bury the referral list in noise
  // and teach her to ignore it, which costs us the flag for the cases that
  // need it. So the response to a fever is the TEST, and the referral follows
  // the result.
  //
  // Thresholds reviewed and approved 2026-10-12. The 37.5 low-grade band and
  // the 35.5 hypothermia rule are deliberately identical to pncFlags, so a
  // midwife learns one set of numbers rather than two.
  {
    const t = data.temperatureC;
    const hasTemp = t != null;
    const febrileNow = hasTemp && t >= 38.0;
    const feverHistory = data.feverLast48h === true;

    if (hasTemp && t >= 39.0) {
      flags.push({ type: 'HIGH_FEVER_PREGNANCY', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 DEMAM TINGGI — suhu ${t}°C (≥ 39°C). Risiko bagi ibu dan janin. Curiga malaria berat atau infeksi berat. RUJUK SEGERA.`,
        message_en: `🔴 HIGH FEVER — ${t}°C (≥ 39°C). A risk to mother and baby. Suspect severe malaria or serious infection. REFER NOW.` });
    } else if (febrileNow) {
      flags.push({ type: 'FEVER_PREGNANCY', severity: 'WARNING', referral: false,
        message_id: `🟡 DEMAM — suhu ${t}°C (≥ 38°C). Cari penyebabnya. Pantau, ukur ulang, dan rujuk bila memburuk.`,
        message_en: `🟡 FEVER — ${t}°C (≥ 38°C). Look for the cause. Monitor, recheck, and refer if she worsens.` });
    } else if (hasTemp && t >= 37.5) {
      flags.push({ type: 'LOW_GRADE_FEVER', severity: 'WARNING', referral: false,
        message_id: `🟡 Suhu ${t}°C — pantau, ukur ulang dalam 4 jam.`,
        message_en: `🟡 Temperature ${t}°C — monitor, recheck in 4 hours.` });
    }

    // Hypothermia is a sign of severe sepsis, not of being cold. Same
    // threshold and the same severity as the postnatal set.
    if (hasTemp && t < 35.5) {
      flags.push({ type: 'HYPOTHERMIA', severity: 'EMERGENCY', referral: true,
        message_id: `🔴 HIPOTERMIA — suhu ${t}°C. Tanda sepsis berat. RUJUK SEGERA.`,
        message_en: `🔴 HYPOTHERMIA — ${t}°C. A sign of severe sepsis. REFER NOW.` });
    }

    /* THE RULE THAT MAKES THE RDT HAPPEN.
       Fires on a fever now OR a fever in the last 48 hours, which is the
       Kemenkes wording, and only while the test has not been done -- a
       negative result is an answer, and repeating the instruction after she
       has complied is how a prompt becomes noise. A positive result has
       already raised MALARIA_POSITIVE above. */
    if ((febrileNow || feverHistory) && !data.malariaRdt) {
      flags.push({ type: 'MALARIA_TEST_REQUIRED', severity: 'WARNING', referral: false,
        message_id: febrileNow
          ? '🟡 WAJIB PERIKSA MALARIA — ada demam. Lakukan RDT atau mikroskop sekarang (aturan Kemenkes untuk daerah endemis).'
          : '🟡 WAJIB PERIKSA MALARIA — ada riwayat demam 48 jam terakhir. Lakukan RDT atau mikroskop sekarang (aturan Kemenkes untuk daerah endemis).',
        message_en: febrileNow
          ? '🟡 MALARIA TEST REQUIRED — she has a fever. Do an RDT or microscopy now (Kemenkes rule for endemic areas).'
          : '🟡 MALARIA TEST REQUIRED — fever in the last 48 hours. Do an RDT or microscopy now (Kemenkes rule for endemic areas).' });
    }
  }

    // ═══ PHASE B: USG FLAGS ═══
 
  if (data.usgResults) {
    const usg = data.usgResults;
 
    // Placenta previa — emergency
    if (usg.plasenta && (usg.plasenta.includes('previa') || usg.plasenta.includes('letak rendah') || usg.plasenta.includes('low'))) {
      flags.push({ type: 'PLACENTA_PREVIA', severity: 'EMERGENCY', referral: true,
        message_id: '🔴 PLASENTA PREVIA — RUJUK ke PONEK. Risiko perdarahan antepartum.',
        message_en: '🔴 PLACENTA PREVIA — REFER to PONEK. Antepartum hemorrhage risk.' });
    }
 
    // Oligohydramnios (ketuban kurang)
    if (usg.ketuban && (usg.ketuban.includes('kurang') || usg.ketuban.includes('oligohidramnion') || usg.ketuban.includes('sedikit'))) {
      flags.push({ type: 'OLIGOHYDRAMNIOS', severity: 'WARNING', referral: true,
        message_id: '🟡 OLIGOHIDRAMNION — Cairan ketuban kurang. Rujuk untuk evaluasi.',
        message_en: '🟡 OLIGOHYDRAMNIOS — Low amniotic fluid. Refer for evaluation.' });
    }
 
    // Polyhydramnios (ketuban berlebih)
    if (usg.ketuban && (usg.ketuban.includes('berlebih') || usg.ketuban.includes('polihidramnion') || usg.ketuban.includes('banyak'))) {
      flags.push({ type: 'POLYHYDRAMNIOS', severity: 'WARNING', referral: false,
        message_id: '🟡 POLIHIDRAMNION — Cairan ketuban berlebih. Pantau ketat.',
        message_en: '🟡 POLYHYDRAMNIOS — Excess amniotic fluid. Monitor closely.' });
    }
 
    // Fetal anomaly detected
    if (usg.kelainanJanin && usg.kelainanJanin.includes('terdeteksi')) {
      flags.push({ type: 'FETAL_ANOMALY', severity: 'EMERGENCY', referral: true,
        message_id: '🔴 KELAINAN JANIN TERDETEKSI — RUJUK untuk evaluasi spesialis.',
        message_en: '🔴 FETAL ANOMALY DETECTED — REFER for specialist evaluation.' });
    }
 
    // IUGR — TBJ below expected for gestational age (rough check)
    // At 28wk ~1000g, 32wk ~1700g, 36wk ~2500g, 40wk ~3300g
    if (usg.tbjGram && data.gestationalWeeks >= 28) {
      const expectedMin: Record<number, number> = { 28: 700, 30: 1000, 32: 1300, 34: 1800, 36: 2100, 38: 2500, 40: 2800 };
      // Find closest reference week
      const refWeeks = Object.keys(expectedMin).map(Number).sort((a, b) => a - b);
      const closest = refWeeks.reduce((prev, curr) =>
        Math.abs(curr - data.gestationalWeeks) < Math.abs(prev - data.gestationalWeeks) ? curr : prev
      );
      if (usg.tbjGram < expectedMin[closest] * 0.75) {
        flags.push({ type: 'IUGR_SUSPECT', severity: 'WARNING', referral: true,
          message_id: `🟡 SUSPEK IUGR — TBJ ${usg.tbjGram}g rendah untuk UK ${data.gestationalWeeks} mgg. Rujuk untuk evaluasi.`,
          message_en: `🟡 IUGR SUSPECT — EFW ${usg.tbjGram}g low for ${data.gestationalWeeks}wk GA. Refer for evaluation.` });
      }
    }
  }

  // ═══ PHASE C: BIRTH PLAN FLAGS ═══
 
  // Home delivery planned at high-risk pregnancy
  if (data.birthPlan?.fasilitas && data.birthPlan.fasilitas.includes('rumah')) {
    const hasRisk = flags.some(f => f.severity === 'EMERGENCY' || f.severity === 'WARNING');
    if (hasRisk) {
      flags.push({ type: 'HOME_DELIVERY_HIGH_RISK', severity: 'WARNING', referral: false,
        message_id: '🟡 RENCANA PERSALINAN DI RUMAH + RISIKO TINGGI — Konseling ulang: sarankan persalinan di fasilitas kesehatan.',
        message_en: '🟡 HOME DELIVERY PLANNED + HIGH RISK — Re-counsel: recommend facility-based delivery.' });
    }
  }
 
  // No birth plan recorded after 32 weeks
  if (!data.birthPlan && data.gestationalWeeks >= 32) {
    flags.push({ type: 'NO_BIRTH_PLAN', severity: 'INFO', referral: false,
      message_id: 'ℹ️ RENCANA PERSALINAN BELUM ADA (≥32 mgg) — Diskusikan rencana persalinan dengan ibu.',
      message_en: 'ℹ️ NO BIRTH PLAN (≥32 wk) — Discuss birth plan with mother.' });
  }
 
  // No transport plan after 36 weeks
  if (data.birthPlan && !data.birthPlan.transportasi && data.gestationalWeeks >= 36) {
    flags.push({ type: 'NO_TRANSPORT_PLAN', severity: 'INFO', referral: false,
      message_id: 'ℹ️ TRANSPORTASI DARURAT BELUM ADA — Pastikan rencana transportasi ke faskes tersedia.',
      message_en: 'ℹ️ NO EMERGENCY TRANSPORT PLAN — Ensure transport to facility is arranged.' });
  }
 
  // No funding plan after 32 weeks
  if (data.birthPlan && !data.birthPlan.pendanaan && data.gestationalWeeks >= 32) {
    flags.push({ type: 'NO_FUNDING_PLAN', severity: 'INFO', referral: false,
      message_id: 'ℹ️ PENDANAAN BELUM ADA — Pastikan pembiayaan persalinan (BPJS/tabungan) sudah disiapkan.',
      message_en: 'ℹ️ NO FUNDING PLAN — Ensure delivery funding (BPJS/savings) is arranged.' });
  }
  
  // ═══ INFO FLAGS ═══

  // Proteinuria without hypertension
  if (proteinuria && !highBP) {
    flags.push({ type: 'PROTEINURIA_ISOLATED', severity: 'INFO', referral: false,
      message_id: 'ℹ️ Proteinuria tanpa hipertensi — periksa ulang, singkirkan ISK.',
      message_en: 'ℹ️ Proteinuria without hypertension — recheck, rule out UTI.' });
  }

  // Reduced fetal movement
  if (['gerakan kurang','berkurang','sedikit','fetal movement'].some(s => cl.includes(s))) {
    flags.push({ type: 'REDUCED_FETAL_MOVEMENT', severity: 'WARNING', referral: false,
      message_id: '🟡 Gerakan janin berkurang — lakukan tes kick count. Jika <10 gerakan/12 jam, RUJUK.',
      message_en: '🟡 Reduced fetal movement — do kick count test. If <10 movements/12h, REFER.' });
  }

  // Premature labour signs
  if (data.gestationalWeeks < 37 && ['kontraksi','mulas','ketuban','pecah air'].some(s => cl.includes(s))) {
    flags.push({ type: 'PRETERM_SIGNS', severity: 'EMERGENCY', referral: true,
      message_id: '🔴 TANDA PERSALINAN PREMATUR — RUJUK SEGERA ke PONED/PONEK.',
      message_en: '🔴 PRETERM LABOUR SIGNS — REFER IMMEDIATELY to PONED/PONEK.' });
  }

  return flags;
}

// ── shouldRefer: determines whether any flag warrants referral ──
export function shouldRefer(flags: ClinicalFlag[]): {
  refer: boolean;
  urgency: 'emergency' | 'urgent' | 'routine' | 'none';
  reasons: string[];
} {
  const referFlags = flags.filter(f => f.referral);
  if (referFlags.length === 0) {
    return { refer: false, urgency: 'none', reasons: [] };
  }

  const hasEmergency = referFlags.some(f => f.severity === 'EMERGENCY');
  return {
    refer: true,
    urgency: hasEmergency ? 'emergency' : 'urgent',
    reasons: referFlags.map(f => f.message_id),
  };
}

// ── formatFlagsForWhatsApp: renders flags as WhatsApp message block ──
export function formatFlagsForWhatsApp(flags: ClinicalFlag[], lang: 'id' | 'en' = 'id'): string {
  if (flags.length === 0) return '';

  const emergencies = flags.filter(f => f.severity === 'EMERGENCY');
  const warnings = flags.filter(f => f.severity === 'WARNING');
  const infos = flags.filter(f => f.severity === 'INFO');

  let out = '';

  if (emergencies.length > 0) {
    out += `\n🚨 *PERINGATAN DARURAT*\n`;
    emergencies.forEach(f => {
      out += `${lang === 'id' ? f.message_id : f.message_en}\n`;
    });
  }

  if (warnings.length > 0) {
    out += `\n⚠️ *PERHATIAN*\n`;
    warnings.forEach(f => {
      out += `${lang === 'id' ? f.message_id : f.message_en}\n`;
    });
  }

  if (infos.length > 0) {
    out += `\n📋 *INFO KLINIS*\n`;
    infos.forEach(f => {
      out += `${lang === 'id' ? f.message_id : f.message_en}\n`;
    });
  }

  return out;
}
