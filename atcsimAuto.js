function dynamicallyLoadScript(url) {
    var script = document.createElement("script"); // Make a script DOM node
    script.src = url; // Set it's src to the provided URL
    document.head.appendChild(script); // Add it to the end of the head section of the page (could change 'head' to 'body' to add it to the end of the body section instead)
}

dynamicallyLoadScript('https://d3js.org/d3.v4.min.js')
dynamicallyLoadScript('https://d3js.org/d3-scale.v1.min.js')


try {
	clearInterval(departureInterval)
	clearInterval(arrivalInterval) 
	clearInterval(spaceInterval) 
	clearInterval(updateInterval)
} catch(err) {

}


// initial North, initial South, east flow North, east flow South, east flow Final, west flow North, west flow South, west flow Final
navs = ['DOB', 'JHH', 'CAVEB', 'WEFOR', 'AT', 'ESFOR', 'HEDEG', 'BR', '8L', '9R', '26R', '27L']
navcoords = {}
currentFlow = 'e'

navs.forEach(function(nav) {
	for (var i=0; i<G_arrNavObjects.length; i++) {
		if (G_arrNavObjects[i][0] == nav) {
			navcoords[nav] = [G_arrNavObjects[i][2], G_arrNavObjects[i][3]]
			break
		}
	}
})


routePlane = function(routing) {
	console.log(routing)
	document.getElementsByName('txtClearance')[0].value = routing
	fnParseInput()
}


checkDepartures = function() {
	var planes = Object.keys(G_objPlanes)
	var waitingPlane = ''
	var takingOffPlane = ''

	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if(p['status'] == 'taking off') {
			takingOffPlane = plane
		}
		if (p['status'] == 'waiting') {
			waitingPlane = plane
		}
	})

	// console.log('waiting: ' + waitingPlane + '     taking off: ' + takingOffPlane)

	// if nobody's waiting, then send one to line up and wait
	planes.forEach(function(plane) {
		if (waitingPlane == '') {
			var p = G_objPlanes[plane]
			if(!p['status'] && !p['runway'] && p[4] == 1026) {
				p['status'] = 'waiting'
				waitingPlane = plane
				routePlane(plane + ' c 29 w')
				return
			}
		}
	})

	// if nobody's taking off, then tell the waiting plane to take off
	if ((takingOffPlane == '' || G_objPlanes[takingOffPlane][6]>140) && waitingPlane != '') {
		takingOffPlane = waitingPlane
		waitingPlane = ''
		G_objPlanes[takingOffPlane]['status'] = 'taking off'
		routePlane(takingOffPlane + ' t')
	}

	// if the taking off plane is above 3000ft, then route him
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16] == 'T' && p[4] > 3000) {
			p['status'] = 'en route'
			var req = G_arrNavObjects[p[13]][0]
			if (p[11] != req) {
				routePlane(plane + ' s 600 c ' + req)
			}
		}
	})
}


checkFlow = function() {
	if ((currentFlow=='w' && intWind<150) || (currentFlow=='e' && intWind>210)) {
		currentFlow = currentFlow=='e' ? 'w' : 'e'
		var planes = Object.keys(G_objPlanes)
		planes.forEach(function(plane) {
			var p = G_objPlanes[plane]
			if (p[16]=='A' && p['leg']!='landing') {
				delete p['final'] // remove the 'final' tag so that the plane is rerouted as if new
			}
		})
	}
}


checkArrivals = function() {
	var planes = Object.keys(G_objPlanes)
	var navN = navs[0]
	var navS = navs[1]
	var navAN = currentFlow=='e' ? navs[2] : navs[5]
	var navAS = currentFlow=='e' ? navs[3] : navs[6]
	var navF = currentFlow=='e' ? navs[4] : navs[7]
	var runN = currentFlow=='e' ? '8l' : '26r'
	var runS = currentFlow=='e' ? '9r' : '27l'

	// route the unrouted planes
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16] == 'A' && !p['final']) {
			// if we're north of the final waypoint
			if (p[3]+62 < navcoords[navF][1]) {
				// routePlane(plane + ' c 4 s 300 c ' + navN)
				p['turnDirection'] = '180'
				p['approach'] = navAN
				p['runway'] = runN
				p['north'] = true
			} else {
				// routePlane(plane + ' c 4 s 300 c ' + navS)
				p['turnDirection'] = '000'
				p['approach'] = navAS
				p['runway'] = runS
				p['north'] = false
			}
			p['final'] = navF
			p['leg'] = 'initial'
		}
	})

	// if we're on final and pointed towards our heading, try to land
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16] == 'A' && p[11] == p['final'] && p[5]==p[8] && p[9]>1999) {
			routePlane(plane + ' l ' + p['runway'])
			p['leg'] = 'landing'
		}
	})
}


highlightLines = []

