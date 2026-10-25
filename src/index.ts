// @sahaibat/anc-engine
// Indonesia's 10T antenatal standard, as executable rules. Pure functions:
// no database, no network, no environment. That is what lets the Bidan app
// score a visit and raise flags with no signal at all.
//
// Imported by BOTH the app and the WhatsApp fallback in sahaibat-healthcare,
// so the two can never disagree about whether a mother is pre-eclamptic.

export { parseAncInit, parseAncData, parsePncInit, calculateBMI } from './parseBidanInput';
export type { ParsedAncInit, ParsedAncData } from './parseBidanInput';

export { score10T } from './score10T';
export type { AncVisitData, QualityResult } from './score10T';

export { generateClinicalFlags, shouldRefer, formatFlagsForWhatsApp } from './clinicalFlags';
export type { ClinicalFlag, AncClinicalInput } from './clinicalFlags';

export { parsePncData } from './parseBidanInput';
export type { ParsedPncData, Severity3 } from './parseBidanInput';

export { generatePncFlags, shouldReferPnc, kfForDay } from './pncFlags';
export type { PncClinicalInput } from './pncFlags';

export { generateDeliveryFlags, shouldReferDelivery, linakes } from './deliveryFlags';
export type {
  DeliveryInput, BabyOutcome, BirthPlace, Attendant, DeliveryMode, BirthOutcome,
} from './deliveryFlags';

export { generateKnFlags, shouldReferKn, knForDay } from './knFlags';
export type { KnInput } from './knFlags';

export { suggestCarePlan, planToFields } from './carePlan';
export type { PlanItem, PlanCategory, CarePlanInput } from './carePlan';

export {
  VACCINE_SCHEDULE, LEGACY_CODE_MAP, DUE_GRACE_DAYS,
  translateLegacy, immunisationStatus, unmatchedGiven, nextDue, immunisationSummary,
} from './immunisation';
export type {
  VaccineCode, VaccineCategory, VaccineProgramme, ScheduledDose,
  GivenDose, DoseState, DoseStatus,
} from './immunisation';

export {
  KB_METHODS, KB_GRACE_DAYS, KBPP_DAYS, KB_END_REASONS,
  kbMethod, isKnownMethod, nextStep, counselledWithoutChoosing,
  dueFor, kbppWindow, kbEndReason, switchedTo,
  // The formulation axis. Medical eligibility keys on hormone content and
  // route; the method codes above key on repeat interval. See contraception.ts.
  KB_FORMULATIONS, kbFormulation, formulationsFor, needsFormulation,
  dueForFormulation, lateDoseNeedsPregnancyCheck,
} from './contraception';
export type {
  KbMethodCode, KbMethodClass, KbMethod, KbEpisodeFacts, KbStep,
  KbDueKind, KbDueState, KbDue, KbppWindow, KbEndReason,
  KbHormone, KbFormulationCode, KbCategoryScale, KbFormulation,
} from './contraception';

/* The conditions each formulation turns on, transcribed from the 2020 Pedoman
   per-method pages, and which of them the record already answers. Assigns no
   category: that needs the category tables, not these prose lists. */
export {
  KB_CONDITIONS, kbCondition, screeningFor, screeningComplete, hasScreening,
} from './kbScreening';
export type {
  KbCondition, KbEvidenceKind, KbKnownFacts, KbScreening, KbScreeningItem,
} from './kbScreening';

/* Starting, continuing and comparing — Klaster 3 p288-290 and the Pedoman.
   Kemenkes has published the operative version of what H1 called the WHO SPR
   layer, so none of this is translated from WHO. */
export {
  startAdvice, missedDose, missedProgestinPill, emergencyContraception,
  followUpSchedule, postpartumRestriction,
  methodFacts, compareMethods, comparableFormulations,
} from './kbPractice';
export type {
  StartAdvice, MissedAction, MissedDoseAdvice, EmergencyAdvice,
  PostpartumVerdict, MethodFacts,
} from './kbPractice';
