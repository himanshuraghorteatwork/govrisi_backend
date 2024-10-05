// ResearchModel1.js
import mongoose from 'mongoose';
import connectDB from '../db/dbConnection.js';
import dotenv from 'dotenv';

dotenv.config();

await connectDB(process.env.MONGO_URI_1);

// Connect to the first database
const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    institution: { type: String, required: true },
    status: { type: String,required: true },
    start: { type: Date, required: true },
    end: { type: Date,required: true },
    file: { type: String ,required: true},
    username:{type:String,required: true,unique:true},
    password:{type:String,required: true},
    email:{type:String,required: true,unique:true},
    researchers: [{ type: String }]
}, { timestamps: true });

const researchProjectSchema = mongoose.model('researchProject', projectSchema);

const researcherSchema=new mongoose.Schema({

    name:{type: String, required: true},
    email:{type: String, required: true},
    field:{type: String, required: true},
    role:{type: String, required: true},
    projectId:{type: String}

},{ timestamps: true });

const researchUserSchema = mongoose.model('researcher', researcherSchema);

export {researchProjectSchema,researchUserSchema};

