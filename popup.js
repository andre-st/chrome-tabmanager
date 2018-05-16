/**
 * @file   Chrome Browser Action Popup UI-Controller
 * @author https://github.com/andre-st
 * 
 */
/* 
 * Note:
 *   As opposed to background.js the popup scripts are short-lived:
 *   Popups are webpages and the webpage is reloaded(!) every time
 *   the user clicks on the popup button.
 * 
 * Relevant Chrome API:
 * - https://developer.chrome.com/extensions/i18n
 * 
 */

"use strict";


// ------------------------- Helper functions ---------------------------
// 
//       Note to myself: if proliferates, switch to jQuery bloat.
//
function getTabMan()
{
	return chrome.extension.getBackgroundPage().tabman; 
}

function elem( id ) 
{
	return document.getElementById( id );
}

function bind( ids, ev, cb ) 
{ 
	const arr = Array.isArray( ids ) ? ids : [ids]; 
	arr.forEach( id => elem( id ).addEventListener( ev, cb ) ); 
}

function i18n( msgId ) 
{
	return chrome.i18n.getMessage( msgId ); 
}

function i18nAll( attr, cb ) 
{
	const list = document.querySelectorAll( '[' + attr + ']' );
	for( var i = 0; i < list.length; i++ ) 
		cb( list[i], i18n( list[i].getAttribute( attr ) ) );
}
// ----------------------------------------------------------------------




function displayStats( tabCount, winCount )
{
	const msg = tabCount + ( tabCount != 1 ? ' Tabs in ' : ' Tab in ' )
	          + winCount + ( winCount != 1 ? ' Windows'  : ' Window'  );
		
	elem( 'stats'        ).innerHTML = msg;
	elem( 'btnMergeNext' ).disabled  = (winCount < 2);
}


function displaySplitSessionState( statename )
{
	elem( 'splitControls' ).className = statename;
}


function displayMergeSessionState( statename )
{
	elem( 'mergeControls' ).className = statename; 
	
	const btn  = elem( 'btnMergeNext' );
	const capt = i18n( statename == 'awaiting' ? 'btnMergeNextAwait' : 'btnMergeNext' );
	
	btn.innerHTML = '<span>' + capt + '</span>';
	btn.blur();
}


function previewSearchResult( tabs, numMatchWin )
{
	const list = elem( 'searchMatchList' );
	
	while( list.hasChildNodes() )
		list.removeChild( list.firstChild );

	tabs.forEach( function( t )
	{
		const text = document.createTextNode( t.title );
		const item = document.createElement ( 'LI'    );
		const icon = document.createElement ( 'IMG'   );
		
		if( t.favIconUrl 
		&& !t.favIconUrl.startsWith( 'chrome://theme/' ) )  // Denied: chrome://theme/IDR_EXTENSIONS_FAVICON@2x
			icon.src = t.favIconUrl;
		
		item.addEventListener( 'click', function( evt )
		{
			chrome.tabs.update( t.id, { active: true, selected: true });
			evt.stopPropagation();
		});
		
		item.appendChild( icon );
		item.appendChild( text );
		list.appendChild( item );
	});
	
	displayStats( list.childElementCount, numMatchWin );
}


function changePopupState( statename )
{
	document.body.className = statename;
	if( statename == 'popupSearchState' )
		getTabMan().drySearch( '', previewSearchResult );
}


document.addEventListener( 'DOMContentLoaded', function() 
{
	// There is no native i18n support for HTML at the time of development:
	// 
	i18nAll( 'data-i18n',             (e,m) => e.innerHTML   = m );
	i18nAll( 'data-i18n-title',       (e,m) => e.title       = m );
	i18nAll( 'data-i18n-placeholder', (e,m) => e.placeholder = m );

	
	// Mouse/Keyboard events:
	// 
	bind( 'btnSort',                 'click', getTabMan().sort                 );
	bind( 'btnMoveTabsToBetterWins', 'click', getTabMan().moveTabsToBetterWins );
	bind( 'btnSplitAtTab',           'click', getTabMan().splitAtTab           );
	bind( 'btnSplitHighlighted',     'click', getTabMan().splitHighlighted     );
	bind( 'btnSplitAtCenter',        'click', getTabMan().splitAtCenter        );
	bind( 'btnSuspend',              'click', getTabMan().suspendTabs          );
	bind( 'btnMergeNext',            'click', getTabMan().mergeNext            );
	bind( 'btnMergeCancel',          'click', getTabMan().cancelMerge          );
	bind( 'editSearch',              'keyup', function( ev )
	{
		getTabMan().drySearch( this.value, previewSearchResult );
		
		if( ev.keyCode === 13 )  // "Enter"
			getTabMan().search( this.value );
	});
	bind( 'editSearch',         'focus',      () => changePopupState( 'popupSearchState'  )   );
	bind( ['multiWinControls'], 'mouseenter', () => elem( 'stats' ).className = 'highlighted' );
	bind( ['multiWinControls'], 'mouseleave', () => elem( 'stats' ).className = ''            );
	
	
	// Indicators/widget states:
	// 
	getTabMan().addMergeSessionListener( displayMergeSessionState );
	getTabMan().addSplitSessionListener( displaySplitSessionState );
	getTabMan().updateStats            ( displayStats             );
});


