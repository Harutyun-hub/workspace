let shareOfVoiceAdsChart = null;
let shareOfVoicePostsChart = null;
let shareOfEngagementChart = null;
let activityTimelineChart = null;
let instagramTrendChart = null;
let adCampaignChart = null;
let adFormatDistributionChart = null;
let ctaTypeBreakdownChart = null;
let postingFrequencyChart = null;

const chartColors = [
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
];

let allData = {
    companies: [],
    instagramPosts: [],
    facebookAds: [],
    googleAds: [],
    screenshots: [],
    websiteData: []
};

async function initIntelligenceDashboard() {
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
        
        setupPillarTabs();
        setupCreativeTabs();
        setupEspionageTabs();
        setupEventListeners();
        await populateCompanyFilters();
        await loadAllData();
        await loadSidebarConversationHistory();
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showToast('Error initializing dashboard', 'error');
    }
}

function setupPillarTabs() {
    const tabs = document.querySelectorAll('.pillar-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const pillar = tab.dataset.pillar;
            document.querySelectorAll('.pillar-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(pillar + 'Pillar').classList.remove('hidden');
        });
    });
}

function setupCreativeTabs() {
    const tabs = document.querySelectorAll('.creative-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const creative = tab.dataset.creative;
            document.querySelectorAll('.creative-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(creative + 'Creative').classList.remove('hidden');
        });
    });
}

function setupEspionageTabs() {
    const tabs = document.querySelectorAll('.espionage-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const espionage = tab.dataset.espionage;
            document.querySelectorAll('.espionage-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(espionage + 'Espionage').classList.remove('hidden');
        });
    });
}

function setupEventListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const companyFilter = document.getElementById('companyFilter');
    const compareCompanyFilter = document.getElementById('compareCompanyFilter');
    
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
            if (compareCompanyFilter) compareCompanyFilter.value = '';
            loadAllData();
        });
    }
    
    [dateFrom, dateTo, companyFilter, compareCompanyFilter].forEach(el => {
        if (el) {
            el.addEventListener('change', () => loadAllData());
        }
    });
}

