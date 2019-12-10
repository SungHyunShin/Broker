// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var Hand = require('pokersolver').Hand;
var Deck = require('card-deck');
var socketIO = require('socket.io');
var app = express();
var server = http.Server(app);
var io = socketIO(server);
app.set('port', 5000);
app.use('/backEnd', express.static(__dirname + '/backEnd'));
app.use('/images/', express.static(__dirname + '/backEnd/images'));
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
var nameToId = {};

// Add the WebSocket handlers
io.on('connection', function(socket) {
  console.log(socket.id+" connected")
  socket.on('roomInit', function(roomInitValues){
    var playerName = roomInitValues['playerName'];
    var roomSizeLimit = roomInitValues['roomSizeLimit'];
    var gameType = roomInitValues['gameType'];

    if(playerName.length>12||playerName.length==0||roomSizeLimit<2||roomSizeLimit>8||!(gameType=='T'||gameType=='B')) return;

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
    nameToId[playerName] = socket.id;
    socket.join(gameCode,function(){console.log(playerName+" joined "+gameCode)});
    socket.emit('redirectToLobby',games[gameCode]['memberList']);
  });
  socket.on('lobbyRedirect',function(gameCode){
    if(gameCode in games){
      socket.emit('redirectToLobby',games[gameCode]['memberList']);
    }
  });
  socket.on('roomJoin', function(player){
    var gameCode = player['gameCode'];
    var playerName = player['playerName'];
    if(playerName.length>12||playerName.length==0||gameCode.length!=5) return;
    if(!(gameCode in games)){
      socket.emit('gameDNE','');
    }
    else if(games[gameCode]['memberList'].includes(playerName)){
      socket.emit('nameExists','');
    }
    else if(games[gameCode]['memberList'].length>=games[gameCode]['roomSizeLimit']){
      socket.emit('roomFull','');
    }
    else{
      socket.join(gameCode,function(){console.log(playerName+" joined "+gameCode)});
      games[gameCode]['memberList'].push(playerName);
      idToName[socket.id] = {'playerName':playerName,'gameCode':gameCode};
      nameToId[playerName] = socket.id;
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

      socket.emit('clientDisconnect','');

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
      if(playerName in nameToId){
        delete nameToId[playerName];
      }
      delete idToName[socket.id];
    }
  });
  socket.on('settingsChange',function(gameSettings){
    if(socket.id in idToName){
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];
      if(!(gameCode in games)) return;
      if(games[gameCode]['inGame']==true){
        socket.emit('gameSettingsError',"You can't change settings in game. How'd you get here?");
        return;
      }
      if(!('gameSettings' in games[gameCode])){
        games[gameCode]['gameSettings'] = {'stackSize':10000,'blindSize':200,'blindIncrease':false,'roundsToIncBigBlind':0};
      }

      // because user can submit partial settings
      if('blindSize' in gameSettings){
        games[gameCode]['gameSettings']['blindSize'] = gameSettings['blindSize'];
      }
      if('stackSize' in gameSettings){
        games[gameCode]['gameSettings']['stackSize'] = gameSettings['stackSize'];
      }
      games[gameCode]['gameSettings']['blindIncrease'] = gameSettings['blindIncrease'];
      if('roundsToIncBigBlind' in gameSettings){
        games[gameCode]['gameSettings']['roundsToIncBigBlind'] = gameSettings['roundsToIncBigBlind'];
      }

      if('blindSize' in gameSettings){
        if('stackSize' in gameSettings){
          if(games[gameCode]['blindSize']>games[gameCode]['stackSize']){
            games[gameCode]['gameSettings']['blindSize'] = 200;
            socket.emit('gameSettingsError',"Blind size can't be higher than stack size! Blind size is reset to default 200");
          }
        }
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
      if(!('gameSettings' in games[gameCode])){ // no settings selected
        games[gameCode]['gameSettings'] = {'stackSize':10000,'blindSize':200,'blindIncrease':false,'roundsToIncBigBlind':0};
      }

      games[gameCode]['gameValues'] = {};
      games[gameCode]['gameValues']['gameSettings'] = games[gameCode]['gameSettings'];

      games[gameCode]['gameValues']['players'] = {};
      games[gameCode]['memberList'].forEach(function(item,index){
        games[gameCode]['gameValues']['players'][item] = {};
        games[gameCode]['gameValues']['players'][item]['playerName'] = item;
        games[gameCode]['gameValues']['players'][item]['socketId'] = nameToId[item];
        games[gameCode]['gameValues']['players'][item]['stackSize'] = games[gameCode]['gameValues']['gameSettings']['stackSize'];
      });
      games[gameCode]['gameValues']['roundsPlayed'] = 0;
      games[gameCode]['gameValues']['bb'] = games[gameCode]['memberList'];


      // configure first round
      games[gameCode]['gameValues']['bb'] = shiftArray(games[gameCode]['gameValues']['bb']);
      smallBlind = games[gameCode]['gameValues']['bb'][0];
      bigBlind = games[gameCode]['gameValues']['bb'][1];
      games[gameCode]['gameValues']['currentRound'] = createNewRound(gameCode,smallBlind,bigBlind);
      // function to hide socket ids from client. Security reasons
      playerList = buildPlayerStackObject(gameCode,games[gameCode]['gameValues']['players']);
      io.to(gameCode).emit('gameStartRedirect',{'playerList':playerList,'bigBlind':games[gameCode]['gameValues']['gameSettings']['blindSize']});

      dealCards(currentRound,buildPlayerStackObject(gameCode));

      io.to(nameToId[currentRound['playersIn'][currentRound['actor']]]).emit('toAct','');
      //games[gameCode]['gameValues']['players'].forEach()
      console.log(games[gameCode]['memberList']);
    }
    else{
      // do nothing
      console.log("ERROR: "+socket.id+" tried to start a game when it's not in one.");
    }
  });
  socket.on('backButton',function(){
    if(socket.id in idToName){
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];
      if(playerName != games[gameCode]['memberList'][0]){ return;} // if not the host. idk how anyone would be able to call this without hacking their client.
      if('inGame' in games[gameCode])
        if(games[gameCode]['inGame']==false){return;}
      games[gameCode]['inGame']=false;
      io.to(gameCode).emit('redirectToLobby',games[gameCode]['memberList']);
    }
  });
  function shiftArray(memberList){
    memberList.push(memberList.shift());
    return memberList;
  }
  function buildPlayerStackObject(gameCode){
    playerList = {};
    games[gameCode]['memberList'].forEach(function(item,index){
      playerList[item] = games[gameCode]['gameValues']['players'][item]['stackSize'];
    });
    return playerList;
  }
  // game FUNCTIONS
  function createNewRound(gameCode,smallBlind,bigBlind){
    if(games[gameCode]['gameValues']['gameSettings']['blindIncrease'])
      if(games[gameCode]['gameValues']['roundsPlayed']==games[gameCode]['gameValues']['gameSettings']['roundsToIncBigBlind'])
        games[gameCode]['gameValues']['gameSettings']['blindSize'] = 2* games[gameCode]['gameValues']['gameSettings']['blindSize'];
    currentRound = {};
    currentRound['bigBlindVal']=games[gameCode]['gameValues']['gameSettings']['blindSize'];
    myDeck = new Deck(['Ad','2d','3d','4d','5d','6d','7d','8d','9d','Td','Jd','Qd','Kd',
      'As','2s','3s','4s','5s','6s','7s','8s','9s','Ts','Js','Qs','Ks',
      'Ac','2c','3c','4c','5c','6c','7c','8c','9c','Tc','Jc','Qc','Kc',
      'Ah','2h','3h','4h','5h','6h','7h','8h','9h','Th','Jh','Qh','Kh']);
    myDeck.shuffle();
    currentRound['playersIn'] = games[gameCode]['gameValues']['bb'];
    currentRound['hands'] = {};
    Object.keys(games[gameCode]['gameValues']['players']).forEach(function(item,index){
      currentRound['hands'][item] = myDeck.draw(2);
    });
    currentRound['board'] = myDeck.draw(5);
    currentRound['bb'] = bigBlind;
    currentRound['sb'] = smallBlind;
    games[gameCode]['gameValues']['players'][bigBlind]['stackSize']=games[gameCode]['gameValues']['players'][bigBlind]['stackSize']-currentRound['bigBlindVal'];
    games[gameCode]['gameValues']['players'][smallBlind]['stackSize']=games[gameCode]['gameValues']['players'][smallBlind]['stackSize']-currentRound['bigBlindVal']/2;
    currentRound['actor'] = 0;
    return currentRound;
  }

  function dealCards(currentRound,playerStack){
    console.log(currentRound);
    for(i=0; i<currentRound['playersIn'].length;i++){
      io.to(nameToId[currentRound['playersIn'][i]]).emit(
        'dealCards',{'players':currentRound['playersIn'],'playerStack':playerStack,'hand':currentRound['hands'][currentRound['playersIn'][i]],
        'bbPlayer':currentRound['bb'],'sbPlayer':currentRound['sb'],'bigBlind':currentRound['bigBlindVal']});
    }
  }
});


// function to log messages sent to server
io.on('message', function(data){
  console.log(data);
});
