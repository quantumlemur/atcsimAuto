

incomingSpacing = 150
minLandingSpacing = 50



if (document.title == 'Atlanta Hartsfield-Jackson Intl.') {
	runwayNE = '8L'
	runwaySE = '9R'
	runwayNW = '26R'
	runwaySW = '27L'
} else if (document.title == 'Chicago O\'Hare Intl.') {
	runwayNE = '9L'
	runwaySE = '10R'
	runwayNW = '27R'
	runwaySW = '28L'
}


function dynamicallyLoadScript(url) {
    var script = document.createElement("script"); // Make a script DOM node
    script.src = url; // Set it's src to the provided URL
    document.head.appendChild(script); // Add it to the end of the head section of the page (could change 'head' to 'body' to add it to the end of the body section instead)
}

dynamicallyLoadScript('https://d3js.org/d3.v4.min.js')
dynamicallyLoadScript('https://d3js.org/d3-scale.v1.min.js')


try {
	clearInterval(accelerate)
	clearInterval(departureInterval)
	clearInterval(arrivalInterval) 
	clearInterval(spaceInterval) 
	clearInterval(updateInterval)
} catch(err) {

}

navcoords = {}
eastFlow = intWind<180


northDownwindIndex = -1
southDownwindIndex = -1
finalIndex = -1

calcLines = function() {
	let panelWidth = document.getElementsByClassName('controlpanel')[0].clientWidth

	minX = 0
	maxX = window.innerWidth - panelWidth

	lineX = maxX / 2
	midY = window.innerHeight / 2
	northY = midY * .85
	southY = midY * 1.15

	maxY = window.innerHeight * 0.98
	minY = window.innerHeight * 0.02

	navs = {
		NORTHDOWNWIND: ['NORTHDOWNWIND', 2, eastFlow?lineX/2:lineX*1.5, northY],
		SOUTHDOWNWIND: ['SOUTHDOWNWIND', 2, eastFlow?lineX/2:lineX*1.5, southY],
		FINAL: ['FINAL', 2, lineX, midY],
	}

	if (northDownwindIndex == -1 || southDownwindIndex == -1 || finalIndex == -1) {
		for (let i=0; i<G_arrNavObjects.length; i++) {
			if (G_arrNavObjects[i][0] == 'NORTHDOWNWIND') {
				northDownwindIndex = i
			} else if (G_arrNavObjects[i][0] == 'SOUTHDOWNWIND') {
				southDownwindIndex = i
			} else if (G_arrNavObjects[i][0] == 'FINAL') {
				finalIndex = i
			}
		}
	}

	if (northDownwindIndex == -1) {
		northDownwindIndex = G_arrNavObjects.push(navs.NORTHDOWNWIND) - 1
	} else {
		G_arrNavObjects[northDownwindIndex] = navs.NORTHDOWNWIND
	}

	if (southDownwindIndex == -1) {
		southDownwindIndex = G_arrNavObjects.push(navs.SOUTHDOWNWIND) - 1
	} else {
		G_arrNavObjects[southDownwindIndex] = navs.SOUTHDOWNWIND
	}

	if (finalIndex == -1) {
		finalIndex = G_arrNavObjects.push(navs.FINAL) - 1
	} else {
		G_arrNavObjects[finalIndex] = navs.FINAL
	}
}


calcLines()


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

	// if nobody's waiting, then send one to line up and wait
	planes.forEach(function(plane) {
		if (waitingPlane == '') {
			var p = G_objPlanes[plane]
			if(!p['status'] && !p['runway'] && p[16] == 'D') {
				p['status'] = 'waiting'
				waitingPlane = plane
				routePlane(plane + ' c 28 c ' + (eastFlow?'090':'270') + ' w')
				return
			}
		}
	})

	// if nobody's taking off, then tell the waiting plane to take off
	if ((takingOffPlane == '' || G_objPlanes[takingOffPlane][6]>100) && waitingPlane != '') {
		takingOffPlane = waitingPlane
		waitingPlane = ''
		G_objPlanes[takingOffPlane]['status'] = 'taking off'
		routePlane(takingOffPlane + ' t')
	}

	// if the taking off plane is above the ground, make him hurry up
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16] == 'T' && p[4] > intFieldElev) {
			setAltitude(plane, 25)
			setSpeed(plane, 600)
		}
	})

	// if the taking off plane is above 3000ft, then route him
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16] == 'T' && p[4] > 6000) {
			p['status'] = 'en route'
			var req = G_arrNavObjects[p[13]][0]
			if (p[11] != req) {
				routePlane(plane + ' c ' + req)
			}
		}
	})
}


