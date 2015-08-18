/* Copyright Torbjorn Tyridal 2015

    This file is part of Masterpassword for Firefox.

    Foobar is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Foobar is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
*/


(function(){

 var stored_sites={};
 var username="";

function save_sites_to_backend() {
    var event = document.createEvent('CustomEvent');
    event.initCustomEvent("masterpassword-siteupdate", true, true, stored_sites);
    document.documentElement.dispatchEvent(event);
}

function stored_sites_table_append(domain,site,type,loginname,count,ver) {
    switch(type) {
        case 'x': type="Maximum"; break;
        case 'l': type="Long"; break;
        case 'm': type="Medium"; break;
        case 'b': type="Basic"; break;
        case 's': type="Short"; break;
        case 'i': type="Pin"; break;
        case 'n': type="Name"; break;
        case 'p': type="Phrase"; break;
        default: throw "Logic error";
    }
    $('#stored_sites').append('<tr><td>'+site+'<td><input class="domainvalue" type="text" data-old="'+
        domain+'" value="'+domain+'"><td>'+loginname+'<td>'+count+'<td>'+type+'<td>'+ver+
        '<td><img class="delete" src="delete.png">');
}

function read_mpsites(d){
    var ret=[],l,fheader={'format':-1};
    d = d.split("\n");
    if (!d.shift() == "# Master Password site export") throw "not a mpsites file";
    while((l = d.shift()) != "##"){}
    while((l = d.shift()) != "##"){
        l = l.split(":");
        if (l[0]=="# Format") fheader.format = 0+$.trim(l[1]);
    }
    if (fheader.format != 1) {
        console.log(fheader);
        throw "Unsupported mpsites format";
    }
    $.each(d, function(){
        var s,re = /([-0-9T:Z]+)  +([0-9]+)  +([0-9]+):([0-9]+):([0-9]+)  +([^\t]*)\t *([^\t]*)\t(.*)$/g;
        if (this.charAt(0)=="#") return true;
        s=re.exec(this);
        if (!s) return true;
        switch(s[3]){
          case '20': s[3]='s'; break;
          case '16': s[3]='x'; break;
          case '21': s[3]='i'; break;
          case '19': s[3]='b'; break;
          case '31': s[3]='p'; break;
          case '30': s[3]='n'; break;
          case '17': s[3]='l'; break;
          case '18': s[3]='m'; break;
          default:console.log('unknown password type, '+s[3]);
        }
        s={
            lastused: s[1],
            timesused: s[2],
            passtype: s[3],
            passalgo: s[4],
            passcnt: s[5],
            loginname: s[6],
            sitename: s[7],
            sitepass: s[8]
          };
        ret.push(s);
    });
    return ret;
}

window.addEventListener('masterpassword-configload', function(e){
    stored_sites = e.detail.sites;
    username = e.detail.username;
    $.each(stored_sites, function(domain,v){
        $.each(v, function(site, settings){
            if (settings.username === undefined)
                settings.username="";
            stored_sites_table_append(domain,site,settings.type,settings.username,settings.generation,"3");
        });
    });
});

$(document).on('dragover dragenter', function(e){
    e.preventDefault();
    e.stopPropagation();
});

$('#stored_sites').on('change','.domainvalue',function(e){
    var $t = $(this), domain = $t.attr('data-old'), newdomain = $t.val(), site;
    $t.attr('data-old', newdomain);
    $t=this;
    do { $t = $t.parentNode;
    } while($t.nodeName != 'TR');
    site=$($t).children('td:eq(0)').text();

    if (! (newdomain in stored_sites)) stored_sites[newdomain] = {};
    stored_sites[newdomain][site] = stored_sites[domain][site];
    delete stored_sites[domain][site];
    save_sites_to_backend();
});

$('#stored_sites').on('click','.delete',function(e){
    var $t, t = this;
    console.log(t);
    while (t.parentNode.nodeName != 'TR') t=t.parentNode;
    if (! t.parentNode.nodeName == 'TR') throw "logic error";
    t=t.parentNode;
    $t=$(t);

    delete stored_sites[$t.find('td:eq(1) > input').val()][$t.children('td:eq(0)').text()];
    $(t).remove();
    save_sites_to_backend();
});

$(document).on('drop', function(e){
    e.originalEvent.dataTransfer.dropEffect='move';
    e.preventDefault();
    e.stopPropagation();
    if (e.originalEvent.dataTransfer.files.length!=1) return;
    if (! /.*\.mpsites$/gi.test(e.originalEvent.dataTransfer.files[0].name)) {
        alert("need a .mpsites file");
        return;
    }
    var fr = new FileReader();
    fr.onload=function(x){
        var x = read_mpsites(x.target.result);
        $.each(x, function(){
            var y = this.sitename.split("@");
            if (y.length>1) this.sitesearch=y[1];
            else this.sitesearch=this.sitename;

            stored_sites_table_append(this.sitesearch,this.sitename,this.passtype,this.loginname,this.passcnt,this.passalgo);

            if (! (this.sitesearch in stored_sites)) stored_sites[this.sitesearch] = {};
            stored_sites[this.sitesearch][this.sitename] = {
                'generation':this.passcnt,
                'type':this.passtype,
                'username':this.loginname
            };
        });

        save_sites_to_backend();
    }
    fr.readAsText(e.originalEvent.dataTransfer.files[0]);

});

$('#export_mpsites').on('click',function(){
    var x = make_mpsites();
    start_data_download(x, 'firefox.mpsites');
});

function make_mpsites() {
    var a=[ '# Master Password site export\n',
        '#     Export of site names and stored passwords (unless device-private) encrypted with the master key.\n',
        '#\n',
        '##\n',
        '# Format: 1\n',
        '# Date: 2015-03-24T14:44:51Z\n',
        '# User Name: '+username+'\n',
        '# Full Name: '+username+'\n',
        '# Avatar: 0\n',
        '# Key ID:\n',
        '# Version: 2.2\n',
        '# Algorithm: 3\n',
        '# Default Type: 17\n',
        '# Passwords: PROTECTED\n',
        '##\n',
        '#\n',
        '#               Last     Times  Password                      Login\t                     Site\tSite\n',
        '#               used      used      type                       name\t                     name\tpassword\n'];

    $.each(stored_sites, function(domain,v){
        $.each(v, function(site, settings){
            var x;
            var loginname;
            switch(settings.type){
                case 's': x='20'; break;
                case 'x': x='16'; break;
                case 'i': x='21'; break;
                case 'b': x='19'; break;
                case 'p': x='31'; break;
                case 'n': x='30'; break;
                case 'l': x='17'; break;
                case 'm': x='18'; break;
                default: throw "unknown password type";
            }
            x+=':3:'+settings.generation;
            while (x.length<8) x=" "+x;
            while (site.length<25) site=" "+site;
            if (settings.username === undefined)
                loginname=""
            else
                loginname = settings.username.substring(0,25);
            while (loginname.length<25) loginname=" "+loginname;

            a.push('2015-03-23T13:06:35Z         0  '+x+'  '+loginname+'\t'+site+'\t\n');
        });
    });
    return a;
}

function start_data_download(stringarr,filename) {
    var a = window.document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob(stringarr, {type: 'text/plain'}));
    a.download = filename;

    // Append anchor to body.
    document.body.appendChild(a)
    a.click();

    // Remove anchor from body
    document.body.removeChild(a)
}


}());
