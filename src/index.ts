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
