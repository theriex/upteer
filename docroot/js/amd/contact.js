/*global setTimeout: false, window: false, document: false, app: false, jt: false, JSON: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// contact book access and supporting functions
//

app.contact = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var //The contact book (profile.book field) is an array of contacts:
        //       [name, profid, email, comms, notes] 
        //The comms field is an array of communication entries:
        //       [tstamp, code, msgtxt, oppname, oppid, wpid]
        //sorted with the most recent entry first.  The opportunity
        //and work period refs are defined as needed.  Older entries
        //roll off as they are replaced with newer ones, see work.py
        //for retentions.  The oppname is redundant and could even be
        //out of date, but it is stored for ease of display.
        codes = { 
            vol: {name: "Volunteering Inquiry", emrel: true,
                  verb: "Contact", prog: "Contacting"},
            vli: {name: "Inquired"},        //coordinator book
            wrk: {name: "Work Completion",  //have email already
                  verb: "Contact", prog: "Contacting"},
            wrd: {name: "Completed Work"},  //coordinator book
            cov: {name: "Co-Volunteer"},
            a2b: {name: "Contact Book Add",
                  verb: "Add", prog: "Adding"},
            b2a: {name: "Contact Note"},
            sha: {name: "Opportunity Share", emrel: true,
                  verb: "Contact", prog: "Contacting"},
            shr: {name: "Received Opportunity"},  //receiver book
            ema: {name: "Contact Info Request", emrel: true,
                  verb: "Request", prog: "Requesting"},
            emc: {name: "Contact Info Receipt"},  //receiver book
            emr: {name: "Contact Info Release", emrel: true,
                  verb: "Send", prog: "Sending"},
            emd: {name: "Contact Info Delivery"}, //receiver book
            ign: {name: "Ignoring",
                  verb: "Ignore", prog: "Ignoring"},
            alw: {name: "Allowing",
                  verb: "Allow", prog: "Allowing"} },
        tracksel = [{noun: "Day", adj: "Daily", max: 8, ceiling: 24},
                    {noun: "Week", adj: "Weekly", max: 20, ceiling: 120},
                    {noun: "Month", adj: "Monthly", max: 80, ceiling: 350}],
        currwp = null,    //most recently accessed WorkPeriod


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    findEntry = function (them) {
        var me, book, profid, i;
        me = app.profile.getMyProfile();
        if(!me.book) {
            me.book = []; }
        book = me.book;
        if(typeof them === "string") {
            profid = them; }
        else {
            profid = jt.instId(them); }
        for(i = 0; i < book.length; i += 1) {
            if(book[i][1] === profid) {
                return book[i]; } }
        return null;
    },
        

    mostRecentComm = function (entry, codestr) {
        var comms = entry[3], i;
        for(i = 0; i < comms.length; i += 1) {
            if(comms[i][1] === codestr) {
                return comms[i]; } }
        return null;
    },


    haveContactInfo = function (them) {
        var entry = findEntry(them);
        return entry && entry[2];  //email address or empty string
    },


    isFriend = function (them) {
        //mutually listed in contact books, or co-volunteers
        //logic is equivalent to is_friend in work.py
        var entry = findEntry(them);
        if(entry && ((mostRecentComm(entry, "a2b") && 
                      mostRecentComm(entry, "b2a")) ||
                     mostRecentComm(entry, "cov"))) {
            return true; }
        return false;
    },


    inquiring = function (opp) {
        var profref, oppid, i;
        profref = app.lcs.getRef("prof", jt.instId(app.profile.getMyProfile()));
        if(!profref.wps) {
            return false; }
        oppid = jt.instId(opp);
        for(i = 0; i < profref.wps.length; i += 1) {
            if(profref.wps[i].opportunity === oppid &&
               profref.wps[i].status === "Inquiring") {
                return true; } }
        return false;
    },


    //Return the contact code and button text if there is a reason to
    //contact them.
    contextForContact = function () {
        var me, them, opp;
        me = app.profile.getMyProfile();
        them = app.profile.getCurrentProfile();
        opp = app.opp.getCurrentOpportunity();
        //They are the coordinator for the last viewed opportunity.
        if(opp && opp.contact.csvcontains(jt.instId(them)) && !inquiring(opp)) {
            return { code: "vol", button: codes.vol.name }; }
        //You are searching for volunteers, or passing an opportunity
        //along to a friend:
        if(opp && (opp.contact.csvcontains(jt.instId(me)) || 
                   isFriend(them))) {
            return { code: "sha", button: codes.sha.name }; }
        //You are friends and you are requesting contact info
        if(isFriend(them) && !haveContactInfo(them)) {
            return { code: "ema", button: codes.sha.name }; }
        //No context to contact them.
        return {};
    },


    oppName = function () {
        var opp, org;
        opp = app.opp.getCurrentOpportunity();
        org = app.lcs.getRef("org", opp.organization).org;
        return org.name + " " + opp.name;
    },


    emailReleaseCheckboxHTML = function (codestr) {
        var them, html = "";
        if(codes[codestr].emrel) {
            them = app.profile.getCurrentProfile();
            html = [["input", {type: "checkbox", name: "emcb", id: "emcb",
                               cla: "contactcb", value: "releaseMyEmail",
                               checked: "checked", 
                               onchange: jt.fs("app.contact.emcbchg()")}],
                    ["label", {fo: "releaseMyEmail", id: "emcblabel"},
                     "Give " + them.name + " my email address"]]; }
        return html;
    },


    trackselHTML = function (disptype, selval) {
        var html = [], i;
        selval = selval || "Week";
        for(i = 0; i < tracksel.length; i += 1) {
            html.push(
                ["option", {id: tracksel[i].adj,
                            selected: jt.toru((tracksel[i].noun === selval ||
                                               tracksel[i].adj === selval),
                                              "selected")},
                 tracksel[i].noun]); }
        html = ["select", {id: "tracksel"},
                html];
        return html;
    },


    contactDialogHTML = function (codestr, entry, subj1, subj2) {
        var html, hp = "", pp = "";
        html = [["div", {id: "contactdlgsubjdiv"},
                 [["div", {id: "contactsubjverbdiv"},
                   subj1],
                  ["div", {id: "contactsubjoppdiv"},
                   subj2]]],
                emailReleaseCheckboxHTML(codestr),
                ["div", {id: "contactdlgtxtdiv", cla: "bigtxtdiv"},
                 ["textarea", {id: "contactta", cla: "bigta"}]]];
        if(codestr === "vol") {
            hp = "Hours Requested"; pp = "per"; }
        else if(codestr === "wrk") {
            hp = "Hours Worked"; pp = "this"; }
        if(hp) {
            html.push(["div", {id: "contacthoursdiv"},
                       [hp + ": ",
                        ["input", {id: "hoursin", min: 1,
                                   type: "number", style: "width:3em;"}],
                        " " + pp + " ",
                        trackselHTML("noun")]]); }
        return html;
    },


    addToContactBookDlgHTML = function (entry) {
        var html;
        html = [["p", "Adding " + entry[0] + " to your contact book."],
                ["p", "To request contact details, " + entry[0] + 
                 " must add you to their contact book, or you have " +
                 "volunteered together."]];
        return html;
    },


    contactInfoRequestDlgHTML = function (entry) {
        var html;
        html = [["div", {id: "contactdlgsubjdiv"},
                 [["div", {id: "contactsubjverbdiv"},
                   "Requesting your email address"],
                  ["div", {id: "contactsubjoppdiv"},
                   ""]]],
                emailReleaseCheckboxHTML("ema"),
                ["div", {id: "contactdlgtxtdiv", cla: "bigtxtdiv"},
                 ["textarea", {id: "contactta", cla: "bigta"}]]];
        return html;
    },


    ignoreAllCommsDlgHTML = function (entry) {
        var html;
        html = [["p", "Are you sure you want to ignore all contact from  " + 
                 entry[0] + "?"],
                ["p", entry[0] + " will not see that you have elected to permanently ignore all communications from them."]];
        return html;
    },


    displayContactDialog = function (codestr, entry) {
        var placeholder = "", html;
        switch(codestr) {
        case "vol": 
            placeholder = "What motivations and strengths will help you contribute positively to " + oppName() + "?";
            html = contactDialogHTML(
                codestr, entry, "Inquiring about volunteering for", oppName());
            break;
        case "wrk": 
            placeholder = "Any feedback you want to share with " + entry[0] + " about the work you did?";
            html = contactDialogHTML(
                codestr, entry, "Volunteer work completed for", oppName());
            break;
        //case "cov": server side update only
        case "a2b":
            html = addToContactBookDlgHTML(entry);
            break;
        //case b2a: server side update only
        case "sha": 
            placeholder = "Why is " + entry[0] + " a great match?";
            html = contactDialogHTML(
                codestr, entry, "Interested in volunteering for", oppName());
            break;
        case "ema": 
            placeholder = "Why are you requesting their email?";
            html = contactInfoRequestDlgHTML(entry);
            break;
        case "ign": 
            html = ignoreAllCommsDlgHTML(entry);
            break; }
        html = ["div", {id: "contactdlgcontentdiv"},
                [html,
                 ["div", {cla: "formbuttonsdiv", id: "dlgbdiv"},
                  [["button", {type: "button", id: "contactcancel",
                               onclick: jt.fs("app.layout.closeDialog()")},
                    "Cancel"],
                   ["button", {type: "button", id: "contactokb",
                               onclick: jt.fs("app.contact.contactok('" +
                                              codestr + "')")},
                    codes[codestr].verb]]]]];
        html = app.layout.dlgwrapHTML(codes[codestr].verb + " " + entry[0], 
                                      html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('contactokb').focus(); });
        if(jt.byId('contactta')) {
            app.initTextArea("contactta", "", placeholder); }
    },


    noteUpdatedWorkPeriod = function (results) {
        var wp, wpid, profref, found = false, i;
        if(results.length <= 1) {
            return; }  //no WorkPeriod to note
        wp = results[1];
        wpid = jt.instId(wp);
        profref = app.lcs.getRef("prof", jt.instId(app.profile.getMyProfile()));
        if(!profref.wps) {
            profref.wps = []; }
        for(i = 0; !found && i < profref.wps.length; i += 1) {
            if(jt.instId(profref.wps[i]) === wpid) {
                profref.wps[i] = wp;
                found = true; } }
        if(!found) {
            profref.wps.unshift(wp); }
        profref.wps.sort(function (a, b) {
            if(a.modified > b.modified) { return -1; }
            if(a.modified < b.modified) { return 1; }
            return 0; });
    },


    wpEditFieldHTML = function (wp, mode, field) {
        var html = wp[field];
        if(mode === "myprof" || mode === "coord") {
            html = [["a", {href: "#changestatus",
                           onclick: jt.fs("app.contact.wpedit('" +
                                          jt.instId(wp) + "')")},
                     html],
                    " "]; }
        return html;
    },


    workPeriodHTML = function (wp, mode) {
        var namelink, html;
        if(mode === "opp" || mode === "coord") {
            namelink = ["a", {href: "#" + wp.volunteer,
                              onclick: jt.fs("app.profile.byprofid('" +
                                             wp.volunteer + "')")},
                    wp.volname]; }
        else { //profbasic or myprof
            namelink = ["a", {href: "#" + wp.opportunity,
                              onclick: jt.fs("app.opp.byoppid('" + 
                                             wp.opportunity + "')")},
                    wp.oppname]; }
        html = ["div", {cla: "wpdescline"},
                [["span", {cla: "wpnamelink"}, namelink],
                 ["span", {cla: "wpstatlab"}, " status: "],
                 ["span", {cla: "wpstatus"},
                  wpEditFieldHTML(wp, mode, "status")],
                 ["span", {cla: "wphours"},
                  wpEditFieldHTML(wp, mode, "hours")],
                 ["span", {cla: "wpstatunits"}, " hrs"]]];
        return html;
    },


    checkSetContactDataVals = function (data, codestr) {
        var retval = true, input, errborder = "medium solid red", ts = null;
        input = jt.byId('contactta');
        if(input) {
            data.msgtxt = input.value || "";
            if(codestr === "vol" && !data.msgtxt) {
                input.style.border = errborder;
                retval = false; } }
        input = jt.byId('tracksel');
        if(input) {
            ts = tracksel[input.selectedIndex];
            data.tracking = ts.adj; }
        //hours may be zero if "No Show"
        input = jt.byId('hoursin');
        if(input) {
            data.hours = input.value || 0;
            if(!data.hours && data.status !== "No Show") {
                input.style.border = errborder;
                retval = false; }
            if(data.hours && ts && data.hours > ts.max) {
                retval = window.confirm(
                    "Are you sure you want to request more than " +
                        ts.max + " hours?") && retval; }
            if(data.hours && ts && data.hours > ts.ceiling) {
                input.value = ts.ceiling;
                retval = false; } }
        return retval;
    },


    displayWorkPeriods = function (dispdiv, wps, mode) {
        var i, html = [];
        if(!wps || wps.length === 0) {
            jt.out(dispdiv, "");
            return; }
        for(i = 0; i < wps.length; i += 1) {
            html.push(workPeriodHTML(wps[i], mode)); }
        html = [["span", {id: "wpstitle", cla: "sectiontitle"},
                 "Volunteering"],
                ["div", {id: "wpslistdiv", cla: "orglistdiv"},
                 html]];
        jt.out(dispdiv, jt.tac2html(html));
    },


    bookEntryCommLinksHTML = function (profid, comms) {
        var html = [], i, comm;
        for(i = 0; i < comms.length; i += 1) {
            comm = comms[i];
            if(i > 0) {
                html.push(", "); }
            html.push(["a", {href: "#" + comm[1] + comm[0],
                             onclick: jt.fs("app.contact.togglebookdet('" + 
                                            profid + "'," + i + ")")},
                       ["span", {cla: "cbentrycommlinkspan"},
                        comm[1]]]); }
        return html;
    },


    bookEntryDispHTML = function (entry) {
        var html, em = "", profid = entry[1];
        if(entry[2]) {
            em = ["a", {href: "mailto:" + entry[2]},
                  ["img", {cla: "cbemlinkimg", src: "img/email.png"}]]; }
        html = ["div", {cla: "cbentrydiv"},
                [["div", {cla: "cbentrysummarydiv"},
                  [["a", {href: "#view=prof&&profid=" + profid,
                          onclick: jt.fs("app.contact.bookjump('prof','" +
                                         profid + "')")},
                    entry[0]], //name
                   " ", em, " ",
                   ["span", {cla: "cbcontactslab"}, "contact: "],
                   bookEntryCommLinksHTML(profid, entry[3])]],
                   //ATTENTION: notes link after last comm (disp/edit)
                 ["div", {cla: "cbentrydetaildiv", id: "cbed" + profid,
                          style: "display:none;" }, "nothin here"]]];
        return html;
    },


    commOppWorkLineHTML = function (comm) {
        var html = [];
        if(comm.length > 3 && comm[3]) { //oppname
            html.push(["span", {cla: "cbdopp"},
                       ["a", {href: "#view=opp&oppid=" + comm[4],
                              onclick: jt.fs("app.contact.bookjump('opp','" +
                                             comm[4] + "')")},
                        comm[3]]]);
            if(comm.length >= 6 && comm[5]) { //wpid
                html.push(" - ");
                html.push(["span", {cla: "cbdwp"},
                           ["a", {href: "#view=wp&wpid=" + comm[5],
                                  onclick: jt.fs("app.contact.wpedit('" +
                                                 comm[5] + "')")},
                            "tracking"]]); } }
        return html;
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    wpedit: function (wpid) {
        //bring up the dialog allowing for changing the stat, hours
        //and other detail fields.  These should be arranged
        //vertically with explanations of what can be done for each.
        //validation and cancel/save.
        jt.err("wpedit not implemented yet");
    },


    wpsProfileDisplay: function (dispdiv, prof) {
        var profid, profref, url, wps, mode = "profbasic";
        jt.out(dispdiv, "");
        profid = jt.instId(prof);
        profref = app.lcs.getRef("prof", profid);
        wps = profref.wps;
        if(!wps) {
            url = "fetchwork?" + app.login.authparams() + "&profid=" + profid;
            jt.call('GET', url, null,
                    function (wps) {
                        profref.wps = wps;
                        app.contact.wpsProfileDisplay(dispdiv, prof); },
                    app.failf(function (code, errtxt) {
                        jt.out(dispdiv, "fetchwork for profile failed " + 
                               code + ": " + errtxt); }),
                    jt.semaphore("contact.wpsProfileDisplay"));
            return; }
        if(jt.instId(prof) === jt.instId(app.profile.getMyProfile())) {
            mode = "myprof"; }
        displayWorkPeriods(dispdiv, wps, mode);
    },


    wpsOpportunityDisplay: function (dispdiv, opp) {
        var oppid, oppref, url, wps, mode = "opp";
        jt.out(dispdiv, "");
        oppid = jt.instId(opp);
        oppref = app.lcs.getRef("opp", oppid);
        wps = oppref.wps;
        if(!wps) {
            url = "fetchwork?" + app.login.authparams() + "&oppid=" + oppid;
            jt.call('GET', url, null,
                    function (wps) {
                        oppref.wps = wps;
                        app.contact.wpsOpportunityDisplay(dispdiv, opp); },
                    app.failf(function (code, errtxt) {
                        jt.out(dispdiv, "fetchwork for opportunity failed " +
                               code + ": " + errtxt); }),
                    jt.semaphore("contact.wpsOpportunityDisplay"));
            return; }
        if(opp.contact.csvcontains(jt.instId(app.profile.getMyProfile()))) {
            mode = "coord"; }
        displayWorkPeriods(dispdiv, wps, mode);
    },


    condlg: function (code) {
        var me, them, book, profid, entry = null, i;
        me = app.profile.getMyProfile();
        them = app.profile.getCurrentProfile();
        if(!me.book) {
            me.book = []; }
        book = me.book;
        profid = jt.instId(them);
        for(i = 0; i < book.length; i += 1) {
            if(book[i][1] === profid) {
                entry = book[i];
                break; } }
        if(!entry) {
            entry = [them.name, profid, "", []]; }
        entry[0] = them.name;  //they might have changed their name...
        displayContactDialog(code, entry);
    },


    getActionButtons: function (me, them) {
        var entry, context, buttons = [];
        entry = findEntry(them);
        if(entry) {
            buttons.push(
                ["button", {type: "button", id: "showbookb",
                            onclick: jt.fs("app.contact.showbook()")},
                 "Contact Book"]); }
        else {
            buttons.push(
                ["button", {type: "button", id: "addtobookb",
                            onclick: jt.fs("app.contact.condlg('a2b')")},
                 "Add To Contact Book"]); }
        context = contextForContact();
        if(context && context.button) {
            buttons.push(
                ["button", {type: "button", id: "contactb",
                            onclick: jt.fs("app.contact.condlg('" + 
                                           context.code + "')")},
                 context.button]); }
        return buttons;
    },


    emcbchg: function () {
        var cb = jt.byId("emcb");
        if(cb) {
            if(cb.checked) {
                jt.byId('contactokb').disabled = false; }
            else {
                jt.byId('contactokb').disabled = true; } }
    },


    contactok: function (codestr) {
        var data;
        data = {code: codestr,
                profid: jt.instId(app.profile.getCurrentProfile()),
                oppid: jt.instId(app.opp.getCurrentOpportunity()) || 0,
                wpid: jt.instId(currwp) || 0};
        if(!checkSetContactDataVals(data, codestr)) {
            return; }
        jt.out('dlgbdiv', codes[codestr].prog + "...");
        data = jt.objdata(data);
        jt.call('POST', "contact?" + app.login.authparams(), data,
                function (results) {
                    app.profile.setMyProfile(
                        app.lcs.put("prof", results[0]).prof);
                    noteUpdatedWorkPeriod(results);
                    app.layout.closeDialog();
                    app.profile.byprofid(
                        jt.instId(app.profile.getCurrentProfile())); },
                app.failf(function (code, errtxt) {
                    //don't overwrite content in case they want to copy it
                    jt.out('dlgbdiv', "Call failed " + code +
                           ": " + errtxt); }),
                jt.semaphore("contact.contactok"));
    },


    showbook: function () {
        //ATTENTION: scroll the book display to the current profile 
        var book, html = [], i;
        book = app.profile.getMyProfile().book || [];
        for(i = 0; i < book.length; i += 1) {
            html.push(bookEntryDispHTML(book[i])); }
        if(html.length === 0) {
            html.push("No contacts yet"); }
        html = ["div", {id: "contactbookdiv"},
                html];
        html = app.layout.dlgwrapHTML("Contact Book", html);
        app.layout.openDialog({y:90}, jt.tac2html(html));
    },


    bookjump: function (type, id) {
        app.layout.closeDialog();
        switch(type) {
        case "prof": return app.profile.byprofid(id);
        case "opp": return app.opp.byoppid(id); }
    },


    togglebookdet: function (profid, index) {
        var entry, comm, div, html;
        entry = findEntry(profid);
        comm = entry[3][index];
        div = jt.byId("cbed" + profid);
        if(div.style.display === "block") {
            div.style.display = "none"; }
        else {
            html = [["div", {cla: "cbdet1div"},
                     [["span", {cla: "cbdtstamp"}, 
                       jt.colloquialDate(comm[0])], " - ",
                      ["span", {cla: "cbdcode"}, 
                       comm[1] + " "],
                      ["span", {cla: "cbdname"}, 
                       "(" + codes[comm[1]].name + ")"]]],
                    ["div", {cla: "cbdet2div"},
                     commOppWorkLineHTML(comm)],
                    ["div", {cla: "cbdet3div"},
                     ["div", {cla: "bigtxtdiv"},
                      jt.linkify(jt.dec(comm[2]))]]];
            jt.out("cbed" + profid, jt.tac2html(html));
            div.style.display = "block"; }
    }


};  //end of returned functions
}());

