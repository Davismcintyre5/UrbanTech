const botProtection = (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    
    // Block known malicious bots/scanners
    const badBots = /curl|wget|python-requests|nmap|nikto|sqlmap|masscan|zgrab|dirbuster|gobuster/i;
    
    if (badBots.test(userAgent)) {
        console.warn(`🚫 Blocked malicious bot: ${userAgent} from ${req.ip}`);
        return res.status(403).json({ error: 'Access denied' });
    }

    // Optional: Block completely empty user agents (often automated scripts)
    if (userAgent.trim() === '') {
        console.warn(`🚫 Blocked empty User-Agent from ${req.ip}`);
        return res.status(403).json({ error: 'Access denied' });
    }

    next();
};

module.exports = botProtection;