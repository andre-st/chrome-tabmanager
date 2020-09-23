/**
 * @file The chrome extension "background page" Javascript  
 * @author  https://github.com/andre-st
 *
 */
/*
 * Relevant Chrome API:
 *   - https://developer.chrome.com/extensions/windows
 *   - https://developer.chrome.com/extensions/tabs
 *   - https://developer.chrome.com/extensions/i18n
 *   - https://developer.chrome.com/apps/contextMenus
 *   - https://developer.chrome.com/apps/commands      (keyboard shortcuts)
 * 
 * Note:
 *   - doc-comments conventions: http://usejsdoc.org/
 *   - members prefixed with an underscore are private members (_function, _attribute)
 *   - consider `urlparts( tab.url )` over `tab.url`, it's transparent to suspended URLs
 *   - windows.getCurrent() isn't the focused one, and windows.getLastFocused() is buggy in a chrome version,
 *     so I used tabs.query({ lastFocusedWindow: true } all the time
 * 
 * Overview:
 *   1.     Tab Manager Functions
 *     1.1  Tab Sortings
 *     1.2  Window Splits
 *     1.3  Window Mergings
 *     1.4  Tabs To Better Wins
 *     1.5  Tab Suspension
 *     1.6  Searches
 *     1.7  Statistics
 *   2.     Helper Functions
 *   3.     Extension Initialization
 * 
 */


"use strict";

/**
 * Tab Manager Namespace
 * @namespace
 * @description Functions usually called by {@link popup.js}
 */
