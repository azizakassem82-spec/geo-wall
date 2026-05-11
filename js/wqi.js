// ============================================================
// GeoWell WQI Engine — WHO International Standards
// Weighted Arithmetic Water Quality Index Method
// ============================================================

const WHO_STANDARDS = {
    Ca:   { limit: 75,   weight: 2, unit: 'mg/L' },
    Mg:   { limit: 50,   weight: 2, unit: 'mg/L' },
    Na:   { limit: 200,  weight: 4, unit: 'mg/L' },
    K:    { limit: 12,   weight: 1, unit: 'mg/L' },
    Cl:   { limit: 250,  weight: 4, unit: 'mg/L' },
    SO4:  { limit: 250,  weight: 4, unit: 'mg/L' },
    HCO3: { limit: 300,  weight: 1, unit: 'mg/L' },
    NO3:  { limit: 50,   weight: 5, unit: 'mg/L' },
    TDS:  { limit: 500,  weight: 5, unit: 'mg/L' },
    pH:   { limit: 8.5,  weight: 3, unit: '' }
};

const W_TOTAL = Object.values(WHO_STANDARDS).reduce((s, p) => s + p.weight, 0);

function calcWQI(well) {
    const c = well.chemical || {};
    const ph = well.physical || {};
    const params = {
        Ca:   (c.cations && c.cations.Ca)  || 0,
        Mg:   (c.cations && c.cations.Mg)  || 0,
        Na:   (c.cations && c.cations.Na)  || 0,
        K:    (c.cations && c.cations.K)   || 0,
        Cl:   (c.anions  && c.anions.Cl)   || 0,
        SO4:  (c.anions  && c.anions.SO4)  || 0,
        HCO3: (c.anions  && c.anions.HCO3) || 0,
        NO3:  (c.anions  && c.anions.NO3)  || 0,
        TDS:  ph.tds  || 0,
        pH:   ph.ph   || 7.0
    };

    let wqiSum = 0;
    const details = {};

    for (const [key, std] of Object.entries(WHO_STANDARDS)) {
        const ci = params[key];
        const si = std.limit;
        const wi = std.weight;
        // pH treated as deviation from ideal (7.0)
        const qi = key === 'pH'
            ? Math.abs(ci - 7.0) / Math.abs(si - 7.0) * 100
            : (ci / si) * 100;
        const wqi_i = (wi / W_TOTAL) * qi;
        wqiSum += wqi_i;
        details[key] = { ci: ci.toFixed(2), si, qi: qi.toFixed(1), wi, wqi_i: wqi_i.toFixed(2) };
    }

    return { wqi: parseFloat(wqiSum.toFixed(2)), details, params };
}

function classifyWQI(wqi) {
    if (wqi < 25)  return { label: 'Excellent', color: '#00ff9d', icon: 'fa-star', risk: 'low' };
    if (wqi < 50)  return { label: 'Good',      color: '#00d4ff', icon: 'fa-thumbs-up', risk: 'low' };
    if (wqi < 75)  return { label: 'Poor',      color: '#ffbf00', icon: 'fa-triangle-exclamation', risk: 'medium' };
    if (wqi < 100) return { label: 'Very Poor', color: '#ff8c00', icon: 'fa-radiation', risk: 'high' };
    return { label: 'Unsuitable', color: '#ff4757', icon: 'fa-skull-crossbones', risk: 'critical' };
}

