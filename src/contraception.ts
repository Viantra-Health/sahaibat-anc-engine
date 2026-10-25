// @sahaibat/anc-engine · src/contraception.ts
//
// KELUARGA BERENCANA, AS DATES AND STATES.
//
// Sanjib, 21 Oct 2026, choosing what makes KB smarter than a form: "Method-
// aware due dates". So this file does that and deliberately little else.
//
// ── WHAT IS HERE: ARITHMETIC ON A METHOD AND A DATE ─────────────────────────
//
// When the next injection falls due. When a refill runs out. When a device
// reaches the end of the life its clinician recorded for it. When the
// postpartum window closes. All of it derivable, none of it a judgement.
//
// ── WHAT IS NOT HERE: ELIGIBILITY ───────────────────────────────────────────
//
// WHO's Medical Eligibility Criteria, and the Roda KLOP wheel Indonesian
// training uses, classify a method for a patient as category 1 to 4. That is
// clinical advice -- "the risks generally outweigh the advantages for this
// woman" -- and this package only encodes clinical rules a clinician has signed
// off. The ANC, PNC and KN engines in this repository were reviewed by
// dr. Rathi; nothing about contraceptive eligibility has been. So there is no
// mecCategory() function, and adding one is a separate decision with a named
// reviewer, not a commit.
//
// ── THE FOUR STATES ARE FOUR, NOT ONE ───────────────────────────────────────
//
// From the research note: "counselling completed, method selected, method
// provided and follow-up scheduled are different states. They should never be
// merged into a single checkbox."
//
// They are not a progression either -- a woman can be counselled and choose
// nothing, or accept a method and never return for the review. So they are four
// independent facts, and nextStep() reads them rather than a status column that
// would force them into a line.
//
// ── A DEVICE WITH NO RECORDED LIFE HAS NO EXPIRY ────────────────────────────
//
// An implant lasts three years or five depending on the product; a copper IUD
// and a hormonal one differ by years. This file will NOT pick a number. The
// clinician records the life at insertion and the arithmetic follows; without
// it, dueFor() returns a 'duration_unknown' reason and no date. Guessing would
// put a removal reminder on a date nobody chose, and a device removed years
// early or left years late is the exact harm the reminder exists to prevent.

/** A method as the record stores it. */
export type KbMethodCode =
  | 'pil'        // oral contraceptive
  | 'suntik_1'   // monthly injectable
  | 'suntik_3'   // three-monthly injectable
  | 'implan'     // subdermal implant
  | 'akdr'       // IUD / intrauterine device
  | 'kondom'
  | 'mal'        // lactational amenorrhoea
  | 'mow'        // female sterilisation
  | 'mop'        // male sterilisation
  | 'lainnya';

export type KbMethodClass =
  | 'short'        // needs repeating on a cycle
  | 'long'         // a device with a life
  | 'barrier'      // per act
  | 'behavioural'  // conditional on circumstance
  | 'permanent';

export interface KbMethod {
  code: KbMethodCode;
  label_id: string;
  label_en: string;
  klass: KbMethodClass;
  /** Days until the next dose or refill. Null when the method does not repeat. */
  repeat_days: number | null;
  /** True when a device is placed and its life must be recorded at insertion. */
  device: boolean;
  /** True when ending the method is itself a procedure. */
  removal_is_a_procedure: boolean;
  /**
   * Days after which the method must be REVIEWED rather than repeated.
   * Lactational amenorrhoea stops being reliable; it is not a refill.
   */
  review_days?: number;
}

/**
 * The methods a clinic or a midwife actually provides here.
 *
 * ⚠ THE INTERVALS ARE PROGRAMME PRACTICE, NOT A SIGNED CLINICAL RULE. A
 * monthly injectable at 30 days and a three-monthly at 90 are the standard
 * Indonesian schedules, and a pill cycle is 28 tablets. They have NOT had the
 * review dr. Rathi gave the ANC, PNC and KN engines, and the grace window below
 * is this file's own choice.
 */
