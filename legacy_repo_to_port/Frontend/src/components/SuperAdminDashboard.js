import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SuperAdminDashboard.css";

const SuperAdminDashboard = () => {
  const navigate = useNavigate();

  const handleManageGames = () => {
    console.log("Navigating to Manage Games...");
    navigate("/select-game");
  };

  const handleManageAnalysis = () => {
    console.log("Navigating to Manage Analysis...");
    navigate("/analysis");
  };

  const handleManageAdminRequests = () => {
    navigate("/pending-requests");
  };

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Super Admin Dashboard</h1>
      <div className="cards-container">
        <div className="card">
          <h2 className="card-title">Manage Games</h2>
          <p className="card-description">
            View and manage all games created by admins.
          </p>
          <button className="card-button" onClick={handleManageGames}>
            Go to Manage Games
          </button>
        </div>
        <div className="card">
          <h2 className="card-title">Manage Analysis</h2>
          <p className="card-description">
            View detailed analysis and insights of children's progress.
          </p>
          <button className="card-button" onClick={handleManageAnalysis}>
            Go to Manage Analysis
          </button>
        </div>
        <div className="card">
          <h2 className="card-title">Manage Admin Requests</h2>
          <p className="card-description">
            Approve or reject registration requests from admins.
          </p>
          <button className="card-button" onClick={handleManageAdminRequests}>
            Go to Admin Requests
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
