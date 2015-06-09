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
        mant = null,        //manual keyword entry timeout handle
        tout = null,        //keyword entry field change listener timout handle
        selhook = null,     //optional select hook function
        delhook = null,     //option delete hook function


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

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
        keys = valcsv.csvarray();
        for(i = 0; i < keys.length; i += 1) {
            html.push(["div", {cla: "selkwdiv" + mode + " " + divid + "kwd"},
                       selectedKeywordHTML(keys[i], mode, i)]); }
        jt.out(divid + "kwk", jt.tac2html(html));
        app.limitwidth(divid + "kwk");
        if(mode === "edit") {
            if(!elkwx) {
                elkwx = function (e) {
                    var kwdiv, spandiv, keyword, filterval;
                    kwdiv = this.parentNode;
                    spandiv = kwdiv.childNodes[0];
                    keyword = spandiv.innerHTML;
                    if(!keyword) {  //spurious click
                        return; }
                    if(!delhook || delhook(keyword)) {
                        filterval = jt.byId(divid + "kwin").value || "";
                        filterval = filterval.toLowerCase();
                        valcsv = valcsv.csvremove(keyword);
                        jt.off(spandiv, "click", elkwx);     //unhook click
                        kwdiv.parentNode.removeChild(kwdiv); //remove disp div
                        if(!filterval ||
                               keyword.toLowerCase().indexOf(filterval) !== 0) {
                            for(i = 0; i < keywords.length; i += 1) {
                                if(keywords[i] === keyword) {
                                    jt.byId(divid + "kwsd" + i).
                                        style.display = "block"; } } } }
                    jt.evtend(e); }; }
            for(i = 0; i < keys.length; i += 1) {
                jt.on(divid + "skwx" + i, "click", elkwx); } }
    },


    unhookSelectedKeywords = function () {
        var i, keys;
        keys = valcsv.csvarray();
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
        if(valcsv.csvcontains(keyword)) {
            return; }  //already there
        //capitalize contained words
        keyword = keyword.replace(/(?:^|\s)\S/g, function(a) { 
            return a.toUpperCase(); });
        valcsv = valcsv.csvappend(keyword);
        index = valcsv.csvarray().length - 1;
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
            else if(valcsv.csvcontains(keywords[i])) {
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
                if(!selhook || selhook(this.innerHTML)) {
                    if(mant) {
                        window.clearTimeout(mant); }
                    this.style.display = "none";
                    appendKeyword(this.innerHTML); }
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
        var kwin = jt.byId(divid + "kwin");
        if(kwin) {
            hideListedKeywords(kwin.value);
            tout = window.setTimeout(followSelectInput, 200); }
    },


    setupKeywordEntryInput = function () {
        var html;
        html = [["input", {type: "text", id: divid + "kwin", cla: "kwin"}],
                ["button", {id: divid + "kwplus", cla: "kwplus"}, "+"]];
        jt.out(divid + "kwe", jt.tac2html(html));
        if(!elkwadd) {
            elkwadd = function (e) {
                mant = window.setTimeout(function () {
                    var kwin = jt.byId(divid + "kwin");
                    mant = null; 
                    appendKeyword(kwin.value);
                    kwin.value = ""; }, 200);
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
    },


    setKeywordSelectUnselectHooks: function (selectf, deletef) {
        selhook = selectf;
        delhook = deletef;
    }

};  //end of returned functions

}()); };

