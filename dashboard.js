let instagramChart = null;
let instagramChart2 = null;

const tableConfigs = {
    facebook: {
        tableName: 'facebook_ads',
        columns: [
            { key: 'publisher_platform', label: 'Platform' },
            { key: 'ad_text', label: 'Ad Text' },
            { key: 'url', label: 'URL', type: 'link' },
            { key: 'ad_image_url', label: 'Image URL', type: 'link' },
            { key: 'ad_cta_type', label: 'CTA Type' },
            { key: 'ad_display_format', label: 'Display Format' },
            { key: 'start_date_string', label: 'Start Date' },
            { key: 'end_date_string', label: 'End Date' }
        ],
        dateField: 'start_date_string',
        companyField: 'page_name',
        companyColumnLabel: 'Company'
    },
    google: {
        tableName: 'google_ads',
        columns: [
            { key: 'advertiser_id', label: 'Advertiser ID' },
            { key: 'url', label: 'URL', type: 'link' },
            { key: 'format', label: 'Format' },
            { key: 'image_url', label: 'Image URL', type: 'link' },
            { key: 'first_show', label: 'First Show' },
            { key: 'last_show', label: 'Last Show' }
        ],
        dateField: 'first_show',
        companyField: 'handle',
        companyColumnLabel: 'Company'
    },
    instagram: {
        tableName: 'instagram_posts',
        columns: [
            { key: 'text', label: 'Text' },
            { key: 'like_count', label: 'Likes' },
            { key: 'comment_count', label: 'Comments' },
            { key: 'display_url', label: 'Display URL', type: 'link' },
            { key: 'url', label: 'URL', type: 'link' }
        ],
        dateField: 'created_at',
        companyField: 'username',
        companyColumnLabel: 'Company'
    }
};

async function initDashboard() {
    try {
        supabase = await initSupabase();
        
        if (!supabase) {
            showToast('Failed to initialize database connection', 'error');
            return;
        }
        
        const session = await initAuth();
        
        if (!session && !window.location.pathname.includes('login.html')) {
            window.location.href = '/login.html';
            return;
        }
        
        currentUser = getCurrentUser();
        
        if (!currentUser) {
            window.location.href = '/login.html';
            return;
        }
        
        updateUserProfile();
        await populateCompanyFilter();
        setupEventListeners();
        await loadAllData();
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showToast('Error initializing dashboard', 'error');
    }
}

function updateUserProfile() {
}

function setupEventListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const companyFilter = document.getElementById('companyFilter');
    const sourceFilter = document.getElementById('sourceFilter');
    
    const debouncedLoadAllData = debounce(() => loadAllData(), 300);
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadAllData();
            showToast('Data refreshed successfully', 'success');
        });
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (dateFrom) dateFrom.value = '';
            if (dateTo) dateTo.value = '';
            if (companyFilter) companyFilter.value = '';
            if (sourceFilter) sourceFilter.value = '';
            loadAllData();
        });
    }
    
    [dateFrom, dateTo, companyFilter, sourceFilter].forEach(el => {
        if (el) {
            el.addEventListener('change', debouncedLoadAllData);
        }
    });
    
    setupSectionToggles();
}

function setupSectionToggles() {
    const sections = ['instagram', 'facebook', 'google'];
    
    sections.forEach(section => {
        const header = document.querySelector(`#${section}Section .section-header`);
        const toggle = document.getElementById(`${section}Toggle`);
        const sectionEl = document.getElementById(`${section}Section`);
        
        if (header && sectionEl) {
            header.addEventListener('click', () => {
                sectionEl.classList.toggle('collapsed');
            });
        }
    });
}

async function loadAllData() {
    const filters = getFilters();
    
    try {
        await Promise.all([
            loadFacebookAds(filters),
            loadGoogleAds(filters),
            loadInstagramPosts(filters)
        ]);
    } catch (error) {
        console.error('Error in loadAllData:', error);
    }
}

function getFilters() {
    const dateFrom = document.getElementById('dateFrom')?.value;
    const dateTo = document.getElementById('dateTo')?.value;
    const company = document.getElementById('companyFilter')?.value;
    const source = document.getElementById('sourceFilter')?.value;
    
    return { dateFrom, dateTo, company, source };
}