checkFlow = function() {
	if ((!eastFlow && intWind<150 && intWind>30) || (eastFlow && intWind>210 && intWind<330)) {
		eastFlow = !eastFlow
		calcLines()

		var planes = Object.keys(G_objPlanes)
		planes.forEach(function(plane) {
			if (G_objPlanes[plane].leg != 'landing') {
				delete G_objPlanes[plane].runway
			}
		})
	}
}


checkArrivals = function() {
	var planes = Object.keys(G_objPlanes)
	var runN = eastFlow ? runwayNE : runwayNW
	var runS = eastFlow ? runwaySE : runwaySW

	// route the unrouted planes
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16] == 'A' && !p['runway']) {
			// if we're north of the final waypoint
			if (p[3]+62 < midY) {
				p['runway'] = runN
				p['north'] = true
			} else {
				p['runway'] = runS
				p['north'] = false
			}
			p['leg'] = 'initial'
			p.high = true
		}
	})

	// if we're on final and pointed towards our heading, try to land
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16]=='A' && p[11]=='FINAL' && p[5]==p[8] && p[9]>1999) {
			routePlane(plane + ' l ' + p['runway'])
			p.leg = 'landing'
			delete p.sequence
		}
	})
}


highlightLines = []


setWaypoint = function(plane, x, y) {
	var p = G_objPlanes[plane]
	if (!!p.waypoint) {
		p.waypoint[2] = x
		p.waypoint[3] = y
	} else {
		var temp = G_arrNavObjects.push([plane, 2, x, y])
		p.waypoint = G_arrNavObjects[temp-1]
	}
	if (p[11] != plane) {
		routePlane(plane + ' c ' + plane)
	}
}

setAltitude = function(plane, alt) {
	var p = G_objPlanes[plane]
	if (p[9] != alt*1000) {
		routePlane(plane + ' c ' + alt + ' x')
	}
}

