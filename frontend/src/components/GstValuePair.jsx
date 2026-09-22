import React from 'react';

export default function GstValuePair({ excluding, including, formatValue }) {
    const format = value => value == null ? '—' : formatValue(value);
    return <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', maxWidth: '100%' }}>
        <span><strong>{format(excluding)}</strong> <small style={{ fontSize: '10px', fontWeight: 500 }}>Excl. GST</small></span>
        <span title="Includes sales GST; before GST settlement" style={{ fontSize: '12px' }}><strong>{format(including)}</strong> <small style={{ fontSize: '10px', fontWeight: 500 }}>Incl. GST</small></span>
    </span>;
}
