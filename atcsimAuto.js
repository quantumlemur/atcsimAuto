

innerPercentage = 0.15 // how far from the middle of the screen (the airport) do we want our waypoints?
outerPercentage = 0.1 // how far from the outside edge of the screen do we want our waypoints?
planesAtOnce = 50 // minimum number of planes on screen to maintain at any given time

incomingSpacing = 150 // target spacing between planes on approach
minLandingSpacing = 30 // what's the minimum spacing between us and the plane in front, after landing clearance?
takingOffPlaneSpeed = 130 // once the plane taking off in front has reached this speed, tell the next plane to start taking off
spacingPrecision = 25 // allowable deviation between the approach spacing
spacingSteps = 100 // number of steps on each leg to evaluate the spacing computation
waypointPrecision = 50 // how far away from each waypoint should we consider the plane to have arrived?
maxLandingAttempts = 100 // how many times should we try to land before we give up and put the plane back in sequence?
initialClearanceAltitude = 10 // altitude to expedite climb after takeoff, in thousands of feet
finalClearanceAltitude = 20 // final altitude for departing aircraft to climb to, in thousands of feet
abortAltitude = 12 // how high to climb in abort?
conflictCoolDownTime = 5 // time in seconds to disallow normal altitude or heading commands after a conflict
numAltitudeSteps = 6 // number of discrete altitude steps on the approach path
simulationStepTime = 100 // time in ms between each simulation step












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
    let script = document.createElement("script"); // Make a script DOM node
    script.src = url; // Set its src to the provided URL
    document.head.appendChild(script); // Add it to the end of the head section of the page (could change 'head' to 'body' to add it to the end of the body section instead)
}

if (window.d3 == undefined) {
	dynamicallyLoadScript('https://d3js.org/d3.v4.min.js')
	dynamicallyLoadScript('https://d3js.org/d3-scale.v1.min.js')
}


try { clearInterval(addPlaneInterval) } catch (err) {}
try { clearInterval(flowInterval) } catch (err) {}
try { clearInterval(conflictInterval) } catch (err) {}
try { clearInterval(departureInterval) } catch (err) {}
try { clearInterval(spaceInterval)  } catch (err) {}
try { clearInterval(updateInterval) } catch (err) {}
try { clearInterval(intervalID); intervalID=null } catch (err) {}



highlightLines = []
highlightPoints = []
northDownwindMaxAlt = 0
southDownwindMaxAlt = 0
northQueue = []
southQueue = []
navcoords = {}
eastFlow = intWind < 180

waypointIndexes = [-1, -1, -1, -1]