export const KB_METHODS: readonly KbMethod[] = [
  { code: 'pil',      label_id: 'Pil KB',              label_en: 'Oral contraceptive pill', klass: 'short',       repeat_days: 28, device: false, removal_is_a_procedure: false },
  { code: 'suntik_1', label_id: 'Suntik 1 bulan',      label_en: 'Monthly injectable',      klass: 'short',       repeat_days: 30, device: false, removal_is_a_procedure: false },
  { code: 'suntik_3', label_id: 'Suntik 3 bulan',      label_en: 'Three-monthly injectable',klass: 'short',       repeat_days: 90, device: false, removal_is_a_procedure: false },
  { code: 'implan',   label_id: 'Implan',              label_en: 'Implant',                 klass: 'long',        repeat_days: null, device: true,  removal_is_a_procedure: true },
  { code: 'akdr',     label_id: 'AKDR (IUD)',          label_en: 'IUD',                     klass: 'long',        repeat_days: null, device: true,  removal_is_a_procedure: true },
  { code: 'kondom',   label_id: 'Kondom',              label_en: 'Condom',                  klass: 'barrier',     repeat_days: null, device: false, removal_is_a_procedure: false },
  /* Reliable only while fully breastfeeding and amenorrhoeic, and only for the
     first months -- so it gets a REVIEW date, not a refill date. Treating it as
     a repeating method would quietly leave a woman counted as protected. */
  { code: 'mal',      label_id: 'MAL (menyusui)',      label_en: 'Lactational amenorrhoea', klass: 'behavioural', repeat_days: null, device: false, removal_is_a_procedure: false, review_days: 180 },
  { code: 'mow',      label_id: 'MOW (tubektomi)',     label_en: 'Female sterilisation',    klass: 'permanent',   repeat_days: null, device: false, removal_is_a_procedure: false },
  { code: 'mop',      label_id: 'MOP (vasektomi)',     label_en: 'Male sterilisation',      klass: 'permanent',   repeat_days: null, device: false, removal_is_a_procedure: false },
  /* An unknown method is KEPT, never dropped, and simply yields no due date.
     A record that says "something, we are not sure what" is worth more than a
     blank, and the next clinician can ask. */
  { code: 'lainnya',  label_id: 'Lainnya',             label_en: 'Other',                   klass: 'short',       repeat_days: null, device: false, removal_is_a_procedure: false },
];

export function kbMethod(code: unknown): KbMethod {
  const s = String(code ?? '').trim().toLowerCase();
  return KB_METHODS.find((m) => m.code === s) ?? KB_METHODS[KB_METHODS.length - 1];
}

/** Does this code name a method we recognise? Distinct from falling back. */
export function isKnownMethod(code: unknown): boolean {
  const s = String(code ?? '').trim().toLowerCase();
  return KB_METHODS.some((m) => m.code === s);
}

/* ── THE FOUR STATES ────────────────────────────────────────────────────── */

export interface KbEpisodeFacts {
  /** Counselling happened. True on its own -- a woman may choose nothing. */
  counselled_at?: string | null;
  /** She chose a method. Not the same as receiving it. */
  method_code?: string | null;
  selected_at?: string | null;
  /** It was actually provided: pills dispensed, injection given, device placed. */
  provided_at?: string | null;
  /** The life of the device as the clinician recorded it, in months. */
  device_months?: number | null;
  /** A follow-up has been put in the diary. */
  follow_up_due?: string | null;
  /** The episode is over. */
  ended_at?: string | null;
  end_reason?: string | null;
}

export type KbStep =
  | 'counsel'              // nothing recorded yet
  | 'select'               // counselled, no method chosen
  | 'provide'              // chosen, not yet given
  | 'schedule_follow_up'   // given, nothing in the diary
  | 'complete'             // all four facts present
  | 'ended';               // this episode is closed

/**
 * What is missing from this episode.
 *
 * Reads the four facts rather than a status column. The order below is the usual
 * order of events, but each fact is checked on its own -- a method provided with
 * no counselling recorded reports 'schedule_follow_up', not 'counsel', because
 * going back to ask for a tick would be worse than noting the gap.
 */
export function nextStep(e: KbEpisodeFacts): KbStep {
  if (e.ended_at) return 'ended';
  if (e.provided_at) return e.follow_up_due ? 'complete' : 'schedule_follow_up';
  if (e.method_code && e.selected_at) return 'provide';
  if (e.counselled_at) return 'select';
  return 'counsel';
}

