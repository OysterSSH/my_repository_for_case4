/*global QUnit*/

sap.ui.define([
	"finprecheck/controller/fin-precheck.controller"
], function (Controller) {
	"use strict";

	QUnit.module("fin-precheck Controller");

	QUnit.test("I should test the fin-precheck controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
