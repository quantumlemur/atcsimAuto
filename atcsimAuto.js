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
currentFlow = intWind<180 ? 'e' : 'w'

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
		if (p[16] == 'T' && p[4] > 6000) {
			p['status'] = 'en route'
			var req = G_arrNavObjects[p[13]][0]
			if (p[11] != req) {
				routePlane(plane + ' s 600 c ' + req)
			}
		}
	})
}


checkFlow = function() {
	if ((currentFlow=='w' && intWind<150 && intWind>30) || (currentFlow=='e' && intWind>210 && intWind<330)) {
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
			p.high = true
			routePlane(plane + ' c 5 s 300')
		}
	})

	// if we're on final and pointed towards our heading, try to land
	planes.forEach(function(plane) {
		var p = G_objPlanes[plane]
		if (p[16] == 'A' && p[11] == p['final'] && p[5]==p[8] && p[9]>1999) {
			routePlane(plane + ' l ' + p['runway'])
			p.leg = 'landing'
			delete p.sequence
		}
	})
}


highlightLines = []

calcLines = function() {
	lineX = 0
	northY = 0
	southY = 0
	maxY = 0
	minY = 0

	for (var i=0; i<G_arrNavObjects.length; i++) {
		if (G_arrNavObjects[i][0] == 'SCARR') {
			lineX = G_arrNavObjects[i][2]
		} else if (G_arrNavObjects[i][0] == 'FT') {
			northY = G_arrNavObjects[i][3]
		} else if (G_arrNavObjects[i][0] == 'HEDEG') {
			southY = G_arrNavObjects[i][3]
		} else if (G_arrNavObjects[i][0] == 'LUCKK') {
			maxY = G_arrNavObjects[i][3]
		}
	}
}

calcLines()


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
					p.leg = 'approach'
					routePlane(plane + ' c ' + p.approach)
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
			} else if (p.leg == 'approach') {
				if (Math.sqrt(Math.pow(p[2]+24 - navcoords[p.approach][0], 2) + Math.pow(p[3]+62 - navcoords[p.approach][1], 2)) < 20) {
					p.leg = 'final'
					routePlane(plane + ' c ' + p.final)
					setAltitude(plane, p.high ? 3 : 2)
				}
			}
		}
	})
	queueN.sort(function(a,b) { return a.dist - b.dist })
	queueS.sort(function(a,b) { return a.dist - b.dist })

	highlightPoints = []
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
			var desiredPathLength = frontPathLength + i*100
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
					// if (i==1) {
					// 	highlightPoints.push({uid:Math.random().toString(), r:diff/100, id:hasDecreased, x:xi, y:yi, fill:'blue'})
					// }
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
			p.diff = diff
			p.dist1 = dist1
			p.dist2 = dist2
			p.pathLength = pathLength
			p.desiredPathLength = desiredPathLength
			if (diff > 50) {
				setSpeed(queueN[i].plane, 450)
			} else if (diff < -50) {
				setSpeed(queueN[i].plane, 160)
			} else {
				setSpeed(queueN[i].plane, 300)
			}
			if (i>0) {
				var prevHigh = G_objPlanes[queueN[i-1].plane].high
				setAltitude(queueN[i].plane, prevHigh ? 5 : 6)
				G_objPlanes[queueN[i].plane].high = !prevHigh
			}
			// highlightPoints.push({uid:Math.random().toString(), r:10, id:p.name, x:xi, y:yi, fill:'green'})
			// highlightLines.push({x1:x1, y1:y1, x2:xi, y2:yi})
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
			var desiredPathLength = frontPathLength + i*100
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
					// if (i==1) {
					// 	highlightPoints.push({uid:Math.random().toString(), r:diff/100, id:hasDecreased, x:xi, y:yi, fill:'blue'})
					// }
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
			p.diff = diff
			p.dist1 = dist1
			p.dist2 = dist2
			p.pathLength = pathLength
			p.desiredPathLength = desiredPathLength
			if (diff > 50) {
				setSpeed(queueS[i].plane, 450)
			} else if (diff < -50) {
				setSpeed(queueS[i].plane, 160)
			} else {
				setSpeed(queueS[i].plane, 300)
			}
			if (i>0) {
				var prevHigh = G_objPlanes[queueS[i-1].plane].high
				setAltitude(queueS[i].plane, prevHigh ? 5 : 6)
				G_objPlanes[queueS[i].plane].high = !prevHigh
			}
			// highlightPoints.push({uid:Math.random().toString(), r:10, id:p.name, x:xi, y:yi, fill:'green'})
		}
	}

	// now space the places that are on the downwind leg
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
			var desired = i*100
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
		.text(function(d) { return !!d.sequence ? '#' + d.sequence + ' | diff: ' + Math.round(d.diff) : '' })

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