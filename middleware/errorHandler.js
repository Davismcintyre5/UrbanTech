const errorHandler = (err, req, res, next) => {
    console.error('💥 Unhandled Error:', err.stack || err.message);

    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    res.status(statusCode).json({
        error: 'Internal Server Error',
        // Only send stack trace in development
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong.'
    });
};

module.exports = errorHandler;