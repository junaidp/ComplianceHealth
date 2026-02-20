import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { generateRemediationGuidance, analyzeDocument, trainingChatbot, generatePolicyTemplate, generateGapNarrative } from '../services/aiService';

const router = Router();

// POST /ai/remediation-guidance
router.post('/remediation-guidance', authenticate, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;

    const task = await prisma.remediationTask.findFirst({
      where: { id: taskId, orgId: req.user!.orgId, isDeleted: false },
      include: { control: true },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found', code: 'NOT_FOUND' });
      return;
    }

    // Check cache (24 hours)
    if (task.aiGuidance && task.aiGeneratedAt) {
      const cacheAge = Date.now() - task.aiGeneratedAt.getTime();
      if (cacheAge < 24 * 60 * 60 * 1000) {
        res.json({ guidance: task.aiGuidance, cached: true });
        return;
      }
    }

    const org = await prisma.organization.findUnique({ where: { id: req.user!.orgId } });
    if (!org) {
      res.status(404).json({ error: 'Organization not found', code: 'NOT_FOUND' });
      return;
    }

    const guidance = await generateRemediationGuidance({
      orgType: org.orgType,
      size: org.bedCount || org.staffSize || undefined,
      processesMinors: org.processesMinors,
      usesAi: org.usesAiOrAutomatedDecisions,
      continuousMonitoring: org.continuousMonitoring,
      crossBorderTransfers: org.crossBorderTransfers,
      applicableRegulatoryBodies: org.applicableRegulatoryBodies,
      controlId: task.controlId,
      controlObjective: task.control.objectiveEn,
      riskLevel: task.riskLevel,
      regArticles: task.control.regArticles || undefined,
      transferRegArticles: task.control.transferRegArticles || undefined,
      ncaRef: task.control.ncaRef || undefined,
      mohPolicyRef: task.control.mohPolicyRef || undefined,
      evidenceGuidance: task.control.evidenceGuidanceEn || undefined,
      mohImplGuidance: task.control.mohImplGuidanceEn || undefined,
      gapType: task.gapType,
      notes: task.notes || undefined,
    });

    await prisma.remediationTask.update({
      where: { id: task.id },
      data: { aiGuidance: guidance, aiGeneratedAt: new Date() },
    });

    res.json({ guidance, cached: false });
  } catch (error) {
    console.error('AI guidance error:', error);
    res.status(500).json({ error: 'Failed to generate AI guidance', code: 'INTERNAL_ERROR' });
  }
});

// POST /ai/analyze-document
router.post('/analyze-document', authenticate, async (req: Request, res: Response) => {
  try {
    const { documentText, controlId } = req.body;

    if (!documentText || !controlId) {
      res.status(400).json({ error: 'documentText and controlId required', code: 'VALIDATION_ERROR' });
      return;
    }

    const control = await prisma.control.findUnique({ where: { id: controlId } });
    if (!control) {
      res.status(404).json({ error: 'Control not found', code: 'NOT_FOUND' });
      return;
    }

    const result = await analyzeDocument(documentText, control.objectiveEn);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze document', code: 'INTERNAL_ERROR' });
  }
});

// POST /ai/training-chat
router.post('/training-chat', authenticate, async (req: Request, res: Response) => {
  try {
    const { question, moduleId } = req.body;

    if (!question) {
      res.status(400).json({ error: 'Question required', code: 'VALIDATION_ERROR' });
      return;
    }

    let moduleContext = 'General PDPL Healthcare Compliance';
    if (moduleId) {
      const module = await prisma.trainingModule.findUnique({ where: { id: moduleId } });
      if (module) {
        moduleContext = `${module.title}: ${module.description}`;
      }
    }

    const answer = await trainingChatbot(question, moduleContext);
    res.json({ answer });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chatbot response', code: 'INTERNAL_ERROR' });
  }
});

// POST /ai/gap-narrative
router.post('/gap-narrative', authenticate, async (req: Request, res: Response) => {
  try {
    const { assessmentId } = req.body;

    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, orgId: req.user!.orgId, isDeleted: false },
      include: {
        responses: {
          where: { answer: { in: ['NO', 'PARTIAL'] } },
          include: { control: true },
        },
      },
    });

    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found', code: 'NOT_FOUND' });
      return;
    }

    const gaps = assessment.responses.map(r => ({
      controlId: r.controlId,
      riskLevel: r.control.riskLevel,
      objective: r.control.objectiveEn,
    }));

    const narrative = await generateGapNarrative(gaps);
    res.json({ narrative });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate gap narrative', code: 'INTERNAL_ERROR' });
  }
});

// POST /ai/policy-template
router.post('/policy-template', authenticate, async (req: Request, res: Response) => {
  try {
    const { controlId } = req.body;

    const control = await prisma.control.findUnique({ where: { id: controlId } });
    if (!control) {
      res.status(404).json({ error: 'Control not found', code: 'NOT_FOUND' });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { id: req.user!.orgId } });
    if (!org) {
      res.status(404).json({ error: 'Organization not found', code: 'NOT_FOUND' });
      return;
    }

    const template = await generatePolicyTemplate(
      controlId,
      control.objectiveEn,
      org.orgType,
      {
        processesMinors: org.processesMinors,
        crossBorderTransfers: org.crossBorderTransfers,
        usesAi: org.usesAiOrAutomatedDecisions,
        continuousMonitoring: org.continuousMonitoring,
      }
    );

    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate policy template', code: 'INTERNAL_ERROR' });
  }
});

export default router;
