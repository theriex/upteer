/*global setTimeout: false, window: false, document: false, history: false, jtminjsDecorateWithUtilities: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

var app = {},  //Global container for application level funcs and values
    jt = {};   //Global access to general utility methods

////////////////////////////////////////
// a p p
//
(function () {
    "use strict";

    ////////////////////////////////////////
    // app variables
    ////////////////////////////////////////

    app.winw = 0;  //adjusted in app.layout
    app.winh = 0;
    app.authcookname = "upteerauth";
    app.secsvr = "https://www.upteer.com";
    app.mainsvr = "https://www.upteer.com";
    app.onescapefunc = null;  //app global escape key handler
    app.escapefuncstack = [];  //for levels of escaping


    ////////////////////////////////////////
    // application level functions
    ////////////////////////////////////////

    //app global key handling
    app.globkey = function (e) {
        if(e && e.keyCode === 27) {  //ESC
            if(app.onescapefunc) {
                jt.evtend(e);
                app.onescapefunc(); } }
    };


    //post module load initialization
    app.init2 = function () {
        app.amdtimer.load.end = new Date();
        app.layout.init();
        jt.on(document, 'keypress', app.globkey);
        jt.on(window, 'popstate', app.history.pop);
        setTimeout(app.login.init, 10);
    };
        

    app.init = function () {
        var href = window.location.href,
            modules = [ "js/amd/layout", "js/amd/login", "js/amd/history",
                        "js/amd/profile", "js/amd/kwentry", "js/amd/org",
                        "js/amd/lcs", "js/amd/menu", "js/amd/opp",
                        "js/amd/match", "js/amd/contact" ];
        jtminjsDecorateWithUtilities(jt);
        if(href.indexOf("embed=") > 0) {
            jt.byId('logodiv').style.display = "none";
            app.embparams = jt.parseParams("String");
            app.embed = app.embparams.embed; }
        if(href.indexOf("#") > 0) {
            href = href.slice(0, href.indexOf("#")); }
        if(href.indexOf("?") > 0) {
            href = href.slice(0, href.indexOf("?")); }
        if(href.indexOf("http:") === 0 && href.indexOf("upteer.com") >= 0) {
            jt.out('logindiv', "Redirecting to secure server...");
            window.location.href = "https:" + href.slice(5);
            return; }
        if(href.search(/:\d\d?080/) >= 0) {  //support for local testing
            app.secsvr = app.mainsvr = href; }
        app.amdtimer = {};
        app.amdtimer.load = { start: new Date() };
        jt.loadAppModules(app, modules, href, app.init2, "?v=150608");
    };


    app.crash = function (code, errtxt, method, url, data) {
        var html, now, subj, body, emref, support;
        support = "support";
        support += "@upteer.com";
        now = new Date();
        subj = "Server crash";
        body = "Hey,\n\n" +
            "The server crashed.  Here are some details:\n\n" +
            "local time: " + now + "\n" +
            "method: " + method + "\n" +
            "url: " + url + "\n" +
            "data: " + data + "\n" +
            "code: " + code + "\n" +
            errtxt + "\n\n" +
            "Please fix this so it doesn't happen again.  If it is " +
            "anything more than a minor bug, open an issue on " +
            "https://github.com/theriex/myopenreviews/issues for " +
            "tracking purposes.\n\n" +
            "thanks,\n";
        emref = "mailto:" + support + "?subject=" + jt.dquotenc(subj) + 
            "&body=" + jt.dquotenc(body);
        html = [
            ["div", {id: "chead"}],
            ["div", {id: "cmain"},
             [["p", "The server just crashed."],
              ["p", 
               [["It's possible hitting the reload button on your " +
                "browser might help. If that doesn't work, then it " +
                "would be awesome if you would please ",
                 ["a", {href: emref},
                  "email support to get it fixed."]]]]]]];
        html = jt.tac2html(html);
        jt.out('contentdiv', html);
    };


    app.failf = function (failfunc) {
        if(!failfunc) {
            failfunc = function (code, errtxt, method, url, data) {
                jt.log(jt.safestr(code) + " " + method + " " + url + 
                       " " + data + " " + errtxt); }; }
        return function (code, errtxt, method, url, data) {
            switch(code) {
            //   400 (bad request) -> general error handling
            //If the user has attempted to do something unauthorized,
            //then it's most likely because their session has expired
            //or they logged out and are trying to resubmit an old
            //form.  The appropriate thing is to redo the login.
            case 401: return app.login.logout();
            //   404 (not found) -> general error handling
            //   405 (GET instead of POST) -> general error handling
            //   412 (precondition failed) -> general error handling
            case 500: return app.crash(code, errtxt, method, url, data);
            default: failfunc(code, errtxt, method, url, data); } };
    };


    //factored to save typing when creating input forms
    app.lvtr = function (id, label, val, placeholder, type) {
        type = type || "text";
        return ["tr", {id: id + "tr"},
                [["td", {align: "right"},
                  ["label", {fo: id, cla: "formlabel"},
                   label]],
                 ["td", {align: "left"},
                  ["input", {type: type, id: id, name: id,
                             value: val, size: 30,
                             placeholder: placeholder}]]]];
    };


    app.limitwidth = function (divid) {
        var width, domelem;
        if(app.winw > 700) {
            domelem = jt.byId(divid);
            if(domelem) {
                width = Math.min(600, Math.round(app.winw * 2 / 3));
                domelem.style.width = width + "px"; } }
    };


    app.initTextArea = function (divid, val, placeholder) {
        var domelem = jt.byId(divid);
        if(domelem) {
            domelem.readOnly = false;
            domelem.value = val || "";
            domelem.placeholder = placeholder;
            app.limitwidth(divid); }
    };

} () );

