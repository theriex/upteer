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
        topskills = null,
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
        var url;
        if(!topskills) {
            url = "topkeys?" + app.login.authparams() + "&search=profile";
            jt.call('GET', url, null,
                    function (keyobjs) {
                        topskills = keyobjs[0].keys.csvarray();
                        initSkillsKeywords(mode); },
                    app.failf(function (code, errtxt) {
                        jt.err("Skill keywords retrieval failed " + code + 
                               ": " + errtxt); }),
                    jt.semaphore("opp.skillkeywords"));
            return; }
        if(skillskw) {
            skillskw.destroy(); }
        skillskw = app.kwentry("skillsdiv", "Desired Skills",
                               topskills, curropp.skills);
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
        else if(opp.spacetime.schedule === "See Calendar") {
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
                line.push(["span", {id: "remopp" + i, cla: "orgx",
                                    onclick: jt.fs("app.opp.removeOpp('" +
                                        jt.instId(oppref.opp) + "','" +
                                        oppref.opp.name + "','" +
                                        oppref.opp.status + "')")},
                           "x"]); }
            line.push(["span", {id: "oppname" + i, cla: "oppnamespan"},
                       ["a", {href: "#view=opp&oppid=" + jt.instId(oppref.opp),
                              onclick: jt.fs("app.opp.display('" +
                                             jt.instId(oppref.opp) + "')")},
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
            html.push(["button", {id: "addoppb", cla: "kwplus",
                                  onclick: jt.fs(addfstr)},
                       "+"]); }
        else {
            html.push(["a", {href: "#embed",
                             onclick: jt.fs("app.opp.togembed('" + 
                                            jt.instId(org) + "','" + 
                                            org.name + "')")},
                       ["span", {cla: "embedlinkspan", id: "embedlinkspan"}, 
                        "embed"]]); }
        html.push(["div", {id: "embedlinkdiv"}]);
        html.push(["div", {id: "opplistdiv", cla: "orglistdiv"}]);
        jt.out(dispdivid, jt.tac2html(html));
        app.lcs.resolveCSV("opp", org.opportunities, function (opprefs) {
            displayOpps(org, opprefs, mode); });
    },


    ziplink = function (zip) {
        var url="https://maps.google.com?q=" + zip;
        return ["span", {cla: "ziplinkspan"},
                ["a", {href: "#" + zip,
                       onclick: jt.fs("window.open('" + url + "')")},
                 zip]];
    },


    opplink = function (opp) {
        var refp, fstr, oppid = jt.instId(opp);
        refp = "?view=opp&oppid=" + oppid;
        fstr = jt.fs("app.opp.flcto('" + oppid + "')");
        if(app.embed && !(app.embparams.logret && app.login.isLoggedIn())) {
            fstr = jt.fs("window.open('" + app.secsvr + refp + "')"); }
        return ["a", {href: refp, onclick: fstr},
                opp.name];
    },


    oppListFull = function (org, opprefs) {
        var html = [], i, opp, kw = null;
        app.org.setCurrentOrganization(org);
        opprefs.sort(function (a, b) {
            if(a.opp && !b.opp) { return -1; }
            if(!a.opp && b.opp) { return 1; }
            a = a.opp;
            b = b.opp;
            if(a.status === "Open" && b.status !== "Open") { return -1; }
            if(a.status !== "Open" && b.status === "Open") { return 1; }
            if(a.modified < b.modified) { return 1; }
            if(a.modified > b.modified) { return -1; }
            return 0; });
        for(i = 0; i < opprefs.length; i += 1) {
            opp = opprefs[i].opp;
            if(!opp || opp.status !== "Open") {
                if(i === 0) {
                    html = "No Opportunities Found."; }
                break; }
            html.push(
                ["div", {cla: "oppdispdiv"},
                 [["div", {cla: "oppnamediv"},
                   ["span", {id: "oppname" + i, cla: "oppnamespan"},
                    opplink(opp)]],
                  ["div", {id: "oppdescdiv" + i, cla: "bigtxtdiv"},
                   jt.linkify(opp.description || "")],
                  ["div", {cla: "oppdetailsdiv"},
                   ["table", {cla: "formtable"},
                    [["tr",
                      ["td", {colspan: 2},
                       ["div", {id: "oppskillsdiv" + i}]]],
                     ["tr",
                      [["td", {cla: "tdnarrow"},
                        [ziplink(opp.zipcode),
                         ["label", {fo: "schedsel", cla: "formlabel"},
                         "Schedule:"]]],
                       ["td", {align: "left"},
                        scheduleDescription(opp)]]],
                     ["tr",
                      ["td", {colspan: 2},
                       ["div", {id: "oppaccessdiv" + i}]]]]]]]]); }
        jt.out('contentdiv', jt.tac2html(html));
        for(i = 0; i < opprefs.length; i += 1) {
            opp = opprefs[i].opp;
            if(kw) {
                kw.destroy(); }
            kw = app.kwentry("oppskillsdiv" + i, "", null, opp.skills);
            kw.displayList();
            kw.destroy();
            kw = app.kwentry("oppaccessdiv" + i, "", null, opp.accessibility);
            kw.displayList(); }
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
        html = ["div", {id: "oppdispdiv", cla: "oppdispdiv"},
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
        verifyOpportunityFieldValues(curropp);  //fill defaults if needed
        jt.out('contentdiv', "Fetching organization " + curropp.organization);
        org = app.lcs.getRef("org", curropp.organization);
        if(org.status === "not cached") {
            app.lcs.getFull("org", curropp.organization, function (orgref) {
                app.opp.display(opp); });
            return; }
        if(!org.org) {
            jt.out('contentdiv', "Org " + curropp.organization + "not found.");
            return; }
        org = org.org;
        app.history.checkpoint({view: "opp", oppid: jt.instId(curropp)});
        profid = jt.instId(app.profile.getMyProfile());
        imgsrc = org.details.logourl || "img/blank.png";
        html = ["div", {id: "oppdispdiv", cla: "oppdispdiv"},
                ["table", {cla: "formtable"},
                 [["tr",
                   [["td", {id: "orgpictd", cla: "tdnarrow",
                            rowspan: 3, align: "right"},
                      ["div", {id: "orgpicdiv"},
                       ["a", {href: "#" + jt.dquotenc(org.name),
                              onclick: jt.fs("app.org.display('" +
                                             jt.instId(org) + "')")},
                        ["img", {cla: "orgpic", src: imgsrc}]]]],
                    ["td", {align: "left", cla: "valpadtd"},
                     curropp.name]]],
                  ["tr",
                   [//pic html extends into here
                    ["td", {align: "left", cla: "valpadtd"},
                     ziplink(curropp.zipcode)]]],
                  ["tr",
                   [//pic html extends into here
                    ["td", {align: "left", cla: "valpadtd"},
                      curropp.status]]],
                  ["tr",
                   ["td", {colspan: 2},
                    ["div", {id: "descripdiv", cla: "bigtxtdiv"},
                     jt.linkify(curropp.description || "")]]],
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
                   [["td", {align: "right"},
                     ["label", {fo: "contact", cla: "formlabel"},
                      "Contact:"]],
                    ["td", {align: "left"},
                     ["div", {id: "contactlistdiv", cla: "refcsvdiv"}]]]],
                  ["tr", ["td", {colspan: 2}, ["div", {id: "wpsoppdiv"}]]],
                  ["tr",
                   ["td", {colspan: 2},
                    ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"}]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        html = [["button", {type: "button", id: "orgbackb",
                            onclick: jt.fs("window.history.back()")},
                 "&#x21B0; Back"]];
        if(org.administrators.csvcontains(profid) || 
           curropp.contact.csvcontains(profid)) {
            html.push(["button", {type: "button", id: "oppeditb",
                                  onclick: jt.fs("app.opp.edit()")},
                       "Edit"]);
            html.push(["button", {type: "button", id: "srchvolsb",
                                  onclick: jt.fs("app.match.init('" +
                                                 jt.instId(curropp) + "')")},
                       "Find Volunteers"]); }
        jt.out('formbuttonsdiv', jt.tac2html(html));
        app.limitwidth("descripdiv");
        app.limitwidth("accdescdiv");
        initAccessKeywords();
        initSkillsKeywords();
        app.contact.wpsOpportunityDisplay("wpsoppdiv", curropp);
        app.profile.displayProfileRefs(curropp.contact, 'contactlistdiv');
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


    byoppid: function (oppid) {
        app.opp.display(oppid);
    },


    getCurrentOpportunity: function () {
        return curropp;
    },


    listOpportunities: function (dispdivid, org, mode, addfstr) {
        rebuildOpportunityDisplay(dispdivid, org, mode, addfstr);
    },


    extListOpps: function (orgid) {
        app.history.checkpoint({view: "embopps", orgid: orgid});
        jt.out('contentdiv', "Finding volunteer opportunities...");
        app.lcs.getFull("org", orgid, function (orgref) {
            var org = orgref.org;
            app.lcs.resolveCSV("opp", org.opportunities, function (opprefs) {
                oppListFull(org, opprefs); }); });
    },


    flcto: function (oppid) {
        if(app.login.isLoggedIn()) {
            app.profile.display(function () {
                app.login.displayAccountNameMenu();
                app.menu.display();
                app.opp.display(oppid); }); }
        else {
            app.login.init("normal"); }
    },


    togembed: function (orgid, orgname) {
        var html;
        html = jt.byId("embedlinkdiv").innerHTML;
        if(html) {
            jt.out("embedlinkspan", "embed");
            jt.out("embedlinkdiv", "");
            return; }
        jt.out("embedlinkspan", "close embed");
        html = ["div", {cla: "embedinstructdiv"},
                [["To embed available opportunities at " + orgname + 
                  ", paste this html into your web page where you want the opportunities to be displayed:"],
                 ["div", {cla: "embedhtmldiv"},
                  ["textarea", {id: "oppsembedta", cla: "codeta"}]],
                 ["div", {cla: "embedstyleseldiv"},
                  [["span", {cla: "embedlinkspan"},
                    "Look and feel "],
                   ["select", {cla: "stylesel", id: "embedstylesel",
                               onchange: jt.fs("app.opp.embedstyle('" + 
                                               orgid + "')")},
                    [["option", {value: "standard"}, "standard"],
                     ["option", {value: "blue"}, "blue"],
                     ["option", {value: "green"}, "green"]]]]]]];
        jt.out("embedlinkdiv", jt.tac2html(html));
        app.opp.embedstyle(orgid);
    },


    embedstyle: function (orgid) {
        var site, stylesel, ta;
        site = window.location.href;
        if(site.endsWith("/")) {
            site = site.slice(0, -1); }
        stylesel = jt.byId("embedstylesel");
        if(stylesel && stylesel.value !== "standard") {
            stylesel = "<div id=\"upteercssoverride\">" + site + "/css/" +
                stylesel.value + ".css</div>\n"; }
        else {
            stylesel = ""; }
        ta = jt.byId("oppsembedta");
        if(ta) {
            ta.readOnly = true;
            ta.value = stylesel +
                "<div id=\"upteerdisplaydiv\"><a href=\"" + site +
                "?view=org&orgid=" + orgid + "\">upteer</a></div>\n" +
                "<script src=\"" + site + "/js/embed.js\"></script>\n"; }
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

