// 3 layers of parallax floating Balls/Balloons
// by Birgit Bachler, 2013
// www.birgitbachler.com

// Ball class adapted from
// Learning Processing
// Daniel Shiffman
// http://www.learningprocessing.com
// Example 10-2: Bouncing ball class

//number of balls in 3 layers
var bground = 30;
var mdground =40;
var frground = 25;

//array length = all layers together
var total = bground+mdground+frground;

//size of balls in 3 layers
var bgsize = 25;
var mdsize = 50;
var frsize = 80;

//Initialize Color Array, colors by https://kuler.adobe.com/Retro-Rain-color-theme-2861967/
var colors = [];

//ball array
var balls = [];

function windowResized() {
  resizeCanvas(windowWidth-5, 800);
}

function setup() {
  createCanvas(windowWidth-5, 800);
  frameRate(25);
  smooth();

  backgroundAlpha = 100;
  colors.push(color(254, 67, 101, backgroundAlpha));
  colors.push(color(252, 157, 154, backgroundAlpha));
  colors.push(color(249, 205, 173, backgroundAlpha));
  colors.push(color(200, 200, 169, backgroundAlpha));
  colors.push(color(131, 175, 155, backgroundAlpha));
  
  //we fill the Ball array backrgound, midground, foreground
  
  for (var i = 0; i < total; i++) {
    if (i < bground) {
      balls.push(new Ball(bgsize));
    } else if (i < mdground+bground) {
      balls.push(new Ball(mdsize));
    } else if (i >= mdground) {
      balls.push(new Ball(frsize));
    }
  }
}

function draw() {
  background(255, 255, 230);

  // Move and display balls
  for (var i = 0; i < balls.length; i++) {
    balls[i].move();
    balls[i].display();
  }

  textSize(40);
  fill("black");
  text("KWCAC Youth Fellowship Open House", 50, 70);

  textSize(30);
  text("Date: 2017 Sep 21st", 100, 200);
  text("Time: 7pm", 150, 300);
  text("Location: KW Chinese Alliance Church", 110, 400);
}

function Ball(tempR) {
  this.r = tempR;
  this.x = random(width);     //position the balls randomly on the canvas
  this.y = random(height);
  this.xspeed =  map(this.r, bgsize, frsize, 2, 8);     //map the speed in x-direction based on the size/layer of the balls
  this.bcolor = colors[int(random(0, colors.length))];    //assign a random color value from the colors array


  this.move = function() {
    this.x += this.xspeed*mouseX/width; // Increment x
    this.y += map(mouseY, 0, height, -5, 5);

    // Check edges
    if (this.x > width+this.r || this.x < -this.r) {
      this.x= -this.r-random(width)/2;
      this.y = random(height);
    }

    if (this.y > height+this.r || this.y < -this.r) {
      this.x= -this.r-random(width)/2;
      this.y = random(height);
    }

  };
  
  this.display = function() {  // Draw the ball
    noStroke();
    fill(this.bcolor);    // assign fill color
    push();
    translate(this.x,this.y);     //translate in x and y direction
    
    ellipse(0, 0, this.r, this.r);     // draw the ball
    pop();
  };
}

function mousePressed() {
  for (var i = 0; i < balls.length; i++) {
    balls[i].r += 20;
    balls[i].display();
  }
}

function mouseReleased() {
  for (var i = 0; i < balls.length; i++) {
    balls[i].r -= 20;
    balls[i].display();
  }
}
