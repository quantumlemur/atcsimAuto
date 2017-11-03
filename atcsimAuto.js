

incomingSpacing = 150 // target spacing between planes on approach
minLandingSpacing = 40 // what's the minimum spacing between us and the plane in front, after landing clearance?
takingOffPlaneSpeed = 110 // once the plane taking off in front has reached this speed, tell the next plane to start taking off
planesAtOnce = 200 // minimum number of planes on screen to maintain at any given time
innerPercentage = 0.12 // how far from the middle of the screen (the airport) do we want our waypoints?
outerPercentage = 0.08 // how far from the outside edge of the screen do we want our waypoints?
spacingPrecision = 25 // allowable deviation between the approach spacing
spacingSteps = 100 // number of steps on each leg to evaluate the spacing computation
waypointPrecision = 50 // how far away from each waypoint should we consider the plane to have arrived?
maxLandingAttempts = 100 // how many times should we try to land before we give up and put the plane back in sequence?
initialClearanceAltitude = 9 // altitude to expedite climb after takeoff, in thousands of feet
finalClearanceAltitude = 20 // final altitude for departing aircraft to climb to, in thousands of feet
abortAltitude = 11 // how high to climb in abort?












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

if (window.d3 == undefined) {
	dynamicallyLoadScript('https://d3js.org/d3.v4.min.js')
	dynamicallyLoadScript('https://d3js.org/d3-scale.v1.min.js')
}


try { clearInterval(accelerate) } catch (err) {}
try { clearInterval(flowInterval) } catch (err) {}
try { clearInterval(conflictInterval) } catch (err) {}
try { clearInterval(departureInterval) } catch (err) {}
try { clearInterval(spaceInterval)  } catch (err) {}
try { clearInterval(updateInterval) } catch (err) {}


