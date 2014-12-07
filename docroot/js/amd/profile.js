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

    var myprof = null,
        currprof = null,
        statusvals = [ "Available", "Busy", "Inactive" ],
        topskills = null,
        lifekw = null,
        skillkw = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    verifyProfileFieldValues = function(prof) {
        prof.email = prof.email || "";
        prof.zipcode = prof.zipcode || "";
        prof.modified = prof.modified || "";
        prof.name = prof.name || "";
        prof.status = prof.status || "";
        prof.profpic = prof.profpic || "";
        prof.about = prof.about || "";
        prof.skills = prof.skills || "";
        prof.lifestat = prof.lifestat || "";
        prof.mailverify = prof.mailverify || "";
        prof.orgs = prof.orgs || "";
    },


    readProfileFormValues = function () {
        var prof = myprof, domelem;
        prof.name = jt.safeget('namein', 'value') || prof.name;
        prof.email = jt.safeget('emailin', 'value') || prof.email;
        prof.zipcode = jt.safeget('zipin', 'value') || prof.zipcode;
        domelem = jt.byId('statussel');
        if(domelem) {
            prof.status = statusvals[domelem.selectedIndex]; }
        domelem = jt.byId('abouttxt');
        if(domelem) {
            prof.about = domelem.value; }
        prof.lifestat = lifekw.getSelectedKeywordsCSV();
        if(skillkw) {
            prof.skills = skillkw.getSelectedKeywordsCSV(); }
        prof.orgs = prof.orgs || "";
    },


    monitorPicUpload = function () {
        var tgif, txt;
        tgif = jt.byId('tgif');
        if(tgif) {
            txt = tgif.contentDocument || tgif.contentWindow.document;
            if(txt) {
                txt = txt.body.innerHTML;
                if(txt.indexOf("Done: ") === 0) {
                    myprof.profpic = jt.instId(myprof);
                    myprof.modified = txt.slice("Done: ".length);
                    app.layout.closeDialog();
                    //rebuild whole form since image size may change layout
                    app.profile.edit();
                    return; }
                if(txt.indexOf("Error: ") === 0) {
                    jt.out('imgupstatdiv', txt); } }
            setTimeout(monitorPicUpload, 800); }
    },


    //Assumes the profile has been saved and has an associated id.
    displayUploadPicForm = function (prof) {
        var html, coords;
        html = [["form", {action: "/profpicupload", method: "post",
                          enctype: "multipart/form-data", target: "tgif"},
                 [["input", {type: "hidden", name: "_id", 
                             value: jt.instId(prof)}],
                  jt.paramsToFormInputs(app.login.authparams()),
                  ["div", {cla: "tablediv"},
                   [["div", {id: "imgupstatdiv", cla: "formstatdiv"},
                     "&nbsp;"],
                    ["div", {cla: "fileindiv"},
                     ["input", {type: "file", name: "picfilein", 
                                id: "picfilein"}]],
                    ["div", {cla: "formbuttonsdiv"},
                     ["input", {type: "submit", value: "Upload"}]]]]]],
                ["iframe", {id: "tgif", name: "tgif", src: "/profpicupload",
                           style: "display:none"}]];
        html = app.layout.dlgwrapHTML("Upload Picture", html);
        coords = jt.geoPos(jt.byId('profpicdiv'));
        coords.w = jt.byId('abouttxt').offsetWidth - 50;
        app.layout.openDialog({x: coords.x, y: coords.y, w: coords.w}, 
                              jt.tac2html(html), null,
                              function () {
                                  monitorPicUpload();
                                  jt.byId('picfilein').focus(); });
    },


    lifeStatusDisplay = function (prof, mode) {
        if(lifekw) {
            lifekw.destroy(); }
        lifekw = app.kwentry(
            "lifestatdiv", "Life Status",
            ["Volunteer Coordinator", "Student", "Professional", "Retired", 
             "Seeking Skills", "Under-employed"],
            prof.lifestat);
        if(mode === "edit") {
            lifekw.setKeywordSelectUnselectHooks(
                function (keyword) {
                    if(keyword === "Volunteer Coordinator") {
                        return app.org.enable("orgsdiv", "profstatdiv",
                                              "app.profile.addOrg"); }
                    return true;
                },
                function (keyword) {
                    if(keyword === "Volunteer Coordinator") {
                        return app.org.disable("orgsdiv", "profstatdiv"); }
                    return true;
                });
            if(prof.lifestat.csvcontains("Volunteer Coordinator")) {
                app.org.listOrganizations("orgsdiv", prof, "edit",
                                          "app.profile.addOrg"); }
            lifekw.displayEntry(); }
        else {
            if(prof.lifestat.csvcontains("Volunteer Coordinator")) {
                app.org.listOrganizations("orgsdiv", prof); }
            lifekw.displayList(); }
    },


    skillKeywordsDisplay = function(prof, mode) {
        if(!topskills) {
            jt.call('GET', "topkeys?" + app.login.authparams(), null,
                    function (keyobjs) {
                        topskills = keyobjs[0].keys.csvarray();
                        skillKeywordsDisplay(prof, mode); },
                    app.failf(function (code, errtxt) {
                        jt.err("Skill keywords retrieval failed " + code + 
                               ": " + errtxt); }),
                    jt.semaphore("profile.skillkeywords"));
            return; }
        if(skillkw) {
            skillkw.destroy(); }
        skillkw = app.kwentry("skillsdiv", "Volunteer Skills", 
                              topskills, prof.skills);
        if(mode === "edit") {
            skillkw.displayEntry(); }
        else {
            skillkw.displayList(); }
    },


    //ATTENTION: allow for changing email after initial profile setup.
    editProfile = function () {
        var html, prof = myprof, options = [], i;
        verifyProfileFieldValues(prof);
        for(i = 0; i < statusvals.length; i += 1) {
            options.push(
                ["option", {id: "statval" + (+i),
                            selected: jt.toru((prof.status === statusvals[i]), 
                                              "selected")},
                 statusvals[i]]); }
        html = ["div", {id: "profdiv"},
                [["div", {id: "profstatdiv", cla: "formstatdiv"}, 
                  "&nbsp;"],
                 ["table", {cla: "formtable"},
                  [["tr",
                    [["td", {id: "picuploadtd", cla: "tdnarrow",
                             rowspan: 4},
                      ["div", {id: "profpicdiv"},
                       ["img", {cla: "profpic", src: "img/emptyprofpic.png"}]]],
                     ["td", {align: "right"},
                      ["label", {fo: "namein", cla: "formlabel"}, 
                       "Name"]],
                     ["td", {align: "left"},
                      ["input", {type: "text", id: "namein", name: "namein",
                                 value: prof.name || "",
                                 size: 20, placeholder: "Your Name"}]]]],
                   ["tr",
                    [//pic html extends into here
                     ["td", {align: "right"},
                      ["label", {fo: "emailin", cla: "formlabel"},
                       "Email"]],
                     ["td", {align: "left"},
                      ["input", {type: "email", id: "emailin", name: "emailin",
                                 size: 20, value: app.login.getAuthName(),
                                 placeholder: app.login.getAuthName(),
                                 disabled: "disabled"}]]]],
                   ["tr",
                    [//pic html extends into here
                     ["td", {align: "right"},
                      ["label", {fo: "zipin", cla: "formlabel"},
                       "Zipcode"]],
                     ["td", {align: "left"},
                      ["input", {type: "text", id: "zipin", name: "zipin",
                                 value: prof.zipcode || "",
                                 size: 8, placeholder: "99999"}]]]],
                   ["tr",
                    [//pic html extends into here
                     ["td", {align: "right"},
                      ["label", {fo: "statussel", cla: "formlabel"},
                       "Status"]],
                     ["td", {align: "left"},
                      ["select", {id: "statussel"},
                       options]]]],
                   ["tr",
                    ["td", {colspan: 3},
                     ["div", {id: "aboutdiv", cla: "bigtxtdiv"},
                      ["textarea", {id: "abouttxt", cla: "bigta"}]]]],
                   ["tr", ["td", {colspan: 3}, ["div", {id: "lifestatdiv"}]]],
                   ["tr", ["td", {colspan: 3}, ["div", {id: "skillsdiv"}]]],
                   ["tr", ["td", {colspan: 3}, ["div", {id: "voluntdiv"}]]],
                   ["tr", ["td", {colspan: 3}, ["div", {id: "orgsdiv"}]]],
                   ["tr",
                    ["td", {colspan: 3},
                     ["div", {cla: "formbuttonsdiv"},
                      ["button", {type: "button", id: "profsaveb",
                                  onclick: jt.fs("app.profile.save()")},
                       "Save"]]]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        app.initTextArea("abouttxt", prof.about, "Public profile or blog? What are you interested in?");
        app.profile.profPicHTML(prof, true);
        lifeStatusDisplay(myprof, "edit");
        skillKeywordsDisplay(myprof, "edit");
    },


    readProfButtonsHTML = function (prof) {
        var buttons = [];
        if(jt.instId(prof) === jt.instId(myprof)) {
            buttons.push(["button", {type: "button", id: "editprofb",
                                     onclick: jt.fs("app.profile.edit()")},
                          "Edit"]);
            buttons.push(["button", {type: "button", id: "searchoppsb",
                                     onclick: jt.fs("app.profile.match()")},
                          "Find Volunteer Opportunities"]); }
        else {
            buttons = app.contact.getActionButtons(myprof, prof); }
        return buttons;
    },


    fetchProfThenRetryRefDisplay = function (profid, refcsv, divid,
                                             clickfnamestr) {
        app.lcs.getFull("prof", profid, function () {
            app.profile.displayProfileRefs(refcsv, divid, clickfnamestr); });
    },


    statHTML = function (prof) {
        if(prof.status === "No Pic") {
            return ["a", {href: "#pic", 
                          onclick: jt.fs("app.profile.explainPic()")},
                    "Pending"]; }
        return prof.status;
    },


    readProfile = function (prof) {
        var html;
        verifyProfileFieldValues(prof);
        html = ["div", {id: "profdiv"},
                [["div", {id: "profstatdiv"}, "&nbsp;"],
                 ["table", {cla: "formtable"},
                  [["tr",
                    [["td", {id: "picuploadtd", cla: "tdnarrow",
                             rowspan: 3},  //no email row
                      ["div", {id: "profpicdiv"},
                       ["img", {cla: "profpic", src: "img/emptyprofpic.png"}]]],
                     ["td", {align: "left", cla: "valpadtd"},
                      ["span", {cla: "namespan"}, prof.name]]]],
                   ["tr",
                    [//pic html extends into here
                     ["td", {align: "left", cla: "valpadtd"},
                      prof.zipcode]]],
                   ["tr",
                    [//pic html extends into here
                     ["td", {align: "left", cla: "valpadtd"},
                      statHTML(prof)]]],
                   ["tr",
                    ["td", {colspan: 2},
                     ["div", {id: "aboutdiv", cla: "bigtxtdiv"},
                      jt.linkify(prof.about || "")]]],
                   ["tr", ["td", {colspan: 2}, ["div", {id: "lifestatdiv"}]]],
                   ["tr", ["td", {colspan: 2}, ["div", {id: "skillsdiv"}]]],
                   ["tr", ["td", {colspan: 2}, ["div", {id: "voluntdiv"}]]],
                   ["tr", ["td", {colspan: 2}, ["div", {id: "orgsdiv"}]]],
                   ["tr", ["td", {colspan: 2}, ["div", {id: "wpsdiv"}]]],
                   ["tr",
                    ["td", {colspan: 2},  //no labels column
                     ["div", {cla: "formbuttonsdiv"},
                      readProfButtonsHTML(prof)]]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        app.limitwidth('aboutdiv');
        app.profile.profPicHTML(prof, false);
        lifeStatusDisplay(prof);
        skillKeywordsDisplay(prof);
        app.contact.wpsProfileDisplay("wpsdiv", prof);
        app.menu.display();
    },


    saveProfile = function (edit) {
        var data,  prof = myprof;
        if(!prof.name) {
            jt.out('profstatdiv', "Please give your name");
            return; }
        if(!prof.email) {
            jt.out('profstatdiv', "An email address is required");
            return; }
        if(!prof.zipcode) {
            jt.out('profstatdiv', "Region matching needs a zipcode to work");
            return; }
        data = jt.objdata(prof);
        jt.call('POST', "saveprof?" + app.login.authparams(), data,
                function (saveprofs) {
                    myprof = saveprofs[0];
                    if(edit === "picupld") {
                        displayUploadPicForm(myprof); }
                    else if(edit === "addorg") {
                        app.org.add(); }
                    else if(edit) {
                        editProfile(); }
                    else {
                        readProfile(myprof); } },
                app.failf(function (code, errtxt) {
                    jt.out('profstatdiv', "Save failed " + code + 
                           ": " + errtxt); }),
                jt.semaphore("profile.saveProfile"));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    edit: function () {
        editProfile();
    },


    save: function (edit) {
        readProfileFormValues();
        saveProfile(edit);
    },


    verifyOrg: function (orgid) {
        var saveneeded = false, data;
        if(!myprof.lifestat.csvcontains("Volunteer Coordinator")) {
            saveneeded = true;
            myprof.lifestat = 
                myprof.lifestat.csvappend("Volunteer Coordinator"); }
        if(!myprof.orgs.csvcontains(orgid)) {
            saveneeded = true;
            myprof.orgs = myprof.orgs.csvappend(orgid); }
        if(saveneeded) {
            data = jt.objdata(myprof);
            jt.call('POST', "saveprof?" + app.login.authparams(), data,
                    function (profs) {
                        myprof = profs[0];
                        app.lcs.put("prof", myprof);
                        jt.log("profile.verifyOrg added " + orgid); },
                    app.failf(function (code, errtxt) {
                        jt.log("profile.verifyOrg " + code + ": " + errtxt); }),
                    jt.semaphore("profile.verifyOrg")); }
    },


    //The profile display gets called after login, and that triggers
    //the server call.  Afterwards myprof is cached and available.
    display: function () {
        var url;
        app.history.checkpoint({view: "profile", profid: jt.instId(myprof)});
        if(myprof) {
            return readProfile(myprof); }
        jt.out('contentdiv', "Fetching your profile...");
        url = "myprofile?" + app.login.authparams();
        jt.call('GET', url, null,
                function (profiles) {
                    if(profiles.length > 0) {
                        myprof = profiles[0];
                        //cache this copy with the private info included so
                        //the cache doesn't fetch a generic copy
                        app.lcs.put("prof", myprof);
                        readProfile(myprof); }
                    else {
                        myprof = { email: app.login.getAuthName };
                        editProfile(); } },
                app.failf(function (code, errtxt) {
                    jt.out('contentdiv', "loginprofile call failed " + code +
                           ": " + errtxt); }),
                jt.semaphore("profile.loginprofile")); 
    },


    byprofid: function (profid) {
        app.history.checkpoint({view: "profile", profid: profid});
        if(profid === jt.instId(myprof)) {
            readProfile(myprof); }
        app.lcs.getFull("prof", profid, function (profref) {
            currprof = profref.prof;
            readProfile(currprof); });
    },


    explainPic: function () {
        var html;
        html = [["p", "Please upload a pic.  People need to be able to recognize you when coordinating opportunities."],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.layout.closeDialog()")},
                  "OK"]]];
        html = app.layout.dlgwrapHTML("Missing Picture", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('okbutton').focus(); });
    },


    profPicHTML: function (prof, editable) {
        var imgsrc, picdiv, html;
        imgsrc = "img/emptyprofpic.png";
        if(editable && !prof.profpic) {
            picdiv = jt.byId('profpicdiv');
            picdiv.style.background = "url('" + imgsrc + "') no-repeat";
            picdiv.style.backgroundSize = "125px 125px";
            html = ["div", {id: "picplaceholderdiv", cla: "formlabel"},
                    "Click to upload a pic of yourself"]; }
        else { //have pic, or not editable
            if(prof.profpic) {  //fetch with cachebust if updated
                imgsrc = "profpic?profileid=" + jt.instId(prof) + 
                    "&modified=" + prof.modified; }
            html = ["img", {cla: "profpic", src: imgsrc}]; }
        jt.out('profpicdiv', jt.tac2html(html));
        if(editable) {
            jt.on('profpicdiv', 'click', function (e) {
                jt.evtend(e);
                if(jt.byId('profsaveb')) {  //save other field edits first
                    app.profile.save("picupld"); } }); }
    },


    getMyProfile: function () {
        return myprof;
    },
    setMyProfile: function (prof) {
        myprof = prof;
    },


    getCurrentProfile: function () {
        return currprof;
    },
    setCurrentProfile: function (prof) {
        currprof = prof;
    },


    addOrg: function () {
        readProfileFormValues();  //don't lose interim edits
        saveProfile("addorg");
    },


    displayProfileRefs: function (refcsv, divid, clickfnamestr) {
        var i, profref, refs;
        clickfnamestr = clickfnamestr || "app.profile.byprofid";
        refs = refcsv.csvarray();
        for(i = 0; i < refs.length; i += 1) {
            profref = app.lcs.getRef("prof", refs[i]);
            if(profref.status === "not cached") {
                return fetchProfThenRetryRefDisplay(refs[i], refcsv, divid,
                                                    clickfnamestr); }
            if(profref.prof) {
                refs[i] = jt.tac2html(
                    ["a", {href: "#" + jt.instId(profref.prof),
                           onclick: jt.fs(clickfnamestr + "(" + 
                                          jt.instId(profref.prof) + ")")},
                     profref.prof.name]); } }
        refs = refs.join(", ");
        if(!refs) {
            refs = "None"; }
        jt.out(divid, refs);
    },


    resetStateVars: function () {
        myprof = null;
        currprof = null;
        lifekw = null;
        skillkw = null;
    },


    serializeFields: function (prof) {
        //the contact book is not updated when saving the profile, so it
        //is not necessary to serialize profile.book when saving.
        if(typeof prof.book === 'object') {
            prof.book = JSON.stringify(prof.book); }
    },


    deserializeFields: function (prof) {
        app.lcs.reconstituteJSONObjectField("book", prof);
    },


    match: function () {
        var errtxt;
        if(myprof.status === "Available" || myprof.status === "Busy") {
            return app.match.init(); }
        errtxt = "Complete your profile to volunteer.";
        if(myprof.status === "Inactive") {
            errtxt = "Activate your profile to find volunteer opportunities"; }
        jt.out('profstatdiv', errtxt);
    }

};  //end of returned functions
}());

