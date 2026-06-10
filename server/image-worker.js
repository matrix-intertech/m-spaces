/**
 * image-worker.js
 * 
 * Worker thread script for CPU-intensive image compression.
 * Runs sharp operations OFF the main event loop so that
 * chat, WebSocket, and API requests are never blocked.
 * 
 * Communication: receives { inputPath, outputPath, options } via parentPort,
 * sends back { success: true } or { success: false, error: '...' }.
 */
'use strict';

const { parentPort } = require('worker_threads');

let sharp;
try {
    sharp = require('sharp');
} catch (err) {
    console.error("[Image Worker] Failed to load 'sharp' library. Please run 'npm rebuild sharp' on your Ubuntu server.", err.message);
    process.exit(1);
}

parentPort.on('message', async (task) => {
    try {
        const { inputPath, outputPath, options } = task;

        let pipeline = sharp(inputPath);

        // Apply resize if specified
        if (options.resize) {
            pipeline = pipeline.resize(options.resize);
        }

        // Apply output format (default: JPEG)
        if (options.format === 'webp') {
            pipeline = pipeline.webp(options.formatOptions || { quality: 80 });
        } else {
            // Default to JPEG
            pipeline = pipeline.jpeg(options.formatOptions || { quality: 80, progressive: true });
        }

        await pipeline.toFile(outputPath);

        parentPort.postMessage({ success: true });
    } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
    }
});
