var socket = io();

// Local variables
var playerName = '';
var gameCode = '';
var seats = {};
var mainPotCurr = 0;

// Incoming message from server handlers
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
socket.on('disconnect',function(){
  document.getElementById('mainDiv').innerHTML = `
  <h4>You've been disconnected by the server.</h4>
  `;
  document.getElementById("bigDiv").style.display = "";
  document.getElementById("boardDiv").innerHTML =``;
  document.getElementById("boardDiv").style.display = "none";
  document.getElementById("exitDiv").innerHTML =``;
});
socket.on('displayBoardFlop',function(cards){
  displayFlop(cards);
});
socket.on('displayBoardTurn',function(card){
  displayTurn(card);
});
socket.on('revealCard',function(data){
  playerN = data['playerName'];
  hand = data['hand'];
  seat = seats[playerN];
  buildCards(hand,seat);
});
socket.on('updateMinRanges',function(data){
  document.getElementById("rangeInput").min = parseInt(data);
  document.getElementById("betInput").min = parseInt(data);
  document.getElementById("minPrice").innterHTML = data;
  if(parseInt(data)>document.getElementById("rangeInput").max){
    document.getElementById("rangeInput").max = parseInt(data);
    document.getElementById("betInput").max = parseInt(data);
    document.getElementById("maxPrice").innterHTML = data;
  }

})
socket.on('displayBoardRiver',function(card){
  displayRiver(card);
});
socket.on('resetBoard',function(){
  resetBoard();
  removeAllChips();
});
socket.on('resetBets',function(){
  seatKeys = Object.keys(seats);
  for(var i=0; i < seatKeys.length;i++){
    document.getElementById(seats[seatKeys[i]]+"bet").style.visibility="hidden";
    document.getElementById(seats[seatKeys[i]]+"bet").innerHTML = ``;
  }
});
socket.on('message', function(data) {
  console.log(data);
});
socket.on('redirectToLobby',function(memberList){
  redirectToLobbyFunc(memberList);
  document.getElementById('boardDiv').innerHTML = ``;
  document.getElementById('exitDiv').innerHTML =``;
  document.getElementById("bigDiv").style.display = "block";
});
socket.on('nameExists',function(){
  alert("Someone with that name already exists in the lobby. Please pick a different name.");
});
socket.on('dealCards',function(data){
  dealInitial(data['players'], data['hand'], data['bbPlayer'], data['sbPlayer'],data['bigBlind']);
});
socket.on('gameStartRedirect',function(data){
  gameStartRedirect(data['playerList'],data['bigBlind'],data['memberList']);
});
socket.on('disconnectedPlayerGame',function(data){
  console.log(data);
  playerN = data['playerName'];
  memberList = data['memberList'];
  if(playerName==memberList[0]){
    document.getElementById("exitDiv").innerHTML =
    `<div class="col-sm-9 col-md-10 col-lg-10 mx-auto">
      <button id = "backButton" class="btn pull-left btn-outline-success my-2 my-sm-0 mr-sm-2" data-toggle="modal" data-target="#myModal" type="button">End Game?</button>
    </div>
    <div class="modal fade" id="myModal" role="dialog">
      <div class="modal-dialog">
        <!-- Modal content-->
        <div class="modal-content">
          <div class="modal-header">
            <h4 class="modal-title">Are you sure?</h4>
          </div>
          <div class="modal-footer">
            <button type="button" id="yesClose" class="btn btn-default" data-dismiss="modal" onclick="socket.emit('backButton','');">Yes. End game.</button>
            <button type="button" class="btn btn-default" data-dismiss="modal">No. Don't end.</button>
          </div>
        </div>
      </div>
    </div>`;
  }
  //TODO: probably just delete the player as game logic is handled by just the server.
  document.getElementById(seats[playerN]+'card1').style.backgroundImage=``;
  document.getElementById(seats[playerN]+'card2').style.backgroundImage=``;
  document.getElementById(seats[playerN]+"name").innerHTML=``;
  document.getElementById(seats[playerN]+"chips").innerHTML=``;
  delete seats[playerN];
});
socket.on('playerFold',function(playerName){
  seat = seats[playerName];
  displayNull(seat);
});
socket.on('roundOver',function(){
  removeAllBets();
});
socket.on('newUser',function(playerName){
  addUser(playerName);
});
socket.on('gameDNE',function(){
  alert("That game does not exist.");
});
socket.on('roomFull',function(){
  alert("That room is full.");
});
socket.on('disconnectedPlayer',function(memberList){
  redirectToLobbyFunc(memberList);
});
socket.on('gameCode',function(data){
  gameCode = data;
});
socket.on('totalPot',function(totalPotAmt){
  document.getElementById("totalPot").innerHTML = 'Total Pot: '+(totalPotAmt).toString();
});
socket.on('mainPot',function(mainPotAmt){
  mainPotCurr += mainPotAmt;
  document.getElementById("mainPot").innerHTML = 'Main Pot: '+(mainPotCurr).toString();
});
socket.on('resetPots',function(){
  mainPotCurr = 0;
  document.getElementById("totalPot").innerHTML = 'Total Pot:';
  document.getElementById("mainPot").innerHTML = 'Main Pot: 0';
})
socket.on('gameSettingsError',function(message){
  alert(message);
});
socket.on('userMessage',function(message){
  document.getElementById("messToUser").innerHTML = message;
});
socket.on('displayWinner',function(message){
  document.getElementById("winner").innerHTML = message;
  setTimeout(function(){document.getElementById("winner").innerHTML = '';}, 5000);
});
socket.on('playerBet',function(data){
  playerN = data['playerName'];
  betAmt = data['betAmt'];
  seat=seats[playerN];
  document.getElementById(seat+"bet").style.visibility="visible";
  document.getElementById(seat+"bet").innerHTML=betAmt;
});
socket.on('toAct',function(raiseData){
  raise = raiseData['raise'];
  raiseAmt = raiseData['raiseAmt'];

  document.getElementById("btn1").disabled=false;
  document.getElementById("btn2").disabled=false;
  document.getElementById("btn3").disabled=false;
  if(raise){
    document.getElementById("btn1").innerHTML="Raise"; // needs checking
    document.getElementById("btn2").innerHTML="Call"; // needs checking
    document.getElementById("btn1").removeEventListener("click",bet);
    document.getElementById("btn2").removeEventListener("click",check);
    document.getElementById("btn1").addEventListener("click",raiseF);
    document.getElementById("btn2").addEventListener("click",call);
  }
  else{
    document.getElementById("btn1").removeEventListener("click",raiseF);
    document.getElementById("btn2").removeEventListener("click",call);
    document.getElementById("btn1").addEventListener("click",bet);
    document.getElementById("btn2").addEventListener("click",check);
  }
  document.getElementById("btn3").addEventListener("click",function(){
    socket.emit('playerFold','');
  });
});
socket.on('turnOver',function(){
  document.getElementById("btn1").innerHTML="Bet"; // needs checking
  document.getElementById("btn2").innerHTML="Check"; // needs checking
  document.getElementById("btn1").disabled=true;
  document.getElementById("btn2").disabled=true;
  document.getElementById("btn3").disabled=true;
})
socket.on('updateStacks',function(data){
  playerList = data['playerList'];
  raise = data['raise'];
  BB= data['bigBlind'];
  if(raise)
    BB = data['raiseAmt'];

  seatList = [];
  memberList = Object.keys(playerList);
  for(var i = memberList.indexOf(playerName) ; i < memberList.length;i++){
    seatList.push(memberList[i]);
  }
  for(var i=0; i < memberList.indexOf(playerName);i++){
    seatList.push(memberList[i]);
  }
  updateSeats(seatList,playerList);
  message = document.getElementById('winner').innerHTML;
  document.getElementById('inputCard').innerHTML = `<div class="card card-signin text-center">
      <div class="card-body">
      <div class="row">
        <p class="text-left" id="winner">`+message+`</p>
      </div>
        <div class="row">
          <p class="text-left" id="messToUser"></p>
        </div>
        <div class="row">
          <text> Bet Amount:</text>
          <input id="betInput" type="number" min="`+BB+`" max="`+playerList[playerName]+`" onkeypress = "return isNumberBet(event) value="`+BB+`";">
        </div>
        <div class="row">
          <div id="minPrice">`+BB+`</div>
          <input id="rangeInput" type="range" min="`+BB+`" max="`+playerList[playerName]+`" oninput="betInput.value=rangeInput.value" value="`+BB+`">
          <div id="maxPrice">`+playerList[playerName]+`</div>
        </div>
        <div class="row">
          <form class="form-inline">
            <button id="btn1" class="btn btn-primary" type="button">Bet</button>
            <button id="btn2" class="btn btn-primary" type="button">Check</button>
            <button id="btn3" class="btn btn-primary" type="button">Fold</button>
          </form>
        </div>
    </div>`;
    document.getElementById("btn1").disabled=true;
    document.getElementById("btn2").disabled=true;
    document.getElementById("btn3").disabled=true;
});
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

