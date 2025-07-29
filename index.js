import express from "express";
import {envConfig , mongoClient} from './app/config/index.js'
import {router} from "./app/routers/index.js"
import {createUser} from "./app/utils/create-auth.js"

const app = express();

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
    console.log(`Running in proyect port : ${envConfig.port}`)
})