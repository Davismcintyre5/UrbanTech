const axios = require('axios');

const startKeepAlive = () => {
    if (process.env.KEEP_ALIVE_ENABLED !== 'true') {
        console.log('💤 Keep-Alive is disabled.');
        return;
    }

    const url = `${process.env.API_URL}/health`;
    console.log(`⏱️ Keep-Alive scheduled: Will ping ${url} every 10 minutes.`);

    // Wait 60 seconds before the first ping to let the server fully boot
    setTimeout(() => {
        const ping = async () => {
            try {
                const res = await axios.get(url);
                console.log(`📡 Keep-Alive Ping: ${res.status} OK`);
            } catch (error) {
                console.error(`⚠️ Keep-Alive Ping Failed: ${error.message}`);
            }
        };

        ping(); // First ping
        setInterval(ping, 10 * 60 * 1000); // Every 10 minutes
    }, 60 * 1000); // 60 seconds initial delay
};

module.exports = startKeepAlive;