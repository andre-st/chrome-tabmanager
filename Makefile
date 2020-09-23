
# ======================= BROWSER ADD-ON MAKEFILE ============================

PROJECT_VERSION = 1.3.0
PACKAGE         = chrome-tabmanager
BUILD_DIR       = _build

# ============================================================================



# Configure Make:
# https://tech.davis-hansson.com/p/make/
SHELL := bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules
#.DEFAULT_GOAL := help


# Computed/derived configuration values:
BUILD_DATE        = $(shell date +'%Y-%m-%d')
GITDIR            = $(wildcard .git)
CHROME_BIN        = $(shell type -p chromium || type -p chrome || type -p brave-browser-stable)
RELEASE           = $(PACKAGE)-$(PROJECT_VERSION)
ICON_PATH_LARGEST = $(shell sed -n -E 's/.*"128"\s*:\s*"([^"]*).*/\1/p' manifest.json)


# ----------------------------------------------------------------------------
## make all          :  Synonymous with 'make' and 'make dist'
all: dist


# ----------------------------------------------------------------------------
## make docs         :  Updates documentation, optionally:
##                        make docs PROJECT_VERSION=1.22
.PHONY: docs
docs:
	# vX.X, vX.XX.X, image:X.XX.X
	sed -i -E "s/([v:])[0-9\.]+/\1${PROJECT_VERSION}/"                                 README.md
	sed -i -E 's/("version"\s*:\s*")[^"]+/\1${PROJECT_VERSION}/'                       manifest.json
	sed -i -E 's/("version_name"\s*:\s*")[^"]+/\1${PROJECT_VERSION} (${BUILD_DATE})/'  manifest.json


# ----------------------------------------------------------------------------
## make icons        :  Creates icons of different size specified in manifest.json
.PHONY: icons
icons:
	# Move icon source file out of the line of fire if specified in manifest.json too
	mv "${ICON_PATH_LARGEST}" "${ICON_PATH_LARGEST}.orig"
	# "32": "image/midsize.png"
	#   ->                        32x32 "image/midsize.png"
	#     ->  convert ... -resize 32x32 "image/midsize.png"
	sed -n -E 's/"([0-9]+)"\s*:\s*"([^"]*).*/\1x\1 "\2"/p' manifest.json | xargs -n2 convert "${ICON_PATH_LARGEST}.orig" -resize
	mv "${ICON_PATH_LARGEST}.orig" "${ICON_PATH_LARGEST}"


# ----------------------------------------------------------------------------
## make release      :  Creates a distclean project directory in build dir
.PHONY: release
release:
	mkdir -p "${BUILD_DIR}/${RELEASE}"
	cp --parents \
			./image/icon*.png \
			./_locales/*/messages.json \
			*.js \
			*.html \
			*.json \
			*.css \
			LICENSE \
			"${BUILD_DIR}/${RELEASE}"


# ----------------------------------------------------------------------------
## make xpi          :  Updates docs and creates Firefox add-on package in build dir
.PHONY: xpi
xpi: icons docs release
	( cd "${BUILD_DIR}/${RELEASE}" && zip -r "../${RELEASE}.xpi" . )


# ----------------------------------------------------------------------------
## make crx          :  Updates docs and Creates Chromium add-on package in build dir
.PHONY: crx
crx: icons docs release
	"${CHROME_BIN}" --no-message-box --pack-extension="${BUILD_DIR}/${RELEASE}" #--pack-extension-key=[extension_key]


# ----------------------------------------------------------------------------
## make dist         :  Updates docs and creates add-on packages in build dir
.PHONY: dist
dist: xpi crx


# ----------------------------------------------------------------------------
## make help         :  Prints this help screen
#
# Just prints all comments with two leading # characters in this Makefile
#
.PHONY: help
help: Makefile
	@sed -n 's/^## //p' $<



