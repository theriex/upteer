/*global window: false, jtminjsDecorateWithUtilities: false, document: false, jt: false, app: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

var upteerembed = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var siteroot = "http://localhost:9080",
        //siteroot = "https://www.upteer.com",
        jt = {},


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    scriptLoaded = function (src) {
        var elems, i;
        elems = document.getElementsByTagName("script");
        for(i = 0; elems && i < elems.length; i += 1) {
            if(elems[i].src && elems[i].src === src) {
                return true; } }
        return false;
    },


    loadScripts = function (scrnames, contf) {
        var i, src, elem, allLoaded;
        allLoaded = true;
        for(i = 0; i < scrnames.length; i += 1) {
            src = siteroot + "/js/" + scrnames[i];
            if(!scriptLoaded(src)) {
                allLoaded = false;
                elem = document.createElement("script");
                elem.onload = contf;
                elem.src = src;
                document.getElementsByTagName("body")[0].appendChild(elem);
                break; } }
        return allLoaded;
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    createUpteerDisplay: function (obj) {
        var html, pos, contentHeight, width, height;
        if(obj && obj.siteroot) {
            siteroot = obj.siteroot; }
        if(loadScripts(["jtmin.js"], upteerembed.createUpteerDisplay)) {
            jtminjsDecorateWithUtilities(jt);
            pos = jt.geoPos(jt.byId('upteerdisplaydiv'));
            contentHeight = document.body.scrollHeight + pos.x;
            contentHeight += 50;  //extra padding to help things work out
            height = window.innerHeight - contentHeight;
            width = document.body.offsetWidth;
            html = ["iframe", {src: siteroot, width: width, height: height}];
            jt.out('upteerdisplaydiv', jt.tac2html(html)); }
    }

};  //end of returned functions
}());

upteerembed.createUpteerDisplay();

