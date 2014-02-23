// http://snipplr.com/view/26662/get-url-parameters-with-jquery--improved/
$.urlParam = function(name) {
    var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (!results) { return 0; }
    return results[1] || 0;
}

$(function() {
    if ($.urlParam('editor')) {
        $('.editor_cont').each(function(i, e) {
            $(e).css('visibility', 'visible').css('display', 'block');
        });
    }
});