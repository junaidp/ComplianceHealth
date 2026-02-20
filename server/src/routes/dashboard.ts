import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate, authorize, ROLES } from '../middleware/auth';

const router = Router();

// GET /dashboard/compliance-score
router.get('/compliance-score', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;

    // Get latest finalized assessment
    const latestAssessment = await prisma.assessment.findFirst({
      where: { orgId, status: 'FINALIZED', isDeleted: false },
      orderBy: { finalizedAt: 'desc' },
    });

    // Get historical assessments for trend
    const historicalAssessments = await prisma.assessment.findMany({
      where: { orgId, status: { in: ['FINALIZED', 'ARCHIVED'] }, isDeleted: false },
      orderBy: { finalizedAt: 'asc' },
      take: 6,
      select: {
        id: true,
        assessmentVersion: true,
        overallScore: true,
        domainScores: true,
        criticalGaps: true,
        highGaps: true,
        mediumGaps: true,
        lowGaps: true,
        finalizedAt: true,
      },
    });

    // Get current draft assessment progress
    const draftAssessment = await prisma.assessment.findFirst({
      where: { orgId, status: 'DRAFT', isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { responses: true } } },
    });

    // Task stats
    const taskStats = await prisma.remediationTask.groupBy({
      by: ['status'],
      where: { orgId, isDeleted: false },
      _count: { id: true },
    });

    const tasksByStatus: Record<string, number> = {};
    taskStats.forEach(t => { tasksByStatus[t.status] = t._count.id; });

    // Overdue tasks
    const overdueTasks = await prisma.remediationTask.count({
      where: {
        orgId,
        isDeleted: false,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        deadline: { lt: new Date() },
      },
    });

    res.json({
      currentScore: latestAssessment ? Number(latestAssessment.overallScore) : null,
      domainScores: latestAssessment?.domainScores || null,
      criticalGaps: latestAssessment?.criticalGaps || 0,
      highGaps: latestAssessment?.highGaps || 0,
      mediumGaps: latestAssessment?.mediumGaps || 0,
      lowGaps: latestAssessment?.lowGaps || 0,
      trend: historicalAssessments.map(a => ({
        version: a.assessmentVersion,
        score: Number(a.overallScore),
        date: a.finalizedAt,
      })),
      draftProgress: draftAssessment ? {
        id: draftAssessment.id,
        responsesCount: draftAssessment._count.responses,
      } : null,
      tasks: {
        ...tasksByStatus,
        overdue: overdueTasks,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get compliance score', code: 'INTERNAL_ERROR' });
  }
});

// GET /dashboard/kpis
router.get('/kpis', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;

    // Task completion rate
    const totalTasks = await prisma.remediationTask.count({
      where: { orgId, isDeleted: false },
    });
    const closedTasks = await prisma.remediationTask.count({
      where: { orgId, isDeleted: false, status: 'CLOSED' },
    });
    const taskCompletionRate = totalTasks > 0 ? Math.round((closedTasks / totalTasks) * 100) : 0;

    // Training completion rate
    const totalUsers = await prisma.user.count({
      where: { orgId, isDeleted: false, isActive: true },
    });
    const trainingRecords = await prisma.trainingRecord.findMany({
      where: { orgId, passed: true },
    });
    const uniqueCompletedUsers = new Set(trainingRecords.map(r => r.userId)).size;
    const trainingCompletionRate = totalUsers > 0 ? Math.round((uniqueCompletedUsers / totalUsers) * 100) : 0;

    // Tasks by risk level
    const tasksByRisk = await prisma.remediationTask.groupBy({
      by: ['riskLevel'],
      where: { orgId, isDeleted: false, status: { not: 'CLOSED' } },
      _count: { id: true },
    });

    // Recent activity
    const recentActivity = await prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    res.json({
      taskCompletionRate,
      trainingCompletionRate,
      totalTasks,
      closedTasks,
      openTasks: totalTasks - closedTasks,
      totalUsers,
      tasksByRisk: tasksByRisk.map(t => ({ riskLevel: t.riskLevel, count: t._count.id })),
      recentActivity: recentActivity.map(a => ({
        action: a.action,
        entityType: a.entityType,
        user: a.user,
        timestamp: a.timestamp,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get KPIs', code: 'INTERNAL_ERROR' });
  }
});

export default router;
