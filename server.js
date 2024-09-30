import express from "express";
import dotenv from "dotenv";

const app=express();
dotenv.config();

app.get("/",(req,res)=>{

    res.send("practice push");

});


app.listen(process.env.PORT,()=>{

    console.log("Server running:"+process.env.PORT)

});