import React, { useEffect, useState, useRef } from "react";
import useSessionId from "../hooks/useSessionID";
import useWebcam from "../hooks/useWebcam";
import useCapture from "../hooks/useCapture";
import "../styles/Game.css";
import confetti from "canvas-confetti";
import { useLocation, useNavigate } from "react-router-dom";
import TimerBar from "./TimerBar";
import axios from "axios";

const Game = () => {
  const location = useLocation();
  const { username, gameName } = location.state || {};
  console.log("username:", username);
  console.log("gameName:", gameName);
  const sessionName = username;
  console.log("username as Session Id:", sessionName);

  const { sessionId } = useSessionId();
  console.log(sessionId);
  const { videoRef, webcamGranted, requestWebcamAccess, cameraActive } =
    useWebcam();
  const { canvasRef, captureImage, captureScreenshot } = useCapture(
    videoRef,
    sessionId
  );

  const captureIntervalRef = useRef(null);

  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(2 * 60);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null);
  const [answerStates, setAnswerStates] = useState([]);
  const [hasStarted, setHasStarted] = useState(false);

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true); // Loading state for fetching questions

  useEffect(() => {
    // Fetch questions from the backend when the component mounts
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/child/game/game-1`)
      .then((response) => {
        setShuffledQuestions(response.data); // Assuming the response contains the questions
        setIsLoading(false); // Set loading to false once questions are fetched
      })
      .catch((error) => {
        console.error("Error fetching questions:", error);
        setIsLoading(false); // Set loading to false even if there is an error
      });
  }, []);

  useEffect(() => {
    let timer;
    if (hasStarted && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeRemaining === 0) {
      endGame();
    }
    return () => clearInterval(timer);
  }, [hasStarted, timeRemaining]);

  useEffect(() => {
    return () => {
      // Cleanup: stop the webcam stream when the component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null; // Clear the srcObject
      }
    };
  }, []);

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

  const startCapture = () => {
    console.log("Startcapture function called ");
    setShuffledQuestions(shuffledQuestions.sort(() => Math.random() - 0.5));
    setCurrentQuestionIndex(0);
    setScore(0);
    setTimeRemaining(2 * 60);
    setShowEndScreen(false);
    setSelectedAnswerIndex(null);
    setAnswerStates([]);
    setHasStarted(true);

    if (webcamGranted) {
      captureIntervalRef.current = setInterval(() => {
        captureImage(sessionId, sessionName, gameName);
        captureScreenshot(sessionId, sessionName, gameName);
      }, 10000);
    }
    document.body.classList.remove("correct", "wrong");
    document.body.style.backgroundColor = "";
  };

  const setNextQuestion = () => {
    setSelectedAnswerIndex(null);
    setAnswerStates([]);
    setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
  };

  const selectAnswer = (index, correct) => {
    if (selectedAnswerIndex !== null) return;

    const correctIndex = shuffledQuestions[
      currentQuestionIndex
    ].answers.findIndex((ans) => ans.correct);
    const newAnswerStates = shuffledQuestions[currentQuestionIndex].answers.map(
      (ans, i) => {
        if (i === correctIndex) {
          return "correct";
        }
        if (i === index) {
          return correct ? "correct" : "wrong";
        }
        return "wrong";
      }
    );

    setSelectedAnswerIndex(index);
    setAnswerStates(newAnswerStates);

    if (correct) {
      setScore((prevScore) => prevScore + 1);
      document.body.classList.add("correct");
      speak("Correct!");
    } else {
      document.body.classList.add("wrong");
      speak("Wrong!");
    }

    setTimeout(() => {
      document.body.classList.remove("correct", "wrong");
      document.body.style.backgroundColor = "";

      if (currentQuestionIndex + 1 < shuffledQuestions.length) {
        setNextQuestion();
      } else {
        endGame();
      }
    }, 1000);
  };

  const endGame = () => {
    setShowEndScreen(true);
    clearInterval(captureIntervalRef.current);

    // Stop the webcam stream
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop()); // Stop each track
      videoRef.current.srcObject = null; // Clear the srcObject
    }

    document.body.classList.remove("correct", "wrong");
    document.body.style.backgroundColor = "";
    triggerConfetti();
  };

  const triggerConfetti = () => {
    let particleCount = 500;
    const colorOptions = [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#ffff00",
      "#ff00ff",
      "#00ffff",
      "#ffffff",
    ];

    const createConfetti = () => {
      confetti({
        particleCount: 10,
        spread: 360,
        startVelocity: Math.random() * 15 + 15,
        ticks: 300,
        gravity: 0.6,
        colors: [colorOptions[Math.floor(Math.random() * colorOptions.length)]],
        origin: { x: Math.random(), y: -0.1 },
      });
    };

    const confettiInterval = setInterval(() => {
      createConfetti();
      particleCount -= 10;
      if (particleCount <= 0) {
        clearInterval(confettiInterval);
      }
    }, 30);

    setTimeout(() => clearInterval(confettiInterval), 10000);
  };

  return (
    <div className="game-container">
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

      {!webcamGranted ? (
        <div className="start-screen">
          <button className="btn start-btn" onClick={requestWebcamAccess}>
            Allow access to camera
          </button>
        </div>
      ) : !hasStarted ? (
        <div className="start-screen">
          <button className="btn start-btn" onClick={startCapture}>
            Start game
          </button>
        </div>
      ) : !showEndScreen ? (
        <>
          <div className="timer">
            <div>
              Time Remaining: {Math.floor(timeRemaining / 60)}:
              {(timeRemaining % 60).toString().padStart(2, "0")}
            </div>
            <TimerBar timeRemaining={timeRemaining} />
          </div>
          <div id="question-container">
            <div className="question-text">
              {shuffledQuestions[currentQuestionIndex]?.question}
            </div>
            <img
              src={shuffledQuestions[currentQuestionIndex]?.image}
              alt="Question"
              className="question-img"
            />
            <div className="btn-grid" style={{ textTransform: "none" }}>
              {Array.isArray(
                shuffledQuestions[currentQuestionIndex]?.answers
              ) &&
                shuffledQuestions[currentQuestionIndex]?.answers.map(
                  (answer, index) => (
                    <button
                      key={index}
                      className={`btn ${answerStates[index] || ""}`}
                      onClick={() => selectAnswer(index, answer.correct)}
                      disabled={selectedAnswerIndex !== null}
                      style={{ textTransform: "none" }}
                    >
                      {answer.text}
                    </button>
                  )
                )}
            </div>
          </div>
        </>
      ) : (
        <div className="end-screen">
          <div className="end-message">
            {score === shuffledQuestions.length
              ? "Congrats! You have scored full marks!"
              : "You've Completed the Quiz!"}
          </div>
          <div className="score">
            Your score: {score}/{shuffledQuestions.length}
          </div>
          <button
            className="btn"
            onClick={() =>
              navigate("/select-game", {
                state: {
                  username,
                  gameName,
                },
              })
            }
          >
            Back to games
          </button>
        </div>
      )}
    </div>
  );
};

export default Game;
