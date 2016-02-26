/*jshint browser:true, jquery:true, devel:true, nonstandard:true, -W055 */
/*globals self, unsafeWindow */

self.port.once("the_password", function (d) {
    if (document.activeElement &&
        document.activeElement.tagName &&
        document.activeElement.tagName === "INPUT" &&
        document.activeElement.type === "password")
    {
        document.activeElement.value = d;
        var el;

        if ('angular' in unsafeWindow)
            el = unsafeWindow.angular.element(document.activeElement);
        else if ('$' in unsafeWindow)
            el = unsafeWindow.$(document.activeElement);
        if (el)
            el.change();
    }
});
