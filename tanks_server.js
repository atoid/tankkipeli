"use strict";

//
// TANK WARS
// 2.1.2022
// VERSION 1.0
// Node.js server side code
//

const SERVER_PORT = process.env.PORT || 8080;
const MAX_NAME_LENGTH = 8;
const MIN_POWER = 10;
const MAX_POWER = 100;
const MIN_ANGLE = Math.PI/16;
const MAX_ANGLE = (Math.PI - Math.PI/16)
const TERRAIN_WIDTH = (2<<10);
const TERRAIN_SEND_WIDTH = 1300;
const TERRAIN_SEND_OFFSET = 1;
const MAX_TERRAIN_HEIGHT = 120;
const TERRAIN_SCALE = 0.9;
const TERRAIN_BASE = 80;
const NUM_ITERATIONS = 7;
const HIT_RADIUS = (11*11);
const MAX_ENERGY = 30;
const HIT_POINTS = 10;
const MAX_PLAYERS = 11;
const PLAYER_START_X = 30;
const PLAYER_SPACING = 120;
const DEATH_TIMEOUT = (5 * 1000);
const PLAYER_COLORS = ["red", "blue", "brown", "pink", "orange", "white", "gray", "purple", "gold", "chocolate", "yellow"];
const MAX_SCORES = 10;

const GAME_UPDATE_INTERVAL = (1000 * 60);
const GAME_SET_TIME = 15;

var tanks = [];
var terrain = [];
var scores_set = [];
var scores_ath = [];

var game = {
    update_inverval: 0,
    set_time: GAME_SET_TIME
}

var use_https = false;

//
// http or https and websocket servers
//

const args = process.argv.slice(2);
if (args[0] == "https") {
    use_https = true;
}

console.log("tanks game server starting at port: " + SERVER_PORT);
console.log("https is " + use_https);

const Fs = require("fs");
const Static = require("node-static");
const WebSocketServer = require("ws").Server;

const fileServer = new Static.Server("./static", {
    indexFile: "tanks.html"
});

var httpsServer;

if (use_https) {
    const Https = require("https");
    httpsServer = Https.createServer({
        key: Fs.readFileSync("key.key"),
        cert: Fs.readFileSync("cert.crt")
    });
}
else {
    const Http = require("http");
    httpsServer = Http.createServer({ });
}

httpsServer.on('request', function(request, response) {
    request.addListener('end', function () {
        fileServer.serve(request, response);
    }).resume();
});

const wss = new WebSocketServer({
    server: httpsServer
});
//const wss = new WebSocket.Server({ port: SERVER_PORT });

gen_terrain();

wss.on('connection', function(ws) {
    console.log("ws client connected");

    ws.on('message', function(msg_str) {
        var msg = JSON.parse(msg_str);
        handle_msg(ws, msg);
    });

    ws.on('close', function() {
        handle_msg(ws, {msg: "close"});
    });
});

wss.on('close', function() {
    console.log("wss server closed");
});

// Main timer for updating game
game.update_inverval = setInterval(update_game, GAME_UPDATE_INTERVAL);

console.log("inits complete");
httpsServer.listen(SERVER_PORT);

//
// Main code
//

function handle_msg(ws, msg)
{
    if (msg.msg == "join") {
        var name = msg.name.substr(0, MAX_NAME_LENGTH);
        name = name.replace(/<[^>]+>/g, '');
        console.log(name + " wants to join");
        var tank = get_tank(ws, name);
        if (typeof(tank) === "object") {
            update_terrain(ws, tank);
            update_scores();
            update_tanks();
        }
        else {
            error_resp(ws, tank);
        }
    }
    else if (msg.msg == "close") {
        console.log("ws client closed");
        var i = tanks.findIndex(tank => tank.ws == ws);
        if (i != -1) {
            console.log(tanks[i].name + " has left");
            tanks.splice(i, 1);
        }
        update_tanks();
    }
    else if (msg.msg == "aim") {
        update_aim(ws, msg);
    }
    else if (msg.msg == "fire") {
        update_fire(ws, msg);
    }
    else if (msg.msg == "hit") {
        update_hit(ws, msg);
    }
    else {
        console.log("unknown message received");
    }
}

function error_resp(ws, err)
{
    console.log(err);
    
    var msg = {
        msg: "error",
        error: err
    };
    ws.send(JSON.stringify(msg));
}

function update_hit(ws, msg)
{
    var x = msg.x;
    var y = msg.y;
    
    for (var tank of tanks) {
        var dx = tank.x - x;
        var dy = tank.y - y;
        var d = dx*dx + dy*dy;

        if (d < HIT_RADIUS) {
            if (tank.energy > 0) {
                tank.energy -= HIT_POINTS;

                var msg = {
                    msg: "hit",
                    name: tank.name,
                    energy: tank.energy
                };

                var msg_str = JSON.stringify(msg);
                update_all(msg_str);

                if (tank.energy <= 0) {
                    update_scores(ws, tank);
                    setTimeout(update_death, DEATH_TIMEOUT, tank.name);
                }
            }
            break;
        }
    }
}

function update_score_table(scores, tank, killed_tank)
{
    var score = scores.find(score => score.name == tank.name);
    if (score) {
        score.score++;
    }
    else {
        scores.push({
            score: 1,
            name: tank.name
        });
    }

    scores.sort(function(a, b) {
        return b.score - a.score;
    });
}

