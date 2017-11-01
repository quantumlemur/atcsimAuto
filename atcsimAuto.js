

incomingSpacing = 130 // target spacing between planes on approach
minLandingSpacing = 40 // what's the minimum spacing between us and the plane in front, after landing clearance?
takingOffPlaneSpeed = 100 // once the plane taking off in front has reached this speed, tell the next plane to start taking off
planesAtOnce = 60 // minimum number of planes on screen to maintain at any given time
innerPercentage = 0.12 // how far from the middle of the screen (the airport) do we want our waypoints?
outerPercentage = 0.1 // how far from the outside edge of the screen do we want our waypoints?
spacingPrecision = 20 // allowable deviation between the approach spacing
spacingSteps = 100 // number of steps on each leg to evaluate the spacing computation
waypointPrecision = 50 // how far away from each waypoint should we consider the plane to have arrived?
maxLandingAttempts = 100 // how many times should we try to land before we give up and put the plane back in sequence?





highlightLines = []

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

northDownwindMaxAlt = 0
southDownwindMaxAlt = 0
northQueue = []
southQueue = []
navcoords = {}
eastFlow = intWind<180

waypointIndexes = [-1, -1, -1, -1]




calcLines = function() {
	// first, reset the number of planes in sequence
	var planes = Object.keys(G_objPlanes)
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p.leg == 'approach' && p.north) {
			northQueue.push(plane)
		} else if (p.leg == 'approach' && !p.north) {
			southQueue.push(plane)
		}
	})

	let panelWidth = document.getElementsByClassName('controlpanel')[0].clientWidth

	minX = 0
	maxX = window.innerWidth - panelWidth

	lineX = maxX / 2
	midY = window.innerHeight / 2
	northY = midY * (1 - innerPercentage)
	southY = midY * (1 + innerPercentage)

	maxY = window.innerHeight
	minY = 0

	// approach path vertices.  list of norths first, then souths
	Xvertices = [
			[lineX, eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX, eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX, eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX, eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX],
			[lineX, eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX, eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX, eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX, eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX]
		]
	Yvertices = [
			[northY, northY, outerPercentage*maxY, outerPercentage*maxY, northY],
			[southY, southY, (1-outerPercentage)*maxY, (1-outerPercentage)*maxY, southY]
		]

	waypointList = [
		['NORTHDOWNWIND', 2, eastFlow?lineX/2:lineX*1.5, northY],
		['SOUTHDOWNWIND', 2, eastFlow?lineX/2:lineX*1.5, southY],
		['ABORT', 2, eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX, midY],
		['FINAL', 2, lineX, midY],
	]

	// find the indexes, if we haven't already
	for (var i=0; i<waypointList.length; i++) {
		if (waypointIndexes[i] == -1) {
			for (var j=0; j<G_arrNavObjects.length; j++) {
				if (G_arrNavObjects[j][0] == waypointList[i][0]) {
					waypointIndexes[i] = j
					break
				}
			}
		}
	}

	for (var i=0; i<waypointList.length; i++) {
		if (waypointIndexes[i] == -1) {
			waypointIndexes[i] = G_arrNavObjects.push(waypointList[i]) - 1
		} else {
			G_arrNavObjects[waypointIndexes[i]] = waypointList[i]
		}
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
				routePlane(plane + ' c 24 c ' + (eastFlow?'090':'270') + ' w')
				return
			}
		}
	})

	// if nobody's taking off, then tell the waiting plane to take off
	if ((takingOffPlane == '' || G_objPlanes[takingOffPlane][6]>takingOffPlaneSpeed) && waitingPlane != '') {
		takingOffPlane = waitingPlane
		waitingPlane = ''
		G_objPlanes[takingOffPlane]['status'] = 'taking off'
		routePlane(takingOffPlane + ' t')
	}

	// if the taking off plane is above the ground, make him hurry up
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16] == 'T' && p[4] > intFieldElev) {
			setAltitude(plane, 25, true)
			setSpeed(plane, 600)
		}
	})

	// if the taking off plane is above 10000ft, then route him
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16] == 'T' && p[4] > 10000) {
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
		if (p[16] == 'A' && !(p.sequence>-1)) {
			// if we're north of the final waypoint
			let north = p[3]+62 < midY
			if (p.abort) {
				north = !p.north
				delete p.abort
			}
			if (north) {
				p['runway'] = runN
				p['north'] = true
				northQueue.push(plane)
			} else {
				p['runway'] = runS
				p['north'] = false
				southQueue.push(plane)
			}
			p.leg = 'approach'
			p.high = true
		}
	})

	// if we're on final and pointed towards our heading, try to land
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16]=='A' && p[11]=='FINAL' && p[5]==p[8] && p[9]>1999) {
			routePlane(plane + ' l ' + (p.north?runN:runS))
			p.leg = 'landing'
			p.landingAttempts += 1
			p.sequence = p.landingAttempts
			if (p.landingAttempts > maxLandingAttempts) {
				abort(plane)
			}
		}
	})
}


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

