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
                  <input type="email" id="playerName" class="form-control" placeholder="Player Name" required autofocus>
                </div>
                <div class="form-group">
                  <input type="email" id="roomCode" class="form-control" placeholder="Room Code" required autofocus>
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
                  <input type="email" id="playerName" class="form-control" placeholder="Player Name" required autofocus>
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
    roomInitValues['playerName'] = document.getElementById('playerName').value;
    roomInitValues['gameType'] = document.getElementById('gameType').value == "Texas Hold'em" ? 'T' : 'B';
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
  console.log("roomJoin");
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
    document.getElementById("mainDiv").innerHTML += `
              <!-- use something similar below to disable the settings menu and start game button for non host players -->
              <!-- document.getElementById("myP").style.visibility = "hidden"; -->
              <button name="room" type="submit" value="start" class="btn btn-lg btn-primary btn-block text-uppercase">Start Game</button>`;
    alert('You are the host.');
  }
};

function addUser(Name){
  document.getElementById("nameDiv").innerHTML += 
		`<div class="alert alert-secondary" role="alert">`
                +Name+
              `</div>`;
}
