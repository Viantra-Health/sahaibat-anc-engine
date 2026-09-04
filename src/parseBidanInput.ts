// lib/triage/parseBidanInput.ts
// Parses Bidan's WhatsApp messages into structured ANC visit data
// Handles Indonesian clinical abbreviations and natural language input
// v2: Added mother height (TB ibu), LILA, DJJ, blood type, BMI calc

export interface ParsedAncInit {
  visitType: string;        // 'K1' through 'K6'
  motherName: string;
  gestationalWeeks: number;
}

export interface ParsedAncData {
  t1WeightKg: number | null;
  t2BpSystolic: number | null;
  t2BpDiastolic: number | null;
  t3FundalHeightCm: number | null;
  t4TtStatus: string | null;
  t5FeTablets: number | null;
  t6LabHb: number | null;
  t6LabProtein: string | null;
  t6LabOther: Record<string, any> | null;
  t7CounsellingTopics: string[] | null;
  t8Presentation: string | null;
  t9CaseManagement: string | null;
  t10FollowupPlan: string | null;
  complaints: string | null;
  // New Buku KIA fields
  motherHeightCm: number | null;
  lilaCm: number | null;
  djjBpm: number | null;
  bloodType: string | null;
  // Phase A: Lab screening fields
  hivStatus: string | null;
  syphilisStatus: string | null;
  hbsagStatus: string | null;
  bloodSugarMg: number | null;
  malariaRdt: string | null;
  usgResults: { plasenta: string | null; ketuban: string | null; kelainanJanin: string | null; tbjGram: number | null; catatan: string | null } | null;
  pmtProvided: boolean | null;
   // Phase C
  birthPlan: {
     fasilitas: string | null;
     transportasi: string | null;
     donorDarah: string | null;
    pendanaan: string | null;
    pendamping: string | null;
    catatan: string | null;
  } | null;
  rawInput: string;
  
}

// Parse the initial message: "ANC3, Siti Aminah, 28mgg"
export function parseAncInit(message: string): ParsedAncInit | null {
  const text = message.trim();

  const ancMatch = text.match(/anc\s*k?(\d)/i);
  if (!ancMatch) return null;

  const visitNum = parseInt(ancMatch[1]);
  if (visitNum < 1 || visitNum > 6) return null;
  const visitType = `K${visitNum}`;

  const weeksMatch = text.match(/(\d{1,2})\s*(?:mgg|minggu|w|weeks?)/i);
  const gestationalWeeks = weeksMatch ? parseInt(weeksMatch[1]) : 0;

  let remaining = text
    .replace(/anc\s*k?\d/i, '')
    .replace(/\d{1,2}\s*(?:mgg|minggu|w|weeks?)/i, '')
    .replace(/[,]/g, ' ')
    .trim();

  const motherName = remaining.split(/\s+/).filter(w => w.length > 0).join(' ') || 'Unknown';

  return { visitType, motherName, gestationalWeeks };
}

