/*!
 * jQuery Cycle Plugin (with Transition Definitions)
 * Examples and documentation at: http://jquery.malsup.com/cycle/
 * Copyright (c) 2007-2010 M. Alsup
 * Version: 2.9998 (27-OCT-2011)
 * Dual licensed under the MIT and GPL licenses.
 * http://jquery.malsup.com/license.html
 * Requires: jQuery v1.3.2 or later
 */
;(function($, undefined) {

var ver = '2.9998';

// if $.support is not defined (pre jQuery 1.3) add what I need
if ($.support == undefined) {
    $.support = {
        opacity: !($.browser.msie)
    };
}

function debug(s) {
    $.fn.cycle.debug && log(s);
}       
function log() {
    window.console && console.log && console.log('[cycle] ' + Array.prototype.join.call(arguments,' '));
}
$.expr[':'].paused = function(el) {
    return el.cyclePause;
}


// the options arg can be...
//   a number  - indicates an immediate transition should occur to the given slide index
//   a string  - 'pause', 'resume', 'toggle', 'next', 'prev', 'stop', 'destroy' or the name of a transition effect (ie, 'fade', 'zoom', etc)
//   an object - properties to control the slideshow
//
// the arg2 arg can be...
//   the name of an fx (only used in conjunction with a numeric value for 'options')
//   the value true (only used in first arg == 'resume') and indicates
//   that the resume should occur immediately (not wait for next timeout)

$.fn.cycle = function(options, arg2) {
    var o = { s: this.selector, c: this.context };

    // in 1.3+ we can fix mistakes with the ready state
    if (this.length === 0 && options != 'stop') {
        if (!$.isReady && o.s) {
            log('DOM not ready, queuing slideshow');
            $(function() {
                $(o.s,o.c).cycle(options,arg2);
            });
            return this;
        }
        // is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
        log('terminating; zero elements found by selector' + ($.isReady ? '' : ' (DOM not ready)'));
        return this;
    }

    // iterate the matched nodeset
    return this.each(function() {
        var opts = handleArguments(this, options, arg2);
        if (opts === false)
            return;

        opts.updateActivePagerLink = opts.updateActivePagerLink || $.fn.cycle.updateActivePagerLink;
        
        // stop existing slideshow for this container (if there is one)
        if (this.cycleTimeout)
            clearTimeout(this.cycleTimeout);
        this.cycleTimeout = this.cyclePause = 0;

        var $cont = $(this);
        var $slides = opts.slideExpr ? $(opts.slideExpr, this) : $cont.children();
        var els = $slides.get();

        var opts2 = buildOptions($cont, $slides, els, opts, o);
        if (opts2 === false)
            return;

        if (els.length < 2) {
            log('terminating; too few slides: ' + els.length);
            return;
        }

        var startTime = opts2.continuous ? 10 : getTimeout(els[opts2.currSlide], els[opts2.nextSlide], opts2, !opts2.backwards);

        // if it's an auto slideshow, kick it off
        if (startTime) {
            startTime += (opts2.delay || 0);
            if (startTime < 10)
                startTime = 10;
            debug('first timeout: ' + startTime);
            this.cycleTimeout = setTimeout(function(){go(els,opts2,0,!opts.backwards)}, startTime);
        }
    });
};

function triggerPause(cont, byHover, onPager) {
    var opts = $(cont).data('cycle.opts');
    var paused = !!cont.cyclePause;
    if (paused && opts.paused)
        opts.paused(cont, opts, byHover, onPager);
    else if (!paused && opts.resumed)
        opts.resumed(cont, opts, byHover, onPager);
}

// process the args that were passed to the plugin fn
function handleArguments(cont, options, arg2) {
    if (cont.cycleStop == undefined)
        cont.cycleStop = 0;
    if (options === undefined || options === null)
        options = {};
    if (options.constructor == String) {
        switch(options) {
        case 'destroy':
        case 'stop':
            var opts = $(cont).data('cycle.opts');
            if (!opts)
                return false;
            cont.cycleStop++; // callbacks look for change
            if (cont.cycleTimeout)
                clearTimeout(cont.cycleTimeout);
            cont.cycleTimeout = 0;
            opts.elements && $(opts.elements).stop();
            $(cont).removeData('cycle.opts');
            if (options == 'destroy')
                destroy(opts);
            return false;
        case 'toggle':
            cont.cyclePause = (cont.cyclePause === 1) ? 0 : 1;
            checkInstantResume(cont.cyclePause, arg2, cont);
            triggerPause(cont);
            return false;
        case 'pause':
            cont.cyclePause = 1;
            triggerPause(cont);
            return false;
        case 'resume':
            cont.cyclePause = 0;
            checkInstantResume(false, arg2, cont);
            triggerPause(cont);
            return false;
        case 'prev':
        case 'next':
            var opts = $(cont).data('cycle.opts');
            if (!opts) {
                log('options not found, "prev/next" ignored');
                return false;
            }
            $.fn.cycle[options](opts);
            return false;
        default:
            options = { fx: options };
        };
        return options;
    }
    else if (options.constructor == Number) {
        // go to the requested slide
        var num = options;
        options = $(cont).data('cycle.opts');
        if (!options) {
            log('options not found, can not advance slide');
            return false;
        }
        if (num < 0 || num >= options.elements.length) {
            log('invalid slide index: ' + num);
            return false;
        }
        options.nextSlide = num;
        if (cont.cycleTimeout) {
            clearTimeout(cont.cycleTimeout);
            cont.cycleTimeout = 0;
        }
        if (typeof arg2 == 'string')
            options.oneTimeFx = arg2;
        go(options.elements, options, 1, num >= options.currSlide);
        return false;
    }
    return options;
    
    function checkInstantResume(isPaused, arg2, cont) {
        if (!isPaused && arg2 === true) { // resume now!
            var options = $(cont).data('cycle.opts');
            if (!options) {
                log('options not found, can not resume');
                return false;
            }
            if (cont.cycleTimeout) {
                clearTimeout(cont.cycleTimeout);
                cont.cycleTimeout = 0;
            }
            go(options.elements, options, 1, !options.backwards);
        }
    }
};

function removeFilter(el, opts) {
    if (!$.support.opacity && opts.cleartype && el.style.filter) {
        try { el.style.removeAttribute('filter'); }
        catch(smother) {} // handle old opera versions
    }
};

// unbind event handlers
function destroy(opts) {
    if (opts.next)
        $(opts.next).unbind(opts.prevNextEvent);
    if (opts.prev)
        $(opts.prev).unbind(opts.prevNextEvent);
    
    if (opts.pager || opts.pagerAnchorBuilder)
        $.each(opts.pagerAnchors || [], function() {
            this.unbind().remove();
        });
    opts.pagerAnchors = null;
    if (opts.destroy) // callback
        opts.destroy(opts);
};

// one-time initialization
function buildOptions($cont, $slides, els, options, o) {
    var startingSlideSpecified;
    // support metadata plugin (v1.0 and v2.0)
    var opts = $.extend({}, $.fn.cycle.defaults, options || {}, $.metadata ? $cont.metadata() : $.meta ? $cont.data() : {});
    var meta = $.isFunction($cont.data) ? $cont.data(opts.metaAttr) : null;
    if (meta)
        opts = $.extend(opts, meta);
    if (opts.autostop)
        opts.countdown = opts.autostopCount || els.length;

    var cont = $cont[0];
    $cont.data('cycle.opts', opts);
    opts.$cont = $cont;
    opts.stopCount = cont.cycleStop;
    opts.elements = els;
    opts.before = opts.before ? [opts.before] : [];
    opts.after = opts.after ? [opts.after] : [];

    // push some after callbacks
    if (!$.support.opacity && opts.cleartype)
        opts.after.push(function() { removeFilter(this, opts); });
    if (opts.continuous)
        opts.after.push(function() { go(els,opts,0,!opts.backwards); });

    saveOriginalOpts(opts);

    // clearType corrections
    if (!$.support.opacity && opts.cleartype && !opts.cleartypeNoBg)
        clearTypeFix($slides);

    // container requires non-static position so that slides can be position within
    if ($cont.css('position') == 'static')
        $cont.css('position', 'relative');
    if (opts.width)
        $cont.width(opts.width);
    if (opts.height && opts.height != 'auto')
        $cont.height(opts.height);

    if (opts.startingSlide != undefined) {
        opts.startingSlide = parseInt(opts.startingSlide,10);
        if (opts.startingSlide >= els.length || opts.startSlide < 0)
            opts.startingSlide = 0; // catch bogus input
        else 
            startingSlideSpecified = true;
    }
    else if (opts.backwards)
        opts.startingSlide = els.length - 1;
    else
        opts.startingSlide = 0;

    // if random, mix up the slide array
    if (opts.random) {
        opts.randomMap = [];
        for (var i = 0; i < els.length; i++)
            opts.randomMap.push(i);
        opts.randomMap.sort(function(a,b) {return Math.random() - 0.5;});
        if (startingSlideSpecified) {
            // try to find the specified starting slide and if found set start slide index in the map accordingly
            for ( var cnt = 0; cnt < els.length; cnt++ ) {
                if ( opts.startingSlide == opts.randomMap[cnt] ) {
                    opts.randomIndex = cnt;
                }
            }
        }
        else {
            opts.randomIndex = 1;
            opts.startingSlide = opts.randomMap[1];
        }
    }
    else if (opts.startingSlide >= els.length)
        opts.startingSlide = 0; // catch bogus input
    opts.currSlide = opts.startingSlide || 0;
    var first = opts.startingSlide;

    // set position and zIndex on all the slides
    $slides.css({position: 'absolute', top:0, left:0}).hide().each(function(i) {
        var z;
        if (opts.backwards)
            z = first ? i <= first ? els.length + (i-first) : first-i : els.length-i;
        else
            z = first ? i >= first ? els.length - (i-first) : first-i : els.length-i;
        $(this).css('z-index', z)
    });

    // make sure first slide is visible
    $(els[first]).css('opacity',1).show(); // opacity bit needed to handle restart use case
    removeFilter(els[first], opts);

    // stretch slides
    if (opts.fit) {
        if (!opts.aspect) {
            if (opts.width)
                $slides.width(opts.width);
            if (opts.height && opts.height != 'auto')
                $slides.height(opts.height);
        } else {
            $slides.each(function(){
                var $slide = $(this);
                var ratio = (opts.aspect === true) ? $slide.width()/$slide.height() : opts.aspect;
                if( opts.width && $slide.width() != opts.width ) {
                    $slide.width( opts.width );
                    $slide.height( opts.width / ratio );
                }

                if( opts.height && $slide.height() < opts.height ) {
                    $slide.height( opts.height );
                    $slide.width( opts.height * ratio );
                }
            });
        }
    }

    if (opts.center && ((!opts.fit) || opts.aspect)) {
        $slides.each(function(){
            var $slide = $(this);
            $slide.css({
                "margin-left": opts.width ?
                    ((opts.width - $slide.width()) / 2) + "px" :
                    0,
                "margin-top": opts.height ?
                    ((opts.height - $slide.height()) / 2) + "px" :
                    0
            });
        });
    }

    if (opts.center && !opts.fit && !opts.slideResize) {
        $slides.each(function(){
            var $slide = $(this);
            $slide.css({
                "margin-left": opts.width ? ((opts.width - $slide.width()) / 2) + "px" : 0,
                "margin-top": opts.height ? ((opts.height - $slide.height()) / 2) + "px" : 0
            });
        });
    }
        
    // stretch container
    var reshape = opts.containerResize && !$cont.innerHeight();
    if (reshape) { // do this only if container has no size http://tinyurl.com/da2oa9
        var maxw = 0, maxh = 0;
        for(var j=0; j < els.length; j++) {
            var $e = $(els[j]), e = $e[0], w = $e.outerWidth(), h = $e.outerHeight();
            if (!w) w = e.offsetWidth || e.width || $e.attr('width');
            if (!h) h = e.offsetHeight || e.height || $e.attr('height');
            maxw = w > maxw ? w : maxw;
            maxh = h > maxh ? h : maxh;
        }
        if (maxw > 0 && maxh > 0)
            $cont.css({width:maxw+'px',height:maxh+'px'});
    }

    var pauseFlag = false;  // https://github.com/malsup/cycle/issues/44
    if (opts.pause)
        $cont.hover(
            function(){
                pauseFlag = true;
                this.cyclePause++;
                triggerPause(cont, true);
            },
            function(){
                pauseFlag && this.cyclePause--;
                triggerPause(cont, true);
            }
        );

    if (supportMultiTransitions(opts) === false)
        return false;

    // apparently a lot of people use image slideshows without height/width attributes on the images.
    // Cycle 2.50+ requires the sizing info for every slide; this block tries to deal with that.
    var requeue = false;
    options.requeueAttempts = options.requeueAttempts || 0;
    $slides.each(function() {
        // try to get height/width of each slide
        var $el = $(this);
        this.cycleH = (opts.fit && opts.height) ? opts.height : ($el.height() || this.offsetHeight || this.height || $el.attr('height') || 0);
        this.cycleW = (opts.fit && opts.width) ? opts.width : ($el.width() || this.offsetWidth || this.width || $el.attr('width') || 0);

        if ( $el.is('img') ) {
            // sigh..  sniffing, hacking, shrugging...  this crappy hack tries to account for what browsers do when
            // an image is being downloaded and the markup did not include sizing info (height/width attributes);
            // there seems to be some "default" sizes used in this situation
            var loadingIE   = ($.browser.msie  && this.cycleW == 28 && this.cycleH == 30 && !this.complete);
            var loadingFF   = ($.browser.mozilla && this.cycleW == 34 && this.cycleH == 19 && !this.complete);
            var loadingOp   = ($.browser.opera && ((this.cycleW == 42 && this.cycleH == 19) || (this.cycleW == 37 && this.cycleH == 17)) && !this.complete);
            var loadingOther = (this.cycleH == 0 && this.cycleW == 0 && !this.complete);
            // don't requeue for images that are still loading but have a valid size
            if (loadingIE || loadingFF || loadingOp || loadingOther) {
                if (o.s && opts.requeueOnImageNotLoaded && ++options.requeueAttempts < 100) { // track retry count so we don't loop forever
                    log(options.requeueAttempts,' - img slide not loaded, requeuing slideshow: ', this.src, this.cycleW, this.cycleH);
                    setTimeout(function() {$(o.s,o.c).cycle(options)}, opts.requeueTimeout);
                    requeue = true;
                    return false; // break each loop
                }
                else {
                    log('could not determine size of image: '+this.src, this.cycleW, this.cycleH);
                }
            }
        }
        return true;
    });

    if (requeue)
        return false;

    opts.cssBefore = opts.cssBefore || {};
    opts.cssAfter = opts.cssAfter || {};
    opts.cssFirst = opts.cssFirst || {};
    opts.animIn = opts.animIn || {};
    opts.animOut = opts.animOut || {};

    $slides.not(':eq('+first+')').css(opts.cssBefore);
    $($slides[first]).css(opts.cssFirst);

    if (opts.timeout) {
        opts.timeout = parseInt(opts.timeout,10);
        // ensure that timeout and speed settings are sane
        if (opts.speed.constructor == String)
            opts.speed = $.fx.speeds[opts.speed] || parseInt(opts.speed,10);
        if (!opts.sync)
            opts.speed = opts.speed / 2;
        
        var buffer = opts.fx == 'none' ? 0 : opts.fx == 'shuffle' ? 500 : 250;
        while((opts.timeout - opts.speed) < buffer) // sanitize timeout
            opts.timeout += opts.speed;
    }
    if (opts.easing)
        opts.easeIn = opts.easeOut = opts.easing;
    if (!opts.speedIn)
        opts.speedIn = opts.speed;
    if (!opts.speedOut)
        opts.speedOut = opts.speed;

    opts.slideCount = els.length;
    opts.currSlide = opts.lastSlide = first;
    if (opts.random) {
        if (++opts.randomIndex == els.length)
            opts.randomIndex = 0;
        opts.nextSlide = opts.randomMap[opts.randomIndex];
    }
    else if (opts.backwards)
        opts.nextSlide = opts.startingSlide == 0 ? (els.length-1) : opts.startingSlide-1;
    else
        opts.nextSlide = opts.startingSlide >= (els.length-1) ? 0 : opts.startingSlide+1;

    // run transition init fn
    if (!opts.multiFx) {
        var init = $.fn.cycle.transitions[opts.fx];
        if ($.isFunction(init))
            init($cont, $slides, opts);
        else if (opts.fx != 'custom' && !opts.multiFx) {
            log('unknown transition: ' + opts.fx,'; slideshow terminating');
            return false;
        }
    }

    // fire artificial events
    var e0 = $slides[first];
    if (!opts.skipInitializationCallbacks) {
        if (opts.before.length)
            opts.before[0].apply(e0, [e0, e0, opts, true]);
        if (opts.after.length)
            opts.after[0].apply(e0, [e0, e0, opts, true]);
    }
    if (opts.next)
        $(opts.next).bind(opts.prevNextEvent,function(){return advance(opts,1)});
    if (opts.prev)
        $(opts.prev).bind(opts.prevNextEvent,function(){return advance(opts,0)});
    if (opts.pager || opts.pagerAnchorBuilder)
        buildPager(els,opts);

    exposeAddSlide(opts, els);

    return opts;
};

// save off original opts so we can restore after clearing state
function saveOriginalOpts(opts) {
    opts.original = { before: [], after: [] };
    opts.original.cssBefore = $.extend({}, opts.cssBefore);
    opts.original.cssAfter  = $.extend({}, opts.cssAfter);
    opts.original.animIn    = $.extend({}, opts.animIn);
    opts.original.animOut   = $.extend({}, opts.animOut);
    $.each(opts.before, function() { opts.original.before.push(this); });
    $.each(opts.after,  function() { opts.original.after.push(this); });
};

function supportMultiTransitions(opts) {
    var i, tx, txs = $.fn.cycle.transitions;
    // look for multiple effects
    if (opts.fx.indexOf(',') > 0) {
        opts.multiFx = true;
        opts.fxs = opts.fx.replace(/\s*/g,'').split(',');
        // discard any bogus effect names
        for (i=0; i < opts.fxs.length; i++) {
            var fx = opts.fxs[i];
            tx = txs[fx];
            if (!tx || !txs.hasOwnProperty(fx) || !$.isFunction(tx)) {
                log('discarding unknown transition: ',fx);
                opts.fxs.splice(i,1);
                i--;
            }
        }
        // if we have an empty list then we threw everything away!
        if (!opts.fxs.length) {
            log('No valid transitions named; slideshow terminating.');
            return false;
        }
    }
    else if (opts.fx == 'all') {  // auto-gen the list of transitions
        opts.multiFx = true;
        opts.fxs = [];
        for (p in txs) {
            tx = txs[p];
            if (txs.hasOwnProperty(p) && $.isFunction(tx))
                opts.fxs.push(p);
        }
    }
    if (opts.multiFx && opts.randomizeEffects) {
        // munge the fxs array to make effect selection random
        var r1 = Math.floor(Math.random() * 20) + 30;
        for (i = 0; i < r1; i++) {
            var r2 = Math.floor(Math.random() * opts.fxs.length);
            opts.fxs.push(opts.fxs.splice(r2,1)[0]);
        }
        debug('randomized fx sequence: ',opts.fxs);
    }
    return true;
};

// provide a mechanism for adding slides after the slideshow has started
function exposeAddSlide(opts, els) {
    opts.addSlide = function(newSlide, prepend) {
        var $s = $(newSlide), s = $s[0];
        if (!opts.autostopCount)
            opts.countdown++;
        els[prepend?'unshift':'push'](s);
        if (opts.els)
            opts.els[prepend?'unshift':'push'](s); // shuffle needs this
        opts.slideCount = els.length;

        // add the slide to the random map and resort
        if (opts.random) {
            opts.randomMap.push(opts.slideCount-1);
            opts.randomMap.sort(function(a,b) {return Math.random() - 0.5;});
        }

        $s.css('position','absolute');
        $s[prepend?'prependTo':'appendTo'](opts.$cont);

        if (prepend) {
            opts.currSlide++;
            opts.nextSlide++;
        }

        if (!$.support.opacity && opts.cleartype && !opts.cleartypeNoBg)
            clearTypeFix($s);

        if (opts.fit && opts.width)
            $s.width(opts.width);
        if (opts.fit && opts.height && opts.height != 'auto')
            $s.height(opts.height);
        s.cycleH = (opts.fit && opts.height) ? opts.height : $s.height();
        s.cycleW = (opts.fit && opts.width) ? opts.width : $s.width();

        $s.css(opts.cssBefore);

        if (opts.pager || opts.pagerAnchorBuilder)
            $.fn.cycle.createPagerAnchor(els.length-1, s, $(opts.pager), els, opts);

        if ($.isFunction(opts.onAddSlide))
            opts.onAddSlide($s);
        else
            $s.hide(); // default behavior
    };
}

// reset internal state; we do this on every pass in order to support multiple effects
$.fn.cycle.resetState = function(opts, fx) {
    fx = fx || opts.fx;
    opts.before = []; opts.after = [];
    opts.cssBefore = $.extend({}, opts.original.cssBefore);
    opts.cssAfter  = $.extend({}, opts.original.cssAfter);
    opts.animIn = $.extend({}, opts.original.animIn);
    opts.animOut   = $.extend({}, opts.original.animOut);
    opts.fxFn = null;
    $.each(opts.original.before, function() { opts.before.push(this); });
    $.each(opts.original.after,  function() { opts.after.push(this); });

    // re-init
    var init = $.fn.cycle.transitions[fx];
    if ($.isFunction(init))
        init(opts.$cont, $(opts.elements), opts);
};

// this is the main engine fn, it handles the timeouts, callbacks and slide index mgmt
function go(els, opts, manual, fwd) {
    // opts.busy is true if we're in the middle of an animation
    if (manual && opts.busy && opts.manualTrump) {
        // let manual transitions requests trump active ones
        debug('manualTrump in go(), stopping active transition');
        $(els).stop(true,true);
        opts.busy = 0;
    }
    // don't begin another timeout-based transition if there is one active
    if (opts.busy) {
        debug('transition active, ignoring new tx request');
        return;
    }

    var p = opts.$cont[0], curr = els[opts.currSlide], next = els[opts.nextSlide];

    // stop cycling if we have an outstanding stop request
    if (p.cycleStop != opts.stopCount || p.cycleTimeout === 0 && !manual)
        return;

    // check to see if we should stop cycling based on autostop options
    if (!manual && !p.cyclePause && !opts.bounce &&
        ((opts.autostop && (--opts.countdown <= 0)) ||
        (opts.nowrap && !opts.random && opts.nextSlide < opts.currSlide))) {
        if (opts.end)
            opts.end(opts);
        return;
    }

    // if slideshow is paused, only transition on a manual trigger
    var changed = false;
    if ((manual || !p.cyclePause) && (opts.nextSlide != opts.currSlide)) {
        changed = true;
        var fx = opts.fx;
        // keep trying to get the slide size if we don't have it yet
        curr.cycleH = curr.cycleH || $(curr).height();
        curr.cycleW = curr.cycleW || $(curr).width();
        next.cycleH = next.cycleH || $(next).height();
        next.cycleW = next.cycleW || $(next).width();

        // support multiple transition types
        if (opts.multiFx) {
            if (fwd && (opts.lastFx == undefined || ++opts.lastFx >= opts.fxs.length))
                opts.lastFx = 0;
            else if (!fwd && (opts.lastFx == undefined || --opts.lastFx < 0))
                opts.lastFx = opts.fxs.length - 1;
            fx = opts.fxs[opts.lastFx];
        }

        // one-time fx overrides apply to:  $('div').cycle(3,'zoom');
        if (opts.oneTimeFx) {
            fx = opts.oneTimeFx;
            opts.oneTimeFx = null;
        }

        $.fn.cycle.resetState(opts, fx);

        // run the before callbacks
        if (opts.before.length)
            $.each(opts.before, function(i,o) {
                if (p.cycleStop != opts.stopCount) return;
                o.apply(next, [curr, next, opts, fwd]);
            });

        // stage the after callacks
        var after = function() {
            opts.busy = 0;
            $.each(opts.after, function(i,o) {
                if (p.cycleStop != opts.stopCount) return;
                o.apply(next, [curr, next, opts, fwd]);
            });
            if (!p.cycleStop) {
                // queue next transition
                queueNext();
            }
        };

        debug('tx firing('+fx+'); currSlide: ' + opts.currSlide + '; nextSlide: ' + opts.nextSlide);
        
        // get ready to perform the transition
        opts.busy = 1;
        if (opts.fxFn) // fx function provided?
            opts.fxFn(curr, next, opts, after, fwd, manual && opts.fastOnEvent);
        else if ($.isFunction($.fn.cycle[opts.fx])) // fx plugin ?
            $.fn.cycle[opts.fx](curr, next, opts, after, fwd, manual && opts.fastOnEvent);
        else
            $.fn.cycle.custom(curr, next, opts, after, fwd, manual && opts.fastOnEvent);
    }
    else {
        queueNext();
    }

    if (changed || opts.nextSlide == opts.currSlide) {
        // calculate the next slide
        opts.lastSlide = opts.currSlide;
        if (opts.random) {
            opts.currSlide = opts.nextSlide;
            if (++opts.randomIndex == els.length) {
                opts.randomIndex = 0;
                opts.randomMap.sort(function(a,b) {return Math.random() - 0.5;});
            }
            opts.nextSlide = opts.randomMap[opts.randomIndex];
            if (opts.nextSlide == opts.currSlide)
                opts.nextSlide = (opts.currSlide == opts.slideCount - 1) ? 0 : opts.currSlide + 1;
        }
        else if (opts.backwards) {
            var roll = (opts.nextSlide - 1) < 0;
            if (roll && opts.bounce) {
                opts.backwards = !opts.backwards;
                opts.nextSlide = 1;
                opts.currSlide = 0;
            }
            else {
                opts.nextSlide = roll ? (els.length-1) : opts.nextSlide-1;
                opts.currSlide = roll ? 0 : opts.nextSlide+1;
            }
        }
        else { // sequence
            var roll = (opts.nextSlide + 1) == els.length;
            if (roll && opts.bounce) {
                opts.backwards = !opts.backwards;
                opts.nextSlide = els.length-2;
                opts.currSlide = els.length-1;
            }
            else {
                opts.nextSlide = roll ? 0 : opts.nextSlide+1;
                opts.currSlide = roll ? els.length-1 : opts.nextSlide-1;
            }
        }
    }
    if (changed && opts.pager)
        opts.updateActivePagerLink(opts.pager, opts.currSlide, opts.activePagerClass);
    
    function queueNext() {
        // stage the next transition
        var ms = 0, timeout = opts.timeout;
        if (opts.timeout && !opts.continuous) {
            ms = getTimeout(els[opts.currSlide], els[opts.nextSlide], opts, fwd);
         if (opts.fx == 'shuffle')
            ms -= opts.speedOut;
      }
        else if (opts.continuous && p.cyclePause) // continuous shows work off an after callback, not this timer logic
            ms = 10;
        if (ms > 0)
            p.cycleTimeout = setTimeout(function(){ go(els, opts, 0, !opts.backwards) }, ms);
    }
};

// invoked after transition
$.fn.cycle.updateActivePagerLink = function(pager, currSlide, clsName) {
   $(pager).each(function() {
       $(this).children().removeClass(clsName).eq(currSlide).addClass(clsName);
   });
};

// calculate timeout value for current transition
function getTimeout(curr, next, opts, fwd) {
    if (opts.timeoutFn) {
        // call user provided calc fn
        var t = opts.timeoutFn.call(curr,curr,next,opts,fwd);
        while (opts.fx != 'none' && (t - opts.speed) < 250) // sanitize timeout
            t += opts.speed;
        debug('calculated timeout: ' + t + '; speed: ' + opts.speed);
        if (t !== false)
            return t;
    }
    return opts.timeout;
};

// expose next/prev function, caller must pass in state
$.fn.cycle.next = function(opts) { advance(opts,1); };
$.fn.cycle.prev = function(opts) { advance(opts,0);};

// advance slide forward or back
function advance(opts, moveForward) {
    var val = moveForward ? 1 : -1;
    var els = opts.elements;
    var p = opts.$cont[0], timeout = p.cycleTimeout;
    if (timeout) {
        clearTimeout(timeout);
        p.cycleTimeout = 0;
    }
    if (opts.random && val < 0) {
        // move back to the previously display slide
        opts.randomIndex--;
        if (--opts.randomIndex == -2)
            opts.randomIndex = els.length-2;
        else if (opts.randomIndex == -1)
            opts.randomIndex = els.length-1;
        opts.nextSlide = opts.randomMap[opts.randomIndex];
    }
    else if (opts.random) {
        opts.nextSlide = opts.randomMap[opts.randomIndex];
    }
    else {
        opts.nextSlide = opts.currSlide + val;
        if (opts.nextSlide < 0) {
            if (opts.nowrap) return false;
            opts.nextSlide = els.length - 1;
        }
        else if (opts.nextSlide >= els.length) {
            if (opts.nowrap) return false;
            opts.nextSlide = 0;
        }
    }

    var cb = opts.onPrevNextEvent || opts.prevNextClick; // prevNextClick is deprecated
    if ($.isFunction(cb))
        cb(val > 0, opts.nextSlide, els[opts.nextSlide]);
    go(els, opts, 1, moveForward);
    return false;
};

function buildPager(els, opts) {
    var $p = $(opts.pager);
    $.each(els, function(i,o) {
        $.fn.cycle.createPagerAnchor(i,o,$p,els,opts);
    });
    opts.updateActivePagerLink(opts.pager, opts.startingSlide, opts.activePagerClass);
};

$.fn.cycle.createPagerAnchor = function(i, el, $p, els, opts) {
    var a;
    if ($.isFunction(opts.pagerAnchorBuilder)) {
        a = opts.pagerAnchorBuilder(i,el);
        debug('pagerAnchorBuilder('+i+', el) returned: ' + a);
    }
    else
        a = '<a href="#">'+(i+1)+'</a>';
        
    if (!a)
        return;
    var $a = $(a);
    // don't reparent if anchor is in the dom
    if ($a.parents('body').length === 0) {
        var arr = [];
        if ($p.length > 1) {
            $p.each(function() {
                var $clone = $a.clone(true);
                $(this).append($clone);
                arr.push($clone[0]);
            });
            $a = $(arr);
        }
        else {
            $a.appendTo($p);
        }
    }

    opts.pagerAnchors =  opts.pagerAnchors || [];
    opts.pagerAnchors.push($a);
    
    var pagerFn = function(e) {
        e.preventDefault();
        opts.nextSlide = i;
        var p = opts.$cont[0], timeout = p.cycleTimeout;
        if (timeout) {
            clearTimeout(timeout);
            p.cycleTimeout = 0;
        }
        var cb = opts.onPagerEvent || opts.pagerClick; // pagerClick is deprecated
        if ($.isFunction(cb))
            cb(opts.nextSlide, els[opts.nextSlide]);
        go(els,opts,1,opts.currSlide < i); // trigger the trans
//      return false; // <== allow bubble
    }
    
    if ( /mouseenter|mouseover/i.test(opts.pagerEvent) ) {
        $a.hover(pagerFn, function(){/* no-op */} );
    }
    else {
        $a.bind(opts.pagerEvent, pagerFn);
    }
    
    if ( ! /^click/.test(opts.pagerEvent) && !opts.allowPagerClickBubble)
        $a.bind('click.cycle', function(){return false;}); // suppress click
    
    var cont = opts.$cont[0];
    var pauseFlag = false; // https://github.com/malsup/cycle/issues/44
    if (opts.pauseOnPagerHover) {
        $a.hover(
            function() { 
                pauseFlag = true;
                cont.cyclePause++; 
                triggerPause(cont,true,true);
            }, function() { 
                pauseFlag && cont.cyclePause--; 
                triggerPause(cont,true,true);
            } 
        );
    }
};

// helper fn to calculate the number of slides between the current and the next
$.fn.cycle.hopsFromLast = function(opts, fwd) {
    var hops, l = opts.lastSlide, c = opts.currSlide;
    if (fwd)
        hops = c > l ? c - l : opts.slideCount - l;
    else
        hops = c < l ? l - c : l + opts.slideCount - c;
    return hops;
};

// fix clearType problems in ie6 by setting an explicit bg color
// (otherwise text slides look horrible during a fade transition)
function clearTypeFix($slides) {
    debug('applying clearType background-color hack');
    function hex(s) {
        s = parseInt(s,10).toString(16);
        return s.length < 2 ? '0'+s : s;
    };
    function getBg(e) {
        for ( ; e && e.nodeName.toLowerCase() != 'html'; e = e.parentNode) {
            var v = $.css(e,'background-color');
            if (v && v.indexOf('rgb') >= 0 ) {
                var rgb = v.match(/\d+/g);
                return '#'+ hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
            }
            if (v && v != 'transparent')
                return v;
        }
        return '#ffffff';
    };
    $slides.each(function() { $(this).css('background-color', getBg(this)); });
};

// reset common props before the next transition
$.fn.cycle.commonReset = function(curr,next,opts,w,h,rev) {
    $(opts.elements).not(curr).hide();
    if (typeof opts.cssBefore.opacity == 'undefined')
        opts.cssBefore.opacity = 1;
    opts.cssBefore.display = 'block';
    if (opts.slideResize && w !== false && next.cycleW > 0)
        opts.cssBefore.width = next.cycleW;
    if (opts.slideResize && h !== false && next.cycleH > 0)
        opts.cssBefore.height = next.cycleH;
    opts.cssAfter = opts.cssAfter || {};
    opts.cssAfter.display = 'none';
    $(curr).css('zIndex',opts.slideCount + (rev === true ? 1 : 0));
    $(next).css('zIndex',opts.slideCount + (rev === true ? 0 : 1));
};

// the actual fn for effecting a transition
$.fn.cycle.custom = function(curr, next, opts, cb, fwd, speedOverride) {
    var $l = $(curr), $n = $(next);
    var speedIn = opts.speedIn, speedOut = opts.speedOut, easeIn = opts.easeIn, easeOut = opts.easeOut;
    $n.css(opts.cssBefore);
    if (speedOverride) {
        if (typeof speedOverride == 'number')
            speedIn = speedOut = speedOverride;
        else
            speedIn = speedOut = 1;
        easeIn = easeOut = null;
    }
    var fn = function() {
        $n.animate(opts.animIn, speedIn, easeIn, function() {
            cb();
        });
    };
    $l.animate(opts.animOut, speedOut, easeOut, function() {
        $l.css(opts.cssAfter);
        if (!opts.sync) 
            fn();
    });
    if (opts.sync) fn();
};

// transition definitions - only fade is defined here, transition pack defines the rest
$.fn.cycle.transitions = {
    fade: function($cont, $slides, opts) {
        $slides.not(':eq('+opts.currSlide+')').css('opacity',0);
        opts.before.push(function(curr,next,opts) {
            $.fn.cycle.commonReset(curr,next,opts);
            opts.cssBefore.opacity = 0;
        });
        opts.animIn    = { opacity: 1 };
        opts.animOut   = { opacity: 0 };
        opts.cssBefore = { top: 0, left: 0 };
    }
};

$.fn.cycle.ver = function() { return ver; };

// override these globally if you like (they are all optional)
$.fn.cycle.defaults = {
    activePagerClass: 'activeSlide', // class name used for the active pager link
    after:         null,  // transition callback (scope set to element that was shown):  function(currSlideElement, nextSlideElement, options, forwardFlag)
    allowPagerClickBubble: false, // allows or prevents click event on pager anchors from bubbling
    animIn:        null,  // properties that define how the slide animates in
    animOut:       null,  // properties that define how the slide animates out
    aspect:        false,  // preserve aspect ratio during fit resizing, cropping if necessary (must be used with fit option)
    autostop:      0,     // true to end slideshow after X transitions (where X == slide count)
    autostopCount: 0,     // number of transitions (optionally used with autostop to define X)
    backwards:     false, // true to start slideshow at last slide and move backwards through the stack
    before:        null,  // transition callback (scope set to element to be shown):     function(currSlideElement, nextSlideElement, options, forwardFlag)
    center:        null,  // set to true to have cycle add top/left margin to each slide (use with width and height options)
    cleartype:     !$.support.opacity,  // true if clearType corrections should be applied (for IE)
    cleartypeNoBg: false, // set to true to disable extra cleartype fixing (leave false to force background color setting on slides)
    containerResize: 1,   // resize container to fit largest slide
    continuous:    0,     // true to start next transition immediately after current one completes
    cssAfter:      null,  // properties that defined the state of the slide after transitioning out
    cssBefore:     null,  // properties that define the initial state of the slide before transitioning in
    delay:         0,     // additional delay (in ms) for first transition (hint: can be negative)
    easeIn:        null,  // easing for "in" transition
    easeOut:       null,  // easing for "out" transition
    easing:        null,  // easing method for both in and out transitions
    end:           null,  // callback invoked when the slideshow terminates (use with autostop or nowrap options): function(options)
    fastOnEvent:   0,     // force fast transitions when triggered manually (via pager or prev/next); value == time in ms
    fit:           0,     // force slides to fit container
    fx:           'fade', // name of transition effect (or comma separated names, ex: 'fade,scrollUp,shuffle')
    fxFn:          null,  // function used to control the transition: function(currSlideElement, nextSlideElement, options, afterCalback, forwardFlag)
    height:       'auto', // container height (if the 'fit' option is true, the slides will be set to this height as well)
    manualTrump:   true,  // causes manual transition to stop an active transition instead of being ignored
    metaAttr:     'cycle',// data- attribute that holds the option data for the slideshow
    next:          null,  // element, jQuery object, or jQuery selector string for the element to use as event trigger for next slide
    nowrap:        0,     // true to prevent slideshow from wrapping
    onPagerEvent:  null,  // callback fn for pager events: function(zeroBasedSlideIndex, slideElement)
    onPrevNextEvent: null,// callback fn for prev/next events: function(isNext, zeroBasedSlideIndex, slideElement)
    pager:         null,  // element, jQuery object, or jQuery selector string for the element to use as pager container
    pagerAnchorBuilder: null, // callback fn for building anchor links:  function(index, DOMelement)
    pagerEvent:   'click.cycle', // name of event which drives the pager navigation
    pause:         0,     // true to enable "pause on hover"
    pauseOnPagerHover: 0, // true to pause when hovering over pager link
    prev:          null,  // element, jQuery object, or jQuery selector string for the element to use as event trigger for previous slide
    prevNextEvent:'click.cycle',// event which drives the manual transition to the previous or next slide
    random:        0,     // true for random, false for sequence (not applicable to shuffle fx)
    randomizeEffects: 1,  // valid when multiple effects are used; true to make the effect sequence random
    requeueOnImageNotLoaded: true, // requeue the slideshow if any image slides are not yet loaded
    requeueTimeout: 250,  // ms delay for requeue
    rev:           0,     // causes animations to transition in reverse (for effects that support it such as scrollHorz/scrollVert/shuffle)
    shuffle:       null,  // coords for shuffle animation, ex: { top:15, left: 200 }
    skipInitializationCallbacks: false, // set to true to disable the first before/after callback that occurs prior to any transition
    slideExpr:     null,  // expression for selecting slides (if something other than all children is required)
    slideResize:   1,     // force slide width/height to fixed size before every transition
    speed:         1000,  // speed of the transition (any valid fx speed value)
    speedIn:       null,  // speed of the 'in' transition
    speedOut:      null,  // speed of the 'out' transition
    startingSlide: 0,     // zero-based index of the first slide to be displayed
    sync:          1,     // true if in/out transitions should occur simultaneously
    timeout:       4000,  // milliseconds between slide transitions (0 to disable auto advance)
    timeoutFn:     null,  // callback for determining per-slide timeout value:  function(currSlideElement, nextSlideElement, options, forwardFlag)
    updateActivePagerLink: null, // callback fn invoked to update the active pager link (adds/removes activePagerClass style)
    width:         null   // container width (if the 'fit' option is true, the slides will be set to this width as well)
};

})(jQuery);


