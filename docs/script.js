// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232509
(function () {
	"use strict";
	var sw, sh; // usabe screen width and height
	var mapCanvas; // canvas for on-screen graphics
	var mapLeft, mapTop; // top-left of map relative to screen
	var mapN = 56.1666667; // north and west edges of map (degrees)
	var mapW = -5.26;
	var x, y, x0, y0; // horizontal and vertical coordinates/measurements
	var offset = {};
	var status; // location
	var json;
	var tracking = false;
    var geolocator = null;
	var track = []; // array of track objects - locations, altitudes, timestamps, lengths, durations,...
	var waypoints=[]; //waypoints
	var loc={};
	var alt, accuracy, dist, heading, speed, slope; // GPS fix data
	var ascent, descent; // total climbing up/down along track
	var deg = "&#x02DA;";
	
	console.log("variables initialised");
	// document.getElementById("buttonStartStop").addEventListener("click", go);
	document.getElementById("wpButton").addEventListener("click", addWP);
	document.getElementById("actionButton").addEventListener("click", go);
	document.getElementById("mapOverlay").addEventListener("click", moveTo);
	loc.lat = 55.773;
	loc.lon = -4.86;
	sw = window.innerWidth;
	sh = window.innerHeight;
	console.log("screen size: "+sw+"x"+sh);
	for (x = 0; x < 6; x++) { // build map by positioning 10x10 grid of tiles
		for (var y = 0; y < 6; y++) {
			var tile = document.getElementById("tile" + y + x);
			tile.style.left = (x * 375) +'px';
			tile.style.top = (y * 675) +'px';
		}
	}
	mapCanvas = document.getElementById("mapCanvas").getContext("2d"); // set up drawing canvas
	document.getElementById("mapCanvas").width = sw;
	document.getElementById("mapCanvas").height = sh;
	console.log("mapCanvas size: "+document.getElementById("mapCanvas").width+"x"+document.getElementById("mapCanvas").height);
	status = window.localStorage.getItem('ClydeLocation');
	console.log("status: "+status);
	if(status) {
		json = JSON.parse(status);
		console.log("json: "+json);
		loc.lat = json.lat;
		loc.lon = json.lon;
		console.log("loc: "+loc.lat+","+loc.lon);
	}
	centreMap(); // go to saved location
	
	function moveTo(event) {
		x=sw/2-event.clientX;
		y=sh/2-event.clientY;
		console.log("move to "+x+", "+y+" from current position");
		loc.lat+=y/8100;
		loc.lon-=x/4050;
		console.log("new location: "+loc.lat+", "+loc.lon);
		centreMap();
	}
	
	function addWP() {
		console.log("add waypoint at "+loc.lon+", "+loc.lat);
		var wp={};
		wp.lat=loc.lat;
		wp.lon=loc.lon;
		waypoints.push(wp)
	}
	
	function go() {
		console.log("go.... start tracking geolocation");
		tracking = true;
		track = [];
	    if (navigator.geolocation) {
        		geolocator = navigator.geolocation.watchPosition(logPosition);
    		} else  {
       		alert("Geolocation is not supported by this browser.");
    		}
		// document.getElementById("buttonStartStop").style.background = "url(stopButton24px.svg) center center no-repeat";
		document.getElementById("actionButton").innerHTML='<img src="stopButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", go);
		document.getElementById("actionButton").addEventListener("click", cease);
	}
	
	function logPosition(position) {
		var interval, n;
		loc.lat = position.coords.latitude;
		loc.lon = position.coords.longitude;
		console.log("fix at N: "+loc.lat+" E: "+loc.lon);
		var now=new Date();
		var fix={};
		fix.time=now.getTime()/1000; // seconds
		fix.lat=loc.lat;
		fix.lon=loc.lon;
		fix.alt = Math.round(position.coords.altitude); // nearest m
		alt = fix.alt;
	    accuracy = position.coords.accuracy;
		console.log("altitude: "+fix.alt+"; accuracy: "+accuracy);
		track.push(fix);
		// new averaging code...
		n = track.length;
		if(n>1) { // restart track after >2min sleep
			interval = fix.time - track[n-2].time;
			if(interval>120) track=[];
		}
		if(n==3) { // first averaging over 3 fixes}
			track[1].lat = (track[0].lat + track[1].lat + track[2].lat)/3;
			track[1].lon = (track[0].lon + track[1].lon + track[2].lon)/3;
			track[1].alt = (track[0].alt + track[1].alt + track[2].alt)/3;
		}
		else if(n==4) {
			track[2].lat = (track[1].lat + track[2].lat + track[3].lat)/3;
			track[1].lon = (track[1].lon + track[2].lon + track[3].lon)/3;
			track[1].alt = (track[1].alt + track[2].alt + track[3].alt)/3;
		}
		else if(n>=5) { // after first 5 fixes, average over most recent 5
			track[n-3].lat = (track[n-5].lat + track[n-4].lat + track[n-3].lat + track[n-2].lat + track[n-1].lat)/5;
			track[n-3].lon = (track[n-5].lon + track[n-4].lon + track[n-3].lon + track[n-2].lon + track[n-1].lon)/5;
			track[n-3].alt = (track[n-5].alt + track[n-4].alt + track[n-3].alt + track[n-2].alt + track[n-1].alt)/5;
		}
		if(n==1) {
			dist = 0;
			speed = 0;
	        heading = 0;
		}
		else if (n<6) { // less accurate earlier speed & heading
			dist = distance(track[0].lon, track[0].lat, fix.lon, fix.lat, "deg");
			interval = fix.time - track[0].time;
			speed = 2.237136 * dist / interval; // current speed mph
			heading = bearing(track[0].lon,track[0].lat,fix.lon,fix.lat,'deg');
		}
		else if(n==6) {
			dist = distance(track[1].lon, track[1].lat, track[4].lon, track[4].lat, "deg");
			interval = track[4].time - track[1].time;
			speed = 2.237136 * dist / interval; // current speed mph
			heading = bearing(track[1].lon,track[1].lat,track[4].lon,track[4].lat,'deg');
		}
		else { // averaged speed & heading
			dist = distance(track[n-7].lon, track[n-7].lon, track[n-3].lon, track[n-3].lon, "deg");
			interval = track[n-3].time - track[n-7].time;
			speed = 1.944 * dist / interval; // current speed knots
			heading = bearing(track[n-7].lon,track[n-7].lat,track[n-3].lon,track[n-3].lat,'deg');
		}
		heading = Math.round(heading);
		centreMap();
	}
	
	function cease(event) {
		console.log("stop tracking ... "+track.length+" fixes");
		tracking = false;
		navigator.geolocation.clearWatch(geolocator);
		// document.getElementById("buttonStartStop").style.background = "url(goButton24px.svg) center center no-repeat";
		document.getElementById("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", cease);
		document.getElementById("actionButton").addEventListener("click", go);
		document.getElementById("heading").innerHTML = "White Peak";
		redraw();
	}

	function redraw() {
	    var i, p, x, y, r;	    
	    mapCanvas.clearRect(0, 0, sw, sh);
		mapCanvas.lineWidth = 5;
		mapCanvas.strokeStyle = 'rgba(0,0,255,0.3)';
		mapCanvas.beginPath();
	    if (tracking) { 
			mapCanvas.fillStyle = 'rgba(0,0,0,0.7)';
			mapCanvas.Baseline = 'top';
			mapCanvas.font = 'Bold 16px Sans-Serif';
			mapCanvas.textAlign = 'left';
			mapCanvas.fillText('mph',5,60);
			mapCanvas.textAlign = 'right';
			mapCanvas.fillText('%',sw-5,60);
			mapCanvas.font = 'Bold 64px Sans-Serif';
			mapCanvas.textAlign = 'left';
			mapCanvas.fillText(speed,5,110);
			mapCanvas.textAlign = 'right';
			mapCanvas.fillText(heading,sw-5,110);
			r = accuracy * 0.216;
			console.log("radius "+r);
	        if (r < 5) r = 5;
	        if (r > 100) r = 100;
	        mapCanvas.arc(sw / 2, sh / 2, r, 0, Math.PI * 2); // location showed by blue circle indicating GPS accuracy if tracking GPS...
	    } // ...otherwise just as small blue square
	    else mapCanvas.rect(sw / 2 - 4, sh / 2 - 4, 8, 8);	
		// draw small circles for waypoints
		for(i in waypoints) {
			var wp=waypoints[i];
			 x = (wp.lon - loc.lon) * 4500 + sw / 2;
	         y = (loc.lat - wp.lat) * 8100 + sh / 2;
			mapCanvas.moveTo(x,y);
			mapCanvas.arc(x, y, 3, 0, Math.PI * 2); 	
		}
        // draw current track as blue line
	    if (track.length > 1) {
	        console.log("draw track - length: " + track.length);
	        // mapCanvas.lineWidth = 3; 
	        mapCanvas.beginPath();
	        p = track[0];
	        x = (p.lon - loc.lon) * 4500 + sw / 2;
	        y = (loc.lat - p.lat) * 8100 + sh / 2;
	        mapCanvas.moveTo(x, y);
	        for (i = 1; i < track.length; i++) {
	            p = track[i];
	            x = (p.lon - loc.lon) * 4500 + sw / 2;
	            y = (loc.lat - p.lat) * 8100 + sh / 2;
	            mapCanvas.lineTo(x, y);
	        }
	    }
		mapCanvas.stroke();
	}
	
	function centreMap() { // move map to current location
		console.log("centre map at "+loc.lat+", "+loc.lon);
	    var i, x, y;
	    mapLeft = (mapW - loc.lon) * 4500 + sw / 2;
	    mapTop = (loc.lat - mapN) * 8100 + sh / 2;
		console.log("map position: "+mapLeft+", "+mapTop);
		var map = document.getElementById("map");
		map.style.left = mapLeft+"px";
		map.style.top = mapTop+"px";
		var string = dm(loc.lat, true) + " " + dm(loc.lon, false);
		document.getElementById('heading').innerHTML = string;
		redraw(); // update track, route, places, etc
		json=JSON.stringify(loc);
		console.log("save location "+json);
		 window.localStorage.setItem('ClydeLocation', json);
	}
	
	function dm(degrees, lat) {
	    var ddmm;
	    var negative = false;
	    var n;
	    if (degrees < 0) {
	        negative = true;
	        degrees = degrees * -1;
	    }
	    ddmm = Math.floor(degrees); // whole degs
	    n = (degrees - ddmm) * 60; // minutes
	    ddmm += deg;
	    if (n < 10) ddmm += "0";
	    ddmm += decimal(n) + "'";
	    if (negative) {
	        if (lat) ddmm += "S";
	        else ddmm += "W";
	    }
	    else {
	        if (lat) ddmm += "N";
	        else ddmm += "E";
	    }
	    return ddmm;
	}

	function distance(x0, y0, x, y, unit) {
	    var dx = x - x0;
	    var dy = y - y0;
	    switch (unit) { // if mode is "m" or omitted dx & dy unchanged
	        case "deg":
	            dx *= 62266; // allow for latitude
	            dy *= 111111.111; // 90 deg = 10000 km
	            break;
	        case "px":
	            dx *= 13.837; // 62266 m/degree / 4500 px/degree (eastwards)
	            dy *= 13.717; // 111111.111 m/degree / 8100 px/degree (northwards)
	            break;
	    }
	    return Math.sqrt(dx * dx + dy * dy);
	}
	// use bearing instead of altitude in Clyde PWA
	function bearing(x0, y0, x, y, unit) {
	    var h;
	    var dx = x - x0;
	    var dy = y - y0;
	    switch (unit) { // if mode is "m" or omitted dx & dy unchanged
			case "deg":
	            dx *= 62266; // allow for latitude
	            dy *= 111111.111; // 90 deg = 10000 km
	            break;
	        case "px":
	            dx *= -13.837; // 62266 m/degree / 4500 px/degree (eastwards)
	            dy *= 13.717; // 111111.111 m/degree / 8100 px/degree (northwards)
	            break;
	    }
        if (dy == 0) {
	        h = (dx > 0) ? 90 : 270;
	    }
	    else {
	        h = Math.atan(dx / dy) * 180 / Math.PI;
	        if (dy < 0) h += 180;
	        if (h < 0) h += 360 // range 0-360
        }
        return h;
	}

	function decimal(n) {
	    return Math.floor(n * 10 + 0.5) / 10;
	}

	// implement service worker if browser is PWA friendly 
  if ('serviceWorker' in navigator) {
	if (navigator.serviceWorker.controller) {
    		console.log('active service worker found, no need to register')
	} else {
		navigator.serviceWorker
        .register('./wpSW.js', {scope: './'})
        .then(function() { console.log('Service Worker Registered'); });
	}
  }
  else {
	  console.log("not PWA friendly");
	  document.getElementById('heading').style.color = '#FF4';
  }
	
})();