calcLines = function() {
	highlightLines = []
	// first, reset the number of planes in sequence
	let planes = Object.keys(G_objPlanes)
	planes.forEach(function(plane) {
		let p = G_objPlanes[plane]
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
				eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX,
				eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX,
				eastFlow?2*outerPercentage*maxX:(1-2*outerPercentage)*maxX,
				lineX,
				eastFlow?(1-2*outerPercentage)*maxX:2*outerPercentage*maxX,
				eastFlow?(1-2*outerPercentage)*maxX:2*outerPercentage*maxX,
				eastFlow?2*outerPercentage*maxX:(1-2*outerPercentage)*maxX,
				eastFlow?2*outerPercentage*maxX:(1-2*outerPercentage)*maxX,
				lineX,
				eastFlow?(1-3*outerPercentage)*maxX:3*outerPercentage*maxX,
			],
			[
				lineX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX,
				eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX,
				eastFlow?outerPercentage*maxX:(1-outerPercentage)*maxX,
				eastFlow?2*outerPercentage*maxX:(1-2*outerPercentage)*maxX,
				lineX,
				eastFlow?(1-2*outerPercentage)*maxX:2*outerPercentage*maxX,
				eastFlow?(1-2*outerPercentage)*maxX:2*outerPercentage*maxX,
				eastFlow?2*outerPercentage*maxX:(1-2*outerPercentage)*maxX,
				eastFlow?2*outerPercentage*maxX:(1-2*outerPercentage)*maxX,
				lineX,
				eastFlow?(1-3*outerPercentage)*maxX:3*outerPercentage*maxX,
			]
		]
	Yvertices = [
			[
				northY,
				northY,
				outerPercentage*maxY,
				outerPercentage*maxY,
				northY,
				northY,
				(northY*3+outerPercentage*maxY)/4,
				(northY*3+outerPercentage*maxY)/4,
				(northY+outerPercentage*maxY*3)/4,
				(northY+outerPercentage*maxY*3)/4,
				(northY*3+outerPercentage*maxY)/4,
				(northY+outerPercentage*maxY)/2,
				(northY+outerPercentage*maxY)/2,
			],
			[
				southY, 
				southY,
				(1-outerPercentage)*maxY,
				(1-outerPercentage)*maxY,
				southY,
				southY,
				((1-outerPercentage)*maxY+southY*3)/4,
				((1-outerPercentage)*maxY+southY*3)/4,
				((1-outerPercentage)*maxY*3+southY)/4,
				((1-outerPercentage)*maxY*3+southY)/4,
				((1-outerPercentage)*maxY+southY*3)/4,
				((1-outerPercentage)*maxY+southY)/2,
				((1-outerPercentage)*maxY+southY)/2,
			]
		]

	waypointList = [
		['NORTHDOWNWIND', 2, eastFlow?lineX/2:lineX*1.5, northY],
		['SOUTHDOWNWIND', 2, eastFlow?lineX/2:lineX*1.5, southY],
		['ABORT', 2, eastFlow?(1-outerPercentage)*maxX:outerPercentage*maxX, midY],
		['FINAL', 2, lineX, midY],
	]

	// find the indexes, if we haven't already
	for (let i=0; i<waypointList.length; i++) {
		if (waypointIndexes[i] == -1) {
			for (let j=0; j<G_arrNavObjects.length; j++) {
				if (G_arrNavObjects[j][0] == waypointList[i][0]) {
					waypointIndexes[i] = j
					break
				}
			}
		}
	}

	for (let i=0; i<waypointList.length; i++) {
		if (waypointIndexes[i] == -1) {
			waypointIndexes[i] = G_arrNavObjects.push(waypointList[i]) - 1
		} else {
			G_arrNavObjects[waypointIndexes[i]] = waypointList[i]
		}
	}

	for (let i=1; i<Xvertices[0].length; i++) {
		highlightLines.push({
			x1: Xvertices[0][i-1],
			y1: Yvertices[0][i-1],
			x2: Xvertices[0][i],
			y2: Yvertices[0][i],
			stroke: 'black',
			timeCreated: 2509654423636,
			id: Math.random()
		})
		highlightLines.push({
			x1: Xvertices[1][i-1],
			y1: Yvertices[1][i-1],
			x2: Xvertices[1][i],
			y2: Yvertices[1][i],
			stroke: 'black',
			timeCreated: 2509654423636,
			id: Math.random()
		})
	}
}


calcLines()


routePlane = function(routing) {
	// console.log(routing)
	document.getElementsByName('txtClearance')[0].value = routing
	fnParseInput()
}

checkFlow = function() {
	if ((!eastFlow && intWind<150 && intWind>30) || (eastFlow && intWind>210 && intWind<330)) {
		eastFlow = !eastFlow
		calcLines()

		// northQueue.reverse()
		// southQueue.reverse()

		// reset the last spacing steps, so they can be re-routed as needed
		let planes = Object.keys(G_objPlanes)
		planes.forEach(function(plane) {
			G_objPlanes[plane].lastLeg = 999999999
			G_objPlanes[plane].lastSpacingStep = 999999999
		})
	}
}

