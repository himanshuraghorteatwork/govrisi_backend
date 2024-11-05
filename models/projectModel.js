import mongoose from 'mongoose';
import connectDB from '../db/dbConnection.js';
import dotenv from 'dotenv';

dotenv.config();

await connectDB(process.env.MONGO_URI);


const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    institution: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String,required: true },
    start: { type: Date, required: true },
    end: { type: Date,required: true },
    username:{type:String,required: true,unique:true},
    password:{type:String,required: true},
    email:{type:String,required: true,unique:true},
    fileId:{type:String},
    researchers: [{ type: String }]
}, { timestamps: true });

const researchProjectSchema = mongoose.model('researchProject', projectSchema);

const researcherSchema=new mongoose.Schema({

    name:{type: String, required: true},
    email:{type: String,required: true},
    field:{type: String, required: true},
    role:{type: String, required: true},
    projectId:{type: String}

},{ timestamps: true });

const researchUserSchema = mongoose.model('researcher', researcherSchema);

const iprSchema = new mongoose.Schema({
    title: { type: String, required: true },
    applicantName: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, required: true },
    applicationNumber: { type: String, required: true, unique: true },
    applicationDate: { type: Date, required: true },
    publicationDate: { type: Date, required: true },
    email: { type: String, required: true },
    certificateFileId: { type: String },
    inventionFileId: { type: String },
    inventors: [
        {
          name: { type: String, required: true },
          email: { type: String, required: true }
        }
      ]
}, { timestamps: true });

const ipr = mongoose.model('ipr', iprSchema);

export {researchProjectSchema,researchUserSchema,ipr};

