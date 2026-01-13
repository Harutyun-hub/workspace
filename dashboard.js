let instagramChart = null;
let instagramChart2 = null;

// Module-level data storage for cross-source aggregation
let facebookData = [];
let googleData = [];
let instagramData = [];
let websiteData = [];
let screenshotsData = [];

// Chart instances for cleanup
let shareOfVoiceAdsChart = null;
let shareOfVoicePostsChart = null;
let shareOfEngagementChart = null;
let activityTimelineChart = null;
let instagramTrendChart = null;
let adCampaignChart = null;
let adFormatDistributionChart = null;

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
    console.log('[Dashboard] ========== INITIALIZING DASHBOARD ==========');
    
    try {
        console.log('[Dashboard] Step 1: Initializing Supabase client...');
        supabase = await initSupabase();
        
        if (!supabase) {
            console.error('[Dashboard] CRITICAL: Supabase client is NULL');
            showToast('Failed to initialize database connection', 'error');
            return;
        }
        console.log('[Dashboard] Supabase client initialized successfully');
        
        console.log('[Dashboard] Step 2: Initializing auth...');
        const session = await initAuth();
        console.log('[Dashboard] Auth session:', session ? 'ACTIVE' : 'NONE');
        
        if (!session && !window.location.pathname.includes('login.html')) {
            console.log('[Dashboard] No session, redirecting to login...');
            window.location.href = '/login.html';
            return;
        }
        
        currentUser = getCurrentUser();
        console.log('[Dashboard] Current user:', currentUser ? currentUser.email : 'NONE');
        
        if (!currentUser) {
            window.location.href = '/login.html';
            return;
        }
        
        console.log('[Dashboard] Step 3: Setting up UI...');
        updateUserProfile();
        setDefaultDateFilters();
        
        console.log('[Dashboard] Step 4: Populating company filter...');
        await populateCompanyFilter();
        
        console.log('[Dashboard] Step 5: Setting up event listeners...');
        setupEventListeners();
        
        console.log('[Dashboard] Step 6: Loading all data...');
        await loadAllData();
        
        console.log('[Dashboard] ========== DASHBOARD READY ==========');
        
    } catch (error) {
        console.error('[Dashboard] CRITICAL ERROR during initialization:', error);
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
    
    console.log('[Dashboard] ========== LOADING ALL DATA ==========');
    console.log('[Dashboard] Supabase client status:', supabase ? 'INITIALIZED' : 'NULL/UNDEFINED');
    console.log('[Dashboard] Filters:', JSON.stringify(filters));
    
    if (!supabase) {
        console.error('[Dashboard] CRITICAL: Supabase client is not initialized!');
        showToast('Database connection not available', 'error');
        return;
    }
    
    try {
        const results = await Promise.allSettled([
            loadFacebookAds(filters),
            loadGoogleAds(filters),
            loadInstagramPosts(filters),
            loadWebsiteData(filters),
            loadCompanyScreenshots(filters)
        ]);
        
        results.forEach((result, index) => {
            const sources = ['Facebook', 'Google', 'Instagram', 'Website', 'Screenshots'];
            if (result.status === 'rejected') {
                console.error(`[Dashboard] ${sources[index]} load FAILED:`, result.reason);
            }
        });
        
        // Update all dashboard components after data is loaded
        console.log('[Dashboard] Updating dashboard components...');
        updateStatCards();
        updateShareOfVoiceCharts();
        updateTimelineCharts();
        updateCompetitorCards();
        
        console.log('[Dashboard] ========== DATA LOADING COMPLETE ==========');
    } catch (error) {
        console.error('[Dashboard] Error in loadAllData:', error);
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
        facebookData = [];
        renderFacebookGallery([]);
        return;
    }
    
    console.log('[Facebook] Loading with filters:', filters.dateFrom, 'to', filters.dateTo, 'handle:', filters.handle);
    
    try {
        let query = supabase
            .from('facebook_ads')
            .select('*');
        
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
        
        const { data, error } = await query.order('snapshot_date', { ascending: false }).limit(100);
        
        console.log('[Facebook] Query result - data:', data?.length, 'rows, error:', error);
        
        if (error) {
            console.error('[Facebook] Supabase error:', error.message, error.details, error.hint);
            showToast('Error loading Facebook Ads: ' + error.message, 'error');
            return;
        }
        
        if (data && data.length > 0) {
            console.log('[Facebook] Sample row:', JSON.stringify(data[0]).substring(0, 200));
        }
        
        const safeData = (data || []).map(row => ({
            ...row,
            company_name: row.page_name || row.handle || 'Unknown'
        }));
        
        // Store in module variable for cross-source aggregation
        facebookData = safeData;
        
        // Render to gallery
        renderFacebookGallery(safeData);
        
    } catch (error) {
        console.error('[Facebook] Exception:', error);
        facebookData = [];
        renderFacebookGallery([]);
    }
}

