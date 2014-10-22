/*global app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// Display an organization that utilizes volunteers
//

app.org = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var currorg = null,
        errdivid = "",


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    associationalStatus = function (prof, orgref) {
        var profid = jt.instId(prof);
        if(!orgref || !orgref.org) {
            return "Unknown"; }
        if(orgref.org.administrators.csvcontains(profid)) {
            return "Admin"; }
        if(orgref.org.coordinators.csvcontains(profid)) {
            return "Coordinator"; }
        return "Pending";
    },


    displayOrgs = function (prof, mode) {
        var i, html = [], line, isSelf, orgref, orgstat;
        if(!prof.orgrefs.length) {
            jt.out('orglistdiv', "No associated organizations");
            return; }
        isSelf = jt.instId(prof) === jt.instId(app.profile.getMyProfile());
        for(i = 0; i < prof.orgrefs.length; i += 1) {
            orgref = prof.orgrefs[i];
            orgstat = associationalStatus(prof, orgref);
            if(isSelf || orgstat === "Admin" || orgstat === "Coordinator") {
                line = [];
                if(mode === "edit") {
                    line.push(["span", {id: "remorg" + i, cla: "orgx",
                                onclick: jt.fs("app.org.removeOrg(" + i + ")")},
                               "x"]); }
                line.push(["span", {id: "stat" + i, cla: "orgstatus"},
                           orgstat]);
                line.push(["span", {id: "orgname" + i, cla: "orgnamespan"},
                           ["a", {href: "#",
                                  onclick: jt.fs("app.org.display(" + 
                                                 jt.instId(orgref.org) + ")")},
                            orgref.org.name]]);
                html.push(["div", {cla: "orgsummaryline"}, line]); } }
        jt.out('orglistdiv', jt.tac2html(html));
    },


    rebuildOrganizationDisplay = function (dispdiv, prof, mode) {
        var html;
        html = [["span", {id: "orgtitle", cla: "sectiontitle"}, 
                 "Organizations"]];
        if(mode === "edit") {
            html.push(["button", {id: "addorgb", cla: "sectionentryplus",
                                  onclick: jt.fs("app.org.add()")},
                       "+"]); }
        html.push(["div", {id: "orglistdiv", cla: "orglistdiv"}]);
        jt.out(dispdiv, jt.tac2html(html));
        if(prof.orgrefs) {
            return displayOrgs(prof, mode); }
        app.lcs.resolveCSV("org", prof.orgs, function(orgrefs) {
            prof.orgrefs = orgrefs;
            displayOrgs(prof, mode); });
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    add: function () {
        jt.err("TODO: Adding an organization not implemented yet");
    },


    enable: function (dispdivid, errordivid) {
        errdivid = errordivid;
        rebuildOrganizationDisplay(dispdivid, app.profile.getMyProfile(), 
                                   "edit");
        return true;
    },


    disable: function (dispdiv, errdiv) {
        var orgs = app.profile.getMyProfile().orgs.csvarray();
        if(orgs.length > 0) {
            jt.out(errdiv, "Delete your organization affiliations first..");
            return false; }
        jt.out(dispdiv, "");
        return true;
    }

};  //end of returned functions
}());

