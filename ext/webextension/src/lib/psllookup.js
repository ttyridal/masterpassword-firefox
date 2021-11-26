function loadImage(url) {
    let img = new Image();
    return new Promise(res=>{
        img.onload = ()=>{
            res(img);
        }
        img.src = url;
    });
}

async function getPixels(url) {
    let img = await loadImage(url);
    let canvas = document.createElement('canvas');
    canvas.height = img.height;
    canvas.width = img.width;
    let context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    return context.getImageData(0, 0, img.width, img.height).data;
}


function pixeldata_to_json(pixeldata) {
    pixeldata = pixeldata.filter((_,i)=> i%4 ==0);
    const blob = new Blob([pixeldata], {type: 'text/plain; charset=utf-8'});
    return blob.text();
}

export class PslLookup {
    constructor(args) {
        args = args || {};
        args = Object.assign({tableLoader: getPixels, tableurl: "./psllookup.json.png"}, args);
        this.psltable = args.tableLoader(args.tableurl)
        .then(pixeldata_to_json)
        .then(JSON.parse)
        .catch(e=>{console.log("something is failing",e)});
    }

    async waitTableReady() {
        let lut = await this.psltable;
        this.psltable = lut;
    }

    getPublicDomain(url) {
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
