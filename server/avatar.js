const { createAvatar } = require('@dicebear/core');
const { funEmoji } = require('@dicebear/collection');
const fs = require('fs');
const path = require('path');

const generateAvatar = async (userId) => {
    const avatar = createAvatar(funEmoji, {
        seed: userId.toString(),
    });

    const avatarSvg = await avatar.toSvg();
    const avatarDir = path.join(__dirname, 'public', 'avatars');

    if (!fs.existsSync(avatarDir)) {
        fs.mkdirSync(avatarDir, { recursive: true });
    }

    const avatarPath = path.join(avatarDir, `${userId}.svg`);
    fs.writeFileSync(avatarPath, avatarSvg);

    return `/avatars/${userId}.svg`;
};

module.exports = { generateAvatar };
