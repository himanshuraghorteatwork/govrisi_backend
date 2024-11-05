import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { ObjectId } from 'mongodb';
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { researchProjectSchema, researchUserSchema } from "../models/projectModel.js";

dotenv.config();

const researchRouter = express.Router();

var gfsBucket;

const connectDB = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI , {
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
    const user = await researchProjectSchema.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Route to check user session status
researchRouter.get('/auth/check-session', (req, res) => {
  if (req.isAuthenticated()) {
    res.status(200).json({ message: 'Authenticated' });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized. Please log in." });
};

// Middleware to handle JSON data along with file uploads
researchRouter.post(
  "/research/registration",
  upload.single("projectFile"), 
  async (req, res) => {
    try {
      
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
      
      const researchers = JSON.parse(req.body.researchers); 
      const researcherIds = [];

      
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

      
      await researchProjectSchema.findByIdAndUpdate(
        projectDocument._id,
        { $set: { researchers: researcherIds } }
      );

      // Handle file upload using GridFSss


      const { originalname, buffer } = req.file;
      const uploadStream = gfsBucket.openUploadStream(originalname);
      uploadStream.end(buffer);

      uploadStream.on("finish", async () => {
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

researchRouter.get("/research/profile", ensureAuthenticated, async (req, res) => {
  try {
    // Send user object (populated by passport.deserializeUser)
    var researchersIds=req.user.researchers;
    const researchersP=[];

    for(var id of researchersIds)
    {

      var d=await researchUserSchema.findById(id);
      researchersP.push(d);

    }

    res.status(200).json({
      success: true,
      user: req.user,
      researchers:researchersP // req.user contains the user info after deserialization
    });
  } catch (error) {
    console.error("Profile retrieval error:", error);
    res.status(500).json({ message: "Failed to retrieve profile data" });
  }
});

researchRouter.post(
  "/research/update",
  ensureAuthenticated,
  upload.single("newFile"), // Handle new file upload
  async (req, res) => {
    try {
      const { username, password, status } = req.body;

      // Authenticate the user
      const user = await researchProjectSchema.findOne({ username });
      if (!user) return res.status(404).json({ message: "User not found" });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

      // Update the project status in the database
      user.status = status;

      // Handle new file upload and delete old file if present
      if (req.file) {
        const { originalname, buffer } = req.file;

        // Delete the old file from GridFS, if it exists
        if (user.fileId) {

          const fileId = new ObjectId(user.fileId); // Ensure ID is an ObjectId
          const fileCursor = await gfsBucket.find({ _id: fileId }).toArray();
          
          if (fileCursor.length > 0) {
            try {
              await gfsBucket.delete(fileId);
            } catch (error) {
              console.error("Error deleting old file:", error);
              return res.status(500).json({ message: "Error deleting old file" });
            }
          } else {
            console.warn("No file found with the provided ID. Skipping deletion.");
          }
        }

        // Upload the new file to GridFS
        const uploadStream = gfsBucket.openUploadStream(originalname);
        uploadStream.end(buffer);

        uploadStream.on("finish", async () => {
          // Update the fileId with the new file ID in the database
          user.fileId = uploadStream.id;
          await user.save(); // Save the updated user data

          res.status(200).json({
            message: "Project updated successfully with new file",
            fileId: uploadStream.id,
          });
        });

        uploadStream.on("error", (err) => {
          console.error("File upload error:", err);
          res.status(500).json({ error: "Error uploading new file" });
        });
      } else {
        // If no new file is uploaded, just save the status update
        await user.save();
        res.status(200).json({ message: "Project status updated successfully" });
      }
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ error: "Error in updating project" });
    }
  }
);

researchRouter.get('/research/search', async (req, res) => {
  try {
    const { query } = req.query; // Get query from query parameters
    // Check if query is a valid string
    if (typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ message: 'Invalid query parameter' }); // Return an error for invalid input
    }

    // Find documents matching the query (case-insensitive)
    const results = await researchProjectSchema.find({
      title: { $regex: new RegExp(query, 'i') } // Create a regex object for case-insensitive search
    });

    // Return the results to the frontend
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

researchRouter.get('/research/projectDetail/:id', async (req, res) => {
  try {
    const { id } = req.params; // Get ID from URL parameters
    const project = await researchProjectSchema.findById(id); // Find project by ID

    if (!project) {
      return res.status(404).json({ message: 'Project not found' }); // Handle case where project is not found
    }

    var researchersIds=project.researchers;
    const researchersP=[];

    for(var rid of researchersIds)
    {

      var d=await researchUserSchema.findById(rid);
      researchersP.push(d);

    }

    res.json({ project, researchers: researchersP });
    // Return project data to frontend
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

researchRouter.get('/research/latest', async (req, res) => {
  try {
    const projects = await researchProjectSchema.find()
      .sort({ createdAt: -1 }) // Sort by createdAt in descending order
      .limit(10); // Limit to 10 projects

    res.json(projects); // Send the projects as a JSON response
  } catch (error) {
    res.status(500).json({ message: 'Error fetching projects', error });
  }
});


researchRouter.post('/research/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          return res.status(500).json({ message: 'Logout failed', error: err });
      }
      res.clearCookie('connect.sid'); // Clear the cookie
      return res.status(200).json({ message: 'Logout successful' });
  });
});

// Logout Rout

researchRouter.get("/open/file/:fileId", async (req, res) => {
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
export default researchRouter;
