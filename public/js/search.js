(() => {
    let isMapMode = false;
    window.toggleMapMode = function() {
        const mapWrapper = document.querySelector('.map-wrapper');
        const mapInner = document.querySelector('.map-inner');
        const listContainer = document.querySelector('.property-list-container');
        const mapEl = document.getElementById('map');
        const btnSpan = document.querySelector('#mapToggleBtn span');
        const btnIcon = document.querySelector('#mapToggleBtn svg');
        
        isMapMode = !isMapMode;
        if (isMapMode) {
            listContainer.classList.add('hidden');
            mapWrapper.classList.remove('hidden', 'lg:block');
            mapWrapper.classList.add('fixed', 'inset-0', 'z-[1500]', 'bg-slate-50');
            mapInner.classList.remove('p-2', 'rounded-[2.5rem]', 'sticky', 'top-24');
            mapEl.classList.remove('rounded-[2rem]', 'h-[calc(100dvh-8rem)]');
            mapEl.classList.add('h-[100dvh]', 'w-full', 'pb-16'); 
            btnSpan.textContent = 'List';
            btnIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />';
            setTimeout(() => UIUtils.invalidateMaps(), 100);
        } else {
            listContainer.classList.remove('hidden');
            mapWrapper.classList.add('hidden', 'lg:block');
            mapWrapper.classList.remove('fixed', 'inset-0', 'z-[1500]', 'bg-slate-50');
            mapInner.classList.add('p-2', 'rounded-[2.5rem]', 'sticky', 'top-24');
            mapEl.classList.add('rounded-[2rem]', 'h-[calc(100dvh-8rem)]');
            mapEl.classList.remove('h-[100dvh]', 'w-full', 'pb-16');
            btnSpan.textContent = 'Map View';
            btnIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />';
            setTimeout(() => UIUtils.invalidateMaps(), 100);
        }
    };

    function escapeHtml(unsafe) {
        return (unsafe || '').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    let matrixMap;
    function addMarkers(props) {
        if (!matrixMap) return;
        matrixMap.loadProperties(props);
    }

    window.fetchPage = function(page) {
        const form = document.getElementById('filterForm');
        fetchSearchResults(form, page);
        document.querySelector('.property-list-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    function renderPagination(paginationData) {
        const controls = document.getElementById('paginationControls');
        if (!controls || !paginationData || paginationData.totalPages <= 1) {
            if (controls) controls.classList.add('hidden');
            return;
        }

        const { page, totalPages } = paginationData;
        controls.classList.remove('hidden');

        let paginationHtml = `
            <button onclick="fetchPage(${page - 1})" class="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all" ${page === 1 ? 'disabled' : ''}>Previous</button>
            <span class="px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl">Page ${page} of ${totalPages}</span>
            <button onclick="fetchPage(${page + 1})" class="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all" ${page === totalPages ? 'disabled' : ''}>Next</button>
        `;
        controls.innerHTML = paginationHtml;
    }

    function initSearchPage() {
        console.log('Initializing search page results and map...');
        
        if (typeof UIUtils !== 'undefined') {
            UIUtils.initCardObserver();
        }

        const properties = window.MatrixSpaces.properties || [];
        const paginationData = window.MatrixSpaces.pagination || null;
        
        if (paginationData) {
            renderPagination(paginationData);
        }

        if (typeof MatrixMap !== 'undefined' && L) {
            matrixMap = new MatrixMap('map', {
                lat: 28.5492,
                lng: 77.2527,
                zoom: 13,
                enforceBorders: true,
                showGlobalBorders: true,
                useGeocoder: true,
                showPoiControl: true
            });
            addMarkers(properties);
        } else if (typeof UIUtils !== 'undefined') {
            UIUtils.initMap('map', 28.5492, 77.2527, { 
                zoom: 13,
                tileLayerUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                subdomains: 'abcd',
                useGeocoder: true
            });
            addMarkers(properties);
        }

        properties.forEach(p => { if (p.photos && p.photos.length > 0) UIUtils.registerCarousel(p.id, p.photos); });
        window.changeSlide = UIUtils.changeSlide.bind(UIUtils);
        UIUtils.initTouchCarousel('.group-carousel');
        
        // Force reveal if observer is slow
        setTimeout(() => {
            document.querySelectorAll('.ms-stagger.opacity-0').forEach(el => el.classList.remove('opacity-0'));
        }, 300);
    }

    function initializeWhenReady() {
        let attempts = 0;
        const checkDeps = setInterval(() => {
            attempts++;
            const isReady = typeof UIUtils !== 'undefined' && typeof L !== 'undefined' && typeof MatrixMap !== 'undefined';
            
            if (isReady) {
                clearInterval(checkDeps);
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', initSearchPage);
                } else {
                    initSearchPage();
                }
            } else if (attempts > 50) { // Timeout after 5 seconds
                clearInterval(checkDeps);
                console.error('[MatrixSpaces] Critical: Failed to load required Map & UI dependencies.');
            }
        }, 100);
    }
    
    initializeWhenReady();

    const mobileToggle = document.getElementById('mobileFilterToggle');
    const mobilePanel = document.getElementById('filterPanel');
    if (mobileToggle && mobilePanel) {
        mobileToggle.addEventListener('click', function () {
            const isHidden = mobilePanel.classList.contains('hidden');
            mobilePanel.classList.toggle('hidden', !isHidden);
            this.setAttribute('aria-expanded', !isHidden);
        });
    }

    document.getElementById('clearFilters')?.addEventListener('click', () => {
        const form = document.getElementById('filterForm');
        form.querySelectorAll('input:not([type=hidden]):not([type=checkbox])').forEach(i => i.value = '');
        form.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = false);
        form.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
        fetchSearchResults(form);
    });

    document.querySelectorAll('#filterForm select, #filterForm input[type="checkbox"]').forEach(el => {
        el.addEventListener('change', function() {
            fetchSearchResults(this.closest('form'));
        });
    });

    const searchInputs = document.querySelectorAll('input[name="search"]');
    let debounceTimer;
    searchInputs.forEach(searchInput => {
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            const form = this.closest('form');
            if (this.value.trim().length >= 3 || this.value.trim().length === 0) {
                debounceTimer = setTimeout(() => {
                    if(form) fetchSearchResults(form);
                }, 600);
            }
        });
    });

    document.getElementById('filterForm')?.addEventListener('submit', function(e) {
        e.preventDefault();
        fetchSearchResults(this);
    });

    window.fetchSearchResults = function(form, page = 1) {
        const formData = new FormData(form);
        const params = new URLSearchParams(formData);
        params.set('page', page);
        params.set('limit', 12);
        
        const newUrl = window.location.pathname + '?' + params.toString();
        window.history.pushState({path: newUrl}, '', newUrl);

        const container = document.getElementById('propertyGrid');
        if (container) {
            if (typeof UIUtils !== 'undefined') {
                if (UIUtils._cardObserver) UIUtils._cardObserver.disconnect();
                if (UIUtils.carousels) UIUtils.carousels = {};
            }
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            container.innerHTML = '<div class="col-span-full flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div></div>';
        }

        const htmlParams = new URLSearchParams(formData);
        htmlParams.append('ajax', 'true');
        htmlParams.set('page', page);
        
        Promise.all([
            fetch('/search?' + htmlParams.toString()).then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.text();
            }),
            fetch('/api/properties?' + params.toString()).then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
        ]).then(([html, data]) => {
            if (container) {
                if(!html || html.trim() === '') {
                    container.innerHTML = '<div class="col-span-full p-10 bg-white border border-slate-200 rounded-3xl text-center shadow-sm"><p class="text-xl font-bold text-slate-700 mb-2">No properties found</p></div>';
                } else {
                    container.innerHTML = html;
                    if (data && data.properties && typeof UIUtils !== 'undefined') {
                        data.properties.forEach(p => { 
                            if (p.photos && p.photos.length > 0) UIUtils.registerCarousel(p.id, p.photos); 
                        });
                    }
                    if (typeof UIUtils !== 'undefined') UIUtils.initTouchCarousel('.group-carousel');
                }
            }

            if (data && data.pagination) {
                renderPagination(data.pagination);
                const countText = document.querySelector('h1 + p.text-slate-600');
                if (countText) countText.textContent = data.pagination.total + ' properties found matching your criteria.';
            }
            
            if (data && data.properties) addMarkers(data.properties);
            if (typeof UIUtils !== 'undefined') UIUtils.initCardObserver();
        }).catch(err => {
            console.error('Fetch error:', err);
            if (container) {
                container.innerHTML = '<div class="col-span-full text-center text-red-500 py-10 font-bold">Error loading results. Please try again.</div>';
            }
        });
    };
})();
