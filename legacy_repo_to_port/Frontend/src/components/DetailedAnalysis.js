import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useLocation } from "react-router-dom"; // Import useLocation
import "../styles/DetailedAnalysis.css";
import { useNavigate } from "react-router-dom";
import Navbar from "./Logout_bar";

const ExpressionAnalysis = () => {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const username = localStorage.getItem("username");
  console.log("Username : "+username);
  const userNameOnly = username ? username.split('@')[0] : "User"; 
  console.log("Username : "+username);
  const userNameWithoutNumbers = userNameOnly.replace(/[0-9]/g, '');
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        console.log(1);
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/admin/detailed_sessions/${sessionId}`
        );
        console.log("Fetched session data:", response.data);
        setSessionData(response.data);
        setLoading(false);
      } catch (err) {
        setError("Error fetching session data");
        setLoading(false);
      }
    };
    fetchSessionData();
  }, [sessionId]);

  useEffect(() => {
    if (sessionData) {
      console.log("Updated sessionData:", sessionData);
    }
  }, [sessionData]);

  const calculateHighestEmotion = (emotionArray) => {
    if (!Array.isArray(emotionArray)) {
      console.warn("Expected an array but received:", emotionArray);
      return { label: "N/A", score: 0 }; // Return a default value if not an array
    }

    let highestEmotion = { label: "", score: 0 };

    emotionArray.forEach((emotionObject) => {
      if (emotionObject.score > highestEmotion.score) {
        highestEmotion = {
          label: emotionObject.label,
          score: emotionObject.score * 100, // Convert score to percentage
        };
      }
    });

    return highestEmotion;
  };

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="circular-loader"></div>
      </div>
    );
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (
    !sessionData ||
    !sessionData.imagePaths ||
    !sessionData.screenshotPaths ||
    !sessionData.modelResponse
  ) {
    return <p>No data found for this session.</p>;
  }

  const handleAnalysisClick = () => {
    navigate("/analysis", { state: { username } }); // Navigate to the analysis page
  };

  const handleLogout = () => {
    console.log(`${username} logged out.`);
    navigate("/", { state: { username } }); // Redirect to the home or login page
  };

  return (
    <div className="container-fluid">
      <Navbar username={userNameWithoutNumbers} handleLogout={handleLogout} role="admin" />
      <div className="image-strip-container">
        <h1>DETAILED ANALYSIS</h1>

        <div className="image-strip">
          {Array.isArray(sessionData.imagePaths) && sessionData.imagePaths.length > 0 ? (
            sessionData.imagePaths.map((imagePath, index) => {
              const emotions = sessionData.modelResponse[index];
              const highestEmotion = calculateHighestEmotion(emotions);
              const timestamp = (index + 1) * 10;

              return (
                <div key={index} className="image-box">
                  <div className="time-percentage">
                    {highestEmotion.label}: {highestEmotion.score.toFixed(2)}% -
                    Captured at {timestamp}s
                  </div>
                  <div className="image-container">
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}/${sessionData.screenshotPaths[index]}`}
                      alt={`Screenshot ${index + 1}`}
                    />
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}/${imagePath}`}
                      alt={`Webcam ${index + 1}`}
                    />
                  </div>
                  <div className="detailed-analysis">
                    {emotions.map((emotionObject, emotionIndex) => (
                      <div key={emotionIndex}>
                        {emotionObject.label}:{" "}
                        {(emotionObject.score * 100).toFixed(2)}%
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <p>No images available for this session.</p>
          )}
        </div>
        <div className="text-center mt-4">
          <button className="home-button" onClick={handleAnalysisClick}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpressionAnalysis;
