const { sendFavoriteNotificationEmail, sendVisitConfirmationEmail, sendAgentTemplateEmail, sendStatusUpdateEmail, sendWishlistUpdateEmail, sendVisitRejectionEmail, sendContactUpdatedVisitEmail, sendAccountCredentialsEmail } = require('./emailService');

// MOCK QUEUE FOR LOCAL DEVELOPMENT WITHOUT REDIS
// This replaces BullMQ and IORedis to process emails directly in the background 
// without needing a separate Redis server running on Windows.

const emailQueue = {
    add: async (name, data) => {
        console.log(`[Local Queue] Received job: ${name}. Processing in background...`);
        
        // Process asynchronously without blocking the main web request thread
        setImmediate(async () => {
            try {
                if (name === 'favoriteEmail') {
                    await sendFavoriteNotificationEmail(data.email, data.propertyTitle);
                } else if (name === 'visitEmail') {
                    await sendVisitConfirmationEmail(data.email, data.role, data.visitDetails);
                } else if (name === 'agentEmail') {
                    await sendAgentTemplateEmail(data.recipientEmail, data.templateType, data.templateData);
                } else if (name === 'statusUpdateEmail') {
                    await sendStatusUpdateEmail(data.email, data.propertyTitle, data.status);
                } else if (name === 'wishlistUpdateEmail') {
                    await sendWishlistUpdateEmail(data.email, data.username, data.propertyTitle, data.status, data.propertyId, data.host);
                } else if (name === 'visitRejectionEmail') {
                    await sendVisitRejectionEmail(data.email, data.renterName, data.propertyTitle);
                } else if (name === 'contactUpdatedVisitEmail') {
                    await sendContactUpdatedVisitEmail(data.email, data.visitDetails);
                } else if (name === 'accountCredentialsEmail') {
                    await sendAccountCredentialsEmail(data.email, data.name, data.username, data.password, data.loginUrl);
                }
                console.log(`[Local Queue] Job ${name} completed successfully.`);
            } catch (err) {
                console.error(`[Local Queue] Job ${name} failed:`, err);
            }
        });
        
        // Return a mock job object
        return { id: Math.random().toString(36).substr(2, 9), name, data };
    }
};

// Mock worker object to prevent errors if other files try to listen to its events
const emailWorker = {
    on: (event, callback) => {}, // Stub
    close: async () => {} // Prevent crash during server shutdown
};

module.exports = { emailQueue, emailWorker };