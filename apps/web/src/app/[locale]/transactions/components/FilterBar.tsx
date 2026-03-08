'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TRANSACTION_TYPES, inputStyle, labelStyle } from './shared';
import type { TransactionFilters } from '@/lib/api';

interface FilterBarProps {
    onApply: (filters: TransactionFilters) => void;
}

export function FilterBar({ onApply }: FilterBarProps) {
    const t = useTranslations('transactions.filter');
    const tType = useTranslations('txTypes');

    const [asset, setAsset] = useState('');
    const [type, setType] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    function handleApply() {
        const filters: TransactionFilters = {};
        if (asset.trim()) filters.asset = asset.trim().toUpperCase();
        if (type) filters.type = type;
        if (from) filters.from = new Date(from).toISOString();
        if (to) filters.to = new Date(to + 'T23:59:59').toISOString();
        onApply(filters);
    }

    function handleClear() {
        setAsset('');
        setType('');
        setFrom('');
        setTo('');
        onApply({});
    }

    const hasFilters = asset || type || from || to;

    return (
        <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', alignItems: 'end' }}>
                <div>
                    <label style={labelStyle}>{t('asset')}</label>
                    <input
                        style={inputStyle}
                        placeholder={t('assetPlaceholder')}
                        value={asset}
                        onChange={e => setAsset(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleApply()}
                    />
                </div>
                <div>
                    <label style={labelStyle}>{t('type')}</label>
                    <select style={inputStyle} value={type} onChange={e => setType(e.target.value)}>
                        <option value="">{t('allTypes')}</option>
                        {TRANSACTION_TYPES.map(tp => (
                            <option key={tp} value={tp}>{tType(tp)}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>{t('dateFrom')}</label>
                    <input
                        type="date"
                        style={inputStyle}
                        value={from}
                        onChange={e => setFrom(e.target.value)}
                    />
                </div>
                <div>
                    <label style={labelStyle}>{t('dateTo')}</label>
                    <input
                        type="date"
                        style={inputStyle}
                        value={to}
                        onChange={e => setTo(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={handleApply} style={{ flex: 1 }}>
                        {t('apply')}
                    </button>
                    {hasFilters && (
                        <button className="btn btn-secondary" onClick={handleClear}>
                            {t('clear')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
