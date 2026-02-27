import React, { useState, useEffect } from "react";
import "../styles/TimerBar.css";

function TimerBar({ totalSeconds = 120 }) {
  const [seconds, setSeconds] = useState(totalSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prevSeconds => {
        if (prevSeconds > 0) {
          return prevSeconds - 1;
        } else {
          clearInterval(timer); // Clear the interval when time is up
          return 0; // Ensure seconds do not go below 0
        }
      });
    }, 1000);

    return () => clearInterval(timer); // Cleanup on unmount
  }, []); // Run effect only once on mount

  const width = (seconds / totalSeconds) * 100; // Calculate width based on remaining seconds

  return (
    <div className="timer-bar">
      <div className="timer-fill" style={{ width: `${width}%` }}></div>
    </div>
  );
}

export default TimerBar;