/**
 * Counselled, and chose nothing. A real and reportable outcome.
 *
 * Separated because it is invisible in any model that treats counselling as
 * step one of acceptance: a woman who was counselled a month ago and selected
 * nothing is somebody to follow up, not an unfinished form.
 */
export function counselledWithoutChoosing(e: KbEpisodeFacts): boolean {
  return !!e.counselled_at && !e.selected_at && !e.provided_at && !e.ended_at;
}

/* ── WHEN THE NEXT THING IS DUE ─────────────────────────────────────────── */

export type KbDueKind =
  | 'refill'          // pills run out
  | 'injection'       // the next injection
  | 'device_expiry'   // the device reaches the end of its recorded life
  | 'review'          // the method must be reconsidered, not repeated
  | 'none';           // nothing recurs

export type KbDueState = 'not_yet' | 'due' | 'overdue' | 'unknown';

export interface KbDue {
  kind: KbDueKind;
  state: KbDueState;
  due_date: string | null;
  days_from_due: number | null;
  /** Why there is no date, when there is none. */
  reason?: 'no_service_date' | 'duration_unknown' | 'method_not_recurring' | 'method_unknown' | 'ended';
}

/**
 * How long after the due day something is still 'due' rather than 'overdue'.
 *
 * Fourteen days, and it is a presentation choice rather than a clinical one.
 * An injectable has its own clinical late window which is NOT this number and
 * is not encoded here -- a woman past her window may need a pregnancy check
 * before the next dose, and that is a judgement this file does not make.
 */
export const KB_GRACE_DAYS = 14;

const DAY = 86_400_000;

function asDate(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return Number.isNaN(Date.parse(s.slice(0, 10))) ? null : s.slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY).toISOString().slice(0, 10);
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  /* 31 January plus one month is 28 February, not 3 March. Without this a
     device inserted on the 31st drifts a few days later every time its expiry
     is recomputed. */
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

function stateFor(due: string, today: string): { state: KbDueState; days: number } {
  const days = Math.round((Date.parse(today) - Date.parse(due)) / DAY);
  return { state: days < 0 ? 'not_yet' : days <= KB_GRACE_DAYS ? 'due' : 'overdue', days };
}

/**
 * The next thing this episode owes, and when.
 *
 * `from` is the date the method was last provided -- the injection given, the
 * pills dispensed, the device inserted. Without it nothing can be dated, and
 * that is reported as a reason rather than as 'not due'.
 */
export function dueFor(
  e: KbEpisodeFacts,
  today: string | Date = new Date(),
): KbDue {
  const now = asDate(typeof today === 'string' ? today : today.toISOString())
    ?? new Date().toISOString().slice(0, 10);

  if (e.ended_at) return { kind: 'none', state: 'unknown', due_date: null, days_from_due: null, reason: 'ended' };

  const from = asDate(e.provided_at);
  if (!from) return { kind: 'none', state: 'unknown', due_date: null, days_from_due: null, reason: 'no_service_date' };

  if (!isKnownMethod(e.method_code)) {
    return { kind: 'none', state: 'unknown', due_date: null, days_from_due: null, reason: 'method_unknown' };
  }
  const m = kbMethod(e.method_code);

  // A device: its life, as recorded. Never assumed.
  if (m.device) {
    const months = Number(e.device_months);
    if (!Number.isFinite(months) || months <= 0) {
      return {
        kind: 'device_expiry', state: 'unknown', due_date: null, days_from_due: null,
        reason: 'duration_unknown',
      };
    }
    const due = addMonths(from, Math.round(months));
    const { state, days } = stateFor(due, now);
    return { kind: 'device_expiry', state, due_date: due, days_from_due: days };
  }

  // A method that must be reconsidered rather than repeated.
  if (m.review_days) {
    const due = addDays(from, m.review_days);
    const { state, days } = stateFor(due, now);
    return { kind: 'review', state, due_date: due, days_from_due: days };
  }

  if (m.repeat_days) {
    const due = addDays(from, m.repeat_days);
    const { state, days } = stateFor(due, now);
    return { kind: m.code === 'pil' ? 'refill' : 'injection', state, due_date: due, days_from_due: days };
  }

  return {
    kind: 'none', state: 'unknown', due_date: null, days_from_due: null,
    reason: 'method_not_recurring',
  };
}