async function loadFacebookAds(filters) {
    if (filters.source && filters.source !== 'facebook') {
        updateTableUI('facebook', []);
        return;
    }
    
    try {
        let query;
        
        if (filters.company) {
            query = supabase
                .from('facebook_ads')
                .select('*, companies!inner(company_key, name, logo_url)')
                .eq('companies.company_key', filters.company);
        } else {
            query = supabase
                .from('facebook_ads')
                .select('*, companies(company_key, name, logo_url)');
        }
        
        if (filters.dateFrom) {
            query = query.gte('start_date_string', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            query = query.lte('start_date_string', filters.dateTo);
        }
        
        const { data, error } = await query.order('start_date_string', { ascending: false });
        
        if (error) {
            console.error('Error loading Facebook Ads:', error);
            showToast('Error loading Facebook Ads data', 'error');
            return;
        }
        
        updateTableUI('facebook', data || []);
        
    } catch (error) {
        console.error('Error loading Facebook Ads:', error);
        updateTableUI('facebook', []);
    }
}

async function loadGoogleAds(filters) {
    if (filters.source && filters.source !== 'google') {
        updateTableUI('google', []);
        return;
    }
    
    try {
        let query;
        
        if (filters.company) {
            query = supabase
                .from('google_ads')
                .select('*, companies!inner(company_key, name, logo_url)')
                .eq('companies.company_key', filters.company);
        } else {
            query = supabase
                .from('google_ads')
                .select('*, companies(company_key, name, logo_url)');
        }
        
        if (filters.dateFrom) {
            query = query.gte('first_show', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            query = query.lte('first_show', filters.dateTo);
        }
        
        const { data, error } = await query.order('first_show', { ascending: false });
        
        if (error) {
            console.error('Error loading Google Ads:', error);
            showToast('Error loading Google Ads data', 'error');
            return;
        }
        
        updateTableUI('google', data || []);
        
    } catch (error) {
        console.error('Error loading Google Ads:', error);
        updateTableUI('google', []);
    }
}

async function loadInstagramPosts(filters) {
    if (filters.source && filters.source !== 'instagram') {
        updateTableUI('instagram', []);
        updateInstagramChart([]);
        return;
    }
    
    try {
        let query;
        
        if (filters.company) {
            query = supabase
                .from('instagram_posts')
                .select('*, companies!inner(company_key, name, logo_url)')
                .eq('companies.company_key', filters.company);
        } else {
            query = supabase
                .from('instagram_posts')
                .select('*, companies(company_key, name, logo_url)');
        }
        
        if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            query = query.lte('created_at', filters.dateTo);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading Instagram Posts:', error);
            showToast('Error loading Instagram Posts data', 'error');
            return;
        }
        
        updateTableUI('instagram', data || []);
        updateInstagramChart(data || []);
        
    } catch (error) {
        console.error('Error loading Instagram Posts:', error);
        updateTableUI('instagram', []);
        updateInstagramChart([]);
    }
}

function updateTableHeaders(source) {
    const config = tableConfigs[source];
    const thead = document.getElementById(`${source}TableHead`);
    
    if (!thead || !config) return;
    
    const companyHeader = `<th>${config.companyColumnLabel || 'Company'}</th>`;
    const columnHeaders = config.columns
        .filter(col => col.key !== config.companyField)
        .map(col => `<th>${escapeHtml(col.label)}</th>`)
        .join('');
    
    thead.innerHTML = `<tr>${companyHeader}${columnHeaders}</tr>`;
}

function updateTableUI(source, data) {
    const config = tableConfigs[source];
    const tbody = document.getElementById(`${source}TableBody`);
    const countEl = document.getElementById(`${source}Count`);
    
    if (!tbody || !config) return;
    
    updateTableHeaders(source);
    
    const itemLabel = source === 'instagram' ? 'posts' : 'ads';
    if (countEl) {
        countEl.textContent = `${data.length} ${itemLabel}`;
    }
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="${config.columns.length + 1}">No data available</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = data.map(row => {
        const companyData = row.companies;
        const companyName = companyData?.name || companyData?.company_key || row[config.companyField] || 'Unknown';
        const logoUrl = companyData?.logo_url || null;
        
        const companyCell = `<td>${renderCompanyWithLogo(companyName, logoUrl, 20)}</td>`;
        
        const cells = config.columns.map(col => {
            if (col.key === config.companyField) {
                return '';
            }
            
            const value = row[col.key];
            
            if (value === null || value === undefined) {
                return '<td>-</td>';
            }
            
            if (col.type === 'link') {
                if (value && value.startsWith('http')) {
                    return `<td><a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(value)}">View</a></td>`;
                }
                return `<td>${escapeHtml(String(value))}</td>`;
            }
            
            return `<td title="${escapeHtml(String(value))}">${escapeHtml(String(value))}</td>`;
        }).filter(cell => cell !== '').join('');
        
        return `<tr>${companyCell}${cells}</tr>`;
    }).join('');
}

function updateInstagramChart(data) {
    const canvas = document.getElementById('instagramChart');
    const canvas2 = document.getElementById('instagramChart2');
    
    if (instagramChart) {
        instagramChart.destroy();
        instagramChart = null;
    }
    
    if (instagramChart2) {
        instagramChart2.destroy();
        instagramChart2 = null;
    }
    
    if (!data || data.length === 0) {
        return;
    }
    
    const sortedData = [...data]
        .filter(item => item.username && (item.like_count || item.comment_count))
        .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
        .slice(0, 10);
    
    if (sortedData.length === 0) {
        return;
    }
    
    const labels = sortedData.map(item => {
        const username = item.username || 'Unknown';
        return username.length > 20 ? username.substring(0, 20) + '...' : username;
    });
    
    const likes = sortedData.map(item => item.like_count || 0);
    const comments = sortedData.map(item => item.comment_count || 0);
    
    if (canvas) {
        try {
            const ctx = canvas.getContext('2d');
            instagramChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Likes',
                            data: likes,
                            backgroundColor: 'rgba(59, 130, 246, 0.8)',
                            borderColor: 'rgba(59, 130, 246, 1)',
                            borderWidth: 2
                        },
                        {
                            label: 'Comments',
                            data: comments,
                            backgroundColor: 'rgba(16, 185, 129, 0.8)',
                            borderColor: 'rgba(16, 185, 129, 1)',
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: false },
                        legend: { display: true, position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y.toLocaleString();
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating Instagram bar chart:', error);
        }
    }
    
    if (canvas2) {
        try {
            const engagementRates = sortedData.map(item => {
                return (item.like_count || 0) + (item.comment_count || 0);
            });
            
            const ctx2 = canvas2.getContext('2d');
            instagramChart2 = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Total Engagement',
                            data: engagementRates,
                            backgroundColor: [
                                'rgba(59, 130, 246, 0.8)',
                                'rgba(16, 185, 129, 0.8)',
                                'rgba(249, 115, 22, 0.8)',
                                'rgba(139, 92, 246, 0.8)',
                                'rgba(236, 72, 153, 0.8)',
                                'rgba(14, 165, 233, 0.8)',
                                'rgba(34, 197, 94, 0.8)',
                                'rgba(251, 146, 60, 0.8)',
                                'rgba(168, 85, 247, 0.8)',
                                'rgba(244, 114, 182, 0.8)'
                            ],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'right',
                            labels: { boxWidth: 12, font: { size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.label + ': ' + context.parsed.toLocaleString() + ' engagements';
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating Instagram doughnut chart:', error);
        }
    }
}

let dashboardCompaniesData = [];

async function populateCompanyFilter() {
    const companyFilter = document.getElementById('companyFilter');
    
    if (!companyFilter) return;
    
    try {
        const { data, error } = await supabase
            .from('companies')
            .select('company_key, name, logo_url')
            .order('company_key', { ascending: true });
        
        if (error) {
            console.error('Error loading companies:', error);
            return;
        }
        
        dashboardCompaniesData = data || [];
        
        const currentValue = companyFilter.value;
        companyFilter.innerHTML = '<option value="">All Companies</option>';
        
        if (data && data.length > 0) {
            data.forEach(company => {
                if (company.company_key) {
                    const option = document.createElement('option');
                    option.value = company.company_key;
                    option.textContent = company.name || company.company_key;
                    option.dataset.logoUrl = company.logo_url || '';
                    companyFilter.appendChild(option);
                }
            });
        }
        
        if (currentValue) {
            companyFilter.value = currentValue;
        }
        
    } catch (error) {
        console.error('Error populating company filter:', error);
    }
}

function getCompanyLogo(companyKey) {
    const company = dashboardCompaniesData.find(c => c.company_key === companyKey);
    return company?.logo_url || null;
}

function renderCompanyWithLogo(name, logoUrl, size = 20) {
    const displayName = escapeHtml(name || 'Unknown');
    if (logoUrl) {
        return `<div class="company-with-logo">
            <img src="${escapeHtml(logoUrl)}" alt="${displayName}" class="company-logo" style="width: ${size}px; height: ${size}px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="company-logo-fallback" style="display: none; width: ${size}px; height: ${size}px;">${displayName.charAt(0).toUpperCase()}</div>
            <span class="company-name">${displayName}</span>
        </div>`;
    }
    return `<div class="company-with-logo">
        <div class="company-logo-fallback" style="width: ${size}px; height: ${size}px;">${displayName.charAt(0).toUpperCase()}</div>
        <span class="company-name">${displayName}</span>
    </div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);
