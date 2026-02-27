const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectToDB = require("./config/db_connection"); // Import the db connection
const path = require("path");
const childRouter = require("./routes/child");
const adminRouter = require("./routes/admin");
const authRoutes=require("./routes/authRoutes");
const userRoutes=require("./routes/userRoutes");
const bcrypt = require("bcryptjs");
const app = express();
require("dotenv").config(); // Load environment variables

// Global middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true, // Allow cookies to be sent with cross-origin requests
  })
);
app.use(bodyParser.json());

//Routess
app.use("/child", childRouter);
app.use("/admin", adminRouter);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve uploaded screenshots
app.use("/screenshots", express.static(path.join(__dirname, "screenshots")));

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Start the server
(async () => {
  try {
    await connectToDB(); // Establish the MongoDB connection
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
  }
})();

// Backend Route to Fetch Sessions with Search
app.get("/sessions", async (req, res) => {
  const { searchTerm } = req.query; // Get search term from query parameter

  try {
    // Search for sessions where sessionName or gameName contains the search term
    const sessions = await Session.find({
      $or: [
        { sessionName: { $regex: searchTerm, $options: "i" } }, // Case-insensitive search
        { gameName: { $regex: searchTerm, $options: "i" } },
      ],
    });

    res.json(sessions); // Return matching sessions
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// code to get hashPassword for super admin
const hashPassword = async (plainPassword) => {
  try {
    const salt = await bcrypt.genSalt(10); // Generate salt
    const hashedPassword = await bcrypt.hash(plainPassword, salt); // Hash password
    console.log("Hashed Password:", hashedPassword);
    return hashedPassword;
  } catch (error) {
    console.error("Error hashing password:", error);
  }
};

// // Replace 'yourPassword123' with your desired password
hashPassword("superadmin");

//document to insert in compass

// {
//   "admin_name": "SuperAdmin",
//   "phone_number": "1234567890",
//   "admin_email": "superadmin@example.com",
//   "role": "super_admin",
//   "password": "$2a$10$QG3fJ0hTfZQuQGp2FkeWCOEpZOqi7L.BpRc3iB3yeacIy.jIr6sOq", // Replace with the hashed password
//   "status": "Approved"
// }

