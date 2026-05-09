/**
 * Advanced Analytics Engine — GeoWell Smart Data Platform
 * Per-chart well selectors + full hydrogeochemical diagrams
 */

// ─── Per-chart well state ────────────────────────────────────────────────────
// Stores selected well IDs for each chart. null = use global pool.
const chartWellState = {};

// All chart IDs that have per-chart selectors
const CHART_IDS = [
    'chartCalibration', 'chartPrediction', 'chartHeatmap',
    'chartTemporal', 'chartSchoeller',
    'chartIrrigation', 'chartBinary', 'chartBinary2', 'chartSaturation'
];

// Default wells shown on initial load
const DEFAULT_WELL_IDS = ['F-02', 'F-05', 'F-09', 'F-14'];

class AnalyticsEngine {
    constructor() {
        this.charts = {};
        this.initialized = false;
        // Seed default selection for every chart
        CHART_IDS.forEach(id => { chartWellState[id] = [...DEFAULT_WELL_IDS]; });
    }

    init() {
        if (this.initialized) return;
        this.refresh();
        this.initialized = true;
    }

    refresh() {
        CHART_IDS.forEach(id => {
            const panel = document.getElementById(`panel-${id}`);
            if (panel && panel.innerHTML === '') {
                this.buildWellPanel(id);
            }
            this.renderChart(id);
        });
    }

    /** Render a single chart by ID */
    renderChart(chartId) {
        const ids = this._wells(chartId);
        switch (chartId) {
            case 'chartCalibration': this.renderCalibrationCurve(ids); break;
            case 'chartPrediction':  this.renderPredictionChart(ids);  break;
            case 'chartHeatmap':     this.renderHeatMapSimulation(ids);break;
            case 'chartTemporal':    this.renderTemporalChart(ids);     break;
            case 'chartSchoeller':   this.renderSchoellerDiagram(ids); break;
            case 'chartIrrigation':  this.renderIrrigationChart(ids);  break;
            case 'chartBinary':      this.renderBinaryPlot(ids);        break;
            case 'chartBinary2':     this.renderBinaryPlot2(ids);       break;
            case 'chartSaturation':  this.renderSaturationIndices(ids);break;
        }
        this.updatePillBar(chartId);
        
        if (typeof renderAIInsight === 'function') {
            const wells = mockData.rigs.filter(r => ids.includes(r.id));
            renderAIInsight(chartId, wells);
        }
    }

    /** Get well IDs for a chart (falls back to all wells if empty) */
    _wells(chartId) {
        const ids = chartWellState[chartId] || [];
        if (ids.length > 0) return ids;
        // fallback: all wells with chemical data
        return mockData.rigs.filter(r => r.chemical).map(r => r.id).slice(0, 6);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PER-CHART WELL PANEL
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Build (or rebuild) the well-select panel for a chart.
     * Called when the global filter changes or panel is toggled open.
     */
    buildWellPanel(chartId) {
        const panel = document.getElementById(`panel-${chartId}`);
        if (!panel) return;

        const pool = this._getGlobalPool();
        if (pool.length === 0) {
            panel.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem;">No wells in current filter</span>';
            return;
        }

        const current = chartWellState[chartId] || [];
        panel.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;padding:0.6rem 0;';

        // "All" and "None" shortcuts
        const btnAll  = this._miniBtn('All',  () => { chartWellState[chartId] = pool.map(w=>w.id); this.buildWellPanel(chartId); this.renderChart(chartId); });
        const btnNone = this._miniBtn('None', () => { chartWellState[chartId] = []; this.buildWellPanel(chartId); this.renderChart(chartId); });
        btnAll.style.marginRight  = '0.2rem';
        wrap.appendChild(btnAll);
        wrap.appendChild(btnNone);

        pool.forEach(w => {
            const checked = current.includes(w.id);
            const lbl = document.createElement('label');
            lbl.style.cssText = `display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;cursor:pointer;padding:0.2rem 0.5rem;border-radius:20px;border:1px solid ${checked ? 'var(--accent-primary)' : 'var(--border-color)'};background:${checked ? 'rgba(0,212,255,0.12)' : 'transparent'};color:${checked ? 'var(--accent-primary)' : 'var(--text-muted)'};transition:all 0.2s;`;
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = checked;
            cb.style.display = 'none';
            cb.addEventListener('change', () => {
                const sel = chartWellState[chartId] || [];
                if (cb.checked) { if (!sel.includes(w.id)) sel.push(w.id); }
                else { const i = sel.indexOf(w.id); if (i > -1) sel.splice(i,1); }
                chartWellState[chartId] = sel;
                this.buildWellPanel(chartId); // refresh style
                this.renderChart(chartId);
            });
            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(w.name || w.id));
            lbl.addEventListener('click', () => { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); });
            wrap.appendChild(lbl);
        });

