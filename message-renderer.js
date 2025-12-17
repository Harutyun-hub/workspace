function normalizeEnvelope(response) {
    try {
        if (!response) {
            return { answer_type: 'text', text: '' };
        }

        if (typeof response === 'string') {
            return { answer_type: 'text', text: response };
        }

        let envelope = response;
        
        if (Array.isArray(envelope)) {
            envelope = envelope[0] || {};
        }

        if (envelope.output || envelope.response) {
            const content = envelope.output || envelope.response;
            if (typeof content === 'string') {
                return { answer_type: 'text', text: content };
            }
            envelope = content;
        }

        const answerType = envelope.answer_type || 'text';
        
        let normalizedData = envelope.data || envelope.rows || envelope.items || [];
        if (typeof normalizedData === 'string' && normalizedData.trim().startsWith('[')) {
            try {
                normalizedData = JSON.parse(normalizedData);
            } catch (e) {
                console.warn('Failed to parse stringified array', e);
                normalizedData = [];
            }
        }

        if (answerType === 'media_gallery' && normalizedData.length > 0) {
            normalizedData = normalizedData.map(item => ({
                url: item.image || item.url || item.src || item.video,
                videoUrl: item.video || (item.media_type === 'video' ? (item.url || item.src) : null),
                caption: item.cta || item.caption || item.alt || item.name || '',
                link: item.link,
                platform: item.platform,
                media_type: item.media_type || (item.video ? 'video' : 'image')
            }));
        }

        return {
            answer_type: answerType,
            title: envelope.title || '',
            text: envelope.text || envelope.content || envelope.note || '',
            data: normalizedData,
            chart_type: envelope.chart_type || envelope.chartType || 'bar',
            note: envelope.note || ''
        };
    } catch (error) {
        console.error('Error normalizing envelope:', error);
        return { answer_type: 'text', text: String(response) };
    }
}

function renderMessage(content) {
    try {
        const envelope = normalizeEnvelope(content);
        
        const renderers = {
            text: renderText,
            chart: renderChart,
            table: renderTable,
            media_gallery: renderMediaGallery
        };

        const renderer = renderers[envelope.answer_type] || renderText;
        return renderer(envelope);
    } catch (error) {
        console.error('Error rendering message:', error);
        return renderText({ text: 'An error occurred while rendering this message.' });
    }
}

function renderText(envelope) {
    const text = envelope.text || envelope.content || '';
    return formatMessageContent(text);
}

