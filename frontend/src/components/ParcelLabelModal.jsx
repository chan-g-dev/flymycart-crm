import { escapeHtml } from '../utils/html';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, Tag } from 'lucide-react';
import { printElement } from '../utils/printHelper';
import './ParcelLabel.css';

export default function ParcelLabelModal({ isOpen, onClose, data, settings }) {
    const [includeHeader, setIncludeHeader] = useState(false); // Default to clean minimalist photo sticker format
    const [labelSize, setLabelSize] = useState('4x6'); // '4x6' | 'a4'

    if (!isOpen || !data) return null;


    // Normalize Receiver details
    const receiverName = data.receiver_name || data.receiver?.name || 'Receiver Name';
    const receiverAddress = data.receiver_address || data.receiver?.address || '';
    const receiverCity = data.receiver_city || data.receiver?.city || '';
    const receiverState = data.receiver_state || data.receiver?.state || '';
    const receiverZip = data.receiver_zip || data.receiver?.zip || '';
    const receiverCountry = data.receiver_country || data.receiver?.country || 'USA';
    const receiverPhoneCode = data.receiver_phone_code || data.receiver?.phone_code || '';
    const receiverPhoneRaw = data.receiver_phone || data.receiver?.phone || '';
    const receiverPhone = receiverPhoneRaw 
        ? `${receiverPhoneCode ? receiverPhoneCode + ' ' : ''}${receiverPhoneRaw}`.trim()
        : '';

    // Receiver City + State line (cleanly formatted)
    let receiverCityState = '';
    if (receiverCity && receiverState) {
        receiverCityState = receiverCity.toLowerCase() === receiverState.toLowerCase()
            ? receiverCity
            : `${receiverCity} ${receiverState}`;
    } else {
        receiverCityState = receiverCity || receiverState;
    }

    // Normalize Sender details
    const senderName = data.same_sender === false && data.alternate_sender_name
        ? data.alternate_sender_name
        : (data.sender_name || data.sender?.name || data.customer_name || 'Sender Name');
    
    const senderAddress = data.sender_address || data.sender?.address || data.address || '';
    const senderCity = data.sender_city || data.sender?.city || '';
    const senderState = data.sender_state || data.sender?.state || '';
    const senderZip = data.sender_zip || data.sender?.zip || '';
    const senderPhoneRaw = data.same_sender === false && data.alternate_sender_phone
        ? data.alternate_sender_phone
        : (data.sender_phone || data.sender?.phone || data.mobile || '');
    const senderPhoneCode = data.sender_phone_code || '+91';
    const senderPhone = senderPhoneRaw
        ? `${senderPhoneCode ? senderPhoneCode + ' ' : ''}${senderPhoneRaw}`.trim()
        : '';

    let senderCityStateZip = '';
    const cityStateParts = [];
    if (senderCity) cityStateParts.push(senderCity);
    if (senderState && senderState.toLowerCase() !== (senderCity || '').toLowerCase()) {
        cityStateParts.push(senderState);
    }
    senderCityStateZip = cityStateParts.join(', ');
    if (senderZip) {
        senderCityStateZip = senderCityStateZip ? `${senderCityStateZip} - ${senderZip}` : senderZip;
    }

    // Shipment metadata
    const awb = data.awb || data.converted_awb || 'PROVISIONAL-AWB';
    const courier = data.courier || 'Express Courier';
    const weight = data.chargeable_weight || data.actual_weight || '0.50';
    const boxesCount = data.boxes?.length || data.packages_count || 1;
    const isDdp = Boolean(data.is_ddp);
    const isIntl = data.domestic_international === 'International' || (receiverCountry && receiverCountry.toLowerCase() !== 'india');

    const handlePrint = () => {
        printElement('printable-parcel-label', {
            title: `Parcel_Label_${awb}`,
            pageSize: labelSize === '4x6' ? '100mm 150mm' : 'A4',
            pageOrientation: 'portrait'
        });
    };

    const handleDownloadHtml = () => {
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Parcel Address Label - ${escapeHtml(awb)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 30px;
            background: #ffffff;
            color: #000000;
        }
        .parcel-physical-sticker {
            max-width: 440px;
            margin: 0 auto;
            border: 2px solid #000000;
            padding: 28px 32px;
            box-sizing: border-box;
        }
        .heading {
            font-size: 18px;
            font-weight: 800;
            margin-bottom: 6px;
        }
        .name {
            font-size: 15.5px;
            font-weight: 700;
            margin-bottom: 4px;
        }
        .line {
            font-size: 13.5px;
            margin-bottom: 2px;
            line-height: 1.4;
        }
        .contact {
            font-size: 14px;
            font-weight: 700;
            margin-top: 7px;
        }
        .divider {
            border: none;
            border-top: 1.5px dashed #64748b;
            margin: 22px 0 20px;
        }
        .topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000000;
            padding-bottom: 10px;
            margin-bottom: 18px;
        }
        @media print {
            body { padding: 0; }
            .parcel-physical-sticker { max-width: 100%; border: 2px solid #000000; }
        }
    </style>
</head>
<body onload="window.print()">
    <div class="parcel-physical-sticker">
        ${includeHeader ? `
        <div class="topbar">
            <div style="font-size: 14px; font-weight: 800; text-transform: uppercase;">${escapeHtml(settings?.companyName || 'Fly My Cart Logistics')}</div>
            <div style="text-align: right; font-size: 11px; font-weight: 700;">AWB: <strong>${escapeHtml(awb)}</strong><br>${escapeHtml(courier)} • ${escapeHtml(weight)} kg</div>
        </div>
        ` : ''}

        <div style="margin-bottom: 22px;">
            <div class="heading">To,</div>
            <div class="name">${escapeHtml(receiverName)}</div>
            ${receiverAddress ? `<div class="line">${escapeHtml(receiverAddress)}</div>` : ''}
            ${receiverCityState ? `<div class="line">${escapeHtml(receiverCityState)}</div>` : ''}
            ${receiverZip ? `<div class="line">${escapeHtml(receiverZip)}</div>` : ''}
            ${receiverCountry ? `<div class="line" style="font-weight: 700;">${escapeHtml(receiverCountry)}</div>` : ''}
            ${receiverPhone ? `<div class="contact">Contact: ${escapeHtml(receiverPhone)}</div>` : ''}
        </div>

        <hr class="divider" />

        <div style="margin-top: 12px;">
            <div class="heading">From,</div>
            <div class="name">${escapeHtml(senderName)}</div>
            ${senderAddress ? `<div class="line">${escapeHtml(senderAddress)}</div>` : ''}
            ${senderCityStateZip ? `<div class="line">${escapeHtml(senderCityStateZip)}</div>` : ''}
            ${senderPhone ? `<div class="contact">Ph: ${escapeHtml(senderPhone)}</div>` : ''}
        </div>

        ${includeHeader ? `
        <div style="margin-top: 20px; padding-top: 10px; border-top: 2px solid #000000; display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 800; text-transform: uppercase;">
            <span>Route: ${isIntl ? 'International' : 'Domestic'}${isIntl ? (isDdp ? ' (DDP Paid)' : ' (DDP Not Paid)') : ''}</span>
            <span>Pieces: ${escapeHtml(boxesCount)} Box${boxesCount > 1 ? 'es' : ''} (${escapeHtml(weight)} kg)</span>
        </div>
        ` : ''}
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Parcel_Label_${awb || 'shipment'}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return createPortal(
        <div className="parcel-label-overlay" onClick={onClose}>
            <div className="parcel-label-modal-container" onClick={e => e.stopPropagation()}>
                {/* Modern Studio Header */}
                <div className="parcel-studio-header">
                    <div className="parcel-studio-brand">
                        <div className="parcel-studio-icon">
                            <Tag size={19} />
                        </div>
                        <div className="parcel-studio-title">
                            <h2>Parcel Box Address Sticker</h2>
                            <p>Print-ready dispatch label for parcel box packaging</p>
                        </div>
                    </div>
                    <div className="parcel-studio-badges">
                        <span className={`parcel-scope-pill ${isIntl ? 'intl' : 'dom'}`}>
                            {isIntl ? `✈️ ${receiverCountry || 'International'}` : '🚚 Domestic'}
                        </span>
                        {isIntl && (
                            <span 
                                className="parcel-scope-pill" 
                                style={{ background: isDdp ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: isDdp ? '#34d399' : '#fbbf24', border: `1px solid ${isDdp ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}` }}
                            >
                                {isDdp ? 'DDP Paid' : 'DDP Not Paid'}
                            </span>
                        )}
                        <button 
                            type="button" 
                            className="parcel-close-btn" 
                            onClick={onClose}
                            title="Close preview"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Workspace Body */}
                <div className="parcel-studio-body">
                    {/* Realistic Preview Canvas */}
                    <div className="parcel-preview-canvas">
                        <div id="printable-parcel-label" className={`parcel-physical-sticker sticker-size-${labelSize}`}>
                            {/* Optional Header Banner */}
                            {includeHeader && (
                                <div className="sticker-header-strip">
                                    <div>
                                        <div className="sticker-brand-name">
                                            {settings?.companyName || 'Fly My Cart Logistics'}
                                        </div>
                                        <div className="sticker-brand-sub">Express Parcel Delivery</div>
                                    </div>
                                    <div className="sticker-meta-col">
                                        <div className="sticker-awb-box">AWB: {awb}</div>
                                        <div>{courier} • {weight} kg</div>
                                    </div>
                                </div>
                            )}

                            {/* TO Section (Receiver) */}
                            <div className="sticker-address-block">
                                <div className="sticker-section-title">To,</div>
                                <div className="sticker-party-name">{receiverName}</div>
                                {receiverAddress && <div className="sticker-line">{receiverAddress}</div>}
                                {receiverCityState && <div className="sticker-line">{receiverCityState}</div>}
                                {receiverZip && <div className="sticker-line">{receiverZip}</div>}
                                {receiverCountry && <div className="sticker-line sticker-line-bold">{receiverCountry}</div>}
                                {receiverPhone && (
                                    <div className="sticker-contact-row">
                                        Contact: {receiverPhone}
                                    </div>
                                )}
                            </div>

                            <hr className="sticker-divider-dashed" />

                            {/* FROM Section (Sender) */}
                            <div className="sticker-address-block" style={{ marginBottom: includeHeader ? '20px' : '6px' }}>
                                <div className="sticker-section-title">From,</div>
                                <div className="sticker-party-name">{senderName}</div>
                                {senderAddress && <div className="sticker-line">{senderAddress}</div>}
                                {senderCityStateZip && <div className="sticker-line">{senderCityStateZip}</div>}
                                {senderPhone && (
                                    <div className="sticker-contact-row">
                                        Ph: {senderPhone}
                                    </div>
                                )}
                            </div>

                            {/* Optional Footer Strip */}
                            {includeHeader && (
                                <div className="sticker-footer-strip">
                                    <span>
                                        Route: {isIntl ? 'International' : 'Domestic'}
                                        {isIntl && ` (${isDdp ? 'DDP Paid' : 'DDP Not Paid'})`}
                                    </span>
                                    <span>{boxesCount} Box{boxesCount > 1 ? 'es' : ''} • {weight} kg</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Controls Panel */}
                    <div className="parcel-studio-controls">
                        <div>
                            <div className="control-section-header">Label Format</div>
                            <div className="label-size-toggle">
                                <button 
                                    type="button" 
                                    className={`size-btn ${labelSize === '4x6' ? 'active' : ''}`}
                                    onClick={() => setLabelSize('4x6')}
                                >
                                    📦 4" × 6" Sticker
                                </button>
                                <button 
                                    type="button" 
                                    className={`size-btn ${labelSize === 'a4' ? 'active' : ''}`}
                                    onClick={() => setLabelSize('a4')}
                                >
                                    📄 A4 Sheet
                                </button>
                            </div>
                        </div>

                        <div>
                            <div className="control-section-header">Label Options</div>
                            <div className="label-option-card">
                                <label className="custom-checkbox-row">
                                    <input 
                                        type="checkbox" 
                                        checked={includeHeader} 
                                        onChange={e => setIncludeHeader(e.target.checked)} 
                                    />
                                    <span>Include AWB & Courier Bar</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <div className="control-section-header">Consignment Info</div>
                            <div className="label-details-box">
                                <div className="label-details-row">
                                    <span>Receiver:</span>
                                    <strong>{receiverName}</strong>
                                </div>
                                <div className="label-details-row">
                                    <span>Destination:</span>
                                    <strong>{receiverCountry || 'Domestic'}</strong>
                                </div>
                                <div className="label-details-row">
                                    <span>Courier:</span>
                                    <strong>{courier}</strong>
                                </div>
                                <div className="label-details-row">
                                    <span>Weight:</span>
                                    <strong>{weight} kg</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action Bar */}
                <div className="parcel-studio-footer">
                    <div className="footer-tip">
                        💡 <span>Fits standard thermal shipping label printers and laser paper</span>
                    </div>

                    <div className="footer-actions-group">
                        <button 
                            type="button" 
                            className="btn-label-download"
                            onClick={handleDownloadHtml}
                            title="Download label document file"
                        >
                            <Download size={16} />
                            <span>Download File</span>
                        </button>
                        <button 
                            type="button" 
                            className="btn-label-print"
                            onClick={handlePrint}
                            title="Print label now"
                        >
                            <Printer size={16} />
                            <span>Print Label</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
