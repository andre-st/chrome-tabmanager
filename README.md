# Bazillion Tabs Manager for Google Chrome

![Maintenance](https://img.shields.io/maintenance/yes/2018.svg)


Chrome extension to sort, split and merge, search, count and suspend tabs in your browser.
This aims at users who let bazillion tabs and windows pile up when browsing the web.


## Program Features and Screenshots

- zero configuration (keyboard shortcuts are optional)
- automatically move tabs to windows with a higher amount of similar tabs, e.g., 
  the 2 YouTube tabs in the current window to a window with 15 YouTube videos; 
  works for all window tabs at once (![Alt text](image/icon16.png?raw=true "Browser Action Icon"))
  and for individual tabs (shortcut or context menu): "You're wrong here, go find your window"
- sort tabs by _hostname_ first and title second, which groups scattered YouTube-videos, 
  Goodreads-books etc. next to each other 
- split windows, e.g., along such groups or automatically at the center
- merge windows back _individually_, if SHIFT-select-and-drag-and-drop is laborious (keyb+mouse) 
  or not available on some X11 WMs; "merge all windows" was removed as I never used it
	
	![Screenshot](image/popup-merge-session.png?raw=true "Screenshot")

- simple tab and window counter inclusive
- search tabs with a given keyword in their titles (smartcase: if a pattern contains an uppercase letter, 
  it is case sensitive, otherwise, it is not); lists tabs from the active window first
	
	![Screenshot](image/popup-search.png?raw=true "Screenshot")
	
	| Special | Command Matches                                             |
	|---------|-------------------------------------------------------------|
	| :de     | tabs with likely german titles, not perfect but good enough |
	| :au     | tabs with active audio content                              |
	| ...     | ...                                                         |

- split highlighted tabs into a separate window; use search function to highlight tabs (press Return-key),
  e.g., separate "playlists" from actual video pages
	
	![Screenshot](image/popup-split-hilighted.png?raw=true "Screenshot")
	
- fully operable with __The Great Suspender__ extension (e.g. sort tabs)
- suspend a single tab (shortcut/context menu) or all tabs in the current window (![Alt text](image/icon16.png?raw=true "Browser Action Icon")) 
  to free up resources (This replaces the Great Suspender extension with a
  lightweight and more robust approach: Uses Data-URLs to avoid loss of suspended
  tabs if extension is uninstalled/disabled for some reason, e.g. by Google due
  to security concerns, [as happened](https://twitter.com/greatsuspender/status/872209499062403076) 
  with The Great Suspender in June 2017)
	
	![Screenshot](image/page-context-menu.png?raw=true "Screenshot with the page context menu")

- combines all the above named operations under 1 browser action icon 
  (![Alt text](image/icon16.png?raw=true "Browser Action Icon")), thus
  less clutter next to Chrome's omnibox
- lightweight and simple UI
- multilingual (English language file only at the moment)
- supports the "Keyboard shortcuts" UI in [chrome://extensions](chrome://extensions) 
  (from there, scroll to the bottom); by default, there are _no_ shortcuts designated
	
	![Screenshot](image/keyboard-shortcuts.png?raw=true "Screenshot with exemplary shortcuts")



## Installation (OS-independent)

### End Users:

1. not available in Chrome's Web Store at the moment (req. credit card to pay a reg fee)
2. you cannot easily install CRX-files permanently from other sites
3. follow "developers" instructions

### Developers:

1. clone Git repository
2. Chrome > Settings > Extensions > [x] Developer mode (upper right corner)
3. Chrome > Settings > Extensions > click <kbd>Load unpacked extension</kbd> 
4. browse to the source directory of the downloaded, unarchived release and confirm

### Feedback:

Use [GitHub](https://github.com/andre-st/chrome-tabmanager/issues) or see [AUTHORS.md](AUTHORS.md) file



## License

Creative Commons BY-SA



## See also

- [Why You Open Too Many Browser Tabs And How To Stop It](http://blog.trello.com/too-many-browser-tabs)
- [On the cognitive value of having a bazillion tabs open on your browser](http://clivethompson.net/2016/09/27/on-the-cognitive-value-of-having-a-bazillion-tabs-open-on-your-browser/)
- [Joe Average < 11 tabs](http://www.slate.com/articles/life/the_hive/2010/12/open_this_story_in_a_new_tab.html)

