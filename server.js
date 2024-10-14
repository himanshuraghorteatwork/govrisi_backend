import express from "express";
import dotenv from "dotenv";
import cors from 'cors';

import {registrationRouter,openPDF} from "./routes/researchRegistration.js";

const app=express();
dotenv.config();app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(registrationRouter);
app.use(openPDF);

app.get("/",(req,res)=>{

    

});

app.listen(process.env.PORT,()=>{

    console.log("Server running:"+process.env.PORT)

});