/*global setTimeout: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// Display a search match.
//

app.match = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var findtype = "",
        nodes = null,
        skillkw = null,
        canonskills = null,
        matchacc = null,
        matches = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    rebuildMatches = function () {
        var i, j, node, id;
        matchacc = {};
        matches = [];
        for(i = 0; i < nodes.length; i += 1) {
            node = nodes[i];
            for(j = 0; j < node.ids.length; j += 1) {
                id = node.ids[j];
                if(!matchacc[id]) {
                    matchacc[id] = { skillsmatched: 1, id: id };
                    matches.push(matchacc[id]); }
                else {
                    matchacc[id].skillsmatched += 1; } } }
    },


    //It is possible for an object to have been referenced by an
    //incomplete subset of the retrieved match nodes.  It might have
    //been pushed off the end of the more popular match keys but still
    //be present in some of the more specific ones.  When that happens
    //the match count will be off.  This utility counts up the
    //matching keys directly from the the object, rather than from
    //the match node references.
    countMatchedSkills = function (obj) {
        var requestskills, skill, i, j, count = 0;
        requestskills = obj.skills.csvarray();
        for(i = 0; i < requestskills.length; i += 1) {
            skill = jt.canonize(requestskills[i]);
            for(j = 0; j < canonskills.length; j += 1) {
                if(skill === canonskills[j]) {
                    count += 1; } } }
        return count;
    },


    fillMatchEntryFromRefObject = function(obj) {
        var match = matchacc[jt.instId(obj)];
        match.name_c = obj.name_c || jt.canonize(obj.name);
        match.skillsmatched = countMatchedSkills(obj);
        match.skillsrequested = obj.skills.csvarray().length;
    },


    getMatchLineImageURL = function (obj) {
        var cachetype, orgref;
        cachetype = (findtype === "volunteers" ? "prof" : "opp");
        if(cachetype === "prof") {
            if(obj.profpic) {
                return "profpic?profileid=" + jt.instId(obj); }
            return "img/emptyprofpic.png"; }
        if(cachetype === "opp") {
            orgref = app.lcs.getRef("org", obj.organization);
            if(orgref.status === "not cached") {
                app.lcs.getFull("org", obj.organization,
                                app.match.redisplayMatchImages);
                return "img/blank.png"; }
            if(orgref.org && orgref.org.details.logourl) {
                return orgref.org.details.logourl; } }
        return "img/blank.png";
    },


    displayMatchLinks = function () {
        var cachetype, dispfname, i, match, ref, html, obj;
        cachetype = (findtype === "volunteers" ? "prof" : "opp");
        dispfname = (findtype === "volunteers" ? "profile" : "opp");
        dispfname = "app." + dispfname + ".by" + cachetype + "id";
        for(i = 0; i < matches.length && i < 50; i += 1) {
            match = matches[i];
            ref = app.lcs.getRef(cachetype, match.id);
            if(ref.status === "not cached") {
                return app.lcs.getFull(cachetype, match.id, 
                                       app.match.redisplayMatchLinks); }
            if(ref[cachetype]) {
                obj = ref[cachetype];
                fillMatchEntryFromRefObject(obj);
                html = [["span", {cla: "matchcountspan"}, 
                         (+match.skillsmatched) + "/" + match.skillsrequested],
                        ["a", {href: "#" + match.name_c,
                               onclick: jt.fs(dispfname + "('" + 
                                              match.id + "')")},
                         [["img", {id: jt.instId(obj) + "img", 
                                   cla: "matchlinelogo", 
                                   src: getMatchLineImageURL(obj)}],
                          ["span", {cla: "matchnamespan"},
                           ref[cachetype].name]]]];
                jt.out("mdiv" + match.id, jt.tac2html(html)); } }
    },


    displayMatches = function () {
        var html, i;
        matches.sort(function (a, b) {
            if(a.skillsmatched > b.skillsmatched) { return -1; }
            if(a.skillsmatched < b.skillsmatched) { return 1; }
            if(a.skillsrequested && b.skillsrequested) {
                if(a.skillsrequested < b.skillsrequested) { return -1; }
                if(a.skillsrequested > b.skillsrequested) { return 1; } }
            if(a.name_c && b.name_c) {
                if(a.name_c < b.name_c) { return -1; }
                if(a.name_c > b.name_c) { return 1; } }
            return 0; });
        html = [];
        for(i = 0; i < matches.length; i += 1) {
            html.push(["div", {id: "mdiv" + matches[i].id, cla: "matchdiv"}]); }
        jt.out("matchlistdiv", jt.tac2html(html));
        displayMatchLinks();
    },


    displayNodes = function () {
        var html, keys = [], i, node;
        if(!jt.byId("matchlistdiv")) {
            html = ["div", {id: "matchcontentdiv"},
                    [["div", {id: "skillsdiv", cla: "matchskillsdiv"}],
                     ["div", {id: "matchlistdiv", cla: "matchlistdiv"}]]];
            jt.out('contentdiv', jt.tac2html(html)); }
        canonskills = [];
        for(i = 0; i < nodes.length; i += 1) {
            node = nodes[i];
            if(!node.count) {  //initialize generic match fields
                node.name_c = jt.instId(node);  //for ease of reference
                if(findtype === "volunteers") {
                    node.count = node.profcount;
                    node.ids = node.profiles; }
                else {
                    node.count = node.oppcount;
                    node.ids = node.opportunities; } }
            if(node.name_c !== "noskills") {
                keys.push((+node.count) + " " + node.name);
                canonskills.push(jt.canonize(node.name)); }
            if(typeof node.ids === "string") {
                node.ids = node.ids.csvarray(); } }
        if(skillkw) {
            skillkw.destroy(); }
        skillkw = app.kwentry("skillsdiv", "Skills Matched", 
                              keys, keys.join(","));
        skillkw.displayList();
        rebuildMatches();
        displayMatches();
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    //If no oppref is given, assume we are searching for
    //opportunities using the skills listed in the profile.
    init: function (oppref) {
        var prevtype, skills, url;
        if(oppref && typeof oppref !== "object") {
            return app.lcs.getFull("opp", oppref, app.match.init); }
        app.history.checkpoint({view: "match", 
                                oppid: oppref ? oppref.oppid : 0});
        prevtype = findtype;
        findtype = oppref ? "volunteers" : "opportunities";
        jt.out('contentdiv', "Searching for matching " + findtype + "...");
        if(nodes && prevtype === findtype) {
            return displayNodes(); }
        if(oppref) {
            skills = oppref.opp.skills; }
        else {
            skills = app.profile.getMyProfile().skills; }
        url = "match?" + app.login.authparams() + "&skills=" + jt.enc(skills);
        jt.call("GET", url, null,
                function (matchnodes) {
                    nodes = matchnodes;
                    displayNodes(); },
                app.failf(function (code, errtxt) {
                    jt.out('contentdiv', "match call failed " + code + 
                           ": " + errtxt); }),
                jt.semaphore("match.init"));
    },


    redisplayMatchLinks: function (ref) {
        var reftype;
        reftype = (findtype === "volunteers"? "prof" : "opp");
        if(ref[reftype]) {
            fillMatchEntryFromRefObject(ref[reftype]); }
        displayMatches();
    },


    redisplayMatchImages: function (ref) {
        displayMatches();
    }

};  //end of returned functions
}());