const nsTabMan =
{
	/**
	 * @callback statsCallback
	 * @param    {number} tabCount - Number of tabs in all windows
	 * @param    {number} winCount - Number of windows (with tabs)
	 * @return   {void}
	 * @public
	 */
	
	/**
	 * @callback mergeSessionCallback
	 * @param    {string} statename - Analogous to CSS classnames 'awaiting', 'cancelable', 'default'
	 * @return   {void}
	 * @public
	 */
	
	/**
	 * @callback splitSessionCallback
	 * @param    {string} statename - Analogous to CSS classnames 'highlighted', 'default'
	 * @return   {void}
	 * @public
	 */
	
	/**
	 * @callback searchCallback
	 * @param    {Tab[]}  tabs
	 * @param    {number} numMatchWin - Number of windows involved in search result
	 * @return   {void}
	 * @public
	 */
	
	
	// ------------------------------ Tab Sortings -------------------------------
	
	/**
	 * With the current window, this sorts all...
	 * - tabs by hostname first and title second
	 * - tabs of Goodreads member by their book count (or library browsing time)
	 * 
	 * @return {void}
	 * @public
	 */
	sort: function()
	{
		const soFn = function( a, b )
		{
			/////// Sort By Host (Default) //////
			let   res   = 0;
			const hosta = urlparts( a.url ).host;
			const hostb = urlparts( b.url ).host;
			res = hosta.concat( a.title ).localeCompare( hostb.concat( b.title ) );
			
			/////// Sort Goodreads //////////////
			if( !hosta.startsWith( "www.goodreads.com" )
			||  !hostb.startsWith( "www.goodreads.com" ) ) return res;
			//
			// Goodreads titles:  "###-### of #,###)"  or  "(#,### books)"  or  "any other title"
			// Page weights:                  ^^^^^    or    ^^^^^          or  1000000
			// 
			const mao  = a.title.match(   /([\d,]+)-[\d,]+ of ([\d,]+)\)/ );
			const mbo  = b.title.match(   /([\d,]+)-[\d,]+ of ([\d,]+)\)/ );
			const max  = a.title.match( /\(([\d,]+) books?\)/ );
			const mbx  = b.title.match( /\(([\d,]+) books?\)/ );
			//
			// Index 0 whole string, 1+ capture group
			// parseInt() fails commas, Goodreads is always US locale:
			// 
			const max1 = max ? parseInt( max[1].replace( ",", "" ) ) : 1000000;
			const mbx1 = mbx ? parseInt( mbx[1].replace( ",", "" ) ) : 1000000;
			const mao2 = mao ? parseInt( mao[2].replace( ",", "" ) ) : max1;
			const mbo2 = mbo ? parseInt( mbo[2].replace( ",", "" ) ) : mbx1;
			
			return mao2 - mbo2;
		}
		
		chrome.tabs.query({ lastFocusedWindow: true }, function( tabs )
		{
			tabs.sort( soFn );
			chrome.tabs.move( tabs.map( t => t.id ), { index: -1 });
		});
	},
	
	
	
	// ------------------------------ Window Splits ------------------------------
	
	_splitSessionListeners: new Array(),
	
	
	/**
	 * Splits the given window at the given tab indices
	 * @param  {number}                theWinId
	 * @param  {number} or {number[]}  theTabIndexOrIndices;
	 *                   if not array, all tabs right of given tab are selected too;
	 *                   otherwise only indexed tabs are split and joined together
	 * @return {void}
	 * @private
	 */
	_splitAtIndex: function( theWinId, theTabIndexOrIndices )
	{
		const tabIndices = Array.isArray( theTabIndexOrIndices )
			?   theTabIndexOrIndices
			: [ theTabIndexOrIndices ];
		
		const tabFilter = Array.isArray( theTabIndexOrIndices )
			? t => tabIndices.includes( t.index )
			: t => t.index >= tabIndices[0];
		
		chrome.tabs.getAllInWindow( theWinid, function( tabs )
		{
			const firstTabId = tabs[tabIndices[0]].id;
			const tabsToMove = tabs.filter( tabFilter ).map( t => t.id );
			
			chrome.windows.create({ tabId: firstTabId },
				newWin => chrome.tabs.move( tabsToMove, { windowId: newWin.id, index: -1 }));
		});
	},
	
	
	/**
	 * Splits the current browser window at the left of the active tab.
	 * @return {void} 
	 * @public
	 */
	splitAtTab: function()
	{
		chrome.tabs.query({ lastFocusedWindow: true, active: true },
			tabs => nsTabMan._splitAtIndex( tabs[0].windowId, tabs[0].index ));
	},
	
	
	/**
	 * Splits the current browser window at the center of the tabs row
	 * @return {void} 
	 * @public
	 */
	splitAtCenter: function()
	{
		chrome.tabs.query({ lastFocusedWindow: true },
			tabs => nsTabMan._splitAtIndex( tabs[0].windowId, Math.round( tabs.length / 2 )));
	},
	
	
	/**
	 * Splits highlighted tabs of the current window into a separate window
	 * @return {void}
	 * @public
	 */
	splitHighlighted: function()
	{
		chrome.tabs.query({ lastFocusedWindow: true, highlighted: true }, function( tabs )
			tabs => nsTabMan._splitAtIndex( tabs[0].windowId, tabs.map( t => t.index ));
		
		nsTabMan._notifySplitSessionListeners( 'default');
	},
	
	
	/**
	 * @param  {string} [theState] - Name of the current split situation
	 * @return {void}
	 * @private
	 */
	_notifySplitSessionListeners: function( theState )
	{
		chrome.tabs.query({ lastFocusedWindow: true }, function( tabs )
		{
			// The active tabs is a highlighted tab too, therefore > 1
			const hasHiTabs = tabs.filter( t => t.highlighted ).length > 1;
			theState = theState || ( hasHiTabs ? 'highlighted' : 'default' );
			nsTabMan._splitSessionListeners.forEach( l => l( theState ) );
		});
	},
	
	
	/**
	 * @param  {splitSessionCallback} theCallback
	 * @return {void}
	 * @public
	 */
	addSplitSessionListener: function( theCallback )
	{
		nsTabMan._splitSessionListeners.push( theCallback );
		nsTabMan._notifySplitSessionListeners();
	},
	
	
	
	// --------------------------- Window Mergings -------------------------------
	
	_mergeSessionListeners: new Array(),
	_winIdToMerge         : undefined,
	
	
	/**
	 * Conflates the given windows with their tabs into a single window.
	 * @param  {number[]} theWinsIds - Array with window Ids
	 * @return {void}
	 * @private
	 */
	_merge: function( theWinIds )
	{
		const mvopt = { windowId: theWinIds[0], index: -1 };
		theWinsIds.forEach(
			wid => chrome.tabs.query({ windowId: wid },
				tabs => chrome.tabs.move( tabs.map( t => t.id ), mvopt )));
	},
	
	
	/**
	 * @param  {string} [theState] - Name of the state of the current merge session
	 * @return {void}
	 * @private
	 */	
	_notifyMergeSessionListeners: function( theState )
	{
		chrome.tabs.query({ lastFocusedWindow: true }, function( tabs )
		{
			theState = theState || (
				nsTabMan._winIdToMerge === undefined        ? 'default' : (
				nsTabMan._winIdToMerge ==  tabs[0].windowId ? 'cancelable' : 'awaiting' ) );
			
			nsTabMan._mergeSessionListeners.forEach( l => l( theState ) );
		});
	},
	
	
	/**
	 * @param  {mergeSessionCallback} theCallback
	 * @return {void}
	 * @public
	 */
	addMergeSessionListener: function( theCallback )
	{
		nsTabMan._mergeSessionListeners.push( theCallback );
		nsTabMan._notifyMergeSessionListeners();
	},
	
	
	/**
	 * Either registers the current window for a future merge or actually
	 * merges the current window with a previously registered window.
	 * 
	 * Unless cancelMerge() is called, every call of mergeNext() will
	 * merge the current window with the previously merged window, 
	 * constituting a nice "merge session".
	 * 
	 * @return {void} 
	 * @see    addMergeSessionListener()
	 * @public
	 */
	mergeNext: function()
	{
		chrome.tabs.query({ lastFocusedWindow: true }, function( tabs )
		{
			const activeWinId = tabs[0].windowId;
			
			if( nsTabMan._winIdToMerge == activeWinId )  // e.g., pressing merge-key 2x
			{
				nsTabMan.cancelMerge();
				return;
			}
			
			if( nsTabMan._winIdToMerge === undefined )
			{
				nsTabMan._winIdToMerge = activeWinId;
				nsTabMan._notifyMergeSessionListeners( 'cancelable' );
				return;
			}
			
			nsTabMan._merge([ activeWinId, nsTabMan._winIdToMerge ]);
			nsTabMan._winIdToMerge = activeWinId;  // Next to merge
			nsTabMan._notifyMergeSessionListeners( 'cancelable' );
		});
	},
	
	
	/**
	 * Stops current mergeNext() session so that user can start a new one.
	 * @return {void}
	 * @public
	 */
	cancelMerge: function()
	{
		nsTabMan._winIdToMerge = undefined;
		nsTabMan._notifyMergeSessionListeners( 'default' );
	},
	
	
	
	// --------------------------- Tabs To Better Wins ---------------------------
	
	/**
	 * @param  {Tab}    theTabToMove
	 * @param  {Tab[]}  theTabsToCompare - all the tabs of all the windows
	 * @return {number} window identifier
	 * @private
	 */
	_suggestBetterWin: function( theTabToMove, theTabsToCompare )
	{
		// @TODO Needs a better model.
		// Adding tabs just to the window with most similar tabs is not
		// satisfying as it would quickly result in a unusable long 
		// list of tabs and requires a manual split on that window soon.
		// If there's already a split, that is, two or more windows with
		// similar tabs, we should balance the amount of these windows.
		// 
		const h = urlparts( theTabToMove.url ).host;	
		return theTabsToCompare
				.filter( t => urlparts( t.url ).host == h && t.id != theTabToMove.id )
				.map   ( t => t.windowId )
				.mode(); 
	},
	
	
	/**
	 * Moves the given tab(s) to windows with similar tabs
	 * @param  {Tab[]} [theTabsToMove] - defaults to all tabs of current window
	 * @return {void}
	 * @public
	 */
	moveTabsToBetterWins: function( theTabsToMove )
	{
		if( Array.isArray( theTabsToMove ) )
		{
			chrome.tabs.query({}, function( allTabs )
			{
				theTabsToMove.forEach( function( t )
				{
					const wid = nsTabMan._suggestBetterWin( t, allTabs );
					if( wid == null || wid == t.windowId ) return;
					chrome.tabs.move( t.id, { windowId: wid, index: -1 });
				});
			});
		}
		else
		{
			chrome.tabs.query({ lastFocusedWindow: true }, 
					tabs => nsTabMan.moveTabsToBetterWins( tabs ) );
		}
	},
	
	
	
	// --------------------------- Tab Suspension --------------------------------
	
	_suspendUrlPrefix: "data:text/html;charset=utf-8,<!--BTM1.0-->", // Incl. signature + susp. page ver
	
	
	/**
	 * @param  {Image}  theImage
	 * @param  {string} theBgColor
	 * @param  {float}  theAlpha - transparency 0..1
	 * @return {string} Data-URL
	 * @private
	 */
	_imageDataUrl: function( theImage, theBgColor, theAlpha )
	{
		const can  = document.createElement( 'canvas' );
		can.width  = theImage.width;
		can.height = theImage.height;
		const ctx  = can.getContext( '2d' );
		
		ctx.fillStyle = theBgColor;
		ctx.fillRect( 0, 0, can.width, can.height );  // globalAlpha 1
		ctx.globalAlpha = theAlpha;
		ctx.drawImage( theImage, 0, 0 );
		
		return can.toDataURL( 'image/webp' );
	},
	
	
	/**
	 * Suspends the given browser tab in order to free up computer resources.
	 * @param  {Tab} theTab
	 * @return {void}
	 * @public
	 */
	suspendTab: function( theTab )
	{
		if( theTab.url.startsWith( nsTabMan._suspendUrlPrefix )
		||  theTab.url.startsWith( "chrome:"                  )
		||  theTab.url.startsWith( "chrome-extension:"        ) 
		||  theTab.url.startsWith( "file:"                    ) ) return;
		
		// We replace the given webpage with a low memory HTML-Data-URL.
		// 
		// Data-URLs are fast and remain functional regardless of whether 
		// our Chrome extension is installed and enabled or not:
		// 
		//     In 2017, I lost suspended tabs when 'TheGreatSuspender' 
		//     Chrome extension was deactivated by Google Webstore due 
		//     to security concerns (hacked developer account IIRC).
		// 
		// But Data-URLs cannot load from "chrome://favicon/" (local 
		// resources denied) and we don't want to generate 50+ 
		// simultaneous web requests since our suspension goal is to 
		// *decrease* system load.
		// 
		// Moreover, Chrome doesn't support manifest host-permissions 
		// for Data-URLs and thus denies `executeScript()`, even with 
		// "<all_urls>". This would have become useful for downsizing 
		// Data-URLs by outsourcing non-critical code, e.g., images.
		// 
		// We access aforesaid chrome: path from the extension (here) 
		// and insert icons as WEBP-Data-URL into our HTML-Data-URL.
		// 
		// Note: Make sure your changes are reflected in `urlparts()`.
		//
		const ico  = document.createElement( 'img' );
		ico.onload = function()  // Local resource (performance)
		{
			// Non-transparent WEBP images is 30% of a single PNG image 
			// with alpha transparency.
			// 
			// Favicon in tab improves findability in a row of 50+ tabs.
			//
			// Favicon in suspension page helps grasp context of a title 
			// (Amazon etc) and gives page a nice look:
			// 
			const icoUrl = nsTabMan._imageDataUrl( ico, '#ffffff', 0.5 );
			
			// We depart from the HTML standard and omit tags (e.g.,
			// <head> or </body></html>), omit attribute quotes etc.
			// when feasible in order to downsize the Data-URL.
			// - user can click anywhere on the page (100%) to unsuspend
			const url  = encodeURI( theTab.url );
			const tit  = theTab.title.length <= 140
			           ? theTab.title
			           : theTab.title.substr( 0, 140 ).concat( '...' );
			
			const html = '<!DOCTYPE html>'
			           + '<html style=height:100%>'
			           + '<link rel=icon href="' + icoUrl + '">'
			           + '<body style=height:100%;margin:0;background-color:#e0e0e0>'
			           + '<a href="' + url + '" '
			           +       'style="width:60%;height:90%;display:inline-block;'
			           +       'text-decoration:none;padding:5% 20%;color:#44f">'
			           +   '<h2 style=font-weight:normal>'
			           +     '<img style=padding:2px;background-color:#fff;zoom:3>'
			           +     '<br><br>' + tit
			           +   '</h2>'
			           + ' suspended'
			           + '</a>'
			           + '<script>'
			           +   'var d=document;var l=d.links[0];'
			           +   'd.images[0].src=d.querySelector("link").href;'
			           +   'd.title=l.text.trim();'
			           +   'l.focus();'  // Unsuspend with Enter-key
			           + '</script>';
			
			const suspendUrl = nsTabMan._suspendUrlPrefix.concat( encodeURI( html ) );
			
			console.assert( suspendUrl.length <= 2048, 'Data-URL must not exceed 2048 chars' );
			
			chrome.tabs.update( theTab.id, { url: suspendUrl } );
		};
		ico.src = 'chrome://favicon/' + theTab.url;
	},
	
	
	/**
	 * Suspends all tabs of the active browser window
	 * @return {void}
	 * @public
	 */
	suspendTabs: function()
	{
		chrome.tabs.query({ lastFocusedWindow: true }, 
				tabs => tabs.filter ( t => !t.audible )
				            .forEach( t => nsTabMan.suspendTab( t ) ) );
	},
	
	
	
	// ------------------------------- Searches ----------------------------------
	
	_searchCmdPrefix: ':',  // Indicates a special search command (:de). Should:
	                        // [x] be easy to remember
	                        // [x] not interfere with legit search patterns
	                        // [ ] be accessible with one hand (other mouse)
	                        //     on german and english keyboard layout
	
	/**
	 * Poor man's language detection but good enough in practice for
	 * someone who speaks German and English only. Achieves better 
	 * results than my UDHR-trigrams based detection (derived from 
	 * github.com/wooorm/franc), perhaps due to the short title lengths
	 * and missing need to discern tens or hundreds of languages.
	 * 
	 * @param  {string} theText
	 * @return {boolean}
	 * @private
	 */
	_isGerman: function( theText )
	{
		// Titles that consist of an URL often led to false positives:
		if( theText.startsWith( 'http://'  ) 
		||  theText.startsWith( 'https://' ) ) return false;
		
		// Many German titles feature at least one of these:
		const reGermanSeparateWords = new RegExp( '(^| )('
				+ 'beim*|am|vo[nr]s*|zu[mr]*|aufs*|bis|aus|ums*'       // Praeposition (' an ' engl.)
				+ '|im|ins|gegen|nach|hinter[nms]*|unter[nms]*'        // ...
				+ '|trotz|vorm*|durchs*|seit|seid|viel'                // ...
				+ '|und|oder|aber|denn|dass|weil|ob|als|ohne'          // Konjunktion
				+ '|solange|sowie|weder|noch|indem|bevor|falls|damit'  // ...
				+ '|ein|einen*|der|die|das|dem|den|jede[snm]|kein'     // Artikel
				+ '|ich|du|er|sie|es|wir|ihre*|mir|mich|sich|jemand'   // Pronomen
				+ '|mein|dein|eurer*|euer|uns|unsere*r*'               // ...
				+ '|wohin|wozu|warum|weshalb|wann|woher|wie'           // Frage (' was ' engl.)
				+ ')( |$)', 'i' );
		
		const reGermanInsideWords = new RegExp( '('
				+ '[\u00c4\u00e4\u00d6\u00f6\u00dc\u00fc\u00df]'       // umlauts ÄäÖöÜüß
				// Unique letter combinations based on a Crunch dict
				// (26^3 combinations) ran against a 51MB DE<>EN 
				// vocabulary file (occurrence frequency in english 
				// vs german words). See `langdet` directory.
				+ '|ekt|jdn|zei|igk|gke|pfe|jdm|kom|mpf|fah|hlu|zun|hse|kte|gss|ukt|ehl|ufs|tzu|zah|urz|hnu|usg|ieh|ktr|zug|geg|pfl|gsp|gsa|zwe|zeu|eih|gsb|ktu|rku|gsg|kau|nku|sze|gsk|ohl|zus|sik|lbs|gsf|gsm|duk|tve|gsv|tzt|gte|olz|lze|hrs|tss|amt|klu|igt|hrt|aat|zte|nnt|nzu|dlu|gsr|wec|fiz|taa|rkr|usf|ikr|tsb|wah|hmu|ftr|gse|ufg|fst|bek|feh|hge|sga|gsc|elz|usw|abg|fsc|gsz|huh|hnl|zsc|bge|msc|gsw|woh|svo|ekr|gsl|lsp|tsg|euz|eku|fge|iku|nft|ufn|ufb|sfr|beu|kze|jds|tko|uhe|hls|mte|ufr|rpf|gek|llg|tsv|mml|tzl|szi|mge|rnd|chz|hrl|meh|rlu|zwi|usr|rzt|abw|tsf|hrz|abh|gsd|ftu|fna|ilz|auk|emd|llk|lre|fik|pfa|aht|itg|sdr|tzb|htb|ikt|sri|zif|mwe|gep|skl|pfs|rgs|stk|rzu|zge|zst|nzs|rzs|ckk|upf|tek|tzs|kko|weh|lfs|sgl|tsr|ufk|ufz|hek|soz|usd|tsl|bni|ldk|gez|hlt|uhr|umw|abt|gze|wun|tzm|szu|chv|zog|lra|ttb|hsp|npf|lkr|sss|ufw|umg|fga|hlb|ruh|ykl|zis|dkr|ltn|zyt|uzi|nsz|dte|mfa|orz|rza|tgl|tkr|tsz|zbe|hoh|fnu|apf|lku|tza|hve|abf|hrh|nsr|kge|mke|fze|itb|usz|ufh|mlu|tzw|mmt|tfr|rrs|rzw|bsa|hha|tbl|uhl|bfa|sbl|rtp|ufm|hze|okr|unz|ssk|zuf|nmu|ebn|eza|ugr|zeh|hfr|ewu|rnc|egt|zim|kts|tvo|uun|fbe|tuh|paz|fsp|hrb|ssg|hwu|zba|abk|ckz|stv|tzg|rzk|zwa|rkz|sza|hnh|rzb|spf|kuc|ufi|hko|hnt|hlk|lsb|esz|ugz|ukl|zve|hrf|bch|duz|lzu|fwe|gsu|kig|lnd|zyk|hrg|llz|umk|ftf|zuc|anr|lzi|zko|llv|otz|pft|htt|nzt|ckv|dsa|bha|kut|hkr|rnk|amk|bga|fkl|hss|usm|htk|tmu|msp|uhn|itk|mts|tzk|beb|mms|ndv|tsd|zul|nzw|nwu|dok|tkl|ltb|ttf|zau|bko|gfr|mde|hsi|mkr|wus|nzl|euf|lwi|fuh'
				+ '|\\d+\\.\\d+\\.\\d{2,4}'                            // german date format
				+ '|deutsch|german'                                    // misc
				+ ')', 'i' );
		
		return theText.search( reGermanSeparateWords ) > -1 ||
		       theText.search( reGermanInsideWords   ) > -1;
	},
	
	
	/**
	 * @param  {string}  theKeyword - Substring of a title (smartcase like Vim) or command ':de', ':au'
	 * @param  {Tab}     theTab
	 * @return {boolean} true if theTab satisfies theKeyword
	 * @private
	 */	
	_isMatch( theKeyword, theTab )
	{
		// Implement some search commands:
		
		if( theKeyword.startsWith( nsTabMan._searchCmdPrefix.concat( 'de' ) ) )
			return nsTabMan._isGerman( theTab.title );
		
		if( theKeyword.startsWith( nsTabMan._searchCmdPrefix.concat( 'au' ) ) )
			return theTab.audible;
		
		// ':recent' opened today or 5 minutes ago
		// ...
		
		// Smartcase keyword search:
		const isCase = theKeyword != theKeyword.toLowerCase();  // Any uppercase char?
		const re     = new RegExp( theKeyword, isCase ? '' : 'i' );
		
		return theTab.title.search( re ) > -1;
	},
	
	
	/**
	 * @param  {string}         theKeyword  - @see _isMatch()
	 * @param  {searchCallback} theCallback - Search results
	 * @return {void}
	 * @public
	 */
	drySearch: function( theKeyword, theCallback )
	{
		const wq = { populate: false, windowTypes: ['normal'] };
		chrome.windows.getAll( wq, function( wins )
		{
			var matWinCount = 0;
			var matTabs     = [];
			for( var i = 0; i < wins.length; i++ )
			{
				const i_ = i;  // for closure
				chrome.tabs.query({ windowId: wins[i].id }, function( tabs )
				{
					const x = tabs.filter( t => nsTabMan._isMatch( theKeyword, t ) );
					if( x.length > 0 )
					{
						// Show current window first in search result:
						matTabs = wins[i_].focused ? x.concat( matTabs ) : matTabs.concat( x );
						matWinCount++;
					}
					
					if( i_ == wins.length - 1 )
						theCallback( matTabs, matWinCount );
				});
			}
		});
	},
	
	
	/**
	 * @param  {string} theKeyword - @see drySearch()
	 * @return {void}
	 * @public
	 */
	search: function( theKeyword )
	{
		// There is no way to darken *all* tabs in a window if there's no match.
		// So this is applies Chrome's single window behavior on all windows:
		//    0 matches: all highlighted
		//    n matches:   n highlighted
		// We also have to de-highlight tabs before.
		// Not the most performant impl but readable:
		// 
		nsTabMan.drySearch( theKeyword, function( matTabs, n )
		{
			chrome.tabs.query({}, function( tabs )
			{
				tabs.forEach( function( t )
				{
					const isMat = ( undefined != matTabs.find( m => m.id == t.id ) );
					if( ( t.highlighted && !isMat) 
					||  (!t.highlighted &&  isMat) )
						chrome.tabs.update( t.id, { highlighted: isMat } );  // Expensive
				});
			});
		});
		
		// highlight() closes our browser action popup, thus we have
		// no chance of showing hints like "there are matches in
		// _other_ windows too" near the search textbox at least.
		// 
		// And we won't be able to open the popup programmatically
		// due to security concerns (Chromium dev team).
		//
		// Therefore, there's no reason to collect stats for such 
		// hints, at the time of development.
	},
	
	
	
	// ------------------------------ Statistics ---------------------------------
	
	/**
	 * @param  {statsCallback} theCallback
	 * @return {void}
	 * @public
	 */
	updateStats: function( theCallback )
	{
		const wq = { populate: false, windowTypes: ['normal'] };
		chrome.windows.getAll( wq, 
				wins => chrome.tabs.query( {}, 
						tabs => theCallback( tabs.length, wins.length ) ) );
	}
};