// Button listeners
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// room join button listener
document.getElementById("roomJoin").addEventListener("click",roomJoinFunc);

// room create button listener
document.getElementById("roomCreate").addEventListener("click",roomCreateFunc);

function raiseF(){
  if(parseInt(document.getElementById('betInput').innerHTML)>=document.getElementById('rangeInput').min
    &&parseInt(document.getElementById('betInput').innerHTML)<=document.getElementById('rangeInput').max){
    socket.emit('playerRaise',parseInt(document.getElementById('betInput').value));
  }
  else
    socket.emit('playerRaise',document.getElementById('rangeInput').value);
}
function call(){
  socket.emit('playerCall','');
}
function bet(){
  if(parseInt(document.getElementById('betInput').innerHTML)>=document.getElementById('rangeInput').min
    &&parseInt(document.getElementById('betInput').innerHTML)<=document.getElementById('rangeInput').max){
    socket.emit('playerBet',parseInt(document.getElementById('betInput').value));
  }
  else
    socket.emit('playerBet',document.getElementById('rangeInput').value);}
function check(){
  socket.emit('playerCheck','');
}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

// vvvvvv FUNCTIONS vvvvvvvv
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

// Re-direct Functions
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// room join function
function roomJoinFunc(){
  document.getElementById("mainDiv").innerHTML =
  `
  <h5 class="card-title text-center">Broker</h5>
  <form class="form-signin">
  <div class="form-group">
  <input type="email" onkeypress = "return isNameCharacter(event)" maxlength = "12" id="playerName" class="form-control" placeholder="Player Name" required autofocus>
  </div>
  <div class="form-group">
  <input type="email" id="roomCode" onkeypress = "return isNumber(event)" class="form-control" maxlength = "5" placeholder="Room Code" required autofocus>
  </div>
  <button name="room" id="roomInit" type="button" value="join" class="btn btn-lg btn-primary btn-block text-uppercase">Join Room</button>
  </form>
  `;
  // Create Lobby Listener
  document.getElementById("roomInit").addEventListener("click",function(){
    gameCode = document.getElementById('roomCode').value;
    playerName = document.getElementById('playerName').value;
    userJoinRoomFunc({'gameCode':gameCode,'playerName':playerName});
  });
}

