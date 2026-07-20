import { CaseStage } from '@ko/db';
import { caseStageToComplianceAdvanceTarget } from '@ko/utils';
import { prisma } from '../db';

export type ComplianceStage = 'INITIAL_DISCLOSURE' | 'FACT_FIND' | 'RESEARCH' | 'ESIS' | 'SUITABILITY_REPORT';

export const STAGE_SEQUENCE: ComplianceStage[] = [
    'INITIAL_DISCLOSURE',
    'FACT_FIND',
    'RESEARCH',
    'ESIS',
    'SUITABILITY_REPORT'
];

export const COMPLIANCE_TO_CASE_STAGE: Record<ComplianceStage, CaseStage> = {
    INITIAL_DISCLOSURE: 'ENQUIRY',
    FACT_FIND: 'FACT_FIND',
    RESEARCH: 'RESEARCH',
    ESIS: 'DIP',
    SUITABILITY_REPORT: 'OFFER'
};

export const CASE_TO_COMPLIANCE_STAGE: Record<CaseStage, ComplianceStage | null> = {
    ENQUIRY: 'INITIAL_DISCLOSURE',
    FACT_FIND: 'FACT_FIND',
    RESEARCH: 'RESEARCH',
    DIP: 'ESIS',
    OFFER: 'SUITABILITY_REPORT',
    COMPLETION: null,
    ARCHIVED: null
};

export interface ChecklistResult {
    isComplete: boolean;
    missingItems: string[];
}

/**
 * verifyStageChecklist — checks compliance items for the current stage.
 */
export async function verifyStageChecklist(
    caseId: string,
    orgId: string,
    currentStage: ComplianceStage
): Promise<ChecklistResult> {
    const missingItems: string[] = [];

    switch (currentStage) {
        case 'INITIAL_DISCLOSURE': {
            // Initial disclosure document uploaded
            const doc = await prisma.document.findFirst({
                where: {
                    caseId,
                    orgId,
                    documentType: 'COMPLIANCE'
                }
            });
            if (!doc) {
                missingItems.push('Initial disclosure document must be uploaded.');
            }
            break;
        }
        case 'FACT_FIND': {
            // All fact-find sections complete
            const factFind = await prisma.factFind.findFirst({
                where: { caseId }
            });
            if (!factFind || !factFind.completedAt) {
                missingItems.push('Fact-find questionnaire must be completed.');
            }
            break;
        }
        case 'RESEARCH': {
            // Min 3 products considered recorded; selected product confirmed; adviser notes filled.
            const caseRecord = await prisma.case.findFirst({
                where: { id: caseId, orgId },
                include: {
                    productsConsidered: true
                }
            });

            if (!caseRecord) {
                missingItems.push('Case not found.');
                break;
            }

            if (caseRecord.productsConsidered.length < 3) {
                missingItems.push('At least 3 products must be considered and recorded.');
            }

            const hasSelectedProduct = caseRecord.productsConsidered.some(p => p.isSelected) || 
                (caseRecord.selectedProduct && caseRecord.selectedLender);

            if (!hasSelectedProduct) {
                missingItems.push('A selected product must be confirmed.');
            }

            if (!caseRecord.adviserNotes || caseRecord.adviserNotes.trim() === '') {
                missingItems.push('Adviser notes must be completed.');
            }
            break;
        }
        case 'ESIS': {
            // ESIS document uploaded or generated
            const docs = await prisma.document.findMany({
                where: {
                    caseId,
                    orgId,
                    documentType: 'COMPLIANCE'
                }
            });
            const hasEsis = docs.some(d => d.name.toUpperCase().includes('ESIS'));
            if (!hasEsis) {
                missingItems.push('ESIS compliance document must be uploaded or generated.');
            }
            break;
        }
        case 'SUITABILITY_REPORT': {
            // Suitability report status = FINALISED
            const report = await prisma.suitabilityReport.findFirst({
                where: {
                    caseId,
                    status: 'FINALISED'
                }
            });
            if (!report) {
                missingItems.push('Suitability report must be finalised.');
            }
            break;
        }
        default:
            break;
    }

    return {
        isComplete: missingItems.length === 0,
        missingItems
    };
}

/**
 * getNextComplianceStage — returns the next target stage in sequence.
 */
export function getNextComplianceStage(current: ComplianceStage): string | null {
    const idx = STAGE_SEQUENCE.indexOf(current);
    if (idx === -1) return null;
    if (idx === STAGE_SEQUENCE.length - 1) return 'COMPLETION';
    return STAGE_SEQUENCE[idx + 1];
}

/** === FRONTEND ADDITION: map CaseStage advance targets for compliance-data === */
export { caseStageToComplianceAdvanceTarget } from '@ko/utils';
/** @deprecated Use caseStageToComplianceAdvanceTarget from @ko/utils */
export function caseStageToComplianceTarget(
  targetStage: CaseStage,
): ComplianceStage | 'COMPLETION' {
  return caseStageToComplianceAdvanceTarget(targetStage) as ComplianceStage | 'COMPLETION';
}
/** === END FRONTEND ADDITION === */