setSpeed= function(plane, speed) {
	var p = G_objPlanes[plane]
	if (p[10] != speed) {
		routePlane(plane + ' s ' + speed)
	}
}

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
			if (p.leg == 'queue' || p.leg == 'initial') {
				if (Math.min(Math.sqrt(Math.pow(p[2]+24-lineX,2) + Math.pow(p[3]+62-northY,2)), Math.sqrt(Math.pow(p[2]+24-lineX,2) + Math.pow(p[3]+62-southY,2))) < 50) {
					p.leg = 'downwind'
					routePlane(plane + ' c ' + (p.north?'NORTHDOWNWIND':'SOUTHDOWNWIND'))
					setSpeed(plane, 240)
					setAltitude(plane, p.high ? 4 : 3)
				} else {
					if (Math.abs(p[2]+24 - lineX) < 20) { // if we're close to the vertical queue line
						p.leg = 'queue'
						setWaypoint(plane, lineX, p.north ? northY : southY)
					} 
					// if we're north
					if (p.north) {
						// var waypoint = currentFlow=='e' ? finalEN : finalWN
						var dist = Math.sqrt(Math.pow(p[2]+24-lineX,2) + Math.pow(p[3]+62-northY,2))
						queueN.push({'plane': plane, 'dist': dist})
					} else {
						// var waypoint = currentFlow=='e' ? finalES : finalWS
						var dist = Math.sqrt(Math.pow(p[2]+24-lineX,2) + Math.pow(p[3]+62-southY,2))
						queueS.push({'plane': plane, 'dist': dist})
					}
				}
			} else if (p.leg == 'downwind') {
				if (p[2]<lineX*.5 || p[2]>lineX*1.5) {
					p.leg = 'final'
					routePlane(plane + ' c FINAL')
					setAltitude(plane, p.high ? 3 : 2)
				}
			}
		}
	})
	queueN.sort(function(a,b) { return a.dist - b.dist })
	queueS.sort(function(a,b) { return a.dist - b.dist })

	highlightLines = []

	// NORTH
	if (queueN.length > 0) {
		var frontPathLength = queueN[0].dist
		for (var i=0; i<queueN.length; i++) {
			var p = G_objPlanes[queueN[i].plane]
			p.sequence = i
			var x1 = p[2] + 24
			var y1 = p[3] + 62
			var x0 = lineX
			var y0 = northY
			var desiredPathLength = frontPathLength + i*incomingSpacing
			var diff = 0
			var prevDiff = 9999999
			var hasDecreased = false
			var xi = lineX
			var yi = northY
			var dist1 = 0
			var dist2 = 0
			var pathLength = 0
			if (p.leg == 'initial') {
				for (var y=northY; y>minY+100; y-=10) {
					yi = y
					dist1 = Math.sqrt(Math.pow(x0-xi,2) + Math.pow(y0-yi,2))
					dist2 = Math.sqrt(Math.pow(x1-xi,2) + Math.pow(y1-yi,2))
					pathLength = dist1 + dist2
					diff = pathLength - desiredPathLength
					if (Math.abs(diff) > prevDiff) {
						break
					}
					prevDiff = Math.abs(diff)
				}
				setWaypoint(queueN[i].plane, xi, yi)
			} else {
				dist1 = 0
				dist2 = Math.sqrt(Math.pow(x1-xi,2) + Math.pow(y1-yi,2))
				pathLength = dist1 + dist2
				diff = pathLength - desiredPathLength
			}
			// store data with the plane
			p.diff = diff
			p.dist1 = dist1
			p.dist2 = dist2
			p.pathLength = pathLength
			p.desiredPathLength = desiredPathLength
			// adjust the incoming speeds for spacing
			if (diff > 50) {
				setSpeed(queueN[i].plane, 450)
			} else if (diff < -50) {
				setSpeed(queueN[i].plane, 160)
			} else {
				setSpeed(queueN[i].plane, 300)
			}
			// stagger the altitudes
			if (i>0) {
				var prevHigh = G_objPlanes[queueN[i-1].plane].high
				setAltitude(queueN[i].plane, prevHigh ? 5 : 6)
				G_objPlanes[queueN[i].plane].high = !prevHigh
			}
		}
	}


	// SOUTH
	if (queueS.length > 0) {
		var frontPathLength = queueS[0].dist
		for (var i=0; i<queueS.length; i++) {
			var p = G_objPlanes[queueS[i].plane]
			p.sequence = i
			var x1 = p[2] + 24
			var y1 = p[3] + 62
			var x0 = lineX
			var y0 = southY
			var desiredPathLength = frontPathLength + i*incomingSpacing
			var diff = 0
			var prevDiff = 9999999
			var hasDecreased = false
			var xi = lineX
			var yi = southY
			var dist1 = 0
			var dist2 = 0
			var pathLength = 0
			if (p.leg == 'initial') {
				for (var y=southY; y<maxY-100; y+=10) {
					yi = y
					dist1 = Math.sqrt(Math.pow(x0-xi,2) + Math.pow(y0-yi,2))
					dist2 = Math.sqrt(Math.pow(x1-xi,2) + Math.pow(y1-yi,2))
					pathLength = dist1 + dist2
					diff = pathLength - desiredPathLength
					if (Math.abs(diff) > prevDiff) {
						break
					}
					prevDiff = Math.abs(diff)
				}
				setWaypoint(queueS[i].plane, xi, yi)
			} else {
				dist1 = 0
				dist2 = Math.sqrt(Math.pow(x1-xi,2) + Math.pow(y1-yi,2))
				pathLength = dist1 + dist2
				diff = pathLength - desiredPathLength
			}
			// store data with the plane
			p.diff = diff
			p.dist1 = dist1
			p.dist2 = dist2
			p.pathLength = pathLength
			p.desiredPathLength = desiredPathLength
			// adjust the incoming speeds for spacing
			if (diff > 50) {
				setSpeed(queueS[i].plane, 450)
			} else if (diff < -50) {
				setSpeed(queueS[i].plane, 160)
			} else {
				setSpeed(queueS[i].plane, 300)
			}
			// stagger the altitudes
			if (i>0) {
				var prevHigh = G_objPlanes[queueS[i-1].plane].high
				setAltitude(queueS[i].plane, prevHigh ? 5 : 6)
				G_objPlanes[queueS[i].plane].high = !prevHigh
			}
		}
	}

	// now space the places that are on the downwind leg
	var waypoints = ['NORTHDOWNWIND', 'SOUTHDOWNWIND']
	for (var w=0; w<waypoints.length; w++) {
		var waypoint = waypoints[w]
		var wx = navs[waypoint][2]
		var wy = navs[waypoint][3]
		var queue = []
		// pull out the planes flying to my waypoint, and calculate their distance
		planes.forEach(function(plane) {
			var p = G_objPlanes[plane]
			if (p[11] == waypoint) {
				var dist = Math.sqrt(Math.pow(p[2]+24-wx,2) + Math.pow(p[3]+62-wy,2))
				queue.push({'plane': plane, 'dist': dist})
			}
		})
		// sort them according to their distance
		queue.sort(function(a,b) {
			return a.dist - b.dist
		})

		for (var i=0; i<queue.length; i++) {
			var p = queue[i]
			var desired = i*incomingSpacing
			var diff = p.dist - queue[0].dist - desired
			G_objPlanes[p.plane].sequence = i
			G_objPlanes[p.plane].dist = p.dist
			G_objPlanes[p.plane].desired = desired
			G_objPlanes[p.plane].firstDist = queue[0].dist
			G_objPlanes[p.plane].diff = diff
			if (diff > 50) {
				setSpeed(p.plane, 300)
			} else if (diff < -50) {
				setSpeed(p.plane, 160)
			} else {
				setSpeed(p.plane, 240)
			}
			// stagger the altitudes
			if (i>0) {
				var prevHigh = G_objPlanes[queue[i-1].plane].high
				setAltitude(queue[i].plane, prevHigh ? 3 : 4)
				G_objPlanes[queue[i].plane].high = !prevHigh
			}
		}

	}

	// now monitor the landing planes for spacing
	var waypoints = [runwayNE, runwayNW, runwaySE, runwaySW]
	for (var w=0; w<waypoints.length; w++) {
		let waypoint = waypoints[w]
		var wx = navs.FINAL[2]
		var wy = navs.FINAL[3]
		var queue = []
		// pull out the planes flying to my waypoint, and calculate their distance
		planes.forEach(function(plane) {
			var p = G_objPlanes[plane]
			if (p[11] == waypoint) {
				var dist = Math.sqrt(Math.pow(p[2]+24-wx,2) + Math.pow(p[3]+62-wy,2))
				queue.push({'plane': plane, 'dist': dist})
			}
		})
		// sort them according to their distance
		queue.sort(function(a,b) {
			return a.dist - b.dist
		})

		// console.log(waypoint, queue)
		for (var i=1; i<queue.length; i++) {
			var p = queue[i]
			var diff = p.dist - queue[i-1].dist
			G_objPlanes[p.plane].sequence = i
			G_objPlanes[p.plane].diff = diff
			// abort landing if too close to the plane in front
			if (diff < minLandingSpacing) {
				routePlane(p.plane + ' a')
				delete G_objPlanes[p.plane]['runway'] // remove the 'final' tag so that the plane is rerouted as if new
				break
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
		.attr('x2', function(d) {
			if (d[16]=='A' ) {
				for (var i=0; i<G_arrNavObjects.length; i++) {
					if (G_arrNavObjects[i][0] == d[11]) {
						return G_arrNavObjects[i][2] - d[2]-24
					}
				}
			}
			return 0
		})
		.attr('y2', function(d) {
			if (d[16]=='A' ) {
				for (var i=0; i<G_arrNavObjects.length; i++) {
					if (G_arrNavObjects[i][0] == d[11]) {
						return G_arrNavObjects[i][3] - d[3]-62
					}
				}
			}
			return 0
		})
	planes.selectAll('text')
		.text(function(d) { return !!d.sequence ? '#' + d.sequence + ' | diff: ' + Math.round(-d.diff) : '' })

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
				.style('stroke', 'gray')
			d3.select(this)
				.append('text')
				.attr('x', '15')
				.attr('y', '0')
				.style('stroke', 'black')
				.style('fill', 'black')
				.style('font-size', '14px')

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




accelerate = setInterval(function() { intNewPlaneTimer = 1 }, 20000) 
flowInterval = setInterval(checkFlow, 10000)
departureInterval = setInterval(checkDepartures, 1000)
arrivalInterval = setInterval(checkArrivals, 1000)
spaceInterval = setInterval(spacePlanes2, 1000)
updateInterval = setInterval(update, 200)