// Parse the clinical data message
export function parseAncData(message: string): ParsedAncData {
  const text = message.trim();
  const textLower = text.toLowerCase();
  const result: ParsedAncData = {
    t1WeightKg: null, t2BpSystolic: null, t2BpDiastolic: null,
    t3FundalHeightCm: null, t4TtStatus: null, t5FeTablets: null,
    t6LabHb: null, t6LabProtein: null, t6LabOther: null,
    t7CounsellingTopics: null, t8Presentation: null,
    t9CaseManagement: null, t10FollowupPlan: null,
    complaints: null,
    motherHeightCm: null, lilaCm: null, djjBpm: null, bloodType: null,
    hivStatus: null, syphilisStatus: null, hbsagStatus: null,
   bloodSugarMg: null, malariaRdt: null,
  usgResults: null, pmtProvided: null,
    birthPlan: null,
  rawInput: text,
  };

  // T1: Weight - "BB 58" or "BB: 58" or "berat 58"
  const bbMatch = textLower.match(/(?:bb|berat\s*badan|berat)\s*:?\s*(\d{2,3}(?:\.\d)?)/);
  if (bbMatch) result.t1WeightKg = parseFloat(bbMatch[1]);

  // T2: Blood pressure - "TD 140/90" or "tekanan darah 140/90"
  const tdMatch = textLower.match(/(?:td|tekanan\s*darah)\s*:?\s*(\d{2,3})\s*[\/]\s*(\d{2,3})/);
  if (tdMatch) {
    result.t2BpSystolic = parseInt(tdMatch[1]);
    result.t2BpDiastolic = parseInt(tdMatch[2]);
  }

  // T3: Fundal height - "TFU 26" or "fundus 26"
  const tfuMatch = textLower.match(/(?:tfu|fundus|tinggi\s*fundus)\s*:?\s*(\d{1,2})/);
  if (tfuMatch) result.t3FundalHeightCm = parseInt(tfuMatch[1]);

  // T4: TT status - "TT lengkap" or "TT2+"
  const ttMatch = textLower.match(/(?:tt|tetanus)\s*:?\s*([\w+]+)/);
  if (ttMatch) result.t4TtStatus = ttMatch[1];

  // T5: Fe tablets - "Fe 30" or "tablet fe 30"
  const feMatch = textLower.match(/(?:fe|tablet\s*fe|zat\s*besi)\s*:?\s*(\d{1,3})\s*(?:tablet)?/);
  if (feMatch) result.t5FeTablets = parseInt(feMatch[1]);

  // T6: Lab - Hb
  const hbMatch = textLower.match(/(?:hb|haemoglobin|hemoglobin)\s*:?\s*(\d{1,2}(?:\.\d{1,2})?)/);
  if (hbMatch) result.t6LabHb = parseFloat(hbMatch[1]);

  // T6: Lab - Protein
  const protMatch = textLower.match(/(?:protein|proteinuria)\s*:?\s*([+-]?\+{0,3}|\d)/);
  if (protMatch) {
    const val = protMatch[1];
    result.t6LabProtein = val === '-' || val === '0' ? '-' : val.includes('+') ? val : `+${val}`;
  }
  if (!result.t6LabProtein) {
    if (textLower.includes('protein +') || textLower.includes('protein positif')) {
      const pMatch = textLower.match(/protein\s*\+?(\d)?/);
      result.t6LabProtein = pMatch && pMatch[1] ? `+${pMatch[1]}` : '+1';
    } else if (textLower.includes('protein -') || textLower.includes('protein negatif')) {
      result.t6LabProtein = '-';
    }
  }

  // T7: Counselling topics - "Konseling tanda bahaya, gizi"
  const konMatch = text.match(/(?:konseling|counselling|temu\s*wicara|edukasi)\s*:?\s*(.+?)(?=,\s*(?:presentasi|keluhan|tindak|tata|lila|djj|golda)|$)/i);
  if (konMatch) {
    const topics = konMatch[1].split(/[,;]/).map(t => t.trim()).filter(t => t.length > 0);
    if (topics.length > 0) result.t7CounsellingTopics = topics;
  }

  // T8: Presentation - "Presentasi kepala" or "letak sungsang"
  const presMatch = textLower.match(/(?:presentasi|letak)\s*:?\s*(kepala|cephalic|sungsang|breech|lintang|transverse|belum)/);
  if (presMatch) result.t8Presentation = presMatch[1];

  // T9: Case management - "Tatalaksana normal" or "tata laksana rujuk"
  const tataMatch = text.match(/(?:tata\s*laksana|tatalaksana|case\s*management)\s*:?\s*(.+?)(?=,\s*(?:tindak|keluhan|lila|djj)|$)/i);
  if (tataMatch) result.t9CaseManagement = tataMatch[1].trim();

  // T10: Follow-up - "Tindak lanjut kontrol 4 minggu"
  const tlMatch = text.match(/(?:tindak\s*lanjut|follow[\s-]*up)\s*:?\s*(.+?)(?=,\s*(?:keluhan|lila|djj)|$)/i);
  if (tlMatch) result.t10FollowupPlan = tlMatch[1].trim();

  // Complaints - "Keluhan sakit kepala"
  const keluhanMatch = text.match(/(?:keluhan|complaint)\s*:?\s*(.+?)(?=,\s*(?:konseling|presentasi|tata|tindak|lila|djj|golda|tb\s*ibu|tinggi\s*ibu)|$)/i);
  if (keluhanMatch) result.complaints = keluhanMatch[1].trim();

  // ── NEW: Mother Height - "TB ibu 155" or "Tinggi ibu 155" or "TB 155 cm" ──
  const tbIbuMatch = textLower.match(/(?:tb\s*ibu|tinggi\s*ibu|tinggi\s*badan\s*ibu|tb)\s*:?\s*(\d{2,3}(?:\.\d)?)\s*(?:cm)?/);
  if (tbIbuMatch) {
    const h = parseFloat(tbIbuMatch[1]);
    // Disambiguate: TB ibu is always >100cm. If someone types "TB 26" that's TFU not height.
    if (h > 100) result.motherHeightCm = h;
  }

  // ── NEW: LILA - "LILA 23" or "LILA: 25.5" or "lila 22 cm" ──
  const lilaMatch = textLower.match(/(?:lila|muac|lingkar\s*lengan)\s*:?\s*(\d{1,2}(?:\.\d)?)\s*(?:cm)?/);
  if (lilaMatch) result.lilaCm = parseFloat(lilaMatch[1]);

  // ── NEW: DJJ (Fetal Heart Rate) - "DJJ 142" or "djj: 148 bpm" ──
  const djjMatch = textLower.match(/(?:djj|denyut\s*jantung|fetal\s*hr|fhr)\s*:?\s*(\d{2,3})\s*(?:bpm|x\/mnt)?/);
  if (djjMatch) result.djjBpm = parseInt(djjMatch[1]);

  // ── NEW: Blood Type - "Goldar O+" or "golongan darah A+" or "gol darah B-" ──
  const goldarMatch = textLower.match(/(?:goldar|golongan\s*darah|gol\s*darah|blood\s*type)\s*:?\s*([abo]+[+-]?)/i);
  if (goldarMatch) {
    let bt = goldarMatch[1].toUpperCase();
    // Normalise: "O" → "O+", "A" → "A+" (assume Rh+ if not specified)
    if (!bt.endsWith('+') && !bt.endsWith('-')) bt += '+';
    result.bloodType = bt;
  }

  // ── PHASE A: HIV status - "HIV reaktif" or "HIV non-reaktif" or "HIV -" ──
  const hivMatch = textLower.match(/(?:hiv|tes\s*hiv)\s*:?\s*(reaktif|non[- ]?reaktif|positif|negatif|[+-])/);
  if (hivMatch) {
    const v = hivMatch[1];
    result.hivStatus = (v === '-' || v.includes('non') || v.includes('negatif')) ? 'non-reaktif' : 'reaktif';
  }

  // ── PHASE A: Syphilis - "Sifilis reaktif" or "VDRL +" ──
  const syphMatch = textLower.match(/(?:sifilis|syphilis|vdrl|tpha)\s*:?\s*(reaktif|non[- ]?reaktif|positif|negatif|[+-])/);
  if (syphMatch) {
    const v = syphMatch[1];
    result.syphilisStatus = (v === '-' || v.includes('non') || v.includes('negatif')) ? 'non-reaktif' : 'reaktif';
  }

  // ── PHASE A: HBsAg - "HBsAg reaktif" or "Hep B +" ──
  const hbsMatch = textLower.match(/(?:hbsag|hbs\s*ag|hepatitis\s*b|hep\s*b)\s*:?\s*(reaktif|non[- ]?reaktif|positif|negatif|[+-])/);
  if (hbsMatch) {
    const v = hbsMatch[1];
    result.hbsagStatus = (v === '-' || v.includes('non') || v.includes('negatif')) ? 'non-reaktif' : 'reaktif';
  }

  // ── PHASE A: Blood sugar - "GDS 145" or "gula darah 120" or "GDA 98" ──
  const gdMatch = textLower.match(/(?:gds|gda|gula\s*darah|blood\s*sugar|gdp)\s*:?\s*(\d{2,3}(?:\.\d)?)/);
  if (gdMatch) result.bloodSugarMg = parseFloat(gdMatch[1]);

  // ── PHASE A: Malaria RDT - "Malaria positif" or "RDT malaria -" ──
const malMatch = textLower.match(/(?:malaria|rdt\s*malaria|rdt)\s*:?\s*(positif|negatif|pos|neg|[+-])/);
  if (malMatch) {
    const v = malMatch[1];
    result.malariaRdt = (v === '-' || v.includes('neg')) ? 'negatif' : 'positif';
  }

  // ── PHASE B: USG results ──
  const usgMatch = text.match(/(?:usg|ultrasonografi)\s*:?\s*(.+?)(?=,\s*(?:pmt|konseling|tatalaksana|tata\s*laksana|tindak|keluhan|hiv|sifilis|hbsag|gds|malaria)|$)/i);
  if (usgMatch) {
    const usgText = usgMatch[1].toLowerCase();
    const usg: { plasenta: string | null; ketuban: string | null; kelainanJanin: string | null; tbjGram: number | null; catatan: string | null } = {
      plasenta: null, ketuban: null, kelainanJanin: null, tbjGram: null, catatan: null,
    };

    const plasentaMatch = usgText.match(/plasenta\s*:?\s*(normal|fundus|anterior|posterior|previa|letak\s*rendah|low[- ]?lying)/);
    if (plasentaMatch) usg.plasenta = plasentaMatch[1].trim();

    const ketubanMatch = usgText.match(/ketuban\s*:?\s*(normal|cukup|kurang|oligohidramnion|berlebih|polihidramnion|sedikit|banyak)/);
    if (ketubanMatch) {
      const k = ketubanMatch[1];
      usg.ketuban = (k === 'cukup') ? 'normal' : k;
    }

    const kelainanMatch = usgText.match(/kelainan\s*(?:janin)?\s*:?\s*(tidak\s*ada|ada|ya|tidak|normal|terdeteksi)/);
    if (kelainanMatch) {
      const k = kelainanMatch[1];
      usg.kelainanJanin = (k.includes('tidak') || k === 'normal') ? 'tidak ada' : 'terdeteksi';
    }

    const tbjMatch = usgText.match(/(?:tbj|taksiran\s*berat)\s*:?\s*(\d{3,4})\s*(?:g|gr|gram)?/);
    if (tbjMatch) usg.tbjGram = parseInt(tbjMatch[1]);

    if (usg.plasenta || usg.ketuban || usg.kelainanJanin || usg.tbjGram) {
      result.usgResults = usg;
    } else {
      result.usgResults = { ...usg, catatan: usgMatch[1].trim() };
    }
  }

  // ── PHASE B: PMT (Supplementary Feeding) ──
const pmtMatch = textLower.match(/(?:pmt|pemberian\s*makanan\s*tambahan)\s*:?\s*(ya|sudah|diberikan|tidak|belum)/);
  if (pmtMatch) {
    const v = pmtMatch[1];
    result.pmtProvided = (v === 'ya' || v === 'sudah' || v === 'diberikan');
  }

  // ── PHASE C: Birth Plan (Rencana Persalinan) ──
  const rpMatch = text.match(/(?:rencana\s*(?:persalinan)?|p\.?\s*lin|birth\s*plan)\s*:?\s*(.+?)(?=,\s*(?:konseling|tatalaksana|tata\s*laksana|tindak|keluhan)|$)/i);
  if (rpMatch) {
    const rpText = rpMatch[1].toLowerCase();
    const bp: { fasilitas: string | null; transportasi: string | null; donorDarah: string | null; pendanaan: string | null; pendamping: string | null; catatan: string | null } = {
      fasilitas: null, transportasi: null, donorDarah: null, pendanaan: null, pendamping: null, catatan: null,
    };

    const faskesMatch = rpText.match(/(?:faskes|fasilitas|tempat)\s*:?\s*(puskesmas[\w\s]*|rs[\w\s]*|rumah\s*sakit[\w\s]*|bpm[\w\s]*|bidan[\w\s]*|rumah|klinik[\w\s]*|ponek[\w\s]*|poned[\w\s]*)/);
    if (faskesMatch) bp.fasilitas = faskesMatch[1].trim();

    const transMatch = rpText.match(/(?:transport|transportasi|kendaraan)\s*:?\s*(ambulans|ambulance|ojek|motor|mobil|kendaraan\s*pribadi|angkot|lainnya)/);
    if (transMatch) bp.transportasi = transMatch[1].trim();

    const donorMatch = rpText.match(/(?:donor(?:\s*darah)?)\s*:?\s*([^,]+)/);
    if (donorMatch) bp.donorDarah = donorMatch[1].trim();

    const danaMatch = rpText.match(/(?:dana|pendanaan|biaya|pembiayaan)\s*:?\s*(bpjs|tabungan|jampersal|kis|lainnya|mandiri|asuransi)/);
    if (danaMatch) bp.pendanaan = danaMatch[1].trim();

    const dampingMatch = rpText.match(/(?:pendamping|damping)\s*:?\s*(suami|ibu|keluarga|[^,]+)/);
    if (dampingMatch) bp.pendamping = dampingMatch[1].trim();

    if (bp.fasilitas || bp.transportasi || bp.donorDarah || bp.pendanaan || bp.pendamping) {
      result.birthPlan = bp;
    } else {
      result.birthPlan = { ...bp, catatan: rpMatch[1].trim() };
    }
  }

  return result;
}

