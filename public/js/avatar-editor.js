document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const saveBtn = document.getElementById('save-btn');
    const avatarPreview = document.getElementById('avatar-preview').querySelector('img');

    let currentAvatarId = null;

    const generateAvatar = async () => {
        try {
            const response = await fetch('/avatar/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to generate avatar');
            }

            const data = await response.json();
            const svg_data = 'data:image/svg+xml;base64,' + btoa(data.svg);
            avatarPreview.src = svg_data;
            currentAvatarId = data.randomString;

        } catch (error) {
            console.error('Error generating avatar:', error);
            alert('Error generating avatar. Please try again.');
        }
    };

    const saveAvatar = async () => {
        if (!currentAvatarId) {
            alert('Please generate an avatar first.');
            return;
        }

        try {
            const response = await fetch('/avatar/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ avatarId: currentAvatarId }),
            });

            if (!response.ok) {
                throw new Error('Failed to save avatar');
            }

            alert('Avatar saved successfully!');

        } catch (error) {
            console.error('Error saving avatar:', error);
            alert('Error saving avatar. Please try again.');
        }
    };

    generateBtn.addEventListener('click', generateAvatar);
    saveBtn.addEventListener('click', saveAvatar);

    // Generate a random avatar on page load
    generateAvatar();
});
