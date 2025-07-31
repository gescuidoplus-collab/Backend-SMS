import express from "express";
import {envConfig , mongoClient} from './app/config/index.js'
import {router} from "./app/routers/index.js"
import {createUser} from "./app/utils/create-auth.js"
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { monthlyTask } from "./app/services/scheduler.js"

const app = express();

// CORS: permite todas las conexiones (ajusta según tu necesidad)
app.use(cors());

// Morgan: solo en desarrollo
if (envConfig.env === "development") {
    app.use(morgan("dev"));
}

// Rate Limit: limita a 100 peticiones por 15 minutos por IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite de peticiones
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

mongoClient();

createUser({
    email: envConfig.emailUser,
    password: envConfig.passwordUser
})
.then(() => {
    console.log('✅ User Admin created successfully');
})
.catch(error => {
    console.log('❌ User Admin was not created:', error.message);
});

app.use(express.json({ limit: "1kb" }));
app.use(express.urlencoded({ extended: true, limit: "1kb" }));

app.get(`${envConfig.urlPath}healtcheck`, (req , res)=>{
    res.status(200).json({'message' : 'version 1.0.0'})
})
app.use(envConfig.urlPath,router)



app.listen(envConfig.port, ()=>{
    monthlyTask();
    console.log(`Running in proyect port : ${envConfig.port}`)
})