// room create function
function roomCreateFunc(){
  document.getElementById("mainDiv").innerHTML =
  `
  <h5 class="card-title text-center">Broker</h5>
  <form class="form-signin">
  <div class="form-group">
  <input type="email" id="playerName" onkeypress = "return isNameCharacter(event)" class="form-control" maxlength = "12" placeholder="Player Name" required autofocus>
  </div>
  <div class="form-group">
  <label for="exampleFormControlSelect1">Game Type</label>
  <select class="form-control" id="gameType">
  <option>Texas Hold'em</option>
  <option>BlackJack</option>
  </select>
  </div>
  <div class="form-group">
  <label for="exampleFormControlSelect1">Room Limit</label>
  <select class="form-control" id="roomSizeLimit">
  <option>2</option>
  <option>3</option>
  <option>4</option>
  <option>5</option>
  <option>6</option>
  <option>7</option>
  <option selected="selected">8</option>
  </select>
  </div>
  <button name="room" id="roomInit" type="button" value="join" class="btn btn-lg btn-primary btn-block text-uppercase">Create Room</button>
  </form>
  `
  ;
  // Create Lobby Listener
  document.getElementById("roomInit").addEventListener("click",function(){
    var roomInitValues = {};
    playerName = document.getElementById('playerName').value;
    var gameType = document.getElementById('gameType').value == "Texas Hold'em" ? 'T' : 'B';
    roomInitValues['playerName'] = playerName;
    roomInitValues['gameType'] = gameType;
    roomInitValues['roomSizeLimit'] = document.getElementById('roomSizeLimit').value;
    hostStartRoomFunc(roomInitValues);
  });
};

// Create Lobby Function
function hostStartRoomFunc(roomInitValues){
  socket.emit("roomInit",roomInitValues);
};

// Join Lobby Function
function userJoinRoomFunc(player){
  socket.emit("roomJoin",player);
};