function renderTitleAndNote(envelope) {
    let html = '';
    
    if (envelope.title) {
        html += `<div class="message-title">${escapeHtml(envelope.title)}</div>`;
    }
    
    if (envelope.note || envelope.text) {
        const noteText = envelope.note || envelope.text;
        html += `<div class="message-note">${escapeHtml(noteText)}</div>`;
    }
    
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderChart(envelope) {
    const chartId = 'chart-' + Math.random().toString(36).substr(2, 9);
    const data = envelope.data || [];
    
    if (!data.length) {
        return renderTitleAndNote(envelope) + '<p class="empty-state">No data available for chart</p>';
    }

    const labels = data.map(d => d.name || d.label || '');
    const chartType = envelope.chart_type || 'bar';
    
    const hasMultipleDatasets = data[0] && (data[0].value2 !== undefined || data[0].values !== undefined);
    
    let datasets = [];
    if (hasMultipleDatasets) {
        const value1 = data.map(d => d.value || d.value1 || 0);
        const value2 = data.map(d => d.value2 || 0);
        datasets = [
            {
                label: envelope.dataset1_label || 'Primary',
                data: value1,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: '#3b82f6',
                borderWidth: 2,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                tension: 0.3,
                fill: chartType === 'line'
            },
            {
                label: envelope.dataset2_label || 'Secondary',
                data: value2,
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderColor: '#22c55e',
                borderWidth: 2,
                pointBackgroundColor: '#22c55e',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                tension: 0.3,
                fill: false
            }
        ];
    } else {
        const values = data.map(d => d.value || d.count || 0);
        datasets = [{
            label: envelope.title || 'Data',
            data: values,
            backgroundColor: chartType === 'line' ? 'rgba(59, 130, 246, 0.1)' : [
                'rgba(59, 130, 246, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(234, 179, 8, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(168, 85, 247, 0.8)',
                'rgba(14, 165, 233, 0.8)'
            ],
            borderColor: chartType === 'line' ? '#3b82f6' : [
                '#3b82f6',
                '#22c55e',
                '#eab308',
                '#ef4444',
                '#a855f7',
                '#0ea5e9'
            ],
            borderWidth: 2,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.3,
            fill: chartType === 'line'
        }];
    }

    const title = envelope.title || '';
    const subtitle = envelope.subtitle || envelope.note || '';

    let html = `<div class="chart-wrapper">`;
    if (title || subtitle) {
        html += `<div class="chart-header">`;
        if (title) {
            html += `<div class="chart-title">${escapeHtml(title)}</div>`;
        }
        if (subtitle) {
            html += `<div class="chart-subtitle">${escapeHtml(subtitle)}</div>`;
        }
        html += `</div>`;
    }
    html += `<div class="chart-container">
        <canvas id="${chartId}"></canvas>
    </div></div>`;

    setTimeout(() => {
        const canvas = document.getElementById(chartId);
        if (!canvas) return;

        const container = canvas.parentElement;
        if (container._chartInstance) {
            container._chartInstance.destroy();
            container._chartInstance = null;
        }

        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
            return;
        }

        const config = {
            type: chartType,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: chartType === 'pie' || chartType === 'doughnut' || hasMultipleDatasets,
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 16,
                            font: {
                                size: 12,
                                family: "'Inter', sans-serif"
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1f2937',
                        bodyColor: '#4b5563',
                        borderColor: 'rgba(0, 0, 0, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            size: 13,
                            weight: '600',
                            family: "'Inter', sans-serif"
                        },
                        bodyFont: {
                            size: 12,
                            family: "'Inter', sans-serif"
                        }
                    }
                },
                scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 12,
                                family: "'Inter', sans-serif"
                            },
                            color: '#6b7280'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 12,
                                family: "'Inter', sans-serif"
                            },
                            color: '#6b7280',
                            padding: 8
                        }
                    }
                } : {}
            }
        };

        container._chartInstance = new Chart(canvas, config);
    }, 10);

    return html;
}

