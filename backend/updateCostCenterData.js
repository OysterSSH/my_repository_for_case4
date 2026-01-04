const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

// CPI配置
const CPI_CONFIG = {
    baseUrl: 'https://isuite-eu-prem-01.it-cpi026-rt.cfapps.eu10-002.hana.ondemand.com',
    clientId: 'sb-8fa18f5e-a0bc-4dfd-8d9e-0db94f224631!b517022|it-rt-isuite-eu-prem-01!b410603',
    clientSecret: '7e079c33-b35d-42bf-bc76-38cbbb038f78$KOEvWQ6c6kqNVkQs--tZPeYlPZHFKaSDXfVg184otL0='
};

// 生成Basic Auth token
const authToken = Buffer.from(`${CPI_CONFIG.clientId}:${CPI_CONFIG.clientSecret}`).toString('base64');

// 创建axios实例
const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
    timeout: 60000
});

/**
 * 解析CPI日期格式 /Date(1759276800000)/ 转换为月份
 * @param {string} dateStr - CPI日期字符串
 * @returns {string} - 月份名称（如"Apr", "May"等）
 */
function parseCPIDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        return null;
    }
    
    // 提取时间戳
    const match = dateStr.match(/\/Date\((\d+)\)\//);
    if (!match) {
        return null;
    }
    
    const timestamp = parseInt(match[1]);
    const date = new Date(timestamp);
    
    // 获取月份（0-11）
    const month = date.getMonth();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return monthNames[month];
}

/**
 * 获取月份对应的字段名
 * @param {string} monthName - 月份名称
 * @returns {string} - 字段名（如"amountApr"）
 */
function getMonthFieldName(monthName) {
    const monthMap = {
        'Apr': 'amountApr',
        'May': 'amountMay',
        'Jun': 'amountJun',
        'Jul': 'amountJul',
        'Aug': 'amountAug',
        'Sep': 'amountSep',
        'Oct': 'amountOct'
    };
    return monthMap[monthName];
}

/**
 * 从CPI获取成本中心数据
 */
async function fetchCostCenterData() {
    console.log('📡 开始从CPI获取成本中心数据...');
    
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

        console.log('✅ CPI响应成功');
        
        // 解析数据
        const results = response.data?.d?.results || response.data?.results || response.data;
        
        if (!Array.isArray(results)) {
            throw new Error('CPI返回的数据格式不正确');
        }
        
        console.log(`📊 CPI返回 ${results.length} 条数据`);
        
        // 过滤出我们需要的成本中心
        const targetCostCenters = ['100030002', '100030005'];
        const filteredData = results.filter(item => {
            // 直接比较成本中心（不需要移除前缀）
            const costCenter = item.kostl || '';
            return targetCostCenters.includes(costCenter);
        });
        
        console.log(`✅ 过滤后剩余 ${filteredData.length} 条数据（成本中心: ${targetCostCenters.join(', ')}）`);
        
        if (filteredData.length > 0) {
            console.log('📋 过滤后数据示例（前2条）:');
            console.log(JSON.stringify(filteredData.slice(0, 2), null, 2));
        }
        
        return filteredData;
        
    } catch (error) {
        console.error('❌ 获取CPI数据失败:', error.message);
        throw error;
    }
}

/**
 * 处理CPI数据并按要求的格式组织
 */
function processCPIData(cpiData) {
    console.log('🔄 开始处理CPI数据...');
    
    // 用于存储按成本中心和成本要素分组的数据
    const dataMap = new Map();
    
    cpiData.forEach((item, index) => {
        // 提取成本中心（添加C前缀）
        const costCenter = 'C' + (item.kostl || '');
        // 提取成本要素
        const costElement = parseInt(item.hkont) || 0;
        // 提取金额（ksl字段）
        const amount = parseFloat(item.ksl) || 0;
        // 解析日期
        const monthName = parseCPIDate(item.budat);
        
        if (!monthName) {
            console.warn(`⚠️ 无法解析日期: ${item.budat}`);
            return;
        }
        
        // 获取月份字段名
        const monthField = getMonthFieldName(monthName);
        if (!monthField) {
            console.warn(`⚠️ 月份不在4-10月范围内: ${monthName}`);
            return;
        }
        
        // 创建唯一键
        const key = `${costCenter}-${costElement}`;
        
        if (!dataMap.has(key)) {
            dataMap.set(key, {
                costCenter: costCenter,
                costElement: costElement,
                amountOct: 0,
                amountSep: 0,
                amountAug: 0,
                amountJul: 0,
                amountJun: 0,
                amountMay: 0,
                amountApr: 0,
                createdAt: null,
                createdBy: null,
                modifiedAt: null,
                modifiedBy: null
            });
        }
        
        // 更新对应月份的金额
        const record = dataMap.get(key);
        record[monthField] = amount;
        
        // 打印前几条处理日志
        if (index < 5) {
            console.log(`  处理数据 ${index + 1}:`, {
                costCenter,
                costElement,
                monthName,
                monthField,
                amount
            });
        }
    });
    
    // 转换为数组
    const result = Array.from(dataMap.values());
    
    console.log(`✅ 处理完成，生成 ${result.length} 条记录`);
    
    return result;
}

/**
 * 更新JSON文件
 */
function updateJSONFile(data) {
    const jsonPath = path.join(__dirname, '../webapp/model/OtherCheckDetails.json');
    
    console.log(`💾 准备更新文件: ${jsonPath}`);
    
    try {
        // 写入文件
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
        console.log('✅ 文件更新成功！');
        console.log(`📊 更新了 ${data.length} 条记录`);
    } catch (error) {
        console.error('❌ 文件写入失败:', error.message);
        throw error;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('='.repeat(60));
    console.log('🚀 开始更新成本中心数据');
    console.log('='.repeat(60));
    
    try {
        // 1. 获取CPI数据
        const cpiData = await fetchCostCenterData();
        
        if (cpiData.length === 0) {
            console.warn('⚠️ 没有找到符合条件的数据');
            return;
        }
        
        // 打印前3条原始数据用于调试
        console.log('\n📋 CPI原始数据示例（前3条）:');
        console.log(JSON.stringify(cpiData.slice(0, 3), null, 2));
        
        // 2. 处理数据
        const processedData = processCPIData(cpiData);
        
        // 打印处理后的数据
        console.log('\n📋 处理后的数据示例（前3条）:');
        console.log(JSON.stringify(processedData.slice(0, 3), null, 2));
        
        // 3. 更新JSON文件
        updateJSONFile(processedData);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ 所有操作完成！');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ 操作失败:', error.message);
        console.error('='.repeat(60));
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = {
    fetchCostCenterData,
    processCPIData,
    updateJSONFile,
    parseCPIDate
};
