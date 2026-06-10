(() => {
    window.scrollContainer = function(btn, direction) {
        const container = btn.parentElement.querySelector('.overflow-x-auto');
        if (container) {
            container.scrollBy({ left: direction * 350, behavior: 'smooth' });
        }
    };

    window.setSearchTab = function(tab, btn) {
        const listingTypeSelect = document.getElementById('heroListingTypeSelect');
        const propertyTypeInput = document.getElementById('heroPropertyType');
        
        if (tab === 'Buy') {
            listingTypeSelect.value = 'sale';
            propertyTypeInput.value = '';
        } else if (tab === 'Rent') {
            listingTypeSelect.value = 'rent';
            propertyTypeInput.value = '';
        } else if (tab === 'Commercial') {
            listingTypeSelect.value = '';
            propertyTypeInput.value = 'Office'; 
        } else if (tab === 'PG') {
            listingTypeSelect.value = 'rent';
            propertyTypeInput.value = 'PG';
        } else if (tab === 'Partners') {
            window.location.href = '/partners';
            return;
        }

        const allTabs = document.querySelectorAll('.search-tab');
        allTabs.forEach(t => {
            t.classList.remove('text-[#D4AF37]', 'text-white', 'hover:bg-white/10');
            t.classList.add('text-white', 'hover:bg-white/10');
            t.querySelector('.tab-indicator').classList.add('hidden');
        });

        btn.classList.remove('text-white', 'hover:bg-white/10');
        btn.classList.add('text-[#D4AF37]');
        btn.querySelector('.tab-indicator').classList.remove('hidden');
    };

    // Real-time notification logic
    const currentUser = window.MatrixSpaces.user;
    if (currentUser) {
        const socket = io();

        // Listen for a toast for a new notification
        socket.on('new_notification_toast', (data) => {
            if (typeof showToast === 'function' && data.content) {
                showToast(`🔔 ${data.content}`, 'info');
            }
        });

        // Listen for an event that just updates the unread count
        socket.on('notification_count_update', (data) => {
            const counters = document.querySelectorAll('.notification-counter');
            counters.forEach(counter => {
                const count = data.totalUnreadCount;
                if (count > 0) {
                    counter.textContent = count > 9 ? '9+' : count;
                    counter.classList.remove('hidden');
                } else {
                    counter.textContent = '';
                    counter.classList.add('hidden');
                }
            });
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected. Will try to reconnect.');
        });
    }

    let isMapMode = false;
    window.toggleMapMode = function() {
        const mapWrapper = document.querySelector('.map-wrapper');
        const mapInner = document.querySelector('.map-inner');
        const listContainer = document.querySelector('.property-list-container');
        const mapEl = document.getElementById('map');
        const btnSpan = document.querySelector('#mapToggleBtn span');
        const btnIcon = document.querySelector('#mapToggleBtn svg');
        const btnWrapper = document.getElementById('mapToggleBtn');
        
        isMapMode = !isMapMode;
        if (isMapMode) {
            listContainer.classList.add('hidden');
            mapWrapper.classList.remove('hidden', 'lg:block');
            mapWrapper.classList.add('fixed', 'inset-0', 'z-[1500]', 'bg-slate-50');
            mapInner.classList.remove('p-2', 'rounded-[2.5rem]', 'sticky', 'top-24');
            mapEl.classList.remove('rounded-[2rem]', 'h-[calc(100dvh-8rem)]');
            mapEl.classList.add('h-[100dvh]', 'w-full', 'pb-24'); // space for bottom nav
            
            btnWrapper.setAttribute('aria-expanded', 'true');
            btnSpan.textContent = 'List';
            btnIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />';
            setTimeout(() => {
                UIUtils.invalidateMaps();
                if (window.homeMapInstance) window.homeMapInstance.map.invalidateSize();
            }, 100);
        } else {
            listContainer.classList.remove('hidden');
            mapWrapper.classList.add('hidden', 'lg:block');
            mapWrapper.classList.remove('fixed', 'inset-0', 'z-[1500]', 'bg-slate-50');
            mapInner.classList.add('p-2', 'rounded-[2.5rem]', 'sticky', 'top-24');
            mapEl.classList.add('rounded-[2rem]', 'h-[calc(100dvh-8rem)]');
            mapEl.classList.remove('h-[100dvh]', 'w-full', 'pb-24');
            
            btnWrapper.setAttribute('aria-expanded', 'false');
            btnSpan.textContent = 'Map View';
            btnIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />';
            setTimeout(() => {
                UIUtils.invalidateMaps();
                if (window.homeMapInstance) window.homeMapInstance.map.invalidateSize();
            }, 100);
        }
    };

    // ─── Map Init ───────────────────────────────────────────────────────────
    window.homeMapInstance = null;
    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    window.addMarkers = function(props) {
        // Safely unwrap data if wrapped in standard API response object
        if (props && props.status === 'success' && props.data && props.data.properties) {
            props = props.data.properties;
        } else if (props && !Array.isArray(props) && props.properties) {
            props = props.properties;
        }
        if (!Array.isArray(props)) return;

        if (!window.homeMapInstance) return;
        
        // Use the globally optimized map core handler
        window.homeMapInstance.loadProperties(props);
    }

    // ─── Geolocation ─────────────────────────────────────────────────────────
    window.getLocation = function() {
        if (!navigator.geolocation) { showToast('Geolocation not supported', 'error'); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const params = new URLSearchParams();
                params.append('lat', pos.coords.latitude);
                params.append('lng', pos.coords.longitude);
            window.location.href = `/search?${params.toString()}`;
            },
            (error) => { 
                if (error.code === error.PERMISSION_DENIED) {
                    showToast('Location access denied. Note: Browsers require HTTPS to use GPS.', 'error');
                } else {
                    showToast('Could not get your location. Please type your city manually.', 'error'); 
                }
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    document.addEventListener('DOMContentLoaded', () => {
        const properties = window.MatrixSpaces.properties || [];
        const saleProperties = window.MatrixSpaces.saleProperties || [];
        const newlyAddedProperties = window.MatrixSpaces.newlyAddedProperties || [];
        const recommendedProperties = window.MatrixSpaces.recommendedProperties || [];
        const recentlyViewedProperties = window.MatrixSpaces.recentlyViewedProperties || [];

        // Enforce popup modal blocks scroll
        if (document.getElementById('completeProfilePopup')) {
            document.body.style.overflow = 'hidden';
        }

        // Hide Map View button on scroll down, show on scroll up
        let lastScrollTopBtn = window.pageYOffset || document.documentElement.scrollTop;
        let tickingBtn = false;
        window.addEventListener('scroll', () => {
            const st = window.pageYOffset || document.documentElement.scrollTop;
            if (!tickingBtn) {
                window.requestAnimationFrame(() => {
                    const mapBtn = document.getElementById('mapToggleBtn');
                    if (mapBtn && typeof isMapMode !== 'undefined' && !isMapMode) {
                        if (st > lastScrollTopBtn && st > 100) {
                            // Scrolling Down
                            mapBtn.classList.add('translate-y-48');
                        } else {
                            // Scrolling Up
                            mapBtn.classList.remove('translate-y-48');
                        }
                    }
                    lastScrollTopBtn = st <= 0 ? 0 : st;
                    tickingBtn = false;
                });
                tickingBtn = true;
            }
        }, { passive: true });

        const initHomeMap = () => {
            document.getElementById('map').innerHTML = ''; // Clear placeholder if any
            
            if (typeof window.MatrixMap !== 'function') {
                console.error('MatrixMap failed to load. Please ensure map-core.js is successfully loading from public/js/map-core.js');
                return;
            }
            window.homeMapInstance = new window.MatrixMap('map', {
                lat: 28.6139,
                lng: 77.2090,
                zoom: 11,
                enforceBorders: true, // Enables the official India boundaries
                showGlobalBorders: true, // Loads corrected country boundaries from local GeoJSON
                useGeocoder: true,    // Enables the Google Maps search bar
                showPoiControl: true  // Enables the nearby amenities feature
            });
            window.addMarkers(properties);
        };

        const initializeHomepageWhenReady = () => {
            let attempts = 0;
            const checkDeps = setInterval(() => {
                attempts++;
                const isReady = typeof UIUtils !== 'undefined' && typeof L !== 'undefined' && typeof window.MatrixMap !== 'undefined';
                
                if (isReady) {
                    clearInterval(checkDeps);
                    initHomeMap();
                } else if (attempts > 50) { 
                    clearInterval(checkDeps);
                    console.error('[MatrixSpaces] Critical: Failed to load required Map & UI dependencies on homepage.');
                }
            }, 100);
        };

        if (localStorage.getItem('cookieConsent') === 'accepted') {
            initializeHomepageWhenReady();
        } else {
            document.getElementById('map').innerHTML = `
                <div class="flex flex-col items-center justify-center h-full w-full bg-slate-100/50 backdrop-blur text-slate-600 p-6 text-center">
                    <svg class="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                    <p class="font-bold mb-4">Interactive map requires cookies for third-party tiles.</p>
                    <button type="button" onclick="acceptCookies()" class="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition shadow-sm">Allow Cookies</button>
                </div>`;
            document.addEventListener('cookiesAccepted', initializeHomepageWhenReady, { once: true });
        }

        UIUtils.initReconnectBanner();

        // ─── Carousel ────────────────────────────────────────────────────────────
        const registerCarousels = (props) => {
            props.forEach(p => {
                if (p.photos && p.photos.length > 0) {
                    UIUtils.registerCarousel(p.id, p.photos);
                }
            });
        };
        
        registerCarousels(properties);
        registerCarousels(saleProperties);
        registerCarousels(newlyAddedProperties);
        registerCarousels(recommendedProperties);
        registerCarousels(recentlyViewedProperties);

        window.changeSlide = UIUtils.changeSlide.bind(UIUtils);
        UIUtils.initTouchCarousel('.group-carousel');

        // ─── Hero Search Autocomplete ────────────────────────────────────────────

        // ─── Filter Form Submits ────────────────────────────────────────────────
        const filterForm = document.getElementById('filterForm');
        if (filterForm) {
            filterForm.addEventListener('submit', e => { e.preventDefault(); fetchProperties(new FormData(filterForm), filterForm.getAttribute('action') || window.location.pathname); });
            filterForm.querySelectorAll('select, input[type="checkbox"]').forEach(el => {
                el.addEventListener('change', () => fetchProperties(new FormData(filterForm), filterForm.getAttribute('action') || window.location.pathname));
            });
        }

        const desktopToggle = document.getElementById('desktopFilterToggle');
        const desktopPanel = document.getElementById('desktopFilterPanel');
        if (desktopToggle && desktopPanel) {
            desktopToggle.addEventListener('click', function () {
                const isHidden = desktopPanel.classList.contains('hidden');
                if (isHidden) {
                    desktopPanel.classList.remove('hidden');
                    void desktopPanel.offsetWidth; // Force Reflow
                    desktopPanel.classList.add('opacity-100', 'translate-y-0');
                    desktopPanel.classList.remove('opacity-0', '-translate-y-2');
                } else {
                    desktopPanel.classList.remove('opacity-100', 'translate-y-0');
                    desktopPanel.classList.add('opacity-0', '-translate-y-2');
                    setTimeout(() => desktopPanel.classList.add('hidden'), 300);
                }
                const icon = document.getElementById('desktopFilterIcon');
                if (icon) icon.style.transform = isHidden ? 'rotate(90deg)' : '';
            });
        }

        const mobileToggle = document.getElementById('mobileFilterToggle');
        const mobilePanel = document.getElementById('filterPanel');
        if (mobileToggle && mobilePanel) {
            mobileToggle.addEventListener('click', function () {
                const isHidden = mobilePanel.classList.contains('hidden');
                if (isHidden) {
                    mobilePanel.classList.remove('hidden');
                    void mobilePanel.offsetWidth; // Force Reflow
                    mobilePanel.classList.add('opacity-100', 'translate-y-0');
                    mobilePanel.classList.remove('opacity-0', '-translate-y-2');
                } else {
                    mobilePanel.classList.remove('opacity-100', 'translate-y-0');
                    mobilePanel.classList.add('opacity-0', '-translate-y-2');
                    setTimeout(() => mobilePanel.classList.add('hidden'), 300);
                }
                this.setAttribute('aria-expanded', !isHidden);
                this.querySelector('svg').style.transform = isHidden ? 'rotate(90deg)' : '';
            });
        }

        // ─── Clear Filters ───────────────────────────────────────────────────────
        document.getElementById('clearFilters')?.addEventListener('click', function () {
            const form = document.getElementById('filterForm');
            if (!form) return;
            form.querySelectorAll('input:not([type=hidden]):not([type=checkbox])').forEach(i => i.value = '');
            form.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = false);
            form.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
            fetchProperties(new FormData(form), form.getAttribute('action') || window.location.pathname);
        });

        // ─── Save / Load Search ──────────────────────────────────────────────────
        document.getElementById('saveSearch')?.addEventListener('click', function () {
            const formData = new FormData(document.getElementById('filterForm'));
            const data = Object.fromEntries(formData.entries());
            fetch('/user/save-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(res => {
                showToast(res.ok ? 'Search filters saved!' : 'Error saving search.', res.ok ? 'info' : 'error');
            });
        });

        document.getElementById('loadSearch')?.addEventListener('click', function () {
            const savedFilters = window.MatrixSpaces.savedFilters || {};
            const form = document.getElementById('filterForm');
            if (!form) return;
            Object.keys(savedFilters).forEach(key => {
                const input = form.querySelector(`[name="${key}"]`);
                if (input) {
                    if (input.type === 'checkbox') input.checked = true;
                    else input.value = savedFilters[key];
                }
            });
            fetchProperties(new FormData(form));
        });

        // ─── AJAX Fetch ──────────────────────────────────────────────────────────
        function fetchProperties(formData, actionUrl = '/search') {
            const params = new URLSearchParams(formData);
            params.append('ajax', 'true');
            const container = document.getElementById('propertyGrid');

            if (container) {
                // --- PHASE 2: GARBAGE COLLECTION ---
                if (typeof UIUtils !== 'undefined') {
                    // Disconnect active IntersectionObservers from old cards
                    if (UIUtils._cardObserver) UIUtils._cardObserver.disconnect();
                    // Drop references to old property carousels to free RAM
                    if (UIUtils.carousels) UIUtils.carousels = {};
                }
                
                // Explicitly remove child nodes to unbind DOM events cleanly
                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }
                // -----------------------------------
            }

            // Show shimmer loaders
            let shimmerHtml = '';
            for (let i = 0; i < 6; i++) {
                shimmerHtml += `
                    <div class="bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/60 flex flex-col">
                        <div class="aspect-[4/3] sm:aspect-[16/9] w-full rounded-t-[2rem] shimmer"></div>
                        <div class="p-5 flex-1 flex flex-col space-y-3">
                            <div class="h-5 w-3/4 rounded shimmer"></div>
                            <div class="h-3 w-1/2 rounded shimmer"></div>
                            <div class="grid grid-cols-2 gap-x-4 gap-y-3 mt-2">
                                <div class="h-4 w-full rounded shimmer"></div>
                                <div class="h-4 w-full rounded shimmer"></div>
                            </div>
                            <div class="flex justify-between items-end border-t border-gray-200/60 pt-4 mt-auto">
                                <div class="h-6 w-1/3 rounded shimmer"></div>
                                <div class="h-10 w-24 rounded-xl shimmer"></div>
                            </div>
                        </div>
                    </div>`;
            }
            container.innerHTML = shimmerHtml;

            // Clean up the action URL if it's empty
            const endpoint = actionUrl === '/' ? '/search' : actionUrl;

            return fetch(`${endpoint}?${params.toString()}`, {
                headers: { 'Accept': 'application/json' }
            })
                .then(res => res.json())
                .then(data => {
                    container.innerHTML = data.html;
                    if (data.properties) {
                        const fixedProps = data.properties.map(p => ({
                            ...p,
                            photos: p.photos ? p.photos.map(photo => photo.startsWith('properties/') ? photo : 'properties/' + photo) : []
                        }));
                        if (typeof window.addMarkers === 'function') window.addMarkers(fixedProps);
                        registerCarousels(fixedProps);
                        UIUtils.initTouchCarousel('#propertyGrid .group-carousel');
                        // Re-initialize scroll observer for newly fetched AJAX cards
                        window.requestAnimationFrame(() => {
                            if (window.initCardObserver) window.initCardObserver();
                        });
                    }
                })
                .catch(err => {
                    console.error('Error fetching properties:', err);
                    container.innerHTML = '<p class="col-span-full text-center text-red-500">Failed to load properties. Please try again.</p>';
                    showToast('Failed to load properties', 'error');
                });
        }

        // ─── Interactive Hero Background (Video) ─────────────
        const initHeroBackground = () => {
            const video = document.querySelector('#hero-container video');
            if (!video) return;

            const initVideoSource = function() {
                const sources = video.querySelectorAll('source');
                sources.forEach(source => {
                    if (source.getAttribute('data-src')) {
                        source.src = source.getAttribute('data-src');
                    }
                });
                video.load();

                const fadeVideoIn = function() { video.classList.remove('opacity-0'); };
                if (video.readyState >= 3) {
                    fadeVideoIn();
                } else {
                    video.addEventListener('canplay', fadeVideoIn, { once: true });
                }
                video.play().catch(e => console.log('Autoplay prevented:', e));
            };

            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(initVideoSource, { timeout: 2000 });
            } else {
                setTimeout(initVideoSource, 500);
            }

        // Calculate base scale to prevent borders during parallax and adjust zoom for mobile
        const getScale = () => window.innerWidth < 768 ? 1.25 : 1.15;
        let currentScale = getScale();
        
        window.addEventListener('resize', () => {
            currentScale = getScale();
            video.style.transform = `translate3d(0, ${window.scrollY * 0.4}px, 0) scale(${currentScale})`;
        }, { passive: true });

        // Set initial transform
        video.style.transform = `translate3d(0, ${window.scrollY * 0.4}px, 0) scale(${currentScale})`;

        let ticking = false;
            window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    video.style.transform = `translate3d(0, ${scrollY * 0.4}px, 0) scale(${currentScale})`;
                    ticking = false;
                });
                ticking = true;
            }
            }, { passive: true });
        };
        
        initHeroBackground();

        // ─── Smooth Reveal for Property Cards (Stagger) ─────────────
        UIUtils.initCardObserver();
    });
})();
