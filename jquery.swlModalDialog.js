/**
 * JQuery modal dialog plugin.
 * Version 1.0
 *
 * This plugin depends on blockUI plugin and basically is a wrapper of blockUI for
 * showing dialog with SNWL styles.
 *
 * This requires JQuery version 1.7+, blockUI 2.7+.
 *
 * @author nobelhuang
 * @copyright DELL SonicWALL
 */
;(function($) {
	/**
	 * This is a global scope plugin
	 */
	$.swlModalDialog = function(options) {
		var opts = null;
		var blockUIOpts = {};

		/* normalize input */
		opts = $.extend({}, $.swlModalDialog.defaults, options);

		/* override default css */
		blockUIOpts.css = $.extend({}, CONST.overrideCss, {
			width: typeof(opts.width) === 'string' ? opts.width : (opts.width + 'px'), 
		});
		blockUIOpts.overlayCSS = CONST.overlayCss;

		/* positioning */
		if (typeof(opts.position) === 'object') {
			if (opts.position.top !== undefined) { delete opts.position.bottom; }
			if (opts.position.left !== undefined) { delete opts.position.right; }
			$.extend(blockUIOpts.css, opts.position);
		}
		else {
			/* currently only support centering */
			$.extend(blockUIOpts.css, {
				margin: 'auto',
				left: 0, right: 0,
				top: opts.gapTop
			});
		}

		/* animation */
		blockUIOpts.fadeIn = blockUIOpts.fadeOut = (opts.animation ? CONST.animation.duration : 0);

		/* auto close */
		if (!opts.closeable) {
			blockUIOpts.timeout = opts.timeout;
		}

		/* compose the dialog element, remember that all the setups are targeting the final html
		 * string instead of a working jquery object, hence event binding at this point is useless.
		 */
		var id = CONST.idPrefix + (Math.floor(Math.random() * 1000000));
		var $dialog = $(CONST.template);
		var contentStr = '';
		var isContentFromElem = false;

		$dialog.attr({id: id});

		/* setup the usage */
		if (CONST.usageClasses[opts.usage]) {
			$dialog.addClass(CONST.usageClasses[opts.usage]);
		}

		/* setup title area */
		if (!opts.title && !opts.closeable) {
			$dialog.find('.title').hide();
		}
		else {
			var title = (typeof(opts.title) === 'function' ? ((opts.title).call(window)) : opts.title);
			if (title) {
				$dialog.find('.title_text').text(title);
			}
			if (opts.closeable) {
				$dialog.find('.title_tools').append(CONST.titleToolTemplates.close);
			}
		}

		/* setup action area */
		if (!opts.buttons || opts.buttons.length <= 0) {
			$dialog.find('.action').hide();
		}
		else {
			var $buttonCont = $dialog.find('.action .buttons');
			opts.buttons.forEach(function(val, index) {
				var template = CONST.actionButtonTemplates[val];
				if (template) {
					var $button = $(template);
					$button.attr('data-name', val);
					$buttonCont.append($button);
				}
			});
		}

		/* setup content area */
		if (opts.contents instanceof jQuery) {
			var $cont = opts.contents;
			contentStr = $cont.html();
			$cont.empty();
			isContentFromElem = true;
		}
		else if (typeof(opts.contents) === 'function') {
			contentStr = opts.contents.call(window);
		}
		else {
			contentStr = opts.contents;
		}
		$dialog.find('.content_body').append(contentStr);

		/* at this point generate the html string for blockUI message */
		var $temp = $('<div>'); $temp.append($dialog);
		blockUIOpts.message = $temp.html();

		/* setup event proxy */
		blockUIOpts.onBlock = function() {
			/* save data after shown */
			/* binding events after the dialog is shown */
			var $shownDialog = $('#' + id);
			var data = {};

			/* store options we used */
			data.opts = opts;
			/* store content html for later restoring if applicable */
			if (isContentFromElem) {
				data.contentStr = contentStr;
				data.contentCont = opts.contents;
			}

			$shownDialog.data(CONST.dataKey, data);

			/* bind for close mark */
			$shownDialog.find('.title_tools .swlTitleToolClose').click(function() {
				__close.call($shownDialog);
			});

			/* bind for action buttons */
			$shownDialog.find('.action .swlAction').click(function() {
				var $button = $(this);
				var buttonName = $button.data('name');

				$shownDialog.find('.action .swlAction').prop({disabled: true});
				if (typeof(opts.onAction) === 'function') {
					opts.onAction.call($shownDialog, buttonName);
				}

				/* close the dialog once click button */
				if (buttonName !== 'reset' && buttonName !== 'default') {
					__close.call($shownDialog);
				}
				else {
					$shownDialog.find('.action .swlAction').prop({disabled: false});
				}
			});

			/* bind for adjusting height */
			if (opts.keepHeightInViewport) {
				__adjustHeight.call($shownDialog);
				$(window).off('resize', __onResize).on('resize', {id: id}, __onResize);
			}

			if (typeof(opts.onShown) === 'function') {
				opts.onShown.call($shownDialog);
			}
		};
		blockUIOpts.onUnblock = function() {
			/* need to restore contents to original container if applicable */
			if (isContentFromElem) {
				opts.contents.html(contentStr);
			}

			if (typeof(opts.onDestroyed) === 'function') {
				opts.onDestroyed.call(window);
			}
		};

		/* finally show this dialog out */
		$.blockUI(blockUIOpts);

		/* return id as handle */
		return id;

	};

	/**
	 * Global function to close a modal dialog, given the dialog handle returned by
	 * $.swlModalDialog().
	 * @param {string}	handle	- handle of dialog returned by $.swlModalDialog()
	 */
	$.swlModalDialogClose = function(handle) {
		var $dialog = $('#' + handle);

		if ($dialog.length === 1) {
			__close.call($dialog);
		}
	};

	function __close() {
		var data = this.data(CONST.dataKey);
		var opts = data.opts;

		if (typeof(opts.beforeClose) === 'function') {
			opts.beforeClose.call(this);
		}

		$.unblockUI({fadeOut: CONST.animation.duration});
	};

	function __adjustHeight() {
		var $dialog = this;
		var $content = $dialog.find('.content');
		var $wrapper = $dialog.closest('.blockMsg');

		var offset = $wrapper.position();
		var height = $dialog.outerHeight();

		offset.bottom = offset.top + height;

		var contentAreaHeight = $content.height();
		var contentBodyHeight = $content.children('.content_body').height();

		height = height - contentAreaHeight + contentBodyHeight;

		var wHeight = $(window).height();
		var toContentAreaHeight = null;

		var fixTop = /^\d+/.test($wrapper.css('top'));

		if (fixTop && (offset.top + height > wHeight)) {
			toContentAreaHeight = contentBodyHeight - (offset.top + height - wHeight);
		}
		if (!fixTop && (offset.bottom - height < 0)) {
			toContentAreaHeight = contentBodyHeight - (height - offset.bottom);
		}

		if (toContentAreaHeight !== null) {
			$content.css({ height: toContentAreaHeight + 'px' });
		}
		else {
			$content.css({ height: 'auto' });
		}
	};

	function __onResize(event) {
		var $dialog = $('#' + event.data.id);

		if ($dialog.length === 1) {
			__adjustHeight.call($dialog);
		}
	};

	/**
	 * Constants used across this plugin
	 */
	var CONST = {
		dataKey: '__mdialogdata',
		template:
			'<div class="swlModalDialog">' +
				'<div class="title">' +
					'<span class="title_text"></span>' +
					'<div class="title_tools"></div>' +
				'</div>' +
				'<div class="content">' +
					'<div class="content_body"></div>' +
				'</div>' +
				'<div class="action">' +
					'<div class="buttons"></div>' +
				'</div>' +
			'</div>',
		titleToolTemplates: {
			close: '<a class="swlTitleToolClose">&#10005;</a>'
		},
		actionButtonTemplates: {
			ok: '<input type="button" class="button size_small swlAction swlActionOk" value="OK">',
			save: '<input type="button" class="button size_small swlAction swlActionSave" value="Save">',
			apply: '<input type="button" class="button size_small swlAction swlActionApply" value="Apply">',
			cancel: '<input type="button" class="button size_small swlAction swlActionCancel" value="Cancel">',
			close: '<input type="button" class="button size_small swlAction swlActionClose" value="Close">',
			reset: '<input type="button" class="button size_small swlAction swlActionReset" value="Reset">',
			'default': '<input type="button" class="button size_small swlAction swlActionDefault" value="Default">'
		},
		idPrefix: 'mdialog',
		usageClasses: {
			warning: 'warning', question: 'question'
		},
		animation: {
			duration: 100
		},
		overrideCss: {
			padding: 0, 
			margin: 0, 
			top: 'initial',
			left: 'initial',
			textAlign: 'left', 
			color: 'inherit', 
			border: 'none', 
			backgroundColor: 'transparent', 
			cursor: 'default'
		},
		overlayCss: {
			opacity: 0.6,
			backgroundColor: '#FFF'
		}
	};

	/**
	 * Modal Dialog default config that could be overridden
	 */
	$.swlModalDialog.defaults = {
		animation: true,

		/**
		 * Indicates whether automatically shrink the height of dialog to make it always be shown
		 * in the viewport once it exceeds the client area.
		 * Enabling this may cause the dialog content area scrollable when shrinking happens.
		 * @type {boolean}
		 */
		keepHeightInViewport: false,

		/**
		 * Position where the dialog will be placed within page. By default, it is "center" which
		 * means the dialog will be placed centered horizontally, otherwise it can be specified
		 * in the format of {top, right, bottom, left}, only specifying two fields.
		 * @type {object|string}
		 */
		position: 'center',

		/**
		 * Width of dialog. By default it is 460px.
		 * @type {number|string}
		 */
		width: 460,

		/**
		 * The use of this dialog, possible values are 'generic', 'warning', 'question'.
		 * @type {string}
		 */
		usage: 'generic',

		/**
		 * Title of this dialog, can be text or string returned by function.
		 * If the title is empty, the title area will not appear intentionally.
		 * @type {string|function|null}
		 */
		title: "Dialog",

		/**
		 * Contents of this dialog, can be html string, or string returned by function, or a
		 * jquery object representing an element that contains contents for this dialog. Notice
		 * children elements will be restored to original container after the dialog dismissed.
		 * @type {string|function|jqueryObject}
		 */
		contents: "",

		/**
		 * Indicates if it is closeable by a close tool at the top right corner. And it is false,
		 * the dialog will be auto closed after timeout milliseconds.
		 * @type {boolean}
		 */
		closeable: true,

		/**
		 * Timeout in milliseconds to close the dialog automatically, this is only effective when
		 * closeable is false.
		 * @type {number}
		 */
		timeout: 2000,

		/**
		 * List of buttons that will be shown for this dialog. Possible values are:
		 *
		 * ok, save, apply, cancel, close, reset, default
		 *
		 * Click any buttons will cause the dialog to be closed except for reset and default buttons.
		 * If there is no buttons specified, the action area will not
		 * appear intentionally.
		 * @type {string[]}
		 */
		buttons: [],

		/**
		 * Callback gets called just after the dialog is shown.
		 * @type {function}
		 * @this jqueryObject	- the dialog jquery object
		 */
		onShown: null,

		/**
		 * Callback gets called just after the dialog is destroyed.
		 * @type {function}
		 */
		onDestroyed: null,

		/**
		 * Callback gets called when one action button is clicked.
		 * @type {function}
		 * @param {string}	buttonName	- the button name as listed for option buttons
		 * @this jqueryObject	- the dialog jquery object
		 */
		onAction: null,

		/**
		 * Callback gets called before the dialog is really closed and destroyed. This happens
		 * when click any buttons or click close mark in the title.
		 * @type {function}
		 * @this jqueryObject	- the dialog jquery object
		 */
		beforeClose: null,

		/**
		 * Some internal options for advanced configuration
		 */
		gapTop: '20px'
	};
})(jQuery);

