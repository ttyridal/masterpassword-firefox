# masterpassword for firefox
Master Password implemented as a Firefox extension

-[addons.mozilla.org entry](https://addons.mozilla.org/en-US/firefox/addon/masterpassword-firefox/)

This is a firefox addon implementing the masterpassword algorithm invented by Maarten Billemont. You can visit his website at [masterpasswordapp.com](http://masterpasswordapp.com). 

**Please note that this plugin is not affiliated with Mr Billemont**

# Installation
Find it in the release pages or at -[addons.mozilla.org entry](https://addons.mozilla.org/en-US/firefox/addon/masterpassword-firefox/)

# Privacy mode
This addon is marked as respecting privacy mode.  When used from a private window no username or site settings will be stored. (note that settings -> privacy -> "firefox will never remember history" makes all your browsing considered private)

# Changing the site name
Many sites (like google) have localized url's (google.de, google.co.uk etc). It is recommended that you use the global (ie google.com) as the site name in such cases.

When you first open masterpassword on a localized domain, that domain will be suggested in masterpassword. You can change this. It will be remembered for your next visit.

If you have several accounts at a domain, it is suggested to prefix the site name with something like "username@" (ie myself@google.com). The site name in masterpassword will change to a dropdown if you have multiple variants.

# KWallet / GNOME Keyring security
`version >= 2.0pre1`

The plugin can store your master key in your OS' key store (ie GNOME Keyring or KWallet, Linux only!). This feature is turned off by default and must be enabled in the addon preferences menu. Before you do, please consider the following:

While both solutions claim to store the password in an encrypted database, you might as well just keep your passwords in a plain text file - with a big fat **PASSWORD** as name - and put that file on an encrypted disk. There is absolutely _no_ isolation against rouge software. Any client can connect to the server and request for every password stored there.

As with most things, it is a balancing act: if you feel that the convenience outweighs the risks, the feature is there for you.

