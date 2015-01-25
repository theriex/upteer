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

    var notices = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    displayNoticesMenu = function () {
        var i, html = [], profref;
        if(!notices) {
            //At startup, there are several orgid and profid
            //references being resolved, and colliding with those while
            //checking for secondary display info like this can lead to
            //calls getting ignored due to retrieval semaphores.  Best
            //to chill for a moment before rebuilding the notices.  That
            //also makes the "Hey" stand out more.
            setTimeout(app.menu.rebuildNotices, 800);
            return; }
        for(i = 0; i < notices.length; i += 1) {
            profref = app.lcs.getRef("prof", notices[i].noticeprof);
            if(profref.status === "not cached") {
                //load the profile so we have the name available later
                app.lcs.getFull("prof", notices[i].noticeprof, 
                                app.menu.profload); } }
        if(notices.length > 0) {
            html = ["a", {href: "#noticesmenu",
                          onclick: jt.fs("app.menu.noticesmenu()")},
                    "Hey!"]; }
        jt.out('noticemenudiv', jt.tac2html(html));
    },


    displayMainMenu = function () {
        var prof, html;
        prof = app.profile.getMyProfile();
        html = ["a", {href: "?view=profile&profid=" + jt.instId(prof),
                      onclick: jt.fs("app.menu.mainmenu()")},
                prof.name];
        jt.out('mainmenudiv', jt.tac2html(html));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    createNotice: function (notice) {
        notices.push(notice);
        displayNoticesMenu();
    },


    select: function (menuitem) {
        app.layout.closeDialog();
        switch(menuitem) {
        case 'myprof': return app.profile.display();
        case 'book': return app.contact.showbook();
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
                ["div", {id: "cbmenudiv", cla: "menuitemdiv"},
                 ["a", {href: "#ContactBook",
                        onclick: jt.fs("app.menu.select('book')")},
                  "Contacts"]],
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
                                  var dlgdiv = jt.byId('dlgdiv');
                                  dlgdiv.style.left = mc.x + "px";
                                  dlgdiv.style.width = "85px"; });
    },


    noticesmenu: function () {
        var i, html = [], name, profref, mc;
        for(i = 0; i < notices.length; i += 1) {
            name = "";
            profref = app.lcs.getRef("prof", notices[i].noticeprof);
            if(profref.prof) {
                name = profref.prof.name; }
            html.push(
                ["div", {id: "noticediv" + i, cla: "noticediv"},
                 ["a", {href: "#" + name,
                        onclick: jt.fs(notices[i].noticefunc)},
                  [notices[i].noticetype,
                   ["br"],
                   name]]]); }
        html = app.layout.dlgwrapHTML("", html);
        mc = jt.geoPos(jt.byId('noticemenudiv'));
        mc.x = Math.min(mc.x, app.winw - 210); //width below + 20
        mc.y = mc.y || 1;  //have to specify something to avoid default
        app.layout.openDialog({x: mc.x, y: mc.y}, jt.tac2html(html),
                              //override the dialog screen overflow protection
                              function () {
                                  var dlgdiv = jt.byId('dlgdiv');
                                  dlgdiv.style.left = mc.x + "px";
                                  dlgdiv.style.width = "175px"; });
    },


    display: function () {
        displayNoticesMenu();
        displayMainMenu();
    },


    rebuildNotices: function () {
        notices = [];
        app.org.checkForNotices();
        app.contact.checkForNotices(app.menu.rebuildNotices);
        app.menu.display();
    },


    profload: function (profref) {
        jt.log("app.menu preloaded profile " + profref.profid);
    }

};  //end of returned functions
}());

