/** Mock CSInterface for web preview — no After Effects required */
function CSInterface() {}
CSInterface.prototype.evalScript = function (script, callback) {
    if (typeof callback === 'function') callback('');
};
CSInterface.prototype.getSystemPath = function () { return ''; };
CSInterface.prototype.getHostEnvironment = function () {
    return { appName: 'AEFT', appVersion: '26.0', appLocale: 'es_ES' };
};
CSInterface.prototype.setPanelFlyoutMenu = function () {};
CSInterface.prototype.addEventListener = function () {};
CSInterface.prototype.removeEventListener = function () {};
CSInterface.prototype.requestOpenExtension = function () {};
CSInterface.prototype.getExtensions = function () { return []; };
CSInterface.prototype.getExtensionID = function () { return 'preview'; };
CSInterface.prototype.openURLInDefaultBrowser = function () {};
