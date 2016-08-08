/*jshint browser:true, jquery:true, devel:true, nonstandard:true, -W055 */
/*globals self, unsafeWindow */

self.port.once("the_password", function (d) {
    if (document.activeElement &&
        document.activeElement.tagName &&
        document.activeElement.tagName === "INPUT" &&
        document.activeElement.type === "password")
    {
        document.activeElement.value = d;

        document.activeElement.dispatchEvent(
            new Event('change', {bubbles: true, cancelable: true}));
    }
});
