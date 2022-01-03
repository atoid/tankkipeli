//
// TANK WARS
// Mouse & touch controls
//

var HIT_Y;
var HIT_X_LEFT;
var HIT_X_RIGHT;
var HIT_X_FIRE;
var HIT_RADIUS;

var keys = [false, false, false];
var keys_last = [false, false, false];

function init_controls(w, h)
{
    var elem = document.getElementById("mycanvas");

    var dx = w / 3;
    var x = elem.width - w + dx / 2;

    HIT_X_LEFT = x + 0 * dx;
    HIT_X_RIGHT = x + 1 * dx;
    HIT_X_FIRE = x + 2 * dx;
    HIT_Y = elem.height - h / 2;
    HIT_RADIUS = (h / 2) ** 2;

    register_events();
    register_kbd();
}

function register_events()
{
    console.log("register_events()");
    var elem = document.getElementById("mycanvas");

    if (!in_mobile) {
        elem.onmousedown = function(event) {
            on_controls(get_event_id(event, true), true);
        }

        elem.onmouseup = function(event) {
            on_controls(get_event_id(event, false), false);
        }

        //elem.onmouseover = function(event) {
        //    on_controls(get_event_id(event), event.buttons == 1);
        //}
        
        elem.onmouseleave = function(event) {
            on_controls(get_event_id(event, false), false);
        }
    }
    else
    {
        elem.addEventListener("touchstart", function(event) {
            on_controls(get_event_id(event, true), true);
        });

        elem.addEventListener("touchend", function(event) {
            on_controls(get_event_id(event, false), false);
        });

        elem.addEventListener("touchcancel", function(event) {
            on_controls(get_event_id(event, false), false);
        });
    }
}

function get_event_id(event, active)
{
    var elem = document.getElementById("mycanvas");

    // Handle touch event
    if (event.changedTouches) {
        var tmp;
        for (var e of event.changedTouches) {
            if (e.target == elem) {
                tmp = e;
                break;
            }
        }

        if (!tmp) {
            return -1;
        }
        event = tmp;
    }

    var rect = elem.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;

    var dy = (y - HIT_Y);

    var dx = (x - HIT_X_LEFT);
    var hr = dx*dx + dy*dy;
    if (hr < HIT_RADIUS || (!active && keys[0])) {
        return 0;
    }

    var dx = (x - HIT_X_RIGHT);
    var hr = dx*dx + dy*dy;
    if (hr < HIT_RADIUS || (!active && keys[1])) {
        return 1;
    }

    var dx = (x - HIT_X_FIRE);
    var hr = dx*dx + dy*dy;
    if (hr < HIT_RADIUS || (!active && keys[2])) {
        return 2;
    }

    return -1;
}

function on_controls(id, active)
{
    if (id >= 0) {
        if (active) {
            keys[id] = true;
        }
        else {
            keys[id] = false;
        }
    }
}

function register_kbd()
{
    document.addEventListener('keydown', function(event) {
        switch (event.key) {
        
        case "ArrowLeft":
        case "a":
            keys[0] = true;
            break;
        case "ArrowRight":
        case "d":
            keys[1] = true;
            break;
        case "ArrowUp":
        case "e":
            keys[2] = true;
            break;
        default:
            break;
        }
    });

    document.addEventListener('keyup', function(event) {
        switch (event.key) {
        
        case "ArrowLeft":
        case "a":
            keys[0] = false;
            break;
        case "ArrowRight":
        case "d":
            keys[1] = false;
            break;
        case "ArrowUp":
        case "e":
            keys[2] = false;
            break;
        default:
            break;
        }
    });
}
