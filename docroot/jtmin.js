/*global alert: false, console: false, document: false, window: false, XMLHttpRequest: false, JSON: false, escape: false, unescape: false, setTimeout: false, navigator: false */

////////////////////////////////////////
// Just The Mods I Need
//
// This library is intended to provide the minimally adequate
// functionality for writing a web application.  No frills, no object
// model, no layers on top of DOM objects.  Emphasis is on necessary
// backfill and utilities that are commonly needed.  Use directly or
// copy whatever you need.
//

////////////////////////////////////////
//prototype mods and global overrides
(function () {
    "use strict";

    if (!String.prototype.trim) {  //thanks to Douglas Crockford
        String.prototype.trim = function () {
            return this.replace(/^\s*(\S*(?:\s+\S+)*)\s*$/, "$1");
        };
    }


    if (!String.prototype.capitalize) {
        String.prototype.capitalize = function () {
            return this.charAt(0).toUpperCase() + this.slice(1);
        };
    }


    if (!String.prototype.endsWith) {
        String.prototype.endsWith = function (suffix) {
            return this.indexOf(suffix, this.length - suffix.length) !== -1;
        };
    }


    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function (searchElement) {
            var i;
            if (this === null) {
                throw new TypeError();
            }
            for (i = 0; i < this.length; i += 1) {
                if (this[i] === searchElement) {
                    return i;
                }
            }
            return -1;
        };
    }


    if (!Array.prototype.shuffle) {
        Array.prototype.shuffle = function () {
            var i, j, tmp;
            for (i = this.length - 1; i > 0; i -= 1) {
                j = Math.floor(Math.random() * (i + 1));
                tmp = this[i];
                this[i] = this[j];
                this[j] = tmp;
            }
            return this;
        };
    }


    if (!Date.prototype.toISOString) {
        Date.prototype.toISOString = function () {
            function pad(n) { return n < 10 ? '0' + n : n; }
            return this.getUTCFullYear() + '-'
                + pad(this.getUTCMonth() + 1) + '-'
                + pad(this.getUTCDate()) + 'T'
                + pad(this.getUTCHours()) + ':'
                + pad(this.getUTCMinutes()) + ':'
                + pad(this.getUTCSeconds()) + 'Z';
        };
    }


}());


