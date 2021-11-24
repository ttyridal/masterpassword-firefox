# masterpassword for browsers
Master Password algorithm implemented as a browser extension, with the intent to serve all webextension based
browsers (Chrome, Edge, Firefox)

This is a browser extension implementing the masterpassword algorithm invented by Maarten Billemont.
You can visit his website at [masterpasswordapp.com](http://masterpasswordapp.com).

**Please note that this plugin is not affiliated with Mr Billemont**

Regardings adoptions for Mobile (eg Android): Personally I have no interest for it, but pull requests will be
accepted as long as they don't deteriorate the experence on desktop versions.


# Compatible apps and what's about this "Spectre" thing
The general idea behind masterpassword is to mathematically derive a unique password from a "master password".
The idea and algorithm was published by Mr. Billemont as an open source MasterPasswordApp on iOS (android and
others followed thereafter). The idea cought on and several **compatible** implementations emerged from
various developers. typically because there was no app for their preferred environment. As is the reason
for the existance of this project.

In 2021, Mr. Billemont re-released his app-efforts under a new name: Spectre. Spectre is still MasterPassword,
just with another name, in other words just "another compatible implementation". Mr. Billemont sited among other
things technical debt for motivation. I guess differentiation/branding could be added to that.

The important takeaway is that the masterpassword algorithm is free and licensed under GPL. The release of
Spectre has no consequence for the algorithm, the masterpassword ecosystem or this browser addon.

# Installation

Visit your browser's store and click the install button:
[Chrome](https://chrome.google.com/webstore/detail/masterpassword-for-chrome/hifbblnjfcimjnlhibannjoclibgedmd?hl=en-US&gl=US)
[Firefox](https://addons.mozilla.org/en-US/firefox/addon/masterpassword-firefox/)


# Documentation
Please refer to the [wiki](https://github.com/ttyridal/masterpassword-firefox/wiki)

## Incognito mode
Exensions are by default prevented from running in incognito mode. You can allow the masterpassword exension in by visiting
the [about:addons](about://addons) or [chrome://extensions/](chrome://extensions/) exension settings and check the box.
Masterpassword will *not* save site settings when in incognito mode.

## Changing the site name
Many sites (like google) have localized url's (google.de, google.co.uk etc). It is recommended that you use the
global (ie google.com) as the site name in such cases.

When you first open masterpassword on a localized domain, that domain will be suggested in masterpassword.
You can change this. It will be remembered for your next visit.

If you have several accounts at a domain, it is suggested to prefix the site name with something like
"username@" (ie myself@google.com). The site name in masterpassword will change to a dropdown if you have multiple variants.

## Algorithm versions and compatibility
The MasterPassword algorithm have gone through several revisions as bugs and unfortunate design descisions have
been discovered. This addon implements v3 of the algorithm. You should have no problem interoperating with other
apps using the same version. Additionally you will get the same passwords for apps using the v2, as long as your
master user name only contains [ascii](https://en.wikipedia.org/wiki/ASCII) letters, numbers and symbols. In
particular that means you should avoid non english/latin characters like æ,ø,å,ß,€ and similar in your name,
if you need to mix v2 and v3.


## Differences on name and phrase type passwords
`version >= 2.0`

There was a descrepancy between how MasterPassword for Firefox and other implementations handled
passwords with the type *name* and *phrase*. This has been corrected in versions after 2.0rc2. To get the old
behaviour select the *name (v)* or *phrase (v)* option.

Specifically, versions prior to 2.0rc2 forced the *variant* for such types to be respectively *login* or *answer*.
The variant concept is not commonly available in other implementations.
