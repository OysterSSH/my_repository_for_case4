sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     * @param {typeof sap.ui.model.json.JSONModel} JSONModel
     */
    function (Controller, JSONModel, MessageToast, MessageBox) {
        "use strict";

        return Controller.extend("finprecheck.controller.CostCenterAnalysis", {
            
            // CPI配置
            CPI_CONFIG: {
                url: "http://localhost:3000/api/costcenter"
            },
            
            onInit: function () {
                const oViewModel = new JSONModel({
                    CostCenterAmounts: [],
                    MonthlyTrend: [],
                    CostCenterPercentage: [],
                    CostElementAmounts: [],
                    CostElementPercentageForPie: [],
                    Details: [],
                    busy: false
                });
                this.getView().setModel(oViewModel, "view");

                this._fetchData();
            },

            onAfterRendering: function () {
                this._setChartProperties();
            },

            _setChartProperties: function () {
                const oCostCenterBarChart = this.byId("costCenterBarChart");
                if (oCostCenterBarChart) {
                    oCostCenterBarChart.setVizProperties({
                        title: {
                            visible: true,
                            text: "Current Month Cost Center Amount (CNY)",
                            style: {
                                fontSize: "16px",
                                fontWeight: "bold"
                            }
                        },
                        categoryAxis: {
                            title: {
                                visible: false,
                                text: "Cost Center"  // X-axis title
                            }
                        },
                        valueAxis: {
                            title: {
                                visible: false,
                                text: "Amount"  // Y-axis title
                            }
                        },
                        plotArea: {
                            dataLabel: {
                                visible: true
                            }
                        }, 
                        legend: {
                            visible: false // 隐藏图例
                        }
                    });
                }

                // 设置Cost Element Chart的坐标轴文字方向
                const oCostElementChart = this.byId("costElementChart");
                if (oCostElementChart) {
                    oCostElementChart.setVizProperties({
                        title: {
                            visible: true,
                            text: "Cost Element Trend (CNY)",
                            style: {
                                fontSize: "16px",
                                fontWeight: "bold"
                            }
                        },
                        plotArea: {
                            dataShape: {
                                primaryAxis: ["bar", "line"]
                            },
                            dataLabel: {
                                visible: true,
                                // Only show data labels for bar chart
                                renderer: function(oLabel) {
                                    // "AverageAmount" is the measure name for line chart
                                    if (oLabel.ctx && oLabel.ctx.measureNames === "AverageAmount") {
                                        oLabel.text = ""; // Hide line chart labels
                                    }
                                }
                            }
                        },
                        categoryAxis: {
                            title: {
                                visible: false,
                                text: "Cost Element"  // X-axis title
                            }
                        },
                        valueAxis: {
                            title: {
                                visible: false,
                                text: "Amount"  // Y-axis title
                            }
                        },
                    });
                }

                // 设置Line Chart的属性
                const oMonthlyTrendChart = this.byId("monthlyTrendChart");
                if (oMonthlyTrendChart) {
                    oMonthlyTrendChart.setVizProperties({
                        title: {
                            visible: true,
                            text: "Cost Center Trend (CNY)",
                            style: {
                                fontSize: "16px",
                                fontWeight: "bold"
                            }
                        },
                        categoryAxis: {
                            title: {
                                visible: false,
                                text: "Amount"  // X-axis title
                            }
                        },
                        valueAxis: {
                            title: {
                                visible: false,
                                text: "Month"  // Y-axis title
                            }
                        },
                        plotArea: {
                            dataLabel: {
                                visible: true
                            }
                        },
                        legend: {
                            visible: false // 隐藏图例
                        }
                    });
                }

                // 设置Pie Chart的属性
                const oCostCenterPieChart = this.byId("costCenterPieChart");
                if (oCostCenterPieChart) {
                    oCostCenterPieChart.setVizProperties({
                        title: {
                            visible: true,
                            text: "Cost Element Percentage",
                            style: {
                                fontSize: "16px",
                                fontWeight: "bold"
                            }
                        },
                        plotArea: {
                            dataLabel: {
                                visible: true
                            }
                        },
                    });
                }
            },            

            onNavBack: function () {
                const oHistory = sap.ui.core.routing.History.getInstance();
                const sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    window.history.go(-1);
                } else {
                    const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("index", {}, true);
                }
            },

            _fetchData: function () {
                const oViewModel = this.getView().getModel("view");
                const that = this;
                
                oViewModel.setProperty("/busy", true);
                
                console.log("=== 开始从CPI加载成本中心数据 ===");
                
                // 调用CPI接口获取3个字段
                this._fetchCostCenterDataFromCPI()
                    .then((aCPIData) => {
                        console.log("✅ CPI返回成功，数据条数:", aCPIData.length);
                        console.log("CPI数据（前3条）:", JSON.stringify(aCPIData.slice(0, 3), null, 2));
                        
                        // 加载Mock数据
                        return that._loadMockData().then((aMockData) => {
                            console.log("✅ Mock数据加载成功，数据条数:", aMockData.length);
                            
                            // 合并CPI数据和Mock数据
                            const aMergedData = aCPIData.map((oCPIItem, index) => {
                                const oMockItem = aMockData[index] || {};
                                
                                console.log(`处理第${index + 1}条数据:`, {
                                    "CPI原始ksl": oCPIItem.ksl,
                                    "转换后的值": parseFloat(oCPIItem.ksl),
                                    "belnr": oCPIItem.belnr,
                                    "hkont": oCPIItem.hkont
                                });
                                
                                return {
                                    // CPI的3个字段
                                    costCenter: oCPIItem.belnr || "",
                                    costElement: oCPIItem.hkont || "",
                                    currentMonthAmount: parseFloat(oCPIItem.ksl) || 0,
                                    // Mock数据的其他字段
                                    avgAmount: oMockItem.avgAmount || 0,
                                    diffAmount: oMockItem.diffAmount || 0,
                                    variance: oMockItem.variance || "0%",
                                    month: oMockItem.month || "",
                                    // 保留CPI原始字段用于调试
                                    belnr: oCPIItem.belnr,
                                    hkont: oCPIItem.hkont,
                                    ksl: oCPIItem.ksl
                                };
                            });
                            
                            console.log("合并后的数据（前3条）:", JSON.stringify(aMergedData.slice(0, 3), null, 2));
                            
                            // 处理数据用于图表和表格
                            that._processData(aMergedData);
                            MessageToast.show(`✅ 成功加载 ${aMergedData.length} 条成本中心数据（CPI + Mock）`);
                        });
                    })
                    .catch((error) => {
                        console.error("❌ 数据加载失败:", error);
                        const errorMsg = error.message || String(error);
                        MessageBox.error(`加载成本中心数据失败: ${errorMsg}\n将使用Mock数据`);
                        
                        // 失败时使用纯Mock数据
                        that._loadMockDataOnly();
                    })
                    .finally(() => {
                        oViewModel.setProperty("/busy", false);
                        console.log("=== 成本中心数据加载完成 ===");
                    });
            },
            
            _loadMockData: function() {
                return new Promise((resolve, reject) => {
                    const sPath = sap.ui.require.toUrl("finprecheck/model/OtherCheckDetails.json");
                    fetch(sPath)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                            }
                            return response.json();
                        })
                        .then(data => {
                            const aMockData = data.results || data;
                            resolve(aMockData);
                        })
                        .catch(error => {
                            console.error("❌ Mock数据加载失败:", error);
                            resolve([]); // 失败时返回空数组
                        });
                });
            },
            
            _fetchCostCenterDataFromCPI: function() {
                return new Promise((resolve, reject) => {
                    console.log("📡 调用后端代理接口:");
                    console.log("  URL:", this.CPI_CONFIG.url);
                    
                    fetch(this.CPI_CONFIG.url, {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        }
                    })
                    .then(response => {
                        console.log("📥 后端响应状态:", response.status, response.statusText);
                        
                        if (!response.ok) {
                            return response.json().then(errorData => {
                                throw new Error(`Backend error! status: ${response.status}. ${errorData.message || errorData.error}`);
                            });
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log("📦 后端返回的原始数据:", JSON.stringify(data, null, 2));
                        
                        // 解析返回的数据
                        const aResults = data.d?.results || data.results || data;
                        
                        console.log("📊 解析后的数据类型:", Array.isArray(aResults) ? "Array" : typeof aResults);
                        console.log("📊 数据条数:", Array.isArray(aResults) ? aResults.length : 1);
                        
                        resolve(Array.isArray(aResults) ? aResults : []);
                    })
                    .catch(error => {
                        console.error("💥 后端请求异常:", error.message);
                        reject(error);
                    });
                });
            },
            
            _loadMockDataOnly: function() {
                const oModel = this.getOwnerComponent().getModel("otherCheckDetails");
                const oData = oModel.getData();
                if (oData && oData.length > 0) {
                    this._processData(oData);
                } else {
                    oModel.attachRequestCompleted(oEvent => {
                        const oData = oModel.getData();
                        this._processData(oData);
                    });
                }
            },

            onCostCenterSelect: function (oEvent) {
                const sSelectedCostCenter = oEvent.getSource().getKey();
                const oViewModel = this.getView().getModel("view");

                if (this._oMonthlyTrendData && this._oMonthlyTrendData[sSelectedCostCenter]) {
                    const aMonthlyTrend = Object.keys(this._oMonthlyTrendData[sSelectedCostCenter]).map(month => ({
                        month: month,
                        amount: this._oMonthlyTrendData[sSelectedCostCenter][month]
                    }));
                    oViewModel.setProperty("/MonthlyTrend", aMonthlyTrend);
                }
            },

            onCostCenterSelectForPie: function (oEvent) {
                const sSelectedCostCenter = oEvent.getSource().getKey();
                const oViewModel = this.getView().getModel("view");

                if (this._oCostElementDataByCostCenter && this._oCostElementDataByCostCenter[sSelectedCostCenter]) {
                    const oCostElementData = this._oCostElementDataByCostCenter[sSelectedCostCenter];
                    const fTotalAmount = Object.values(oCostElementData).reduce((sum, cur) => sum + cur, 0);
                    
                    const aCostElementPercentage = Object.keys(oCostElementData).map(sCostElement => ({
                        costElement: sCostElement,
                        percentage: (oCostElementData[sCostElement] / fTotalAmount) * 100
                    }));

                    oViewModel.setProperty("/CostElementPercentageForPie", aCostElementPercentage);
                }
            },

            onCostCenterSelectForElement: function (oEvent) {
                const sSelectedCostCenter = oEvent.getSource().getKey();
                this._updateCostElementChart(sSelectedCostCenter);
            },

            _updateCostElementChart: function (sCostCenter) {
                const oViewModel = this.getView().getModel("view");
                if (!this._oAllData) {
                    return;
                }
                const aDataForCostCenter = this._oAllData.filter(item => item.costCenter === sCostCenter);

                const oCostElementData = aDataForCostCenter.reduce((acc, cur) => {
                    if (!acc[cur.costElement]) {
                        acc[cur.costElement] = {
                            currentMonthAmount: 0,
                            monthlyAmounts: []
                        };
                    }
                    acc[cur.costElement].currentMonthAmount += cur.amountOct;
                    acc[cur.costElement].monthlyAmounts.push(cur.amountMay, cur.amountJun, cur.amountJul, cur.amountAug, cur.amountSep, cur.amountOct);
                    return acc;
                }, {});

                const aCostElementAmounts = Object.keys(oCostElementData).map(key => {
                    const aAmounts = oCostElementData[key].monthlyAmounts;
                    const fAvgAmount = aAmounts.length > 0 ? aAmounts.reduce((sum, cur) => sum + cur, 0) / aAmounts.length : 0;
                    return {
                        costElement: key,
                        currentMonthAmount: oCostElementData[key].currentMonthAmount,
                        avgAmount: fAvgAmount
                    };
                });
                oViewModel.setProperty("/CostElementAmounts", aCostElementAmounts);
            },

            _processData: function (aData) {
                const oViewModel = this.getView().getModel("view");
                
                console.log("📊 _processData收到的数据（前3条）:", JSON.stringify(aData.slice(0, 3), null, 2));

                // 1. Cost Center Amounts (Bar Chart) - 使用currentMonthAmount
                const oCostCenterAmounts = aData.reduce((acc, cur) => {
                    const amount = cur.currentMonthAmount || cur.amountOct || 0;
                    acc[cur.costCenter] = (acc[cur.costCenter] || 0) + amount;
                    return acc;
                }, {});
                const aCostCenterAmounts = Object.keys(oCostCenterAmounts).map(key => ({
                    costCenter: key,
                    amount: oCostCenterAmounts[key]
                }));
                oViewModel.setProperty("/CostCenterAmounts", aCostCenterAmounts);

                // 2. Monthly Trend (Line Chart) - 使用currentMonthAmount作为Oct
                const oMonthlyTrend = aData.reduce((acc, cur) => {
                    if (!acc[cur.costCenter]) {
                        acc[cur.costCenter] = {};
                    }
                    acc[cur.costCenter]["May"] = (acc[cur.costCenter]["May"] || 0) + (cur.amountMay || 0);
                    acc[cur.costCenter]["Jun"] = (acc[cur.costCenter]["Jun"] || 0) + (cur.amountJun || 0);
                    acc[cur.costCenter]["Jul"] = (acc[cur.costCenter]["Jul"] || 0) + (cur.amountJul || 0);
                    acc[cur.costCenter]["Aug"] = (acc[cur.costCenter]["Aug"] || 0) + (cur.amountAug || 0);
                    acc[cur.costCenter]["Sep"] = (acc[cur.costCenter]["Sep"] || 0) + (cur.amountSep || 0);
                    acc[cur.costCenter]["Oct"] = (acc[cur.costCenter]["Oct"] || 0) + (cur.currentMonthAmount || cur.amountOct || 0);
                    return acc;
                }, {});

                this._oMonthlyTrendData = oMonthlyTrend; // Store all trend data

                // Pre-calculate cost element amounts for each cost center - 使用currentMonthAmount
                this._oCostElementDataByCostCenter = aData.reduce((acc, cur) => {
                    if (!acc[cur.costCenter]) {
                        acc[cur.costCenter] = {};
                    }
                    const amount = cur.currentMonthAmount || cur.amountOct || 0;
                    acc[cur.costCenter][cur.costElement] = (acc[cur.costCenter][cur.costElement] || 0) + amount;
                    return acc;
                }, {});

                // For simplicity, showing trend for the first cost center initially
                const sFirstCostCenter = aCostCenterAmounts.length > 0 ? aCostCenterAmounts[0].costCenter : null;
                if (sFirstCostCenter) {
                    const aMonthlyTrend = Object.keys(this._oMonthlyTrendData[sFirstCostCenter]).map(month => ({
                        month: month,
                        amount: this._oMonthlyTrendData[sFirstCostCenter][month]
                    }));
                    oViewModel.setProperty("/MonthlyTrend", aMonthlyTrend);

                } else {
                    oViewModel.setProperty("/MonthlyTrend", []);
                }

                // Set initial data for Pie Chart
                if (sFirstCostCenter && this._oCostElementDataByCostCenter[sFirstCostCenter]) {
                    const oInitialCostElementData = this._oCostElementDataByCostCenter[sFirstCostCenter];
                    const fTotalAmountForPie = Object.values(oInitialCostElementData).reduce((sum, cur) => sum + cur, 0);
                    const aInitialPieData = Object.keys(oInitialCostElementData).map(sCostElement => ({
                        costElement: sCostElement,
                        percentage: (oInitialCostElementData[sCostElement] / fTotalAmountForPie) * 100
                    }));
                    oViewModel.setProperty("/CostElementPercentageForPie", aInitialPieData);
                }

                // 3. Cost Center Percentage (Pie Chart) - This seems to be for a different purpose now, maybe can be removed if not used elsewhere
                const fTotalAmount = aCostCenterAmounts.reduce((sum, cur) => sum + cur.amount, 0);
                const aCostCenterPercentage = aCostCenterAmounts.map(item => ({
                    costCenter: item.costCenter,
                    percentage: (item.amount / fTotalAmount) * 100
                }));
                oViewModel.setProperty("/CostCenterPercentage", aCostCenterPercentage);

                // 4. Cost Element Amounts (Combination Chart)
                this._oAllData = aData; // Store all data
                if (sFirstCostCenter) {
                    this._updateCostElementChart(sFirstCostCenter);
                }

                // 5. Details Table - 使用currentMonthAmount
                const aDetails = aData.map(item => {
                    const currentAmount = item.currentMonthAmount || item.amountOct || 0;
                    // Per user request: Average is from April to September
                    const aPastMonthlyAmounts = [
                        item.amountApr || 0, 
                        item.amountMay || 0, 
                        item.amountJun || 0, 
                        item.amountJul || 0, 
                        item.amountAug || 0, 
                        item.amountSep || 0
                    ];
                    const fAvgAmount = aPastMonthlyAmounts.reduce((sum, cur) => sum + cur, 0) / 6;
                    const fDiffAmount = currentAmount - fAvgAmount;
                    const fVariance = fAvgAmount === 0 ? 0 : (fDiffAmount / fAvgAmount) * 100;
                    return {
                        costCenter: item.costCenter,
                        costElement: item.costElement,
                        currentMonthAmount: currentAmount,
                        avgAmount: fAvgAmount.toFixed(2),
                        diffAmount: fDiffAmount.toFixed(2),
                        variance: fVariance.toFixed(2)
                    };
                });
                
                console.log("📋 Details表格数据（前3条）:", JSON.stringify(aDetails.slice(0, 3), null, 2));
                oViewModel.setProperty("/Details", aDetails);
            },
            
            formatDiffAmount: function(diffAmount) {
                if (!diffAmount && diffAmount !== 0) {
                    return "";
                }
                
                const fAmount = parseFloat(diffAmount);
                if (fAmount > 0) {
                    return "+" + fAmount.toFixed(2);
                } else if (fAmount < 0) {
                    return fAmount.toFixed(2); // 负数本身就有-号
                } else {
                    return "0.00";
                }
            }
        });
    });
