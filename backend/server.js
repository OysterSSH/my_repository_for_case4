const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = 3000;

// 启用CORS
app.use(cors());
app.use(express.json());

// CPI配置
const CPI_CONFIG = {
    baseUrl: 'https://isuite-eu-prem-01.it-cpi026-rt.cfapps.eu10-002.hana.ondemand.com',
    clientId: 'sb-8fa18f5e-a0bc-4dfd-8d9e-0db94f224631!b517022|it-rt-isuite-eu-prem-01!b410603',
    clientSecret: '7e079c33-b35d-42bf-bc76-38cbbb038f78$KOEvWQ6c6kqNVkQs--tZPeYlPZHFKaSDXfVg184otL0='
};

// 生成Basic Auth token
const authToken = Buffer.from(`${CPI_CONFIG.clientId}:${CPI_CONFIG.clientSecret}`).toString('base64');

// 创建axios实例，配置忽略SSL证书验证
const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
    timeout: 60000 // 增加到60秒
});

// COGI数据接口
app.get('/api/cogi', async (req, res) => {
    console.log('📡 收到COGI数据请求');
    
    try {
        const response = await axiosInstance.get(
            `${CPI_CONFIG.baseUrl}/http/case4/FI_CG001`,
            {
                headers: {
                    'Authorization': `Basic ${authToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('📥 CPI响应状态:', response.status, response.statusText);
        console.log('✅ CPI返回数据条数:', response.data?.results?.length || response.data?.length || 'unknown');
        
        res.json(response.data);
    } catch (error) {
        console.error('💥 调用CPI失败:', error.message);
        if (error.response) {
            console.error('错误响应:', error.response.status, error.response.data);
            res.status(error.response.status).json({
                error: 'CPI request failed',
                status: error.response.status,
                message: error.response.data
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// 成本中心数据接口
app.get('/api/costcenter', async (req, res) => {
    console.log('📡 收到成本中心数据请求');
    
    try {
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

        console.log('📥 CPI响应状态:', response.status, response.statusText);
        console.log('✅ CPI返回数据');
        
        res.json(response.data);
    } catch (error) {
        console.error('💥 调用CPI失败:', error.message);
        if (error.response) {
            res.status(error.response.status).json({
                error: 'CPI request failed',
                status: error.response.status,
                message: error.response.data
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// 固定资产数据接口
app.get('/api/fixedasset', async (req, res) => {
    console.log('📡 收到固定资产数据请求');
    console.log('📝 查询参数:', req.query);
    
    try {
        // 构建查询参数
        const params = new URLSearchParams();
        
        // 如果前端传了参数，就使用前端的参数
        if (req.query.bukrs) params.append('bukrs', req.query.bukrs);
        if (req.query.gjahr) params.append('gjahr', req.query.gjahr);
        if (req.query.peraf) params.append('peraf', req.query.peraf);
        
        const queryString = params.toString();
        const url = queryString 
            ? `${CPI_CONFIG.baseUrl}/http/case4/FI_SAA001?${queryString}`
            : `${CPI_CONFIG.baseUrl}/http/case4/FI_SAA001`;
        
        console.log('🔗 请求URL:', url);
        
        const response = await axiosInstance.get(url, {
            headers: {
                'Authorization': `Basic ${authToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('📥 CPI响应状态:', response.status, response.statusText);
        console.log('✅ CPI返回数据');
        
        res.json(response.data);
    } catch (error) {
        console.error('💥 调用CPI失败:', error.message);
        if (error.response) {
            res.status(error.response.status).json({
                error: 'CPI request failed',
                status: error.response.status,
                message: error.response.data
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// 更新成本中心数据的接口
app.post('/api/update-costcenter', async (req, res) => {
    console.log('📡 收到更新成本中心数据请求');
    
    try {
        const updateScript = require('./updateCostCenterData');
        
        // 获取CPI数据
        const cpiData = await updateScript.fetchCostCenterData();
        
        if (cpiData.length === 0) {
            return res.status(404).json({
                success: false,
                message: '没有找到符合条件的数据'
            });
        }
        
        // 处理数据
        const processedData = updateScript.processCPIData(cpiData);
        
        // 更新文件
        updateScript.updateJSONFile(processedData);
        
        res.json({
            success: true,
            message: '成本中心数据更新成功',
            recordCount: processedData.length,
            data: processedData
        });
        
    } catch (error) {
        console.error('💥 更新成本中心数据失败:', error.message);
        res.status(500).json({
            success: false,
            error: 'Update failed',
            message: error.message
        });
    }
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend server is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 后端服务器已启动在 http://localhost:${PORT}`);
    console.log('📡 可用接口:');
    console.log(`  - GET http://localhost:${PORT}/api/cogi - COGI数据`);
    console.log(`  - GET http://localhost:${PORT}/api/costcenter - 成本中心数据`);
    console.log(`  - GET http://localhost:${PORT}/api/fixedasset - 固定资产数据`);
    console.log(`  - POST http://localhost:${PORT}/api/update-costcenter - 更新成本中心数据到JSON`);
});
