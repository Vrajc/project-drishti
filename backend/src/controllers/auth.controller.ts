import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const getPrismaErrorResponse = (error: any) => {
  const code = error?.code as string | undefined;

  if (code === 'P1001' || code === 'P1002') {
    return { status: 503, message: 'Database is unavailable. Please try again later.' };
  }

  if (code === 'P2021') {
    return { status: 500, message: 'Database schema is not ready. Please contact support.' };
  }

  return { status: 500, message: null as string | null };
};

// Validation helper functions
const validateGmail = (email: string): boolean => {
  return email.endsWith('@gmail.com');
};

const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  return { valid: true };
};

// Register new user
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Validate Gmail
    if (!validateGmail(email)) {
      return res.status(400).json({ message: 'Email must be a Gmail address (@gmail.com)' });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email. Please login instead.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Roles a person may give themselves.
    //
    // ADMIN and POLICE are deliberately absent. Public registration granted them
    // on request, which meant anyone could create an account with the whole
    // camera estate, the watchlist, alerts, dispatch and vehicle tracking behind
    // it. Those accounts are now created by an administrator through
    // PATCH /api/users/:id/role, or by the server's own seed.
    const SELF_SERVICE_ROLES: Record<string, 'ORGANIZER' | 'PARTICIPANT'> = {
      organizer: 'ORGANIZER',
      participant: 'PARTICIPANT',
    };

    const requested = String(role ?? 'participant').toLowerCase();

    // Refused rather than quietly downgraded: someone who asked for an operator
    // account needs to know they did not get one.
    if (requested !== '' && !(requested in SELF_SERVICE_ROLES)) {
      return res.status(403).json({
        message:
          `The "${requested}" role cannot be self-registered. Ask an administrator to grant it ` +
          'to an existing account.',
      });
    }

    // Save to database
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: SELF_SERVICE_ROLES[requested] || 'PARTICIPANT',
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role.toLowerCase() },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return user data without password
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.toLowerCase(),
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    const prismaError = getPrismaErrorResponse(error);
    res.status(prismaError.status).json({
      message: prismaError.message || 'Error creating user',
      error: error.message,
    });
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Validate Gmail
    if (!validateGmail(email)) {
      return res.status(400).json({ message: 'Email must be a Gmail address (@gmail.com)' });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found. Please sign up first.' });
    }

    // Check if role matches (optional check)
    if (role && user.role.toLowerCase() !== role) {
      return res.status(401).json({ message: `Invalid credentials for ${role} role` });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role.toLowerCase() },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return user data without password
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.toLowerCase(),
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    const prismaError = getPrismaErrorResponse(error);
    res.status(prismaError.status).json({
      message: prismaError.message || 'Error logging in',
      error: error.message,
    });
  }
};

// Get user profile
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organization: true,
        phone: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.toLowerCase(),
        organization: user.organization,
        phone: user.phone,
      },
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    const prismaError = getPrismaErrorResponse(error);
    res.status(prismaError.status).json({
      message: prismaError.message || 'Error fetching profile',
      error: error.message,
    });
  }
};

// Logout user (client-side token removal)
export const logout = async (req: Request, res: Response) => {
  res.status(200).json({ message: 'Logout successful' });
};