async function loadGoogleAds(filters) {
    if (filters.source && filters.source !== 'google') {
        googleData = [];
        renderGoogleGallery([]);
        return;
    }
    
    console.log('[Google] Loading with filters:', filters.dateFrom, 'to', filters.dateTo, 'handle:', filters.handle);
    
    try {
        let query = supabase
            .from('google_ads')
            .select('*');
        
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
        
        const { data, error } = await query.order('snapshot_date', { ascending: false }).limit(100);
        
        console.log('[Google] Query result - data:', data?.length, 'rows, error:', error);
        
        if (error) {
            console.error('[Google] Supabase error:', error.message, error.details, error.hint);
            showToast('Error loading Google Ads: ' + error.message, 'error');
            return;
        }
        
        if (data && data.length > 0) {
            console.log('[Google] Sample row:', JSON.stringify(data[0]).substring(0, 200));
        }
        
        const safeData = (data || []).map(row => ({
            ...row,
            image_url: row.image_url ?? null,
            company_name: row.handle || 'Unknown'
        }));
        
        // Store in module variable for cross-source aggregation
        googleData = safeData;
        
        // Render to gallery
        renderGoogleGallery(safeData);
        
    } catch (error) {
        console.error('[Google] Exception:', error);
        googleData = [];
        renderGoogleGallery([]);
    }
}

async function loadInstagramPosts(filters) {
    if (filters.source && filters.source !== 'instagram') {
        instagramData = [];
        renderPostsGallery([]);
        updateInstagramChart([]);
        return;
    }
    
    console.log('[Instagram] Loading with filters:', filters.dateFrom, 'to', filters.dateTo, 'handle:', filters.handle);
    
    try {
        let query = supabase
            .from('instagram_posts')
            .select('*');
        
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
        
        const { data, error } = await query.order('snapshot_date', { ascending: false }).limit(100);
        
        console.log('[Instagram] Query result - data:', data?.length, 'rows, error:', error);
        
        if (error) {
            console.error('[Instagram] Supabase error:', error.message, error.details, error.hint);
            showToast('Error loading Instagram Posts: ' + error.message, 'error');
            return;
        }
        
        if (data && data.length > 0) {
            console.log('[Instagram] Sample row:', JSON.stringify(data[0]).substring(0, 200));
        }
        
        const safeData = (data || []).map(row => ({
            ...row,
            display_uri: row.display_uri || row.display_url || null,
            username: row.handle ?? '',
            company_name: row.handle || 'Unknown'
        }));
        
        // Store in module variable for cross-source aggregation
        instagramData = safeData;
        
        // Render to gallery and charts
        renderPostsGallery(safeData);
        updateInstagramChart(safeData);
        
    } catch (error) {
        console.error('[Instagram] Exception:', error);
        instagramData = [];
        renderPostsGallery([]);
        updateInstagramChart([]);
    }
}

async function loadWebsiteData(filters) {
    if (filters.source && filters.source !== 'website') {
        websiteData = [];
        renderChangesTimeline([]);
        return;
    }
    
    console.log('[Website] Loading with filters:', filters.dateFrom, 'to', filters.dateTo, 'handle:', filters.handle);
    
    try {
        let query = supabase
            .from('website_data')
            .select('*');
        
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
        
        const { data, error } = await query.order('snapshot_date', { ascending: false }).limit(100);
        
        console.log('[Website] Query result - data:', data?.length, 'rows, error:', error);
        
        if (error) {
            console.error('[Website] Supabase error:', error.message, error.details, error.hint);
            showToast('Error loading Website data: ' + error.message, 'error');
            return;
        }
        
        if (data && data.length > 0) {
            console.log('[Website] Sample row:', JSON.stringify(data[0]).substring(0, 200));
        }
        
        const safeData = (data || []).map(row => ({
            ...row,
            company_name: row.company_name || row.handle || 'Unknown'
        }));
        
        // Store in module variable for cross-source aggregation
        websiteData = safeData;
        
        // Render to timeline and populate diff selector
        renderChangesTimeline(safeData);
        populateDiffCompanySelect(safeData);
        
    } catch (error) {
        console.error('[Website] Exception:', error);
        websiteData = [];
        renderChangesTimeline([]);
    }
}

