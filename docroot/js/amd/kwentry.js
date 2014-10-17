/*global app: false, jt: false, window: false */

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


    elkwxSetup = function () {
        elkwx = function (e) {
            var kwdiv, keyword, filterval, i;
            kwdiv = this.parentNode;
            keyword = kwdiv.childNodes[0].innnerHTML;
            filterval = jt.byId(divid + "kwin").value;
            removeKeyword(keyword);                 //remove from CSV
            kwdiv.parentNode.removeChild(kwdiv);    //remove display div
            if(keyword.toLowerCase().indexOf(filterval.toLowerCase) < 0) {
                for(i = 0; i < keywords.length; i += 1) {
                    if(keywords[i].toLowerCase() === keyword.toLowerCase()) {
                        jt.byId(divid + "kwsd" + i).
                            style.display = "block"; } } }
            jt.evtend(e); 
        };
    },


    selectedKeywordHTML = function(keyword, mode, index) {
        var html = [];
        html.push(["span", {cla: "selkwspan"}, keyword]);
        if(mode === "edit") {
            html.push(["span", {id: divid + "skwx" + index,
                                cla: "selkwdelspan"}, 
                       "x"]); }
        html = ["div", {cla: "selkwdiv"}, html];
        return html;
    },


    setupSelectedKeywords = function (mode) {
        var i, keys, html = [];
        keys = csvarray();
        for(i = 0; i < keys.length; i += 1) {
            html.push(selectedKeywordHTML(keys[i], mode, i)); }
        jt.out(divid + "kwk", jt.tac2html(html));
        if(mode === "edit") {
            if(!elkwx) {
                elkwxSetup(); }
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
        var html;
        valcsv = valcsv || "";
        if(keywordSelected(keyword)) {
            return; }  //already there
        if(valcsv) {
            valcsv += ","; }
        valcsv += keyword;
        html = jt.byId(divid + "kwk").innerHTML;
        html += jt.tac2html(selectedKeywordHTML(keyword, "edit",
                                                csvarray().length -1));
        jt.out(divid + "kwk", html);
    },


    hideListedKeywords = function (kwval) {
        var i, disp;
        for(i = 0; i < keywords.length; i += 1) {
            disp = "block";
            if(kwval && keywords[i].indexOf(kwval) !== 0) {
                disp = "none"; }
            if(keywordSelected(keywords[i])) {
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
        tout = window.setTimeout(function () {
            hideListedKeywords(jt.byId(divid + "kwin").value); }, 200);
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
        jt.out(divid, "TODO: values for " + title);
    },


    getSelectedKeywordsCSV: function () {
        return valcsv;
    }

};  //end of returned functions

}()); };

