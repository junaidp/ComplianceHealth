import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided', code: 'AUTH_REQUIRED' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
}

export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' });
      return;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  DPO: 'dpo',
  CISO: 'ciso',
  CDO: 'cdo',
  COMPLIANCE_OFFICER: 'compliance_officer',
  DATA_STEWARD: 'data_steward',
  DATA_CUSTODIAN: 'data_custodian',
  DEPARTMENT_MANAGER: 'department_manager',
  STAFF: 'staff',
  AUDITOR: 'auditor',
} as const;

export const DPO_AND_ABOVE = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.DPO];
export const MANAGEMENT_ROLES = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.DPO, ROLES.CISO, ROLES.CDO, ROLES.COMPLIANCE_OFFICER];
export const ALL_AUTHENTICATED = Object.values(ROLES);