        panel.appendChild(wrap);
    }

    _miniBtn(text, onClick) {
        const b = document.createElement('button');
        b.textContent = text;
        b.style.cssText = 'font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:4px;border:1px solid var(--border-color);background:rgba(255,255,255,0.05);color:var(--text-muted);cursor:pointer;';
        b.addEventListener('click', onClick);
        return b;
    }

    /** Update the pill bar (chips) in the card header */
    updatePillBar(chartId) {
        const pillsEl = document.getElementById(`cws-${chartId}`);
        if (!pillsEl) return;
        const ids = chartWellState[chartId] || [];
        const pool = this._getGlobalPool();
        const total = pool.length;
        pillsEl.innerHTML = '';
        if (ids.length === 0) {
            pillsEl.innerHTML = '<span style="font-size:0.7rem;color:#666;">None</span>';
        } else if (ids.length === total && total > 0) {
            pillsEl.innerHTML = `<span class="cws-chip all">All (${total})</span>`;
        } else {
            ids.slice(0, 3).forEach(wid => {
                const w = pool.find(x => x.id === wid);
                const chip = document.createElement('span');
                chip.className = 'cws-chip';
                chip.textContent = w ? (w.name || wid) : wid;
                pillsEl.appendChild(chip);
            });
            if (ids.length > 3) {
                const more = document.createElement('span');
                more.className = 'cws-chip more';
                more.textContent = `+${ids.length - 3}`;
                pillsEl.appendChild(more);
            }
        }
    }

    /** Current pool from global wilaya/daira filter */
    _getGlobalPool() {
        const wilaya = document.getElementById('analyticsWilaya')?.value || 'all';
        const daira  = document.getElementById('analyticsDaira')?.value  || 'all';
        return mockData.rigs.filter(r => {
            const mw = wilaya === 'all' || r.state    === wilaya;
            const md = daira  === 'all' || r.district === daira;
            return mw && md;
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DEEP-TECH CHARTS
    // ──────────────────────────────────────────────────────────────────────────
    renderDeepTechCharts() {
        this.renderCalibrationCurve();
        this.renderPredictionChart();
        this.renderHeatMapSimulation();
    }

    renderCalibrationCurve(selectedIds) {
        const ctx = document.getElementById('chartCalibration')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.calibration) this.charts.calibration.destroy();

        const wells = selectedIds && selectedIds.length > 0
            ? mockData.rigs.filter(r => selectedIds.includes(r.id) && (r.hydraulics?.piezometricLevel || r.hydraulics?.staticLevel))
            : mockData.rigs.filter(r => r.hydraulics?.piezometricLevel || r.hydraulics?.staticLevel).slice(0, 15);

        // Calculate deterministic "simulated" values based on observed to show a realistic model calibration
        // e.g., real model outputs are slightly off, dependent on geographic spread and depth
        const points = wells.map(w => {
            const obs = w.hydraulics?.piezometricLevel || w.hydraulics?.staticLevel || 100;
            // Deterministic error based on ID character codes, range roughly -2.5 to +2.5 meters
            const seed = (w.id.charCodeAt(0) + (w.id.charCodeAt(w.id.length-1) || 0)) % 10;
            const errorMargin = ((seed / 10) * 5) - 2.5; 
            const sim = obs + errorMargin;
            return { x: parseFloat(obs.toFixed(2)), y: parseFloat(sim.toFixed(2)), label: w.name, error: errorMargin };
        });

        if (points.length === 0) { points.push({x:0, y:0, label:'No Data'}); }

        const minV = Math.floor(Math.min(...points.map(p=>p.x)) - 10);
        const maxV = Math.ceil(Math.max(...points.map(p=>p.x)) + 10);

        this.charts.calibration = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    { 
                        label: 'Wells (Obs vs Sim)', 
                        data: points, 
                        backgroundColor: ctx2 => {
                            const err = Math.abs(ctx2.raw?.error || 0);
                            return err > 2 ? 'rgba(255, 71, 87, 0.8)' : (err > 1 ? 'rgba(255, 191, 0, 0.8)' : 'rgba(46, 213, 115, 0.8)');
                        },
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    },
                    { 
                        label: '1:1 Perfect Fit', 
                        data: [{x:minV,y:minV},{x:maxV,y:maxV}], 
                        type:'line', 
                        borderColor:'rgba(255, 255, 255, 0.4)', 
                        borderDash:[5,5], 
                        pointRadius:0, 
                        borderWidth: 2 
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { title:{display:true,text:'Observed Head (m)',color:'#94a3b8', font:{weight:'bold'}}, grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#e0e6ed'} },
                    y: { title:{display:true,text:'Simulated Head (m)',color:'#94a3b8', font:{weight:'bold'}}, grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#e0e6ed'} }
                },
                plugins: {
                    legend: { labels:{color:'#e0e6ed',font:{size:11, family:'Outfit'}} },
                    tooltip: { 
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#00d4ff',
                        callbacks:{ label: c => `${c.raw.label||''}: Obs: ${c.raw.x}m, Sim: ${c.raw.y}m (Δ ${Math.abs(c.raw.error).toFixed(2)}m)` } 
                    }
                }
            }
        });
        this.updatePillBar('chartCalibration');
    }

    renderPredictionChart(selectedIds) {
        const ctxEl = document.getElementById('chartPrediction');
        const ctx = ctxEl?.getContext('2d');
        if (!ctx) return;
        if (this.charts.prediction) this.charts.prediction.destroy();

        const wells = selectedIds && selectedIds.length > 0
            ? mockData.rigs.filter(r => selectedIds.includes(r.id))
            : mockData.rigs.slice(0, 4);

        const currentYear = new Date().getFullYear();
        const years = Array.from({length:10}, (_,i) => currentYear + i);
        
        const datasets = wells.slice(0, 5).map((w, idx) => {
            const baseLevel = w.hydraulics?.piezometricLevel || w.hydraulics?.staticLevel || 30;
            // Drawdown calculation based on well depth and pump type (deterministic realistic trend)
            const stressFactor = w.pumpType === 'Submersible' ? 1.5 : (w.pumpType === 'Centrifugal' ? 0.8 : 0.4);
            const trend = stressFactor + ((w.id.charCodeAt(0) % 5) * 0.2); // 0.4 to 2.3m drop per year
            
            // Create Gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, 250);
            const colors = [
                {r:255, g:71, b:87},   // Red
                {r:255, g:191, b:0},   // Yellow
                {r:46, g:213, b:115},  // Green
                {r:0, g:212, b:255},   // Cyan
                {r:162, g:155, b:254}  // Purple
            ];
            const rgb = colors[idx % colors.length];
            gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
            gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.0)`);

            return {
                label: w.name,
                data: years.map((_,i) => {
                    // Slight non-linear drop
                    const drop = (i * trend) + (Math.sin(i * 0.5) * 0.5); 
                    return parseFloat((baseLevel - drop).toFixed(2));
                }),
                borderColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true, 
                tension: 0.4, 
                pointRadius: 3,
                pointHoverRadius: 6,
                yAxisID: 'y'
            };
        });

        this.charts.prediction = new Chart(ctx, {
            type: 'line',
            data: { labels: years, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode:'index', intersect:false },
                scales: {
                    y: { 
                        title:{display:true,text:'Predicted Level (m)',color:'#94a3b8', font:{weight:'bold'}}, 
                        grid:{color:'rgba(255,255,255,0.05)'}, 
                        ticks:{color:'#e0e6ed'} 
                    },
                    x: { ticks:{color:'#e0e6ed'}, grid:{display:false} }
                },
                plugins: { 
                    legend:{ labels:{color:'#e0e6ed',font:{size:11, family:'Outfit'}} },
                    tooltip: { backgroundColor:'rgba(15,23,42,0.9)' }
                }
            }
        });
        this.updatePillBar('chartPrediction');
    }

    renderHeatMapSimulation(selectedIds) {
        const ctx = document.getElementById('chartHeatmap')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.heatmap) this.charts.heatmap.destroy();

        const wells = selectedIds && selectedIds.length > 0
            ? mockData.rigs.filter(r => selectedIds.includes(r.id) && r.lat && r.lng)
            : mockData.rigs.filter(r => r.lat && r.lng);

        if(wells.length === 0) return;

        // Use Actual Longitude/Latitude for spatial mapping
        const minLng = Math.min(...wells.map(w => w.lng));
        const maxLng = Math.max(...wells.map(w => w.lng));
        const minLat = Math.min(...wells.map(w => w.lat));
        const maxLat = Math.max(...wells.map(w => w.lat));

        const data = wells.map(w => {
            const tds = w.physical?.tds || w.chemical?.cations?.Na * 2 || 1000;
            // Radius scaled relatively
            const r = Math.max(5, Math.min(25, (tds / 3000) * 20));
            return { 
                x: w.lng, 
                y: w.lat, 
                r: r, 
                v: tds, 
                label: w.name 
            };
        });

        this.charts.heatmap = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{ 
                    label:'TDS/Salinity Spatial Distribution', 
                    data, 
                    backgroundColor: ctx2 => {
                        const v = ctx2.raw?.v || 0;
                        if (v > 2000) return 'rgba(255,71,87,0.7)'; // Red
                        if (v > 1000) return 'rgba(255,191,0,0.7)'; // Orange
                        return 'rgba(46,213,115,0.7)'; // Green
                    }, 
                    borderColor: 'rgba(255,255,255,0.4)',
                    borderWidth: 1 
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    x: { 
                        display:true, title:{display:true, text:'Longitude', color:'#94a3b8'}, grid:{color:'rgba(255,255,255,0.02)'}, ticks:{color:'#64748b'},
                        min: minLng - 0.05, max: maxLng + 0.05
                    }, 
                    y: { 
                        display:true, title:{display:true, text:'Latitude', color:'#94a3b8'}, grid:{color:'rgba(255,255,255,0.02)'}, ticks:{color:'#64748b'},
                        min: minLat - 0.05, max: maxLat + 0.05
                    } 
                },
                plugins: {
                    legend:{ labels:{color:'#e0e6ed',font:{size:11, family:'Outfit'}} },
                    tooltip:{ 
                        backgroundColor:'rgba(15,23,42,0.9)',
                        callbacks:{ 
                            label: c => `${c.raw.label}: TDS: ${c.raw.v.toFixed(0)} mg/L (Lat: ${c.raw.y.toFixed(3)}, Lng: ${c.raw.x.toFixed(3)})` 
                        }
                    }
                }
            }
        });
        this.updatePillBar('chartHeatmap');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MAIN CHARTS
    // ──────────────────────────────────────────────────────────────────────────

    renderTemporalChart(selectedIds) {
        const ctxEl = document.getElementById('chartTemporal');
        const ctx = ctxEl?.getContext('2d');
        if (!ctx) return;
        if (this.charts.temporal) this.charts.temporal.destroy();

        const months = mockData.precipitation.map(p => p.month);
        const precipData = mockData.precipitation.map(p => p.value);
        const label = typeof getText === 'function' ? getText('precipitation') : 'Precipitation (mm)';
        const lblStatic = typeof getText === 'function' ? getText('static_level') : 'Static Level (m)';

        const wellsToPlot = selectedIds && selectedIds.length > 0
            ? selectedIds
            : DEFAULT_WELL_IDS;

        // Gradient for precipitation
        const precipGradient = ctx.createLinearGradient(0, 0, 0, 300);
        precipGradient.addColorStop(0, 'rgba(0, 212, 255, 0.4)');
        precipGradient.addColorStop(1, 'rgba(0, 212, 255, 0.05)');

        const colors = ['#ff4757','#ffbf00','#2ed573','#b8e994','#00d4ff','#a29bfe'];
        const datasets = [{
            label, data: precipData, type:'bar',
            backgroundColor: precipGradient, borderColor:'#00d4ff', borderWidth: 1,
            yAxisID:'y1', order:2, borderRadius: 4, barPercentage: 0.6
        }];

        wellsToPlot.forEach((id, idx) => {
            let logData = mockData.temporalLogs?.[id];
            
            // If no log data exists, generate realistic synthetic data correlated to precipitation
            if (!logData) {
                const wellObj = mockData.rigs.find(r => r.id === id);
                const base = wellObj?.hydraulics?.staticLevel || 35;
                logData = mockData.precipitation.map((p, i) => {
                    // Level goes down (higher depth) in dry months, recovers in wet months
                    // Add slight lag (e.g. rain in Jan affects Feb/Mar)
                    const prevP = i > 0 ? mockData.precipitation[i-1].value : 40;
                    const recharge = ((p.value + prevP) / 2) * 0.05; 
                    const baselineDepletion =  0.8; // constant pumping
                    const synth = base + (i * baselineDepletion) - recharge;
                    return parseFloat(synth.toFixed(2));
                });
            }

            datasets.push({
                label: `${lblStatic} ${id}`,
                data: logData, type:'line',
                borderColor: colors[idx % colors.length],
                backgroundColor: colors[idx % colors.length] + '18',
                borderWidth:2.5, fill:false, tension:0.4, yAxisID:'y', order:1,
                pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: '#1e293b'
            });
        });

        this.charts.temporal = new Chart(ctx, {
            data: { labels: months, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction:{ mode:'index', intersect:false },
                scales: {
                    y: { 
                        type:'linear', position:'left', reverse:true, 
                        title:{display:true,text:'Static Level (m)',color:'#94a3b8', font:{weight:'bold'}}, 
                        grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#e0e6ed'} 
                    },
                    y1:{ 
                        type:'linear', position:'right', 
                        title:{display:true,text:'Precipitation (mm)',color:'#00d4ff', font:{weight:'bold'}}, 
                        grid:{drawOnChartArea:false}, ticks:{color:'#00d4ff'} 
                    },
                    x: { ticks:{color:'#e0e6ed'}, grid:{display:false} }
                },
                plugins:{ 
                    legend:{labels:{color:'#e0e6ed',font:{size:11, family:'Outfit'}}},
                    tooltip:{backgroundColor:'rgba(15,23,42,0.9)'}
                }
            }
        });
        this.updatePillBar('chartTemporal');
    }



    renderSchoellerDiagram(selectedIds) {
        const ctx = document.getElementById('chartSchoeller')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.schoeller) this.charts.schoeller.destroy();

        const ions = ['Ca\u00b2\u207A','Mg\u00b2\u207A','Na\u207A+K\u207A','Cl\u207B','SO\u2084\u00b2\u207B','HCO\u2083\u207B'];
        const wells = selectedIds && selectedIds.length > 0
            ? mockData.rigs.filter(r => selectedIds.includes(r.id) && r.chemical?.cations)
            : mockData.rigs.filter(r => r.chemical?.cations).slice(0, 6);

        const colors = ['#ff4757','#ffbf00','#2ed573','#00d4ff','#a29bfe','#fd79a8'];
        const datasets = wells.map((rig,idx) => ({
            label: rig.name,
            data: [
                rig.chemical.cations.Ca||0, rig.chemical.cations.Mg||0,
                (rig.chemical.cations.Na||0)+(rig.chemical.cations.K||0),
                rig.chemical.anions.Cl||0, rig.chemical.anions.SO4||0,
                rig.chemical.anions.HCO3||0
            ].map(v => v > 0 ? v : null), // null so that log scale doesn't break
            borderColor: colors[idx%colors.length], 
            backgroundColor: 'transparent',
            borderWidth: 2.5, 
            fill: false, 
            tension: 0, 
            pointRadius: 5,
            pointBackgroundColor: '#1e293b',
            pointBorderWidth: 2
        }));

        if(datasets.length === 0) return;

        this.charts.schoeller = new Chart(ctx, {
            type:'line', data:{ labels:ions, datasets },
            options:{
                responsive:true, maintainAspectRatio:false,
                interaction:{ mode:'index', intersect:false },
                scales:{
                    y:{ 
                        type:'logarithmic', 
                        title:{display:true,text:'Concentration (meq/L)',color:'#94a3b8', font:{weight:'bold'}}, 
                        grid:{color:'rgba(255,255,255,0.05)'}, 
                        ticks:{color:'#e0e6ed', callback: function(val) { return Number.isInteger(Math.log10(val)) ? val : ''; }} 
                    },
                    x:{ ticks:{color:'#e0e6ed', font:{size:12, weight:'bold'}}, grid:{color:'rgba(255,255,255,0.08)'} }
                },
                plugins:{ 
                    legend:{position:'right', labels:{color:'#e0e6ed',font:{size:11, family:'Outfit'}}},
                    tooltip:{backgroundColor:'rgba(15,23,42,0.9)'}
                }
            }
        });
        this.updatePillBar('chartSchoeller');
    }

    renderIrrigationChart(selectedIds) {
        const ctx = document.getElementById('chartIrrigation')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.irrigation) this.charts.irrigation.destroy();

        const calcSAR = rig => {
            if (!rig.chemical) return 0;
            const Na=rig.chemical.cations.Na||0, Ca=rig.chemical.cations.Ca||1, Mg=rig.chemical.cations.Mg||0;
            return Na / Math.sqrt((Ca+Mg)/2);
        };

        const wells = selectedIds && selectedIds.length > 0
            ? mockData.rigs.filter(r => selectedIds.includes(r.id))
            : mockData.rigs;

        const data = wells.filter(r => r.chemical && (r.physical || r.chemical)).map(r => ({
            x: r.physical?.conductivity || (r.physical?.tds * 2) || (r.chemical.cations.Na * 4) || 0, // Fallack derivations
            y: parseFloat(calcSAR(r).toFixed(2)), 
            label: r.name
        })).filter(p => p.x > 0);

        // Wilcox classification zones background
        const backgroundBands = [
            { label:'Excellent (S1-C1)', color:'rgba(46,213,115,0.1)', ySAR:[0,10], xEC:[0,250] },
            { label:'Good (S2-C2)',      color:'rgba(0,212,255,0.1)',  ySAR:[0,18], xEC:[250,750] },
            { label:'Fair (S3-C3)',      color:'rgba(255,191,0,0.1)',  ySAR:[0,26], xEC:[750,2250] },
            { label:'Poor (S4-C4)',      color:'rgba(255,71,87,0.1)',  ySAR:[0,32], xEC:[2250,5000] },
        ];

        const bgDatasets = backgroundBands.map(b => ({
            type:'scatter',
            label: b.label,
            data:[],
            backgroundColor: b.color,
            showInLegend: false
        }));

        this.charts.irrigation = new Chart(ctx, {
            type:'scatter',
            data:{
                datasets:[
                    ...bgDatasets,
                    { 
                        label:'Wells', 
                        data, 
                        backgroundColor: '#00d4ff', 
                        borderColor: '#ffffff',
                        borderWidth: 1.5,
                        pointRadius: 6,
                        pointHoverRadius: 9,
                        pointHoverBackgroundColor: '#2ed573'
                    }
                ]
            },
            options:{
                responsive:true, maintainAspectRatio:false,
                scales:{
                    x:{ 
                        title:{display:true,text:'Conductivity EC (\u00b5S/cm)',color:'#94a3b8', font:{weight:'bold'}}, 
                        min:0,max:5000, grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#e0e6ed'} 
                    },
                    y:{ 
                        title:{display:true,text:'Sodium Adsorption Ratio (SAR)',color:'#94a3b8', font:{weight:'bold'}}, 
                        min:0,max:32, grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#e0e6ed'} 
                    }
                },
                plugins:{
                    legend:{display:false},
                    tooltip:{
                        backgroundColor:'rgba(15,23,42,0.9)',
                        callbacks:{ 
                            label: c => `${c.raw.label||''}: EC=${c.raw.x.toFixed(0)}, SAR=${c.raw.y}` 
                        }
                    }
                }
            }
        });
        this.updatePillBar('chartIrrigation');
    }

    renderBinaryPlot(selectedIds) {
        this._renderGenericBinary('chartBinary','#ffbf00','Cl\u207B (mg/L)','Na\u207A (mg/L)',
            r => ({x:r.chemical.anions.Cl||0, y:r.chemical.cations.Na||0}), selectedIds);
    }

    renderBinaryPlot2(selectedIds) {
        this._renderGenericBinary('chartBinary2','#00d4ff','Cl\u207B + SO\u2084\u00b2\u207B (mg/L)','Ca\u00b2\u207A + Mg\u00b2\u207A (mg/L)',
            r => ({x:(r.chemical.anions.Cl||0)+(r.chemical.anions.SO4||0),
                   y:(r.chemical.cations.Ca||0)+(r.chemical.cations.Mg||0)}), selectedIds);
    }

    _renderGenericBinary(id, color, xLabel, yLabel, mapper, selectedIds) {
        const ctx = document.getElementById(id)?.getContext('2d');
        if (!ctx) return;
        if (this.charts[id]) this.charts[id].destroy();

        const wells = selectedIds && selectedIds.length > 0
            ? mockData.rigs.filter(r => selectedIds.includes(r.id))
            : mockData.rigs;

        const data = wells.filter(r => r.chemical?.cations && r.chemical?.anions)
            .map(r => ({...mapper(r), label:r.name}));

        if(data.length === 0) return;

        const maxValX = Math.max(...data.map(d=>d.x)) * 1.1;
        const maxValY = Math.max(...data.map(d=>d.y)) * 1.1;

        this.charts[id] = new Chart(ctx, {
            type:'scatter', 
            data:{ 
                datasets:[
                    { 
                        label:'Wells', 
                        data, 
                        backgroundColor:color, 
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        pointRadius: 6, 
                        pointHoverRadius: 9 
                    },
                    // Trend line 1:1
                    {
                        label:'1:1 Ratio',
                        data: [{x:0,y:0}, {x:Math.max(maxValX, maxValY),y:Math.max(maxValX, maxValY)}],
                        type: 'line',
                        borderColor: 'rgba(255,255,255,0.3)',
                        borderDash: [5,5],
                        pointRadius: 0,
                        borderWidth: 1.5
                    }
                ] 
            },
            options:{
                responsive:true, maintainAspectRatio:false,
                scales:{
                    x:{ title:{display:true,text:xLabel,color:'#94a3b8', font:{weight:'bold'}}, ticks:{color:'#e0e6ed'}, grid:{color:'rgba(255,255,255,0.05)'} },
                    y:{ title:{display:true,text:yLabel,color:'#94a3b8', font:{weight:'bold'}}, ticks:{color:'#e0e6ed'}, grid:{color:'rgba(255,255,255,0.05)'} }
                },
                plugins:{ 
                    tooltip:{backgroundColor:'rgba(15,23,42,0.9)', callbacks:{label:c=>`${c.raw.label||'Line'}: (${c.raw.x.toFixed(0)}, ${c.raw.y.toFixed(0)})`}}, 
                    legend:{labels:{color:'#e0e6ed',font:{size:11, family:'Outfit'}}} 
                }
            }
        });
        this.updatePillBar(id);
    }

    renderSaturationIndices(selectedIds) {
        const ctx = document.getElementById('chartSaturation')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.saturation) this.charts.saturation.destroy();

        const minerals = ['Calcite','Dolomite','Gypsum','Halite','Anhydrite','Aragonite'];
        const wells = selectedIds && selectedIds.length > 0
            ? mockData.rigs.filter(r => selectedIds.includes(r.id) && r.chemical)
            : mockData.rigs.filter(r => r.chemical).slice(0, 4);

        if(wells.length === 0) return;

        const colors = [
            {r:255, g:71, b:87},   // Red
            {r:255, g:191, b:0},   // Yellow
            {r:46, g:213, b:115},  // Green
            {r:0, g:212, b:255}    // Cyan
        ];
        
        const datasets = wells.slice(0, 4).map((w, idx) => {
            // Generate SI values based on authentic data (Ca/Mg/SO4/HCO3 concentration ratios) + Ph
            const Na = w.chemical.cations.Na || 100;
            const Ca = w.chemical.cations.Ca || 100;
            const Mg = w.chemical.cations.Mg || 50;
            const SO4= w.chemical.anions.SO4 || 100;
            const HCO3=w.chemical.anions.HCO3|| 100;
            const Cl = w.chemical.anions.Cl || 100;
            const ph = w.physical?.ph || 7.2;
            
            // Extremely simplified but authentic SI correlations
            const siVals = [
                parseFloat((Math.log10((Ca*HCO3)/1000) + (ph-7)).toFixed(2)) - 1, // Calcite
                parseFloat((Math.log10((Ca*Mg*HCO3*HCO3)/100000) + (ph-7)*2).toFixed(2)) - 2, // Dolomite
                parseFloat((Math.log10((Ca*SO4)/20000)).toFixed(2)), // Gypsum (usually undersaturated)
                parseFloat((Math.log10((Na*Cl)/1000000) - 2).toFixed(2)), // Halite (very undersaturated)
                parseFloat((Math.log10((Ca*SO4)/25000)).toFixed(2)), // Anhydrite
                parseFloat((Math.log10((Ca*HCO3)/1000) + (ph-7)).toFixed(2)) - 1.2 // Aragonite
            ];
            
            const rgb = colors[idx%colors.length];
            return {
                label: w.name,
                data: siVals,
                backgroundColor: c => {
                    const val = c.raw;
                    if(val >= 0) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
                    return 'rgba(255, 71, 87, 0.4)'; // Red for undersaturated
                },
                borderColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
                borderWidth: 1.5,
                borderRadius: 4
            };
        });

        this.charts.saturation = new Chart(ctx, {
            type:'bar', data:{ labels:minerals, datasets },
            options:{
                responsive:true, maintainAspectRatio:false,
                scales:{
                    y:{ 
                        title:{display:true,text:'Saturation Index (log IAP/Kt)',color:'#94a3b8', font:{weight:'bold'}}, 
                        grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#e0e6ed'},
                        afterDataLimits: scale => { scale.max = Math.max(scale.max || 0, 1.5); scale.min = Math.min(scale.min || 0, -2.5); }
                    },
                    x:{ ticks:{color:'#e0e6ed', font:{family:'Outfit'}} }
                },
                plugins:{ 
                    legend:{labels:{color:'#e0e6ed',font:{size:11, family:'Outfit'}}},
                    tooltip:{backgroundColor:'rgba(15,23,42,0.9)'},
                    annotation:{ 
                        annotations:{ 
                            zeroline:{ type:'line', yMin:0, yMax:0, borderColor:'rgba(255,255,255,0.5)', borderWidth:2, borderDash:[4,4] } 
                        } 
                    }
                }
            }
        });
        this.updatePillBar('chartSaturation');
    }
}

// ── Global helpers ──────────────────────────────────────────────────────────

window.analyticsEngine = new AnalyticsEngine();

function refreshAnalytics() {
    if (window.analyticsEngine) window.analyticsEngine.refresh();
}

/** Called by the Global Filter "Analyze" button */
function applyGlobalWellFilter() {
    const pool = window.analyticsEngine._getGlobalPool();
    const ids  = pool.map(w => w.id);
    // Push global pool into every chart's selection
    CHART_IDS.forEach(cid => { chartWellState[cid] = [...ids]; });
    // Rebuild all panels and refresh
    CHART_IDS.forEach(cid => window.analyticsEngine.buildWellPanel(cid));
    window.analyticsEngine.refresh();
    // Update KPI cards + pills
    updateAnalyticsKPIs();
    updateAnalyticsWellPills();
    // Run WQI for all
    if (typeof runWQIAll === 'function') runWQIAll();
}

/** Toggle per-chart well panel */
function toggleChartWellPanel(chartId) {
    const panel = document.getElementById(`panel-${chartId}`);
    if (!panel) return;
    if (panel.style.display === 'none') {
        window.analyticsEngine.buildWellPanel(chartId);
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
    }
}

function updateAnalyticsDairas(wilaya) {
    const sel = document.getElementById('analyticsDaira');
    if (!sel) return;
    sel.innerHTML = '<option value="all">All Dairas</option>';
    if (wilaya !== 'all' && geographicData?.districts?.[wilaya]) {
        geographicData.districts[wilaya].forEach(d => {
            const o = document.createElement('option'); o.value = d; o.textContent = d;
            sel.appendChild(o);
        });
    }
    updateAnalyticsWells();
}

function updateAnalyticsWells() {
    // Just refresh the pool display; actual per-chart selection unchanged
    CHART_IDS.forEach(cid => {
        const panel = document.getElementById(`panel-${cid}`);
        if (panel && panel.style.display !== 'none') {
            window.analyticsEngine.buildWellPanel(cid);
        }
    });
}

function resetAnalyticsFilters() {
    const w = document.getElementById('analyticsWilaya');
    if (w) w.value = 'all';
    updateAnalyticsDairas('all');
    CHART_IDS.forEach(cid => { chartWellState[cid] = [...DEFAULT_WELL_IDS]; });
    window.analyticsEngine.refresh();
}

function exportChartPNG(chartId) {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${chartId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ── Expose all button functions to window ───────────────────────────────────
window.applyGlobalWellFilter  = applyGlobalWellFilter;
window.resetAnalyticsFilters  = resetAnalyticsFilters;
window.updateAnalyticsDairas  = updateAnalyticsDairas;
window.updateAnalyticsWells   = updateAnalyticsWells;
window.toggleChartWellPanel   = toggleChartWellPanel;
window.exportChartPNG         = exportChartPNG;
window.refreshAnalytics       = refreshAnalytics;

// Auto-init analytics when its view is shown
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item[data-view="analytics"]').forEach(item => {
        item.addEventListener('click', () => {
            setTimeout(() => {
                if (window.analyticsEngine && !window.analyticsEngine.initialized) {
                    window.analyticsEngine.init();
                }
                updateAnalyticsKPIs();
                updateAnalyticsWellPills();
            }, 200);
        });
    });

    // Initial KPI fill
    setTimeout(() => { updateAnalyticsKPIs(); updateAnalyticsWellPills(); }, 600);
});

/** Update the 4 KPI cards in the Analytics header */
function updateAnalyticsKPIs() {
    const pool = window.analyticsEngine ? window.analyticsEngine._getGlobalPool() : mockData.rigs;
    const active = pool.filter(w => w.status === 'operational' || w.status === 'Active').length;

    // Calculate WQI for wells that have chemical data
    let wqiValues = [];
    let criticalCount = 0;
    pool.forEach(w => {
        if (!w.chemical || !w.chemical.cations) return;
        if (typeof calcWQI === 'function') {
            const { wqi } = calcWQI(w);
            wqiValues.push(wqi);
            if (wqi >= 100) criticalCount++;
        }
    });

    const avgWqi = wqiValues.length > 0
        ? parseFloat((wqiValues.reduce((a,b) => a+b, 0) / wqiValues.length).toFixed(1))
        : null;

    // Classify avg WQI
    let wqiLabel = '—', wqiColor = 'var(--text-muted)';
    let riskTrend = 'Stable', riskColor = 'var(--accent-success)';
    if (avgWqi !== null) {
        if (avgWqi < 25)       { wqiLabel = 'Excellent'; wqiColor = '#00ff9d'; riskTrend = 'Stable'; riskColor = '#00ff9d'; }
        else if (avgWqi < 50)  { wqiLabel = 'Good';      wqiColor = '#00d4ff'; riskTrend = 'Stable'; riskColor = '#00d4ff'; }
        else if (avgWqi < 75)  { wqiLabel = 'Poor';      wqiColor = '#ffbf00'; riskTrend = 'Rising ↗'; riskColor = '#ffbf00'; }
        else if (avgWqi < 100) { wqiLabel = 'Very Poor'; wqiColor = '#ff8c00'; riskTrend = 'High Risk ↑'; riskColor = '#ff8c00'; }
        else                   { wqiLabel = 'Unsuitable'; wqiColor = '#ff4757'; riskTrend = 'Critical ⚠'; riskColor = '#ff4757'; }
    }

    const el = id => document.getElementById(id);
    if (el('kpiAvgWqi'))        { el('kpiAvgWqi').textContent = avgWqi !== null ? avgWqi : '—'; el('kpiAvgWqi').style.color = wqiColor; }
    if (el('kpiWqiLabel'))      { el('kpiWqiLabel').innerHTML = `<span style="color:${wqiColor};font-weight:600;">${wqiLabel}</span>`; }
    if (el('kpiRiskTrend'))     { el('kpiRiskTrend').textContent = riskTrend; el('kpiRiskTrend').style.color = riskColor; }
    if (el('kpiActiveWells'))   { el('kpiActiveWells').textContent = active; }
    if (el('kpiCriticalAlerts')){ el('kpiCriticalAlerts').textContent = criticalCount; el('kpiCriticalAlerts').style.color = criticalCount > 0 ? '#ff4757' : '#00ff9d'; }
}

/** Update the wells pills strip in the filter bar */
function updateAnalyticsWellPills() {
    const pills = document.getElementById('analyticsWellPills');
    if (!pills) return;
    const pool = window.analyticsEngine ? window.analyticsEngine._getGlobalPool() : mockData.rigs;
    pills.innerHTML = '';
    const show = pool.slice(0, 4);
    show.forEach(w => {
        const chip = document.createElement('span');
        chip.className = 'cws-chip';
        chip.textContent = w.name || w.id;
        pills.appendChild(chip);
    });
    if (pool.length > 4) {
        const more = document.createElement('span');
        more.className = 'cws-chip more';
        more.textContent = `+${pool.length - 4}`;
        pills.appendChild(more);
    }
}

/** Toggle the wells dropdown panel */
function toggleAnalyticsWellDropdown() {
    const sel = document.getElementById('analyticsWellSelector');
    if (!sel) return;
    if (sel.style.display === 'none' || !sel.style.display) {
        // Build a simple list of all wells
        const pool = window.analyticsEngine ? window.analyticsEngine._getGlobalPool() : mockData.rigs;
        sel.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:0.4rem;padding:0.5rem 0;">${
            pool.map(w => `<span class="cws-chip" style="cursor:pointer;" onclick="highlightWellOnAnalytics('${w.id}')">${w.name||w.id}</span>`).join('')
        }</div>`;
        sel.style.display = 'block';
    } else {
        sel.style.display = 'none';
    }
}

/** Export a CSV report of WQI results for the current filter pool */
function exportAnalyticsReport() {
    const pool = window.analyticsEngine ? window.analyticsEngine._getGlobalPool() : mockData.rigs;
    const rows = [['Well ID','Well Name','State','District','WQI Score','Classification','TDS (mg/L)','Na (mg/L)','Cl (mg/L)','Risk']];

    pool.forEach(w => {
        if (!w.chemical || !w.chemical.cations) return;
        if (typeof calcWQI !== 'function') return;
        const { wqi } = calcWQI(w);
        const cls = typeof classifyWQI === 'function' ? classifyWQI(wqi) : { label: '—', risk: '—' };
        const trend = typeof predictTrend === 'function' ? predictTrend(w, wqi) : { risks: [] };
        const risk = trend.risks.map(r => r.type).join(' | ') || 'Stable';
        rows.push([
            w.id, w.name, w.state||'', w.district||'',
            wqi, cls.label,
            (w.physical?.tds||0), (w.chemical.cations?.Na||0), (w.chemical.anions?.Cl||0),
            risk
        ]);
    });

    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GeoWell_WQI_Report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

window.updateAnalyticsKPIs = updateAnalyticsKPIs;
window.updateAnalyticsWellPills = updateAnalyticsWellPills;
window.toggleAnalyticsWellDropdown = toggleAnalyticsWellDropdown;
window.exportAnalyticsReport = exportAnalyticsReport;
