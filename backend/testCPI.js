const axios = require('axios');
const https = require('https');

const CPI_CONFIG = {
    baseUrl: 'https://isuite-eu-prem-01.it-cpi026-rt.cfapps.eu10-002.hana.ondemand.com',
    clientId: 'sb-8fa18f5e-a0bc-4dfd-8d9e-0db94f224631!b517022|it-rt-isuite-eu-prem-01!b410603',
    clientSecret: '7e079c33-b35d-42bf-bc76-38cbbb038f78$KOEvWQ6c6kqNVkQs--tZPeYlPZHFKaSDXfVg184otL0='
};

const authToken = Buffer.from(`${CPI_CONFIG.clientId}:${CPI_CONFIG.clientSecret}`).toString('base64');

const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
    timeout: 60000
});

async function test() {
    try {
        console.log('正在获取CPI数据...');
        const response = await axiosInstance.get(
            `${CPI_CONFIG.baseUrl}/http/case4/FI_CC001`,
            {
                headers: {
                    'Authorization': `Basic ${authToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('\n=== CPI响应 ===');
        console.log('状态:', response.status);
        console.log('\n数据结构:');
        
        const data = response.data;
        const results = data?.d?.results || data?.results || data;
        
        if (Array.isArray(results) && results.length > 0) {
            console.log(`\n共 ${results.length} 条数据`);
            console.log('\n第一条数据的字段:');
            console.log(JSON.stringify(results[0], null, 2));
            
            console.log('\n第二条数据:');
            if (results[1]) {
                console.log(JSON.stringify(results[1], null, 2));
            }
            
            console.log('\n第三条数据:');
            if (results[2]) {
                console.log(JSON.stringify(results[2], null, 2));
            }
        } else {
            console.log('数据:', JSON.stringify(data, null, 2).substring(0, 1000));
        }
        
    } catch (error) {
        console.error('错误:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
    }
}

test();
