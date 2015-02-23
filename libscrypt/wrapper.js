var mpw=function(name, password){
    if (Module.ccall('mp_key', 'number', ['string','string'], [password,name]))
    {
        alert("keying failed");
    }
    return function(site,count,type){
        return Module.ccall('mp_password', 'string', ['string','number','number'], [site,count,type.charCodeAt(0)]);
    }
    
};