/* ── KB PASCA PERSALINAN ────────────────────────────────────────────────── */

/**
 * The postpartum family-planning window.
 *
 * Indonesian programme materials define KBPP as contraception started within
 * 42 days of delivery, which is the number used here and the only one.
 *
 * IT IS A PROMPT, NOT A DEADLINE. A woman who starts on day 50 has still
 * started; what closes on day 42 is the programme's definition of postpartum
 * initiation, not her opportunity. So `state` says 'closed', never 'missed'.
 */
export const KBPP_DAYS = 42;

export interface KbppWindow {
  delivery_date: string;
  closes_on: string;
  day: number;
  state: 'open' | 'closing' | 'closed';
}

export function kbppWindow(
  deliveryDate: string | null | undefined,
  today: string | Date = new Date(),
): KbppWindow | null {
  const d = asDate(deliveryDate);
  if (!d) return null;
  const now = asDate(typeof today === 'string' ? today : today.toISOString())
    ?? new Date().toISOString().slice(0, 10);
  const day = Math.round((Date.parse(now) - Date.parse(d)) / DAY);
  const closes = addDays(d, KBPP_DAYS);
  /* 'closing' from a week out, because counselling takes a visit to arrange and
     a window that only announces itself on the last day announces nothing. */
  const state: KbppWindow['state'] =
    day > KBPP_DAYS ? 'closed' : day >= KBPP_DAYS - 7 ? 'closing' : 'open';
  return { delivery_date: d, closes_on: closes, day, state };
}

/* ── SWITCHING ──────────────────────────────────────────────────────────── */

/**
 * Why an episode ended. A growing vocabulary, so no CHECK anywhere.
 *
 * 'ganti_cara' is the one that matters: a woman who stops an injectable and
 * chooses an implant has TWO episodes and a reason joining them, and a model
 * that overwrote her method would lose the fact that she switched and why --
 * which is exactly the pattern worth reading back later.
 */
export const KB_END_REASONS = [
  'ganti_cara',      // switched to another method
  'efek_samping',    // side effects
  'ingin_hamil',     // wants to conceive
  'habis_masa',      // the device reached the end of its life
  'dilepas_medis',   // removed on medical grounds
  'tidak_lanjut',    // stopped coming
  'menopause',
  'lainnya',
] as const;
export type KbEndReason = typeof KB_END_REASONS[number];

export function kbEndReason(v: unknown): KbEndReason {
  const s = String(v ?? '').trim().toLowerCase();
  return (KB_END_REASONS as readonly string[]).includes(s) ? (s as KbEndReason) : 'lainnya';
}

/**
 * Did she switch, rather than stop?
 *
 * Reads the pair: this episode ended for 'ganti_cara' AND another episode
 * starts on or after it. The reason alone is a claim; the next episode is the
 * evidence. An episode marked 'ganti_cara' with nothing following it is a woman
 * who meant to switch and did not, which is a follow-up and not a switch.
 */
export function switchedTo(
  ended: KbEpisodeFacts,
  episodes: readonly KbEpisodeFacts[],
): KbEpisodeFacts | null {
  if (kbEndReason(ended.end_reason) !== 'ganti_cara') return null;
  const end = asDate(ended.ended_at);
  if (!end) return null;
  const after = episodes
    .filter((e) => e !== ended)
    .filter((e) => {
      const started = asDate(e.provided_at) ?? asDate(e.selected_at);
      return started != null && started >= end;
    })
    .sort((a, b) => {
      const sa = asDate(a.provided_at) ?? asDate(a.selected_at) ?? '';
      const sb = asDate(b.provided_at) ?? asDate(b.selected_at) ?? '';
      return sa < sb ? -1 : 1;
    });
  return after[0] ?? null;
}

