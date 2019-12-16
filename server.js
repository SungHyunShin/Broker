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
app.use('/client', express.static(__dirname + '/client'));
app.use('/images/', express.static(__dirname + '/client/images'));
// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, '/client/index.html'));
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
    if(!(gameCode in games)){
      socket.emit('gameDNE','');
      return;
    }
    if('inGame' in games[gameCode])
    if(games[gameCode]['inGame'])
    return;
    if(playerName.length>12||playerName.length==0||gameCode.length!=5) return;

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
          // need to remove player from actor list
          if(!('gameValues' in games[gameCode])) return;
          if(!('currentRound' in games[gameCode]['gameValues'])) return;
          io.to(gameCode).emit('disconnectedPlayerGame',{'playerName':playerName,'memberList':games[gameCode]['memberList']});
          // if in current round, need to check if they are the actor
          // if one actor is now left, give entire pot to the actor and start new round
          var actingName = games[gameCode]['gameValues']['currentRound']['toAct'][0];
          if(games[gameCode]['gameValues']['currentRound']['toAct'].includes(playerName)) games[gameCode]['gameValues']['currentRound']['toAct'].splice(games[gameCode]['gameValues']['currentRound']['toAct'].indexOf(playerName),1);
          if(games[gameCode]['gameValues']['currentRound']['playersIn'].includes(playerName)) games[gameCode]['gameValues']['currentRound']['playersIn'].splice(games[gameCode]['gameValues']['currentRound']['playersIn'].indexOf(playerName),1);
          if(games[gameCode]['gameValues']['bb'].includes(playerName)) games[gameCode]['gameValues']['bb'].splice(games[gameCode]['gameValues']['bb'].indexOf(playerName),1);
          currentRound = games[gameCode]['gameValues']['currentRound'];
          console.log("line 309");
          console.log(games[gameCode]['gameValues']);

          if(currentRound['playersIn'].length<=1){
            if(actingName!=playerName){
              io.to(nameToId[actingName]).emit('turnOver');
            }
            // pot logic
            potLogic(gameCode);
            if(games[gameCode]['gameValues']['bb'].length == 1){
              io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
              return;
            }
            // go to next round
            console.log("ROUND OVER");
            var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
            clearTimeout(timer);
          }

          if(currentRound['toAct'].length==0){
            // reset list to playersIn
            games[gameCode]['gameValues']['currentRound']['toAct'] = games[gameCode]['gameValues']['currentRound']['playersIn'].slice(0);

            for(var i = 0; i< games[gameCode]['gameValues']['currentRound']['toAct'].length;i++){
              if(games[gameCode]['gameValues']['currentRound']['toAct'][i] in games[gameCode]['gameValues']['currentRound']['allIn']) {
                games[gameCode]['gameValues']['currentRound']['toAct'].splice(i,1);
              }
            }

            // next stage
            stage = currentRound['stage'];
            switch(stage){
              case 'blinds':
              io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
              games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
              io.to(gameCode).emit('resetPots','');
              io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
              games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
              games[gameCode]['gameValues']['currentRound']['raise'] = false;
              games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
              io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
              io.to(gameCode).emit('resetBets','');
              break;

              case 'flop':
              io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
              games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
              io.to(gameCode).emit('resetPots','');
              io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
              games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
              games[gameCode]['gameValues']['currentRound']['raise'] = false;
              games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
              io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
              io.to(gameCode).emit('resetBets','');
              break;

              case 'turn':
              io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
              games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
              io.to(gameCode).emit('resetPots','');
              io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
              games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
              games[gameCode]['gameValues']['currentRound']['raise'] = false;
              games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
              io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
              io.to(gameCode).emit('resetBets','');
              break;

              case 'river':
              // calculate pot stuff and end the round
              for(var i = 0;i<currentRound['playersIn'].length;i++){
                io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
              }
              potLogic(gameCode);
              // evaluate game state and end game if needed, or start new round
              games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
              if(games[gameCode]['gameValues']['bb'].length == 1){
                io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
                return;
              }
              // go to next round
              console.log("ROUND OVER");
              var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
              return;
            }
          }
          if(games[gameCode]['gameValues']['currentRound']['toAct'].length==0&&games[gameCode]['gameValues']['currentRound']['playersIn'].length!=0){
            stage = currentRound['stage'];
            switch(stage){
              case 'blinds':
              io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
              games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
              games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
              games[gameCode]['gameValues']['currentRound']['raise'] = false;
              games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
              io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
              io.to(gameCode).emit('resetBets','');
              case 'flop':
              io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
              games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
              games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
              games[gameCode]['gameValues']['currentRound']['raise'] = false;
              games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
              io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
              io.to(gameCode).emit('resetBets','');

              case 'turn':
              io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
              games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
              games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
              games[gameCode]['gameValues']['currentRound']['raise'] = false;
              games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
              io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
              io.to(gameCode).emit('resetBets','');

              case 'river':
              // calculate pot stuff and end the round
              for(var i = 0;i<currentRound['playersIn'].length;i++){
                io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
              }
              potLogic(gameCode);
              // evaluate game state and end game if needed, or start new round
              games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
              if(games[gameCode]['gameValues']['bb'].length <= 1){
                io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
                return;
              }
              // go to next round
              console.log("ROUND OVER");
              var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
              return;
            }
          }
          if(currentRound['toAct'][0]==currentRound['sb']){
            if(!(currentRound['raise'])&&(currentRound['stage']=='blinds')) {
              io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':true,'raiseAmt':currentRound['bigBlindVal']/2});
            }
            else{
              io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
            }

            games[gameCode]['gameValues']['currentRound']['sb'] = null;

          }
          else{
            io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
          }
          if(currentRound['raise']||(currentRound['toAct'][0]==currentRound['sb']&&currentRound['stage']=='blinds')){
            if(currentRound['toAct'][0] in currentRound['roundPot'])
            var amtIn = currentRound['roundPot'][currentRound['toAct'][0]];
            else {
              var amtIn = 0;
            }
            io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. "+(currentRound['raiseAmt']-amtIn)+" to call.");
          }
          else{
            io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. ");
          }

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
      games[gameCode]['gameValues']['bb'] = games[gameCode]['memberList'].slice(0);


      // configure first round
      startNewRound(gameCode,true);
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
  socket.on('playerBet',function(betAmt){
    if(socket.id in idToName){
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];
      console.log(playerName+': playerBet');

      // check if it's their turn and legal move
      if(playerName != games[gameCode]['gameValues']['currentRound']['toAct'][0]){
        return;
      }
      betAmt = parseInt(betAmt);
      // check betSize
      if(betAmt<games[gameCode]['gameValues']['currentRound']['bigBlindVal']||
        betAmt>games[gameCode]['gameValues']['players'][playerName]['stackSize'])
        return;

      games[gameCode]['gameValues']['currentRound']['raise'] = true;
      games[gameCode]['gameValues']['currentRound']['raiseAmt'] = betAmt;

      if(playerName in games[gameCode]['gameValues']['currentRound']['pot'])
        games[gameCode]['gameValues']['currentRound']['pot'][playerName] += betAmt;
      else
        games[gameCode]['gameValues']['currentRound']['pot'][playerName] = betAmt;

      if(playerName in games[gameCode]['gameValues']['currentRound']['roundPot'])
        games[gameCode]['gameValues']['currentRound']['roundPot'][playerName] += betAmt;
      else
        games[gameCode]['gameValues']['currentRound']['roundPot'][playerName] = betAmt;

      games[gameCode]['gameValues']['players'][playerName]['stackSize'] -= betAmt;

      if(games[gameCode]['gameValues']['players'][playerName]['stackSize']==0){
        games[gameCode]['gameValues']['currentRound']['allIn'][playerName]=games[gameCode]['gameValues']['currentRound']['pot'][playerName];
      }

      games[gameCode]['gameValues']['currentRound']['totalPot']+=betAmt;
      io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
      io.to(gameCode).emit('mainPot',betAmt);

      var playerList = buildPlayerStackObject(gameCode);
      io.to(gameCode).emit('updateStacks',{'playerList':playerList,'bigBlind':games[gameCode]['gameValues']['gameSettings']['blindSize'],'raise':games[gameCode]['gameValues']['currentRound']['raise'],'raiseAmt':games[gameCode]['gameValues']['currentRound']['raiseAmt']})
      io.to(gameCode).emit('playerBet',{'playerName':playerName,'betAmt':games[gameCode]['gameValues']['currentRound']['raiseAmt']});
      // remove from actors list
      games[gameCode]['gameValues']['currentRound']['toAct'] = games[gameCode]['gameValues']['currentRound']['playersIn'].slice(0);

      while(games[gameCode]['gameValues']['currentRound']['toAct'][0]!=playerName){
        games[gameCode]['gameValues']['currentRound']['toAct'].push(games[gameCode]['gameValues']['currentRound']['toAct'].shift());
      }
      games[gameCode]['gameValues']['currentRound']['toAct'].shift();
      for(var i = 0; i< games[gameCode]['gameValues']['currentRound']['toAct'].length;i++){
        if(games[gameCode]['gameValues']['currentRound']['toAct'][i] in games[gameCode]['gameValues']['currentRound']['allIn']) {
          games[gameCode]['gameValues']['currentRound']['toAct'].splice(i,1);
        }
      }
      // send message to next actor

      socket.emit('turnOver','');
      currentRound = games[gameCode]['gameValues']['currentRound'];
      console.log("line 309");
      console.log(games[gameCode]['gameValues']);
      if(currentRound['toAct'].length==0){
        // reset list to playersIn
        games[gameCode]['gameValues']['currentRound']['toAct'] = games[gameCode]['gameValues']['currentRound']['playersIn'].slice(0);

        for(var i = 0; i< games[gameCode]['gameValues']['currentRound']['toAct'].length;i++){
          if(games[gameCode]['gameValues']['currentRound']['toAct'][i] in games[gameCode]['gameValues']['currentRound']['allIn']) {
            games[gameCode]['gameValues']['currentRound']['toAct'].splice(i,1);
          }
        }

        // next stage
        stage = currentRound['stage'];
        switch(stage){
          case 'blinds':
          io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
          games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'flop':
          io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'turn':
          io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'river':
          // calculate pot stuff and end the round
          for(var i = 0;i<currentRound['playersIn'].length;i++){
            io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
          }
          potLogic(gameCode);
          // evaluate game state and end game if needed, or start new round
          games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
          if(games[gameCode]['gameValues']['bb'].length == 1){
            io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
            return;
          }
          // go to next round
          console.log("ROUND OVER");
          var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
          return;
        }
      }
      if(games[gameCode]['gameValues']['currentRound']['toAct'].length==0&&games[gameCode]['gameValues']['currentRound']['playersIn'].length!=0){
        stage = currentRound['stage'];
        switch(stage){
          case 'blinds':
          io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
          games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          case 'flop':
          io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');

          case 'turn':
          io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');

          case 'river':
          // calculate pot stuff and end the round
          for(var i = 0;i<currentRound['playersIn'].length;i++){
            io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
          }
          potLogic(gameCode);
          // evaluate game state and end game if needed, or start new round
          games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
          if(games[gameCode]['gameValues']['bb'].length <= 1){
            io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
            return;
          }
          // go to next round
          console.log("ROUND OVER");
          var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
          return;
        }
      }
      if(currentRound['toAct'][0]==currentRound['sb']){
        if(!(currentRound['raise'])&&(currentRound['stage']=='blinds')) {
          io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':true,'raiseAmt':currentRound['bigBlindVal']/2});
        }
        else{
          io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
        }

        games[gameCode]['gameValues']['currentRound']['sb'] = null;

      }
      else{
        io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
      }
      if(currentRound['raise']||(currentRound['toAct'][0]==currentRound['sb']&&currentRound['stage']=='blinds')){
        if(currentRound['toAct'][0] in currentRound['roundPot'])
        var amtIn = currentRound['roundPot'][currentRound['toAct'][0]];
        else {
          var amtIn = 0;
        }
        io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. "+(currentRound['raiseAmt']-amtIn)+" to call.");
      }
      else{
        io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. ");
      }

    }
  });
  socket.on('playerCheck',function(){
    if(socket.id in idToName){
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];
      console.log(playerName+': playerCheck');

      // check if it's their turn and legal move
      if(playerName != games[gameCode]['gameValues']['currentRound']['toAct'][0]){
        return;
      }
      // remove from actors list
      games[gameCode]['gameValues']['currentRound']['toAct'].shift();

      // send message to next actor

      socket.emit('turnOver','');
      currentRound = games[gameCode]['gameValues']['currentRound'];
      console.log("line 309");
      console.log(games[gameCode]['gameValues']);
      if(currentRound['toAct'].length==0){
        // reset list to playersIn
        games[gameCode]['gameValues']['currentRound']['toAct'] = games[gameCode]['gameValues']['currentRound']['playersIn'].slice(0);

        for(var i = 0; i< games[gameCode]['gameValues']['currentRound']['toAct'].length;i++){
          if(games[gameCode]['gameValues']['currentRound']['toAct'][i] in games[gameCode]['gameValues']['currentRound']['allIn']) {
            games[gameCode]['gameValues']['currentRound']['toAct'].splice(i,1);
          }
        }

        // next stage
        stage = currentRound['stage'];
        switch(stage){
          case 'blinds':
          io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
          games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'flop':
          io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'turn':
          io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'river':
          // calculate pot stuff and end the round
          for(var i = 0;i<currentRound['playersIn'].length;i++){
            io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
          }
          potLogic(gameCode);
          // evaluate game state and end game if needed, or start new round
          games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
          if(games[gameCode]['gameValues']['bb'].length == 1){
            io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
            return;
          }
          // go to next round
          console.log("ROUND OVER");
          var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
          return;
        }
      }
      if(games[gameCode]['gameValues']['currentRound']['toAct'].length==0&&games[gameCode]['gameValues']['currentRound']['playersIn'].length!=0){
        stage = currentRound['stage'];
        switch(stage){
          case 'blinds':
          io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
          games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          case 'flop':
          io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');

          case 'turn':
          io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');

          case 'river':
          // calculate pot stuff and end the round
          for(var i = 0;i<currentRound['playersIn'].length;i++){
            io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
          }
          potLogic(gameCode);
          // evaluate game state and end game if needed, or start new round
          games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
          if(games[gameCode]['gameValues']['bb'].length <= 1){
            io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
            return;
          }
          // go to next round
          console.log("ROUND OVER");
          var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
          return;
        }
      }
      if(currentRound['toAct'][0]==currentRound['sb']){
        if(!(currentRound['raise'])&&(currentRound['stage']=='blinds')) {
          io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':true,'raiseAmt':currentRound['bigBlindVal']/2});
        }
        else{
          io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
        }

        games[gameCode]['gameValues']['currentRound']['sb'] = null;

      }
      else{
        io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
      }
      if(currentRound['raise']||(currentRound['toAct'][0]==currentRound['sb']&&currentRound['stage']=='blinds')){
        if(currentRound['toAct'][0] in currentRound['roundPot'])
        var amtIn = currentRound['roundPot'][currentRound['toAct'][0]];
        else {
          var amtIn = 0;
        }
        io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. "+(currentRound['raiseAmt']-amtIn)+" to call.");
      }
      else{
        io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. ");
      }

    }
  });
  socket.on('playerFold',function(){
    if(socket.id in idToName){
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];
      console.log(playerName+': playerFold');

      // check if it's their turn and legal move
      if(playerName != games[gameCode]['gameValues']['currentRound']['toAct'][0]){
        return;
      }
      // send to others to remove from list
      io.to(gameCode).emit('playerFold',playerName);

      // remove from actors list
      games[gameCode]['gameValues']['currentRound']['toAct'].shift();
      // remove from players in list
      games[gameCode]['gameValues']['currentRound']['playersIn'].splice(games[gameCode]['gameValues']['currentRound']['playersIn'].indexOf(playerName), 1);

      // remove from allIn list and players list if folded while all in
      if(playerName in games[gameCode]['gameValues']['currentRound']['allIn']){
        delete games[gameCode]['gameValues']['currentRound']['allIn'][playerName];
        games[gameCode]['gameValues']['bb'].splice(games[gameCode]['gameValues']['bb'].indexOf(playerName),1);
      }
      // send message to next actor
      socket.emit('turnOver','');
      currentRound = games[gameCode]['gameValues']['currentRound'];
      console.log("line 309");
      console.log(games[gameCode]['gameValues']);

      if(currentRound['playersIn'].length==1){
        // pot logic
        potLogic(gameCode);
        if(games[gameCode]['gameValues']['bb'].length <= 1){
          io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['playersIn'][0]+" has won! Congratulations! Waiting for host to end game.");
          return;
        }
        // go to next round
        console.log("ROUND OVER");
        var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
        clearTimeout(timer);
      }

      if(currentRound['toAct'].length==0){
        // reset list to playersIn
        games[gameCode]['gameValues']['currentRound']['toAct'] = games[gameCode]['gameValues']['currentRound']['playersIn'].slice(0);

        for(var i = 0; i< games[gameCode]['gameValues']['currentRound']['toAct'].length;i++){
          if(games[gameCode]['gameValues']['currentRound']['toAct'][i] in games[gameCode]['gameValues']['currentRound']['allIn']) {
            games[gameCode]['gameValues']['currentRound']['toAct'].splice(i,1);
          }
        }

        // next stage
        stage = currentRound['stage'];
        switch(stage){
          case 'blinds':
          io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
          games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'flop':
          io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'turn':
          io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'river':
          // calculate pot stuff and end the round
          for(var i = 0;i<currentRound['playersIn'].length;i++){
            io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
          }
          potLogic(gameCode);
          // evaluate game state and end game if needed, or start new round
          games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
          if(games[gameCode]['gameValues']['bb'].length == 1){
            io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
            return;
          }
          // go to next round
          console.log("ROUND OVER");
          var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
          return;
        }
      }
      if(games[gameCode]['gameValues']['currentRound']['toAct'].length==0&&games[gameCode]['gameValues']['currentRound']['playersIn'].length!=0){
        stage = currentRound['stage'];
        switch(stage){
          case 'blinds':
          io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
          games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          case 'flop':
          io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');

          case 'turn':
          io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');

          case 'river':
          // calculate pot stuff and end the round
          for(var i = 0;i<currentRound['playersIn'].length;i++){
            io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
          }
          potLogic(gameCode);
          // evaluate game state and end game if needed, or start new round
          games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
          if(games[gameCode]['gameValues']['bb'].length <= 1){
            io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
            return;
          }
          // go to next round
          console.log("ROUND OVER");
          var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
          return;
        }
      }
      if(currentRound['toAct'][0]==currentRound['sb']){
        if(!(currentRound['raise'])&&(currentRound['stage']=='blinds')) {
          io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':true,'raiseAmt':currentRound['bigBlindVal']/2});
        }
        else{
          io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
        }

        games[gameCode]['gameValues']['currentRound']['sb'] = null;

      }
      else{
        io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
      }
      if(currentRound['raise']||(currentRound['toAct'][0]==currentRound['sb']&&currentRound['stage']=='blinds')){
        if(currentRound['toAct'][0] in currentRound['roundPot'])
        var amtIn = currentRound['roundPot'][currentRound['toAct'][0]];
        else {
          var amtIn = 0;
        }
        io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. "+(currentRound['raiseAmt']-amtIn)+" to call.");
      }
      else{
        io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. ");
      }

    }
  });
  socket.on('playerRaise',function(betAmt){
    if(socket.id in idToName){
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];
      console.log(playerName+': playerRaise');
      // check betSize
      if(betAmt<games[gameCode]['gameValues']['currentRound']['raiseAmt']||
        betAmt>games[gameCode]['gameValues']['players'][playerName]['stackSize'])
        return;

      // check if it's their turn and legal move
      if(playerName != games[gameCode]['gameValues']['currentRound']['toAct'][0]){
        return;
      }
      betAmt = parseInt(betAmt);
      raiseAmt = betAmt;
      if(playerName in games[gameCode]['gameValues']['currentRound']['roundPot'])
        raiseAmt += games[gameCode]['gameValues']['currentRound']['raiseAmt'] - games[gameCode]['gameValues']['currentRound']['roundPot'][playerName];
      else{
        raiseAmt += games[gameCode]['gameValues']['currentRound']['raiseAmt'];
      }

      if(raiseAmt>games[gameCode]['gameValues']['players'][playerName]['stackSize']){
        raiseAmt = games[gameCode]['gameValues']['players'][playerName]['stackSize'];
      }

      games[gameCode]['gameValues']['currentRound']['raise'] = true;
      games[gameCode]['gameValues']['currentRound']['raiseAmt'] += betAmt;

      if(playerName in games[gameCode]['gameValues']['currentRound']['pot'])
        games[gameCode]['gameValues']['currentRound']['pot'][playerName] += raiseAmt;
      else
        games[gameCode]['gameValues']['currentRound']['pot'][playerName] = games[gameCode]['gameValues']['currentRound']['raiseAmt'];
      if(playerName in games[gameCode]['gameValues']['currentRound']['roundPot']){
        games[gameCode]['gameValues']['players'][playerName]['stackSize'] -= raiseAmt;
        games[gameCode]['gameValues']['currentRound']['roundPot'][playerName] += raiseAmt;
      }
      else{
        games[gameCode]['gameValues']['players'][playerName]['stackSize'] -= games[gameCode]['gameValues']['currentRound']['raiseAmt'];
        games[gameCode]['gameValues']['currentRound']['roundPot'][playerName] = games[gameCode]['gameValues']['currentRound']['raiseAmt'];
      }

      if(games[gameCode]['gameValues']['players'][playerName]['stackSize']==0){
        games[gameCode]['gameValues']['currentRound']['allIn'][playerName]=games[gameCode]['gameValues']['currentRound']['pot'][playerName];
      }

      games[gameCode]['gameValues']['currentRound']['totalPot']+=betAmt;
      io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
      io.to(gameCode).emit('mainPot',betAmt);

      var playerList = buildPlayerStackObject(gameCode);
      io.to(gameCode).emit('updateStacks',{'playerList':playerList,'bigBlind':games[gameCode]['gameValues']['gameSettings']['blindSize'],'raise':games[gameCode]['gameValues']['currentRound']['raise'],'raiseAmt':games[gameCode]['gameValues']['currentRound']['raiseAmt']})
      io.to(gameCode).emit('playerBet',{'playerName':playerName,'betAmt':games[gameCode]['gameValues']['currentRound']['raiseAmt']});
      // remove from actors list
      games[gameCode]['gameValues']['currentRound']['toAct'] = games[gameCode]['gameValues']['currentRound']['playersIn'].slice(0);

      while(games[gameCode]['gameValues']['currentRound']['toAct'][0]!=playerName){
        games[gameCode]['gameValues']['currentRound']['toAct'].push(games[gameCode]['gameValues']['currentRound']['toAct'].shift());
      }
      games[gameCode]['gameValues']['currentRound']['toAct'].shift();
      for(var i = 0; i< games[gameCode]['gameValues']['currentRound']['toAct'].length;i++){
        if(games[gameCode]['gameValues']['currentRound']['toAct'][i] in games[gameCode]['gameValues']['currentRound']['allIn']) {
          games[gameCode]['gameValues']['currentRound']['toAct'].splice(i,1);
        }
      }

      // send message to next actor

      socket.emit('turnOver','');
      currentRound = games[gameCode]['gameValues']['currentRound'];
      console.log("line 309");
      console.log(games[gameCode]['gameValues']);
      if(currentRound['toAct'].length==0){
        // reset list to playersIn
        games[gameCode]['gameValues']['currentRound']['toAct'] = games[gameCode]['gameValues']['currentRound']['playersIn'].slice(0);

        for(var i = 0; i< games[gameCode]['gameValues']['currentRound']['toAct'].length;i++){
          if(games[gameCode]['gameValues']['currentRound']['toAct'][i] in games[gameCode]['gameValues']['currentRound']['allIn']) {
            games[gameCode]['gameValues']['currentRound']['toAct'].splice(i,1);
          }
        }

        // next stage
        stage = currentRound['stage'];
        switch(stage){
          case 'blinds':
          io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
          games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'flop':
          io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'turn':
          io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'river':
          // calculate pot stuff and end the round
          for(var i = 0;i<currentRound['playersIn'].length;i++){
            io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
          }
          potLogic(gameCode);
          // evaluate game state and end game if needed, or start new round
          games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
          if(games[gameCode]['gameValues']['bb'].length == 1){
            io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
            return;
          }
          // go to next round
          console.log("ROUND OVER");
          var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
          return;
        }
      }
      if(games[gameCode]['gameValues']['currentRound']['toAct'].length==0&&games[gameCode]['gameValues']['currentRound']['playersIn'].length!=0){
        stage = currentRound['stage'];
        switch(stage){
          case 'blinds':
          io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
          games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          case 'flop':
          io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');

          case 'turn':
          io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');

          case 'river':
          // calculate pot stuff and end the round
          for(var i = 0;i<currentRound['playersIn'].length;i++){
            io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
          }
          potLogic(gameCode);
          // evaluate game state and end game if needed, or start new round
          games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
          if(games[gameCode]['gameValues']['bb'].length <= 1){
            io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
            return;
          }
          // go to next round
          console.log("ROUND OVER");
          var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
          return;
        }
      }
      if(currentRound['toAct'][0]==currentRound['sb']){
        if(!(currentRound['raise'])&&(currentRound['stage']=='blinds')) {
          io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':true,'raiseAmt':currentRound['bigBlindVal']/2});
        }
        else{
          io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
        }

        games[gameCode]['gameValues']['currentRound']['sb'] = null;

      }
      else{
        io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
      }
      if(currentRound['raise']||(currentRound['toAct'][0]==currentRound['sb']&&currentRound['stage']=='blinds')){
        if(currentRound['toAct'][0] in currentRound['roundPot'])
        var amtIn = currentRound['roundPot'][currentRound['toAct'][0]];
        else {
          var amtIn = 0;
        }
        io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. "+(currentRound['raiseAmt']-amtIn)+" to call.");
      }
      else{
        io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. ");
      }

    }
  });
  socket.on('playerCall',function(){
    if(socket.id in idToName){
      var playerName = idToName[socket.id]['playerName'];
      var gameCode = idToName[socket.id]['gameCode'];
      console.log(playerName+': playerCall');

      // check if it's their turn and legal move
      if(playerName != games[gameCode]['gameValues']['currentRound']['toAct'][0]){
        return;
      }
      var callAmt = games[gameCode]['gameValues']['currentRound']['raiseAmt'];
      if(playerName in games[gameCode]['gameValues']['currentRound']['roundPot'])
        callAmt -= games[gameCode]['gameValues']['currentRound']['roundPot'][playerName];
      if(games[gameCode]['gameValues']['players'][playerName]['stackSize']<=callAmt){
        callAmt = games[gameCode]['gameValues']['players'][playerName]['stackSize'];
        if(playerName in games[gameCode]['gameValues']['currentRound']['pot']){
          games[gameCode]['gameValues']['currentRound']['allIn'][playerName]=games[gameCode]['gameValues']['currentRound']['pot'][playerName]+callAmt;
        }
        else{
          games[gameCode]['gameValues']['currentRound']['allIn'][playerName]=callAmt;
        }
        games[gameCode]['gameValues']['players'][playerName]['stackSize'] = 0;
      }
      else{
        games[gameCode]['gameValues']['players'][playerName]['stackSize'] -= callAmt;
      }

      if(playerName in games[gameCode]['gameValues']['currentRound']['pot']){
        games[gameCode]['gameValues']['currentRound']['pot'][playerName]+=callAmt;
      }
      else{
        games[gameCode]['gameValues']['currentRound']['pot'][playerName]=callAmt;
      }
      if(playerName in games[gameCode]['gameValues']['currentRound']['roundPot']){
        games[gameCode]['gameValues']['currentRound']['roundPot'][playerName]+=callAmt;
      }
      else{
        games[gameCode]['gameValues']['currentRound']['roundPot'][playerName]=callAmt;
      }
      games[gameCode]['gameValues']['currentRound']['totalPot']+=callAmt;
      io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
      io.to(gameCode).emit('mainPot',callAmt);
      if(games[gameCode]['gameValues']['players'][playerName]['stackSize']==0){ // if all in
        games[gameCode]['gameValues']['currentRound']['allIn'][playerName] = games[gameCode]['gameValues']['currentRound']['pot'][playerName];
      }
      var playerList = buildPlayerStackObject(gameCode);
      io.to(gameCode).emit('updateStacks',{'playerList':playerList,'bigBlind':games[gameCode]['gameValues']['gameSettings']['blindSize'],'raise':games[gameCode]['gameValues']['currentRound']['raise'],'raiseAmt':games[gameCode]['gameValues']['currentRound']['raiseAmt']})
      io.to(gameCode).emit('playerBet',{'playerName':playerName,'betAmt':games[gameCode]['gameValues']['currentRound']['raiseAmt']});
      // remove from actors list
      games[gameCode]['gameValues']['currentRound']['toAct'].shift();

      // send message to next actor

      socket.emit('turnOver','');
      currentRound = games[gameCode]['gameValues']['currentRound'];
      console.log("line 309");
      console.log(games[gameCode]['gameValues']);
      if(currentRound['toAct'].length==0){
        // reset list to playersIn
        games[gameCode]['gameValues']['currentRound']['toAct'] = games[gameCode]['gameValues']['currentRound']['playersIn'].slice(0);

        for(var i = 0; i< games[gameCode]['gameValues']['currentRound']['toAct'].length;i++){
          if(games[gameCode]['gameValues']['currentRound']['toAct'][i] in games[gameCode]['gameValues']['currentRound']['allIn']) {
            games[gameCode]['gameValues']['currentRound']['toAct'].splice(i,1);
          }
        }

        // next stage
        stage = currentRound['stage'];
        switch(stage){
          case 'blinds':
          io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
          games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'flop':
          io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'turn':
          io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
          io.to(gameCode).emit('resetPots','');
          io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');
          break;

          case 'river':
          // calculate pot stuff and end the round
          for(var i = 0;i<currentRound['playersIn'].length;i++){
            io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
          }
          potLogic(gameCode);
          // evaluate game state and end game if needed, or start new round
          games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
          if(games[gameCode]['gameValues']['bb'].length == 1){
            io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
            return;
          }
          // go to next round
          console.log("ROUND OVER");
          var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
          return;
        }
      }
      if(games[gameCode]['gameValues']['currentRound']['toAct'].length==0&&games[gameCode]['gameValues']['currentRound']['playersIn'].length!=0){
        stage = currentRound['stage'];
        switch(stage){
          case 'blinds':
          io.to(gameCode).emit('displayBoardFlop',games[gameCode]['gameValues']['currentRound']['board'].slice(0,3));
          games[gameCode]['gameValues']['currentRound']['stage'] = 'flop';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');

          case 'flop':
          io.to(gameCode).emit('displayBoardTurn',games[gameCode]['gameValues']['currentRound']['board'].slice(3,4)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'turn';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');


          case 'turn':
          io.to(gameCode).emit('displayBoardRiver',games[gameCode]['gameValues']['currentRound']['board'].slice(4,5)[0]);
          games[gameCode]['gameValues']['currentRound']['stage'] = 'river';
          games[gameCode]['gameValues']['currentRound']['roundPot'] = {};
          games[gameCode]['gameValues']['currentRound']['raise'] = false;
          games[gameCode]['gameValues']['currentRound']['raiseAmt'] = games[gameCode]['gameValues']['currentRound']['bigBlindVal'];
          io.to(gameCode).emit('updateMinRanges',games[gameCode]['gameValues']['currentRound']['bigBlindVal']);
          io.to(gameCode).emit('resetBets','');


          case 'river':
          // calculate pot stuff and end the round
          for(var i = 0;i<currentRound['playersIn'].length;i++){
            io.to(gameCode).emit('revealCard',{'playerName':currentRound['playersIn'][i],'hand':currentRound['hands'][currentRound['playersIn'][i]]});
          }
          potLogic(gameCode);
          // evaluate game state and end game if needed, or start new round
          games[gameCode]['gameValues']['currentRound']['stage'] = 'over';
          if(games[gameCode]['gameValues']['bb'].length <= 1){
            io.to(gameCode).emit('userMessage',games[gameCode]['gameValues']['bb'][0]+" has won! Congratulations! Waiting for host to end game.");
            return;
          }
          // go to next round
          console.log("ROUND OVER");
          var timer = setTimeout(function(){startNewRound(gameCode,false)},5000);
          return;
        }
      }
      if(currentRound['toAct'][0]==currentRound['sb']){
        if(!(currentRound['raise'])&&(currentRound['stage']=='blinds')) {
          io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':true,'raiseAmt':currentRound['bigBlindVal']/2});
        }
        else{
          io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
        }

        games[gameCode]['gameValues']['currentRound']['sb'] = null;

      }
      else{
        io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':currentRound['raise'],'raiseAmt':currentRound['raiseAmt']});
      }
      if(currentRound['raise']||(currentRound['toAct'][0]==currentRound['sb']&&currentRound['stage']=='blinds')){
        if(currentRound['toAct'][0] in currentRound['roundPot'])
        var amtIn = currentRound['roundPot'][currentRound['toAct'][0]];
        else {
          var amtIn = 0;
        }
        io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. "+(currentRound['raiseAmt']-amtIn)+" to call.");
      }
      else{
        io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. ");
      }

    }
  });
  // game FUNCTIONS
  function startNewRound(gameCode,firstRound){
    if(!firstRound)
    io.to(gameCode).emit('resetBoard','');
    games[gameCode]['gameValues']['bb'] = shiftArray(games[gameCode]['gameValues']['bb']);
    smallBlind = games[gameCode]['gameValues']['bb'][0];
    bigBlind = games[gameCode]['gameValues']['bb'][1];
    games[gameCode]['gameValues']['currentRound'] = createNewRound(gameCode,smallBlind,bigBlind);
    // function to hide socket ids from client. Security reasons
    playerList = buildPlayerStackObject(gameCode);

    if(firstRound)
    io.to(gameCode).emit('gameStartRedirect',{'playerList':playerList,'bigBlind':games[gameCode]['gameValues']['gameSettings']['blindSize'],'memberList':games[gameCode]['memberList']});
    else
    io.to(gameCode).emit('updateStacks',{'playerList':playerList,'bigBlind':games[gameCode]['gameValues']['gameSettings']['blindSize'],'raise':games[gameCode]['gameValues']['currentRound']['raise'],'raiseAmt':games[gameCode]['gameValues']['currentRound']['raiseAmt']});
    dealCards(currentRound,buildPlayerStackObject(gameCode));
    console.log("line 390");
    console.log(games[gameCode]['gameValues']);
    io.to(nameToId[currentRound['toAct'][0]]).emit('toAct',{'raise':true,'raiseAmt':currentRound['raiseAmt']});
    io.to(gameCode).emit('resetPots','');
    io.to(gameCode).emit('totalPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
    io.to(gameCode).emit('mainPot',games[gameCode]['gameValues']['currentRound']['totalPot']);
    if(currentRound['toAct'][0]==currentRound['sb']){
      io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. "+(currentRound['raiseAmt']-currentRound['bigBlindVal']/2).toString()+" to call.");
    }
    else{
      io.to(gameCode).emit('userMessage',currentRound['toAct'][0]+" to act. "+(currentRound['raiseAmt']).toString()+" to call.");
    }
  }

  function potLogic(gameCode){
    if(!(gameCode in games)) return;
    needWinner = true;
    givePrizes = {}
    playersInHands = {};
    playersWithHands = Object.keys(games[gameCode]['gameValues']['currentRound']['hands']);
    for(var i = 0;i<playersWithHands.length;i++){
      if(games[gameCode]['gameValues']['currentRound']['playersIn'].includes(playersWithHands[i]))
      playersInHands[playersWithHands[i]]=games[gameCode]['gameValues']['currentRound']['hands'][playersWithHands[i]];
    };
    while(needWinner){
      winners = calcPot(playersInHands,games[gameCode]['gameValues']['currentRound']['board'],games[gameCode]['gameValues']['currentRound']['totalPot']);
      for(var i = 0; i<winners.length;i++){
        givePrizes[winners[i]['name']] = games[gameCode]['gameValues']['currentRound']['pot'][winners[i]['name']];
        if(winners[i]['name'] in games[gameCode]['gameValues']['currentRound']['allIn']){
          delete playersInHands[winners[i]['name']];
        }
        else{
          needWinner = false;
        }
      }
      if(Object.keys(playersInHands).length==0){
        needWinner = false;
      }
    }


    var sortablePZ = [];
    prizeWinners = Object.keys(givePrizes);
    for (var i=0;i<prizeWinners.length;i++) {
      sortablePZ.push([prizeWinners[i], givePrizes[prizeWinners[i]]]);
    }
    sortablePZ.sort(function(a, b) {
      return a[1] - b[1];
    });
    pot = games[gameCode]['gameValues']['currentRound']['pot'];
    var sortablePC = [];
    potKeys = Object.keys(pot);
    for (var i=0;i<potKeys.length;i++){
      sortablePC.push([potKeys[i], pot[potKeys[i]]]);
    }
    sortablePC.sort(function(a, b) {
      return a[1] - b[1];
    });


    for(var i = 0;i<sortablePZ.length-1;i++){
      if(sortablePZ[i][1]==sortablePZ[i+1][1]){
        sortablePZ[i].push(true);
      }
      else{
        sortablePZ[i].push(false);
      }
    }

    sortablePZ[sortablePZ.length-1].push(false);
    message = "";
    for(var i = 0;i<sortablePZ.length;i++){
      var winnings = 0;
      var newSortablePC = sortablePC.slice(0);
      for(var j = 0;j<sortablePC.length;j++){
        winnings += sortablePC[j][1];
        newSortablePC.shift();
        if((sortablePC[j][0]==sortablePZ[i][0])&&(i!=sortablePZ.length-1)){
          break;
        }
      }
      sortablePC = newSortablePC.slice(0);
      if(sortablePZ[i][2]){
        var j = i;
        var tieCount = 1;
        while(sortablePZ[j][2]){
          j++;
          tieCount++;
        }
        while(i<j){
          console.log(sortablePZ[i][0]+" HAS WON "+winnings+". ");
          message += sortablePZ[i][0]+" had won "+winnings+". "
          games[gameCode]['gameValues']['players'][sortablePZ[i++][0]]['stackSize'] += winnings/tieCount;
        }
        i--;
      }
      else{
        console.log(sortablePZ[i][0]+" HAS WON "+winnings+". ");
        message += sortablePZ[i][0]+" had won "+winnings+". "
        games[gameCode]['gameValues']['players'][sortablePZ[i][0]]['stackSize'] += winnings;
      }
    }
    io.to(gameCode).emit('displayWinner',message);
    var players = Object.keys(games[gameCode]['gameValues']['players']);
    for(var i = 0; i < players.length;i++){
      if(games[gameCode]['gameValues']['players'][players[i]]['stackSize']==0)
      games[gameCode]['gameValues']['bb'].splice(games[gameCode]['gameValues']['bb'].indexOf(players[i]),1);
    }
  }

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
    currentRound['playersIn'] = games[gameCode]['gameValues']['bb'].slice(0);
    currentRound['hands'] = {};
    for(var i =0; i < games[gameCode]['gameValues']['bb'].length;i++){
      currentRound['hands'][games[gameCode]['gameValues']['bb'][i]] = myDeck.draw(2);
    };
    currentRound['stage'] = 'blinds';
    currentRound['board'] = myDeck.draw(5);
    currentRound['bb'] = bigBlind;
    currentRound['sb'] = smallBlind;
    currentRound['allIn'] = {};
    currentRound['pot'] = {}
    currentRound['roundPot']={}
    currentRound['totalPot']=0
    if(games[gameCode]['gameValues']['players'][bigBlind]['stackSize']>currentRound['bigBlindVal']){
      currentRound['pot'][bigBlind] = currentRound['bigBlindVal'];
      currentRound['roundPot'][bigBlind] = currentRound['bigBlindVal'];
      currentRound['totalPot']+=currentRound['bigBlindVal'];
      games[gameCode]['gameValues']['players'][bigBlind]['stackSize']-=currentRound['bigBlindVal'];
    }
    else{
      currentRound['pot'][bigBlind] = games[gameCode]['gameValues']['players'][bigBlind]['stackSize'];
      currentRound['roundPot'][bigBlind] = games[gameCode]['gameValues']['players'][bigBlind]['stackSize'];
      currentRound['totalPot']+=games[gameCode]['gameValues']['players'][bigBlind]['stackSize'];
      currentRound['allIn'][bigBlind]=currentRound['pot'][bigBlind];
      games[gameCode]['gameValues']['players'][bigBlind]['stackSize']=0;
    }
    if(games[gameCode]['gameValues']['players'][smallBlind]['stackSize']>currentRound['bigBlindVal']/2){
      currentRound['pot'][smallBlind] = currentRound['bigBlindVal']/2;
      currentRound['roundPot'][smallBlind] = currentRound['bigBlindVal']/2;
      currentRound['totalPot']+=currentRound['bigBlindVal']/2;
      games[gameCode]['gameValues']['players'][smallBlind]['stackSize']-=currentRound['bigBlindVal']/2;
    }
    else{
      currentRound['pot'][smallBlind] = games[gameCode]['gameValues']['players'][smallBlind]['stackSize'];
      currentRound['roundPot'][smallBlind] = games[gameCode]['gameValues']['players'][smallBlind]['stackSize'];
      currentRound['totalPot']+=games[gameCode]['gameValues']['players'][smallBlind]['stackSize'];
      currentRound['allIn'][smallBlind]=currentRound['pot'][smallBlind];
      games[gameCode]['gameValues']['players'][smallBlind]['stackSize']=0;
    }
    currentRound['toAct'] = currentRound['playersIn'].slice(0);
    if(smallBlind in currentRound['allIn'])
      currentRound['toAct'].shift();
    else
      currentRound['toAct'].push(currentRound['toAct'].shift()); // move bigblind to end of list
    if(bigBlind in currentRound['allIn'])
      currentRound['toAct'].shift();
    else
      currentRound['toAct'].push(currentRound['toAct'].shift()); // move smallblind to end of list
    currentRound['raise'] = false;
    currentRound['raiseAmt'] = currentRound['bigBlindVal'];
    return currentRound;
  }

  function dealCards(currentRound,playerStack){
    for(i=0; i<currentRound['playersIn'].length;i++){
      io.to(nameToId[currentRound['playersIn'][i]]).emit(
        'dealCards',{'players':currentRound['playersIn'],'playerStack':playerStack,'hand':currentRound['hands'][currentRound['playersIn'][i]],
        'bbPlayer':currentRound['bb'],'sbPlayer':currentRound['sb'],'bigBlind':currentRound['bigBlindVal']});
      }
    }

    function calcPot(listOfHands, board, pot) {
      //Object.values returns values of dictionary
      //grab hands and names
      justHands = Object.values(listOfHands);
      justNames = Object.keys(listOfHands);
      solvedHands = [];
      solvedHandDict=[];

      for (n = 0; n < justNames.length; n++) {

        //get hands in correct form
        var eachHand = Hand.solve(justHands[n].concat(board));
        var tempHand = eachHand;
        var winnerHand = Hand.winners([eachHand,eachHand]);

        //push solved hands to dictionary
        solvedHandDict.push({ key: justNames[n],
          value: winnerHand[0]
        });
        solvedHands.push(tempHand);
      }
      var winner = Hand.winners(solvedHands);
      winnerList=[];
      //compare solved hands to the winners, to see who won
      for (j=0; j< winner.length; j++)
      {
        for (k=0; k<solvedHandDict.length; k++){
          if(winner[j]['cardPool']===solvedHandDict[k]['value']['cardPool']){
            winnerList.push(solvedHandDict[k]['key']);

          }
        }
      }
      //divide pot amongst players
      potVal = Math.ceil(pot/winnerList.length);
      winnerDict = [];

      for( z =0; z<winnerList.length; z++){
        var newdict= {name:winnerList[z],
          value: potVal}

          winnerDict.push(newdict);
        }
        return winnerDict;
      }

    });


    // function to log messages sent to server
    io.on('message', function(data){
      console.log(data);
    });
