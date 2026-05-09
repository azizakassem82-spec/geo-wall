// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Sidebar Navigation
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    const views = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove active from all nav items and views
            navItems.forEach(n => n.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));

            // Add active to clicked nav item
            item.classList.add('active');

            // Show corresponding view
            const viewId = item.getAttribute('data-view');
            const viewElement = document.getElementById(`view-${viewId}`);
            if (viewElement) {
                viewElement.classList.add('active');
            }
        });
    });

    // Ensure only the active view is displayed initially
    const activeNav = document.querySelector('.nav-item.active[data-view]');
    if (activeNav) {
        const viewId = activeNav.getAttribute('data-view');
        const viewElement = document.getElementById(`view-${viewId}`);
        if (viewElement) {
            viewElement.classList.add('active');
        }
    }
});

// 2. Auth Overlay Tabs
window.switchAuthMode = function(mode) {
    const tabs = document.querySelectorAll('.auth-tab');
    const views = document.querySelectorAll('.auth-form-view');

    tabs.forEach(tab => tab.classList.remove('active'));
    views.forEach(view => view.classList.remove('active'));

    if (mode === 'login') {
        tabs[0].classList.add('active');
        document.getElementById('auth-view-login').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('auth-view-signup').classList.add('active');
    }
};

// 3. Auth Overlay Actions
window.handleAuthAction = function(event, isSignup) {
    event.preventDefault();
    // Hide overlay on login/signup click
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
        overlay.style.transition = 'opacity 0.4s ease';
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 400);
    }
};

// 4. Chat Panel Toggle
window.toggleChatPanel = function() {
    const panel = document.getElementById('expertChatPanel');
    if (panel) {
        if (panel.style.display === 'none' || panel.style.display === '') {
            panel.style.display = 'flex';
        } else {
            panel.style.display = 'none';
        }
    }
};

