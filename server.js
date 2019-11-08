// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');var app = express();
var server = http.Server(app);
var io = socketIO(server);
app.set('port', 5000);
app.use('/backEnd', express.static(__dirname + '/backEnd'));
// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, '/frontEnd/landing_page.html'));
});
// Starts the server.
server.listen(5000, function() {
  console.log('Starting server on port 5000');
});

var games = [];
var gameC = 0;

// Add the WebSocket handlers
io.on('connection', function(socket) {
  var game = "";
  socket.on('roomCreate', function(){
    gameC += 1;
    game = gameC.toString().padStart(5, "0");
    console.log(game);
  });
});
