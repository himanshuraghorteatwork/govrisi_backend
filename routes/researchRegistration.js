import express from "express";
import dotenv from "dotenv";

const app=express();
dotenv.config();

const registrationRouter=express.Router();

registrationRouter.post("/research/registration",(req,res)=>{

    // var {title,file,s,institution,start,end}=req.body;
    // ,status,institution,start_date,end_date
    console.log(req.body);
    // +" "+status+" "+institution+" "+start_date+" "+end_date

});

export default registrationRouter;


