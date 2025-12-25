/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["finprecheck/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
