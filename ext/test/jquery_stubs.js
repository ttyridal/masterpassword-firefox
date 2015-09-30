function $() {
    return {
        'on': function(){}
    };
}

$.each = function(a, cb) {
    var x;
    for (x in a) {
        if (!a.hasOwnProperty(x)) continue;
        cb(x, a[x]);
    }
}