// all users redirect to lobby function
function redirectToLobbyFunc(memberList){
  document.getElementById("mainDiv").innerHTML =
  `
  <div id="nameDiv">
  <h5 class="card-title text-center">`+gameCode+`</h5>
  <!-- the yellow one to mark the host-->
  <div class="alert alert-warning" role="alert">`
  + memberList[0]  +
  `</div>
  <!-- Add the divs for current members -->
  </div>
  `
  for(i = 1; i < memberList.length; i++)
  {
    addUser(memberList[i]);
  }

  // if the user is a host check
  if(playerName == memberList[0]){
    document.getElementById("mainDiv").innerHTML +=
    `
    <!-- use something similar below to disable the settings menu and start game button for non host players -->
    <!-- document.getElementById("myP").style.visibility = "hidden"; -->
    <button name="room" type="button" id="settingsButton" value="start" class="btn btn-lg btn-primary btn-block text-uppercase">Game Settings</button>
    <label for="settingsButton">If not specified, default settings will be applied.</label>
    <button name="room" type="button" id="startButton" value="start" class="btn btn-lg btn-primary btn-block text-uppercase">Start Game</button>`;


    // Create Button Listeners
    document.getElementById("settingsButton").addEventListener("click",function(){
      document.getElementById("mainDiv").innerHTML = `
      <h5 class="card-title text-center">Broker</h5>
      <form class="form-signin">
      <label>Game Settings</label>
      <div class="form-group">
      <input type="email" id="stackSize" onkeypress = "return isNumber(event)" class="form-control" maxlength = "7" placeholder="Stack Size (players Starting Money)" required autofocus>
      </div>
      <div class="form-group">
      <input type="email" id="blindSize" onkeypress = "return isNumber(event)" class="form-control" maxlength = "7" placeholder="Big Blind Size" required autofocus>
      </div>
      <div class="form-group text-center">
      <input type="checkbox" class="custom-control-input" value="checked" id="blindIncrease">
      <label class="custom-control-label" for="blindIncrease">Blinds double after X Rounds?</label>
      </div>
      <div class="form-group">
      <input type="email" id="roundsToIncBigBlind" onkeypress = "return isNumber(event)" class="form-control" maxlength = "3" placeholder="Rounds before blinds double" required autofocus>
      </div>
      <button name="room" id="cancelButton" type="button" value="join" class="btn btn-lg btn-primary btn-block text-uppercase">Cancel</button>
      <button name="room" id="submitSettings" type="button" value="join" class="btn btn-lg btn-primary btn-block text-uppercase">Submit Settings</button>
      </form>
      `;
      document.getElementById("cancelButton").addEventListener("click",function()
      {
        socket.emit('lobbyRedirect',gameCode);
      });
      document.getElementById("submitSettings").addEventListener("click",function(){
        var gameSettings = {};
        if(!isNaN(parseInt(document.getElementById('stackSize').value,10)))
          gameSettings['stackSize'] = parseInt(document.getElementById('stackSize').value,10);
        if(!isNaN(parseInt(document.getElementById('blindSize').value,10)))
          gameSettings['blindSize'] = parseInt(document.getElementById('blindSize').value,10);
        if(document.getElementById('blindIncrease').checked){
          gameSettings['blindIncrease'] = true;
          gameSettings['roundsToIncBigBlind'] = parseInt(document.getElementById('roundsToIncBigBlind').value,10);
        }
        else{
          gameSettings['blindIncrease'] = false;
          gameSettings['roundsToIncBigBlind'] = 0;
        }

        socket.emit('settingsChange',gameSettings);
      });

    });
    document.getElementById("startButton").addEventListener("click",function(){
      socket.emit('startGame','');
    });
  }
};

function addUser(Name){
  document.getElementById("nameDiv").innerHTML +=
  `<div class="alert alert-secondary" role="alert">`
  +Name+
  `</div>`;
}

