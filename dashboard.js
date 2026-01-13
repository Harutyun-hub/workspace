let instagramChart = null;
let instagramChart2 = null;

const tableConfigs = {
    facebook: {
        tableName: 'facebook_ads',
        columns: [
            { key: 'page_name', label: 'Page Name' },
            { key: 'publisher_platform', label: 'Platform' },
            { key: 'url', label: 'Ad URL', type: 'link' },
            { key: 'start_date_string', label: 'Start Date' },
            { key: 'end_date_string', label: 'End Date' }
        ],
        dateField: 'snapshot_date',
        companyField: 'handle',
        companyColumnLabel: 'Company'
    },
    google: {
        tableName: 'google_ads',
        columns: [
            { key: 'advertiser_id', label: 'Advertiser ID' },
            { key: 'url', label: 'Ad URL', type: 'link' },
            { key: 'format', label: 'Format' },
            { key: 'image_url', label: 'Image', type: 'link' },
            { key: 'first_shown', label: 'First Shown' },
            { key: 'last_shown', label: 'Last Shown' }
        ],
        dateField: 'snapshot_date',
        companyField: 'handle',
        companyColumnLabel: 'Company'
    },
    instagram: {
        tableName: 'instagram_posts',
        columns: [
            { key: 'text', label: 'Text' },
            { key: 'like_count', label: 'Likes' },
            { key: 'comment_count', label: 'Comments' },
            { key: 'display_uri', label: 'Image', type: 'link' },
            { key: 'url', label: 'URL', type: 'link' }
        ],
        dateField: 'snapshot_date',
        companyField: 'handle',
        companyColumnLabel: 'Company'
    },
    website: {
        tableName: 'website_data',
        columns: [
            { key: 'title', label: 'Title' },
            { key: 'url', label: 'URL', type: 'link' },
            { key: 'meta_description', label: 'Description' },
            { key: 'og_title', label: 'OG Title' },
            { key: 'snapshot_date', label: 'Snapshot Date' }
        ],
        dateField: 'snapshot_date',
        companyField: 'handle',
        companyColumnLabel: 'Company'
    },
    screenshots: {
        tableName: 'company_screenshots',
        columns: [
            { key: 'page_type', label: 'Page Type' },
            { key: 'image_url', label: 'Screenshot', type: 'link' },
            { key: 'marketing_intent', label: 'Marketing Intent' },
            { key: 'promotions_detected', label: 'Promotions' },
            { key: 'created_at', label: 'Captured At' }
        ],
        dateField: 'created_at',
        companyField: 'company_name',
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
        setDefaultDateFilters();
        await populateCompanyFilter();
        setupEventListeners();
        await loadAllData();
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showToast('Error initializing dashboard', 'error');
    }
}

function setDefaultDateFilters() {
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    if (dateFrom && dateTo) {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        dateFrom.value = formatDate(sevenDaysAgo);
        dateTo.value = formatDate(today);
        
        console.log('[Dashboard] Default date filter set to last 7 days:', dateFrom.value, 'to', dateTo.value);
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
            if (companyFilter) companyFilter.value = '';
            if (sourceFilter) sourceFilter.value = '';
            setDefaultDateFilters();
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
            loadInstagramPosts(filters),
            loadWebsiteData(filters),
            loadCompanyScreenshots(filters)
        ]);
    } catch (error) {
        console.error('Error in loadAllData:', error);
    }
}

function getFilters() {
    const dateFrom = document.getElementById('dateFrom')?.value;
    const dateTo = document.getElementById('dateTo')?.value;
    const handle = document.getElementById('companyFilter')?.value || null;
    const source = document.getElementById('sourceFilter')?.value;
    
    return { dateFrom, dateTo, handle, source };
}

