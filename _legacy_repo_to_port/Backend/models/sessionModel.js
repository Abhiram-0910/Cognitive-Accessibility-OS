const mongoose = require('mongoose');

// Define a schema for session data
const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    sessionName: { type: String, required: true },  // Add sessionName to store player name
    gameName: { type: String, required: false },
    imagePaths: [String],  // Array of strings for image paths
    screenshotPaths: [String],  // Array of strings for screenshot paths
    timestamp: { type: [String], default: () => [new Date().toLocaleDateString(), new Date().toLocaleTimeString()] }, // Store date and time as an array
    modelResponse: { type: Array, required: false }
});

// Prevent OverwriteModelError by checking if the model is already defined
const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

module.exports = Session;
