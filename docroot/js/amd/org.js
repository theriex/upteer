/*global app: false, jt: false, setTimeout: false, window: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// Display an organization that utilizes volunteers
//
// Organization affiliation cases:
//   - User creates new org: profid added to org.administrators, orgid
//     added to profile on return from new org save.
//   - User resigns from org: Their profid is removed from all org
//     references.  If they were the last administrator, then the org
//     is switched to inactive.
//   - User associates with an inactive org with no admins: They become
//     the new administrator.  Org gets vetted before reactivating.
//   - User associates with an existing org: Their profid is added to
//     org.unassociated, and the orgid is added to their prof.orgs as
//     "Pending".  Org admins are notified the new associate needs to be
//     accepted or rejected.
//       - org association on profile reads "Pending", "Coordinator",
//         "Administrator" or "Not Associated" depending on acceptance.
//       - If the user is associated with an organization that is not
//         "Active", that org status takes precedence and the association
//         status on their profile would read "Pending" or "Inactive".
//   - Admins can promote from coordinator to administrator, demote from
//     administrator to coordinator, or remove associations.
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
    },


    readFormValues = function () {
        currorg.name = jt.safeget('namein', 'value') || "";
        //name_c: updated by server
        //modified: updated by server
        //status: already set via form link action
        //administrators: already modified via form link action
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
        if(!currorg.name) {
            jt.out('orgstatdiv', "Your organization must have a name");
            return false; }
        return true;
    },


    assocStatus = function (prof, org) {
        var profid = jt.instId(prof);
        if(!org) {
            return "Unknown"; }
        if(org.administrators.csvcontains(profid)) {
            return "Administrator"; }
        if(org.coordinators.csvcontains(profid)) {
            return "Coordinator"; }
        if(org.unassociated.csvcontains(profid)) {
            return "Pending"; }
        return "Not Associated";
    },


    orgStatusEditValue = function (org) {
        var statval, assoc;
        assoc = assocStatus(app.profile.getMyProfile(), org);
        statval = currorg.status;
        if(statval === "Approved") {
            if(assoc === "Administrator") {
                statval += " " + jt.tac2html(
                    ["a", {href: "#Deactivate", cla: "subtext",
                           onclick: jt.fs("app.org.confirmDeactivate()")},
                     "Deactivate"]); } }
        else { //"Pending" or "Inactive"
            statval = jt.tac2html(
                ["a", {href: "#Activate",
                       onclick: jt.fs("app.org.activate()")},
                 statval]); }
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


    displayOrgs = function (prof, orgrefs, mode) {
        var i, html = [], line, orgref;
        if(!orgrefs.length) {
            jt.out('orglistdiv', "No associated organizations");
            return; }
        for(i = 0; i < orgrefs.length; i += 1) {
            orgref = orgrefs[i];
            if(orgref.org) {  //tolerate bad references
                line = [];
                if(mode === "edit") {
                    line.push(["span", {id: "remorg" + i, cla: "orgx",
                                        onclick: jt.fs("app.org.removeOrg('" + 
                                                       jt.instId(orgref.org) + 
                                                       "','" + 
                                                       orgref.org.name + "')")},
                               "x"]); }
                line.push(["span", {id: "orgname" + i, cla: "orgnamespan"},
                           ["a", {href: "#view=org&orgid=" + 
                                  jt.instId(orgref.org),
                                  onclick: jt.fs("app.org.display(" + 
                                                 jt.instId(orgref.org) + ")")},
                            orgref.org.name]]);
                line.push(["span", {id: "stat" + i, cla: "orgstatus"},
                           " (" + assocStatus(prof, orgref.org) + ")"]);
                html.push(["div", {cla: "orgsummaryline"}, line]); } }
        jt.out('orglistdiv', jt.tac2html(html));
    },


    rebuildOrganizationDisplay = function (dispdiv, prof, mode, addfstr) {
        var html;
        html = [["span", {id: "orgtitle", cla: "sectiontitle"}, 
                 "Organizations"]];
        if(mode === "edit") {
            html.push(["button", {id: "addorgb", cla: "kwplus",
                                  onclick: jt.fs(addfstr)}, 
                       "+"]); }
        html.push(["div", {id: "orglistdiv", cla: "orglistdiv"}]);
        jt.out(dispdiv, jt.tac2html(html));
        app.lcs.resolveCSV("org", prof.orgs, function (orgrefs) {
            displayOrgs(prof, orgrefs, mode); });
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
                                   onclick: jt.fs("window.history.back()")},
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
        else if(org.unassociated && org.unassociated.csvcontains(profid)) {
            html = ["div", {id: "assocnoticediv"},
                    [["p", "You have already applied to be associated with"],
                     ["div", {cla: "orgassocnameline"}, org.name],
                     ["p", "Please contact one of your organization's administrators directly so they can approve you."],
                     ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"},
                      ["button", {type: "button", id: "orgselokb",
                                  onclick: jt.fs("app.profile.edit()")},
                       "Ok"]]]];
            jt.out('contentdiv', jt.tac2html(html)); }
        else {
            html = "Your association as a volunteer coordinator will need to be approved by one of your organization's administrators, please contact them directly and ask them to login again or reload the page in their browser to see your association request.";
            if(!org.administrators) {
                html = "You have been accepted as an administrator."; }
            html = ["div", {id: "assocnoticediv"},
                    [["p", {id: "assocverbpara"}, "Adding your association to"],
                     ["div", {cla: "orgassocnameline"}, org.name],
                     ["p", html],
                     ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"}]]];
            jt.out('contentdiv', jt.tac2html(html));
            if(app.winw > 700) {
                jt.byId('assocnoticediv').style.width =
                    (Math.round((app.winw * 2) / 3)) + "px"; }
            data = jt.objdata({ orgid: jt.instId(org), profid: profid });
            jt.call('POST', "orgassoc?" + app.login.authparams(), data,
                    function (objs) {
                        app.lcs.put("prof", objs[0]);
                        app.profile.setMyProfile(objs[0]);
                        app.lcs.put("org", objs[1]);
                        currorg = objs[1];
                        jt.out('assocverbpara', "Added your association to");
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
                  [app.lvtr("namein", "Name", currorg.name, 
                            "Name of your organization"),
                   ["tr",
                    [["td", {align: "right"},
                      ["label", {fo: "statusin", cla: "formlabel"},
                       "Status"]],
                     ["td", {align: "left"},
                      orgStatusEditValue(currorg)]]],
                   app.lvtr("siteurlin", "Site URL", currorg.details.siteurl,
                            "https://yoursite.org/index.html", "url"),
                   app.lvtr("logourlin", 
                            ["a", {href: "#LogoURL",
                                   onclick: jt.fs("app.org.logoexpl()")},
                             "Logo URL"], 
                            currorg.details.logourl,
                            "https://yoursite.org/logo.png", "url"),
                   app.lvtr("phonein", "Phone", currorg.details.phone,
                            "808 111 2222", "tel"),
                   app.lvtr("emailin", "Email", currorg.details.email,
                            "volunteer@yourorg.com", "email"),
                   app.lvtr("addrin", "Address", currorg.details.addr,
                            "1234 MakeThingsBetter Way"),
                   app.lvtr("cityin", "City", currorg.details.city, 
                            "Honolulu or ?"),
                   app.lvtr("statein", "State", currorg.details.state, 
                            "Hawai'i or ?"),
                   app.lvtr("zipin", "Zip", currorg.details.zip, "96817 or ?"),
                   ["tr",
                    [["td", {align: "right", cla: "listlabel"},
                      "Administrators: "],
                     ["td", {align: "left"},
                      ["div", {id: "adminlistdiv", cla: "refcsvdiv"}]]]],
                   ["tr",
                    [["td", {align: "right", cla: "listlabel"},
                      "Coordinators: "],
                     ["td", {align: "left"},
                      ["div", {id: "coordlistdiv", cla: "refcsvdiv"}]]]],
                   //unassociated members not displayed (notice only)
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "oppslistdiv", cla: "refcsvdiv"}]]],
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
        app.opp.listOpportunities("oppslistdiv", currorg, "edit",
                                  "app.org.addOpportunity");
    },


    display: function (org) {
        var imgsrc, namelink, html, assoc;
        if(org && typeof org === "object" && org.org) {
            currorg = org.org; }
        else if(org) {
            return app.lcs.getFull("org", org, app.org.display); }
        app.history.checkpoint({view: "org", orgid: jt.instId(currorg)});
        verifyOrganizationFieldValues(currorg);  //fill defaults if needed
        assoc = assocStatus(app.profile.getMyProfile(), currorg);
        imgsrc = app.sslSafeRef(jt.instId(currorg), 
                                currorg.details.logourl || "img/blank.png");
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
                      ["a", {href: "tel:" + currorg.details.phone},
                       currorg.details.phone]]]],
                   ["tr",
                    ["td", {colspan: 2, align: "left", cla: "valpadtd"},
                     addressLink(currorg)]],
                   ["tr",
                    ["td", {colspan: 2, align: "left", cla: "valpadtd"},
                     ["a", {href: "mailto:" + currorg.details.email},
                      currorg.details.email]]],
                   ["tr",
                    [["td", {align: "right", cla: "listlabel"},
                      "Administrators: "],
                     ["td", {align: "left"},
                      ["div", {id: "adminlistdiv", cla: "refcsvdiv"}]]]],
                   ["tr",
                    [["td", {align: "right", cla: "listlabel"},
                      "Coordinators: "],
                     ["td", {align: "left"},
                      ["div", {id: "coordlistdiv", cla: "refcsvdiv"}]]]],
                   //unassociated members not displayed (notice only)
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "oppslistdiv", cla: "refcsvdiv"}]]],
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "formbuttonsdiv", cla: "formbuttonsdiv"}]]]
                   ]]]];
        jt.out('contentdiv', jt.tac2html(html));
        html = [["button", {type: "button", id: "orgbackb",
                            onclick: jt.fs("window.history.back()")},
                 "&#x21B0; Back"]];
        if(assoc === "Administrator") {
            html.push(["button", {type: "button", id: "orgeditb",
                                  onclick: jt.fs("app.org.edit()")},
                       "Edit"]); }
        jt.out('formbuttonsdiv', jt.tac2html(html));
        app.profile.displayProfileRefs(currorg.administrators, 'adminlistdiv');
        app.profile.displayProfileRefs(currorg.coordinators, 'coordlistdiv');
        app.opp.listOpportunities("oppslistdiv", currorg);
    },


    save: function (directive) {
        var noform, bdiv, html, data;
        noform = (directive === "memchg" || 
                  (directive === "addopp" && !jt.byId("logourlin")));
        if(noform || readFormValues()) {
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
                        else if(directive === "addopp") {
                            nextf = app.opp.add; }
                        currorg = orgs[0];
                        app.lcs.put("org", currorg);
                        app.menu.rebuildNotices();
                        nextf(); },
                    app.failf(function (code, errtxt) {
                        if(html) {
                            jt.out('formbuttonsdiv', html); }
                        jt.out('orgstatdiv', "save failed " + code +
                               ": " + errtxt); }),
                    jt.semaphore("org.save")); }
    },


    getCurrentOrganization: function () {
        return currorg;
    },
    setCurrentOrganization: function (org) {
        currorg = org;
    },


    removeOrg: function (orgid, name) {
        var prof = app.profile.getMyProfile();
        if(!window.confirm("Are you sure you want to delete " + name + "?")) {
            return; }
        prof.orgs = prof.orgs.csvremove(orgid);
        app.lcs.resolveCSV("org", prof.orgs, function(orgrefs) {
            displayOrgs(prof, orgrefs, "edit"); });
    },


    byorgid: function (orgid) {
        app.org.display(orgid);
    },


    enableok: function () {
        var okb = jt.byId("okbutton");
        if(okb) {
            okb.disabled = false; }
    },


    membership: function (prof) {
        var stat, options, html;
        if(prof && typeof prof === "object" && prof.prof) {
            prof = prof.prof; }
        else if(prof) {
            return app.lcs.getFull("prof", prof, app.org.membership); }
        stat = assocStatus(prof, currorg);
        options = [];
        if(stat !== "Administrator") {
            options.push(
                ["tr",
                 [["td", {valign: "top"},
                   ["input", {type: "radio", name: "memact", 
                              value: "admin", id: "adminrad",
                              onclick: "app.org.enableok()"}]],
                  ["td",
                   [["label", {fo: "adminrad"}, 
                     "Make " + prof.name + " an administrator"],
                    ["br"],
                    ["Administrators have full edit rights to accept or remove others and change the organization fields."]]]]]); }
        if(stat !== "Coordinator") {
            options.push(
                ["tr",
                 [["td", {valign: "top"},
                   ["input", {type: "radio", name: "memact", 
                              value: "coord", id: "coordrad",
                              onclick: "app.org.enableok()"}]],
                  ["td",
                   [["label", {fo: "coordrad"}, 
                     "Make " + prof.name + " a volunteer coordinator"],
                    ["br"],
                    ["Coordinators can create and manage volunteer opportunities for the organization."]]]]]); }
        options.push(
            ["tr",
             [["td", {valign: "top"},
               ["input", {type: "radio", name: "memact", 
                          value: "remove", id: "removerad",
                          onclick: "app.org.enableok()"}]],
              ["td",
               [["label", {fo: "removerad"}, 
                 "Remove " + prof.name],
                ["br"],
                [prof.name + " is not currently managing volunteer opportunities or administrating the organization."]]]]]);
        html = [["p", 
                 [prof.name + " is associated with " + currorg.name + " as ", 
                  ["em", stat],
                  ". You can"]],
                ["table", options],
                ["div", {cla: "dlgbuttonsdiv"},
                 [["button", {type: "button", id: "cancelbutton",
                              onclick: jt.fs("app.layout.closeDialog()")},
                  "Cancel"],
                  ["button", {type: "button", id: "okbutton",
                              disabled: "disabled",
                              onclick: jt.fs("app.org.memberchange('" + 
                                             jt.instId(prof) + "')")},
                   "OK"]]]];
        html = app.layout.dlgwrapHTML("Membership", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('okbutton').focus(); });
    },


    memberchange: function (profid) {
        var cb;
        cb = jt.byId('adminrad');
        if(cb && cb.checked) {
            if(!currorg.administrators.csvcontains(profid)) {
                currorg.administrators = 
                    currorg.administrators.csvappend(profid); }
            currorg.coordinators = currorg.coordinators.csvremove(profid);
            currorg.unassociated = currorg.unassociated.csvremove(profid); }
        cb = jt.byId('coordrad');
        if(cb && cb.checked) {
            currorg.administrators = currorg.administrators.csvremove(profid);
            if(!currorg.coordinators.csvcontains(profid)) {
                currorg.coordinators = 
                    currorg.coordinators.csvappend(profid); }
            currorg.unassociated = currorg.unassociated.csvremove(profid); }
        cb = jt.byId('removerad');
        if(cb && cb.checked) {
            currorg.administrators = currorg.administrators.csvremove(profid);
            currorg.coordinators = currorg.coordinators.csvremove(profid);
            currorg.unassociated = currorg.unassociated.csvremove(profid); }
        app.layout.closeDialog();
        if(!currorg.administrators) {
            currorg.administrators = currorg.administrators.csvappend(profid);
            currorg.coordinators = currorg.coordinators.csvremove(profid);
            currorg.unassociated = currorg.unassociated.csvremove(profid);
            jt.out('orgstatdiv', "You must have at least one administrator"); }
        else {
            app.org.save("memchg"); }
    },


    activate: function () {
        var subject, body, mailref, html;
        subject = "Please approve " + currorg.name;
        body = subject + ". Organization id: " + jt.instId(currorg) + 
            "\n\nThanks,\n" + app.profile.getMyProfile().name;
        mailref = "mailto:admin@upteer.com?subject=" + jt.dquotenc(subject) +
            "&body=" + jt.dquotenc(body);
        html = [["div", {id: "contactdiv", cla: "paradiv"},
                 ["All new or reactivating organizations must be approved by Upteer before creating new volunteer opportunities. Please ",
                  ["a", {href: mailref}, "contact support"],
                  " to get your organization approved!"]],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.layout.closeDialog()")},
                  "OK"]]];
        html = app.layout.dlgwrapHTML("Approval", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('okbutton').focus(); });
    },


    confirmDeactivate: function () {
        var html;
        html = [["p", "Organizations generally cannot be deleted because they are part of the volunteering log, however they can be switched to \"Inactive\" which prevents any new volunteer opportunities from being created. Once inactivated, an organization must be re-approved by Upteer before becoming active again."],
                ["div", {cla: "dlgconfmsgdiv"},
                 "Are you sure you want to deactivate " + currorg.name + "?"],
                ["div", {cla: "dlgbuttonsdiv"},
                 [["button", {type: "button", id: "cancelb",
                              onclick: jt.fs("app.layout.closeDialog()")},
                   "Cancel"],
                  ["button", {type: "button", id: "deactivateb",
                             onclick: jt.fs("app.org.deactivate()")},
                   "Deactivate"]]]];
        html = app.layout.dlgwrapHTML("Deactivate", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('cancelb').focus(); });
    },
                

    deactivate: function () {
        app.layout.closeDialog();
        currorg.status = "Inactive";
        app.org.save();
    },


    logoexpl: function () {
        var html;
        html = [["div", {id: "expldiv", cla: "paradiv"},
                 "Upteer uses a link to your logo rather than uploading a copy, so you won't have an old version here if you make changes. To get the url of your logo, simply \"right click\" the image on your web site and copy the image location. Then paste that URL into the form field."],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.layout.closeDialog()")},
                  "OK"]]];
        html = app.layout.dlgwrapHTML("Your Logo", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('okbutton').focus(); });
    },


    checkForNotices: function (orgrefs) {
        var prof, i, j, profids;
        prof = app.profile.getMyProfile();
        if(!orgrefs) {
            return app.lcs.resolveCSV("org", prof.orgs, 
                                      app.org.checkForNotices); }
        for(i = 0; i < orgrefs.length; i += 1) {
            if(assocStatus(prof, orgrefs[i].org) === "Administrator") {
                profids = orgrefs[i].org.unassociated.csvarray();
                //jt.log("org.checkForNotices " + profids.length + " pending");
                for(j = 0; profids && j < profids.length; j += 1) {
                    app.menu.createNotice({
                        noticetype: "Association Request",
                        noticeprof: profids[j],
                        noticefunc: "app.org.associationNotice(" + profids[j] +
                            "," + jt.instId(orgrefs[i].org) + ")"}); } } }
    },


    associationNotice: function (profid, orgid) {
        app.lcs.getFull("org", orgid, function(orgref) {
            currorg = orgref.org;
            app.org.membership(profid); });
    },


    addOpportunity: function (opp) {
        if(opp) {
            currorg.opportunities.csvappend(jt.instId(opp)); }
        app.org.save("addopp");
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
            //The form error output can easily be off the top of the screen
            //when clicking the 'X' button next to Volunteer Coordinator,
            //and if you don't see the message it just seems broken.
            //jt.out(errdiv, "Delete your organization affiliations first..");
            jt.err("Please remove your organization affiliations before removing your Volunteer Coordinator status");
            return false; }
        jt.out(dispdiv, "");
        return true;
    }

};  //end of returned functions
}());