calcLines = function() {
	lineX = 0
	northY = 0
	southY = 0

	waypoints.forEach(function(waypoint) {
		for (var i=0; i<G_arrNavObjects.length; i++) {
			if (G_arrNavObjects[i][0] == 'SCARR') {
				lineX = G_arrNavObjects[i][1]
			} else if (G_arrNavObjects[i][0] == 'CAVEB') {
				northY = G_arrNavObjects[i][2]
			} else if (G_arrNavObjects[i][0] == 'WEFOR') {
				southY = G_arrNavObjects[i][2]
			}
		}
	})
}

calcLines()


highlightPoints = []

spacePlanes2 = function() {
	var planes = Object.keys(G_objPlanes)
	var Splanes = []
	var Nplanes = []
	var queueN = []
	var queueS = []
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16]=='A') {
			if (p.leg == 'initial') {
				// if we're close to the line
				if (Math.abs(p[2]+24 - lineX)<100) {
					p.leg = 'queue'
					delete p.target
					routePlane(plane + ' c ' + p.turnDirection)
				} else { // if we're on initial but not there yet
					// if we're north
					if (p.north) {
						var waypoint = currentFlow=='e' ? finalEN : finalWN
						var dist = Math.sqrt(Math.pow(p[2]+24-lineX,2) + Math.pow(p[3]+62-northY,2))
						queueN.push({'plane': plane, 'dist': dist})
					} else {
						var waypoint = currentFlow=='e' ? finalES : finalWS
						var dist = Math.sqrt(Math.pow(p[2]+24-lineX,2) + Math.pow(p[3]+62-southY,2))
						queueS.push({'plane': plane, 'dist': dist})
					}
				}
			} else if (p.leg == 'queue') {
				if (Math.min(Math.abs(p[2]+62 - northY), Math.abs(p[2]+62 - southY)) < 10) {
					routePlane(plane + ' c ' + p.approach)
				}
			}
		}
	})
	queueN.sort(function(a,b) { return a.dist - b.dist })
	queueS.sort(function(a,b) { return a.dist - b.dist })

	highlightPoints = []

	if (G_objPlanes[queueS[0].plane][11] != (currentFlow=='e' ? finalES : finalWS)) {
		routePlane(queueS[0].plane + ' c 3 s 300 c ' + (currentFlow=='e' ? finalES : finalWS))
	}
	var frontPathLength = queueS[0].dist
	for (var i=1; i<queueS.length; i++) {
		var p = G_objPlanes[queueS[i].plane]
		var x1 = p[2] + 24
		var y1 = p[3] + 62
		var x0 = navcoords[currentFlow=='e' ? finalES : finalWS][0]
		var y0 = navcoords[currentFlow=='e' ? finalES : finalWS][1]
		var ml = currentFlow=='e' ? mES : mWS // m of the path line
		var bl = currentFlow=='e' ? bES : bWS // b of the path line
		var desiredPathLength = frontPathLength + i*150
		var prevDiff = 0
		var hasDecreased = false
		for (var x=x0; x<window.innerWidth; x+=10) {
			var xi = x
			var yi = ml * xi + bl
			var dist1 = Math.sqrt(Math.pow(x0-xi,2) + Math.pow(y0-yi,2))
			var dist2 = Math.sqrt(Math.pow(x1-xi,2) + Math.pow(y1-yi,2))
			var pathLength = dist1 + dist2
			var diff = Math.abs(pathLength - desiredPathLength)
			if (i==1) {
				// highlightPoints.push({uid:Math.random().toString(), r:diff/100, id:hasDecreased, x:xi, y:yi, fill:'blue'})
			}
			if (hasDecreased) {
				if (diff > prevDiff) {
					p['target'] = [xi, yi]
					// highlightPoints.push({uid:Math.random().toString(), r:10, id:p.name, x:xi, y:yi, fill:'green'})
					var theta = Math.atan2(yi-y1, xi-x1) / 3.14 * 180
					theta += 90 + 360
					theta = theta % 360
					var degrees = Math.round(theta)
					degrees = degrees.toString().padStart(3, '0')
					if(G_objPlanes[queueS[i].plane][8] != degrees) {
						routePlane(queueS[i].plane + ' c ' + degrees)
					}
					break
				}
			} else {
				if (diff < prevDiff) {
					hasDecreased = true
				}
			}
			prevDiff = diff
		}
	}
}





