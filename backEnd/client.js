var socket = io();

var playerName = '';
var gameCode = '';

socket.on('message', function(data) {
  console.log(data);
});

socket.on('redirectLobbyUser',function(){
  console.log('redirectLobbyUser');
  redirectLobbyUFunc();
});
socket.on('redirectLobbyHost',function(){
  console.log('redirectLobbyHFunc');
  redirectLobbyHFunc();
});
socket.on('gameCode',function(data){
  gameCode = data;
});

// room join button listener
document.getElementById("roomJoin").addEventListener("click",roomJoinFunc);

// room create button listener
document.getElementById("roomCreate").addEventListener("click",roomCreateFunc);

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
                  <select class="form-control" id="exampleFormControlSelect1">
                    <option>BlackJack</option>
                    <option>Texas Hold'em</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="exampleFormControlSelect1">Stack Size</label>
                  <input type="email" id="playerName" class="form-control" placeholder="Enter number." required autofocus>
                </div>
                <div class="form-group">
                  <label for="exampleFormControlSelect1">Room Limit</label>
                  <select class="form-control" id="exampleFormControlSelect1">
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
  document.getElementById("roomInit").addEventListener("click",hostStartRoomFunc);
};

// Create Lobby Function
function hostStartRoomFunc(){
  console.log("roomInit");
  socket.emit("roomInit","");
};

// Join Lobby Function
function userJoinRoomFunc(player){
  console.log("roomJoin");
  socket.emit("roomJoin",player);
};

// user redirect to lobby function
function redirectLobbyUFunc(){
  document.getElementById("mainDiv").innerHTML =
  `
   <h5 class="card-title text-center">Room #\number </h5>
              <!-- Add the divs for current members -->
              <div class="alert alert-secondary" role="alert">
                Joseph Han
              </div>
              <!-- the yellow one to mark the host-->
              <div class="alert alert-warning" role="alert">
                Andy Shin
              </div>
              <div class="alert alert-secondary" role="alert">
                Jin Kim
              </div>


              <!-- use something similar below to disable the settings menu and start game button for non host players -->
              <!-- document.getElementById("myP").style.visibility = "hidden"; -->
  `;
};
// host user redirect to lobby function
function redirectLobbyHFunc(){
  document.getElementById("mainDiv").innerHTML =
  `
  <h5 class="card-title text-center">Room #\number </h5>
              <!-- Add the divs for current members -->
              <div class="alert alert-secondary" role="alert">
                Joseph Han
              </div>
              <!-- the yellow one to mark the host-->
              <div class="alert alert-warning" role="alert">
                Andy Shin
              </div>
              <div class="alert alert-secondary" role="alert">
                Jin Kim
              </div>


              <!-- use something similar below to disable the settings menu and start game button for non host players -->
              <!-- document.getElementById("myP").style.visibility = "hidden"; -->
              <button name="room" type="submit" value="start" class="btn btn-lg btn-primary btn-block text-uppercase">Start Game</button>
  `;
};
