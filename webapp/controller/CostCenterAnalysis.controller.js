sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     * @param {typeof sap.ui.model.json.JSONModel} JSONModel
     */
    function (Controller, JSONModel, MessageToast) {
        "use strict";

        return Controller.extend("finprecheck.controller.CostCenterAnalysis", {
        onInit: function () {
            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("costCenterAnalysis").attachPatternMatched(this._onRouteMatched, this);

            // 初始化视图模型
            const oViewModel = new JSONModel({
                Details: [],
                CostCenterAmounts: [],
                CostElementAmounts: [],
                MonthlyTrend: [],
                CostElementPercentageForPie: []
            });
            this.getView().setModel(oViewModel, "view");
        },

        _onRouteMatched: function () {
            // 从组件模型中获取差异分析数据
            const oAnalysisModel = this.getOwnerComponent().getModel("costCenterAnalysis");
            
            if (!oAnalysisModel || !oAnalysisModel.getData().varianceResults) {
                MessageToast.show("未找到差异分析数据，请先执行分析");
                this.onNavBack();
                return;
            }

            const oData = oAnalysisModel.getData();
            this._processAnalysisData(oData);
        },

        /**
         * 处理差异分析数据并更新视图
         */
        _processAnalysisData: function (oData) {
            const aVarianceResults = oData.varianceResults || [];
            const oViewModel = this.getView().getModel("view");

            // 1. 更新详细数据表格
            const aDetails = aVarianceResults.map(item => ({
                costCenter: item.cost_center,
                costElement: item.cost_element,
                currentMonthAmount: item.current_month_amount.toFixed(2),
                avgAmount: item.historical_average_amount.toFixed(2),
                diffAmount: item.variance_amount.toFixed(2),
                variance: (item.variance_ratio * 100).toFixed(1) + "%"
            }));
            oViewModel.setProperty("/Details", aDetails);

            // 2. 更新成本中心汇总数据（用于柱状图）
            const oCostCenterMap = {};
            aVarianceResults.forEach(item => {
                const cc = item.cost_center;
                if (!oCostCenterMap[cc]) {
                    oCostCenterMap[cc] = 0;
                }
                oCostCenterMap[cc] += item.current_month_amount;
            });

            const aCostCenterAmounts = Object.keys(oCostCenterMap).map(cc => ({
                costCenter: cc,
                amount: oCostCenterMap[cc]
            }));
            oViewModel.setProperty("/CostCenterAmounts", aCostCenterAmounts);

            // 3. 更新成本要素分析数据（用于组合图）
            const oCostElementMap = {};
            aVarianceResults.forEach(item => {
                const key = `${item.cost_center}_${item.cost_element}`;
                if (!oCostElementMap[key]) {
                    oCostElementMap[key] = {
                        costElement: `${item.cost_center}-${item.cost_element}`,
                        currentMonthAmount: 0,
                        avgAmount: 0
                    };
                }
                oCostElementMap[key].currentMonthAmount += item.current_month_amount;
                oCostElementMap[key].avgAmount += item.historical_average_amount;
            });

            const aCostElementAmounts = Object.values(oCostElementMap);
            oViewModel.setProperty("/CostElementAmounts", aCostElementAmounts);

            // 4. 初始化月度趋势数据（默认选择第一个成本中心）
            if (aCostCenterAmounts.length > 0) {
                this._updateMonthlyTrend(aCostCenterAmounts[0].costCenter);
                this._updatePieChart(aCostCenterAmounts[0].costCenter);
            }

            console.log("差异分析数据已加载:", {
                detailsCount: aDetails.length,
                costCenters: aCostCenterAmounts.length,
                costElements: aCostElementAmounts.length
            });
        },

        /**
         * 更新月度趋势图（基于选中的成本中心）
         */
        _updateMonthlyTrend: function (sCostCenter) {
            const oAnalysisModel = this.getOwnerComponent().getModel("costCenterAnalysis");
            const aRawData = oAnalysisModel.getData().rawData || [];
            
            // 按月份聚合该成本中心的数据
            const oMonthlyMap = {};
            aRawData.filter(item => item.kostl === sCostCenter).forEach(item => {
                const month = item.budat ? item.budat.substring(0, 7) : "";
                if (!month) return;
                
                if (!oMonthlyMap[month]) {
                    oMonthlyMap[month] = 0;
                }
                oMonthlyMap[month] += item.ksl || 0;
            });

            const aMonthlyTrend = Object.keys(oMonthlyMap)
                .sort()
                .map(month => ({
                    month: month,
                    amount: oMonthlyMap[month]
                }));

            this.getView().getModel("view").setProperty("/MonthlyTrend", aMonthlyTrend);
        },

        /**
         * 更新饼图数据（成本要素占比）
         */
        _updatePieChart: function (sCostCenter) {
            const oViewModel = this.getView().getModel("view");
            const aDetails = oViewModel.getProperty("/Details");
            
            // 筛选该成本中心的数据
            const aFiltered = aDetails.filter(item => item.costCenter === sCostCenter);
            const fTotal = aFiltered.reduce((sum, item) => sum + parseFloat(item.currentMonthAmount), 0);
            
            const aPieData = aFiltered.map(item => ({
                costElement: item.costElement,
                percentage: fTotal > 0 ? (parseFloat(item.currentMonthAmount) / fTotal * 100).toFixed(2) : 0
            }));

            oViewModel.setProperty("/CostElementPercentageForPie", aPieData);
        },

        /**
         * 成本中心选择（折线图）
         */
        onCostCenterSelect: function (oEvent) {
            const sCostCenter = oEvent.getParameter("item").getKey();
            this._updateMonthlyTrend(sCostCenter);
            MessageToast.show(`已切换到成本中心: ${sCostCenter}`);
        },

        /**
         * 成本中心选择（饼图）
         */
        onCostCenterSelectForPie: function (oEvent) {
            const sCostCenter = oEvent.getParameter("item").getKey();
            this._updatePieChart(sCostCenter);
            MessageToast.show(`已切换到成本中心: ${sCostCenter}`);
        },

        /**
         * 成本中心选择（成本要素分析）
         */
        onCostCenterSelectForElement: function (oEvent) {
            const sCostCenter = oEvent.getParameter("item").getKey();
            const oViewModel = this.getView().getModel("view");
            const aAllElements = oViewModel.getProperty("/Details");
            
            // 筛选该成本中心的成本要素
            const aFiltered = aAllElements
                .filter(item => item.costCenter === sCostCenter)
                .map(item => ({
                    costElement: item.costElement,
                    currentMonthAmount: parseFloat(item.currentMonthAmount),
                    avgAmount: parseFloat(item.avgAmount)
                }));

            oViewModel.setProperty("/CostElementAmounts", aFiltered);
            MessageToast.show(`已切换到成本中心: ${sCostCenter}`);
        },

        /**
         * 格式化差异金额（红色显示负数，绿色显示正数）
         */
        formatDiffAmount: function (sValue) {
            const fValue = parseFloat(sValue);
            if (isNaN(fValue)) return sValue;
            
            // 这里只返回格式化的值，颜色通过 CustomData 设置
            return fValue >= 0 ? `+${fValue.toFixed(2)}` : fValue.toFixed(2);
        },

        onNavBack: function () {
            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("finprecheck");
        }
    });
});
    //     return Controller.extend("finprecheck.controller.CostCenterAnalysis", {
    //         onInit: function () {
    //             const oViewModel = new JSONModel({
    //                 CostCenterAmounts: [],
    //                 MonthlyTrend: [],
    //                 CostCenterPercentage: [],
    //                 CostElementAmounts: [],
    //                 CostElementPercentageForPie: [],
    //                 Details: []
    //             });
    //             this.getView().setModel(oViewModel, "view");

    //             this._fetchData();
    //         },

    //         onAfterRendering: function () {
    //             this._setChartProperties();
    //         },

    //         _setChartProperties: function () {
    //             const oCostCenterBarChart = this.byId("costCenterBarChart");
    //             if (oCostCenterBarChart) {
    //                 oCostCenterBarChart.setVizProperties({
    //                     title: {
    //                         visible: true,
    //                         text: "当月成本中心金额(CNY)",
    //                         style: {
    //                             fontSize: "16px",
    //                             fontWeight: "bold"
    //                         }
    //                     },
    //                     categoryAxis: {
    //                         title: {
    //                             visible: false,
    //                             text: "成本中心"  // 横坐标标题
    //                         }
    //                     },
    //                     valueAxis: {
    //                         title: {
    //                             visible: false,
    //                             text: "金额"  // 纵坐标标题
    //                         }
    //                     },
    //                     plotArea: {
    //                         dataLabel: {
    //                             visible: true
    //                         }
    //                     }, 
    //                     legend: {
    //                         visible: false // 隐藏图例
    //                     }
    //                 });
    //             }

    //             // 设置Cost Element Chart的坐标轴文字方向
    //             const oCostElementChart = this.byId("costElementChart");
    //             if (oCostElementChart) {
    //                 oCostElementChart.setVizProperties({
    //                     title: {
    //                         visible: true,
    //                         text: "成本要素趋势(CNY)",
    //                         style: {
    //                             fontSize: "16px",
    //                             fontWeight: "bold"
    //                         }
    //                     },
    //                     plotArea: {
    //                         dataShape: {
    //                             primaryAxis: ["bar", "line"]
    //                         },
    //                         dataLabel: {
    //                             visible: true,
    //                             // 仅显示柱状图的数据标签
    //                             renderer: function(oLabel) {
    //                                 // "AverageAmount" 是折线图的度量名称
    //                                 if (oLabel.ctx && oLabel.ctx.measureNames === "AverageAmount") {
    //                                     oLabel.text = ""; // 隐藏折线图的标签
    //                                 }
    //                             }
    //                         }
    //                     },
    //                     categoryAxis: {
    //                         title: {
    //                             visible: false,
    //                             text: "成本要素"  // 横坐标标题
    //                         }
    //                     },
    //                     valueAxis: {
    //                         title: {
    //                             visible: false,
    //                             text: "金额"  // 纵坐标标题
    //                         }
    //                     },
    //                 });
    //             }

    //             // 设置Line Chart的属性
    //             const oMonthlyTrendChart = this.byId("monthlyTrendChart");
    //             if (oMonthlyTrendChart) {
    //                 oMonthlyTrendChart.setVizProperties({
    //                     title: {
    //                         visible: true,
    //                         text: "成本中心趋势(CNY)",
    //                         style: {
    //                             fontSize: "16px",
    //                             fontWeight: "bold"
    //                         }
    //                     },
    //                     categoryAxis: {
    //                         title: {
    //                             visible: false,
    //                             text: "金额"  // 横坐标标题
    //                         }
    //                     },
    //                     valueAxis: {
    //                         title: {
    //                             visible: false,
    //                             text: "月份"  // 纵坐标标题
    //                         }
    //                     },
    //                     plotArea: {
    //                         dataLabel: {
    //                             visible: true
    //                         }
    //                     },
    //                     legend: {
    //                         visible: false // 隐藏图例
    //                     }
    //                 });
    //             }

    //             // 设置Pie Chart的属性
    //             const oCostCenterPieChart = this.byId("costCenterPieChart");
    //             if (oCostCenterPieChart) {
    //                 oCostCenterPieChart.setVizProperties({
    //                     title: {
    //                         visible: true,
    //                         text: "成本要素金额占比",
    //                         style: {
    //                             fontSize: "16px",
    //                             fontWeight: "bold"
    //                         }
    //                     },
    //                     plotArea: {
    //                         dataLabel: {
    //                             visible: true
    //                         }
    //                     },
    //                 });
    //             }
    //         },            

    //         onNavBack: function () {
    //             const oHistory = sap.ui.core.routing.History.getInstance();
    //             const sPreviousHash = oHistory.getPreviousHash();

    //             if (sPreviousHash !== undefined) {
    //                 window.history.go(-1);
    //             } else {
    //                 const oRouter = this.getOwnerComponent().getRouter();
    //                 oRouter.navTo("index", {}, true);
    //             }
    //         },

    //         _fetchData: function () {
    //             const oModel = this.getOwnerComponent().getModel("otherCheckDetails");
    //             const oData = oModel.getData();
    //             if (oData && oData.length > 0) {
    //                 this._processData(oData);
    //             } else {
    //                 oModel.attachRequestCompleted(oEvent => {
    //                     const oData = oModel.getData();
    //                     this._processData(oData);
    //                 });
    //             }
    //         },

    //         onCostCenterSelect: function (oEvent) {
    //             const sSelectedCostCenter = oEvent.getSource().getKey();
    //             const oViewModel = this.getView().getModel("view");

    //             if (this._oMonthlyTrendData && this._oMonthlyTrendData[sSelectedCostCenter]) {
    //                 const aMonthlyTrend = Object.keys(this._oMonthlyTrendData[sSelectedCostCenter]).map(month => ({
    //                     month: month,
    //                     amount: this._oMonthlyTrendData[sSelectedCostCenter][month]
    //                 }));
    //                 oViewModel.setProperty("/MonthlyTrend", aMonthlyTrend);
    //             }
    //         },

    //         onCostCenterSelectForPie: function (oEvent) {
    //             const sSelectedCostCenter = oEvent.getSource().getKey();
    //             const oViewModel = this.getView().getModel("view");

    //             if (this._oCostElementDataByCostCenter && this._oCostElementDataByCostCenter[sSelectedCostCenter]) {
    //                 const oCostElementData = this._oCostElementDataByCostCenter[sSelectedCostCenter];
    //                 const fTotalAmount = Object.values(oCostElementData).reduce((sum, cur) => sum + cur, 0);
                    
    //                 const aCostElementPercentage = Object.keys(oCostElementData).map(sCostElement => ({
    //                     costElement: sCostElement,
    //                     percentage: (oCostElementData[sCostElement] / fTotalAmount) * 100
    //                 }));

    //                 oViewModel.setProperty("/CostElementPercentageForPie", aCostElementPercentage);
    //             }
    //         },

    //         onCostCenterSelectForElement: function (oEvent) {
    //             const sSelectedCostCenter = oEvent.getSource().getKey();
    //             this._updateCostElementChart(sSelectedCostCenter);
    //         },

    //         _updateCostElementChart: function (sCostCenter) {
    //             const oViewModel = this.getView().getModel("view");
    //             if (!this._oAllData) {
    //                 return;
    //             }
    //             const aDataForCostCenter = this._oAllData.filter(item => item.costCenter === sCostCenter);

    //             const oCostElementData = aDataForCostCenter.reduce((acc, cur) => {
    //                 if (!acc[cur.costElement]) {
    //                     acc[cur.costElement] = {
    //                         currentMonthAmount: 0,
    //                         monthlyAmounts: []
    //                     };
    //                 }
    //                 acc[cur.costElement].currentMonthAmount += cur.amountOct;
    //                 acc[cur.costElement].monthlyAmounts.push(cur.amountMay, cur.amountJun, cur.amountJul, cur.amountAug, cur.amountSep, cur.amountOct);
    //                 return acc;
    //             }, {});

    //             const aCostElementAmounts = Object.keys(oCostElementData).map(key => {
    //                 const aAmounts = oCostElementData[key].monthlyAmounts;
    //                 const fAvgAmount = aAmounts.length > 0 ? aAmounts.reduce((sum, cur) => sum + cur, 0) / aAmounts.length : 0;
    //                 return {
    //                     costElement: key,
    //                     currentMonthAmount: oCostElementData[key].currentMonthAmount,
    //                     avgAmount: fAvgAmount
    //                 };
    //             });
    //             oViewModel.setProperty("/CostElementAmounts", aCostElementAmounts);
    //         },

    //         _processData: function (aData) {
    //             const oViewModel = this.getView().getModel("view");

    //             // 1. Cost Center Amounts (Bar Chart)
    //             const oCostCenterAmounts = aData.reduce((acc, cur) => {
    //                 acc[cur.costCenter] = (acc[cur.costCenter] || 0) + cur.amountOct;
    //                 return acc;
    //             }, {});
    //             const aCostCenterAmounts = Object.keys(oCostCenterAmounts).map(key => ({
    //                 costCenter: key,
    //                 amount: oCostCenterAmounts[key]
    //             }));
    //             oViewModel.setProperty("/CostCenterAmounts", aCostCenterAmounts);

    //             // 2. Monthly Trend (Line Chart)
    //             const oMonthlyTrend = aData.reduce((acc, cur) => {
    //                 if (!acc[cur.costCenter]) {
    //                     acc[cur.costCenter] = {};
    //                 }
    //                 acc[cur.costCenter]["May"] = (acc[cur.costCenter]["May"] || 0) + cur.amountMay;
    //                 acc[cur.costCenter]["Jun"] = (acc[cur.costCenter]["Jun"] || 0) + cur.amountJun;
    //                 acc[cur.costCenter]["Jul"] = (acc[cur.costCenter]["Jul"] || 0) + cur.amountJul;
    //                 acc[cur.costCenter]["Aug"] = (acc[cur.costCenter]["Aug"] || 0) + cur.amountAug;
    //                 acc[cur.costCenter]["Sep"] = (acc[cur.costCenter]["Sep"] || 0) + cur.amountSep;
    //                 acc[cur.costCenter]["Oct"] = (acc[cur.costCenter]["Oct"] || 0) + cur.amountOct;
    //                 return acc;
    //             }, {});

    //             this._oMonthlyTrendData = oMonthlyTrend; // Store all trend data

    //             // Pre-calculate cost element amounts for each cost center
    //             this._oCostElementDataByCostCenter = aData.reduce((acc, cur) => {
    //                 if (!acc[cur.costCenter]) {
    //                     acc[cur.costCenter] = {};
    //                 }
    //                 acc[cur.costCenter][cur.costElement] = (acc[cur.costCenter][cur.costElement] || 0) + cur.amountOct;
    //                 return acc;
    //             }, {});

    //             // For simplicity, showing trend for the first cost center initially
    //             const sFirstCostCenter = aCostCenterAmounts.length > 0 ? aCostCenterAmounts[0].costCenter : null;
    //             if (sFirstCostCenter) {
    //                 const aMonthlyTrend = Object.keys(this._oMonthlyTrendData[sFirstCostCenter]).map(month => ({
    //                     month: month,
    //                     amount: this._oMonthlyTrendData[sFirstCostCenter][month]
    //                 }));
    //                 oViewModel.setProperty("/MonthlyTrend", aMonthlyTrend);

    //             } else {
    //                 oViewModel.setProperty("/MonthlyTrend", []);
    //             }

    //             // Set initial data for Pie Chart
    //             if (sFirstCostCenter && this._oCostElementDataByCostCenter[sFirstCostCenter]) {
    //                 const oInitialCostElementData = this._oCostElementDataByCostCenter[sFirstCostCenter];
    //                 const fTotalAmountForPie = Object.values(oInitialCostElementData).reduce((sum, cur) => sum + cur, 0);
    //                 const aInitialPieData = Object.keys(oInitialCostElementData).map(sCostElement => ({
    //                     costElement: sCostElement,
    //                     percentage: (oInitialCostElementData[sCostElement] / fTotalAmountForPie) * 100
    //                 }));
    //                 oViewModel.setProperty("/CostElementPercentageForPie", aInitialPieData);
    //             }

    //             // 3. Cost Center Percentage (Pie Chart) - This seems to be for a different purpose now, maybe can be removed if not used elsewhere
    //             const fTotalAmount = aCostCenterAmounts.reduce((sum, cur) => sum + cur.amount, 0);
    //             const aCostCenterPercentage = aCostCenterAmounts.map(item => ({
    //                 costCenter: item.costCenter,
    //                 percentage: (item.amount / fTotalAmount) * 100
    //             }));
    //             oViewModel.setProperty("/CostCenterPercentage", aCostCenterPercentage);

    //             // 4. Cost Element Amounts (Combination Chart)
    //             this._oAllData = aData; // Store all data
    //             if (sFirstCostCenter) {
    //                 this._updateCostElementChart(sFirstCostCenter);
    //             }

    //             // 5. Details Table
    //             const aDetails = aData.map(item => {
    //                 // Per user request: Average is from April to September
    //                 const aPastMonthlyAmounts = [item.amountApr, item.amountMay, item.amountJun, item.amountJul, item.amountAug, item.amountSep];
    //                 const fAvgAmount = aPastMonthlyAmounts.reduce((sum, cur) => (sum || 0) + (cur || 0), 0) / 6;
    //                 const fDiffAmount = item.amountOct - fAvgAmount;
    //                 const fVariance = fAvgAmount === 0 ? 0 : (fDiffAmount / fAvgAmount) * 100;
    //                 return {
    //                     costCenter: item.costCenter,
    //                     costElement: item.costElement,
    //                     currentMonthAmount: item.amountOct,
    //                     avgAmount: fAvgAmount.toFixed(2),
    //                     diffAmount: fDiffAmount.toFixed(2),
    //                     variance: fVariance.toFixed(2)
    //                 };
    //             });
    //             oViewModel.setProperty("/Details", aDetails);
    //         },
            
    //         formatDiffAmount: function(diffAmount) {
    //             if (!diffAmount && diffAmount !== 0) {
    //                 return "";
    //             }
                
    //             const fAmount = parseFloat(diffAmount);
    //             if (fAmount > 0) {
    //                 return "+" + fAmount.toFixed(2);
    //             } else if (fAmount < 0) {
    //                 return fAmount.toFixed(2); // 负数本身就有-号
    //             } else {
    //                 return "0.00";
    //             }
    //         }
    //     });
    // });
