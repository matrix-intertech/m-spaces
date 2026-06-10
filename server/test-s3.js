require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

if (process.env.AWS_S3_BUCKET_NAME) process.env.AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME.replace(/[^a-zA-Z0-9-.]/g, '');
if (process.env.AWS_REGION) process.env.AWS_REGION = process.env.AWS_REGION.replace(/[^a-zA-Z0-9-]/g, '');

async function checkS3() {
    const testUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/new_assets/logo.png`;
    console.log("---------------------------------------------------");
    console.log(`Pinging S3: ${testUrl}`);
    console.log("---------------------------------------------------");
    
    try {
        const response = await fetch(testUrl);
        const text = await response.text();
        
        console.log(`HTTP Status: ${response.status} ${response.status === 200 ? '✅ SUCCESS' : '❌ FAILED'}\n`);
        console.log("AWS Response XML:");
        console.log(text);
        
        if (response.status === 403) {
            console.log("\n🕵️‍♂️ DIAGNOSIS: ACCESS DENIED (403)");
            console.log("AWS is blocking the public. You must uncheck 'Block all public access' AND save the Bucket Policy in the AWS Console.");
        } else if (response.status === 404) {
            console.log("\n🕵️‍♂️ DIAGNOSIS: NOT FOUND (404)");
            console.log("The bucket is public, but 'logo.png' is missing. Run the upload-assets.js script again!");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
checkS3();