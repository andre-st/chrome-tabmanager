
# Configure Make:
# https://tech.davis-hansson.com/p/make/
SHELL := bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules
#.DEFAULT_GOAL := help


# Configure Make rules:
PROJECT_VERSION   = 1.3.0
PACKAGE           = chrome-tabmanager
RELEASE           = $(PACKAGE)-$(PROJECT_VERSION)
GITDIR            = $(wildcard .git)
BUILD_DIR         = _build


# ----------------------------------------------------------------------------
## make all          :  Synonymous with 'make release'
all: release


# ----------------------------------------------------------------------------
## make docs         :  Updates documentation, optionally:
##                        make docs PROJECT_VERSION=1.22
.PHONY: docs
docs:
	# vX.X, vX.XX.X, image:X.XX.X
	sed -i -E "s/([v:])[0-9\.]+/\1${PROJECT_VERSION}/"           README.md
	sed -i -E 's/("version":\s*")[0-9\.]+/\1${PROJECT_VERSION}/' manifest.json


# ----------------------------------------------------------------------------
## make icons        :  Creates icons in different sizes based on the largest one
.PHONY: icons
icons:
	convert ./image/icon128.png -resize 48x48 ./image/icon48.png
	convert ./image/icon128.png -resize 16x16 ./image/icon16.png


# ----------------------------------------------------------------------------
## make release      :  Creates a new browser add-on XPI package in build dir
.PHONY: release
release: icons docs
	mkdir -p ${BUILD_DIR}
	zip - ./image/icon*.png ./_locales/*/messages.json *.js *.html *.json *.css LICENSE > "${BUILD_DIR}/${RELEASE}.xpi"


# ----------------------------------------------------------------------------
## make help         :  Prints this help screen
#
# Prints all comments with two leading # characters in this Makefile
#
.PHONY: help
help: Makefile
	@sed -n 's/^## //p' $<



