const logger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    
    // Using originalUrl ensures the full path is logged even if the router is mounted on a subpath
    const url = req.originalUrl || req.url; 
    
    console.log(`[${timestamp}] ${req.method} ${url}`);
    
    next();
};

module.exports = logger;