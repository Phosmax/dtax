/**
 * User preferences stored in localStorage.
 * Can be migrated to backend user profile later.
 */

const PREFS_KEY = 'dtax_prefs';

export interface UserPreferences {
    defaultMethod: 'FIFO' | 'LIFO' | 'HIFO';
    defaultYear: number;
}

const DEFAULTS: UserPreferences = {
    defaultMethod: 'FIFO',
    defaultYear: new Date().getFullYear(),
};

export function getPreferences(): UserPreferences {
    if (typeof window === 'undefined') return DEFAULTS;
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (!raw) return DEFAULTS;
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
    } catch {
        return DEFAULTS;
    }
}

export function savePreferences(prefs: Partial<UserPreferences>): UserPreferences {
    const current = getPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    return updated;
}
