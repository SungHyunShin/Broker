# Broker

Created by: Andy Shin, Austin Sura, Jin Kim, and Joseph Han

Tech Stack: Node.js, sockets.io, Express, JavaScript, HTML, CSS

Broker is a web-application project for an online poker game. This lets users to host rooms and have other users join using game codes, all with no accounts necessary. The server is hosted by heroku.

Just start a game and let users hop right in!

This is hosted over at: https://broker-poker.herokuapp.com




Npm install required:

- https://github.com/kadamwhite/node-card-deck
- https://www.npmjs.com/package/pokersolver
- https://socket.io
- https://expressjs.com


To Do list:
- [x] add random gameCode
- [ ] add BlackJack
- [ ] add text invites
- [ ] move things into more functions in server.js
- [ ] add session affinity https://devcenter.heroku.com/articles/session-affinity
- [x] fix chip bugs such as going all in and lost chips
- [x] fix pot distribution to winners
