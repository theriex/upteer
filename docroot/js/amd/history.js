/*global window: false, document: false, history: false, JSON: false, app: false, jt: false */

/*jslint white: true, unparam: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// history utility methods
//

app.history = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure data
    ////////////////////////////////////////

    var 


    ////////////////////////////////////////
    // closure helper funtions
    ////////////////////////////////////////

    getTitle = function (state) {
        var title = document.title;
        return title;
    },


    getURL = function (state) {
        var url = window.location.href;
        return url;
    };


    ////////////////////////////////////////
    // closure exposed functions
    ////////////////////////////////////////

return {

    //If the view, profile, or opportunity has changed, then push a
    //history record. If the view mode has changed, then replace the
    //current history record so the state of the view is restored
    //properly.  Otherwise no effect.
    checkpoint: function (pstate) {
        var hstate, title, url;
        if(history) {  //verify history object defined, otherwise skip
            hstate = history.state;
            if(!hstate 
               || hstate.view !== pstate.view 
               || hstate.profid !== pstate.profid
               || hstate.oppid !== pstate.oppid) {
                if(history.pushState && 
                   typeof history.pushState === 'function') {
                    title = getTitle(pstate);
                    url = getURL(pstate);
                    history.pushState(pstate, title, url);
                    jt.log("history.pushState: " + 
                            JSON.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } }
            else if(pstate.viewmode && pstate.viewmode !== hstate.viewmode) {
                if(history.replaceState &&
                   typeof history.replaceState === 'function') {
                    title = getTitle(pstate);
                    url = getURL(pstate);
                    history.replaceState(pstate, title, url);
                    jt.log("history.replaceState: " + 
                            JSON.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } } }
    },


    pop: function (event) {
        var state;
        if(event) {
            state = event.state; }
        jt.log("historyPop: " + JSON.stringify(state));
        if(state) {
            switch(state.view) {
            case "profile":
                if(jt.isId(state.profid)) {
                    app.profile.byprofid(state.profid); }
                else {
                    app.profile.display(); }
                break; 
            case "org":
                if(jt.isId(state.orgid)) {
                    app.org.byorgid(state.orgid); }
                break;
            case "opp":
                if(jt.isId(state.oppid)) {
                    app.opp.byoppid(state.oppid); }
                break;
            case "match":
                app.match.init(state.oppid);
                break;
            //other history state handling cases go here...
            } }
        else if(app.login.isLoggedIn()) {
            jt.log("historyPop: no state. displaying profile.");
                    app.profile.display(); }
        //no default action if not logged in.  A browser may pop the
        //history to attempt to return to the raw site in the event of
        //an autologin failure.
    },


    currState: function () {
        var state = {};
        if(history && history.state) {
            state = history.state; }
        return state;
    }


    }; //end of returned functions

}());


