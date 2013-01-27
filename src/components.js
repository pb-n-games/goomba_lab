const DIR_RIGHT = 0;
const DIR_UP = 1;
const DIR_LEFT = 2;
const DIR_DOWN = 3;
const DIR_TRAPPED = 4;

// The Grid component allows an element to be located
//  on a grid of tiles
Crafty.c('Grid', {
	init : function() {
		this.attr({
			w : Game.map_grid.tile.width,
			h : Game.map_grid.tile.height
		})
	},
	// Locate this entity at the given position on the grid
	at : function(x, y) {
		if(x === undefined && y === undefined) {
			return {
				x : this.x / Game.map_grid.tile.width,
				y : this.y / Game.map_grid.tile.height
			}
		} else {
			this.attr({
				x : x * Game.map_grid.tile.width,
				y : y * Game.map_grid.tile.height
			});
			return this;
		}
	}
});

// An "Actor" is an entity that is drawn in 2D on canvas
//  via our logical coordinate grid
Crafty.c('Actor', {
	init : function() {
		this.requires('2D, Canvas, Grid');
	},
});

Crafty.c('FromEditor', {
	//Just a trait
});

Crafty.c('Goomba', {
	init : function() {
		this.animation_speed = 16;
		this.requires('Actor, SpriteAnimation')
			.animate('MovingUp',    0, 0, 7)
			.animate('MovingDown',  0, 1, 7)
			.animate('MovingLeft',  0, 2, 7)
			.animate('MovingRight', 0, 3, 7)
		.bind("pauseSimulation", function() {
			this.unbind("EnterFrame");
			this.tweenPausedIncrement = new Date().getTime() - this.tweenStart;
		}).bind("startSimulation", function() {
			console.log('[Goomba] startSim');

			this.animate('MovingRight', this.animation_speed, -1);

			var at = this.at();
			if(this.startedOnce) {
				this.tweenStart = new Date().getTime() - this.tweenPausedIncrement;
			} else {
				this.tweenStart = new Date().getTime();
				this.moveDir = DIR_RIGHT;
				this.currentGridX = this.startPosition.x;
				this.currentGridY = this.startPosition.y;
				this.x = Game.map_grid.tile.width * this.currentGridX;
				this.y = Game.map_grid.tile.width * this.currentGridY;
				this.nextGridX = at.x + 1;
				this.nextGridY = at.y;
			}
			this.startedOnce = true;
			this.bind("EnterFrame", this.enterFrame);
		}).bind("resetSimulation", function() {
			console.log("resetSim");
			this.unbind("EnterFrame");
			this.currentGridX = this.startPosition.x;
			this.currentGridY = this.startPosition.y;
			this.x = Game.map_grid.tile.width * this.currentGridX;
			this.y = Game.map_grid.tile.width * this.currentGridY;
			
			this.startedOnce = false;
		});
	},
	startedOnce : false,
	startPosition : {
		x : 0,
		y : 1
	},
	currentGridX : 0,
	currentGridY : 1,
	moveDir : DIR_RIGHT,
	msPerTile : 500,
	nextGridX : 1,
	nextGridY : 1,
	tweenStart : new Date().getTime(),
	tweenPausedIncrement : 0,

	// use direction constants as indexes into these
	leftTurn : [DIR_UP, DIR_LEFT, DIR_DOWN, DIR_RIGHT],
	rightTurn : [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT],
	reverseDir : [DIR_LEFT, DIR_DOWN, DIR_RIGHT, DIR_UP],

	enterFrame : function() {
		var tweenDiff = new Date().getTime() - this.tweenStart;
		if(tweenDiff < this.msPerTile) {
			// update tweening
			this.x = Game.map_grid.tile.width * ((this.nextGridX - this.currentGridX) * tweenDiff / this.msPerTile + this.currentGridX);
			this.y = Game.map_grid.tile.height * ((this.nextGridY - this.currentGridY) * tweenDiff / this.msPerTile + this.currentGridY);
		} else {
			// finalize destination, process game logic, and set new one
			this.currentGridX = this.nextGridX;
			this.currentGridY = this.nextGridY;
			this.x = Game.map_grid.tile.width * this.nextGridX;
			this.y = Game.map_grid.tile.height * this.nextGridY;
			// check for win
			var exits = Crafty("Exit");
			var self = this;
			if(_.find(exits, function(exit) {
				var at = Crafty(exit).at();
				return at.x == self.currentGridX && at.y == self.currentGridY;
			})) {
				Crafty.trigger("ReachedExit");
			}
			// we'll be moving to another tile, so set it up
			this.moveDir = this.getNextDir.bind(this)();

			// Stop the existing animation
			this.stop();

			// we trust getNextDir implicitly to give us a valid direction
			switch(this.moveDir) {
				case DIR_RIGHT:
					this.nextGridX = this.currentGridX + 1;
					this.nextGridY = this.currentGridY;
					this.animate('MovingRight', this.animation_speed, -1);
					break;
				case DIR_UP:
					this.nextGridX = this.currentGridX;
					this.nextGridY = this.currentGridY - 1;
					this.animate('MovingUp', this.animation_speed, -1);
					break;
				case DIR_LEFT:
					this.nextGridX = this.currentGridX - 1;
					this.nextGridY = this.currentGridY;
					this.animate('MovingLeft', this.animation_speed, -1);
					break;
				case DIR_DOWN:
					this.nextGridX = this.currentGridX;
					this.nextGridY = this.currentGridY + 1;
					this.animate('MovingDown', this.animation_speed, -1);
					break;
				case DIR_TRAPPED:
					this.nextGridX = this.currentGridX;
					this.nextGridY = this.currentGridY;
					return;
			}
			this.tweenStart = new Date().getTime();
		}
	},
	eatDeliciousAttractor : function(attractor) {
		if(!Crafty(attractor).at) {
			return;
		}
		var at = Crafty(attractor).at();
		if(this.currentGridX == at.x && this.currentGridY == at.y) {
			// collision, so eat the entity and continue looking for additional attractors
			Crafty(attractor).eat();
		}
	},
	getYummyTarget : function(attractors) {
		var cgx = this.currentGridX;
		var cgy = this.currentGridY;
		var attractor_objects = _.map(attractors, function(a) {
			return Crafty(a);
		});
		var attractors_in_line = _.filter(attractor_objects, function(a) {
			if(!a.at) {
				return false;
			}
			return a.at().x == cgx || a.at().y == cgy;
		});
		var attractors_by_dist = _.sortBy(attractors_in_line, function(a) {
			return Math.abs(a.at().x - cgx) + Math.abs(a.at().y - cgy);
		});
		if(attractors_by_dist.length == 0) {
			return false;
		}
		var min_dist = Math.abs(attractors_by_dist[0].at().x - cgx) + Math.abs(attractors_by_dist[0].at().y - cgy);
		var closest_attractors = _.filter(attractors_by_dist, function(a) {
			return (Math.abs(a.at().x - cgx) + Math.abs(a.at().y - cgy)) == min_dist;
		});
		var closest_attractors_with_dir = _.map(closest_attractors, function(a) {
			if(a.at().x > cgx)
				return {
					dir : DIR_RIGHT,
					a : a
				};
			else if(a.at().x < cgx)
				return {
					dir : DIR_LEFT,
					a : a
				};
			else if(a.at().y > cgy)
				return {
					dir : DIR_DOWN,
					a : a
				};
			else if(a.at().y < cgy)
				return {
					dir : DIR_UP,
					a : a
				};
		});
		var chosen_attractor;
		if(closest_attractors_with_dir.length > 1) {
			if(!( chosen_attractor = _.find(closest_attractors_with_dir, function(a) {
				return a.dir == this.moveDir;
			}.bind(this)))) {
				chosen_attractor = _.sortBy(closest_attractors_with_dir, "dir")[0];
			}
		} else {
			chosen_attractor = closest_attractors_with_dir[0];
		}

		if(chosen_attractor) {
			this.moveDir = chosen_attractor.dir;
			return true;
		}
		return false;
	},
	pathingGrid : null,
});