function gameStartRedirect(playerList,BB,memberList){
  if(playerName == memberList[0]){
    document.getElementById("exitDiv").innerHTML =
    `<div class="col-sm-9 col-md-10 col-lg-10 mx-auto">
      <button id = "backButton" class="btn pull-left btn-outline-success my-2 my-sm-0 mr-sm-2" data-toggle="modal" data-target="#myModal" type="button">End Game?</button>
    </div>
    <div class="modal fade" id="myModal" role="dialog">
      <div class="modal-dialog">
        <!-- Modal content-->
        <div class="modal-content">
          <div class="modal-header">
            <h4 class="modal-title">Are you sure?</h4>
          </div>
          <div class="modal-footer">
            <button type="button" id="yesClose" class="btn btn-default" data-dismiss="modal" onclick="socket.emit('backButton','');">Yes. End game.</button>
            <button type="button" class="btn btn-default" data-dismiss="modal">No. Don't end.</button>
          </div>
        </div>
      </div>
    </div>`;
  }
  document.getElementById("mainDiv").innerHTML =``;
  document.getElementById("bigDiv").style.display = "none";
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(navigator.userAgent)) {
    document.getElementById("boardDiv").innerHTML +=
      `<div class="zoom">
        <div class="main-body">
          <div class="poker-table-class" data-uid="">
            <div class="player-row">
              <div id = "seat4" class="seat">
                <div class="holecards">
                  <div id="4card1" class="mplayingCard"></div>
                  <div id="4card2" class="mplayingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="4name" class="player-name"></span>
                  <span id="4chips" class="chips"></span>
                </div>
                <div id="chips4" class="chipsContainer">
                  <div id="4bet" class="mchip"></div>
                  <div id="4bb" class="mchip blind"></div>
                </div>
              </div>
              <div id = "seat5"class="seat">
                <div class="holecards">
                  <div id="5card1" class="mplayingCard"></div>
                  <div id="5card2" class="mplayingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="5name" class="player-name"></span>
                  <span id="5chips" class="chips"></span>
                </div>
                <div id="chips5" class="chipsContainer">
                  <div id="5bet" class="mchip"></div>
                  <div id="5bb" class="mchip blind"></div>
                </div>
              </div>
              <div id = "seat6"class="seat">
                <div class="holecards">
                  <div id="6card1" class="mplayingCard"></div>
                  <div id="6card2" class="mplayingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="6name" class="player-name"></span>
                  <span id="6chips" class="chips"></span>
                </div>
                <div id="chips6" class="chipsContainer">
                  <div id="6bet" class="mchip"></div>
                  <div id="6bb" class="mchip blind"></div>
                </div>
              </div>
              <div id = "seat7"class="seat">
                <div class="holecards">
                  <div id="7card1" class="mplayingCard"></div>
                  <div id="7card2" class="mplayingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="7name" class="player-name"></span>
                  <span id="7chips" class="chips"></span>
                </div>
                <div id="chips7" class="chipsContainer">
                  <div id="7bet" class="mchip"></div>
                  <div id="7bb" class="mchip blind"></div>
                </div>
              </div>
            </div>
            <div class="player-row mcenter-row">
              <div id = "seat3"class="seat">
                <div class="holecards">
                  <div id="3card1" class="mplayingCard"></div>
                  <div id="3card2" class="mplayingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="3name" class="player-name"></span>
                  <span id="3chips" class="chips"></span>
                </div>
                <div class="bet"></div>
              </div>
              <div id="chips3" class="chipsContainer">
                <div id="3bet" class="mchip"></div>
                <div id="3bb" class="mchip blind"></div>
              </div>
              <div class="boardCol">
              <div class="gameBoard">
                <div class="flop-cards">
                  <div id="board1" class="mboardCard"></div>
                  <div id="board2"class="mboardCard"></div>
                  <div id="board3"class="mboardCard"></div>
                  <div id="board4"class="mboardCard"></div>
                  <div id="board5"class="mboardCard"></div>
                </div>
                <div class="mburn-cards">
                  <div id="burn1" class="mboardCard mburn1"></div>
                  <div id="burn2" class="mboardCard mburn2"></div>
                  <div id="burn3" class="mboardCard mburn3"></div>
                </div>
              </div>
              <p id="totalPot">Total Pot:</p>
              <p id="mainPot">Main Pot:</p>
              </div>

              <div id="chips8" class="chipsContainer">
                <div id="8bet" class="mchip"></div>
                <div id="8bb" class="mchip blind"></div>
              </div>
              <div id = "seat8"class="seat">
                <div class="holecards">
                  <div id="8card1" class="mplayingCard"></div>
                  <div id="8card2" class="mplayingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="8name" class="player-name"></span>
                  <span id="8chips" class="chips"></span>
                </div>
                <div class="bet"></div>
              </div>
            </div>
            <div class="player-row" >
              <div id = "seat2"class="seat">
                <div id="chips2" class="chipsContainer">
                  <div id="2bet" class="mchip"></div>
                  <div id="2bb" class="mchip blind"></div>
                </div>
                <div class="holecards">
                  <div id="2card1" class="mplayingCard"></div>
                  <div id="2card2" class="mplayingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="2name" class="player-name"></span>
                  <span id="2chips" class="chips"></span>
                </div>
              </div>
              <div id = "seat1" class="seat">
                <div id="chips1" class="chipsContainer">
                  <div id="1bet" class="mchip"></div>
                  <div id="1bb" class="mchip blind"></div>
                </div>
                <div class="holecards">
                  <div id="1card1" class="mboardCard"></div>
                  <div id="1card2" class="mboardCard"></div>
                </div>
                <div class="name-chips">
                  <span id="1name" class="player-name"></span>
                  <span id="1chips" class="chips"></span>
                </div>
              </div>
              <div class="minmax-price-container">
                <div id="inputCard"  class="card card-signin text-center">
                  <div class="card-body">
                  <div class="row">
                    <p class="text-left" id="winner"></p>
                  </div>
                  <div class="row">
                    <p class="text-left" id="messToUser"></p>
                  </div>
                  <div class="row">
                    <text> Bet Amount:</text>
                    <input id="betInput" type="number" min="`+BB+`" max="`+playerList[playerName]+`" onkeypress = "return isNumberBet(event) value="`+BB+`";">
                  </div>
                  <div class="row">
                    <div id="minPrice">`+BB+`</div>
                    <input id="rangeInput" type="range" min="`+BB+`" max="`+playerList[playerName]+`" oninput="betInput.value=rangeInput.value" value="`+BB+`">
                    <div id="maxPrice">`+playerList[playerName]+`</div>
                  </div>
                    <div class="row">
                      <form class="form-inline">
                        <button id="btn1" class="btn btn-primary" type="button">Bet</button>
                        <button id="btn2" class="btn btn-primary" type="button">Check</button>
                        <button id="btn3" class="btn btn-primary" type="button">Fold</button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>


          </div>
        </div>
      </div>`;
  }
  else{
    document.getElementById("boardDiv").innerHTML +=
      `<div class="main-body">
        <div class="margins">

          <div class="poker-table-class" data-uid="">
            <div class="player-row">
              <div id="seat4" class="seat">
                <div class="holecards">
                  <div id="4card1" class="playingCard"></div>
                  <div id="4card2" class="playingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="4name" class="player-name"></span>
                  <span id="4chips" class="chips"></span>
                </div>
                <div id="chips4" class="chipsContainer">
                  <div id="4bet" class="chip"></div>
                  <div id="4bb" class="chip blind"></div>
                </div>
              </div>
              <div id="seat5" class="seat">
                <div class="holecards">
                  <div id="5card1" class="playingCard"></div>
                  <div id="5card2" class="playingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="5name" class="player-name"></span>
                  <span id="5chips" class="chips"></span>
                </div>
                <div id="chips5" class="chipsContainer">
                  <div id="5bet" class="chip"></div>
                  <div id="5bb" class="chip blind"></div>
                </div>
              </div>
              <div id="seat6" class="seat">
                <div class="holecards">
                  <div id="6card1" class="playingCard"></div>
                  <div id="6card2" class="playingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="6name" class="player-name"></span>
                  <span id="6chips" class="chips"></span>
                </div>
                <div id="chips6" class="chipsContainer">
                  <div id="6bet" class="chip"></div>
                  <div id="6bb" class="chip blind"></div>
                </div>
              </div>
              <div id="seat7" class="seat">
                <div class="holecards">
                  <div id="7card1" class="playingCard"></div>
                  <div id="7card2" class="playingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="7name" class="player-name"></span>
                  <span id="7chips" class="chips"></span>
                </div>
                <div id="chips7" class="chipsContainer">
                  <div id="7bet" class="chip"></div>
                  <div id="7bb" class="chip blind"></div>
                </div>
              </div>
            </div>
            <div class="player-row center-row">
              <div id="seat3" class="seat">
                <div class="holecards">
                  <div id="3card1" class="playingCard"></div>
                  <div id="3card2" class="playingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="3name" class="player-name"></span>
                  <span id="3chips" class="chips"></span>
                </div>
                <div class="bet"></div>
              </div>
              <div id="chips3" class="chipsContainer">
                <div id="3bet" class="chip"></div>
                <div id="3bb" class="chip blind"></div>
              </div>
              <div class="boardCol">
              <div class="gameBoard">
                <div class="flop-cards">
                  <div id="board1" class="boardCard"></div>
                  <div id="board2" class="boardCard"></div>
                  <div id="board3" class="boardCard"></div>
                  <div id="board4" class="boardCard"></div>
                  <div id="board5" class="boardCard"></div>
                </div>
                <div class="burn-cards">
                  <div id="burn1" class="boardCard burn1"></div>
                  <div id="burn2" class="boardCard burn2"></div>
                  <div id="burn3" class="boardCard burn3"></div>
                </div>
              </div>
              <p id="totalPot">Total Pot:</p>
              <p id="mainPot">Main Pot:</p>
              </div>
              <div id="chips8" class="chipsContainer">
                <div id="8bet" class="chip"></div>
                <div id="8bb" class="chip blind"></div>
              </div>

              <div id="seat8" class="seat">
                <div class="holecards">
                  <div id="8card1" class="playingCard"></div>
                  <div id="8card2" class="playingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="8name" class="player-name"></span>
                  <span id="8chips" class="chips"></span>
                </div>
                <div class="bet"></div>
              </div>
            </div>
            <div class="player-row" >
              <div id="seat2" class="seat">
                <div id="chips2" class="chipsContainer">
                  <div id="2bet" class="chip"></div>
                  <div id="2bb" class="chip blind"></div>
                </div>
                <div class="holecards">
                  <div id="2card1" class="playingCard"></div>
                  <div id="2card2" class="playingCard"></div>
                </div>
                <div class="name-chips">
                  <span id="2name" class="player-name"></span>
                  <span id="2chips" class="chips"></span>
                </div>
              </div>
              <div id="seat1" class="seat">
                <div id="chips1" class="chipsContainer">
                  <div id="1bet" class="chip"></div>
                  <div id="1bb" class="chip blind"></div>
                </div>
                <div class="holecards">
                  <div id="1card1" class="boardCard"></div>
                  <div id="1card2" class="boardCard"></div>
                </div>
                <div class="name-chips">
                  <span id="1name" class="player-name"></span>
                  <span id="1chips" class="chips"></span>
                </div>
              </div>
              <div class="minmax-price-container">
                <div id="inputCard"  class="card card-signin text-center">
                  <div class="card-body">
                  <div class="row">
                    <p class="text-left" id="winner"></p>
                  </div>
                  <div class="row">
                    <p class="text-left" id="messToUser"></p>
                  </div>
                  <div class="row">
                    <text> Bet Amount:</text>
                    <input id="betInput" type="number" min="`+BB+`" max="`+playerList[playerName]+`" onkeypress = "return isNumberBet(event) value="`+BB+`";">
                  </div>
                  <div class="row">
                    <div id="minPrice">`+BB+`</div>
                    <input id="rangeInput" type="range" min="`+BB+`" max="`+playerList[playerName]+`" oninput="betInput.value=rangeInput.value" value="`+BB+`">
                    <div id="maxPrice">`+playerList[playerName]+`</div>
                  </div>
                    <div class="row">
                      <form class="form-inline">
                        <button id="btn1" class="btn btn-primary" type="button">Bet</button>
                        <button id="btn2" class="btn btn-primary" type="button">Check</button>
                        <button id="btn3" class="btn btn-primary" type="button">Fold</button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>`;
  }
  document.getElementById("btn1").disabled=true;
  document.getElementById("btn2").disabled=true;
  document.getElementById("btn3").disabled=true;

  // populate board with you at the bottom
  seatList = [];
  for(var i = memberList.indexOf(playerName) ; i < memberList.length;i++){
    seatList.push(memberList[i]);
  }
  for(var i=0; i < memberList.indexOf(playerName);i++){
    seatList.push(memberList[i]);
  }

  addSeats(seatList,playerList);


}

