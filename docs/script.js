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
	var loc={};
	var fix;
	var fixes=[];
	var track = []; // array of track objects - locations, altitudes, timestamps, lengths, durations,...
	var accuracy, dist, distance, heading, speed; // fix & track data
	var deg = "&#176;";
	var compass="N  NNENE ENEE  ESESE SSES  SSWSW WSWW  WNWNW NNWN  "
	var notifications=[];
	
	console.log("variables initialised");
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
	status = window.localStorage.getItem('ClydeTrip'); // recover previous trip stats
	notify("trip status: "+status);
	if(status) {
		json=JSON.parse(status);
		var text="last trip distance: "+json.distance+" nm in ";
		if(json.time>60) text+=Math.floor(json.time/60)+" hr ";
		text+=json.time%60+" min; speed: "+Math.round(json.distance*60/json.time)+" knots; ";
		alert(text);
	}
	
	function moveTo(event) {
		if(tracking) {
			showNotifications(); // show testing diagnostics
			return;
		}
		x=sw/2-event.clientX;
		y=sh/2-event.clientY;
		console.log("move to "+x+", "+y+" from current position");
		loc.lat+=y/8100;
		loc.lon-=x/4050;
		console.log("new location: "+loc.lat+", "+loc.lon);
		centreMap();
	}
	
	function addTP() {
		notify("add trackpoint "+track.length);
		var tp={};
		tp.lon=loc.lon;
		tp.lat=loc.lat;
		tp.time=loc.time;
		track.push(tp);
		redraw();
		if(track.length<2) return;
		var trip={};
		trip.distance=decimal((distance+dist)/1852); // nautical miles
		trip.time=Math.round((loc.time-track[0].time)/60); // minutes
		var json=JSON.stringify(trip);
		// console.log("save trip "+json);
		window.localStorage.setItem('ClydeTrip', json);
	}
	
	function go() {
		console.log("go.... start tracking geolocation");
		tracking = true;
		track = [];
		loc={};
		distance = 0;
		heading = 0;
		speed = 0;
		notify("start tracking");
		fix=0;
		fixes=[];
	    if (navigator.geolocation) {
			var opt={enableHighAccuracy: true, timeout: 15000, maximumAge: 0};
        		geolocator = navigator.geolocation.watchPosition(sampleLocation,locationError,opt);
    		} else  {
       		alert("Geolocation is not supported by this browser.");
    		}
		// document.getElementById("buttonStartStop").style.background = "url(stopButton24px.svg) center center no-repeat";
		document.getElementById("actionButton").innerHTML='<img src="stopButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", go);
		document.getElementById("actionButton").addEventListener("click", cease);
	}
	
	function sampleLocation(position) {
		var accuracy=position.coords.accuracy;
		notify("fix "+fix+" accuracy: "+accuracy);
		console.log("at "+position.coords.longitude+","+position.coords.latitude)
		if(accuracy>50) return; // skip inaccurate fixes
		fixes[fix]={};
		fixes[fix].lon=position.coords.longitude;
		fixes[fix].lat=position.coords.latitude;
		fix++;
		if(fix<3) return;
		fix=0; // reset to get next three sample fixes
		var now=new Date();
		loc.time=Math.round(now.getTime()/1000); // whole seconds
		loc.lon=(fixes[0].lon+fixes[1].lon+fixes[2].lon)/3; // average location data
		loc.lat=(fixes[0].lat+fixes[1].lat+fixes[2].lat)/3;
		// ALLOW TESTING AT IDRIDGEHAY
		loc.lon-=3.301276;
		loc.lat+=2.74155;
		// END OF TEST CODE		
		notify(loc.lon+","+loc.lat+", accuracy:"+accuracy);
		if(track.length<1) addTP(); // add first trackpoint at start
		else {
			var t=track.length-1; // most recent trackpoint
			// notify("latest trackpoint; "+t);
			dist=measure("distance",loc.lon,loc.lat,track[t].lon,track[t].lat); // distance since last trackpoint
			var interval=loc.time-track[t].time;
			// notify("times: "+loc.time+", "+track[t].time);
			// notify("dist: "+Math.round(dist)+"m interval: "+interval+"s");
			if(dist>0 && interval>0) speed = 1.944012 * dist / interval; // current speed knots
			speed = Math.round(speed); // nearest mph
			var direction=measure("heading",track[t].lon,track[t].lat,loc.lon,loc.lat); // heading since last trackpoint
			var turn=Math.abs(direction-heading);
			if(turn>180) turn=360-turn;
			notify("speed: "+speed+"knots; turn: "+Math.round(turn));
			if((dist>100)||(turn>30)) { // add trackpoint after 100m or when direction changes > 30*
			// if(dist>25) { // JUST FOR TESTING
				distance=distance+Math.round(dist);
				heading=Math.round(direction);
				addTP();
				dist=0;
			}
		}
		centreMap();
	}
	
	function locationError(error) {
		var message="";
		switch (error.code) {
			case error.PERMISSION_DENIED:
				message="location request denied";
				break;
			case error.POSITION_UNAVAILABLE:
				message="location not available";
				break;
			case error.TIMEOUT:
				message="location timeout";
				break;
			case error.UNKNOWN_ERROR:
				message="unknown loaction error";
		}
		alert(message);
	}
	
	function cease(event) {
		console.log("stop tracking ... "+track.length+" fixes");
		tracking = false;
		navigator.geolocation.clearWatch(geolocator);
		document.getElementById("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", cease);
		document.getElementById("actionButton").addEventListener("click", go);
		document.getElementById("heading").innerHTML = "Clyde";
		redraw();
	}

	function redraw() {
	    var i, p, x, y, r, d;	    
	    mapCanvas.clearRect(0, 0, sw, sh);
		mapCanvas.lineWidth = 5;
		mapCanvas.strokeStyle = 'rgba(0,0,255,0.3)';
		mapCanvas.fillStyle = 'rgba(0,0,0,0.7)';
		mapCanvas.Baseline = 'top';
	    if (tracking) { 
			// notify("tracking - redraw");
			mapCanvas.font = 'Bold 16px Sans-Serif';
			mapCanvas.textAlign = 'left';
			mapCanvas.fillText('knots',5,60);
			mapCanvas.font = 'Bold 64px Sans-Serif';
			mapCanvas.textAlign = 'left';
			mapCanvas.fillText(speed,5,110);
			mapCanvas.textAlign = 'right';
			if(distance>0) { // display distance travelled
				notify("display distance");
				mapCanvas.textAlign = 'right';
				d=distance+dist;
				d/=1852; // nautical miles
				d=decimal(d);
				notify(d+"nm");
				mapCanvas.font = 'Bold 16px Sans-Serif';
				mapCanvas.fillText('nm',sw-5,60);
				mapCanvas.font = 'Bold 48px Sans-Serif';
				mapCanvas.fillText(d,sw-5,110);
				mapCanvas.textAlign = 'left';
				notify("display heading and slope");
				d=Math.round((heading+11.25)/22.5); // 16 compass directions: N, NNE, NE,...
				d=compass.substr(d*3,3); // compass point eg. NNE
			}
        		// draw current track as blue line
	   		if (track.length > 1) {
	        		console.log("draw track - length: " + track.length);
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
		}
		mapCanvas.rect(sw / 2 - 8, sh / 2 - 8, 16, 16);	 // blue square at current location
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
	
	function measure(type,x0,y0,x,y) {
		var dx = x - x0;
	    var dy = y - y0;
        dx *= 66610; // allow for latitude
        dy *= 111111.111; // 90 deg = 10000 km
		if(type=="distance") return Math.sqrt(dx * dx + dy * dy);
		var h; // heading
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
	
	function notify(note) {
		notifications.push(note);
		while(notifications.length>10) notifications.shift();
		console.log(note);
	}
	
	function showNotifications() {
		var message="";
		for(var i in notifications) {
			message+=notifications[i]+"; ";
		}
		alert(message);
	}

	// implement service worker if browser is PWA friendly 
  if ('serviceWorker' in navigator) {
	if (navigator.serviceWorker.controller) {
    		console.log('active service worker found, no need to register')
	} else {
		navigator.serviceWorker
        .register('./sw.js', {scope: './'})
        .then(function() { console.log('Service Worker Registered'); });
	}
  }
  else {
	  console.log("not PWA friendly");
	  document.getElementById('heading').style.color = 'yellow';
  }
	
})();