/*!
 * jQuery Cycle Plugin Transition Definitions
 * This script is a plugin for the jQuery Cycle Plugin
 * Examples and documentation at: http://malsup.com/jquery/cycle/
 * Copyright (c) 2007-2010 M. Alsup
 * Version:  2.73
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 */
(function($) {

//
// These functions define slide initialization and properties for the named
// transitions. To save file size feel free to remove any of these that you
// don't need.
//
$.fn.cycle.transitions.none = function($cont, $slides, opts) {
    opts.fxFn = function(curr,next,opts,after){
        $(next).show();
        $(curr).hide();
        after();
    };
};

// not a cross-fade, fadeout only fades out the top slide
$.fn.cycle.transitions.fadeout = function($cont, $slides, opts) {
    $slides.not(':eq('+opts.currSlide+')').css({ display: 'block', 'opacity': 1 });
    opts.before.push(function(curr,next,opts,w,h,rev) {
        $(curr).css('zIndex',opts.slideCount + (!rev === true ? 1 : 0));
        $(next).css('zIndex',opts.slideCount + (!rev === true ? 0 : 1));
    });
    opts.animIn.opacity = 1;
    opts.animOut.opacity = 0;
    opts.cssBefore.opacity = 1;
    opts.cssBefore.display = 'block';
    opts.cssAfter.zIndex = 0;
};

// scrollUp/Down/Left/Right
$.fn.cycle.transitions.scrollUp = function($cont, $slides, opts) {
    $cont.css('overflow','hidden');
    opts.before.push($.fn.cycle.commonReset);
    var h = $cont.height();
    opts.cssBefore.top = h;
    opts.cssBefore.left = 0;
    opts.cssFirst.top = 0;
    opts.animIn.top = 0;
    opts.animOut.top = -h;
};
$.fn.cycle.transitions.scrollDown = function($cont, $slides, opts) {
    $cont.css('overflow','hidden');
    opts.before.push($.fn.cycle.commonReset);
    var h = $cont.height();
    opts.cssFirst.top = 0;
    opts.cssBefore.top = -h;
    opts.cssBefore.left = 0;
    opts.animIn.top = 0;
    opts.animOut.top = h;
};
$.fn.cycle.transitions.scrollLeft = function($cont, $slides, opts) {
    $cont.css('overflow','hidden');
    opts.before.push($.fn.cycle.commonReset);
    var w = $cont.width();
    opts.cssFirst.left = 0;
    opts.cssBefore.left = w;
    opts.cssBefore.top = 0;
    opts.animIn.left = 0;
    opts.animOut.left = 0-w;
};
$.fn.cycle.transitions.scrollRight = function($cont, $slides, opts) {
    $cont.css('overflow','hidden');
    opts.before.push($.fn.cycle.commonReset);
    var w = $cont.width();
    opts.cssFirst.left = 0;
    opts.cssBefore.left = -w;
    opts.cssBefore.top = 0;
    opts.animIn.left = 0;
    opts.animOut.left = w;
};
$.fn.cycle.transitions.scrollHorz = function($cont, $slides, opts) {
    $cont.css('overflow','hidden').width();
    opts.before.push(function(curr, next, opts, fwd) {
        if (opts.rev)
            fwd = !fwd;
        $.fn.cycle.commonReset(curr,next,opts);
        opts.cssBefore.left = fwd ? (next.cycleW-1) : (1-next.cycleW);
        opts.animOut.left = fwd ? -curr.cycleW : curr.cycleW;
    });
    opts.cssFirst.left = 0;
    opts.cssBefore.top = 0;
    opts.animIn.left = 0;
    opts.animOut.top = 0;
};
$.fn.cycle.transitions.scrollVert = function($cont, $slides, opts) {
    $cont.css('overflow','hidden');
    opts.before.push(function(curr, next, opts, fwd) {
        if (opts.rev)
            fwd = !fwd;
        $.fn.cycle.commonReset(curr,next,opts);
        opts.cssBefore.top = fwd ? (1-next.cycleH) : (next.cycleH-1);
        opts.animOut.top = fwd ? curr.cycleH : -curr.cycleH;
    });
    opts.cssFirst.top = 0;
    opts.cssBefore.left = 0;
    opts.animIn.top = 0;
    opts.animOut.left = 0;
};

// slideX/slideY
$.fn.cycle.transitions.slideX = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $(opts.elements).not(curr).hide();
        $.fn.cycle.commonReset(curr,next,opts,false,true);
        opts.animIn.width = next.cycleW;
    });
    opts.cssBefore.left = 0;
    opts.cssBefore.top = 0;
    opts.cssBefore.width = 0;
    opts.animIn.width = 'show';
    opts.animOut.width = 0;
};
$.fn.cycle.transitions.slideY = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $(opts.elements).not(curr).hide();
        $.fn.cycle.commonReset(curr,next,opts,true,false);
        opts.animIn.height = next.cycleH;
    });
    opts.cssBefore.left = 0;
    opts.cssBefore.top = 0;
    opts.cssBefore.height = 0;
    opts.animIn.height = 'show';
    opts.animOut.height = 0;
};

