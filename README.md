<div align="center">
<h3 align="center">Chess-Socket</h3>

  <p align="center">
    Chess-Socket is an open-source <a href="https://socket.io">Socket.IO</a> server for <a href="https://github.com/sandstorm831/chessdom">chessdom</a>.
    <br />
  </p>
</div>

<!-- TABLE OF CONTENTS -->

## Table of Contents

  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#prerequisites">Prerequisites</a></li>
    <li><a href="#built-with">Built with</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#project-structure">Project structure</a></li>
    <li><a href="#note">Note</a></li>
    <li><a href="#license">License</a></li>
  </ol>

<!-- ABOUT THE PROJECT -->

## About The Project

Chess-Socket is an open-source socket-io server primarily made for the [chessdom](https://github.com/sandstorm831/chessdom) project live chess game-play functionality. It maintains the state of game for reconciliation in case of accidental disconnects. It'll recursively sent the responses untill it recieve a acknowledgement from the respective client.

### Built With

[![Socket.IO][Socket.io]][Socket-url]
[![Prisma][prisma]][prisma-url]
[![NodeJS][nodejs]][nodejs-url]
[![TypeScript][typescript]][typescript-url]

## Prerequisites

To run the project in your local machine, you must have

- Node.js : [Volta recommended](https://volta.sh/)

## Installation

Once you finish installation Node.js, follow the commands to setup the project locally on your machine

1. clone the project
   ```sh
   git clone https://github.com/Sandstorm831/chessSocket.git
   ```
2. enter the project
   ```sh
   cd chessSocket
   ```
3. Install NPM packages
   ```sh
   npm install
   ```
4. Create .env file at the root of the folder.

   ```sh
   touch .env
   ```

5. Setup the `DATABASE_URL` in `.env` file

   ```sh
   DATABASE_URL=
   ```

   You can get a hosted SQL database from [Aiven](https://aiven.io/)
   <br/>

6. Establish link between `schema.prisma` and `.env`

   ```sh
   npx prisma generate
   ```

7. Apply the migrations to the DB.
   ```sh
   npx prisma migrate deploy
   ```


8. build the project

   ```sh
   npm run build
   ```

9. Start the server
   ```sh
    npm run start
   ```
   This completes the set-up for this project, all the functionalities present in the application will now be live at `port: 8080`, remember to bypass `CORS` setting present in the `server.ts` file to connect to a `localhost`.

<!-- LICENSE -->

## Project Structure

```
chessSocket
┃
┣ prisma
┃ ┣ migrations                              // various migrations files
┃ ┃ ┃                                       // for DB schema
┃ ┃ ┣ 20250206074038_init
┃ ┃ ┃ ┗ migration.sql
┃ ┃ ┣ 20250206074554_pgn_long_string
┃ ┃ ┃ ┗ migration.sql
┃ ┃ ┣ 20250206075112_storing_pgs_as_text
┃ ┃ ┃ ┗ migration.sql
┃ ┃ ┗ migration_lock.toml
┃ ┗ schema.prisma                           // DB schema
┃
┣ src
┃ ┣ websockets
┃ ┃ ┗ server.ts                             // Complete web-socket server
┃ ┣ DBQueries.ts                            // All DB queries definition
┃ ┗ queue.ts                                // Custom Queue data structure
┃
┣ .gitignore
┣ README.md
┣ package-lock.json
┣ package.json
┣ tsconfig.json
┗ tsconfig.tsbuildinfo
```

## Note

<ul>
<li>Server will Ban any user, from whom any unexpected response came back to the server. The ban last for 15 minures</li>

<li>Server maintains the state of game, thus for any accidental disconnects, the original game will be restored if the game exists and user joins before 10 seconds</li>

<li>A valid game end will prompt the server to save the game to database automatically, any valid game ending includes resignation, checkmate or draw</li>

<li>Any user leaving in between the game, is dealt by prompting the same to the opponent user</li>

<li>Rematch functionality is also given, therefore, if both users clicks rematch a rematch will start immediately</li>
</ul>

## License

Distributed under the GPL-3.0 license. See [LICENSE](./LICENSE) for more information.

[Socket.io]: https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101
[Socket-url]: https://socket.io/
[Socket-url]: https://socket.io/
[prisma]: https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white
[prisma-url]: https://www.prisma.io/
[nodejs]: https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white
[nodejs-url]: https://nodejs.org/en
[typescript]: https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white
[typescript-url]: https://www.typescriptlang.org/
