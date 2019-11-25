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
  console.log(socket.id+" connected")
  socket.on('roomInit', function(roomInitValues){
    var playerName = roomInitValues['playerName'];
    var roomSizeLimit = roomInitValues['roomSizeLimit'];
    var gameType = roomInitValues['gameType'];
    
    if(playerName.length>12||playerName.length==0||roomSizeLimit<2||roomSizeLimit>10||!(gameType=='T'||gameType=='B')) return;

    gameC += 1;
    var gameCode = gameC.toString().padStart(5, "0");
    console.log(gameCode);
    socket.emit('gameCode',gameCode);
    games[gameCode] = {};
    games[gameCode]['gameType'] = gameType;
    games[gameCode]['roomSizeLimit'] = roomSizeLimit;
    games[gameCode]['memberList'] = [playerName];
    games[gameCode]['inGame'] = false;
    idToName[socket.id] = {'playerName':playerName,'gameCode':gameCode};
    socket.join(gameCode,function(){console.log(playerName+" joined "+gameCode)});
    socket.emit('redirectToLobby',games[gameCode]['memberList']);
  });
  socket.on('roomJoin', function(player){
    var gameCode = player['gameCode'];
    var playerName = player['playerName'];
    if(playerName.length>12||playerName.length==0||gameCode.length!=5) return;
    if(!(gameCode in games)){
      socket.emit('gameDNE','');
    }
    else if(games[gameCode]['memberList'].length>=games[gameCode]['roomSizeLimit']){
      socket.emit('roomFull','');
    }
    else{
      socket.join(gameCode,function(){console.log(playerName+" joined "+gameCode)});
      games[gameCode]['memberList'].push(playerName);
      idToName[socket.id] = {'playerName':playerName,'gameCode':gameCode};
      socket.to(gameCode).emit('newUser',playerName);
      socket.emit('redirectToLobby',games[gameCode]['memberList']);
    }
  });
  socket.on('disconnect', function(){
    console.log(socket.id+" disconnected")
    if(socket.id in idToName){
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];

      // remove the player
      games[gameCode]['memberList'].splice(games[gameCode]['memberList'].indexOf(playerName),1);

      // checks for empty game
      if(games[gameCode]['memberList'].length==0){
        //socket.to(gameCode).disconnect();
        delete games[gameCode];
      }
      else{ // updates other clients
	if(games[gameCode]['inGame']==false){
          io.to(gameCode).emit('disconnectedPlayer',games[gameCode]['memberList']);
	}
        // TODO check if in game and handle logic
	else{
	  io.to(gameCode).emit('disconnectedPlayerGame',games[gameCode]['memberList']);
	}
      }
    }
  });
  socket.on('settingsChange',function(gameSettings){
    if(socket.id in idToName){
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];
      if(!(gameCode in games)) return;
      if(gameSettings['blindSize']>gameSettings['stackSize']){
         socket.emit('gameSettingsError',"Blind size can't be higher than stack size!");
         return;
      }
      if(games[gameCode]['inGame']==true){
        socket.emit('gameSettingsError',"You can't change settings in game. How'd you get here?");
        // TODO ADD BACK IN AFTER GAME REDIRECT WORKS
        //return;
      }
      games[gameCode]['gameSettings'] = gameSettings;
      socket.emit('redirectToLobby',games[gameCode]['memberList']);
    }
  });
  socket.on('startGame', function(){
    // TODO add settings checking and processing
    if(socket.id in idToName){
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];
      if(playerName != games[gameCode]['memberList'][0]){ return;} // if not the host. idk how anyone would be able to call this without hacking their client.
      if('inGame' in games[gameCode])
        if(games[gameCode]['inGame']==true){return;}
      if(games[gameCode]['memberList'].length<2||games[gameCode]['memberList'].length>10){return};
      games[gameCode]['inGame'] = true;
      io.to(gameCode).emit('gameStartRedirect',games[gameCode]['memberList']);      
      console.log('gameStartRedirect')
    }
    else{
      // do nothing
      console.log("ERROR: "+socket.id+" tried to start a game when it's not in one.");
    }
  });
});

// function to log messages sent to server
io.on('message', function(data){
  console.log(data);
});
