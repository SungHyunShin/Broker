var socket = io();
socket.on('message', function(data) {
  console.log(data);
});
document.getElementById("roomCreate").addEventListener("click", function(){
  socket.emit('roomCreate',"");
  console.log('roomCreate');
});
