interface OrgProfile {
  orgType: string;
  processesMinors: boolean;
  crossBorderTransfers: boolean;
  usesCloud: string;
  conductsResearch: boolean;
  usesAiOrAutomatedDecisions: boolean;
  continuousMonitoring: boolean;
}

interface BranchingResult {
  activatedControls: string[];
  naControls: string[];
}

const HEALTH_ORG_TYPES = [
  'government_hospital', 'private_hospital', 'clinic_small',
  'clinic_large', 'insurer', 'pharma', 'health_tech'
];

export function evaluateBranchingRules(profile: OrgProfile): BranchingResult {
  const activated: Set<string> = new Set();
  const naControls: Set<string> = new Set();

  // Rule 1: processes_minors = TRUE
  if (profile.processesMinors) {
    ['PDPL-G.10', 'PDPL-R.10'].forEach(c => activated.add(c));
  }

  // Rule 2: cross_border_transfers = TRUE
  if (profile.crossBorderTransfers) {
    ['PDPL-T.5', 'PDPL-T.6', 'PDPL-T.7', 'PDPL-T.8', 'PDPL-T.9', 'HS-PDPL-013', 'NCA-D4.R2'].forEach(c => activated.add(c));
  }

  // Rule 3: cross_border_transfers = FALSE → transfer controls N/A
  if (!profile.crossBorderTransfers) {
    ['PDPL-T.5', 'PDPL-T.6', 'PDPL-T.7', 'PDPL-T.8', 'PDPL-T.9', 'HS-PDPL-013'].forEach(c => naControls.add(c));
  }

  // Rule 4: All health orgs → mandatory controls
  if (HEALTH_ORG_TYPES.includes(profile.orgType)) {
    ['PDPL-C.1', 'HS-PDPL-001', 'HS-PDPL-002', 'HS-PDPL-003', 'PDPL-G.1'].forEach(c => activated.add(c));
  }

  // Rule 5: uses_cloud = YES or PARTIALLY
  if (profile.usesCloud === 'yes' || profile.usesCloud === 'partial') {
    ['PDPL-T.2', 'NCA-D4.R2'].forEach(c => activated.add(c));
  }

  // Rule 6: uses_ai_or_automated_decisions = TRUE
  if (profile.usesAiOrAutomatedDecisions) {
    ['PDPL-G.3', 'HS-PDPL-020'].forEach(c => activated.add(c));
  }

  // Rule 7 is evaluated during assessment (G.3 answered NO → cascade gaps)

  return {
    activatedControls: Array.from(activated),
    naControls: Array.from(naControls),
  };
}

export function isControlApplicable(
  controlId: string,
  conditionalOn: any,
  profile: OrgProfile,
  branchingResult: BranchingResult
): boolean {
  // If control is in N/A list, it's not applicable
  if (branchingResult.naControls.includes(controlId)) {
    return false;
  }

  // If control has conditional requirements, check them
  if (conditionalOn && typeof conditionalOn === 'object') {
    for (const [key, value] of Object.entries(conditionalOn)) {
      const profileValue = (profile as any)[key];
      if (profileValue !== value) {
        return false;
      }
    }
  }

  return true;
}

export function isHealthOrg(orgType: string): boolean {
  return HEALTH_ORG_TYPES.includes(orgType);
}
