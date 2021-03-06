/*global alert: false, setTimeout: false, window: false, document: false, history: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.login = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var authmethod = "",
        authtoken = "",
        authname = "",
        cookdelim = "..upteerauth..",
        loginhtml = "",
        initparams = {},  //parameters the app was started with


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    // secureURL = function (endpoint) {
    //     var url = window.location.href;
    //     if(url.indexOf(":8080") > 0 ||           //local dev or
    //        url.indexOf("https://") === 0) {      //secure server
    //         url = endpoint; }  //relative path url ok, data is encrypted
    //     else {  //not secured, try via XDR although it may not work
    //         url = app.secsvr + "/" + endpoint; }
    //     return url;
    // },


    authparams = function () {
        var params, sec; 
        params = "am=" + authmethod + "&at=" + authtoken + 
                 "&an=" + jt.enc(authname);
        sec = jt.cookie(authtoken);
        if(sec) {
            params += "&as=" + jt.enc(sec); }
        return params;
    },


    // //Produces less cryptic params to read
    // authparamsfull = function () {
    //     var params = "authmethod=" + authmethod + 
    //                  "&authtoken=" + authtoken + 
    //                  "&authname=" + jt.enc(authname);
    //     return params;
    // },


    decorateLoginForm = function () {
        var html;
        html = ["button", {type: "button", id: "createAccountButton",
                           onclick: jt.fs("app.login.createAccount()")},
                "Create account"];
        html = jt.tac2html(html) + jt.byId('loginbuttonsdiv').innerHTML;
        jt.out('loginbuttonsdiv', html);
        html = ["span", {cla: "subtext"},
                ["a", {id: "forgotpwlink", href: "#forgotPassword",
                       title: "Email my password, I forgot it",
                       onclick: jt.fs("app.login.forgotPassword()")},
                 "Forgot my password..."]];
        jt.out('forgotpassdiv', jt.tac2html(html));
    },


    logoutWithNoDisplayUpdate = function () {
        //remove the cookie
        jt.cookie(app.authcookname, "", -1);
        authmethod = "";
        authtoken = "";
        authname = "";
        app.profile.resetStateVars();
    },


    clearParams = function () {
        //this also clears any search parameters to leave a clean url.
        //that way a return call from someplace like twitter doesn't
        //keep token info and similar parameter stuff hanging around.
        var url = window.location.pathname;
        //note this is using the standard html5 history directly.  That's
        //a way to to clear the URL noise without a redirect triggering
        //a page refresh. 
        if(history && history.pushState && 
                      typeof history.pushState === 'function') {
            history.pushState("", document.title, url); }
    },


    //Cookie timeout is enforced both by the expiration setting here,
    //and by the server (user.py authenticated).  On FF14 with
    //noscript installed, the cookie gets written as a session cookie
    //regardless of the expiration set here.  This happens even if
    //directly using Cookie.set, or setting document.cookie directly.
    //On FF14 without noscript, all is normal.
    setAuthentication = function (method, token, name) {
        var cval = method + cookdelim + token + cookdelim + name;
        jt.cookie(app.authcookname, cval, 365);
        authmethod = method;
        authtoken = token;
        authname = name;
    },


    //webkit likes to escape at signs
    fixEmailAddress = function (emaddr) {
        emaddr = emaddr.replace(/%40/g, "@");
        return emaddr;
    },


    //safari displays "No%20match%20for%20those%20credentials"
    //and even "No%2520match%2520for%2520those%2520credentials"
    fixServerText = function (text) {
        var emailin;
        if(!text) {
            text = ""; }
        text = text.replace(/%20/g, " ");
        text = text.replace(/%2520/g, " ");
        if(text.startsWith("Not registered")) {
            emailin = jt.byId('emailin');
            if(emailin && emailin.value) {
                text = fixEmailAddress(emailin.value); }
            else {
                text = "That account"; }
            text += " is not registered yet.<br/>" +
                "If you want to create it, verify your<br/>" + 
                "password is entered correctly and<br/>" + 
                "click \"Create account\"."; }
        return text;
    },


    displayEmailSent = function () {
        var html;
        html = [["p",
                 [["Your account information has been emailed to "],
                  ["code", jt.byId('emailin').value],
                  [" and should arrive in a few minutes.  If it doesn't" + 
                   " show up, please"]]],
                ["ol",
                 [["li", "Make sure your email address is spelled correctly"],
                  ["li", "Check your spam folder"],
                  ["li", "Confirm the email address you entered is the same" +
                        " one you used when you created your account."]]],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.layout.closeDialog()")},
                  "OK"]]];
        html = app.layout.dlgwrapHTML("Email Account Password", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('okbutton').focus(); });
    },


    noteReturnToParameter = function (url) {
        if(initparams.returnto) {
            //we are returning to another site, probably with an
            //embedded upteer display.
            jt.out('loginparaminputs', jt.tac2html(
                ["input", {type: "hidden", name: "returnto",
                           value: initparams.returnto}])); }
        else {
            //we are on our local site, but return to it again with
            //all current command line parameters so that the the app
            //retries processing them after login is complete.
            jt.out('loginparaminputs', jt.tac2html(
                ["input", {type: "hidden", name: "returnto",
                           value: url}])); }
    },


    checkLoginAndCallBack = function () {
        var url = jt.dec(initparams.clacb);
        if(url.indexOf("#") < 0) {
            url += "#"; }
        if(!url.endsWith("#")) {
            url += "&"; }
        if(app.login.isLoggedIn()) {
            url += authparams(); }
        else {
            url += "at=notloggedin"; }
        jt.out('contentdiv', "Returning to " + url);
        window.location.href = url;
    },


    logLoadTimes = function () {
        var millis, timer = app.amdtimer;
        millis = timer.load.end.getTime() - timer.load.start.getTime();
        jt.log("load app: " + millis);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    init: function (verb) {
        var url;
        logLoadTimes();
        url = window.location.href;
        if((url.indexOf("http:") === 0) && (url.search(/:\d080/) < 0)) {
            //not over https and not local development. Redirect.
            window.location.href = "https" + url.slice(4); }
        if(!loginhtml) {  //save html form in case needed later
            loginhtml = jt.byId('logindiv').innerHTML; }
        initparams = jt.parseParams("String");
        noteReturnToParameter(url);
        if(initparams.authname && jt.byId('emailin')) {
            jt.byId('emailin').value = fixEmailAddress(initparams.authname); }
        if(initparams.loginerr) {
            jt.out('loginstatdiv', fixServerText(initparams.loginerr)); }
        else if(initparams.authtoken && initparams.authname) {
            setAuthentication("utin", initparams.authtoken, 
                              initparams.authname); }
        clearParams();
        if(!app.login.isLoggedIn()) {
            app.login.readAuthCookie(); }
        if(initparams.clacb) {
            return checkLoginAndCallBack(); }
        if(app.embed && verb !== "normal") {
            return app.opp.extListOpps(app.embed); }
        if(app.login.isLoggedIn()) {
            app.login.displayAccountNameMenu();  //base menu html
            if(initparams.view === "profile" && initparams.profid) {
                return app.profile.display(function () {
                    app.profile.byprofid(initparams.profid); }); }
            if(initparams.view === "opp" && initparams.oppid) {
                return app.profile.display(function () {
                    app.menu.display();
                    app.opp.byoppid(initparams.oppid); }); }
            return app.profile.display(); }
        if(!jt.byId('logindiv')) {
            jt.out('contentdiv', loginhtml); }
        if(!jt.byId('createAccountButton')) {  //form not decorated
            decorateLoginForm(); }
    },


    authparams: function () {
        return authparams();
    },


    getAuthName: function () {
        return authname;
    },


    isLoggedIn: function () {
        if(authmethod && authtoken && authname) {
            return true; }
        return false;
    },


    readAuthCookie: function () {
        var cval, mtn;
        cval = jt.cookie(app.authcookname);
        if(cval) {
            mtn = cval.split(cookdelim);
            authmethod = mtn[0];
            authtoken = mtn[1];
            authname = fixEmailAddress(mtn[2]); }
        return authtoken;  //true if set earlier
    },


    logout: function () {
        logoutWithNoDisplayUpdate();
        app.login.init();
    },


    setAuth: function (method, token, name) {
        setAuthentication(method, token, name);
    },


    createAccount: function () {
        var emaddr, password, data, buttonhtml;
        emaddr = jt.byId('emailin').value;
        password = jt.byId('passin').value;
        if(!emaddr || !password || !emaddr.trim() || !password.trim()) {
            jt.out('loginstatdiv', "Please specify an email and password");
            return; }
        jt.out('loginstatdiv', "&nbsp;");
        buttonhtml = jt.byId('loginbuttonsdiv').innerHTML;
        jt.out('loginbuttonsdiv', "Creating new account...");
        data = jt.objdata({ emailin: emaddr, passin: password });
        jt.call('POST', "newacct", data,
                function (objs) {
                    setAuthentication("utid", objs[0].token, emaddr);
                    app.login.displayAccountNameMenu();
                    jt.out('contentdiv', "<p>Welcome to the Upteer volunteer community! Your account has been created. </p><p>Signing you in for the first time now...</p>");
                    //database eventual consistency... give it a few seconds
                    setTimeout(app.profile.display, 3000); },
                app.failf(function (code, errtxt) {
                    if(code === 412 && errtxt.startsWith("Account exists")) {
                        jt.byId('loginform').submit(); }
                    else {
                        jt.out('loginstatdiv', String(code) + " " + errtxt);
                        jt.out('loginbuttonsdiv', buttonhtml); } }),
                jt.semaphore("login.createAccount"));
    },


    forgotPassword: function () {
        var email, data;
        email = jt.byId('emailin').value;
        if(!jt.isProbablyEmail(email)) {
            jt.out('loginstatdiv', "Please fill in your email address.");
            return; }
        jt.out('loginstatdiv', "Sending...");
        data = "email=" + jt.enc(email);
        jt.call('POST', "mailcred", data,
                function (objs) {
                    jt.out('loginstatdiv', "&nbsp;");
                    displayEmailSent(); },
                app.failf(function (code, errtxt) {
                    jt.out('loginstatdiv', errtxt); }),
                jt.semaphore("forgotPassword"));
    },


    displayAccountNameMenu: function () {
        //The account name they logged in with needs to be displayed
        //as a link in the upper right.  Clicking brings up a menu
        //with the option to sign out.  While it might seem nicer to
        //display the profile name, the email address is better since
        //it provides another check to make sure it is valid.
        jt.out('mainmenudiv', authname);
        jt.out('logodiv', jt.tac2html(
            ["img", {src: "img/logo.png", width:"155", height:"48"}]));
    }

};  //end of returned functions
}());