// shuffle
$.fn.cycle.transitions.shuffle = function($cont, $slides, opts) {
    var i, w = $cont.css('overflow', 'visible').width();
    $slides.css({left: 0, top: 0});
    opts.before.push(function(curr,next,opts) {
        $.fn.cycle.commonReset(curr,next,opts,true,true,true);
    });
    // only adjust speed once!
    if (!opts.speedAdjusted) {
        opts.speed = opts.speed / 2; // shuffle has 2 transitions
        opts.speedAdjusted = true;
    }
    opts.random = 0;
    opts.shuffle = opts.shuffle || {left:-w, top:15};
    opts.els = [];
    for (i=0; i < $slides.length; i++)
        opts.els.push($slides[i]);

    for (i=0; i < opts.currSlide; i++)
        opts.els.push(opts.els.shift());

    // custom transition fn (hat tip to Benjamin Sterling for this bit of sweetness!)
    opts.fxFn = function(curr, next, opts, cb, fwd) {
        if (opts.rev)
            fwd = !fwd;
        var $el = fwd ? $(curr) : $(next);
        $(next).css(opts.cssBefore);
        var count = opts.slideCount;
        $el.animate(opts.shuffle, opts.speedIn, opts.easeIn, function() {
            var hops = $.fn.cycle.hopsFromLast(opts, fwd);
            for (var k=0; k < hops; k++)
                fwd ? opts.els.push(opts.els.shift()) : opts.els.unshift(opts.els.pop());
            if (fwd) {
                for (var i=0, len=opts.els.length; i < len; i++)
                    $(opts.els[i]).css('z-index', len-i+count);
            }
            else {
                var z = $(curr).css('z-index');
                $el.css('z-index', parseInt(z,10)+1+count);
            }
            $el.animate({left:0, top:0}, opts.speedOut, opts.easeOut, function() {
                $(fwd ? this : curr).hide();
                if (cb) cb();
            });
        });
    };
    $.extend(opts.cssBefore, { display: 'block', opacity: 1, top: 0, left: 0 });
};

