function showToast(message, type = 'error', duration = 5000) {
    let container = document.getElementById('toast-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        error: '⚠️',
        success: '✓',
        warning: '⚡'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.error}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showLoadingOverlay(message = 'Loading...') {
    let overlay = document.getElementById('loading-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div style="text-align: center;">
                <div class="loading-spinner">
                    <img src="data:image/webp;base64,UklGRmACAABXRUJQVlA4WAoAAAAQAAAALwAAJwAAQUxQSDoBAAABkEPbtqk957dt27Zt26j+zlaH1oxt2zY727ad7PCNcU9YRsQE0F+7WVGKAauQg+9edzGSLbuGs3u3KbHR6H4BXDkxzMZ60Wec7AyyVSKmYYeBza7EVq7yBt6NGhJbzd6XeFCnSGytF3/GqVTiG3oY2OxObOUqruPduAHxVKyK1+55iYcNSsQ0+cW93R9xLoO4au8A8GmbF3G1nvwRwC1v4qhp5ewTvQU/bGGgUbbn2t3Hrz5/9+FkqTDlzC3v8POtRcYk2nrxa/z8zUoTEm6+CVJna5Bw03WQ+iaNhGsvgeTjesIU+iC9h4TXvJV20ElY9n1I/TjPikR7Lrwr5XGbKomWjVz98WcfDqaReI3Bz/jx6x2VesTQZDOAl8CVackaxDL/2qWby1ZvrraXIZ5yEQHBvi4BavR/GFZQOCAAAQAAcAYAnQEqMAAoAD5RHo1FI6GhFVquqDgFBLSG2ALMIVvw3q4ix6tC3yb1G3kmqTCBWfEJfEPMfP7l/ltgAP7+R4Y//QKXxVvmENlWTE14vj4/+4WA0j9JQw8Phyu5lEu2U/gIak9ASN1auVLqjuiBNcXlWcLCOpzk4Nw2/xk+MwUSnUsWzt/jdgMGqd/c0M6FI5JETm4PMDBqTCPnbdkAkL9XsqdJ6gHS0BKSJCPq6hDSI2q9s7ETDxIXpHX2F8El35ZOql03xpwklQ3bnw7wD/y9RHnkx5tawCOe90K4b3Kj/+aILfz79/JAKfxTqmXg42hLSZ5tM4vC9JZPtwAAAA==" alt="Loading">
                </div>
                <p style="margin-top: 16px; color: #5f6368; font-size: 14px;">${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    
    return overlay;
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function handleError(error, context = 'Operation') {
    console.error(`${context} failed:`, error);
    
    let userMessage = `${context} failed. Please try again.`;
    
    if (error.message) {
        if (error.message.includes('fetch') || error.message.includes('network')) {
            userMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('timeout')) {
            userMessage = 'Request timed out. Please try again.';
        } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
            userMessage = 'Authentication error. Please log in again.';
        } else if (error.message.includes('403') || error.message.includes('forbidden')) {
            userMessage = 'Access denied. Please check your permissions.';
        } else if (error.message.includes('404')) {
            userMessage = 'Resource not found.';
        } else if (error.message.includes('500')) {
            userMessage = 'Server error. Please try again later.';
        }
    }
    
    showToast(userMessage, 'error');
}

async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
}

function debounce(func, wait = 300) {
    let timeoutId = null;
    return function(...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func.apply(this, args);
            timeoutId = null;
        }, wait);
    };
}