spacePlanes = function() {
	var planes = Object.keys(G_objPlanes)
	var waypoints = [navs[0], navs[1], navs[2], navs[3], navs[5], navs[6]]
	for (var w=0; w<waypoints.length; w++) {
		var waypoint = waypoints[w]
		var wx = navcoords[waypoint][0]
		var wy = navcoords[waypoint][1]
		var queue = []
		// pull out the planes flying to my waypoint, and calculate their distance
		planes.forEach(function(plane) {
			var p = G_objPlanes[plane]
			if (p[11] == waypoint) {
				var dist = Math.sqrt(Math.pow(p[2]+24-navcoords[waypoint][0],2) + Math.pow(p[3]+62-navcoords[waypoint][1],2))
				queue.push({'plane': plane, 'dist': dist})
			}
		})
		// sort them according to their distance
		queue.sort(function(a,b) {
			return a.dist - b.dist
		})

		// console.log(waypoint, queue)
		for (var i=0; i<queue.length; i++) {
			var p = queue[i]
			var desired = i*150
			G_objPlanes[p.plane].sequence = i
			G_objPlanes[p.plane].dist = p.dist
			G_objPlanes[p.plane].desired = desired
			G_objPlanes[p.plane].firstDist = queue[0].dist
			if (p.dist < 50) {
				if (G_objPlanes[p.plane]['leg'] == 'initial') {
					routePlane(p.plane + ' c 3 x s 300 c ' + G_objPlanes[p.plane]['approach'])
					G_objPlanes[p.plane]['leg'] = 'approach'
				} else {
					routePlane(p.plane + ' c 2 x s 240 c ' + G_objPlanes[p.plane]['final'])
					G_objPlanes[p.plane]['leg'] = 'final'
				}
			} else if (p.dist - queue[0].dist - desired > 50) {
				if (G_objPlanes[p.plane][10] != 400) {
					routePlane(p.plane + ' s 400')
				}
			} else if (p.dist - queue[0].dist - desired < -50) {
				if (G_objPlanes[p.plane][10] != 160) {
					routePlane(p.plane + ' s 160')
				}
			} else {
				if (G_objPlanes[p.plane][10] != 300) {
					routePlane(p.plane + ' s 300')
				}
			}
		}
	}
}

render = function() {
	d3.select('#canvas').select('svg').remove()
	svg = d3.select('#canvas').append('svg')
		.attr('width', window.innerWidth)
		.attr('height', window.innerHeight)
}

render()

colorscale = d3.scaleOrdinal(d3.schemecategory10)

update = function() {
	// convert planes dict into list
	data = []
	Object.keys(G_objPlanes).forEach(function(plane) {
		var out = G_objPlanes[plane]
		out.name = plane
		data.push(out)
	})

	var planes = self.svg.selectAll('g')
		.data(data, function(d) { return d.name })

	// apply updates
	planes.attr('transform', function(d) { return 'translate(' + (d[2]+24) + ',' + (d[3]+62) + ')' })
	// planes.selectAll('circle')
	// 	.style('fill', function(d) { return d[10]==300 ? 'blue' : d[10]==400 ? 'green' : d[10]==160 ? 'red' : 'black' })
	planes.selectAll('line')
		.attr('x1', function(d) { return 0 })
		.attr('y1', function(d) { return 0 })
		.attr('x2', function(d) { return !!d.target ? d.target[0] - d[2]-24 : 0 })
		.attr('y2', function(d) { return !!d.target ? d.target[1] - d[3]-62 : 0 })
	// planes.selectAll('text')
	// 	.text(function(d) { return !!d['leg'] && d['leg']!='landing' ? d.sequence + ' navdst: ' + Math.round(d.dist) + '  des: ' + d.desired + ' act: ' + Math.round(d.dist-d.firstDist) : '' })

	// create new objects
	planes.enter()
		.append('g')
		.attr('class', 'plane')
		.attr('transform', function(d) { return 'translate(' + (d[2]+24) + ',' + (d[3]+62) + ')' })
		.each(function(d) {
			// d3.select(this)
			// 	.append('circle')
			// 	.attr('cx', '0')
			// 	.attr('cy', '0')
			// 	.attr('r', 7)
			d3.select(this)
				.append('line')
				.attr('x1', '0')
				.attr('x2', '0')
				.attr('y1', '0')
				.attr('y2', '0')
				.style('stroke', 'black')
			d3.select(this)
				.append('text')
				.attr('x', '15')
				.attr('y', '0')
				.style('stroke', 'black')

		})

	planes.exit().remove()


	var points = self.svg.selectAll('#highlight')
		.data(highlightPoints, function(d) { return d.uid })

	points.enter()
		.append('circle')
		.attr('id', 'highlight')
		.attr('cx', '0')
		.attr('cy', '0')
		.attr('r', 0)

	points
		.attr('fill', function(d) { return d.fill })
		.attr('cx', function(d) { return d.x })
		.attr('cy', function(d) { return d.y })
		.attr('r', function(d) { return d.r })

	points.exit().remove()


	var lines = self.svg.selectAll('#line')
		.data(highlightLines)

	lines.enter()
		.append('line')
		.attr('id', 'line')
		.style('stroke', 'gray')

	lines
		.attr('x1', function(d) { return d.x1 })
		.attr('y1', function(d) { return d.y1 })
		.attr('x2', function(d) { return d.x2 })
		.attr('y2', function(d) { return d.y2 })

	lines.exit().remove()
}


flowInterval = setInterval(checkFlow, 10000)
departureInterval = setInterval(checkDepartures, 1000)
arrivalInterval = setInterval(checkArrivals, 1000)
spaceInterval = setInterval(spacePlanes2, 1000)
updateInterval = setInterval(update, 200)


// solve((cos(a)-cos(t))*(y0-y1-d*sin(t))=(sin(a)-sin(t))*(x1-x0-d*cos(t)),a)