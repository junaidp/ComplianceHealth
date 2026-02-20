import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate, authorize, ROLES } from '../middleware/auth';
import { logAudit, getClientIp } from '../utils/auditLogger';

const router = Router();

// GET /remediation/tasks
router.get('/tasks', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, risk_level, owner_user_id, control_id, domain_number } = req.query;
    const where: any = { orgId: req.user!.orgId, isDeleted: false };

    if (status) where.status = status;
    if (risk_level) where.riskLevel = risk_level;
    if (owner_user_id) where.ownerUserId = owner_user_id;
    if (control_id) where.controlId = control_id;

    const tasks = await prisma.remediationTask.findMany({
      where,
      include: {
        control: { select: { domainNumber: true, domainName: true, objectiveEn: true, riskLevel: true, ref: true } },
        owner: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: [
        { riskLevel: 'asc' },
        { deadline: 'asc' },
      ],
    });

    // Filter by domain if needed
    let filtered = tasks;
    if (domain_number) {
      filtered = tasks.filter(t => t.control.domainNumber === parseInt(domain_number as string));
    }

    // Sort by risk priority
    const riskOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    filtered.sort((a, b) => (riskOrder[a.riskLevel] || 4) - (riskOrder[b.riskLevel] || 4));

    res.json({ data: filtered, total: filtered.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tasks', code: 'INTERNAL_ERROR' });
  }
});

// GET /remediation/tasks/:id
router.get('/tasks/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const task = await prisma.remediationTask.findFirst({
      where: { id: String(req.params.id), orgId: req.user!.orgId, isDeleted: false },
      include: {
        control: true,
        owner: { select: { firstName: true, lastName: true, email: true } },
        assessment: { select: { assessmentVersion: true, status: true } },
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found', code: 'NOT_FOUND' });
      return;
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get task', code: 'INTERNAL_ERROR' });
  }
});

// PUT /remediation/tasks/:id/status
router.put('/tasks/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, notes, rejectionNote } = req.body;
    const task = await prisma.remediationTask.findFirst({
      where: { id: String(req.params.id), orgId: req.user!.orgId, isDeleted: false },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found', code: 'NOT_FOUND' });
      return;
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      OPEN: ['IN_PROGRESS', 'DEFERRED'],
      IN_PROGRESS: ['UNDER_REVIEW', 'DEFERRED'],
      UNDER_REVIEW: ['CLOSED', 'IN_PROGRESS', 'DEFERRED'],
      CLOSED: [],
      DEFERRED: ['OPEN', 'IN_PROGRESS'],
    };

    if (!validTransitions[task.status]?.includes(status)) {
      res.status(422).json({
        error: `Invalid transition from ${task.status} to ${status}`,
        code: 'INVALID_TRANSITION',
      });
      return;
    }

    // IN_PROGRESS → UNDER_REVIEW requires notes or evidence
    if (task.status === 'IN_PROGRESS' && status === 'UNDER_REVIEW' && !notes && !task.notes) {
      res.status(400).json({
        error: 'Notes or evidence upload required before submitting for review',
        code: 'NOTES_REQUIRED',
      });
      return;
    }

    // UNDER_REVIEW → CLOSED: DPO/Compliance Officer only + evidence for CRITICAL/HIGH
    if (status === 'CLOSED') {
      if (![ROLES.DPO, ROLES.ORG_ADMIN, ROLES.COMPLIANCE_OFFICER].includes(req.user!.role as any)) {
        res.status(403).json({ error: 'Only DPO or Compliance Officer can close tasks', code: 'FORBIDDEN' });
        return;
      }
      if (task.evidenceRequiredForClosure) {
        const evidence = await prisma.evidenceFile.findFirst({
          where: { taskId: task.id, orgId: req.user!.orgId, isDeleted: false },
        });
        if (!evidence) {
          res.status(400).json({
            error: 'Evidence upload required to close CRITICAL/HIGH tasks',
            code: 'EVIDENCE_REQUIRED',
          });
          return;
        }
      }
    }

    // DEFERRED: DPO only + justification required
    if (status === 'DEFERRED') {
      if (req.user!.role !== ROLES.DPO && req.user!.role !== ROLES.ORG_ADMIN) {
        res.status(403).json({ error: 'Only DPO can defer tasks', code: 'FORBIDDEN' });
        return;
      }
      if (!notes) {
        res.status(400).json({ error: 'Written justification required for deferral', code: 'JUSTIFICATION_REQUIRED' });
        return;
      }
    }

    // Rejection note for UNDER_REVIEW → IN_PROGRESS
    if (task.status === 'UNDER_REVIEW' && status === 'IN_PROGRESS' && !rejectionNote) {
      res.status(400).json({ error: 'Rejection note required', code: 'REJECTION_NOTE_REQUIRED' });
      return;
    }

    const oldStatus = task.status;
    const updateData: any = {
      status,
      notes: notes || task.notes,
    };

    if (status === 'CLOSED') {
      updateData.closedAt = new Date();
    }

    const updated = await prisma.remediationTask.update({
      where: { id: task.id },
      data: updateData,
    });

    await logAudit({
      orgId: req.user!.orgId,
      userId: req.user!.userId,
      action: 'TASK_STATUS_CHANGED',
      entityType: 'task',
      entityId: task.id,
      oldValue: { status: oldStatus },
      newValue: { status, notes },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task status', code: 'INTERNAL_ERROR' });
  }
});

// PUT /remediation/tasks/:id/assign
router.put('/tasks/:id/assign', authenticate, authorize(ROLES.DPO, ROLES.ORG_ADMIN, ROLES.COMPLIANCE_OFFICER), async (req: Request, res: Response) => {
  try {
    const { ownerUserId } = req.body;

    const task = await prisma.remediationTask.findFirst({
      where: { id: String(req.params.id), orgId: req.user!.orgId, isDeleted: false },
    });
    if (!task) {
      res.status(404).json({ error: 'Task not found', code: 'NOT_FOUND' });
      return;
    }

    // Verify user belongs to same org
    if (ownerUserId) {
      const targetUser = await prisma.user.findFirst({
        where: { id: ownerUserId, orgId: req.user!.orgId, isDeleted: false },
      });
      if (!targetUser) {
        res.status(400).json({ error: 'User not found in organization', code: 'INVALID_USER' });
        return;
      }
    }

    const updated = await prisma.remediationTask.update({
      where: { id: task.id },
      data: { ownerUserId },
      include: { owner: { select: { firstName: true, lastName: true, email: true } } },
    });

    await logAudit({
      orgId: req.user!.orgId,
      userId: req.user!.userId,
      action: 'TASK_ASSIGNED',
      entityType: 'task',
      entityId: task.id,
      newValue: { ownerUserId },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign task', code: 'INTERNAL_ERROR' });
  }
});

export default router;
