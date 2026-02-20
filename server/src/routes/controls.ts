import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { evaluateBranchingRules, isControlApplicable } from '../services/branchingRules';

const router = Router();

// GET /controls
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { source, domain_number, risk_level } = req.query;
    const where: any = {};
    if (source) where.source = source;
    if (domain_number) where.domainNumber = parseInt(domain_number as string);
    if (risk_level) where.riskLevel = risk_level;

    const controls = await prisma.control.findMany({
      where,
      orderBy: [{ domainNumber: 'asc' }, { id: 'asc' }],
    });
    res.json({ data: controls, total: controls.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get controls', code: 'INTERNAL_ERROR' });
  }
});

// GET /controls/applicable
router.get('/applicable', authenticate, async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.orgId },
    });
    if (!org) {
      res.status(404).json({ error: 'Organization not found', code: 'NOT_FOUND' });
      return;
    }

    const profile = {
      orgType: org.orgType,
      processesMinors: org.processesMinors,
      crossBorderTransfers: org.crossBorderTransfers,
      usesCloud: org.usesCloud,
      conductsResearch: org.conductsResearch,
      usesAiOrAutomatedDecisions: org.usesAiOrAutomatedDecisions,
      continuousMonitoring: org.continuousMonitoring,
    };

    const branchingResult = evaluateBranchingRules(profile);
    const allControls = await prisma.control.findMany({
      orderBy: [{ domainNumber: 'asc' }, { id: 'asc' }],
    });

    const applicableControls = allControls.filter(control =>
      isControlApplicable(control.id, control.conditionalOn, profile, branchingResult)
    );

    // Group by domain
    const domains: Record<number, any> = {};
    for (const control of applicableControls) {
      if (!domains[control.domainNumber]) {
        domains[control.domainNumber] = {
          domainNumber: control.domainNumber,
          domainName: control.domainName,
          controls: [],
        };
      }
      domains[control.domainNumber].controls.push(control);
    }

    res.json({
      data: applicableControls,
      domains: Object.values(domains),
      total: applicableControls.length,
      branchingResult,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get applicable controls', code: 'INTERNAL_ERROR' });
  }
});

// GET /controls/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const control = await prisma.control.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!control) {
      res.status(404).json({ error: 'Control not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(control);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get control', code: 'INTERNAL_ERROR' });
  }
});

export default router;
