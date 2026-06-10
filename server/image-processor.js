/**
 * image-processor.js
 *
 * Non-blocking image processing utility that offloads sharp operations
 * to a pool of worker threads. This prevents the main event loop from
 * being blocked when multiple users upload images simultaneously.
 *
 * Usage:
 *   const { compressImage, compressImages } = require('./image-processor');
 *
 *   // Single image (e.g. avatar)
 *   await compressImage(filePath, { resize: { width: 400, height: 400, fit: 'cover' }, formatOptions: { quality: 90 } });
 *
 *   // Multiple images in parallel (e.g. property photos)
 *   await compressImages(files, { resize: { width: 1920, withoutEnlargement: true }, formatOptions: { quality: 80, progressive: true } });
 */
'use strict';

const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

const WORKER_SCRIPT = path.join(__dirname, 'image-worker.js');

// Pool size: use half the CPU cores (minimum 2) to leave headroom for the event loop
const POOL_SIZE = Math.max(2, Math.floor(os.cpus().length / 2));

// --- Worker Pool ---
const workerPool = [];
const taskQueue = [];

/**
 * Create a fresh worker and add it to the pool.
 */
function createWorker() {
    const worker = new Worker(WORKER_SCRIPT);

    const workerWrapper = {
        worker,
        busy: false,
    };

    worker.on('error', (err) => {
        console.error('[ImageProcessor] Worker error:', err.message);
        // Replace the crashed worker
        const idx = workerPool.indexOf(workerWrapper);
        if (idx !== -1) workerPool.splice(idx, 1);
        workerPool.push(createWorker());
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.warn(`[ImageProcessor] Worker exited with code ${code}, replacing in 5 seconds...`);
            const idx = workerPool.indexOf(workerWrapper);
            if (idx !== -1) workerPool.splice(idx, 1);
            setTimeout(() => {
                workerPool.push(createWorker());
            }, 5000); // Wait 5 seconds before replacing to prevent CPU-burning crash loops
        }
    });

    return workerWrapper;
}

// Initialize the pool
for (let i = 0; i < POOL_SIZE; i++) {
    workerPool.push(createWorker());
}

/**
 * Run a single compression task on the next available worker.
 * Returns a Promise that resolves when the worker finishes.
 */
function runTask(task) {
    return new Promise((resolve, reject) => {
        const available = workerPool.find(w => !w.busy);

        const execute = (workerWrapper) => {
            workerWrapper.busy = true;

            const onMessage = (result) => {
                workerWrapper.worker.removeListener('message', onMessage);
                workerWrapper.busy = false;

                // Process next queued task if any
                if (taskQueue.length > 0) {
                    const next = taskQueue.shift();
                    execute(workerWrapper); // reuse this worker
                    // Actually we need to send the next task — let's restructure:
                }

                if (result.success) {
                    resolve();
                } else {
                    reject(new Error(result.error));
                }
            };

            workerWrapper.worker.on('message', onMessage);
            workerWrapper.worker.postMessage(task);
        };

        if (available) {
            execute(available);
        } else {
            // All workers busy — queue the task
            taskQueue.push({ task, resolve, reject });
        }
    });
}

/**
 * Drain queued tasks when a worker becomes free.
 * (Wired into the pool automatically.)
 */
function drainQueue() {
    while (taskQueue.length > 0) {
        const available = workerPool.find(w => !w.busy);
        if (!available) break;

        const { task, resolve, reject } = taskQueue.shift();

        available.busy = true;

        const onMessage = (result) => {
            available.worker.removeListener('message', onMessage);
            available.busy = false;

            if (result.success) {
                resolve();
            } else {
                reject(new Error(result.error));
            }

            // Continue draining
            drainQueue();
        };

        available.worker.on('message', onMessage);
        available.worker.postMessage(task);
    }
}

/**
 * Compress a single image file in-place using a worker thread.
 *
 * @param {string} filePath - Absolute path to the image file.
 * @param {object} options  - Compression options.
 * @param {object} [options.resize]         - sharp resize options (e.g. { width: 1920, withoutEnlargement: true })
 * @param {string} [options.format]         - Output format: 'jpeg' (default) or 'webp'
 * @param {object} [options.formatOptions]  - Format-specific options (e.g. { quality: 80, progressive: true })
 * @returns {Promise<void>}
 */
async function compressImage(filePath, options = {}) {
    const fs = require('fs');
    const outputPath = filePath + '.compressed.tmp';

    try {
        await new Promise((resolve, reject) => {
            const available = workerPool.find(w => !w.busy);

            const task = {
                inputPath: filePath,
                outputPath: outputPath,
                options: {
                    resize: options.resize || null,
                    format: options.format || 'jpeg',
                    formatOptions: options.formatOptions || { quality: 80, progressive: true },
                },
            };

            const execute = (workerWrapper) => {
                workerWrapper.busy = true;

                const onMessage = (result) => {
                    workerWrapper.worker.removeListener('message', onMessage);
                    workerWrapper.busy = false;
                    drainQueue();

                    if (result.success) {
                        resolve();
                    } else {
                        reject(new Error(result.error));
                    }
                };

                workerWrapper.worker.on('message', onMessage);
                workerWrapper.worker.postMessage(task);
            };

            if (available) {
                execute(available);
            } else {
                taskQueue.push({ task, resolve, reject });
            }
        });

        // Replace original file with the compressed version
        await fs.promises.rename(outputPath, filePath);
    } catch (err) {
        // Clean up temp file on failure
        try { await require('fs').promises.unlink(outputPath); } catch (_) {}
        throw err;
    }
}

/**
 * Compress multiple image files in parallel using the worker pool.
 * All images are processed concurrently (up to POOL_SIZE at a time),
 * NOT sequentially — so 20 images don't take 20× as long.
 *
 * @param {Array<{path: string, filename: string}>} files - Array of multer file objects.
 * @param {object} options - Same options as compressImage().
 * @returns {Promise<Array<{filename: string, success: boolean, error?: string}>>}
 */
async function compressImages(files, options = {}) {
    const results = await Promise.allSettled(
        files.map(file =>
            compressImage(file.path, options)
                .then(() => ({ filename: file.filename, success: true }))
                .catch(err => ({ filename: file.filename, success: false, error: err.message }))
        )
    );

    return results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message });
}

/**
 * Gracefully shut down all workers.
 */
function shutdown() {
    for (const w of workerPool) {
        w.worker.terminate();
    }
}

module.exports = { compressImage, compressImages, shutdown };