// turnUp/Down/Left/Right
$.fn.cycle.transitions.turnUp = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,true,false);
        opts.cssBefore.top = next.cycleH;
        opts.animIn.height = next.cycleH;
        opts.animOut.width = next.cycleW;
    });
    opts.cssFirst.top = 0;
    opts.cssBefore.left = 0;
    opts.cssBefore.height = 0;
    opts.animIn.top = 0;
    opts.animOut.height = 0;
};
$.fn.cycle.transitions.turnDown = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,true,false);
        opts.animIn.height = next.cycleH;
        opts.animOut.top   = curr.cycleH;
    });
    opts.cssFirst.top = 0;
    opts.cssBefore.left = 0;
    opts.cssBefore.top = 0;
    opts.cssBefore.height = 0;
    opts.animOut.height = 0;
};
$.fn.cycle.transitions.turnLeft = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,false,true);
        opts.cssBefore.left = next.cycleW;
        opts.animIn.width = next.cycleW;
    });
    opts.cssBefore.top = 0;
    opts.cssBefore.width = 0;
    opts.animIn.left = 0;
    opts.animOut.width = 0;
};
$.fn.cycle.transitions.turnRight = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,false,true);
        opts.animIn.width = next.cycleW;
        opts.animOut.left = curr.cycleW;
    });
    $.extend(opts.cssBefore, { top: 0, left: 0, width: 0 });
    opts.animIn.left = 0;
    opts.animOut.width = 0;
};

