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
        //If the notes field contains **blocked** then no comms make
        //it through.  Implement when needed.  The comms field is an
        //array of communication entries:
        //       [tstamp, code, msgtxt, oppname, oppid, wpid]
        //sorted with the most recent entry first.  The opportunity
        //and work period refs are defined if needed.  Older entries
        //roll off as they are replaced with newer ones, see work.py
        //for retentions.  The oppname is redundant and could even
        //drift out of date, but it is stored for ease of display.
        commstates = {
            nostate: {
                optdescr: "There are no further actions available",
                dlg: {
                    exp1: "No actions available." },
                actions: [] },
            vinq: { //volunteer inquiring about volunteering
                title: "Volunteering Inquiry",
                optdescr: "Contacting a coordinator is the first step in volunteering, and your offer to help out is deeply appreciated! To help smooth the process, please describe why you are a good match for what is needed, and allow a few days for people to get back to you.",
                dlg: {
                    subj1: "Inquiring about volunteering for",
                    subj2: "$OPPLINK - $THEM",
                    txtpl: "What motivations and strengths will help you" +
                        " contribute positively to $OPPNAME?",
                    hours: "Requested" },
                actions: [
                    { verb: "Contact", prog: "Contacting", emrel: true,
                      actname: "Volunteering Inquiry",
                      mycomm: { code: "mvi", next: "vstart", txtreq: true,
                                delay: 3},
                      theircomm: { code: "tvi", next: "inqresp" } }] },
            vrej: { //volunteering offer was rejected
                title: "Withdraw Offer",
                optdescr: "Sometimes an opportunity doesn't work out. You can always retry later after doing something else.",
                dlg: {
                    subj1: "Withdraw offer for",
                    subj2: "$OPPLINK - $THEM",
                    commtxt: true },
                actions: [
                    { verb: "Withdraw", prog: "Withdrawing",
                      actname: "Withdrawn Inquiry",
                      mycomm: { code: "mvw", next: "" },
                      theircomm: { code: "tvw", next: "" } }] },
            vstart: {
                title: "Start Work",
                optdescr: "After asking about volunteering, you should hear back from the coordinator within a week. Use the email link to contact them directly if there are details to be worked out before starting, or if you have more questions. After you have been in touch, you can either withdraw your offer or go to work. When you know what day you are starting, fill in the Start field and click the Start button to begin tracking your hours.",
                dlg: {
                    exp1: "Withdraw offer or start work for",
                    subj2: "$OPPLINK - $THEM",
                    commtxt: true,
                    hours: "Ongoing",
                    start: "Entry" },
                actions: [
                    { verb: "Withdraw", prog: "Withdrawing",
                      actname: "Withdrawn Inquiry",
                      mycomm: { code: "mvw", next: "" },
                      theircomm: { code: "tvw", next: "" } },
                    { verb: "Start", prog: "Starting",
                      actname: "Start Work",
                      mycomm: { code: "mwu", next: "vwork"},
                      theircomm: null }] },
            vwork: { //volunteer is withdrawing offer or updating work def
                title: "Work Update",
                optdescr: "After volunteering for this work period, complete it to track your hours. You can re-inquire to volunteer again if this is an ongoing opportunity.",
                dlg: {
                    exp1: "Updating your volunteering work description for",
                    subj2: "$OPPLINK - $THEM",
                    hours: "Ongoing",
                    start: "Entry" },
                actions: [
                    { verb: "Withdraw", prog: "Withdrawing",
                      actname: "Withdrawn Inquiry",
                      mycomm: { code: "mvw", next: "" },
                      theircomm: { code: "tvw", next: "" } },
                    { verb: "Update", prog: "Updating",
                      actname: "Update Work",
                      mycomm: { code: "mwu", next: "vwork"},
                      theircomm: null },
                    { verb: "Complete", prog: "Completing",
                      actname: "Work Completed",
                      mycomm: { code: "mwd", next: "" },
                      theircomm: { code: "twd", next: "wrkconf" } }] },
            inqresp: { //coordinator responding to a volunteering inquiry
                title: "Inquiry Response",
                optdescr: "You can reject a volunteer for any reason, but any guidance you can provide is much appreciated. If you respond, please be clear about what the volunteer should do next. If more steps are needed before starting work, ask the volunteer to contact you directly by email.",
                dlg: {
                    subj1: "$OPPLINK - $THEM",
                    commtxt: true,
                    txtpl: "What should $THEIRNAME do next?",
                    hours: "Requested" },
                actions: [
                    { verb: "Reject", prog: "Rejecting", 
                      actname: "Inquiry Refused",
                      mycomm: { code: "mvf", next: "" },
                      theircomm: { code: "tvf", next: "vrej" } },
                    { verb: "Respond", prog: "Responding", emrel: true,
                      actname: "Inquiry Response",
                      mycomm: { code: "mvy", next: "", txtreq: true },
                      theircomm: { code: "tvy", next: "vstart" } }] },
            wrkconf: { //coordinator is confirming completed work
                title: "Work Completion",
                optdescr: "Confirm the hours volunteered are correct, adjusting as needed to accurately reflect the time actually contributed. If this is an ongoing opportunity, the volunteer will submit a new inquiry for additional hours.",
                dlg: {
                    subj1: "Work done by $THEIRNAME for $OPPNAME",
                    txtpl: "Any feedback you want to share with $THEIRNAME" +
                        " about the work they did?",
                    hours: "Worked",
                    start: "Entry" },
                actions: [  //wp status is figured from hours...
                    { verb: "Confirm", prog: "Confirming",
                      actname: "Work Completion",
                      mycomm: { code: "mwc", next: "wrkconf", end: true },
                      theircomm: { code: "twc", next: "opprev", 
                                   delay: 7, noprompt: 14 } 
                    }] },
            opprev: { //volunteer is reviewing opportunity
                title: "Opportunity Review",
                optdescr: "If you want, you can write a public review of this volunteer opportunity based on your experience. Reviews add detail to your profile about the work you have done which helps other volunteers and people viewing your profile.",
                dlg: {
                    exp1: "Share your experience",
                    txtpl: "How did this volunteering work enrich you?" +
                        " What was the impact? Your words may help other" +
                        " volunteers and groups reading about the work." },
                actions: [
                    { verb: "Publish", prog: "Publishing",
                      actname: "Opportunity Review",
                      mycomm: { code: "mor", next: "opprev", 
                                txtreq: true, end: true },
                      theircomm: { code: "tor", next: "volrev", 
                                   noprompt: 5 } 
                    }] },
            volrev: { //coordinator is reviewing volunteer's contribution
                title: "Volunteer Contribution Review",
                optdescr: "If you want, you can write a brief public statement describing how this volunteer stepped up to accomplish a task, and/or the impact they had. Reviewing work is one of the best ways to appreciate and encourage volunteering.",
                dlg: {
                    exp1: "Recommend $THEIRNAME",
                    commtxt: true,
                    txtpl: "What do you want to tell the community about" +
                        " how this volunteer helped your organization?" },
                actions: [
                    { verb: "Publish", prog: "Publishing",
                      actname: "Volunteer Review",
                      mycomm: { code: "mvr", next: "volrev", 
                                txtreq: true, end: true },
                      theircomm: { code: "tvr", next: "" } }] },
            oppshare: { //coordinator or friend sharing an opportunity
                title: "Opportunity Share",
                optdescr: "If you think someone would be a good match, and possibly be interested in an opportunity, you can share it with them to bring it to their attention. If they are interested, then they will inquire about volunteering.",
                dlg: {
                    subj1: "Interested in volunteering for",
                    subj2: "$OPPLINK",
                    txtpl: "Why is $OPPNAME a great match?" },
                actions: [
                    { verb: "Contact", prog: "Contacting", emrel: true,
                      actname: "Opportunity Share",
                      mycomm: { code: "msh", next: "", txtreq: true },
                      theircomm: { code: "tsh", next: "shresp" } }] },
            shresp: { //reaction to a shared opportunity
                title: "Share Response",
                optdescr: "Click on the opportunity link to read about it, then click the contact link to inquire about volunteering. Click the dismiss button to remove this share from your notices.",
                dlg: {
                    subj1: "Shared Volunteering Opportunity",
                    subj2: "$OPPLINK - $THEM",
                    commtxt: true },
                actions: [
                    { verb: "Dismiss", prog: "Dismissing",
                      actname: "Dismissed Share",
                      mycomm: { code: "msd", next: "" },
                      theircomm: null }] },
            bookadd: { //anyone adding anyone else to their contact book
                title: "Contact Book Add",
                optdescr: "If you add someone to your contact book, and they add you back, then you can request their email address. Your contact book is a place to keep track of people you know or might like to meet.",
                dlg: {
                    exp1: "Adding $THEIRNAME to your contact book" },
                actions: [
                    { verb: "Add To Contact Book", prog: "Adding",
                      actname: "Contact Book Add",
                      mycomm: { code: "mab", next: "" },
                      theircomm: { code: "tab", next: "addback", 
                                   end: true } }] },
            addback: { //adding back to confirm contact
                title: "Contact Book Add Back",
                optdescr: "If you add someone back, then you are treated as friends and can request email addresses from each other.",
                dlg: {
                    exp1: "Add back $THEIRNAME to your contact book" },
                actions: [
                    { verb: "Add Back", prog: "Adding",
                      actname: "Contact Add Back",
                      mycomm: { code: "mab", next: "" },
                      theircomm: { code: "tab", next: "" } }] },
            emreq: { //mutual contact or co-worker requesting email address
                title: "Contact Information Request",
                optdescr: "If you have worked with someone, or if you are mutual contacts, then you can request their email address to get in touch. They may or may not respond, your respect and understanding is appreciated.",
                dlg: {
                    subj1: "Requesting email address",
                    txtpl: "Why are you requesting their email?" },
                actions: [
                    { verb: "Request", prog: "Requesting", emrel: true,
                      actname: "Contact Info Request",
                      mycomm: { code: "mci", next: "", txtreq: true },
                      theircomm: { code: "tci", next: "emresp" } }] },
            emresp: { //responding to an email request
                title: "Contact Information Response",
                optdescr: "If you are not completely comfortable giving your email address to this person, then you should ignore their request. If you would like to stay in touch, then release your email address so you can contact each other directly.",
                dlg: {
                    subj1: "Response for email address request from",
                    subj2: "$THEM",
                    commtxt: true },
                actions: [
                    { verb: "Ignore", prog: "Ignoring",
                      actname: "Contact Info Ignore",
                      mycomm: { code: "mcg", next: "" },
                      theircomm: null },
                    { verb: "Release", prog: "Releasing", emrel: true,
                      actname: "Contact Info Response",
                      mycomm: { code: "mcr", next: "" },
                      theircomm: { code: "tcr", next: ""} }] } },
        tracksel = [{noun: "Day", adj: "Daily", max: 8, ceiling: 24},
                    {noun: "Week", adj: "Weekly", max: 20, ceiling: 120},
                    {noun: "Month", adj: "Monthly", max: 80, ceiling: 350}],
        dlgstate = { profid: "", oppid: "", wpid: "" },


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
        //mutually listed in contact books, or co-volunteers.  The "cov"
        //comms entry is added automatically by server processing.  The
        //logic here is equivalent to is_friend in work.py
        var entry = findEntry(them);
        if(entry && ((mostRecentComm(entry, "mab") && 
                      mostRecentComm(entry, "tab")) ||
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
            return { name: "vinq", button: "Ask To Volunteer",
                     oppname: opp.name }; }
        //You are searching for volunteers, or passing an opportunity
        //along to a friend:
        if(opp && (opp.contact.csvcontains(jt.instId(me)) || 
                   isFriend(them))) {
            return { name: "oppshare", button: "Share Opportunity",
                     oppname: opp.name }; }
        //You are friends and you are requesting contact info
        if(isFriend(them) && !haveContactInfo(them)) {
            return { name: "emreq", button: "Request Email Address" }; }
        //No context to contact them.
        return {};
    },


    emailReleaseCheckboxHTML = function (csname, entry, commobj) {
        var cs, emrel = false, i, html = "";
        cs = commstates[csname || "nostate"];
        for(i = 0; i < cs.actions.length; i += 1) {
            if(cs.actions[i].emrel) {
                emrel = true;
                break; } }
        if(emrel) {
            html = [["input", {type: "checkbox", name: "emcb", id: "emcb",
                               cla: "contactcb", value: "releaseMyEmail",
                               checked: "checked", 
                               onchange: jt.fs("app.contact.emcbchg()")}],
                    ["label", {fo: "releaseMyEmail", id: "emcblabel"},
                     "Give " + entry[0] + " my email address"]]; }
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


    contactDialogActionButtonsHTML = function (cs) {
        var html = [], i, bid, codestr;
        bid = "dlgdefaultbutton";
        if(cs.actions.length > 0) {
            bid = "contactcancelb"; }
        html.push(["button", {type: "button", id: bid,
                              onclick: jt.fs("app.layout.closeDialog()")},
                   (cs.actions.length > 0 ? "Cancel" : "Ok")]);
        for(i = 0; i < cs.actions.length; i += 1) {
            bid = jt.canonize(cs.actions[i].verb);
            if(i === cs.actions.length - 1) {
                bid = "dlgdefaultbutton"; } 
            codestr = cs.actions[i].mycomm.code;
            html.push(["button", {type: "button", id: bid,
                                  onclick: jt.fs("app.contact.contactok('" +
                                                 codestr + "')")},
                       cs.actions[i].verb]); }
        return html;
    },


    replaceDollarRefs = function (text, entry, commobj) {
        var opp, org, html;
        text = text.replace("$THEIRNAME", entry[0]);
        if(text.indexOf("$THEM") >= 0) {
            html = ["a", {href: "#" + entry[0],
                          onclick: jt.fs("app.contact.bookjump('prof','" +
                                         entry[1] + "')")},
                    entry[0]];
            if(entry[2]) {
                html = [html,
                        " ",
                        ["a", {href: "mailto:" + entry[2]},
                         ["img", {cla: "cbemlinkimg", 
                                  src: "img/email.png"}]]]; }
            text = text.replace("$THEM", jt.tac2html(html)); }
        if(text.indexOf("$OPPNAME") >= 0) {
            opp = app.lcs.getRef("opp", commobj.oppid).opp;
            org = app.lcs.getRef("org", opp.organization).org;
            text = text.replace("$OPPNAME", org.name + " " + opp.name); }
        if(text.indexOf("$OPPLINK") >= 0) {
            //the refs were faulted in when the dialog was displayed
            opp = app.lcs.getRef("opp", commobj.oppid).opp;
            org = app.lcs.getRef("org", opp.organization).org;
            html = ["a", {href: "#" + opp.name,
                          onclick: jt.fs("app.contact.bookjump('opp','" +
                                         commobj.oppid + "')")},
                    org.name + " " + opp.name];
            text = text.replace("$OPPLINK", jt.tac2html(html)); }
        return text;
    },


    verifyWorkPeriodLoaded = function (wpid) {
        if(wpid) {
            app.lcs.getFull("wp", wpid, function (wpref) {
                jt.log("verifyWorkPeriodLoaded " + wpid); }); }
    },


    //The assumption is that the WorkPeriod has already been loaded.
    //Either with the profile, with the opportunity, or with the
    //contact notice.  Not having it available is basically an error.
    findWorkPeriod = function (wpid) {
        var wpref;
        if(!wpid) {
            jt.log("WARNING: findWorkPeriod called with no wpid");
            return null; }
        wpref = app.lcs.getRef("wp", wpid);
        if(wpref.wp) {
            return wpref.wp; }
        if(wpref.status === "not cached") {
            jt.log("ERROR: findWorkPeriod wpid " + wpid + " not cached.");
            app.lcs.getFull("wp", wpid, function (x) {
                jt.log("findWorkPeriod fetched wpid " + wpid); }); }
        else {
            jt.log("ERROR: findWorkPeriod wpid " + wpid + " not found."); }
        return null;
    },


    setDialogState = function (profid, oppid, wpid) {
        dlgstate.profid = profid || "";
        dlgstate.oppid = oppid || "";
        dlgstate.wpid = wpid || "";
    },


    describeActionsHTML = function(uid, linktxt, csname) {
        var html;
        if(!csname) { 
            return ""; }
        html = ["div", {id: "descactcontdiv" + uid},
                [["div", {id: "descacttitlediv" + uid, cla: "formbuttonsdiv"},
                  ["a", {href: "#describe",
                         onclick: jt.fs("app.contact.toggleDA('" + uid +
                                        "','" + csname + "')")},
                   linktxt]],
                 ["div", {id: "descactdiv" + uid, cla: "descactdiv"}]]];
        return html;
    },


    displayContactDialog = function (csname, entry, commobj) {
        var html = [], cs, wp = null, dval;
        setDialogState(entry[1], commobj.oppid, commobj.wpid);
        cs = commstates[csname || "nostate"];
        if(commobj.wpid) {
            wp = findWorkPeriod(commobj.wpid); }
        if(cs.dlg.exp1) {
            html.push(["div", {id: "condlgexp1div"}, 
                       replaceDollarRefs(cs.dlg.exp1, entry, commobj)]); }
        if(cs.dlg.exp2) {
            html.push(["div", {id: "condlgexp2div"}, 
                       replaceDollarRefs(cs.dlg.exp2, entry, commobj)]); }
        if(cs.dlg.subj1) {
            html.push(["div", {id: "condlgsubj1div"}, 
                       replaceDollarRefs(cs.dlg.subj1, entry, commobj)]); }
        if(cs.dlg.subj2) {
            html.push(["div", {id: "condlgsubj2div"}, 
                       replaceDollarRefs(cs.dlg.subj2, entry, commobj)]); }
        if(cs.dlg.commtxt) {
            html.push(["div", {id: "condlgcommtxtdiv", cla: "bigtxtdiv"},
                       jt.linkify(jt.dec(commobj.msgtxt))]); }
        html.push(emailReleaseCheckboxHTML(csname, entry, commobj));
        if(cs.dlg.txtpl) {
            html.push(["div", {id: "condlgtxtdiv", cla: "bigtxtdiv"},
                       ["textarea", {id: "condlgta", cla: "bigta"}]]); }
        if(cs.dlg.hours) {
            html.push(["div", {id: "condlghoursdiv"},
                       [(cs.dlg.hours === "Requested" ? "Requesting " : ""),
                        ["input", {id: "hoursin", min: 1, 
                                   value: (wp && wp.hours) || "",
                                   type: "number", style: "width:3em;"}],
                        " hours per ",
                        trackselHTML("noun", (wp && wp.tracking) || null)]]); }
        if(cs.dlg.start) {
            dval = (wp && wp.start) || new Date().toISOString();
            dval = dval.slice(0, 10);
            html.push(["div", {id: "condlgstartdiv"},
                       [["label", {fo: "startin", id: "condlgstartlabel"},
                         "Start"],
                        " ",
                        ["input", {id: "startin", type: "date",
                                   value: dval}]]]); }
        html = ["div", {id: "condlgcontentdiv"},
                [html,
                 describeActionsHTML("condlg", "Describe Options", csname),
                 ["div", {id: "dlgerrmsgdiv"}],
                 ["div", {id: "dlgbdiv", cla: "formbuttonsdiv"},
                  contactDialogActionButtonsHTML(cs)]]];
        html = app.layout.dlgwrapHTML(cs.title, html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('dlgdefaultbutton').focus(); });
        if(jt.byId('condlgta')) {
            app.initTextArea("condlgta", "", replaceDollarRefs(
                cs.dlg.txtpl, entry, commobj)); }
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
        html = ["div", {cla: "wpdescline", id: "wpdldiv" + jt.instId(wp)},
                [["span", {cla: "wpnamelink"}, namelink],
                 ["span", {cla: "wpstatlab"}, " status: "],
                 ["span", {cla: "wpstatus"},
                  wpEditFieldHTML(wp, mode, "status")],
                 ["span", {cla: "wphours"},
                  wpEditFieldHTML(wp, mode, "hours")],
                 ["span", {cla: "wpstatunits"}, " hrs"]]];
        return html;
    },


    sortWorkPeriods = function (wps) {
        wps.sort(function (a, b) {
            if(a.modified > b.modified) { return -1; }
            if(a.modified < b.modified) { return 1; }
            return 0; });
    },


    noteUpdatedWorkPeriod = function (results) {
        var wp, wpid, profref, found = false, i, mode, html;
        if(results.length <= 1) {
            return; }  //no WorkPeriod to note
        wp = results[1];
        app.lcs.put("wp", wp);
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
        sortWorkPeriods(profref.wps);
        if(jt.byId("wpdldiv" + wpid)) {  //is displayed on screen
            mode = jt.byId("wpsoppdiv") ? "coord" : "myprof";
            html = workPeriodHTML(wp, mode);
            html = html[2];  //strip outer div, re-use existing
            jt.out("wpdldiv" + wpid, jt.tac2html(html)); }
    },


    actionForCode = function (code) {
        var name, actions, i;
        for(name in commstates) {
            if(commstates.hasOwnProperty(name)) {
                actions = commstates[name].actions;
                for(i = 0; i < actions.length; i += 1) {
                    if(actions[i].mycomm && 
                       actions[i].mycomm.code === code) {
                        return actions[i]; }
                    if(actions[i].theircomm &&
                       actions[i].theircomm.code === code) {
                        return actions[i]; } } } }
        return null;
    },


    codeDefinition = function (code) {
        var action;
        action = actionForCode(code);
        if(action) {
            if(action.mycomm.code === code) {
                return action.mycomm; }
            if(action.theircomm.code === code) {
                return action.theircomm; } }
        return null;
    },


    checkSetContactDataVals = function (data, codestr) {
        var retval = true, cdef, input, ts = null,
            errborder = "medium solid red";
        cdef = codeDefinition(codestr);
        //verify text area content
        input = jt.byId('condlgta');
        if(input) {
            if(cdef.txtreq && !input.value) {
                input.style.border = errborder;
                retval = false; }
            data.msgtxt = input.value; }
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
        //start date may or may not be provided
        input = jt.byId('startin');
        if(input) {
            try {
                data.start = new Date(input.value).toISOString();
            } catch (e) {
                input.style.border = errborder;
                retval = false;
            } }
        return retval;
    },


    displayWorkPeriods = function (dispdiv, wps, mode) {
        var i, html = [];
        if(!wps || wps.length === 0) {
            jt.out(dispdiv, "");
            return; }
        sortWorkPeriods(wps);
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


    commOppSpanHTML = function (comm) {
        var html = "";
        if(comm.length > 3 && comm[3]) { //have oppname
            html = ["span", {cla: "cbdopp"},
                    ["a", {href: "#view=opp&oppid=" + comm[4],
                           onclick: jt.fs("app.contact.bookjump('opp','" +
                                          comm[4] + "')")},
                     comm[3]]]; }
        return html;
    },


    wpIsEditable = function (wp) {
        if(typeof wp === "string") {
            wp = findWorkPeriod(wp); }
        if(wp.volunteer === jt.instId(app.profile.getMyProfile())) {
            if(wp.status === "Inquiring" || 
               wp.status === "Responded" ||
               wp.status === "Volunteering") {
                return true; } }
        else {  //assume they are the coordinator since viewing...
            if(wp.status === "Inquiring" ||
               wp.status === "Done" ||
               wp.status === "No Show" ||
               wp.status === "Completed") {
                return true; } }
        return false;
    },


    commWorkUpdateButtonHTML = function (profid, index, comm, csname) {
        var bname, html;
        if(!csname) {
            return ""; }
        if(comm.length >= 6 && comm[5] && wpIsEditable(comm[5])) {
            html = jt.fs("app.contact.wpedit('" + comm[5] + "')");
            bname = "Update Work"; }
        else {
            html = jt.fs("app.contact.condlg('" + csname + "','" + 
                         profid + "','" + index + "')");
            bname = commstates[csname].title; }
        html = ["span", {cla: "cbdwp"},
                ["button", {type: "button", id: "wpeditb",
                            onclick: html},
                 bname]];
        return html;
    },


    entryObject = function (entry) {
        var obj = { name: "", profid: "", email: "", comms: [], notes: "" };
        if(entry) {
            obj.name = entry[0];
            obj.profid = entry[1];
            if(entry.length >= 3) {
                obj.email = entry[2]; }
            if(entry.length >= 4) {
                obj.comms = entry[3]; }
            if(entry.length >= 5) {
                obj.notes = entry[4]; } }
        return obj;
    },


    commObject = function (comm) {
        var obj = { tstamp: "1970-01-01T00:00:00Z", code: "", msgtxt: "",
                    oppname: "", oppid: "", wpid: "" };
        if(comm) {
            obj.tstamp = comm[0];
            obj.code = comm[1];
            if(comm.length >= 3) {
                obj.msgtxt = comm[2] || ""; }
            if(comm.length >= 5) {
                obj.oppname = comm[3] || "";
                obj.oppid = comm[4] || ""; }
            if(comm.length >= 6) {
                obj.wpid = comm[5]; } }
        return obj;
    },


    ongoingWork = function (wp) {
        var monthmax = { "01": 31, "02": 28, "03": 31, "04": 30,
                         "05": 31, "06": 30, "07": 31, "08": 31,
                         "09": 30, "10": 31, "11": 30, "12": 31 };
        if(wp.start) {
            if(wp.tracking === "Daily") {
                wp.end = jt.ISOString2Day(wp.start).getTime();
                wp.end += 24 * 60 * 60 * 1000;
                wp.end = new Date(wp.end).toISOString(); }
            else if(wp.tracking === "Monthly") {
                wp.end = wp.start.slice(0, 8) +
                    monthmax[wp.start.slice(5, 7)] +
                    "T00:00:00Z"; }
            else { //weekly or unknown value assumed to be weekly
                wp.end = jt.ISOString2Day(wp.start).getTime();
                wp.end += 7 * 24 * 60 * 60 * 1000;
                wp.end = new Date(wp.end).toISOString(); }
            if(new Date().toISOString() < wp.end) {
                return true; } }
        return false;
    },


    inActions = function (commstatename, codestr) {
        var cs, i, action;
        cs = commstates[commstatename || "nostate"];
        for(i = 0; i < cs.actions.length; i += 1) {
            action = cs.actions[i];
            if(action.mycomm && action.mycomm.code === codestr) {
                return true; }
            if(action.theircomm && action.theircomm.code === codestr) {
                return true; } }
        return false;
    },


    actedOn = function (cdef, commobj, comms, index) {
        var delay, wp, commstate, i, action, j, resp;
        //if this is an end state in the communication state machine
        if(cdef.end) {
            return true; }
        //if there is a delay that hasn't been met yet
        if(cdef.delay) {
            delay = jt.ISOString2Day(commobj.tstamp).getTime();
            delay += cdef.delay * 24 * 60 * 60 * 1000;
            delay = new Date(delay).toISOString();
            if(delay > new Date().toISOString()) {
                return true; } }
        //if the work is currently ongoing
        if(commobj.wpid) {
            //the wp would have been loaded with the profile...
            wp = findWorkPeriod(commobj.wpid);
            if(wp && ongoingWork(wp)) {
                return true; } }
        //if there are no further actions
        commstate = commstates[cdef.next || "nostate"];
        if(!commstate || !commstate.actions || !commstate.actions.length) {
            return true; }
        //if the reciprocal action was taken or a canceling action was taken
        for(i = 0; i < commstate.actions.length; i += 1) {
            action = commstate.actions[i];
            for(j = index - 1; j >= 0; j -= 1) {
                resp = commObject(comms[j]);
                if(action.mycomm) {
                    if(inActions(cdef.next, resp.code) ||
                       inActions(action.mycomm.next, resp.code)) {
                        return true; } }
                if(action.theircomm) {
                    if(inActions(cdef.next, resp.code) ||
                       inActions(action.theircomm.next, resp.code)) {
                        return true; } } } }
        return false;
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    wpedit: function (wpid) {
        var book, i, entry, j, cobj, cdef;
        book = app.profile.getMyProfile().book;
        for(i = 0; i < book.length; i += 1) {
            entry = entryObject(book[i]);
            for(j = 0; j < entry.comms.length; j += 1) {
                cobj = commObject(entry.comms[j]);
                if(cobj.wpid === wpid) {
                    cdef = codeDefinition(cobj.code);
                    return app.contact.condlg(cdef.next, entry.profid, j); } } }
        jt.err("No communication regarding wpid " + wpid + " was found." +
               " \nPlease contact support.");
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
                        app.lcs.putAll("wp", wps);
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
                        app.lcs.putAll("wp", wps);
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


    condlg: function (csname, profid, commindex) {
        var me, book, them, entry = null, i, commobj = null, 
            oppref = null, orgid = "", orgref = null;
        //verify book entry, faulting in profile if needed
        me = app.profile.getMyProfile();
        if(!me.book) {
            me.book = []; }
        book = me.book;
        if(!profid) {
            them = app.profile.getCurrentProfile();
            profid = jt.instId(them); }
        else {
            them = app.lcs.getRef("prof", profid);
            if(them.status === "not cached") {
                return app.lcs.getFull("prof", profid, function (profref) {
                    app.contact.condlg(csname, profid, commindex); }); }
            them = them.prof; }
        for(i = 0; i < book.length; i += 1) {
            if(book[i][1] === profid) {
                entry = book[i];
                break; } }
        if(!entry) {
            entry = [them.name, profid, "", []]; }
        entry[0] = them.name;  //they might have changed their name...
        //verify opportunity, faulting in as needed
        commobj = commObject(commindex >= 0 ? entry[3][commindex] : null);
        if(commindex === undefined || commindex === -1) {
            commobj.oppid = jt.instId(app.opp.getCurrentOpportunity()); }
        if(commobj.oppid) {
            oppref = app.lcs.getRef("opp", commobj.oppid);
            if(oppref.status === "not cached") {
                return app.lcs.getFull("opp", commobj.oppid, function (x) {
                    app.contact.condlg(csname, profid, commindex); }); } }
        if(oppref && oppref.opp) {
            orgid = oppref.opp.organization;
            orgref = app.lcs.getRef("org", orgid);
            if(orgref.status === "not cached") {
                return app.lcs.getFull("org", orgid, function (x) {
                    app.contact.condlg(csname, profid, commindex); }); } }
        //commobj.wpid should already be available from when the user
        //first logged in and displayed their profile
        displayContactDialog(csname, entry, commobj, commindex);
    },


    getActionButtons: function (me, them) {
        var entry, context, buttons = [];
        entry = findEntry(them);
        if(entry) {
            buttons.push(
                ["div", {cla: "buttonwithsubtext"},
                 [["button", {type: "button", id: "showbookb",
                              onclick: jt.fs("app.contact.showbook('" + 
                                             jt.instId(them) + "')")},
                   "Contact Book"],
                  ["div", {cla: "buttonsubtext"}, "&nbsp;"]]]); }
        else {
            buttons.push(
                ["div", {cla: "buttonwithsubtext"},
                 [["button", {type: "button", id: "addtobookb",
                              onclick: jt.fs("app.contact.condlg('bookadd')")},
                   "Add To Contact Book"],
                  ["div", {cla: "buttonsubtext"}, "&nbsp;"]]]); }
        context = contextForContact();
        if(context && context.button) {
            buttons.push(
                ["div", {cla: "buttonwithsubtext"},
                 [["button", {type: "button", id: "contactb",
                              onclick: jt.fs("app.contact.condlg('" + 
                                             context.name + "')")},
                   context.button],
                  ["div", {cla: "buttonsubtext"},
                   context.oppname ? "(" + context.oppname + ")" : "&nbsp;"
                  ]]]); }
        return buttons;
    },


    emcbchg: function () {
        //NB: This assumes that only the last defined button has email toggle.
        var cb, button;
        cb = jt.byId("emcb");
        if(cb) {
            button = jt.byId('dlgdefaultbutton');
            if(cb.checked) {
                button.className = "buttonwithsubtext";
                button.disabled = false; }
            else {
                button.className = "buttonwithsubtext disabledbutton";
                button.disabled = true; } }
    },


    contactok: function (codestr) {
        var data, bookprofid, actdef, buttonhtml;
        data = {code: codestr,
                profid: dlgstate.profid,
                oppid: dlgstate.oppid,
                wpid: dlgstate.wpid};
        bookprofid = dlgstate.profid;
        if(!checkSetContactDataVals(data, codestr)) {
            return; }
        actdef = actionForCode(codestr);
        buttonhtml = jt.byId('dlgbdiv').innerHTML;
        jt.out('dlgbdiv', actdef.prog + "...");
        jt.out('dlgerrmsgdiv', "");
        data = jt.objdata(data);
        jt.call('POST', "contact?" + app.login.authparams(), data,
                function (results) {
                    app.profile.setMyProfile(
                        app.lcs.put("prof", results[0]).prof);
                    noteUpdatedWorkPeriod(results);
                    app.menu.rebuildNotices();
                    app.profile.display();
                    app.layout.closeDialog();
                    app.contact.showbook(bookprofid); },
                function (code, errtxt) {
                    jt.out('dlgerrmsgdiv', actdef.prog + " (" + codestr + 
                           ") call failed " + code + ": " + errtxt);
                    jt.out('dlgbdiv', buttonhtml); },
                jt.semaphore("contact.contactok"));
    },


    showbook: function (profid) {
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
        if(profid) {
            app.contact.togglebookdet(profid, 0); }
    },


    bookjump: function (type, id) {
        app.layout.closeDialog();
        switch(type) {
        case "prof": return app.profile.byprofid(id);
        case "opp": return app.opp.byoppid(id); }
    },


    togglebookdet: function (profid, index) {
        var entry, comm, action, nextstate, div, html;
        entry = findEntry(profid);
        if(!entry) {
            jt.log("togglebookdet did not find profid " + profid);
            return; }
        comm = entry[3][index];
        action = actionForCode(comm[1]);
        if(action.mycomm && action.mycomm.code === comm[1]) {
            nextstate = action.mycomm.next; }
        else if(action.theircomm && action.theircomm.code === comm[1]) {
            nextstate = action.theircomm.next; }
        div = jt.byId("cbed" + profid);
        if(div.style.display === "block" && jt.byId("cbdet" + profid + index)) {
            div.style.display = "none"; }
        else {
            //ATTENTION: scroll the book display profile to top of div
            html = [["div", {cla: "cbdet1div", id: "cbdet" + profid + index},
                     [["span", {cla: "cbdtstamp"}, 
                       jt.colloquialDate(comm[0])], " - ",
                      ["span", {cla: "cbdcode"}, 
                       comm[1] + " "],
                      ["span", {cla: "cbdname"}, 
                       "(" + action.actname + ") "],
                      ["span", {cla: "cbdopp"},
                       commOppSpanHTML(comm)]]],
                    ["div", {cla: "cbdet2div"},
                     ["div", {cla: "bigtxtdiv"},
                      jt.linkify(jt.dec(comm[2]))]],
                    describeActionsHTML(String(profid) + index,
                                        "What Happens Next?", 
                                        nextstate),
                    ["div", {cla: "formbuttonsdiv"},
                     commWorkUpdateButtonHTML(profid, index, comm, nextstate)]];
            jt.out("cbed" + profid, jt.tac2html(html));
            div.style.display = "block"; }
    },


    toggleDA: function (uid, csname) {
        var domid;
        domid = "descactdiv" + uid;
        if(jt.byId(domid).innerHTML) {
            jt.out(domid, ""); }
        else {
            jt.out(domid, commstates[csname || "nostate"].optdescr); }
    },


    checkForNotices: function () {
        var book, i, eobj, comms, j, cobj, cdef, actdef;
        book = app.profile.getMyProfile().book || [];
        for(i = 0; i < book.length; i += 1) {
            eobj = entryObject(book[i]);
            comms = eobj.comms;
            for(j = 0; j < comms.length; j += 1) {
                cobj = commObject(comms[j]);
                cdef = codeDefinition(cobj.code);
                actdef = actionForCode(cobj.code);
                if(cdef && !actedOn(cdef, cobj, comms, j)) {
                    verifyWorkPeriodLoaded(cobj.wpid);
                    app.menu.createNotice({
                        noticetype: actdef.actname,
                        noticeprof: eobj.profid,
                        noticefunc: "app.contact.condlg('" + cdef.next +
                            "','" + eobj.profid + "'," + j + ")"}); } } }
    }


};  //end of returned functions
}());

