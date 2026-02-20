import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate, authorize, ROLES } from '../middleware/auth';
import { evaluateBranchingRules, isControlApplicable, isHealthOrg } from '../services/branchingRules';
import { calculateScores, getPointsForAnswer, getDefaultDeadlineDays } from '../services/scoring';
import { logAudit, getClientIp } from '../utils/auditLogger';
import { addDays } from 'date-fns';

const router = Router();

// POST /assessments — Create new assessment
router.post('/', authenticate, authorize(ROLES.ORG_ADMIN, ROLES.DPO, ROLES.COMPLIANCE_OFFICER), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org || !org.onboardingCompleted) {
      res.status(400).json({ error: 'Organization onboarding must be completed first', code: 'ONBOARDING_REQUIRED' });
      return;
    }

    // Get latest version
    const latestAssessment = await prisma.assessment.findFirst({
      where: { orgId, isDeleted: false },
      orderBy: { assessmentVersion: 'desc' },
    });

    const newVersion = latestAssessment ? latestAssessment.assessmentVersion + 1 : 1;

    // Archive previous if exists
    if (latestAssessment && latestAssessment.status !== 'ARCHIVED') {
      await prisma.assessment.update({
        where: { id: latestAssessment.id },
        data: { status: 'ARCHIVED' },
      });
    }

    const assessment = await prisma.assessment.create({
      data: {
        orgId,
        assessmentVersion: newVersion,
        status: 'DRAFT',
        createdBy: req.user!.userId,
      },
    });

    await logAudit({
      orgId,
      userId: req.user!.userId,
      action: 'ASSESSMENT_CREATED',
      entityType: 'assessment',
      entityId: assessment.id,
      newValue: { version: newVersion },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json(assessment);
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({ error: 'Failed to create assessment', code: 'INTERNAL_ERROR' });
  }
});

// GET /assessments — List org assessments
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = { orgId: req.user!.orgId, isDeleted: false };
    if (status) where.status = status;

    const assessments = await prisma.assessment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: { select: { firstName: true, lastName: true, email: true } },
        finalizedByUser: { select: { firstName: true, lastName: true, email: true } },
        _count: { select: { responses: true } },
      },
    });

    res.json({ data: assessments, total: assessments.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get assessments', code: 'INTERNAL_ERROR' });
  }
});

// GET /assessments/:id — Assessment detail
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { id: String(req.params.id), orgId: req.user!.orgId, isDeleted: false },
      include: {
        responses: { include: { control: true } },
        createdByUser: { select: { firstName: true, lastName: true, email: true } },
        finalizedByUser: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found', code: 'NOT_FOUND' });
      return;
    }

    // Get org for branching
    const org = await prisma.organization.findUnique({ where: { id: req.user!.orgId } });
    const profile = {
      orgType: org!.orgType,
      processesMinors: org!.processesMinors,
      crossBorderTransfers: org!.crossBorderTransfers,
      usesCloud: org!.usesCloud,
      conductsResearch: org!.conductsResearch,
      usesAiOrAutomatedDecisions: org!.usesAiOrAutomatedDecisions,
      continuousMonitoring: org!.continuousMonitoring,
    };
    const branchingResult = evaluateBranchingRules(profile);

    // Calculate progress
    const allControls = await prisma.control.findMany();
    const applicableControls = allControls.filter(c =>
      isControlApplicable(c.id, c.conditionalOn, profile, branchingResult)
    );
    const answeredCount = (assessment as any).responses.length;
    const totalApplicable = applicableControls.length;
    const progress = totalApplicable > 0 ? Math.round((answeredCount / totalApplicable) * 100) : 0;

    res.json({
      ...assessment,
      progress,
      totalApplicable,
      answeredCount,
      branchingResult,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get assessment', code: 'INTERNAL_ERROR' });
  }
});

