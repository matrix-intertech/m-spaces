require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const FRONTEND_PATH = process.env.FRONTEND_PATH ? path.resolve(process.env.FRONTEND_PATH) : path.join(__dirname, '../frontend');
const ASSETS_DIR = path.join(FRONTEND_PATH, 'public/assets');

if (!BUCKET_NAME || !process.env.AWS_REGION) {
    console.error('❌ Error: AWS_S3_BUCKET_NAME and AWS_REGION must be set in your .env file.');
    process.exit(1);
}

const s3Client = new S3Client({ region: process.env.AWS_REGION });

async function uploadDirectory(directory) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            await uploadDirectory(fullPath);
        } else {
            const fileStream = fs.createReadStream(fullPath);
            const targetS3Folder = 'new_assets';
            const bucketPath = targetS3Folder + '/' + path.relative(ASSETS_DIR, fullPath).replace(/\\/g, '/');
            
            const contentType = mime.lookup(fullPath) || 'application/octet-stream';

            console.log(`- Uploading: ${bucketPath} (${contentType})`);

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: bucketPath,
                Body: fileStream,
                ContentType: contentType
            });

            try {
                await s3Client.send(command);
            } catch (err) {
                console.error(`  ❌ FAILED to upload ${file}:`, err);
            }
        }
    }
}

async function main() {
    console.log(`\n🚀 Starting asset upload to S3 bucket: ${BUCKET_NAME}`);
    console.log('===================================================');
    
    if (!fs.existsSync(ASSETS_DIR)) {
        console.error(`❌ Assets directory not found at: ${ASSETS_DIR}`);
        return;
    }

    await uploadDirectory(ASSETS_DIR);

    console.log('===================================================');
    console.log('✅ Asset upload complete!');
}

main();