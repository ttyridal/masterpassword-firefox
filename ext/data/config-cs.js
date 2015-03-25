window.addEventListener("masterpassword-siteupdate", function(event) {
    self.port.emit('configstore', event.detail);
}, false);

self.port.on("configload", function (d) {
    var e = document.createEvent('CustomEvent');
    var cloned = cloneInto(d, document.defaultView);
    e.initCustomEvent("masterpassword-configload", true, true, cloned);
    document.documentElement.dispatchEvent(e);
});

self.port.emit('configload', 'lots of fun');
