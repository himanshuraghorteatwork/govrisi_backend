import express from "express";
import dotenv from "dotenv";
import {researchProjectSchema,researchUserSchema} from "../models/research.js";

const app=express();
dotenv.config();

const registrationRouter=express.Router();

registrationRouter.post("/research/registration",async(req,res)=>{

    var researcherId=[];
    var {title,institution,email,status,startDate,endDate,username,password}=req.body.formData;
    var projectDocument=await researchProjectSchema.create({title:title,institution:institution,status:status,start:startDate,end:endDate,username:username,password:password,email:email});

    var researcher=req.body.researchers;

    for(var user of researcher)
    {

        var researcherDocument=await researchUserSchema.create({name:user.name,email:user.email,role:user.role,field:user.researchField,projectId:projectDocument._id});
        researcherId.push(researcherDocument._id);

    }

    await researchProjectSchema.findOneAndUpdate({_id:projectDocument._id},{$set:{researchers:researcherId}});

});

export default registrationRouter;