// In Game Functions
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

function displayNum(number){
  if(number<1100){
    return number;
  }
  return Math.floor(number/1000 * Math.pow(10, 1 || 0)) / Math.pow(10, 1 || 0).toString()+"k";
}

function updateSeats(seatList,playerList){
  for(var i=0; i<seatList.length;i++){
    seat = seats[seatList[i]];
    document.getElementById((seat)+"name").innerHTML=seatList[i];
    document.getElementById((seat)+"chips").innerHTML=displayNum(playerList[seatList[i]]);
  }
}

function addSeats(seatList,playerList){
  for(var i=0; i<seatList.length;i++){
    seats[seatList[i]] = i+1;
    document.getElementById((i+1)+"name").innerHTML=seatList[i];
    document.getElementById((i+1)+"chips").innerHTML=displayNum(playerList[seatList[i]]);
  }
}

function resetBoard(){
  for(var i = 0;i < 5; i++){
    document.getElementById("board"+(i+1).toString()).classList.remove('playingCardFace');
    document.getElementById("board"+(i+1).toString()).innerHTML='';
  }
  for(var i=1;i<9;i++){
    document.getElementById((i).toString()+"card1").classList.remove('playingCardFace');
    document.getElementById((i).toString()+"card1").innerHTML='';
    document.getElementById((i).toString()+"card2").classList.remove('playingCardFace');
    document.getElementById((i).toString()+"card2").innerHTML='';
  }
  document.getElementById("burn1").style.visibility="hidden";
  document.getElementById("burn2").style.visibility="hidden";
  document.getElementById("burn3").style.visibility="hidden";
}

