var socket = io();

// Local variables
var playerName = '';
var gameCode = '';

// Incoming message from server handlers
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
socket.on('message', function(data) {
  console.log(data);
});
socket.on('redirectToLobby',function(memberList){
  redirectToLobbyFunc(memberList);
});
socket.on('gameStartRedirect',function(memberList){
  console.log('gameStartRedirect');
  // TODO: send to game lobby screen function
  document.getElementById("mainDiv").innerHTML = `
    <div class="container fixed-bottom">
        <div class="row">
          <div class="col-sm-9 col-md-7 col-lg-5 mx-auto">
            <div class="card card-signin my-5 text-center">
              <div class="card-body">
                MIN_PRICE
                <input type="range" min="1" max="100" value="50">
                MAX_PRICE
                <form class="form-inline">
                  <button class="btn btn-outline-success my-2 my-sm-0 mr-sm-2" type="submit">Button 1</button>
                  <button class="btn btn-outline-success my-2 my-sm-0 mr-sm-2" type="submit">Button 2</button>
                  <button class="btn btn-outline-success my-2 my-sm-0 mr-sm-2" type="submit">Button 3</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>`
});
socket.on('blindIncrease',function(newBlindAmount){
  //TODO maybe. Or not. Depends on how we decide to do blind increases
});
socket.on('playerTurn',function(){
  //TODO either we give the player actions they can take, or maybe we just need to let them know its their turn and they can do logic on their own
  // probably better practice to give turns they can do.
});
socket.on('disconnectedPlayerGame',function(){
  //TODO: probably just delete the player as game logic is handled by just the server.
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
socket.on('gameSettingsError',function(message){
  alert(message);
});
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

// Button listeners
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// room join button listener
document.getElementById("roomJoin").addEventListener("click",roomJoinFunc);

// room create button listener
document.getElementById("roomCreate").addEventListener("click",roomCreateFunc);
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

// Functions
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
                    <option>8</option>
                    <option>9</option>
                    <option>10</option>
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
        redirectToLobbyFunc(memberList);
      });
      document.getElementById("submitSettings").addEventListener("click",function(){
        var gameSettings = {};
        gameSettings['stackSize'] = parseInt(document.getElementById('stackSize').value,10);
        gameSettings['blindSize'] = parseInt(document.getElementById('blindSize').value,10);
        gameSettings['blindIncrease'] = document.getElementById('blindIncrease').checked;
        gameSettings['roundsToIncBigBlind'] = parseInt(document.getElementById('roundsToIncBigBlind').value,10);
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
