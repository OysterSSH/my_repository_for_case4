const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const cpiService = require("./cpi_service");
const aiCoreService = require("./aicore_service");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 原有的预检查接口
app.post("/api/ai-core/precheck", async (req, res) => {
  try {
    const { companyCode, plant, postingTime } = req.body;
    // TODO: 实现预检查逻辑
    res.json({ results: [] });
  } catch (err) {
    res.status(500).json({ message: "AI Core 调用失败", error: String(err) });
  }
});

// 新增：成本中心差异分析接口
app.post("/api/cost-center/analyze", async (req, res) => {
  try {
    const { currentMonth } = req.body; // 期望格式: "2025-10"
    
    // 如果没有传当前月份，使用当前日期
    const analysisMonth = currentMonth || new Date().toISOString().substring(0, 7);
    
    console.log(`[${new Date().toISOString()}] 开始成本中心差异分析: 目标月份=${analysisMonth}`);

    // 步骤1：调用 CPI 获取全量数据
    console.log(`[${new Date().toISOString()}] 调用 CPI 获取数据...`);
    const cpiData = await cpiService.getCostCenterData();

    if (!cpiData || cpiData.length === 0) {
      return res.json({
        success: true,
        cpiData: [],
        summary: null,
        aiAnalysis: null,
        varianceResults: [],
        message: "未查询到成本中心数据"
      });
    }

    console.log(`[${new Date().toISOString()}] CPI 数据获取成功，共 ${cpiData.length} 条记录`);

    // 步骤2：提取关键字段（减少 token）
    const essentialData = cpiService.extractEssentialFields(cpiData);

    // 步骤3：构建 Prompt
    const prompt = aiCoreService.buildPrompt(essentialData, analysisMonth);
    const estimatedTokens = aiCoreService.estimateTokens(prompt);
    console.log(`[${new Date().toISOString()}] Prompt 构建完成`);
    console.log(`  - Prompt 长度: ${prompt.length} 字符`);
    console.log(`  - 估算 Token 数: ${estimatedTokens}`);
    console.log(`  - 数据行数: ${essentialData.length}`);

    // Token 预警
    if (estimatedTokens > 50000) {
      console.warn(`警告: 估算 Token 数 (${estimatedTokens}) 较高，可能影响响应速度`);
    }

    // 步骤4：调用 AI Core 分析
    console.log(`[${new Date().toISOString()}] 调用 AI Core 进行差异分析...`);
    const aiRawResponse = await aiCoreService.analyzeData(prompt);
    console.log(`[${new Date().toISOString()}] AI Core 响应接收完成`);

    // 步骤5：解析 AI 返回结果
    let varianceResults = [];
    try {
      varianceResults = aiCoreService.parseAIResponse(aiRawResponse);
      console.log(`[${new Date().toISOString()}] 差异分析结果: ${varianceResults.length} 条异常记录`);
    } catch (parseError) {
      console.error("AI 响应解析失败:", parseError.message);
      // 返回原始响应供调试
      return res.json({
        success: false,
        message: "AI 响应解析失败",
        rawResponse: aiRawResponse,
        error: parseError.message
      });
    }

    // 步骤6：获取数据摘要
    const summary = cpiService.getDataSummary(cpiData);

    // 返回结果
    res.json({
      success: true,
      analysisMonth: analysisMonth,
      summary: summary,
      varianceResults: varianceResults,
      rawAIResponse: aiRawResponse, // 保留原始响应便于调试
      tokenEstimate: estimatedTokens
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] 成本中心分析失败:`, err);
    res.status(500).json({ 
      success: false,
      message: "成本中心分析失败", 
      error: String(err),
      details: err.response?.data || null
    });
  }
});

// 健康检查接口
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`[${new Date().toISOString()}] AI Core service listening on port ${port}`);
  console.log(`CPI URL: ${process.env.CPI_URL}`);
  console.log(`AI Core URL: ${process.env.AI_CORE_URL}`);
});