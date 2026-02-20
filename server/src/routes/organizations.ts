import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate, authorize, ROLES, DPO_AND_ABOVE } from '../middleware/auth';
import { evaluateBranchingRules } from '../services/branchingRules';
import { logAudit, getClientIp } from '../utils/auditLogger';

const router = Router();

// GET /organizations/profile
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.orgId },
    });
    if (!org) {
      res.status(404).json({ error: 'Organization not found', code: 'NOT_FOUND' });
      return;
    }
    const branchingResult = evaluateBranchingRules({
      orgType: org.orgType,
      processesMinors: org.processesMinors,
      crossBorderTransfers: org.crossBorderTransfers,
      usesCloud: org.usesCloud,
      conductsResearch: org.conductsResearch,
      usesAiOrAutomatedDecisions: org.usesAiOrAutomatedDecisions,
      continuousMonitoring: org.continuousMonitoring,
    });
    res.json({ ...org, branchingResult });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get organization profile', code: 'INTERNAL_ERROR' });
  }
});

// PUT /organizations/profile
router.put('/profile', authenticate, authorize(ROLES.ORG_ADMIN, ROLES.DPO, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const oldOrg = await prisma.organization.findUnique({ where: { id: orgId } });

    const updateData: any = {};
    const allowedFields = [
      'name', 'orgType', 'bedCount', 'staffSize', 'regionsOfOperation',
      'processesMinors', 'crossBorderTransfers', 'usesCloud', 'conductsResearch',
      'usesAiOrAutomatedDecisions', 'continuousMonitoring', 'dpoAppointed',
      'dpoName', 'dpoEmail', 'applicableRegulatoryBodies', 'onboardingCompleted',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
    });

    const branchingResult = evaluateBranchingRules({
      orgType: org.orgType,
      processesMinors: org.processesMinors,
      crossBorderTransfers: org.crossBorderTransfers,
      usesCloud: org.usesCloud,
      conductsResearch: org.conductsResearch,
      usesAiOrAutomatedDecisions: org.usesAiOrAutomatedDecisions,
      continuousMonitoring: org.continuousMonitoring,
    });

    await logAudit({
      orgId,
      userId: req.user!.userId,
      action: 'ORG_PROFILE_UPDATED',
      entityType: 'organization',
      entityId: orgId,
      oldValue: oldOrg,
      newValue: org,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({ ...org, branchingResult });
  } catch (error) {
    console.error('Update org error:', error);
    res.status(500).json({ error: 'Failed to update organization profile', code: 'INTERNAL_ERROR' });
  }
});

// GET /organizations/users
router.get('/users', authenticate, authorize(ROLES.ORG_ADMIN, ROLES.DPO, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { orgId: req.user!.orgId, isDeleted: false },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, department: true, isActive: true, lastLoginAt: true,
        createdAt: true,
      },
    });
    res.json({ data: users, total: users.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users', code: 'INTERNAL_ERROR' });
  }
});

// POST /organizations/users
router.post('/users', authenticate, authorize(ROLES.ORG_ADMIN, ROLES.DPO), async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role, department } = req.body;
    if (!email || !password || !firstName || !lastName || !role) {
      res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
      return;
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        department,
        orgId: req.user!.orgId,
      },
    });

    await logAudit({
      orgId: req.user!.orgId,
      userId: req.user!.userId,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: user.id,
      newValue: { email, role, department },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      id: user.id, email: user.email, firstName: user.firstName,
      lastName: user.lastName, role: user.role, department: user.department,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Email already exists', code: 'DUPLICATE_EMAIL' });
      return;
    }
    res.status(500).json({ error: 'Failed to create user', code: 'INTERNAL_ERROR' });
  }
});

export default router;
