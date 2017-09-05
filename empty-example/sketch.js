var canvas;
var centreX, centreY, radiusOriginal, radiusCurrent;
var r,g,b;

function setup() {
	canvas = createCanvas(windowWidth-5, windowHeight-5);
	windowResized();

	centreX = 200;
	centreY = 300;
	radiusOriginal = 250;

}

function draw() {
	background(255, 255, 236);
	strokeWeight(0);
	textSize(40);
	fill("black");
	text("KWCAC Youth Fellowship Open House", 50, 70);

	
	resizeCircle(centreX, centreY);
	fill(0,0,255,50);
	circle = ellipse(centreX, centreY, radiusOriginal, radiusOriginal);
	
	strokeWeight(0);
	fill("black");
	text("Time: 7pm", centreX - 90, centreY + 20 );
}

function resizeCircle(x, y) {
	var d = dist(mouseX, mouseY, x, y);
	if (d < radiusOriginal) {
		translate((mouseX-x) * 0.1, (mouseY-y) * 0.1);
		stroke(0,0,255,100);
		strokeWeight(20);
	} else {
		radiusCurrent = radiusOriginal;
		strokeWeight(0);
	}
}

function windowResized() {
	resizeCanvas(windowWidth-5, 800);
}