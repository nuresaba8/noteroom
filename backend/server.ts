import express, { static as _static } from 'express'
import { join } from 'path'
import { config } from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4'

import cookieParser from 'cookie-parser'
import session from 'express-session'
import { connect } from 'mongoose'
import { urlencoded, json } from 'body-parser';
import fileUpload from 'express-fileupload'
import cors from 'cors'
import pkg from 'connect-mongo';
const { create } = pkg;
import chalk from 'chalk';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swaggers/swaggerOptions';

import postApiRouter from './apis/post.api.js';
import seacrhApiRouter from './apis/search.api.js';
import profileApiRouter from './apis/profile.api.js';
import notificationApiRouter from './apis/notifications.api.js';
import requestsApiRouter from './apis/requests.api.js';
import authApiRouter from './apis/auth.api.js';
import uploadApiRouter from './apis/upload.api.js';
import mcqApiRouter from './apis/mcq.api';
import friendsApiRouter from './apis/friends.api';
import resolvers from './graphql/resolvers/index.resolver'
import typeDefs from './graphql/typeDefs/index.typeDef'
import spacesApiRouter from './apis/spaces.api';

config({ path: join(__dirname, '.env') });

const app = express()
const server = createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
const apolloServer = new ApolloServer({ typeDefs, resolvers })
const url = (process.env.DEVELOPMENT && process.env.DEVELOPMENT === "true") ? process.env.MONGO_URI_DEV : process.env.MONGO_URI

connect(url).then(() => {
    console.log(chalk.cyan(`[-] development mode: ${chalk.yellow(process.env.DEVELOPMENT)}`))
    if (process.env.DEVELOPMENT && process.env.DEVELOPMENT === "true") {
        console.log(chalk.cyan(`[-] using local mongodb: ${chalk.yellow(url)}`))
    } else {
        console.log(chalk.cyan(`[-] using remote mongodb: ${chalk.yellow(url)}`))
    }
})

const port = process.env.PORT
const staticPath = join(__dirname, "../../frontend/dist")
const allowedHosts = JSON.parse(process.env.ALLOWED_HOSTS)

function devAuthCookie(req, res, next) {
    const mockSessionUserID = req.headers['x-msid'] 
    if (mockSessionUserID) {
        req.session.mstdid = mockSessionUserID
    } else {
        console.log(chalk.red("DEVELOPMENT_SESSION_COOKIE is set to true but no x-msid header is found. Setting mstdid=undefined"))
        req.session.mstdid = undefined
    }

    next()
}

app.use(cors({
    origin: allowedHosts,
    credentials: true
}))
app.use(express.json()); 
app.use(express.static(staticPath))
app.use(urlencoded({ extended: true })) 
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    store: create({
        mongoUrl: url,
        ttl: 60 * 60 * 720
    }),
    cookie: {
        httpOnly: true,   
        secure: false,   
        maxAge: 1000 * 60 * 60 * 720
    }
}));
if (process.env.DEVELOPMENT_SESSION_COOKIE === "true") {
    console.log(chalk.cyan(`[-] using development session cookie: ${chalk.yellow('`session.mstdid`')}`))
    app.use(devAuthCookie)
}
app.use(cookieParser()) 
app.use(fileUpload()) 

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/users', profileApiRouter(io))
app.use('/api/posts', postApiRouter(io))
app.use('/api/notifications', notificationApiRouter(io))
app.use('/api/requests', requestsApiRouter(io))
app.use('/api/search', seacrhApiRouter(io))
app.use('/api/auth', authApiRouter(io))
app.use('/api/upload', uploadApiRouter(io))
app.use('/api/mcq/', mcqApiRouter(io))
app.use('/api/friends', friendsApiRouter(io))
app.use('/api/spaces', spacesApiRouter(io))

app.get('/logout', (req, res) => {
    try {
        req.session.destroy(error => {
            res.clearCookie('studentID')
            res.clearCookie('username')
            res.clearCookie('connect.sid')
            res.json({ ok: true })
        })
    } catch (error) {
        res.json({ ok: false })
    }
})


app.get("*", (req, res) => {
    res.sendFile(join(staticPath, 'index.html'))
})


export let userSocketMap: Map<string, string> = new Map()
io.on('connection', (socket) => {
    let studentID = <string>socket.handshake.query.studentID
    if (studentID) {
        userSocketMap.set(studentID, socket.id)
    }

    socket.on('disconnect', () => {
        userSocketMap.forEach((sockID, studentID) => {
            if (sockID === socket.id) {
                userSocketMap.delete(studentID)
            }
        })
    })
})

async function startServer() {
    await apolloServer.start()

    app.use("/api/graphql", expressMiddleware(apolloServer, {
        context: async ({ req, res }) => ({
            req, res
        })
    }))

    server.listen(port, () => {
        console.log(chalk.cyan(`[-] server is listening on: ${chalk.yellow(`http://localhost:${port}`)}`));
    })
}

startServer().then(() => {
    console.log(chalk.cyan(`[-] apollo server started, enpoint: ${chalk.yellow(`http://localhost:${port}/graphql`)}`));
}).catch(error => {
    console.log(chalk.cyan(`[-] apollo server couldn't start: ${chalk.red(error)}`));
})