highlightLines = []
northDownwindMaxAlt = 0
southDownwindMaxAlt = 0
northQueue = []
southQueue = []
navcoords = {}
eastFlow = intWind < 180

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

	runN = eastFlow ? runwayNE : runwayNW
	runS = eastFlow ? runwaySE : runwaySW

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
			[
				lineX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?3*outerPercentage*maxX:(1-3*outerPercentage)*maxX,
				eastFlow?3*outerPercentage*maxX:(1-3*outerPercentage)*maxX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX,
				eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX,
			],
			[
				lineX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?3*outerPercentage*maxX:(1-3*outerPercentage)*maxX,
				eastFlow?3*outerPercentage*maxX:(1-3*outerPercentage)*maxX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX,
				eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX,
			]
		]
	Yvertices = [
			[
				northY,
				northY,
				(outerPercentage*maxY+northY*2)/3,
				(outerPercentage*maxY+northY*2)/3,
				(outerPercentage*maxY*2+northY)/3,
				(outerPercentage*maxY*2+northY)/3,
				outerPercentage*maxY,
				outerPercentage*maxY,
				northY,
			],
			[
				southY, 
				southY,
				((1-outerPercentage)*maxY+southY*2)/3,
				((1-outerPercentage)*maxY+southY*2)/3,
				((1-outerPercentage)*maxY*2+southY)/3,
				((1-outerPercentage)*maxY*2+southY)/3,
				(1-outerPercentage)*maxY,
				(1-outerPercentage)*maxY,
				southY
			]
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

checkFlow = function() {
	if ((!eastFlow && intWind<150 && intWind>30) || (eastFlow && intWind>210 && intWind<330)) {
		eastFlow = !eastFlow
		calcLines()

		northQueue.reverse()
		southQueue.reverse()

		var planes = Object.keys(G_objPlanes)
		planes.forEach(function(plane) {
			G_objPlanes[plane].lastLeg = 999999999
			G_objPlanes[plane].lastSpacingStep = 999999999
		})
	}
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

setAltitude = function(plane, alt, expedite=false, deconflict=false) {
	var p = G_objPlanes[plane]
	if (!p.conflictCoolDown>0 || deconflict) { // if we're in conflict, only allow an altitude change from the de-conflictizer
		if (p[9] != alt*1000) {
			routePlane(plane + ' c ' + alt + (expedite?' x':''))
		}
	}
}

setSpeed = function(plane, speed) {
	var p = G_objPlanes[plane]
	if (p[10] != speed) {
		routePlane(plane + ' s ' + speed)
	}
}

setNav = function(plane, nav, direction='') {
	var p = G_objPlanes[plane]
	if (p[11] != nav) {
		routePlane(plane + ' c ' + nav + ' ' + direction)
	}
}


highlightPoints = []
for (var i=0; i<Xvertices[0].length; i++) {
	highlightPoints.push({
		fill: 'black',
		r: 5,
		x: Xvertices[0][i],
		y: Yvertices[0][i],
		timeCreated: 2509654423636,
		id: Math.random()
	})
}

checkDepartures = function() {
	var planes = Object.keys(G_objPlanes)
	var waitingPlane = ''
	var takingOffPlane = ''

	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p.leg == 'takingOff') {
			takingOffPlane = plane
		}
		if (p.leg == 'waiting') {
			waitingPlane = plane
		}
	})

	// if the taking off plane is above the ground, then set him on initial climb
	if (takingOffPlane) {
		var p = G_objPlanes[takingOffPlane]
		if (p[4] > intFieldElev) {
			p.leg = 'initialClimb'
			takingOffPlane = ''
		}
	}

	// if there's no plane currently taking off
	if ((!takingOffPlane || G_objPlanes[takingOffPlane][6]>takingOffPlaneSpeed)&& !!waitingPlane) {
		takingOffPlane = waitingPlane
		waitingPlane = ''
		var p = G_objPlanes[takingOffPlane]
		p.leg = 'takingOff'
		routePlane(takingOffPlane + ' t')
	}

	// if nobody's waiting, then send one to line up and wait
	if (!waitingPlane) {
		for (var i=0; i<planes.length; i++) {
			var p = G_objPlanes[planes[i]]
			if(!p.leg && !p['runway'] && p[16] == 'D') {
				p.leg = 'waiting'
				routePlane(planes[i] + ' c 24 c ' + (eastFlow?'090':'270') + ' w')
				break
			}
		}
	}
}


deConflict = function() {
	// pull out the list of planes in conflict and stagger them
	conflicts = []
	var planes = Object.keys(G_objPlanes)
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[18]) {
			conflicts.push(plane)
			p.conflictCoolDown = 20
		} else if (p.conflictCoolDown > 0) {
			p.conflictCoolDown -= 1
		}
	})
	conflicts.forEach(function(me) {
		for (var i=0; i<conflicts.length; i++) {
			var other = conflicts[i]
			if (other != me) {
				p1 = G_objPlanes[me]
				p2 = G_objPlanes[other]
				if ((Math.sqrt(Math.pow(p1[2]-p2[2], 2) + Math.pow(p1[3]-p2[3], 2)) < 75) && (Math.abs(p1[4]-p2[4]) < 1200)) {
					if(p1[4] < p2[4]) {
						setAltitude(me, Math.floor((p1[4]-1)/1000), true, true)
						setAltitude(other, Math.ceil((p2[4]+1)/1000), true, true)
					} else {
						setAltitude(me, Math.ceil((p1[4]+1)/1000), true, true)
						setAltitude(other, Math.floor((p2[4]-1)/1000), true, true)
					}
				}
			}
		}
	})
}


