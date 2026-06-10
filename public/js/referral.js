/**
 * MatrixSpaces - Referral Dashboard Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    const referralModal = document.getElementById('referralModal');
    const btnsOpenReferral = document.querySelectorAll('#btnOpenReferral');
    
    let currentReferralCode = '';

    btnsOpenReferral.forEach(btn => {
        btn.addEventListener('click', () => {
            if (referralModal) referralModal.classList.remove('hidden');
            loadReferralDashboard();
        });
    });

    // Close modal handling
    document.querySelectorAll('[data-close-referral]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (referralModal) referralModal.classList.add('hidden');
        });
    });

    function loadReferralDashboard() {
        fetch('/api/referrals/dashboard')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    currentReferralCode = data.referral_code;
                    renderDashboard(data);
                } else {
                    if (typeof showToast === 'function') {
                        showToast(data.error || 'Failed to load referral stats.', 'error');
                    } else {
                        alert(data.error || 'Failed to load referral stats.');
                    }
                }
            })
            .catch(err => {
                console.error("Referral fetch error:", err);
            });
    }

    function renderDashboard(data) {
        const stats = data.stats || {};
        
        document.getElementById('refTotal').textContent = stats.total_referrals || 0;
        document.getElementById('refPartners').textContent = stats.partner_referrals || 0;
        document.getElementById('refUsers').textContent = stats.user_referrals || 0;
        document.getElementById('refEarnings').textContent = `₹${Number(stats.total_earned || 0).toLocaleString()}`;
        
        const tbody = document.getElementById('refRecentTable');
        if (tbody) {
            tbody.innerHTML = '';
            if (data.history && data.history.length > 0) {
                data.history.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-slate-100 hover:bg-slate-50';
                    tr.innerHTML = `
                        <td class="p-3 text-sm font-medium text-slate-800">${escapeHtml(r.referred_name || 'N/A')}</td>
                        <td class="p-3 text-sm text-slate-600 capitalize">${r.referred_role || r.referral_type}</td>
                        <td class="p-3 text-sm font-bold ${r.status === 'paid' ? 'text-green-600' : (r.status === 'verified' ? 'text-blue-600' : 'text-amber-500')} capitalize">${r.status}</td>
                        <td class="p-3 text-sm font-bold text-slate-800">₹${r.amount}</td>
                        <td class="p-3 text-xs text-slate-500">${new Date(r.created_at).toLocaleDateString()}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-slate-500">No recent referrals. Start inviting!</td></tr>';
            }
        }
    }

    window.generateReferralLink = function(type) {
        if (!currentReferralCode) {
            if (typeof showToast === 'function') showToast('Wait for your referral code to load.', 'error');
            return;
        }
        
        const protocol = window.location.protocol;
        const host = window.location.host;
        
        let link = `${protocol}//${host}/login?ref=${currentReferralCode}`;
        if (type === 'partner') {
            link = `${protocol}//${host}/partner-signup?ref=${currentReferralCode}`;
        } else if (type === 'user') {
            link = `${protocol}//${host}/login?tab=signup&ref=${currentReferralCode}`;
        }

        document.getElementById('referralLinkInput').value = link;
        document.getElementById('shareButtons').classList.remove('hidden');
    };

    window.copyReferralLink = function() {
        const linkInput = document.getElementById('referralLinkInput');
        if (linkInput && linkInput.value) {
            navigator.clipboard.writeText(linkInput.value).then(() => {
                if (typeof showToast === 'function') showToast('Referral link copied to clipboard!', 'success');
            });
        }
    };

    window.shareWhatsApp = function() {
        const link = document.getElementById('referralLinkInput').value;
        if (!link) return;
        const text = encodeURIComponent(`Join MatrixSpaces using my referral link! \n\n${link}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    window.shareEmail = function() {
        const link = document.getElementById('referralLinkInput').value;
        if (!link) return;
        const subject = encodeURIComponent('Join MatrixSpaces');
        const body = encodeURIComponent(`Hi, \n\nI invite you to join MatrixSpaces. Sign up using my link: \n\n${link}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});