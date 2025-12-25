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

    return Controller.extend("finprecheck.controller.COGIList", {
        onInit: function() {
            // 获取Router实例
            this.oRouter = this.getOwnerComponent().getRouter();
            
            // 注册路由匹配处理
            this.oRouter.getRoute("cogiList").attachPatternMatched(this._onObjectMatched, this);
            
            // 初始化视图模型
            const oViewModel = new JSONModel({
                busy: false,
                delay: 0,
                COGIData: [] // 初始化空数组
            });
            this.getView().setModel(oViewModel, "view");
            
            // 获取OData V4模型
            this.oModel = this.getOwnerComponent().getModel();
            
            // 设置默认月份为2025-10
            this._setDefaultMonth();
        },

        _setDefaultMonth: function() {
            // 在视图渲染完成后设置默认值
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
            
            // 确保月份选择器有默认值
            const oMonthPicker = this.byId("monthPicker");
            if (oMonthPicker && !oMonthPicker.getValue()) {
                oMonthPicker.setValue("2025-10");
            }
            
            this._loadCOGIData(sCheckItem);
        },

        _loadCOGIData: function(sCheckItem) {
            const oViewModel = this.getView().getModel("view");
            const oCogiModel = this.getOwnerComponent().getModel("cogiResultItems");

            oViewModel.setProperty("/busy", true);

            const processData = () => {
                const aAllData = oCogiModel.getData();
                if (aAllData && aAllData.length > 0) {
                    const aData = aAllData.map((oData, index) => ({
                        index: index + 1,
                        sequenceNumber: oData.sequenceNumber,
                        productionOrder: oData.productionOrder,
                        material: oData.materialNumber,
                        materialDesc: oData.materialDesc,
                        plant: oData.plant,
                        storagePlace: oData.storageLocation,
                        movementType: oData.movementType,
                        errorDesc: oData.errorDesc,
                        aiSuggestion: oData.suggestedAction
                    }));
                    oViewModel.setProperty("/COGIData", aData);
                }
                oViewModel.setProperty("/busy", false);
            };

            if (oCogiModel.getData() && oCogiModel.getData().length > 0) {
                processData();
            } else {
                oCogiModel.attachRequestCompleted(processData);
            }
        },

        // 新增表格搜索功能（占位方法）
        onTableSearch: function(oEvent) {
            // 表格搜索功能 - 保持不实现
            MessageToast.show("表格搜索功能开发中...");
        },

        onTableLiveSearch: function(oEvent) {
            // 实时搜索功能 - 保持不实现
            // 可以在这里添加实时搜索逻辑
        },

        onOpenFilterDialog: function() {
            // 高级筛选功能 - 保持不实现
            MessageToast.show("高级筛选功能开发中...");
        },

        onOpenColumnDialog: function() {
            // 显示/隐藏列功能 - 保持不实现
            MessageToast.show("列设置功能开发中...");
        },

        onResetColumnWidth: function() {
            // 重置列宽功能 - 保持不实现
            MessageToast.show("重置列宽功能开发中...");
        },

        onExportToExcel: function() {
            // 调用原有的导出功能
            this.onExport();
        },

        onSaveTableView: function() {
            // 保存视图功能 - 保持不实现
            MessageToast.show("保存视图功能开发中...");
        },

        // 沟通按钮相关方法（保持不变）
        onCommunicationDefault: function() {
            MessageToast.show("请从下拉菜单中选择具体操作");
        },

        onAddComment: function() {
            MessageToast.show("添加注释功能开发中...");
        },

        onSendNotification: function() {
            const oDialog = this.byId("sendNotificationDialog");
            
            // 重置对话框内容
            this._resetNotificationDialog();
            
            // 打开对话框
            oDialog.open();
        },

        onSendEmail: function() {
            MessageToast.show("发送电子邮件功能开发中...");
        },

        onMarkCompleted: function() {
            const oTable = this.byId("cogiTable");
            const aSelectedIndices = oTable.getSelectedIndices();
            
            if (aSelectedIndices.length === 0) {
                MessageToast.show("请先选择要标记为已完成的记录");
                return;
            }
            
            MessageBox.confirm(`确定要将选中的 ${aSelectedIndices.length} 条记录标记为已完成吗？`, {
                onClose: function(sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        MessageToast.show(`已将 ${aSelectedIndices.length} 条记录标记为已完成`);
                        // 这里可以添加实际的标记逻辑
                    }
                }
            });
        },

        _resetNotificationDialog: function() {
            // 清空到期日期
            this.byId("dueDatePicker").setValue("");
            
            // 清空收件人选择
            this.byId("recipientComboBox").setSelectedKey("");
            
            // 设置默认注释内容
            const sDefaultComment = "请在{到期日期}之前完成所有COGI报错项的处理。有问题请及时联系。谢谢！";
            this.byId("notificationComment").setValue(sDefaultComment);
        },

        onDueDateChange: function(oEvent) {
            const sDueDate = oEvent.getParameter("value");
            if (sDueDate) {
                // 更新注释中的到期日期
                const sComment = `请在${sDueDate}之前完成所有COGI报错项的处理。有问题请及时联系。谢谢！`;
                this.byId("notificationComment").setValue(sComment);
            }
        },

        onConfirmSendNotification: function() {
            const sDueDate = this.byId("dueDatePicker").getValue();
            const sRecipient = this.byId("recipientComboBox").getSelectedKey();
            const sComment = this.byId("notificationComment").getValue();
            
            // 验证必填字段
            if (!sDueDate) {
                MessageToast.show("请选择到期日期");
                return;
            }
            
            if (!sRecipient) {
                MessageToast.show("请选择收件人");
                return;
            }
            
            if (!sComment.trim()) {
                MessageToast.show("请输入注释内容");
                return;
            }
            
            // 获取选中的记录数量
            const oTable = this.byId("cogiTable");
            const aSelectedIndices = oTable.getSelectedIndices();
            
            if (aSelectedIndices.length === 0) {
                MessageToast.show("请先选择要通知的记录");
                return;
            }
            
            // 模拟发送通知
            MessageBox.success(`通知已成功发送给 ${sRecipient}！\n到期日期：${sDueDate}\n涉及记录：${aSelectedIndices.length} 条`, {
                onClose: function() {
                    this.byId("sendNotificationDialog").close();
                }.bind(this)
            });
        },

        onCancelSendNotification: function() {
            this.byId("sendNotificationDialog").close();
        },

        // 查询功能（保持原有逻辑）
        onSearch: function() {
            const sMonth = this.byId("monthPicker").getValue();
            if (!sMonth) {
                MessageToast.show("请选择月份");
                return;
            }
            
            // 重新加载数据
            this._loadCOGIData();
            MessageToast.show(`按月份 ${sMonth} 进行筛选`);
        },

        // 导出功能（适配新的数据结构）
        onExport: function() {
            const oViewModel = this.getView().getModel("view");
            const aData = oViewModel.getProperty("/COGIData");
            
            if (!aData || aData.length === 0) {
                MessageToast.show("没有数据可以导出");
                return;
            }

            // 获取当前选择的月份用于文件名
            const sMonth = this.byId("monthPicker").getValue() || "2025-10";
            
            const aColumns = [
                { label: "序号", property: "index", type: EdmType.String },
                { label: "生产订单", property: "productionOrder", type: EdmType.String },
                { label: "物料号", property: "material", type: EdmType.String },
                { label: "物料描述", property: "materialDesc", type: EdmType.String },
                { label: "工厂", property: "plant", type: EdmType.String },
                { label: "存储地点", property: "storagePlace", type: EdmType.String },
                { label: "移动类型", property: "movementType", type: EdmType.String },
                { label: "错误描述", property: "errorDesc", type: EdmType.String },
                { label: "AI建议", property: "aiSuggestion", type: EdmType.String }
            ];

            const oSettings = {
                workbook: { columns: aColumns },
                dataSource: aData,
                fileName: `COGI清单_${sMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`
            };

            new Spreadsheet(oSettings).build();
        },

        // 选择变化事件（适配sap.ui.table.Table）
        onSelectionChange: function(oEvent) {
            const oTable = this.byId("cogiTable");
            const aSelectedIndices = oTable.getSelectedIndices();
            MessageToast.show(`已选择 ${aSelectedIndices.length} 条记录`);
        },

        onNavBack: function() {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.oRouter.navTo("index", {}, true);
            }
        }
    });
});
