const bcrypt = require('bcrypt');
const { getUserPermissions } = require('../permission-utils');
const { validatePassword, addToPasswordHistory, generateUniqueUsername } = require('../utils');
const repository = require('../repositories/corporate-workflow-repository');

function getCorporateOwnerId(user) {
    return user.role === 'corporate' ? user.id : user.parent_id;
}

async function getCorporateDashboardData(user) {
    const permissions = await getUserPermissions(user.id);
    let isApproved = user.is_domain_approved;

    if (user.role === 'corporate_user' && !isApproved) {
        const parentApproval = await repository.getParentApproval(user.parent_id);
        if (parentApproval) isApproved = parentApproval.is_domain_approved;
    }

    let subordinates = [];
    if (user.role === 'corporate') {
        subordinates = await repository.getSubordinates(user.id);
    }

    const corpId = getCorporateOwnerId(user);
    let companyName = user.agency_name;
    let companyType = user.corporate_type;
    let companyLogo = user.company_logo;

    if (user.role === 'corporate_user') {
        const branding = await repository.getCorporateBranding(user.parent_id);
        if (branding) {
            companyName = branding.agency_name || companyName;
            companyType = branding.corporate_type || companyType;
            companyLogo = branding.company_logo || companyLogo;
        }
    }

    const [assignedRM, requirements, visits, teamShortlist] = await Promise.all([
        repository.getCorporateManager(corpId),
        repository.getCorporateRequirements(corpId),
        repository.getCorporateVisits(user.id),
        repository.getTeamShortlist(corpId)
    ]);

    let requirementSuggestions = [];
    try {
        requirementSuggestions = await repository.getRequirementSuggestions(corpId);
    } catch (_) {
        requirementSuggestions = [];
    }

    return {
        user,
        permissions,
        isApproved,
        subordinates,
        visits,
        assignedRM,
        requirements,
        requirementSuggestions,
        teamShortlist,
        companyName,
        companyType,
        companyLogo
    };
}

async function addSubordinate(user, body) {
    const passwordError = validatePassword(body.password);
    if (passwordError) {
        return { ok: false, code: 'PASSWORD', message: passwordError };
    }

    if (user.email.split('@')[1] !== body.email.split('@')[1]) {
        return { ok: false, code: 'DOMAIN', message: 'Email domain mismatch' };
    }

    const hash = await bcrypt.hash(body.password, 10);
    const uniqueUsername = await generateUniqueUsername(body.name);
    const created = await repository.createCorporateUser({
        name: body.name,
        username: uniqueUsername,
        email: body.email,
        passwordHash: hash,
        phone: body.phone,
        parentId: user.id
    });

    if (created) {
        await addToPasswordHistory(created.id, hash);
    }

    return { ok: true };
}

async function addRequirement(user, body) {
    await repository.createCorporateRequirement({
        corporateId: getCorporateOwnerId(user),
        cities: body.cities,
        locality: body.locality || null,
        propertyType: body.property_type,
        minSize: body.min_size,
        budget: body.budget,
        description: body.description || null
    });

    return { ok: true };
}

async function addSharedRequirement(user, body) {
    await repository.createSharedRequirement({
        corporateId: getCorporateOwnerId(user),
        cities: body.cities,
        locality: body.locality || null,
        propertyType: body.property_type,
        requirementType: body.requirement_type || 'Buy',
        description: body.description || '',
        minSize: body.min_size,
        budget: body.budget
    });

    return { ok: true };
}

async function deleteUserRequirement(user, requirementId) {
    await repository.deleteUserRequirement({
        requirementId,
        userId: user.id
    });

    return { ok: true };
}

async function updateProfile(user, body, logoPath) {
    await repository.updateCorporateProfile({
        userId: user.id,
        agencyName: body.agency_name,
        corporateType: body.corporate_type,
        companyLogo: logoPath
    });

    return {
        ok: true,
        sessionUpdates: {
            agency_name: body.agency_name,
            corporate_type: body.corporate_type,
            company_logo: logoPath
        }
    };
}

module.exports = {
    getCorporateDashboardData,
    addSubordinate,
    addRequirement,
    addSharedRequirement,
    deleteUserRequirement,
    updateProfile
};