function displayFlop(cards){
  for(var i = 0;i < cards.length; i++){
    buildCard(cards[i],"board"+(i+1).toString());
  }
  document.getElementById("burn1").style.visibility="visible";
}
function displayTurn(card){
  buildCard(card,"board4")
  document.getElementById("burn2").style.visibility="visible";
}
function displayRiver(card){
  buildCard(card,"board5")
  document.getElementById("burn3").style.visibility="visible";
}

function dealInitial(players, hand, bbPlayer, sbPlayer, bbVal){
  // ~~~~~ display big blind and small blind button ~~~~~~ //
  // big blind
  document.getElementById(seats[bbPlayer]+"bb").style.backgroundImage= "url('images/bigBlind.png')";
  document.getElementById(seats[bbPlayer]+"bb").style.visibility="visible";
  document.getElementById(seats[bbPlayer]+"bet").style.visibility="visible";
  document.getElementById(seats[bbPlayer]+"bet").innerHTML = displayNum(bbVal);
  // small blind
  if(players.length!=2){
    document.getElementById(seats[sbPlayer]+"bb").style.backgroundImage = "url('images/smallBlind.png')";
    document.getElementById(seats[sbPlayer]+"bb").style.visibility="visible";
  }
  document.getElementById(seats[sbPlayer]+"bet").innerHTML = displayNum(bbVal/2);
  document.getElementById(seats[sbPlayer]+"bet").style.visibility="visible";

  // ~~~~~ display own hand ~~~~~ //
  buildCards(hand,1);
  // ~~~~~~ display other players who are in with dealt card backs ~~~~~//
  for(var i = 0; i < players.length;i++){
    seat = seats[players[i]]
    displayBacks(seat);
  }
}

