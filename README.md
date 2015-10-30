# masterpassword for firefox
Master Password implemented as a Firefox extension

This is a firefox addon implementing the masterpassword algorithm invented by Maarten Billemont. You can visit his website at [masterpasswordapp.com](http://masterpasswordapp.com). 

**Please note that this plugin is not affiliated with Mr Billemont**

# Installation
Download from the Mozilla addon store: 
* [Latest beta](https://addons.mozilla.org/firefox/downloads/latest-beta/583040/addon-583040-latest.xpi)
* [Latest stable](https://addons.mozilla.org/firefox/downloads/latest/583040/addon-583040-latest.xpi)

or from the [github release pages](https://github.com/ttyridal/masterpassword-firefox/releases)

# Privacy mode
This addon is marked as respecting privacy mode.  When used from a private window no username or site settings will be stored. (note that settings -> privacy -> "firefox will never remember history" makes all your browsing considered private)

# Changing the site name
Many sites (like google) have localized url's (google.de, google.co.uk etc). It is recommended that you use the global (ie google.com) as the site name in such cases.

When you first open masterpassword on a localized domain, that domain will be suggested in masterpassword. You can change this. It will be remembered for your next visit.

If you have several accounts at a domain, it is suggested to prefix the site name with something like "username@" (ie myself@google.com). The site name in masterpassword will change to a dropdown if you have multiple variants.

# Algorithm versions and compatibility
The MasterPassword algorithm have gone through several revisions as bugs and unfortunate design descisions have
been discovered. This addon implements v3 of the algorithm. You should have no problem interoperating with other
apps using the same version. Additionally you will get the same passwords for apps using the v2, as long as your master
user name only contains [ascii](https://en.wikipedia.org/wiki/ASCII) letters, numbers and symbols. In particular that means 
you should avoid non english/latin characters like æ,ø,å,ß,€ and similar in your name, if you need to mix v2 and v3.


# Differences on name and phrase type passwords
`version >= 2.0rc2`

There was a descrepancy between how MasterPassword for Firefox and other implementations handled
passwords with the type *name* and *phrase*. This has been corrected in versions after 2.0rc2. To get the old
behaviour select the *name (v)* or *phrase (v)* option.

Specifically, versions prior to 2.0rc2 forced the *variant* for such types to be respectively *login* or *answer*.
The variant concept is not commonly available in other implementations.


# System password vaults
`version >= 2.0pre3`

The plugin can store your master key in your OS' key store (ie GNOME Keyring, KWallet, OSX Keychain or Windows Password Vault).
This feature is disabled by default and must be enabled in the addon preferences menu.

Keeping your passwords in MasterPassword is relatively secure, given that your master key is not easily guessed.

These system password vaults have a varying degree of protection (encrypted on disk etc), but are generally not
protecting you from attacks while you are logged in (typically, any program can access all passwords). Some (hey
windows) even "roam" your password by default. Sounds nice, but that basically means that your passwords are floating
around the internet, hopefully well encrypted.

In summary, your master key is kept safest when stored only between your ears. If you, however, accept the risks, it is quite
convenient and the feature is there for you.