// Parse PNC init: "PNC KF2, Siti, hari ke-7" or "KF1, Siti"
export function parsePncInit(message: string): { visitType: string; motherName: string; daysPostpartum: number } | null {
  const text = message.trim();
  const kfMatch = text.match(/(?:pnc\s*)?kf(\d)/i);
  if (!kfMatch) return null;

  const visitNum = parseInt(kfMatch[1]);
  if (visitNum < 1 || visitNum > 4) return null;

  const daysMatch = text.match(/(?:hari\s*ke-?|day\s*)(\d{1,3})/i);
  const daysPostpartum = daysMatch ? parseInt(daysMatch[1]) : 0;

  let remaining = text.replace(/(?:pnc\s*)?kf\d/i, '').replace(/hari\s*ke-?\d+/i, '').replace(/[,]/g, ' ').trim();
  const motherName = remaining.split(/\s+/).filter(w => w.length > 0).join(' ') || 'Unknown';

  return { visitType: `KF${visitNum}`, motherName, daysPostpartum };
}

// ── BMI Calculator ──
export function calculateBMI(weightKg: number | null, heightCm: number | null): { bmi: number | null; category: string | null } {
  if (!weightKg || !heightCm || heightCm < 100) return { bmi: null, category: null };
  const heightM = heightCm / 100;
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

  let category: string;
  if (bmi < 18.5) category = 'underweight';
  else if (bmi < 25.0) category = 'normal';
  else if (bmi < 30.0) category = 'overweight';
  else category = 'obese';

  return { bmi, category };
}
