'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { getPreferences, savePreferences } from '@/lib/preferences';

const METHODS = ['FIFO', 'LIFO', 'HIFO'] as const;
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);

export default function SettingsPage() {
    const t = useTranslations('settings');
    const tTax = useTranslations('tax');
    const { user } = useAuth();

    const [method, setMethod] = useState<string>('FIFO');
    const [year, setYear] = useState<number>(currentYear);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const prefs = getPreferences();
        setMethod(prefs.defaultMethod);
        setYear(prefs.defaultYear);
    }, []);

    function handleSave() {
        savePreferences({
            defaultMethod: method as 'FIFO' | 'LIFO' | 'HIFO',
            defaultYear: year,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    const inputStyle = {
        width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', fontSize: '14px',
    };

    const labelStyle = {
        display: 'block' as const, fontSize: '13px', color: 'var(--text-muted)',
        marginBottom: '8px', fontWeight: 500 as const,
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('title')}</h1>
                    <p className="page-subtitle">{t('subtitle')}</p>
                </div>
            </div>

            <div className="card" style={{ padding: '24px', maxWidth: '480px' }}>
                {user && (
                    <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{user.email}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {user.role} {user.name ? `· ${user.name}` : ''}
                        </div>
                    </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>{t('defaultMethod')}</label>
                    <select style={inputStyle} value={method} onChange={e => setMethod(e.target.value)}>
                        {METHODS.map(m => (
                            <option key={m} value={m}>{tTax(m.toLowerCase() as 'fifo' | 'lifo' | 'hifo')}</option>
                        ))}
                    </select>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={labelStyle}>{t('defaultYear')}</label>
                    <select style={inputStyle} value={year} onChange={e => setYear(Number(e.target.value))}>
                        {YEARS.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%' }}>
                    {t('save')}
                </button>

                {saved && (
                    <div style={{
                        marginTop: '12px', padding: '10px', textAlign: 'center',
                        background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: 'var(--radius-sm)', color: '#22c55e', fontSize: '14px',
                    }}>
                        {t('saved')}
                    </div>
                )}
            </div>
        </div>
    );
}
