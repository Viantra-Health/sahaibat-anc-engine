// @sahaibat/anc-engine · src/kbProvision.ts
//
// WHAT PROVIDING THIS METHOD ACTUALLY REQUIRES.
//
// H1 asks a third question beside eligibility and practice: "Can this
// facility and clinician provide it?" — and answers it with "verify recorded
// authorization and route appropriately". Routing is the operative word.
//
// ── WHAT THIS FILE KNOWS, AND WHAT IT DELIBERATELY DOES NOT ─────────────────
//
// It knows what each method REQUIRES, because Kemenkes says so per method:
//
//   Pedoman 2020 p101   tubektomi and vasektomi carry category S — the
//                       procedure needs an experienced operator, complete
//                       equipment, general anaesthesia available, and a
//                       temporary alternative offered where referral is needed
//   Klaster 3 p289      the implant "harus dipasang/dilepas oleh staf
//                       terlatih"; the copper IUD may be fitted postpartum
//                       "oleh staf terlatih"
//
// It does NOT know which facility level is authorised for what. H1 cites
// KMK 2015/2023 for the Posyandu / Pustu / Puskesmas differentiation and we do
// not hold that document. So there is no facility table here and no function
// that claims a given clinic may or may not do something. The engine states
// the REQUIREMENT; the clinic states what it has; the caller compares them.
//
// Inventing that table would be the worst possible failure for this file: a
// product telling a midwife she is not authorised for something she is
// trained and licensed to do, on no authority at all.

import { kbFormulation, type KbFormulationCode } from './contraception';

export type ProvisionKind =
  /** Handed over. Pills, condoms. */
  | 'serahkan'
  /** Administered on the spot by a clinician. Injections. */
  | 'suntik'
  /** A procedure: inserted or removed by trained staff. Implant, AKDR. */
  | 'tindakan'
  /** Category S: experienced operator, full equipment, anaesthesia. */
  | 'khusus'
  /** Nothing is provided — it is counselling and instruction. MAL, SMS. */
  | 'konseling';

export interface ProvisionRequirement {
  formulation: KbFormulationCode;
  kind: ProvisionKind;
  /** Trained staff are required to give or fit it. */
  trainedStaffRequired: boolean;
  /** Removal is itself a procedure, which is a separate commitment. */
  removalIsAProcedure: boolean;
  requirement_id: string;
  requirement_en: string;
  /** What to do when the facility cannot meet it. Null where it always can. */
  ifUnavailable_id: string | null;
  ifUnavailable_en: string | null;
  source: string | null;
}

