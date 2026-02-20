import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { authenticate, JwtPayload } from '../middleware/auth';
import { logAudit, getClientIp } from '../utils/auditLogger';

const router = Router();

function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role, orgName, orgType } = req.body;

    if (!email || !password || !firstName || !lastName || !orgName || !orgType) {
      res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
      return;
    }

    if (password.length < 12) {
      res.status(400).json({ error: 'Password must be at least 12 characters', code: 'VALIDATION_ERROR' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered', code: 'DUPLICATE_EMAIL' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const org = await prisma.organization.create({
      data: {
        name: orgName,
        orgType,
      },
    });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: role || 'org_admin',
        orgId: org.id,
      },
    });

    const payload: JwtPayload = {
      userId: user.id,
      orgId: org.id,
      role: user.role,
      email: user.email,
    };

    const tokens = generateTokens(payload);

    await logAudit({
      orgId: org.id,
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: user.id,
      newValue: { email, role: user.role },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        orgId: org.id,
      },
      organization: {
        id: org.id,
        name: org.name,
        orgType: org.orgType,
        onboardingCompleted: org.onboardingCompleted,
      },
      ...tokens,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', code: 'INTERNAL_ERROR' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required', code: 'VALIDATION_ERROR' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user || user.isDeleted || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
      email: user.email,
    };

    const tokens = generateTokens(payload);

    await logAudit({
      orgId: user.orgId,
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        orgId: user.orgId,
        language: user.language,
      },
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        orgType: user.organization.orgType,
        onboardingCompleted: user.organization.onboardingCompleted,
      },
      ...tokens,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', code: 'INTERNAL_ERROR' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required', code: 'VALIDATION_ERROR' });
      return;
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
    const tokens = generateTokens({
      userId: decoded.userId,
      orgId: decoded.orgId,
      role: decoded.role,
      email: decoded.email,
    });

    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token', code: 'INVALID_TOKEN' });
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { organization: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        orgId: user.orgId,
        language: user.language,
        department: user.department,
      },
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        orgType: user.organization.orgType,
        onboardingCompleted: user.organization.onboardingCompleted,
        subscriptionTier: user.organization.subscriptionTier,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info', code: 'INTERNAL_ERROR' });
  }
});

export default router;