function displayNull(playerSeat){
  if(playerSeat==1){
    document.getElementById(playerSeat+'card1').style.innerHTML= "";
    document.getElementById(playerSeat+'card2').style.innerHTML= "";
  }
  document.getElementById(playerSeat+'card1').style.backgroundImage= "";
  document.getElementById(playerSeat+'card1').classList.remove('playingCardFace');
  document.getElementById(playerSeat+'card1').innerHTML="";
  document.getElementById(playerSeat+'card2').style.backgroundImage= "";
  document.getElementById(playerSeat+'card2').classList.remove('playingCardFace');
  document.getElementById(playerSeat+'card2').innerHTML="";
}

function removeAllChips(){
  seatKeys = Object.keys(seats);
  for(var i=0; i < seatKeys.length;i++){
    document.getElementById(seats[seatKeys[i]]+"bb").style.visibility="hidden";
    document.getElementById(seats[seatKeys[i]]+"bet").style.visibility="hidden";
    document.getElementById(seats[seatKeys[i]]+"bet").style.innerHTML="";
  }
}

function removeAllBets(){
  seatKeys = Object.keys(seats);
  for(var i=0; i < seatKeys.length;i++){
    document.getElementById(seats[seatKeys[i]]+"bet").style.visibility="hidden";
    document.getElementById(seats[seatKeys[i]]+"bet").style.innerHTML="";
  }
}

function displayBacks(playerSeat){
  document.getElementById(playerSeat+'card1').style.backgroundImage= "url('images/cardback.png')";
  document.getElementById(playerSeat+'card2').style.backgroundImage= "url('images/cardback.png')";
}

function buildCards(hand,playerSeat){
  buildCard(hand[0],playerSeat+'card1');
  buildCard(hand[1],playerSeat+'card2');
}

function buildCard(card,location){
  // dynamically build cards
  rank = card[0];
  suit = card[1];
  switch(rank){
    case 'A':
      rankUrl = 'images/ace.png'
      break;
    case '2':
      rankUrl = 'images/2.png'
      break;
    case '3':
      rankUrl = 'images/3.png'
      break;
    case '4':
      rankUrl = 'images/4.png'
      break;
    case '5':
      rankUrl = 'images/5.png'
      break;
    case '6':
      rankUrl = 'images/6.png'
      break;
    case '7':
      rankUrl = 'images/7.png'
      break;
    case '8':
      rankUrl = 'images/8.png'
      break;
    case '9':
      rankUrl = 'images/9.png'
      break;
    case 'T':
      rankUrl = 'images/ten.png'
      break;
    case 'J':
      rankUrl = 'images/jack.png'
      break;
    case 'Q':
      rankUrl = 'images/queen.png'
      break;
    case 'K':
      rankUrl = 'images/king.png'
      break;
  }
  switch(suit){
    case 'h':
      suitUrl = 'images/heart.png'
      break;
    case 's':
      suitUrl = 'images/spade.png'
      break;
    case 'd':
      suitUrl = 'images/diamond.png'
      break;
    case 'c':
      suitUrl = 'images/club.png'
      break;
  }
  document.getElementById(location).classList.add('playingCardFace');
  document.getElementById(location).innerHTML = `<img class="number" src=`+rankUrl+`> <img class="suit" src=`+suitUrl+`>`;

}


// Functions used in input control
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

function isNameCharacter(evt){
  var regex = new RegExp("^[a-zA-Z0-9]+$");
  var str = String.fromCharCode(!evt.charCode? evt.which : evt.charCode);
  if (regex.test(str)) {
    return true;
  }
  evt.preventDefault();
  return false;
}

function isNumber(evt){
  var charCode = (evt.which) ? evt.which : evt.keyCode;
  if (charCode != 46 && charCode > 31 && (charCode < 48 || charCode > 57)) return false;
  return true;
}

function isNumberBet(evt){
  var charCode = (evt.which) ? evt.which : evt.keyCode;
  if (charCode != 46 && charCode > 31 && (charCode < 48 || charCode > 57)) return false;
  return isWithinBet(evt);
}

function isWithinBet(evt){
  var charCode = (evt.which) ? evt.which : evt.keyCode;
  inputtedKey = String.fromCharCode(charCode);
  if(document.getElementById('betInput').value){
    newValue = parseInt(document.getElementById('betInput').value,10)*10+parseInt(inputtedKey,10);
  }
  else{
    newValue = parseInt(parseInt(inputtedKey,10));
  }
  if(newValue<=document.getElementById('betInput').max){
    document.getElementById('rangeInput').value = newValue;
    return true;
  }
  return false;
}
