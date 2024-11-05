import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { ipr } from "../models/projectModel.js";

const IPRRouter = express.Router();
dotenv.config();

let gfsBucket; // Variable to hold the GridFSBucket instance

// Connect to the MongoDB database and set up GridFS
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const conn = mongoose.connection;

    // Ensure that the connection is open before setting up the bucket
      gfsBucket = new GridFSBucket(conn.db, { bucketName: "iprPdfFiles" });

      console.log("Connected to MongoDB and GridFS bucket initialized."); // Log connection success
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1); // Stop the server if the connection fails
  }
};

connectDB();

// Setup Multer for file storage in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Endpoint to add IPR
IPRRouter.post('/ipr/addIPR', upload.fields([{ name: 'certificateFile' }, { name: 'inventionFile' }]), async (req, res) => {
  try {
    // Parse inventors if they are sent as a JSON string in the request body
    const inventors = req.body.inventors ? JSON.parse(req.body.inventors) : [];

    // Destructure required fields from the request body
    const {
      title,
      applicantName,
      description,
      status,
      applicationNumber,
      applicationDate,
      publicationDate,
      email,
    } = req.body;

    // Validate required fields
    if (!title || !applicantName) {
      return res.status(400).json({ message: 'Title and applicant name are required.' });
    }

    // Save files to GridFS and handle potential errors
    const certificateFileId = req.files['certificateFile']
      ? await saveFileToGridFS(req.files['certificateFile'][0])
      : null;

    const inventionFileId = req.files['inventionFile']
      ? await saveFileToGridFS(req.files['inventionFile'][0])
      : null;

    // Create the new IPR document with inventors as an array of objects
    const newIPR = new ipr({
      title,
      applicantName,
      description,
      status,
      applicationNumber,
      applicationDate,
      publicationDate,
      email,
      inventors, // Directly store inventors as objects with name and email
      certificateFileId,
      inventionFileId,
    });

    // Save the IPR document
    await newIPR.save();

    // Respond with a success message
    res.status(201).json({ message: 'IPR added successfully', ipr: newIPR });
  } catch (error) {
    console.error('Error while adding IPR:', error);
    res.status(500).json({ message: 'Failed to add IPR' });
  }
});


// Helper function to save file to GridFS
const saveFileToGridFS = (file) => {
  return new Promise((resolve, reject) => {
    if (!gfsBucket) {
      return reject(new Error('GridFSBucket is not initialized')); // Ensure the bucket is initialized
    }
    const uploadStream = gfsBucket.openUploadStream(file.originalname);
    uploadStream.end(file.buffer);
    uploadStream.on('finish', () => resolve(uploadStream.id)); // Resolve with file ID on success
    uploadStream.on('error', (err) => {
      console.error('Error uploading file to GridFS:', err);
      reject(err); // Reject the promise on error
    });
  });
};

IPRRouter.get('/ipr/getIPRs', async (req, res) => {
  try {
    const iprs = await ipr
      .find() // Fetch all IPRs
      .sort({ applicationDate: -1 }) // Sort by application date in descending order (latest first)
      .limit(50); // Limit to 50 entries

    res.status(200).json(iprs); // Send array of IPRs as JSON
  } catch (error) {
    console.error('Error fetching IPRs:', error);
    res.status(500).json({ message: 'Failed to fetch IPRs' });
  }
});

IPRRouter.post('/ipr/search', async (req, res) => {
  try {
    const searchCriteria = req.body;
    const query = {};

    if (searchCriteria.title) {
      query.title = { $regex: searchCriteria.title, $options: 'i' }; // Case-insensitive search
    }
    if (searchCriteria.applicationNumber) {
      query.applicationNumber = searchCriteria.applicationNumber;
    }
    if (searchCriteria.applicantName) {
      query.applicantName = { $regex: searchCriteria.applicantName, $options: 'i' };
    }
    if (searchCriteria.status) {
      query.status = searchCriteria.status;
    }
    if (searchCriteria.fromDate || searchCriteria.toDate) {
      query.applicationDate = {};
      if (searchCriteria.fromDate) {
        query.applicationDate.$gte = new Date(searchCriteria.fromDate);
      }
      if (searchCriteria.toDate) {
        query.applicationDate.$lte = new Date(searchCriteria.toDate);
      }
    }

    const results = await ipr.find(query).limit(50); // Adjust limit as needed
    res.status(200).json(results);
  } catch (error) {
    console.error('Error during search:', error);
    res.status(500).json({ message: 'Error fetching search results' });
  }
});


IPRRouter.get("/ipr/open/file/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params; // Get file ID from route parameters
    const downloadStream = gfsBucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="downloaded.pdf"',
    });

    downloadStream.pipe(res); // Stream the file directly to the response
  } catch (error) {
    console.error('Error retrieving file:', error);
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
});


export default IPRRouter;
