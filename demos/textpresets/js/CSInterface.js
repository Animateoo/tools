/** Mock CSInterface for web preview */
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

var SystemPath = {
    USER_DATA: "USER_DATA",
    COMMON_FILES: "COMMON_FILES",
    MY_DOCUMENTS: "MY_DOCUMENTS",
    APPLICATION: "APPLICATION",
    EXTENSION: "EXTENSION",
    HOST_APPLICATION: "HOST_APPLICATION"
};
var CSXSWindowType = {
    _PANEL: "Panel",
    _MODAL_DIALOG: "ModalDialog"
};
