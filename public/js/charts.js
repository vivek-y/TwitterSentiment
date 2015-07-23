// Client-side code
/* jshint browser: true, jquery: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, nonew: true, quotmark: double, strict: true, undef: true, unused: true */
$(document).ready(function () {
    "use strict";
    var keyword = "";
    var socket = io.connect("http://localhost:3000");

    //Turn off UTC to use local time zone
    Highcharts.setOptions({
        global: {
            useUTC: false
        }
    });

    //Display donut chart
    var donut = new Highcharts.Chart({
        chart: {
            renderTo: "semiDonut",
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false
        },
        title: {
            text: "SENTIMENT",
        },
        tooltip: {
            formatter: function() {
                return "<b>"+ this.point.name +"</b>: "+ this.percentage.toFixed(1) +" %";
            }
        },
        plotOptions: {
            pie: {
                allowPointSelect: false,
                cursor: "pointer",
                dataLabels: {
                    enabled: true,
                    color: "#000000",
                    connectorColor: "#000000",
                    formatter: function() {
                        return "<b>"+ this.point.name +"</b>: "+ this.percentage.toFixed(1) +" %";
                    }
                }
            }
        },
        series: [{ //Filler data
            type: "pie",
            name: "Distribution",
            data: [
                ["Neutral", 4], 
                ["Positive", 3],
                ["Negative", 3]             
            ]
        }]
    });

    //Display dynamic line chart
    var lineChart = new Highcharts.Chart({
        chart: {
            renderTo: "lineChart",
            defaultSeriesType: "spline"
        },
        title: {
            text: "REAL TIME SENTIMENT SCORE"
        },
        xAxis: {
            type: "datetime",
            tickPixelInterval: 150,
            maxZoom: 20 * 1000
        },
        yAxis: {
            minPadding: 0.2,
            maxPadding: 0.2,
            title: {
                text: "SENTIMENT SCORE",
                margin: 80
            }
        },
        series: [{
            name: "SENTIMENT SCORE",
            data: []
        }]
    }); 

    //Listen for current state of app
    socket.on("state", function(inUse){
        keyword = inUse.keyword;
        $("#status").html("<h3 class='text-warning'> MONITORING \""+ keyword +"\"... </h3>");
        //If app is in use, show "stop" button. Else, show search bar.
        if(inUse.state){
            $("#stop").show();
            $("#search").hide(); 
        }else{
            $("#stop").hide();
            $("#search").show();
        }
    });       

    //Handles keyword submission
    $("#searchForm").on("submit", function(evt) {
        evt.preventDefault();
        var topic = $("#topic").val();
        //Handles case when keyword is empty string.
        if(topic === "" || topic === null){
            return;
        }
        //Tells server about new keyword to track
        socket.emit("topic", topic);
        $("#status").html("<h3 class='text-warning'> MONITORING \""+ topic +"\"... </h3>");
        $("#stop").show();
        $("#search").hide();
    });

    // Handles event when user stops analysis
    $("#stopForm").on("submit", function(evt) {
        evt.preventDefault();
        socket.emit("stopStreaming", "dummy");
        $("#stop").hide();
        $("#search").show();
    });

    
    // Handles real-time data updates
    socket.on("data", function(data) {
        donut.series[0].setData([
            ["Neutral",data.neu],   
            ["Positive",data.pos],
            ["Negative", data.neg]           
        ]);
        var shift = data.total > 200;
        var x = (new Date()).getTime();
        var y = data.currentScore;
        $("#tweet").html(data.tweet);
        $("#totalTweet").html(data.total);
        $("#positiveTweet").html(data.pos);
        $("#negativeTweet").html(data.neg);
        $("#neutralTweet").html(data.neu);
        var sentimentScore = (data.pos - data.neg) / (data.pos + data.neg);
        $("#sentimentScore").html(parseFloat(sentimentScore).toFixed(2));

        lineChart.series[0].addPoint( [x,y],true, shift);
    });

    // Handles updates to Last 10 Analysis Table
    socket.on("list", function(tweets) {
        console.log(tweets);
        var title = "<h4 class='text-center'>LAST 10 SENTIMENT ANALYSIS</h4>";
        var table = title + "<table class='table table-condensed table-bordered'>";
        table = table + "<tr><td><b>KEYWORD</b></td><td><b>TOTAL TWEETS</b></td><td><b>SENTIMENT SCORE</b></td></tr>";
        for (var i = tweets.length-1; i >=  0; i--) {
            table = table + "<tr><td>" + tweets[i].keyword + "</td>";
            table = table + "<td>" + tweets[i].total + "</td>";
            table = table + "<td>" + tweets[i].score.toFixed(2) + "</td></tr>";
        }

        $("#recentSearch").html(table);
    });

});

