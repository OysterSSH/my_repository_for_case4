# 成本中心数据更新说明

## 概述
此脚本用于从SAP CPI获取成本中心数据，并更新到前端的JSON文件中。

## 功能特点

### 1. 数据来源
- **CPI接口**: `https://isuite-eu-prem-01.it-cpi026-rt.cfapps.eu10-002.hana.ondemand.com/http/case4/FI_CC001`
- **筛选条件**: 只获取成本中心为 `100030002` 和 `100030005` 的数据

### 2. 数据映射

#### CPI字段映射：
- `kostl` (成本中心) → `costCenter` (添加前缀"C")
- `hkont` (成本要素) → `costElement`
- `ksl` (金额) → 按月份映射到对应字段
- `budat` (日期) → 解析后映射到相应月份

#### 日期转换：
CPI使用特殊的日期格式：`/Date(1759276800000)/`
- 这是Unix时间戳格式（毫秒）
- 脚本会自动解析并转换为月份名称
- 支持的月份范围：4月(Apr)到10月(Oct)

#### 月份字段映射：
- Apr → `amountApr`
- May → `amountMay`
- Jun → `amountJun`
- Jul → `amountJul`
- Aug → `amountAug`
- Sep → `amountSep`
- Oct → `amountOct`

### 3. 输出格式

更新后的 `OtherCheckDetails.json` 文件结构：
```json
[
  {
    "costCenter": "C100030002",
    "costElement": 6600420000,
    "amountOct": 20500,
    "amountSep": 15500,
    "amountAug": 14600,
    "amountJul": 15100,
    "amountJun": 15800,
    "amountMay": 16200,
    "amountApr": 15500,
    "createdAt": null,
    "createdBy": null,
    "modifiedAt": null,
    "modifiedBy": null
  }
]
```

## 使用方法

### 方式1：直接运行脚本
```bash
cd backend
node updateCostCenterData.js
```

### 方式2：通过API调用
先启动后端服务器：
```bash
cd backend
node server.js
```

然后调用API：
```bash
curl -X POST http://localhost:3000/api/update-costcenter
```

或在浏览器中使用fetch：
```javascript
fetch('http://localhost:3000/api/update-costcenter', {
    method: 'POST'
})
.then(res => res.json())
.then(data => console.log(data));
```

## 脚本说明

### updateCostCenterData.js
主要功能模块：

1. **fetchCostCenterData()**: 从CPI获取数据并过滤
2. **parseCPIDate()**: 解析CPI日期格式
3. **getMonthFieldName()**: 获取月份对应的字段名
4. **processCPIData()**: 处理和组织数据
5. **updateJSONFile()**: 更新JSON文件

### server.js
新增API端点：
- `POST /api/update-costcenter`: 触发数据更新

## 数据示例

### CPI原始数据：
```json
{
  "bukrs": "1500",
  "kostl": "100030002",
  "budat": "/Date(1759276800000)/",
  "belnr": "MK00000000",
  "hkont": "6600420000",
  "ksl": "20500.000",
  "rkcur": "CNY"
}
```

### 转换后的数据：
```json
{
  "costCenter": "C100030002",
  "costElement": 6600420000,
  "amountOct": 20500
}
```

## 注意事项

1. **成本中心前缀**: 所有成本中心会自动添加前缀"C"（C100030002, C100030005）
2. **数据合并**: 同一成本中心和成本要素的不同月份数据会合并到一条记录中
3. **月份范围**: 只处理4月到10月的数据，其他月份会被忽略
4. **数据覆盖**: 每次运行会完全覆盖原有的JSON文件

## 错误处理

- 如果CPI连接失败，脚本会抛出错误并终止
- 如果没有找到符合条件的数据，会显示警告信息
- 日期解析失败的记录会被跳过，并显示警告

## 调试

如果需要查看详细日志，可以使用测试脚本：
```bash
node testCPI.js
```

这会显示CPI返回的原始数据结构。
