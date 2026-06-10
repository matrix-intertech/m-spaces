const pool = require('./db');

let io;

const notificationService = {
    /**
     * Initializes the service with the Socket.IO instance.
     * @param {object} socketIoInstance - The main Socket.IO server instance.
     */
    initialize(socketIoInstance) {
        io = socketIoInstance;
        console.log('[Notification Service] Initialized.');
    },

    /**
     * Sends a notification to a specific user.
     * @param {number} userId - The ID of the user to notify.
     * @param {string} content - The notification message.
     * @param {string} link - The link for the notification.
     */
    async sendNotification(userId, content, link) {
        if (!io) {
            console.error('[Notification Service] Error: Service not initialized. Call initialize(io) first.');
            return;
        }
        try {
            // 1. Save notification to the database
            const newNotif = await pool.query(
                'INSERT INTO notifications (user_id, content, link) VALUES ($1, $2, $3) RETURNING *',
                [userId, content, link]
            );

            // 2. Emit a real-time event to the user's private room
            io.to(`user_${userId}`).emit('new_notification', newNotif.rows[0]);

            // 3. Update the unread count for that user
            await this.updateUnreadCount(userId);

        } catch (err) {
            console.error('[Notification Service] Error sending notification:', err);
        }
    },

    /**
     * Calculates and emits the total unread notification count for a user.
     * @param {number} userId - The ID of the user.
     */
    async updateUnreadCount(userId) {
        if (!io) {
            console.error('[Notification Service] Error: Service not initialized.');
            return;
        }
        try {
            const totalRes = await pool.query(
                "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE",
                [userId]
            );
            const totalUnreadCount = parseInt(totalRes.rows[0].count, 10) || 0;

            // Emit the updated count to the specific user's room
            io.to(`user_${userId}`).emit('update_unread_count', {
                total: totalUnreadCount
            });
        } catch (err) {
            console.error('[Notification Service] Error updating unread count:', err);
        }
    }
};

module.exports = notificationService;