spacePlanes = function() {
	var planes = Object.keys(G_objPlanes)
	var planeIsRolling = false
	var planeIsWaiting = false

	// first, check if we've lost any planes (accidentally flew off screen)
	for (var i=0; i<northQueue.length; i++) {
		if (planes.indexOf(northQueue[i]) == -1) {
			northQueue.splice(i, 1)
		}
	}
	for (var i=0; i<southQueue.length; i++) {
		if (planes.indexOf(southQueue[i]) == -1) {
			southQueue.splice(i, 1)
		}
	}
	// make sure there aren't any duplicates in the queues...
	var i = 1
	while (i < northQueue.length) {
		if (northQueue[i] == northQueue[i-1]) {
			northQueue.splice(i, 1)
		} else {
			i += 1
		}
	}
	var i = 1
	while (i < southQueue.length) {
		if (southQueue[i] == southQueue[i-1]) {
			southQueue.splice(i, 1)
		} else {
			i += 1
		}
	}


	planes.forEach(function(plane) {
		var d = new Date()
		var t = d.getTime()
		if (highlightPoints.length>0 && t - highlightPoints[0].timeCreated > 10*1000) {
			highlightPoints.splice(0,1)
		}
		if (highlightLines.length>0 && t - highlightLines[0].timeCreated > 10*1000) {
			highlightLines.splice(0,1)
		}


		var p = G_objPlanes[plane]
		if (p.leg == 'approach') {
			var sequence = p.north ? northQueue.indexOf(plane) : southQueue.indexOf(plane)
			p.sequence = sequence
			// first find the length of the downwind leg
			if (sequence == 0) {
				var dist = Math.sqrt(Math.pow(p[2]+24 - lineX,2) + Math.pow(p[3]+62-(p.north?northY:southY),2))
				if (dist < waypointPrecision) {
					p.leg = 'downwind'
					p.runway = p.north ? runN : runS
					setNav(plane, (p.north?'NORTHDOWNWIND':'SOUTHDOWNWIND'))
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
				var desiredPathLength = incomingSpacing*sequence + (p.north?G_objPlanes[northQueue[0]].pathLength:G_objPlanes[southQueue[0]].pathLength)
				var diff = 0
				var prevDiff = 9999999
				var xi = 0 // intersection X
				var yi = 0 // intersection Y
				var dist0 = 0 // sum of previous legs
				var dist1 = 0 // distance along current leg
				var dist2 = 0 // distance from intersection to plane
				var leg = 0 // which leg are we on
				var spacingStep = 0 // which spacing step are we on

				var pathLength = 0
				for (leg=0; leg<Xvertices[p.north?0:1].length-1; leg++) {
					var Xstep = (Xvertices[p.north?0:1][leg+1] - Xvertices[p.north?0:1][leg]) / spacingSteps
					var Ystep = (Yvertices[p.north?0:1][leg+1] - Yvertices[p.north?0:1][leg]) / spacingSteps
					for (spacingStep=0; spacingStep<spacingSteps; spacingStep++) {
						xi = Xvertices[p.north?0:1][leg] + Xstep*spacingStep
						yi = Yvertices[p.north?0:1][leg] + Ystep*spacingStep
						dist1 = Math.sqrt(Math.pow(Xvertices[p.north?0:1][leg]-xi, 2) + Math.pow(Yvertices[p.north?0:1][leg]-yi, 2))
						dist2 = Math.sqrt(Math.pow(xi-xp, 2) + Math.pow(yi-yp, 2))
						pathLength = dist0 + dist1 + dist2
						diff = pathLength - desiredPathLength
						if (Math.abs(diff) > Math.abs(prevDiff)) { // if we've found a path long enough, but also don't make the path longer than it already is, to prevent planes backtracking (unless we need to go more than 500 units longer)
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

				// if we want to make the path longer, only allow it if it's within 30 degrees of where we're already supposed to be pointing
				if (leg >= p.lastLeg && spacingStep > p.lastSpacingStep) { // if we're trying to lengthen the path
					var theta = (Math.atan2(xi-xp, yp-yi) * 180 / Math.PI + 360) % 360
					var d = new Date()
					if ((p[5]-theta)%360 > 30 && (p[5]-theta)%360 < 330) { // if the angle is greater than 30 degrees from before
						// then set the point back to where it was
						leg = p.lastLeg
						spacingStep = p.lastSpacingStep
						console.log('rejected', p[5], Math.round(theta), plane, leg, p.lastLeg, spacingStep, p.lastSpacingStep)
						highlightPoints.push({id:Math.random(), fill:'black', x:xp, y:yp, r:7, timeCreated:d.getTime()})
						highlightPoints.push({id:Math.random(), fill:'red', x:xi, y:yi, r:7, timeCreated:d.getTime()})
						highlightPoints.push({id:Math.random(), fill:'blue', x:p.waypoint[2], y:p.waypoint[3], r:7, timeCreated:d.getTime()})
						highlightLines.push({id:Math.random(), x1:xp, y1:yp, x2:xi, y2:yi, timeCreated:d.getTime(), stroke:'red'})
						highlightLines.push({id:Math.random(), x1:xp, y1:yp, x2:p.waypoint[2], y2:p.waypoint[3], timeCreated:d.getTime(), stroke:'blue'})
						xi = p.waypoint[2]
						yi = p.waypoint[3]
						dist0 = p.dist0
						dist1 = p.dist1
						dist2 = Math.sqrt(Math.pow(xi-xp, 2) + Math.pow(yi-yp, 2))
						pathLength = dist0 + dist1 + dist2
						diff = pathLength - desiredPathLength
					} else {
						// console.log('accepted', p[5], theta, plane, leg, p.lastLeg, spacingStep, p.lastSpacingStep)
						highlightPoints.push({id:Math.random(), fill:'green', x:xp, y:yp, r:5, timeCreated:d.getTime()})
						highlightPoints.push({id:Math.random(), fill:'green', x:xi, y:yi, r:5, timeCreated:d.getTime()})
						highlightPoints.push({id:Math.random(), fill:'green', x:p.waypoint[2], y:p.waypoint[3], r:5, timeCreated:d.getTime()})
						highlightLines.push({id:Math.random(), x1:xp, y1:yp, x2:xi, y2:yi, timeCreated:d.getTime(), stroke:'black'})
						highlightLines.push({id:Math.random(), x1:xp, y1:yp, x2:p.waypoint[2], y2:p.waypoint[3], timeCreated:d.getTime(), stroke:'black'})
					}
				}
				p.lastLeg = leg
				p.lastSpacingStep = spacingStep
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
				p.alt = ((p.north?G_objPlanes[northQueue[sequence-1]].alt:G_objPlanes[southQueue[sequence-1]].alt) + 1) % 5
				setAltitude(plane, p.alt+6)
			}
		} else if (p.leg == 'downwind') {
			if (p[2]+24 < lineX/2 || p[2]+24 > lineX*1.5) {
				p.leg = 'final'
				p.landingAttempts = 0
				setAltitude(plane, 2)
				setNav(plane, 'FINAL')
			}
		} else if (p.leg == 'final') {
			// if we've finished our turn and haven't started our final descent yet, then rey to land
			if (p[5]==p[8] && p[9]>1999) {
				routePlane(plane + ' l ' + (p.north?runN:runS))
				p.leg = 'landing'
				p.landingAttempts += 1
				p.sequence = p.landingAttempts
				if (p.landingAttempts > maxLandingAttempts) {
					abort(plane)
				}
			}
		} else if (p.leg == 'takingOff') {
			if (p[4] > intFieldElev) {
				p.leg = 'initialClimb'
			}
		} else if (p.leg == 'initialClimb') {
			setAltitude(plane, initialClearanceAltitude, true)
			// if we're climbing and have reached clearance altitude, give final climb and waypoint clearance
			if (p[4] >= initialClearanceAltitude*1000) {
				p.leg = 'departure'
			}
		} else if (p.leg == 'departure') {
			setSpeed(plane, 600)
			setAltitude(plane, finalClearanceAltitude)
			setNav(plane, G_arrNavObjects[p[13]][0])
		} else if (p.leg == 'abort') {
			setNav(plane, 'ABORT')
			setSpeed(plane, 240)
			setAltitude(plane, abortAltitude + 5)
			if (p[4] >= abortAltitude*1000) {
				p.north = !p.north
				delete p.leg
			}
		} else if (!p.leg && p[16]=='A') { // if don't have a leg assigned but we're an arrival (haven't been routed), then insert us into the approach sequence
			// if we're north of the final waypoint
			if (p.north == undefined) {
				p.north = p[3]+62 < midY
			}
			if (northQueue.indexOf(plane) == -1 && southQueue.indexOf(plane) == -1) {
				if (p.north) {
					northQueue.push(plane)
				} else {
					southQueue.push(plane)
				}
			}
			p.alt = 0
			p.leg = 'approach'
		}
	})


	// monitor the queues, and if one is overflowing and the other isn't, then switch a plane
	if (northQueue.length > 0 && southQueue.length > 0) {
		var lastNorth = northQueue[northQueue.length - 1]
		var pN = G_objPlanes[lastNorth]
		var lastSouth = southQueue[southQueue.length - 1]
		var pS = G_objPlanes[lastSouth]
		if (pN[10] == 160 && pS[10] != 160) {
			abort(lastNorth)
		} else 	if (pN[10] == 160 && pN[10] != 160) {
			abort(lastSouth)
		}
	}



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
			G_objPlanes[p.plane].sequence = i
			G_objPlanes[p.plane].diff = diff
			// abort landing if too close to the plane in front
			if (diff < minLandingSpacing) {
				abort(p.plane)
				break
			}
		}
	}
}



abort = function(plane) {
	plane = plane.toUpperCase()
	if (!!G_objPlanes[plane]) {
		var p = G_objPlanes[plane]
		var index = northQueue.indexOf(plane)
		if (index != -1) {
			northQueue.splice(index, 1)
		}
		index = southQueue.indexOf(plane)
		if (index != -1) {
			southQueue.splice(index, 1)
		}
		p.leg = 'abort'
		delete p.sequence
		delete p.lastLeg
		delete p.lastSpacingStep
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

	var d = new Date()
	var t = d.getTime()

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
		.text(function(d) { return d.sequence>-1 ? d.sequence + ' | path: ' + Math.round(d.pathLength) + ' | des: ' + Math.round(d.desiredPathLength) : '' }) // + ' | dist0: ' + Math.round(d.dist0) + ' | dist1: ' + Math.round(d.dist1) + ' | dist2: ' + Math.round(d.dist2): '' })

	// create new objects
	planes.enter()
		.append('g')
		.attr('class', 'plane')
		.attr('transform', function(d) { return 'translate(' + (d[2]+24) + ',' + (d[3]+62) + ')' })
		.on('click', function() { console.log('aaaah real monsters') })
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
		.data(highlightPoints, function(d) { return d.id })

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
		.attr('opacity', function(d) { return 1 - (t-d.timeCreated)/10000})

	points.exit().remove()


	var lines = self.svg.selectAll('#line')
		.data(highlightLines, function(d) { return d.id })

	lines.enter()
		.append('line')
		.attr('id', 'line')
		.style('stroke', function(d) { return !!d.stroke ? d.stroke : 'black' })

	lines
		.attr('x1', function(d) { return d.x1 })
		.attr('y1', function(d) { return d.y1 })
		.attr('x2', function(d) { return d.x2 })
		.attr('y2', function(d) { return d.y2 })
		.attr('opacity', function(d) { return 1 - (t-d.timeCreated)/10000})

	lines.exit().remove()
}




accelerate = setInterval(function() { if (intPlanesOnScreen < planesAtOnce) { intNewPlaneTimer = 0 } }, 1000) 
flowInterval = setInterval(checkFlow, 10000)
conflictInterval = setInterval(deConflict, 1000)
departureInterval = setInterval(checkDepartures, 1000)
spaceInterval = setInterval(spacePlanes, 5000)
updateInterval = setInterval(update, 200)