setAltitude = function(plane, alt, expedite=false) {
	var p = G_objPlanes[plane]
	if (p[9] != alt*1000) {
		routePlane(plane + ' c ' + alt + (expedite?' x':''))
	}
}

setSpeed= function(plane, speed) {
	var p = G_objPlanes[plane]
	if (p[10] != speed) {
		routePlane(plane + ' s ' + speed)
	}
}



highlightPoints = []
for (var i=0; i<Xvertices[0].length; i++) {
	highlightPoints.push({
		fill: 'black',
		r: 5,
		x: Xvertices[0][i],
		y: Yvertices[0][i]
	})
}


decrementPlaneSequences = function(north) {
	var planes = Object.keys(G_objPlanes)
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p.leg == 'approach' && p.north == north) {
			p.sequence -= 1
		}
	})
	if (north) {
		numNorthSequencePlanes -= 1
	} else {
		numSouthSequencePlanes -= 1
	}
}

spacePlanes2 = function() {
	var planes = Object.keys(G_objPlanes)

	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16]=='A') {
			if (p.leg == 'approach') {
				var sequence = p.north ? northQueue.indexOf(plane) : southQueue.indexOf(plane)
				p.sequence = sequence
				// first find the length of the downwind leg
				if (sequence == 0) {
					var dist = Math.sqrt(Math.pow(p[2]+24 - lineX,2) + Math.pow(p[3]+62-(p.north?northY:southY),2))
					if (dist < waypointPrecision) {
						p.leg = 'downwind'
						routePlane(plane + ' c ' + (p.north?'NORTHDOWNWIND':'SOUTHDOWNWIND'))
						if (p.north) {
							northQueue.splice(0, 1)
						} else {
							southQueue.splice(0, 1)
						}
					} else {
						p.pathLength = dist
						p.desiredPathLength = dist
						setWaypoint(plane, lineX, p.north?northY:southY)
						setAltitude(plane, sequence+1+(p.north?northDownwindMaxAlt:southDownwindMaxAlt))
					}
				} else {
					var xp = p[2] + 24 // plane X
					var yp = p[3] + 62 // plane Y
					var desiredPathLength = incomingSpacing + (p.north?G_objPlanes[northQueue[sequence-1]].pathLength:G_objPlanes[southQueue[sequence-1]].pathLength)
					var diff = 0
					var prevDiff = 9999999
					var xi = 0 // intersection X
					var yi = 0 // intersection Y
					var dist0 = 0 // sum of previous legs
					var dist1 = 0 // distance along current leg
					var dist2 = 0 // distance from intersection to plane

					var pathLength = 0
					for (var leg=0; leg<Xvertices[p.north?0:1].length-1; leg++) {
						var Xstep = (Xvertices[p.north?0:1][leg+1] - Xvertices[p.north?0:1][leg]) / spacingSteps
						var Ystep = (Yvertices[p.north?0:1][leg+1] - Yvertices[p.north?0:1][leg]) / spacingSteps
						for (var spacingStep=0; spacingStep<spacingSteps; spacingStep++) {
							xi = Xvertices[p.north?0:1][leg] + Xstep*spacingStep
							yi = Yvertices[p.north?0:1][leg] + Ystep*spacingStep
							dist1 = Math.sqrt(Math.pow(Xvertices[p.north?0:1][leg]-xi, 2) + Math.pow(Yvertices[p.north?0:1][leg]-yi, 2))
							dist2 = Math.sqrt(Math.pow(xi-xp, 2) + Math.pow(yi-yp, 2))
							pathLength = dist0 + dist1 + dist2
							diff = pathLength - desiredPathLength
							if (Math.abs(diff) > Math.abs(prevDiff)) {
								break
							}
							prevDiff = diff
						}
						// if we get here, we've either gotten to the end of the current leg or we've found the correct length
						if (Math.abs(diff) > Math.abs(prevDiff)) { // if we've found the correct length
							break
						} else {
							dist0 += Math.sqrt(Math.pow(Xvertices[p.north?0:1][leg]-Xvertices[p.north?0:1][leg+1], 2) + Math.pow(Yvertices[p.north?0:1][leg]-Yvertices[p.north?0:1][leg+1], 2))
						}
					}
					setWaypoint(plane, xi, yi)
					if (p.north) {
						previousNorthPathLength = pathLength
					} else {
						previousSouthPathLength = pathLength
					}
					// store data with the plane
					p.diff = diff
					p.dist0 = dist0
					p.dist1 = dist1
					p.dist2 = dist2
					p.pathLength = pathLength
					p.desiredPathLength = desiredPathLength
					// adjust the incoming speeds for spacing
					if (diff > spacingPrecision) {
						setSpeed(plane, 400)
					} else if (diff < -spacingPrecision) {
						setSpeed(plane, 160)
					} else {
						setSpeed(plane, 240)
					}
					// stagger the altitudes
					setAltitude(plane, sequence+1+(p.north?northDownwindMaxAlt:southDownwindMaxAlt))
				}
			} else if (p.leg == 'downwind') {
				if (eastFlow ? p[2]+24 < lineX/2 : p[2]+24 > lineX*1.5) {
					p.leg = 'final'
					p.landingAttempts = 0
					setAltitude(plane, 2)
					routePlane(plane + ' c FINAL')
				}

			}
		}
	})

	// now space the places that are on the downwind leg
	var waypoints = ['NORTHDOWNWIND', 'SOUTHDOWNWIND']
	for (var w=0; w<waypoints.length; w++) {
		var waypoint = waypoints[w]
		var wx = eastFlow ? lineX/2 : lineX*1.5
		var wy = waypoint=='NORTHDOWNWIND' ? northY : southY
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
			if (diff > spacingPrecision) {
				setSpeed(p.plane, 300)
			} else if (diff < -spacingPrecision) {
				setSpeed(p.plane, 160)
			} else {
				setSpeed(p.plane, 240)
			}
			// stagger the altitudes
			setAltitude(queue[i].plane, i+3)
		}

		if (waypoint == 'NORTHDOWNWIND') {
			northDownwindMaxAlt = queue.length + 2
		} else {
			southDownwindMaxAlt = queue.length + 2
		}

	}


	// now monitor the landing planes for spacing
	var waypoints = [runwayNE, runwayNW, runwaySE, runwaySW]
	for (var w=0; w<waypoints.length; w++) {
		let waypoint = waypoints[w]
		var wx = lineX
		var wy = midY
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
			// G_objPlanes[p.plane].sequence = i
			G_objPlanes[p.plane].diff = diff
			// abort landing if too close to the plane in front
			if (diff < minLandingSpacing) {
				abort(p.plane)
				break
			}
		}
	}


	// reroute the aborted planes once they're high enough
	var planes = Object.keys(G_objPlanes)
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p.abort) {
			if (p[9] != 10000) {
				routePlane(plane + ' a')
				routePlane(plane + ' c ' + eastFlow?'090':'270')
				routePlane(plane + ' c 10')
			}
			if (p[4] >= 10000) {
				delete p.sequence
				p.abort == false
			}
		}
	})
}


abort = function(plane) {
	plane = plane.toUpperCase()
	if (!!G_objPlanes[plane]) {
		routePlane(plane + ' c ABORT')
		G_objPlanes[plane].abort = true
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
		.text(function(d) { return d.sequence>-1 ? '#' + d.sequence + ' | path: ' + Math.round(d.pathLength) + ' | des: ' + Math.round(d.desiredPathLength) : '' }) // + ' | dist0: ' + Math.round(d.dist0) + ' | dist1: ' + Math.round(d.dist1) + ' | dist2: ' + Math.round(d.dist2): '' })

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
		.data(highlightPoints)

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




accelerate = setInterval(function() { if (intPlanesOnScreen < planesAtOnce) { intNewPlaneTimer = 0 } }, 1000) 
flowInterval = setInterval(checkFlow, 10000)
departureInterval = setInterval(checkDepartures, 1000)
arrivalInterval = setInterval(checkArrivals, 1000)
spaceInterval = setInterval(spacePlanes2, 1000)
updateInterval = setInterval(update, 1000)