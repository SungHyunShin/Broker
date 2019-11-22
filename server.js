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
var idToName = {};

// Add the WebSocket handlers
io.on('connection', function(socket) {
  socket.on('roomInit', function(roomInitValues){
    var playerName = roomInitValues['playerName'];
    var roomSizeLimit = roomInitValues['roomSizeLimit'];
    var gameType = roomInitValues['gameType'];

    gameC += 1;
    var gameCode = gameC.toString().padStart(5, "0");
    console.log(gameCode);
    socket.emit('gameCode',gameCode);
    games[gameCode] = {};
    games[gameCode]['gameType'] = gameType;
    games[gameCode]['roomSizeLimit'] = roomSizeLimit;
    games[gameCode]['memberList'] = [playerName];
    idToName[socket.id] = {'playerName':playerName,'gameCode':gameCode};
    socket.emit('redirectToLobby',games[gameCode]['memberList']);
    socket.join(gameCode);
  });
  socket.on('roomJoin', function(player){
    var gameCode = player['gameCode'];
    var playerName = player['playerName'];
    if(!(gameCode in games)){
      socket.emit('gameDNE','');
    }
    else if(games[gameCode]['memberList'].length>=games[gameCode]['roomSizeLimit']){
      socket.emit('roomFull','');
    }
      else{
      socket.join(gameCode);
      games[gameCode]['memberList'].push(playerName);
      idToName[socket.id] = {'playerName':playerName,'gameCode':gameCode};
      socket.to(gameCode).emit('newUser',playerName);
      socket.emit('redirectToLobby',games[gameCode]['memberList']);
    }
  });
  socket.on('disconnect', function(){
    if(socket.id in idToName){
      // TODO check if in game and handle logic
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];

      // remove the player
      games[gameCode]['memberList'].splice(games[gameCode]['memberList'].indexOf(playerName),1);

      // checks for empty game
      if(games[gameCode]['memberList'].length==0){
        socket.to(gameCode).disconnect();
        delete games[gameCode];
      }
      else{ // updates other clients
        socket.to(gameCode).emit('disconnectedPlayer',games[gameCode]['memberList']);
      }
    }
  });
});

io.on('message', function(data){
  console.log(data);
});
