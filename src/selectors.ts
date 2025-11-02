// downloadFilename, downloadProgress and downloadSpeed are all children of downloadItem
export const selectors = {
	/** ![](https://i.imgur.com/7GCNBdG.png|height=164|width=760) */
	downloadItem: '.transfers-manager-list-item',

	/**
	 * Value in ariaLabel
	 * ![](https://i.imgur.com/VDcCVZv.png|height=160|width=755)
	 * */
	downloadFilename: '.transfers-manager-list-item-name span[data-testid=transfer-item-name] span',

	/** ![](https://i.imgur.com/DdipQVw.png|height=162|width=759) */
	downloadProgress: '.progress-bar',

	/** ![](https://i.imgur.com/Yh1XfiQ.png|height=162|width=759) */
	downloadProgressText: '.transfers-manager-list-item-size',

	/** ![](https://i.imgur.com/7ZNyuFP.png|height=118|width=552) */
	downloadSpeed: 'span[data-testid=transfer-item-status]',

	/** Filename for file shares
	 * ![](https://i.imgur.com/mB50e04.png|height=240|width=788) */
	fileShareFilename: '.inline-flex[aria-label]',

	/**
	 * Used to determine if share type is file
	 * ![](https://i.imgur.com/7GCNBdG.png)
	 * */
	fileShareProof: 'div.file-preview-container',

	/** ![](https://i.imgur.com/oNMUXVv.png|height=174|width=172) */
	incorrectPasswordPopup: 'div[role=alert].notification--error',

	/** ![](https://i.imgur.com/VJTVKKW.png|height=149|width=355) */
	itemDownloadButton: 'button[data-testid=context-menu-download]',

	/**
	 * Not visible
	 * Contains info about item like:
	 * - Folder - subfolder
	 * - File - text/plain - example.txt
	 */
	itemInfo: 'td[data-testid=column-name] span.sr-only',

	/**
	 * Item info is instead stored in alt attributes on items with thumbnails
	 * ![](https://i.imgur.com/XP4K5ci.png|height=149|width=347)
	 * */
	itemInfoFallback: 'td[data-testid=column-name] [alt]',

	/** ![](https://i.imgur.com/MCBB0EZ.png|height=209|width=611) */
	itemSize: 'td[data-testid=column-size] span',

	/** ![](https://i.imgur.com/3T9kxh2.png|height=209|width=256) */
	passwordInput: 'input[type=password]',

	/**
	 * https://en.wikipedia.org/wiki/Breadcrumb_navigation
	 * ![](https://i.imgur.com/kDol7BZ.png|height=57|width=473)
	 * */
	previousFolderBreadcrumb: '.shared-folder-header-breadcrumbs > .collapsing-breadcrumb:nth-last-child(3)',

	/**
	 * https://en.wikipedia.org/wiki/Breadcrumb_navigation
	 * ![]'li.collapsing-breadcrumb:nth-child(1)'|height=57|width=473)
	 * */
	rootFolderBreadcrumb: 'li.collapsing-breadcrumb:nth-child(1)',

	/** ![](https://i.imgur.com/MUB7jSN.png|height=210|width=617) */
	shareDownloadButton: 'button[data-testid=download-button]',

	/**
	 * Parent of itemSize, itemInfo and itemInfoFallback
	 * ![](https://i.imgur.com/CFftzK4.png|height=176|width=893)
	 * */
	tableRows: 'tbody > tr.file-browser-list-item'
};
