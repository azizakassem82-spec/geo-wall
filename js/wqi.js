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
    // Inject into Analytics view — create or update WQI summary card
    let panel = document.getElementById('wqiSummaryCard');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'wqiSummaryCard';
        panel.className = 'card';
        panel.style.cssText = 'margin-bottom:1.5rem;border:1px solid rgba(0,212,255,0.3);';
        const grid = document.querySelector('#view-analytics .dashboard-grid');
        if (grid) grid.insertBefore(panel, grid.firstChild);
    }

    const rows = results.slice(0, 10).map(r => `
        <tr>
            <td style="padding:8px 12px;font-weight:600;">${r.id}</td>
            <td style="padding:8px 12px;">${r.name}</td>
            <td style="padding:8px 12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:${Math.min(r.wqi,200)/2}px;max-width:100px;height:8px;border-radius:4px;background:${r.color};"></div>
                    <strong style="font-family:'Orbitron',sans-serif;color:${r.color};">${r.wqi}</strong>
                </div>
            </td>
            <td style="padding:8px 12px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:${r.color}22;color:${r.color};border:1px solid ${r.color}44;">${r.label}</span></td>
            <td style="padding:8px 12px;"><button onclick="runWQIAnalysis('${r.id}')" style="background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);color:#00d4ff;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.75rem;">View Details</button></td>
        </tr>`).join('');

    panel.innerHTML = `
        <div class="card-header">
            <h3><i class="fa-solid fa-flask-vial"></i> WQI Report — WHO Standards (Top 10 Wells)</h3>
            <button class="action-btn" onclick="runWQIAll()"><i class="fa-solid fa-rotate"></i> Refresh</button>
        </div>
        <div style="overflow-x:auto;padding:1rem;">
            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <th style="padding:8px 12px;text-align:left;color:#64748b;">ID</th>
                    <th style="padding:8px 12px;text-align:left;color:#64748b;">Well Name</th>
                    <th style="padding:8px 12px;text-align:left;color:#64748b;">WQI Score</th>
                    <th style="padding:8px 12px;text-align:left;color:#64748b;">Classification</th>
                    <th style="padding:8px 12px;text-align:left;color:#64748b;">Action</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

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
