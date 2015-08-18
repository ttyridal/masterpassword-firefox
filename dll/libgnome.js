
function load_gnome_keyring1() {
    var lib;
    try {
    lib = ctypes.open('data/dll/libpwmgr_gnome.so');
    } catch(e) {
        console.log("failed to load dll libpwmgr_gnome");
        return null;
    }

    var init = lib.declare("init", ctypes.default_abi, ctypes.bool);
    if (!init) {
        console.log("Gnome password not available");
        return null;
    }

    var get_password = (function () {
        var getpw = lib.declare("get_password", ctypes.default_abi, ctypes.int, ctypes.char.ptr.ptr);
        var freepw = lib.declare("free_password", ctypes.default_abi, ctypes.void_t, ctypes.char.ptr);

        return function() {
            var res_str = new ctypes.char.ptr();
            var res = getpw(res_str.address());
            var s = res_str.readString();
            freepw(res_str);
            return s;
        }
    }());
    var set_password = (function () {
        var setpw = lib.declare("set_password", ctypes.default_abi, ctypes.int, ctypes.char.ptr);
        return function(pw) { return setpw(ctypes.char.array()(pw)); }
    }());

    return {'set_password':set_password, 'get_password':get_password};
}
