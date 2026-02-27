import React, { useEffect, useState, useRef } from "react";
import { Chart } from "chart.js/auto";
import axios from "axios";
import { useParams, useNavigate, useLocation } from "react-router-dom"; // Import useNavigate and useLocation
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/OverallAnalysis.css";
import Navbar from "./Logout_bar";

const OverallAnalysis = () => {
  const [emotionAverages, setEmotionAverages] = useState({});
  const { sessionId } = useParams();
  const navigate = useNavigate();
  // const username = localStorage.getItem("username");
  // console.log(username); // Log the username to check
  const username = localStorage.getItem("username");
  console.log("Username : "+username);
  const userNameOnly = username ? username.split('@')[0] : "User"; 
  console.log("Username : "+username);
  const userNameWithoutNumbers = userNameOnly.replace(/[0-9]/g, '');
  const handleLogout = () => {
    console.log(`${username} logged out.`);
    navigate("/"); // Redirect to the home or login page
  };

  // References for the charts
  const donutChartRef = useRef(null);
  const barChartRef = useRef(null);

  useEffect(() => {
    const fetchEmotionData = async () => {
      try {
        console.log(1);
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/admin/sessions/${sessionId}`
        );
        const modelResponse = response.data;

        const emotionTotals = {};
        let count = 0;

        modelResponse.forEach((imageEmotions) => {
          imageEmotions.forEach((emotion) => {
            if (!emotionTotals[emotion.label]) {
              emotionTotals[emotion.label] = 0;
            }
            emotionTotals[emotion.label] += emotion.score;
          });
          count++;
        });

        const averages = {};
        for (const [label, total] of Object.entries(emotionTotals)) {
          averages[label] = (total / count) * 100;
        }

        setEmotionAverages(averages);
      } catch (error) {
        console.error("Error fetching emotion data", error);
      }
    };

    fetchEmotionData();
  }, [sessionId]);

  useEffect(() => {
    if (Object.keys(emotionAverages).length > 0) {
      // Destroy existing donut chart if it exists
      if (donutChartRef.current) {
        donutChartRef.current.destroy();
      }

      // Destroy existing bar chart if it exists
      if (barChartRef.current) {
        barChartRef.current.destroy();
      }

      const ctx1 = document.getElementById("overallChart").getContext("2d");
      const ctx2 = document.getElementById("overallBarChart").getContext("2d");

      const labels = Object.keys(emotionAverages);
      const data = Object.values(emotionAverages);

      // Create Donut Chart
      donutChartRef.current = new Chart(ctx1, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Average Emotions",
              data: data,
              backgroundColor: [
                "#4caf50",
                "#2196f3",
                "#f44336",
                "#ff9800",
                "#9c27b0",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: "top" },
          },
        },
      });

      // Create Bar Chart
      barChartRef.current = new Chart(ctx2, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Average Emotions",
              data: data,
              backgroundColor: [
                "#4caf50",
                "#2196f3",
                "#f44336",
                "#ff9800",
                "#9c27b0",
              ],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "Percentage (%)" },
            },
          },
        },
      });
    }

    // Cleanup function to destroy charts when the component unmounts
    return () => {
      if (donutChartRef.current) donutChartRef.current.destroy();
      if (barChartRef.current) barChartRef.current.destroy();
    };
  }, [emotionAverages]);

  const handleAnalysisClick = () => {
    navigate("/analysis", { state: { username } }); // Navigate to the analysis page if needed
  };
  

  console.log(username);
  return (
    <div>
      <Navbar username={userNameWithoutNumbers} handleLogout={handleLogout} role="admin" />
      <div className=" scrollable-table-container">
        <h1 className="text-center">Overall Expression Analysis</h1>
        <div className="row my-4">
          <div className="col-md-12">
            <h4>Average Emotion Percentages</h4>
            <ul>
              {Object.entries(emotionAverages).map(([emotion, avg]) => (
                <li key={emotion}>
                  {emotion.charAt(0).toUpperCase() + emotion.slice(1)}:{" "}
                  {avg.toFixed(2)}%
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div id="chartContainer" className="row">
          <div className="col-md-6">
            <canvas id="overallChart" width="400" height="400"></canvas>
          </div>
          <div className="col-md-6">
            <canvas id="overallBarChart" width="400" height="400"></canvas>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default OverallAnalysis;
