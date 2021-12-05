/* parseUri JS v0.1.1, by Steven Levithan <http://stevenlevithan.com>
Splits any well-formed URI into the following parts (all are optional):
----------------------
- source (since the exec method returns the entire match as key 0, we might as well use it)
- protocol (i.e., scheme)
- authority (includes both the domain and port)
  - domain (i.e., host; can be an IP address)
  - port
- path (includes both the directory path and filename)
  - directoryPath (supports directories with periods, and without a trailing backslash)
  - fileName
- query (does not include the leading question mark)
- anchor (i.e., fragment) */

// source http://blog.stevenlevithan.com/archives/parseuri-split-url

export function parseUri(sourceUri){
    var uriPartNames = ["source","protocol","authority","domain","port","path","directoryPath","fileName","query","anchor"],
    uriParts = new RegExp("^(?:([^:/?#.]+):)?(?://)?(([^:/?#]*)(?::(\\d*))?)((/(?:[^?#](?![^?#/]*\\.[^?#/.]+(?:[\\?#]|$)))*/?)?([^?#/]*))?(?:\\?([^#]*))?(?:#(.*))?").exec(sourceUri),
    uri = {};
    for(var i = 0; i < 10; i++)
        uri[uriPartNames[i]] = uriParts[i] ? uriParts[i] : "";
    if(uri.directoryPath.length > 0)
        uri.directoryPath = uri.directoryPath.replace(/\/?$/, "/");
    return uri;
}