async function populateCompanyFilters() {
    const companyFilter = document.getElementById('companyFilter');
    const compareCompanyFilter = document.getElementById('compareCompanyFilter');
    
    try {
        const { data, error } = await supabase
            .from('companies')
            .select('id, company_key, name')
            .eq('is_active', true)
            .order('name', { ascending: true });
        
        if (error) {
            console.error('Error loading companies:', error);
            return;
        }
        
        allData.companies = data || [];
        
        [companyFilter, compareCompanyFilter].forEach(filter => {
            if (filter) {
                const firstOption = filter.options[0].outerHTML;
                filter.innerHTML = firstOption;
                
                if (data && data.length > 0) {
                    data.forEach(company => {
                        const option = document.createElement('option');
                        option.value = company.company_key;
                        option.textContent = company.name || company.company_key;
                        filter.appendChild(option);
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('Error populating company filters:', error);
    }
}

function getFilters() {
    const dateFrom = document.getElementById('dateFrom')?.value;
    const dateTo = document.getElementById('dateTo')?.value;
    const company = document.getElementById('companyFilter')?.value;
    const compareCompany = document.getElementById('compareCompanyFilter')?.value;
    
    return { dateFrom, dateTo, company, compareCompany };
}

function getCompanyIdsFromFilters(filters) {
    const companyIds = [];
    
    if (filters.company) {
        const company = allData.companies.find(c => c.company_key === filters.company);
        if (company) {
            companyIds.push(company.id);
        }
    }
    
    if (filters.compareCompany) {
        const compareCompany = allData.companies.find(c => c.company_key === filters.compareCompany);
        if (compareCompany && !companyIds.includes(compareCompany.id)) {
            companyIds.push(compareCompany.id);
        }
    }
    
    return companyIds;
}

async function loadAllData() {
    const filters = getFilters();
    
    try {
        await Promise.all([
            loadInstagramPosts(filters),
            loadFacebookAds(filters),
            loadGoogleAds(filters),
            loadScreenshots(filters),
            loadWebsiteData(filters)
        ]);
        
        updateBattlefieldView();
        updatePulseView();
        updateCreativeView();
        updateEspionageView();
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function loadInstagramPosts(filters) {
    try {
        let query = supabase
            .from('instagram_posts')
            .select('id, username, profile_pic_url, text, like_count, comment_count, display_uri, url, created_at, company_id');
        
        const companyIds = getCompanyIdsFromFilters(filters);
        if (companyIds.length > 0) {
            query = query.in('company_id', companyIds);
        }
        
        if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            query = query.lte('created_at', filters.dateTo);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading Instagram posts:', error);
            return;
        }
        
        allData.instagramPosts = data || [];
        
    } catch (error) {
        console.error('Error loading Instagram posts:', error);
    }
}

async function loadFacebookAds(filters) {
    try {
        let query = supabase
            .from('facebook_ads')
            .select('id, page_name, ad_image_url, ad_text, ad_cta_type, ad_display_format, ad_link_url, start_date_string, end_date_string, company_id');
        
        const companyIds = getCompanyIdsFromFilters(filters);
        if (companyIds.length > 0) {
            query = query.in('company_id', companyIds);
        }
        
        if (filters.dateFrom) {
            query = query.gte('start_date_string', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            query = query.lte('start_date_string', filters.dateTo);
        }
        
        const { data, error } = await query.order('start_date_string', { ascending: false });
        
        if (error) {
            console.error('Error loading Facebook ads:', error);
            return;
        }
        
        allData.facebookAds = data || [];
        
    } catch (error) {
        console.error('Error loading Facebook ads:', error);
    }
}

async function loadGoogleAds(filters) {
    try {
        let query = supabase
            .from('google_ads')
            .select('id, image_url, url, format, first_shown, last_shown, region_name, company_id');
        
        const companyIds = getCompanyIdsFromFilters(filters);
        if (companyIds.length > 0) {
            query = query.in('company_id', companyIds);
        }
        
        if (filters.dateFrom) {
            query = query.gte('first_shown', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            query = query.lte('first_shown', filters.dateTo);
        }
        
        const { data, error } = await query.order('first_shown', { ascending: false });
        
        if (error) {
            console.error('Error loading Google ads:', error);
            return;
        }
        
        allData.googleAds = data || [];
        
    } catch (error) {
        console.error('Error loading Google ads:', error);
    }
}

async function loadScreenshots(filters) {
    try {
        let query = supabase
            .from('company_screenshots')
            .select('id, image_url, page_type, created_at, company_name, company_id');
        
        const companyIds = getCompanyIdsFromFilters(filters);
        if (companyIds.length > 0) {
            query = query.in('company_id', companyIds);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading screenshots:', error);
            return;
        }
        
        allData.screenshots = data || [];
        
    } catch (error) {
        console.error('Error loading screenshots:', error);
    }
}

async function loadWebsiteData(filters) {
    try {
        let query = supabase
            .from('website_data')
            .select('id, company_name, url, title, meta_description, og_title, og_description, snapshot_date, company_id');
        
        const companyIds = getCompanyIdsFromFilters(filters);
        if (companyIds.length > 0) {
            query = query.in('company_id', companyIds);
        }
        
        const { data, error } = await query.order('snapshot_date', { ascending: false });
        
        if (error) {
            console.error('Error loading website data:', error);
            return;
        }
        
        allData.websiteData = data || [];
        
    } catch (error) {
        console.error('Error loading website data:', error);
    }
}

function updateBattlefieldView() {
    const totalAds = allData.facebookAds.length + allData.googleAds.length;
    const totalPosts = allData.instagramPosts.length;
    const totalCompanies = allData.companies.length;
    const totalEngagement = allData.instagramPosts.reduce((sum, post) => {
        return sum + (post.like_count || 0) + (post.comment_count || 0);
    }, 0);
    
    document.getElementById('totalAdsCount').textContent = totalAds.toLocaleString();
    document.getElementById('totalPostsCount').textContent = totalPosts.toLocaleString();
    document.getElementById('totalCompaniesCount').textContent = totalCompanies.toLocaleString();
    document.getElementById('totalEngagement').textContent = formatNumber(totalEngagement);
    
    updateShareOfVoiceCharts();
    updateCompetitorCards();
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}

function updateShareOfVoiceCharts() {
    const companyAdCounts = {};
    const companyPostCounts = {};
    const companyEngagement = {};
    
    allData.facebookAds.forEach(ad => {
        const name = ad.page_name || 'Unknown';
        companyAdCounts[name] = (companyAdCounts[name] || 0) + 1;
    });
    
    allData.googleAds.forEach(ad => {
        const company = allData.companies.find(c => c.id === ad.company_id);
        const name = company?.name || 'Unknown';
        companyAdCounts[name] = (companyAdCounts[name] || 0) + 1;
    });
    
    allData.instagramPosts.forEach(post => {
        const name = post.username || 'Unknown';
        companyPostCounts[name] = (companyPostCounts[name] || 0) + 1;
        companyEngagement[name] = (companyEngagement[name] || 0) + (post.like_count || 0) + (post.comment_count || 0);
    });
    
    renderPieChart('shareOfVoiceAdsChart', shareOfVoiceAdsChart, companyAdCounts, (chart) => { shareOfVoiceAdsChart = chart; });
    renderPieChart('shareOfVoicePostsChart', shareOfVoicePostsChart, companyPostCounts, (chart) => { shareOfVoicePostsChart = chart; });
    renderPieChart('shareOfEngagementChart', shareOfEngagementChart, companyEngagement, (chart) => { shareOfEngagementChart = chart; });
}

function renderPieChart(canvasId, existingChart, data, setChart) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    if (existingChart) {
        existingChart.destroy();
    }
    
    const labels = Object.keys(data).slice(0, 10);
    const values = labels.map(label => data[label]);
    
    if (labels.length === 0) {
        setChart(null);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: chartColors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 },
                        padding: 8
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    setChart(chart);
}

function updateCompetitorCards() {
    const container = document.getElementById('competitorCards');
    if (!container) return;
    
    const competitorData = {};
    
    allData.companies.forEach(company => {
        competitorData[company.id] = {
            name: company.name || company.company_key,
            ads: 0,
            posts: 0,
            engagement: 0
        };
    });
    
    allData.facebookAds.forEach(ad => {
        if (ad.company_id && competitorData[ad.company_id]) {
            competitorData[ad.company_id].ads++;
        }
    });
    
    allData.googleAds.forEach(ad => {
        if (ad.company_id && competitorData[ad.company_id]) {
            competitorData[ad.company_id].ads++;
        }
    });
    
    allData.instagramPosts.forEach(post => {
        if (post.company_id && competitorData[post.company_id]) {
            competitorData[post.company_id].posts++;
            competitorData[post.company_id].engagement += (post.like_count || 0) + (post.comment_count || 0);
        }
    });
    
    const sortedCompetitors = Object.values(competitorData)
        .sort((a, b) => (b.ads + b.posts) - (a.ads + a.posts))
        .slice(0, 8);
    
    if (sortedCompetitors.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3z" fill="currentColor"/>
                </svg>
                <h4>No competitor data</h4>
                <p>Add companies to start tracking competitors</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = sortedCompetitors.map(comp => `
        <div class="competitor-card">
            <div class="competitor-card-header">
                <div class="competitor-avatar">${comp.name.charAt(0).toUpperCase()}</div>
                <span class="competitor-name">${escapeHtml(comp.name)}</span>
            </div>
            <div class="competitor-stats">
                <div class="competitor-stat">
                    <span class="competitor-stat-value">${comp.ads}</span>
                    <span class="competitor-stat-label">Ads</span>
                </div>
                <div class="competitor-stat">
                    <span class="competitor-stat-value">${comp.posts}</span>
                    <span class="competitor-stat-label">Posts</span>
                </div>
                <div class="competitor-stat">
                    <span class="competitor-stat-value">${formatNumber(comp.engagement)}</span>
                    <span class="competitor-stat-label">Engagement</span>
                </div>
            </div>
        </div>
    `).join('');
}

function updatePulseView() {
    updateActivityTimeline();
    updateInstagramTrend();
    updateAdCampaignChart();
    updateCampaignDurationStats();
    updatePostingFrequencyChart();
}

function updateCampaignDurationStats() {
    const durations = [];
    
    allData.facebookAds.forEach(ad => {
        if (ad.start_date_string && ad.end_date_string) {
            try {
                const startDate = new Date(ad.start_date_string);
                const endDate = new Date(ad.end_date_string);
                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays <= 365) {
                        durations.push(diffDays);
                    }
                }
            } catch (e) {}
        }
    });
    
    const avgEl = document.getElementById('avgCampaignDuration');
    const minEl = document.getElementById('minCampaignDuration');
    const maxEl = document.getElementById('maxCampaignDuration');
    const totalEl = document.getElementById('totalCampaignsWithDuration');
    
    if (durations.length > 0) {
        const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        const min = Math.min(...durations);
        const max = Math.max(...durations);
        
        if (avgEl) avgEl.textContent = avg;
        if (minEl) minEl.textContent = min;
        if (maxEl) maxEl.textContent = max;
        if (totalEl) totalEl.textContent = durations.length;
    } else {
        if (avgEl) avgEl.textContent = 'N/A';
        if (minEl) minEl.textContent = 'N/A';
        if (maxEl) maxEl.textContent = 'N/A';
        if (totalEl) totalEl.textContent = '0';
    }
}

function updatePostingFrequencyChart() {
    const canvas = document.getElementById('postingFrequencyChart');
    if (!canvas) return;
    
    if (postingFrequencyChart) {
        postingFrequencyChart.destroy();
    }
    
    if (allData.instagramPosts.length === 0) {
        postingFrequencyChart = null;
        return;
    }
    
    const competitorTotalPosts = {};
    const competitorWeeklyPosts = {};
    const allWeeks = new Set();
    
    allData.instagramPosts.forEach(post => {
        if (post.created_at && post.username) {
            const date = new Date(post.created_at);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];
            const username = post.username;
            
            allWeeks.add(weekKey);
            
            competitorTotalPosts[username] = (competitorTotalPosts[username] || 0) + 1;
            
            if (!competitorWeeklyPosts[username]) {
                competitorWeeklyPosts[username] = {};
            }
            if (!competitorWeeklyPosts[username][weekKey]) {
                competitorWeeklyPosts[username][weekKey] = 0;
            }
            competitorWeeklyPosts[username][weekKey]++;
        }
    });
    
    const topCompetitors = Object.entries(competitorTotalPosts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([username]) => username);
    
    if (topCompetitors.length === 0) {
        postingFrequencyChart = null;
        return;
    }
    
    const topCompetitorWeeks = new Set();
    topCompetitors.forEach(competitor => {
        if (competitorWeeklyPosts[competitor]) {
            Object.keys(competitorWeeklyPosts[competitor]).forEach(week => {
                topCompetitorWeeks.add(week);
            });
        }
    });
    
    const sortedWeeks = Array.from(topCompetitorWeeks).sort().slice(-8);
    
    if (sortedWeeks.length === 0) {
        postingFrequencyChart = null;
        return;
    }
    
    const datasets = topCompetitors.map((competitor, index) => ({
        label: competitor,
        data: sortedWeeks.map(week => competitorWeeklyPosts[competitor][week] || 0),
        backgroundColor: chartColors[index % chartColors.length],
        borderRadius: 4
    }));
    
    const ctx = canvas.getContext('2d');
    postingFrequencyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedWeeks.map(d => {
                const date = new Date(d);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Posts' } },
                x: { title: { display: true, text: 'Week Starting' } }
            }
        }
    });
}

function updateActivityTimeline() {
    const canvas = document.getElementById('activityTimelineChart');
    if (!canvas) return;
    
    if (activityTimelineChart) {
        activityTimelineChart.destroy();
    }
    
    const dateGroups = {};
    
    allData.instagramPosts.forEach(post => {
        if (post.created_at) {
            const date = post.created_at.split('T')[0];
            if (!dateGroups[date]) dateGroups[date] = { posts: 0, fbAds: 0, gAds: 0 };
            dateGroups[date].posts++;
        }
    });
    
    allData.facebookAds.forEach(ad => {
        if (ad.start_date_string) {
            const date = ad.start_date_string.split('T')[0];
            if (!dateGroups[date]) dateGroups[date] = { posts: 0, fbAds: 0, gAds: 0 };
            dateGroups[date].fbAds++;
        }
    });
    
    allData.googleAds.forEach(ad => {
        if (ad.first_shown) {
            const date = ad.first_shown.split('T')[0];
            if (!dateGroups[date]) dateGroups[date] = { posts: 0, fbAds: 0, gAds: 0 };
            dateGroups[date].gAds++;
        }
    });
    
    const sortedDates = Object.keys(dateGroups).sort().slice(-30);
    
    if (sortedDates.length === 0) {
        return;
    }
    
    const ctx = canvas.getContext('2d');
    activityTimelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates.map(d => {
                const date = new Date(d);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: [
                {
                    label: 'Instagram Posts',
                    data: sortedDates.map(d => dateGroups[d].posts),
                    borderColor: 'rgba(236, 72, 153, 1)',
                    backgroundColor: 'rgba(236, 72, 153, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Facebook Ads',
                    data: sortedDates.map(d => dateGroups[d].fbAds),
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Google Ads',
                    data: sortedDates.map(d => dateGroups[d].gAds),
                    borderColor: 'rgba(34, 197, 94, 1)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
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
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateInstagramTrend() {
    const canvas = document.getElementById('instagramTrendChart');
    if (!canvas) return;
    
    if (instagramTrendChart) {
        instagramTrendChart.destroy();
    }
    
    const dateEngagement = {};
    
    allData.instagramPosts.forEach(post => {
        if (post.created_at) {
            const date = post.created_at.split('T')[0];
            if (!dateEngagement[date]) dateEngagement[date] = { likes: 0, comments: 0 };
            dateEngagement[date].likes += post.like_count || 0;
            dateEngagement[date].comments += post.comment_count || 0;
        }
    });
    
    const sortedDates = Object.keys(dateEngagement).sort().slice(-14);
    
    if (sortedDates.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    instagramTrendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedDates.map(d => {
                const date = new Date(d);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: [
                {
                    label: 'Likes',
                    data: sortedDates.map(d => dateEngagement[d].likes),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 4
                },
                {
                    label: 'Comments',
                    data: sortedDates.map(d => dateEngagement[d].comments),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' }
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
    }
    
    const formatCounts = {};
    
    allData.facebookAds.forEach(ad => {
        const format = ad.ad_display_format || 'Unknown';
        formatCounts[format] = (formatCounts[format] || 0) + 1;
    });
    
    allData.googleAds.forEach(ad => {
        const format = ad.format || 'Unknown';
        formatCounts[format] = (formatCounts[format] || 0) + 1;
    });
    
    const labels = Object.keys(formatCounts);
    const values = labels.map(l => formatCounts[l]);
    
    if (labels.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    adCampaignChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ad Count',
                data: values,
                backgroundColor: chartColors.slice(0, labels.length),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });
}

function updateCreativeView() {
    updatePostsGallery();
    updateFacebookGallery();
    updateGoogleGallery();
    updateAdFormatDistributionChart();
    updateCtaTypeBreakdownChart();
}

function updateAdFormatDistributionChart() {
    const canvas = document.getElementById('adFormatDistributionChart');
    if (!canvas) return;
    
    if (adFormatDistributionChart) {
        adFormatDistributionChart.destroy();
    }
    
    const formatCounts = {};
    
    allData.facebookAds.forEach(ad => {
        const format = ad.ad_display_format || 'Unknown';
        formatCounts[format] = (formatCounts[format] || 0) + 1;
    });
    
    allData.googleAds.forEach(ad => {
        const format = ad.format || 'Unknown';
        formatCounts[format] = (formatCounts[format] || 0) + 1;
    });
    
    const labels = Object.keys(formatCounts);
    const values = labels.map(l => formatCounts[l]);
    
    if (labels.length === 0) {
        adFormatDistributionChart = null;
        return;
    }
    
    const ctx = canvas.getContext('2d');
    adFormatDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: chartColors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 },
                        padding: 8
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateCtaTypeBreakdownChart() {
    const canvas = document.getElementById('ctaTypeBreakdownChart');
    if (!canvas) return;
    
    if (ctaTypeBreakdownChart) {
        ctaTypeBreakdownChart.destroy();
    }
    
    const ctaCounts = {};
    
    allData.facebookAds.forEach(ad => {
        if (ad.ad_cta_type) {
            const cta = ad.ad_cta_type.replace(/_/g, ' ');
            ctaCounts[cta] = (ctaCounts[cta] || 0) + 1;
        }
    });
    
    const labels = Object.keys(ctaCounts);
    const values = labels.map(l => ctaCounts[l]);
    
    if (labels.length === 0) {
        ctaTypeBreakdownChart = null;
        return;
    }
    
    const ctx = canvas.getContext('2d');
    ctaTypeBreakdownChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: chartColors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 },
                        padding: 8
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updatePostsGallery() {
    const container = document.getElementById('postsGallery');
    const countEl = document.getElementById('postsGalleryCount');
    if (!container) return;
    
    const sortedPosts = [...allData.instagramPosts]
        .sort((a, b) => {
            const engA = (a.like_count || 0) + (a.comment_count || 0);
            const engB = (b.like_count || 0) + (b.comment_count || 0);
            return engB - engA;
        })
        .slice(0, 20);
    
    if (countEl) {
        countEl.textContent = `${sortedPosts.length} posts`;
    }
    
    if (sortedPosts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/>
                </svg>
                <h4>No posts found</h4>
                <p>Adjust your filters to see social posts</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = sortedPosts.map(post => `
        <div class="post-card">
            ${post.display_uri ? 
                `<img class="post-image" src="${escapeHtml(post.display_uri)}" alt="Post image" onerror="this.outerHTML='<div class=\\'post-image-placeholder\\'><svg width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\'><path d=\\'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z\\' fill=\\'currentColor\\'/></svg></div>'">` : 
                `<div class="post-image-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/></svg></div>`
            }
            <div class="post-content">
                <div class="post-header">
                    ${post.profile_pic_url ? 
                        `<img class="post-avatar" src="${escapeHtml(post.profile_pic_url)}" alt="${escapeHtml(post.username || '')}" onerror="this.style.display='none'">` : 
                        ''
                    }
                    <span class="post-username">@${escapeHtml(post.username || 'unknown')}</span>
                </div>
                <p class="post-text">${escapeHtml(post.text || '')}</p>
                <div class="post-stats">
                    <div class="post-stat likes">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        <span>${formatNumber(post.like_count || 0)}</span>
                    </div>
                    <div class="post-stat comments">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/></svg>
                        <span>${formatNumber(post.comment_count || 0)}</span>
                    </div>
                    ${post.url ? `<a href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer" class="ad-link" style="margin-left: auto;">View</a>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function updateFacebookGallery() {
    const container = document.getElementById('facebookGallery');
    const countEl = document.getElementById('facebookGalleryCount');
    if (!container) return;
    
    const ads = allData.facebookAds.slice(0, 20);
    
    if (countEl) {
        countEl.textContent = `${ads.length} ads`;
    }
    
    if (ads.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" fill="currentColor"/>
                </svg>
                <h4>No Facebook ads found</h4>
                <p>Adjust your filters to see ads</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = ads.map(ad => {
        let adText = ad.ad_text || '';
        try {
            if (adText.startsWith('{')) {
                const parsed = JSON.parse(adText);
                adText = parsed.text || adText;
            }
        } catch (e) {}
        
        return `
            <div class="ad-card">
                ${ad.ad_image_url ? 
                    `<img class="ad-image" src="${escapeHtml(ad.ad_image_url)}" alt="Ad creative" onerror="this.outerHTML='<div class=\\'ad-image-placeholder\\'><svg width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\'><path d=\\'M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z\\' fill=\\'currentColor\\'/></svg></div>'">` : 
                    `<div class="ad-image-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" fill="currentColor"/></svg></div>`
                }
                <div class="ad-content">
                    <div class="ad-meta">
                        ${ad.ad_cta_type ? `<span class="ad-badge cta">${escapeHtml(ad.ad_cta_type.replace(/_/g, ' '))}</span>` : ''}
                        ${ad.ad_display_format ? `<span class="ad-badge format">${escapeHtml(ad.ad_display_format)}</span>` : ''}
                    </div>
                    <p class="ad-text">${escapeHtml(adText)}</p>
                    <div class="ad-dates">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
                        <span>${ad.start_date_string ? formatDate(ad.start_date_string) : 'N/A'} - ${ad.end_date_string ? formatDate(ad.end_date_string) : 'Active'}</span>
                    </div>
                    <div class="ad-brand">
                        <div class="ad-brand-logo">${(ad.page_name || 'A').charAt(0).toUpperCase()}</div>
                        <span class="ad-brand-name">${escapeHtml(ad.page_name || 'Unknown')}</span>
                        ${ad.ad_link_url ? `<a href="${escapeHtml(ad.ad_link_url)}" target="_blank" rel="noopener noreferrer" class="ad-link">Visit</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateGoogleGallery() {
    const container = document.getElementById('googleGallery');
    const countEl = document.getElementById('googleGalleryCount');
    if (!container) return;
    
    const ads = allData.googleAds.slice(0, 20);
    
    if (countEl) {
        countEl.textContent = `${ads.length} ads`;
    }
    
    if (ads.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" fill="currentColor"/>
                </svg>
                <h4>No Google ads found</h4>
                <p>Adjust your filters to see ads</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = ads.map(ad => {
        const company = allData.companies.find(c => c.id === ad.company_id);
        const companyName = company?.name || 'Unknown';
        
        return `
            <div class="ad-card">
                ${ad.image_url ? 
                    `<img class="ad-image" src="${escapeHtml(ad.image_url)}" alt="Ad creative" onerror="this.outerHTML='<div class=\\'ad-image-placeholder\\'><svg width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\'><path d=\\'M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z\\' fill=\\'currentColor\\'/></svg></div>'">` : 
                    `<div class="ad-image-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" fill="currentColor"/></svg></div>`
                }
                <div class="ad-content">
                    <div class="ad-meta">
                        ${ad.format ? `<span class="ad-badge format">${escapeHtml(ad.format)}</span>` : ''}
                        ${ad.region_name ? `<span class="ad-badge">${escapeHtml(ad.region_name)}</span>` : ''}
                    </div>
                    <div class="ad-dates">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
                        <span>${ad.first_shown ? formatDate(ad.first_shown) : 'N/A'} - ${ad.last_shown ? formatDate(ad.last_shown) : 'Active'}</span>
                    </div>
                    <div class="ad-brand">
                        <div class="ad-brand-logo">${companyName.charAt(0).toUpperCase()}</div>
                        <span class="ad-brand-name">${escapeHtml(companyName)}</span>
                        ${ad.url ? `<a href="${escapeHtml(ad.url)}" target="_blank" rel="noopener noreferrer" class="ad-link">Visit</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateEspionageView() {
    updateScreenshotsGrid();
    updateChangesTimeline();
    populateDiffCompanySelect();
}

function populateDiffCompanySelect() {
    const select = document.getElementById('diffCompanySelect');
    if (!select) return;
    
    const companiesWithData = new Set();
    allData.websiteData.forEach(data => {
        if (data.company_name) {
            companiesWithData.add(data.company_name);
        }
    });
    
    select.innerHTML = '<option value="">Select Company</option>';
    Array.from(companiesWithData).sort().forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        select.appendChild(option);
    });
    
    select.addEventListener('change', () => {
        updateDiffViewer(select.value);
    });
}

function updateDiffViewer(companyName) {
    const container = document.getElementById('diffViewer');
    if (!container) return;
    
    if (!companyName) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
                </svg>
                <h4>Select a company to compare</h4>
                <p>Choose a company to see how their messaging changed over time</p>
            </div>
        `;
        return;
    }
    
    const companyData = allData.websiteData
        .filter(data => data.company_name === companyName && data.snapshot_date)
        .sort((a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date));
    
    if (companyData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
                </svg>
                <h4>No data available</h4>
                <p>No website snapshots found for this company</p>
            </div>
        `;
        return;
    }
    
    if (companyData.length === 1) {
        const snapshot = companyData[0];
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
                </svg>
                <h4>Only one snapshot available</h4>
                <p>Captured on ${formatDate(snapshot.snapshot_date)}. Need at least 2 snapshots to compare changes.</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="diff-comparisons">';
    let hasChanges = false;
    
    for (let i = companyData.length - 1; i > 0; i--) {
        const newer = companyData[i];
        const older = companyData[i - 1];
        
        if (newer.snapshot_date === older.snapshot_date) {
            continue;
        }
        
        const changes = [];
        
        if (newer.title !== older.title) {
            changes.push({
                field: 'Page Title',
                old: older.title || '(empty)',
                new: newer.title || '(empty)'
            });
        }
        
        if (newer.meta_description !== older.meta_description) {
            changes.push({
                field: 'Meta Description',
                old: older.meta_description || '(empty)',
                new: newer.meta_description || '(empty)'
            });
        }
        
        if (newer.og_title !== older.og_title) {
            changes.push({
                field: 'OG Title',
                old: older.og_title || '(empty)',
                new: newer.og_title || '(empty)'
            });
        }
        
        if (newer.og_description !== older.og_description) {
            changes.push({
                field: 'OG Description',
                old: older.og_description || '(empty)',
                new: newer.og_description || '(empty)'
            });
        }
        
        if (changes.length > 0) {
            hasChanges = true;
            html += `
                <div class="diff-card">
                    <div class="diff-header">
                        <span class="diff-dates">${formatDate(older.snapshot_date)} → ${formatDate(newer.snapshot_date)}</span>
                        <span class="diff-count">${changes.length} change${changes.length > 1 ? 's' : ''}</span>
                    </div>
                    <div class="diff-changes">
                        ${changes.map(change => `
                            <div class="diff-change">
                                <div class="diff-field-label">${escapeHtml(change.field)}</div>
                                <div class="diff-old">
                                    <span class="diff-indicator removed">-</span>
                                    <span class="diff-text">${escapeHtml(change.old)}</span>
                                </div>
                                <div class="diff-new">
                                    <span class="diff-indicator added">+</span>
                                    <span class="diff-text">${escapeHtml(change.new)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    if (!hasChanges) {
        html = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
                </svg>
                <h4>No changes detected</h4>
                <p>The messaging has remained consistent across ${companyData.length} snapshots</p>
            </div>
        `;
    } else {
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function updateScreenshotsGrid() {
    const container = document.getElementById('screenshotsGrid');
    if (!container) return;
    
    const screenshots = allData.screenshots.slice(0, 12);
    
    if (screenshots.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/>
                </svg>
                <h4>No screenshots available</h4>
                <p>Website screenshots will appear here when captured</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = screenshots.map(ss => `
        <div class="screenshot-card">
            <img class="screenshot-image" src="${escapeHtml(ss.image_url || '')}" alt="${escapeHtml(ss.company_name || 'Screenshot')}" onclick="openImageModal('${escapeHtml(ss.image_url || '')}')" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 200%22><rect fill=%22%23f3f4f6%22 width=%22300%22 height=%22200%22/><text fill=%22%239ca3af%22 x=%22150%22 y=%22100%22 text-anchor=%22middle%22 dy=%22.3em%22>No image</text></svg>'">
            <div class="screenshot-info">
                <div class="screenshot-company">${escapeHtml(ss.company_name || 'Unknown')}</div>
                <div class="screenshot-meta">
                    <span class="screenshot-type">${escapeHtml(ss.page_type || 'Homepage')}</span>
                    <span class="screenshot-date">${ss.created_at ? formatDate(ss.created_at) : 'N/A'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function updateChangesTimeline() {
    const container = document.getElementById('changesTimeline');
    if (!container) return;
    
    const changes = allData.websiteData.slice(0, 10);
    
    if (changes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
                </svg>
                <h4>No website changes tracked</h4>
                <p>Website text changes will appear here when detected</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = changes.map(change => `
        <div class="change-card">
            <div class="change-header">
                <span class="change-company">${escapeHtml(change.company_name || 'Unknown')}</span>
                <span class="change-date">${change.snapshot_date ? formatDate(change.snapshot_date) : 'N/A'}</span>
            </div>
            ${change.url ? `<a href="${escapeHtml(change.url)}" target="_blank" rel="noopener noreferrer" class="change-url">${escapeHtml(change.url)}</a>` : ''}
            <div class="change-fields">
                ${change.title ? `
                    <div class="change-field">
                        <div class="change-field-label">Page Title</div>
                        <div class="change-field-value">${escapeHtml(change.title)}</div>
                    </div>
                ` : ''}
                ${change.meta_description ? `
                    <div class="change-field">
                        <div class="change-field-label">Meta Description</div>
                        <div class="change-field-value">${escapeHtml(change.meta_description)}</div>
                    </div>
                ` : ''}
                ${change.og_title ? `
                    <div class="change-field">
                        <div class="change-field-label">OG Title</div>
                        <div class="change-field-value">${escapeHtml(change.og_title)}</div>
                    </div>
                ` : ''}
                ${change.og_description ? `
                    <div class="change-field">
                        <div class="change-field-label">OG Description</div>
                        <div class="change-field-value">${escapeHtml(change.og_description)}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    } catch (e) {
        return dateString;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openImageModal(imageUrl) {
    let modal = document.getElementById('imageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.className = 'image-modal';
        modal.innerHTML = `
            <button class="image-modal-close" onclick="closeImageModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                </svg>
            </button>
            <img src="" alt="Full size image">
        `;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeImageModal();
        });
        document.body.appendChild(modal);
    }
    
    modal.querySelector('img').src = imageUrl;
    modal.classList.add('active');
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

async function loadSidebarConversationHistory() {
    const user = getCurrentUser();
    if (!user) return;
    
    const historyContainer = document.getElementById('chatHistory');
    if (!historyContainer) return;
    
    try {
        historyContainer.innerHTML = '<div style="padding: 16px; text-align: center;"><div class="spinner"></div></div>';
        
        const conversations = await getUserConversations(user.id);
        historyContainer.innerHTML = '';
        
        if (conversations.length === 0) {
            historyContainer.innerHTML = '<div style="padding: 16px; text-align: center; color: #9aa0a6; font-size: 13px;">No conversations yet</div>';
            return;
        }
        
        conversations.forEach(conv => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.onclick = () => window.location.href = '/index.html';
            
            const iconSvg = document.createElement('span');
            iconSvg.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" fill="currentColor"/>
            </svg>`;
            
            const chatText = document.createElement('span');
            chatText.className = 'chat-item-text';
            chatText.textContent = conv.title || 'New chat';
            
            chatItem.appendChild(iconSvg);
            chatItem.appendChild(chatText);
            historyContainer.appendChild(chatItem);
        });
    } catch (error) {
        console.error('Error loading conversation history:', error);
        historyContainer.innerHTML = '<div style="padding: 16px; text-align: center; color: #9aa0a6; font-size: 13px;">Failed to load history</div>';
    }
}

document.addEventListener('DOMContentLoaded', initIntelligenceDashboard);