const R: Partial<Record<KbFormulationCode, Omit<ProvisionRequirement, 'formulation'>>> = {
  kpk: {
    kind: 'serahkan', trainedStaffRequired: false, removalIsAProcedure: false,
    requirement_id: 'Diserahkan kepada klien, tanpa tindakan.',
    requirement_en: 'Handed to the client, no procedure.',
    ifUnavailable_id: null, ifUnavailable_en: null, source: null,
  },
  kpp: {
    kind: 'serahkan', trainedStaffRequired: false, removalIsAProcedure: false,
    requirement_id: 'Diserahkan kepada klien, tanpa tindakan.',
    requirement_en: 'Handed to the client, no procedure.',
    ifUnavailable_id: null, ifUnavailable_en: null, source: null,
  },
  kondom_pria: {
    kind: 'serahkan', trainedStaffRequired: false, removalIsAProcedure: false,
    requirement_id: 'Diserahkan kepada klien, tanpa tindakan.',
    requirement_en: 'Handed to the client, no procedure.',
    ifUnavailable_id: null, ifUnavailable_en: null, source: null,
  },
  kondom_wanita: {
    kind: 'serahkan', trainedStaffRequired: false, removalIsAProcedure: false,
    requirement_id: 'Diserahkan kepada klien, tanpa tindakan.',
    requirement_en: 'Handed to the client, no procedure.',
    ifUnavailable_id: null, ifUnavailable_en: null, source: null,
  },
  ksk: {
    kind: 'suntik', trainedStaffRequired: true, removalIsAProcedure: false,
    requirement_id: 'Suntikan intramuskuler oleh tenaga kesehatan.',
    requirement_en: 'Intramuscular injection by a health worker.',
    ifUnavailable_id: null, ifUnavailable_en: null, source: 'Pedoman 2020 p62',
  },
  ksp_dmpa: {
    kind: 'suntik', trainedStaffRequired: true, removalIsAProcedure: false,
    requirement_id: 'Suntikan intramuskuler oleh tenaga kesehatan, tiap 12 minggu.',
    requirement_en: 'Intramuscular injection by a health worker, every 12 weeks.',
    ifUnavailable_id: 'Klien bergantung pada tempat layanan untuk suntikan ulang — pastikan aksesnya sebelum memilih.',
    ifUnavailable_en: 'She depends on a service point for every repeat — make sure she can reach one before choosing it.',
    source: 'Klaster 3 p289 · Pedoman 2020 p63',
  },
  ksp_neten: {
    kind: 'suntik', trainedStaffRequired: true, removalIsAProcedure: false,
    requirement_id: 'Suntikan intramuskuler oleh tenaga kesehatan, tiap 8 minggu.',
    requirement_en: 'Intramuscular injection by a health worker, every 8 weeks.',
    ifUnavailable_id: 'Klien bergantung pada tempat layanan untuk suntikan ulang — pastikan aksesnya sebelum memilih.',
    ifUnavailable_en: 'She depends on a service point for every repeat — make sure she can reach one before choosing it.',
    source: 'Klaster 3 p289 · Pedoman 2020 p63',
  },
  implan: {
    kind: 'tindakan', trainedStaffRequired: true, removalIsAProcedure: true,
    requirement_id: 'Harus dipasang dan dilepas oleh staf terlatih.',
    requirement_en: 'Must be inserted and removed by trained staff.',
    ifUnavailable_id: 'Rujuk ke fasilitas yang punya tenaga terlatih. Pelepasan juga tindakan — pastikan klien punya akses untuk melepasnya nanti, bukan hanya memasangnya.',
    ifUnavailable_en: 'Refer to a facility with trained staff. Removal is a procedure too — make sure she can reach one to have it taken out later, not only put in.',
    source: 'Klaster 3 p289',
  },
  akdr_cu: {
    kind: 'tindakan', trainedStaffRequired: true, removalIsAProcedure: true,
    requirement_id: 'Dipasang oleh staf terlatih. Pascasalin dapat dipasang dalam 48 jam, atau setelah 4 minggu.',
    requirement_en: 'Fitted by trained staff. Postpartum it may be fitted within 48 hours, or after 4 weeks.',
    ifUnavailable_id: 'Rujuk ke fasilitas yang punya tenaga terlatih. Pelepasan juga tindakan.',
    ifUnavailable_en: 'Refer to a facility with trained staff. Removal is a procedure too.',
    source: 'Klaster 3 p289',
  },
  akdr_lng: {
    kind: 'tindakan', trainedStaffRequired: true, removalIsAProcedure: true,
    requirement_id: 'Dipasang dan dilepas oleh staf terlatih.',
    requirement_en: 'Fitted and removed by trained staff.',
    ifUnavailable_id: 'Rujuk ke fasilitas yang punya tenaga terlatih.',
    ifUnavailable_en: 'Refer to a facility with trained staff.',
    source: 'Klaster 3 p289',
  },
  mow: {
    kind: 'khusus', trainedStaffRequired: true, removalIsAProcedure: false,
    requirement_id: 'Kategori S: prosedur harus dilakukan operator berpengalaman, peralatan lengkap, anestesi umum tersedia dengan regimen yang disiapkan.',
    requirement_en: 'Category S: the procedure needs an experienced operator, complete equipment, and general anaesthesia available with a prepared regimen.',
    ifUnavailable_id: 'Rujuk — dan sediakan metode sementara sampai tindakan terlaksana. Permanen: pastikan keputusannya mantap.',
    ifUnavailable_en: 'Refer — and provide a temporary method until it is done. It is permanent: be sure the decision is settled.',
    source: 'Pedoman 2020 p101',
  },
  mop: {
    kind: 'khusus', trainedStaffRequired: true, removalIsAProcedure: false,
    requirement_id: 'Kategori S: prosedur harus dilakukan operator berpengalaman dengan peralatan lengkap.',
    requirement_en: 'Category S: the procedure needs an experienced operator with complete equipment.',
    ifUnavailable_id: 'Rujuk — dan sediakan metode sementara sampai tindakan terlaksana. Permanen: pastikan keputusannya mantap.',
    ifUnavailable_en: 'Refer — and provide a temporary method until it is done. It is permanent: be sure the decision is settled.',
    source: 'Pedoman 2020 p101',
  },
  mal: {
    kind: 'konseling', trainedStaffRequired: false, removalIsAProcedure: false,
    requirement_id: 'Tidak ada yang diberikan — konseling dan syaratnya, serta rencana metode lanjutan.',
    requirement_en: 'Nothing is provided — counselling on its conditions, and a plan for what follows it.',
    ifUnavailable_id: null, ifUnavailable_en: null, source: null,
  },
  sms: {
    kind: 'konseling', trainedStaffRequired: false, removalIsAProcedure: false,
    requirement_id: 'Tidak ada yang diberikan — konseling dan latihan mengenali masa subur.',
    requirement_en: 'Nothing is provided — counselling and learning to recognise the fertile window.',
    ifUnavailable_id: null, ifUnavailable_en: null, source: null,
  },
  kondar: {
    kind: 'serahkan', trainedStaffRequired: false, removalIsAProcedure: false,
    requirement_id: 'Levonorgestrel diserahkan. Bila AKDR tembaga yang dipilih, itu tindakan oleh staf terlatih.',
    requirement_en: 'Levonorgestrel is handed over. If a copper IUD is chosen instead, that is a procedure by trained staff.',
    ifUnavailable_id: null, ifUnavailable_en: null, source: 'Klaster 3 p290',
  },
};

