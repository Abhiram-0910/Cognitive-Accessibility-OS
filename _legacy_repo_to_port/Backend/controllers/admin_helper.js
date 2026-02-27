const express = require("express");
const router = express.Router();
const Session = require("../models/sessionModel");
const axios = require("axios");

const MODEL_URL =
  "https://api-inference.huggingface.co/models/trpakov/vit-face-expression";

// Helper function to get session media
const getSessionMedia = async (sessionId) => {
  try {
    // Fetch the session by sessionId from MongoDB
    const session = await Session.findOne({ sessionId: sessionId });
    if (!session) {
      return { error: "Session not found" };
    }
    console.log(
      "this are the image paths in getSessionMedia function",
      session.imagePaths
    );

    // Return imagePaths (add screenshotPaths if necessary)
    return {
      imagePaths: session.imagePaths || [],
    };
  } catch (error) {
    console.error("Error fetching media:", error);
    return { error: "Failed to fetch media" };
  }
};

// Helper function to send the image to Hugging Face model
async function sendImageToModel(imageBuffer, retries = 5, delay = 5000) {
  // Convert the image buffer to base64 encoding
  console.log("SendImageToModel function called ");
  const base64Image = imageBuffer.toString("base64");

  for (let i = 0; i < retries; i++) {
    try {
      console.log("this is the token", process.env.HUGGING_FACE_API_KEY);

      // Send the image to the Hugging Face model as base64
      const response = await axios.post(
        MODEL_URL,
        { image: base64Image }, // Adjust the payload according to model requirements
        {
          headers: {
            Authorization: process.env.HUGGING_FACE_API_KEY,
            "Content-Type": "application/json", // Set content type to JSON
          },
        }
      );

      console.log(
        "this is the response just after sending images for analysis:",
        response.data
      );

      // If we get a successful response, return it
      return response.data;
    } catch (error) {
      if (
        error.response &&
        error.response.status === 503 &&
        error.response.data.error.includes("currently loading")
      ) {
        const estimatedTime = error.response.data.estimated_time || 5000;
        console.log(
          `Model is still loading, retrying in ${estimatedTime} milliseconds...`
        );

        // Wait for the estimated time before retrying
        await new Promise((resolve) => setTimeout(resolve, estimatedTime));
      } else if (error.response && error.response.status === 400) {
        console.error(
          "Error response data(chatgpt rec):",
          error.response?.data
        );

        console.error(
          "Bad request: Ensure you're sending the image in the correct format."
        );
        throw new Error(
          "Failed to process the image with Hugging Face: Bad Request"
        );
      } else {
        console.error(
          "Error sending image to Hugging Face model:",
          error.message
        );
        throw new Error("Failed to process the image with Hugging Face");
      }
    }
  }

  throw new Error("Exceeded retry limit, unable to process the image.");
}

// Function to save analysis results in MongoDB
const saveAnalysisResults = async (sessionId, analysisResults) => {
  if (!Array.isArray(analysisResults)) {
    console.error("Analysis results must be provided as an array");
    return { success: false, message: "Analysis results must be an array" };
  }

  try {
    // Find the session and update it with the analysis results
    const updatedSession = await Session.findOneAndUpdate(
      { sessionId },
      { $set: { modelResponse: analysisResults } },
      { new: true } // Ensures we get the updated session
    );

    if (!updatedSession) {
      console.error("Session not found");
      return { success: false, message: "Session not found" };
    }

    console.log("Analysis results saved successfully:", updatedSession);
    return { success: true, session: updatedSession };
  } catch (error) {
    console.error("Error saving analysis results:", error);
    return { success: false, message: "Error saving analysis results" };
  }
};

module.exports = {
  getSessionMedia,
  sendImageToModel,
  saveAnalysisResults,
};