/* ── FORMULASI: THE AXIS MEC ACTUALLY SCORES ON ─────────────────────────────
 *
 * KbMethodCode above answers "when is the next dose due", so it keys on the
 * REPEAT INTERVAL. Medical eligibility keys on something else entirely --
 * hormone content and route -- and the two axes do not line up:
 *
 *   `pil`      is one code and Kemenkes has TWO eligibility lists, KPK and KPP
 *   `akdr`     is one code and Kemenkes has TWO, Copper and LNG
 *   `suntik_3` is a 90-day interval; DMPA is 90 days and NET-EN is 60, and
 *              both are progestin injectables with DIFFERENT late windows
 *
 * So a category attached to `pil` would have to pick one answer for two drugs
 * with different safety profiles, and whichever it picked would be wrong half
 * the time -- wearing a number that reads as authoritative.
 *
 * This is NOT a replacement vocabulary. The method codes stay exactly as they
 * are, dueFor() is untouched, and every formulation names the method it
 * belongs to. What this adds is the second axis, so a rule table has something
 * addressable to hang off.
 *
 * ── SOURCE ─────────────────────────────────────────────────────────────────
 *
 * The names and the splits are Kemenkes' own, from Pedoman Pelayanan
 * Kontrasepsi dan Keluarga Berencana (Direktorat Kesehatan Keluarga, 2020):
 * AKDR Copper p42, AKDR-LNG p47, Implan p53, KSK p57, KSP p63, KPK p69,
 * KPP p75, Kondom p80. Not invented here and not translated from WHO.
 *
 * TWO METHODS HAD NO CODE AT ALL and are added as formulations whose method is
 * 'lainnya' until the method list itself grows: emergency contraception, which
 * Kemenkes covers and which Klaster 3 p290 gives real dosing for, and
 * fertility awareness, which the Pedoman p101 scores on its own A/C/D scale.
 */

export type KbHormone =
  | 'kombinasi'     // estrogen + progestin -- what most MEC 3 and 4 turn on
  | 'progestin'
  | 'non_hormonal';

export type KbFormulationCode =
  | 'kpk'          // Kontrasepsi Pil Kombinasi
  | 'kpp'          // Kontrasepsi Pil Progestin
  | 'ksk'          // Kontrasepsi Suntik Kombinasi
  | 'ksp_dmpa'     // Suntik Progestin, DMPA, 3-monthly
  | 'ksp_neten'    // Suntik Progestin, NET-EN, 2-monthly
  | 'implan'
  | 'akdr_cu'      // AKDR Copper
  | 'akdr_lng'     // AKDR levonorgestrel
  | 'kondom_pria'
  | 'kondom_wanita'
  | 'mal'
  | 'sms'          // Sadar Masa Subur / metode kalender
  | 'mow'
  | 'mop'
  | 'kondar';      // Kontrasepsi Darurat

/**
 * Which category scale a formulation is scored on.
 *
 * Pedoman p101 is explicit that 1-4 does not apply to everything. Fertility
 * awareness uses Accept / Caution / Delay, and the permanent methods add
 * Special -- an experienced operator, full equipment and anaesthesia available.
 * A single `category` column would be wrong for three of these.
 */
export type KbCategoryScale =
  | 'mec_1_4'
  | 'acd'          // A / C / D
  | 'acds';        // A / C / D / S

export interface KbFormulation {
  code: KbFormulationCode;
  /** The method code this belongs to. dueFor() still reads the method. */
  method: KbMethodCode;
  label_id: string;
  label_en: string;
  hormone: KbHormone;
  scale: KbCategoryScale;
  /**
   * Days before the next dose, where it differs from the method's own.
   *
   * NET-EN is the reason this exists: it shares `suntik_3` with DMPA and
   * repeats at 60 days rather than 90.
   */
  repeat_days?: number | null;
  /**
   * How late she can be and still simply be given the dose.
   *
   * Klaster 3 p290: 2 weeks for NET-EN, 4 weeks for DMPA. Past it, pregnancy
   * is checked first. NOTE FOR WHOEVER VERIFIES THE TRANSCRIPTION: the first
   * bullet on that page reads "< 2 minggu (NET-EN) atau > 4 minggu (DMPA)",
   * where the second comparator must be "<" for the sentence to mean anything.
   * The two thresholds are consistent across both bullets and are what is
   * encoded; the stray ">" is recorded here rather than silently corrected.
   */
  late_window_days?: number | null;
  /** Page in the 2020 Pedoman carrying this formulation's eligibility list. */
  source_page?: number | null;
}

