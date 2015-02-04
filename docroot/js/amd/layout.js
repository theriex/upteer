/*global window: false, document: false, setTimeout: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4, regexp: true */

app.layout = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dndState = null,
        dlgqueue = [],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    displayDocContent = function (url, html) {
        var idx;
        if(!html || !html.trim()) {
            html = url + " contains no text"; }
        idx = html.indexOf("<body>");
        if(idx > 0) {
            html = html.slice(idx + "<body>".length,
                              html.indexOf("</body")); }
        html = html.replace(/\.<!-- \$ABOUTCONTACT -->/g,
            "<a href=\"mailto:support@upteer.com\">email support</a>");
        //create title from capitalized doc file name
        idx = url.lastIndexOf("/");
        if(idx > 0) {
            url = url.slice(idx + 1); }
        idx = url.indexOf(".");
        if(idx > 0) {
            url = url.slice(0, idx); }
        switch(url) {
        case "about": url = "About Upteer"; break;
        case "terms": url = "Terms of Use"; break;
        case "privacy": url = "Privacy Statement"; break;
        default: url = url.capitalize(); }
        //display content
        html = app.layout.dlgwrapHTML(url, html);
        app.layout.openDialog({x:20, y:60}, html);
    },


    //relative paths don't work when you are running file://...
    relativeToAbsolute = function (url) {
        var loc = window.location.href;
        loc = loc.slice(0, loc.lastIndexOf("/") + 1);
        return loc + url;
    },


    attachDocLinkClick = function (node, link) {
        jt.on(node, "click", function (e) {
            jt.evtend(e);
            app.layout.displayDoc(link); });
    },


    applyCSSOverride = function () {
        var cssurl, csselem;
        cssurl = app.embparams && app.embparams.css;
        if(cssurl) {
            csselem = document.createElement('link');
            csselem.rel = "stylesheet";
            csselem.type = "text/css";
            csselem.href = jt.dec(cssurl);
            document.head.appendChild(csselem); }
    },


    localDocLinks = function () {
        var i, nodes, node, href;
        nodes = document.getElementsByTagName('a');
        for(i = 0; nodes && i < nodes.length; i += 1) {
            node = nodes[i];
            href = node.href;
            //href may have been resolved from relative to absolute...
            if(href && href.indexOf("docs/") >= 0) {
                attachDocLinkClick(node, href); } }
        if(app.embed) {  //replace local doc links with site link
            jt.byId('footerdiv').style.wordSpacing = "5px";
            jt.out('footerdiv', jt.tac2html(
                ["a", {href: app.mainsvr,
                       onclick: jt.fs("window.open('" + app.mainsvr + "')")},
                 "Opportunities from Upteer"])); }
    },


    findDisplayHeightAndWidth = function () {
        //most browsers (FF, safari, chrome, etc)
        if(window.innerWidth && window.innerHeight) {
            app.winw = window.innerWidth;
            app.winh = window.innerHeight; }
        //IE8
        else if(document.body && document.body.offsetWidth) {
            app.winw = document.body.offsetWidth;
            app.winh = document.body.offsetHeight; }
        //last resort
        else {  //WTF, just guess.
            app.winw = 800;
            app.winh = 800; }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    init: function () {
        app.layout.commonUtilExtensions();
        findDisplayHeightAndWidth();
        applyCSSOverride();
        localDocLinks();
    },


    commonUtilExtensions: function () {
        //Referencing variables starting with an underscore causes jslint
        //complaints, but it still seems the clearest and safest way to
        //handle an ID value in the server side Python JSON serialization.
        //This utility method encapsulates the access, and provides a
        //single point of adjustment if the server side logic changes.
        //A GAE int can easily be larger than a javascript int.
        jt.instId = function (obj) {
            var idfield = "_id";
            if(obj && obj.hasOwnProperty(idfield)) {
                return String(obj[idfield]); }
        };
        jt.setInstId = function (obj, idval) {
            var idfield = "_id";
            obj[idfield] = String(idval);
        };
        jt.isId = function (idval) {
            if(idval && typeof idval === 'string' && idval !== "0") {
                return true; }
            return false;
        };
    },


    parseEmbeddedJSON: function (text) {  //for static page support
        var obj = null, jsonobj = JSON || window.JSON;
        if(!jsonobj) {
            jt.err("JSON not supported, please use a modern browser"); }
        text = text.trim();
        text = text.replace(/\n/g, "\\n");
        text = text.replace(/<a[^>]*\>/g, "");
        text = text.replace(/<\/a>/g, "");
        try {
            obj = jsonobj.parse(text);
        } catch(problem) {
            jt.err("Error parsing JSON: " + problem +
                   "\nPlease upgrade your browser");
        }
        return obj;
    },


    displayDoc: function (url) {
        var html = "Fetching " + url + " ...";
        if(jt.byId('dlgdiv').style.visibility === "visible") {
            return app.layout.closeDialog(); }     //toggle off
        app.layout.openDialog(null, html);
        if(url.indexOf(":") < 0) {
            url = relativeToAbsolute(url); }
        jt.request('GET', url, null,
                   function (resp) {
                       displayDocContent(url, resp); },
                   function (code, errtxt) {
                       displayDocContent(url, errtxt); },
                   jt.semaphore("layout.displayDoc"));
    },


    writeDialogContents: function (html) {
        jt.out('dlgdiv', jt.tac2html(
            ["div", {id: "dlgborderdiv"},
             ["div", {id: "dlginsidediv"}, 
              html]]));
    },


    queueDialog: function (coords, html, initf, visf) {
        if(jt.byId('dlgdiv').style.visibility === "visible") {
            dlgqueue.push({coords: coords, html: html, 
                           initf: initf, visf: visf}); }
        else {
            app.layout.openDialog(coords, html, initf, visf); }
    },


    //clobbers existing dialog if already open
    openDialog: function (coords, html, initf, visf) {
        var dlgdiv = jt.byId('dlgdiv');
        //window.scrollTo(0,0);  -- makes phone dialogs jump around. Don't.
        coords = coords || {};  //default x and y separately
        coords.x = coords.x || Math.min(Math.round(app.winw * 0.1), 100);
        coords.y = coords.y || 60;  //default y if not specified
        if(coords.x > (app.winw / 2)) {
            coords.x = 20; }  //display too tight, use default left pos
        coords.y = coords.y + jt.byId('bodyid').scrollTop;  //logical height
        dlgdiv.style.left = String(coords.x) + "px";
        dlgdiv.style.top = String(coords.y) + "px";
        dlgdiv.style.width = (coords.w || Math.round(app.winw * 0.7)) + "px";
        if(app.winw < 500) {
            dlgdiv.style.width = (Math.round(app.winw * 0.9) - 30) + "px"; }
        if(!app.escapefuncstack) {
            app.escapefuncstack = []; }
        app.escapefuncstack.push(app.onescapefunc);
        app.onescapefunc = app.layout.closeDialog;
        app.layout.writeDialogContents(html);
        if(initf) {
            initf(); }
        jt.byId('dlgdiv').style.visibility = "visible";
        if(visf) {
            visf(); }
    },


    closeDialog: function () {
        var dlg;
        jt.out('dlgdiv', "");
        jt.byId('dlgdiv').style.visibility = "hidden";
        app.onescapefunc = app.escapefuncstack.pop();
        if(dlgqueue.length > 0) {
            dlg = dlgqueue.pop();
            app.layout.openDialog(dlg.coords, dlg.html, dlg.initf, dlg.visf); }
    },


    dragstart: function (event) {
        if(event) {
            dndState = { domobj: event.target,
                         screenX: event.screenX,
                         screenY: event.screenY };
            jt.log("dragstart " + dndState.domobj + " " + 
                    dndState.screenX + "," + dndState.screenY);
            if(event.dataTransfer && event.dataTransfer.setData) {
                event.dataTransfer.setData("text/plain", "general drag"); } }
    },


    dragend: function (event) {
        if(event && dndState) {
            jt.log("dragend called");
            dndState.ended = true; }
    },


    bodydragover: function (event) {
        if(event && dndState && (!dndState.ended || dndState.dropped)) {
            //jt.log("dndOver preventing default cancel");
            event.preventDefault(); }
    },


    bodydrop: function (event) {
        var diffX, diffY, domobj, currX, currY;
        jt.log("bodydrop called");
        if(event && dndState) {
            dndState.dropped = true;
            diffX = event.screenX - dndState.screenX;
            diffY = event.screenY - dndState.screenY;
            domobj = dndState.domobj;
            jt.log("dropping " + domobj + " moved " + diffX + "," + diffY);
            currX = domobj.offsetLeft;
            currY = domobj.offsetTop;
            domobj.style.left = String(currX + diffX) + "px";
            domobj.style.top = String(currY + diffY) + "px";
            event.preventDefault();
            event.stopPropagation(); }
    },


    dlgwrapHTML: function (title, html) {
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"}, title],
                html];
        return jt.tac2html(html);
    }


};  //end of returned functions
}());