function renderTable(envelope) {
    const data = envelope.data || [];
    
    if (!data.length) {
        return renderTitleAndNote(envelope) + '<p class="empty-state">No data available for table</p>';
    }

    const columns = Object.keys(data[0] || {});
    if (!columns.length) {
        return renderTitleAndNote(envelope) + '<p class="empty-state">No data available</p>';
    }

    function normalizeColumnName(col) {
        return col.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    }
    
    function formatColumnHeader(col) {
        return col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    function isCompanyColumn(colName) {
        const companyKeywords = ['company', 'brand', 'advertiser', 'page_name', 'competitor'];
        return companyKeywords.some(k => colName.toLowerCase().includes(k));
    }
    
    function isStatusColumn(colName) {
        const statusKeywords = ['status', 'state', 'availability', 'stock'];
        return statusKeywords.some(k => colName.toLowerCase().includes(k));
    }
    
    function isGrowthColumn(colName) {
        const growthKeywords = ['growth', 'change', 'diff', 'delta', 'percent'];
        return growthKeywords.some(k => colName.toLowerCase().includes(k));
    }
    
    function getCompanyLogoUrl(companyName) {
        if (!companyName || typeof window.getChatCompanyLogo !== 'function') return null;
        return window.getChatCompanyLogo(companyName);
    }
    
    function renderCompanyCell(value) {
        if (!value) return '';
        const companyName = String(value).trim();
        const logoUrl = getCompanyLogoUrl(companyName);
        const displayName = escapeHtml(companyName);
        
        if (logoUrl) {
            return `<div class="table-company-cell">
                <img src="${escapeHtml(logoUrl)}" alt="${displayName}" class="table-company-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="table-company-fallback" style="display: none;">${displayName.charAt(0).toUpperCase()}</div>
                <span class="table-company-name">${displayName}</span>
            </div>`;
        }
        return `<div class="table-company-cell">
            <div class="table-company-fallback">${displayName.charAt(0).toUpperCase()}</div>
            <span class="table-company-name">${displayName}</span>
        </div>`;
    }
    
    function getStatusInfo(value) {
        const val = String(value).toLowerCase().trim();
        const statusMap = {
            'in stock': { color: 'green', label: 'In Stock' },
            'instock': { color: 'green', label: 'In Stock' },
            'available': { color: 'green', label: 'Available' },
            'active': { color: 'green', label: 'Active' },
            'success': { color: 'green', label: 'Success' },
            'completed': { color: 'green', label: 'Completed' },
            'approved': { color: 'green', label: 'Approved' },
            'low stock': { color: 'yellow', label: 'Low Stock' },
            'lowstock': { color: 'yellow', label: 'Low Stock' },
            'limited': { color: 'yellow', label: 'Limited' },
            'pending': { color: 'yellow', label: 'Pending' },
            'warning': { color: 'yellow', label: 'Warning' },
            'review': { color: 'yellow', label: 'Review' },
            'out of stock': { color: 'red', label: 'Out of Stock' },
            'outofstock': { color: 'red', label: 'Out of Stock' },
            'unavailable': { color: 'red', label: 'Unavailable' },
            'inactive': { color: 'red', label: 'Inactive' },
            'failed': { color: 'red', label: 'Failed' },
            'rejected': { color: 'red', label: 'Rejected' },
            'error': { color: 'red', label: 'Error' },
            'discontinued': { color: 'gray', label: 'Discontinued' }
        };
        
        for (const [key, info] of Object.entries(statusMap)) {
            if (val.includes(key) || val === key) {
                return info;
            }
        }
        
        return { color: 'blue', label: value };
    }
    
    const TEXT_TRUNCATE_LENGTH = 80;
    
    function isImageUrl(str) {
        if (!str || typeof str !== 'string') return false;
        const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
        const imageHosts = /(googleusercontent|s0\.2mdn\.net|fbcdn|cloudinary|imgur|unsplash)/i;
        return imageExtensions.test(str) || imageHosts.test(str);
    }
    
    function isUrl(str) {
        if (!str || typeof str !== 'string') return false;
        return /^https?:\/\//i.test(str.trim());
    }
    
    function formatCellValue(value, colName) {
        if (value === undefined || value === null) return '';
        
        const strValue = String(value).trim();
        
        if (isCompanyColumn(colName)) {
            return renderCompanyCell(value);
        }
        
        if (isStatusColumn(colName)) {
            const status = getStatusInfo(value);
            return `<span class="status-indicator"><span class="status-dot status-${status.color}"></span>${escapeHtml(status.label)}</span>`;
        }
        
        if (isGrowthColumn(colName)) {
            const numValue = parseFloat(strValue.replace(/[^-0-9.]/g, ''));
            if (!isNaN(numValue)) {
                const isPositive = numValue >= 0;
                const formattedValue = strValue.includes('%') ? strValue : (isPositive ? '+' : '') + numValue + '%';
                return `<span class="${isPositive ? 'growth-positive' : 'growth-negative'}">${escapeHtml(formattedValue)}</span>`;
            }
        }
        
        if (isImageUrl(strValue)) {
            const uniqueId = 'img-thumb-' + Math.random().toString(36).substr(2, 9);
            return `<div class="table-image-cell">
                <a href="${escapeHtml(strValue)}" target="_blank" rel="noopener noreferrer" class="table-image-link">
                    <img src="${escapeHtml(strValue)}" alt="Preview" class="table-image-thumb" id="${uniqueId}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <span class="table-image-placeholder" style="display:none;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                    </span>
                </a>
            </div>`;
        }
        
        if (isUrl(strValue)) {
            const displayUrl = strValue.length > 40 ? strValue.substring(0, 37) + '...' : strValue;
            return `<a href="${escapeHtml(strValue)}" target="_blank" rel="noopener noreferrer" class="table-link">${escapeHtml(displayUrl)}</a>`;
        }
        
        if (strValue.length > TEXT_TRUNCATE_LENGTH) {
            const uniqueId = 'text-' + Math.random().toString(36).substr(2, 9);
            const truncatedText = strValue.substring(0, TEXT_TRUNCATE_LENGTH);
            return `<div class="truncated-text-cell" id="${uniqueId}">
                <span class="truncated-text">${escapeHtml(truncatedText)}...</span>
                <span class="full-text" style="display:none;">${escapeHtml(strValue)}</span>
                <button class="text-expand-btn" onclick="(function(el){
                    var container = el.closest('.truncated-text-cell');
                    var truncated = container.querySelector('.truncated-text');
                    var full = container.querySelector('.full-text');
                    var isExpanded = full.style.display !== 'none';
                    truncated.style.display = isExpanded ? 'inline' : 'none';
                    full.style.display = isExpanded ? 'none' : 'inline';
                    el.textContent = isExpanded ? 'more' : 'less';
                })(this)">more</button>
            </div>`;
        }
        
        return escapeHtml(strValue);
    }
    
    const title = envelope.title || '';
    
    let html = `<div class="table-wrapper">`;
    if (title) {
        html += `<div class="table-title">${escapeHtml(title)}</div>`;
    }
    html += '<div class="table-container"><table class="data-table"><thead><tr>';
    
    columns.forEach(col => {
        const colClass = 'col-' + normalizeColumnName(col);
        html += `<th class="${colClass}">${formatColumnHeader(col)}</th>`;
    });
    
    html += '</tr></thead><tbody>';
    
    data.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            const colClass = 'col-' + normalizeColumnName(col);
            const cellValue = formatCellValue(row[col], col);
            html += `<td class="${colClass}">${cellValue}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div></div>';
    
    if (envelope.note || envelope.text) {
        const noteText = envelope.note || envelope.text;
        html = `<div class="message-note">${escapeHtml(noteText)}</div>` + html;
    }
    
    return html;
}

function renderMediaGallery(envelope) {
    const items = envelope.data || [];
    
    console.log('Rendering media gallery with items:', items);
    
    if (!items.length) {
        return renderTitleAndNote(envelope) + '<p class="empty-state">No media items available</p>';
    }

    let html = '';
    
    if (envelope.note || envelope.text) {
        const noteText = envelope.note || envelope.text;
        html += `<div class="message-note">${escapeHtml(noteText)}</div>`;
    }
    
    html += '<div class="media-gallery">';
    
    items.forEach((item, index) => {
        const url = item.url;
        const videoUrl = item.videoUrl;
        const isVideo = item.media_type === 'video' || videoUrl;
        const caption = item.caption || item.title || envelope.title || '';
        
        console.log(`Media item ${index}:`, { url, videoUrl, isVideo, item });
        
        const imageId = 'img-' + Math.random().toString(36).substr(2, 9);
        
        html += '<div class="media-card">';
        
        if (isVideo) {
            const videoSrc = videoUrl || url;
            html += `<div class="media-image-container">
                <video class="media-image" controls preload="metadata" style="object-fit: contain; background: #000;">
                    <source src="${escapeHtml(videoSrc)}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>`;
        } else if (url && url.match(/^https?:\/\//)) {
            html += `<div class="media-image-container">
                <img id="${imageId}" src="${escapeHtml(url)}" alt="${escapeHtml(caption || 'Image')}" class="media-image" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer">
                <div class="media-placeholder" id="placeholder-${imageId}" style="display: none;">
                    <div class="media-placeholder-content">
                        <div class="media-placeholder-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21,15 16,10 5,21"/>
                            </svg>
                        </div>
                        <div class="media-placeholder-text">Image could not be loaded</div>
                    </div>
                </div>
            </div>`;
            
            setTimeout(() => {
                const img = document.getElementById(imageId);
                if (img) {
                    img.onerror = function() {
                        console.log('Image failed to load:', url);
                        this.style.display = 'none';
                        const placeholder = document.getElementById('placeholder-' + imageId);
                        if (placeholder) {
                            placeholder.style.display = 'flex';
                        }
                    };
                }
            }, 10);
        } else {
            html += `<div class="media-image-container">
                <div class="media-placeholder">
                    <div class="media-placeholder-content">
                        <div class="media-placeholder-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21,15 16,10 5,21"/>
                            </svg>
                        </div>
                        <div class="media-placeholder-text">Image placeholder</div>
                    </div>
                </div>
            </div>`;
        }
        
        if (caption) {
            html += `<div class="media-caption">${escapeHtml(caption)}</div>`;
        }
        
        html += '</div>';
    });
    
    html += '</div>';
    
    return html;
}
