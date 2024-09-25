import express from "express";
import dotenv from "dotenv";

const app=express();
dotenv.config();

app.get("/",(req,res)=>{

    res.send("Hii from GOVRIfghSI");

});

app.get("/")

app.listen(process.env.PORT,()=>{

    console.log("Server running:"+process.env.PORT)

});