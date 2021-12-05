
export function mockStorageGet(possibleValues) {
    if (typeof possibleValues === 'undefined')
        possibleValues = {};
    return (key, cb) => {
        let res = {};
        // default values
        if (!!key && key.constructor === Object) {
            Object.assign(res, key);
            key = Object.keys(key);
        }
        if (typeof key === 'string')
            key = [key];

        for (let k of key)
            if (k in possibleValues)
            res[k] = typeof possibleValues[k] !== 'undefined' ? possibleValues[k] : res[k];

        cb(res);
    };
}