// zoom
$.fn.cycle.transitions.zoom = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,false,false,true);
        opts.cssBefore.top = next.cycleH/2;
        opts.cssBefore.left = next.cycleW/2;
        $.extend(opts.animIn, { top: 0, left: 0, width: next.cycleW, height: next.cycleH });
        $.extend(opts.animOut, { width: 0, height: 0, top: curr.cycleH/2, left: curr.cycleW/2 });
    });
    opts.cssFirst.top = 0;
    opts.cssFirst.left = 0;
    opts.cssBefore.width = 0;
    opts.cssBefore.height = 0;
};

// fadeZoom
$.fn.cycle.transitions.fadeZoom = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,false,false);
        opts.cssBefore.left = next.cycleW/2;
        opts.cssBefore.top = next.cycleH/2;
        $.extend(opts.animIn, { top: 0, left: 0, width: next.cycleW, height: next.cycleH });
    });
    opts.cssBefore.width = 0;
    opts.cssBefore.height = 0;
    opts.animOut.opacity = 0;
};

// blindX
$.fn.cycle.transitions.blindX = function($cont, $slides, opts) {
    var w = $cont.css('overflow','hidden').width();
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts);
        opts.animIn.width = next.cycleW;
        opts.animOut.left   = curr.cycleW;
    });
    opts.cssBefore.left = w;
    opts.cssBefore.top = 0;
    opts.animIn.left = 0;
    opts.animOut.left = w;
};
// blindY
$.fn.cycle.transitions.blindY = function($cont, $slides, opts) {
    var h = $cont.css('overflow','hidden').height();
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts);
        opts.animIn.height = next.cycleH;
        opts.animOut.top   = curr.cycleH;
    });
    opts.cssBefore.top = h;
    opts.cssBefore.left = 0;
    opts.animIn.top = 0;
    opts.animOut.top = h;
};
// blindZ
$.fn.cycle.transitions.blindZ = function($cont, $slides, opts) {
    var h = $cont.css('overflow','hidden').height();
    var w = $cont.width();
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts);
        opts.animIn.height = next.cycleH;
        opts.animOut.top   = curr.cycleH;
    });
    opts.cssBefore.top = h;
    opts.cssBefore.left = w;
    opts.animIn.top = 0;
    opts.animIn.left = 0;
    opts.animOut.top = h;
    opts.animOut.left = w;
};

