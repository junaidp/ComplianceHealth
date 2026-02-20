import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate, authorize, ROLES } from '../middleware/auth';
import { logAudit, getClientIp } from '../utils/auditLogger';
import { addMonths } from 'date-fns';

const router = Router();

// GET /training/modules
router.get('/modules', authenticate, async (req: Request, res: Response) => {
  try {
    const modules = await prisma.trainingModule.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

    // Get user's training records
    const records = await prisma.trainingRecord.findMany({
      where: { userId: req.user!.userId, orgId: req.user!.orgId },
    });

    const recordMap = new Map(records.map(r => [r.moduleId, r]));

    const enriched = modules.map(m => ({
      ...m,
      userRecord: recordMap.get(m.id) || null,
      isAssigned: m.targetRoles.includes(req.user!.role) || m.targetRoles.includes('All staff'),
    }));

    res.json({ data: enriched, total: modules.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get training modules', code: 'INTERNAL_ERROR' });
  }
});

// GET /training/modules/:id
router.get('/modules/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const module = await prisma.trainingModule.findUnique({
      where: { id: String(req.params.id) },
    });

    if (!module) {
      res.status(404).json({ error: 'Training module not found', code: 'NOT_FOUND' });
      return;
    }

    const record = await prisma.trainingRecord.findUnique({
      where: { userId_moduleId: { userId: req.user!.userId, moduleId: module.id } },
    });

    res.json({ ...module, userRecord: record });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get training module', code: 'INTERNAL_ERROR' });
  }
});

// POST /training/modules/:id/start
router.post('/modules/:id/start', authenticate, async (req: Request, res: Response) => {
  try {
    const module = await prisma.trainingModule.findUnique({
      where: { id: String(req.params.id) },
    });

    if (!module) {
      res.status(404).json({ error: 'Training module not found', code: 'NOT_FOUND' });
      return;
    }

    // Check if already exists
    let record = await prisma.trainingRecord.findUnique({
      where: { userId_moduleId: { userId: req.user!.userId, moduleId: module.id } },
    });

    if (record && record.passed && record.expiresAt && record.expiresAt > new Date()) {
      res.json({ ...record, message: 'Already completed and valid' });
      return;
    }

    if (!record) {
      record = await prisma.trainingRecord.create({
        data: {
          orgId: req.user!.orgId,
          userId: req.user!.userId,
          moduleId: module.id,
          role: req.user!.role,
          attempts: 0,
        },
      });
    }

    res.json({ record, module: { content: module.content, questions: module.questions } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start training', code: 'INTERNAL_ERROR' });
  }
});

// POST /training/modules/:id/submit
router.post('/modules/:id/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const { answers } = req.body;
    const moduleId = String(req.params.id);

    const module = await prisma.trainingModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      res.status(404).json({ error: 'Training module not found', code: 'NOT_FOUND' });
      return;
    }

    let record = await prisma.trainingRecord.findUnique({
      where: { userId_moduleId: { userId: req.user!.userId, moduleId } },
    });

    if (!record) {
      res.status(400).json({ error: 'Training session not started', code: 'SESSION_NOT_STARTED' });
      return;
    }

    if (record.attempts >= module.maxAttempts) {
      res.status(400).json({
        error: `Maximum attempts (${module.maxAttempts}) reached. Contact your manager.`,
        code: 'MAX_ATTEMPTS_REACHED',
      });
      return;
    }

    // Score the quiz
    const questions = module.questions as any[];
    if (!questions || !Array.isArray(questions)) {
      res.status(500).json({ error: 'Module questions not configured', code: 'INTERNAL_ERROR' });
      return;
    }

    let correctCount = 0;
    const results: any[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userAnswer = answers?.[i];
      const isCorrect = userAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      results.push({
        questionIndex: i,
        correct: isCorrect,
        userAnswer,
        correctAnswer: q.correctAnswer,
      });
    }

    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const passed = score >= module.passScore;
    const newAttempts = record.attempts + 1;

    const updateData: any = {
      score,
      passed,
      attempts: newAttempts,
    };

    if (passed) {
      updateData.completedAt = new Date();
      updateData.expiresAt = addMonths(new Date(), 12);
    }

    record = await prisma.trainingRecord.update({
      where: { id: record.id },
      data: updateData,
    });

    // If failed on 3rd attempt, log for manager notification
    if (!passed && newAttempts >= module.maxAttempts) {
      await logAudit({
        orgId: req.user!.orgId,
        userId: req.user!.userId,
        action: 'TRAINING_MAX_ATTEMPTS_REACHED',
        entityType: 'training',
        entityId: moduleId,
        newValue: { score, attempts: newAttempts },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });
    }

    if (passed) {
      await logAudit({
        orgId: req.user!.orgId,
        userId: req.user!.userId,
        action: 'TRAINING_COMPLETED',
        entityType: 'training',
        entityId: moduleId,
        newValue: { score, passed, attempts: newAttempts },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });
    }

    res.json({
      score,
      passed,
      attempts: newAttempts,
      maxAttempts: module.maxAttempts,
      results,
      record,
    });
  } catch (error) {
    console.error('Training submit error:', error);
    res.status(500).json({ error: 'Failed to submit training', code: 'INTERNAL_ERROR' });
  }
});

// GET /training/records — Org training records
router.get('/records', authenticate, authorize(ROLES.ORG_ADMIN, ROLES.DPO, ROLES.CDO, ROLES.DEPARTMENT_MANAGER), async (req: Request, res: Response) => {
  try {
    const records = await prisma.trainingRecord.findMany({
      where: { orgId: req.user!.orgId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, role: true, department: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get all modules for enrichment
    const modules = await prisma.trainingModule.findMany({ where: { isActive: true } });
    const moduleMap = new Map(modules.map(m => [m.id, m]));

    const enriched = records.map(r => ({
      ...r,
      module: moduleMap.get(r.moduleId) || null,
    }));

    res.json({ data: enriched, total: records.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get training records', code: 'INTERNAL_ERROR' });
  }
});

export default router;
