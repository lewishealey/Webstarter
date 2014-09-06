/*! Respond.js v1.4.0: min/max-width media query polyfill. (c) Scott Jehl. MIT Lic. j.mp/respondjs  */
(function( w ){

	"use strict";

	//exposed namespace
	var respond = {};
	w.respond = respond;

	//define update even in native-mq-supporting browsers, to avoid errors
	respond.update = function(){};

	//define ajax obj
	var requestQueue = [],
		xmlHttp = (function() {
			var xmlhttpmethod = false;
			try {
				xmlhttpmethod = new w.XMLHttpRequest();
			}
			catch( e ){
				xmlhttpmethod = new w.ActiveXObject( "Microsoft.XMLHTTP" );
			}
			return function(){
				return xmlhttpmethod;
			};
		})(),

		//tweaked Ajax functions from Quirksmode
		ajax = function( url, callback ) {
			var req = xmlHttp();
			if (!req){
				return;
			}
			req.open( "GET", url, true );
			req.onreadystatechange = function () {
				if ( req.readyState !== 4 || req.status !== 200 && req.status !== 304 ){
					return;
				}
				callback( req.responseText );
			};
			if ( req.readyState === 4 ){
				return;
			}
			req.send( null );
		};

	//expose for testing
	respond.ajax = ajax;
	respond.queue = requestQueue;

	// expose for testing
	respond.regex = {
		media: /@media[^\{]+\{([^\{\}]*\{[^\}\{]*\})+/gi,
		keyframes: /@.*keyframes[^\{]+\{(?:[^\{\}]*\{[^\}\{]*\})+[^\}]+\}/gi,
		urls: /(url\()['"]?([^\/\)'"][^:\)'"]+)['"]?(\))/g,
		findStyles: /@media *([^\{]+)\{([\S\s]+?)$/,
		only: /(only\s+)?([a-zA-Z]+)\s?/,
		minw: /\([\s]*min\-width\s*:[\s]*([\s]*[0-9\.]+)(px|em)[\s]*\)/,
		maxw: /\([\s]*max\-width\s*:[\s]*([\s]*[0-9\.]+)(px|em)[\s]*\)/
	};

	//expose media query support flag for external use
	respond.mediaQueriesSupported = w.matchMedia && w.matchMedia( "only all" ) !== null && w.matchMedia( "only all" ).matches;

	//if media queries are supported, exit here
	if( respond.mediaQueriesSupported ){
		return;
	}

	//define vars
	var doc = w.document,
		docElem = doc.documentElement,
		mediastyles = [],
		rules = [],
		appendedEls = [],
		parsedSheets = {},
		resizeThrottle = 30,
		head = doc.getElementsByTagName( "head" )[0] || docElem,
		base = doc.getElementsByTagName( "base" )[0],
		links = head.getElementsByTagName( "link" ),

		lastCall,
		resizeDefer,

		//cached container for 1em value, populated the first time it's needed
		eminpx,

		// returns the value of 1em in pixels
		getEmValue = function() {
			var ret,
				div = doc.createElement('div'),
				body = doc.body,
				originalHTMLFontSize = docElem.style.fontSize,
				originalBodyFontSize = body && body.style.fontSize,
				fakeUsed = false;

			div.style.cssText = "position:absolute;font-size:1em;width:1em";

			if( !body ){
				body = fakeUsed = doc.createElement( "body" );
				body.style.background = "none";
			}

			// 1em in a media query is the value of the default font size of the browser
			// reset docElem and body to ensure the correct value is returned
			docElem.style.fontSize = "100%";
			body.style.fontSize = "100%";

			body.appendChild( div );

			docElem.insertBefore( body, docElem.firstChild );

			ret = div.offsetWidth;

			if( fakeUsed ){
				docElem.removeChild( body );
			}
			else {
				body.removeChild( div );
			}

			// restore the original values
			docElem.style.fontSize = originalHTMLFontSize;
			if( originalBodyFontSize ) {
				body.style.fontSize = originalBodyFontSize;
			}


			//also update eminpx before returning
			ret = eminpx = parseFloat(ret);

			return ret;
		},

		//enable/disable styles
		applyMedia = function( fromResize ){
			var name = "clientWidth",
				docElemProp = docElem[ name ],
				currWidth = doc.compatMode === "CSS1Compat" && docElemProp || doc.body[ name ] || docElemProp,
				styleBlocks	= {},
				lastLink = links[ links.length-1 ],
				now = (new Date()).getTime();

			//throttle resize calls
			if( fromResize && lastCall && now - lastCall < resizeThrottle ){
				w.clearTimeout( resizeDefer );
				resizeDefer = w.setTimeout( applyMedia, resizeThrottle );
				return;
			}
			else {
				lastCall = now;
			}

			for( var i in mediastyles ){
				if( mediastyles.hasOwnProperty( i ) ){
					var thisstyle = mediastyles[ i ],
						min = thisstyle.minw,
						max = thisstyle.maxw,
						minnull = min === null,
						maxnull = max === null,
						em = "em";

					if( !!min ){
						min = parseFloat( min ) * ( min.indexOf( em ) > -1 ? ( eminpx || getEmValue() ) : 1 );
					}
					if( !!max ){
						max = parseFloat( max ) * ( max.indexOf( em ) > -1 ? ( eminpx || getEmValue() ) : 1 );
					}

					// if there's no media query at all (the () part), or min or max is not null, and if either is present, they're true
					if( !thisstyle.hasquery || ( !minnull || !maxnull ) && ( minnull || currWidth >= min ) && ( maxnull || currWidth <= max ) ){
						if( !styleBlocks[ thisstyle.media ] ){
							styleBlocks[ thisstyle.media ] = [];
						}
						styleBlocks[ thisstyle.media ].push( rules[ thisstyle.rules ] );
					}
				}
			}

			//remove any existing respond style element(s)
			for( var j in appendedEls ){
				if( appendedEls.hasOwnProperty( j ) ){
					if( appendedEls[ j ] && appendedEls[ j ].parentNode === head ){
						head.removeChild( appendedEls[ j ] );
					}
				}
			}

			//inject active styles, grouped by media type
			for( var k in styleBlocks ){
				if( styleBlocks.hasOwnProperty( k ) ){
					var ss = doc.createElement( "style" ),
						css = styleBlocks[ k ].join( "\n" );

					ss.type = "text/css";
					ss.media = k;

					//originally, ss was appended to a documentFragment and sheets were appended in bulk.
					//this caused crashes in IE in a number of circumstances, such as when the HTML element had a bg image set, so appending beforehand seems best. Thanks to @dvelyk for the initial research on this one!
					head.insertBefore( ss, lastLink.nextSibling );

					if ( ss.styleSheet ){
						ss.styleSheet.cssText = css;
					}
					else {
						ss.appendChild( doc.createTextNode( css ) );
					}

					//push to appendedEls to track for later removal
					appendedEls.push( ss );
				}
			}
		},
		//find media blocks in css text, convert to style blocks
		translate = function( styles, href, media ){
			var qs = styles.replace( respond.regex.keyframes, '' ).match( respond.regex.media ),
				ql = qs && qs.length || 0;

			//try to get CSS path
			href = href.substring( 0, href.lastIndexOf( "/" ) );

			var repUrls = function( css ){
					return css.replace( respond.regex.urls, "$1" + href + "$2$3" );
				},
				useMedia = !ql && media;

			//if path exists, tack on trailing slash
			if( href.length ){ href += "/"; }

			//if no internal queries exist, but media attr does, use that
			//note: this currently lacks support for situations where a media attr is specified on a link AND
				//its associated stylesheet has internal CSS media queries.
				//In those cases, the media attribute will currently be ignored.
			if( useMedia ){
				ql = 1;
			}

			for( var i = 0; i < ql; i++ ){
				var fullq, thisq, eachq, eql;

				//media attr
				if( useMedia ){
					fullq = media;
					rules.push( repUrls( styles ) );
				}
				//parse for styles
				else{
					fullq = qs[ i ].match( respond.regex.findStyles ) && RegExp.$1;
					rules.push( RegExp.$2 && repUrls( RegExp.$2 ) );
				}

				eachq = fullq.split( "," );
				eql = eachq.length;

				for( var j = 0; j < eql; j++ ){
					thisq = eachq[ j ];
					mediastyles.push( {
						media : thisq.split( "(" )[ 0 ].match( respond.regex.only ) && RegExp.$2 || "all",
						rules : rules.length - 1,
						hasquery : thisq.indexOf("(") > -1,
						minw : thisq.match( respond.regex.minw ) && parseFloat( RegExp.$1 ) + ( RegExp.$2 || "" ),
						maxw : thisq.match( respond.regex.maxw ) && parseFloat( RegExp.$1 ) + ( RegExp.$2 || "" )
					} );
				}
			}

			applyMedia();
		},

		//recurse through request queue, get css text
		makeRequests = function(){
			if( requestQueue.length ){
				var thisRequest = requestQueue.shift();

				ajax( thisRequest.href, function( styles ){
					translate( styles, thisRequest.href, thisRequest.media );
					parsedSheets[ thisRequest.href ] = true;

					// by wrapping recursive function call in setTimeout
					// we prevent "Stack overflow" error in IE7
					w.setTimeout(function(){ makeRequests(); },0);
				} );
			}
		},

		//loop stylesheets, send text content to translate
		ripCSS = function(){

			for( var i = 0; i < links.length; i++ ){
				var sheet = links[ i ],
				href = sheet.href,
				media = sheet.media,
				isCSS = sheet.rel && sheet.rel.toLowerCase() === "stylesheet";

				//only links plz and prevent re-parsing
				if( !!href && isCSS && !parsedSheets[ href ] ){
					// selectivizr exposes css through the rawCssText expando
					if (sheet.styleSheet && sheet.styleSheet.rawCssText) {
						translate( sheet.styleSheet.rawCssText, href, media );
						parsedSheets[ href ] = true;
					} else {
						if( (!/^([a-zA-Z:]*\/\/)/.test( href ) && !base) ||
							href.replace( RegExp.$1, "" ).split( "/" )[0] === w.location.host ){
							// IE7 doesn't handle urls that start with '//' for ajax request
							// manually add in the protocol
							if ( href.substring(0,2) === "//" ) { href = w.location.protocol + href; }
							requestQueue.push( {
								href: href,
								media: media
							} );
						}
					}
				}
			}
			makeRequests();
		};

	//translate CSS
	ripCSS();

	//expose update for re-running respond later on
	respond.update = ripCSS;

	//expose getEmValue
	respond.getEmValue = getEmValue;

	//adjust on resize
	function callMedia(){
		applyMedia( true );
	}

	if( w.addEventListener ){
		w.addEventListener( "resize", callMedia, false );
	}
	else if( w.attachEvent ){
		w.attachEvent( "onresize", callMedia );
	}
})(this);

//DivPeek - Custom jQuery CSS3 Animation Trigger Script by David Halford
//(see https://github.com/davidhalford/DivPeek)
//===============================================================================
//CONFIG: 
var elementsToTrack = ["#feature","#hero","#savior","#capture","#footer",".move-obj",".move-obj-2",".move-obj-3",".move-obj-4",".move-obj-5"];

var pixelOffset = -24;
var inClassName = "inViewPort";
var outClassName = "outViewPort";
//===============================================================================
jQuery.fn.exists=function(){return this.length>0;}
var viewPortHeight=$(window).height();var scrollFromTop=$(window).scrollTop();var scrollFromBottom=(parseInt(scrollFromTop)+parseInt(viewPortHeight));function recalcVars(){viewPortHeight=$(window).height();scrollFromTop=$(window).scrollTop();scrollFromBottom=(parseInt(scrollFromTop)+parseInt(viewPortHeight));for(var i=0;i<elementsToTrack.length;i++){if($(elementsToTrack[i]).exists()){checkInViewport(scrollFromBottom,elementsToTrack[i]);}}}
$(window).resize(function(e){recalcVars();});document.addEventListener("touchmove",ScrollStart,false);document.addEventListener("scroll",Scroll,false);function ScrollStart(){recalcVars();}
function Scroll(){recalcVars();}
function checkInViewport(scrollBottom,domElement){var elementPos=$(domElement).offset().top;if((parseInt(scrollBottom)+parseInt(pixelOffset))>elementPos){$(domElement).addClass(inClassName).removeClass(outClassName);}else{$(domElement).removeClass(inClassName).addClass(outClassName);}}


/*

Holder - 2.2 - client side image placeholders
(c) 2012-2013 Ivan Malopinsky / http://imsky.co

Provided under the MIT License.
Commercial use requires attribution.

*/

var Holder = Holder || {};
(function (app, win) {

var preempted = false,
fallback = false,
canvas = document.createElement('canvas');
var dpr = 1, bsr = 1;
var resizable_images = [];

if (!canvas.getContext) {
	fallback = true;
} else {
	if (canvas.toDataURL("image/png")
		.indexOf("data:image/png") < 0) {
		//Android doesn't support data URI
		fallback = true;
	} else {
		var ctx = canvas.getContext("2d");
	}
}

if(!fallback){
    dpr = window.devicePixelRatio || 1,
    bsr = ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio || ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1;
}

var ratio = dpr / bsr;

var settings = {
	domain: "holder.js",
	images: "img",
	bgnodes: ".holderjs",
	themes: {
		"gray": {
			background: "#eee",
			foreground: "#aaa",
			size: 12
		},
		"social": {
			background: "#3a5a97",
			foreground: "#fff",
			size: 12
		},
		"industrial": {
			background: "#434A52",
			foreground: "#C2F200",
			size: 12
		},
		"sky": {
			background: "#0D8FDB",
			foreground: "#fff",
			size: 12
		},
		"vine": {
			background: "#39DBAC",
			foreground: "#1E292C",
			size: 12
		},
		"lava": {
			background: "#F8591A",
			foreground: "#1C2846",
			size: 12
		}
	},
	stylesheet: ""
};
app.flags = {
	dimensions: {
		regex: /^(\d+)x(\d+)$/,
		output: function (val) {
			var exec = this.regex.exec(val);
			return {
				width: +exec[1],
				height: +exec[2]
			}
		}
	},
	fluid: {
		regex: /^([0-9%]+)x([0-9%]+)$/,
		output: function (val) {
			var exec = this.regex.exec(val);
			return {
				width: exec[1],
				height: exec[2]
			}
		}
	},
	colors: {
		regex: /#([0-9a-f]{3,})\:#([0-9a-f]{3,})/i,
		output: function (val) {
			var exec = this.regex.exec(val);
			return {
				size: settings.themes.gray.size,
				foreground: "#" + exec[2],
				background: "#" + exec[1]
			}
		}
	},
	text: {
		regex: /text\:(.*)/,
		output: function (val) {
			return this.regex.exec(val)[1];
		}
	},
	font: {
		regex: /font\:(.*)/,
		output: function (val) {
			return this.regex.exec(val)[1];
		}
	},
	auto: {
		regex: /^auto$/
	},
	textmode: {
		regex: /textmode\:(.*)/,
		output: function(val){
			return this.regex.exec(val)[1];
		}
	}
}

//getElementsByClassName polyfill
document.getElementsByClassName||(document.getElementsByClassName=function(e){var t=document,n,r,i,s=[];if(t.querySelectorAll)return t.querySelectorAll("."+e);if(t.evaluate){r=".//*[contains(concat(' ', @class, ' '), ' "+e+" ')]",n=t.evaluate(r,t,null,0,null);while(i=n.iterateNext())s.push(i)}else{n=t.getElementsByTagName("*"),r=new RegExp("(^|\\s)"+e+"(\\s|$)");for(i=0;i<n.length;i++)r.test(n[i].className)&&s.push(n[i])}return s})

//getComputedStyle polyfill
window.getComputedStyle||(window.getComputedStyle=function(e){return this.el=e,this.getPropertyValue=function(t){var n=/(\-([a-z]){1})/g;return t=="float"&&(t="styleFloat"),n.test(t)&&(t=t.replace(n,function(){return arguments[2].toUpperCase()})),e.currentStyle[t]?e.currentStyle[t]:null},this})

//http://javascript.nwbox.com/ContentLoaded by Diego Perini with modifications
function contentLoaded(n,t){var l="complete",s="readystatechange",u=!1,h=u,c=!0,i=n.document,a=i.documentElement,e=i.addEventListener?"addEventListener":"attachEvent",v=i.addEventListener?"removeEventListener":"detachEvent",f=i.addEventListener?"":"on",r=function(e){(e.type!=s||i.readyState==l)&&((e.type=="load"?n:i)[v](f+e.type,r,u),!h&&(h=!0)&&t.call(n,null))},o=function(){try{a.doScroll("left")}catch(n){setTimeout(o,50);return}r("poll")};if(i.readyState==l)t.call(n,"lazy");else{if(i.createEventObject&&a.doScroll){try{c=!n.frameElement}catch(y){}c&&o()}i[e](f+"DOMContentLoaded",r,u),i[e](f+s,r,u),n[e](f+"load",r,u)}}

//https://gist.github.com/991057 by Jed Schmidt with modifications
function selector(a){
	a=a.match(/^(\W)?(.*)/);var b=document["getElement"+(a[1]?a[1]=="#"?"ById":"sByClassName":"sByTagName")](a[2]);
	var ret=[];	b!==null&&(b.length?ret=b:b.length===0?ret=b:ret=[b]);	return ret;
}

//shallow object property extend
function extend(a,b){
	var c={};
	for(var i in a){
		if(a.hasOwnProperty(i)){
			c[i]=a[i];
		}
	}
	for(var i in b){
		if(b.hasOwnProperty(i)){
			c[i]=b[i];
		}
	}
	return c
}

//hasOwnProperty polyfill
if (!Object.prototype.hasOwnProperty)
    /*jshint -W001, -W103 */
    Object.prototype.hasOwnProperty = function(prop) {
		var proto = this.__proto__ || this.constructor.prototype;
		return (prop in this) && (!(prop in proto) || proto[prop] !== this[prop]);
	}
    /*jshint +W001, +W103 */

function text_size(width, height, template) {
	height = parseInt(height, 10);
	width = parseInt(width, 10);
	var bigSide = Math.max(height, width)
	var smallSide = Math.min(height, width)
	var scale = 1 / 12;
	var newHeight = Math.min(smallSide * 0.75, 0.75 * bigSide * scale);
	return {
		height: Math.round(Math.max(template.size, newHeight))
	}
}

function draw(args) {
	var ctx = args.ctx;
	var dimensions = args.dimensions;
	var template = args.template;
	var ratio = args.ratio;
	var holder = args.holder;
	var literal = holder.textmode == "literal";
	var exact = holder.textmode == "exact";

	var ts = text_size(dimensions.width, dimensions.height, template);
	var text_height = ts.height;
	var width = dimensions.width * ratio,
		height = dimensions.height * ratio;
	var font = template.font ? template.font : "sans-serif";
	canvas.width = width;
	canvas.height = height;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = template.background;
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = template.foreground;
	ctx.font = "bold " + text_height + "px " + font;
	var text = template.text ? template.text : (Math.floor(dimensions.width) + "x" + Math.floor(dimensions.height));
	if (literal) {
		var dimensions = holder.dimensions;
		text = dimensions.width + "x" + dimensions.height;
	}
	else if(exact && holder.exact_dimensions){
		var dimensions = holder.exact_dimensions;
		text = (Math.floor(dimensions.width) + "x" + Math.floor(dimensions.height));
	}
	var text_width = ctx.measureText(text).width;
	if (text_width / width >= 0.75) {
		text_height = Math.floor(text_height * 0.75 * (width / text_width));
	}
	//Resetting font size if necessary
	ctx.font = "bold " + (text_height * ratio) + "px " + font;
	ctx.fillText(text, (width / 2), (height / 2), width);
	return canvas.toDataURL("image/png");
}

function render(mode, el, holder, src) {
	
	var dimensions = holder.dimensions,
		theme = holder.theme,
		text = holder.text ? decodeURIComponent(holder.text) : holder.text;
	var dimensions_caption = dimensions.width + "x" + dimensions.height;
	theme = (text ? extend(theme, {
		text: text
	}) : theme);
	theme = (holder.font ? extend(theme, {
		font: holder.font
	}) : theme);
	el.setAttribute("data-src", src);
	holder.theme = theme;
	el.holder_data = holder;
	
	if (mode == "image") {
		el.setAttribute("alt", text ? text : theme.text ? theme.text + " [" + dimensions_caption + "]" : dimensions_caption);
		if (fallback || !holder.auto) {
			el.style.width = dimensions.width + "px";
			el.style.height = dimensions.height + "px";
		}
		if (fallback) {
			el.style.backgroundColor = theme.background;
		} else {
			el.setAttribute("src", draw({ctx: ctx, dimensions: dimensions, template: theme, ratio:ratio, holder: holder}));
			
			if(holder.textmode && holder.textmode == "exact"){
				resizable_images.push(el);
				resizable_update(el);
			}
			
		}
	} else if (mode == "background") {
		if (!fallback) {
			el.style.backgroundImage = "url(" + draw({ctx:ctx, dimensions: dimensions, template: theme, ratio: ratio, holder: holder}) + ")";
			el.style.backgroundSize = dimensions.width + "px " + dimensions.height + "px";
		}
	} else if (mode == "fluid") {
		el.setAttribute("alt", text ? text : theme.text ? theme.text + " [" + dimensions_caption + "]" : dimensions_caption);
		if (dimensions.height.slice(-1) == "%") {
			el.style.height = dimensions.height
		} else {
			el.style.height = dimensions.height + "px"
		}
		if (dimensions.width.slice(-1) == "%") {
			el.style.width = dimensions.width
		} else {
			el.style.width = dimensions.width + "px"
		}
		if (el.style.display == "inline" || el.style.display === "" || el.style.display == "none") {
			el.style.display = "block";
		}
		if (fallback) {
			el.style.backgroundColor = theme.background;
		} else {
			resizable_images.push(el);
			resizable_update(el);
		}
	}
}

function dimension_check(el, callback) {
	var dimensions = {
		height: el.clientHeight,
		width: el.clientWidth
	};
	if (!dimensions.height && !dimensions.width) {
		if (el.hasAttribute("data-holder-invisible")) {
			throw new Error("Holder: placeholder is not visible");
		} else {
			el.setAttribute("data-holder-invisible", true)
			setTimeout(function () {
				callback.call(this, el)
			}, 1)
			return null;
		}
	} else {
		el.removeAttribute("data-holder-invisible")
	}
	return dimensions;
}

function resizable_update(element) {
	var images;
	if (element.nodeType == null) {
		images = resizable_images;
	} else {
		images = [element]
	}
	for (var i in images) {
		if (!images.hasOwnProperty(i)) {
			continue;
		}
		var el = images[i]
		if (el.holder_data) {
			var holder = el.holder_data;
			var dimensions = dimension_check(el, resizable_update)
			if(dimensions){
				if(holder.fluid){
					el.setAttribute("src", draw({
						ctx: ctx,
						dimensions: dimensions,
						template: holder.theme,
						ratio: ratio,
						holder: holder
					}))
				}
				if(holder.textmode && holder.textmode == "exact"){
					holder.exact_dimensions = dimensions;
					el.setAttribute("src", draw({
						ctx: ctx,
						dimensions: holder.dimensions,
						template: holder.theme,
						ratio: ratio,
						holder: holder
					}))
				}
			}
		}
	}
}

function parse_flags(flags, options) {
	var ret = {
		theme: extend(settings.themes.gray, {})
	};
	var render = false;
	for (sl = flags.length, j = 0; j < sl; j++) {
		var flag = flags[j];
		if (app.flags.dimensions.match(flag)) {
			render = true;
			ret.dimensions = app.flags.dimensions.output(flag);
		} else if (app.flags.fluid.match(flag)) {
			render = true;
			ret.dimensions = app.flags.fluid.output(flag);
			ret.fluid = true;
		} else if (app.flags.textmode.match(flag)) {
			ret.textmode = app.flags.textmode.output(flag)
		} else if (app.flags.colors.match(flag)) {
			ret.theme = app.flags.colors.output(flag);
		} else if (options.themes[flag]) {
			//If a theme is specified, it will override custom colors
			if(options.themes.hasOwnProperty(flag)){
				ret.theme = extend(options.themes[flag], {});
			}
		} else if (app.flags.font.match(flag)) {
			ret.font = app.flags.font.output(flag);
		} else if (app.flags.auto.match(flag)) {
			ret.auto = true;
		} else if (app.flags.text.match(flag)) {
			ret.text = app.flags.text.output(flag);
		}
	}
	return render ? ret : false;
}

for (var flag in app.flags) {
	if (!app.flags.hasOwnProperty(flag)) continue;
	app.flags[flag].match = function (val) {
		return val.match(this.regex)
	}
}
app.add_theme = function (name, theme) {
	name != null && theme != null && (settings.themes[name] = theme);
	return app;
};
app.add_image = function (src, el) {
	var node = selector(el);
	if (node.length) {
		for (var i = 0, l = node.length; i < l; i++) {
			var img = document.createElement("img")
			img.setAttribute("data-src", src);
			node[i].appendChild(img);
		}
	}
	return app;
};
app.run = function (o) {
	preempted = true;
	
	var options = extend(settings, o),
		images = [],
		imageNodes = [],
		bgnodes = [];
	if (typeof (options.images) == "string") {
		imageNodes = selector(options.images);
	} else if (window.NodeList && options.images instanceof window.NodeList) {
		imageNodes = options.images;
	} else if (window.Node && options.images instanceof window.Node) {
		imageNodes = [options.images];
	}
	
	if (typeof (options.bgnodes) == "string") {
		bgnodes = selector(options.bgnodes);
	} else if (window.NodeList && options.elements instanceof window.NodeList) {
		bgnodes = options.bgnodes;
	} else if (window.Node && options.bgnodes instanceof window.Node) {
		bgnodes = [options.bgnodes];
	}
	for (i = 0, l = imageNodes.length; i < l; i++) images.push(imageNodes[i]);
	var holdercss = document.getElementById("holderjs-style");
	if (!holdercss) {
		holdercss = document.createElement("style");
		holdercss.setAttribute("id", "holderjs-style");
		holdercss.type = "text/css";
		document.getElementsByTagName("head")[0].appendChild(holdercss);
	}
	if (!options.nocss) {
		if (holdercss.styleSheet) {
			holdercss.styleSheet.cssText += options.stylesheet;
		} else {
			holdercss.appendChild(document.createTextNode(options.stylesheet));
		}
	}
	var cssregex = new RegExp(options.domain + "\/(.*?)\"?\\)");
	for (var l = bgnodes.length, i = 0; i < l; i++) {
		var src = window.getComputedStyle(bgnodes[i], null)
			.getPropertyValue("background-image");
		var flags = src.match(cssregex);
		var bgsrc = bgnodes[i].getAttribute("data-background-src");
		if (flags) {
			var holder = parse_flags(flags[1].split("/"), options);
			if (holder) {
				render("background", bgnodes[i], holder, src);
			}
		} else if (bgsrc != null) {
			var holder = parse_flags(bgsrc.substr(bgsrc.lastIndexOf(options.domain) + options.domain.length + 1)
				.split("/"), options);
			if (holder) {
				render("background", bgnodes[i], holder, src);
			}
		}
	}
	for (l = images.length, i = 0; i < l; i++) {
		var attr_data_src, attr_src;
		attr_src = attr_data_src = src = null;
		try {
			attr_src = images[i].getAttribute("src");
			attr_datasrc = images[i].getAttribute("data-src");
		} catch (e) {}
		if (attr_datasrc == null && !! attr_src && attr_src.indexOf(options.domain) >= 0) {
			src = attr_src;
		} else if ( !! attr_datasrc && attr_datasrc.indexOf(options.domain) >= 0) {
			src = attr_datasrc;
		}
		if (src) {
			var holder = parse_flags(src.substr(src.lastIndexOf(options.domain) + options.domain.length + 1)
				.split("/"), options);
			if (holder) {
				if (holder.fluid) {
					render("fluid", images[i], holder, src)
				} else {
					render("image", images[i], holder, src);
				}
			}
		}
	}
	return app;
};
contentLoaded(win, function () {
	if (window.addEventListener) {
		window.addEventListener("resize", resizable_update, false);
		window.addEventListener("orientationchange", resizable_update, false);
	} else {
		window.attachEvent("onresize", resizable_update)
	}
	preempted || app.run();
});
if (typeof define === "function" && define.amd) {
	define([], function () {
		return app;
	});
}

})(Holder, window);

/*! 
 * LESS - Leaner CSS v1.5.0 
 * http://lesscss.org 
 * 
 * Copyright (c) 2009-2013, Alexis Sellier <self@cloudhead.net> 
 * Licensed under the Apache v2 License. 
 * 
 * @licence 
 */ 

function require(a){return window.less[a.split("/")[1]]}function log(a,b){"development"==less.env&&"undefined"!=typeof console&&less.logLevel>=b&&console.log("less: "+a)}function extractId(a){return a.replace(/^[a-z-]+:\/+?[^\/]+/,"").replace(/^\//,"").replace(/\.[a-zA-Z]+$/,"").replace(/[^\.\w-]+/g,"-").replace(/\./g,":")}function errorConsole(a,b){var c="{line} {content}",d=a.filename||b,e=[],f=(a.type||"Syntax")+"Error: "+(a.message||"There is an error in your .less file")+" in "+d+" ",g=function(a,b,d){void 0!==a.extract[b]&&e.push(c.replace(/\{line\}/,(parseInt(a.line,10)||0)+(b-1)).replace(/\{class\}/,d).replace(/\{content\}/,a.extract[b]))};a.extract?(g(a,0,""),g(a,1,"line"),g(a,2,""),f+="on line "+a.line+", column "+(a.column+1)+":\n"+e.join("\n")):a.stack&&(f+=a.stack),log(f,logLevel.errors)}function createCSS(a,b,c){var d=b.href||"",e="less:"+(b.title||extractId(d)),f=document.getElementById(e),g=!1,h=document.createElement("style");if(h.setAttribute("type","text/css"),b.media&&h.setAttribute("media",b.media),h.id=e,h.styleSheet)try{h.styleSheet.cssText=a}catch(i){throw new Error("Couldn't reassign styleSheet.cssText.")}else h.appendChild(document.createTextNode(a)),g=null!==f&&f.childNodes.length>0&&h.childNodes.length>0&&f.firstChild.nodeValue===h.firstChild.nodeValue;var j=document.getElementsByTagName("head")[0];if(null===f||g===!1){var k=b&&b.nextSibling||null;k?k.parentNode.insertBefore(h,k):j.appendChild(h)}if(f&&g===!1&&f.parentNode.removeChild(f),c&&cache){log("saving "+d+" to cache.",logLevel.info);try{cache.setItem(d,a),cache.setItem(d+":timestamp",c)}catch(i){log("failed to save",logLevel.errors)}}}function errorHTML(a,b){var c,d,e="less-error-message:"+extractId(b||""),f='<li><label>{line}</label><pre class="{class}">{content}</pre></li>',g=document.createElement("div"),h=[],i=a.filename||b,j=i.match(/([^\/]+(\?.*)?)$/)[1];g.id=e,g.className="less-error-message",d="<h3>"+(a.type||"Syntax")+"Error: "+(a.message||"There is an error in your .less file")+"</h3>"+'<p>in <a href="'+i+'">'+j+"</a> ";var k=function(a,b,c){void 0!==a.extract[b]&&h.push(f.replace(/\{line\}/,(parseInt(a.line,10)||0)+(b-1)).replace(/\{class\}/,c).replace(/\{content\}/,a.extract[b]))};a.extract?(k(a,0,""),k(a,1,"line"),k(a,2,""),d+="on line "+a.line+", column "+(a.column+1)+":</p>"+"<ul>"+h.join("")+"</ul>"):a.stack&&(d+="<br/>"+a.stack.split("\n").slice(1).join("<br/>")),g.innerHTML=d,createCSS([".less-error-message ul, .less-error-message li {","list-style-type: none;","margin-right: 15px;","padding: 4px 0;","margin: 0;","}",".less-error-message label {","font-size: 12px;","margin-right: 15px;","padding: 4px 0;","color: #cc7777;","}",".less-error-message pre {","color: #dd6666;","padding: 4px 0;","margin: 0;","display: inline-block;","}",".less-error-message pre.line {","color: #ff0000;","}",".less-error-message h3 {","font-size: 20px;","font-weight: bold;","padding: 15px 0 5px 0;","margin: 0;","}",".less-error-message a {","color: #10a","}",".less-error-message .error {","color: red;","font-weight: bold;","padding-bottom: 2px;","border-bottom: 1px dashed red;","}"].join("\n"),{title:"error-message"}),g.style.cssText=["font-family: Arial, sans-serif","border: 1px solid #e00","background-color: #eee","border-radius: 5px","-webkit-border-radius: 5px","-moz-border-radius: 5px","color: #e00","padding: 15px","margin-bottom: 15px"].join(";"),"development"==less.env&&(c=setInterval(function(){document.body&&(document.getElementById(e)?document.body.replaceChild(g,document.getElementById(e)):document.body.insertBefore(g,document.body.firstChild),clearInterval(c))},10))}function error(a,b){less.errorReporting&&"html"!==less.errorReporting?"console"===less.errorReporting?errorConsole(a,b):"function"==typeof less.errorReporting&&less.errorReporting("add",a,b):errorHTML(a,b)}function removeErrorHTML(a){var b=document.getElementById("less-error-message:"+extractId(a));b&&b.parentNode.removeChild(b)}function removeErrorConsole(){}function removeError(a){less.errorReporting&&"html"!==less.errorReporting?"console"===less.errorReporting?removeErrorConsole(a):"function"==typeof less.errorReporting&&less.errorReporting("remove",a):removeErrorHTML(a)}function loadStyles(a){for(var b,c=document.getElementsByTagName("style"),d=0;d<c.length;d++)if(b=c[d],b.type.match(typePattern)){var e=new less.tree.parseEnv(less),f=b.innerHTML||"";e.filename=document.location.href.replace(/#.*$/,""),a&&(e.useFileCache=!0,f+="\n"+a);var g=function(a){return function(b,c){if(b)return error(b,"inline");var d=c.toCSS(less);a.type="text/css",a.styleSheet?a.styleSheet.cssText=d:a.innerHTML=d}}(b);new less.Parser(e).parse(f,g)}}function extractUrlParts(a,b){var c,d,e=/^((?:[a-z-]+:)?\/+?(?:[^\/\?#]*\/)|([\/\\]))?((?:[^\/\\\?#]*[\/\\])*)([^\/\\\?#]*)([#\?].*)?$/i,f=a.match(e),g={},h=[];if(!f)throw new Error("Could not parse sheet href - '"+a+"'");if(!f[1]||f[2]){if(d=b.match(e),!d)throw new Error("Could not parse page url - '"+b+"'");f[1]=f[1]||d[1]||"",f[2]||(f[3]=d[3]+f[3])}if(f[3]){for(h=f[3].replace(/\\/g,"/").split("/"),c=0;c<h.length;c++)"."===h[c]&&(h.splice(c,1),c-=1);for(c=0;c<h.length;c++)".."===h[c]&&c>0&&(h.splice(c-1,2),c-=2)}return g.hostPart=f[1],g.directories=h,g.path=f[1]+h.join("/"),g.fileUrl=g.path+(f[4]||""),g.url=g.fileUrl+(f[5]||""),g}function pathDiff(a,b){var c,d,e,f,g=extractUrlParts(a),h=extractUrlParts(b),i="";if(g.hostPart!==h.hostPart)return"";for(d=Math.max(h.directories.length,g.directories.length),c=0;d>c&&h.directories[c]===g.directories[c];c++);for(f=h.directories.slice(c),e=g.directories.slice(c),c=0;c<f.length-1;c++)i+="../";for(c=0;c<e.length-1;c++)i+=e[c]+"/";return i}function getXMLHttpRequest(){if(window.XMLHttpRequest)return new XMLHttpRequest;try{return new ActiveXObject("MSXML2.XMLHTTP.3.0")}catch(a){return log("browser doesn't support AJAX.",logLevel.errors),null}}function doXHR(a,b,c,d){function e(b,c,d){b.status>=200&&b.status<300?c(b.responseText,b.getResponseHeader("Last-Modified")):"function"==typeof d&&d(b.status,a)}var f=getXMLHttpRequest(),g=isFileProtocol?less.fileAsync:less.async;"function"==typeof f.overrideMimeType&&f.overrideMimeType("text/css"),log("XHR: Getting '"+a+"'",logLevel.info),f.open("GET",a,g),f.setRequestHeader("Accept",b||"text/x-less, text/css; q=0.9, */*; q=0.5"),f.send(null),isFileProtocol&&!less.fileAsync?0===f.status||f.status>=200&&f.status<300?c(f.responseText):d(f.status,a):g?f.onreadystatechange=function(){4==f.readyState&&e(f,c,d)}:e(f,c,d)}function loadFile(a,b,c,d,e){b&&b.currentDirectory&&!/^([a-z-]+:)?\//.test(a)&&(a=b.currentDirectory+a);var f=extractUrlParts(a,window.location.href),g=f.url,h={currentDirectory:f.path,filename:g};if(b?(h.entryPath=b.entryPath,h.rootpath=b.rootpath,h.rootFilename=b.rootFilename,h.relativeUrls=b.relativeUrls):(h.entryPath=f.path,h.rootpath=less.rootpath||f.path,h.rootFilename=g,h.relativeUrls=d.relativeUrls),h.relativeUrls&&(h.rootpath=d.rootpath?extractUrlParts(d.rootpath+pathDiff(f.path,h.entryPath)).path:f.path),d.useFileCache&&fileCache[g])try{var i=fileCache[g];e&&(i+="\n"+e),c(null,i,g,h,{lastModified:new Date})}catch(j){c(j,null,g)}else doXHR(g,d.mime,function(a,b){fileCache[g]=a;try{c(null,a,g,h,{lastModified:b})}catch(d){c(d,null,g)}},function(a,b){c({type:"File",message:"'"+b+"' wasn't found ("+a+")"},null,g)})}function loadStyleSheet(a,b,c,d,e){var f=new less.tree.parseEnv(less);f.mime=a.type,e&&(f.useFileCache=!0),loadFile(a.href,null,function(e,g,h,i,j){if(j){j.remaining=d;var k=cache&&cache.getItem(h),l=cache&&cache.getItem(h+":timestamp");if(!c&&l&&j.lastModified&&new Date(j.lastModified).valueOf()===new Date(l).valueOf())return createCSS(k,a),j.local=!0,b(null,null,g,a,j,h),void 0}removeError(h),g?(f.currentFileInfo=i,new less.Parser(f).parse(g,function(c,d){if(c)return b(c,null,null,a);try{b(c,d,g,a,j,h)}catch(c){b(c,null,null,a)}})):b(e,null,null,a,j,h)},f,e)}function loadStyleSheets(a,b,c){for(var d=0;d<less.sheets.length;d++)loadStyleSheet(less.sheets[d],a,b,less.sheets.length-(d+1),c)}function initRunningMode(){"development"===less.env?(less.optimization=0,less.watchTimer=setInterval(function(){less.watchMode&&loadStyleSheets(function(a,b,c,d,e){a?error(a,d.href):b&&createCSS(b.toCSS(less),d,e.lastModified)})},less.poll)):less.optimization=3}("undefined"==typeof window.less||"undefined"!=typeof window.less.nodeType)&&(window.less={}),less=window.less,tree=window.less.tree={},less.mode="browser";var less,tree;void 0===less&&(less=exports,tree=require("./tree"),less.mode="node"),less.Parser=function(a){function b(){r=u[q],s=p,v=p}function c(){u[q]=r,p=s,v=p}function d(){p>v&&(u[q]=u[q].slice(p-v),v=p)}function e(a){var b=a.charCodeAt(0);return 32===b||10===b||9===b}function f(a){var b,c;if(a instanceof Function)return a.call(w.parsers);if("string"==typeof a)b=o.charAt(p)===a?a:null,c=1,d();else{if(d(),!(b=a.exec(u[q])))return null;c=b[0].length}return b?(g(c),"string"==typeof b?b:1===b.length?b[0]:b):void 0}function g(a){for(var b=p,c=q,d=p+u[q].length,f=p+=a;d>p&&e(o.charAt(p));)p++;return u[q]=u[q].slice(a+(p-f)),v=p,0===u[q].length&&q<u.length-1&&q++,b!==p||c!==q}function h(a,b){var c=f(a);return c?c:(i(b||("string"==typeof a?"expected '"+a+"' got '"+o.charAt(p)+"'":"unexpected token")),void 0)}function i(a,b){var c=new Error(a);throw c.index=p,c.type=b||"Syntax",c}function j(a){return"string"==typeof a?o.charAt(p)===a:a.test(u[q])}function k(a,b){return a.filename&&b.currentFileInfo.filename&&a.filename!==b.currentFileInfo.filename?w.imports.contents[a.filename]:o}function l(a,b){for(var c=a+1,d=null,e=-1;--c>=0&&"\n"!==b.charAt(c);)e++;return"number"==typeof a&&(d=(b.slice(0,a).match(/\n/g)||"").length),{line:d,column:e}}function m(a,b,c){var d=c.currentFileInfo.filename;return"browser"!==less.mode&&"rhino"!==less.mode&&(d=require("path").resolve(d)),{lineNumber:l(a,b).line+1,fileName:d}}function n(a,b){var c=k(a,b),d=l(a.index,c),e=d.line,f=d.column,g=a.call&&l(a.call,c).line,h=c.split("\n");this.type=a.type||"Syntax",this.message=a.message,this.filename=a.filename||b.currentFileInfo.filename,this.index=a.index,this.line="number"==typeof e?e+1:null,this.callLine=g+1,this.callExtract=h[g],this.stack=a.stack,this.column=f,this.extract=[h[e-1],h[e],h[e+1]]}var o,p,q,r,s,t,u,v,w,x=a&&a.filename;a instanceof tree.parseEnv||(a=new tree.parseEnv(a));var y=this.imports={paths:a.paths||[],queue:[],files:a.files,contents:a.contents,mime:a.mime,error:null,push:function(b,c,d,e){var f=this;this.queue.push(b);var g=function(a,c,d){f.queue.splice(f.queue.indexOf(b),1);var g=d in f.files||d===x;f.files[d]=c,a&&!f.error&&(f.error=a),e(a,c,g,d)};less.Parser.importer?less.Parser.importer(b,c,g,a):less.Parser.fileLoader(b,c,function(b,e,f,h){if(b)return g(b),void 0;var i=new tree.parseEnv(a);i.currentFileInfo=h,i.processImports=!1,i.contents[f]=e,(c.reference||d.reference)&&(h.reference=!0),d.inline?g(null,e,f):new less.Parser(i).parse(e,function(a,b){g(a,b,f)})},a)}};return n.prototype=new Error,n.prototype.constructor=n,this.env=a=a||{},this.optimization="optimization"in this.env?this.env.optimization:1,w={imports:y,parse:function(b,c){var d,e,g,h=null;if(p=q=v=t=0,o=b.replace(/\r\n/g,"\n"),o=o.replace(/^\uFEFF/,""),w.imports.contents[a.currentFileInfo.filename]=o,u=function(b){for(var c,d,e,f,g=0,i=/(?:@\{[\w-]+\}|[^"'`\{\}\/\(\)\\])+/g,j=/\/\*(?:[^*]|\*+[^\/*])*\*+\/|\/\/.*/g,k=/"((?:[^"\\\r\n]|\\.)*)"|'((?:[^'\\\r\n]|\\.)*)'|`((?:[^`]|\\.)*)`/g,l=0,m=b[0],p=0;p<o.length;)if(i.lastIndex=p,(c=i.exec(o))&&c.index===p&&(p+=c[0].length,m.push(c[0])),e=o.charAt(p),j.lastIndex=k.lastIndex=p,(c=k.exec(o))&&c.index===p)p+=c[0].length,m.push(c[0]);else if(d||"/"!==e||(f=o.charAt(p+1),"/"!==f&&"*"!==f||!(c=j.exec(o))||c.index!==p)){switch(e){case"{":if(!d){l++,m.push(e);break}case"}":if(!d){l--,m.push(e),b[++g]=m=[];break}case"(":if(!d){d=!0,m.push(e);break}case")":if(d){d=!1,m.push(e);break}default:m.push(e)}p++}else p+=c[0].length,m.push(c[0]);return 0!==l&&(h=new n({index:p-1,type:"Parse",message:l>0?"missing closing `}`":"missing opening `{`",filename:a.currentFileInfo.filename},a)),b.map(function(a){return a.join("")})}([[]]),h)return c(new n(h,a));try{d=new tree.Ruleset([],f(this.parsers.primary)),d.root=!0,d.firstRoot=!0}catch(i){return c(new n(i,a))}if(d.toCSS=function(b){return function(c,d){c=c||{};var e,f,g=new tree.evalEnv(c);"object"!=typeof d||Array.isArray(d)||(d=Object.keys(d).map(function(a){var b=d[a];return b instanceof tree.Value||(b instanceof tree.Expression||(b=new tree.Expression([b])),b=new tree.Value([b])),new tree.Rule("@"+a,b,!1,null,0)}),g.frames=[new tree.Ruleset(null,d)]);try{e=b.call(this,g),(new tree.joinSelectorVisitor).run(e),(new tree.processExtendsVisitor).run(e),new tree.toCSSVisitor({compress:Boolean(c.compress)}).run(e),c.sourceMap&&(e=new tree.sourceMapOutput({writeSourceMap:c.writeSourceMap,rootNode:e,contentsMap:w.imports.contents,sourceMapFilename:c.sourceMapFilename,outputFilename:c.sourceMapOutputFilename,sourceMapBasepath:c.sourceMapBasepath,sourceMapRootpath:c.sourceMapRootpath,outputSourceFiles:c.outputSourceFiles,sourceMapGenerator:c.sourceMapGenerator})),f=e.toCSS({compress:Boolean(c.compress),dumpLineNumbers:a.dumpLineNumbers,strictUnits:Boolean(c.strictUnits)})}catch(h){throw new n(h,a)}return c.cleancss&&"node"===less.mode?require("clean-css").process(f):c.compress?f.replace(/(^(\s)+)|((\s)+$)/g,""):f}}(d.eval),p<o.length-1){p=t;var j=l(p,o);g=o.split("\n"),e=j.line+1,h={type:"Parse",message:"Unrecognised input",index:p,filename:a.currentFileInfo.filename,line:e,column:j.column,extract:[g[e-2],g[e-1],g[e]]}}var k=function(b){return b=h||b||w.imports.error,b?(b instanceof n||(b=new n(b,a)),c(b)):c(null,d)};return a.processImports===!1?k():(new tree.importVisitor(this.imports,k).run(d),void 0)},parsers:{primary:function(){for(var a,b=[];(a=f(this.extendRule)||f(this.mixin.definition)||f(this.rule)||f(this.ruleset)||f(this.mixin.call)||f(this.comment)||f(this.directive))||f(/^[\s\n]+/)||f(/^;+/);)a&&b.push(a);return b},comment:function(){var b;if("/"===o.charAt(p))return"/"===o.charAt(p+1)?new tree.Comment(f(/^\/\/.*/),!0,p,a.currentFileInfo):(b=f(/^\/\*(?:[^*]|\*+[^\/*])*\*+\/\n?/))?new tree.Comment(b,!1,p,a.currentFileInfo):void 0},comments:function(){for(var a,b=[];a=f(this.comment);)b.push(a);return b},entities:{quoted:function(){var b,c,d=p,e=p;return"~"===o.charAt(d)&&(d++,c=!0),'"'===o.charAt(d)||"'"===o.charAt(d)?(c&&f("~"),(b=f(/^"((?:[^"\\\r\n]|\\.)*)"|'((?:[^'\\\r\n]|\\.)*)'/))?new tree.Quoted(b[0],b[1]||b[2],c,e,a.currentFileInfo):void 0):void 0},keyword:function(){var a;if(a=f(/^[_A-Za-z-][_A-Za-z0-9-]*/)){var b=tree.Color.fromKeyword(a);return b?b:new tree.Keyword(a)}},call:function(){var b,c,d,e,g=p;if(b=/^([\w-]+|%|progid:[\w\.]+)\(/.exec(u[q])){if(b=b[1],c=b.toLowerCase(),"url"===c)return null;if(p+=b.length,"alpha"===c&&(e=f(this.alpha),"undefined"!=typeof e))return e;if(f("("),d=f(this.entities.arguments),f(")"))return b?new tree.Call(b,d,g,a.currentFileInfo):void 0}},arguments:function(){for(var a,b=[];(a=f(this.entities.assignment)||f(this.expression))&&(b.push(a),f(",")););return b},literal:function(){return f(this.entities.dimension)||f(this.entities.color)||f(this.entities.quoted)||f(this.entities.unicodeDescriptor)},assignment:function(){var a,b;return(a=f(/^\w+(?=\s?=)/i))&&f("=")&&(b=f(this.entity))?new tree.Assignment(a,b):void 0},url:function(){var b;if("u"===o.charAt(p)&&f(/^url\(/))return b=f(this.entities.quoted)||f(this.entities.variable)||f(/^(?:(?:\\[\(\)'"])|[^\(\)'"])+/)||"",h(")"),new tree.URL(null!=b.value||b instanceof tree.Variable?b:new tree.Anonymous(b),a.currentFileInfo)},variable:function(){var b,c=p;return"@"===o.charAt(p)&&(b=f(/^@@?[\w-]+/))?new tree.Variable(b,c,a.currentFileInfo):void 0},variableCurly:function(){var b,c=p;return"@"===o.charAt(p)&&(b=f(/^@\{([\w-]+)\}/))?new tree.Variable("@"+b[1],c,a.currentFileInfo):void 0},color:function(){var a;return"#"===o.charAt(p)&&(a=f(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/))?new tree.Color(a[1]):void 0},dimension:function(){var a,b=o.charCodeAt(p);if(!(b>57||43>b||47===b||44==b))return(a=f(/^([+-]?\d*\.?\d+)(%|[a-z]+)?/))?new tree.Dimension(a[1],a[2]):void 0},unicodeDescriptor:function(){var a;return(a=f(/^U\+[0-9a-fA-F?]+(\-[0-9a-fA-F?]+)?/))?new tree.UnicodeDescriptor(a[0]):void 0},javascript:function(){var b,c,d=p;return"~"===o.charAt(d)&&(d++,c=!0),"`"===o.charAt(d)?(void 0===a.javascriptEnabled||a.javascriptEnabled||i("You are using JavaScript, which has been disabled."),c&&f("~"),(b=f(/^`([^`]*)`/))?new tree.JavaScript(b[1],p,c):void 0):void 0}},variable:function(){var a;return"@"===o.charAt(p)&&(a=f(/^(@[\w-]+)\s*:/))?a[1]:void 0},extend:function(a){var b,c,d,e=p,g=[];if(f(a?/^&:extend\(/:/^:extend\(/)){do{for(d=null,b=[];;){if(d=f(/^(all)(?=\s*(\)|,))/))break;if(c=f(this.element),!c)break;b.push(c)}d=d&&d[1],g.push(new tree.Extend(new tree.Selector(b),d,e))}while(f(","));return h(/^\)/),a&&h(/^;/),g}},extendRule:function(){return this.extend(!0)},mixin:{call:function(){var d,e,g,i=[],k=p,l=o.charAt(p),m=!1;if("."===l||"#"===l){for(b();d=f(/^[#.](?:[\w-]|\\(?:[A-Fa-f0-9]{1,6} ?|[^A-Fa-f0-9]))+/);)i.push(new tree.Element(e,d,p,a.currentFileInfo)),e=f(">");return f("(")&&(g=this.mixin.args.call(this,!0).args,h(")")),g=g||[],f(this.important)&&(m=!0),i.length>0&&(f(";")||j("}"))?new tree.mixin.Call(i,g,k,a.currentFileInfo,m):(c(),void 0)}},args:function(a){for(var b,c,d,e,g,j,k=[],l=[],m=[],n={args:null,variadic:!1};;){if(a)j=f(this.expression);else{if(f(this.comments),"."===o.charAt(p)&&f(/^\.{3}/)){n.variadic=!0,f(";")&&!b&&(b=!0),(b?l:m).push({variadic:!0});break}j=f(this.entities.variable)||f(this.entities.literal)||f(this.entities.keyword)}if(!j)break;e=null,j.throwAwayComments&&j.throwAwayComments(),g=j;var q=null;if(a?1==j.value.length&&(q=j.value[0]):q=j,q&&q instanceof tree.Variable)if(f(":"))k.length>0&&(b&&i("Cannot mix ; and , as delimiter types"),c=!0),g=h(this.expression),e=d=q.name;else{if(!a&&f(/^\.{3}/)){n.variadic=!0,f(";")&&!b&&(b=!0),(b?l:m).push({name:j.name,variadic:!0});break}a||(d=e=q.name,g=null)}g&&k.push(g),m.push({name:e,value:g}),f(",")||(f(";")||b)&&(c&&i("Cannot mix ; and , as delimiter types"),b=!0,k.length>1&&(g=new tree.Value(k)),l.push({name:d,value:g}),d=null,k=[],c=!1)}return n.args=b?l:m,n},definition:function(){var a,d,e,g,i=[],k=!1;if(!("."!==o.charAt(p)&&"#"!==o.charAt(p)||j(/^[^{]*\}/))&&(b(),d=f(/^([#.](?:[\w-]|\\(?:[A-Fa-f0-9]{1,6} ?|[^A-Fa-f0-9]))+)\s*\(/))){a=d[1];var l=this.mixin.args.call(this,!1);if(i=l.args,k=l.variadic,f(")")||(t=p,c()),f(this.comments),f(/^when/)&&(g=h(this.conditions,"expected condition")),e=f(this.block))return new tree.mixin.Definition(a,i,e,g,k);c()}}},entity:function(){return f(this.entities.literal)||f(this.entities.variable)||f(this.entities.url)||f(this.entities.call)||f(this.entities.keyword)||f(this.entities.javascript)||f(this.comment)},end:function(){return f(";")||j("}")},alpha:function(){var a;if(f(/^\(opacity=/i))return(a=f(/^\d+/)||f(this.entities.variable))?(h(")"),new tree.Alpha(a)):void 0},element:function(){var b,c,d;return c=f(this.combinator),b=f(/^(?:\d+\.\d+|\d+)%/)||f(/^(?:[.#]?|:*)(?:[\w-]|[^\x00-\x9f]|\\(?:[A-Fa-f0-9]{1,6} ?|[^A-Fa-f0-9]))+/)||f("*")||f("&")||f(this.attribute)||f(/^\([^()@]+\)/)||f(/^[\.#](?=@)/)||f(this.entities.variableCurly),b||f("(")&&(d=f(this.selector))&&f(")")&&(b=new tree.Paren(d)),b?new tree.Element(c,b,p,a.currentFileInfo):void 0},combinator:function(){var a=o.charAt(p);if(">"===a||"+"===a||"~"===a||"|"===a){for(p++;o.charAt(p).match(/\s/);)p++;return new tree.Combinator(a)}return o.charAt(p-1).match(/\s/)?new tree.Combinator(" "):new tree.Combinator(null)},lessSelector:function(){return this.selector(!0)},selector:function(b){for(var c,d,e,g,j,k=[],l=[];(b&&(e=f(this.extend))||b&&(g=f(/^when/))||(c=f(this.element)))&&(g?j=h(this.conditions,"expected condition"):j?i("CSS guard can only be used at the end of selector"):e?l.push.apply(l,e):(l.length&&i("Extend can only be used at the end of selector"),d=o.charAt(p),k.push(c),c=null),"{"!==d&&"}"!==d&&";"!==d&&","!==d&&")"!==d););return k.length>0?new tree.Selector(k,l,j,p,a.currentFileInfo):(l.length&&i("Extend must be used to extend a selector, it cannot be used on its own"),void 0)},attribute:function(){var a,b,c;if(f("["))return(a=f(this.entities.variableCurly))||(a=h(/^(?:[_A-Za-z0-9-\*]*\|)?(?:[_A-Za-z0-9-]|\\.)+/)),(c=f(/^[|~*$^]?=/))&&(b=f(this.entities.quoted)||f(/^[0-9]+%/)||f(/^[\w-]+/)||f(this.entities.variableCurly)),h("]"),new tree.Attribute(a,c,b)},block:function(){var a;return f("{")&&(a=f(this.primary))&&f("}")?a:void 0},ruleset:function(){var d,e,g,h=[];for(b(),a.dumpLineNumbers&&(g=m(p,o,a));(d=f(this.lessSelector))&&(h.push(d),f(this.comments),f(","));)d.condition&&i("Guards are only currently allowed on a single selector."),f(this.comments);if(h.length>0&&(e=f(this.block))){var j=new tree.Ruleset(h,e,a.strictImports);return a.dumpLineNumbers&&(j.debugInfo=g),j}t=p,c()},rule:function(d){var e,g,h,i=o.charAt(p),j=!1;if(b(),"."!==i&&"#"!==i&&"&"!==i&&(e=f(this.variable)||f(this.ruleProperty))){if(g=d||!a.compress&&"@"!==e.charAt(0)?f(this.anonymousValue)||f(this.value):f(this.value)||f(this.anonymousValue),h=f(this.important),"+"===e[e.length-1]&&(j=!0,e=e.substr(0,e.length-1)),g&&f(this.end))return new tree.Rule(e,g,h,j,s,a.currentFileInfo);if(t=p,c(),g&&!d)return this.rule(!0)}},anonymousValue:function(){var a;return(a=/^([^@+\/'"*`(;{}-]*);/.exec(u[q]))?(p+=a[0].length-1,new tree.Anonymous(a[1])):void 0},"import":function(){var d,e,g=p;b();var h=f(/^@import?\s+/),i=(h?f(this.importOptions):null)||{};return h&&(d=f(this.entities.quoted)||f(this.entities.url))&&(e=f(this.mediaFeatures),f(";"))?(e=e&&new tree.Value(e),new tree.Import(d,e,i,g,a.currentFileInfo)):(c(),void 0)},importOptions:function(){var a,b,c,d={};if(!f("("))return null;do if(a=f(this.importOption)){switch(b=a,c=!0,b){case"css":b="less",c=!1;break;case"once":b="multiple",c=!1}if(d[b]=c,!f(","))break}while(a);return h(")"),d},importOption:function(){var a=f(/^(less|css|multiple|once|inline|reference)/);return a?a[1]:void 0},mediaFeature:function(){var b,c,d=[];do if(b=f(this.entities.keyword)||f(this.entities.variable))d.push(b);else if(f("(")){if(c=f(this.property),b=f(this.value),!f(")"))return null;if(c&&b)d.push(new tree.Paren(new tree.Rule(c,b,null,null,p,a.currentFileInfo,!0)));else{if(!b)return null;d.push(new tree.Paren(b))}}while(b);return d.length>0?new tree.Expression(d):void 0},mediaFeatures:function(){var a,b=[];do if(a=f(this.mediaFeature)){if(b.push(a),!f(","))break}else if((a=f(this.entities.variable))&&(b.push(a),!f(",")))break;while(a);return b.length>0?b:null},media:function(){var b,c,d,e;return a.dumpLineNumbers&&(e=m(p,o,a)),f(/^@media/)&&(b=f(this.mediaFeatures),c=f(this.block))?(d=new tree.Media(c,b,p,a.currentFileInfo),a.dumpLineNumbers&&(d.debugInfo=e),d):void 0},directive:function(){var d,e,g,h,i,j,k,l;if("@"===o.charAt(p)){if(e=f(this["import"])||f(this.media))return e;if(b(),d=f(/^@[a-z-]+/)){switch(h=d,"-"==d.charAt(1)&&d.indexOf("-",2)>0&&(h="@"+d.slice(d.indexOf("-",2)+1)),h){case"@font-face":i=!0;break;case"@viewport":case"@top-left":case"@top-left-corner":case"@top-center":case"@top-right":case"@top-right-corner":case"@bottom-left":case"@bottom-left-corner":case"@bottom-center":case"@bottom-right":case"@bottom-right-corner":case"@left-top":case"@left-middle":case"@left-bottom":case"@right-top":case"@right-middle":case"@right-bottom":i=!0;break;case"@host":case"@page":case"@document":case"@supports":case"@keyframes":i=!0,j=!0;break;case"@namespace":k=!0}if(j&&(l=(f(/^[^{]+/)||"").trim(),l&&(d+=" "+l)),i){if(g=f(this.block))return new tree.Directive(d,g,p,a.currentFileInfo)}else if((e=k?f(this.expression):f(this.entity))&&f(";")){var n=new tree.Directive(d,e,p,a.currentFileInfo);return a.dumpLineNumbers&&(n.debugInfo=m(p,o,a)),n}c()}}},value:function(){for(var a,b=[];(a=f(this.expression))&&(b.push(a),f(",")););return b.length>0?new tree.Value(b):void 0},important:function(){return"!"===o.charAt(p)?f(/^! *important/):void 0},sub:function(){var a,b;return f("(")&&(a=f(this.addition))?(b=new tree.Expression([a]),h(")"),b.parens=!0,b):void 0},multiplication:function(){var a,b,c,d,g;if(a=f(this.operand)){for(g=e(o.charAt(p-1));!j(/^\/[*\/]/)&&(c=f("/")||f("*"))&&(b=f(this.operand));)a.parensInOp=!0,b.parensInOp=!0,d=new tree.Operation(c,[d||a,b],g),g=e(o.charAt(p-1));return d||a}},addition:function(){var a,b,c,d,g;if(a=f(this.multiplication)){for(g=e(o.charAt(p-1));(c=f(/^[-+]\s+/)||!g&&(f("+")||f("-")))&&(b=f(this.multiplication));)a.parensInOp=!0,b.parensInOp=!0,d=new tree.Operation(c,[d||a,b],g),g=e(o.charAt(p-1));return d||a}},conditions:function(){var a,b,c,d=p;if(a=f(this.condition)){for(;j(/^,\s*(not\s*)?\(/)&&f(",")&&(b=f(this.condition));)c=new tree.Condition("or",c||a,b,d);return c||a}},condition:function(){var a,b,c,d,e=p,g=!1;return f(/^not/)&&(g=!0),h("("),(a=f(this.addition)||f(this.entities.keyword)||f(this.entities.quoted))?((d=f(/^(?:>=|<=|=<|[<=>])/))?(b=f(this.addition)||f(this.entities.keyword)||f(this.entities.quoted))?c=new tree.Condition(d,a,b,e,g):i("expected expression"):c=new tree.Condition("=",a,new tree.Keyword("true"),e,g),h(")"),f(/^and/)?new tree.Condition("and",c,f(this.condition)):c):void 0},operand:function(){var a,b=o.charAt(p+1);"-"!==o.charAt(p)||"@"!==b&&"("!==b||(a=f("-"));var c=f(this.sub)||f(this.entities.dimension)||f(this.entities.color)||f(this.entities.variable)||f(this.entities.call);return a&&(c.parensInOp=!0,c=new tree.Negative(c)),c},expression:function(){for(var a,b,c=[];a=f(this.addition)||f(this.entity);)c.push(a),!j(/^\/[\/*]/)&&(b=f("/"))&&c.push(new tree.Anonymous(b));return c.length>0?new tree.Expression(c):void 0},property:function(){var a;return(a=f(/^(\*?-?[_a-zA-Z0-9-]+)\s*:/))?a[1]:void 0},ruleProperty:function(){var a;return(a=f(/^(\*?-?[_a-zA-Z0-9-]+)\s*(\+?)\s*:/))?a[1]+(a[2]||""):void 0}}}},function(a){function b(b){return a.functions.hsla(b.h,b.s,b.l,b.a)}function c(b,c){return b instanceof a.Dimension&&b.unit.is("%")?parseFloat(b.value*c/100):d(b)}function d(b){if(b instanceof a.Dimension)return parseFloat(b.unit.is("%")?b.value/100:b.value);if("number"==typeof b)return b;throw{error:"RuntimeError",message:"color functions take numbers as parameters"}}function e(a){return Math.min(1,Math.max(0,a))}a.functions={rgb:function(a,b,c){return this.rgba(a,b,c,1)},rgba:function(b,e,f,g){var h=[b,e,f].map(function(a){return c(a,256)});return g=d(g),new a.Color(h,g)},hsl:function(a,b,c){return this.hsla(a,b,c,1)},hsla:function(a,b,c,f){function g(a){return a=0>a?a+1:a>1?a-1:a,1>6*a?i+6*(h-i)*a:1>2*a?h:2>3*a?i+6*(h-i)*(2/3-a):i}a=d(a)%360/360,b=e(d(b)),c=e(d(c)),f=e(d(f));var h=.5>=c?c*(b+1):c+b-c*b,i=2*c-h;return this.rgba(255*g(a+1/3),255*g(a),255*g(a-1/3),f)},hsv:function(a,b,c){return this.hsva(a,b,c,1)},hsva:function(a,b,c,e){a=360*(d(a)%360/360),b=d(b),c=d(c),e=d(e);var f,g;f=Math.floor(a/60%6),g=a/60-f;var h=[c,c*(1-b),c*(1-g*b),c*(1-(1-g)*b)],i=[[0,3,1],[2,0,1],[1,0,3],[1,2,0],[3,1,0],[0,1,2]];return this.rgba(255*h[i[f][0]],255*h[i[f][1]],255*h[i[f][2]],e)},hue:function(b){return new a.Dimension(Math.round(b.toHSL().h))},saturation:function(b){return new a.Dimension(Math.round(100*b.toHSL().s),"%")},lightness:function(b){return new a.Dimension(Math.round(100*b.toHSL().l),"%")},hsvhue:function(b){return new a.Dimension(Math.round(b.toHSV().h))},hsvsaturation:function(b){return new a.Dimension(Math.round(100*b.toHSV().s),"%")},hsvvalue:function(b){return new a.Dimension(Math.round(100*b.toHSV().v),"%")},red:function(b){return new a.Dimension(b.rgb[0])},green:function(b){return new a.Dimension(b.rgb[1])},blue:function(b){return new a.Dimension(b.rgb[2])},alpha:function(b){return new a.Dimension(b.toHSL().a)},luma:function(b){return new a.Dimension(Math.round(100*b.luma()*b.alpha),"%")},saturate:function(a,c){if(!a.rgb)return null;var d=a.toHSL();return d.s+=c.value/100,d.s=e(d.s),b(d)},desaturate:function(a,c){var d=a.toHSL();return d.s-=c.value/100,d.s=e(d.s),b(d)},lighten:function(a,c){var d=a.toHSL();return d.l+=c.value/100,d.l=e(d.l),b(d)},darken:function(a,c){var d=a.toHSL();return d.l-=c.value/100,d.l=e(d.l),b(d)},fadein:function(a,c){var d=a.toHSL();return d.a+=c.value/100,d.a=e(d.a),b(d)},fadeout:function(a,c){var d=a.toHSL();return d.a-=c.value/100,d.a=e(d.a),b(d)},fade:function(a,c){var d=a.toHSL();return d.a=c.value/100,d.a=e(d.a),b(d)},spin:function(a,c){var d=a.toHSL(),e=(d.h+c.value)%360;return d.h=0>e?360+e:e,b(d)},mix:function(b,c,d){d||(d=new a.Dimension(50));var e=d.value/100,f=2*e-1,g=b.toHSL().a-c.toHSL().a,h=((-1==f*g?f:(f+g)/(1+f*g))+1)/2,i=1-h,j=[b.rgb[0]*h+c.rgb[0]*i,b.rgb[1]*h+c.rgb[1]*i,b.rgb[2]*h+c.rgb[2]*i],k=b.alpha*e+c.alpha*(1-e);return new a.Color(j,k)},greyscale:function(b){return this.desaturate(b,new a.Dimension(100))},contrast:function(a,b,c,e){if(!a.rgb)return null;if("undefined"==typeof c&&(c=this.rgba(255,255,255,1)),"undefined"==typeof b&&(b=this.rgba(0,0,0,1)),b.luma()>c.luma()){var f=c;c=b,b=f}return e="undefined"==typeof e?.43:d(e),a.luma()*a.alpha<e?c:b},e:function(b){return new a.Anonymous(b instanceof a.JavaScript?b.evaluated:b)},escape:function(b){return new a.Anonymous(encodeURI(b.value).replace(/=/g,"%3D").replace(/:/g,"%3A").replace(/#/g,"%23").replace(/;/g,"%3B").replace(/\(/g,"%28").replace(/\)/g,"%29"))},"%":function(b){for(var c=Array.prototype.slice.call(arguments,1),d=b.value,e=0;e<c.length;e++)d=d.replace(/%[sda]/i,function(a){var b=a.match(/s/i)?c[e].value:c[e].toCSS();return a.match(/[A-Z]$/)?encodeURIComponent(b):b});return d=d.replace(/%%/g,"%"),new a.Quoted('"'+d+'"',d)},unit:function(b,c){if(!(b instanceof a.Dimension))throw{type:"Argument",message:"the first argument to unit must be a number"+(b instanceof a.Operation?". Have you forgotten parenthesis?":"")};return new a.Dimension(b.value,c?c.toCSS():"")},convert:function(a,b){return a.convertTo(b.value)},round:function(a,b){var c="undefined"==typeof b?0:b.value;return this._math(function(a){return a.toFixed(c)},null,a)},pi:function(){return new a.Dimension(Math.PI)},mod:function(b,c){return new a.Dimension(b.value%c.value,b.unit)},pow:function(b,c){if("number"==typeof b&&"number"==typeof c)b=new a.Dimension(b),c=new a.Dimension(c);else if(!(b instanceof a.Dimension&&c instanceof a.Dimension))throw{type:"Argument",message:"arguments must be numbers"};return new a.Dimension(Math.pow(b.value,c.value),b.unit)},_math:function(b,c,d){if(d instanceof a.Dimension)return new a.Dimension(b(parseFloat(d.value)),null==c?d.unit:c);if("number"==typeof d)return b(d);throw{type:"Argument",message:"argument must be a number"}},_minmax:function(b,c){switch(c=Array.prototype.slice.call(c),c.length){case 0:throw{type:"Argument",message:"one or more arguments required"};case 1:return c[0]}var d,e,f,g,h,i,j=[],k={};for(d=0;d<c.length;d++)f=c[d],f instanceof a.Dimension?(g=f.unify(),i=g.unit.toString(),e=k[i],void 0!==e?(h=j[e].unify(),(b&&g.value<h.value||!b&&g.value>h.value)&&(j[e]=f)):(k[i]=j.length,j.push(f))):j.push(f);return 1==j.length?j[0]:(c=j.map(function(a){return a.toCSS(this.env)}).join(this.env.compress?",":", "),new a.Anonymous((b?"min":"max")+"("+c+")"))},min:function(){return this._minmax(!0,arguments)},max:function(){return this._minmax(!1,arguments)},argb:function(b){return new a.Anonymous(b.toARGB())},percentage:function(b){return new a.Dimension(100*b.value,"%")},color:function(b){if(b instanceof a.Quoted){var c,d=b.value;if(c=a.Color.fromKeyword(d))return c;if(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/.test(d))return new a.Color(d.slice(1));throw{type:"Argument",message:"argument must be a color keyword or 3/6 digit hex e.g. #FFF"}}throw{type:"Argument",message:"argument must be a string"}},iscolor:function(b){return this._isa(b,a.Color)},isnumber:function(b){return this._isa(b,a.Dimension)},isstring:function(b){return this._isa(b,a.Quoted)},iskeyword:function(b){return this._isa(b,a.Keyword)},isurl:function(b){return this._isa(b,a.URL)
},ispixel:function(a){return this.isunit(a,"px")},ispercentage:function(a){return this.isunit(a,"%")},isem:function(a){return this.isunit(a,"em")},isunit:function(b,c){return b instanceof a.Dimension&&b.unit.is(c.value||c)?a.True:a.False},_isa:function(b,c){return b instanceof c?a.True:a.False},multiply:function(a,b){var c=a.rgb[0]*b.rgb[0]/255,d=a.rgb[1]*b.rgb[1]/255,e=a.rgb[2]*b.rgb[2]/255;return this.rgb(c,d,e)},screen:function(a,b){var c=255-(255-a.rgb[0])*(255-b.rgb[0])/255,d=255-(255-a.rgb[1])*(255-b.rgb[1])/255,e=255-(255-a.rgb[2])*(255-b.rgb[2])/255;return this.rgb(c,d,e)},overlay:function(a,b){var c=a.rgb[0]<128?2*a.rgb[0]*b.rgb[0]/255:255-2*(255-a.rgb[0])*(255-b.rgb[0])/255,d=a.rgb[1]<128?2*a.rgb[1]*b.rgb[1]/255:255-2*(255-a.rgb[1])*(255-b.rgb[1])/255,e=a.rgb[2]<128?2*a.rgb[2]*b.rgb[2]/255:255-2*(255-a.rgb[2])*(255-b.rgb[2])/255;return this.rgb(c,d,e)},softlight:function(a,b){var c=b.rgb[0]*a.rgb[0]/255,d=c+a.rgb[0]*(255-(255-a.rgb[0])*(255-b.rgb[0])/255-c)/255;c=b.rgb[1]*a.rgb[1]/255;var e=c+a.rgb[1]*(255-(255-a.rgb[1])*(255-b.rgb[1])/255-c)/255;c=b.rgb[2]*a.rgb[2]/255;var f=c+a.rgb[2]*(255-(255-a.rgb[2])*(255-b.rgb[2])/255-c)/255;return this.rgb(d,e,f)},hardlight:function(a,b){var c=b.rgb[0]<128?2*b.rgb[0]*a.rgb[0]/255:255-2*(255-b.rgb[0])*(255-a.rgb[0])/255,d=b.rgb[1]<128?2*b.rgb[1]*a.rgb[1]/255:255-2*(255-b.rgb[1])*(255-a.rgb[1])/255,e=b.rgb[2]<128?2*b.rgb[2]*a.rgb[2]/255:255-2*(255-b.rgb[2])*(255-a.rgb[2])/255;return this.rgb(c,d,e)},difference:function(a,b){var c=Math.abs(a.rgb[0]-b.rgb[0]),d=Math.abs(a.rgb[1]-b.rgb[1]),e=Math.abs(a.rgb[2]-b.rgb[2]);return this.rgb(c,d,e)},exclusion:function(a,b){var c=a.rgb[0]+b.rgb[0]*(255-a.rgb[0]-a.rgb[0])/255,d=a.rgb[1]+b.rgb[1]*(255-a.rgb[1]-a.rgb[1])/255,e=a.rgb[2]+b.rgb[2]*(255-a.rgb[2]-a.rgb[2])/255;return this.rgb(c,d,e)},average:function(a,b){var c=(a.rgb[0]+b.rgb[0])/2,d=(a.rgb[1]+b.rgb[1])/2,e=(a.rgb[2]+b.rgb[2])/2;return this.rgb(c,d,e)},negation:function(a,b){var c=255-Math.abs(255-b.rgb[0]-a.rgb[0]),d=255-Math.abs(255-b.rgb[1]-a.rgb[1]),e=255-Math.abs(255-b.rgb[2]-a.rgb[2]);return this.rgb(c,d,e)},tint:function(a,b){return this.mix(this.rgb(255,255,255),a,b)},shade:function(a,b){return this.mix(this.rgb(0,0,0),a,b)},extract:function(a,b){return b=b.value-1,Array.isArray(a.value)?a.value[b]:Array(a)[b]},length:function(b){var c=Array.isArray(b.value)?b.value.length:1;return new a.Dimension(c)},"data-uri":function(b,c){if("undefined"!=typeof window)return new a.URL(c||b,this.currentFileInfo).eval(this.env);var d=b.value,e=c&&c.value,f=require("fs"),g=require("path"),h=!1;if(arguments.length<2&&(e=d),this.env.isPathRelative(e)&&(e=this.currentFileInfo.relativeUrls?g.join(this.currentFileInfo.currentDirectory,e):g.join(this.currentFileInfo.entryPath,e)),arguments.length<2){var i;try{i=require("mime")}catch(j){i=a._mime}d=i.lookup(e);var k=i.charsets.lookup(d);h=["US-ASCII","UTF-8"].indexOf(k)<0,h&&(d+=";base64")}else h=/;base64$/.test(d);var l=f.readFileSync(e),m=32,n=parseInt(l.length/1024,10);if(n>=m&&this.env.ieCompat!==!1)return this.env.silent||console.warn("Skipped data-uri embedding of %s because its size (%dKB) exceeds IE8-safe %dKB!",e,n,m),new a.URL(c||b,this.currentFileInfo).eval(this.env);l=h?l.toString("base64"):encodeURIComponent(l);var o="'data:"+d+","+l+"'";return new a.URL(new a.Anonymous(o))},"svg-gradient":function(b){function c(){throw{type:"Argument",message:"svg-gradient expects direction, start_color [start_position], [color position,]..., end_color [end_position]"}}arguments.length<3&&c();var d,e,f,g,h,i,j,k=Array.prototype.slice.call(arguments,1),l="linear",m='x="0" y="0" width="1" height="1"',n=!0,o={compress:!1},p=b.toCSS(o);switch(p){case"to bottom":d='x1="0%" y1="0%" x2="0%" y2="100%"';break;case"to right":d='x1="0%" y1="0%" x2="100%" y2="0%"';break;case"to bottom right":d='x1="0%" y1="0%" x2="100%" y2="100%"';break;case"to top right":d='x1="0%" y1="100%" x2="100%" y2="0%"';break;case"ellipse":case"ellipse at center":l="radial",d='cx="50%" cy="50%" r="75%"',m='x="-50" y="-50" width="101" height="101"';break;default:throw{type:"Argument",message:"svg-gradient direction must be 'to bottom', 'to right', 'to bottom right', 'to top right' or 'ellipse at center'"}}for(e='<?xml version="1.0" ?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none"><'+l+'Gradient id="gradient" gradientUnits="userSpaceOnUse" '+d+">",f=0;f<k.length;f+=1)k[f].value?(g=k[f].value[0],h=k[f].value[1]):(g=k[f],h=void 0),g instanceof a.Color&&((0===f||f+1===k.length)&&void 0===h||h instanceof a.Dimension)||c(),i=h?h.toCSS(o):0===f?"0%":"100%",j=g.alpha,e+='<stop offset="'+i+'" stop-color="'+g.toRGB()+'"'+(1>j?' stop-opacity="'+j+'"':"")+"/>";if(e+="</"+l+"Gradient>"+"<rect "+m+' fill="url(#gradient)" /></svg>',n)try{e=new Buffer(e).toString("base64")}catch(q){n=!1}return e="'data:image/svg+xml"+(n?";base64":"")+","+e+"'",new a.URL(new a.Anonymous(e))}},a._mime={_types:{".htm":"text/html",".html":"text/html",".gif":"image/gif",".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png"},lookup:function(b){var c=require("path").extname(b),d=a._mime._types[c];if(void 0===d)throw new Error('Optional dependency "mime" is required for '+c);return d},charsets:{lookup:function(a){return a&&/^text\//.test(a)?"UTF-8":""}}};for(var f=[{name:"ceil"},{name:"floor"},{name:"sqrt"},{name:"abs"},{name:"tan",unit:""},{name:"sin",unit:""},{name:"cos",unit:""},{name:"atan",unit:"rad"},{name:"asin",unit:"rad"},{name:"acos",unit:"rad"}],g=function(a,b){return function(c){return null!=b&&(c=c.unify()),this._math(Math[a],b,c)}},h=0;h<f.length;h++)a.functions[f[h].name]=g(f[h].name,f[h].unit);a.functionCall=function(a,b){this.env=a,this.currentFileInfo=b},a.functionCall.prototype=a.functions}(require("./tree")),function(a){a.colors={aliceblue:"#f0f8ff",antiquewhite:"#faebd7",aqua:"#00ffff",aquamarine:"#7fffd4",azure:"#f0ffff",beige:"#f5f5dc",bisque:"#ffe4c4",black:"#000000",blanchedalmond:"#ffebcd",blue:"#0000ff",blueviolet:"#8a2be2",brown:"#a52a2a",burlywood:"#deb887",cadetblue:"#5f9ea0",chartreuse:"#7fff00",chocolate:"#d2691e",coral:"#ff7f50",cornflowerblue:"#6495ed",cornsilk:"#fff8dc",crimson:"#dc143c",cyan:"#00ffff",darkblue:"#00008b",darkcyan:"#008b8b",darkgoldenrod:"#b8860b",darkgray:"#a9a9a9",darkgrey:"#a9a9a9",darkgreen:"#006400",darkkhaki:"#bdb76b",darkmagenta:"#8b008b",darkolivegreen:"#556b2f",darkorange:"#ff8c00",darkorchid:"#9932cc",darkred:"#8b0000",darksalmon:"#e9967a",darkseagreen:"#8fbc8f",darkslateblue:"#483d8b",darkslategray:"#2f4f4f",darkslategrey:"#2f4f4f",darkturquoise:"#00ced1",darkviolet:"#9400d3",deeppink:"#ff1493",deepskyblue:"#00bfff",dimgray:"#696969",dimgrey:"#696969",dodgerblue:"#1e90ff",firebrick:"#b22222",floralwhite:"#fffaf0",forestgreen:"#228b22",fuchsia:"#ff00ff",gainsboro:"#dcdcdc",ghostwhite:"#f8f8ff",gold:"#ffd700",goldenrod:"#daa520",gray:"#808080",grey:"#808080",green:"#008000",greenyellow:"#adff2f",honeydew:"#f0fff0",hotpink:"#ff69b4",indianred:"#cd5c5c",indigo:"#4b0082",ivory:"#fffff0",khaki:"#f0e68c",lavender:"#e6e6fa",lavenderblush:"#fff0f5",lawngreen:"#7cfc00",lemonchiffon:"#fffacd",lightblue:"#add8e6",lightcoral:"#f08080",lightcyan:"#e0ffff",lightgoldenrodyellow:"#fafad2",lightgray:"#d3d3d3",lightgrey:"#d3d3d3",lightgreen:"#90ee90",lightpink:"#ffb6c1",lightsalmon:"#ffa07a",lightseagreen:"#20b2aa",lightskyblue:"#87cefa",lightslategray:"#778899",lightslategrey:"#778899",lightsteelblue:"#b0c4de",lightyellow:"#ffffe0",lime:"#00ff00",limegreen:"#32cd32",linen:"#faf0e6",magenta:"#ff00ff",maroon:"#800000",mediumaquamarine:"#66cdaa",mediumblue:"#0000cd",mediumorchid:"#ba55d3",mediumpurple:"#9370d8",mediumseagreen:"#3cb371",mediumslateblue:"#7b68ee",mediumspringgreen:"#00fa9a",mediumturquoise:"#48d1cc",mediumvioletred:"#c71585",midnightblue:"#191970",mintcream:"#f5fffa",mistyrose:"#ffe4e1",moccasin:"#ffe4b5",navajowhite:"#ffdead",navy:"#000080",oldlace:"#fdf5e6",olive:"#808000",olivedrab:"#6b8e23",orange:"#ffa500",orangered:"#ff4500",orchid:"#da70d6",palegoldenrod:"#eee8aa",palegreen:"#98fb98",paleturquoise:"#afeeee",palevioletred:"#d87093",papayawhip:"#ffefd5",peachpuff:"#ffdab9",peru:"#cd853f",pink:"#ffc0cb",plum:"#dda0dd",powderblue:"#b0e0e6",purple:"#800080",red:"#ff0000",rosybrown:"#bc8f8f",royalblue:"#4169e1",saddlebrown:"#8b4513",salmon:"#fa8072",sandybrown:"#f4a460",seagreen:"#2e8b57",seashell:"#fff5ee",sienna:"#a0522d",silver:"#c0c0c0",skyblue:"#87ceeb",slateblue:"#6a5acd",slategray:"#708090",slategrey:"#708090",snow:"#fffafa",springgreen:"#00ff7f",steelblue:"#4682b4",tan:"#d2b48c",teal:"#008080",thistle:"#d8bfd8",tomato:"#ff6347",turquoise:"#40e0d0",violet:"#ee82ee",wheat:"#f5deb3",white:"#ffffff",whitesmoke:"#f5f5f5",yellow:"#ffff00",yellowgreen:"#9acd32"}}(require("./tree")),function(a){a.debugInfo=function(b,c,d){var e="";if(b.dumpLineNumbers&&!b.compress)switch(b.dumpLineNumbers){case"comments":e=a.debugInfo.asComment(c);break;case"mediaquery":e=a.debugInfo.asMediaQuery(c);break;case"all":e=a.debugInfo.asComment(c)+(d||"")+a.debugInfo.asMediaQuery(c)}return e},a.debugInfo.asComment=function(a){return"/* line "+a.debugInfo.lineNumber+", "+a.debugInfo.fileName+" */\n"},a.debugInfo.asMediaQuery=function(a){return"@media -sass-debug-info{filename{font-family:"+("file://"+a.debugInfo.fileName).replace(/([.:/\\])/g,function(a){return"\\"==a&&(a="/"),"\\"+a})+"}line{font-family:\\00003"+a.debugInfo.lineNumber+"}}\n"},a.find=function(a,b){for(var c,d=0;d<a.length;d++)if(c=b.call(a,a[d]))return c;return null},a.jsify=function(a){return Array.isArray(a.value)&&a.value.length>1?"["+a.value.map(function(a){return a.toCSS(!1)}).join(", ")+"]":a.toCSS(!1)},a.toCSS=function(a){var b=[];return this.genCSS(a,{add:function(a){b.push(a)},isEmpty:function(){return 0===b.length}}),b.join("")},a.outputRuleset=function(a,b,c){b.add(a.compress?"{":" {\n"),a.tabLevel=(a.tabLevel||0)+1;for(var d=a.compress?"":Array(a.tabLevel+1).join("  "),e=a.compress?"":Array(a.tabLevel).join("  "),f=0;f<c.length;f++)b.add(d),c[f].genCSS(a,b),b.add(a.compress?"":"\n");a.tabLevel--,b.add(e+"}")}}(require("./tree")),function(a){a.Alpha=function(a){this.value=a},a.Alpha.prototype={type:"Alpha",accept:function(a){this.value=a.visit(this.value)},eval:function(b){return this.value.eval?new a.Alpha(this.value.eval(b)):this},genCSS:function(a,b){b.add("alpha(opacity="),this.value.genCSS?this.value.genCSS(a,b):b.add(this.value),b.add(")")},toCSS:a.toCSS}}(require("../tree")),function(a){a.Anonymous=function(a,b,c,d){this.value=a.value||a,this.index=b,this.mapLines=d,this.currentFileInfo=c},a.Anonymous.prototype={type:"Anonymous",eval:function(){return this},compare:function(a){if(!a.toCSS)return-1;var b=this.toCSS(),c=a.toCSS();return b===c?0:c>b?-1:1},genCSS:function(a,b){b.add(this.value,this.currentFileInfo,this.index,this.mapLines)},toCSS:a.toCSS}}(require("../tree")),function(a){a.Assignment=function(a,b){this.key=a,this.value=b},a.Assignment.prototype={type:"Assignment",accept:function(a){this.value=a.visit(this.value)},eval:function(b){return this.value.eval?new a.Assignment(this.key,this.value.eval(b)):this},genCSS:function(a,b){b.add(this.key+"="),this.value.genCSS?this.value.genCSS(a,b):b.add(this.value)},toCSS:a.toCSS}}(require("../tree")),function(a){a.Call=function(a,b,c,d){this.name=a,this.args=b,this.index=c,this.currentFileInfo=d},a.Call.prototype={type:"Call",accept:function(a){this.args=a.visit(this.args)},eval:function(b){var c,d,e=this.args.map(function(a){return a.eval(b)}),f=this.name.toLowerCase();if(f in a.functions)try{if(d=new a.functionCall(b,this.currentFileInfo),c=d[f].apply(d,e),null!=c)return c}catch(g){throw{type:g.type||"Runtime",message:"error evaluating function `"+this.name+"`"+(g.message?": "+g.message:""),index:this.index,filename:this.currentFileInfo.filename}}return new a.Call(this.name,e,this.index,this.currentFileInfo)},genCSS:function(a,b){b.add(this.name+"(",this.currentFileInfo,this.index);for(var c=0;c<this.args.length;c++)this.args[c].genCSS(a,b),c+1<this.args.length&&b.add(", ");b.add(")")},toCSS:a.toCSS}}(require("../tree")),function(a){a.Color=function(a,b){this.rgb=Array.isArray(a)?a:6==a.length?a.match(/.{2}/g).map(function(a){return parseInt(a,16)}):a.split("").map(function(a){return parseInt(a+a,16)}),this.alpha="number"==typeof b?b:1};var b="transparent";a.Color.prototype={type:"Color",eval:function(){return this},luma:function(){return.2126*this.rgb[0]/255+.7152*this.rgb[1]/255+.0722*this.rgb[2]/255},genCSS:function(a,b){b.add(this.toCSS(a))},toCSS:function(a,c){var d=a&&a.compress&&!c;if(this.alpha<1)return 0===this.alpha&&this.isTransparentKeyword?b:"rgba("+this.rgb.map(function(a){return Math.round(a)}).concat(this.alpha).join(","+(d?"":" "))+")";var e=this.toRGB();if(d){var f=e.split("");f[1]===f[2]&&f[3]===f[4]&&f[5]===f[6]&&(e="#"+f[1]+f[3]+f[5])}return e},operate:function(b,c,d){var e=[];d instanceof a.Color||(d=d.toColor());for(var f=0;3>f;f++)e[f]=a.operate(b,c,this.rgb[f],d.rgb[f]);return new a.Color(e,this.alpha+d.alpha)},toRGB:function(){return"#"+this.rgb.map(function(a){return a=Math.round(a),a=(a>255?255:0>a?0:a).toString(16),1===a.length?"0"+a:a}).join("")},toHSL:function(){var a,b,c=this.rgb[0]/255,d=this.rgb[1]/255,e=this.rgb[2]/255,f=this.alpha,g=Math.max(c,d,e),h=Math.min(c,d,e),i=(g+h)/2,j=g-h;if(g===h)a=b=0;else{switch(b=i>.5?j/(2-g-h):j/(g+h),g){case c:a=(d-e)/j+(e>d?6:0);break;case d:a=(e-c)/j+2;break;case e:a=(c-d)/j+4}a/=6}return{h:360*a,s:b,l:i,a:f}},toHSV:function(){var a,b,c=this.rgb[0]/255,d=this.rgb[1]/255,e=this.rgb[2]/255,f=this.alpha,g=Math.max(c,d,e),h=Math.min(c,d,e),i=g,j=g-h;if(b=0===g?0:j/g,g===h)a=0;else{switch(g){case c:a=(d-e)/j+(e>d?6:0);break;case d:a=(e-c)/j+2;break;case e:a=(c-d)/j+4}a/=6}return{h:360*a,s:b,v:i,a:f}},toARGB:function(){var a=[Math.round(255*this.alpha)].concat(this.rgb);return"#"+a.map(function(a){return a=Math.round(a),a=(a>255?255:0>a?0:a).toString(16),1===a.length?"0"+a:a}).join("")},compare:function(a){return a.rgb?a.rgb[0]===this.rgb[0]&&a.rgb[1]===this.rgb[1]&&a.rgb[2]===this.rgb[2]&&a.alpha===this.alpha?0:-1:-1}},a.Color.fromKeyword=function(c){if(a.colors.hasOwnProperty(c))return new a.Color(a.colors[c].slice(1));if(c===b){var d=new a.Color([0,0,0],0);return d.isTransparentKeyword=!0,d}}}(require("../tree")),function(a){a.Comment=function(a,b,c,d){this.value=a,this.silent=!!b,this.currentFileInfo=d},a.Comment.prototype={type:"Comment",genCSS:function(b,c){this.debugInfo&&c.add(a.debugInfo(b,this),this.currentFileInfo,this.index),c.add(this.value.trim())},toCSS:a.toCSS,isSilent:function(a){var b=this.currentFileInfo&&this.currentFileInfo.reference&&!this.isReferenced,c=a.compress&&!this.value.match(/^\/\*!/);return this.silent||b||c},eval:function(){return this},markReferenced:function(){this.isReferenced=!0}}}(require("../tree")),function(a){a.Condition=function(a,b,c,d,e){this.op=a.trim(),this.lvalue=b,this.rvalue=c,this.index=d,this.negate=e},a.Condition.prototype={type:"Condition",accept:function(a){this.lvalue=a.visit(this.lvalue),this.rvalue=a.visit(this.rvalue)},eval:function(a){var b,c=this.lvalue.eval(a),d=this.rvalue.eval(a),e=this.index;return b=function(a){switch(a){case"and":return c&&d;case"or":return c||d;default:if(c.compare)b=c.compare(d);else{if(!d.compare)throw{type:"Type",message:"Unable to perform comparison",index:e};b=d.compare(c)}switch(b){case-1:return"<"===a||"=<"===a||"<="===a;case 0:return"="===a||">="===a||"=<"===a||"<="===a;case 1:return">"===a||">="===a}}}(this.op),this.negate?!b:b}}}(require("../tree")),function(a){a.Dimension=function(b,c){this.value=parseFloat(b),this.unit=c&&c instanceof a.Unit?c:new a.Unit(c?[c]:void 0)},a.Dimension.prototype={type:"Dimension",accept:function(a){this.unit=a.visit(this.unit)},eval:function(){return this},toColor:function(){return new a.Color([this.value,this.value,this.value])},genCSS:function(a,b){if(a&&a.strictUnits&&!this.unit.isSingular())throw new Error("Multiple units in dimension. Correct the units or use the unit function. Bad unit: "+this.unit.toString());var c=this.value,d=String(c);if(0!==c&&1e-6>c&&c>-1e-6&&(d=c.toFixed(20).replace(/0+$/,"")),a&&a.compress){if(0===c&&this.unit.isLength())return b.add(d),void 0;c>0&&1>c&&(d=d.substr(1))}b.add(d),this.unit.genCSS(a,b)},toCSS:a.toCSS,operate:function(b,c,d){var e=a.operate(b,c,this.value,d.value),f=this.unit.clone();if("+"===c||"-"===c)if(0===f.numerator.length&&0===f.denominator.length)f.numerator=d.unit.numerator.slice(0),f.denominator=d.unit.denominator.slice(0);else if(0===d.unit.numerator.length&&0===f.denominator.length);else{if(d=d.convertTo(this.unit.usedUnits()),b.strictUnits&&d.unit.toString()!==f.toString())throw new Error("Incompatible units. Change the units or use the unit function. Bad units: '"+f.toString()+"' and '"+d.unit.toString()+"'.");e=a.operate(b,c,this.value,d.value)}else"*"===c?(f.numerator=f.numerator.concat(d.unit.numerator).sort(),f.denominator=f.denominator.concat(d.unit.denominator).sort(),f.cancel()):"/"===c&&(f.numerator=f.numerator.concat(d.unit.denominator).sort(),f.denominator=f.denominator.concat(d.unit.numerator).sort(),f.cancel());return new a.Dimension(e,f)},compare:function(b){if(b instanceof a.Dimension){var c=this.unify(),d=b.unify(),e=c.value,f=d.value;return f>e?-1:e>f?1:d.unit.isEmpty()||0===c.unit.compare(d.unit)?0:-1}return-1},unify:function(){return this.convertTo({length:"m",duration:"s",angle:"rad"})},convertTo:function(b){var c,d,e,f,g,h=this.value,i=this.unit.clone(),j={};if("string"==typeof b){for(c in a.UnitConversions)a.UnitConversions[c].hasOwnProperty(b)&&(j={},j[c]=b);b=j}g=function(a,b){return e.hasOwnProperty(a)?(b?h/=e[a]/e[f]:h*=e[a]/e[f],f):a};for(d in b)b.hasOwnProperty(d)&&(f=b[d],e=a.UnitConversions[d],i.map(g));return i.cancel(),new a.Dimension(h,i)}},a.UnitConversions={length:{m:1,cm:.01,mm:.001,"in":.0254,pt:.0254/72,pc:12*(.0254/72)},duration:{s:1,ms:.001},angle:{rad:1/(2*Math.PI),deg:1/360,grad:.0025,turn:1}},a.Unit=function(a,b,c){this.numerator=a?a.slice(0).sort():[],this.denominator=b?b.slice(0).sort():[],this.backupUnit=c},a.Unit.prototype={type:"Unit",clone:function(){return new a.Unit(this.numerator.slice(0),this.denominator.slice(0),this.backupUnit)},genCSS:function(a,b){this.numerator.length>=1?b.add(this.numerator[0]):this.denominator.length>=1?b.add(this.denominator[0]):a&&a.strictUnits||!this.backupUnit||b.add(this.backupUnit)},toCSS:a.toCSS,toString:function(){var a,b=this.numerator.join("*");for(a=0;a<this.denominator.length;a++)b+="/"+this.denominator[a];return b},compare:function(a){return this.is(a.toString())?0:-1},is:function(a){return this.toString()===a},isLength:function(){return Boolean(this.toCSS().match(/px|em|%|in|cm|mm|pc|pt|ex/))},isEmpty:function(){return 0===this.numerator.length&&0===this.denominator.length},isSingular:function(){return this.numerator.length<=1&&0===this.denominator.length},map:function(a){var b;for(b=0;b<this.numerator.length;b++)this.numerator[b]=a(this.numerator[b],!1);for(b=0;b<this.denominator.length;b++)this.denominator[b]=a(this.denominator[b],!0)},usedUnits:function(){var b,c,d={};c=function(a){return b.hasOwnProperty(a)&&!d[e]&&(d[e]=a),a};for(var e in a.UnitConversions)a.UnitConversions.hasOwnProperty(e)&&(b=a.UnitConversions[e],this.map(c));return d},cancel:function(){var a,b,c,d={};for(b=0;b<this.numerator.length;b++)a=this.numerator[b],c||(c=a),d[a]=(d[a]||0)+1;for(b=0;b<this.denominator.length;b++)a=this.denominator[b],c||(c=a),d[a]=(d[a]||0)-1;this.numerator=[],this.denominator=[];for(a in d)if(d.hasOwnProperty(a)){var e=d[a];if(e>0)for(b=0;e>b;b++)this.numerator.push(a);else if(0>e)for(b=0;-e>b;b++)this.denominator.push(a)}0===this.numerator.length&&0===this.denominator.length&&c&&(this.backupUnit=c),this.numerator.sort(),this.denominator.sort()}}}(require("../tree")),function(a){a.Directive=function(b,c,d,e){this.name=b,Array.isArray(c)?(this.rules=[new a.Ruleset([],c)],this.rules[0].allowImports=!0):this.value=c,this.currentFileInfo=e},a.Directive.prototype={type:"Directive",accept:function(a){this.rules=a.visit(this.rules),this.value=a.visit(this.value)},genCSS:function(b,c){c.add(this.name,this.currentFileInfo,this.index),this.rules?a.outputRuleset(b,c,this.rules):(c.add(" "),this.value.genCSS(b,c),c.add(";"))},toCSS:a.toCSS,eval:function(b){var c=this;return this.rules&&(b.frames.unshift(this),c=new a.Directive(this.name,null,this.index,this.currentFileInfo),c.rules=[this.rules[0].eval(b)],c.rules[0].root=!0,b.frames.shift()),c},variable:function(b){return a.Ruleset.prototype.variable.call(this.rules[0],b)},find:function(){return a.Ruleset.prototype.find.apply(this.rules[0],arguments)},rulesets:function(){return a.Ruleset.prototype.rulesets.apply(this.rules[0])},markReferenced:function(){var a,b;if(this.isReferenced=!0,this.rules)for(b=this.rules[0].rules,a=0;a<b.length;a++)b[a].markReferenced&&b[a].markReferenced()}}}(require("../tree")),function(a){a.Element=function(b,c,d,e){this.combinator=b instanceof a.Combinator?b:new a.Combinator(b),this.value="string"==typeof c?c.trim():c?c:"",this.index=d,this.currentFileInfo=e},a.Element.prototype={type:"Element",accept:function(a){this.combinator=a.visit(this.combinator),this.value=a.visit(this.value)},eval:function(b){return new a.Element(this.combinator,this.value.eval?this.value.eval(b):this.value,this.index,this.currentFileInfo)},genCSS:function(a,b){b.add(this.toCSS(a),this.currentFileInfo,this.index)},toCSS:function(a){var b=this.value.toCSS?this.value.toCSS(a):this.value;return""===b&&"&"===this.combinator.value.charAt(0)?"":this.combinator.toCSS(a||{})+b}},a.Attribute=function(a,b,c){this.key=a,this.op=b,this.value=c},a.Attribute.prototype={type:"Attribute",accept:function(a){this.value=a.visit(this.value)},eval:function(b){return new a.Attribute(this.key.eval?this.key.eval(b):this.key,this.op,this.value&&this.value.eval?this.value.eval(b):this.value)},genCSS:function(a,b){b.add(this.toCSS(a))},toCSS:function(a){var b=this.key.toCSS?this.key.toCSS(a):this.key;return this.op&&(b+=this.op,b+=this.value.toCSS?this.value.toCSS(a):this.value),"["+b+"]"}},a.Combinator=function(a){this.value=" "===a?" ":a?a.trim():""},a.Combinator.prototype={type:"Combinator",_outputMap:{"":""," ":" ",":":" :","+":" + ","~":" ~ ",">":" > ","|":"|"},_outputMapCompressed:{"":""," ":" ",":":" :","+":"+","~":"~",">":">","|":"|"},genCSS:function(a,b){b.add((a.compress?this._outputMapCompressed:this._outputMap)[this.value])},toCSS:a.toCSS}}(require("../tree")),function(a){a.Expression=function(a){this.value=a},a.Expression.prototype={type:"Expression",accept:function(a){this.value=a.visit(this.value)},eval:function(b){var c,d=this.parens&&!this.parensInOp,e=!1;return d&&b.inParenthesis(),this.value.length>1?c=new a.Expression(this.value.map(function(a){return a.eval(b)})):1===this.value.length?(this.value[0].parens&&!this.value[0].parensInOp&&(e=!0),c=this.value[0].eval(b)):c=this,d&&b.outOfParenthesis(),this.parens&&this.parensInOp&&!b.isMathOn()&&!e&&(c=new a.Paren(c)),c},genCSS:function(a,b){for(var c=0;c<this.value.length;c++)this.value[c].genCSS(a,b),c+1<this.value.length&&b.add(" ")},toCSS:a.toCSS,throwAwayComments:function(){this.value=this.value.filter(function(b){return!(b instanceof a.Comment)})}}}(require("../tree")),function(a){a.Extend=function(a,b,c){switch(this.selector=a,this.option=b,this.index=c,b){case"all":this.allowBefore=!0,this.allowAfter=!0;break;default:this.allowBefore=!1,this.allowAfter=!1}},a.Extend.prototype={type:"Extend",accept:function(a){this.selector=a.visit(this.selector)},eval:function(b){return new a.Extend(this.selector.eval(b),this.option,this.index)},clone:function(){return new a.Extend(this.selector,this.option,this.index)},findSelfSelectors:function(a){var b,c,d=[];for(b=0;b<a.length;b++)c=a[b].elements,b>0&&c.length&&""===c[0].combinator.value&&(c[0].combinator.value=" "),d=d.concat(a[b].elements);this.selfSelectors=[{elements:d}]}}}(require("../tree")),function(a){a.Import=function(a,b,c,d,e){if(this.options=c,this.index=d,this.path=a,this.features=b,this.currentFileInfo=e,void 0!==this.options.less||this.options.inline)this.css=!this.options.less||this.options.inline;else{var f=this.getPath();f&&/css([\?;].*)?$/.test(f)&&(this.css=!0)}},a.Import.prototype={type:"Import",accept:function(a){this.features=a.visit(this.features),this.path=a.visit(this.path),this.options.inline||(this.root=a.visit(this.root))},genCSS:function(a,b){this.css&&(b.add("@import ",this.currentFileInfo,this.index),this.path.genCSS(a,b),this.features&&(b.add(" "),this.features.genCSS(a,b)),b.add(";"))},toCSS:a.toCSS,getPath:function(){if(this.path instanceof a.Quoted){var b=this.path.value;return void 0!==this.css||/(\.[a-z]*$)|([\?;].*)$/.test(b)?b:b+".less"}return this.path instanceof a.URL?this.path.value.value:null},evalForImport:function(b){return new a.Import(this.path.eval(b),this.features,this.options,this.index,this.currentFileInfo)},evalPath:function(b){var c=this.path.eval(b),d=this.currentFileInfo&&this.currentFileInfo.rootpath;if(!(c instanceof a.URL)){if(d){var e=c.value;e&&b.isPathRelative(e)&&(c.value=d+e)}c.value=b.normalizePath(c.value)}return c},eval:function(b){var c,d=this.features&&this.features.eval(b);if(this.skip)return[];if(this.options.inline){var e=new a.Anonymous(this.root,0,{filename:this.importedFilename},!0);return this.features?new a.Media([e],this.features.value):[e]}if(this.css){var f=new a.Import(this.evalPath(b),d,this.options,this.index);if(!f.css&&this.error)throw this.error;return f}return c=new a.Ruleset([],this.root.rules.slice(0)),c.evalImports(b),this.features?new a.Media(c.rules,this.features.value):c.rules}}}(require("../tree")),function(a){a.JavaScript=function(a,b,c){this.escaped=c,this.expression=a,this.index=b},a.JavaScript.prototype={type:"JavaScript",eval:function(b){var c,d=this,e={},f=this.expression.replace(/@\{([\w-]+)\}/g,function(c,e){return a.jsify(new a.Variable("@"+e,d.index).eval(b))});try{f=new Function("return ("+f+")")}catch(g){throw{message:"JavaScript evaluation error: "+g.message+" from `"+f+"`",index:this.index}}for(var h in b.frames[0].variables())e[h.slice(1)]={value:b.frames[0].variables()[h].value,toJS:function(){return this.value.eval(b).toCSS()}};try{c=f.call(e)}catch(g){throw{message:"JavaScript evaluation error: '"+g.name+": "+g.message+"'",index:this.index}}return"string"==typeof c?new a.Quoted('"'+c+'"',c,this.escaped,this.index):Array.isArray(c)?new a.Anonymous(c.join(", ")):new a.Anonymous(c)}}}(require("../tree")),function(a){a.Keyword=function(a){this.value=a},a.Keyword.prototype={type:"Keyword",eval:function(){return this},genCSS:function(a,b){b.add(this.value)},toCSS:a.toCSS,compare:function(b){return b instanceof a.Keyword?b.value===this.value?0:1:-1}},a.True=new a.Keyword("true"),a.False=new a.Keyword("false")}(require("../tree")),function(a){a.Media=function(b,c,d,e){this.index=d,this.currentFileInfo=e;var f=this.emptySelectors();this.features=new a.Value(c),this.rules=[new a.Ruleset(f,b)],this.rules[0].allowImports=!0},a.Media.prototype={type:"Media",accept:function(a){this.features=a.visit(this.features),this.rules=a.visit(this.rules)},genCSS:function(b,c){c.add("@media ",this.currentFileInfo,this.index),this.features.genCSS(b,c),a.outputRuleset(b,c,this.rules)},toCSS:a.toCSS,eval:function(b){b.mediaBlocks||(b.mediaBlocks=[],b.mediaPath=[]);var c=new a.Media([],[],this.index,this.currentFileInfo);this.debugInfo&&(this.rules[0].debugInfo=this.debugInfo,c.debugInfo=this.debugInfo);var d=!1;b.strictMath||(d=!0,b.strictMath=!0);try{c.features=this.features.eval(b)}finally{d&&(b.strictMath=!1)}return b.mediaPath.push(c),b.mediaBlocks.push(c),b.frames.unshift(this.rules[0]),c.rules=[this.rules[0].eval(b)],b.frames.shift(),b.mediaPath.pop(),0===b.mediaPath.length?c.evalTop(b):c.evalNested(b)},variable:function(b){return a.Ruleset.prototype.variable.call(this.rules[0],b)},find:function(){return a.Ruleset.prototype.find.apply(this.rules[0],arguments)},rulesets:function(){return a.Ruleset.prototype.rulesets.apply(this.rules[0])},emptySelectors:function(){var b=new a.Element("","&",this.index,this.currentFileInfo);return[new a.Selector([b],null,null,this.index,this.currentFileInfo)]},markReferenced:function(){var a,b=this.rules[0].rules;for(this.isReferenced=!0,a=0;a<b.length;a++)b[a].markReferenced&&b[a].markReferenced()},evalTop:function(b){var c=this;if(b.mediaBlocks.length>1){var d=this.emptySelectors();c=new a.Ruleset(d,b.mediaBlocks),c.multiMedia=!0}return delete b.mediaBlocks,delete b.mediaPath,c},evalNested:function(b){var c,d,e=b.mediaPath.concat([this]);for(c=0;c<e.length;c++)d=e[c].features instanceof a.Value?e[c].features.value:e[c].features,e[c]=Array.isArray(d)?d:[d];return this.features=new a.Value(this.permute(e).map(function(b){for(b=b.map(function(b){return b.toCSS?b:new a.Anonymous(b)}),c=b.length-1;c>0;c--)b.splice(c,0,new a.Anonymous("and"));return new a.Expression(b)})),new a.Ruleset([],[])},permute:function(a){if(0===a.length)return[];if(1===a.length)return a[0];for(var b=[],c=this.permute(a.slice(1)),d=0;d<c.length;d++)for(var e=0;e<a[0].length;e++)b.push([a[0][e]].concat(c[d]));return b},bubbleSelectors:function(b){this.rules=[new a.Ruleset(b.slice(0),[this.rules[0]])]}}}(require("../tree")),function(a){a.mixin={},a.mixin.Call=function(b,c,d,e,f){this.selector=new a.Selector(b),this.arguments=c,this.index=d,this.currentFileInfo=e,this.important=f},a.mixin.Call.prototype={type:"MixinCall",accept:function(a){this.selector=a.visit(this.selector),this.arguments=a.visit(this.arguments)},eval:function(b){var c,d,e,f,g,h,i,j,k,l=[],m=!1;for(e=this.arguments&&this.arguments.map(function(a){return{name:a.name,value:a.value.eval(b)}}),f=0;f<b.frames.length;f++)if((c=b.frames[f].find(this.selector)).length>0){for(j=!0,g=0;g<c.length;g++){for(d=c[g],i=!1,h=0;h<b.frames.length;h++)if(!(d instanceof a.mixin.Definition)&&d===(b.frames[h].originalRuleset||b.frames[h])){i=!0;break}if(!i&&d.matchArgs(e,b)){if(!d.matchCondition||d.matchCondition(e,b))try{d instanceof a.mixin.Definition||(d=new a.mixin.Definition("",[],d.rules,null,!1),d.originalRuleset=c[g].originalRuleset||c[g]),Array.prototype.push.apply(l,d.eval(b,e,this.important).rules)}catch(n){throw{message:n.message,index:this.index,filename:this.currentFileInfo.filename,stack:n.stack}}m=!0}}if(m){if(!this.currentFileInfo||!this.currentFileInfo.reference)for(f=0;f<l.length;f++)k=l[f],k.markReferenced&&k.markReferenced();return l}}throw j?{type:"Runtime",message:"No matching definition was found for `"+this.selector.toCSS().trim()+"("+(e?e.map(function(a){var b="";return a.name&&(b+=a.name+":"),b+=a.value.toCSS?a.value.toCSS():"???"}).join(", "):"")+")`",index:this.index,filename:this.currentFileInfo.filename}:{type:"Name",message:this.selector.toCSS().trim()+" is undefined",index:this.index,filename:this.currentFileInfo.filename}}},a.mixin.Definition=function(b,c,d,e,f){this.name=b,this.selectors=[new a.Selector([new a.Element(null,b,this.index,this.currentFileInfo)])],this.params=c,this.condition=e,this.variadic=f,this.arity=c.length,this.rules=d,this._lookups={},this.required=c.reduce(function(a,b){return!b.name||b.name&&!b.value?a+1:a},0),this.parent=a.Ruleset.prototype,this.frames=[]},a.mixin.Definition.prototype={type:"MixinDefinition",accept:function(a){this.params=a.visit(this.params),this.rules=a.visit(this.rules),this.condition=a.visit(this.condition)},variable:function(a){return this.parent.variable.call(this,a)},variables:function(){return this.parent.variables.call(this)},find:function(){return this.parent.find.apply(this,arguments)},rulesets:function(){return this.parent.rulesets.apply(this)},evalParams:function(b,c,d,e){var f,g,h,i,j,k,l,m,n=new a.Ruleset(null,[]),o=this.params.slice(0);if(c=new a.evalEnv(c,[n].concat(c.frames)),d)for(d=d.slice(0),h=0;h<d.length;h++)if(g=d[h],k=g&&g.name){for(l=!1,i=0;i<o.length;i++)if(!e[i]&&k===o[i].name){e[i]=g.value.eval(b),n.rules.unshift(new a.Rule(k,g.value.eval(b))),l=!0;
break}if(l){d.splice(h,1),h--;continue}throw{type:"Runtime",message:"Named argument for "+this.name+" "+d[h].name+" not found"}}for(m=0,h=0;h<o.length;h++)if(!e[h]){if(g=d&&d[m],k=o[h].name)if(o[h].variadic&&d){for(f=[],i=m;i<d.length;i++)f.push(d[i].value.eval(b));n.rules.unshift(new a.Rule(k,new a.Expression(f).eval(b)))}else{if(j=g&&g.value)j=j.eval(b);else{if(!o[h].value)throw{type:"Runtime",message:"wrong number of arguments for "+this.name+" ("+d.length+" for "+this.arity+")"};j=o[h].value.eval(c),n.resetCache()}n.rules.unshift(new a.Rule(k,j)),e[h]=j}if(o[h].variadic&&d)for(i=m;i<d.length;i++)e[i]=d[i].value.eval(b);m++}return n},eval:function(b,c,d){var e,f,g=[],h=this.frames.concat(b.frames),i=this.evalParams(b,new a.evalEnv(b,h),c,g);return i.rules.unshift(new a.Rule("@arguments",new a.Expression(g).eval(b))),e=this.rules.slice(0),f=new a.Ruleset(null,e),f.originalRuleset=this,f=f.eval(new a.evalEnv(b,[this,i].concat(h))),d&&(f=this.parent.makeImportant.apply(f)),f},matchCondition:function(b,c){return this.condition&&!this.condition.eval(new a.evalEnv(c,[this.evalParams(c,new a.evalEnv(c,this.frames.concat(c.frames)),b,[])].concat(this.frames).concat(c.frames)))?!1:!0},matchArgs:function(a,b){var c,d=a&&a.length||0;if(this.variadic){if(d<this.required-1)return!1}else{if(d<this.required)return!1;if(d>this.params.length)return!1}c=Math.min(d,this.arity);for(var e=0;c>e;e++)if(!this.params[e].name&&!this.params[e].variadic&&a[e].value.eval(b).toCSS()!=this.params[e].value.eval(b).toCSS())return!1;return!0}}}(require("../tree")),function(a){a.Negative=function(a){this.value=a},a.Negative.prototype={type:"Negative",accept:function(a){this.value=a.visit(this.value)},genCSS:function(a,b){b.add("-"),this.value.genCSS(a,b)},toCSS:a.toCSS,eval:function(b){return b.isMathOn()?new a.Operation("*",[new a.Dimension(-1),this.value]).eval(b):new a.Negative(this.value.eval(b))}}}(require("../tree")),function(a){a.Operation=function(a,b,c){this.op=a.trim(),this.operands=b,this.isSpaced=c},a.Operation.prototype={type:"Operation",accept:function(a){this.operands=a.visit(this.operands)},eval:function(b){var c,d=this.operands[0].eval(b),e=this.operands[1].eval(b);if(b.isMathOn()){if(d instanceof a.Dimension&&e instanceof a.Color){if("*"!==this.op&&"+"!==this.op)throw{type:"Operation",message:"Can't substract or divide a color from a number"};c=e,e=d,d=c}if(!d.operate)throw{type:"Operation",message:"Operation on an invalid type"};return d.operate(b,this.op,e)}return new a.Operation(this.op,[d,e],this.isSpaced)},genCSS:function(a,b){this.operands[0].genCSS(a,b),this.isSpaced&&b.add(" "),b.add(this.op),this.isSpaced&&b.add(" "),this.operands[1].genCSS(a,b)},toCSS:a.toCSS},a.operate=function(a,b,c,d){switch(b){case"+":return c+d;case"-":return c-d;case"*":return c*d;case"/":return c/d}}}(require("../tree")),function(a){a.Paren=function(a){this.value=a},a.Paren.prototype={type:"Paren",accept:function(a){this.value=a.visit(this.value)},genCSS:function(a,b){b.add("("),this.value.genCSS(a,b),b.add(")")},toCSS:a.toCSS,eval:function(b){return new a.Paren(this.value.eval(b))}}}(require("../tree")),function(a){a.Quoted=function(a,b,c,d,e){this.escaped=c,this.value=b||"",this.quote=a.charAt(0),this.index=d,this.currentFileInfo=e},a.Quoted.prototype={type:"Quoted",genCSS:function(a,b){this.escaped||b.add(this.quote,this.currentFileInfo,this.index),b.add(this.value),this.escaped||b.add(this.quote)},toCSS:a.toCSS,eval:function(b){var c=this,d=this.value.replace(/`([^`]+)`/g,function(d,e){return new a.JavaScript(e,c.index,!0).eval(b).value}).replace(/@\{([\w-]+)\}/g,function(d,e){var f=new a.Variable("@"+e,c.index,c.currentFileInfo).eval(b,!0);return f instanceof a.Quoted?f.value:f.toCSS()});return new a.Quoted(this.quote+d+this.quote,d,this.escaped,this.index,this.currentFileInfo)},compare:function(a){if(!a.toCSS)return-1;var b=this.toCSS(),c=a.toCSS();return b===c?0:c>b?-1:1}}}(require("../tree")),function(a){a.Rule=function(b,c,d,e,f,g,h){this.name=b,this.value=c instanceof a.Value?c:new a.Value([c]),this.important=d?" "+d.trim():"",this.merge=e,this.index=f,this.currentFileInfo=g,this.inline=h||!1,this.variable="@"===b.charAt(0)},a.Rule.prototype={type:"Rule",accept:function(a){this.value=a.visit(this.value)},genCSS:function(a,b){b.add(this.name+(a.compress?":":": "),this.currentFileInfo,this.index);try{this.value.genCSS(a,b)}catch(c){throw c.index=this.index,c.filename=this.currentFileInfo.filename,c}b.add(this.important+(this.inline||a.lastRule&&a.compress?"":";"),this.currentFileInfo,this.index)},toCSS:a.toCSS,eval:function(b){var c=!1;"font"!==this.name||b.strictMath||(c=!0,b.strictMath=!0);try{return new a.Rule(this.name,this.value.eval(b),this.important,this.merge,this.index,this.currentFileInfo,this.inline)}finally{c&&(b.strictMath=!1)}},makeImportant:function(){return new a.Rule(this.name,this.value,"!important",this.merge,this.index,this.currentFileInfo,this.inline)}}}(require("../tree")),function(a){a.Ruleset=function(a,b,c){this.selectors=a,this.rules=b,this._lookups={},this.strictImports=c},a.Ruleset.prototype={type:"Ruleset",accept:function(a){if(this.paths)for(var b=0;b<this.paths.length;b++)this.paths[b]=a.visit(this.paths[b]);else this.selectors=a.visit(this.selectors);this.rules=a.visit(this.rules)},eval:function(b){var c,d,e,f=this.selectors&&this.selectors.map(function(a){return a.eval(b)}),g=new a.Ruleset(f,this.rules.slice(0),this.strictImports);for(g.originalRuleset=this,g.root=this.root,g.firstRoot=this.firstRoot,g.allowImports=this.allowImports,this.debugInfo&&(g.debugInfo=this.debugInfo),b.frames.unshift(g),b.selectors||(b.selectors=[]),b.selectors.unshift(this.selectors),(g.root||g.allowImports||!g.strictImports)&&g.evalImports(b),e=0;e<g.rules.length;e++)g.rules[e]instanceof a.mixin.Definition&&(g.rules[e].frames=b.frames.slice(0));var h=b.mediaBlocks&&b.mediaBlocks.length||0;for(e=0;e<g.rules.length;e++)g.rules[e]instanceof a.mixin.Call&&(c=g.rules[e].eval(b).filter(function(b){return b instanceof a.Rule&&b.variable?!g.variable(b.name):!0}),g.rules.splice.apply(g.rules,[e,1].concat(c)),e+=c.length-1,g.resetCache());for(e=0;e<g.rules.length;e++)d=g.rules[e],d instanceof a.mixin.Definition||(g.rules[e]=d.eval?d.eval(b):d);if(b.frames.shift(),b.selectors.shift(),b.mediaBlocks)for(e=h;e<b.mediaBlocks.length;e++)b.mediaBlocks[e].bubbleSelectors(f);return g},evalImports:function(b){var c,d;for(c=0;c<this.rules.length;c++)this.rules[c]instanceof a.Import&&(d=this.rules[c].eval(b),"number"==typeof d.length?(this.rules.splice.apply(this.rules,[c,1].concat(d)),c+=d.length-1):this.rules.splice(c,1,d),this.resetCache())},makeImportant:function(){return new a.Ruleset(this.selectors,this.rules.map(function(a){return a.makeImportant?a.makeImportant():a}),this.strictImports)},matchArgs:function(a){return!a||0===a.length},matchCondition:function(b,c){var d=this.selectors[this.selectors.length-1];return d.condition&&!d.condition.eval(new a.evalEnv(c,c.frames))?!1:!0},resetCache:function(){this._rulesets=null,this._variables=null,this._lookups={}},variables:function(){return this._variables?this._variables:this._variables=this.rules.reduce(function(b,c){return c instanceof a.Rule&&c.variable===!0&&(b[c.name]=c),b},{})},variable:function(a){return this.variables()[a]},rulesets:function(){return this.rules.filter(function(b){return b instanceof a.Ruleset||b instanceof a.mixin.Definition})},find:function(b,c){c=c||this;var d,e=[],f=b.toCSS();return f in this._lookups?this._lookups[f]:(this.rulesets().forEach(function(f){if(f!==c)for(var g=0;g<f.selectors.length;g++)if(d=b.match(f.selectors[g])){b.elements.length>f.selectors[g].elements.length?Array.prototype.push.apply(e,f.find(new a.Selector(b.elements.slice(1)),c)):e.push(f);break}}),this._lookups[f]=e)},genCSS:function(b,c){var d,e,f,g,h,i=[],j=[],k=!0;b.tabLevel=b.tabLevel||0,this.root||b.tabLevel++;var l=b.compress?"":Array(b.tabLevel+1).join("  "),m=b.compress?"":Array(b.tabLevel).join("  ");for(d=0;d<this.rules.length;d++)g=this.rules[d],g.rules||g instanceof a.Media||g instanceof a.Directive||this.root&&g instanceof a.Comment?j.push(g):i.push(g);if(!this.root){for(f=a.debugInfo(b,this,m),f&&(c.add(f),c.add(m)),d=0;d<this.paths.length;d++){for(h=this.paths[d],b.firstSelector=!0,e=0;e<h.length;e++)h[e].genCSS(b,c),b.firstSelector=!1;d+1<this.paths.length&&c.add(b.compress?",":",\n"+m)}c.add((b.compress?"{":" {\n")+l)}for(d=0;d<i.length;d++)g=i[d],d+1!==i.length||this.root&&0!==j.length&&!this.firstRoot||(b.lastRule=!0),g.genCSS?g.genCSS(b,c):g.value&&c.add(g.value.toString()),b.lastRule?b.lastRule=!1:c.add(b.compress?"":"\n"+l);for(this.root||(c.add(b.compress?"}":"\n"+m+"}"),b.tabLevel--),d=0;d<j.length;d++)i.length&&k&&c.add((b.compress?"":"\n")+(this.root?l:m)),k||c.add((b.compress?"":"\n")+(this.root?l:m)),k=!1,j[d].genCSS(b,c);c.isEmpty()||b.compress||!this.firstRoot||c.add("\n")},toCSS:a.toCSS,markReferenced:function(){for(var a=0;a<this.selectors.length;a++)this.selectors[a].markReferenced()},joinSelectors:function(a,b,c){for(var d=0;d<c.length;d++)this.joinSelector(a,b,c[d])},joinSelector:function(b,c,d){var e,f,g,h,i,j,k,l,m,n,o,p,q,r,s;for(e=0;e<d.elements.length;e++)j=d.elements[e],"&"===j.value&&(h=!0);if(h){for(r=[],i=[[]],e=0;e<d.elements.length;e++)if(j=d.elements[e],"&"!==j.value)r.push(j);else{for(s=[],r.length>0&&this.mergeElementsOnToSelectors(r,i),f=0;f<i.length;f++)if(k=i[f],0===c.length)k.length>0&&(k[0].elements=k[0].elements.slice(0),k[0].elements.push(new a.Element(j.combinator,"",0,j.index,j.currentFileInfo))),s.push(k);else for(g=0;g<c.length;g++)l=c[g],m=[],n=[],p=!0,k.length>0?(m=k.slice(0),q=m.pop(),o=d.createDerived(q.elements.slice(0)),p=!1):o=d.createDerived([]),l.length>1&&(n=n.concat(l.slice(1))),l.length>0&&(p=!1,o.elements.push(new a.Element(j.combinator,l[0].elements[0].value,j.index,j.currentFileInfo)),o.elements=o.elements.concat(l[0].elements.slice(1))),p||m.push(o),m=m.concat(n),s.push(m);i=s,r=[]}for(r.length>0&&this.mergeElementsOnToSelectors(r,i),e=0;e<i.length;e++)i[e].length>0&&b.push(i[e])}else if(c.length>0)for(e=0;e<c.length;e++)b.push(c[e].concat(d));else b.push([d])},mergeElementsOnToSelectors:function(b,c){var d,e;if(0===c.length)return c.push([new a.Selector(b)]),void 0;for(d=0;d<c.length;d++)e=c[d],e.length>0?e[e.length-1]=e[e.length-1].createDerived(e[e.length-1].elements.concat(b)):e.push(new a.Selector(b))}}}(require("../tree")),function(a){a.Selector=function(a,b,c,d,e,f){this.elements=a,this.extendList=b||[],this.condition=c,this.currentFileInfo=e||{},this.isReferenced=f,c||(this.evaldCondition=!0)},a.Selector.prototype={type:"Selector",accept:function(a){this.elements=a.visit(this.elements),this.extendList=a.visit(this.extendList),this.condition=a.visit(this.condition)},createDerived:function(b,c,d){d=null!=d?d:this.evaldCondition;var e=new a.Selector(b,c||this.extendList,this.condition,this.index,this.currentFileInfo,this.isReferenced);return e.evaldCondition=d,e},match:function(a){var b,c,d,e,f=this.elements,g=f.length;if(b=a.elements.slice(a.elements.length&&"&"===a.elements[0].value?1:0),c=b.length,d=Math.min(g,c),0===c||c>g)return!1;for(e=0;d>e;e++)if(f[e].value!==b[e].value)return!1;return!0},eval:function(a){var b=this.condition&&this.condition.eval(a);return this.createDerived(this.elements.map(function(b){return b.eval(a)}),this.extendList.map(function(b){return b.eval(a)}),b)},genCSS:function(a,b){var c,d;if(a&&a.firstSelector||""!==this.elements[0].combinator.value||b.add(" ",this.currentFileInfo,this.index),!this._css)for(c=0;c<this.elements.length;c++)d=this.elements[c],d.genCSS(a,b)},toCSS:a.toCSS,markReferenced:function(){this.isReferenced=!0},getIsReferenced:function(){return!this.currentFileInfo.reference||this.isReferenced},getIsOutput:function(){return this.evaldCondition}}}(require("../tree")),function(a){a.UnicodeDescriptor=function(a){this.value=a},a.UnicodeDescriptor.prototype={type:"UnicodeDescriptor",genCSS:function(a,b){b.add(this.value)},toCSS:a.toCSS,eval:function(){return this}}}(require("../tree")),function(a){a.URL=function(a,b){this.value=a,this.currentFileInfo=b},a.URL.prototype={type:"Url",accept:function(a){this.value=a.visit(this.value)},genCSS:function(a,b){b.add("url("),this.value.genCSS(a,b),b.add(")")},toCSS:a.toCSS,eval:function(b){var c,d=this.value.eval(b);return c=this.currentFileInfo&&this.currentFileInfo.rootpath,c&&"string"==typeof d.value&&b.isPathRelative(d.value)&&(d.quote||(c=c.replace(/[\(\)'"\s]/g,function(a){return"\\"+a})),d.value=c+d.value),d.value=b.normalizePath(d.value),new a.URL(d,null)}}}(require("../tree")),function(a){a.Value=function(a){this.value=a},a.Value.prototype={type:"Value",accept:function(a){this.value=a.visit(this.value)},eval:function(b){return 1===this.value.length?this.value[0].eval(b):new a.Value(this.value.map(function(a){return a.eval(b)}))},genCSS:function(a,b){var c;for(c=0;c<this.value.length;c++)this.value[c].genCSS(a,b),c+1<this.value.length&&b.add(a&&a.compress?",":", ")},toCSS:a.toCSS}}(require("../tree")),function(a){a.Variable=function(a,b,c){this.name=a,this.index=b,this.currentFileInfo=c},a.Variable.prototype={type:"Variable",eval:function(b){var c,d,e=this.name;if(0===e.indexOf("@@")&&(e="@"+new a.Variable(e.slice(1)).eval(b).value),this.evaluating)throw{type:"Name",message:"Recursive variable definition for "+e,filename:this.currentFileInfo.file,index:this.index};if(this.evaluating=!0,c=a.find(b.frames,function(a){return(d=a.variable(e))?d.value.eval(b):void 0}))return this.evaluating=!1,c;throw{type:"Name",message:"variable "+e+" is undefined",filename:this.currentFileInfo.filename,index:this.index}}}}(require("../tree")),function(a){var b=["paths","optimization","files","contents","relativeUrls","rootpath","strictImports","insecure","dumpLineNumbers","compress","processImports","syncImport","javascriptEnabled","mime","useFileCache","currentFileInfo"];a.parseEnv=function(a){if(d(a,this,b),this.contents||(this.contents={}),this.files||(this.files={}),!this.currentFileInfo){var c=a&&a.filename||"input",e=c.replace(/[^\/\\]*$/,"");a&&(a.filename=null),this.currentFileInfo={filename:c,relativeUrls:this.relativeUrls,rootpath:a&&a.rootpath||"",currentDirectory:e,entryPath:e,rootFilename:c}}};var c=["silent","verbose","compress","yuicompress","ieCompat","strictMath","strictUnits","cleancss","sourceMap","importMultiple"];a.evalEnv=function(a,b){d(a,this,c),this.frames=b||[]},a.evalEnv.prototype.inParenthesis=function(){this.parensStack||(this.parensStack=[]),this.parensStack.push(!0)},a.evalEnv.prototype.outOfParenthesis=function(){this.parensStack.pop()},a.evalEnv.prototype.isMathOn=function(){return this.strictMath?this.parensStack&&this.parensStack.length:!0},a.evalEnv.prototype.isPathRelative=function(a){return!/^(?:[a-z-]+:|\/)/.test(a)},a.evalEnv.prototype.normalizePath=function(a){var b,c=a.split("/").reverse();for(a=[];0!==c.length;)switch(b=c.pop()){case".":break;case"..":0===a.length||".."===a[a.length-1]?a.push(b):a.pop();break;default:a.push(b)}return a.join("/")};var d=function(a,b,c){if(a)for(var d=0;d<c.length;d++)a.hasOwnProperty(c[d])&&(b[c[d]]=a[c[d]])}}(require("./tree")),function(a){a.visitor=function(a){this._implementation=a},a.visitor.prototype={visit:function(a){if(a instanceof Array)return this.visitArray(a);if(!a||!a.type)return a;var b,c,d="visit"+a.type,e=this._implementation[d];return e&&(b={visitDeeper:!0},c=e.call(this._implementation,a,b),this._implementation.isReplacing&&(a=c)),(!b||b.visitDeeper)&&a&&a.accept&&a.accept(this),d+="Out",this._implementation[d]&&this._implementation[d](a),a},visitArray:function(a){var b,c=[];for(b=0;b<a.length;b++){var d=this.visit(a[b]);d instanceof Array?(d=this.flatten(d),c=c.concat(d)):c.push(d)}return this._implementation.isReplacing?c:a},doAccept:function(a){a.accept(this)},flatten:function(a,b){return a.reduce(this.flattenReduce.bind(this),b||[])},flattenReduce:function(a,b){return b instanceof Array?a=this.flatten(b,a):a.push(b),a}}}(require("./tree")),function(a){a.importVisitor=function(b,c,d){this._visitor=new a.visitor(this),this._importer=b,this._finish=c,this.env=d||new a.evalEnv,this.importCount=0},a.importVisitor.prototype={isReplacing:!0,run:function(a){var b;try{this._visitor.visit(a)}catch(c){b=c}this.isFinished=!0,0===this.importCount&&this._finish(b)},visitImport:function(b,c){var d,e=this,f=b.options.inline;if(!b.css||f){try{d=b.evalForImport(this.env)}catch(g){g.filename||(g.index=b.index,g.filename=b.currentFileInfo.filename),b.css=!0,b.error=g}if(d&&(!d.css||f)){b=d,this.importCount++;var h=new a.evalEnv(this.env,this.env.frames.slice(0));b.options.multiple&&(h.importMultiple=!0),this._importer.push(b.getPath(),b.currentFileInfo,b.options,function(c,d,g,i){c&&!c.filename&&(c.index=b.index,c.filename=b.currentFileInfo.filename),g&&!h.importMultiple&&(b.skip=g);var j=function(a){e.importCount--,0===e.importCount&&e.isFinished&&e._finish(a)};return!d||(b.root=d,b.importedFilename=i,f||b.skip)?(j(),void 0):(new a.importVisitor(e._importer,j,h).run(d),void 0)})}}return c.visitDeeper=!1,b},visitRule:function(a,b){return b.visitDeeper=!1,a},visitDirective:function(a){return this.env.frames.unshift(a),a},visitDirectiveOut:function(){this.env.frames.shift()},visitMixinDefinition:function(a){return this.env.frames.unshift(a),a},visitMixinDefinitionOut:function(){this.env.frames.shift()},visitRuleset:function(a){return this.env.frames.unshift(a),a},visitRulesetOut:function(){this.env.frames.shift()},visitMedia:function(a){return this.env.frames.unshift(a.ruleset),a},visitMediaOut:function(){this.env.frames.shift()}}}(require("./tree")),function(a){a.joinSelectorVisitor=function(){this.contexts=[[]],this._visitor=new a.visitor(this)},a.joinSelectorVisitor.prototype={run:function(a){return this._visitor.visit(a)},visitRule:function(a,b){b.visitDeeper=!1},visitMixinDefinition:function(a,b){b.visitDeeper=!1},visitRuleset:function(a){var b=this.contexts[this.contexts.length-1],c=[];this.contexts.push(c),a.root||(a.selectors=a.selectors.filter(function(a){return a.getIsOutput()}),0===a.selectors.length&&(a.rules.length=0),a.joinSelectors(c,b,a.selectors),a.paths=c)},visitRulesetOut:function(){this.contexts.length=this.contexts.length-1},visitMedia:function(a){var b=this.contexts[this.contexts.length-1];a.rules[0].root=0===b.length||b[0].multiMedia}}}(require("./tree")),function(a){a.toCSSVisitor=function(b){this._visitor=new a.visitor(this),this._env=b},a.toCSSVisitor.prototype={isReplacing:!0,run:function(a){return this._visitor.visit(a)},visitRule:function(a){return a.variable?[]:a},visitMixinDefinition:function(){return[]},visitExtend:function(){return[]},visitComment:function(a){return a.isSilent(this._env)?[]:a},visitMedia:function(a,b){return a.accept(this._visitor),b.visitDeeper=!1,a.rules.length?a:[]},visitDirective:function(b){if(b.currentFileInfo.reference&&!b.isReferenced)return[];if("@charset"===b.name){if(this.charset){if(b.debugInfo){var c=new a.Comment("/* "+b.toCSS(this._env).replace(/\n/g,"")+" */\n");return c.debugInfo=b.debugInfo,this._visitor.visit(c)}return[]}this.charset=!0}return b},checkPropertiesInRoot:function(b){for(var c,d=0;d<b.length;d++)if(c=b[d],c instanceof a.Rule&&!c.variable)throw{message:"properties must be inside selector blocks, they cannot be in the root.",index:c.index,filename:c.currentFileInfo?c.currentFileInfo.filename:null}},visitRuleset:function(b,c){var d,e=[];if(b.firstRoot&&this.checkPropertiesInRoot(b.rules),b.root)b.accept(this._visitor),c.visitDeeper=!1,(b.firstRoot||b.rules.length>0)&&e.splice(0,0,b);else{b.paths=b.paths.filter(function(b){var c;for(" "===b[0].elements[0].combinator.value&&(b[0].elements[0].combinator=new a.Combinator("")),c=0;c<b.length;c++)return b[c].getIsReferenced()&&b[c].getIsOutput()?!0:!1});for(var f=0;f<b.rules.length;f++)d=b.rules[f],d.rules&&(e.push(this._visitor.visit(d)),b.rules.splice(f,1),f--);b.rules.length>0&&b.accept(this._visitor),c.visitDeeper=!1,this._mergeRules(b.rules),this._removeDuplicateRules(b.rules),b.rules.length>0&&b.paths.length>0&&e.splice(0,0,b)}return 1===e.length?e[0]:e},_removeDuplicateRules:function(b){var c,d,e,f={};for(e=b.length-1;e>=0;e--)if(d=b[e],d instanceof a.Rule)if(f[d.name]){c=f[d.name],c instanceof a.Rule&&(c=f[d.name]=[f[d.name].toCSS(this._env)]);var g=d.toCSS(this._env);-1!==c.indexOf(g)?b.splice(e,1):c.push(g)}else f[d.name]=d},_mergeRules:function(b){for(var c,d,e,f={},g=0;g<b.length;g++)d=b[g],d instanceof a.Rule&&d.merge&&(e=[d.name,d.important?"!":""].join(","),f[e]?b.splice(g--,1):c=f[e]=[],c.push(d));Object.keys(f).map(function(b){c=f[b],c.length>1&&(d=c[0],d.value=new a.Value(c.map(function(a){return a.value})))})}}}(require("./tree")),function(a){a.extendFinderVisitor=function(){this._visitor=new a.visitor(this),this.contexts=[],this.allExtendsStack=[[]]},a.extendFinderVisitor.prototype={run:function(a){return a=this._visitor.visit(a),a.allExtends=this.allExtendsStack[0],a},visitRule:function(a,b){b.visitDeeper=!1},visitMixinDefinition:function(a,b){b.visitDeeper=!1},visitRuleset:function(b){if(!b.root){var c,d,e,f,g=[];for(c=0;c<b.rules.length;c++)b.rules[c]instanceof a.Extend&&(g.push(b.rules[c]),b.extendOnEveryPath=!0);for(c=0;c<b.paths.length;c++){var h=b.paths[c],i=h[h.length-1];for(f=i.extendList.slice(0).concat(g).map(function(a){return a.clone()}),d=0;d<f.length;d++)this.foundExtends=!0,e=f[d],e.findSelfSelectors(h),e.ruleset=b,0===d&&(e.firstExtendOnThisSelectorPath=!0),this.allExtendsStack[this.allExtendsStack.length-1].push(e)}this.contexts.push(b.selectors)}},visitRulesetOut:function(a){a.root||(this.contexts.length=this.contexts.length-1)},visitMedia:function(a){a.allExtends=[],this.allExtendsStack.push(a.allExtends)},visitMediaOut:function(){this.allExtendsStack.length=this.allExtendsStack.length-1},visitDirective:function(a){a.allExtends=[],this.allExtendsStack.push(a.allExtends)},visitDirectiveOut:function(){this.allExtendsStack.length=this.allExtendsStack.length-1}},a.processExtendsVisitor=function(){this._visitor=new a.visitor(this)},a.processExtendsVisitor.prototype={run:function(b){var c=new a.extendFinderVisitor;return c.run(b),c.foundExtends?(b.allExtends=b.allExtends.concat(this.doExtendChaining(b.allExtends,b.allExtends)),this.allExtendsStack=[b.allExtends],this._visitor.visit(b)):b},doExtendChaining:function(b,c,d){var e,f,g,h,i,j,k,l,m=[],n=this;for(d=d||0,e=0;e<b.length;e++)for(f=0;f<c.length;f++)j=b[e],k=c[f],this.inInheritanceChain(k,j)||(i=[k.selfSelectors[0]],g=n.findMatch(j,i),g.length&&j.selfSelectors.forEach(function(b){h=n.extendSelector(g,i,b),l=new a.Extend(k.selector,k.option,0),l.selfSelectors=h,h[h.length-1].extendList=[l],m.push(l),l.ruleset=k.ruleset,l.parents=[k,j],k.firstExtendOnThisSelectorPath&&(l.firstExtendOnThisSelectorPath=!0,k.ruleset.paths.push(h))}));if(m.length){if(this.extendChainCount++,d>100){var o="{unable to calculate}",p="{unable to calculate}";try{o=m[0].selfSelectors[0].toCSS(),p=m[0].selector.toCSS()}catch(q){}throw{message:"extend circular reference detected. One of the circular extends is currently:"+o+":extend("+p+")"}}return m.concat(n.doExtendChaining(m,c,d+1))}return m},inInheritanceChain:function(a,b){if(a===b)return!0;if(b.parents){if(this.inInheritanceChain(a,b.parents[0]))return!0;if(this.inInheritanceChain(a,b.parents[1]))return!0}return!1},visitRule:function(a,b){b.visitDeeper=!1},visitMixinDefinition:function(a,b){b.visitDeeper=!1},visitSelector:function(a,b){b.visitDeeper=!1},visitRuleset:function(a){if(!a.root){var b,c,d,e,f=this.allExtendsStack[this.allExtendsStack.length-1],g=[],h=this;for(d=0;d<f.length;d++)for(c=0;c<a.paths.length;c++)e=a.paths[c],a.extendOnEveryPath||e[e.length-1].extendList.length||(b=this.findMatch(f[d],e),b.length&&f[d].selfSelectors.forEach(function(a){g.push(h.extendSelector(b,e,a))}));a.paths=a.paths.concat(g)}},findMatch:function(a,b){var c,d,e,f,g,h,i,j=this,k=a.selector.elements,l=[],m=[];for(c=0;c<b.length;c++)for(d=b[c],e=0;e<d.elements.length;e++)for(f=d.elements[e],(a.allowBefore||0===c&&0===e)&&l.push({pathIndex:c,index:e,matched:0,initialCombinator:f.combinator}),h=0;h<l.length;h++)i=l[h],g=f.combinator.value,""===g&&0===e&&(g=" "),!j.isElementValuesEqual(k[i.matched].value,f.value)||i.matched>0&&k[i.matched].combinator.value!==g?i=null:i.matched++,i&&(i.finished=i.matched===k.length,i.finished&&!a.allowAfter&&(e+1<d.elements.length||c+1<b.length)&&(i=null)),i?i.finished&&(i.length=k.length,i.endPathIndex=c,i.endPathElementIndex=e+1,l.length=0,m.push(i)):(l.splice(h,1),h--);return m},isElementValuesEqual:function(b,c){if("string"==typeof b||"string"==typeof c)return b===c;if(b instanceof a.Attribute)return b.op!==c.op||b.key!==c.key?!1:b.value&&c.value?(b=b.value.value||b.value,c=c.value.value||c.value,b===c):b.value||c.value?!1:!0;if(b=b.value,c=c.value,b instanceof a.Selector){if(!(c instanceof a.Selector)||b.elements.length!==c.elements.length)return!1;for(var d=0;d<b.elements.length;d++){if(b.elements[d].combinator.value!==c.elements[d].combinator.value&&(0!==d||(b.elements[d].combinator.value||" ")!==(c.elements[d].combinator.value||" ")))return!1;if(!this.isElementValuesEqual(b.elements[d].value,c.elements[d].value))return!1}return!0}return!1},extendSelector:function(b,c,d){var e,f,g,h,i,j=0,k=0,l=[];for(e=0;e<b.length;e++)h=b[e],f=c[h.pathIndex],g=new a.Element(h.initialCombinator,d.elements[0].value,d.elements[0].index,d.elements[0].currentFileInfo),h.pathIndex>j&&k>0&&(l[l.length-1].elements=l[l.length-1].elements.concat(c[j].elements.slice(k)),k=0,j++),i=f.elements.slice(k,h.index).concat([g]).concat(d.elements.slice(1)),j===h.pathIndex&&e>0?l[l.length-1].elements=l[l.length-1].elements.concat(i):(l=l.concat(c.slice(j,h.pathIndex)),l.push(new a.Selector(i))),j=h.endPathIndex,k=h.endPathElementIndex,k>=c[j].elements.length&&(k=0,j++);return j<c.length&&k>0&&(l[l.length-1].elements=l[l.length-1].elements.concat(c[j].elements.slice(k)),j++),l=l.concat(c.slice(j,c.length))},visitRulesetOut:function(){},visitMedia:function(a){var b=a.allExtends.concat(this.allExtendsStack[this.allExtendsStack.length-1]);b=b.concat(this.doExtendChaining(b,a.allExtends)),this.allExtendsStack.push(b)},visitMediaOut:function(){this.allExtendsStack.length=this.allExtendsStack.length-1},visitDirective:function(a){var b=a.allExtends.concat(this.allExtendsStack[this.allExtendsStack.length-1]);b=b.concat(this.doExtendChaining(b,a.allExtends)),this.allExtendsStack.push(b)},visitDirectiveOut:function(){this.allExtendsStack.length=this.allExtendsStack.length-1}}}(require("./tree")),function(a){a.sourceMapOutput=function(a){this._css=[],this._rootNode=a.rootNode,this._writeSourceMap=a.writeSourceMap,this._contentsMap=a.contentsMap,this._sourceMapFilename=a.sourceMapFilename,this._outputFilename=a.outputFilename,this._sourceMapBasepath=a.sourceMapBasepath,this._sourceMapRootpath=a.sourceMapRootpath,this._outputSourceFiles=a.outputSourceFiles,this._sourceMapGeneratorConstructor=a.sourceMapGenerator||require("source-map").SourceMapGenerator,this._sourceMapRootpath&&"/"!==this._sourceMapRootpath.charAt(this._sourceMapRootpath.length-1)&&(this._sourceMapRootpath+="/"),this._lineNumber=0,this._column=0},a.sourceMapOutput.prototype.normalizeFilename=function(a){return this._sourceMapBasepath&&0===a.indexOf(this._sourceMapBasepath)&&(a=a.substring(this._sourceMapBasepath.length),("\\"===a.charAt(0)||"/"===a.charAt(0))&&(a=a.substring(1))),(this._sourceMapRootpath||"")+a.replace(/\\/g,"/")},a.sourceMapOutput.prototype.add=function(a,b,c,d){if(a){var e,f,g,h,i;if(b){var j=this._contentsMap[b.filename].substring(0,c);f=j.split("\n"),h=f[f.length-1]}if(e=a.split("\n"),g=e[e.length-1],b)if(d)for(i=0;i<e.length;i++)this._sourceMapGenerator.addMapping({generated:{line:this._lineNumber+i+1,column:0===i?this._column:0},original:{line:f.length+i,column:0===i?h.length:0},source:this.normalizeFilename(b.filename)});else this._sourceMapGenerator.addMapping({generated:{line:this._lineNumber+1,column:this._column},original:{line:f.length,column:h.length},source:this.normalizeFilename(b.filename)});1===e.length?this._column+=g.length:(this._lineNumber+=e.length-1,this._column=g.length),this._css.push(a)}},a.sourceMapOutput.prototype.isEmpty=function(){return 0===this._css.length},a.sourceMapOutput.prototype.toCSS=function(a){if(this._sourceMapGenerator=new this._sourceMapGeneratorConstructor({file:this._outputFilename,sourceRoot:null}),this._outputSourceFiles)for(var b in this._contentsMap)this._sourceMapGenerator.setSourceContent(this.normalizeFilename(b),this._contentsMap[b]);if(this._rootNode.genCSS(a,this),this._css.length>0){var c,d=JSON.stringify(this._sourceMapGenerator.toJSON());this._sourceMapFilename&&(c=this.normalizeFilename(this._sourceMapFilename)),this._writeSourceMap?this._writeSourceMap(d):c="data:application/json,"+encodeURIComponent(d),c&&this._css.push("/*# sourceMappingURL="+c+" */")}return this._css.join("")}}(require("./tree"));var isFileProtocol=/^(file|chrome(-extension)?|resource|qrc|app):/.test(location.protocol);less.env=less.env||("127.0.0.1"==location.hostname||"0.0.0.0"==location.hostname||"localhost"==location.hostname||location.port.length>0||isFileProtocol?"development":"production");var logLevel={info:2,errors:1,none:0};if(less.logLevel="undefined"!=typeof less.logLevel?less.logLevel:logLevel.info,less.async=less.async||!1,less.fileAsync=less.fileAsync||!1,less.poll=less.poll||(isFileProtocol?1e3:1500),less.functions)for(var func in less.functions)less.tree.functions[func]=less.functions[func];var dumpLineNumbers=/!dumpLineNumbers:(comments|mediaquery|all)/.exec(location.hash);dumpLineNumbers&&(less.dumpLineNumbers=dumpLineNumbers[1]);var typePattern=/^text\/(x-)?less$/,cache=null,fileCache={};if(less.watch=function(){return less.watchMode||(less.env="development",initRunningMode()),this.watchMode=!0},less.unwatch=function(){return clearInterval(less.watchTimer),this.watchMode=!1},/!watch/.test(location.hash)&&less.watch(),"development"!=less.env)try{cache="undefined"==typeof window.localStorage?null:window.localStorage}catch(_){}var links=document.getElementsByTagName("link");less.sheets=[];for(var i=0;i<links.length;i++)("stylesheet/less"===links[i].rel||links[i].rel.match(/stylesheet/)&&links[i].type.match(typePattern))&&less.sheets.push(links[i]);less.modifyVars=function(a){var b="";for(var c in a)b+=("@"===c.slice(0,1)?"":"@")+c+": "+(";"===a[c].slice(-1)?a[c]:a[c]+";");less.refresh(!1,b)},less.refresh=function(a,b){var c,d;c=d=new Date,loadStyleSheets(function(a,b,e,f,g){return a?error(a,f.href):(g.local?log("loading "+f.href+" from cache.",logLevel.info):(log("parsed "+f.href+" successfully.",logLevel.info),createCSS(b.toCSS(less),f,g.lastModified)),log("css for "+f.href+" generated in "+(new Date-d)+"ms",logLevel.info),0===g.remaining&&log("css generated in "+(new Date-c)+"ms",logLevel.info),d=new Date,void 0)},a,b),loadStyles(b)},less.refreshStyles=loadStyles,less.Parser.fileLoader=loadFile,less.refresh("development"===less.env),"function"==typeof define&&define.amd&&define(function(){return less});

/*!
 * Bootstrap v3.0.3 (http://getbootstrap.com)
 * Copyright 2013 Twitter, Inc.
 * Licensed under http://www.apache.org/licenses/LICENSE-2.0
 */

if("undefined"==typeof jQuery)throw new Error("Bootstrap requires jQuery");+function(a){"use strict";function b(){var a=document.createElement("bootstrap"),b={WebkitTransition:"webkitTransitionEnd",MozTransition:"transitionend",OTransition:"oTransitionEnd otransitionend",transition:"transitionend"};for(var c in b)if(void 0!==a.style[c])return{end:b[c]}}a.fn.emulateTransitionEnd=function(b){var c=!1,d=this;a(this).one(a.support.transition.end,function(){c=!0});var e=function(){c||a(d).trigger(a.support.transition.end)};return setTimeout(e,b),this},a(function(){a.support.transition=b()})}(jQuery),+function(a){"use strict";var b='[data-dismiss="alert"]',c=function(c){a(c).on("click",b,this.close)};c.prototype.close=function(b){function c(){f.trigger("closed.bs.alert").remove()}var d=a(this),e=d.attr("data-target");e||(e=d.attr("href"),e=e&&e.replace(/.*(?=#[^\s]*$)/,""));var f=a(e);b&&b.preventDefault(),f.length||(f=d.hasClass("alert")?d:d.parent()),f.trigger(b=a.Event("close.bs.alert")),b.isDefaultPrevented()||(f.removeClass("in"),a.support.transition&&f.hasClass("fade")?f.one(a.support.transition.end,c).emulateTransitionEnd(150):c())};var d=a.fn.alert;a.fn.alert=function(b){return this.each(function(){var d=a(this),e=d.data("bs.alert");e||d.data("bs.alert",e=new c(this)),"string"==typeof b&&e[b].call(d)})},a.fn.alert.Constructor=c,a.fn.alert.noConflict=function(){return a.fn.alert=d,this},a(document).on("click.bs.alert.data-api",b,c.prototype.close)}(jQuery),+function(a){"use strict";var b=function(c,d){this.$element=a(c),this.options=a.extend({},b.DEFAULTS,d)};b.DEFAULTS={loadingText:"loading..."},b.prototype.setState=function(a){var b="disabled",c=this.$element,d=c.is("input")?"val":"html",e=c.data();a+="Text",e.resetText||c.data("resetText",c[d]()),c[d](e[a]||this.options[a]),setTimeout(function(){"loadingText"==a?c.addClass(b).attr(b,b):c.removeClass(b).removeAttr(b)},0)},b.prototype.toggle=function(){var a=this.$element.closest('[data-toggle="buttons"]'),b=!0;if(a.length){var c=this.$element.find("input");"radio"===c.prop("type")&&(c.prop("checked")&&this.$element.hasClass("active")?b=!1:a.find(".active").removeClass("active")),b&&c.prop("checked",!this.$element.hasClass("active")).trigger("change")}b&&this.$element.toggleClass("active")};var c=a.fn.button;a.fn.button=function(c){return this.each(function(){var d=a(this),e=d.data("bs.button"),f="object"==typeof c&&c;e||d.data("bs.button",e=new b(this,f)),"toggle"==c?e.toggle():c&&e.setState(c)})},a.fn.button.Constructor=b,a.fn.button.noConflict=function(){return a.fn.button=c,this},a(document).on("click.bs.button.data-api","[data-toggle^=button]",function(b){var c=a(b.target);c.hasClass("btn")||(c=c.closest(".btn")),c.button("toggle"),b.preventDefault()})}(jQuery),+function(a){"use strict";var b=function(b,c){this.$element=a(b),this.$indicators=this.$element.find(".carousel-indicators"),this.options=c,this.paused=this.sliding=this.interval=this.$active=this.$items=null,"hover"==this.options.pause&&this.$element.on("mouseenter",a.proxy(this.pause,this)).on("mouseleave",a.proxy(this.cycle,this))};b.DEFAULTS={interval:5e3,pause:"hover",wrap:!0},b.prototype.cycle=function(b){return b||(this.paused=!1),this.interval&&clearInterval(this.interval),this.options.interval&&!this.paused&&(this.interval=setInterval(a.proxy(this.next,this),this.options.interval)),this},b.prototype.getActiveIndex=function(){return this.$active=this.$element.find(".item.active"),this.$items=this.$active.parent().children(),this.$items.index(this.$active)},b.prototype.to=function(b){var c=this,d=this.getActiveIndex();return b>this.$items.length-1||0>b?void 0:this.sliding?this.$element.one("slid.bs.carousel",function(){c.to(b)}):d==b?this.pause().cycle():this.slide(b>d?"next":"prev",a(this.$items[b]))},b.prototype.pause=function(b){return b||(this.paused=!0),this.$element.find(".next, .prev").length&&a.support.transition.end&&(this.$element.trigger(a.support.transition.end),this.cycle(!0)),this.interval=clearInterval(this.interval),this},b.prototype.next=function(){return this.sliding?void 0:this.slide("next")},b.prototype.prev=function(){return this.sliding?void 0:this.slide("prev")},b.prototype.slide=function(b,c){var d=this.$element.find(".item.active"),e=c||d[b](),f=this.interval,g="next"==b?"left":"right",h="next"==b?"first":"last",i=this;if(!e.length){if(!this.options.wrap)return;e=this.$element.find(".item")[h]()}this.sliding=!0,f&&this.pause();var j=a.Event("slide.bs.carousel",{relatedTarget:e[0],direction:g});if(!e.hasClass("active")){if(this.$indicators.length&&(this.$indicators.find(".active").removeClass("active"),this.$element.one("slid.bs.carousel",function(){var b=a(i.$indicators.children()[i.getActiveIndex()]);b&&b.addClass("active")})),a.support.transition&&this.$element.hasClass("slide")){if(this.$element.trigger(j),j.isDefaultPrevented())return;e.addClass(b),e[0].offsetWidth,d.addClass(g),e.addClass(g),d.one(a.support.transition.end,function(){e.removeClass([b,g].join(" ")).addClass("active"),d.removeClass(["active",g].join(" ")),i.sliding=!1,setTimeout(function(){i.$element.trigger("slid.bs.carousel")},0)}).emulateTransitionEnd(600)}else{if(this.$element.trigger(j),j.isDefaultPrevented())return;d.removeClass("active"),e.addClass("active"),this.sliding=!1,this.$element.trigger("slid.bs.carousel")}return f&&this.cycle(),this}};var c=a.fn.carousel;a.fn.carousel=function(c){return this.each(function(){var d=a(this),e=d.data("bs.carousel"),f=a.extend({},b.DEFAULTS,d.data(),"object"==typeof c&&c),g="string"==typeof c?c:f.slide;e||d.data("bs.carousel",e=new b(this,f)),"number"==typeof c?e.to(c):g?e[g]():f.interval&&e.pause().cycle()})},a.fn.carousel.Constructor=b,a.fn.carousel.noConflict=function(){return a.fn.carousel=c,this},a(document).on("click.bs.carousel.data-api","[data-slide], [data-slide-to]",function(b){var c,d=a(this),e=a(d.attr("data-target")||(c=d.attr("href"))&&c.replace(/.*(?=#[^\s]+$)/,"")),f=a.extend({},e.data(),d.data()),g=d.attr("data-slide-to");g&&(f.interval=!1),e.carousel(f),(g=d.attr("data-slide-to"))&&e.data("bs.carousel").to(g),b.preventDefault()}),a(window).on("load",function(){a('[data-ride="carousel"]').each(function(){var b=a(this);b.carousel(b.data())})})}(jQuery),+function(a){"use strict";var b=function(c,d){this.$element=a(c),this.options=a.extend({},b.DEFAULTS,d),this.transitioning=null,this.options.parent&&(this.$parent=a(this.options.parent)),this.options.toggle&&this.toggle()};b.DEFAULTS={toggle:!0},b.prototype.dimension=function(){var a=this.$element.hasClass("width");return a?"width":"height"},b.prototype.show=function(){if(!this.transitioning&&!this.$element.hasClass("in")){var b=a.Event("show.bs.collapse");if(this.$element.trigger(b),!b.isDefaultPrevented()){var c=this.$parent&&this.$parent.find("> .panel > .in");if(c&&c.length){var d=c.data("bs.collapse");if(d&&d.transitioning)return;c.collapse("hide"),d||c.data("bs.collapse",null)}var e=this.dimension();this.$element.removeClass("collapse").addClass("collapsing")[e](0),this.transitioning=1;var f=function(){this.$element.removeClass("collapsing").addClass("in")[e]("auto"),this.transitioning=0,this.$element.trigger("shown.bs.collapse")};if(!a.support.transition)return f.call(this);var g=a.camelCase(["scroll",e].join("-"));this.$element.one(a.support.transition.end,a.proxy(f,this)).emulateTransitionEnd(350)[e](this.$element[0][g])}}},b.prototype.hide=function(){if(!this.transitioning&&this.$element.hasClass("in")){var b=a.Event("hide.bs.collapse");if(this.$element.trigger(b),!b.isDefaultPrevented()){var c=this.dimension();this.$element[c](this.$element[c]())[0].offsetHeight,this.$element.addClass("collapsing").removeClass("collapse").removeClass("in"),this.transitioning=1;var d=function(){this.transitioning=0,this.$element.trigger("hidden.bs.collapse").removeClass("collapsing").addClass("collapse")};return a.support.transition?(this.$element[c](0).one(a.support.transition.end,a.proxy(d,this)).emulateTransitionEnd(350),void 0):d.call(this)}}},b.prototype.toggle=function(){this[this.$element.hasClass("in")?"hide":"show"]()};var c=a.fn.collapse;a.fn.collapse=function(c){return this.each(function(){var d=a(this),e=d.data("bs.collapse"),f=a.extend({},b.DEFAULTS,d.data(),"object"==typeof c&&c);e||d.data("bs.collapse",e=new b(this,f)),"string"==typeof c&&e[c]()})},a.fn.collapse.Constructor=b,a.fn.collapse.noConflict=function(){return a.fn.collapse=c,this},a(document).on("click.bs.collapse.data-api","[data-toggle=collapse]",function(b){var c,d=a(this),e=d.attr("data-target")||b.preventDefault()||(c=d.attr("href"))&&c.replace(/.*(?=#[^\s]+$)/,""),f=a(e),g=f.data("bs.collapse"),h=g?"toggle":d.data(),i=d.attr("data-parent"),j=i&&a(i);g&&g.transitioning||(j&&j.find('[data-toggle=collapse][data-parent="'+i+'"]').not(d).addClass("collapsed"),d[f.hasClass("in")?"addClass":"removeClass"]("collapsed")),f.collapse(h)})}(jQuery),+function(a){"use strict";function b(){a(d).remove(),a(e).each(function(b){var d=c(a(this));d.hasClass("open")&&(d.trigger(b=a.Event("hide.bs.dropdown")),b.isDefaultPrevented()||d.removeClass("open").trigger("hidden.bs.dropdown"))})}function c(b){var c=b.attr("data-target");c||(c=b.attr("href"),c=c&&/#/.test(c)&&c.replace(/.*(?=#[^\s]*$)/,""));var d=c&&a(c);return d&&d.length?d:b.parent()}var d=".dropdown-backdrop",e="[data-toggle=dropdown]",f=function(b){a(b).on("click.bs.dropdown",this.toggle)};f.prototype.toggle=function(d){var e=a(this);if(!e.is(".disabled, :disabled")){var f=c(e),g=f.hasClass("open");if(b(),!g){if("ontouchstart"in document.documentElement&&!f.closest(".navbar-nav").length&&a('<div class="dropdown-backdrop"/>').insertAfter(a(this)).on("click",b),f.trigger(d=a.Event("show.bs.dropdown")),d.isDefaultPrevented())return;f.toggleClass("open").trigger("shown.bs.dropdown"),e.focus()}return!1}},f.prototype.keydown=function(b){if(/(38|40|27)/.test(b.keyCode)){var d=a(this);if(b.preventDefault(),b.stopPropagation(),!d.is(".disabled, :disabled")){var f=c(d),g=f.hasClass("open");if(!g||g&&27==b.keyCode)return 27==b.which&&f.find(e).focus(),d.click();var h=a("[role=menu] li:not(.divider):visible a",f);if(h.length){var i=h.index(h.filter(":focus"));38==b.keyCode&&i>0&&i--,40==b.keyCode&&i<h.length-1&&i++,~i||(i=0),h.eq(i).focus()}}}};var g=a.fn.dropdown;a.fn.dropdown=function(b){return this.each(function(){var c=a(this),d=c.data("bs.dropdown");d||c.data("bs.dropdown",d=new f(this)),"string"==typeof b&&d[b].call(c)})},a.fn.dropdown.Constructor=f,a.fn.dropdown.noConflict=function(){return a.fn.dropdown=g,this},a(document).on("click.bs.dropdown.data-api",b).on("click.bs.dropdown.data-api",".dropdown form",function(a){a.stopPropagation()}).on("click.bs.dropdown.data-api",e,f.prototype.toggle).on("keydown.bs.dropdown.data-api",e+", [role=menu]",f.prototype.keydown)}(jQuery),+function(a){"use strict";var b=function(b,c){this.options=c,this.$element=a(b),this.$backdrop=this.isShown=null,this.options.remote&&this.$element.load(this.options.remote)};b.DEFAULTS={backdrop:!0,keyboard:!0,show:!0},b.prototype.toggle=function(a){return this[this.isShown?"hide":"show"](a)},b.prototype.show=function(b){var c=this,d=a.Event("show.bs.modal",{relatedTarget:b});this.$element.trigger(d),this.isShown||d.isDefaultPrevented()||(this.isShown=!0,this.escape(),this.$element.on("click.dismiss.modal",'[data-dismiss="modal"]',a.proxy(this.hide,this)),this.backdrop(function(){var d=a.support.transition&&c.$element.hasClass("fade");c.$element.parent().length||c.$element.appendTo(document.body),c.$element.show(),d&&c.$element[0].offsetWidth,c.$element.addClass("in").attr("aria-hidden",!1),c.enforceFocus();var e=a.Event("shown.bs.modal",{relatedTarget:b});d?c.$element.find(".modal-dialog").one(a.support.transition.end,function(){c.$element.focus().trigger(e)}).emulateTransitionEnd(300):c.$element.focus().trigger(e)}))},b.prototype.hide=function(b){b&&b.preventDefault(),b=a.Event("hide.bs.modal"),this.$element.trigger(b),this.isShown&&!b.isDefaultPrevented()&&(this.isShown=!1,this.escape(),a(document).off("focusin.bs.modal"),this.$element.removeClass("in").attr("aria-hidden",!0).off("click.dismiss.modal"),a.support.transition&&this.$element.hasClass("fade")?this.$element.one(a.support.transition.end,a.proxy(this.hideModal,this)).emulateTransitionEnd(300):this.hideModal())},b.prototype.enforceFocus=function(){a(document).off("focusin.bs.modal").on("focusin.bs.modal",a.proxy(function(a){this.$element[0]===a.target||this.$element.has(a.target).length||this.$element.focus()},this))},b.prototype.escape=function(){this.isShown&&this.options.keyboard?this.$element.on("keyup.dismiss.bs.modal",a.proxy(function(a){27==a.which&&this.hide()},this)):this.isShown||this.$element.off("keyup.dismiss.bs.modal")},b.prototype.hideModal=function(){var a=this;this.$element.hide(),this.backdrop(function(){a.removeBackdrop(),a.$element.trigger("hidden.bs.modal")})},b.prototype.removeBackdrop=function(){this.$backdrop&&this.$backdrop.remove(),this.$backdrop=null},b.prototype.backdrop=function(b){var c=this.$element.hasClass("fade")?"fade":"";if(this.isShown&&this.options.backdrop){var d=a.support.transition&&c;if(this.$backdrop=a('<div class="modal-backdrop '+c+'" />').appendTo(document.body),this.$element.on("click.dismiss.modal",a.proxy(function(a){a.target===a.currentTarget&&("static"==this.options.backdrop?this.$element[0].focus.call(this.$element[0]):this.hide.call(this))},this)),d&&this.$backdrop[0].offsetWidth,this.$backdrop.addClass("in"),!b)return;d?this.$backdrop.one(a.support.transition.end,b).emulateTransitionEnd(150):b()}else!this.isShown&&this.$backdrop?(this.$backdrop.removeClass("in"),a.support.transition&&this.$element.hasClass("fade")?this.$backdrop.one(a.support.transition.end,b).emulateTransitionEnd(150):b()):b&&b()};var c=a.fn.modal;a.fn.modal=function(c,d){return this.each(function(){var e=a(this),f=e.data("bs.modal"),g=a.extend({},b.DEFAULTS,e.data(),"object"==typeof c&&c);f||e.data("bs.modal",f=new b(this,g)),"string"==typeof c?f[c](d):g.show&&f.show(d)})},a.fn.modal.Constructor=b,a.fn.modal.noConflict=function(){return a.fn.modal=c,this},a(document).on("click.bs.modal.data-api",'[data-toggle="modal"]',function(b){var c=a(this),d=c.attr("href"),e=a(c.attr("data-target")||d&&d.replace(/.*(?=#[^\s]+$)/,"")),f=e.data("modal")?"toggle":a.extend({remote:!/#/.test(d)&&d},e.data(),c.data());b.preventDefault(),e.modal(f,this).one("hide",function(){c.is(":visible")&&c.focus()})}),a(document).on("show.bs.modal",".modal",function(){a(document.body).addClass("modal-open")}).on("hidden.bs.modal",".modal",function(){a(document.body).removeClass("modal-open")})}(jQuery),+function(a){"use strict";var b=function(a,b){this.type=this.options=this.enabled=this.timeout=this.hoverState=this.$element=null,this.init("tooltip",a,b)};b.DEFAULTS={animation:!0,placement:"top",selector:!1,template:'<div class="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',trigger:"hover focus",title:"",delay:0,html:!1,container:!1},b.prototype.init=function(b,c,d){this.enabled=!0,this.type=b,this.$element=a(c),this.options=this.getOptions(d);for(var e=this.options.trigger.split(" "),f=e.length;f--;){var g=e[f];if("click"==g)this.$element.on("click."+this.type,this.options.selector,a.proxy(this.toggle,this));else if("manual"!=g){var h="hover"==g?"mouseenter":"focus",i="hover"==g?"mouseleave":"blur";this.$element.on(h+"."+this.type,this.options.selector,a.proxy(this.enter,this)),this.$element.on(i+"."+this.type,this.options.selector,a.proxy(this.leave,this))}}this.options.selector?this._options=a.extend({},this.options,{trigger:"manual",selector:""}):this.fixTitle()},b.prototype.getDefaults=function(){return b.DEFAULTS},b.prototype.getOptions=function(b){return b=a.extend({},this.getDefaults(),this.$element.data(),b),b.delay&&"number"==typeof b.delay&&(b.delay={show:b.delay,hide:b.delay}),b},b.prototype.getDelegateOptions=function(){var b={},c=this.getDefaults();return this._options&&a.each(this._options,function(a,d){c[a]!=d&&(b[a]=d)}),b},b.prototype.enter=function(b){var c=b instanceof this.constructor?b:a(b.currentTarget)[this.type](this.getDelegateOptions()).data("bs."+this.type);return clearTimeout(c.timeout),c.hoverState="in",c.options.delay&&c.options.delay.show?(c.timeout=setTimeout(function(){"in"==c.hoverState&&c.show()},c.options.delay.show),void 0):c.show()},b.prototype.leave=function(b){var c=b instanceof this.constructor?b:a(b.currentTarget)[this.type](this.getDelegateOptions()).data("bs."+this.type);return clearTimeout(c.timeout),c.hoverState="out",c.options.delay&&c.options.delay.hide?(c.timeout=setTimeout(function(){"out"==c.hoverState&&c.hide()},c.options.delay.hide),void 0):c.hide()},b.prototype.show=function(){var b=a.Event("show.bs."+this.type);if(this.hasContent()&&this.enabled){if(this.$element.trigger(b),b.isDefaultPrevented())return;var c=this.tip();this.setContent(),this.options.animation&&c.addClass("fade");var d="function"==typeof this.options.placement?this.options.placement.call(this,c[0],this.$element[0]):this.options.placement,e=/\s?auto?\s?/i,f=e.test(d);f&&(d=d.replace(e,"")||"top"),c.detach().css({top:0,left:0,display:"block"}).addClass(d),this.options.container?c.appendTo(this.options.container):c.insertAfter(this.$element);var g=this.getPosition(),h=c[0].offsetWidth,i=c[0].offsetHeight;if(f){var j=this.$element.parent(),k=d,l=document.documentElement.scrollTop||document.body.scrollTop,m="body"==this.options.container?window.innerWidth:j.outerWidth(),n="body"==this.options.container?window.innerHeight:j.outerHeight(),o="body"==this.options.container?0:j.offset().left;d="bottom"==d&&g.top+g.height+i-l>n?"top":"top"==d&&g.top-l-i<0?"bottom":"right"==d&&g.right+h>m?"left":"left"==d&&g.left-h<o?"right":d,c.removeClass(k).addClass(d)}var p=this.getCalculatedOffset(d,g,h,i);this.applyPlacement(p,d),this.$element.trigger("shown.bs."+this.type)}},b.prototype.applyPlacement=function(a,b){var c,d=this.tip(),e=d[0].offsetWidth,f=d[0].offsetHeight,g=parseInt(d.css("margin-top"),10),h=parseInt(d.css("margin-left"),10);isNaN(g)&&(g=0),isNaN(h)&&(h=0),a.top=a.top+g,a.left=a.left+h,d.offset(a).addClass("in");var i=d[0].offsetWidth,j=d[0].offsetHeight;if("top"==b&&j!=f&&(c=!0,a.top=a.top+f-j),/bottom|top/.test(b)){var k=0;a.left<0&&(k=-2*a.left,a.left=0,d.offset(a),i=d[0].offsetWidth,j=d[0].offsetHeight),this.replaceArrow(k-e+i,i,"left")}else this.replaceArrow(j-f,j,"top");c&&d.offset(a)},b.prototype.replaceArrow=function(a,b,c){this.arrow().css(c,a?50*(1-a/b)+"%":"")},b.prototype.setContent=function(){var a=this.tip(),b=this.getTitle();a.find(".tooltip-inner")[this.options.html?"html":"text"](b),a.removeClass("fade in top bottom left right")},b.prototype.hide=function(){function b(){"in"!=c.hoverState&&d.detach()}var c=this,d=this.tip(),e=a.Event("hide.bs."+this.type);return this.$element.trigger(e),e.isDefaultPrevented()?void 0:(d.removeClass("in"),a.support.transition&&this.$tip.hasClass("fade")?d.one(a.support.transition.end,b).emulateTransitionEnd(150):b(),this.$element.trigger("hidden.bs."+this.type),this)},b.prototype.fixTitle=function(){var a=this.$element;(a.attr("title")||"string"!=typeof a.attr("data-original-title"))&&a.attr("data-original-title",a.attr("title")||"").attr("title","")},b.prototype.hasContent=function(){return this.getTitle()},b.prototype.getPosition=function(){var b=this.$element[0];return a.extend({},"function"==typeof b.getBoundingClientRect?b.getBoundingClientRect():{width:b.offsetWidth,height:b.offsetHeight},this.$element.offset())},b.prototype.getCalculatedOffset=function(a,b,c,d){return"bottom"==a?{top:b.top+b.height,left:b.left+b.width/2-c/2}:"top"==a?{top:b.top-d,left:b.left+b.width/2-c/2}:"left"==a?{top:b.top+b.height/2-d/2,left:b.left-c}:{top:b.top+b.height/2-d/2,left:b.left+b.width}},b.prototype.getTitle=function(){var a,b=this.$element,c=this.options;return a=b.attr("data-original-title")||("function"==typeof c.title?c.title.call(b[0]):c.title)},b.prototype.tip=function(){return this.$tip=this.$tip||a(this.options.template)},b.prototype.arrow=function(){return this.$arrow=this.$arrow||this.tip().find(".tooltip-arrow")},b.prototype.validate=function(){this.$element[0].parentNode||(this.hide(),this.$element=null,this.options=null)},b.prototype.enable=function(){this.enabled=!0},b.prototype.disable=function(){this.enabled=!1},b.prototype.toggleEnabled=function(){this.enabled=!this.enabled},b.prototype.toggle=function(b){var c=b?a(b.currentTarget)[this.type](this.getDelegateOptions()).data("bs."+this.type):this;c.tip().hasClass("in")?c.leave(c):c.enter(c)},b.prototype.destroy=function(){this.hide().$element.off("."+this.type).removeData("bs."+this.type)};var c=a.fn.tooltip;a.fn.tooltip=function(c){return this.each(function(){var d=a(this),e=d.data("bs.tooltip"),f="object"==typeof c&&c;e||d.data("bs.tooltip",e=new b(this,f)),"string"==typeof c&&e[c]()})},a.fn.tooltip.Constructor=b,a.fn.tooltip.noConflict=function(){return a.fn.tooltip=c,this}}(jQuery),+function(a){"use strict";var b=function(a,b){this.init("popover",a,b)};if(!a.fn.tooltip)throw new Error("Popover requires tooltip.js");b.DEFAULTS=a.extend({},a.fn.tooltip.Constructor.DEFAULTS,{placement:"right",trigger:"click",content:"",template:'<div class="popover"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'}),b.prototype=a.extend({},a.fn.tooltip.Constructor.prototype),b.prototype.constructor=b,b.prototype.getDefaults=function(){return b.DEFAULTS},b.prototype.setContent=function(){var a=this.tip(),b=this.getTitle(),c=this.getContent();a.find(".popover-title")[this.options.html?"html":"text"](b),a.find(".popover-content")[this.options.html?"html":"text"](c),a.removeClass("fade top bottom left right in"),a.find(".popover-title").html()||a.find(".popover-title").hide()},b.prototype.hasContent=function(){return this.getTitle()||this.getContent()},b.prototype.getContent=function(){var a=this.$element,b=this.options;return a.attr("data-content")||("function"==typeof b.content?b.content.call(a[0]):b.content)},b.prototype.arrow=function(){return this.$arrow=this.$arrow||this.tip().find(".arrow")},b.prototype.tip=function(){return this.$tip||(this.$tip=a(this.options.template)),this.$tip};var c=a.fn.popover;a.fn.popover=function(c){return this.each(function(){var d=a(this),e=d.data("bs.popover"),f="object"==typeof c&&c;e||d.data("bs.popover",e=new b(this,f)),"string"==typeof c&&e[c]()})},a.fn.popover.Constructor=b,a.fn.popover.noConflict=function(){return a.fn.popover=c,this}}(jQuery),+function(a){"use strict";function b(c,d){var e,f=a.proxy(this.process,this);this.$element=a(c).is("body")?a(window):a(c),this.$body=a("body"),this.$scrollElement=this.$element.on("scroll.bs.scroll-spy.data-api",f),this.options=a.extend({},b.DEFAULTS,d),this.selector=(this.options.target||(e=a(c).attr("href"))&&e.replace(/.*(?=#[^\s]+$)/,"")||"")+" .nav li > a",this.offsets=a([]),this.targets=a([]),this.activeTarget=null,this.refresh(),this.process()}b.DEFAULTS={offset:10},b.prototype.refresh=function(){var b=this.$element[0]==window?"offset":"position";this.offsets=a([]),this.targets=a([]);var c=this;this.$body.find(this.selector).map(function(){var d=a(this),e=d.data("target")||d.attr("href"),f=/^#\w/.test(e)&&a(e);return f&&f.length&&[[f[b]().top+(!a.isWindow(c.$scrollElement.get(0))&&c.$scrollElement.scrollTop()),e]]||null}).sort(function(a,b){return a[0]-b[0]}).each(function(){c.offsets.push(this[0]),c.targets.push(this[1])})},b.prototype.process=function(){var a,b=this.$scrollElement.scrollTop()+this.options.offset,c=this.$scrollElement[0].scrollHeight||this.$body[0].scrollHeight,d=c-this.$scrollElement.height(),e=this.offsets,f=this.targets,g=this.activeTarget;if(b>=d)return g!=(a=f.last()[0])&&this.activate(a);for(a=e.length;a--;)g!=f[a]&&b>=e[a]&&(!e[a+1]||b<=e[a+1])&&this.activate(f[a])},b.prototype.activate=function(b){this.activeTarget=b,a(this.selector).parents(".active").removeClass("active");var c=this.selector+'[data-target="'+b+'"],'+this.selector+'[href="'+b+'"]',d=a(c).parents("li").addClass("active");d.parent(".dropdown-menu").length&&(d=d.closest("li.dropdown").addClass("active")),d.trigger("activate.bs.scrollspy")};var c=a.fn.scrollspy;a.fn.scrollspy=function(c){return this.each(function(){var d=a(this),e=d.data("bs.scrollspy"),f="object"==typeof c&&c;e||d.data("bs.scrollspy",e=new b(this,f)),"string"==typeof c&&e[c]()})},a.fn.scrollspy.Constructor=b,a.fn.scrollspy.noConflict=function(){return a.fn.scrollspy=c,this},a(window).on("load",function(){a('[data-spy="scroll"]').each(function(){var b=a(this);b.scrollspy(b.data())})})}(jQuery),+function(a){"use strict";var b=function(b){this.element=a(b)};b.prototype.show=function(){var b=this.element,c=b.closest("ul:not(.dropdown-menu)"),d=b.data("target");if(d||(d=b.attr("href"),d=d&&d.replace(/.*(?=#[^\s]*$)/,"")),!b.parent("li").hasClass("active")){var e=c.find(".active:last a")[0],f=a.Event("show.bs.tab",{relatedTarget:e});if(b.trigger(f),!f.isDefaultPrevented()){var g=a(d);this.activate(b.parent("li"),c),this.activate(g,g.parent(),function(){b.trigger({type:"shown.bs.tab",relatedTarget:e})})}}},b.prototype.activate=function(b,c,d){function e(){f.removeClass("active").find("> .dropdown-menu > .active").removeClass("active"),b.addClass("active"),g?(b[0].offsetWidth,b.addClass("in")):b.removeClass("fade"),b.parent(".dropdown-menu")&&b.closest("li.dropdown").addClass("active"),d&&d()}var f=c.find("> .active"),g=d&&a.support.transition&&f.hasClass("fade");g?f.one(a.support.transition.end,e).emulateTransitionEnd(150):e(),f.removeClass("in")};var c=a.fn.tab;a.fn.tab=function(c){return this.each(function(){var d=a(this),e=d.data("bs.tab");e||d.data("bs.tab",e=new b(this)),"string"==typeof c&&e[c]()})},a.fn.tab.Constructor=b,a.fn.tab.noConflict=function(){return a.fn.tab=c,this},a(document).on("click.bs.tab.data-api",'[data-toggle="tab"], [data-toggle="pill"]',function(b){b.preventDefault(),a(this).tab("show")})}(jQuery),+function(a){"use strict";var b=function(c,d){this.options=a.extend({},b.DEFAULTS,d),this.$window=a(window).on("scroll.bs.affix.data-api",a.proxy(this.checkPosition,this)).on("click.bs.affix.data-api",a.proxy(this.checkPositionWithEventLoop,this)),this.$element=a(c),this.affixed=this.unpin=null,this.checkPosition()};b.RESET="affix affix-top affix-bottom",b.DEFAULTS={offset:0},b.prototype.checkPositionWithEventLoop=function(){setTimeout(a.proxy(this.checkPosition,this),1)},b.prototype.checkPosition=function(){if(this.$element.is(":visible")){var c=a(document).height(),d=this.$window.scrollTop(),e=this.$element.offset(),f=this.options.offset,g=f.top,h=f.bottom;"object"!=typeof f&&(h=g=f),"function"==typeof g&&(g=f.top()),"function"==typeof h&&(h=f.bottom());var i=null!=this.unpin&&d+this.unpin<=e.top?!1:null!=h&&e.top+this.$element.height()>=c-h?"bottom":null!=g&&g>=d?"top":!1;this.affixed!==i&&(this.unpin&&this.$element.css("top",""),this.affixed=i,this.unpin="bottom"==i?e.top-d:null,this.$element.removeClass(b.RESET).addClass("affix"+(i?"-"+i:"")),"bottom"==i&&this.$element.offset({top:document.body.offsetHeight-h-this.$element.height()}))}};var c=a.fn.affix;a.fn.affix=function(c){return this.each(function(){var d=a(this),e=d.data("bs.affix"),f="object"==typeof c&&c;e||d.data("bs.affix",e=new b(this,f)),"string"==typeof c&&e[c]()})},a.fn.affix.Constructor=b,a.fn.affix.noConflict=function(){return a.fn.affix=c,this},a(window).on("load",function(){a('[data-spy="affix"]').each(function(){var b=a(this),c=b.data();c.offset=c.offset||{},c.offsetBottom&&(c.offset.bottom=c.offsetBottom),c.offsetTop&&(c.offset.top=c.offsetTop),b.affix(c)})})}(jQuery);

