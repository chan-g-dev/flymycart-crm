import { LoadingSpinner } from './LoadingSpinner';
import React, { useState } from 'react';
import { businessDate, formatBusinessDate } from '../utils/businessDates';
import { Calendar, X } from 'lucide-react';
import './BookingsChart.css';
import ChartVisualization, { ChartTypeSelect } from './ChartVisualization';

export default function BookingsChart({ trend, selectedCenter, isLoading, selectedDate, onSelectDate }) {
    const [period, setPeriod] = useState('this');
    const [chartType, setChartType] = useState('bar');
    const days = trend?.slice(period === 'this' ? 7 : 0, period === 'this' ? 14 : 7).map(day => ({
        date: day.date,
        count: selectedCenter && selectedCenter !== 'All Centers'
            ? Number(day.centers[selectedCenter] || 0)
            : Object.values(day.centers).reduce((total, count) => total + Number(count), 0),
    })) || [];
    const total = days.reduce((sum, day) => sum + day.count, 0);
    const max = Math.max(1, ...days.map(day => day.count));
    const today = businessDate();

    const handleDayClick = (date) => {
        if (!onSelectDate) return;
        if (selectedDate === date) {
            onSelectDate('');
        } else {
            onSelectDate(date);
        }
    };

    return <section className="dash-box bookings-chart" aria-label="Daily bookings chart" aria-busy={isLoading}>
        <div className="dash-box-header bookings-chart-heading">
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0 }}>Bookings by day</h3>
                    {selectedDate && (
                        <span className="bookings-active-pill">
                            Filtered: {formatBusinessDate(selectedDate, { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                </div>
                <p>{days.length > 0 ? `${formatBusinessDate(days[0].date)} – ${formatBusinessDate(days.at(-1).date)} · IST · Monday–Sunday` : 'Calendar week · IST'}</p>
            </div>
            <div className="chart-panel-controls">
                <div className="bookings-calendar-filter" title="Filter bookings by specific calendar date">
                    <Calendar size={13} className="calendar-icon" />
                    <input 
                        type="date" 
                        aria-label="Filter bookings by date"
                        value={selectedDate || ''} 
                        onChange={e => onSelectDate && onSelectDate(e.target.value)}
                        className="bookings-date-input"
                    />
                    {selectedDate && (
                        <button 
                            type="button" 
                            className="bookings-date-clear-btn" 
                            onClick={() => onSelectDate && onSelectDate('')}
                            title="Clear date filter (show all)"
                            aria-label="Clear date filter"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
                <ChartTypeSelect title="Bookings by day" value={chartType} onChange={setChartType} options={[['bar', 'Bar'], ['line', 'Line'], ['area', 'Area'], ['horizontal', 'Horizontal bar']]} />
                <div className="fmc-segmented-capsule">
                    <button type="button" className={`fmc-segmented-btn ${period === 'this' ? 'active' : ''}`} aria-pressed={period === 'this'} onClick={() => setPeriod('this')}>This week</button>
                    <button type="button" className={`fmc-segmented-btn ${period === 'last' ? 'active' : ''}`} aria-pressed={period === 'last'} onClick={() => setPeriod('last')}>Last week</button>
                </div>
            </div>
        </div>
        {!trend ? <p role="status">{isLoading ? <LoadingSpinner inline text="Loading bookings…" /> : 'Booking trend unavailable. Refresh to try again.'}</p> : <>
            <div className="bookings-chart-total-row">
                <div className="bookings-chart-total">
                    <strong>{total.toLocaleString('en-IN')}</strong> bookings 
                    <span>· {selectedCenter || 'All Centers'}</span>
                </div>
                {selectedDate && (
                    <div className="bookings-selected-date-callout">
                        <span>📅 Viewing bookings for <strong>{formatBusinessDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                        <button type="button" onClick={() => onSelectDate && onSelectDate('')}>Show all dates &times;</button>
                    </div>
                )}
            </div>
            {chartType !== 'bar' ? (
                <ChartVisualization title="Bookings by day" type={chartType} data={days.map(day => ({ label: formatBusinessDate(day.date, { weekday: 'short' }), value: day.count }))} />
            ) : (
                <div className="bookings-chart-plot" role="list" aria-label="Booking counts by date">
                    {days.map(day => {
                        const isSelected = selectedDate === day.date;
                        return (
                            <div 
                                key={day.date} 
                                className={`bookings-chart-column ${day.date === today ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`} 
                                role="button" 
                                tabIndex={0}
                                onClick={() => handleDayClick(day.date)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDayClick(day.date); } }}
                                title={`Click to view ${day.count} booking${day.count === 1 ? '' : 's'} on ${formatBusinessDate(day.date)}`}
                                aria-label={`${formatBusinessDate(day.date)}: ${day.count} bookings${day.date === today ? ', today' : ''}${isSelected ? ', selected' : ''}`}
                            >
                                <div className="bookings-chart-track">
                                    <div className="bookings-chart-bar" style={{ height: `${day.count / max * 100}%` }}>
                                        <span>{day.count}</span>
                                    </div>
                                </div>
                                <span className="bookings-chart-day">{formatBusinessDate(day.date, { weekday: 'short' })}</span>
                                <small>{formatBusinessDate(day.date, { day: 'numeric', month: 'short' })}</small>
                            </div>
                        );
                    })}
                </div>
            )}
            {total === 0 && <p className="bookings-chart-empty">No bookings recorded for this week.</p>}
        </>}
    </section>;
}
