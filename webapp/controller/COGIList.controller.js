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
            
            // CPI配置 - 通过本地后端代理调用
            this.CPI_CONFIG = {
                url: "http://localhost:3000/api/cogi"
            };
            
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
            
            // 自动从CPI加载数据
            this._loadCOGIData(sCheckItem);
        },

        _loadCOGIData: function(sCheckItem) {
            const oViewModel = this.getView().getModel("view");
            const that = this; // 保存上下文
            
            oViewModel.setProperty("/busy", true);

            // 获取月份选择器的值
            const oMonthPicker = this.byId("monthPicker");
            const sMonth = oMonthPicker ? oMonthPicker.getValue() : "2025-10";
            
            // 从月份中提取年月（格式：2025-10 -> 2025/10）
            const [year, month] = sMonth.split("-");
            const sPostingPeriod = `${year}/${month}`;

            console.log("=== 开始从CPI加载COGI数据 ===");
            console.log("请求月份:", sMonth);
            console.log("过账期间:", sPostingPeriod);

            // 调用CPI接口获取4个字段
            this._fetchCOGIDataFromCPI(sPostingPeriod)
                .then((aCPIData) => {
                    console.log("✅ CPI返回成功，数据条数:", aCPIData.length);
                    console.log("CPI数据（前3条）:", JSON.stringify(aCPIData.slice(0, 3), null, 2));
                    
                    // 加载Mock数据
                    return that._loadMockData().then((aMockData) => {
                        console.log("✅ Mock数据加载成功，数据条数:", aMockData.length);
                        
                        // 合并CPI数据和Mock数据
                        const aProcessedData = aCPIData.map((oCPIItem, index) => {
                            const oMockItem = aMockData[index] || {};
                            return {
                                index: index + 1,
                                // CPI的4个字段
                                plant: oCPIItem.werks_d,
                                material: oCPIItem.matnr,
                                productionOrder: oCPIItem.aufnr,
                                movementType: oCPIItem.bwart,
                                // Mock数据的其他字段
                                materialDesc: oMockItem.materialDesc || "",
                                storagePlace: oMockItem.storageLocation || "",
                                errorDesc: oMockItem.errorDesc || "",
                                aiSuggestion: oMockItem.suggestedAction || "",
                                // 保留CPI的其他原始字段（用于调试）
                                werks_d: oCPIItem.werks_d,
                                matnr: oCPIItem.matnr,
                                aufnr: oCPIItem.aufnr,
                                bwart: oCPIItem.bwart
                            };
                        });
                        
                        console.log("合并后的数据（前3条）:", JSON.stringify(aProcessedData.slice(0, 3), null, 2));
                        
                        oViewModel.setProperty("/COGIData", aProcessedData);
                        MessageToast.show(`✅ 成功加载 ${aProcessedData.length} 条COGI数据（CPI + Mock）`);
                        return aProcessedData; // 返回数据供后续使用
                    });
                })
                .catch((error) => {
                    console.error("❌ 数据加载失败:", error);
                    const errorMsg = error.message || String(error);
                    MessageBox.error(`加载COGI数据失败: ${errorMsg}\n请检查后端服务`);
                    oViewModel.setProperty("/COGIData", []);
                })
                .finally(() => {
                    oViewModel.setProperty("/busy", false);
                    console.log("=== COGI数据加载完成 ===");
                });
        },

        _loadMockData: function() {
            return new Promise((resolve, reject) => {
                const sPath = sap.ui.require.toUrl("finprecheck/model/COGIResultItems.json");
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

        _fetchCOGIDataFromCPI: function(sPostingPeriod) {
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
                    
                    // 假设返回的数据在data.d.results或直接是数组
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
            
            // 重新加载数据（会调用CPI接口）
            this._loadCOGIData();
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