function predictTrend(well, wqi) {
    const tds = (well.physical && well.physical.tds) || 0;
    const cl  = (well.chemical && well.chemical.anions && well.chemical.anions.Cl) || 0;
    const na  = (well.chemical && well.chemical.cations && well.chemical.cations.Na) || 0;

    let risks = [];
    let predicted12m = wqi;

    if (tds > 1000) {
        predicted12m *= 1.12;
        risks.push({ type: 'Salinization', severity: 'critical', msg: `TDS=${tds} mg/L exceeds 1000. Aquifer salinization risk within 6 months.` });
    } else if (tds > 500) {
        predicted12m *= 1.06;
        risks.push({ type: 'Salinization', severity: 'warning', msg: `TDS=${tds} mg/L is elevated. Monitor monthly.` });
    }

    if (cl > 400) {
        predicted12m *= 1.08;
        risks.push({ type: 'Chloride Intrusion', severity: 'critical', msg: `Cl⁻=${cl} mg/L — possible saltwater intrusion vector.` });
    }

    if (na > 300) {
        risks.push({ type: 'Sodium Hazard', severity: 'warning', msg: `Na⁺=${na} mg/L — SAR ratio elevated, irrigation damage risk.` });
    }

    if ((well.physical && well.physical.tds) === 0) {
        risks.push({ type: 'Data Gap', severity: 'info', msg: 'No physical measurements recorded. WQI based on ion data only.' });
    }

    if (risks.length === 0) {
        risks.push({ type: 'Stable', severity: 'good', msg: 'No significant degradation risk predicted for the next 12 months.' });
    }

    return { risks, predicted12m: parseFloat(predicted12m.toFixed(2)) };
}

window.runWQIAnalysis = function(wellId) {
    const well = mockData.rigs.find(w => w.id === wellId);
    if (!well || !well.chemical) {
        showWQIError('No hydrochemical data available for this well.');
        return;
    }

    const { wqi, details, params } = calcWQI(well);
    const cls = classifyWQI(wqi);
    const trend = predictTrend(well, wqi);

    renderWQIPanel(well, wqi, cls, details, params, trend);
    updateMapMarkerWQI(wellId, wqi, cls);

    return { wqi, cls, details, trend };
};

window.runWQIAll = function() {
    const results = [];
    mockData.rigs.forEach(well => {
        if (!well.chemical || !well.chemical.cations) return;
        const { wqi } = calcWQI(well);
        const cls = classifyWQI(wqi);
        results.push({ id: well.id, name: well.name, wqi, label: cls.label, color: cls.color });
        updateMapMarkerWQI(well.id, wqi, cls);
    });

    results.sort((a, b) => b.wqi - a.wqi);
    renderWQISummaryPanel(results);
    return results;
};

