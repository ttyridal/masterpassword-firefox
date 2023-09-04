export class PslLookup {
    constructor(args) {
        args = args || {};
        args = Object.assign({tableurl: "./psllookup.json.gz"}, args);

        this.psltable = fetch(args.tableurl).then(r=>r.body)
        .then(stream=>{
            const ds = new DecompressionStream('gzip');
            const decompressedStream = stream.pipeThrough(ds);
            return new Response(decompressedStream, {headers: { "Content-Type": "application/json"}}).json()
        })
        .catch(e=>{console.error("psllookup load failed",e); return undefined;});
    }

    async waitTableReady() {
        let lut = await this.psltable;
        this.psltable = lut;
    }

    getPublicDomain(url) {
        if (typeof this.psltable === 'undefined')
            throw new Error("PslLoopup not initialized");
        let lut = this.psltable;
        const parts = url.split('.').reverse();
        let res = [];
        let v;

        for (v=0; v < parts.length; v++) {
            const part = parts[v];
            if (!lut) break;
            if (part in lut) {
                res.push(part);
                lut = lut[part]
            }
            else if ('*' in lut) {
                res.push(part);
                lut = null;
            } else
                break;
        }
        if (v < parts.length)
            res.push(parts[v]);

        return res.reverse().join('.');
    }
}
