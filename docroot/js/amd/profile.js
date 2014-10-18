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
        lifekw = null,
        skillkw = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

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
        prof.skills = skillkw.getSelectedKeywordsCSV();
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
        app.layout.openDialog({x: coords.x, y: coords.y}, 
                              jt.tac2html(html), null,
                              function () {
                                  monitorPicUpload();
                                  jt.byId('picfilein').focus(); });
    },


    lifeStatusDisplay = function (mode) {
        if(lifekw) {
            lifekw.destroy(); }
        lifekw = app.kwentry(
            "lifestatdiv", "Life Status",
            ["Student", "Professional", "Retired", "Under-Employed",
             "Seeking Skills", "Volunteer Coordinator"],
            myprof.lifestat);
        if(mode === "edit") {
            lifekw.displayEntry(); }
        else {
            lifekw.displayList(); }
    },


    skillKeywordsDisplay = function(mode) {
        if(skillkw) {
            skillkw.destroy(); }
        skillkw = app.kwentry(
            "skillsdiv", "Volunteer Skills",
            ["Graphic Design", "Web Development", "Video Production",
             "Web Technology", "GIS", "Quilting", "Technical Writing",
             "Warehouse Management", "Grant Writing", "Copy Editing", 
             "Land Use Research", "Dog Fostering", "Photography",
             "Print Graphics", "Architectural Drawing", "Law"],
            myprof.skills);
        if(mode === "edit") {
            skillkw.displayEntry(); }
        else {
            skillkw.displayList(); }
    },


    //ATTENTION: allow for changing email after initial profile setup.
    editProfile = function () {
        var html, prof = myprof, options = [], i, domelem;
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
                   ["tr",
                    ["td", {colspan: 3},
                     ["div", {cla: "formbuttonsdiv"},
                      ["button", {type: "button", id: "profsaveb",
                                  onclick: jt.fs("app.profile.save()")},
                       "Save"]]]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        domelem = jt.byId("abouttxt");
        if(domelem) {
            domelem.readOnly = false;
            domelem.value = prof.about || "";
            domelem.placeholder = "What do you do? What kinds of things would you like to get involved in? Do you have a public LinkedIn profile or website?";
            domelem.style.width = domelem.parentNode.offsetWidth + "px"; }
        app.profile.profPicHTML(prof, true);
        lifeStatusDisplay("edit");
        skillKeywordsDisplay("edit");
    },


    readProfButtonsHTML = function (prof) {
        var buttons = [];
        if(prof === myprof) {
            buttons.push(["button", {type: "button", id: "editprofb",
                                     onclick: jt.fs("app.profile.edit()")},
                          "Edit"]); }
        else {
            buttons.push(["button", {type: "button", id: "contactprofb",
                                     onclick: jt.fs("app.profile.contact()")},
                          "Contact"]); }
        return buttons;
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
        html = ["div", {id: "profdiv"},
                [["div", {id: "profstatdiv"}, "&nbsp;"],
                 ["table", {cla: "formtable"},
                  [["tr",
                    [["td", {id: "picuploadtd", cla: "tdnarrow",
                             rowspan: 3},  //no email row
                      ["div", {id: "profpicdiv"},
                       ["img", {cla: "profpic", src: "img/emptyprofpic.png"}]]],
                     ["td", {align: "left", cla: "valpadtd"},
                      prof.name]]],
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
                   ["tr",
                    ["td", {colspan: 2},  //no labels column
                     ["div", {cla: "formbuttonsdiv"},
                      readProfButtonsHTML(prof)]]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        app.profile.profPicHTML(prof, false);
        lifeStatusDisplay();
        skillKeywordsDisplay();
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


    contact: function () {
        jt.err("Contact not implemented yet");
    },


    //The profile display is the starting display after login, so
    //only the first startup call triggers a server call.
    display: function () {
        var url;
        if(myprof) {
            return readProfile(myprof); }
        jt.out('contentdiv', "Fetching your profile...");
        url = "myprofile?" + app.login.authparams();
        jt.call('GET', url, null,
                function (profiles) {
                    if(profiles.length > 0) {
                        myprof = profiles[0];
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
        jt.err("profile.byprofid not implemented yet");
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
    }


};  //end of returned functions
}());

