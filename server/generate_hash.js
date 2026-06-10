const bcrypt = require('bcrypt');

const password = 'admin.matrix';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
        console.error(err);
        return;
    }
    console.log('---------------------------------------------------');
    console.log(`Password: ${password}`);
    console.log(`Generated Hash: ${hash}`);
    console.log('---------------------------------------------------');
    console.log('Run this SQL command in your database tool to update the admin password:');
    console.log(`UPDATE users SET password = '${hash}' WHERE role = 'admin';`);
    console.log('---------------------------------------------------');
});