async function loadCompanyScreenshots(filters) {
    if (filters.source && filters.source !== 'screenshots') {
        screenshotsData = [];
        renderScreenshotsGrid([]);
        return;
    }
    
    console.log('[Screenshots] Loading with filters:', filters.dateFrom, 'to', filters.dateTo, 'company:', filters.handle);
    
    try {
        let query = supabase
            .from('company_screenshots')
            .select('*');
        
        if (filters.handle) {
            query = query.or(`company_name.eq.${filters.handle},company_name.ilike.%${filters.handle}%`);
        }
        
        // Screenshots use created_at instead of snapshot_date
        if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            const dateToEnd = filters.dateTo + 'T23:59:59.999Z';
            query = query.lte('created_at', dateToEnd);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
        
        console.log('[Screenshots] Query result - data:', data?.length, 'rows, error:', error);
        
        if (error) {
            console.error('[Screenshots] Supabase error:', error.message, error.details, error.hint);
            showToast('Error loading Screenshots: ' + error.message, 'error');
            return;
        }
        
        if (data && data.length > 0) {
            console.log('[Screenshots] Sample row:', JSON.stringify(data[0]).substring(0, 200));
        }
        
        const safeData = (data || []).map(row => ({
            ...row,
            company_name: row.company_name || 'Unknown'
        }));
        
        // Store in module variable for cross-source aggregation
        screenshotsData = safeData;
        
        // Render to screenshots grid
        renderScreenshotsGrid(safeData);
        
    } catch (error) {
        console.error('[Screenshots] Exception:', error);
        screenshotsData = [];
        renderScreenshotsGrid([]);
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

// ==================== GALLERY RENDER FUNCTIONS ====================

function renderFacebookGallery(data) {
    const gallery = document.getElementById('facebookGallery');
    const countEl = document.getElementById('facebookGalleryCount');
    
    if (countEl) {
        countEl.textContent = `${data.length} ads`;
    }
    
    if (!gallery) {
        console.warn('[Facebook] Gallery element not found');
        return;
    }
    
    if (data.length === 0) {
        gallery.innerHTML = `
            <div class="empty-state">
                <p>No Facebook ads found for the selected filters</p>
            </div>
        `;
        return;
    }
    
    gallery.innerHTML = data.map(ad => {
        const pageName = escapeHtml(ad.page_name || ad.handle || 'Unknown');
        const handle = escapeHtml(ad.handle || '');
        const url = ad.url || '#';
        const pageUri = ad.page_profile_uri || '#';
        const startDate = ad.start_date_string ? formatDateShort(ad.start_date_string) : '-';
        const endDate = ad.end_date_string ? formatDateShort(ad.end_date_string) : '-';
        const platform = parsePlatform(ad.publisher_platform);
        const adText = parseAdText(ad.snapshot_data);
        
        return `
            <div class="ad-card">
                <div class="ad-card-header">
                    <div class="ad-company">
                        <strong>${pageName}</strong>
                        <span class="ad-handle">@${handle}</span>
                    </div>
                    <span class="platform-badge facebook">${platform}</span>
                </div>
                <div class="ad-card-body">
                    ${adText ? `<p class="ad-text">${escapeHtml(adText.substring(0, 200))}${adText.length > 200 ? '...' : ''}</p>` : ''}
                    <div class="ad-dates">
                        <span>📅 ${startDate} - ${endDate}</span>
                    </div>
                </div>
                <div class="ad-card-footer">
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="view-ad-btn">View Ad</a>
                    <a href="${escapeHtml(pageUri)}" target="_blank" rel="noopener" class="view-page-btn">View Page</a>
                </div>
            </div>
        `;
    }).join('');
}

function renderGoogleGallery(data) {
    const gallery = document.getElementById('googleGallery');
    const countEl = document.getElementById('googleGalleryCount');
    
    if (countEl) {
        countEl.textContent = `${data.length} ads`;
    }
    
    if (!gallery) {
        console.warn('[Google] Gallery element not found');
        return;
    }
    
    if (data.length === 0) {
        gallery.innerHTML = `
            <div class="empty-state">
                <p>No Google ads found for the selected filters</p>
            </div>
        `;
        return;
    }
    
    gallery.innerHTML = data.map(ad => {
        const handle = escapeHtml(ad.handle || 'Unknown');
        const url = ad.url || '#';
        const imageUrl = ad.image_url || '';
        const format = escapeHtml(ad.format || 'unknown');
        const firstShown = ad.first_shown ? formatDateShort(ad.first_shown) : '-';
        const lastShown = ad.last_shown ? formatDateShort(ad.last_shown) : '-';
        
        return `
            <div class="ad-card">
                <div class="ad-card-header">
                    <div class="ad-company">
                        <strong>${handle}</strong>
                    </div>
                    <span class="format-badge">${format}</span>
                </div>
                ${imageUrl ? `
                    <div class="ad-image">
                        <img src="${escapeHtml(imageUrl)}" alt="Ad creative" loading="lazy" onerror="this.style.display='none'">
                    </div>
                ` : ''}
                <div class="ad-card-body">
                    <div class="ad-dates">
                        <span>📅 ${firstShown} - ${lastShown}</span>
                    </div>
                </div>
                <div class="ad-card-footer">
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="view-ad-btn">View Ad</a>
                </div>
            </div>
        `;
    }).join('');
}

function renderPostsGallery(data) {
    const gallery = document.getElementById('postsGallery');
    const countEl = document.getElementById('postsGalleryCount');
    
    if (countEl) {
        countEl.textContent = `${data.length} posts`;
    }
    
    if (!gallery) {
        console.warn('[Instagram] Gallery element not found');
        return;
    }
    
    if (data.length === 0) {
        gallery.innerHTML = `
            <div class="empty-state">
                <p>No Instagram posts found for the selected filters</p>
            </div>
        `;
        return;
    }
    
    // Sort by engagement (likes + comments)
    const sortedData = [...data].sort((a, b) => {
        const engA = (a.like_count || 0) + (a.comment_count || 0);
        const engB = (b.like_count || 0) + (b.comment_count || 0);
        return engB - engA;
    });
    
    gallery.innerHTML = sortedData.map(post => {
        const handle = escapeHtml(post.handle || 'Unknown');
        const text = post.text || '';
        const likes = (post.like_count || 0).toLocaleString();
        const comments = (post.comment_count || 0).toLocaleString();
        const imageUrl = post.display_uri || '';
        const postUrl = post.url || '#';
        const date = post.snapshot_date ? formatDateShort(post.snapshot_date) : '-';
        
        return `
            <div class="post-card">
                <div class="post-card-header">
                    <div class="post-author">
                        <strong>@${handle}</strong>
                        <span class="post-date">${date}</span>
                    </div>
                </div>
                ${imageUrl ? `
                    <div class="post-image">
                        <img src="${escapeHtml(imageUrl)}" alt="Post image" loading="lazy" onerror="this.style.display='none'">
                    </div>
                ` : ''}
                <div class="post-card-body">
                    <p class="post-text">${escapeHtml(text.substring(0, 280))}${text.length > 280 ? '...' : ''}</p>
                    <div class="post-stats">
                        <span class="stat-item">❤️ ${likes}</span>
                        <span class="stat-item">💬 ${comments}</span>
                    </div>
                </div>
                <div class="post-card-footer">
                    <a href="${escapeHtml(postUrl)}" target="_blank" rel="noopener" class="view-post-btn">View Post</a>
                </div>
            </div>
        `;
    }).join('');
}

function renderScreenshotsGrid(data) {
    const grid = document.getElementById('screenshotsGrid');
    
    if (!grid) {
        console.warn('[Screenshots] Grid element not found');
        return;
    }
    
    if (data.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <p>No screenshots found for the selected filters</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = data.map(screenshot => {
        const companyName = escapeHtml(screenshot.company_name || 'Unknown');
        const imageUrl = screenshot.image_url || '';
        const pageType = escapeHtml(screenshot.page_type || 'page');
        const marketingIntent = screenshot.marketing_intent || '';
        const hasPromos = screenshot.promotions_detected;
        const date = screenshot.created_at ? formatDateShort(screenshot.created_at) : '-';
        
        return `
            <div class="screenshot-card">
                <div class="screenshot-header">
                    <strong>${companyName}</strong>
                    <div class="screenshot-badges">
                        <span class="page-type-badge">${pageType}</span>
                        ${hasPromos ? '<span class="promo-badge">🎁 Promo</span>' : ''}
                    </div>
                </div>
                ${imageUrl ? `
                    <div class="screenshot-image">
                        <img src="${escapeHtml(imageUrl)}" alt="Screenshot of ${companyName}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'image-error\\'>Image unavailable</div>'">
                    </div>
                ` : ''}
                ${marketingIntent ? `
                    <div class="marketing-intent">
                        <strong>AI Analysis:</strong>
                        <p>${escapeHtml(marketingIntent.substring(0, 200))}${marketingIntent.length > 200 ? '...' : ''}</p>
                    </div>
                ` : ''}
                <div class="screenshot-footer">
                    <span class="screenshot-date">📅 ${date}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderChangesTimeline(data) {
    const timeline = document.getElementById('changesTimeline');
    
    if (!timeline) {
        console.warn('[Website] Timeline element not found');
        return;
    }
    
    if (data.length === 0) {
        timeline.innerHTML = `
            <div class="empty-state">
                <p>No website changes found for the selected filters</p>
            </div>
        `;
        return;
    }
    
    // Group by company and sort by date
    const sortedData = [...data].sort((a, b) => new Date(b.snapshot_date) - new Date(a.snapshot_date));
    
    timeline.innerHTML = sortedData.map(item => {
        const companyName = escapeHtml(item.company_name || item.handle || 'Unknown');
        const title = escapeHtml(item.title || 'No title');
        const metaDesc = item.meta_description || '';
        const ogTitle = item.og_title || '';
        const ogDesc = item.og_description || '';
        const url = item.url || '#';
        const date = item.snapshot_date ? formatDateShort(item.snapshot_date) : '-';
        
        return `
            <div class="timeline-item">
                <div class="timeline-header">
                    <strong>${companyName}</strong>
                    <span class="timeline-date">${date}</span>
                </div>
                <div class="timeline-body">
                    <h4>${title}</h4>
                    ${metaDesc ? `<p class="meta-desc">${escapeHtml(metaDesc.substring(0, 200))}${metaDesc.length > 200 ? '...' : ''}</p>` : ''}
                    ${ogTitle ? `<div class="og-info"><strong>OG:</strong> ${escapeHtml(ogTitle)}</div>` : ''}
                </div>
                <div class="timeline-footer">
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener">Visit Site</a>
                </div>
            </div>
        `;
    }).join('');
}

function populateDiffCompanySelect(data) {
    const select = document.getElementById('diffCompanySelect');
    if (!select) return;
    
    const uniqueCompanies = [...new Set(data.map(d => d.company_name || d.handle).filter(Boolean))].sort();
    
    select.innerHTML = '<option value="">Select Company</option>' + 
        uniqueCompanies.map(company => `<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join('');
}

// ==================== STAT CARDS FUNCTIONS ====================

function updateStatCards() {
    // Total Ads = Facebook + Google
    const totalAds = facebookData.length + googleData.length;
    const totalAdsEl = document.getElementById('totalAdsCount');
    if (totalAdsEl) totalAdsEl.textContent = totalAds.toLocaleString();
    
    // Total Posts = Instagram
    const totalPosts = instagramData.length;
    const totalPostsEl = document.getElementById('totalPostsCount');
    if (totalPostsEl) totalPostsEl.textContent = totalPosts.toLocaleString();
    
    // Total Competitors = unique handles across all sources
    const allHandles = new Set([
        ...facebookData.map(d => d.handle),
        ...googleData.map(d => d.handle),
        ...instagramData.map(d => d.handle),
        ...websiteData.map(d => d.handle || d.company_name),
        ...screenshotsData.map(d => d.company_name)
    ].filter(Boolean));
    const totalCompaniesEl = document.getElementById('totalCompaniesCount');
    if (totalCompaniesEl) totalCompaniesEl.textContent = allHandles.size.toLocaleString();
    
    // Total Engagement = sum of likes + comments from Instagram
    const totalEngagement = instagramData.reduce((sum, post) => {
        return sum + (post.like_count || 0) + (post.comment_count || 0);
    }, 0);
    const totalEngagementEl = document.getElementById('totalEngagement');
    if (totalEngagementEl) totalEngagementEl.textContent = formatNumber(totalEngagement);
    
    // Campaign duration stats from Facebook ads
    updateCampaignDurationStats();
    
    console.log('[Dashboard] Stats updated: Ads:', totalAds, 'Posts:', totalPosts, 'Companies:', allHandles.size, 'Engagement:', totalEngagement);
}

function updateCampaignDurationStats() {
    const durations = facebookData
        .filter(ad => ad.start_date_string && ad.end_date_string)
        .map(ad => {
            const start = new Date(ad.start_date_string);
            const end = new Date(ad.end_date_string);
            return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24))); // days
        })
        .filter(d => d > 0 && d < 365); // Filter out unreasonable values
    
    if (durations.length === 0) return;
    
    const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    
    const avgEl = document.getElementById('avgCampaignDuration');
    const minEl = document.getElementById('minCampaignDuration');
    const maxEl = document.getElementById('maxCampaignDuration');
    const totalEl = document.getElementById('totalCampaignsWithDuration');
    
    if (avgEl) avgEl.textContent = `${avg} days`;
    if (minEl) minEl.textContent = `${min} days`;
    if (maxEl) maxEl.textContent = `${max} days`;
    if (totalEl) totalEl.textContent = durations.length.toString();
}

// ==================== CHART FUNCTIONS ====================

function updateShareOfVoiceCharts() {
    updateShareOfVoiceAdsChart();
    updateShareOfVoicePostsChart();
    updateShareOfEngagementChart();
    updateAdFormatDistributionChart();
}

function updateShareOfVoiceAdsChart() {
    const canvas = document.getElementById('shareOfVoiceAdsChart');
    if (!canvas) return;
    
    if (shareOfVoiceAdsChart) {
        shareOfVoiceAdsChart.destroy();
        shareOfVoiceAdsChart = null;
    }
    
    // Combine Facebook and Google ads by handle
    const handleCounts = {};
    [...facebookData, ...googleData].forEach(ad => {
        const handle = ad.handle || 'Unknown';
        handleCounts[handle] = (handleCounts[handle] || 0) + 1;
    });
    
    const sortedHandles = Object.entries(handleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sortedHandles.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    shareOfVoiceAdsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedHandles.map(([handle]) => handle),
            datasets: [{
                data: sortedHandles.map(([, count]) => count),
                backgroundColor: generateColors(sortedHandles.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } }
            }
        }
    });
}

