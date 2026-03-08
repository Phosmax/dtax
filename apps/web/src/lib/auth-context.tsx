'use client';

/**
 * 认证上下文
 * 管理 JWT token 和用户状态，提供 login/register/logout 方法。
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'dtax_token';

interface AuthUser {
    id: string;
    email: string;
    name: string | null;
    role: string;
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // 启动时从 localStorage 恢复 token
    useEffect(() => {
        const stored = getStoredToken();
        if (stored) {
            setToken(stored);
            fetchMe(stored).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    async function fetchMe(jwt: string) {
        try {
            const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data.data);
            } else {
                // token 无效，清除
                localStorage.removeItem(TOKEN_KEY);
                setToken(null);
            }
        } catch {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
        }
    }

    async function login(email: string, password: string) {
        const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: { message: 'Login failed' } }));
            throw new Error(err.error?.message || 'Login failed');
        }

        const data = await res.json();
        localStorage.setItem(TOKEN_KEY, data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
    }

    async function register(email: string, password: string, name?: string) {
        const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: { message: 'Registration failed' } }));
            throw new Error(err.error?.message || 'Registration failed');
        }

        const data = await res.json();
        localStorage.setItem(TOKEN_KEY, data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
