// chat.js
document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // Connect to the socket server
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const messagesContainer = document.getElementById('messagesContainer');
    const conversationId = document.querySelector('[data-conversation-id]').dataset.conversationId;
    const onlineStatusDot = document.getElementById('onlineStatusDot');
    const activityStatus = document.getElementById('activityStatus');

    // Scroll to bottom on load
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Join the conversation room
    socket.emit('join_room', { conversationId: conversationId });

    // Handle incoming messages
    socket.on('receive_message', (data) => {
        if (data.conversationId == conversationId) {
            appendMessage(data);
            messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
            socket.emit('mark_read', { conversationId: conversationId });
        }
    });

    // Handle typing indicators
    let typingTimeout;
    input.addEventListener('input', () => {
        socket.emit('typing', { conversationId: conversationId });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('stop_typing', { conversationId: conversationId });
        }, 2000);
    });

    socket.on('typing', (data) => {
        if (data.conversationId == conversationId) {
            activityStatus.innerText = 'Typing...';
            activityStatus.classList.add('text-indigo-600', 'font-bold');
        }
    });

    socket.on('stop_typing', (data) => {
        if (data.conversationId == conversationId) {
            activityStatus.innerText = 'Online';
            activityStatus.classList.remove('text-indigo-600', 'font-bold');
        }
    });

    // Handle Online/Offline Status
    socket.on('user_status', (data) => {
        // Filter to only care about the other person in this conversation
        if (data.userId === window.otherUserId) {
            if (data.status === 'online') {
                onlineStatusDot.classList.remove('bg-gray-300');
                onlineStatusDot.classList.add('bg-green-500');
                activityStatus.innerText = 'Online';
            } else {
                onlineStatusDot.classList.remove('bg-green-500');
                onlineStatusDot.classList.add('bg-gray-300');
                activityStatus.innerText = 'Offline';
            }
        }
    });

    // Handle Read Status
    socket.on('message_read', (data) => {
        if (data.conversationId == conversationId && data.readerId !== window.userId) {
            // Update all my sent messages to "Read" status
            document.querySelectorAll('.msg-status').forEach(el => {
                el.innerText = 'Read';
                el.classList.add('text-indigo-400');
            });
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = input.value.trim();
        if (content) {
            const messageData = {
                conversationId: conversationId,
                content: content,
                timestamp: new Date().toISOString()
            };

            socket.emit('send_message', messageData);
            input.value = '';
            socket.emit('stop_typing', { conversationId: conversationId });
        }
    });

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function appendMessage(data) {
        const isMe = data.senderId === window.userId;
        const msgDiv = document.createElement('div');
        msgDiv.className = `mb-4 flex ${isMe ? 'justify-end' : 'justify-start'}`;
        
        msgDiv.innerHTML = `
            <div class="px-4 py-2 rounded-2xl max-w-[80%] break-words shadow-sm ${isMe ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 border border-gray-100'}">
                <p class="text-sm">${escapeHtml(data.content)}</p>
                <div class="flex items-center justify-between mt-1 gap-4">
                    <span class="text-[10px] opacity-70 block">
                        ${new Date(data.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    ${isMe ? `<span class="text-[10px] opacity-70 msg-status">Sent</span>` : ''}
                </div>
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    }

    // Mark as read on load
    socket.emit('mark_read', { conversationId: conversationId });

    // Handle Bot Toggle (Preserved from previous step)
    const botToggle = document.getElementById('botToggle');
    if (botToggle) {
        botToggle.addEventListener('change', async () => {
            const isEnabled = botToggle.checked;
            try {
                const response = await fetch(`/chat/conversations/${conversationId}/toggle-bot`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: isEnabled })
                });
                const result = await response.json();
                if (!result.success) {
                    botToggle.checked = !isEnabled;
                    alert('Failed to update bot settings');
                }
            } catch (e) {
                console.error('Bot toggle error:', e);
                botToggle.checked = !isEnabled;
                alert('An error occurred while updating bot settings');
            }
        });
    }
});
