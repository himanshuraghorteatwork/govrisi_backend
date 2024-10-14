import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { researchProjectSchema, researchUserSchema } from "../models/research.js";

const app = express();
dotenv.config();

const registrationRouter = express.Router();
const openPDF=express.Router();

var gfsBucket;

const connectDB = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI_1 , {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
  
      const conn = mongoose.connection;
      gfsBucket = new GridFSBucket(conn.db, { bucketName: "pdfFiles" });
    } catch (error) {
      console.error("Database connection error:", error);
      process.exit(1); // Stop the server if connection fails
    }
  };

  connectDB();
// Setup Multer for file storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware to handle JSON data along with file uploads
registrationRouter.post(
  "/research/registration",
  upload.single("projectFile"), // Handle single file upload under "projectFile"
  async (req, res) => {
    try {
      // Parse the JSON formData string from the request body
      const formData = JSON.parse(req.body.formData);
      const { title, institution, email, status, startDate, endDate, username, password,description } = formData;

      const existingUser = await researchProjectSchema.findOne({
        $or: [{ username }, { email }],
      });
    
      if (existingUser) {
        return res.status(400).json({
          message: 'Username or email already exists. Please use a different one.',
        });
      }
      // Create the project document
      const projectDocument = await researchProjectSchema.create({
        title,
        institution,
        description,
        status,
        start: startDate,
        end: endDate,
        username,
        password,
        email,
      });

      const researchers = JSON.parse(req.body.researchers); // Parse the researchers array
      const researcherIds = [];

      // Loop through and create each researcher document
      for (const user of researchers) {
        const researcherDocument = await researchUserSchema.create({
          name: user.name,
          email: user.remail,
          role: user.role,
          field: user.researchField,
          projectId: projectDocument._id,
        });
        researcherIds.push(researcherDocument._id);
      }

      // Update the project with researcher IDs
      await researchProjectSchema.findByIdAndUpdate(
        projectDocument._id,
        { $set: { researchers: researcherIds } }
      );

      // Handle file upload using GridFS


      const { originalname, buffer } = req.file;

      const uploadStream = gfsBucket.openUploadStream(originalname);
      uploadStream.end(buffer);

      uploadStream.on("finish", async () => {
        // Save the file ID to the project document
        await researchProjectSchema.findByIdAndUpdate(
          projectDocument._id,
          { $set: { fileId: uploadStream.id } }
        );
        res.status(201).json({
          message: "Project and file uploaded successfully",
          projectId: projectDocument._id,
          fileId: uploadStream.id,
        });
      });

      uploadStream.on("error", (err) => {
        console.error("File upload error:", err);
        res.status(500).json({ error: "Error uploading file" });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Error in registration" });
    }
  }
);

openPDF.get("/open/file", async (req, res) => {
  try {
    
    var d=await researchProjectSchema.findOne({title:"GOVRISI"});

    // Find the file by its ID and stream it to the response
    const fileId = new mongoose.Types.ObjectId(d.fileId);
    const downloadStream = gfsBucket.openDownloadStream(fileId);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="downloaded.pdf"',
    });

    downloadStream.pipe(res); // Stream the file directly to the response
  } catch (error) {
    console.error("Error retrieving file:", error);
    res.status(500).json({ error: "Failed to retrieve file" });
  }
});

export {registrationRouter,openPDF};
