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
            
            // Get OData V4 model
            this.oModel = this.getOwnerComponent().getModel();
            
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
            const oFixedAssetModel = this.getOwnerComponent().getModel("fixedAssetDepreciationItems");

            oViewModel.setProperty("/busy", true);

            const processData = () => {
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
                }
                oViewModel.setProperty("/busy", false);
            };

            if (oFixedAssetModel.getData() && oFixedAssetModel.getData().length > 0) {
                processData();
            } else {
                oFixedAssetModel.attachRequestCompleted(processData);
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
