sap.ui.define([], function () {
    "use strict";

    // 移除FLP Shell的左右边距，让应用全屏显示
    return {
        init: function () {
            // 等待Shell渲染完成后移除边距
            var checkShell = setInterval(function() {
                var oShell = sap.ui.getCore().byId("shell");
                if (oShell) {
                    // 设置Shell为全屏模式
                    oShell.setAppWidthLimited(false);
                    clearInterval(checkShell);
                }
                
                // 通过CSS也确保移除边距
                var styleEl = document.createElement('style');
                styleEl.textContent = `
                    .sapUshellShellCntnt,
                    .sapMShellCentralBox,
                    .sapUshellApplicationContainer {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .sapUshellShellHead ~ div {
                        max-width: 100% !important;
                    }
                `;
                document.head.appendChild(styleEl);
            }, 100);
            
            // 5秒后停止检查
            setTimeout(function() {
                clearInterval(checkShell);
            }, 5000);
        }
    };
});
