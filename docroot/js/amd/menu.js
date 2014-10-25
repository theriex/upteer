/*global app: false, jt: false, setTimeout: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// Handle the top menu display
//

app.menu = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var notices = [],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    displayNoticesMenu = function () {
        jt.out('noticemenudiv', "");
        //ATTENTION: If there are any notices, then display a "Hey!"
        //link to access them.  Clicking a notice link brings up a
        //dialog explaining what needs to be done and providing
        //options.  The dialog function is part of the notice object..
    },


    displayMainMenu = function () {
        var html;
        html = ["a", {href: "#mainmenu",
                      onclick: jt.fs("app.menu.mainmenu()")},
                app.profile.getMyProfile().name];
        jt.out('mainmenudiv', jt.tac2html(html));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    select: function (menuitem) {
        app.layout.closeDialog();
        switch(menuitem) {
        case 'myprof': return app.profile.display();
        case 'logout': 
            jt.out('noticemenudiv', "");
            jt.out('mainmenudiv', "");
            return app.login.logout();
        }
    },


    mainmenu: function () {
        var html, mc;
        html = [["div", {id: "myprofmenudiv", cla: "menuitemdiv"},
                 ["a", {href: "#MyProfile",
                        onclick: jt.fs("app.menu.select('myprof')")},
                  "My Profile"]],
                ["div", {id: "signoutmenudiv", cla: "menuitemdiv"},
                 ["a", {href: "#SignOut",
                        onclick: jt.fs("app.menu.select('logout')")},
                  "Sign Out"]]];
        html = app.layout.dlgwrapHTML("", html);
        mc = jt.geoPos(jt.byId('mainmenudiv'));
        mc.x = Math.min(mc.x, app.winw - 120);
        mc.y = mc.y || 1;  //have to specify something to avoid default
        app.layout.openDialog({x: mc.x, y: mc.y}, jt.tac2html(html),
                              //override the dialog screen overflow protection
                              function () {
                                  jt.byId('dlgdiv').style.left = 
                                      mc.x + "px"; });
    },


    display: function () {
        displayNoticesMenu();
        displayMainMenu();
    }

};  //end of returned functions
}());

