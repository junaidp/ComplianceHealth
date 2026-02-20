import { Decimal } from '@prisma/client/runtime/library';

interface ControlScore {
  controlId: string;
  domainNumber: number;
  riskLevel: string;
  answer: string;
  pointsYes: number;
  pointsPartial: number;
  pointsEarned: number;
  weightMultiplier: number;
}

interface DomainScore {
  domainNumber: number;
  domainName: string;
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  controlCount: number;
  gapCount: number;
  partialCount: number;
}

interface ScoreResult {
  overallScore: number;
  totalControlsAssessed: number;
  criticalGaps: number;
  highGaps: number;
  mediumGaps: number;
  lowGaps: number;
  domainScores: DomainScore[];
}

const DOMAIN_NAMES: Record<number, string> = {
  1: 'Governance & Accountability',
  2: 'Lawful Basis & Consent Management',
  3: 'Data Subject Rights Fulfillment',
  4: 'Data Security & Cybersecurity (NCA ECC)',
  5: 'Third-Party & Data Transfer Compliance',
  6: 'Breach Management & Notification',
  7: 'Records & Documentation',
  8: 'Training & Awareness',
  9: 'Sectoral & Special Processing',
  10: 'MoH Health Sector Controls',
};

export function calculateScores(controlScores: ControlScore[]): ScoreResult {
  // Filter out N/A
  const assessed = controlScores.filter(c => c.answer !== 'NA');

  let totalPointsAvailable = 0;
  let totalPointsEarned = 0;
  let criticalGaps = 0;
  let highGaps = 0;
  let mediumGaps = 0;
  let lowGaps = 0;

  const domainMap = new Map<number, {
    totalPoints: number;
    earnedPoints: number;
    controlCount: number;
    gapCount: number;
    partialCount: number;
  }>();

  for (const cs of assessed) {
    const maxPoints = cs.pointsYes * cs.weightMultiplier;
    const earned = cs.pointsEarned * cs.weightMultiplier;

    totalPointsAvailable += maxPoints;
    totalPointsEarned += earned;

    // Count gaps
    if (cs.answer === 'NO') {
      switch (cs.riskLevel) {
        case 'CRITICAL': criticalGaps++; break;
        case 'HIGH': highGaps++; break;
        case 'MEDIUM': mediumGaps++; break;
        case 'LOW': lowGaps++; break;
      }
    }

    // Domain scores
    if (!domainMap.has(cs.domainNumber)) {
      domainMap.set(cs.domainNumber, {
        totalPoints: 0, earnedPoints: 0, controlCount: 0, gapCount: 0, partialCount: 0,
      });
    }
    const domain = domainMap.get(cs.domainNumber)!;
    domain.totalPoints += maxPoints;
    domain.earnedPoints += earned;
    domain.controlCount++;
    if (cs.answer === 'NO') domain.gapCount++;
    if (cs.answer === 'PARTIAL') domain.partialCount++;
  }

  const domainScores: DomainScore[] = [];
  for (const [num, data] of domainMap.entries()) {
    domainScores.push({
      domainNumber: num,
      domainName: DOMAIN_NAMES[num] || `Domain ${num}`,
      totalPoints: data.totalPoints,
      earnedPoints: data.earnedPoints,
      percentage: data.totalPoints > 0 ? Math.round((data.earnedPoints / data.totalPoints) * 10000) / 100 : 0,
      controlCount: data.controlCount,
      gapCount: data.gapCount,
      partialCount: data.partialCount,
    });
  }

  domainScores.sort((a, b) => a.domainNumber - b.domainNumber);

  const overallScore = totalPointsAvailable > 0
    ? Math.round((totalPointsEarned / totalPointsAvailable) * 10000) / 100
    : 0;

  return {
    overallScore,
    totalControlsAssessed: assessed.length,
    criticalGaps,
    highGaps,
    mediumGaps,
    lowGaps,
    domainScores,
  };
}

export function getPointsForAnswer(answer: string, pointsYes: number, pointsPartial: number): number {
  switch (answer) {
    case 'YES': return pointsYes;
    case 'PARTIAL': return pointsPartial;
    case 'NO': return 0;
    case 'NA': return 0;
    default: return 0;
  }
}

export function getDefaultDeadlineDays(riskLevel: string): number {
  switch (riskLevel) {
    case 'CRITICAL': return 30;
    case 'HIGH': return 60;
    case 'MEDIUM': return 90;
    case 'LOW': return 180;
    default: return 90;
  }
}