// growX - grow horizontally from centered 0 width
$.fn.cycle.transitions.growX = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,false,true);
        opts.cssBefore.left = this.cycleW/2;
        opts.animIn.left = 0;
        opts.animIn.width = this.cycleW;
        opts.animOut.left = 0;
    });
    opts.cssBefore.top = 0;
    opts.cssBefore.width = 0;
};
// growY - grow vertically from centered 0 height
$.fn.cycle.transitions.growY = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,true,false);
        opts.cssBefore.top = this.cycleH/2;
        opts.animIn.top = 0;
        opts.animIn.height = this.cycleH;
        opts.animOut.top = 0;
    });
    opts.cssBefore.height = 0;
    opts.cssBefore.left = 0;
};

// curtainX - squeeze in both edges horizontally
$.fn.cycle.transitions.curtainX = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,false,true,true);
        opts.cssBefore.left = next.cycleW/2;
        opts.animIn.left = 0;
        opts.animIn.width = this.cycleW;
        opts.animOut.left = curr.cycleW/2;
        opts.animOut.width = 0;
    });
    opts.cssBefore.top = 0;
    opts.cssBefore.width = 0;
};
// curtainY - squeeze in both edges vertically
$.fn.cycle.transitions.curtainY = function($cont, $slides, opts) {
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,true,false,true);
        opts.cssBefore.top = next.cycleH/2;
        opts.animIn.top = 0;
        opts.animIn.height = next.cycleH;
        opts.animOut.top = curr.cycleH/2;
        opts.animOut.height = 0;
    });
    opts.cssBefore.height = 0;
    opts.cssBefore.left = 0;
};

// cover - curr slide covered by next slide
$.fn.cycle.transitions.cover = function($cont, $slides, opts) {
    var d = opts.direction || 'left';
    var w = $cont.css('overflow','hidden').width();
    var h = $cont.height();
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts);
        if (d == 'right')
            opts.cssBefore.left = -w;
        else if (d == 'up')
            opts.cssBefore.top = h;
        else if (d == 'down')
            opts.cssBefore.top = -h;
        else
            opts.cssBefore.left = w;
    });
    opts.animIn.left = 0;
    opts.animIn.top = 0;
    opts.cssBefore.top = 0;
    opts.cssBefore.left = 0;
};

// uncover - curr slide moves off next slide
$.fn.cycle.transitions.uncover = function($cont, $slides, opts) {
    var d = opts.direction || 'left';
    var w = $cont.css('overflow','hidden').width();
    var h = $cont.height();
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,true,true,true);
        if (d == 'right')
            opts.animOut.left = w;
        else if (d == 'up')
            opts.animOut.top = -h;
        else if (d == 'down')
            opts.animOut.top = h;
        else
            opts.animOut.left = -w;
    });
    opts.animIn.left = 0;
    opts.animIn.top = 0;
    opts.cssBefore.top = 0;
    opts.cssBefore.left = 0;
};

// toss - move top slide and fade away
$.fn.cycle.transitions.toss = function($cont, $slides, opts) {
    var w = $cont.css('overflow','visible').width();
    var h = $cont.height();
    opts.before.push(function(curr, next, opts) {
        $.fn.cycle.commonReset(curr,next,opts,true,true,true);
        // provide default toss settings if animOut not provided
        if (!opts.animOut.left && !opts.animOut.top)
            $.extend(opts.animOut, { left: w*2, top: -h/2, opacity: 0 });
        else
            opts.animOut.opacity = 0;
    });
    opts.cssBefore.left = 0;
    opts.cssBefore.top = 0;
    opts.animIn.left = 0;
};

// wipe - clip animation
$.fn.cycle.transitions.wipe = function($cont, $slides, opts) {
    var w = $cont.css('overflow','hidden').width();
    var h = $cont.height();
    opts.cssBefore = opts.cssBefore || {};
    var clip;
    if (opts.clip) {
        if (/l2r/.test(opts.clip))
            clip = 'rect(0px 0px '+h+'px 0px)';
        else if (/r2l/.test(opts.clip))
            clip = 'rect(0px '+w+'px '+h+'px '+w+'px)';
        else if (/t2b/.test(opts.clip))
            clip = 'rect(0px '+w+'px 0px 0px)';
        else if (/b2t/.test(opts.clip))
            clip = 'rect('+h+'px '+w+'px '+h+'px 0px)';
        else if (/zoom/.test(opts.clip)) {
            var top = parseInt(h/2,10);
            var left = parseInt(w/2,10);
            clip = 'rect('+top+'px '+left+'px '+top+'px '+left+'px)';
        }
    }

    opts.cssBefore.clip = opts.cssBefore.clip || clip || 'rect(0px 0px 0px 0px)';

    var d = opts.cssBefore.clip.match(/(\d+)/g);
    var t = parseInt(d[0],10), r = parseInt(d[1],10), b = parseInt(d[2],10), l = parseInt(d[3],10);

    opts.before.push(function(curr, next, opts) {
        if (curr == next) return;
        var $curr = $(curr), $next = $(next);
        $.fn.cycle.commonReset(curr,next,opts,true,true,false);
        opts.cssAfter.display = 'block';

        var step = 1, count = parseInt((opts.speedIn / 13),10) - 1;
        (function f() {
            var tt = t ? t - parseInt(step * (t/count),10) : 0;
            var ll = l ? l - parseInt(step * (l/count),10) : 0;
            var bb = b < h ? b + parseInt(step * ((h-b)/count || 1),10) : h;
            var rr = r < w ? r + parseInt(step * ((w-r)/count || 1),10) : w;
            $next.css({ clip: 'rect('+tt+'px '+rr+'px '+bb+'px '+ll+'px)' });
            (step++ <= count) ? setTimeout(f, 13) : $curr.css('display', 'none');
        })();
    });
    $.extend(opts.cssBefore, { display: 'block', opacity: 1, top: 0, left: 0 });
    opts.animIn    = { left: 0 };
    opts.animOut   = { left: 0 };
};

})(jQuery);
//

/*  --------------------------------------------------------------------
    MaxImage 2.0 (Fullscreen Slideshow for use with jQuery Cycle Plugin)
    --------------------------------------------------------------------
    
    Examples and documentation at: http://www.aaronvanderzwan.com/maximage/2.0/
    Copyright (c) 2007-2012 Aaron Vanderzwan
    Dual licensed under the MIT and GPL licenses.
    
    NOTES:
    This plugin is intended to simplify the creation of fullscreen 
    background slideshows.  It is intended to be used alongside the 
    jQuery Cycle plugin: 
    http://jquery.malsup.com/cycle/
    
    If you simply need a fullscreen background image, please
    refer to the following document for ways to do this that
    are much more simple:
    http://css-tricks.com/perfect-full-page-background-image/
    
    If you have any questions please contact Aaron Vanderzwan
    at http://www.aaronvanderzwan.com/blog/
    Documentation at:
    http://blog.aaronvanderzwan.com/2012/07/maximage-2-0/
    
    HISTORY:
    MaxImage 2.0 is a project first built as jQuery MaxImage Plugin 
    (http://www.aaronvanderzwan.com/maximage/). Once CSS3 came along, 
    the background-size:cover solved the problem MaxImage
    was intended to solve.  However, fully customizable
    fullscreen slideshows is still fairly complex and I have not
    found any helpers for integrating with the jQuery Cycle Plugin.
    MaxCycle is intended to solve this problem.
    
    TABLE OF CONTENTS:
    @Modern
        @setup
        @resize
        @preload
    @Old
        @setup
        @preload
        @onceloaded
        @maximage
        @windowresize
        @doneresizing
    @Cycle
        @setup
    @Adjust
        @center
        @fill
        @maxcover
        @maxcontain
    @Utils
        @browser_tests
        @construct_slide_object
        @sizes
    @modern_browser
    @debug
        
*/
/*! 
 * Maximage Version: 2.0.8 (16-Jan-2012) - http://www.aaronvanderzwan.com/maximage/2.0/
 */



