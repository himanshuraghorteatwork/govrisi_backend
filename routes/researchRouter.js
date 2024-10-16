import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { researchProjectSchema, researchUserSchema } from "../models/research.js";

const app = express();
dotenv.config();

const researchRouter = express.Router();

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

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await researchProjectSchema.findOne({ username });
      if (!user) return done(null, false, { message: "User not found" });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return done(null, false, { message: "Incorrect password" });

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await researchUserSchema.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Middleware to handle JSON data along with file uploads
researchRouter.post(
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

      const hashedPassword = await bcrypt.hash(password, 10); // Hash password
      const projectDocument = await researchProjectSchema.create({
        title, institution, description, status,
        start: startDate, end: endDate,
        username, password: hashedPassword, email,
      });
      // Create the project document
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

researchRouter.post("/research/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err); // Handle error during authentication

    if (!user) {
      return res.status(401).json({ message: info.message || "Invalid credentials" });
    }

    req.logIn(user, (err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Login successful", user: user.username });
    });
  })(req, res, next);
});

// Logout Rout

researchRouter.get("/open/file", async (req, res) => {
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



export default researchRouter;
