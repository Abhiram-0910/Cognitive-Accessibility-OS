import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Confetti from "react-confetti";
import "../styles/Game_2.css";
import { useLocation } from "react-router-dom";
import useWebcam from "../hooks/useWebcam";
import useSessionId from "../hooks/useSessionID";
import useCapture from "../hooks/useCapture";
import axios from "axios"; // Import axios to make HTTP requests

// Function to handle voice feedback with a check for the speech synthesis
const speak = (text) => {
  if ("speechSynthesis" in window) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);

    // Ensure speech synthesis is active before speaking
    if (synth.speaking) {
      synth.cancel(); // Stop any ongoing speech to avoid overlaps
    }

    // Speak after a short delay to handle any issues with speech initiation
    setTimeout(() => {
      synth.speak(utterance);
    }, 100);
  } else {
    console.warn("Speech synthesis not supported in this browser.");
  }
};

const Game = ({ gameId }) => {
  const [questions, setQuestions] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [completedWord, setCompletedWord] = useState("");
  const [isCorrect, setIsCorrect] = useState(null);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const { username, gameName } = location.state || {};
  const { videoRef, webcamGranted, requestWebcamAccess } = useWebcam();
  const { sessionId } = useSessionId();
  const { canvasRef, captureImage, captureScreenshot } = useCapture(
    videoRef,
    sessionId
  );

  // Debug logs for troubleshooting
  console.log("Game 2 Component - Debug Info:", {
    questions,
    currentLevel,
    currentQuestion: questions[currentLevel],
  });

  // Comprehensive debug logs
  console.log("Game 2 Component - Debug Info:", {
    fullLocation: location,
    locationState: location.state,
    extractedUsername: username,
    extractedGameName: gameName,
  });

  useEffect(() => {
    const fetchGameQuestions = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/child/game/game-2`
        );
        setQuestions(response.data || []);
        if (response.data.length > 0) {
          setCompletedWord(response.data[0]?.word || "");
        }
        setIsLoading(false); // Set loading to false when data is fetched
      } catch (error) {
        console.error("Error fetching game questions:", error);
        setIsLoading(false);
      }
    };
    fetchGameQuestions();
  }, [gameId]);

  useEffect(() => {
    return () => clearInterval(intervalId); // Cleanup the interval
  }, [intervalId]);

  const startGame = () => {
    console.log("Game 2 - StartGame Debug Info:", {
      sessionId,
      username,
      gameName,
      webcamGranted,
    });

    setGameStarted(true);
    const id = setInterval(() => {
      console.log("Game 2 - Capture Interval Debug Info:", {
        sessionId,
        username,
        gameName,
      });
      captureImage(sessionId, username || `Child_${sessionId}`, gameName);
      captureScreenshot(sessionId, username || `Child_${sessionId}`, gameName);
    }, 10000);

    setIntervalId(id);
  };

  const handleDrop = (letter) => {
    const currentQuestion = questions[currentLevel];
    if (!currentQuestion) return;

    const { correctLetter, word } = currentQuestion;
    if (letter === correctLetter) {
      setIsCorrect(true);
      setCompletedWord(word.replace("_", letter));
      speak("Correct!");

      setTimeout(() => {
        if (currentLevel < questions.length - 1) {
          setCurrentLevel(currentLevel + 1);
          setCompletedWord(questions[currentLevel + 1]?.word || "");
          setIsCorrect(null);
        } else {
          clearInterval(intervalId);
          setShowEndScreen(true);
          stopWebcamStream();
        }
      }, 1500);
    } else {
      setIsCorrect(false);
      speak("Try again!");
    }
  };

  // Stop the webcam stream
  const stopWebcamStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop()); // Stop each track
      videoRef.current.srcObject = null; // Clear the srcObject
    }
  };

  const currentQuestion = questions[currentLevel] || {};
  const { image = "", options = [] } = currentQuestion;

  if (showEndScreen) {
    stopWebcamStream(); // Stop the webcam when the game ends
    return <EndScreen />;
  }

  return (
    <div className="game-container">
      <h3
        className="mb-4 display-4"
        style={{ fontFamily: "Comic Sans MS, sans-serif",fontSize:"20px" }} 
      >
        Drag & Spell the word!
      </h3>
      {!webcamGranted && (
        <button className="btn2" onClick={requestWebcamAccess} >
          ALLOW ACCESS TO CAMERA
        </button>
      )}
      {webcamGranted && !gameStarted && (
        <button className="btn2" onClick={startGame} >
          START GAME
        </button>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ display: "none" }}
      ></video>
      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
        width="640"
        height="480"
      ></canvas>
      {gameStarted && (
        <>
          <WordWithImage
            word={completedWord}
            image={image}
            isCorrect={isCorrect}
            handleDrop={handleDrop}
            
          />
          <div className="options d-flex justify-content-center mt-4" >
            {options.map((letter, index) => (
              <LetterOption key={index} letter={letter} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const WordWithImage = ({ word, image, isCorrect, handleDrop }) => {
  const getBackgroundColor = () => {
    if (isCorrect === null) return "white";
    return isCorrect ? "lightgreen" : "lightcoral";
  };

  const onDrop = (e) => {
    e.preventDefault();
    const droppedLetter = e.dataTransfer.getData("letter");
    handleDrop(droppedLetter);
  };

  return (
    <div
      className="word-container"
      style={{
        backgroundColor: getBackgroundColor(),
        borderRadius: "15px",
        transition: "background-color 0.3s ease",
        position: "relative",
      }}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <img
        src={image}
        alt="object to guess"
        className="img-fluid mb-3 rounded"
        style={{ width: "150px" }}
      />
      <h1
        className="display-3 font-weight-bold"
        style={{ fontFamily: "Comic Sans MS, sans-serif", color: "#5a189a" }}
      >
        {word}
      </h1>

      {/* Show thumbs-up emoji if answer is correct */}
      {isCorrect && (
        <span
          className="thumbs-up"
          style={{
            fontSize: "3rem",
            color: "green",
            position: "absolute",
            top: "10px",
            right: "10px",
            transition: "opacity 0.3s ease",
          }}
        >
          👍
        </span>
      )}
    </div>
  );
};

const LetterOption = ({ letter }) => {
  const onDragStart = (e) => {
    e.dataTransfer.setData("letter", letter);
  };

  return (
    <div
      className="letter-option btn btn-warning m-2"
      draggable
      onDragStart={onDragStart}
      style={{
        width: "50px",
        height: "50px",
        fontSize: "1.5rem",
        fontFamily: "Comic Sans MS, sans-serif",
        color: "#FFFFFF",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textTransform: "none" 
      }}
    >
      {letter}
    </div>
  );
};

// End Screen component with confetti effect
const EndScreen = () => {
  return (
    <div className="end-screen text-center p-5">
      <Confetti />
      <h1
        className="display-2 font-weight-bold"
        style={{ fontFamily: "Comic Sans MS, sans-serif", color: "#4CAF50" }}
      >
        Well Done!
      </h1>
      <p
        className="lead"
        style={{ fontFamily: "Comic Sans MS, sans-serif", color: "#555" }}
      >
        You've completed all the levels.
      </p>
      <button
        className="btn2"
        onClick={() => (window.location.href = "/select-game")}
      >
        Back to Games
      </button>
    </div>
  );
};

export default Game;
