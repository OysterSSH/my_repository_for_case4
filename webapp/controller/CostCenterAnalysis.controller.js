sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     * @param {typeof sap.ui.model.json.JSONModel} JSONModel
     */
    function (Controller, JSONModel) {
        "use strict";

        return Controller.extend("finprecheck.controller.CostCenterAnalysis", {
            onInit: function () {
                const oViewModel = new JSONModel({
                    CostCenterAmounts: [],
                    MonthlyTrend: [],
                    CostCenterPercentage: [],
                    CostElementAmounts: [],
                    CostElementPercentageForPie: [],
                    Details: []
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

                // 1. Cost Center Amounts (Bar Chart)
                const oCostCenterAmounts = aData.reduce((acc, cur) => {
                    acc[cur.costCenter] = (acc[cur.costCenter] || 0) + cur.amountOct;
                    return acc;
                }, {});
                const aCostCenterAmounts = Object.keys(oCostCenterAmounts).map(key => ({
                    costCenter: key,
                    amount: oCostCenterAmounts[key]
                }));
                oViewModel.setProperty("/CostCenterAmounts", aCostCenterAmounts);

                // 2. Monthly Trend (Line Chart)
                const oMonthlyTrend = aData.reduce((acc, cur) => {
                    if (!acc[cur.costCenter]) {
                        acc[cur.costCenter] = {};
                    }
                    acc[cur.costCenter]["May"] = (acc[cur.costCenter]["May"] || 0) + cur.amountMay;
                    acc[cur.costCenter]["Jun"] = (acc[cur.costCenter]["Jun"] || 0) + cur.amountJun;
                    acc[cur.costCenter]["Jul"] = (acc[cur.costCenter]["Jul"] || 0) + cur.amountJul;
                    acc[cur.costCenter]["Aug"] = (acc[cur.costCenter]["Aug"] || 0) + cur.amountAug;
                    acc[cur.costCenter]["Sep"] = (acc[cur.costCenter]["Sep"] || 0) + cur.amountSep;
                    acc[cur.costCenter]["Oct"] = (acc[cur.costCenter]["Oct"] || 0) + cur.amountOct;
                    return acc;
                }, {});

                this._oMonthlyTrendData = oMonthlyTrend; // Store all trend data

                // Pre-calculate cost element amounts for each cost center
                this._oCostElementDataByCostCenter = aData.reduce((acc, cur) => {
                    if (!acc[cur.costCenter]) {
                        acc[cur.costCenter] = {};
                    }
                    acc[cur.costCenter][cur.costElement] = (acc[cur.costCenter][cur.costElement] || 0) + cur.amountOct;
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

                // 5. Details Table
                const aDetails = aData.map(item => {
                    // Per user request: Average is from April to September
                    const aPastMonthlyAmounts = [item.amountApr, item.amountMay, item.amountJun, item.amountJul, item.amountAug, item.amountSep];
                    const fAvgAmount = aPastMonthlyAmounts.reduce((sum, cur) => (sum || 0) + (cur || 0), 0) / 6;
                    const fDiffAmount = item.amountOct - fAvgAmount;
                    const fVariance = fAvgAmount === 0 ? 0 : (fDiffAmount / fAvgAmount) * 100;
                    return {
                        costCenter: item.costCenter,
                        costElement: item.costElement,
                        currentMonthAmount: item.amountOct,
                        avgAmount: fAvgAmount.toFixed(2),
                        diffAmount: fDiffAmount.toFixed(2),
                        variance: fVariance.toFixed(2)
                    };
                });
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
