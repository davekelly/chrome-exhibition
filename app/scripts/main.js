'use strict';

$(function(){
    $('#slideshow').maximage({
        cycleOptions: {
            fx: 'fade',
            speed: 1000, // Has to match the speed for CSS transitions in jQuery.maximage.css (lines 30 - 33)
            timeout: 0,
            prev: '#arrow_left',
            next: '#arrow_right',
            pause: 1,
            log: false
        },
        onFirstImageLoaded: function(){
            jQuery('#cycle-loader').hide();
            jQuery('#slideshow').fadeIn('fast');
        }
    });

    // Helper function to Fill and Center the HTML5 Video
    jQuery('video,object').maximage('maxcover');

    // To show it is dynamic html text
    jQuery('.in-slide-content').delay(1200).fadeIn();


    var hammerOptions = {};
    $('#slideshow')
        .hammer(hammerOptions)
        .on('swipeleft', function(ev) {
            // console.log(ev);
            $('#slideshow').cycle('next');
        })
        .on('swiperight', function(ev){
            // console.log(ev);
            $('#slideshow').cycle('prev');
        });
});