async function loadFacebookAds(filters) {
    if (filters.source && filters.source !== 'facebook') {
        updateTableUI('facebook', []);
        return;
    }
    
    console.log('[Facebook] Filter range:', filters.dateFrom, 'to', filters.dateTo, 'handle:', filters.handle);
    
    try {
        let query = supabase
            .from('facebook_ads')
            .select('id, handle, snapshot_date, page_id, page_name, publisher_platform, start_date_string, end_date_string, page_profile_uri, url');
        
        if (filters.handle) {
            query = query.eq('handle', filters.handle);
        }
        
        if (filters.dateFrom) {
            query = query.gte('snapshot_date', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            const dateToEnd = filters.dateTo + 'T23:59:59.999Z';
            query = query.lte('snapshot_date', dateToEnd);
        }
        
        const { data, error } = await query.order('snapshot_date', { ascending: false });
        
        if (error) {
            console.error('Error loading Facebook Ads:', error);
            showToast('Error loading Facebook Ads data', 'error');
            return;
        }
        
        console.log('[Facebook] Rows found:', data?.length);
        
        const safeData = (data || []).map(row => ({
            ...row,
            company_name: row.page_name || row.handle || 'Unknown'
        }));
        
        updateTableUI('facebook', safeData);
        
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
    
    console.log('[Google] Filter range:', filters.dateFrom, 'to', filters.dateTo, 'handle:', filters.handle);
    
    try {
        let query = supabase
            .from('google_ads')
            .select('id, handle, snapshot_date, advertiser_id, first_shown, last_shown, url, format, image_url');
        
        if (filters.handle) {
            query = query.eq('handle', filters.handle);
        }
        
        if (filters.dateFrom) {
            query = query.gte('snapshot_date', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            const dateToEnd = filters.dateTo + 'T23:59:59.999Z';
            query = query.lte('snapshot_date', dateToEnd);
        }
        
        const { data, error } = await query.order('snapshot_date', { ascending: false });
        
        if (error) {
            console.error('Error loading Google Ads:', error);
            showToast('Error loading Google Ads data', 'error');
            return;
        }
        
        console.log('[Google] Rows found:', data?.length);
        
        const safeData = (data || []).map(row => ({
            ...row,
            image_url: row.image_url ?? null,
            company_name: row.handle || 'Unknown'
        }));
        
        updateTableUI('google', safeData);
        
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
    
    console.log('[Instagram] Filter range:', filters.dateFrom, 'to', filters.dateTo, 'handle:', filters.handle);
    
    try {
        let query = supabase
            .from('instagram_posts')
            .select('id, handle, snapshot_date, text, like_count, comment_count, display_uri, url');
        
        if (filters.handle) {
            query = query.eq('handle', filters.handle);
        }
        
        if (filters.dateFrom) {
            query = query.gte('snapshot_date', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            const dateToEnd = filters.dateTo + 'T23:59:59.999Z';
            query = query.lte('snapshot_date', dateToEnd);
        }
        
        const { data, error } = await query.order('snapshot_date', { ascending: false });
        
        if (error) {
            console.error('Error loading Instagram Posts:', error);
            showToast('Error loading Instagram Posts data', 'error');
            return;
        }
        
        console.log('[Instagram] Rows found:', data?.length);
        
        const safeData = (data || []).map(row => ({
            ...row,
            display_uri: row.display_uri ?? null,
            username: row.handle ?? '',
            company_name: row.handle || 'Unknown'
        }));
        
        updateTableUI('instagram', safeData);
        updateInstagramChart(safeData);
        
    } catch (error) {
        console.error('Error loading Instagram Posts:', error);
        updateTableUI('instagram', []);
        updateInstagramChart([]);
    }
}

async function loadWebsiteData(filters) {
    if (filters.source && filters.source !== 'website') {
        updateTableUI('website', []);
        return;
    }
    
    console.log('[Website] Filter range:', filters.dateFrom, 'to', filters.dateTo, 'handle:', filters.handle);
    
    try {
        let query = supabase
            .from('website_data')
            .select('id, handle, company_name, snapshot_date, url, title, meta_description, meta_keywords, og_title, og_description, og_url');
        
        if (filters.handle) {
            query = query.eq('handle', filters.handle);
        }
        
        if (filters.dateFrom) {
            query = query.gte('snapshot_date', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            const dateToEnd = filters.dateTo + 'T23:59:59.999Z';
            query = query.lte('snapshot_date', dateToEnd);
        }
        
        const { data, error } = await query.order('snapshot_date', { ascending: false });
        
        if (error) {
            console.error('Error loading Website Data:', error);
            showToast('Error loading Website data', 'error');
            return;
        }
        
        console.log('[Website] Rows found:', data?.length);
        
        const safeData = (data || []).map(row => ({
            ...row,
            company_name: row.company_name || row.handle || 'Unknown'
        }));
        
        updateTableUI('website', safeData);
        
    } catch (error) {
        console.error('Error loading Website Data:', error);
        updateTableUI('website', []);
    }
}

async function loadCompanyScreenshots(filters) {
    if (filters.source && filters.source !== 'screenshots') {
        updateTableUI('screenshots', []);
        return;
    }
    
    console.log('[Screenshots] Filter range:', filters.dateFrom, 'to', filters.dateTo, 'company:', filters.handle);
    
    try {
        let query = supabase
            .from('company_screenshots')
            .select('id, company_id, company_name, image_url, page_type, created_at, marketing_intent, promotions_detected');
        
        if (filters.handle) {
            query = query.or(`company_name.eq.${filters.handle},company_name.ilike.%${filters.handle}%`);
        }
        
        if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            const dateToEnd = filters.dateTo + 'T23:59:59.999Z';
            query = query.lte('created_at', dateToEnd);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading Company Screenshots:', error);
            showToast('Error loading Screenshots data', 'error');
            return;
        }
        
        console.log('[Screenshots] Rows found:', data?.length);
        
        const safeData = (data || []).map(row => ({
            ...row,
            company_name: row.company_name || 'Unknown'
        }));
        
        updateTableUI('screenshots', safeData);
        
    } catch (error) {
        console.error('Error loading Company Screenshots:', error);
        updateTableUI('screenshots', []);
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
        const companyName = row.company_name || row[config.companyField] || 'Unknown';
        
        const companyCell = `<td>${renderCompanyName(companyName)}</td>`;
        
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

let dashboardHandles = [];

async function populateCompanyFilter() {
    const companyFilter = document.getElementById('companyFilter');
    
    if (!companyFilter) return;
    
    try {
        const [fbResult, googleResult, igResult, websiteResult] = await Promise.all([
            supabase.from('facebook_ads').select('handle').limit(1000),
            supabase.from('google_ads').select('handle').limit(1000),
            supabase.from('instagram_posts').select('handle').limit(1000),
            supabase.from('website_data').select('handle').limit(1000)
        ]);
        
        const allHandles = new Set();
        
        (fbResult.data || []).forEach(row => row.handle && allHandles.add(row.handle));
        (googleResult.data || []).forEach(row => row.handle && allHandles.add(row.handle));
        (igResult.data || []).forEach(row => row.handle && allHandles.add(row.handle));
        (websiteResult.data || []).forEach(row => row.handle && allHandles.add(row.handle));
        
        dashboardHandles = Array.from(allHandles).sort((a, b) => a.localeCompare(b));
        
        const currentValue = companyFilter.value;
        companyFilter.innerHTML = '<option value="">All Companies</option>';
        
        dashboardHandles.forEach(handle => {
            const option = document.createElement('option');
            option.value = handle;
            option.textContent = handle;
            companyFilter.appendChild(option);
        });
        
        if (currentValue && dashboardHandles.includes(currentValue)) {
            companyFilter.value = currentValue;
        }
        
        console.log('[Dashboard] Loaded', dashboardHandles.length, 'unique company handles');
        
    } catch (error) {
        console.error('Error populating company filter:', error);
    }
}

function renderCompanyName(name) {
    const displayName = escapeHtml(name || 'Unknown');
    return `<div class="company-with-logo">
        <div class="company-logo-fallback" style="width: 20px; height: 20px;">${displayName.charAt(0).toUpperCase()}</div>
        <span class="company-name">${displayName}</span>
    </div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


document.addEventListener('DOMContentLoaded', initDashboard);