export function provisionRequirement(formulation: unknown): ProvisionRequirement | null {
  const f = kbFormulation(formulation);
  if (!f) return null;
  const r = R[f.code];
  return r ? { formulation: f.code, ...r } : null;
}

/**
 * Can a facility that offers THESE kinds provide it here, or must it refer?
 *
 * `offers` is what the clinic says it does — not something this package
 * decides. There is no facility-level table here on purpose: H1 cites
 * KMK 2015/2023 for the Posyandu / Pustu / Puskesmas differentiation and we
 * do not hold it. A product that told a midwife she was unauthorised for
 * something she is trained and licensed to do, on no authority, would be
 * worse than one that stays quiet.
 *
 * Unknown formulation or untranscribed requirement returns null — "we do not
 * know", never "yes".
 */
export function canProvideHere(
  formulation: unknown,
  offers: readonly ProvisionKind[],
): { here: boolean; requirement: ProvisionRequirement } | null {
  const r = provisionRequirement(formulation);
  if (!r) return null;
  return { here: offers.includes(r.kind), requirement: r };
}

/** Every provision kind, for a clinic to tick what it actually does. */
export const PROVISION_KINDS: readonly ProvisionKind[] =
  ['serahkan', 'suntik', 'tindakan', 'khusus', 'konseling'];

export const PROVISION_LABELS: Record<ProvisionKind, { id: string; en: string }> = {
  serahkan:  { id: 'Diserahkan langsung', en: 'Handed over' },
  suntik:    { id: 'Suntikan', en: 'Injection' },
  tindakan:  { id: 'Tindakan oleh staf terlatih', en: 'Procedure by trained staff' },
  khusus:    { id: 'Tindakan khusus dengan anestesi', en: 'Special procedure with anaesthesia' },
  konseling: { id: 'Konseling saja', en: 'Counselling only' },
};
