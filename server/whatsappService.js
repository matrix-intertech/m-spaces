/**
 * MSG91 WhatsApp Integration Service
 */
const pool = require('./db');
const MSG91_WA_URL = 'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';

function buildProviderErrorMessage(data) {
    const raw = typeof data?.errors === 'string'
        ? data.errors
        : Array.isArray(data?.errors)
            ? data.errors.map((item) => item?.message || item?.error || String(item)).join(', ')
            : data?.message || 'WhatsApp delivery failed';

    if (/no subscription assigned to this number/i.test(raw)) {
        return 'WhatsApp OTP is temporarily unavailable because the configured MSG91 WhatsApp number is not subscribed for OTP delivery.';
    }

    return raw;
}

/**
 * Core function to send any WhatsApp Template
 * @param {string} to - The recipient's phone number
 * @param {string} templateName - The exact name of the MSG91 template
 * @param {Array} components - Array of component objects (body, button, etc.)
 * @param {string} language - The language code of the template (default 'en')
 */

function bodyComponent(...values) {
    if (!values || values.length === 0) return null;
    return {
        type: 'body',
        parameters: values.map((v, index) => {
            const isObj = typeof v === 'object' && v !== null;
            const valStr = String(isObj && 'value' in v ? v.value : (v || 'N/A')).substring(0, 1024);

            return {
                type: 'text',
                text: valStr
            };
        })
    };
}

function buttonComponent(index, subType, value) {
    if (value === undefined || value === null) return null;
    const valStr = String(value || 'N/A').substring(0, 1024);
    return {
        type: 'button',
        sub_type: subType,
        index: String(index),
        parameters: [{ type: 'text', text: valStr }]
    };
}

