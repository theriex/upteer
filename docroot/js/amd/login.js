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
        app.review.resetStateVars();
        app.profile.resetStateVars();
        app.pen.resetStateVars();
        app.rel.resetStateVars("logout");
    },


    // clearParams = function () {
    //     //this also clears any search parameters to leave a clean url.
    //     //that way a return call from someplace like twitter doesn't
    //     //keep token info and similar parameter stuff hanging around.
    //     var url = window.location.pathname;
    //     //note this is using the standard html5 history directly.  That's
    //     //a way to to clear the URL noise without a redirect triggering
    //     //a page refresh. 
    //     if(history && history.pushState && 
    //                   typeof history.pushState === 'function') {
    //         history.pushState("", document.title, url); }
    // },


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
        app.login.updateAuthentDisplay();
    },


    // //safari displays "No%20match%20for%20those%20credentials"
    // //and even "No%2520match%2520for%2520those%2520credentials"
    // fixServerText = function (text) {
    //     if(!text) {
    //         text = ""; }
    //     text = text.replace(/%20/g, " ");
    //     text = text.replace(/%2520/g, " ");
    //     return text;
    // },


    displayAccountNameMenu = function () {
        //The account name they logged in with needs to be displayed
        //as a link in the upper right.  Clicking brings up a menu
        //with the option to sign out.  While it might seem nicer to
        //display the profile name, the email address is better since
        //it provides another check to make sure it is valid.
        jt.out('headingdiv', authname);
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

    init: function () {
        logLoadTimes();
        if(!loginhtml) {  //save html form in case needed later
            loginhtml = jt.byId('logindiv').innerHTML; }
        if(!app.login.isLoggedIn()) {
            app.login.readAuthCookie(); }
        if(app.login.isLoggedIn()) {
            displayAccountNameMenu();
            return app.profile.display(); }
        if(!jt.byId('logindiv')) {
            jt.out('contentdiv', loginhtml); }
        if(!jt.byId('createAccountButton')) {  //form not decorated
            decorateLoginForm(); }
    },


    authparams: function () {
        return authparams();
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
            authname = mtn[2]; }
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
        jt.err("login.createAccount not implemented yet");
    },


    forgotPassword: function () {
        jt.err("login.forgotPassword not implemented yet");
    }

};  //end of returned functions
}());