export const KB_FORMULATIONS: readonly KbFormulation[] = [
  { code: 'kpk',        method: 'pil',      label_id: 'Pil Kombinasi (KPK)',        label_en: 'Combined oral pill',        hormone: 'kombinasi',    scale: 'mec_1_4', repeat_days: 28, source_page: 69 },
  { code: 'kpp',        method: 'pil',      label_id: 'Pil Progestin (KPP)',        label_en: 'Progestin-only pill',       hormone: 'progestin',    scale: 'mec_1_4', repeat_days: 28, source_page: 75 },
  { code: 'ksk',        method: 'suntik_1', label_id: 'Suntik Kombinasi (KSK)',     label_en: 'Combined injectable',       hormone: 'kombinasi',    scale: 'mec_1_4', repeat_days: 30, source_page: 57 },
  /* ── 84 AND 56, NOT 90 AND 60 ──────────────────────────────────────────
     Corrected 24 Oct 2026. These were first encoded as 90 and 60 from the
     Pedoman p62, which states the schedule in MONTHS: DMPA "setiap 3 bulan",
     NET-EN "setiap 2 bulan". Klaster 3 p289 states the same schedule in WEEKS
     and with the dose -- DMPA IM 150 mg 12 mingguan, NET-EN IM 200 mg 8
     mingguan -- and weeks is what a dose interval actually is.

     The difference is not pedantry. "Three months" is 89, 90, 91 or 92 days
     depending on which month she was injected in, so a due date computed from
     it drifts by up to six days across a year; twelve weeks is 84 days
     always. The late windows on p290 (2 weeks NET-EN, 4 weeks DMPA) are
     stated against the weekly schedule and only line up with it.

     KB_METHODS.suntik_3 KEEPS 90. That is the method-level approximation the
     programme itself uses when it says "suntik 3 bulan", every existing
     episode was computed against it, and changing it would silently move
     every historical due date. The precise interval belongs on the
     formulation -- which is what this axis is for. */
  { code: 'ksp_dmpa',   method: 'suntik_3', label_id: 'Suntik Progestin DMPA',      label_en: 'DMPA injectable',           hormone: 'progestin',    scale: 'mec_1_4', repeat_days: 84, late_window_days: 28, source_page: 63 },
  { code: 'ksp_neten',  method: 'suntik_3', label_id: 'Suntik Progestin NET-EN',    label_en: 'NET-EN injectable',         hormone: 'progestin',    scale: 'mec_1_4', repeat_days: 56, late_window_days: 14, source_page: 63 },
  { code: 'implan',     method: 'implan',   label_id: 'Implan',                     label_en: 'Implant',                   hormone: 'progestin',    scale: 'mec_1_4', source_page: 53 },
  { code: 'akdr_cu',    method: 'akdr',     label_id: 'AKDR Copper',                label_en: 'Copper IUD',                hormone: 'non_hormonal', scale: 'mec_1_4', source_page: 42 },
  { code: 'akdr_lng',   method: 'akdr',     label_id: 'AKDR-LNG',                   label_en: 'Levonorgestrel IUS',        hormone: 'progestin',    scale: 'mec_1_4', source_page: 47 },
  { code: 'kondom_pria',   method: 'kondom', label_id: 'Kondom laki-laki',          label_en: 'Male condom',               hormone: 'non_hormonal', scale: 'mec_1_4', source_page: 80 },
  { code: 'kondom_wanita', method: 'kondom', label_id: 'Kondom perempuan',          label_en: 'Female condom',             hormone: 'non_hormonal', scale: 'mec_1_4', source_page: 81 },
  { code: 'mal',        method: 'mal',      label_id: 'MAL (Metode Amenore Laktasi)', label_en: 'Lactational amenorrhoea', hormone: 'non_hormonal', scale: 'mec_1_4' },
  /* Its own scale, per Pedoman p101: no medical condition is worsened by
     knowing when you are fertile, so the question is whether the method can be
     used accurately rather than safely. */
  { code: 'sms',        method: 'lainnya',  label_id: 'Sadar Masa Subur',           label_en: 'Fertility awareness',       hormone: 'non_hormonal', scale: 'acd' },
  { code: 'mow',        method: 'mow',      label_id: 'MOW (Tubektomi)',            label_en: 'Female sterilisation',      hormone: 'non_hormonal', scale: 'acds' },
  { code: 'mop',        method: 'mop',      label_id: 'MOP (Vasektomi)',            label_en: 'Male sterilisation',        hormone: 'non_hormonal', scale: 'acds' },
  /* Not a continuing method and so not an episode in the usual sense. Carried
     here because Kemenkes covers it, Klaster 3 p290 doses it, and a product
     that cannot record it cannot record the visit where it mattered most. */
  { code: 'kondar',     method: 'lainnya',  label_id: 'Kontrasepsi Darurat',        label_en: 'Emergency contraception',   hormone: 'progestin',    scale: 'mec_1_4' },
];

