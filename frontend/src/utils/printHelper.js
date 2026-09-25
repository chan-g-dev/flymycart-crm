/**
 * Ultra-reliable Print Helper for Invoices, Parcel Labels, Customer Statements, and Operational Reports
 * Clones the printable section into an in-viewport hidden iframe with rock-solid Light Theme token enforcement.
 */

export function printElement(elementOrId, options = {}) {
    const element = typeof elementOrId === 'string' 
        ? document.getElementById(elementOrId) 
        : elementOrId;

    if (!element) {
        console.warn('Print target element not found:', elementOrId);
        window.print();
        return;
    }

    const {
        title = 'Fly My Cart Document',
        pageOrientation = 'portrait', // 'portrait' | 'landscape'
        pageSize = 'A4'
    } = options;

    // Collect all stylesheets and style rules from current page
    let stylesHtml = '';
    try {
        const styleElements = document.querySelectorAll('style, link[rel="stylesheet"]');
        styleElements.forEach(el => {
            stylesHtml += el.outerHTML;
        });
    } catch (e) {
        console.warn('Failed to collect document styles:', e);
    }

    // Remove any previously created print iframe
    const oldIframe = document.getElementById('fmc-dedicated-print-iframe');
    if (oldIframe && oldIframe.parentNode) {
        oldIframe.parentNode.removeChild(oldIframe);
    }

    // Create an in-viewport hidden iframe (Chrome requires non-zero in-bounds viewport dimensions to layout and render print output)
    const printIframe = document.createElement('iframe');
    printIframe.id = 'fmc-dedicated-print-iframe';
    printIframe.setAttribute('aria-hidden', 'true');
    printIframe.style.position = 'fixed';
    printIframe.style.top = '0';
    printIframe.style.left = '0';
    printIframe.style.width = '100vw';
    printIframe.style.height = '100vh';
    printIframe.style.border = '0';
    printIframe.style.zIndex = '-99999';
    printIframe.style.opacity = '0.0001';
    printIframe.style.pointerEvents = 'none';
    printIframe.style.background = '#ffffff';

    document.body.appendChild(printIframe);

    const doc = printIframe.contentWindow?.document || printIframe.contentDocument;
    if (!doc) {
        console.error('Cannot access print iframe document');
        window.print();
        return;
    }

    const baseHref = window.location.origin + '/';

    const printableHtml = `
<!DOCTYPE html>
<html lang="en" data-theme="light">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <base href="${baseHref}" />
        <title>Fly My Cart Document</title>
        ${stylesHtml}
        <style>
            /* 1. Global High-Specificity Light Palette Override (Neutralizes Dark Mode on Paper/PDF) */
            :root, 
            [data-theme="dark"], 
            [data-theme="light"], 
            html, 
            body, 
            div, 
            span, 
            h1, h2, h3, h4, h5, h6, 
            p, td, th, table, strong, b, em {
                --primary-blue: #1e64f0 !important;
                --primary-blue-hover: #1551c9 !important;
                --primary-blue-soft: #eff6ff !important;
                --bg-app: #f8fafc !important;
                --card-bg: #ffffff !important;
                --bg-card: #ffffff !important;
                --card-border: #cbd5e1 !important;
                --text-main: #0f172a !important;
                --text-muted: #475569 !important;
                --text-subtle: #64748b !important;
                --text-light: #94a3b8 !important;
                --emerald: #059669 !important;
                --emerald-soft: #ecfdf5 !important;
                --amber: #d97706 !important;
                --amber-soft: #fffbeb !important;
                --rose: #dc2626 !important;
                --rose-soft: #fef2f2 !important;
                --sky: #0284c7 !important;
                --sky-soft: #f0f9ff !important;
                --violet: #7c3aed !important;
                --violet-soft: #f5f3ff !important;
                --radius-sm: 6px !important;
                --radius-md: 8px !important;
                --radius-lg: 10px !important;
            }

            @page {
                size: ${pageSize} ${pageOrientation};
                margin: 8mm 10mm 8mm 10mm;
            }

            *, *::before, *::after {
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }

            html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #0f172a !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                font-size: 11.5px !important;
                line-height: 1.4 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
            }

            /* Force black/dark text on headings and paragraphs */
            h1, h2, h3, h4, h5, h6, strong, b, th {
                color: #0f172a !important;
            }

            p, span, td, div {
                color: inherit;
            }

            .no-print, button, .modal-close, .btn, .fmc-request-activity, .fmc-page-loading, .invoice-logo-controls {
                display: none !important;
            }

            .printable-wrapper,
            .printable-wrapper * {
                visibility: visible !important;
            }

            .printable-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                background: #ffffff !important;
                padding: 4px !important;
                margin: 0 !important;
                display: block !important;
            }

            /* Container and card visibility overrides */
            #printable-invoice, 
            #printable-report-eod, 
            #printable-report-weekly, 
            #printable-report-monthly, 
            #printable-parcel-label, 
            #printable-customer-drawer, 
            .invoice-container, 
            .fmc-report-hero-card {
                display: block !important;
                visibility: visible !important;
                width: 100% !important;
                max-width: 100% !important;
                background: #ffffff !important;
                color: #0f172a !important;
                border: 1px solid #cbd5e1 !important;
                box-shadow: none !important;
                margin: 0 0 16px 0 !important;
                padding: 18px !important;
                border-radius: 10px !important;
            }

            /* KPI Cards & Hero Metrics */
            .fmc-kpi-grid, .weekly-kpi-grid {
                display: grid !important;
                grid-template-columns: repeat(4, 1fr) !important;
                gap: 12px !important;
                margin-bottom: 16px !important;
            }

            .fmc-kpi-card, .weekly-kpi {
                border: 1px solid #cbd5e1 !important;
                background: #f8fafc !important;
                padding: 12px !important;
                border-radius: 8px !important;
                break-inside: avoid !important;
                box-shadow: none !important;
            }

            .fmc-kpi-card-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 6px !important;
            }

            .fmc-kpi-tag {
                font-size: 11px !important;
                font-weight: 700 !important;
                color: #475569 !important;
            }

            .fmc-kpi-val {
                font-size: 20px !important;
                font-weight: 900 !important;
                color: #0f172a !important;
                margin-bottom: 2px !important;
            }

            .fmc-kpi-sub {
                font-size: 10.5px !important;
                color: #64748b !important;
            }

            /* Breakdown Panels & Boxes */
            .fmc-breakdown-box, .weekly-table-panel {
                background: #ffffff !important;
                border: 1px solid #cbd5e1 !important;
                padding: 14px !important;
                border-radius: 8px !important;
                break-inside: avoid !important;
                margin-bottom: 12px !important;
            }

            .fmc-breakdown-header, .weekly-panel-title {
                color: #0f172a !important;
                font-weight: 800 !important;
                font-size: 12.5px !important;
                border-bottom: 1px solid #e2e8f0 !important;
                padding-bottom: 8px !important;
                margin-bottom: 10px !important;
                display: flex !important;
                justify-content: space-between !important;
            }

            .fmc-breakdown-item {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                padding: 6px 0 !important;
                border-bottom: 1px solid #f1f5f9 !important;
                color: #0f172a !important;
            }

            /* Invoice layout rules */
            .invoice-brand {
                display: flex !important;
                justify-content: space-between !important;
                align-items: flex-start !important;
                border-bottom: 2px solid #1e64f0 !important;
                padding-bottom: 14px !important;
                margin-bottom: 16px !important;
                break-inside: avoid !important;
            }

            .invoice-metadata-grid {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 12px !important;
                margin-bottom: 16px !important;
                break-inside: avoid !important;
            }

            .invoice-metadata-grid > div {
                background: #f8fafc !important;
                border: 1px solid #cbd5e1 !important;
                padding: 10px 12px !important;
                border-radius: 6px !important;
            }

            .invoice-summary-grid {
                display: grid !important;
                grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr) !important;
                gap: 14px !important;
                align-items: start !important;
                break-inside: avoid !important;
            }

            .invoice-totals {
                background: #f8fafc !important;
                border: 1px solid #cbd5e1 !important;
                padding: 12px 14px !important;
                border-radius: 6px !important;
            }

            /* Tables in print */
            table, .data-table, .weekly-data-table {
                width: 100% !important;
                border-collapse: collapse !important;
                page-break-inside: auto !important;
                color: #0f172a !important;
                margin-bottom: 16px !important;
            }

            th, td {
                padding: 7px 10px !important;
                font-size: 11px !important;
                border-bottom: 1px solid #e2e8f0 !important;
                color: #0f172a !important;
            }

            th {
                background: #f8fafc !important;
                font-weight: 800 !important;
                color: #1e293b !important;
            }

            tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }

            /* Status Pills and Badges */
            .status-pill, .ddp-tag-paid, .ddp-tag-unpaid {
                display: inline-block !important;
                font-size: 10px !important;
                font-weight: 800 !important;
                padding: 2px 7px !important;
                border-radius: 4px !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            .status-pill.delivered, .ddp-tag-paid {
                background: #ecfdf5 !important;
                color: #059669 !important;
                border: 1px solid #a7f3d0 !important;
            }

            .status-pill.delayed, .status-pill.unpaid, .ddp-tag-unpaid {
                background: #fef2f2 !important;
                color: #dc2626 !important;
                border: 1px solid #fecaca !important;
            }
        </style>
    </head>
    <body>
        <div class="printable-wrapper">
            ${element.outerHTML}
        </div>
    </body>
</html>
    `;

    doc.open();
    doc.write(printableHtml);
    doc.close();
    // Customer names and document numbers are text, never HTML markup.
    doc.title = String(title);

    const triggerPrint = () => {
        try {
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
        } catch (err) {
            console.error('Print iframe error, fallback to window.print():', err);
            window.print();
        }
    };

    if (printIframe.contentWindow) {
        printIframe.contentWindow.onafterprint = () => {
            setTimeout(() => {
                if (printIframe.parentNode) {
                    printIframe.parentNode.removeChild(printIframe);
                }
            }, 500);
        };
    }

    // Wait for any images inside the iframe to finish loading before opening print dialog
    const iframeImages = doc.querySelectorAll('img');
    if (iframeImages.length > 0) {
        const imagePromises = Array.from(iframeImages).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        });
        Promise.all(imagePromises).then(() => {
            setTimeout(triggerPrint, 250);
        });
    } else {
        setTimeout(triggerPrint, 250);
    }
}
