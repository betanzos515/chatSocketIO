import express from 'express';
import logger from 'morgan';

import { Server } from 'socket.io';
import { createServer } from 'node:http';

import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@libsql/client';

const db = createClient({
    url:process.env.DB_URL,
    authToken:process.env.DB_TOKEN
});

await db.execute(`
CREATE TABLE IF NOT EXISTS messages(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    username TEXT
)`
);

const app = express();
const server = createServer(app); //creamos el servidor para el soporte de socket.io

const io = new Server(server,{
    connectionStateRecovery:{}
}); //servidor de websocket.

//servidor websocket
io.on('connection', async (socket)=>{
    console.log('an user has connected!');
    
    socket.on('disconnect',()=>{
        console.log('an user has disconnect!');
    });

    socket.on('chat message',async (message)=>{
        let result ;
        const username = socket.handshake.auth.username ?? 'anonymous';
        try {
            result = await db.execute({
                sql:` INSERT INTO messages (content, username) VALUES (:message,:username)`,
                args:{ message,username }
            });
        } catch (error) {
            console.error(error);
            return;
        }
        console.log(result.lastInsertRowid.toString());
        io.emit('chat message',message, result.lastInsertRowid.toString(), username);
    });
    
    if(!socket.recovered){
        try{
            const results = await db.execute({
                sql:'SELECT id, content, username FROM messages WHERE id > ?',
                args:[socket.handshake.auth.serverOffset ?? 0]
            });
            results.rows.forEach( row=>{
                socket.emit('chat message',row.content, row.id.toString(), row.username);
            })
        }catch(err){
            console.error(err);
            return;
        }
    }
});

app.use(logger('dev'));

const PORT = process.env.PORT ?? 3000 ;

app.get('/',(req,res)=>{
    //process.cwd = current worker directory ó directorio de trabajo actual que es la carpeta donde se ah inicializado el proyecto
    res.sendFile(process.cwd()+'/client/index.html');
});

// app.listen(PORT,( )=>{
//     console.log(`El sevidor se encuentra corriendo en el puerto ${PORT}` );
// });

//en vez de usar app como servidor estaremos escuchando el servidor de node:http para los websocket
server.listen(PORT,()=>{
    console.log(`El servidor está corriendo en el puerto ${ PORT }` )
});