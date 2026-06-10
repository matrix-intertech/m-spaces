const http = require('http');

function testEndpoint(url, label) {
    return new Promise((resolve) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`\n=== ${label} ===`);
                console.log('Status:', res.statusCode);
                console.log('Size:', data.length);
                
                // Check which card template is being used
                const hasNewCard = data.includes('ms-stagger revealed');
                const hasOldCardOpacity = data.includes('ms-stagger opacity-0');
                const hasOldCardCursor = data.includes('ms-stagger cursor-pointer');
                console.log('Has NEW card (ms-stagger revealed):', hasNewCard);
                console.log('Has OLD card (ms-stagger opacity-0):', hasOldCardOpacity);
                
                // Count property cards  
                const msStagger = (data.match(/ms-stagger/g) || []).length;
                console.log('ms-stagger count:', msStagger);
                
                // Check for JS errors in page
                const hasReferenceError = data.includes('ReferenceError');
                const hasTypeError = data.includes('TypeError');
                const hasSyntaxError = data.includes('SyntaxError');
                console.log('Has ReferenceError:', hasReferenceError);
                console.log('Has TypeError:', hasTypeError);
                console.log('Has SyntaxError:', hasSyntaxError);
                
                // Check pagination rendered
                const hasPagination = data.includes('paginationControls');
                console.log('Has pagination controls:', hasPagination);
                
                // Check map
                const hasMap = data.includes('id="map"');
                console.log('Has map div:', hasMap);
                
                // Check for "No properties found"
                const hasNoResults = data.includes('No properties found');
                console.log('Has "No properties found":', hasNoResults);
                
                // Check search results count display
                const countMatch = data.match(/(\d+)\s*properties found/);
                if (countMatch) console.log('Properties count in UI:', countMatch[1]);
                
                // Check CSS visibility overrides
                const hasVisibilityFix = data.includes('opacity: 1 !important');
                console.log('Has CSS visibility fix:', hasVisibilityFix);
                
                // Check for initSearchPage
                const hasInit = data.includes('initSearchPage');
                console.log('Has initSearchPage:', hasInit);
                
                // Check UIUtils loaded
                const hasUIUtils = data.includes('ui-utils.js');
                console.log('Has ui-utils.js script:', hasUIUtils);
                
                resolve(data);
            });
        }).on('error', (e) => {
            console.log(`\n=== ${label} ===`);
            console.log('Error:', e.message);
            resolve(null);
        });
    });
}

async function main() {
    await testEndpoint('http://localhost:3000/search?search=hall', 'Search for "hall"');
    await testEndpoint('http://localhost:3000/search', 'Empty search');
    await testEndpoint('http://localhost:3000/search?listingType=sale', 'Search listing type=sale');
    
    // Test AJAX endpoint
    await new Promise((resolve) => {
        http.get('http://localhost:3000/search?search=hall&ajax=true', (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log('\n=== AJAX Search for "hall" ===');
                console.log('Status:', res.statusCode);
                console.log('Size:', data.length);
                console.log('Is HTML (not empty):', data.trim().length > 0);
                console.log('First 200 chars:', data.substring(0, 200));
                resolve();
            });
        }).on('error', (e) => {
            console.log('Error:', e.message);
            resolve();
        });
    });
    
    // Test API endpoint
    await new Promise((resolve) => {
        http.get('http://localhost:3000/api/properties?search=hall&limit=2', (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log('\n=== API Properties for "hall" ===');
                console.log('Status:', res.statusCode);
                try {
                    const json = JSON.parse(data);
                    console.log('Properties count:', json.properties?.length);
                    console.log('Pagination:', JSON.stringify(json.pagination));
                } catch(e) {
                    console.log('Parse error:', e.message);
                    console.log('Raw:', data.substring(0, 300));
                }
                resolve();
            });
        }).on('error', (e) => {
            console.log('Error:', e.message);
            resolve();
        });
    });
}

main();
