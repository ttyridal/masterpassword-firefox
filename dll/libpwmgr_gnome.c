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

#define APP_NAME "masterpassword-for-firefox"
#define MAX_PASSWORD_LENGTH 100

#include <stdio.h>
#include <string.h>
#include "glib.h"
#include "gnome-keyring.h"

#define APPNAME "masterpassword-for-firefox"
#define USAGE "masterkey"

char const * lasterr;

GnomeKeyringPasswordSchema my_schema = {
  GNOME_KEYRING_ITEM_GENERIC_SECRET,
  {
       { "appname", GNOME_KEYRING_ATTRIBUTE_TYPE_STRING },
       { "usage", GNOME_KEYRING_ATTRIBUTE_TYPE_STRING },
       { NULL, 0 }
      },0,0,0
  };

int init(void) {
    return !! gnome_keyring_is_available();
}

void clear(void) {
}

void deinit(void) {
}

void free_password(char * p) {
    gnome_keyring_free_password(p);
}

int get_password(char ** p) {
    GnomeKeyringResult result;

    result = gnome_keyring_find_password_sync(&my_schema, p,
            "appname", APPNAME,
            "usage", USAGE,
            NULL);
    switch (result) {
        case GNOME_KEYRING_RESULT_OK:
            return 0;
        case GNOME_KEYRING_RESULT_NO_MATCH:
            return -1;
        default:
            lasterr = gnome_keyring_result_to_message(result);
            return -2;
    }
    return -3;
}

int set_password(char * s) {
    GnomeKeyringResult result;

    result = gnome_keyring_store_password_sync(&my_schema, NULL,
            "Masterpassword-ff master key", s,
            "appname", APPNAME,
            "usage", USAGE,
            NULL);
    switch (result) {
        case GNOME_KEYRING_RESULT_OK:
            return 0;
        default:
            lasterr = gnome_keyring_result_to_message(result);
            return -2;
    }
    return -3;
}