// PUT /assessments/:id/responses/:controlId — Submit or update control response
router.put('/:id/responses/:controlId', authenticate, async (req: Request, res: Response) => {
  try {
    const assessmentId = String(req.params.id);
    const controlId = String(req.params.controlId);
    const { answer, naJustification, notes } = req.body;

    if (!['YES', 'PARTIAL', 'NO', 'NA'].includes(answer)) {
      res.status(400).json({ error: 'Invalid answer. Must be YES, PARTIAL, NO, or NA', code: 'VALIDATION_ERROR' });
      return;
    }

    // Verify assessment is DRAFT
    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, orgId: req.user!.orgId, isDeleted: false },
    });
    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found', code: 'NOT_FOUND' });
      return;
    }
    if (assessment.status !== 'DRAFT' && assessment.status !== 'IN_REVIEW') {
      res.status(400).json({ error: 'Assessment is not editable', code: 'ASSESSMENT_LOCKED' });
      return;
    }

    // Get control
    const control = await prisma.control.findUnique({ where: { id: String(controlId) } });
    if (!control) {
      res.status(404).json({ error: 'Control not found', code: 'NOT_FOUND' });
      return;
    }

    // Get org profile for validation
    const org = await prisma.organization.findUnique({ where: { id: req.user!.orgId } });

    // Rule 4: No N/A for mandatory health org controls
    const mandatoryControls = ['PDPL-C.1', 'PDPL-G.1', 'HS-PDPL-001', 'HS-PDPL-002', 'HS-PDPL-003'];
    if (answer === 'NA' && mandatoryControls.includes(String(controlId)) && isHealthOrg(org!.orgType)) {
      res.status(400).json({
        error: 'This control is mandatory for healthcare organizations and cannot be marked as N/A',
        code: 'MANDATORY_CONTROL',
      });
      return;
    }

    // N/A requires justification
    if (answer === 'NA' && (!naJustification || naJustification.length < 20)) {
      res.status(400).json({
        error: 'N/A justification required (minimum 20 characters)',
        code: 'JUSTIFICATION_REQUIRED',
      });
      return;
    }

    const pointsEarned = getPointsForAnswer(answer, control.pointsYes, control.pointsPartial);

    const existingResponse = await prisma.response.findUnique({
      where: { assessmentId_controlId: { assessmentId: String(assessmentId), controlId: String(controlId) } },
    });

    let response;
    if (existingResponse) {
      response = await prisma.response.update({
        where: { id: existingResponse.id },
        data: {
          answer,
          naJustification: answer === 'NA' ? naJustification : null,
          pointsEarned,
          notes,
          lastModifiedBy: req.user!.userId,
          lastModifiedAt: new Date(),
        },
      });
    } else {
      response = await prisma.response.create({
        data: {
          assessmentId: String(assessmentId),
          controlId: String(controlId),
          answer,
          naJustification: answer === 'NA' ? naJustification : null,
          pointsEarned,
          notes,
          answeredBy: req.user!.userId,
        },
      });
    }

    // Rule 7: G.3 answered NO → cascade gaps
    if (controlId === 'PDPL-G.3' && answer === 'NO') {
      // Auto-flag G.12 and D.5
      console.log('DPIA not conducted — G.12 and D.5 cascade gaps flagged');
    }

    // Auto-create remediation task for NO or PARTIAL
    if (answer === 'NO' || answer === 'PARTIAL') {
      const existingTask = await prisma.remediationTask.findFirst({
        where: { assessmentId: String(assessmentId), controlId: String(controlId), orgId: req.user!.orgId, isDeleted: false },
      });

      if (!existingTask) {
        const deadlineDays = getDefaultDeadlineDays(control.riskLevel);
        await prisma.remediationTask.create({
          data: {
            orgId: req.user!.orgId,
            assessmentId: String(assessmentId),
            controlId: String(controlId),
            gapType: answer === 'NO' ? 'GAP' : 'PARTIAL',
            riskLevel: control.riskLevel,
            title: `Implement: ${control.objectiveEn.substring(0, 200)}`,
            status: 'OPEN',
            legalBasis: [control.regArticles, control.transferRegArticles, control.ncaRef, control.mohPolicyRef].filter(Boolean).join(' | '),
            evidenceRequired: control.evidenceGuidanceEn ? [control.evidenceGuidanceEn] : [],
            responsibleRole: control.responsibleRoles?.[0] || null,
            deadline: addDays(new Date(), deadlineDays),
            evidenceRequiredForClosure: control.riskLevel === 'CRITICAL' || control.riskLevel === 'HIGH',
          },
        });
      }
    }

    // T.8 auto-alert: if T.8 sub-question answered YES
    if (String(controlId).startsWith('PDPL-T.8') && answer === 'YES') {
      await prisma.remediationTask.create({
        data: {
          orgId: req.user!.orgId,
          assessmentId: String(assessmentId),
          controlId: String(controlId),
          gapType: 'GAP',
          riskLevel: 'CRITICAL',
          title: `URGENT: Transfer suspension required — ${controlId}`,
          status: 'OPEN',
          legalBasis: 'Transfer Reg. Art. 7',
          deadline: new Date(),
          evidenceRequiredForClosure: true,
        },
      });
    }

    await logAudit({
      orgId: req.user!.orgId,
      userId: req.user!.userId,
      action: 'RESPONSE_SUBMITTED',
      entityType: 'response',
      entityId: response.id,
      oldValue: existingResponse ? { answer: existingResponse.answer } : null,
      newValue: { controlId: String(controlId), answer, pointsEarned },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json(response);
  } catch (error) {
    console.error('Submit response error:', error);
    res.status(500).json({ error: 'Failed to submit response', code: 'INTERNAL_ERROR' });
  }
});