setWaypoint = function(plane, x, y, deconflict=true) {
	let p = G_objPlanes[plane]
	if (!p.conflictCoolDown>0 || deconflict) { // if we're in conflict, only allow an altitude change from the de-conflictizer
		if (!!p.waypoint) {
			p.waypoint[2] = x
			p.waypoint[3] = y
		} else {
			for (let i=0; i<G_arrNavObjects.length; i++) {
				if (G_arrNavObjects[i][0] == plane) {
					G_arrNavObjects[i] = [plane, 2, x, y]
					p.waypoint = G_arrNavObjects[i]
					break
				}
			}
			if (!p.waypoint) {
				let temp = G_arrNavObjects.push([plane, 2, x, y])
				p.waypoint = G_arrNavObjects[temp-1]
			}
		}
		if (p[11] != plane) {
			routePlane(plane + ' c ' + plane)
		}
	}
}

setHeading = function(plane, heading, deconflict=true) {
	let p = G_objPlanes[plane]
	if (!p.conflictCoolDown>0 || deconflict) { // if we're in conflict, only allow an altitude change from the de-conflictizer
		if (p[8] != heading) {
			routePlane(plane + ' c ' + ('000' + heading).substr(-3, 3))
		}
	}
}

setAltitude = function(plane, alt, expedite=false, deconflict=false) {
	let p = G_objPlanes[plane]
	if (!p.conflictCoolDown>0 || deconflict) { // if we're in conflict, only allow an altitude change from the de-conflictizer
		if (p[9] != alt*1000) {
			routePlane(plane + ' c ' + alt + (expedite?' x':''))
		}
	}
}

setSpeed = function(plane, speed) {
	let p = G_objPlanes[plane]
	if (p[10] != speed) {
		routePlane(plane + ' s ' + speed)
	}
}

setNav = function(plane, nav, direction='') {
	let p = G_objPlanes[plane]
	if (p[11] != nav) {
		routePlane(plane + ' c ' + nav + ' ' + direction)
	}
}

checkDepartures = function() {
	let planes = Object.keys(G_objPlanes)
	let waitingPlane = ''
	let takingOffPlane = ''

	planes.forEach(function(plane) {
		let p = G_objPlanes[plane]
		if (p.leg == 'takingOff') {
			takingOffPlane = plane
		}
		if (p.leg == 'waiting') {
			waitingPlane = plane
		}
	})

	// if the taking off plane is above the ground, then set him on initial climb
	if (takingOffPlane) {
		let p = G_objPlanes[takingOffPlane]
		if (p[4] > intFieldElev) {
			p.leg = 'initialClimb'
			takingOffPlane = ''
		}
	}

	// if there's no plane currently taking off
	if ((!takingOffPlane || G_objPlanes[takingOffPlane][6]>takingOffPlaneSpeed)&& !!waitingPlane) {
		takingOffPlane = waitingPlane
		waitingPlane = ''
		let p = G_objPlanes[takingOffPlane]
		p.leg = 'takingOff'
		routePlane(takingOffPlane + ' t')
	}

	// if nobody's waiting, then send one to line up and wait
	if (!waitingPlane) {
		for (let i=0; i<planes.length; i++) {
			let p = G_objPlanes[planes[i]]
			if(!p.leg && !p['runway'] && p[16] == 'D') {
				p.leg = 'waiting'
				p.takeoffHeading = eastFlow?'090':'270'
				routePlane(planes[i] + ' c 24 c ' + p.takeoffHeading + ' w')
				break
			}
		}
	}
}