function renderWQIPanel(well, wqi, cls, details, params, trend) {
    const container = document.getElementById('aiAnalysisResult');
    if (!container) return;

    const riskRows = trend.risks.map(r => {
        const sev = { critical: '#ff4757', warning: '#ffbf00', good: '#00ff9d', info: '#00d4ff' };
        const ico = { critical: 'fa-bolt', warning: 'fa-triangle-exclamation', good: 'fa-shield-check', info: 'fa-circle-info' };
        return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 12px;border-radius:6px;background:rgba(${r.severity==='critical'?'255,71,87':r.severity==='warning'?'255,191,0':'0,255,157'},0.07);border-left:3px solid ${sev[r.severity]};margin-bottom:6px;">
            <i class="fa-solid ${ico[r.severity]}" style="color:${sev[r.severity]};margin-top:2px;"></i>
            <div><strong style="color:${sev[r.severity]};">${r.type}</strong><br><span style="font-size:0.8rem;color:#94a3b8;">${r.msg}</span></div>
        </div>`;
    }).join('');

    const paramRows = Object.entries(details).map(([k, d]) => {
        const pct = Math.min(parseFloat(d.qi), 200);
        const barColor = pct > 100 ? '#ff4757' : pct > 75 ? '#ffbf00' : '#00ff9d';
        return `<tr>
            <td style="padding:6px 8px;font-weight:600;color:#e0e6ed;">${k}</td>
            <td style="padding:6px 8px;color:#94a3b8;">${d.ci} / ${d.si}</td>
            <td style="padding:6px 8px;">
                <div style="background:rgba(255,255,255,0.05);border-radius:4px;height:8px;width:100%;min-width:80px;">
                    <div style="width:${Math.min(pct,100)}%;height:100%;border-radius:4px;background:${barColor};"></div>
                </div>
            </td>
            <td style="padding:6px 8px;text-align:right;font-family:monospace;color:${barColor};">${d.qi}%</td>
        </tr>`;
    }).join('');

    container.style.display = 'block';
    container.innerHTML = `
        <div style="border:1px solid ${cls.color};border-radius:12px;overflow:hidden;margin-bottom:1rem;">
            <div style="background:linear-gradient(135deg,rgba(${cls.color==='#00ff9d'?'0,255,157':'0,212,255'},0.15),transparent);padding:1.5rem;display:flex;align-items:center;gap:1.5rem;">
                <div style="width:90px;height:90px;border-radius:50%;border:4px solid ${cls.color};display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 25px ${cls.color}55;">
                    <div style="font-family:'Orbitron',sans-serif;font-size:1.6rem;font-weight:800;color:${cls.color};">${wqi}</div>
                    <div style="font-size:0.6rem;color:#94a3b8;letter-spacing:1px;">WQI</div>
                </div>
                <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <i class="fa-solid ${cls.icon}" style="color:${cls.color};font-size:1.2rem;"></i>
                        <span style="font-size:1.3rem;font-weight:700;color:${cls.color};">${cls.label}</span>
                    </div>
                    <div style="color:#94a3b8;font-size:0.9rem;">Well: <strong style="color:#e0e6ed;">${well.name}</strong></div>
                    <div style="color:#94a3b8;font-size:0.85rem;margin-top:4px;">12-Month Predicted WQI: 
                        <strong style="color:${trend.predicted12m > wqi ? '#ff4757' : '#00ff9d'};">${trend.predicted12m}</strong>
                        ${trend.predicted12m > wqi ? ' ↗ Declining' : ' → Stable'}
                    </div>
                </div>
            </div>
        </div>

        <h4 style="margin-bottom:8px;color:#94a3b8;text-transform:uppercase;font-size:0.75rem;letter-spacing:1px;">⚗ Parameter Analysis (WHO Standards)</h4>
        <div style="overflow-x:auto;margin-bottom:1.5rem;">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <th style="padding:6px 8px;text-align:left;color:#64748b;">Param</th>
                    <th style="padding:6px 8px;text-align:left;color:#64748b;">Measured / Limit</th>
                    <th style="padding:6px 8px;text-align:left;color:#64748b;">Quality</th>
                    <th style="padding:6px 8px;text-align:right;color:#64748b;">qi %</th>
                </tr></thead>
                <tbody>${paramRows}</tbody>
            </table>
        </div>

        <h4 style="margin-bottom:8px;color:#94a3b8;text-transform:uppercase;font-size:0.75rem;letter-spacing:1px;">🔮 12-Month Predictive Risk Assessment</h4>
        ${riskRows}

        <div style="margin-top:1rem;padding:1rem;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.2);border-radius:8px;">
            <strong style="color:#00d4ff;"><i class="fa-solid fa-lightbulb"></i> Recommendation:</strong>
            <p style="color:#cbd5e1;font-size:0.85rem;margin-top:4px;line-height:1.5;">
                ${wqi < 50 ? 'Water quality is acceptable. Continue routine monitoring quarterly.' :
                  wqi < 75 ? 'Elevated ion concentrations detected. Increase monitoring frequency to monthly. Consider treatment if used for drinking.' :
                  'Water quality is critically poor. <strong>DO NOT USE for drinking.</strong> Immediate treatment or alternative source required. Alert municipal authorities.'}
            </p>
        </div>
    `;

    // Update the status badge in the card header
    const badge = document.getElementById('btnRunAI');
    if (badge) badge.innerHTML = `<i class="fa-solid ${cls.icon}" style="color:${cls.color};"></i> WQI: ${wqi} — ${cls.label}`;
}

function renderWQISummaryPanel(results) {
    let panel = document.getElementById('wqiSummaryCard');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'wqiSummaryCard';
        panel.className = 'card';
        panel.style.cssText = 'margin-bottom:1.5rem; border:1px solid rgba(0,212,255,0.15); overflow:hidden; background:var(--bg-card);';
        const grid = document.querySelector('#view-analytics .dashboard-grid');
        if (grid) {
            const kpiRow = document.getElementById('analyticsKpiRow');
            if (kpiRow && kpiRow.nextElementSibling) {
                grid.insertBefore(panel, kpiRow.nextElementSibling);
            } else {
                grid.insertBefore(panel, grid.firstChild);
            }
        }
    }

    // Build Wells Pills for subheader
    const show = results.slice(0, 3);
    let pillsHTML = show.map(r => `<span style="display:inline-block; padding:3px 10px; border-radius:12px; font-size:0.75rem; font-weight:600; background:rgba(0,212,255,0.15); color:#00d4ff; border:1px solid rgba(0,212,255,0.3); margin-right:4px;">${r.name}</span>`).join('');
    if (results.length > 3) {
        pillsHTML += `<span style="display:inline-block; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600; background:rgba(255,255,255,0.05); color:#94a3b8; border:1px solid rgba(255,255,255,0.1);">+${results.length - 3}</span>`;
    }

    const rows = results.map(r => {
        const well = mockData.rigs.find(w => w.id === r.id);
        const trend = well ? predictTrend(well, r.wqi) : { predicted12m: r.wqi };
        const trendLabel = trend.predicted12m > r.wqi ? 'Moderate' : 'Stable';
        const trendColor = trend.predicted12m > r.wqi ? '#ffbf00' : '#00ff9d';
        
        let insight = "Water quality parameters show stability for the upcoming 12 months.";
        if (well && well.physical?.tds > 1000) insight = "Increasing TDS trends detected. Monitor salinity intrusion monthly.";
        else if (r.wqi > 100) insight = "Critical ion concentrations detected. Immediate treatment required.";
        else if (trend.predicted12m > r.wqi) insight = "Slight degradation trend. Monitor seasonal fluctuations.";

        return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
            <td style="padding:1.2rem 1.5rem; vertical-align:middle;">
                <div style="font-weight:700; color:#fff; font-size:0.95rem; margin-bottom:2px;">${r.name}</div>
                <div style="font-size:0.75rem; color:#64748b;">${r.id}</div>
            </td>
            <td style="padding:1.2rem 1.5rem; vertical-align:middle;">
                <div style="font-weight:700; font-size:1.1rem; color:#fff;">${r.wqi}</div>
            </td>
            <td style="padding:1.2rem 1.5rem; vertical-align:middle;">
                <span style="display:inline-block; padding:4px 12px; border-radius:4px; font-size:0.75rem; font-weight:600; background:transparent; color:${r.color}; border:1px solid ${r.color}; text-transform:none;">${r.label}</span>
            </td>
            <td style="padding:1.2rem 1.5rem; vertical-align:middle;">
                <div style="display:flex; align-items:center; gap:8px; color:#fff; font-size:0.85rem; font-weight:500;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${trendColor}; box-shadow:0 0 5px ${trendColor};"></span>
                    ${trendLabel}
                </div>
            </td>
            <td style="padding:1.2rem 1.5rem; vertical-align:middle; max-width:400px;">
                <div style="font-size:0.85rem; color:#94a3b8; line-height:1.5;">${insight}</div>
            </td>
        </tr>`;
    }).join('');

    panel.innerHTML = `
        <div class="card-header" style="padding:1.2rem 1.5rem; border-bottom:none;">
            <div style="display:flex; align-items:center; gap:0.8rem;">
                <i class="fa-solid fa-file-invoice" style="color:#00d4ff; font-size:1.1rem;"></i>
                <h3 style="margin:0; font-size:1.05rem; font-family:'Outfit',sans-serif; font-weight:700;">WQI Report — WHO Standards</h3>
            </div>
        </div>
        
        <!-- Sub-header with Pills and Buttons -->
        <div style="padding:0 1.5rem 1rem 1.5rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; align-items:center; gap:0.6rem;">
                <span style="font-size:0.8rem; color:#64748b; font-weight:600;">Wells:</span>
                <div style="display:flex; align-items:center;">
                    ${pillsHTML}
                </div>
            </div>
            <div style="display:flex; gap:0.6rem;">
                <button onclick="openWQIMethodology()" style="background:rgba(0,212,255,0.08); border:1px solid rgba(0,212,255,0.4); color:#00d4ff; padding:6px 14px; border-radius:20px; cursor:pointer; font-size:0.75rem; font-weight:600; display:flex; align-items:center; gap:6px; transition:all 0.2s;" onmouseover="this.style.background='rgba(0,212,255,0.15)'" onmouseout="this.style.background='rgba(0,212,255,0.08)'">
                    <i class="fa-solid fa-circle-info"></i> Methodology
                </button>
                <button onclick="runWQIAll()" style="background:transparent; border:1px solid rgba(0,255,157,0.4); color:#00ff9d; padding:6px 14px; border-radius:20px; cursor:pointer; font-size:0.75rem; font-weight:600; display:flex; align-items:center; gap:6px; transition:all 0.2s;" onmouseover="this.style.background='rgba(0,255,157,0.1)'" onmouseout="this.style.background='transparent'">
                    <i class="fa-solid fa-rotate"></i> Refresh
                </button>
            </div>
        </div>

        <div class="table-container" style="padding:0;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.01); border-bottom:1px solid rgba(255,255,255,0.05);">
                        <th style="padding:1rem 1.5rem; font-size:0.7rem; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Well</th>
                        <th style="padding:1rem 1.5rem; font-size:0.7rem; color:#64748b; text-transform:uppercase; letter-spacing:1px;">WQI Score</th>
                        <th style="padding:1rem 1.5rem; font-size:0.7rem; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Status</th>
                        <th style="padding:1rem 1.5rem; font-size:0.7rem; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Trend (12M)</th>
                        <th style="padding:1rem 1.5rem; font-size:0.7rem; color:#64748b; text-transform:uppercase; letter-spacing:1px;">AI Insight</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>`;
}

