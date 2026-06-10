const supportPolicy = require('../policies/support-policy');
const adminPolicy = require('../policies/admin-policy');

describe('support/admin permission boundaries', () => {
    test('support keeps moderation permissions and loses admin-grade permissions', () => {
        const filtered = supportPolicy.filterPermissions([
            'view_overview',
            'view_messages',
            'view_users',
            'manage_kyc',
            'manage_properties',
            'manage_visits',
            'manage_permissions',
            'manage_team',
            'manage_users',
            'manage_referrals',
            'manage_bot'
        ]);

        expect(filtered).toEqual(expect.arrayContaining([
            'view_overview',
            'view_messages',
            'view_users',
            'manage_kyc'
        ]));
        expect(filtered).not.toEqual(expect.arrayContaining([
            'manage_properties',
            'manage_visits',
            'manage_permissions',
            'manage_team',
            'manage_users',
            'manage_referrals',
            'manage_bot'
        ]));
    });

    test('support defaults include KYC review even when stale role grants are missing it', () => {
        const filtered = supportPolicy.filterPermissions(['view_overview', 'view_messages', 'view_users']);
        expect(filtered).toContain('manage_kyc');
    });

    test('admin policy distinguishes admin from support', () => {
        expect(adminPolicy.isAdmin({ role: 'admin' })).toBe(true);
        expect(adminPolicy.isAdmin({ role: 'support' })).toBe(false);
    });
});
