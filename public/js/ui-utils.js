const UIUtils = (() => {
    const mapInstances = {};
    const carouselData = {};

    return {
        initMap: function(mapId, lat, lng, options = {}) {
            if (!document.getElementById(mapId)) return null;
            if (mapInstances[mapId]) {
                mapInstances[mapId].map.setView([lat, lng], options.zoom || 15);
                return mapInstances[mapId];
            }

            const map = L.map(mapId, { attributionControl: false }).setView([lat, lng], options.zoom || 15);
            L.control.attribution({ position: 'topright' }).addTo(map);
            
            const tileLayerUrl = options.tileLayerUrl || 'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png';
            const attribution = options.attribution || '&copy; OpenStreetMap contributors &copy; CARTO';
            
            L.tileLayer(tileLayerUrl, { attribution, maxZoom: options.maxZoom || 20, subdomains: options.subdomains || 'abcd' }).addTo(map);

            const markerOptions = {};
            if (options.draggable) markerOptions.draggable = true;
            
            const propertyIcon = L.icon({
                iconUrl: '/assets/property.png',
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
            });
            markerOptions.icon = propertyIcon;

            const marker = L.marker([lat, lng], markerOptions).addTo(map);

            if (options.popupHTML) {
                marker.bindPopup(options.popupHTML).openPopup();
            }

            if (options.draggable) {
                marker.on('dragend', function (e) {
                    const pos = marker.getLatLng();
                    if (options.latInputId) {
                        const latInput = document.getElementById(options.latInputId);
                        if(latInput) latInput.value = pos.lat;
                    }
                    if (options.lngInputId) {
                        const lngInput = document.getElementById(options.lngInputId);
                        if(lngInput) lngInput.value = pos.lng;
                    }
                    if (options.useGeocoder) {
                        marker.bindPopup(`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`).openPopup();
                    }
                });
            }

            mapInstances[mapId] = { map, marker };
            return mapInstances[mapId];
        },
        invalidateMaps: function() {
            Object.values(mapInstances).forEach(inst => {
                if (inst && inst.map) inst.map.invalidateSize();
            });
        },
        registerCarousel: function(id, photos) {
            carouselData[id] = { photos, index: 0 };
        },
        changeSlide: function(e, id, direction) {
            let actualId = id;
            let actualDirection = direction;
            if (typeof e === 'string') {
                actualId = e;
                actualDirection = direction;
                e = null;
            }
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const data = carouselData[actualId];
            if (!data || !data.photos || !data.photos.length) return;
            data.index = (data.index + actualDirection + data.photos.length) % data.photos.length;
        
        let photoKey = data.photos[data.index];
        const s3BaseUrl = (window.MatrixSpaces && window.MatrixSpaces.s3BaseUrl) ? window.MatrixSpaces.s3BaseUrl : 'https://matrixspaces-uploads-590184011565-ap-south-1-an.s3.ap-south-1.amazonaws.com/';
        const newSrc = `${s3BaseUrl}${photoKey.startsWith('properties/') ? photoKey : 'properties/' + photoKey}`;
        
        document.querySelectorAll(`[data-prop-id="${actualId}"]`).forEach(carousel => {
            const img = carousel.querySelector('img');
            if (img) img.src = newSrc;
        });
        },
        initTouchCarousel: function(selector) {
            document.querySelectorAll(selector).forEach(el => {
                let startX = 0;
                el.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
                el.addEventListener('touchend', e => {
                    const diff = startX - e.changedTouches[0].clientX;
                    const id = el.dataset.propId;
                    if (Math.abs(diff) > 40 && id) this.changeSlide(null, id, diff > 0 ? 1 : -1);
                }, { passive: true });
            });
        },
        getMapInstance: function(mapId) {
            return mapInstances[mapId];
        },
        initReconnectBanner: function() {
            if (document.getElementById('reconnect-banner')) return;

            const banner = document.createElement('div');
            banner.id = 'reconnect-banner';
            banner.className = 'fixed top-0 left-0 right-0 bg-amber-500 text-white text-center py-2 text-sm font-bold z-[9999] hidden transition-opacity duration-300';
            banner.innerHTML = `
                <div class="container mx-auto flex items-center justify-center gap-2">
                    <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Connection lost. Reconnecting...</span>
                </div>
            `;
            document.body.prepend(banner);

            if (window.socket) {
                window.socket.on('disconnect', () => banner.classList.remove('hidden'));
                window.socket.on('reconnect', () => banner.classList.add('hidden'));
            }
        },
        initCardObserver: function() {
            if (this._cardObserver) this._cardObserver.disconnect();
            
            const observerOptions = {
                root: null,
                rootMargin: '200px',
                threshold: 0
            };

            this._cardObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        window.requestAnimationFrame(() => {
                            entry.target.style.opacity = '1';
                            entry.target.style.transform = 'translate3d(0, 0, 0)';
                            entry.target.classList.remove('opacity-0');
                            entry.target.classList.add('animate-fade-in-up', 'revealed');
                        });
                        observer.unobserve(entry.target);
                    }
                });
            }, observerOptions);

            const observeCards = () => {
                document.querySelectorAll('.ms-stagger:not(.revealed)').forEach((card, index) => {
                    card.style.animationDelay = `${(index % 8) * 50}ms`;
                    this._cardObserver.observe(card);
                });
            };

            observeCards();

            // Automatic reveal for dynamically added content
            if (this._mutationObserver) this._mutationObserver.disconnect();
            this._mutationObserver = new MutationObserver((mutations) => {
                let hasNewCards = false;
                mutations.forEach(m => {
                    m.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && (node.classList.contains('ms-stagger') || node.querySelector('.ms-stagger'))) {
                            hasNewCards = true;
                        }
                    });
                });
                if (hasNewCards) observeCards();
            });

            // Phase 3: Scope MutationObserver to prevent global DOM performance hits
            const targetNode = document.getElementById('propertyGrid') || document.querySelector('.property-list-container') || document.body;
            this._mutationObserver.observe(targetNode, { childList: true, subtree: true });

            // Universal fallback
            setTimeout(() => {
                document.querySelectorAll('.ms-stagger:not(.revealed)').forEach((card) => {
                    card.style.opacity = '1';
                    card.style.transform = 'translate3d(0, 0, 0)';
                    card.classList.remove('opacity-0');
                    card.classList.add('animate-fade-in-up', 'revealed');
                });
            }, 1000);
        }
    };
})();
window.UIUtils = UIUtils;
