import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate, authorize, ROLES } from '../middleware/auth';

const router = Router();

// GET /audit-log
router.get('/', authenticate, authorize(ROLES.DPO, ROLES.ORG_ADMIN, ROLES.AUDITOR), async (req: Request, res: Response) => {
  try {
    const { action, user_id, date_from, date_to, entity_type, page = '1', per_page = '50' } = req.query;
    const where: any = { orgId: req.user!.orgId };

    if (action) where.action = action;
    if (user_id) where.userId = user_id;
    if (entity_type) where.entityType = entity_type;
    if (date_from || date_to) {
      where.timestamp = {};
      if (date_from) where.timestamp.gte = new Date(date_from as string);
      if (date_to) where.timestamp.lte = new Date(date_to as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(per_page as string);
    const take = parseInt(per_page as string);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs.map(l => ({ ...l, id: l.id.toString() })),
      total,
      page: parseInt(page as string),
      per_page: parseInt(per_page as string),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get audit log', code: 'INTERNAL_ERROR' });
  }
});

export default router;
