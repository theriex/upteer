/*global alert: false, confirm: false, setTimeout: false, window: false, document: false, app: false, jt: false, JSON: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// Display a volunteer (or non-profit organization member) profile.
//

app.profile = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var currprof = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    saveProfile = function (e) {
        jt.err("saveProfile not implemented yet");
    };



    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    display: function () {
        jt.out("contentdiv", "At this point you should be looking at your profile, but that hasn't been built yet.<br/>Check back in a couple of weeks...");
    },


    byprofid: function (profid) {
        jt.err("profile.byprofid not implemented yet");
    }

};  //end of returned functions
}());

