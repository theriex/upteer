/*global window: false, jtminjsDecorateWithUtilities: false, document: false, jt: false, app: false, upteerFrameDimensionsOverride: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

var upteerembed = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var siteroot = "https://www.upteer.com",
        jt = {},
        urlparams = {},
        udivs = {},
        framedim = {width: 320, height: 533},  //min cell phone display


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
    },


    readUpteerDivs = function () {
        var div;
        div = jt.byId('upteerloginreturn');
        if(div) {
            udivs.logret = div.innerHTML;
            div.innerHTML = ""; }
        div = jt.byId('upteercssoverride');
        if(div) {
            udivs.css = div.innerHTML;
            div.innerHTML = ""; }
    },


    callUpteerLogin = function () {
        jt.out('upteerloginreturn', "Redirecting to Upteer for login...");
        window.location.href = siteroot + "?clacb=" + jt.enc(udivs.logret);
    },


    loginparams = function () {
        var str = "";
        if((urlparams.at && urlparams.at !== "notloggedin") 
           || urlparams.authtoken) {
            str += "&authtoken=" + (urlparams.at || urlparams.authtoken);
            if(urlparams.an || urlparams.authname) {
                str += "&authname=" + (urlparams.an || urlparams.authname); } }
        return str;
    },


    insertLookAndFeelCSS = function () {
        var csselem;
        if(udivs.css) {
            csselem = document.createElement('link');
            csselem.rel = "stylesheet";
            csselem.type = "text/css";
            csselem.href = udivs.css;
            document.head.insertBefore(csselem, document.head.childNodes[0]); }
    },


    upteerLoginButtonHTML = function () {
        var url, html;
        url = udivs.logret;
        url = jt.enc(url);
        url = siteroot + "?returnto=" + url;
        html = ["div", {cla: "formbuttonsdiv",
                        style: "text-align:center; padding:0px 0px 5px 0px;"},
                ["button", {type: "button", id: "upteerLoginButton",
                            onclick: "window.location.href='" + url +
                                           "';return false;"},
                 "Sign in to Upteer"]];
        return html;
    },


    computeFrameDimensions = function (udiv) {
        var pos, contheight, height, width;
        pos = jt.geoPos(udiv);
        contheight = document.body.scrollHeight + pos.x;
        contheight += 50;  //extra padding to help things work out
        height = window.innerHeight - contheight;
        width = document.body.offsetWidth;
        framedim.width = Math.max(framedim.width, width);
        framedim.height = Math.max(framedim.height, height);
        if(typeof upteerFrameDimensionsOverride === "function") {
            upteerFrameDimensionsOverride(framedim); }
    },


    writeEmbeddedContent = function () {
        var udiv, src, html = [];
        udiv = jt.byId('upteerdisplaydiv');
        computeFrameDimensions(udiv);
        src = siteroot + "?embed=" + udiv.innerHTML;
        src += loginparams();
        src += "&site=" + jt.enc(window.location.href);
        if(udivs.css) {
            src += "&css=" + jt.enc(udivs.css); }
        if(udivs.logret) {
            src += "&logret=" + jt.enc(udivs.logret); }
        if(urlparams.at === "notloggedin") {
            insertLookAndFeelCSS();
            html.push(upteerLoginButtonHTML()); }
        html.push(["iframe", {id: "upteeriframe", src: src, 
                              width: framedim.width, 
                              height: framedim.height}]);
        jt.out('upteerdisplaydiv', jt.tac2html(html));
    };



    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    createUpteerDisplay: function (obj) {
        if(obj && obj.siteroot) {
            siteroot = obj.siteroot; }
        if(loadScripts(["jtmin.js"], upteerembed.createUpteerDisplay)) {
            jtminjsDecorateWithUtilities(jt);
            urlparams = jt.parseParams("String");
            readUpteerDivs();
            if(udivs.logret && !(urlparams.at || urlparams.authtoken)) {
                return callUpteerLogin(); }
            writeEmbeddedContent(); }
    }

};  //end of returned functions
}());

upteerembed.createUpteerDisplay();

