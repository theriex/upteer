/*global app: false, jt: false */

/*jslint white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// Local Cache Storage for referenced objects.  Database objects are
// encapsulated in a reference container with a fetch status and time.
//

app.lcs = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var cache = {
        prof: { refs: {},
                fetchend: "profbyid",
                fetchparamf: function (id) {
                    return "profid=" + id; } },
        org:  { refs: {},
                fetchend: "orgbyid",
                fetchparamf: function (id) {
                    return "orgid=" + id; } },
        opp:  { refs: {},
                fetchend: "oppbyid",
                fetchparamf: function (id) {
                    return "oppid=" + id; } } },


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    idify = function (id) {
        if(typeof id === 'object') {
            id = jt.instId(id); }
        if(typeof id === 'number') {
            id = String(id); }
        return id;
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    getRef: function (type, id) {
        var ref;
        id = idify(id);  //convert to string as needed
        ref = cache[type].refs[id];
        if(!ref) {
            ref = { status: "not cached",
                    updtime: new Date() };
            ref[type + "id"] = id; }
        return ref;
    },


    getFull: function (type, id, callback, debugmsg) {
        var ref, url;
        id = idify(id);
        ref = app.lcs.getRef(type, id);
        if(ref && ref.status !== "not cached") {
            if(debugmsg) {
                jt.log("getFull cached " + type + id + " " + debugmsg); }
            return callback(ref); }
        if(debugmsg) {
            jt.log("getFull retrieving " + type + id + " " + debugmsg); }
        url = cache[type].fetchend + "?" + cache[type].fetchparamf(id);
        jt.call('GET', url, null,
                function (objs) {
                    if(objs.length > 0) {
                        callback(app.lcs.put(type, objs[0])); }
                    else {  //should never happen, but treat as deleted
                        callback(app.lcs.tomb(type, id, "deleted")); } },
                function (code, errtxt) {
                    callback(app.lcs.tomb(type, id, 
                                          String(code) + ": " + errtxt)); },
                jt.semaphore("lcs.fetch" + type + id), null, [400, 404]);
    },


    resolveCSV: function (type, ids, callbackf, refs) {
        if(typeof ids === "string") {
            ids = ids.csvarray(); }
        if(!refs) {
            refs = []; }
        if(ids.length > refs.length) {
            app.lcs.getFull(type, ids[refs.length], function (ref) {
                refs.push(ref);
                app.lcs.resolveCSV(type, ids, callbackf, refs); }); }
        else {
            callbackf(refs); }
    },


    tomb: function (type, id, reason) {
        var tombstone, ref;
        tombstone = { status: reason, updtime: new Date() };
        tombstone[type + "id"] = id;
        jt.setInstId(tombstone, id);
        ref = app.lcs.put(type, tombstone);
        ref.status = reason;
        ref[type] = null;  //so caller can just test for ref.type...
        return tombstone;
    },
        

    put: function (type, obj) {
        var ref;
        if(cache[type].putprep) {
            cache[type].putprep(obj); }
        ref = app.lcs.getRef(type, obj);
        if(!idify(obj)) {
            jt.log("attempt to lcs.put unidentified object");
            return null; }
        cache[type].refs[idify(obj)] = ref;
        ref[type] = obj;
        ref.status = "ok";
        ref.updtime = new Date();
        //any existing decorator fields on the ref are not overwritten
        return ref;
    },


    putAll: function (type, objs) {
        var i;
        for(i = 0; objs && i < objs.length; i += 1) {
            if(objs[i].fetched) {  //ending stats and cursor object...
                break; }
            app.lcs.put(type, objs[i]); }
    },


    rem: function (type, obj) {
        var ref;
        ref = app.lcs.getRef(type, obj);
        ref.status = "deleted";
        ref.updtime = new Date();
        ref[type] = null;
    },


    nukeItAll: function () {
        var name;
        for(name in cache) {
            if(cache.hasOwnProperty(name)) {
                cache[name].refs = {}; } }
    }

}; //end of returned functions
}());