/** Opens the Methodology Modal seen in Image 1 */
window.openWQIMethodology = function() {
    if (!document.getElementById('wqiMethodologyModal')) {
        const modalHTML = `
        <div id="wqiMethodologyModal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); align-items:center; justify-content:center;" onclick="if(event.target===this)closeWQIMethodology()">
            <div style="background:#0d111a; border:1px solid rgba(0,212,255,0.3); border-radius:16px; width:650px; max-width:95vw; max-height:90vh; overflow-y:auto; box-shadow:0 25px 50px rgba(0,0,0,0.5); animation:modalFadeIn 0.3s ease;">
                <div style="padding:1.5rem; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; background:#0d111a; z-index:10;">
                    <div style="display:flex; align-items:center; gap:0.8rem;">
                        <i class="fa-solid fa-book-open" style="color:#00d4ff;"></i>
                        <h2 style="margin:0; font-size:1.1rem; font-family:'Orbitron',sans-serif; color:#fff;">WQI Methodology & AI Logic</h2>
                    </div>
                    <button onclick="closeWQIMethodology()" style="background:rgba(255,255,255,0.05); border:none; color:#94a3b8; width:32px; height:32px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s;" onmouseover="this.style.background='rgba(255,71,87,0.2)';this.style.color='#ff4757';" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#94a3b8';">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                
                <div style="padding:2rem; color:#cbd5e1; font-size:0.9rem; line-height:1.6;">
                    <h4 style="color:#00d4ff; margin-bottom:0.8rem; display:flex; align-items:center; gap:8px;">1. Mathematical Formula</h4>
                    <p style="margin-bottom:1.5rem;">The Water Quality Index (WQI) is computed using the weighted arithmetic index method:</p>
                    <div style="background:rgba(0,0,0,0.3); padding:1rem; border-radius:8px; text-align:center; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.05);">
                        <code style="font-family:'Orbitron',sans-serif; font-size:1.1rem; color:#fff;">WQI = Σ (wi * qi) / Σ wi</code>
                    </div>
                    <ul style="list-style:none; padding:0; margin-bottom:2rem; font-size:0.85rem; color:#94a3b8;">
                        <li style="margin-bottom:0.4rem;"><strong style="color:#00d4ff;">wi:</strong> Unit weight of the i-th parameter.</li>
                        <li><strong style="color:#00d4ff;">qi:</strong> Quality rating of the i-th parameter.</li>
                    </ul>

                    <h4 style="color:#00d4ff; margin-bottom:1rem; display:flex; align-items:center; gap:8px;">2. Parameter Weights (WHO Standards)</h4>
                    <table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-bottom:2rem; border:1px solid rgba(255,255,255,0.05);">
                        <thead>
                            <tr style="background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.1);">
                                <th style="padding:0.8rem; text-align:left; color:#64748b; text-transform:uppercase;">Parameter</th>
                                <th style="padding:0.8rem; text-align:left; color:#64748b; text-transform:uppercase;">WHO Limit</th>
                                <th style="padding:0.8rem; text-align:left; color:#64748b; text-transform:uppercase;">Weight (WI)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(WHO_STANDARDS).map(([k,v]) => `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                    <td style="padding:0.8rem; font-weight:700; color:#fff;">${k}</td>
                                    <td style="padding:0.8rem; color:#94a3b8;">${v.limit} ${v.unit}</td>
                                    <td style="padding:0.8rem; color:#00d4ff; font-weight:700;">${v.weight}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <h4 style="color:#00d4ff; margin-bottom:1rem; display:flex; align-items:center; gap:8px;">3. Classification Scales</h4>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:0.5rem;">
                        <div style="background:rgba(0,255,157,0.1); border:1px solid rgba(0,255,157,0.3); padding:0.8rem; border-radius:8px; text-align:center;">
                            <div style="color:#00ff9d; font-weight:800;">0 - 25</div>
                            <div style="font-size:0.7rem; text-transform:uppercase; color:#00ff9d;">Excellent</div>
                        </div>
                        <div style="background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.3); padding:0.8rem; border-radius:8px; text-align:center;">
                            <div style="color:#00d4ff; font-weight:800;">26 - 50</div>
                            <div style="font-size:0.7rem; text-transform:uppercase; color:#00d4ff;">Good</div>
                        </div>
                        <div style="background:rgba(255,191,0,0.1); border:1px solid rgba(255,191,0,0.3); padding:0.8rem; border-radius:8px; text-align:center;">
                            <div style="color:#ffbf00; font-weight:800;">51 - 75</div>
                            <div style="font-size:0.7rem; text-transform:uppercase; color:#ffbf00;">Poor</div>
                        </div>
                        <div style="background:rgba(255,71,87,0.1); border:1px solid rgba(255,71,87,0.3); padding:0.8rem; border-radius:8px; text-align:center;">
                            <div style="color:#ff4757; font-weight:800;">> 100</div>
                            <div style="font-size:0.7rem; text-transform:uppercase; color:#ff4757;">Unsuitable</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <style>
            @keyframes modalFadeIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        </style>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    document.getElementById('wqiMethodologyModal').style.display = 'flex';
};

window.closeWQIMethodology = function() {
    const modal = document.getElementById('wqiMethodologyModal');
    if (modal) modal.style.display = 'none';
};

function updateMapMarkerWQI(wellId, wqi, cls) {
    if (!window.mainMap || !window.mainMap.markers) return;
    const marker = window.mainMap.markers[wellId];
    if (!marker) return;
    const el = marker._icon;
    if (el) el.style.filter = `drop-shadow(0 0 8px ${cls.color})`;
}

function showWQIError(msg) {
    const c = document.getElementById('aiAnalysisResult');
    if (c) { c.style.display='block'; c.innerHTML=`<div style="padding:1rem;color:#ff4757;">${msg}</div>`; }
}

// Auto-run on Analytics view open
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', () => {
            if (item.getAttribute('data-view') === 'analytics') {
                setTimeout(() => { if (typeof runWQIAll === 'function') runWQIAll(); }, 500);
            }
        });
    });
});
