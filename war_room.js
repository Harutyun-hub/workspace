(function() {
    'use strict';

    const WAR_ROOM_CONTEXT = 'WarRoom';
    
    const TOTOGAMING_ID = '9b67e411-ec00-47d9-87d4-a56dacf41e8a';
    
    let primaryCompanyId = TOTOGAMING_ID;
    let competitorCompanyId = null;
    let battlefieldChart = null;
    let companies = [];
    let battlefieldRawData = null;
    let currentHoverDate = null;

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
            loadSurveillanceData();
        });
        
        log('Mission Control initialized', { primary: primaryCompanyId, competitor: competitorCompanyId });
    }

    async function fetchBattlefieldData() {
        try {
            log('Fetching battlefield data (Paid vs Organic)...');
            
            await SupabaseManager.initialize();
            const client = SupabaseManager.getClient();
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];
            
            const companyIds = [primaryCompanyId, competitorCompanyId].filter(Boolean);
            
            const [fbResult, googleResult, igResult] = await Promise.all([
                client
                    .from('facebook_ads')
                    .select('id, company_id, start_date_string, ad_image_url, ad_text, page_name')
                    .in('company_id', companyIds)
                    .gte('start_date_string', dateFilter)
                    .order('start_date_string', { ascending: false }),
                client
                    .from('google_ads')
                    .select('id, company_id, first_shown, image_url, url')
                    .in('company_id', companyIds)
                    .gte('first_shown', dateFilter)
                    .order('first_shown', { ascending: false }),
                client
                    .from('instagram_posts')
                    .select('id, company_id, created_at, display_uri, text, username')
                    .in('company_id', companyIds)
                    .gte('created_at', dateFilter)
                    .order('created_at', { ascending: false })
            ]);
            
            const fbData = (fbResult.data || []).map(item => ({
                ...item,
                created_at: item.start_date_string,
                source: 'facebook',
                type: 'paid',
                image_url: item.ad_image_url,
                text: item.ad_text,
                title: item.page_name
            }));
            
            const googleData = (googleResult.data || []).map(item => ({
                ...item,
                created_at: item.first_shown,
                source: 'google',
                type: 'paid',
                image_url: item.image_url,
                text: item.url,
                title: 'Google Ad'
            }));
            
            const igData = (igResult.data || []).map(item => ({
                ...item,
                source: 'instagram',
                type: 'organic',
                image_url: item.display_uri,
                text: item.text,
                title: item.username
            }));
            
            const allData = [...fbData, ...googleData, ...igData];
            
            log('Battlefield raw data fetched', { 
                fb: fbData.length,
                google: googleData.length,
                ig: igData.length,
                total: allData.length
            });
            
            battlefieldRawData = allData;
            return allData;
        } catch (error) {
            log('Failed to fetch battlefield data: ' + error.message);
            return [];
        }
    }

    function aggregateByDay(data) {
        const daysList = [];
        const dayMap = {};
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const isoDate = date.toISOString().split('T')[0];
            
            daysList.push({ dayKey, isoDate });
            dayMap[dayKey] = { 
                friendlyPaid: 0, 
                friendlyOrganic: 0,
                hostilePaid: 0, 
                hostileOrganic: 0
            };
        }
        
        data.forEach(item => {
            if (!item.created_at) return;
            const itemDate = new Date(item.created_at);
            const dayKey = itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            if (dayMap[dayKey]) {
                const isFriendly = item.company_id === primaryCompanyId;
                const isPaid = item.type === 'paid';
                
                if (isFriendly) {
                    if (isPaid) {
                        dayMap[dayKey].friendlyPaid++;
                    } else {
                        dayMap[dayKey].friendlyOrganic++;
                    }
                } else if (item.company_id === competitorCompanyId) {
                    if (isPaid) {
                        dayMap[dayKey].hostilePaid++;
                    } else {
                        dayMap[dayKey].hostileOrganic++;
                    }
                }
            }
        });
        
        const labels = daysList.map(d => d.dayKey);
        const isoDates = daysList.map(d => d.isoDate);
        const friendlyPaidData = labels.map(key => dayMap[key].friendlyPaid);
        const friendlyOrganicData = labels.map(key => dayMap[key].friendlyOrganic);
        const hostilePaidData = labels.map(key => -dayMap[key].hostilePaid);
        const hostileOrganicData = labels.map(key => -dayMap[key].hostileOrganic);
        
        return { labels, isoDates, friendlyPaidData, friendlyOrganicData, hostilePaidData, hostileOrganicData };
    }

    function renderBattlefieldChart(chartData) {
        const canvas = document.getElementById('battlefieldChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (battlefieldChart) {
            battlefieldChart.destroy();
        }
        
        battlefieldChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Friendly Paid Ads',
                        data: chartData.friendlyPaidData,
                        backgroundColor: '#3B82F6',
                        borderColor: '#3B82F6',
                        borderWidth: 0,
                        borderRadius: 2,
                        barPercentage: 0.85,
                        categoryPercentage: 0.9,
                        stack: 'Us'
                    },
                    {
                        label: 'Friendly Organic',
                        data: chartData.friendlyOrganicData,
                        backgroundColor: 'rgba(59, 130, 246, 0.3)',
                        borderColor: 'rgba(59, 130, 246, 0.5)',
                        borderWidth: 1,
                        borderRadius: 2,
                        barPercentage: 0.85,
                        categoryPercentage: 0.9,
                        stack: 'Us'
                    },
                    {
                        label: 'Enemy Paid Ads',
                        data: chartData.hostilePaidData,
                        backgroundColor: '#EF4444',
                        borderColor: '#EF4444',
                        borderWidth: 0,
                        borderRadius: 2,
                        barPercentage: 0.85,
                        categoryPercentage: 0.9,
                        stack: 'Them'
                    },
                    {
                        label: 'Enemy Organic',
                        data: chartData.hostileOrganicData,
                        backgroundColor: 'rgba(239, 68, 68, 0.3)',
                        borderColor: 'rgba(239, 68, 68, 0.5)',
                        borderWidth: 1,
                        borderRadius: 2,
                        barPercentage: 0.85,
                        categoryPercentage: 0.9,
                        stack: 'Them'
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
                onHover: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const hoveredDate = chartData.isoDates[index];
                        const hoveredLabel = chartData.labels[index];
                        if (currentHoverDate !== hoveredDate) {
                            currentHoverDate = hoveredDate;
                            updateIntelFeed(hoveredDate, hoveredLabel);
                        }
                    }
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
                                const labels = ['US Paid', 'US Organic', 'THEM Paid', 'THEM Organic'];
                                return labels[context.datasetIndex] + ': ' + value;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
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
                        stacked: true,
                        grid: {
                            color: (context) => {
                                if (context.tick.value === 0) {
                                    return 'rgba(255, 255, 255, 0.8)';
                                }
                                return 'transparent';
                            },
                            lineWidth: (context) => {
                                if (context.tick.value === 0) {
                                    return 2;
                                }
                                return 0;
                            }
                        },
                        ticks: {
                            display: false
                        },
                        border: {
                            display: false
                        }
                    }
                }
            }
        });
        
        log('Stacked battlefield chart rendered');
    }

    function updateIntelFeed(dateStr, label) {
        const contentEl = document.getElementById('intelFeedContent');
        const statusEl = document.getElementById('intelFeedStatus');
        
        if (!contentEl) return;
        
        if (!battlefieldRawData || battlefieldRawData.length === 0 || !competitorCompanyId) {
            contentEl.innerHTML = `
                <div class="intel-loading">
                    <span class="intel-loading-text">Loading intel data...</span>
                </div>
            `;
            return;
        }
        
        statusEl.textContent = 'SCANNING ' + label;
        statusEl.classList.add('active');
        
        const dayItems = battlefieldRawData.filter(item => {
            const itemDate = new Date(item.created_at).toISOString().split('T')[0];
            return itemDate === dateStr && item.company_id === competitorCompanyId;
        });
        
        const paidFirst = dayItems.sort((a, b) => {
            if (a.type === 'paid' && b.type !== 'paid') return -1;
            if (a.type !== 'paid' && b.type === 'paid') return 1;
            return 0;
        });
        
        const topItems = paidFirst.slice(0, 3);
        
        if (topItems.length === 0) {
            contentEl.innerHTML = `
                <div class="intel-empty">
                    <span class="intel-empty-icon">🔍</span>
                    <span class="intel-empty-text">No enemy intel for ${label}</span>
                </div>
            `;
            return;
        }
        
        contentEl.innerHTML = topItems.map(item => renderIntelCard(item)).join('');
    }

    function renderIntelCard(item) {
        const sourceIcon = {
            'facebook': '📘',
            'google': '🔷',
            'instagram': '📸'
        };
        
        const typeLabel = item.type === 'paid' ? 'PAID' : 'ORGANIC';
        const textContent = item.text || item.title || '';
        const truncatedText = textContent.length > 80 ? textContent.substring(0, 80) + '...' : textContent;
        const displayText = truncatedText || 'No description available';
        
        let dateStr = '';
        try {
            dateStr = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (e) {
            dateStr = 'Unknown date';
        }
        
        const thumbnailHtml = item.image_url 
            ? `<img class="intel-thumbnail" src="${item.image_url}" alt="Creative" onerror="this.parentElement.innerHTML='<div class=\\'intel-thumbnail-placeholder\\'><span>${sourceIcon[item.source] || '📄'}</span></div>'">`
            : `<div class="intel-thumbnail-placeholder"><span>${sourceIcon[item.source] || '📄'}</span></div>`;
        
        const sourceName = (item.source || 'unknown').toUpperCase();
        
        return `
            <div class="intel-card">
                ${thumbnailHtml}
                <div class="intel-details">
                    <span class="intel-source ${item.source || ''}">${sourceName} · ${typeLabel}</span>
                    <span class="intel-text">${displayText}</span>
                    <span class="intel-meta">${dateStr}</span>
                </div>
            </div>
        `;
    }

    function loadDefaultIntelFeed() {
        const contentEl = document.getElementById('intelFeedContent');
        const statusEl = document.getElementById('intelFeedStatus');
        
        if (!contentEl || !battlefieldRawData) {
            contentEl.innerHTML = `
                <div class="intel-loading">
                    <span class="intel-loading-text">Awaiting target selection...</span>
                </div>
            `;
            return;
        }
        
        statusEl.textContent = 'MONITORING';
        statusEl.classList.remove('active');
        
        const enemyPaid = battlefieldRawData
            .filter(item => item.company_id === competitorCompanyId && item.type === 'paid')
            .slice(0, 3);
        
        if (enemyPaid.length === 0) {
            const anyEnemy = battlefieldRawData
                .filter(item => item.company_id === competitorCompanyId)
                .slice(0, 3);
            
            if (anyEnemy.length === 0) {
                contentEl.innerHTML = `
                    <div class="intel-empty">
                        <span class="intel-empty-icon">📡</span>
                        <span class="intel-empty-text">No enemy activity detected<br/>in the last 30 days</span>
                    </div>
                `;
                return;
            }
            
            contentEl.innerHTML = anyEnemy.map(item => renderIntelCard(item)).join('');
            return;
        }
        
        contentEl.innerHTML = enemyPaid.map(item => renderIntelCard(item)).join('');
    }

    async function loadBattlefieldData() {
        log('Loading battlefield data (stacked)...');
        
        if (!primaryCompanyId || !competitorCompanyId) {
            log('Missing company selection, skipping battlefield load');
            return;
        }
        
        const rawData = await fetchBattlefieldData();
        const chartData = aggregateByDay(rawData);
        
        renderBattlefieldChart(chartData);
        loadDefaultIntelFeed();
    }

    const MAJOR_PLATFORM_DOMAINS = [
        'facebook', 'fbcdn', 'fb.com', 'connect.facebook.net',
        'google', 'googletagmanager', 'googlesyndication', 'googleapis', 'gstatic',
        'tiktok', 'tiktokcdn',
        'hotjar',
        'doubleclick', 'googleadservices'
    ];

    async function scanTechStack() {
        const statusEl = document.getElementById('techRadarStatus');
        const metaBadge = document.getElementById('metaPixelBadge');
        const gtmBadge = document.getElementById('gtmBadge');
        const tiktokBadge = document.getElementById('tiktokBadge');
        const hotjarBadge = document.getElementById('hotjarBadge');
        const metaItem = document.getElementById('metaPixelItem');
        const gtmItem = document.getElementById('gtmItem');
        const tiktokItem = document.getElementById('tiktokItem');
        const hotjarItem = document.getElementById('hotjarItem');
        const otherScriptsSection = document.getElementById('otherScriptsSection');
        const otherScriptsList = document.getElementById('otherScriptsList');
        
        if (!competitorCompanyId) {
            if (statusEl) statusEl.textContent = 'AWAITING TARGET';
            return;
        }
        
        if (statusEl) statusEl.textContent = 'SCANNING...';
        
        try {
            await SupabaseManager.initialize();
            const supabase = SupabaseManager.getClient();
            
            const { data, error } = await supabase
                .from('website_data')
                .select('tech_stack, created_at')
                .eq('company_id', competitorCompanyId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            if (error || !data || !data.tech_stack) {
                log('No tech_stack data found for competitor');
                if (statusEl) statusEl.textContent = 'NO DATA';
                resetTechBadges();
                if (otherScriptsSection) otherScriptsSection.style.display = 'none';
                return;
            }
            
            const techStack = data.tech_stack;
            const hasGTM = techStack.has_gtm === true;
            
            const metaDirect = techStack.meta_pixel_direct === true;
            const tiktokDirect = techStack.tiktok_pixel_direct === true;
            const hotjarDirect = techStack.hotjar_direct === true;
            
            updateTechBadgeGhost('meta', metaBadge, metaItem, metaDirect, hasGTM);
            updateTechBadgeGhost('gtm', gtmBadge, gtmItem, hasGTM, false);
            updateTechBadgeGhost('tiktok', tiktokBadge, tiktokItem, tiktokDirect, hasGTM);
            updateTechBadgeGhost('hotjar', hotjarBadge, hotjarItem, hotjarDirect, hasGTM);
            
            let detectedCount = 0;
            let inferredCount = 0;
            
            if (metaDirect) detectedCount++;
            else if (hasGTM) inferredCount++;
            
            if (hasGTM) detectedCount++;
            
            if (tiktokDirect) detectedCount++;
            else if (hasGTM) inferredCount++;
            
            if (hotjarDirect) detectedCount++;
            else if (hasGTM) inferredCount++;
            
            if (statusEl) {
                let statusText = '';
                if (detectedCount > 0) statusText += `${detectedCount} DETECTED`;
                if (inferredCount > 0) {
                    if (statusText) statusText += ' + ';
                    statusText += `${inferredCount} INFERRED`;
                }
                if (!statusText) statusText = '0 DETECTED';
                statusEl.textContent = statusText;
                statusEl.classList.toggle('active', detectedCount > 0 || inferredCount > 0);
            }
            
            renderOtherScripts(techStack.all_external_scripts, otherScriptsSection, otherScriptsList);
            
            log(`Tech scan complete: ${detectedCount} detected, ${inferredCount} inferred (GTM managed)`);
            
        } catch (error) {
            log('Tech scan error: ' + error.message);
            if (statusEl) statusEl.textContent = 'ERROR';
        }
    }
    
    function updateTechBadgeGhost(techType, badgeEl, itemEl, isDirect, hasGTM) {
        if (!badgeEl) return;
        
        itemEl?.classList.remove('detected', 'inferred');
        
        if (isDirect) {
            badgeEl.textContent = 'DETECTED';
            badgeEl.className = `tech-badge active ${techType}`;
            badgeEl.innerHTML = 'DETECTED';
            itemEl?.classList.add('detected');
        } else if (hasGTM && techType !== 'gtm') {
            badgeEl.className = `tech-badge inferred ${techType}`;
            badgeEl.innerHTML = `GTM MANAGED<span class="ghost-tooltip">Tracking is likely managed dynamically via Google Tag Manager container.</span>`;
            itemEl?.classList.add('inferred');
        } else {
            badgeEl.textContent = 'NOT DETECTED';
            badgeEl.className = 'tech-badge inactive';
        }
    }
    
    function resetTechBadges() {
        const badges = ['metaPixelBadge', 'gtmBadge', 'tiktokBadge', 'hotjarBadge'];
        const items = ['metaPixelItem', 'gtmItem', 'tiktokItem', 'hotjarItem'];
        const types = ['meta', 'gtm', 'tiktok', 'hotjar'];
        
        badges.forEach((id, index) => {
            const badge = document.getElementById(id);
            const item = document.getElementById(items[index]);
            updateTechBadgeGhost(types[index], badge, item, false, false);
        });
        
        const otherScriptsSection = document.getElementById('otherScriptsSection');
        if (otherScriptsSection) otherScriptsSection.style.display = 'none';
    }
    
    function renderOtherScripts(allScripts, sectionEl, listEl) {
        if (!sectionEl || !listEl) return;
        
        if (!allScripts || !Array.isArray(allScripts) || allScripts.length === 0) {
            sectionEl.style.display = 'none';
            return;
        }
        
        const filteredScripts = allScripts.filter(script => {
            const lowered = script.toLowerCase();
            return !MAJOR_PLATFORM_DOMAINS.some(domain => lowered.includes(domain));
        });
        
        if (filteredScripts.length === 0) {
            sectionEl.style.display = 'none';
            return;
        }
        
        const extractDomain = (url) => {
            try {
                let domain = url.replace(/^https?:\/\//, '').split('/')[0];
                const parts = domain.split('.');
                if (parts.length > 2) {
                    domain = parts.slice(-2).join('.');
                }
                return domain;
            } catch {
                return url;
            }
        };
        
        const uniqueDomains = [...new Set(filteredScripts.map(extractDomain))];
        
        listEl.innerHTML = uniqueDomains.slice(0, 10).map(domain => 
            `<span class="script-pill">${domain}</span>`
        ).join('');
        
        sectionEl.style.display = 'block';
        log(`Rendered ${uniqueDomains.length} unknown script domains`);
    }

    function renderAiTacticalInsight(screenshot) {
        if (!screenshot) return '';
        
        const promotionsDetected = screenshot.promotions_detected === true || 
                                   screenshot.promotions_detected === 'true';
        const hasAiAnalysis = screenshot.ai_analysis && 
                              String(screenshot.ai_analysis).trim() !== '';
        
        const hasAiData = promotionsDetected || hasAiAnalysis;
        
        if (!hasAiData) return '';
        
        const headline = screenshot.marketing_intent || 'Marketing Strategy Detected';
        const subtext = screenshot.ai_analysis || 'AI analysis pending...';
        
        return `
            <div class="ai-tactical-insight">
                <div class="ai-insight-header">
                    <span class="ai-insight-icon">🤖</span>
                    <span class="ai-insight-title">AI VISION ANALYSIS</span>
                    <span class="ai-insight-pulse"></span>
                </div>
                <div class="ai-insight-content">
                    <div class="ai-insight-headline">${escapeHtml(headline)}</div>
                    <div class="ai-insight-subtext">${escapeHtml(subtext)}</div>
                </div>
            </div>
        `;
    }

    async function loadVisualIntercept() {
        const contentEl = document.getElementById('visualInterceptContent');
        const statusEl = document.getElementById('visualInterceptStatus');
        
        if (!contentEl) return;
        
        if (!competitorCompanyId) {
            statusEl.textContent = 'AWAITING TARGET';
            statusEl.className = 'visual-intercept-status';
            contentEl.innerHTML = `
                <div class="visual-loading">
                    <span class="visual-loading-text">Select a target to intercept visuals...</span>
                </div>
            `;
            return;
        }
        
        statusEl.textContent = 'INTERCEPTING...';
        
        try {
            const supabase = await SupabaseManager.getClient();
            
            const { data, error } = await supabase
                .from('company_screenshots')
                .select('id, image_url, created_at, ai_analysis, marketing_intent, promotions_detected')
                .eq('company_id', competitorCompanyId)
                .order('created_at', { ascending: false })
                .limit(2);
            
            if (error) {
                log('Visual intercept error: ' + error.message);
                statusEl.textContent = 'ERROR';
                return;
            }
            
            if (!data || data.length === 0) {
                statusEl.textContent = 'NO INTEL';
                statusEl.className = 'visual-intercept-status';
                contentEl.innerHTML = `
                    <div class="no-intel">
                        <span class="no-intel-icon">🔍</span>
                        <span class="no-intel-text">NO VISUAL INTEL<br/>No screenshots captured yet</span>
                    </div>
                `;
                log('No screenshots found for competitor');
                return;
            }
            
            if (data.length === 1) {
                statusEl.textContent = 'BASELINE';
                statusEl.className = 'visual-intercept-status baseline';
                
                const screenshot = data[0];
                const dateStr = new Date(screenshot.created_at).toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric' 
                });
                
                const aiInsightHtml = renderAiTacticalInsight(screenshot);
                
                contentEl.innerHTML = `
                    <div class="single-screenshot">
                        <img src="${screenshot.image_url}" alt="Baseline screenshot" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect fill=%22%231E293B%22 width=%22400%22 height=%22300%22/><text fill=%22%2364748B%22 x=%22200%22 y=%22150%22 text-anchor=%22middle%22 font-family=%22monospace%22>Image unavailable</text></svg>'">
                        <div class="baseline-badge">BASELINE ESTABLISHED<br/>${dateStr}</div>
                    </div>
                    ${aiInsightHtml}
                `;
                log('Single screenshot found - showing baseline');
                return;
            }
            
            statusEl.textContent = 'COMPARING';
            statusEl.className = 'visual-intercept-status comparing';
            
            const [newer, older] = data;
            const newerDate = new Date(newer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const olderDate = new Date(older.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            const aiInsightHtml = renderAiTacticalInsight(newer);
            
            contentEl.innerHTML = `
                <div class="diff-slider-container" id="diffSlider">
                    <img class="diff-image before" src="${older.image_url}" alt="Before">
                    <img class="diff-image after" src="${newer.image_url}" alt="After">
                    <div class="diff-slider-handle" id="diffHandle"></div>
                    <div class="diff-labels">
                        <span class="diff-label before">BEFORE (${olderDate})</span>
                        <span class="diff-label after">AFTER (${newerDate})</span>
                    </div>
                </div>
                ${aiInsightHtml}
            `;
            
            initDiffSlider();
            log('Two screenshots found - diff slider initialized');
            
        } catch (error) {
            log('Visual intercept error: ' + error.message);
            statusEl.textContent = 'ERROR';
        }
    }
    
    function initDiffSlider() {
        const container = document.getElementById('diffSlider');
        const handle = document.getElementById('diffHandle');
        const afterImage = container?.querySelector('.diff-image.after');
        
        if (!container || !handle || !afterImage) return;
        
        let isDragging = false;
        
        function updateSlider(clientX) {
            const rect = container.getBoundingClientRect();
            let position = ((clientX - rect.left) / rect.width) * 100;
            position = Math.max(0, Math.min(100, position));
            
            handle.style.left = `${position}%`;
            afterImage.style.clipPath = `inset(0 ${100 - position}% 0 0)`;
        }
        
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            e.preventDefault();
        });
        
        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateSlider(e.clientX);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                updateSlider(e.clientX);
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        handle.addEventListener('touchstart', (e) => {
            isDragging = true;
            e.preventDefault();
        });
        
        container.addEventListener('touchstart', (e) => {
            isDragging = true;
            updateSlider(e.touches[0].clientX);
        });
        
        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length > 0) {
                updateSlider(e.touches[0].clientX);
            }
        });
        
        document.addEventListener('touchend', () => {
            isDragging = false;
        });
    }

    const PROMO_CATEGORIES = {
        money: { icon: '💰', label: 'Bonus', cssClass: 'money' },
        spins: { icon: '🎰', label: 'Spins', cssClass: 'spins' },
        chips: { icon: '🎫', label: 'Free Bet', cssClass: 'chips' },
        events: { icon: '🏆', label: 'Event', cssClass: 'events' }
    };

    async function loadMarketIntel() {
        const statusEl = document.getElementById('marketIntelStatus');
        const contentEl = document.getElementById('marketIntelContent');
        const headlineEl = document.getElementById('marketIntelHeadline');
        const pillsEl = document.getElementById('promoPillsContainer');
        
        if (!contentEl || !pillsEl) return;
        
        if (!competitorCompanyId) {
            if (statusEl) statusEl.textContent = 'AWAITING TARGET';
            if (statusEl) statusEl.className = 'market-intel-status';
            if (headlineEl) {
                headlineEl.textContent = '';
                headlineEl.classList.remove('visible');
            }
            pillsEl.innerHTML = `
                <div class="promo-loading">
                    <span class="promo-loading-text">Select a target to scan promotions...</span>
                </div>
            `;
            return;
        }
        
        if (statusEl) {
            statusEl.textContent = 'SCANNING...';
            statusEl.className = 'market-intel-status';
        }
        
        try {
            await SupabaseManager.initialize();
            const supabase = SupabaseManager.getClient();
            
            const { data, error } = await supabase
                .from('website_data')
                .select('active_promotions, created_at')
                .eq('company_id', competitorCompanyId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (error) {
                log('Market intel error: ' + error.message);
                if (statusEl) {
                    statusEl.textContent = 'ERROR';
                    statusEl.className = 'market-intel-status';
                }
                return;
            }
            
            if (!data || !data.active_promotions) {
                renderNoPromo(statusEl, headlineEl, pillsEl);
                log('No active promotions data found');
                return;
            }
            
            const promos = data.active_promotions;
            const offers = promos.offers || {};
            const headline = promos.headline || null;
            const description = promos.description || null;
            
            const hasAnyPromo = ['money', 'spins', 'chips', 'events'].some(
                cat => Array.isArray(offers[cat]) && offers[cat].length > 0
            );
            
            if (!hasAnyPromo) {
                renderNoPromo(statusEl, headlineEl, pillsEl);
                log('No active offers in any category');
                return;
            }
            
            if (statusEl) {
                statusEl.textContent = 'ACTIVE';
                statusEl.className = 'market-intel-status active';
            }
            
            if (headline && headlineEl) {
                headlineEl.textContent = headline;
                headlineEl.classList.add('visible');
            } else if (headlineEl) {
                headlineEl.textContent = '';
                headlineEl.classList.remove('visible');
            }
            
            let pillsHtml = '';
            const tooltipText = description ? escapeHtml(description) : '';
            
            for (const [category, config] of Object.entries(PROMO_CATEGORIES)) {
                const items = offers[category];
                if (Array.isArray(items) && items.length > 0) {
                    for (const item of items) {
                        const rawText = String(item);
                        pillsHtml += `
                            <span class="promo-pill ${config.cssClass}">
                                <span class="promo-pill-icon">${config.icon}</span>
                                <span class="promo-pill-text">${escapeHtml(rawText)}</span>
                                ${tooltipText ? `<span class="promo-tooltip">${tooltipText}</span>` : ''}
                            </span>
                        `;
                    }
                }
            }
            
            pillsEl.innerHTML = pillsHtml;
            
            const totalCount = ['money', 'spins', 'chips', 'events'].reduce(
                (sum, cat) => sum + (Array.isArray(offers[cat]) ? offers[cat].length : 0), 0
            );
            log(`Rendered ${totalCount} promo pills`);
            
        } catch (error) {
            log('Market intel error: ' + error.message);
            if (statusEl) statusEl.textContent = 'ERROR';
        }
    }
    
    function renderNoPromo(statusEl, headlineEl, pillsEl) {
        if (statusEl) {
            statusEl.textContent = 'NO PROMO';
            statusEl.className = 'market-intel-status no-promo';
        }
        if (headlineEl) {
            headlineEl.textContent = '';
            headlineEl.classList.remove('visible');
        }
        if (pillsEl) {
            pillsEl.innerHTML = `
                <div class="no-promo-message">
                    <span class="no-promo-icon">📭</span>
                    <span class="no-promo-text">No Active Promo</span>
                </div>
            `;
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function loadSurveillanceData() {
        log('Loading surveillance data...');
        await Promise.all([
            scanTechStack(),
            loadVisualIntercept(),
            loadMarketIntel()
        ]);
    }

    async function init() {
        log('Initializing War Room...');

        updateSystemTime();
        setInterval(updateSystemTime, 1000);

        try {
            await refreshDashboard();
            
            await initMissionControl();
            await loadBattlefieldData();
            await loadSurveillanceData();
            
            setInterval(refreshDashboard, 30000);
            setInterval(loadBattlefieldData, 30000);
            setInterval(loadSurveillanceData, 30000);
            
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
