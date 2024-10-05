// Import dotenv to access environment variables
import 'dotenv/config';

export default {
  mongodb: {
    // Use the environment variable for the MongoDB connection string
    url: process.env.MONGO_URI,
    
    databaseName: 'research',  // Name of your MongoDB database
    
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  // Directory where migrations are stored
  migrationsDir: "migrations",

  // MongoDB collection where the changelog will be stored
  changelogCollectionName: "changelog",

  // Optional: MongoDB connection settings
  migrationFileExtension: ".js", // Use ".js" for JavaScript migrations
};