deConflict = function() {
	let d = new Date()
	let t = d.getTime()
	// pull out the list of planes in conflict and stagger them
	conflicts = []
	let planes = Object.keys(G_objPlanes)
	planes.forEach(function(plane) {
		let p = G_objPlanes[plane]
		if (p[18]) {
			conflicts.push(plane)
			p.conflictCoolDown = conflictCoolDownTime
		} else if (p.conflictCoolDown > 0) {
			p.conflictCoolDown -= 1
		}
	})
	conflicts.forEach(function(me) {
		highlightPoints.push({id:Math.random(), fill:'red', x:G_objPlanes[me][2]+24, y:G_objPlanes[me][3]+62, r:7, timeCreated:t})
		for (let i=0; i<conflicts.length; i++) {
			let other = conflicts[i]
			if (other != me) {
				p1 = G_objPlanes[me]
				p2 = G_objPlanes[other]
				if ((Math.sqrt(Math.pow(p1[2]-p2[2], 2) + Math.pow(p1[3]-p2[3], 2)) < 75) && (Math.abs(p1[4]-p2[4]) < 1200)) {
					// first, turn away from the other guy
					let xdelta = p1[2] - p2[2]
					let ydelta = p1[3] - p2[3]
					xdelta = xdelta / Math.sqrt(Math.pow(xdelta,2) + Math.pow(ydelta,2)) * 100
					ydelta = ydelta / Math.sqrt(Math.pow(xdelta,2) + Math.pow(ydelta,2)) * 100
					// setWaypoint(me, p1[2]+24+xdelta, p1[3]+62+ydelta, true)
					// second, move vertically away from the other guy
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
	let planes = Object.keys(G_objPlanes)
	let planeIsRolling = false
	let planeIsWaiting = false

	// first, check if we've lost any planes (accidentally flew off screen)
	for (let i=0; i<northQueue.length; i++) {
		if (planes.indexOf(northQueue[i]) == -1) {
			northQueue.splice(i, 1)
		}
	}
	for (let i=0; i<southQueue.length; i++) {
		if (planes.indexOf(southQueue[i]) == -1) {
			southQueue.splice(i, 1)
		}
	}
	// make sure there aren't any duplicates in the queues...
	let i = 1
	while (i < northQueue.length) {
		if (northQueue[i] == northQueue[i-1]) {
			northQueue.splice(i, 1)
		} else {
			i += 1
		}
	}
	i = 1
	while (i < southQueue.length) {
		if (southQueue[i] == southQueue[i-1]) {
			southQueue.splice(i, 1)
		} else {
			i += 1
		}
	}


	planes.forEach(function(plane) {
		let d = new Date()
		let t = d.getTime()
		if (highlightPoints.length>0 && t - highlightPoints[0].timeCreated > 5*1000) {
			highlightPoints.splice(0,1)
		}
		if (highlightLines.length>0 && t - highlightLines[0].timeCreated > 5*1000) {
			highlightLines.splice(0,1)
		}


		let p = G_objPlanes[plane]
		if (p.leg == 'approach') {
			let sequence = p.north ? northQueue.indexOf(plane) : southQueue.indexOf(plane)
			let desiredPathLength = 0
			p.sequence = sequence
			// first find the length of the downwind leg
			if (sequence == 0) {
				let dist = Math.sqrt(Math.pow(Xvertices[p.north?0:1][0]-(p[2]+24), 2) + Math.pow(Yvertices[p.north?0:1][0]-(p[3]+62), 2))
				if (dist < waypointPrecision) {
					p.leg = 'downwind'
					p.runway = p.north ? runN : runS
					setNav(plane, (p.north?'NORTHDOWNWIND':'SOUTHDOWNWIND'))
					if (p.north) {
						northQueue.splice(0, 1)
					} else {
						southQueue.splice(0, 1)
					}
				}
				desiredPathLength = dist
			} else {
				p.alt = ((p.north?G_objPlanes[northQueue[sequence-1]].alt:G_objPlanes[southQueue[sequence-1]].alt) + 1) % numAltitudeSteps
				desiredPathLength = incomingSpacing*sequence + (p.north?G_objPlanes[northQueue[0]].pathLength:G_objPlanes[southQueue[0]].pathLength)
			}
			let xp = p[2] + 24 // plane X
			let yp = p[3] + 62 // plane Y
			let diff = 0
			let prevDiff = 9999999
			let xi = 0 // intersection X
			let yi = 0 // intersection Y
			let dist0 = 0 // sum of previous legs
			let dist1 = 0 // distance along current leg
			let dist2 = 0 // distance from intersection to plane
			let leg = 0 // which leg are we on
			let spacingStep = 0 // which spacing step are we on
			let Xstep = 0
			let Ystep = 0

			let pathLength = 0
			for (leg=0; leg<Xvertices[p.north?0:1].length-1; leg++) {
				Xstep = (Xvertices[p.north?0:1][leg+1] - Xvertices[p.north?0:1][leg]) / spacingSteps
				Ystep = (Yvertices[p.north?0:1][leg+1] - Yvertices[p.north?0:1][leg]) / spacingSteps
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
				let theta = (Math.atan2(xi-xp, yp-yi) * 180 / Math.PI + 360) % 360
				let d = new Date()
				if ((p[5]-theta)%360 > 10 && (p[5]-theta)%360 < 350) { // if the angle is greater than 30 degrees from before
					// then set the point back to where it was
					leg = p.lastLeg
					spacingStep = p.lastSpacingStep
					// console.log('rejected', p[5], Math.round(theta), plane, leg, p.lastLeg, spacingStep, p.lastSpacingStep)
					highlightPoints.push({id:Math.random(), fill:'black', x:xp, y:yp, r:7, timeCreated:d.getTime()})
					highlightPoints.push({id:Math.random(), fill:'red', x:xi, y:yi, r:7, timeCreated:d.getTime()})
					highlightPoints.push({id:Math.random(), fill:'blue', x:p.lastXi, y:p.lastYi, r:7, timeCreated:d.getTime()})
					highlightLines.push({id:Math.random(), x1:xp, y1:yp, x2:xi, y2:yi, timeCreated:d.getTime(), stroke:'red'})
					highlightLines.push({id:Math.random(), x1:xp, y1:yp, x2:p.lastXi, y2:p.lastYi, timeCreated:d.getTime(), stroke:'blue'})
					xi = p.lastXi
					yi = p.lastYi
					dist0 = p.dist0
					dist1 = p.dist1
					dist2 = Math.sqrt(Math.pow(xi-xp, 2) + Math.pow(yi-yp, 2))
					pathLength = dist0 + dist1 + dist2
					diff = pathLength - desiredPathLength
				} else {
					// console.log('accepted', p[5], theta, plane, leg, p.lastLeg, spacingStep, p.lastSpacingStep)
					highlightPoints.push({id:Math.random(), fill:'green', x:xp, y:yp, r:5, timeCreated:d.getTime()})
					highlightPoints.push({id:Math.random(), fill:'green', x:xi, y:yi, r:5, timeCreated:d.getTime()})
					highlightPoints.push({id:Math.random(), fill:'green', x:p.lastXi, y:p.lastYi, r:5, timeCreated:d.getTime()})
					highlightLines.push({id:Math.random(), x1:xp, y1:yp, x2:xi, y2:yi, timeCreated:d.getTime(), stroke:'black'})
					highlightLines.push({id:Math.random(), x1:xp, y1:yp, x2:p.lastXi, y2:p.lastYi, timeCreated:d.getTime(), stroke:'black'})
				}
			}
			p.lastXi = xi
			p.lastYi = yi
			p.lastLeg = leg
			p.lastSpacingStep = spacingStep
			if (dist2 < 100) { // now that we know where our intersection point should be, move it forward as we get closer to the line itself
				p.onCourse = true
				let numPointsAhead = Math.floor((100-dist2) / 5)
				spacingStep -= numPointsAhead
				if (spacingStep < 0) { // go around a corner if we need to
					leg = leg - 1
					if (leg < 0) {
						leg = 0
						spacingStep = 0
					} else {
						spacingStep += spacingSteps
					}
					Xstep = (Xvertices[p.north?0:1][leg+1] - Xvertices[p.north?0:1][leg]) / spacingSteps
					Ystep = (Yvertices[p.north?0:1][leg+1] - Yvertices[p.north?0:1][leg]) / spacingSteps
				}
				xi = Xvertices[p.north?0:1][leg] + Xstep*spacingStep
				yi = Yvertices[p.north?0:1][leg] + Ystep*spacingStep
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
			setAltitude(plane, p.alt+6+(p.onCourse?0:numAltitudeSteps))
		} else if (p.leg == 'downwind') {
			setNav(plane, p.north?'NORTHDOWNWIND':'SOUTHDOWNWIND')
			if (p[2]+24 < lineX/2 || p[2]+24 > lineX*1.5) {
				p.leg = 'final'
			}
		} else if (p.leg == 'final') {
			setAltitude(plane, 2)
			setNav(plane, 'FINAL')
			// if we've finished our turn and haven't started our final descent yet, then rey to land
			if (p[5]==p[8]) {
				p.leg = 'landing'
				p.landingAttempts = 0
			}
		} else if (p.leg == 'takingOff') {
			if (p[4] > intFieldElev) {
				p.leg = 'initialClimb'
			}
		} else if (p.leg == 'initialClimb') {
			setAltitude(plane, finalClearanceAltitude, true)
			setNav(plane, 'ABORT')
			setSpeed(plane, 240)
			// if we're climbing and have reached clearance altitude, give final climb and waypoint clearance
			if (p[4] >= initialClearanceAltitude*1000) {
				p.leg = 'departure'
			}
		} else if (p.leg == 'departure') {
			setSpeed(plane, 300)
			setAltitude(plane, finalClearanceAltitude)
			setNav(plane, G_arrNavObjects[p[13]][0])
		} else if (p.leg == 'abort') {
			if (p[9] == intFieldElev) {
				routePlane(plane + ' a')
			}
			setHeading(plane, p.north?'45':'135')
			setSpeed(plane, 240)
			setAltitude(plane, abortAltitude + 5)
			if (p[4] >= abortAltitude*1000) {
				delete p.leg
			}
		} else if (p.leg == 'landing') {
			if (p[9] != intFieldElev) {
				routePlane(plane + ' l ' + (p.north?runN:runS))
				p.landingAttempts += 1
			}
			p.sequence = p.landingAttempts
			if (p.landingAttempts > maxLandingAttempts) {
				abort(plane)
			}
			if (p[12] == null) { // if the plane has made itself go around
				abort(plane)
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
			p.onCourse = false
			p.leg = 'approach'
		}
	})


	// monitor the queues, and if one is overflowing and the other isn't, then switch a plane
	if (northQueue.length > 0 && southQueue.length > 0) {
		let lastNorth = northQueue[northQueue.length - 1]
		let pN = G_objPlanes[lastNorth]
		let lastSouth = southQueue[southQueue.length - 1]
		let pS = G_objPlanes[lastSouth]
		if (pN[10] == 160 && pS[10] != 160) {
			abort(lastNorth)
		}
		if (pS[10] == 160 && pN[10] != 160) {
			abort(lastSouth)
		}
	}



	// now space the places that are on the downwind leg
	let waypoints = ['NORTHDOWNWIND', 'SOUTHDOWNWIND']
	for (let w=0; w<waypoints.length; w++) {
		let waypoint = waypoints[w]
		let wx = eastFlow ? lineX/2 : lineX*1.5
		let wy = waypoint=='NORTHDOWNWIND' ? northY : southY
		let queue = []
		// pull out the planes flying to my waypoint, and calculate their distance
		planes.forEach(function(plane) {
			let p = G_objPlanes[plane]
			if (p[11] == waypoint) {
				let dist = Math.sqrt(Math.pow(p[2]+24-wx,2) + Math.pow(p[3]+62-wy,2))
				queue.push({'plane': plane, 'dist': dist})
			}
		})
		// sort them according to their distance
		queue.sort(function(a,b) {
			return a.dist - b.dist
		})

		for (let i=0; i<queue.length; i++) {
			let p = queue[i]
			let desired = i*incomingSpacing
			let diff = p.dist - queue[0].dist - desired
			G_objPlanes[p.plane].sequence = i
			G_objPlanes[p.plane].pathLength = p.dist
			G_objPlanes[p.plane].desiredPathLength = desired
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
	waypoints = [runwayNE, runwayNW, runwaySE, runwaySW]
	for (let w=0; w<waypoints.length; w++) {
		let waypoint = waypoints[w]
		let wx = lineX
		let wy = midY
		let queue = []
		// pull out the planes flying to my waypoint, and calculate their distance
		planes.forEach(function(plane) {
			let p = G_objPlanes[plane]
			if (p[11] == waypoint) {
				let dist = Math.sqrt(Math.pow(p[2]+24-wx,2) + Math.pow(p[3]+62-wy,2))
				queue.push({'plane': plane, 'dist': dist})
			}
		})
		// sort them according to their distance
		queue.sort(function(a,b) {
			return a.dist - b.dist
		})

		// console.log(waypoint, queue)
		for (let i=1; i<queue.length; i++) {
			let p = queue[i]
			let diff = p.dist - queue[i-1].dist
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
		let p = G_objPlanes[plane]
		let index = northQueue.indexOf(plane)
		if (index != -1) {
			northQueue.splice(index, 1)
		}
		index = southQueue.indexOf(plane)
		if (index != -1) {
			southQueue.splice(index, 1)
		}
		p.leg = 'abort'
		p.onCourse = false
		p.north = !p.north
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

	let d = new Date()
	let t = d.getTime()

	// convert planes dict into list
	data = []
	Object.keys(G_objPlanes).forEach(function(plane) {
		let out = G_objPlanes[plane]
		out.name = plane
		data.push(out)
	})

	let planes = self.svg.selectAll('g')
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
				for (let i=0; i<G_arrNavObjects.length; i++) {
					if (G_arrNavObjects[i][0] == d[11]) {
						return G_arrNavObjects[i][2] - d[2]-24
					}
				}
			}
			return 0
		})
		.attr('y2', function(d) {
			if (d[16]=='A' ) {
				for (let i=0; i<G_arrNavObjects.length; i++) {
					if (G_arrNavObjects[i][0] == d[11]) {
						return G_arrNavObjects[i][3] - d[3]-62
					}
				}
			}
			return 0
		})
	planes.selectAll('text')
		.text(function(d) { return d.sequence>-1 ? d.sequence : '' }) // + ' | path: ' + Math.round(d.pathLength) + ' | des: ' + Math.round(d.desiredPathLength) + ' | dist2: ' + Math.round(d.dist2) : '' }) // + ' | dist0: ' + Math.round(d.dist0) + ' | dist1: ' + Math.round(d.dist1) + ' | dist2: ' + Math.round(d.dist2): '' })

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

	let points = self.svg.selectAll('#highlight')
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
		.attr('opacity', function(d) { return 1 - (t-d.timeCreated)/5000})

	points.exit().remove()


	let lines = self.svg.selectAll('#line')
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
		.attr('opacity', function(d) { return 1 - (t-d.timeCreated)/5000})

	lines.exit().remove()
}




addPlaneInterval = setInterval(function() { if (intPlanesOnScreen < planesAtOnce) { intNewPlaneTimer = 0 } }, 1000) 
flowInterval = setInterval(checkFlow, 10000)
conflictInterval = setInterval(deConflict, 100)
departureInterval = setInterval(checkDepartures, 100)
spaceInterval = setInterval(spacePlanes, 300)
updateInterval = setInterval(update, 100)
intervalID = setInterval("fnMoveIt()", simulationStepTime);