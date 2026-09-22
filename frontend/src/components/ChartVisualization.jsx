import React from 'react';
import './ChartVisualization.css';

export function ChartTypeSelect({ title, value, onChange, options }) {
    return <select className="chart-type-select" aria-label={`${title} visualization`} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>;
}

// A shared numeric scale keeps comparisons honest, including negative profit.
export default function ChartVisualization({ data, type, title, formatValue = String }) {
    const values = data.map(item => Number(item.value) || 0);
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const width = data.length <= 3 ? 360 : 640, height = 240;
    const left = 60, right = width - 20, top = 28, bottom = 198;
    const y = value => bottom - (value - min) / (max - min) * (bottom - top);
    const x = index => left + (index + 0.5) * (right - left) / Math.max(1, data.length);
    const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
    const description = data.map((item, index) => `${item.label}: ${formatValue(values[index])}`).join('; ');

    if (type === 'horizontal' || type === 'dot') {
        const zero = (0 - min) / (max - min) * 100;
        return <div className="comparison-chart" role="img" aria-label={`${title}: ${description}`}>
            {data.map((item, index) => {
                const end = (values[index] - min) / (max - min) * 100;
                return <div className="comparison-chart-row" key={item.label}>
                    <div className="comparison-chart-label"><span>{item.label}</span><strong>{formatValue(values[index])}</strong></div>
                    <div className="comparison-chart-track">
                        <span className="comparison-chart-zero" style={{ left: `${zero}%` }} />
                        <span className={type === 'dot' ? 'comparison-chart-dot' : 'comparison-chart-bar'} style={{ background: item.color || '#2563eb', left: `${type === 'dot' ? end : Math.min(zero, end)}%`, width: type === 'dot' ? undefined : `${Math.abs(end - zero)}%` }} />
                    </div>
                </div>;
            })}
        </div>;
    }

    return <svg className="comparison-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: ${description}`}>
        <title>{title}: {description}</title>
        {[min, min + (max - min) / 2, max].map(value => <g key={value}>
            <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#dbe3ef" strokeDasharray={value === 0 ? undefined : '4 4'} />
            <text x={left - 8} y={y(value) + 4} textAnchor="end" className="chart-axis-label">{formatValue(value)}</text>
        </g>)}
        {type === 'area' && data.length > 0 && <polygon points={`${x(0)},${y(0)} ${points} ${x(data.length - 1)},${y(0)}`} fill="#2563eb" opacity="0.16" />}
        {(type === 'line' || type === 'area') && <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="3" />}
        {data.map((item, index) => <g key={item.label}>
            {type === 'bar' ? <rect x={x(index) - 22} y={Math.min(y(0), y(values[index]))} width="44" height={Math.abs(y(values[index]) - y(0))} rx="3" fill={item.color || '#2563eb'} /> : <circle cx={x(index)} cy={y(values[index])} r="4" fill={item.color || '#2563eb'} />}
            <text x={x(index)} y={y(values[index]) - 9} textAnchor="middle" className="chart-value-label">{formatValue(values[index])}</text>
            <text x={x(index)} y={bottom + 25} textAnchor="middle" className="chart-axis-label">{item.label}</text>
            <title>{item.label}: {formatValue(values[index])}</title>
        </g>)}
    </svg>;
}
