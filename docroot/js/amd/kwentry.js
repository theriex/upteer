/*global app: false, jt: false, window: false, document: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// A keyword entry widget.
//

app.kwentry = function (calldivid, calltitle, callkeywords, callvalcsv) {
"use strict";
return (function () {

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var divid = calldivid,           //the divid for this widget display
        title = calltitle,           //the name of the field being edited
        keywords = callkeywords,     //the selectable keywords 
        valcsv = callvalcsv || "",   //the selected keywords
        elkwx = null,       //'x' dismiss selected keyword event listener
        elkwsel = null,     //select keyword from list click event listener
        elkwadd = null,     //keyword entry field add/change event listener
        tout = null,        //keyword entry field change listener timout handle


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    csvarray = function () {
        if(valcsv && valcsv.trim()) {
            return valcsv.split(","); }
        return [];
    },


    keywordSelected = function(keyword) {
        if(valcsv.endsWith(keyword) || valcsv.indexOf(keyword + ",") >= 0) {
            return true; }
        return false;
    },


    //The given keyword may be contained in other keywords, e.g. "web"
    //from "web,web developer,coder" leaves "web developer,coder"
    removeKeyword = function (keyword) {
        var idx, temp;
        if(valcsv === keyword) {
            valcsv = "";
            return; }
        idx = valcsv.indexOf(keyword + ",");
        while(idx >= 0) {
            temp = valcsv.slice(0, idx);
            temp += valcsv.slice(idx + keyword.length + 1);
            valcsv = temp;
            idx = valcsv.indexOf(keyword + ","); }
        if(valcsv.endsWith("," + keyword)) {
            valcsv = valcsv.slice(0, -1 * (keyword.length + 1)); }
    },


    selectedKeywordHTML = function(keyword, mode, index) {
        var html = [];
        html.push(["span", {cla: "selkwspan"}, keyword]);
        if(mode === "edit") {
            html.push(["span", {id: divid + "skwx" + index,
                                cla: "selkwdelspan"}, 
                       "x"]); }
        return html;
    },


    setupSelectedKeywords = function (mode) {
        var i, keys, html = [];
        keys = csvarray();
        for(i = 0; i < keys.length; i += 1) {
            html.push(["div", {cla: "selkwdiv" + mode},
                       selectedKeywordHTML(keys[i], mode, i)]); }
        jt.out(divid + "kwk", jt.tac2html(html));
        if(mode === "edit") {
            if(!elkwx) {
                elkwx = function (e) {
                    var kwdiv, spandiv, keyword, filterval;
                    kwdiv = this.parentNode;
                    spandiv = kwdiv.childNodes[0];
                    keyword = spandiv.innerHTML;
                    if(!keyword) {  //spurious click
                        return; }
                    filterval = jt.byId(divid + "kwin").value || "";
                    filterval = filterval.toLowerCase();
                    removeKeyword(keyword);                 //remove from CSV
                    jt.off(spandiv, "click", elkwx);        //unhook click
                    kwdiv.parentNode.removeChild(kwdiv);    //remove display div
                    if(!filterval ||
                           keyword.toLowerCase().indexOf(filterval) !== 0) {
                        for(i = 0; i < keywords.length; i += 1) {
                            if(keywords[i] === keyword) {
                                jt.byId(divid + "kwsd" + i).
                                    style.display = "block"; } } }
                    jt.evtend(e); }; }
            for(i = 0; i < keys.length; i += 1) {
                jt.on(divid + "skwx" + i, "click", elkwx); } }
    },


    unhookSelectedKeywords = function () {
        var i, keys;
        keys = csvarray();
        for(i = 0; i < keys.length; i += 1) {
            jt.off(divid + "skwx" + i, "click", elkwx); }
    },


    appendKeyword = function (keyword) {
        var index, div;
        keyword = keyword || "";
        keyword = keyword.trim();
        if(!keyword) {
            return; }
        valcsv = valcsv || "";
        if(keywordSelected(keyword)) {
            return; }  //already there
        //capitalize contained words
        keyword = keyword.replace(/(?:^|\s)\S/g, function(a) { 
            return a.toUpperCase(); });
        if(valcsv) {
            valcsv += ","; }
        valcsv += keyword;
        index = csvarray().length - 1;
        div = document.createElement("div");
        div.className = "selkwdivedit";
        div.innerHTML = jt.tac2html(
            selectedKeywordHTML(keyword, "edit", index));
        jt.byId(divid + "kwk").appendChild(div);
        jt.on(divid + "skwx" + index, "click", elkwx);
    },


    hideListedKeywords = function (kwval) {
        var i, disp;
        for(i = 0; i < keywords.length; i += 1) {
            disp = "block";
            if(kwval && 
               keywords[i].toLowerCase().indexOf(kwval.toLowerCase()) !== 0) {
                disp = "none"; }
            else if(keywordSelected(keywords[i])) {
                disp = "none"; }
            jt.byId(divid + "kwsd" + i).style.display = disp; }
    },


    setupSelectionList = function () {
        var html = [], i;
        for(i = 0; i < keywords.length; i += 1) {
            html.push(["div", {id: divid + "kwsd" + i, 
                               cla: "kwselectdiv"}, 
                       keywords[i]]); }
        jt.out(divid + "kwl", jt.tac2html(html));
        if(!elkwsel) {
            elkwsel = function (e) {
                this.style.display = "none";
                appendKeyword(this.innerHTML);
                jt.evtend(e); }; }
        for(i = 0; i < keywords.length; i += 1) {
            jt.on(divid + "kwsd" + i, "click", elkwsel); }
        hideListedKeywords();
    },


    unhookSelectionList = function () {
        var i;
        for(i = 0; i < keywords.length; i += 1) {
            jt.off(divid + "kwsd" + i, "click", elkwsel); }
    },


    followSelectInput = function () {
        hideListedKeywords(jt.byId(divid + "kwin").value);
        tout = window.setTimeout(followSelectInput, 200);
    },


    setupKeywordEntryInput = function () {
        var html;
        html = [["input", {type: "text", id: divid + "kwin", cla: "kwin"}],
                ["button", {id: divid + "kwplus", cla: "kwplus"}, "+"]];
        jt.out(divid + "kwe", jt.tac2html(html));
        if(!elkwadd) {
            elkwadd = function (e) {
                var kwin = jt.byId(divid + "kwin");
                appendKeyword(kwin.value);
                kwin.value = "";
                jt.evtend(e); }; }
        jt.on(divid + "kwin", "change", elkwadd);
        jt.on(divid + "kwplus", "click", elkwadd);
        if(tout) {
            window.clearTimeout(tout);
            tout = null; }
        followSelectInput();
    },


    unhookKeywordEntryInput = function () {
        jt.off(divid + "kwin", "change", elkwadd);
        jt.off(divid + "kwplus", "click", elkwadd);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    displayEntry: function () {
        var html; 
        html = ["div", {id: divid + "kwc", cla: "kwcontainerdiv"},
                [["div", {id: divid + "kwt", cla: "kwtitlediv"},
                  title],
                 ["div", {id: divid + "kww", cla: "kwworkdiv"},
                  [["div", {id: divid + "kwl", cla: "kwlistdiv"}],
                   ["div", {id: divid + "kwe", cla: "kwentrydiv"}],
                   ["div", {id: divid + "kwk", cla: "kwkeywordsdiv"}]]]]];
        jt.out(divid, jt.tac2html(html));
        jt.byId(divid + "kwk").style.width = (app.winw / 2) + "px";
        setupSelectionList();
        setupKeywordEntryInput();
        setupSelectedKeywords("edit");
    },


    destroy: function () {
        if(tout) {
            window.clearTimeout(tout);
            tout = null; }
        if(elkwx) {
            unhookSelectedKeywords();
            elkwx = null; }
        if(elkwsel) {
            unhookSelectionList();
            elkwsel = null; }
        if(elkwadd) {
            unhookKeywordEntryInput();
            elkwadd = null; }
    },


    displayList: function () {
        var html;
        html = ["div", {id: divid + "kwc", cla: "kwcontainerdiv"},
                ["div", {id: divid + "kww", cla: "kwworkdiv"},
                 ["div", {id: divid + "kwk", cla: "kwkeywordsdiv"}]]];
        jt.out(divid, jt.tac2html(html));
        setupSelectedKeywords("list");
    },


    getSelectedKeywordsCSV: function () {
        return valcsv;
    }

};  //end of returned functions

}()); };

