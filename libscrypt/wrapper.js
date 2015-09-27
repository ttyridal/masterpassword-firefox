var mpw=function(name, password){
    var key,
        keyofs = Module.ccall('get_masterkey', 'number', [], []);

    if (!Module.ccall('mp_key', 'number', ['string','string'], [password,name]))
    {
        alert("keying failed");
        return null;
    }
    // the underlaying code will reuse the key memory. By taking
    // a copy here, we can reset it before the call.
    key = new Uint8Array(Module.HEAPU8.subarray(keyofs, keyofs+64));

    return {
        sitepassword : function(site,count,type){
            Module.HEAPU8.set(key, keyofs);
            return Module.ccall('mp_password', 'string', ['string','number','number'], [site,count,type.charCodeAt(0)]);
        },
        key_id : function() {
            Module.HEAPU8.set(key, keyofs);
            return Module.ccall('sha256_digest', 'string', ['number','number'], [keyofs, 64]);
        }
    };
};
