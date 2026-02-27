const express = require("express");
const fs = require("fs");
const multer = require("multer");
const  Session  = require("../models/sessionModel");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads"); // Path to the uploads folder
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const screenshotStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const screenshotDir = "./screenshots"; // Path to the screenshots folder
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    cb(null, screenshotDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

async function saveAnalysisResult(
  filePath,
  sessionId,
  sessionName,
  gameName,
  fileType
) {
  try {
    console.log("Session Name : ", sessionName);
    const update = {
      sessionName: sessionName || "Unnamed Session", // Set default sessionName if not provided
      gameName: gameName || "Unknown Game", // Add this line to save gameName
      timestamp: new Date(), // Add this line to update the timestamp
    };
    // Store the correct path depending on file type (image or screenshot)
    if (fileType === "image") {
      update.$push = { imagePaths: filePath }; // Use $push to append to the imagePaths array
    } else if (fileType === "screenshot") {
      update.$push = { screenshotPaths: filePath }; // Use $push to append to the screenshotPaths array
    }

    // Find the session by sessionId and update with the file path and sessionName
    await Session.findOneAndUpdate({ sessionId: sessionId }, update, {
      upsert: true,
      new: true,
    });

    console.log(`${fileType} path, sessionName, and gameName saved to MongoDB`);
  } catch (error) {
    console.error("Error saving file path or sessionName to MongoDB:", error);
    throw error;
  }
}

module.exports = { storage, screenshotStorage, saveAnalysisResult };
