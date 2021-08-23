include config.mk

HOMEDIR = $(shell pwd)
rollup = ./node_modules/.bin/rollup

deploy:
	npm version patch && make build && git commit -a -m"Build" && make pushall

pushall: sync
	git push origin main

run:
	$(rollup) -c -w

build:
	$(rollup) -c

sync:
	rsync -a $(HOMEDIR)/ $(USER)@$(SERVER):/$(APPDIR) \
    --exclude node_modules/

set-up-server-dir:
	ssh $(USER)@$(SERVER) "mkdir -p $(APPDIR)"


prettier:
	prettier index.html --write
