// Server-side code
/*jshint node: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, nonew: true, quotmark: double, strict: true, undef: true, unused: true */
"use strict";

var express = require("express");
var app = require("express")();
var server = require("http").Server(app);
var path = require("path");
var Twitter = require("twitter");
var io = require("socket.io")(server);
var sentiment = require("sentiment");
var port = 3000;
var mongoose = require("mongoose");
var inUse = { state: false, keyword : ""};
var score = {
			total:0,
			pos:0,
			neg:0,
			neu: 0,
			currentScore: 0,
			tweet: ""
		};

// Setup view engine
app.set("views", path.join(__dirname, "/views"));
app.set("view engine", "jade");

// More set up
app.use(express.static(path.join(__dirname, "/public")));

//Create server
server.listen(port, function(){
	console.log("Now listening on port: %s", port);
});

//Setup Twitter
var twit = new Twitter({
	consumer_key: "MpexGqEOaiXzINTk6MjjLJDto",
	consumer_secret: "BSsXF0DSv8JLVklPbNlXPe96jaOVzKG08uo4PENKghmb1QyMz1",
	access_token_key: "3172708812-6WyVHiyyQCW2F4y1irkxCZpRS2cu1EgrJ2Lvi91",
	access_token_secret: "YGLVoWaXG2snGd6ki3OT6r9ti8q88zuZOGIKyY0VdZth3"
});

//Setup database
mongoose.connect("mongodb://localhost/sentiment", function(err){
  if(err){ console.log(err);}
});

//Define db schema
var tweetSchema = new mongoose.Schema( 
	{
		keyword: String,
		total: Number,
		pos: Number,
		neg: Number,
		neu: Number,
		date: { type: Date, default: Date.now },
		score: Number
	}, {
		capped: { size: 2048, max: 10, autoIndexId: true }
	}
);

var Tweets = mongoose.model("Tweets", tweetSchema);

//Turn on socket-io
io.on("connection", function(socket){
	console.log("socket connected");
	//Broadcast current state of application
	io.emit("state", inUse);

	//Listen for new keyword/topic search
	socket.on("topic", function(topic) {
		//If topic is empty string, don't do anything.
		if(topic === "" || topic === null){
			return;
		}

		//Update current state
		inUse.state = true;
		inUse.keyword = topic;

		score = {
			total:0,
			pos:0,
			neg:0,
			neu: 0,
			currentScore: 0,
			tweet: ""
		};

		//Filter Twitter stream by keyword/topic for only english language
		twit.stream("statuses/filter", {track: topic, language:"en"}, function(stream) {
			stream.on("data", function(tweet) {
				//Sentiment analysis on current tweet
				var senti = sentiment(tweet.text);
				score.total++;
				score.currentScore = senti.score;
				score.tweet = tweet.text;

				//Update sentiment statistics
				if (senti.score === 0) {
					score.neu++;
				} 
				else if (senti.score < 0) {
					score.neg++;
				}
				else {
					score.pos++;
				}

				//Broadcast state and sentiment result
				io.emit("data",score);
				io.emit("state",inUse);
			});
			twit.currentStream = stream;
			twit.currentKey = topic;	
		});
	});

	//Find and broadcast last 10 analyses
	Tweets.find({}, function(error, tweets) {
		if(error){
			console.log(error);
		} else{
			io.emit("list", tweets);
		}
	});

	//Handles event when someone stop analysis
	socket.on("stopStreaming", function(data) {
		//Destroy current stream
		twit.currentStream.destroy();
		//Update app state
		inUse.state = false;
		inUse.keyword = "";
		//Broadcast app state
		io.emit("state",inUse);

		//Save results of current analysis
		var tweet = {
			keyword: twit.currentKey,
			total: score.total,
			pos: score.pos,
			neg: score.neg,
			neu: score.neu,
			score: (score.pos - score.neg) / (score.pos + score.neg)
		};
		var newTweet = new Tweets (tweet);
		newTweet.save(function (err, result) {
			//Error checking to make sure results are saved
			if (err !==null) {
				console.log(err);
			}
			else {
				//Find and broadcast last 10 analyses
				Tweets.find({}, function (err, tweets) {
					io.emit("list", tweets);
				});
			}
		});
	});
});

//Route handles get request to application
app.get("/", function(req,res){
	res.render("index");
});

module.exports = app;