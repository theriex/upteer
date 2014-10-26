/*global app: false, jt: false, setTimeout: false */

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
        autocomporgs = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    verifyOrganizationFieldValues = function(org) {
        org = org || {};
        org.name = org.name || "";
        //name_c: updated by server
        //modified: updated by server
        org.status = org.status || "Pending";
        org.administrators = org.administrators || 
            jt.instId(app.profile.getMyProfile());
        org.coordinators = org.coordinators || "";
        org.unassociated = org.unassociated || "";
        org.details = org.details || {};
        org.details.logourl = org.details.logourl || "";
        org.details.siteurl = org.details.siteurl || "";
        org.details.phone = org.details.phone || "";
        org.details.email = org.details.email || "";
        org.details.addr = org.details.addr || "";
        org.details.city = org.details.city || "";
        org.details.state = org.details.state || "";
        org.details.zip = org.details.zip || "";
        org.details.applyurl = org.details.applyurl || "";
    },


    readFormValues = function () {
        currorg.name = jt.safeget('namein', 'value') || "";
        //name_c: updated by server
        //modified: updated by server
        //status: already set via form link action
        //adminstrators: already modified via form link action
        //coordinators: ditto
        //unassociated: ditto
        currorg.details = currorg.details || {};
        currorg.details.logourl = jt.safeget('logourlin', 'value') || "";
        currorg.details.siteurl = jt.safeget('siteurlin', 'value') || "";
        currorg.details.phone = jt.safeget('phonein', 'value') || "";
        currorg.details.email = jt.safeget('emailin', 'value') || "";
        currorg.details.addr = jt.safeget('addrin', 'value') || "";
        currorg.details.city = jt.safeget('cityin', 'value') || "";
        currorg.details.state = jt.safeget('statein', 'value') || "";
        currorg.details.zip = jt.safeget('zipin', 'value') || "";
        currorg.details.applyurl = jt.safeget('appurlin', 'value') || "";
        if(!currorg.name) {
            jt.out('orgstatdiv', "Your organization must have a name");
            return false; }
        return true;
    },


    orgStatusEditValue = function (org) {
        var statval;
        statval = currorg.status;
        switch(statval) {
        case "Pending":
            statval = jt.tac2html(
                ["a", {href: "#Activate",
                       onclick: jt.fs("app.org.activate()")},
                 "Pending"]);
            break;
        case "Approved":
            statval += " " + jt.tac2html(
                ["a", {href: "#Deactivate", cla: "subtext",
                       onclick: jt.fs("app.org.deactivate()")},
                 "Deactivate"]);
            break;
        case "Inactive":
            statval = jt.tac2html(
                ["a", {href: "#Reactivate",
                       onclick: jt.fs("app.org.reactivate()")},
                 "Inactive"]);
            break;
        }
        return statval;
    },


    addressLink = function (org) {
        var addr, url, html;
        addr = org.details.addr + (org.details.addr? ", " : "") + 
            org.details.city + " " + org.details.state +  " " + 
            org.details.zip;
        url = "http://maps.google.com?q=" + jt.embenc(addr);
        html = ["a", {href: url, 
                      onclick: jt.fs("window.open('" + url + "')")},
                addr];
        return jt.tac2html(html);
    },


    lvtr = function (id, label, val, placeholder, type) {
        type = type || "text";
        return ["tr",
                [["td", {align: "right"},
                  ["label", {fo: id, cla: "formlabel"},
                   label]],
                 ["td", {align: "left"},
                  ["input", {type: type, id: id, name: id,
                             value: val, size: 30,
                             placeholder: placeholder}]]]];
    },


    assocStatus = function (prof, org) {
        var profid = jt.instId(prof);
        if(!org) {
            return "Unknown"; }
        if(org.administrators.csvcontains(profid)) {
            return "Administrator"; }
        if(org.coordinators.csvcontains(profid)) {
            return "Coordinator"; }
        if(org.unnassociated.csvcontains(profid)) {
            return "Pending"; }
        return "Not Associated";
    },


    displayOrgs = function (prof, mode) {
        var i, html = [], line, isSelf, orgref, orgstat;
        if(!prof.orgrefs.length) {
            jt.out('orglistdiv', "No associated organizations");
            return; }
        isSelf = jt.instId(prof) === jt.instId(app.profile.getMyProfile());
        for(i = 0; i < prof.orgrefs.length; i += 1) {
            orgref = prof.orgrefs[i];
            orgstat = assocStatus(prof, orgref.org);
            if(isSelf || orgstat === "Administrator" || 
                   orgstat === "Coordinator") {
                line = [];
                if(mode === "edit") {
                    line.push(["span", {id: "remorg" + i, cla: "orgx",
                                onclick: jt.fs("app.org.removeOrg(" + i + ")")},
                               "x"]); }
                line.push(["span", {id: "orgname" + i, cla: "orgnamespan"},
                           ["a", {href: "#",
                                  onclick: jt.fs("app.org.display(" + 
                                                 jt.instId(orgref.org) + ")")},
                            orgref.org.name]]);
                line.push(["span", {id: "stat" + i, cla: "orgstatus"},
                           " (" + orgstat + ")"]);
                html.push(["div", {cla: "orgsummaryline"}, line]); } }
        jt.out('orglistdiv', jt.tac2html(html));
    },


    rebuildOrganizationDisplay = function (dispdiv, prof, mode, addfstr) {
        var html;
        html = [["span", {id: "orgtitle", cla: "sectiontitle"}, 
                 "Organizations"]];
        if(mode === "edit") {
            html.push(["button", {id: "addorgb", cla: "sectionentryplus",
                                  onclick: jt.fs(addfstr)}, 
                       "+"]); }
        html.push(["div", {id: "orglistdiv", cla: "orglistdiv"}]);
        jt.out(dispdiv, jt.tac2html(html));
        if(prof.orgrefs) {
            return displayOrgs(prof, mode); }
        app.lcs.resolveCSV("org", prof.orgs, function(orgrefs) {
            prof.orgrefs = orgrefs;
            displayOrgs(prof, mode); });
    },


    displayAutocompOrgs = function (orgs) {
        var i, html = [];
        autocomporgs = orgs;
        for(i = 0; i < orgs.length; i += 1) {
            html.push(["div", {cla: "orgsummaryline"},
                       ["a", {href: "#" + orgs[i].name, 
                              onclick: jt.fs("app.org.orgselect(" + i + ")")},
                        orgs[i].name]]); }
        jt.out('orgacdiv', jt.tac2html(html));
    },


    autocompOrgName = function () {
        var namein, val, url;
        namein = jt.byId('namein');
        if(namein) {  //form is still displayed
            val = namein.value;
            if(val && val.length > 2 && val !== currorg.name) {
                currorg.name = val;
                url = "orgnames?" + app.login.authparams() + "&pre=" + val;
                jt.call("GET", url, null,
                        function (orgs) {
                            displayAutocompOrgs(orgs);
                            autocompOrgName(); },
                        app.failf(function (code, errtxt) {
                            jt.out('orgstatdiv', "orgnames call failed " + 
                                   code + ": " + errtxt); }),
                        jt.semaphore("org.autocomp")); }
            else {
                setTimeout(autocompOrgName, 200); } }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    add: function () {
        var html;
        currorg = { administrators: jt.instId(app.profile.getMyProfile()),
                    name: "" };
        html = ["div", {id: "orgdispdiv"},
                [["div", {id: "orgstatdiv"}, 
                  "Adding your organization"],
                 ["table", {cla: "formtable"},
                  [["tr",
                    [["td", {align: "right"},
                      ["label", {fo: "namein", cla: "formlabel"}, 
                       "Name"]],
                     ["td", {align: "left"},
                      ["input", {type: "text", id: "namein", name: "namein",
                                 value: currorg.name || "", size: 20, 
                                 //no onchange.  Too easy to create mistakes
                                 placeholder: "Name of Organization"}]]]],
                   ["tr",
                    ["td", {colspan: 3},
                     ["div", {id: "orgacdiv", cla: "orglistdiv"}]]],
                   ["tr",
                    ["td", {colspan: 3},
                     ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"},
                      [["button", {type: "button", id: "orgbackb",
                                   onclick: jt.fs("app.history.pop()")},
                        "&#x21B0; Back"],
                       ["button", {type: "button", id: "orgsaveb",
                                   onclick: jt.fs("app.org.save()")},
                        "Create"]]]]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        autocompOrgName();
    },


    orgselect: function (orgindex) {
        var org, profid, html, data;
        org = autocomporgs[orgindex];
        profid = jt.instId(app.profile.getMyProfile());
        if(org.administrators.csvcontains(profid) ||
           org.coordinators.csvcontains(profid)) {
            jt.log("orgselect already member");
            app.profile.edit(); }
        else if(org.unassociated.csvcontains(profid)) {
            html = [["p", "You have already applied to be associated with"],
                    ["div", {cla: "orgsummaryline"}, org.name],
                    ["p", "Please contact one of your organization's administrators directly so they can approve you.  If the existing administrators cannot be located, please contact Upteer support."],
                    ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"},
                     ["button", {type: "button", id: "orgselokb",
                                 onclick: jt.fs("app.profile.edit()")},
                      "Ok"]]];
            jt.out('contentdiv', jt.tact2html(html)); }
        else {
            html = [["p", "Adding your association to"],
                    ["div", {cla: "orgsummaryline"}, org.name],
                    ["p", "Your association as a volunteer coordinator will need to be approved by one of your organization's administrators before you can create volunteer opportunities.  All listed administrators will see your application next time they log in, but you might want to contact one of them directly.  After they add you, log in again or click the refresh button on your browser."],
                    ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"}]];
            jt.out('contentdiv', jt.tac2html(html));
            data = jt.objdata({ orgid: jt.instId(org), profid: profid });
            jt.call('POST', "orgassoc?" + app.login.authparams(), data,
                    function (objs) {
                        app.lcs.put("prof", objs[0]);
                        app.profile.setMyProfile(objs[0]);
                        app.lcs.put("org", objs[1]);
                        currorg = objs[1];
                        jt.out('formbuttonsdiv', jt.tac2html(
                            ["button", {type: "button", id: "orgselokb",
                                        onclick: jt.fs("app.profile.edit()")},
                             "Ok"])); },
                    app.failf(function (code, errtxt) {
                        jt.out('formbuttonsdiv', "orgassoc failed " + code +
                               ": " + errtxt); }),
                    jt.semaphore("org.orgselect")); }
    },


    edit: function () {
        var html;
        verifyOrganizationFieldValues(currorg);
        html = ["div", {id: "orgdispdiv"},
                [["div", {id: "orgstatdiv"}, "&nbsp;"],
                 ["table", {cla: "formtable"},
                  [lvtr("namein", "Name", currorg.name, 
                        "Name of your organization"),
                   ["tr",
                    [["td", {align: "right"},
                      ["label", {fo: "statusin", cla: "formlabel"},
                       "Status"]],
                     ["td", {align: "left"},
                      orgStatusEditValue(currorg)]]],
                   lvtr("siteurlin", "Site URL", currorg.details.siteurl,
                        "https://yoursite.org/index.html", "url"),
                   lvtr("logourlin", 
                        ["a", {href: "#LogoURL",
                               onclick: jt.fs("app.org.logoexpl()")},
                         "Logo URL"], 
                        currorg.details.logourl,
                        "https://yoursite.org/logo.png", "url"),
                   lvtr("appurlin", 
                        ["a", {href: "#ApplicationURL",
                               onclick: jt.fs("app.org.appexpl()")},
                         "Application URL"],
                        currorg.details.applyurl,
                        "https://yoursite.org/apply.html", "url"),
                   lvtr("phonein", "Phone", currorg.details.phone,
                        "808 111 2222", "tel"),
                   lvtr("emailin", "Email", currorg.details.email,
                        "volunteer@yourorg.com", "email"),
                   lvtr("addrin", "Address", currorg.details.addr,
                        "1234 MakeThingsBetter Way"),
                   lvtr("cityin", "City", currorg.details.city, 
                        "Honolulu or ?"),
                   lvtr("statein", "State", currorg.details.state, 
                        "Hawai'i or ?"),
                   lvtr("zipin", "Zip", currorg.details.zip, "96817 or ?"),
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "adminlistdiv", cla: "refcsvdiv"}]]],
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "coordlistdiv", cla: "refcsvdiv"}]]],
                   //unnassociated members not displayed (notice only)
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "oppslistdiv", cla: "refcsvdiv"},
                      "TODO: volunteer opportunities go here"]]],
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"},
                      ["button", {type: "button", id: "orgsaveb",
                                  onclick: jt.fs("app.org.save()")},
                       "Save"]]]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        app.profile.displayProfileRefs(currorg.administrators, 'adminlistdiv',
                                       "app.org.membership");
        app.profile.displayProfileRefs(currorg.coordinators, 'coordlistdiv',
                                       "app.org.membership");
    },


    display: function (org) {
        var imgsrc, namelink, html, assoc;
        if(org && typeof org === "object" && org.org) {
            currorg = org.org; }
        else if(org) {
            return app.lcs.getFull("org", org, app.org.display); }
        app.history.checkpoint({view: "org", orgid: jt.instId(currorg)});
        verifyOrganizationFieldValues(currorg);
        assoc = assocStatus(app.profile.getMyProfile(), currorg);
        imgsrc = currorg.details.logourl || "img/blank.png";
        namelink = ["span", {cla: "namespan"}, currorg.name];
        if(currorg.details.siteurl) {
            namelink = ["a", {href: currorg.details.siteurl,
                              onclick: jt.fs("window.open('" + 
                                             currorg.details.siteurl + "')")},
                        namelink]; }
        html = ["div", {id: "orgdispdiv"},
                [["table", {cla: "formtable"},
                  [["tr",
                    [["td", {id: "orgpictd", cla: "tdnarrow", 
                             rowspan: 3, align: "right"},
                      ["div", {id: "orgpicdiv"},
                       ["img", {cla: "orgpic", src: imgsrc}]]],
                     ["td", {align: "left", cla: "valpadtd"},
                      namelink]]],
                   ["tr",
                    [//pic html extends into here
                     ["td", {align: "left", cla: "valpadtd"},
                      currorg.status]]],
                   ["tr",
                    [//pic html extends into here
                     ["td", {align: "left", cla: "valpadtd"},
                      ["a", {href: currorg.details.applyurl,
                             onclick: jt.fs("window.open('" +
                                            currorg.details.applyurl + "')")},
                       ["span", {cla: "subtext"},
                        "Volunteer Application Form(s)"]]]]],
                   ["tr",
                    [["td", {align: "left", cla: "valpadtd"},
                      ["a", {href: "mailto:" + currorg.details.email},
                       currorg.details.email]],
                     ["td", {align: "left", cla: "valpadtd"},
                      ["a", {href: "tel:" + currorg.details.phone},
                       currorg.details.phone]]]],
                   ["tr",
                    ["td", {align: "left", cla: "valpadtd", colspan: 2},
                     addressLink(currorg)]],
                   ["tr",
                    [["td", {align: "right"},
                      "Administrators:"],
                     ["td", {align: "left"},
                      ["div", {id: "adminlistdiv", cla: "refcsvdiv"}]]]],
                   ["tr",
                    [["td", {align: "right"},
                      "Coordinators:"],
                     ["td", {align: "left"},
                      ["div", {id: "coordlistdiv", cla: "refcsvdiv"}]]]],
                   //unnassociated members not displayed (notice only)
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "oppslistdiv", cla: "refcsvdiv"},
                      "TODO: volunteer opportunities go here"]]],
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"}]]]
                   ]]]];
        jt.out('contentdiv', jt.tac2html(html));
        html = [["button", {type: "button", id: "orgbackb",
                            onclick: jt.fs("app.history.pop()")},
                 "&#x21B0; Back"]];
        if(assoc === "Administrator") {
            html.push(["button", {type: "button", id: "orgeditb",
                                  onclick: jt.fs("app.org.edit()")},
                       "Edit"]); }
        jt.out('formbuttonsdiv', jt.tac2html(html));
        app.profile.displayProfileRefs(currorg.administrators, 'adminlistdiv');
        app.profile.displayProfileRefs(currorg.coordinators, 'coordlistdiv');
    },


    save: function () {
        var bdiv, html, data;
        if(readFormValues()) {
            bdiv = jt.byId("formbuttonsdiv");
            if(bdiv) {
                html = bdiv.innerHTML;
                jt.out('formbuttonsdiv', "Saving..."); }
            app.org.serializeFields(currorg);
            data = jt.objdata(currorg);
            app.org.deserializeFields(currorg);  //in case fail or interim use
            jt.call('POST', "orgsave?" + app.login.authparams(), data,
                    function (orgs) {
                        var nextf = app.org.display;
                        if(!jt.instId(currorg)) {
                            setTimeout(function () {
                                app.profile.verifyOrg(jt.instId(orgs[0])); },
                                       200);
                            nextf = app.org.edit; }
                        currorg = orgs[0];
                        app.lcs.put("org", currorg);
                        nextf(); },
                    app.failf(function (code, errtxt) {
                        if(html) {
                            jt.out('formbuttonsdiv', html); }
                        jt.out('orgstatdiv', "save failed " + code +
                               ": " + errtxt); }),
                    jt.semaphore("org.save")); }
    },


    byorgid: function (orgid) {
        //set currorg and call display...
        jt.err("TODO: org.byorgid not implemented yet");
    },


    membership: function (profid) {
        //dlg: $NAME is currently $ASSOCSTAT. You can 
        //  radios: promote, demote, remove, accept as coord/admin, reject
        //  explanation section with details of what will happen
        // update button makes the change and closes the dialog
        //The last admin may not resign. They will serve as the last
        //remaining authority if the organization is to resume
        //activity at some point.  If they are unresponsive at that
        //time, then someone looking to take over as the new admin can
        //talk to upteer support which can swap the adminID in the
        //database (provided the user and organization both check out
        //as legit)
        jt.err("TODO: org.membership not implemented yet");
    },


    activate: function () {
        var subject, body, mailref, html;
        subject = "Please approve " + currorg.name;
        body = subject + ". Organization id: " + jt.instId(currorg) + 
            "\n\nThanks,\n" + app.profile.getMyProfile().name;
        mailref = "mailto:admin@upteer.com?subject=" + jt.dquotenc(subject) +
            "&body=" + jt.dquotenc(body);
        html = [["div", {id: "contactdiv", cla: "paradiv"},
                 ["Please ",
                  ["a", {href: mailref}, "contact support"],
                  " to get your organization approved!"]],
                ["p", "All organizations need to be approved by Upteer before creating any volunteer opportunities.  This is just to verify existence and contact info, your understanding is appreciated."],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.layout.closeDialog()")},
                  "OK"]]];
        html = app.layout.dlgwrapHTML("Approval", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('okbutton').focus(); });
    },


    deactivate: function () {
        //Dialog confirming it should be switched to inactive, which
        //means no new opportunities can be created.  Existing
        //opportunities must be closed out.  Any listed admin can
        //reactivate.  Explain that an organization cannot be deleted
        //because it needs to stick around for volunteer history.  If
        //the organization was created in error and has no volunteer
        //opportunities, then contact upteer support to get rid of it.
        jt.err("TODO: org.deactivate not implemented yet");
    },


    reactivate: function () {
        //Dialog confirming confirming the status should be switched
        //back to active.  No biggie, just so they don't sit there
        //toggling the status all day.
        jt.err("TODO: org.reactivate not implemented yet");
    },


    logoexpl: function () {
        var html;
        html = [["div", {id: "expldiv", cla: "paradiv"},
                 "Upteer uses a link to your logo rather than uploading a copy, so you won't have an old version here if you make changes. To get the url of your logo, simply \"right click\" the logo on your site and copy the image location. Then paste that URL into the form field."],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.layout.closeDialog()")},
                  "OK"]]];
        html = app.layout.dlgwrapHTML("Your Logo", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('okbutton').focus(); });
    },


    appexpl: function () {
        var html;
        html = [["div", {id: "expldiv", cla: "paradiv"},
                 "If you require volunteers to fill out one or more forms, please provide a link to where they can access what they need.  The forms will be integrated into the standard Upteer volunteering process."],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.layout.closeDialog()")},
                  "OK"]]];
        html = app.layout.dlgwrapHTML("Your Logo", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('okbutton').focus(); });
    },


    serializeFields: function (org) {
        if(typeof org.details === 'object') {
            org.details = JSON.stringify(org.details); }
    },


    deserializeFields: function (org) {
        app.lcs.reconstituteJSONObjectField("details", org);
    },


    listOrganizations: function (dispdivid, prof, mode, addfstr) {
        rebuildOrganizationDisplay(dispdivid, prof, mode, addfstr);
    },


    enable: function (dispdivid, errordivid, addfstr) {
        rebuildOrganizationDisplay(dispdivid, app.profile.getMyProfile(), 
                                   "edit", addfstr);
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

