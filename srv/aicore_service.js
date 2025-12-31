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
    
    const prompt = `你需要协助完成财务月结成本中心差异分析任务。请仔细阅读以下输入数据和操作步骤，输出符合要求的分析结果。

<当前月份>
${currentMonth}
</当前月份>

<成本中心数据表>
${tableData}
</成本中心数据表>

请按照以下步骤进行操作：

步骤1：计算当前月份金额
- 从成本中心数据表中筛选出"过账日期（月份）(BUDAT)"等于<当前月份>的所有行项目
- 按"成本中心（KOSTL）"和"成本要素（HKONT）"分组
- 对每组的"控制范围货币金额（KSL）"求和，得到"当前月份金额"

步骤2：计算过去月份平均金额
- 从成本中心数据表中筛选出"过账日期（月份）"在<当前月份>之前的所有行项目
- 按时间排序并统计有效月份数（记为x）
- 按"成本中心（KOSTL）"和"成本要素（HKONT）"分组
- 对每组的"控制范围货币金额（KSL）"求和后除以x，得到"过去x个月平均金额"

步骤3：计算差异并筛选
- 对相同"成本中心（KOSTL）"和"成本要素（HKONT）"的记录，计算：
  - 差异金额 = 当前月份金额 - 过去x个月平均金额
  - 差异占比 = 差异金额 / 过去x个月平均金额（保留两位小数）
- 筛选出差异占比>=20%或<=-20%的记录

输出要求：
- 仅输出符合条件的记录
- 格式为JSON数组，每个对象包含以下英文字段：
  - cost_center (成本中心)
  - cost_element (成本要素)
  - current_month_amount (当前月份金额)
  - historical_average_amount (过去x个月平均金额)
  - variance_amount (差异金额)
  - variance_ratio (差异占比，以小数形式表示，如0.25表示25%)

请将最终结果用<result>标签包裹，结果必须是严格的JSON格式。`;

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