(function() {
    'use strict';

    const WAR_ROOM_CONTEXT = 'WarRoom';
    
    const TOTOGAMING_ID = '9b67e411-ec00-47d9-87d4-a56dacf41e8a';
    
    let primaryCompanyId = TOTOGAMING_ID;
    let competitorCompanyId = null;
    let battlefieldChart = null;
    let companies = [];

    function log(message, meta = null) {
        const timestamp = new Date().toISOString();
        console.log(
            `%c[WAR ROOM]%c ${timestamp} ${message}`,
            'color: #EF4444; font-weight: bold; background: #1E293B; padding: 2px 6px; border-radius: 3px;',
            'color: #94A3B8;'
        );
        if (meta) console.log('  Data:', meta);
    }

    function updateSystemTime() {
        const timeEl = document.getElementById('systemTime');
        if (timeEl) {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        }
    }

    function updateLastScanTime() {
        const scanEl = document.getElementById('lastScanTime');
        if (scanEl) {
            const now = new Date();
            scanEl.textContent = now.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit'
            });
        }
    }

    function setConnectionStatus(status, text) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.className = 'connection-status ' + status;
            statusEl.querySelector('.status-text').textContent = text;
        }
    }

    function updateDefconModule(threatLevel) {
        const defconCard = document.querySelector('.defcon-card');
        const defconBadge = document.getElementById('defconBadge');
        const threatIcon = document.getElementById('threatIcon');
        const threatText = document.getElementById('threatText');
        const threatDescription = document.getElementById('threatDescription');

        defconCard.classList.remove('threat-critical', 'threat-elevated', 'threat-secure');
        threatText.classList.remove('critical', 'elevated', 'secure');
        defconBadge.classList.remove('critical', 'elevated', 'secure');

        const level = (threatLevel || '').toUpperCase();

        switch (level) {
            case 'CRITICAL':
                defconCard.classList.add('threat-critical');
                defconBadge.classList.add('critical');
                defconBadge.textContent = 'CRITICAL';
                threatIcon.textContent = '🔴';
                threatText.textContent = 'HIGH THREAT DETECTED';
                threatText.classList.add('critical');
                threatDescription.textContent = 'Immediate attention required. Competitor activity at dangerous levels.';
                break;
            case 'ELEVATED':
                defconCard.classList.add('threat-elevated');
                defconBadge.classList.add('elevated');
                defconBadge.textContent = 'ELEVATED';
                threatIcon.textContent = '🟡';
                threatText.textContent = 'ELEVATED ACTIVITY';
                threatText.classList.add('elevated');
                threatDescription.textContent = 'Increased competitor movements detected. Monitor closely.';
                break;
            case 'SECURE':
            default:
                defconCard.classList.add('threat-secure');
                defconBadge.classList.add('secure');
                defconBadge.textContent = 'SECURE';
                threatIcon.textContent = '🟢';
                threatText.textContent = 'SYSTEM SECURE';
                threatText.classList.add('secure');
                threatDescription.textContent = 'All systems nominal. No significant competitor threats detected.';
                break;
        }
    }

    function updateAggressionGauge(score) {
        const valueEl = document.getElementById('aggressionValue');
        const barEl = document.getElementById('aggressionBar');
        const descriptionEl = document.getElementById('aggressionDescription');

        const numScore = parseInt(score) || 0;
        const clampedScore = Math.max(0, Math.min(100, numScore));

        valueEl.textContent = clampedScore;
        barEl.style.width = clampedScore + '%';

        valueEl.classList.remove('low', 'medium', 'high');

        if (clampedScore <= 33) {
            valueEl.classList.add('low');
            descriptionEl.textContent = 'Low competitive pressure. Market position stable.';
        } else if (clampedScore <= 66) {
            valueEl.classList.add('medium');
            descriptionEl.textContent = 'Moderate competitor activity. Stay vigilant.';
        } else {
            valueEl.classList.add('high');
            descriptionEl.textContent = 'High aggression detected. Defensive measures recommended.';
        }
    }

    async function fetchIntelligenceData() {
        try {
            log('Fetching intelligence data...');
            
            await SupabaseManager.initialize();
            const client = SupabaseManager.getClient();

            const { data, error } = await client
                .from('intelligence_scores')
                .select('*')
                .limit(1)
                .single();

            if (error) {
                throw error;
            }

            log('Intelligence data received', data);
            return data;
        } catch (error) {
            log('Failed to fetch intelligence data: ' + error.message);
            throw error;
        }
    }

    async function refreshDashboard() {
        try {
            const data = await fetchIntelligenceData();
            
            updateDefconModule(data.threat_level);
            updateAggressionGauge(data.aggression_score);
            updateLastScanTime();
            
            setConnectionStatus('connected', 'LIVE');
            
        } catch (error) {
            console.error('Dashboard refresh failed:', error);
            setConnectionStatus('error', 'OFFLINE');
            
            updateDefconModule('SECURE');
            updateAggressionGauge(0);
        }
    }

    async function fetchCompanies() {
        try {
            log('Fetching active companies...');
            
            await SupabaseManager.initialize();
            const client = SupabaseManager.getClient();
            
            const { data, error } = await client
                .from('companies')
                .select('id, name, logo_url')
                .order('name');
            
            if (error) throw error;
            
            log('Companies fetched', { count: data.length });
            return data || [];
        } catch (error) {
            log('Failed to fetch companies: ' + error.message);
            return [];
        }
    }

    async function initMissionControl() {
        log('Initializing Mission Control...');
        
        companies = await fetchCompanies();
        
        const friendlySelect = document.getElementById('friendlySelect');
        const hostileSelect = document.getElementById('hostileSelect');
        
        if (!friendlySelect || !hostileSelect || companies.length === 0) {
            log('Mission Control: No companies available');
            return;
        }
        
        friendlySelect.innerHTML = '';
        hostileSelect.innerHTML = '';
        
        companies.forEach(company => {
            const friendlyOption = document.createElement('option');
            friendlyOption.value = company.id;
            friendlyOption.textContent = company.name || company.id;
            friendlySelect.appendChild(friendlyOption);
            
            const hostileOption = document.createElement('option');
            hostileOption.value = company.id;
            hostileOption.textContent = company.name || company.id;
            hostileSelect.appendChild(hostileOption);
        });
        
        const totoIndex = companies.findIndex(c => c.id === TOTOGAMING_ID);
        if (totoIndex !== -1) {
            friendlySelect.value = TOTOGAMING_ID;
            primaryCompanyId = TOTOGAMING_ID;
        } else {
            primaryCompanyId = companies[0]?.id || null;
            friendlySelect.value = primaryCompanyId;
        }
        
        const competitorCompany = companies.find(c => c.id !== primaryCompanyId);
        if (competitorCompany) {
            competitorCompanyId = competitorCompany.id;
            hostileSelect.value = competitorCompanyId;
        }
        
        friendlySelect.addEventListener('change', (e) => {
            primaryCompanyId = e.target.value;
            log('Primary company changed', { id: primaryCompanyId });
            loadBattlefieldData();
        });
        
        hostileSelect.addEventListener('change', (e) => {
            competitorCompanyId = e.target.value;
            log('Competitor company changed', { id: competitorCompanyId });
            loadBattlefieldData();
        });
        
        log('Mission Control initialized', { primary: primaryCompanyId, competitor: competitorCompanyId });
    }

    async function fetchBattlefieldData() {
        try {
            log('Fetching battlefield data...');
            
            await SupabaseManager.initialize();
            const client = SupabaseManager.getClient();
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];
            
            const companyIds = [primaryCompanyId, competitorCompanyId].filter(Boolean);
            
            const [fbResult, googleResult, igResult] = await Promise.all([
                client
                    .from('facebook_ads')
                    .select('id, company_id, start_date_string')
                    .in('company_id', companyIds)
                    .gte('start_date_string', dateFilter),
                client
                    .from('google_ads')
                    .select('id, company_id, first_shown')
                    .in('company_id', companyIds)
                    .gte('first_shown', dateFilter),
                client
                    .from('instagram_posts')
                    .select('id, company_id, created_at')
                    .in('company_id', companyIds)
                    .gte('created_at', dateFilter)
            ]);
            
            const fbData = (fbResult.data || []).map(item => ({
                ...item,
                created_at: item.start_date_string
            }));
            const googleData = (googleResult.data || []).map(item => ({
                ...item,
                created_at: item.first_shown
            }));
            const allData = [
                ...fbData,
                ...googleData,
                ...(igResult.data || [])
            ];
            
            log('Battlefield raw data fetched', { 
                fb: fbResult.data?.length || 0,
                google: googleResult.data?.length || 0,
                ig: igResult.data?.length || 0
            });
            
            return allData;
        } catch (error) {
            log('Failed to fetch battlefield data: ' + error.message);
            return [];
        }
    }

    function aggregateByDay(data) {
        const dayMap = {};
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dayMap[dayKey] = { friendly: 0, hostile: 0, dateObj: new Date(date) };
        }
        
        data.forEach(item => {
            const itemDate = new Date(item.created_at);
            const dayKey = itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            if (dayMap[dayKey]) {
                if (item.company_id === primaryCompanyId) {
                    dayMap[dayKey].friendly++;
                } else if (item.company_id === competitorCompanyId) {
                    dayMap[dayKey].hostile++;
                }
            }
        });
        
        const labels = Object.keys(dayMap);
        const friendlyData = labels.map(key => dayMap[key].friendly);
        const hostileData = labels.map(key => -dayMap[key].hostile);
        
        return { labels, friendlyData, hostileData };
    }

    function renderBattlefieldChart(labels, friendlyData, hostileData) {
        const canvas = document.getElementById('battlefieldChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (battlefieldChart) {
            battlefieldChart.destroy();
        }
        
        battlefieldChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'US (Friendly)',
                        data: friendlyData,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: '#3B82F6',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: 'THEM (Hostile)',
                        data: hostileData,
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderColor: '#EF4444',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
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
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#F8FAFC',
                        bodyColor: '#94A3B8',
                        borderColor: 'rgba(148, 163, 184, 0.3)',
                        borderWidth: 1,
                        titleFont: {
                            family: "'JetBrains Mono', monospace",
                            size: 12,
                            weight: 600
                        },
                        bodyFont: {
                            family: "'JetBrains Mono', monospace",
                            size: 11
                        },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const value = Math.abs(context.raw);
                                const label = context.datasetIndex === 0 ? 'US Activity' : 'THEM Activity';
                                return label + ': ' + value;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#64748B',
                            font: {
                                family: "'JetBrains Mono', monospace",
                                size: 9
                            },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        border: {
                            display: false
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: false
                        },
                        border: {
                            display: true,
                            color: 'rgba(255, 255, 255, 0.8)',
                            width: 2
                        }
                    }
                }
            }
        });
        
        log('Battlefield chart rendered');
    }

    async function loadBattlefieldData() {
        log('Loading battlefield data...');
        
        if (!primaryCompanyId || !competitorCompanyId) {
            log('Missing company selection, skipping battlefield load');
            return;
        }
        
        const rawData = await fetchBattlefieldData();
        const { labels, friendlyData, hostileData } = aggregateByDay(rawData);
        
        renderBattlefieldChart(labels, friendlyData, hostileData);
    }

    async function init() {
        log('Initializing War Room...');

        updateSystemTime();
        setInterval(updateSystemTime, 1000);

        try {
            await refreshDashboard();
            
            await initMissionControl();
            await loadBattlefieldData();
            
            setInterval(refreshDashboard, 30000);
            setInterval(loadBattlefieldData, 30000);
            
            log('War Room initialized successfully');
        } catch (error) {
            log('Initialization error: ' + error.message);
            setConnectionStatus('error', 'ERROR');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
