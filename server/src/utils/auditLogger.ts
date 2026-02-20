import { prisma } from '../index';

interface AuditEntry {
  orgId: string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress: string;
  userAgent?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: entry.orgId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType || null,
        entityId: entry.entityId || null,
        oldValue: entry.oldValue || null,
        newValue: entry.newValue || null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent || null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export function getClientIp(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '0.0.0.0';
}
