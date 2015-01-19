/*global d3: false, jtminjsDecorateWithUtilities: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//This is a degenerate module just used for reporting.  Don't model it.
var actstat = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var data = null,
        jt = {},
        margin = { top: 20, right: 20, bottom: 40, left: 40},
        width = 600 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom,
        xscale = d3.time.scale().range([0, width]),
        yscale = d3.scale.linear().range([height, 0]),
        sercoloridx = 0,
        sernames = [ "logins", "opportunities", "volunteering",
                     "mvi", "mvw", "mvf", "mvy",
                     "mor", "mvr", "msh", "msd" ],
        sertrans = [ "logins", "opportunities", "volunteering",
                     "inquiries", "withdrawals", "refusals", "responses",
                     "opprevs", "volrevs", "shares", "dismissals" ],
        colors =   [ "red", "blue", "green",
                     "Chartreuse", "DarkGreen", "orange", "LightSeaGreen",
                     "silver", "SlateGray", "purple", "GoldenRod" ],

    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    seriesValue = function (series, datum) {
        var refs, i, refelems;
        if(datum.refers && datum.refers.indexOf(series.name) >= 0) {
            refs = datum.refers.split(",");
            for(i = 0; i < refs.length; i += 1) {
                refelems = refs[i].split(":");
                if(refelems[0] === series.name) {
                    return parseInt(refelems[1], 10); } } }
        return 0;
    },


    dataValue = function (datum, accessor) {
        if(typeof accessor === "string") {
            return datum[accessor] || 0; }
        return seriesValue(accessor, datum);
    },


    makeLine = function (attr) {
        return d3.svg.line()
            .x(function (d) { return xscale(d.day); })
            .y(function (d) { return yscale(dataValue(d, attr)); });
    },


    makeSeriesDef = function (sname, dname) {
        var scolor, dashstr;
        scolor = colors[sercoloridx % colors.length];
        sercoloridx += 1;
        dashstr = "1, 0";
        if(sname === "opportunities" || sname === "volunteering") {
            dashstr = "3, 3"; }
        return { name: sname, datafield: dname, 
                 width: "2px", dashes: dashstr, color: scolor, 
                 total: 0, min: 0, max: 0,
                 title: "See stat.py for key defs" };
    },


    makeDailySeries = function () {
        var series = [], i, field, rawfn, ser, j, datum, value;
        for(i = 0; i < sernames.length; i += 1) {
            rawfn = sernames[i];
            field = sertrans[i];
            ser = makeSeriesDef(field, rawfn);
            for(j = 0; j < data.length; j += 1) {
                datum = data[j];
                value = datum[field] || datum[rawfn] || 0;
                ser.min = Math.min(ser.min, value);
                ser.max = Math.max(ser.max, value);
                ser.total += value; }
            series.push(ser); }
        return series;
    },


    showColorKeys = function (divid, keytitle, serieslayout) {
        var html = [];
        serieslayout.forEach(function (rowlayout) {
            var rowhtml = [];
            rowlayout.forEach(function (seriesdef) {
                seriesdef = seriesdef || { color: "white", name: "" };
                rowhtml.push(["td", {style: "padding:5px 20px;"},
                              [["span", {style: "background-color:" + 
                                                seriesdef.color},
                                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"],
                               ["span", {style: "display:inline-block;" +
                                                "width:20px;" + 
                                                "text-align:right;"},
                                (seriesdef.max || "")],
                               "&nbsp;",
                               ["a", {name: seriesdef.name,
                                      title: seriesdef.title},
                                seriesdef.name]]]); });
            html.push(["tr",
                       rowhtml]); });
        html = ["table",
                ["tr",
                 [["td", {cla: "titletxt"},
                   keytitle],
                  ["td",
                   ["table",
                    html]]]]];
        jt.out(divid, jt.tac2html(html));
    },


    rowify = function (series, cols) {
        var i, tdc = 0, rows = [], row = [];
        for(i = 0; i < series.length; i += 1) {
            if(tdc >= cols) {
                rows.push(row);
                row = [];
                tdc = 0; }
            row.push(series[i]);
            tdc += 1; }
        if(row.length > 0) {
            rows.push(row); }
        return rows;
    },


    minMaxData = function () {
        var min, max;
        min = data.reduce(function (value, datum) {
            return Math.min(value, datum.min); }, 1000000);
        max = data.reduce(function (value, datum) {
            return Math.max(value, datum.max); }, 0);
        return [min, max];
    },


    displayDailyGraph = function () {
        var svg, xAxis, yAxis, series;
        series = makeDailySeries();
        showColorKeys('dailykeysdiv', "Daily Activity", rowify(series, 3));
        svg = d3.select('#dailychartdiv')
            .data(data)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform",
                  "translate(" + margin.left + "," + margin.top + ")");
        xAxis = d3.svg.axis().scale(xscale).orient("bottom");
        yAxis = d3.svg.axis().scale(yscale).orient("left");
        xscale.domain(d3.extent(data, function (d) { return d.day; }));
        yscale.domain(d3.extent(minMaxData(), function (d) { return d; }));
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);
        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis);
        series.forEach(function (sdef) {
            svg.append("path")
                .datum(data)
                .attr("class", "line")
                .attr("stroke", sdef.color)
                .attr("stroke-width", sdef.width)
                .attr("stroke-dasharray", sdef.dashes)
                .attr("d", makeLine(sdef.datafield)); });
    },


    verticalize = function (obj, field) {
        var elems;
        if(!field || !obj[field]) {
            return; }
        elems = obj[field].csvarray();
        elems.forEach(function (elem) {
            var attrval = elem.split(":"),
                attr = attrval[0],
                val = parseInt(attrval[1], 10);
            obj[attr] = (obj[attr] || 0) + val; });
    },


    prepData = function () {
        data.sort(function (a, b) {
            if(a.day < b.day) { return -1; }
            if(a.day > b.day) { return 1; }
            return 0; });
        while(data.length > 0 && !data[data.length - 1].daily) {
            data = data.slice(0, data.length - 1); }
        data.forEach(function (stat) {
            var i, sname;
            stat.day = new Date(stat.day);
            verticalize(stat, "daily");
            verticalize(stat, "comms");
            stat.min = 0;
            stat.max = 0;
            for(i = 0; i < sernames.length; i += 1) {
                sname = sertrans[i];
                stat[sname] = stat[sname] || 0;
                stat.min = Math.min(stat.min, stat[sname]);
                stat.max = Math.max(stat.max, stat[sname]); } });
    },


    fetchDataAndDisplay = function () {
        jt.out('dailykeysdiv', "Fetching ActivityStat records");
        jt.call('GET', "../fetchdaystats", null,
                function (stats) {
                    data = stats;
                    prepData();
                    displayDailyGraph(); },
                function (code, errtxt) {
                    jt.out('averagesdiv', "fetch failed: " + code + 
                           " " + errtxt); },
                jt.semaphore("actstat.fetchDataAndDisplay"));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    display: function () {
        jtminjsDecorateWithUtilities(jt);
        fetchDataAndDisplay();
    }

}; //end of returned functions
}());