Crafty.c('YellowGoomba', {
	init : function() {
		this.requires('spr_goomba_yellow, Goomba');
	},
	getNextDir : function() {
		var walls = Crafty("Wall");
		var bugs = Crafty("Bug");
		var fires = Crafty("Fire");
		var waters = Crafty("Water");

		// true if tile is walkable for this variety of Goomba
		this.pathingGrid = new Array();

		// grid is walkable by default
		for(var x = 0; x < Game.map_grid.width; x++) {
			this.pathingGrid[x] = new Array();
			for(var y = 0; y < Game.map_grid.width; y++) {
				this.pathingGrid[x][y] = true;
			}
		}

		// walls are 1-tile obstacles
		_.each(walls, function(wall) {
			var at = Crafty(wall).at();
			this.pathingGrid[at.x][at.y] = false;
		}.bind(this));
		// fires are 3x3 obstacles for yellows
		_.each(fires, function(fire) {
			var at = Crafty(fire).at();
			for(var x = at.x - 1; x <= at.x + 1; x++) {
				for(var y = at.y - 1; y <= at.y + 1; y++) {
					this.pathingGrid[x][y] = false;
				}
			}
		}.bind(this));

		// eat delicious attractors if we're standing on one, then check for attractors to move to
		var attractors = _.union(waters,bugs);
		_.each(attractors, this.eatDeliciousAttractor.bind(this));
		if((this.getYummyTarget.bind(this))(attractors)) {
			// attract towards attractor!
			return this.moveDir;
		}

		// no attraction, so move normally, checking for obstacles
		var testMoveDir = this.moveDir;
		var tries = 0;
		do {
			// get the next X,Y and direction to test
			var testNextX = this.currentGridX;
			var testNextY = this.currentGridY;
			switch(testMoveDir) {
				case DIR_RIGHT:
				case DIR_TRAPPED:
					testNextX++;
					break;
				case DIR_UP:
					testNextY--;
					break;
				case DIR_LEFT:
					testNextX--;
					break;
				case DIR_DOWN:
					testNextY++;
					break;
			}

			// check bounds of grid
			if(testNextX >= Game.map_grid.width || testNextX < 0 || testNextY >= Game.map_grid.height || testNextY < 0) {
				// fail because of bounds
			}
			// OBSTACLES
			else if(!this.pathingGrid[testNextX][testNextY]) {
				// fail because there's an obstacle in the way
			} else {
				// looks like we're good to go!
				return testMoveDir;
			}

			// if fail, make right turn
			testMoveDir = this.rightTurn[testMoveDir];
			// handle case where no movement is possible
		} while(tries++ < 4)
	}
});