async function sendWhatsAppTemplate(to, templateName, components = [], language = 'en') {
    const authKey = process.env.MSG91_AUTH_KEY ? process.env.MSG91_AUTH_KEY.trim() : null;
    const integratedNumber = process.env.MSG91_WA_NUMBER ? process.env.MSG91_WA_NUMBER.trim() : null;

    if (!authKey) {
        console.warn('MSG91_AUTH_KEY is missing. WhatsApp message aborted.');
        const error = new Error('MSG91 WhatsApp integration is not configured.');
        error.code = 'WA_NOT_CONFIGURED';
        error.userMessage = 'WhatsApp OTP is not available right now. Please use password login or email OTP.';
        throw error;
    }

    if (!integratedNumber) {
        console.warn('MSG91_WA_NUMBER is missing. WhatsApp message aborted.');
        const error = new Error('MSG91 integrated WhatsApp number is missing.');
        error.code = 'WA_NUMBER_MISSING';
        error.userMessage = 'WhatsApp OTP is not available right now. Please use password login or email OTP.';
        throw error;
    }

    // Ensure number has country code (defaults to 91 for India if 10 digits)
    let mobile = to.toString().replace(/\D/g, '');
    if (mobile.length === 10) mobile = '91' + mobile;

    const validComponents = components.filter(Boolean);

    const payload = {
        "integrated_number": integratedNumber,
        "content_type": "template",
        "payload": {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": String(mobile),
            "type": "template",
            "template": {
                "name": templateName,
                "language": { "code": language, "policy": "deterministic" }
            }
        }
    };

    // Only attach components if we actually have variables to send
    if (validComponents.length > 0) {
        payload.payload.template.components = validComponents;
    }

    try {
        const response = await fetch(MSG91_WA_URL, {
            method: 'POST',
            headers: {
                'authkey': authKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        let data;
        try { data = JSON.parse(rawText); } catch (e) { data = { hasError: true, message: rawText }; }

        if (data.hasError || data.type === 'error' || data.status === 'fail') {
            console.error(`MSG91 WhatsApp Error for template [${templateName}]:`, data);
        }

        // Log response to the database asynchronously
        const dbStatus = (data.hasError || data.type === 'error' || data.status === 'fail') ? 'failed' : 'success';
        try {
            await pool.query('INSERT INTO whatsapp_logs (phone, template_name, status, response) VALUES ($1, $2, $3, $4)', [mobile, templateName, dbStatus, JSON.stringify(data)]);
        } catch (dbErr) {
            console.error('Failed to log WhatsApp message to DB:', dbErr.message);
        }

        return data;
    } catch (error) {
        console.error(`Fetch error sending WA Template [${templateName}]:`, error);
        throw error;
    }
}

module.exports = {
    sendWhatsAppTemplate,

    // 1. contact_updated_visit
    sendContactUpdatedVisit: (to, userName, date, time, agentName, agentPhone, mapUrl) =>
        sendWhatsAppTemplate(to, 'contact_updated_visit', [
            bodyComponent(
                { name: 'user_name', value: userName || 'User' },
                { name: 'date', value: date || 'N/A' },
                { name: 'time', value: time || 'N/A' },
                { name: 'agent_name', value: agentName || 'Agent' },
                { name: 'agent_phone', value: agentPhone || 'N/A' },
                { name: 'map_url', value: mapUrl || 'N/A' }
            )
        ], 'en'),

    // 2. otp_verification
    sendOtpVerification: (to, otpCode) =>
        sendWhatsAppTemplate(to, 'otp_verification', [
            bodyComponent(otpCode || '000000'),
            buttonComponent(0, 'url', otpCode || '000000')
        ], 'en_US').then((data) => {
            if (data?.hasError || data?.type === 'error' || data?.status === 'fail') {
                const error = new Error(buildProviderErrorMessage(data));
                error.code = 'WA_PROVIDER_ERROR';
                error.providerResponse = data;
                error.userMessage = /temporarily unavailable/i.test(error.message)
                    ? 'WhatsApp OTP is temporarily unavailable. Please use password login or email OTP for now.'
                    : 'Failed to send WhatsApp OTP. Please try again later or use another login method.';
                throw error;
            }

            return data;
        }),

    // 3. visit_notification
    sendVisitNotification: (to, userName, propertyName, locality, date, time, mapUrl) =>
        sendWhatsAppTemplate(to, 'visit_notification', [
            bodyComponent(
                { name: 'user_name', value: userName || 'User' },
                { name: 'property_name', value: propertyName || 'Property' },
                { name: 'locality', value: locality || 'N/A' },
                { name: 'date', value: date || 'N/A' },
                { name: 'time', value: time || 'N/A' },
                { name: 'map_url', value: mapUrl || 'N/A' }
            )
        ], 'en'),

    // 4. property_updates
    sendPropertyUpdates: (to, userName, locality) =>
        sendWhatsAppTemplate(to, 'property_updates', [
            bodyComponent(
                { name: 'user_name', value: userName || 'User' },
                { name: 'locality', value: locality || 'N/A' }
            )
        ], 'en'),

    // 5. updated_message_notification
    sendMessageNotification: (to, userName, propertyId) =>
        sendWhatsAppTemplate(to, 'updated_message_notification', [
            bodyComponent({ name: 'user_name', value: userName || 'User' }),
            propertyId ? buttonComponent(0, 'url', propertyId) : null
        ], 'en'),

    // 6. listing_update
    sendListingUpdate: (to, userName) =>
        sendWhatsAppTemplate(to, 'listing_update', [
            bodyComponent({ name: 'user_name', value: userName || 'User' })
        ], 'en'),

    // 7. property_status_update
    sendPropertyStatusUpdate: (to, name, location, status) =>
        sendWhatsAppTemplate(to, 'property_status_update', [
            bodyComponent(
                { name: 'name', value: name || 'User' },
                { name: 'location', value: location || 'N/A' },
                { name: 'status', value: status || 'Updated' }
            )
        ], 'en'),

    // 8. visit_request_approval
    sendVisitRequestApproval: (to, ownerName, renterName, propertyTitle, preferredTime, visitId) =>
        sendWhatsAppTemplate(to, 'visit_request_approval', [
            bodyComponent(
                { name: 'owner_name', value: ownerName || 'Owner' },
                { name: 'renter_name', value: renterName || 'A visitor' },
                { name: 'property_title', value: propertyTitle || 'your property' }
            ),
            buttonComponent(0, 'url', `visits/approve/${visitId || ''}`)
        ], 'en'),
        
    // 9. visit_approval_matrixspaces
    sendVisitApproval: (to, userName, propertyName, propertyShort, visitDate, visitTime, contactName, contactNumber, propertyAddress) =>
        sendWhatsAppTemplate(to, 'visit_approval_matrixspaces', [
            bodyComponent(
                userName || 'User',
                propertyName || 'Property',
                propertyShort || 'Property',
                visitDate || 'TBD',
                visitTime || 'TBD',
                contactName || 'Manager',
                contactNumber || 'N/A',
                propertyAddress || 'Address'
            )
        ], 'en'),

    // 10. visit_rejected_matrixspaces
    sendVisitRejection: (to, userName, propertyName) =>
        sendWhatsAppTemplate(to, 'visit_rejected_matrixspaces', [
            bodyComponent(userName || 'User', propertyName || 'Property')
        ], 'en'),

    // 11. account_login_details
    sendAccountCredentials: (to, name, username, email, password, loginUrl) =>
        sendWhatsAppTemplate(to, 'account_login_details', [
            bodyComponent(
                { name: 'name', value: name || 'User' },
                { name: 'username', value: username || 'N/A' },
                { name: 'email', value: email || 'N/A' },
                { name: 'password', value: password || 'N/A' },
                { name: 'login_url', value: loginUrl || 'N/A' }
            )
        ], 'en')
};
