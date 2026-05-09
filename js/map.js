class wellMap {
    constructor(elementId) {
        this.elementId = elementId;
        this.map = null;
        this.baseLayer = null;
        this.markerLayer = null;
        this.markers = {};       // index: wellId -> marker
        this._initialFitDone = false;
        this.init();
    }

    init() {
        // Initialize Map centered on Algeria/desert region for demo
        this.map = L.map(this.elementId, { 
            maxZoom: 22,
            editable: true 
        }).setView([31.5, 5.5], 8);

        // Start with OpenStreetMap (Street View)
        this.baseLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google Maps',
            maxZoom: 22,
            maxNativeZoom: 20
        }).addTo(this.map);

        // Initialize marker layer group
        this.markerLayer = L.layerGroup().addTo(this.map);

        // Check for mock data (now attached to window)
        if (window.mockData && window.mockData.rigs) {
            console.log(`[Leaflet] Rendering ${window.mockData.rigs.length} mock wells.`);
            
            // Store initial coordinates for reset functionality
            window.mockData.rigs.forEach(r => {
                if (r.initialLat === undefined) r.initialLat = r.lat;
                if (r.initialLng === undefined) r.initialLng = r.lng;
            });

            this.renderMarkers();
            
            // Initial fit to data if no QGIS data yet
            const group = L.featureGroup();
            window.mockData.rigs.forEach(r => {
                group.addLayer(L.marker([r.lat, r.lng]));
            });
            this.map.fitBounds(group.getBounds());
            
        } else {
            console.error("[Leaflet] window.mockData is missing!");
        }
    }

    _buildIcon(status, isNew = false) {
        const colors = { 'operational': '#00d4ff', 'Active': '#00d4ff', 'maintenance': '#ffbf00', 'offline': '#ff4444' };
        const color = colors[status] || '#00d4ff';
        const pulse = isNew ? `animation: markerBounce 0.6s ease-out;` : '';
        return L.divIcon({
            className: 'custom-div-icon',
            html: `<div style='background-color:${color};width:14px;height:14px;border-radius:50%;box-shadow:0 0 12px ${color};border:2px solid #fff;${pulse}'></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
    }

    _buildPopup(rig) {
        const h = rig.hydraulics || {};
        const statusColor = (rig.status === 'operational' || rig.status === 'Active' || !rig.status) ? '#2ed573' : '#ff4757';
        const statusLabel = typeof getText === 'function' ? getText('status_' + (rig.status || 'operational')).toUpperCase() : (rig.status || 'OPERATIONAL').toUpperCase();
        return `
            <div style="color:#1a1a1a;font-family:'Outfit',sans-serif;min-width:250px;padding:5px;">
                <h4 style="margin:0 0 10px 0;color:#0081a7;font-size:16px;border-bottom:2px solid #00d4ff;padding-bottom:5px;">
                    ${rig.name} <small style="color:#666;font-weight:normal;">(${rig.id})</small>
                </h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:10px;">
                    <div><strong>📍 District:</strong><br>${rig.district || 'N/A'}</div>
                    <div><strong>🛠 Status:</strong><br><span style="color:${statusColor};font-weight:bold;">${statusLabel}</span></div>
                    <div><strong>📏 Depth:</strong> ${rig.depth || 'N/A'} m</div>
                    <div><strong>💧 Discharge:</strong> ${h.discharge || 'N/A'} m³/h</div>
                </div>
                <div style="background:#f0f9ff;padding:8px;border-radius:6px;border-left:3px solid #00d4ff;margin-bottom:10px;">
                    <div style="font-weight:bold;margin-bottom:3px;font-size:11px;color:#005f73;">HYDRAULIC INFO:</div>
                    <div style="font-size:11px;line-height:1.4;">
                        📉 Static: <b>${h.staticLevel || 'N/A'} m</b><br>
                        📈 Dynamic: <b>${h.dynamicLevel || 'N/A'} m</b><br>
                        📍 Piezometry: <b>${h.piezometricLevel || 'N/A'} m</b>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <button onclick="window.viewWellDetails('${rig.id}')" style="background:linear-gradient(135deg,#00b4d8,#0077b6);border:none;padding:10px;border-radius:4px;color:white;cursor:pointer;font-size:11px;font-weight:bold;width:100%;display:flex;align-items:center;justify-content:center;gap:5px;">
                        <i class="fa-solid fa-eye"></i> Full Details
                    </button>
                    <button onclick="window.openMeasurementFromMap('${rig.id}')" style="background:linear-gradient(135deg,#2ed573,#7bed9f);border:none;padding:10px;border-radius:4px;color:#1a1a1a;cursor:pointer;font-size:11px;font-weight:bold;width:100%;display:flex;align-items:center;justify-content:center;gap:5px;">
                        <i class="fa-solid fa-plus-circle"></i> Add Measurement
                    </button>
                    <a href="#" onclick="window.resetWellPosition('${rig.id}'); return false;" style="text-align:center;color:#666;font-size:10px;text-decoration:underline;margin-top:5px;">
                        <i class="fa-solid fa-rotate-left"></i> Reset Position
                    </a>
                </div>
            </div>`;
    }

    _createMarker(rig, isNew = false) {
        const lat = parseFloat(rig.lat);
        const lng = parseFloat(rig.lng);
        if (isNaN(lat) || isNaN(lng)) return null;

        const marker = L.marker([lat, lng], {
            icon: this._buildIcon(rig.status, isNew),
            draggable: true
        })
        .bindPopup(this._buildPopup(rig))
        .bindTooltip(rig.name, { permanent: true, direction: 'top', offset: [0, -10], className: 'well-label' });

        marker.on('dragend', (event) => {
            const pos = event.target.getLatLng();
            const well = mockData.rigs.find(w => w.id === rig.id);
            if (well) {
                well.lat = pos.lat;
                well.lng = pos.lng;
                if (typeof renderWellsTable === 'function') renderWellsTable();
                if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
            }
        });

        return marker;
    }

    renderMarkers(filterTerm = '') {
        if (!this.markerLayer) this.markerLayer = L.layerGroup().addTo(this.map);
        this.markerLayer.clearLayers();
        this.markers = {};

        const bounds = [];
        const term = filterTerm.toLowerCase();

        mockData.rigs.forEach(rig => {
            if (term && !rig.name.toLowerCase().includes(term) &&
                !rig.id.toLowerCase().includes(term) &&
                !(rig.state || '').toLowerCase().includes(term) &&
                !(rig.district || '').toLowerCase().includes(term)) return;

            const lat = parseFloat(rig.lat);
            const lng = parseFloat(rig.lng);
            if (isNaN(lat) || isNaN(lng)) return;
            bounds.push([lat, lng]);

            const marker = this._createMarker(rig);
            if (marker) {
                this.markerLayer.addLayer(marker);
                this.markers[rig.id] = marker;
            }
        });

        // Only auto-fit on first load, not on every refresh
        if (!this._initialFitDone && bounds.length > 0) {
            this.map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
            this._initialFitDone = true;
        }
    }

    // Add a single new marker with fly-to animation
    addSingleMarker(rig) {
        const lat = parseFloat(rig.lat);
        const lng = parseFloat(rig.lng);
        if (isNaN(lat) || isNaN(lng)) return;

        // Remove existing marker for this ID if present
        if (this.markers && this.markers[rig.id]) {
            this.markerLayer.removeLayer(this.markers[rig.id]);
        }

        const marker = this._createMarker(rig, true); // isNew=true → bounce animation
        if (!marker) return;

        if (!this.markerLayer) this.markerLayer = L.layerGroup().addTo(this.map);
        this.markerLayer.addLayer(marker);
        if (!this.markers) this.markers = {};
        this.markers[rig.id] = marker;

        // Smooth fly-to new well
        this.map.flyTo([lat, lng], 13, { animate: true, duration: 1.2, easeLinearity: 0.25 });

        // Open popup after fly-to
        setTimeout(() => marker.openPopup(), 1300);
    }

    // Update existing marker in place (no zoom change)
    updateMarker(rig) {
        if (!this.markers || !this.markers[rig.id]) {
            this.addSingleMarker(rig);
            return;
        }
        const lat = parseFloat(rig.lat);
        const lng = parseFloat(rig.lng);
        if (isNaN(lat) || isNaN(lng)) return;

        const marker = this.markers[rig.id];
        marker.setLatLng([lat, lng]);
        marker.setIcon(this._buildIcon(rig.status));
        marker.setPopupContent(this._buildPopup(rig));
        marker.setTooltipContent(rig.name);

        // Brief highlight pulse
        if (marker._icon) {
            marker._icon.style.transition = 'transform 0.3s';
            marker._icon.style.transform = 'scale(2)';
            setTimeout(() => { if (marker._icon) marker._icon.style.transform = 'scale(1)'; }, 350);
        }
    }

    highlightRig(rigId) {
        this.markerLayer.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                const popup = layer.getPopup();
                if (popup && popup.getContent().includes(rigId)) {
                    this.map.flyTo(layer.getLatLng(), 12, {
                        duration: 1.5
                    });
                    layer.openPopup();
                }
            }
        });
    }

    changeBaseLayer(type) {
        // Remove existing base layer
        if (this.baseLayer) {
            this.map.removeLayer(this.baseLayer);
        }

        let url = '';
        let attribution = '';

        if (type === 'street-map') {
            // GOOGLE TERRAIN (Requested: Relief/Plan)
            url = 'https://mt1.google.com/vt/lyrs=p&hl=en&x={x}&y={y}&z={z}';
            attribution = '&copy; Google Maps Terrain';
        } else if (type === 'satellite') {
            // GOOGLE HYBRID (Requested: Satellite + Legend/Labels)
            url = 'https://mt1.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}';
            attribution = '&copy; Google Maps Satellite';
        } else if (type === 'dark') {
            url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            attribution = '&copy; CARTO';
        } else {
            url = 'https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}';
            attribution = '&copy; Google Maps';
        }

        this.baseLayer = L.tileLayer(url, {
            attribution: attribution,
            maxZoom: 22,
            maxNativeZoom: 20
        }).addTo(this.map);

        // Ensure markers stay on top
        if (this.markerLayer) {
            this.markerLayer.bringToFront();
        }
    }

    // Support for QGIS Layers (Missing in original map.js)
    addGenericLayer(geojsonData, layerName) {
        if (!this.genericLayers) this.genericLayers = {};

        // Remove if exists
        if (this.genericLayers[layerName]) {
            this.map.removeLayer(this.genericLayers[layerName]);
        }

        // Define style based on type
        const style = (feature) => {
            switch (feature.geometry.type) {
                case 'Point': return { radius: 8, fillColor: "#ff7800", color: "#000", weight: 1, opacity: 1, fillOpacity: 0.8 };
                case 'LineString': return { color: "#3388ff", weight: 4, opacity: 0.8 };
                case 'Polygon': return { fillColor: "#3388ff", weight: 2, opacity: 1, color: "white", fillOpacity: 0.2 };
                default: return {};
            }
        };

        const pointToLayer = (feature, latlng) => {
            return L.circleMarker(latlng, style(feature));
        };

        const onEachFeature = (feature, layer) => {
            if (feature.properties) {
                let popupContent = '<div style="font-family: Outfit, sans-serif;">';
                for (const [key, value] of Object.entries(feature.properties)) {
                    popupContent += `<strong>${key}:</strong> ${value}<br>`;
                }
                popupContent += '</div>';
                layer.bindPopup(popupContent);
            }
        };

        // Create GeoJSON layer (Reverted to standard SVG for quality since heavy data is disabled)
        const layer = L.geoJSON(geojsonData, {
            style: style,
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, style(feature));
            },
            onEachFeature: onEachFeature
        });

        layer.addTo(this.map);
        this.genericLayers[layerName] = layer;
        
        console.log(`[Leaflet] Added layer: ${layerName}`);
    }

    toggleGenericLayer(layerName, isVisible) {
        if (!this.genericLayers || !this.genericLayers[layerName]) return;

        if (isVisible) {
            if (!this.map.hasLayer(this.genericLayers[layerName])) {
                this.map.addLayer(this.genericLayers[layerName]);
            }
        } else {
            if (this.map.hasLayer(this.genericLayers[layerName])) {
                this.map.removeLayer(this.genericLayers[layerName]);
            }
        }
    }
}

// Global instances
window.mainMap = null; // Dashboard map
window.fullMap = null; // Fullscreen map

document.addEventListener('DOMContentLoaded', () => {
    // Dashboard Map
    if (document.getElementById('map')) {
        window.mainMap = new wellMap('map');
    }
    
    // Full Screen Map
    if (document.getElementById('map-full')) {
        console.log("[Leaflet] Initializing Full Screen Map...");
        window.fullMap = new wellMap('map-full');
        
        // ADD LAYER CONTROLS
        const baseMaps = {
            "Normal Map": L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }),
            "Satellite (Google Earth)": L.tileLayer('http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}', { attribution: '&copy; Google Maps' })
        };
        L.control.layers(baseMaps).addTo(window.fullMap.map);

        // FORCE INITIAL RESIZE
        setTimeout(() => {
            if (window.fullMap && window.fullMap.map) window.fullMap.map.invalidateSize();
        }, 500);
    }
});

window.resetWellPosition = function(wellId) {
    const well = mockData.rigs.find(w => w.id === wellId);
    if (well && well.initialLat !== undefined) {
        well.lat = well.initialLat;
        well.lng = well.initialLng;
        console.log(`[Leaflet] Well ${wellId} reset to original position.`);
        if (window.mainMap) window.mainMap.renderMarkers();
        if (window.fullMap) window.fullMap.renderMarkers();
        if (typeof renderWellsTable === 'function') renderWellsTable();
    }
};

function changeBasemap(type) {
    if (!mainMap) return;

    mainMap.changeBaseLayer(type);

    // Update active button state
    document.querySelectorAll('.card-actions .sm-btn').forEach(btn => btn.classList.remove('active'));
    if (type === 'street-map') {
        const btn = document.getElementById('btnMapStreets');
        if (btn) btn.classList.add('active');
    } else if (type === 'satellite') {
        const btn = document.getElementById('btnMapSatellite');
        if (btn) btn.classList.add('active');
    }
}
