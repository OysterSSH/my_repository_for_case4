const axios = require("axios");

class CPIService {
  constructor() {
    this.baseURL = process.env.CPI_URL;
    this.username = process.env.CPI_AUTH_ID;
    this.password = process.env.CPI_AUTH_PASSWORD;
  }

  /**
   * 调用 CPI 获取成本中心数据
   * @returns {Promise<Array>} 成本中心数据数组
   */
  async getCostCenterData() {
    try {
      console.log(`开始调用 CPI: bukrs=${this.baseURL}`);
      
      const response = await axios.get(this.baseURL, {
        auth: {
          username: this.username,
          password: this.password
        },
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        timeout: 120000
      });


      // 解析 OData 格式返回值
      if (response.data && response.data.d && response.data.d.results) {
        const results = response.data.d.results;
        console.log(`CPI 返回数据条数: ${results.length}`);
        
        // 清洗数据：移除 __metadata 字段，转换日期格式
        const cleanedResults = results.map(item => ({
          bukrs: item.bukrs,           // 公司代码
          kostl: item.kostl,           // 成本中心
          budat: this._formatODataDate(item.budat),  // 过账日期
          belnr: item.belnr,           // 凭证编号
          hkont: item.hkont,           // 成本要素
          ksl: parseFloat(item.ksl),   // 控制范围货币金额
          rkcur: item.rkcur,           // 控制范围货币
          megbtr: parseFloat(item.megbtr), // 数量
          runit: item.runit            // 单位
        }));

        return cleanedResults;
      } else {
        console.warn("CPI 返回数据格式异常，无 d.results 字段");
        return [];
      }

    } catch (error) {
      console.error("CPI 调用失败:", error.message);
      if (error.response) {
        console.error("CPI 响应状态:", error.response.status);
        console.error("CPI 响应数据:", JSON.stringify(error.response.data, null, 2));
      }
      throw new Error(`CPI 调用失败: ${error.message}`);
    }
  }

    /**
   * 提取用于 AI 分析的关键字段
   * @param {Array} data - 完整数据
   * @returns {Array} 仅包含 BUKRS, KOSTL, BUDAT, HKONT, KSL 的数据
   */
  extractEssentialFields(data) {
    return data.map(item => ({
      bukrs: item.bukrs,
      kostl: item.kostl,
      budat: item.budat,
      hkont: item.hkont,
      ksl: item.ksl
    }));
  }

  /**
   * 转换 OData 日期格式 /Date(1764547200000)/ 为可读格式
   */
  _formatODataDate(odataDate) {
    if (!odataDate || typeof odataDate !== 'string') return odataDate;
    
    const match = odataDate.match(/\/Date\((\d+)\)\//);
    if (match) {
      const timestamp = parseInt(match[1]);
      const date = new Date(timestamp);
      return date.toISOString().split('T')[0]; // 返回 YYYY-MM-DD
    }
    return odataDate;
  }

  /**
   * 获取数据统计摘要
   */
  getDataSummary(data) {
    if (!data || data.length === 0) {
      return { totalAmount: 0, recordCount: 0, costCenters: [], dateRange: null };
    }

    const totalAmount = data.reduce((sum, item) => sum + (item.ksl || 0), 0);
    const costCenters = [...new Set(data.map(item => item.kostl))];
    const dates = data.map(item => item.budat).filter(d => d).sort();

    return {
      totalAmount: totalAmount.toFixed(2),
      recordCount: data.length,
      costCenters: costCenters,
      dateRange: dates.length > 0 ? `${dates[0]} 至 ${dates[dates.length - 1]}` : null,
      currency: data[0]?.rkcur || 'CNY'
    };
  }
}

module.exports = new CPIService();