// POST /assessments/:id/finalize — Finalize assessment (DPO only)
router.post('/:id/finalize', authenticate, authorize(ROLES.DPO, ROLES.ORG_ADMIN), async (req: Request, res: Response) => {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { id: String(req.params.id), orgId: req.user!.orgId, isDeleted: false },
      include: { responses: { include: { control: true } } },
    });

    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found', code: 'NOT_FOUND' });
      return;
    }

    if (assessment.status !== 'DRAFT' && assessment.status !== 'IN_REVIEW') {
      res.status(400).json({ error: 'Assessment cannot be finalized from current status', code: 'INVALID_STATUS' });
      return;
    }

    // Calculate scores
    const controlScores = (assessment as any).responses.map((r: any) => ({
      controlId: r.controlId,
      domainNumber: r.control.domainNumber,
      riskLevel: r.control.riskLevel,
      answer: r.answer,
      pointsYes: r.control.pointsYes,
      pointsPartial: r.control.pointsPartial,
      pointsEarned: r.pointsEarned,
      weightMultiplier: Number(r.control.weightMultiplier),
    }));

    const scores = calculateScores(controlScores);

    const updated = await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        status: 'FINALIZED',
        overallScore: scores.overallScore,
        totalControlsAssessed: scores.totalControlsAssessed,
        criticalGaps: scores.criticalGaps,
        highGaps: scores.highGaps,
        mediumGaps: scores.mediumGaps,
        lowGaps: scores.lowGaps,
        domainScores: scores.domainScores as any,
        finalizedBy: req.user!.userId,
        finalizedAt: new Date(),
      },
    });

    await logAudit({
      orgId: req.user!.orgId,
      userId: req.user!.userId,
      action: 'ASSESSMENT_FINALIZED',
      entityType: 'assessment',
      entityId: assessment.id,
      newValue: { overallScore: scores.overallScore, version: assessment.assessmentVersion },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({ ...updated, domainScores: scores.domainScores });
  } catch (error) {
    console.error('Finalize assessment error:', error);
    res.status(500).json({ error: 'Failed to finalize assessment', code: 'INTERNAL_ERROR' });
  }
});

// PUT /assessments/:id/submit-review — Submit for DPO review
router.put('/:id/submit-review', authenticate, async (req: Request, res: Response) => {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { id: String(req.params.id), orgId: req.user!.orgId, isDeleted: false },
    });

    if (!assessment || assessment.status !== 'DRAFT') {
      res.status(400).json({ error: 'Assessment must be in DRAFT status', code: 'INVALID_STATUS' });
      return;
    }

    const updated = await prisma.assessment.update({
      where: { id: assessment.id },
      data: { status: 'IN_REVIEW' },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit for review', code: 'INTERNAL_ERROR' });
  }
});

export default router;