// --------------------------- Helper Functions ------------------------------

/**
 * @return {Object} Most frequent element in array
 * @public
 */
Array.prototype.mode = function()
{
	return this.reduce( (a, b, i, arr) =>
		( arr.filter( v => v === a ).length >= 
		  arr.filter( v => v === b ).length ? a : b ), null );
};


/**
 * @param  {string}            theURL
 * @return {HTMLAnchorElement} Object with properties like port, host etc
 * @todo   Error handling
 * @public
 */
function urlparts( theURL ) 
{
	var a  = document.createElement( 'a' );
	a.href = theURL;
	
	// Was URL suspended by TheGreatSuspender extensions?
	if( a.protocol.startsWith( 'chrome-extension' )
	&&  a.pathname.endsWith  ( '/suspended.html'  ))
	{
		const uPos = a.hash.search( /(#|&)uri=/ );         // suspended.html#ttl=...&uri=...
		if( uPos > -1 )                                    // Use real URL from hash string
			a = urlparts( a.hash.substr( uPos + 5 ) );    // Chops param name, to HTMLAnchorElement
	}
	
	// Was URL suspended by our extensions?
	if( theURL.startsWith( nsTabMan._suspendUrlPrefix ) )     // Oops, violates visibility
	{
		// Error-prone, assumes good encodings
		const data = decodeURI( theURL.substr( nsTabMan._suspendUrlPrefix.length ) );
		const href = data.match( /<a href="([^"]*)"/ );	
		if( href != null && href.length > 1 )
			a = urlparts( href[1] );
	}
	
	return a;
}



// --------------------------------- Init ------------------------------------

chrome.extension.getBackgroundPage().tabman = nsTabMan;   // Let popup.js access our manager


chrome.contextMenus.create(
{
	title   : chrome.i18n.getMessage( 'menuSuspendTab' ),
	contexts: ['page'],
	onclick : (info,tab) => nsTabMan.suspendTab( tab )
});


chrome.contextMenus.create(
{
	title   : chrome.i18n.getMessage( 'menuMoveTabToBetterWin' ),
	contexts: ['page'],
	onclick : (info,tab) => nsTabMan.moveTabsToBetterWins( [tab] )
});

// Keyboard shortcuts:
chrome.commands.onCommand.addListener( function( theCommand )
{
	switch( theCommand )
	{
		case "mergeNext":              // Alt+M
			nsTabMan.mergeNext();
			break;
			
		case "splitAtTab":             // Alt+S
			nsTabMan.splitAtTab();
			break;
			
		case "suspendTabs":            // Alt+B
			nsTabMan.suspendTabs();
			break;
			
		case "suspendTab":             // Alt+H
			chrome.tabs.query({ lastFocusedWindow: true },
					tabs => nsTabMan.suspendTab( tabs.find( t => t.active ) ) );
			break;
			
		case "moveTabToBetterWin":     // Alt+W
			chrome.tabs.query({ lastFocusedWindow: true }, function( tabs )
			{
				const t = tabs.find( t => t.active );
				nsTabMan.moveTabsToBetterWins([ t ]);
				
				// I always do that on single tabs, otherwise 
				// I would have watched/read it immediately:
				nsTabMan.suspendTab( t );
			});
			break;
	}
});