export function kbFormulation(code: unknown): KbFormulation | null {
  const s = String(code ?? '').trim().toLowerCase();
  return KB_FORMULATIONS.find((f) => f.code === s) ?? null;
}

/** Every formulation belonging to a method code. Empty for an unknown method. */
export function formulationsFor(method: unknown): readonly KbFormulation[] {
  const s = String(method ?? '').trim().toLowerCase();
  return KB_FORMULATIONS.filter((f) => f.method === s);
}

/**
 * Does this method need the clinician to say WHICH formulation?
 *
 * True only where the choice changes an answer: two eligibility lists, or two
 * repeat intervals. `implan` returns false -- Kemenkes publishes one list for
 * it -- which is why this reads the table rather than counting products.
 */
export function needsFormulation(method: unknown): boolean {
  return formulationsFor(method).length > 1;
}

/**
 * When the next dose is due, for a formulation rather than a method.
 *
 * The ONE case the method-level dueFor() cannot answer: a woman on NET-EN is
 * due at 60 days and `suntik_3` says 90. Answering her from the method code
 * would tell her she is a month early when she is on time.
 *
 * Falls through to dueFor() whenever the formulation adds nothing, so there is
 * one implementation of the arithmetic and not two.
 */
export function dueForFormulation(
  e: KbEpisodeFacts,
  formulation: unknown,
  today: string | Date = new Date(),
): KbDue {
  const base = dueFor(e, today);
  const f = kbFormulation(formulation);
  if (!f || f.repeat_days == null) return base;

  // Only a REPEATING method with a different interval needs overriding. A
  // device, a review method or an undatable episode is already answered.
  const m = kbMethod(e.method_code);
  if (m.device || m.review_days || !m.repeat_days) return base;
  if (m.repeat_days === f.repeat_days) return base;
  if (base.due_date == null) return base;

  return dueForOverride(e, f, today);
}

function dueForOverride(e: KbEpisodeFacts, f: KbFormulation, today: string | Date): KbDue {
  const now = asDate(typeof today === 'string' ? today : today.toISOString())
    ?? new Date().toISOString().slice(0, 10);
  const from = asDate(e.provided_at);
  if (!from) return { kind: 'none', state: 'unknown', due_date: null, days_from_due: null, reason: 'no_service_date' };
  const due = addDays(from, f.repeat_days as number);
  const { state, days } = stateFor(due, now);
  return { kind: f.method === 'pil' ? 'refill' : 'injection', state, due_date: due, days_from_due: days };
}

/**
 * Is she late enough that pregnancy must be excluded before the next dose?
 *
 * Klaster 3 p288-290. Null where the formulation has no published window --
 * which is most of them, and is not the same as "she is fine".
 */
export function lateDoseNeedsPregnancyCheck(
  e: KbEpisodeFacts,
  formulation: unknown,
  today: string | Date = new Date(),
): boolean | null {
  const f = kbFormulation(formulation);
  if (!f || f.late_window_days == null) return null;
  const due = dueForFormulation(e, formulation, today);
  if (due.due_date == null || due.days_from_due == null) return null;
  return due.days_from_due > f.late_window_days;
}