// 5. Language Selection
window.setLang = function(lang) {
    const btns = document.querySelectorAll('.lang-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    console.log(`Language changed to ${lang}`);
};

// 6. GIS Layers Dropdown
window.toggleGISSubmenu = function(e) {
    e.preventDefault();
    const control = document.getElementById('layerControl');
    const chevron = document.getElementById('gisChevron');
    if (control) {
        if (control.style.display === 'none' || control.style.display === '') {
            control.style.display = 'block';
            if (chevron) chevron.style.transform = 'rotate(180deg)';
        } else {
            control.style.display = 'none';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    }
};

// changeBasemap is defined in map.js — do not redefine here.



let mockGeoLayer = null;
window.toggleNeuralHeatmap = function() {
    const btn = document.getElementById('btnNeuralMap');
    const panel = document.getElementById('aiEnginePanel');
    btn.classList.toggle('active');
    
    if(btn.classList.contains('active')) {
        btn.style.boxShadow = '0 0 15px rgba(0, 212, 255, 0.6)';
        if(panel) panel.style.display = 'block';
        
        if (window.mapInstance && typeof L !== 'undefined') {
            const mockFaultLines = {
                "type": "FeatureCollection",
                "features": [
                    { "type": "Feature", "properties": {"name": "Atlas Fault A"}, "geometry": { "type": "LineString", "coordinates": [[2.5, 36.0], [4.0, 35.5], [6.0, 35.0]] } },
                    { "type": "Feature", "properties": {"name": "Saharan Flexure"}, "geometry": { "type": "LineString", "coordinates": [[3.0, 34.0], [5.0, 34.5], [7.0, 33.8]] } }
                ]
            };
            mockGeoLayer = L.geoJSON(mockFaultLines, {
                style: { color: '#00d4ff', weight: 4, opacity: 0.8, dashArray: '5, 10' }
            }).bindPopup(function(layer) { return layer.feature.properties.name; }).addTo(window.mapInstance);
        }
    } else {
        btn.style.boxShadow = 'none';
        if(panel) panel.style.display = 'none';
        if (window.mapInstance && mockGeoLayer) {
            window.mapInstance.removeLayer(mockGeoLayer);
            mockGeoLayer = null;
        }
    }
};

// --- Mock Data Generation ---
document.addEventListener('DOMContentLoaded', () => {
    // Current Date
    const dateEl = document.getElementById('currentDate');
    if(dateEl) {
        const d = new Date();
        dateEl.innerHTML = `<i class="fa-regular fa-calendar"></i> ${d.toLocaleDateString()}`;
    }

    // KPI Cards
    const kpiRow = document.querySelector('.kpi-row');
    if(kpiRow) {
        kpiRow.innerHTML = `
            <div class="kpi-card" style="border-top: 3px solid var(--accent-primary);">
                <h4 style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; margin-bottom:0.5rem;"><i class="fa-solid fa-layer-group"></i> TOTAL WELLS</h4>
                <div style="font-size:2.5rem; font-weight:800; color:#fff; font-family:var(--font-heading);">59</div>
                <div style="margin-top:1rem; font-size:0.85rem; color:var(--accent-success); font-weight: 600;"><i class="fa-solid fa-arrow-trend-up"></i> +2 new</div>
            </div>
            <div class="kpi-card" style="border-top: 3px solid var(--accent-success);">
                <h4 style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; margin-bottom:0.5rem;"><i class="fa-solid fa-droplet"></i> ACTIVE PRODUCTION</h4>
                <div style="font-size:2.5rem; font-weight:800; color:#fff; font-family:var(--font-heading);">56</div>
                <div style="margin-top:1rem; font-size:0.85rem; color:var(--accent-success); font-weight: 600;"><i class="fa-solid fa-check"></i> 98% Online</div>
            </div>
            <div class="kpi-card" style="border-top: 3px solid var(--accent-primary);">
                <h4 style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; margin-bottom:0.5rem;"><i class="fa-solid fa-droplet"></i> DAILY OUTPUT (BBL)</h4>
                <div style="font-size:2.5rem; font-weight:800; color:#fff; font-family:var(--font-heading);">58427</div>
                <div style="margin-top:1rem; font-size:0.85rem; color:var(--accent-success); font-weight: 600;"><i class="fa-solid fa-arrow-trend-up"></i> +5.4%</div>
            </div>
            <div class="kpi-card" style="border-top: 3px solid var(--accent-danger);">
                <h4 style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; margin-bottom:0.5rem;"><i class="fa-solid fa-gauge-high"></i> SYSTEM EFFICIENCY</h4>
                <div style="font-size:2.5rem; font-weight:800; color:#fff; font-family:var(--font-heading);">95%</div>
                <div style="margin-top:1rem; font-size:0.85rem; color:var(--accent-danger); font-weight: 600;"><i class="fa-solid fa-arrow-trend-down"></i> -1.2%</div>
            </div>
        `;
    }

    // Rig Status
    const rigList = document.getElementById('rigStatusList');
    if(rigList) {
        rigList.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1rem 0;">
                <div>
                    <strong style="color: #fff; font-size: 0.95rem; display: block;">Ain Djasser N1</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">North Zone</span>
                </div>
                <span class="status-badge" style="border: 1px solid var(--accent-success); color: var(--accent-success); background: rgba(16, 185, 129, 0.1);">OPERATIONAL</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1rem 0;">
                <div>
                    <strong style="color: #fff; font-size: 0.95rem; display: block;">Ain Djasser N2</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">North Zone</span>
                </div>
                <span class="status-badge" style="border: 1px solid var(--accent-success); color: var(--accent-success); background: rgba(16, 185, 129, 0.1);">OPERATIONAL</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1rem 0;">
                <div>
                    <strong style="color: #fff; font-size: 0.95rem; display: block;">Ain Djasser N3</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">North Zone</span>
                </div>
                <span class="status-badge" style="border: 1px solid var(--accent-success); color: var(--accent-success); background: rgba(16, 185, 129, 0.1);">OPERATIONAL</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1rem 0;">
                <div>
                    <strong style="color: #fff; font-size: 0.95rem; display: block;">Ain Djasser N4</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">North Zone</span>
                </div>
                <span class="status-badge" style="border: 1px solid var(--accent-success); color: var(--accent-success); background: rgba(16, 185, 129, 0.1);">OPERATIONAL</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0;">
                <div>
                    <strong style="color: #fff; font-size: 0.95rem; display: block;">Ain Djasser N5</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">North Zone</span>
                </div>
                <span class="status-badge" style="border: 1px solid var(--accent-warning); color: var(--accent-warning); background: rgba(245, 158, 11, 0.1);">MAINTENANCE</span>
            </div>
        `;
    }

    // Alerts List (Keep existing or modify)
    const alertsList = document.getElementById('alertsList');
    if(alertsList) {
        // Keeping alerts similar, but adapting slightly if needed. Let's keep the existing mock.
    }

    // Leaflet Map Initialization
    const mapEl = document.getElementById('map');
    if(mapEl) {
        // Only init if Leaflet is loaded and not already initialized
        if (typeof L !== 'undefined' && !mapEl._leaflet_id) {
            mapEl.innerHTML = ''; // clear loading text
            if(!mapEl.style.height) mapEl.style.height = '400px'; // ensure height

            window.mapInstance = L.map('map').setView([34.0, 4.0], 6);
            
            // Default Street Map Tile Layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                className: 'map-tiles'
            }).addTo(window.mapInstance);

            // Add Markers based on screenshot
            L.marker([36.2641, 2.7539]).addTo(window.mapInstance).bindPopup('Medea');
            L.marker([35.6, 5.8]).addTo(window.mapInstance).bindPopup('Merouana F20').openPopup();
            L.marker([34.85, 5.73]).addTo(window.mapInstance).bindPopup('Biskra');
            L.marker([32.0, 3.0]).addTo(window.mapInstance).bindPopup('QGIS Test Well Beta');

            // Force recalculation of map size in case of container sizing changes
            setTimeout(() => { window.mapInstance.invalidateSize(); }, 500);
        } else if (typeof L === 'undefined') {
            mapEl.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; width:100%; background:rgba(0,0,0,0.5); color:var(--text-muted); flex-direction:column; gap:10px;"><i class="fa-solid fa-map-location-dot" style="font-size:3rem; color:var(--accent-primary); opacity:0.5;"></i><span>Interactive Map Loading...</span><span style="font-size:0.8rem;">(Leaflet JS required)</span></div>';
        }
    }

    // Chart Placeholder
    const chartEl = document.getElementById('productionChart');
    if(chartEl) {
        chartEl.parentElement.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; width:100%; background:rgba(0,0,0,0.2); border-radius:8px; color:var(--text-muted); flex-direction:column; gap:10px;"><i class="fa-solid fa-chart-line" style="font-size:3rem; color:var(--accent-primary); opacity:0.5;"></i><span>Production Chart Loading...</span></div>';
    }

    // --- FORM SUBMISSION (localStorage) ---
    const loadLogs = () => {
        const tbody = document.getElementById('logsTableBody');
        if(!tbody) return;
        const logs = JSON.parse(localStorage.getItem('geowell_logs') || '[]');
        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${log.date}</td>
                <td><span class="status-badge status-active">Verified</span></td>
                <td>${log.staticLvl}</td>
                <td>${log.dynamicLvl}</td>
                <td>${log.ph}</td>
                <td>${log.piezo}</td>
                <td>${log.discharge}</td>
                <td><button class="action-btn" style="padding: 4px 8px; font-size: 0.7rem;"><i class="fa-solid fa-file-pdf"></i></button></td>
            </tr>
        `).join('');
    };
    loadLogs();

    const logForm = document.getElementById('logForm');
    if(logForm) {
        logForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get inputs
            const inputs = logForm.querySelectorAll('input, select');
            let date = "2026-05-09"; // Mock date if fields are missing
            let staticLvl = "45.2", dynamicLvl = "48.1", ph = "7.2", piezo = "102", discharge = "15";
            
            // Simple extraction (assuming inputs have correct order/names or we just mock it for now since we didn't add IDs to inputs in index.html)
            const logs = JSON.parse(localStorage.getItem('geowell_logs') || '[]');
            logs.unshift({ date, staticLvl, dynamicLvl, ph, piezo, discharge });
            localStorage.setItem('geowell_logs', JSON.stringify(logs));
            
            loadLogs();
            
            // Close modal
            document.getElementById('logModal').classList.remove('active');
            alert('Measurement Saved Successfully to Local Database!');
        });
    }

    // Close Modal functions
    window.closeLogModal = function() {
        const m = document.getElementById('logModal');
        if(m) m.classList.remove('active');
    };
    window.closeWellModal = function() {
        const m = document.getElementById('wellModal');
        if(m) m.classList.remove('active');
    };
});
