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


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    readProfileFormValues = function () {
        var prof = myprof, sel;
        prof.name = jt.safeget('namein', 'value') || prof.name;
        prof.email = jt.safeget('emailin', 'value') || prof.email;
        prof.zipcode = jt.safeget('zipin', 'value') || prof.zipcode;
        sel = jt.byId('statussel');
        if(sel) {
            prof.status = statusvals[sel.selectedIndex]; }
        //prof.lifestat CSV
        //prof.skills CSV
    },


    displayUploadPicForm = function (prof) {
        jt.err("displayUploadPicForm not implemented yet");
    },


    profPicHTML = function (prof, editable) {
        var imgsrc, picdiv, html;
        imgsrc = "img/emptyprofpic.png";
        if(editable && !prof.profpic) {
            picdiv = jt.byId('profpicdiv');
            picdiv.style.background = "url('" + imgsrc + "') no-repeat";
            picdiv.style.backgroundSize = "125px 125px";
            html = ["div", {id: "picplaceholderdiv", cla: "formlabel"},
                    "Click to upload a pic of yourself"]; }
        else { //have pic, or not editable
            if(prof.profpic) {
                imgsrc = "profpic?profileid=" + jt.instId(prof); }
            html = ["img", {cla: "profpic", src: imgsrc}]; }
        jt.out('profpicdiv', jt.tac2html(html));
        if(editable) {
            jt.on('profpicdiv', 'click', function (e) {
                jt.evtend(e);
                if(jt.byId('profsaveb')) {  //save other field edits first
                    app.profile.save("edit"); }
                displayUploadPicForm(myprof); }); }
    },


    //ATTENTION: allow for changing email after initial profile setup.
    editProfile = function () {
        var html, prof = myprof, options = [], i;
        for(i = 0; i < statusvals.length; i += 1) {
            options.push(
                ["option", {id: "statval" + (+i),
                            selected: jt.toru((prof.status === statusvals[i]), 
                                              "selected")},
                 statusvals[i]]); }
        html = ["div", {id: "profdiv"},
                [["div", {id: "profstatdiv"}, "&nbsp;"],
                 ["table", {cla: "formtable"},
                  [["tr",
                    [["td", {id: "picuploadtd", rowspan: 4},
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
                    [//profPicHTML extends into here
                     ["td", {align: "right"},
                      ["label", {fo: "emailin", cla: "formlabel"},
                       "Email"]],
                     ["td", {align: "left"},
                      ["input", {type: "email", id: "emailin", name: "emailin",
                                 size: 20, value: app.login.getAuthName(),
                                 placeholder: app.login.getAuthName(),
                                 disabled: "disabled"}]]]],
                   ["tr",
                    [//profPicHTML extends into here
                     ["td", {align: "right"},
                      ["label", {fo: "zipin", cla: "formlabel"},
                       "Zipcode"]],
                     ["td", {align: "left"},
                      ["input", {type: "text", id: "zipin", name: "zipin",
                                 value: prof.zipcode || "",
                                 size: 8, placeholder: "99999"}]]]],
                   ["tr",
                    [//profPicHTML extends into here
                     ["td", {align: "right"},
                      ["label", {fo: "statussel", cla: "formlabel"},
                       "Status"]],
                     ["td", {align: "left"},
                      ["select", {id: "statussel"},
                       options]]]],
                   //prof.lifestat CSV
                   //prof.skills CSV
                   ["tr",
                    ["td", {colspan: 3},
                     ["div", {cla: "formbuttonsdiv"},
                      ["button", {type: "button", id: "profsaveb",
                                  onclick: jt.fs("app.profile.save()")},
                       "Save"]]]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        profPicHTML(prof, true);
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


    readProfile = function (prof) {
        var html;
        html = ["div", {id: "profdiv"},
                [["div", {id: "profstatdiv"}, "&nbsp;"],
                 ["table", {cla: "formtable"},
                  [["tr",
                    [["td", {id: "picuploadtd", rowspan: 3},  //no email row
                      ["div", {id: "profpicdiv"},
                       ["img", {cla: "profpic", src: "img/emptyprofpic.png"}]]],
                     ["td", {align: "left", cla: "valpadtd"},
                      prof.name]]],
                   ["tr",
                    [//profPicHTML extends into here
                     ["td", {align: "left", cla: "valpadtd"},
                      prof.zipcode]]],
                   ["tr",
                    [//profPicHTML extends into here
                     ["td", {align: "left", cla: "valpadtd"},
                      prof.status]]],
                   //prof.lifestat CSV
                   //prof.skills CSV
                   ["tr",
                    ["td", {colspan: 2},  //no labels column
                     ["div", {cla: "formbuttonsdiv"},
                      readProfButtonsHTML(prof)]]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        profPicHTML(prof, false);
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
                function (savepens) {
                    myprof = savepens[0];
                    if(edit) {
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
    }

};  //end of returned functions
}());