function updateShareOfVoicePostsChart() {
    const canvas = document.getElementById('shareOfVoicePostsChart');
    if (!canvas) return;
    
    if (shareOfVoicePostsChart) {
        shareOfVoicePostsChart.destroy();
        shareOfVoicePostsChart = null;
    }
    
    const handleCounts = {};
    instagramData.forEach(post => {
        const handle = post.handle || 'Unknown';
        handleCounts[handle] = (handleCounts[handle] || 0) + 1;
    });
    
    const sortedHandles = Object.entries(handleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sortedHandles.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    shareOfVoicePostsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedHandles.map(([handle]) => handle),
            datasets: [{
                data: sortedHandles.map(([, count]) => count),
                backgroundColor: generateColors(sortedHandles.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } }
            }
        }
    });
}

function updateShareOfEngagementChart() {
    const canvas = document.getElementById('shareOfEngagementChart');
    if (!canvas) return;
    
    if (shareOfEngagementChart) {
        shareOfEngagementChart.destroy();
        shareOfEngagementChart = null;
    }
    
    const handleEngagement = {};
    instagramData.forEach(post => {
        const handle = post.handle || 'Unknown';
        const engagement = (post.like_count || 0) + (post.comment_count || 0);
        handleEngagement[handle] = (handleEngagement[handle] || 0) + engagement;
    });
    
    const sortedHandles = Object.entries(handleEngagement)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sortedHandles.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    shareOfEngagementChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedHandles.map(([handle]) => handle),
            datasets: [{
                data: sortedHandles.map(([, engagement]) => engagement),
                backgroundColor: generateColors(sortedHandles.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } }
            }
        }
    });
}

