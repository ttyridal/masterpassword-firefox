function $() {
    return {
        'on': function(){}
    };
}

$.each = function(a, cb) {
    var x;
    for (x in a) {
        if (!a.hasOwnProperty(x)) continue;
        cb.apply(a[x], [x, a[x]]);
    }
};

$.trim = String.trim;
