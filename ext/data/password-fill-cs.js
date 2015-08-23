self.port.once("the_password", function (d) {
    if (document.activeElement && 
        document.activeElement.tagName &&
        document.activeElement.tagName == "INPUT" &&
        document.activeElement.type == "password") 
    {
        document.activeElement.value = d;
    }
});
