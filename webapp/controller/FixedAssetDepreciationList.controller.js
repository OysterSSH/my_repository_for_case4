sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/export/library",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function(Controller, History, JSONModel, MessageToast, Spreadsheet, exportLibrary, MessageBox, Filter, FilterOperator) {
    "use strict";

    const EdmType = exportLibrary.EdmType;

    return Controller.extend("finprecheck.controller.FixedAssetDepreciationList", {
        onInit: function() {
            // Get Router instance
            this.oRouter = this.getOwnerComponent().getRouter();
            
            // Register route pattern matched handler
            this.oRouter.getRoute("fixedAssetDepreciationList").attachPatternMatched(this._onObjectMatched, this);
            
            // Initialize view model
            const oViewModel = new JSONModel({
                busy: false,
                delay: 0,
                FixedAssetData: [] // Initialize empty array
            });
            this.getView().setModel(oViewModel, "view");
            
            // CPI配置 - 通过本地后端代理调用
            this.CPI_CONFIG = {
                url: "http://localhost:3000/api/fixedasset"
            };
            
            // Set default month to 2025-10
            this._setDefaultMonth();
        },

        _setDefaultMonth: function() {
            // Set default value after view rendering is complete
            this.getView().addEventDelegate({
                onAfterRendering: function() {
                    const oMonthPicker = this.byId("monthPicker");
                    if (oMonthPicker && !oMonthPicker.getValue()) {
                        oMonthPicker.setValue("2025-10");
                    }
                }.bind(this)
            });
        },

        _onObjectMatched: function(oEvent) {
            const sCheckItem = decodeURIComponent(oEvent.getParameter("arguments").checkItem || "");
            
            // Ensure month picker has default value
            const oMonthPicker = this.byId("monthPicker");
            if (oMonthPicker && !oMonthPicker.getValue()) {
                oMonthPicker.setValue("2025-10");
            }
            
            this._loadFixedAssetData(sCheckItem);
        },

        _loadFixedAssetData: function(sCheckItem) {
            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/busy", true);

            // Get month picker value
            const oMonthPicker = this.byId("monthPicker");
            const sMonth = oMonthPicker ? oMonthPicker.getValue() : "2025-10";

            console.log("=== 开始从CPI加载固定资产数据 ===");
            console.log("请求月份:", sMonth);

            // Call CPI to get all fixed asset fields
            this._fetchFixedAssetDataFromCPI(sMonth)
                .then((aCPIData) => {
                    console.log("✅ CPI返回成功，数据条数:", aCPIData.length);
                    console.log("原始CPI数据（全部）:", JSON.stringify(aCPIData, null, 2));
                    
                    // 直接使用CPI返回的数据，不再合并Mock
                    const aProcessedData = aCPIData.map((oCPIItem, index) => ({
                        index: index + 1,
                        ...oCPIItem // 展开所有CPI字段
                    }));
                    
                    console.log("处理后的数据（前3条）:", JSON.stringify(aProcessedData.slice(0, 3), null, 2));
                    
                    oViewModel.setProperty("/FixedAssetData", aProcessedData);
                    MessageToast.show(`✅ 从CPI成功加载 ${aProcessedData.length} 条固定资产数据`);
                })
                .catch((error) => {
                    console.error("❌ CPI调用失败:", error);
                    MessageBox.error(`加载固定资产数据失败: ${error.message}\n请检查后端服务`);
                    oViewModel.setProperty("/FixedAssetData", []);
                })
                .finally(() => {
                    oViewModel.setProperty("/busy", false);
                    console.log("=== 固定资产数据加载完成 ===");
                });
        },

        _fetchFixedAssetDataFromCPI: function(sMonth) {
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
                    
                    // Assume data is in data.d.results or directly an array
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

        _loadMockData: function(oViewModel) {
            console.log("⚠️ 使用本地Mock数据作为备用");
            const oFixedAssetModel = this.getOwnerComponent().getModel("fixedAssetDepreciationItems");
            const aAllData = oFixedAssetModel.getData();
            
            if (aAllData && aAllData.length > 0) {
                const aData = aAllData.map((oData, index) => ({
                    index: index + 1,
                    sequenceNumber: oData.sequenceNumber,
                    assetNumber: oData.assetNumber,
                    assetDescription: oData.assetDescription,
                    acquisitionDate: oData.acquisitionDate,
                    acquisitionValue: oData.acquisitionValue,
                    accumulatedDepreciation: oData.accumulatedDepreciation,
                    lastDepreciationDate: oData.lastDepreciationDate,
                    errorDesc: oData.errorDesc,
                    aiSuggestion: oData.suggestedAction
                }));
                oViewModel.setProperty("/FixedAssetData", aData);
                console.log("📦 Mock数据加载完成，条数:", aData.length);
                MessageToast.show("⚠️ 使用本地mock数据");
            }
        },

        // Table search functionality (placeholder method)
        onTableSearch: function(oEvent) {
            MessageToast.show("Table search functionality under development...");
        },

        onTableLiveSearch: function(oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const oTable = this.byId("fixedAssetTable");
            const oBinding = oTable.getBinding("rows");
            
            if (!oBinding) {
                return;
            }

            const aFilters = [];
            if (sQuery && sQuery.length > 0) {
                const aColumns = ["assetNumber", "assetDescription", "errorDesc", "aiSuggestion"];
                const aColumnFilters = aColumns.map(sColumn => 
                    new Filter(sColumn, FilterOperator.Contains, sQuery)
                );
                aFilters.push(new Filter({
                    filters: aColumnFilters,
                    and: false
                }));
            }

            oBinding.filter(aFilters, "Application");
        },

        onSearch: function() {
            MessageToast.show("Query completed");
        },

        onExport: function() {
            const oTable = this.byId("fixedAssetTable");
            const oBinding = oTable.getBinding("rows");
            
            if (!oBinding || oBinding.getLength() === 0) {
                MessageToast.show("No data to export");
                return;
            }

            const aCols = this._createColumnConfig();
            const oSettings = {
                workbook: {
                    columns: aCols,
                    hierarchyLevel: 'Level'
                },
                dataSource: oBinding,
                fileName: 'FixedAssetDepreciation.xlsx',
                worker: false
            };

            const oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function() {
                oSheet.destroy();
            });
        },

        _createColumnConfig: function() {
            return [
                { label: 'Index', property: 'index', type: EdmType.Number },
                { label: 'Asset Number', property: 'assetNumber', type: EdmType.String },
                { label: 'Asset Description', property: 'assetDescription', type: EdmType.String, width: 30 },
                { label: 'Acquisition Date', property: 'acquisitionDate', type: EdmType.Date },
                { label: 'Acquisition Value', property: 'acquisitionValue', type: EdmType.Number },
                { label: 'Accumulated Depreciation', property: 'accumulatedDepreciation', type: EdmType.Number },
                { label: 'Last Depreciation Date', property: 'lastDepreciationDate', type: EdmType.Date },
                { label: 'Error Description', property: 'errorDesc', type: EdmType.String, width: 30 },
                { label: 'AI Suggestion', property: 'aiSuggestion', type: EdmType.String, width: 35 }
            ];
        },

        onCommunicationDefault: function() {
            MessageToast.show("Communication functionality");
        },

        onAddComment: function() {
            MessageToast.show("Add comment functionality under development...");
        },

        onSendNotification: function() {
            const oTable = this.byId("fixedAssetTable");
            const aSelectedIndices = oTable.getSelectedIndices();
            
            if (aSelectedIndices.length === 0) {
                MessageBox.warning("Please select at least one asset");
                return;
            }

            const oDialog = this.byId("sendNotificationDialog");
            oDialog.open();
        },

        onSendEmail: function() {
            MessageToast.show("Send email functionality under development...");
        },

        onMarkCompleted: function() {
            MessageToast.show("Mark as completed functionality under development...");
        },

        onDueDateChange: function(oEvent) {
            // Handle due date change
        },

        onConfirmSendNotification: function() {
            const oDueDatePicker = this.byId("dueDatePicker");
            const oRecipientComboBox = this.byId("recipientComboBox");
            const oCommentTextArea = this.byId("notificationComment");

            const sDueDate = oDueDatePicker.getValue();
            const sRecipient = oRecipientComboBox.getSelectedKey();
            const sComment = oCommentTextArea.getValue();

            if (!sDueDate || !sRecipient || !sComment) {
                MessageBox.error("Please fill in all required fields");
                return;
            }

            MessageToast.show("Notification sent successfully");
            
            this.byId("sendNotificationDialog").close();
            this._clearNotificationDialog();
        },

        onCancelSendNotification: function() {
            this.byId("sendNotificationDialog").close();
            this._clearNotificationDialog();
        },

        _clearNotificationDialog: function() {
            this.byId("dueDatePicker").setValue("");
            this.byId("recipientComboBox").setSelectedKey("");
            this.byId("notificationComment").setValue("");
        },

        onOpenFilterDialog: function() {
            MessageToast.show("Advanced filter functionality under development...");
        },

        onOpenColumnDialog: function() {
            MessageToast.show("Show/hide columns functionality under development...");
        },

        onResetColumnWidth: function() {
            MessageToast.show("Column width reset");
        },

        onExportToExcel: function() {
            this.onExport();
        },

        onSaveTableView: function() {
            MessageToast.show("Table view saved");
        },

        onSelectionChange: function(oEvent) {
            // Handle row selection change
        },

        onNavBack: function() {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.oRouter.navTo("Routefin-precheck", {}, true);
            }
        }
    });
});
