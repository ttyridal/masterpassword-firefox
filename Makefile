all: chrome firefox edge

CHROMEDST:=_build/chrome/
FFDST:=_build/firefox/
EDGEDST:=_build/edge/

LIBSCRYPT:=ext/webextension/src/lib/scrypt-asm.js
PSLLOOKUP:=ext/webextension/src/lib/psllookup.json.gz

clean:
	rm -Rf _build/*



chrome: $(LIBSCRYPT) $(PSLLOOKUP)
	mkdir -p $(CHROMEDST)
	cp -r ext/webextension/icons $(CHROMEDST)
	cp ext/chromeext/manifest.json $(CHROMEDST)
	cd ext/webextension && find src -type f -not -name '*test.js' | cpio -p -dumv ../../$(CHROMEDST)
	cd $(CHROMEDST) && zip -r ../masterpassword-chrome.zip *

firefox: $(LIBSCRYPT) $(PSLLOOKUP)
	mkdir -p $(FFDST)
	cp -r ext/webextension/icons $(FFDST)
	cp ext/firefoxext/manifest.json $(FFDST)
	cd ext/webextension && find src -type f -not -name '*test.js' | cpio -p -dumv ../../$(FFDST)
	cd $(FFDST) && zip -r ../masterpassword-firefox.zip *

edge: $(LIBSCRYPT) $(PSLLOOKUP)
	mkdir -p $(EDGEDST)
	cp -r ext/webextension/icons $(EDGEDST)
	cp ext/edgeext/manifest.json $(EDGEDST)
	cd ext/webextension && find src -type f -not -name '*test.js' | cpio -p -dumv ../../$(EDGEDST)
	cd $(EDGEDST) && zip -r ../masterpassword-edge.zip *
