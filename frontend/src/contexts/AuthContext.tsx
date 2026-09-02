import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { persist } from '../utils/storage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Mirrors the UserRole enum in prisma/schema.prisma, lower-cased the way the
// auth controller signs it into the token. POLICE operates the camera registry.
export type UserRole = 'participant' | 'organizer' | 'admin' | 'police';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('drishti_user');
    const token = localStorage.getItem('drishti_token');
    if (storedUser && token) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('drishti_user');
        localStorage.removeItem('drishti_token');
      }
    }
  }, []);

  const login = async (email: string, password: string, role: UserRole) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const userData: User = data.user;
      const token = data.token;

      setUser(userData);
      setIsAuthenticated(true);
      // The session depends on these surviving a reload, and the event cache
      // had already been seen to fill the store - so a user could have been
      // unable to sign in because of cached venue maps. `persist` evicts the
      // caches to make room rather than letting the token write fail.
      persist('drishti_user', JSON.stringify(userData));
      if (!persist('drishti_token', token)) {
        console.warn(
          'The session token could not be stored; signing in again will be needed after a reload.'
        );
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      const userData: User = data.user;
      const token = data.token;

      setUser(userData);
      setIsAuthenticated(true);
      // The session depends on these surviving a reload, and the event cache
      // had already been seen to fill the store - so a user could have been
      // unable to sign in because of cached venue maps. `persist` evicts the
      // caches to make room rather than letting the token write fail.
      persist('drishti_user', JSON.stringify(userData));
      if (!persist('drishti_token', token)) {
        console.warn(
          'The session token could not be stored; signing in again will be needed after a reload.'
        );
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('drishti_user');
    localStorage.removeItem('drishti_token');
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    isAuthenticated
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};