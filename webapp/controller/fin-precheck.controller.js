sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Popover",
    "sap/m/Text",
    "sap/m/VBox",
    "sap/m/Button",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/Dialog",
    "sap/m/MessageStrip"
], function (Controller, JSONModel, MessageToast, Filter, FilterOperator, Popover, Text, VBox, Button, Toolbar, ToolbarSpacer, Dialog, MessageStrip) {
    "use strict";

    return Controller.extend("finprecheck.controller.fin-precheck", {
        onInit: function() {
            this.oRouter = this.getOwnerComponent().getRouter();
            const oViewModel = new JSONModel({
                CompanyCodes: [{ key: "1010", text: "1010" }],
                Plants: [{ key: "1010", text: "1010" }],
                CheckResults: []
            });
            this.getView().setModel(oViewModel, "view");
            this.getView().byId("precheckTable").bindRows("view>/CheckResults");
        },

        onPrecheck: function() {
            const oView = this.getView();
            const oTable = oView.byId("precheckTable");
            const oButton = oView.byId("precheckButton");
            const sCompanyCode = oView.byId("companyCodeInput").getSelectedKey();
            const sPlant = oView.byId("plantInput").getSelectedKey();
            const sPostingTime = oView.byId("postingTimePicker").getValue();

            if (!sCompanyCode || !sPlant || !sPostingTime) {
                MessageToast.show("请填写所有必填字段。");
                return;
            }

            oButton.setText("AI分析中...");
            oButton.setEnabled(false);
            oTable.setBusy(true);

            setTimeout(() => {
                const oViewModel = oView.getModel("view");
                const oCheckResultsModel = this.getOwnerComponent().getModel("checkResults");
                const aAllData = oCheckResultsModel.getData();

                if (aAllData) {
                    const aFilteredData = aAllData.filter(item => 
                        item.companyCode === sCompanyCode &&
                        item.werks === sPlant &&
                        item.postingTime === sPostingTime
                    );
                    oViewModel.setProperty("/CheckResults", aFilteredData);
                    MessageToast.show(`AI预检查完成，共 ${aFilteredData.length} 条记录`);
                } else {
                    MessageToast.show("数据模型加载失败，请刷新页面重试。");AI
                }
                oTable.setBusy(false);
                oButton.setText("AI预检查");
                oButton.setEnabled(true);
            }, 5000);
        },

        onAIAnalysisPress: function(oEvent) {
            const oButton = oEvent.getSource();
            const oBindingContext = oButton.getBindingContext("view");
            const oData = oBindingContext.getObject();
            this._showAIAnalysisPopover(oButton, oData);
        },

        _showAIAnalysisPopover: function(oButton, oData) {
            if (!this._oAIPopover) {
                this._oAIPopover = new Popover({
                    title: "AI智能分析",
                    placement: "Auto",
                    contentWidth: "400px",
                    content: [
                        new VBox({
                            items: [
                                new MessageStrip({
                                    text: "提示：此内容为 AI 创作，仅供参考与交流",
                                    type: "Information",
                                    showIcon: true,
                                    customIcon: "sap-icon://alert"
                                }).addStyleClass("sapUiSmallMarginBottom"),
                                new Text({ id: "aiPopoverSuggestion", wrapping: true }).addStyleClass("sapUiSmallMarginBegin")
                            ]
                        }).addStyleClass("sapUiResponsiveMargin")
                    ],
                    footer: [
                        new Toolbar({
                            content: [
                                new ToolbarSpacer(),
                                new Button({
                                    text: "关闭",
                                    type: "Emphasized",
                                    press: () => {
                                        if (this._typingInterval) {
                                            clearInterval(this._typingInterval);
                                            this._typingInterval = null;
                                        }
                                        this._oAIPopover.close();
                                    }
                                })
                            ]
                        })
                    ]
                });
                this.getView().addDependent(this._oAIPopover);
            }

            const oSuggestionText = sap.ui.getCore().byId("aiPopoverSuggestion");
            oSuggestionText.setText("");
            this._oAIPopover.openBy(oButton);

            const sSuggestion = oData.suggestion || "暂无AI分析说明";
            let i = 0;

            if (this._typingInterval) {
                clearInterval(this._typingInterval);
            }

            this._typingInterval = setInterval(() => {
                if (i < sSuggestion.length) {
                    const nextChunk = sSuggestion.substring(i, i + 5);
                    oSuggestionText.setText(oSuggestionText.getText() + nextChunk);
                    i += 5;
                } else {
                    clearInterval(this._typingInterval);
                    this._typingInterval = null;
                }
            }, 100);
        },

        onExecuteAgent: function() {
            MessageToast.show("开发未完成");
        },

        onNavigateToDetail: function(oEvent) {
            const oButton = oEvent.getSource();
            const oBindingContext = oButton.getBindingContext("view");
            if (!oBindingContext) return;

            const oData = oBindingContext.getObject();
            const oTable = this.getView().byId("precheckTable");
            const aRows = oTable.getRows();
            let iRowIndex = -1;

            for (let i = 0; i < aRows.length; i++) {
                const oRow = aRows[i];
                const aCells = oRow.getCells();
                for (let j = 0; j < aCells.length; j++) {
                    if (aCells[j].getItems && aCells[j].getItems().some(item => item === oButton)) {
                        iRowIndex = oRow.getIndex();
                        break;
                    }
                }
                if (iRowIndex !== -1) break;
            }

            if (iRowIndex === 0) {
                this.oRouter.navTo("cogiList", {
                    checkItem: encodeURIComponent(oData.checkItem || ""),
                    id: oData.ID || ""
                });
            } else if (iRowIndex === 1) {
                this.oRouter.navTo("costCenterAnalysis");
            } else {
                MessageToast.show("该功能暂未实现，敬请期待");
            }
        },

        onReset: function() {
            const oView = this.getView();
            oView.byId("companyCodeInput").setSelectedKey("");
            oView.byId("plantInput").setSelectedKey("");
            oView.byId("postingTimePicker").setValue("2025.10");
            oView.getModel('view').setProperty('/CheckResults', []);
            MessageToast.show("查询条件已重置");
        },

        onSearch: function(oEvent) {
            const sQuery = oEvent.getParameter("query");
            this._applySearchFilter(sQuery);
        },

        onLiveSearch: function(oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            this._applySearchFilter(sQuery);
        },

        _applySearchFilter: function(sQuery) {
            const oTable = this.getView().byId("precheckTable");
            const oBinding = oTable.getBinding("rows");
            if (sQuery) {
                const aFilters = [
                    new Filter("checkItem", FilterOperator.Contains, sQuery),
                    new Filter("checkResult", FilterOperator.Contains, sQuery),
                    new Filter("suggestedAction", FilterOperator.Contains, sQuery)
                ];
                oBinding.filter(new Filter({ filters: aFilters, and: false }));
            } else {
                oBinding.filter([]);
            }
        },

        onOpenFilterDialog: function() { MessageToast.show("高级筛选功能开发中..."); },
        onOpenColumnDialog: function() { MessageToast.show("列设置功能开发中..."); },
        onExportToExcel: function() { MessageToast.show("导出Excel功能开发中..."); },
        onSaveTableView: function() { MessageToast.show("表格视图已保存"); },

        onResetColumnWidth: function() {
            const oTable = this.byId("precheckTable");
            oTable.getColumns().forEach(oColumn => {
                const sColumnId = oColumn.getId().split("--").pop();
                const widths = {
                    idColumn: "80px", alertTypeColumn: "120px", checkItemColumn: "200px",
                    checkResultColumn: "300px", suggestedActionColumn: "300px",
                    suggestionColumn: "120px", isAgentColumn: "100px"
                };
                if (widths[sColumnId]) {
                    oColumn.setWidth(widths[sColumnId]);
                }
            });
            MessageToast.show("列宽已重置");
        },

        formatAlertIcon: function(sAlertType) {
            const icons = { "红灯": "sap-icon://message-error", "黄灯": "sap-icon://message-warning", "绿灯": "sap-icon://message-success" };
            return icons[sAlertType] || "";
        },

        formatAlertColor: function(sAlertType) {
            const colors = { "红灯": "Negative", "黄灯": "Critical", "绿灯": "Positive" };
            return colors[sAlertType] || "Default";
        },

        formatAlertText: function(sAlertType) {
            const texts = { "红灯": "报错", "黄灯": "警告", "绿灯": "通过" };
            return texts[sAlertType] || sAlertType;
        },

        formatRowHighlightColor: function(sAlertType) {
            const colors = { "红灯": "Error", "黄灯": "Warning", "绿灯": "Success" };
            return colors[sAlertType] || "None";
        },

        onExit: function() {
            if (this._oAIPopover) {
                this._oAIPopover.destroy();
            }
        }
    });
});