(function ($) {
    "use strict";
    $.fn.maximage = function (settings, helperSettings) {

        var config;

        if (typeof settings == 'object' || settings === undefined) config = $.extend( $.fn.maximage.defaults, settings || {} );
        if (typeof settings == 'string') config = $.fn.maximage.defaults;
        
        /*jslint browser: true*/
        $.Body = $('body');
        $.Window = $(window);
        $.Scroll = $('html, body');
        $.Events = {
            RESIZE: 'resize'
        };
        
        this.each(function() {
            var $self = $(this),
                preload_count = 0,
                imageCache = [];
            
            /* --------------------- */
            
            // @Modern
            
            /* 
            MODERN BROWSER NOTES:
                Modern browsers have CSS3 background-size option so we setup the DOM to be the following structure for cycle plugin:
                div = cycle
                    div = slide with background-size:cover
                    div = slide with background-size:cover
                    etc.
            */
            
            var Modern = {
                setup: function(){
                    if($.Slides.length > 0){
                        // Setup images
                        for(var i in $.Slides) {
                            // Set our image
                            var $img = $.Slides[i];

                            if(typeof $img.style == 'undefined'){
                                $img.style = '';
                            }
                            
                            // Create a div with a background image so we can use CSS3's position cover (for modern browsers)
                            $self.append('<div class="mc-image ' + $img.theclass + '" title="' + $img.alt + '" style="background-image:url(\'' + $img.url + '\');' + $img.style + '" data-href="'+ $img.datahref +'">'+ $img.content +'</div>');
                            // $self.append('<div class="mc-image ' + $img.theclass + '" title="' + $img.alt + '" style="background-image:url(\'' + $img.url + '\');' + $img.style + '" data-href="'+ $img.datahref +'">'+ $img.content +'</div>');
                        }
                        
                        // Begin our preload process (increments itself after load)
                        Modern.preload(0);
                        
                        // If using Cycle, this resets the height and width of each div to always fill the window; otherwise can be done with CSS
                        Modern.resize();
                    }
                },
                preload: function(n){
                    // Preload all of the images but never show them, just use their completion so we know that they are done
                    //      and so that the browser can cache them / fade them in smoothly
                    
                    // Create new image object
                    var $img = $('<img/>');
                    $img.load(function() {
                        // Once the first image has completed loading, start the slideshow, etc.
                        if(preload_count==0) {
                            // Only start cycle after first image has loaded
                            Cycle.setup();
                            
                            // Run user defined onFirstImageLoaded() function
                            config.onFirstImageLoaded();
                        }
                        
                        // preload_count starts with 0, $.Slides.length starts with 1
                        if(preload_count==($.Slides.length-1)) {
                            // If we have just loaded the final image, run the user defined function onImagesLoaded()
                            config.onImagesLoaded( $self );
                        }else{ 
                            // Increment the counter
                            preload_count++;
                            
                            // Load the next image
                            Modern.preload(preload_count);
                        }
                    });
                    
                    // Set the src... this triggers begin of load
                    $img[0].src = $.Slides[n].url;
                    
                    // Push to external array to avoid cleanup by aggressive garbage collectors
                    imageCache.push($img[0]);
                },
                resize: function(){
                    // Cycle sets the height of each slide so when we resize our browser window this becomes a problem.
                    //  - the cycle option 'slideResize' has to be set to false otherwise it will trump our resize
                    $.Window
                        .bind($.Events.RESIZE,
                        function(){
                            // Remove scrollbars so we can take propper measurements
                            $.Scroll.addClass('mc-hide-scrolls');
                            
                            // Set vars so we don't have to constantly check it
                            $.Window
                                .data('h', Utils.sizes().h)
                                .data('w', Utils.sizes().w);
                            
                            // Set container and slides height and width to match the window size
                            $self
                                .height($.Window.data('h')).width($.Window.data('w'))
                                .children()
                                .height($.Window.data('h')).width($.Window.data('w'));
                            
                            // This is special noise for cycle (cycle has separate height and width for each slide)
                            $self.children().each(function(){
                                this.cycleH = $.Window.data('h');
                                this.cycleW = $.Window.data('w');
                            });
                            
                            // Put the scrollbars back to how they were
                            $($.Scroll).removeClass('mc-hide-scrolls');
                        });
                }
            }
            
            
            
            /* --------------------- */
            
            // @Old
            
            /* 
            OLD BROWSER NOTES:
                We setup the dom to be the following structure for cycle plugin on old browsers:
                div = cycle
                    div = slide
                        img = full screen size image
                    div = slide
                        img = full screen size image
                    etc.
            */
            
            var Old = {
                setup: function(){
                    var c, t, $div;
                    
                    // Clear container
                    if($.BrowserTests.msie && !config.overrideMSIEStop){
                        // Stop IE from continually trying to preload images that we already removed
                        document.execCommand("Stop", false);
                    }
                    $self.html('');
                    
                    $.Body.addClass('mc-old-browser');
                    
                    if($.Slides.length > 0){
                        // Remove scrollbars so we can take propper measurements
                        $.Scroll.addClass('mc-hide-scrolls');
                        
                        // Cache our new dimensions
                        $.Window
                            .data('h', Utils.sizes().h)
                            .data('w', Utils.sizes().w);
                        
                        // Add our loading div to the DOM
                        $('body').append($("<div></div>").attr("class", "mc-loader").css({'position':'absolute','left':'-9999px'}));
                        
                        //  Loop through slides
                        for(var j in $.Slides) {
                            // Determine content (if container or image)
                            if($.Slides[j].content.length == 0){
                                c = '<img src="' + $.Slides[j].url + '" />';
                            }else{
                                c = $.Slides[j].content;
                            }
                            
                            // Create Div
                            $div = $("<div>" + c + "</div>").attr("class", "mc-image mc-image-n" + j + " " + $.Slides[j].theclass);
                            
                            // Add new container div to the DOM
                            $self.append( $div );
                            
                            // Account for slides without images
                            if($('.mc-image-n' + j).children('img').length == 0){
                            }else{
                                // Add first image to loader to get that started
                                $('div.mc-loader').append( $('.mc-image-n' + j).children('img').first().clone().addClass('not-loaded') );
                            }
                        }
                        
                        // Begin preloading
                        Old.preload();
                        
                        // Setup the resize function to listen for window changes
                        Old.windowResize();
                    }
                },
                preload: function(){
                    // Intervals to tell if an images have loaded
                    var t = setInterval(function() {
                        $('.mc-loader').children('img').each(function(i){
                            // Check if image is loaded
                            var $img = $(this);
                            
                            // Loop through not-loaded images
                            if($img.hasClass('not-loaded')){
                                if( $img.height() > 0 ){
                                    // Remove Dom notice
                                    $(this).removeClass('not-loaded');
                                    
                                    // Set the dimensions
                                    var $img1 = $('div.mc-image-n' + i).children('img').first();
                                    
                                    $img1
                                        .data('h', $img.height())
                                        .data('w', $img.width())
                                        .data('ar', ($img.width() / $img.height()));
                                    
                                    // Go on
                                    Old.onceLoaded(i)
                                }
                            }
                        });
                    
                        if( $('.not-loaded').length == 0){
                            // Remove our loader element because all of our images are now loaded
                            $('.mc-loader').remove();
                            
                            // Clear interval when all images are loaded
                            clearInterval(t);
                        }
                    }, 1000);
                },
                onceLoaded: function(m){
                    // Do maximage magic
                    Old.maximage(m);
                    
                    // Once the first image has completed loading, start the slideshow, etc.
                    if(m == 0) {
                        // If we changed the visibility before, make sure it is back on
                        $self.css({'visibility':'visible'});
                        
                        // Run user defined onFirstImageLoaded() function
                        config.onFirstImageLoaded();
                    
                    // After everything is done loading, clean up
                    }else if(m == $.Slides.length - 1){
                        // Only start cycle after the first image has loaded
                        Cycle.setup();
                        
                        // Put the scrollbars back to how they were
                        $($.Scroll).removeClass('mc-hide-scrolls');
                        
                        // If we have just loaded the final image, run the user defined function onImagesLoaded()
                        config.onImagesLoaded( $self );
                        
                        if(config.debug) {
                            debug(' - Final Maximage - ');debug($self);
                        }
                    }
                },
                maximage: function(p){
                    // Cycle sets the height of each slide so when we resize our browser window this becomes a problem.
                    //  - the cycle option 'slideResize' has to be set to false otherwise it will trump our resize
                    $('div.mc-image-n' + p)
                        .height($.Window.data('h'))
                        .width($.Window.data('w'))
                        .children('img')
                        .first()
                        .each(function(){
                            Adjust.maxcover($(this));
                        });
                },
                windowResize: function(){
                    $.Window
                        .bind($.Events.RESIZE,
                        function(){
                            clearTimeout(this.id);
                            this.id = setTimeout(Old.doneResizing, 200);
                        });
                },
                doneResizing: function(){
                    // The final resize (on finish)
                    // Remove scrollbars so we can take propper measurements
                    $($.Scroll).addClass('mc-hide-scrolls');
                    
                    // Cache our window's new dimensions
                    $.Window
                        .data('h', Utils.sizes().h)
                        .data('w', Utils.sizes().w);
                    
                    // Set the container's height and width
                    $self.height($.Window.data('h')).width($.Window.data('w'))
                    
                    // Set slide's height and width to match the window size
                    $self.find('.mc-image').each(function(n){
                        Old.maximage(n);
                    });
                    
                    // Update cycle's ideas of what our slide's height and width should be
                    var curr_opts = $self.data('cycle.opts');
                    if(curr_opts != undefined){
                        curr_opts.height = $.Window.data('h');
                        curr_opts.width = $.Window.data('w');
                        jQuery.each(curr_opts.elements, function(index, item) {
                            item.cycleW = $.Window.data('w');
                            item.cycleH = $.Window.data('h');
                        });
                    }
                    
                    // Put the scrollbars back to how they were
                    $($.Scroll).removeClass('mc-hide-scrolls');
                }
            }
            
            
            /* --------------------- */
            
            // @Cycle
            
            var Cycle = {
                setup: function(){
                    var h,w;
                    
                    $self.addClass('mc-cycle');
                    
                    // Container sizes (if not set)
                    $.Window
                        .data('h', Utils.sizes().h)
                        .data('w', Utils.sizes().w);
                    
                    // Prefer CSS Transitions
                    jQuery.easing.easeForCSSTransition = function(x, t, b, c, d, s) {
                        return b+c;
                    };
                    
                    var cycleOptions = $.extend({
                        fit:1,
                        containerResize:0,
                        height:$.Window.data('h'),
                        width:$.Window.data('w'),
                        slideResize: false,
                        easing: ($.BrowserTests.cssTransitions && config.cssTransitions ? 'easeForCSSTransition' : 'swing')
                    }, config.cycleOptions);
                    
                    $self.cycle( cycleOptions );
                }
            }
            
            
            
            /* --------------------- */
            
            // @Adjust = Math to center and fill all elements
            
            var Adjust = {
                center: function($item){
                    // Note: if alignment is 'left' or 'right' it can be controlled with CSS once verticalCenter 
                    //  and horizontal center are set to false in the plugin options
                    if(config.verticalCenter){
                        $item.css({marginTop:(($item.height() - $.Window.data('h'))/2) * -1})
                    }
                    if(config.horizontalCenter){
                        $item.css({marginLeft:(($item.width() - $.Window.data('w'))/2) * -1});
                    }
                },
                fill: function($item){
                    var $storageEl = $item.is('object') ? $item.parent().first() : $item;
                    
                    if(typeof config.backgroundSize == 'function'){
                        // If someone wants to write their own fill() function, they can: example customBackgroundSize.html
                        config.backgroundSize( $item );
                    }else if(config.backgroundSize == 'cover'){
                        if($.Window.data('w') / $.Window.data('h') < $storageEl.data('ar')){
                            $item
                                .height($.Window.data('h'))
                                .width(($.Window.data('h') * $storageEl.data('ar')).toFixed(0));
                        }else{
                            $item
                                .height(($.Window.data('w') / $storageEl.data('ar')).toFixed(0))
                                .width($.Window.data('w'));
                        }
                    }else if(config.backgroundSize == 'contain'){
                        if($.Window.data('w') / $.Window.data('h') < $storageEl.data('ar')){
                            $item
                                .height(($.Window.data('w') / $storageEl.data('ar')).toFixed(0))
                                .width($.Window.data('w'));
                        }else{
                            $item
                                .height($.Window.data('h'))
                                .width(($.Window.data('h') * $storageEl.data('ar')).toFixed(0));
                        }
                    }else{
                        debug('The backgroundSize option was not recognized for older browsers.');
                    }
                },
                maxcover: function($item){
                    Adjust.fill($item);
                    Adjust.center($item);
                },
                maxcontain: function($item){
                    Adjust.fill($item);
                    Adjust.center($item);
                }
            }
            
            
            
            /* --------------------- */
            
            // @Utils = General utilities for the plugin
            
            var Utils = {
                browser_tests: function(){
                    var $div = $('<div />')[0],
                        vendor = ['Moz', 'Webkit', 'Khtml', 'O', 'ms'],
                        p = 'transition',
                        obj = {
                            cssTransitions: false,
                            cssBackgroundSize: ( "backgroundSize" in $div.style && config.cssBackgroundSize ), // Can override cssBackgroundSize in options
                            html5Video: false,
                            msie: false
                        };
                    
                    // Test for CSS Transitions
                    if(config.cssTransitions){
                        if(typeof $div.style[p] == 'string') { obj.cssTransitions = true }
                    
                        // Tests for vendor specific prop
                        p = p.charAt(0).toUpperCase() + p.substr(1);
                        for(var i=0; i<vendor.length; i++) {
                            if(vendor[i] + p in $div.style) { obj.cssTransitions = true; }
                        }
                    }
                    
                    // Check if we can play html5 videos
                    if( !!document.createElement('video').canPlayType ) {
                        obj.html5Video = true;
                    }
                    
                    // Check for MSIE since we lost $.browser in jQuery
                    obj.msie = (Utils.msie() !== undefined);
                    
                    
                    if(config.debug) {
                        debug(' - Browser Test - ');debug(obj);
                    }
                    
                    return obj;
                },
                construct_slide_object: function(){
                    var obj = new Object(),
                        arr = new Array(),
                        temp = '';
                    
                    $self.children().each(function(i){
                        var $img = $(this).is('img') ? $(this).clone() : $(this).find('img').first().clone();
                        
                        // reset obj
                        obj = {};
                        
                        // set attributes to obj
                        obj.url = $img.attr('src');
                        obj.title = $img.attr('title') != undefined ? $img.attr('title') : '';
                        obj.alt = $img.attr('alt') != undefined ? $img.attr('alt') : '';
                        obj.theclass = $img.attr('class') != undefined ? $img.attr('class') : '';
                        obj.styles = $img.attr('style') != undefined ? $img.attr('style') : '';
                        obj.orig = $img.clone();
                        obj.datahref = $img.attr('data-href') != undefined ? $img.attr('data-href') : '';
                        obj.content = "";
                        
                        // Setup content for within container
                        if($(this).find('img').length > 0){
                            if($.BrowserTests.cssBackgroundSize){
                                $(this).find('img').first().remove();
                            }
                            obj.content = $(this).html();
                        }
                        
                        // Stop loading image so we can load them sequentiallyelse{
                        $img[0].src = "";
                        
                        // Remove original object (only on nonIE. IE hangs if you remove an image during load)
                        if($.BrowserTests.cssBackgroundSize){
                            $(this).remove();
                        }
                        
                        // attach obj to arr
                        arr.push(obj);
                    });
                    
                    
                    if(config.debug) {
                        debug(' - Slide Object - ');debug(arr);
                    }
                    return arr;
                },
                msie: function(){
                    var undef,
                        v = 3,
                        div = document.createElement('div'),
                        all = div.getElementsByTagName('i');

                    while (
                        div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->',
                        all[0]
                    );
                    
                    return v > 4 ? v : undef;
                },
                sizes: function(){
                    var sizes = {h:0,w:0};
                    
                    if(config.fillElement == "window"){
                        sizes.h = $.Window.height();
                        sizes.w = $.Window.width();
                    }else{
                        var $fillElement = $self.parents(config.fillElement).first();
                        
                        // Height
                        if($fillElement.height() == 0 || $fillElement.data('windowHeight') == true){
                            $fillElement.data('windowHeight',true);
                            sizes.h = $.Window.height();
                        }else{
                            sizes.h = $fillElement.height();
                        }
                    
                        // Width
                        if($fillElement.width() == 0 || $fillElement.data('windowWidth') == true){
                            $fillElement.data('windowWidth',true);
                            sizes.w = $.Window.width();
                        }else{
                            sizes.w = $fillElement.width();
                        }
                    }
                    
                    return sizes;
                }
            }
            
            
            
            /* --------------------- */
            
            // @Instantiation
            
            // Helper Function
            // Run tests to see what our browser can handle
            $.BrowserTests = Utils.browser_tests();
            
            if(typeof settings == 'string'){
                // TODO: Resize object fallback for old browsers,  If we are trying to size an HTML5 video and our browser doesn't support it
                if($.BrowserTests.html5Video || !$self.is('video')) {
                    var to, 
                        $storageEl = $self.is('object') ? $self.parent().first() : $self; // Can't assign .data() to '<object>'
                    
                    if( !$.Body.hasClass('mc-old-browser') )
                        $.Body.addClass('mc-old-browser');
                    
                    // Cache our window's new dimensions
                    $.Window
                        .data('h', Utils.sizes().h)
                        .data('w', Utils.sizes().w);
                
                    // Please include height and width attributes on your html elements
                    $storageEl
                        .data('h', $self.height())
                        .data('w', $self.width())
                        .data('ar', $self.width() / $self.height());
                
                    // We want to resize these elements with the window
                    $.Window
                        .bind($.Events.RESIZE,
                        function(){
                            // Cache our window's new dimensions
                            $.Window
                                .data('h', Utils.sizes().h)
                                .data('w', Utils.sizes().w);
                        
                            // Limit resize runs
                            to = $self.data('resizer');
                            clearTimeout(to);
                            to = setTimeout( Adjust[settings]($self), 200 );
                            $self.data('resizer', to);
                        });
                
                    // Initial run
                    Adjust[settings]($self);
                }
            }else{
                // Construct array of image objects for us to use
                $.Slides = Utils.construct_slide_object();
                
                // If we are allowing background-size:cover run Modern
                if($.BrowserTests.cssBackgroundSize){
                    if(config.debug) debug(' - Using Modern - ');
                    Modern.setup();
                }else{
                    if(config.debug) debug(' - Using Old - ');
                    Old.setup();
                }
            }
        });
        
        // private function for debugging
        function debug($obj) {
            if (window.console && window.console.log) {
                window.console.log($obj);
            }
        }
    }
    
    // Default options
    $.fn.maximage.defaults = {
        debug: false,
        cssBackgroundSize: true,  // Force run the functionality used for newer browsers
        cssTransitions: true,  // Force run the functionality used for old browsers
        verticalCenter: true, // Only necessary for old browsers
        horizontalCenter: true, // Only necessary for old browsers
        scaleInterval: 20, // Only necessary for old browsers
        backgroundSize: 'cover', // Only necessary for old browsers (this can be function)
        fillElement: 'window', // Either 'window' or a CSS selector for a parent element
        overrideMSIEStop: false, // This gives the option to not 'stop' load for MSIE (stops coded background images from loading so we can preload)... 
                                 // If setting this option to true, please beware of IE7/8 "Stack Overflow" error but if there are more than 13 slides
                                 // The description of the bug: http://blog.aaronvanderzwan.com/forums/topic/stack-overflow-in-ie-7-8/#post-33038
        onFirstImageLoaded: function(){},
        onImagesLoaded: function(){}
    }
})(jQuery);