Crafty.c('BlueGoomba', {
	init : function() {
		this.requires('spr_goomba_blue, Goomba');
	},
	getNextDir : function() {
		var walls = Crafty("Wall");
		var bugs = Crafty("Bug");
		var fires = Crafty("Fire");
		var waters = Crafty("Water");

		// true if tile is walkable for this variety of Goomba
		this.pathingGrid = new Array();

		// grid is walkable by default
		for(var x = 0; x < Game.map_grid.width; x++) {
			this.pathingGrid[x] = new Array();
			for(var y = 0; y < Game.map_grid.width; y++) {
				this.pathingGrid[x][y] = true;
			}
		}

		// walls are 1-tile obstacles
		_.each(walls, function(wall) {
			var at = Crafty(wall).at();
			this.pathingGrid[at.x][at.y] = false;
		}.bind(this));

		// eat delicious attractors if we're standing on one, then check for attractors to move to
		var attractors = bugs;
		_.each(attractors, this.eatDeliciousAttractor.bind(this));
		if(this.getYummyTarget(attractors.bind(this))) {
			// attract towards attractor!
			return this.moveDir;
		}

		// no attraction, so move normally, checking for obstacles
		var testMoveDir = this.moveDir;
		var tries = 0;
		do {
			// get the next X,Y and direction to test
			var testNextX = this.currentGridX;
			var testNextY = this.currentGridY;
			switch(testMoveDir) {
				case DIR_RIGHT:
				case DIR_TRAPPED:
					testNextX++;
					break;
				case DIR_UP:
					testNextY--;
					break;
				case DIR_LEFT:
					testNextX--;
					break;
				case DIR_DOWN:
					testNextY++;
					break;
			}

			// check bounds of grid
			if(testNextX >= Game.map_grid.width || testNextX < 0 || testNextY >= Game.map_grid.height || testNextY < 0) {
				// fail because of bounds
			}
			// OBSTACLES
			else if(!this.pathingGrid[testNextX][testNextY]) {
				// fail because there's an obstacle in the way
			} else {
				// looks like we're good to go!
				return testMoveDir;
			}

			// if fail, make right turn
			testMoveDir = this.leftTurn[testMoveDir];
			// handle case where no movement is possible
		} while(tries++ < 4)
	}
});

