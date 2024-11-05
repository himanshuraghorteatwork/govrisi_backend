import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import cors from "cors";

import researchRouter from "./routes/researchRouter.js";
import iprRouter from "./routes/iprRouter.js"; 

const app = express();
dotenv.config();
  
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }));
  
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true when using HTTPS
      sameSite: 'Lax', // Use 'Lax' for local development
      maxAge: 1000 * 60 * 60 * 24,
    },
  }));

// Initialize Passport.js middleware
app.use(passport.initialize());
app.use(passport.session()); // Enables persistent login sessions

// Register your routers
app.use(researchRouter);
app.use(iprRouter);


// Start the server
app.listen(process.env.PORT, () => {
  console.log("Server running on port: " + process.env.PORT);
});
