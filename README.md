# atcsimAuto

Fully automated air traffic control routing for http://atc-sim.com/.  Start a session at one of the default airports (I recommend ORD or ATL), and paste the .js into the browser dev tools.  You can tweak the variables in the first section of the file, and also adjust whether it simulates in realtime or accelerated.

It creates made-up labyrinthine approach paths for the sake of the sim, rather than following the real approach paths, including altitudes.  It also doesn't do any predictive de-conflict routing, but just handles conflicts on the fly, so there are many more than you'd normally want.  Flight path predictive planning and conflict resolution is what I'd like to add in next.  
