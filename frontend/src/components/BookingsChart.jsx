import React, { useState } from 'react';
import { businessDate, formatBusinessDate } from '../utils/businessDates';
import './BookingsChart.css';

export default function BookingsChart({ trend, selectedCenter, isLoading }) {
    const [period, setPeriod] = useState('this');
    const days = trend?.slice(period === 'this' ? 7 : 0, period === 'this' ? 14 : 7).map(day => ({
        date: day.date,
        count: selectedCenter && selectedCenter !== 'All Centers'
            ? Number(day.centers[selectedCenter] || 0)
            : Object.values(day.centers).reduce((total, count) => total + Number(count), 0),
    })) || [];
    const total = days.reduce((sum, day) => sum + day.count, 0);
    const max = Math.max(1, ...days.map(day => day.count));
    const today = businessDate();

    return <section className="dash-box bookings-chart" aria-label="Daily bookings chart" aria-busy={isLoading}>
        <div className="dash-box-header bookings-chart-heading">
            <div><h3>Bookings by day</h3><p>{days.length > 0 ? `${formatBusinessDate(days[0].date)} – ${formatBusinessDate(days.at(-1).date)} · IST · Monday–Sunday` : 'Calendar week · IST'}</p></div>
            <div className="fmc-segmented-capsule">
                <button type="button" className={`fmc-segmented-btn ${period === 'this' ? 'active' : ''}`} aria-pressed={period === 'this'} onClick={() => setPeriod('this')}>This week</button>
                <button type="button" className={`fmc-segmented-btn ${period === 'last' ? 'active' : ''}`} aria-pressed={period === 'last'} onClick={() => setPeriod('last')}>Last week</button>
            </div>
        </div>
        {!trend ? <p role="status">{isLoading ? 'Loading bookings…' : 'Booking trend unavailable. Refresh to try again.'}</p> : <>
            <div className="bookings-chart-total"><strong>{total.toLocaleString('en-IN')}</strong> bookings <span>· {selectedCenter || 'All Centers'}</span></div>
            <div className="bookings-chart-plot" role="list" aria-label="Booking counts by date">
                {days.map(day => <div key={day.date} className={`bookings-chart-column ${day.date === today ? 'is-today' : ''}`} role="listitem" aria-label={`${formatBusinessDate(day.date)}: ${day.count} bookings${day.date === today ? ', today' : ''}`}>
                    <div className="bookings-chart-track">
                        <div className="bookings-chart-bar" style={{ height: `${day.count / max * 100}%` }} title={`${formatBusinessDate(day.date)}: ${day.count} bookings`}><span>{day.count}</span></div>
                    </div>
                    <span className="bookings-chart-day">{formatBusinessDate(day.date, { weekday: 'short' })}</span>
                    <small>{formatBusinessDate(day.date, { day: 'numeric', month: 'short' })}</small>
                </div>)}
            </div>
            {total === 0 && <p className="bookings-chart-empty">No bookings recorded for this week.</p>}
        </>}
    </section>;
}
