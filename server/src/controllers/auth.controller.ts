import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { config } from '../config';
import { AuthenticatedRequest } from '../middleware/auth';

function generateToken(user: { id: string; email: string; name: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeenAt: user.lastSeenAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, avatar } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: 'Email is already registered.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`
      }
    });

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeenAt: user.lastSeenAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeenAt: user.lastSeenAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
}

export async function getDemoAccounts(req: Request, res: Response): Promise<void> {
  try {
    const demoEmails = ['alice@demo.com', 'bob@demo.com', 'charlie@demo.com', 'dana@demo.com'];
    const users = await prisma.user.findMany({
      where: { email: { in: demoEmails } }
    });

    const accounts = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatar: u.avatar,
      token: generateToken(u)
    }));

    res.json({ accounts });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch demo accounts' });
  }
}

export async function getAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.id;
    const users = await prisma.user.findMany({
      where: currentUserId ? { id: { not: currentUserId } } : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isOnline: true,
        lastSeenAt: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({ users });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}
