const axios = require("axios");

class AICoreService {
  constructor() {
    this.baseURL = process.env.AI_CORE_URL;
    this.clientId = process.env.AI_CORE_CLIENT_ID;
    this.clientSecret = process.env.AI_CORE_CLIENT_SECRET;
    this.authURL = process.env.AI_CORE_AUTH_URL;
    this.resourceGroup = process.env.AI_CORE_RESOURCE_GROUP;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        this.authURL,
        new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (error) {
      console.error("获取 AI Core Token 失败:", error.message);
      throw new Error(`AI Core 认证失败: ${error.message}`);
    }
  }

  async analyzeData(prompt) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.baseURL}/chat/completions?api-version=2023-05-15`,
        {
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          frequency_penalty: 0,
          presence_penalty: 0
        },
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "AI-Resource-Group": this.resourceGroup,
            "Content-Type": "application/json"
          },
          timeout: 120000
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error("AI Core 调用失败:", error.message);
      throw new Error(`AI Core 分析失败: ${error.message}`);
    }
  }

  /**
   * 构建成本中心差异分析 Prompt
   * @param {Array} cpiData - CPI 返回的成本中心数据（已清洗）
   * @param {string} currentMonth - 当前月份，格式：YYYY-MM (如 2025-10)
   */
  buildPrompt(cpiData, currentMonth) {
    // 提取必要字段并格式化为表格
    const tableData = this._formatDataTable(cpiData);
    
    const prompt = `You are required to assist in performing a Financial Month-End Cost Center Variance Analysis task. Please carefully review the following input data and processing steps, and output the analysis results according to the specified requirements.

<Current Month>
${currentMonth}
</Current Month>

<Cost Center Data Table>
${tableData}
</Cost Center Data Table>

Please perform the analysis according to the following steps:

Step 1: Calculate the Current Month Amount
- Filter all line items from the cost center data table where Posting Date (Month) (BUDAT) equals the <Current Month>
- Group by "Cost Center (KOSTL)" and "Cost Element (HKONT)"
- Sum the "Controlling Area Currency Amount (KSL)" for each group to get the "Current Month Amount"

Step 2: Calculate the Historical Average Amount
- Filter all line items from the cost center data table where Posting Date (Month) (BUDAT) is before the <Current Month>
- Sort by date and count the number of valid months (denoted as x)
- Group by "Cost Center (KOSTL)" and "Cost Element (HKONT)"
- Sum the "Controlling Area Currency Amount (KSL)" for each group and divide by x to get the "Historical Average Amount"

Step 3: Calculate Variance and Filter Results
- For records with the same Cost Center (KOSTL) and Cost Element (HKONT), calculate:
  - Variance Amount = Current Month Amount − Historical Average Amount of the Past x Months
  - Variance Ratio = Variance Amount / Historical Average Amount of the Past x Months (rounded to two decimal places)
- Filter and retain records where the Variance Ratio is greater than or equal to 20% or less than or equal to −20%

Output Requirements:
- Output only the records that meet the filtering criteria
-The output must be a JSON array, where each object contains the following fields in English:
  - cost_center
  - cost_element
  - current_month_amount
  - historical_average_amount
  - variance_amount
  - variance_ratio (expressed as a decimal, e.g., 0.25 represents 25%)

Please wrap the final output within <result> tags. The output must be strictly valid JSON format.`;

    return prompt;
  }

  /**
   * 提取关键字段并格式化为表格字符串
   * @param {Array} data - 完整的成本中心数据
   * @returns {string} 格式化的表格字符串
   */
  _formatDataTable(data) {
    // 提取关键字段并转换日期格式为 YYYY-MM
    const essentialData = data.map(item => ({
      BUKRS: item.bukrs,
      KOSTL: item.kostl,
      BUDAT: item.budat ? item.budat.substring(0, 7) : '', // 转为 YYYY-MM
      HKONT: item.hkont,
      KSL: item.ksl
    }));

    // 转为 CSV 格式字符串（节省 token）
    const header = 'BUKRS,KOSTL,BUDAT,HKONT,KSL';
    const rows = essentialData.map(row => 
      `${row.BUKRS},${row.KOSTL},${row.BUDAT},${row.HKONT},${row.KSL}`
    );

    return header + '\n' + rows.join('\n');
  }

  /**
   * 解析 AI Core 返回的结果
   * @param {string} aiResponse - AI 返回的原始文本
   * @returns {Array} 解析后的 JSON 数组
   */
  parseAIResponse(aiResponse) {
    try {
      // 提取 <result> 标签中的内容
      const resultMatch = aiResponse.match(/<result>([\s\S]*?)<\/result>/);
      if (!resultMatch) {
        console.warn("未找到 <result> 标签，尝试直接解析");
        // 尝试查找 JSON 数组
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("无法从响应中提取结果");
      }

      const resultContent = resultMatch[1].trim();
      
      // 移除可能的 markdown 代码块标记
      const cleanContent = resultContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      return JSON.parse(cleanContent);
    } catch (error) {
      console.error("解析 AI 响应失败:", error.message);
      console.error("原始响应:", aiResponse);
      throw new Error(`解析 AI 响应失败: ${error.message}`);
    }
  }

  /**
   * 估算 Token 数量（粗略估算：1 token ≈ 4 字符）
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }
}

module.exports = new AICoreService();