////////////////////////////////////////
// Utility methods.  Library users will need to tolerate this global
// function, and pass in an object to hold all the utility methods.
var jtminjsDecorateWithUtilities = function (utilityObject) {
    "use strict";

    var uo = utilityObject;  //local reference for function chaining


    ////////////////////////////////////////
    // general javascript utility functions
    ////////////////////////////////////////

    uo.byId = function (elemid) {
        return document.getElementById(elemid);
    };


    //Return true if object is not null, and has the given method/object
    uo.isAvailable = function (object, method) {
        return object &&
            (/^(?:function|object|unknown)$/).test(typeof object[method]);
    };


    ////////////////////////////////////////
    // IO convenience
    ////////////////////////////////////////

    uo.log = function (text) {
        try {
            if (console && console.log) {
                console.log(text);
            }
        } catch (ignore) {  //most likely a bad IE console def, just skip it
        }
    };


    uo.err = function (text) {
        alert(text);
    };


    uo.assert = function (testval) {
        if (!testval) {
            uo.err("An application integrity check has failed. Please reload the page in your browser.");
            throw ("uo.assert");
        }
    };


    uo.out = function (domid, html) {
        var node = uo.byId(domid);
        if (node) {
            node.innerHTML = html;
        } else {
            uo.log("DOM id " + domid + " not available for output");
        }
    };


    ////////////////////////////////////////
    // String manipulation and conversion 
    ////////////////////////////////////////

    uo.prefixed = function (string, prefix) {
        if (string && string.indexOf(prefix) === 0) {
            return true;
        }
        return false;
    };


    uo.ellipsis = function (string, length) {
        if (!string || typeof string !== "string") {
            return "";
        }
        string = string.trim();
        if (string.length <= length) {
            return string;
        }
        string = string.slice(0, length - 3) + "...";
        return string;
    };


    uo.safestr = function (string) {
        if (!string) {
            return "";
        }
        return String(string);
    };


    uo.safeint = function (val) {
        if (!val) {
            val = 0;
        }
        if (typeof val !== "number") {
            val = parseInt(val, 10);
        }
        return val;
    };


    uo.safeget = function (domid, field) {
        var elem = uo.byId(domid);
        if (elem) {
            return elem[field];
        }
    };


    uo.saferef = function (object, fieldspec) {
        var fields, i;
        if (!object) {
            return null;
        }
        fields = fieldspec.split(".?");
        for (i = 0; i < fields.length; i += 1) {
            if (object && object[fields[i]]) {
                object = object[fields[i]];
            } else {
                return null;
            }
        }
        return object;
    };


    uo.enc = function (val) {
        val = val || "";
        if (typeof val === "string") {
            val = val.trim();
        }
        return encodeURIComponent(val);
    };


    uo.dec = function (val) {
        val = val || "";
        if (typeof val === "string") {
            val = val.trim();
        }
        try {
            val = decodeURIComponent(val);
        } catch (e) {
            uo.log("decodeURIComponent failure: " + e);
        }
        return val;
    };


    //if a string needs to be URL encoded and then stuffed inside of
    //single quotes, then you need to replace any embedded single
    //quotes to avoid terminating the string early.
    uo.embenc = function (val) {
        val = uo.enc(val);
        val = val.replace(/'/g, "%27");
        return val;
    };


    uo.dquotenc = function (val) {
        val = uo.enc(val);
        val = val.replace(/"/g, "&quot;");
        return val;
    };


    //if making an html attribute value by escaping double quotes,
    //then get rid of any double quotes in the contained value
    uo.ndq = function (val) {
        if (!val) {
            return "";
        }
        val = val.replace(/"/g, "&quot;");
        return val;
    };


    //see also http://tools.ietf.org/html/rfc3986 and also
    //http://www.ietf.org/rfc/rfc2396.  Note that this does not
    //guarantee a canonized string value will be a valid url parameter
    //value.  Characters may still need to be encoded.
    uo.canonize = function (txt) {
        var strval = txt || "";
        //whitespace and generally problematic characters
        strval = strval.replace(/\s/g, "");
        strval = strval.replace(/\"/g, "");
        strval = strval.replace(/\./g, "");
        //URI reserved characters gen-delims
        strval = strval.replace(/\:/g, "");
        strval = strval.replace(/\//g, "");
        strval = strval.replace(/\?/g, "");
        strval = strval.replace(/\#/g, "");
        strval = strval.replace(/\[/g, "");
        strval = strval.replace(/\]/g, "");
        strval = strval.replace(/\@/g, "");
        //URI reserved characters sub-delims
        strval = strval.replace(/\!/g, "");
        strval = strval.replace(/\$/g, "");
        strval = strval.replace(/\&/g, "");
        strval = strval.replace(/\'/g, "");
        strval = strval.replace(/\(/g, "");
        strval = strval.replace(/\)/g, "");
        strval = strval.replace(/\*/g, "");
        strval = strval.replace(/\+/g, "");
        strval = strval.replace(/\,/g, "");
        strval = strval.replace(/\;/g, "");
        strval = strval.replace(/\=/g, "");
        strval = strval.toLowerCase();
        return strval;
    };


    uo.ISOString2Day = function (str) {
        var date, year, month, day;
        if (!str) {
            return new Date();
        }
        year = parseInt(str.slice(0, 4), 10);
        month = parseInt(str.slice(5, 7), 10);
        day = parseInt(str.slice(8, 10), 10);
        date = new Date(year, (month - 1), day, 0, 0, 0, 0);
        return date;
    };


    uo.colloquialDate = function (date, compress) {
        var days = [ 'Sunday', 'Monday', 'Tuesday', 'Wednesday',
                     'Thursday', 'Friday', 'Saturday', 'Sunday' ],
            months = [ "January", "February", "March", "April", "May",
                       "June", "July", "August", "September", "October",
                       "November", "December" ],
            now = new Date(),
            elapsed,
            dayname,
            month,
            retval;
        if (typeof date === "string") {
            date = uo.ISOString2Day(date);
        }
        elapsed = now.getTime() - date.getTime();
        if (elapsed < 24 * 60 * 60 * 1000) {
            return "Today";
        }
        if (elapsed < 48 * 60 * 60 * 1000) {
            return "Yesterday";
        }
        dayname = String(days[date.getUTCDay()]);
        month = String(months[date.getMonth()]);
        if (compress) {
            dayname = dayname.slice(0, 3);
            month = month.slice(0, 3);
        }
        retval = dayname + " " + month + " " + String(date.getUTCDate());
        if (elapsed > 365 * 24 * 60 * 60 * 1000) {
            retval += " " + String(date.getFullYear());
        }
        return retval;
    };


    ////////////////////////////////////////
    // value testing and manipulation
    ////////////////////////////////////////

    //return true if the given text can be reasonably construed to be an
    //email address.
    uo.isProbablyEmail = function (text) {
        return text && text.match(/^\S+@\S+\.\S+$/);
    };


    //convert a "a=1&b=2" type string into an object form
    uo.paramsToObj = function (paramstr, obj) {
        var comps, i, attval, idx = paramstr.indexOf("?");
        if (idx >= 0) {
            paramstr = paramstr.slice(idx + 1);
        }
        if (!obj) {
            obj = {};
        }
        if (paramstr) {
            comps = paramstr.split("&");
            for (i = 0; i < comps.length; i += 1) {
                attval = comps[i].split("=");
                if (attval.length > 1) {
                    obj[attval[0]] = attval[1];
                } else {
                    obj.anchor = attval[0];
                }
            }
        }
        return obj;
    };


    //parse the url hash and query parts into an object
    uo.parseParams = function () {
        var pstr, obj = {};
        pstr = window.location.hash;
        if (pstr.indexOf("#") === 0) {
            pstr = pstr.slice(1);
        }
        uo.paramsToObj(pstr, obj);
        pstr = window.location.search;
        uo.paramsToObj(pstr, obj);
        return obj;
    };


    //return the given object field and values as html POST data
    uo.objdata = function (obj, skips) {
        var str = "", name;
        if (!obj) {
            return "";
        }
        if (!skips) {
            skips = [];
        }
        for (name in obj) {
            if (obj.hasOwnProperty(name)) {
                if (skips.indexOf(name) < 0) {
                    if (str) {
                        str += "&";
                    }
                    str += name + "=" + uo.enc(obj[name]);
                }
            }
        }
        return str;
    };


    uo.paramsToFormInputs = function (paramstr) {
        var html = "", fields, i, attval;
        if (!paramstr) {
            return "";
        }
        fields = paramstr.split("&");
        for (i = 0; i < fields.length; i += 1) {
            attval = fields[i].split("=");
            html += "<input type=\"hidden\" name=\"" + attval[0] + "\"" +
                                          " value=\"" + attval[1] + "\"/>";
        }
        return html;
    };


    uo.makelink = function (url) {
        var html, suffix = "";
        if (!url) {
            return "";
        }
        //strip any common trailing punctuation on the url if found
        if (/[\.\,\)]$/.test(url)) {
            suffix = url.slice(-1);
            url = url.slice(0, -1);
        }
        html = "<a href=\"" + url + "\" onclick=\"window.open('" + url +
            "');return false;\">" + url + "</a>" + suffix;
        return html;
    };


    //Make the text into display html.  Newlines become <br/>s and
    //urls become hrefs that open in a new window/tab.  Trying to
    //avoid complex regex since those are annoying to maintain.  Ok
    //with not automatically picking up on things that don't start
    //with "http".  Links other than web not desired.
    uo.linkify = function (txt) {
        if (!txt) {
            return "";
        }
        txt = txt.replace(/https?:\S+/g, function (url) {
            return uo.makelink(url);
        });
        txt = txt.replace(/\n/g, "<br/>");
        return txt;
    };


    //Some things don't work in older browsers and need code
    //workarounds to degrade gracefully.  Like not scaling fixed
    //background images.  IE8 is a known problem, but some older stock
    //android browsers are also problematic.  This function identifies
    //the more common browsers known to be consistently updated.
    uo.isLowFuncBrowser = function () {
        var nav;
        if (navigator) {
            nav = navigator;
            // alert("appCodeName: " + nav.appCodeName + "\n" +
            //       "appName: " + nav.appName + "\n" +
            //       "appVersion: " + nav.appVersion + "\n" +
            //       "platform: " + nav.platform + "\n" +
            //       "userAgent: " + nav.userAgent + "\n");
            if (nav.userAgent.indexOf("Firefox") >= 0) {
                return false;
            }
            if (nav.userAgent.indexOf("Chrome") >= 0) {
                return false;
            }
            if ((nav.userAgent.indexOf("Safari") >= 0) &&
                    (nav.userAgent.indexOf("CyanogenMod") < 0) &&
                    (nav.userAgent.indexOf("Android") < 0)) {
                return false;
            }
        }
        return true;
    };


    ////////////////////////////////////////
    // event handling
    ////////////////////////////////////////

    //synonym for "addEventListener" with basic IE8 shim
    uo.on = function (element, eventName, handler) {
        if (typeof element === "string") {  //convert DOM id to DOM node
            element = uo.byId(element);
        }
        if (uo.isAvailable(element, "addEventListener")) {
            element.addEventListener(eventName, handler, false);
        } else if (uo.isAvailable(element, "attachEvent")) {
            element["e" + eventName + handler] = handler;
            element[eventName + handler] = function () {
                element["e" + eventName + handler](window.event);
            };
            element.attachEvent("on" + eventName,
                                element[eventName + handler]);
        }
    };


    //synonym for "removeEventListener" with basic IE8 shim
    uo.off = function (element, eventName, handler) {
        if (typeof element === "string") {  //convert DOM id to DOM node
            element = uo.byId(element);
        }
        if (uo.isAvailable(element, "removeEventListener")) {
            element.removeEventListener(eventName, handler, false);
        } else if (uo.isAvailable(element, "detachEvent")) {
            element.detachEvent("on" + eventName,
                                element[eventName + handler]);
        }
    };


    //synonym for preventDefault + stopPropagation with basic IE8 shim
    uo.evtend = function (event) {
        if (event) {
            if (event.preventDefault) {
                event.preventDefault();
            } else {
                event.returnValue = false;
            }
            if (event.stopPropagation) {
                event.stopPropagation();
            } else {
                event.cancelBubble = true;
            }
        }
    };


    //append false return to a literal function string
    uo.fs = function (fstr) {
        if (fstr) {  //Do not wrap if undefined, null, or anything else falsy
            fstr = (uo.safestr(fstr)).trim();
            if (fstr.indexOf(")") < 0) {
                fstr += "()";
            }
            if (fstr.indexOf(";") < fstr.length - 1) {
                fstr += ";";
            }
            if (fstr.indexOf("return false") < 0) {
                fstr += "return false;";
            }
        }
        return uo.fsd(fstr);
    };


    //does nothing, can be redefined to use for general decoration.
    uo.fsd = function (fstr) {
        return fstr;
    };


    ////////////////////////////////////////
    // HTML creation
    ////////////////////////////////////////

    //Override this function if you need your own custom tags.  If I've
    //missed anything generally useful, let me know.
    uo.isHTMLElement = function (elemtype) {
        var elems = ["a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdi", "bdo", "big", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "command", "datalist", "dd", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "keygen", "label", "legend", "li", "link", "map", "mark", "menu", "meta", "meter", "nav", "noframes", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "section", "select", "small", "source", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"];
        if (typeof elemtype !== "string") {
            return false;
        }
        elemtype = (uo.safestr(elemtype)).trim().toLowerCase();
        if (elems.indexOf(elemtype) >= 0) {
            return true;
        }
        return false;
    };


    uo.isHTMLVoidElement = function (elemtype) {
        var voids = ["area", "base", "br", "col", "command", "embed",
                     "hr", "img", "input", "keygen", "link", "menuitem",
                     "meta", "param", "source", "track", "wbr"];
        elemtype = (uo.safestr(elemtype)).trim().toLowerCase();
        if (voids.indexOf(elemtype) >= 0) {
            return true;
        }
        return false;
    };


    //If value is not falsy, then return tval if specified and value
    //otherwise.  If value is falsy, return undefined.  Useful for
    //handling html attributes like "checked", "disabled" etc.
    uo.toru = function (value, tval) {
        if (value) {
            return tval || value;
        }
    };


    //Some html attribute names are javascript reserved words and
    //therefore can't be directly used as object labels.  You can
    //quote them or use synonyms.  If I've missed anything generally
    //useful, let me know.
    uo.tacattr = function (name) {
        switch (name) {
        case "cla":
            return "class";
        case "fo":
            return "for";
        }
        return name;
    };


    //A TAC array has the general form [tagname, attrobj, content]
    //where content can be another TAC array, a value, or omitted.
    //Attributes with undefined or null values are ignored, empty
    //string attributes are valid values.  The implementation passes
    //all context in its own memoized stackframe param due to a mix of
    //paranoia and debugger bugs.
    uo.tac2html = function (tac, frame) {
        var name;
        if (!frame) {
            frame = { html: "", elemtype: null, attrobj: null,
                      content: null, isHTMLTag: false, i: null};
        }
        //if tac is something other than an "array", use its string value
        if (typeof tac !== 'object' || !tac.length) {
            return uo.safestr(tac);
        }
        if (tac.length === 0) {
            return "";
        }
        frame.elemtype = tac[0];
        frame.isHTMLTag = uo.isHTMLElement(frame.elemtype);
        if (frame.isHTMLTag) {  //make an html element
            frame.html += "<" + frame.elemtype;
            if (tac.length > 1) { //have attributes and/or content
                frame.attrobj = tac[1];
                //if plain object without length then treat as attributes
                if (frame.attrobj && typeof frame.attrobj === 'object' &&
                        !frame.attrobj.length) {
                    for (name in frame.attrobj) {
                        if (frame.attrobj.hasOwnProperty(name)) {
                            if (frame.attrobj[name] !== undefined &&
                                    frame.attrobj[name] !== null) {
                                frame.html += " " + uo.tacattr(name) +
                                    "=\"" + frame.attrobj[name] + "\"";
                            }
                        }
                    }
                } else if (frame.attrobj) {  //treat as content
                    frame.content = frame.attrobj;
                }
            }
            if (uo.isHTMLVoidElement(frame.elemtype)) {
                frame.html += " />";  //extra space is just traditional
                return frame.html;  //no content allowed so we're done.
            }
            //regular element, close normally and include any specified content
            frame.html += ">";
            if (!frame.content && tac.length > 2) {
                frame.content = tac[2];
            }
            if (frame.content) {
                frame.html += uo.tac2html(frame.content);
            }
            frame.html += "</" + frame.elemtype + ">";
            return frame.html;
        } //we have an array of tacs, append them all together
        for (frame.i = 0; frame.i < tac.length; frame.i += 1) {
            frame.html += uo.tac2html(tac[frame.i]);
        }
        return frame.html;
    };


    ////////////////////////////////////////
    // calling the server
    ////////////////////////////////////////

    //Simulate the latency associated with a server call if local
    //development.  This helps avoid inadvertent bad code.  Can be
    //set to null or modified as desired.
    uo.localDelayBusyWait = function () {
        var tempdiv, tempdivid, now, start, delayms = 300;
        if (!document || !window || !window.location || !window.location.href ||
                window.location.href.indexOf("localhost:8080") < 0) {
            return;
        }
        tempdivid = 'localDelayBusyWaitDiv';
        tempdiv = uo.byId(tempdivid);
        if (!tempdiv) {
            tempdiv = document.createElement("div");
            tempdiv.id = tempdivid;
            document.body.appendChild(tempdiv);
        }
        now = start = new Date().getTime();
        while (now - start < delayms) {
            now = new Date().getTime();
            uo.out(tempdivid, "delay " + (now - start));
        }
        uo.out(tempdivid, "");
    };


    //Use a semaphore for preventing duplicate server calls. 
    uo.semaphores = {};
    uo.semaphore = function (key) {
        if (!uo.semaphore[key]) {
            uo.semaphore[key] = {};
        }
        return uo.semaphore[key];
    };


    //Make an async call to the server and return the result as text.
    // - method: GET, POST, etc.
    // - url: url.
    // - data: null for GET, form data for POST.
    // - success(response): called on successful completion.
    // - failure(errcode, errtxt, method, url, data): called on
    //   failure. If no failure function is provided, then all call
    //   errors are ignored.  The recommended approach is to create a
    //   general handler function at the app level and pass that along
    //   to deal with required login, crashes etc.
    // - lockobj: if provided, re-entrant calls are ignored.
    // - setup(method, url, data, lockobj): if provided, the given
    //   function is called after the re-entrancy test but before any
    //   actual processing.
    // - timeoutms: if not provided, then 0 (no timeout) is used
    uo.request = function (method, url, data, success, failure,
                           lockobj, setup, timeoutms) {
        if (lockobj && lockobj.critsec === "processing") {
            uo.log(method + " " + url + " already in progress...");
            return;
        }
        if (lockobj) {
            lockobj.critsec = "processing";
        }
        if (setup) {
            setup(method, url, data, lockobj);
        }
        if (uo.localDelayBusyWait) {
            uo.localDelayBusyWait();
        }
        timeoutms = timeoutms || 0;
        (function (m, u, d, s, f, k, t) {
            var xhr = new XMLHttpRequest();
            xhr.open(m, u);
            xhr.setRequestHeader("Content-type",
                                 "application/x-www-form-urlencoded");
            xhr.timeout = t;
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {  //DONE
                    if (k) {
                        k.critsec = "completed";
                    }
                    if (xhr.status === 200 ||  //successful
                           //or local access retrieved something...
                            (xhr.status === 0 && xhr.responseText)) {
                        s(xhr.responseText);
                    } else if (f) {
                        //use responseText for custom error messages,
                        //statusText for general error messages.  Custom
                        //overrides general
                        f(xhr.status, xhr.responseText || xhr.statusText,
                            m, u, d);
                    }
                }
            };
            xhr.send(d);
        }(method, url, data, success, failure, lockobj, timeoutms));
    };


    //Wrapper for ajax call that returns an object from server JSON.
    //
    //A: On GAE local, it is possible to get a successful callback
    //with no data. So xhr.readyState === 4 and xhr.status === 200,
    //but there is no xhr.responseText.  That is followed by a second
    //callback with xhr.responseText.  Rather than logging a JSON
    //parse error for an empty string (and then chasing that down
    //because it looks like the log is showing a problem) this case is
    //trapped and ignored.  ep19apr14
    uo.call = function (method, url, data, success, failure,
                        lockobj, setup, timeoutms) {
        var jsonobj = JSON || window.JSON;
        if (!jsonobj) {
            uo.err("JSON not supported, please use a modern browser");
        }
        uo.request(method, url, data, function (resp) {
            if (!resp) {  //See comment A
                //uo.log("Ignoring interim callback with empty data");
                return;  //no data but didn't fail.  Wait for second callback.
            }
            try {
                resp = jsonobj.parse(resp);
            } catch (exception) {
                uo.log("JSON parse failure: " + exception);
                failure(415, resp, method, url, data);
            }
            success(resp);
        }, failure, lockobj, setup, timeoutms);
    };


    ////////////////////////////////////////
    // simple cookie access
    ////////////////////////////////////////

    //If only the cookie name is provided, then the current value is returned.
    uo.cookie = function (cname, cval, expiredays) {
        var expiration, index;
        if (cval || expiredays <= 0) {
            cval = cval || "";
            if (!expiredays) {
                expiredays = 365;
            }
            expiration = new Date();
            expiration.setDate(expiration.getDate() + expiredays);
            cval = escape(cval) + "; expires=" + expiration.toUTCString();
            document.cookie = cname + "=" + cval;
        }
        cval = document.cookie;
        index = cval.indexOf(" " + cname + "=");
        if (index < 0) {
            index = cval.indexOf(cname + "=");
        }
        if (index < 0) {
            cval = null;
        } else {
            cval = cval.slice(index);
            cval = cval.slice(cval.indexOf("=") + 1);
            index = cval.indexOf(";");
            if (index >= 0) {
                cval = cval.slice(0, index);
            }
            cval = unescape(cval);
        }
        return cval;
    };


    ////////////////////////////////////////
    // event geometry
    ////////////////////////////////////////

    //Return sensible position info for the given domelem.
    uo.geoPos = function (domelem, pos) {
        if (!pos) {
            pos = { h: domelem.offsetHeight,
                    w: domelem.offsetWidth,
                    x: 0,
                    y: 0 };
        }
        pos.x += domelem.offsetLeft;
        pos.y += domelem.offsetTop;
        if (domelem.offsetParent) {
            return uo.geoPos(domelem.offsetParent, pos);
        }
        return pos;
    };


    //Return sensible element x,y coordinates for event handling. 
    //Available position info *should* be
    //    pageX: relative to top left of fully rendered content 
    //    screenX: relative to top left of physical screen 
    //    clientX: relative to the top left of browser window
    //but IE8 has no event.pageX, clientHeight/Left/Top/Width are
    //always zero, and event.x/y === event.clientX/Y.
    uo.geoXY = function (event) {
        var pos;
        if (event.pageX) {
            return { x: event.pageX, y: event.pageY };
        }
        pos = { h: -1, w: -1, x: event.offsetX, y: event.offsetY };
        pos = uo.geoPos(event.srcElement, pos);
        if (!pos) {
            pos = { x: event.offsetX, y: event.offsetY };
        }
        return pos;
    };


    ////////////////////////////////////////
    // dynamic script loader
    ////////////////////////////////////////

    uo.loadAppModules = function (app, modulenames, path, callback) {
        var i, url, modname, js;
        if (path.lastIndexOf(".") > path.lastIndexOf("/")) {
            path = path.slice(0, path.lastIndexOf("/"));
        }
        if (path.charAt(path.length - 1) !== '/') {
            path += "/";
        }
        for (i = 0; i < modulenames.length; i += 1) {
            url = path + modulenames[i] + ".js";
            modname = modulenames[i];
            if (modname.indexOf("/") >= 0) {
                modname = modname.slice(modname.lastIndexOf("/") + 1);
                modulenames[i] = modname;
            }
            if (!app[modname]) {
                js = document.createElement('script');
                js.async = true;
                js.src = url;
                document.body.appendChild(js);
            }
        }
        uo.waitForModules(app, modulenames, callback);
    };


    uo.waitForModules = function (app, modulenames, callback) {
        var i, modname, loaded = true;
        for (i = 0; i < modulenames.length; i += 1) {
            modname = modulenames[i];
            if (!app[modname]) {
                loaded = false;
                break;
            }
        }
        if (!loaded) {
            setTimeout(function () {
                uo.waitForModules(app, modulenames, callback);
            }, 100);
        } else {
            callback();
        }
    };

};


