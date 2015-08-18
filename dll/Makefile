FLAGS := -std=gnu99 -fPIC -Wall -Wextra -O2 -shared
RM := rm -f

GNOME=libpwmgr_gnome.so
GNOME_DEPS:=`pkg-config --cflags gnome-keyring-1 glib-2.0`
GNOME_KEYRING_SO:=`ldconfig -p | grep libgnome-keyring.so.0 | cut -d\> -f2`

TARGET_LIBS=$(GNOME)

.PHONY: all
all: ${TARGET_LIBS}


$(GNOME): $(GNOME:.so=.c)
	gcc $(FLAGS) $(GNOME_DEPS) -Wl,-soname,$@ -o $@ $^ $(GNOME_KEYRING_SO)


$(SRCS:.c=.d):%.d:%.c
		$(CC) $(CFLAGS) -MM $< >$@

include $(SRCS:.c=.d)

.PHONY: clean
clean:
	-${RM} ${TARGET_LIBS} $(SRCS:.c=.d)

install: $(TARGET_LIBS)
	cp $(TARGET_LIBS) ../ext/data/dll/
