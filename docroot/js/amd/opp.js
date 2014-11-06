/*global app: false, jt: false, setTimeout: false, window: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// Volunteer Opportunity forms and functionality
// Notes:
//  - The accounting start time is either the hard start time specified
//    by the opportunity (if available), or the date when the first
//    volunteer is accepted.  The opportunity must be closed out and the
//    hours settled after at most 93 (length of 4th qtr + 1) days.
//  - An opportunity (even an expired one) can be renewed.  If there is
//    any accounting necessary, then the existing opportunity is first
//    cloned into a new opportunity.  The times are adjusted as needed.
//    Volunteers are not carried forward into the new opportunity.  The
//    coordinator can tell their volunteers to apply for the renewed
//    opportunity if they want, but there is no automatic signup.
//  - An opportunity expires if it hasn't been modified in 93 days.
//    Expiration notice mail is sent 15 days before, 4 days before, and
//    on expiration.
//  - An opportunity name must be unique within an organization across
//    all the opportunities that are currently open.
// 


app.opp = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var curropp = null,
        accesskw = null,
        skillskw = null,
        statusvals = [ "Inactive", "Open", "Closed" ],
        schedvals = [ "Flexible", "As Described", "See Calendar" ],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    verifyOpportunityFieldValues = function (opp) {
        var org = app.org.getCurrentOrganization();
        opp = opp || {};
        opp.name = opp.name || "";
        //name_c: updated by server
        opp.organization = opp.organization || jt.instId(org);
        opp.contact = opp.contact || jt.instId(app.profile.getMyProfile());
        //modified: updated by server
        opp.accstart = opp.accstart || "";
        opp.zipcode = opp.zipcode || "";
        opp.status = opp.status || "Inactive";
        opp.description = opp.description || "";
        opp.accessibility = opp.accessibility || "";
        opp.accesscomment = opp.accesscomment || "";
        opp.skills = opp.skills || "";
        opp.spacetime = opp.spacetime || {};
        opp.spacetime.minHours = opp.spacetime.minHours || 1;
        opp.spacetime.maxHours = opp.spacetime.maxHours || 0; 
        opp.spacetime.schedule = opp.spacetime.schedule || schedvals[0];
        opp.spacetime.schdescr = opp.spacetime.schdescr || "";
        opp.spacetime.schedcal = opp.spacetime.schedcal || "";
    },


    readOppFormValues = function () {
        var org, zip, domelem;
        org = app.org.getCurrentOrganization();
        zip = (org.details && org.details.zipcode) || "";
        curropp.name = jt.safeget('namein', 'value') || "";
        //name_c: updated by server
        //organization: already set
        //contact: already set by form processing
        //modified: updated by server
        //accstart: updated by server
        curropp.zipcode = jt.safeget('zipin', 'value') || zip;
        domelem = jt.byId('statussel');
        if(domelem) {
            curropp.status = statusvals[domelem.selectedIndex]; }
        curropp.status = curropp.status || "Inactive";
        domelem = jt.byId('descriptxt');
        if(domelem) {
            curropp.description = domelem.value; }
        curropp.description = curropp.description || "";
        curropp.accessibility = accesskw.getSelectedKeywordsCSV();
        domelem = jt.byId('accdesctxt');
        if(domelem) {
            curropp.accesscomment = domelem.value; }
        curropp.accesscomment = curropp.accesscomment || "";
        curropp.skills = skillskw.getSelectedKeywordsCSV();
        curropp.spacetime = curropp.spacetime || {};
        curropp.spacetime.minHours = jt.safeget('minhoursin', 'value') || "1";
        curropp.spacetime.maxHours = jt.safeget('maxhoursin', 'value') || "0";
        curropp.spacetime.schedule = jt.safeget('schedulein', 'value') || 
            curropp.spacetime.schedule;
        curropp.spacetime.schdescr = jt.safeget('schdescrin', 'value') || 
            curropp.spacetime.schdescr;
        curropp.spacetime.schedcal = jt.safeget('schedcalin', 'value') ||
            curropp.spacetime.schedcal;
        if(!curropp.name) {
            jt.out('oppstatdiv', "The opportunity must have a name");
            return false; }
        return true;
    },


    selectionOptions = function (idbase, optvals, currval) {
        var options = [], i;
        for(i = 0; i < optvals.length; i += 1) {
            options.push(
                ["option", {id: idbase + (+i),
                            selected: jt.toru(currval === optvals[i],
                                              "selected")},
                 optvals[i]]); }
        return options;
    },


    initAccessKeywords = function (mode) {
        if(accesskw) {
            accesskw.destroy(); }
        accesskw = app.kwentry("accessdiv", "Accessibility", [
            "Remote Work Ok", "Wheelchair Accessible", 
            "Impaired Vision Accessible", "Service Animal Ok",
            "Accompanying Companion Ok", "Accompanying Child Ok"], 
                               curropp.accessibility);
        if(mode === "edit") {
            accesskw.displayEntry(); }
        else {
            accesskw.displayList(); }
    },


    initSkillsKeywords = function (mode) {
        if(skillskw) {
            skillskw.destroy(); }
        skillskw = app.kwentry("skillsdiv", "Desired Skills", [
            "Graphic Design", "Web Development", "Video Production",
             "Web Technology", "GIS", "Quilting", "Technical Writing",
             "Warehouse Management", "Grant Writing", "Copy Editing", 
             "Land Use Research", "Dog Fostering", "Photography",
             "Print Graphics", "Architectural Drawing", "Law"], 
                               curropp.skills);
        if(mode === "edit") {
            skillskw.displayEntry(); }
        else {
            skillskw.displayList(); }
    },


    hourDescription = function (opp) {
        var hours = opp.spacetime.minHours;
        if(opp.spacetime.maxHours) {
            hours += " to " + curropp.spacetime.maxHours + " hours"; }
        else if(hours === "1") {
            hours = ""; } //not even worth mentioning lowest default time req
        else {
            hours = "Minimum " + hours + " hours"; }
        return hours;
    },


    scheduleDescription = function (opp) {
        var retval = "Flexible";
        if(opp.spacetime.schedule === "As Described") {
            retval = opp.spacetime.schdescr; }
        else if(opp.spacetime === "See Calendar") {
            retval = ["a", {href: opp.spacetime.schedcal,
                            onclick: jt.fs("window.open('" + 
                                           opp.spacetime.schedcal + "')")},
                      "See Calendar"]; }
        return retval;
    },


    displayOpps = function (org, opprefs, mode) {
        var i, html = [], line, oppref;
        if(!opprefs.length) {
            jt.out('opplistdiv', "No volunteer opportunities");
            return; }
        for(i = 0; i < opprefs.length; i += 1) {
            oppref = opprefs[i];
            line = [];
            if(mode === "edit") {
                line.push(["span", {id: "remopp" + i, cla: "oppx",
                                    onclick: jt.fs("app.opp.removeOpp('" +
                                        jt.instId(oppref.opp) + "','" +
                                        oppref.opp.name + "','" +
                                        oppref.opp.status + "')")},
                           "x"]); }
            line.push(["span", {id: "oppname" + i, cla: "oppnamespan"},
                       ["a", {href: "#",
                              onclick: jt.fs("app.opp.display(" +
                                             jt.instId(oppref.opp) + ")")},
                        oppref.opp.name]]);
            line.push(["span", {id: "oppstat" + i, cla: "oppstatus"},
                       " (" + oppref.opp.status + ")"]);
            html.push(["div", {cla: "oppsummaryline"}, line]); }
        jt.out('opplistdiv', jt.tac2html(html));
    },


    rebuildOpportunityDisplay = function (dispdivid, org, mode, addfstr) {
        var html;
        html = [["span", {id: "opptitle", cla: "sectiontitle"},
                 "Opportunities"]];
        if(mode === "edit") {
            html.push(["button", {id: "addoppb", cla: "sectionentryplus",
                                  onclick: jt.fs(addfstr)},
                       "+"]); }
        html.push(["div", {id: "opplistdiv", cla: "opplistdiv"}]);
        jt.out(dispdivid, jt.tac2html(html));
        app.lcs.resolveCSV("opp", org.opportunities, function (opprefs) {
            displayOpps(org, opprefs, mode); });
    };



    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    schedtype: function () {
        var type, schedsel = jt.byId("schedsel");
        if(schedsel) {
            type = schedvals[schedsel.selectedIndex];
            curropp.spacetime.schedule = type;
            if(type === "As Described") {
                jt.byId('schdescrintr').style.display = "table-row";
                jt.byId('schedcalintr').style.display = "none"; }
            else if(type === "See Calendar") {
                jt.byId('schdescrintr').style.display = "none";
                jt.byId('schedcalintr').style.display = "table-row"; }
            else {
                jt.byId('schdescrintr').style.display = "none";
                jt.byId('schedcalintr').style.display = "none"; } }
    },


    add: function () {
        curropp = { zipcode: app.org.getCurrentOrganization().details.zip };
        app.opp.edit();
    },


    edit: function () {
        var html;
        verifyOpportunityFieldValues(curropp);
        html = ["div", {id: "oppdispdiv"},
                [["div", {id: "oppstatdiv"}],
                 ["table", {cla: "formtable"},
                  [app.lvtr("namein", "Name", curropp.name, 
                            "Name of this opportunity"),
                   //organization cannot be modified
                   //ATTENTION: contact field editing
                   app.lvtr("zipin", "Zip", curropp.zipcode, "96817 or ?"),
                   ["tr",
                    [["td", {align: "right"},
                      ["label", {fo: "statussel", cla: "formlabel"},
                       "Status"]],
                     ["td", {align: "left"},
                      ["select", {id: "statussel"},
                       selectionOptions("so", statusvals, curropp.status)]]]],
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "descripdiv", cla: "bigtxtdiv"},
                      ["textarea", {id: "descriptxt", cla: "bigta"}]]]],
                   ["tr", ["td", {colspan: 2}, ["div", {id: "accessdiv"}]]],
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "accdescdiv", cla: "bigtxtdiv"},
                      ["textarea", {id: "accdesctxt", cla: "bigta"}]]]],
                   ["tr", ["td", {colspan: 2}, ["div", {id: "skillsdiv"}]]],
                   ["tr",
                    [["td", {align: "right", valign: "top"},
                      ["span", {cla: "formlabel"}, "Hours"]],
                     ["td", {align: "left"},
                      [["label", {fo: "minhoursin", cla: "formlabel"}, "Min "],
                       ["input", {type: "text", id: "minhoursin", 
                                  value: curropp.spacetime.minHours || "1",
                                  name: "minhoursin", size: 4}],
                       ["label", {fo: "maxhoursin", cla: "formlabel"}, " Max "],
                       ["input", {type: "text", id: "maxhoursin",
                                  value: curropp.spacetime.maxHours || "",
                                  name: "maxhoursin", size: 4}]]]]],
                   ["tr",
                    [["td", {align: "right"},
                      ["label", {fo: "schedsel", cla: "formlabel"},
                       "Schedule"]],
                     ["td", {align: "left"},
                      ["select", {id: "schedsel",
                                  onchange: jt.fs("app.opp.schedtype()")},
                       selectionOptions("sch", schedvals, 
                                        curropp.spacetime.schedule)]]]],
                   app.lvtr("schdescrin", "Description",
                            curropp.spacetime.schdescr, ""),
                   app.lvtr("schedcalin", "Calendar",
                            curropp.spacetime.schedcal, 
                            "https://www.google.com/calendar", "url"),
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"},
                      ["button", {type: "button", id: "orgsaveb",
                                  onclick: jt.fs("app.opp.save()")},
                       "Save"]]]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        app.initTextArea("descriptxt", curropp.description, 
                         "What would you like volunteers to do?");
        initAccessKeywords("edit");
        app.initTextArea("accdesctxt", curropp.accesscomment,
                         "Any clarifications or caveats on access?");
        initSkillsKeywords("edit");
        app.opp.schedtype();
    },


    save: function (directive) {
        var bdiv, html, data;
        if(directive === "noform" || readOppFormValues()) {
            bdiv = jt.byId("formbuttonsdiv");
            if(bdiv) {
                html = bdiv.innerHTML;
                jt.out('formbuttonsdiv', "Saving..."); }
            app.opp.serializeFields(curropp);
            data = jt.objdata(curropp);
            app.opp.deserializeFields(curropp);  //in case fail or interim use
            jt.call('POST', "oppsave?" + app.login.authparams(), data,
                    function (results) {
                        app.lcs.put("opp", results[0]);
                        curropp = results[0];
                        app.lcs.put("org", results[1]);
                        app.org.setCurrentOrganization(results[1]);
                        if(!jt.instId(curropp)) {
                            setTimeout(function () {
                                app.org.addOpportunity(jt.instId(curropp)); },
                                       200); }
                        app.opp.display(curropp); },
                    app.failf(function (code, errtxt) {
                        if(html) {
                            jt.out('formbuttonsdiv', html); }
                        jt.out('oppstatdiv', "save failed " + code + 
                               ": " + errtxt); }),
                    jt.semaphore("opp.save")); }
    },


    display: function (opp) {
        var org, profid, imgsrc, html;
        if(opp && typeof opp === "object" && opp.opp) {
            curropp = opp.opp; }
        else if(opp) {
            return app.lcs.getFull("opp", opp, app.opp.display); }
        app.history.checkpoint({view: "opp", orgid: jt.instId(curropp)});
        verifyOpportunityFieldValues(curropp);  //fill defaults if needed
        org = app.org.getCurrentOrganization();
        profid = jt.instId(app.profile.getMyProfile());
        imgsrc = org.details.logourl || "img/blank.png";
        html = ["div", {id: "oppdispdiv"},
                ["table", {cla: "formtable"},
                 [["tr",
                   [["td", {id: "orgpictd", cla: "tdnarrow",
                            rowspan: 3, align: "right"},
                      ["div", {id: "orgpicdiv"},
                       //ATTENTION: Make this a link to display the org
                       ["img", {cla: "orgpic", src: imgsrc}]]],
                     ["td", {align: "left", cla: "valpadtd"},
                      curropp.name]]],
                  ["tr",
                   [//pic html extends into here
                    ["td", {align: "left", cla: "valpadtd"},
                      curropp.zipcode]]],
                  ["tr",
                   [//pic html extends into here
                    ["td", {align: "left", cla: "valpadtd"},
                      curropp.status]]],
                  ["tr",
                   ["td", {colspan: 2},
                    ["div", {id: "descripdiv", cla: "bigtxtdiv"},
                     jt.linkify(curropp.description || "")]]],
                  //ATTENTION: contact profile links
                  ["tr", ["td", {colspan: 2}, ["div", {id: "accessdiv"}]]],
                  ["tr",
                   ["td", {colspan: 2},
                    ["div", {id: "accdescdiv", cla: "bigtxtdiv"},
                     jt.linkify(curropp.accesscomment || "")]]],
                  ["tr", ["td", {colspan: 2}, ["div", {id: "skillsdiv"}]]],
                  ["tr",
                   ["td", {colspan: 2},
                    hourDescription(curropp)]],
                  ["tr",
                   [["td", {align: "right"},
                     ["label", {fo: "schedsel", cla: "formlabel"},
                      "Schedule:"]],
                    ["td", {align: "left"},
                     scheduleDescription(curropp)]]],
                  ["tr",
                   ["td", {colspan: 2},
                    ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"}]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        html = [["button", {type: "button", id: "orgbackb",
                            onclick: jt.fs("app.history.pop()")},
                 "&#x21B0; Back"]];
        if(org.administrators.csvcontains(profid) || 
           opp.contact.csvcontains(profid)) {
            html.push(["button", {type: "button", id: "oppeditb",
                                  onclick: jt.fs("app.opp.edit()")},
                       "Edit"]); }
        jt.out('formbuttonsdiv', jt.tac2html(html));
        app.limitwidth("descripdiv");
        app.limitwidth("accdescdiv");
        initAccessKeywords();
        initSkillsKeywords();
    },


    removeOpp: function (oppid, name, status) {
        var org = app.org.getCurrentOrganization();
        if(status === "Open") {
            jt.err("You need to close this opportunity before removing it");
            return; }
        if(!window.confirm("Are you sure you want to delete " + name + "?")) {
            return; }
        org.opportunities = org.opportunities.csvremove(oppid);
        app.lcs.resolveCSV("opp", org.opportunities, function (opprefs) {
            displayOpps(org, opprefs, "edit"); });
    },


    listOpportunities: function (dispdivid, org, mode, addfstr) {
        rebuildOpportunityDisplay(dispdivid, org, mode, addfstr);
    },


    serializeFields: function (opp) {
        if(typeof opp.spacetime === 'object') {
            opp.spacetime = JSON.stringify(opp.spacetime); }
    },


    deserializeFields: function (opp) {
        app.lcs.reconstituteJSONObjectField("spacetime", opp);
        if(opp.spacetime.maxHours === "0") {
            opp.spacetime.maxHours = ""; }
    }

};  //end of returned functions
}());
