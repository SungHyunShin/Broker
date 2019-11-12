// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var app = express();
var server = http.Server(app);
var io = socketIO(server);
app.set('port', 5000);
app.use('/backEnd', express.static(__dirname + '/backEnd'));
// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, '/frontEnd/index.html'));
});
// Starts the server.
server.listen(5000, function() {
  console.log('Starting server on port 5000');
});

var games = {};
var gameC = 0;

// Add the WebSocket handlers
io.on('connection', function(socket) {
  socket.on('roomInit', function(){
    gameC += 1;
    var game = gameC.toString().padStart(5, "0");
    console.log(game);
    socket.emit('gameCode',game);
    socket.emit('redirectLobbyHost',"");
    games[game] = ['STANDINHOSTUSERNAME'];
    socket.join(game);
  });
  socket.on('roomJoin', function(player){
    var gameCode = player['gameCode'];
    var playerName = player['playerName'];
    socket.emit('message',games);
    socket.emit('message',gameCode);
    socket.emit('message',playerName);
    if(gameCode in games){
      socket.emit('message','game exists');
      socket.join(gameCode);
      games[gameCode].push(playerName);
      socket.emit('redirectLobbyUser',"");
    }
    else{
      socket.emit('message','game does not exist');
    }
  });
});

io.on('message', function(data){
  console.log(data);
});
