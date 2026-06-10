/**
 * Standardized API response formatter (JSend format)
 */
exports.success = (res, data, statusCode = 200) => {
    return res.status(statusCode).json({
        status: 'success',
        data: data
    });
};

exports.error = (res, message, code = 'INTERNAL_ERROR', statusCode = 500) => {
    if (statusCode >= 500) {
        console.error(`[${code}] ${message}`);
    }
    
    return res.status(statusCode).json({
        status: 'error',
        code: code,
        message: message
    });
};