function update_scores(ws, killed_tank)
{
    if (ws) {
        var tank = tanks.find(tank => tank.ws == ws);
        if (tank == killed_tank) {
            console.log(tank.name + " suicide");
            return;
        }

        if (tank) {
            console.log(tank.name + " killed " + killed_tank.name);
            update_score_table(scores_set, tank, killed_tank);
            update_score_table(scores_ath, tank, killed_tank);
        }
    }

    var msg = {
        "msg": "scores",
        "set_time": (game.set_time >= 10) ? "00:" + game.set_time : "00:0" + game.set_time,
        "scores_set": scores_set.slice(0, MAX_SCORES),
        "scores_ath": scores_ath.slice(0, MAX_SCORES)
    }

    var msg_str = JSON.stringify(msg);
    update_all(msg_str);
}

function update_death(name)
{
    var i = tanks.findIndex(tank => tank.name == name);
    if (i != -1) {
        tanks.splice(i, 1);
        update_tanks();
    }
}

function update_fire(ws, msg)
{
    var tank = tanks.find(tank => tank.ws == ws);
    if (tank && tank.energy > 0) {
        var power = msg.power;
        if (power < MIN_POWER) {
            power = MIN_POWER;
        }
        if (power > MAX_POWER) {
            power = MAX_POWER;
        }

        msg = {
            msg: "fire",
            name: tank.name,
            angle: tank.angle,
            power: power
        };

        var msg_str = JSON.stringify(msg);
        update_all(msg_str);
    }
}

function update_aim(ws, msg)
{
    var tank = tanks.find(tank => tank.ws == ws);
    if (tank && tank.energy > 0) {
        var angle = msg.angle;
        if (angle < MIN_ANGLE) {
            angle = MIN_ANGLE;
        } 
        if (angle > MAX_ANGLE) {
            angle = MAX_ANGLE;
        }

        tank.angle = angle;
        msg = {
            msg: "aim",
            name: tank.name,
            angle: tank.angle
        };

        var msg_str = JSON.stringify(msg);
        update_all(msg_str);
    }
}

function update_terrain(ws, tank)
{
    var msg = {
        msg: "terrain",
        tank: {
            name: tank.name,
            angle: tank.angle
        },
        terrain: terrain
    };
    ws.send(JSON.stringify(msg));
}

function update_new_terrain()
{
    var msg = {
        msg: "terrain",
        terrain: terrain
    };

    var msg_str = JSON.stringify(msg);
    update_all(msg_str);
}

function update_tanks()
{
    var msg = {
        msg: "tanks",
        tanks: tanks
    };
    
    var msg_str = JSON.stringify(msg, function(key, value) {
        return key == "ws" ? undefined : value;
    });

    update_all(msg_str);
}

function update_all(msg_str)
{
    for (var ws of wss.clients) {
        ws.send(msg_str);
    }
}

function get_tank(ws, name)
{
    if (name == "") {
        return "Empty name not allowed.";
    }

    var tank = tanks.find(tank => tank.name == name);
    if (tank) {
        return "Tank " + name + " already joined.";
    }

    var tank = tanks.find(tank => tank.ws == ws);
    if (tank) {
        return "Tank " + tank.name + " already joined.";
    }

    tank = {
        ws: ws,
        name: name,
        angle: Math.PI/4 + Math.PI/2 * Math.random(),
        energy: MAX_ENERGY,
        color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]
    }

    return get_slot(tank);
}

function get_slot(new_tank)
{
    for (var j = 0; j < 100; j++) {
        var slot = Math.floor(MAX_PLAYERS * Math.random());
        
        var i = tanks.findIndex(tank => tank.slot == slot);
        if (i != -1) {
            var tank = tanks[i];
            if (tank && tank.energy >= 0) {
                continue;
            }
        }

        new_tank.slot = slot;
        new_tank.x = PLAYER_START_X + PLAYER_SPACING * slot;
        new_tank.y = terrain[new_tank.x];

        if (i != -1) {
            tanks[i] = new_tank;
        }
        else {
            tanks.push(new_tank);
        }

        return new_tank;
    }

    return "Could not get slot for tank.";
}

function gen_terrain()
{
	var n_terrain = [];

    // Naive terrain
	for (var i = 0; i < TERRAIN_WIDTH; i++) {
    	n_terrain[i] = MAX_TERRAIN_HEIGHT * Math.random();
    	terrain[i] = TERRAIN_BASE;
    }
        
	// Iterate terrain
    for (var it = 0; it < NUM_ITERATIONS; it++) {
        var we = TERRAIN_SCALE / (2 ** (NUM_ITERATIONS - it));
        var step = 2 ** it;

		var s_terrain = [];
		for (var i = 0; i < TERRAIN_WIDTH; i+= step) {
            s_terrain[i] = we * n_terrain[i];
			if (1 && i > 0 && step > 1) {
            	var y1 = s_terrain[i-step];
            	var y2 = s_terrain[i];
                var dx = 0;
            	for (var j = i-step; j < i; j++) {
                	s_terrain[j] = y1 + (y2-y1)/step * dx;
	            	terrain[j] += s_terrain[j];
                    dx++;
                }
            }
            else {
                terrain[i] += s_terrain[i];
            }
	    }
    }

    // Shorten data
    terrain = terrain.slice(TERRAIN_SEND_OFFSET, TERRAIN_SEND_OFFSET + TERRAIN_SEND_WIDTH);

    // Round all values
    for (var i = 0; i < TERRAIN_WIDTH; i++) {
        terrain[i] = parseInt(terrain[i]);
    }
}

function update_game()
{
    game.set_time--;
    if (game.set_time <= 0) {
        game.set_time = GAME_SET_TIME;

        scores_set = [];
        gen_terrain();

        // Update y positions
        for (var tank of tanks) {
            tank.y = terrain[tank.x];
        }

        update_new_terrain();
        update_tanks();
    }

    update_scores();
}