function updateAdFormatDistributionChart() {
    const canvas = document.getElementById('adFormatDistributionChart');
    if (!canvas) return;
    
    if (adFormatDistributionChart) {
        adFormatDistributionChart.destroy();
        adFormatDistributionChart = null;
    }
    
    const formatCounts = {};
    googleData.forEach(ad => {
        const format = ad.format || 'unknown';
        formatCounts[format] = (formatCounts[format] || 0) + 1;
    });
    
    const sortedFormats = Object.entries(formatCounts).sort((a, b) => b[1] - a[1]);
    
    if (sortedFormats.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    adFormatDistributionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: sortedFormats.map(([format]) => format),
            datasets: [{
                data: sortedFormats.map(([, count]) => count),
                backgroundColor: generateColors(sortedFormats.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } }
            }
        }
    });
}

function updateTimelineCharts() {
    updateActivityTimelineChart();
    updateInstagramTrendChart();
    updateAdCampaignChart();
}

function updateActivityTimelineChart() {
    const canvas = document.getElementById('activityTimelineChart');
    if (!canvas) return;
    
    if (activityTimelineChart) {
        activityTimelineChart.destroy();
        activityTimelineChart = null;
    }
    
    // Group all data by date
    const dateData = {};
    
    facebookData.forEach(ad => {
        const date = ad.snapshot_date ? ad.snapshot_date.split('T')[0] : null;
        if (date) {
            if (!dateData[date]) dateData[date] = { facebook: 0, google: 0, instagram: 0 };
            dateData[date].facebook++;
        }
    });
    
    googleData.forEach(ad => {
        const date = ad.snapshot_date ? ad.snapshot_date.split('T')[0] : null;
        if (date) {
            if (!dateData[date]) dateData[date] = { facebook: 0, google: 0, instagram: 0 };
            dateData[date].google++;
        }
    });
    
    instagramData.forEach(post => {
        const date = post.snapshot_date ? post.snapshot_date.split('T')[0] : null;
        if (date) {
            if (!dateData[date]) dateData[date] = { facebook: 0, google: 0, instagram: 0 };
            dateData[date].instagram++;
        }
    });
    
    const sortedDates = Object.keys(dateData).sort();
    if (sortedDates.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    activityTimelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [
                {
                    label: 'Facebook Ads',
                    data: sortedDates.map(d => dateData[d].facebook),
                    borderColor: '#1877F2',
                    backgroundColor: 'rgba(24, 119, 242, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Google Ads',
                    data: sortedDates.map(d => dateData[d].google),
                    borderColor: '#EA4335',
                    backgroundColor: 'rgba(234, 67, 53, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Instagram Posts',
                    data: sortedDates.map(d => dateData[d].instagram),
                    borderColor: '#E4405F',
                    backgroundColor: 'rgba(228, 64, 95, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function updateInstagramTrendChart() {
    const canvas = document.getElementById('instagramTrendChart');
    if (!canvas) return;
    
    if (instagramTrendChart) {
        instagramTrendChart.destroy();
        instagramTrendChart = null;
    }
    
    // Group by date and sum engagement
    const dateEngagement = {};
    instagramData.forEach(post => {
        const date = post.snapshot_date ? post.snapshot_date.split('T')[0] : null;
        if (date) {
            const engagement = (post.like_count || 0) + (post.comment_count || 0);
            dateEngagement[date] = (dateEngagement[date] || 0) + engagement;
        }
    });
    
    const sortedDates = Object.keys(dateEngagement).sort();
    if (sortedDates.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    instagramTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Total Engagement',
                data: sortedDates.map(d => dateEngagement[d]),
                borderColor: '#E4405F',
                backgroundColor: 'rgba(228, 64, 95, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function updateAdCampaignChart() {
    const canvas = document.getElementById('adCampaignChart');
    if (!canvas) return;
    
    if (adCampaignChart) {
        adCampaignChart.destroy();
        adCampaignChart = null;
    }
    
    // Group ads by date
    const dateAds = {};
    [...facebookData, ...googleData].forEach(ad => {
        const date = ad.snapshot_date ? ad.snapshot_date.split('T')[0] : null;
        if (date) {
            dateAds[date] = (dateAds[date] || 0) + 1;
        }
    });
    
    const sortedDates = Object.keys(dateAds).sort();
    if (sortedDates.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    adCampaignChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Ad Activity',
                data: sortedDates.map(d => dateAds[d]),
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function updateCompetitorCards() {
    const container = document.getElementById('competitorCards');
    if (!container) return;
    
    // Aggregate stats by handle
    const competitorStats = {};
    
    facebookData.forEach(ad => {
        const handle = ad.handle || 'Unknown';
        if (!competitorStats[handle]) {
            competitorStats[handle] = { fbAds: 0, googleAds: 0, posts: 0, engagement: 0 };
        }
        competitorStats[handle].fbAds++;
    });
    
    googleData.forEach(ad => {
        const handle = ad.handle || 'Unknown';
        if (!competitorStats[handle]) {
            competitorStats[handle] = { fbAds: 0, googleAds: 0, posts: 0, engagement: 0 };
        }
        competitorStats[handle].googleAds++;
    });
    
    instagramData.forEach(post => {
        const handle = post.handle || 'Unknown';
        if (!competitorStats[handle]) {
            competitorStats[handle] = { fbAds: 0, googleAds: 0, posts: 0, engagement: 0 };
        }
        competitorStats[handle].posts++;
        competitorStats[handle].engagement += (post.like_count || 0) + (post.comment_count || 0);
    });
    
    // Sort by total activity
    const sortedCompetitors = Object.entries(competitorStats)
        .map(([handle, stats]) => ({
            handle,
            ...stats,
            total: stats.fbAds + stats.googleAds + stats.posts
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);
    
    if (sortedCompetitors.length === 0) {
        container.innerHTML = '<p class="empty-state">No competitor data available</p>';
        return;
    }
    
    container.innerHTML = sortedCompetitors.map(comp => `
        <div class="competitor-card">
            <div class="competitor-name">${escapeHtml(comp.handle)}</div>
            <div class="competitor-stats">
                <div class="comp-stat">
                    <span class="comp-stat-value">${comp.fbAds}</span>
                    <span class="comp-stat-label">FB Ads</span>
                </div>
                <div class="comp-stat">
                    <span class="comp-stat-value">${comp.googleAds}</span>
                    <span class="comp-stat-label">Google Ads</span>
                </div>
                <div class="comp-stat">
                    <span class="comp-stat-value">${comp.posts}</span>
                    <span class="comp-stat-label">Posts</span>
                </div>
                <div class="comp-stat">
                    <span class="comp-stat-value">${formatNumber(comp.engagement)}</span>
                    <span class="comp-stat-label">Engagement</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ==================== HELPER FUNCTIONS ====================

function formatDateShort(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
        return '-';
    }
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function parsePlatform(platformJson) {
    try {
        if (typeof platformJson === 'string') {
            const parsed = JSON.parse(platformJson);
            if (Array.isArray(parsed)) return parsed.join(', ');
            return parsed;
        }
        if (Array.isArray(platformJson)) return platformJson.join(', ');
        return platformJson || 'Facebook';
    } catch {
        return 'Facebook';
    }
}

function parseAdText(snapshotData) {
    try {
        if (!snapshotData) return '';
        const data = typeof snapshotData === 'string' ? JSON.parse(snapshotData) : snapshotData;
        if (data.body) {
            if (typeof data.body === 'string') return data.body;
            if (data.body.text) return data.body.text;
        }
        return '';
    } catch {
        return '';
    }
}

function generateColors(count) {
    const baseColors = [
        'rgba(59, 130, 246, 0.8)',   // Blue
        'rgba(16, 185, 129, 0.8)',   // Green
        'rgba(245, 158, 11, 0.8)',   // Orange
        'rgba(239, 68, 68, 0.8)',    // Red
        'rgba(139, 92, 246, 0.8)',   // Purple
        'rgba(236, 72, 153, 0.8)',   // Pink
        'rgba(6, 182, 212, 0.8)',    // Cyan
        'rgba(132, 204, 22, 0.8)',   // Lime
        'rgba(251, 191, 36, 0.8)',   // Amber
        'rgba(99, 102, 241, 0.8)'    // Indigo
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
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
    
    console.log('[Dashboard] Fetching company handles from all tables...');
    
    try {
        const [fbResult, googleResult, igResult, websiteResult, screenshotsResult] = await Promise.all([
            supabase.from('facebook_ads').select('handle').limit(1000),
            supabase.from('google_ads').select('handle').limit(1000),
            supabase.from('instagram_posts').select('handle').limit(1000),
            supabase.from('website_data').select('handle').limit(1000),
            supabase.from('company_screenshots').select('company_name').limit(1000)
        ]);
        
        console.log('[Dashboard] Filter query results - FB:', fbResult.data?.length, 'Google:', googleResult.data?.length, 
                    'IG:', igResult.data?.length, 'Website:', websiteResult.data?.length, 'Screenshots:', screenshotsResult.data?.length);
        
        if (fbResult.error) console.error('[Dashboard] FB filter error:', fbResult.error);
        if (googleResult.error) console.error('[Dashboard] Google filter error:', googleResult.error);
        if (igResult.error) console.error('[Dashboard] IG filter error:', igResult.error);
        if (websiteResult.error) console.error('[Dashboard] Website filter error:', websiteResult.error);
        if (screenshotsResult.error) console.error('[Dashboard] Screenshots filter error:', screenshotsResult.error);
        
        const allHandles = new Set();
        
        (fbResult.data || []).forEach(row => row.handle && allHandles.add(row.handle));
        (googleResult.data || []).forEach(row => row.handle && allHandles.add(row.handle));
        (igResult.data || []).forEach(row => row.handle && allHandles.add(row.handle));
        (websiteResult.data || []).forEach(row => row.handle && allHandles.add(row.handle));
        (screenshotsResult.data || []).forEach(row => row.company_name && allHandles.add(row.company_name));
        
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
        
        console.log('[Dashboard] Loaded', dashboardHandles.length, 'unique company handles:', dashboardHandles.slice(0, 5).join(', '), '...');
        
    } catch (error) {
        console.error('[Dashboard] Error populating company filter:', error);
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