Crafty.c('RedGoomba', {
	init : function() {
		this.requires('spr_goomba_red, Goomba');
	},
	getNextDir : function() {
		var walls = Crafty("Wall");
		var bugs = Crafty("Bug");
		var fires = Crafty("Fire");
		var waters = Crafty("Water");

		// true if tile is walkable for this variety of Goomba
		this.pathingGrid = new Array();

		// grid is walkable by default
		for(var x = 0; x < Game.map_grid.width; x++) {
			this.pathingGrid[x] = new Array();
			for(var y = 0; y < Game.map_grid.width; y++) {
				this.pathingGrid[x][y] = true;
			}
		}

		// walls are 1-tile obstacles
		_.each(walls, function(wall) {
			var at = Crafty(wall).at();
			this.pathingGrid[at.x][at.y] = false;
		}.bind(this));
		// water and bugs are 3x3 obstacles for reds
		_.each(waters, function(water) {
			var at = Crafty(water).at();
			for(var x = at.x - 1; x <= at.x + 1; x++) {
				for(var y = at.y - 1; y <= at.y + 1; y++) {
					this.pathingGrid[x][y] = false;
				}
			}
		}.bind(this));
		_.each(bugs, function(bug) {
			var at = Crafty(bug).at();
			for(var x = at.x - 1; x <= at.x + 1; x++) {
				for(var y = at.y - 1; y <= at.y + 1; y++) {
					this.pathingGrid[x][y] = false;
				}
			}
		}.bind(this));

		// eat delicious attractors if we're standing on one, then check for attractors to move to
		var attractors = fires;
		_.each(attractors, this.eatDeliciousAttractor.bind(this));
		if(this.getYummyTarget(attractors.bind(this))) {
			// attract towards attractor!
			return this.moveDir;
		}

		// no attraction, so move normally, checking for obstacles
		var testMoveDir = this.moveDir;
		var tries = 0;
		do {
			// get the next X,Y and direction to test
			var testNextX = this.currentGridX;
			var testNextY = this.currentGridY;
			switch(testMoveDir) {
				case DIR_RIGHT:
				case DIR_TRAPPED:
					testNextX++;
					break;
				case DIR_UP:
					testNextY--;
					break;
				case DIR_LEFT:
					testNextX--;
					break;
				case DIR_DOWN:
					testNextY++;
					break;
			}

			// check bounds of grid
			if(testNextX >= Game.map_grid.width || testNextX < 0 || testNextY >= Game.map_grid.height || testNextY < 0) {
				// fail because of bounds
			}
			// OBSTACLES
			else if(!this.pathingGrid[testNextX][testNextY]) {
				// fail because there's an obstacle in the way
			} else {
				// looks like we're good to go!
				return testMoveDir;
			}

			// if fail, make right turn
			testMoveDir = this.reverseDir[testMoveDir];
			// handle case where no movement is possible
		} while(tries++ < 4)
	}
});

Crafty.c('Wall', {
	init : function() {
		this.requires('Actor, Solid, spr_wall');
	},
});

Crafty.c('Exit', {
	init : function() {
		this.requires('Actor, Solid, spr_exit');
	},
});

//Things that can be eaten
Crafty.c('Yummy', {
	yummyType : null,
	eat : function() {
		var state = {
			x : this.at().x,
			y : this.at().y,
			yummyType : this.yummyType,
			fromEditor : this.has('FromEditor')
		};
		
		Game.yummiesEaten.push(state);
		this.destroy();
	},
	
	yummy : function(yummyType) {
		this.yummyType = yummyType;
		return this;
	}
});

Crafty.c('Fire', {
	init : function() {
		this.requires('Yummy, Actor, Solid, spr_fire');
		this.yummy('Fire');
	},
});

Crafty.c('Water', {
	init : function() {
		this.requires('Yummy, Actor, Solid, spr_water');
		this.yummy('Water');
	},
});

Crafty.c('Bug', {
	animation_speed: 16,
	init : function() {
		this.requires('Yummy, Actor, Solid, SpriteAnimation, spr_bug')
			.animate('MovingUp',    0, 0, 7)
			.animate('MovingDown',  0, 1, 7)
			.animate('MovingLeft',  0, 2, 7)
			.animate('MovingRight', 0, 3, 7)
			.yummy('Bug')
			.animate('MovingRight', this.animation_speed, -1);
	},
});
