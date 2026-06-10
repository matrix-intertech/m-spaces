document.addEventListener('DOMContentLoaded', () => {
    // Animate page in
    document.body.classList.add('page-loaded');
    document.body.classList.remove('page-exiting');
    
    // Finish the progress bar
    const bar = document.getElementById('page-transition-bar');
    if (bar) {
        bar.style.width = '100%';
        setTimeout(() => {
            bar.style.opacity = '0';
            setTimeout(() => {
                bar.style.width = '0%';
            }, 300); // Wait for opacity fade
        }, 300);
    }
});

// Intercept navigation links
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    
    // Ensure it's a valid standard internal link
    if (!link) return;
    if (link.target === '_blank') return;
    if (link.hasAttribute('data-no-transition')) return;
    if (link.hostname !== window.location.hostname) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return; // Allow opening in new tab
    
    const currentPath = window.location.pathname.replace(/\/$/, '');
    const linkPath = link.pathname.replace(/\/$/, '');
    
    // Ignore anchor/hash links on the same page or empty JS links
    if (currentPath === linkPath && link.hash) return;
    if (link.getAttribute('href') === '#' || link.getAttribute('href').startsWith('javascript:')) return;

    e.preventDefault();
    
    // Start loading bar & exit animation
    const bar = document.getElementById('page-transition-bar');
    if (bar) {
        bar.style.opacity = '1';
        bar.style.width = '30%';
        setTimeout(() => { bar.style.width = '60%'; }, 100);
    }

    document.body.classList.remove('page-loaded');
    document.body.classList.add('page-exiting');

    // Delay navigation so the animation can play
    setTimeout(() => {
        window.location.href = link.href;
    }, 300); // Matches the 0.3s CSS transition duration
});

// Fix Safari/Firefox Back-Forward Cache (bfcache) freezing the page in the "exited" state
window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
        document.body.classList.add('page-loaded');
        document.body.classList.remove('page-exiting');
        const bar = document.getElementById('page-transition-bar');
        if (bar) {
            bar.style.opacity = '0';
            bar.style.width = '0%';
        }
    }
});